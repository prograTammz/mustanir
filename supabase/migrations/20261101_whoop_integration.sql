-- Al-Mustanir: WHOOP replaces Apple Health. Run once in Supabase → SQL Editor.
create table public.whoop_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  whoop_user_id bigint,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  scope text,
  updated_at timestamptz not null default now()
);
alter table public.whoop_tokens enable row level security;

create table public.whoop_states (
  state text primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.whoop_states enable row level security;

create table public.whoop_status (
  user_id uuid primary key references auth.users on delete cascade,
  whoop_user_id bigint,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  records integer not null default 0
);
alter table public.whoop_status enable row level security;
create policy "own whoop status" on public.whoop_status for select to authenticated using (user_id = (select auth.uid()));

create table public.whoop_records (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('cycle', 'sleep', 'recovery', 'workout', 'body')),
  id text not null,
  day date,
  start_at timestamptz,
  end_at timestamptz,
  data jsonb not null,
  received_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);
alter table public.whoop_records enable row level security;
create policy "own whoop records" on public.whoop_records for select to authenticated using (user_id = (select auth.uid()));
create index whoop_records_day_idx on public.whoop_records (user_id, kind, day);

-- Apple Health off switch (settings.healthSource = 'whoop', set when WHOOP connects).
create or replace function public.apple_health_off(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.data->>'healthSource' from public.settings s where s.user_id = p_user), '') = 'whoop';
$$;
revoke execute on function public.apple_health_off(uuid) from public, anon, authenticated;

create or replace function public.drop_apple_health() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.apple_health_off(new.user_id) then return null; end if;
  return new;
end $$;
create trigger drop_apple_health before insert on public.health_samples for each row execute function public.drop_apple_health();
create trigger drop_apple_health before insert on public.health_workouts for each row execute function public.drop_apple_health();

create or replace function public.days_ignore_apple() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.data->>'source', '') like 'Apple Health%' and public.apple_health_off(new.user_id) then
    return case when tg_op = 'UPDATE' then old else null end;
  end if;
  return new;
end $$;
create trigger days_ignore_apple before insert or update on public.days for each row execute function public.days_ignore_apple();

create or replace function public.health_rollup(p_user uuid, p_from date, p_to date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.apple_health_off(p_user) then return; end if;
  delete from public.health_daily d where d.user_id = p_user and d.day between p_from and p_to;
  with s as (
    select s.*, bool_or(s.source = 'HAE history') over (partition by s.day, s.metric) as has_hist
    from public.health_samples s where s.user_id = p_user and s.day between p_from and p_to)
  insert into public.health_daily(user_id, day, metric, value, min_value, max_value, samples)
  select s.user_id, s.day, s.metric,
    case coalesce(m.agg, 'avg')
      when 'sum' then sum(s.value)
      when 'minutes' then sum(s.value)
      when 'last' then (array_agg(s.value order by s.end_at desc))[1]
      when 'min' then min(s.value)
      when 'max' then max(s.value)
      else avg(s.value) end,
    min(s.value), max(s.value), count(*)
  from s left join public.health_metrics m on m.key = s.metric
  where (s.source = 'HAE history') = s.has_hist
  group by s.user_id, s.day, s.metric, m.agg;
end $$;

insert into public.health_metrics (key, label, unit, agg, category, aliases, better, sort) values
  ('recovery', 'Recovery', '%', 'avg', 'recovery', '{}', 1, -20),
  ('strain', 'Day strain', '', 'max', 'recovery', '{}', 0, -19),
  ('sleepPerformance', 'Sleep performance', '%', 'avg', 'sleep', '{}', 1, -18),
  ('sleepConsistency', 'Sleep consistency', '%', 'avg', 'sleep', '{}', 1, -17),
  ('sleepEfficiency', 'Sleep efficiency', '%', 'avg', 'sleep', '{}', 1, -16),
  ('sleepNeed', 'Sleep needed', 'min', 'minutes', 'sleep', '{}', 0, -15),
  ('sleepDebt', 'Sleep debt', 'min', 'minutes', 'sleep', '{}', -1, -14),
  ('napMin', 'Naps', 'min', 'minutes', 'sleep', '{}', 0, -13),
  ('sleepCycles', 'Sleep cycles', '', 'avg', 'sleep', '{}', 0, -12),
  ('disturbances', 'Sleep disturbances', '', 'avg', 'sleep', '{}', -1, -11),
  ('totalKcal', 'Energy burned', 'kcal', 'sum', 'activity', '{}', 0, -10),
  ('maxHR', 'Max heart rate', 'bpm', 'max', 'heart', '{}', 0, -9),
  ('skinTemp', 'Skin temperature', '°C', 'avg', 'vitals', '{}', 0, -8),
  ('workoutMin', 'Workout time', 'min', 'sum', 'activity', '{}', 1, -7),
  ('workoutKm', 'Workout distance', 'km', 'sum', 'activity', '{}', 0, -6),
  ('zone1Min', 'Heart-rate zone 1', 'min', 'sum', 'activity', '{}', 0, -5),
  ('zone2Min', 'Heart-rate zone 2', 'min', 'sum', 'activity', '{}', 1, -4),
  ('zone3Min', 'Heart-rate zone 3', 'min', 'sum', 'activity', '{}', 1, -3),
  ('zone4Min', 'Heart-rate zone 4', 'min', 'sum', 'activity', '{}', 0, -2),
  ('zone5Min', 'Heart-rate zone 5', 'min', 'sum', 'activity', '{}', 0, -1)
on conflict (key) do nothing;

-- Hourly safety net (webhooks can be missed; cycles have none).
select cron.schedule('mustanir-whoop', '7 * * * *', $$
  select net.http_post(
    url := 'https://qanzhisoxueaizscdial.supabase.co/functions/v1/whoop/poll',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-token', (select value from public.app_secrets where name = 'cron_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000);
$$);
