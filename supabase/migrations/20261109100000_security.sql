-- Security review, 9 Nov 2026.
-- 1. pg_net lived in the public schema (Supabase advisor warning). Reinstall it in the extensions schema.
--    Its functions stay in the net schema, so the reminder schedule (net.http_post) keeps working.
--    Only requests still waiting in pg_net's queue at that moment are lost; the schedule runs again in 5 minutes.
drop extension if exists pg_net;
create extension pg_net with schema extensions;

-- 2. Trigger functions are not part of the API. Triggers still run without these grants.
revoke execute on function public.start_trial() from public, anon, authenticated;
revoke execute on function public.touch_doc() from public, anon, authenticated;
revoke execute on function public.contact_to_ticket() from public, anon, authenticated;

