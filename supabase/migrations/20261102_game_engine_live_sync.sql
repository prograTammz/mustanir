-- ADR-0001: one game engine on both sides, patch writes and live sync.

/* ---------- the player, as the server sees it ---------- */
create table if not exists public.player_state (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  level        int  not null default 1,
  xp           int  not null default 0,
  rank_en      text,
  rank_ar      text,
  day          date,             -- the day "today_*" describes, in the player's time zone
  today_xp     int  not null default 0,
  today_max    int  not null default 0,
  streak       int  not null default 0,
  medals_won   int  not null default 0,
  medals_total int  not null default 0,
  data         jsonb not null default '{}'::jsonb, -- ministers, open items, streaks, closest medals
  computed_at  timestamptz not null default now()
);
alter table public.player_state enable row level security;
drop policy if exists "own player state" on public.player_state;
create policy "own player state" on public.player_state for select using ((select auth.uid()) = user_id);

create table if not exists public.medal_awards (
  user_id  uuid not null references auth.users (id) on delete cascade,
  medal_id text not null,
  won_on   date,
  won_at   timestamptz not null default now(),
  primary key (user_id, medal_id)
);
alter table public.medal_awards enable row level security;
drop policy if exists "own medal awards" on public.medal_awards;
create policy "own medal awards" on public.medal_awards for select using ((select auth.uid()) = user_id);

-- Level-ups and medals. origin 'server' (WHOOP, FatSecret) become pushes; 'app' ones were already celebrated on screen.
create table if not exists public.game_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('level_up', 'medal')),
  payload     jsonb not null default '{}'::jsonb,
  origin      text not null default 'app' check (origin in ('app', 'server')),
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists game_events_pending_idx on public.game_events (created_at) where notified_at is null;
create index if not exists game_events_user_idx on public.game_events (user_id, created_at desc);
alter table public.game_events enable row level security;
drop policy if exists "own game events" on public.game_events;
create policy "own game events" on public.game_events for select using ((select auth.uid()) = user_id);

/* ---------- patch writes ---------- */
-- The phone sends only the keys it changed; Postgres merges them in one statement (a null removes a key),
-- so a WHOOP write landing at the same moment is never overwritten.
create or replace function public.save_day(p_date date, p_patch jsonb, p_scores jsonb default null)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  insert into public.days as d (user_id, date, data, scores)
  values ((select auth.uid()), p_date, jsonb_strip_nulls(coalesce(p_patch, '{}'::jsonb)), coalesce(p_scores, '{}'::jsonb))
  on conflict (user_id, date) do update
    set data = jsonb_strip_nulls(d.data || coalesce(p_patch, '{}'::jsonb)),
        scores = coalesce(p_scores, d.scores)
  returning d.updated_at;
$$;
revoke all on function public.save_day(date, jsonb, jsonb) from public, anon;
grant execute on function public.save_day(date, jsonb, jsonb) to authenticated;

-- Incremental reads: "what changed since my cursor".
create index if not exists days_user_updated_idx on public.days (user_id, updated_at);

/* ---------- the engine runs after every write ---------- */
-- One call per user per statement (a WHOOP sync upserting 30 days is one call), through pg_net, so writes never wait.
create or replace function public.days_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  tok text;
  who text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'server');
begin
  select value into tok from public.app_secrets where name = 'cron_token';
  for r in select distinct user_id from new_rows where user_id is not null loop
    perform net.http_post(
      url := 'https://qanzhisoxueaizscdial.supabase.co/functions/v1/game/recompute',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', tok),
      body := jsonb_build_object('user_id', r.user_id, 'origin', case when who = 'authenticated' then 'app' else 'server' end),
      timeout_milliseconds := 8000
    );
  end loop;
  return null;
end $$;
revoke all on function public.days_changed() from public, anon, authenticated;

drop trigger if exists days_changed_ins on public.days;
drop trigger if exists days_changed_upd on public.days;
create trigger days_changed_ins after insert on public.days referencing new table as new_rows for each statement execute function public.days_changed();
create trigger days_changed_upd after update on public.days referencing new table as new_rows for each statement execute function public.days_changed();

/* ---------- live sync ---------- */
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'days') then
    alter publication supabase_realtime add table public.days;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'player_state') then
    alter publication supabase_realtime add table public.player_state;
  end if;
end $$;

/* ---------- advisors ---------- */
revoke execute on function public.days_ignore_apple() from public, anon, authenticated;
revoke execute on function public.drop_apple_health() from public, anon, authenticated;
create index if not exists whoop_states_user_idx on public.whoop_states (user_id);
create index if not exists fatsecret_states_user_idx on public.fatsecret_states (user_id);

-- The walking pad is gone (WHOOP records walks); its table was never used.
drop index if exists public.walkpad_open_idx;
drop table if exists public.walkpad_sessions;

/* ---------- hourly: midnight rollover, Sunday weigh-ins and anything a trigger missed ---------- */
select cron.schedule('mustanir-game', '2 * * * *', $cron$
  select net.http_post(
    url := 'https://qanzhisoxueaizscdial.supabase.co/functions/v1/game/all',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', (select value from public.app_secrets where name = 'cron_token')),
    body := '{}'::jsonb, timeout_milliseconds := 20000);
$cron$);
