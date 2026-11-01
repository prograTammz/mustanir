-- FatSecret: meals logged in the FatSecret app (photo, barcode or search) flow into `meals` automatically.
alter table public.meals add column if not exists source text, add column if not exists external_id text;
create unique index if not exists meals_source_external on public.meals (user_id, source, external_id); -- NULL ids (hand-logged meals) never collide

create table public.fatsecret_tokens (            -- service role only
  user_id uuid primary key references auth.users on delete cascade,
  token text not null,
  secret text not null,
  updated_at timestamptz not null default now()
);
alter table public.fatsecret_tokens enable row level security;

create table public.fatsecret_states (            -- OAuth 1.0 request tokens, minutes-long
  token text primary key,
  secret text not null,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.fatsecret_states enable row level security;

create table public.fatsecret_status (
  user_id uuid primary key references auth.users on delete cascade,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text
);
alter table public.fatsecret_status enable row level security;
create policy "own fatsecret status" on public.fatsecret_status for select to authenticated using (user_id = (select auth.uid()));

-- Hourly, a few minutes before the WHOOP poll so each deficit uses the newest meals.
select cron.schedule('mustanir-fatsecret', '2 * * * *', $$
  select net.http_post(
    url := 'https://qanzhisoxueaizscdial.supabase.co/functions/v1/fatsecret/poll',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-token', (select value from public.app_secrets where name = 'cron_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000);
$$);
