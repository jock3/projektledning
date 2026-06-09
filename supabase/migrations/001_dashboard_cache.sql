-- Cache-tabell för projektdashboards — en rad per projekt
CREATE TABLE IF NOT EXISTS public.dashboard_cache (
  project_key  TEXT        PRIMARY KEY,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data         JSONB       NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.dashboard_cache ENABLE ROW LEVEL SECURITY;

-- Dashboarden är publik (ingen autentisering krävs)
CREATE POLICY "allow_public_read" ON public.dashboard_cache
  FOR SELECT USING (true);

-- Endast service_role (Edge Function) får skriva
CREATE POLICY "allow_service_write" ON public.dashboard_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Supabase Realtime — frontend uppdateras automatiskt vid upsert
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_cache;

-- pg_cron: trigga sync-dashboard var 15:e minut
-- Kräver att pg_cron och pg_net är aktiverade i projektet (Dashboard → Extensions).
-- Ersätt <PROJECT_REF> och <SERVICE_ROLE_KEY> med faktiska värden.
--
-- SELECT cron.schedule(
--   'sync-gloweb',
--   '*/15 * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/sync-dashboard',
--     headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
--     body    := '{}'::jsonb
--   )
--   $$
-- );
