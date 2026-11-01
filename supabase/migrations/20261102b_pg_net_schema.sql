-- Advisor 0014: pg_net out of the public schema. Its functions live in `net` either way, so cron jobs and triggers are unaffected.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
