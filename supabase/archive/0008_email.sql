-- Emails sent through Resend by /api/reminders (runs every 5 minutes):
-- support replies to the customer, new-request alerts to the team, and trial-ending reminders to parents.
create table if not exists public.email_log (key text primary key, sent_at timestamptz not null default now());
alter table public.email_log enable row level security;

create or replace function public.email_feed(p_secret text) returns json
language plpgsql stable security definer set search_path to 'public', 'private', 'auth' as $$
declare since timestamptz := '2026-10-12 18:00:00+00';
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return json_build_object(
    'replies', (select coalesce(json_agg(json_build_object(
        'key', 'tm:' || m.id, 'to', t.email, 'name', t.name, 'number', t.number, 'subject', t.subject, 'body', m.body, 'source', t.source)), '[]')
      from ticket_messages m join tickets t on t.id = m.ticket_id
      where m.author = 'team' and not m.internal and m.created_at > since and t.email is not null
        and not exists (select 1 from email_log l where l.key = 'tm:' || m.id)),
    'new_tickets', (select coalesce(json_agg(json_build_object(
        'key', 'tk:' || t.id, 'number', t.number, 'subject', t.subject, 'email', t.email, 'name', t.name, 'source', t.source, 'category', t.category,
        'body', (select body from ticket_messages m where m.ticket_id = t.id and m.author = 'customer' order by created_at limit 1))), '[]')
      from tickets t where t.created_at > since and not exists (select 1 from email_log l where l.key = 'tk:' || t.id)),
    'team', (select coalesce(json_agg(email), '[]') from admin_emails),
    'trials', (select coalesce(json_agg(json_build_object(
        'key', 'tr:' || s.tribe_code || ':' || to_char(s.trial_ends_at, 'YYYY-MM-DD'), 'tribe', tr.name, 'ends', s.trial_ends_at,
        'to', (select coalesce(json_agg(lower(u.email)), '[]') from memberships mm join auth.users u on u.id = mm.user_id
               where mm.tribe_code = s.tribe_code and mm.status = 'active' and mm.role = 'parent'))), '[]')
      from subscriptions s join tribes tr on tr.code = s.tribe_code
      where s.status = 'trialing' and tr.deleted_at is null and s.trial_ends_at between now() and now() + interval '48 hours'
        and not exists (select 1 from email_log l where l.key = 'tr:' || s.tribe_code || ':' || to_char(s.trial_ends_at, 'YYYY-MM-DD')))
  );
end $$;

create or replace function public.email_done(p_secret text, p_keys text[]) returns void
language plpgsql security definer set search_path to 'public', 'private' as $$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into email_log(key) select unnest(coalesce(p_keys, '{}')) on conflict do nothing;
end $$;

revoke execute on function public.email_feed(text), public.email_done(text, text[]) from public;
grant execute on function public.email_feed(text), public.email_done(text, text[]) to anon, authenticated;
