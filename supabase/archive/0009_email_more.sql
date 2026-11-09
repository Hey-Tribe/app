-- More HeyTribe emails: family welcome, join requests and approvals, Premium started / payment problem / canceled,
-- and deletion confirmations. Sent once each by /api/reminders through Resend.
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
        and not exists (select 1 from email_log l where l.key = 'tr:' || s.tribe_code || ':' || to_char(s.trial_ends_at, 'YYYY-MM-DD'))),
    'welcomes', (select coalesce(json_agg(json_build_object('key', 'tw:' || tr.code, 'to', lower(u.email), 'tribe', tr.name, 'code', tr.code)), '[]')
      from tribes tr join auth.users u on u.id = tr.created_by
      where tr.created_at > since and tr.deleted_at is null and tr.code <> 'SAMPLE'
        and not exists (select 1 from email_log l where l.key = 'tw:' || tr.code)),
    'join_requests', (select coalesce(json_agg(json_build_object('key', 'jr:' || m.tribe_code || ':' || m.user_id, 'tribe', tr.name, 'who', lower(u.email),
        'to', (select coalesce(json_agg(lower(pu.email)), '[]') from memberships pm join auth.users pu on pu.id = pm.user_id
               where pm.tribe_code = m.tribe_code and pm.status = 'active' and pm.role = 'parent'))), '[]')
      from memberships m join tribes tr on tr.code = m.tribe_code join auth.users u on u.id = m.user_id
      where m.status = 'pending' and m.removed_at is null and m.joined_at > since and tr.deleted_at is null
        and not exists (select 1 from email_log l where l.key = 'jr:' || m.tribe_code || ':' || m.user_id)),
    'approvals', (select coalesce(json_agg(json_build_object('key', 'ja:' || m.tribe_code || ':' || m.user_id, 'to', lower(u.email), 'tribe', tr.name, 'role', m.role)), '[]')
      from memberships m join tribes tr on tr.code = m.tribe_code join auth.users u on u.id = m.user_id
      where m.status = 'active' and m.joined_at > since and m.user_id is distinct from tr.created_by and tr.deleted_at is null
        and not exists (select 1 from email_log l where l.key = 'ja:' || m.tribe_code || ':' || m.user_id)),
    'billing', (select coalesce(json_agg(json_build_object(
        'key', case s.status when 'active' then 'pa:' || s.stripe_subscription_id
                             when 'past_due' then 'pd:' || s.stripe_subscription_id || ':' || to_char(coalesce(s.current_period_end, s.updated_at), 'YYYY-MM-DD')
                             else 'pc:' || s.stripe_subscription_id end,
        'kind', s.status, 'tribe', tr.name, 'period_end', s.current_period_end,
        'to', (select coalesce(json_agg(lower(pu.email)), '[]') from memberships pm join auth.users pu on pu.id = pm.user_id
               where pm.tribe_code = s.tribe_code and pm.status = 'active' and pm.role = 'parent'))), '[]')
      from subscriptions s join tribes tr on tr.code = s.tribe_code
      where s.stripe_subscription_id is not null and s.status in ('active', 'past_due', 'canceled') and s.updated_at > since
        and not exists (select 1 from email_log l where l.key = case s.status when 'active' then 'pa:' || s.stripe_subscription_id
                             when 'past_due' then 'pd:' || s.stripe_subscription_id || ':' || to_char(coalesce(s.current_period_end, s.updated_at), 'YYYY-MM-DD')
                             else 'pc:' || s.stripe_subscription_id end)),
    'deletions', (select coalesce(json_agg(json_build_object('key', 'dr:' || d.id, 'to', d.email, 'kind', d.kind,
        'tribe', (select name from tribes where code = d.tribes[1]))), '[]')
      from deletion_requests d where d.requested_at > since and d.email is not null
        and not exists (select 1 from email_log l where l.key = 'dr:' || d.id))
  );
end $$;
