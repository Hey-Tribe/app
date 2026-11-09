-- Hey Tribe database baseline: the live schema as of 9 Nov 2026, generated from the production project.
-- Older migrations (0001-0013) are kept in supabase/archive for history. Every change after this file is a new
-- migration in this folder, applied to production with the same SQL, so a fresh local database matches production.
-- CI starts a local database from this folder, runs the RLS tests in supabase/tests and checks the generated types.
set check_function_bodies = off;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- Server-only settings and counters. No API role can reach this schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.ai_usage (
  bucket text not null,
  day date not null,
  calls integer default 0 not null
);
alter table private.ai_usage add constraint ai_usage_pkey PRIMARY KEY (bucket, day);
create table private.app_secrets (
  name text not null,
  value text not null
);
alter table private.app_secrets add constraint app_secrets_pkey PRIMARY KEY (name);

create sequence if not exists public.site_submissions_id_seq as bigint start 1 increment 1;

-- Functions
CREATE OR REPLACE FUNCTION public.admin_activation()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  with s as (select id, created_at from auth.users where created_at between now() - interval '90 days' and now() - interval '7 days')
  select json_build_object(
    'label', 'Created or joined a family',
    'signups', (select count(*) from s),
    'activated', (select count(*) from s where exists (select 1 from tribes x where x.created_by = s.id and x.created_at <= s.created_at + interval '7 days') or exists (select 1 from memberships m where m.user_id = s.id))
  );
$function$
;
CREATE OR REPLACE FUNCTION public.admin_daily(p_days integer DEFAULT 30)
 RETURNS TABLE(day date, signups bigint, tribes bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select d::date,
    (select count(*) from auth.users u where u.created_at >= d and u.created_at < d + interval '1 day'),
    (select count(*) from tribes t where t.code <> 'SAMPLE' and t.created_at >= d and t.created_at < d + interval '1 day')
  from generate_series(date_trunc('day', now()) - make_interval(days => greatest(1, least(p_days, 365)) - 1), date_trunc('day', now()), interval '1 day') d
  order by 1;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_db_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tables', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'),
    'rls_off', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
    'open_to_anon', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
    'largest', (select coalesce(json_agg(t), '[]'::json) from (select c.relname as name, pg_total_relation_size(c.oid) as bytes from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by pg_total_relation_size(c.oid) desc limit 3) t),
    'users', (select count(*) from auth.users),
    'checked_at', now()
  );
$function$
;
CREATE OR REPLACE FUNCTION public.admin_errors(p_days integer DEFAULT 7)
 RETURNS TABLE(area text, message text, n bigint, visitors bigint, last_at timestamp with time zone, path text, source text, line integer, ua text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select e.area, e.message, count(*), count(distinct e.vid), max(e.at),
           (array_agg(e.path order by e.at desc))[1], (array_agg(e.source order by e.at desc))[1],
           (array_agg(e.line order by e.at desc))[1], (array_agg(e.ua order by e.at desc))[1]
    from client_errors e where e.at > now() - make_interval(days => greatest(p_days, 1))
    group by e.area, e.message order by max(e.at) desc limit 100;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_set_subscription(p_code text, p_status text, p_trial_days integer DEFAULT NULL::integer, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into subscriptions(tribe_code, status) values (p_code, p_status) on conflict (tribe_code) do update set status = excluded.status;
  update subscriptions set
    trial_ends_at = case when p_trial_days is not null then greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => p_trial_days) else trial_ends_at end,
    note = coalesce(p_note, note), updated_at = now()
  where tribe_code = p_code;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_stats()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'users_total',   (select count(*) from auth.users),
    'users_7d',      (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_today',   (select count(*) from auth.users where created_at >= date_trunc('day', now())),
    'unconfirmed',   (select count(*) from auth.users where email_confirmed_at is null),
    'tribes_total',  (select count(*) from tribes where code <> 'SAMPLE'),
    'tribes_7d',     (select count(*) from tribes where code <> 'SAMPLE' and created_at > now() - interval '7 days'),
    'tribes_active', (select count(distinct tribe_code) from docs where tribe_code <> 'SAMPLE' and updated_at > now() - interval '7 days'),
    'people_total',  (select count(*) from docs where col = 'members' and tribe_code <> 'SAMPLE'),
    'items_total',   (select count(*) from docs where tribe_code <> 'SAMPLE'),
    'trialing',      (select count(*) from subscriptions where status = 'trialing' and trial_ends_at > now()),
    'trial_expired', (select count(*) from subscriptions where status = 'trialing' and trial_ends_at <= now()),
    'active',        (select count(*) from subscriptions where status = 'active'),
    'past_due',      (select count(*) from subscriptions where status = 'past_due'),
    'canceled',      (select count(*) from subscriptions where status = 'canceled'),
    'comped',        (select count(*) from subscriptions where status = 'comped'),
    'inbox_new',     (select count(*) from site_submissions where status = 'new'),
    'visitors_7d',   (select count(distinct vid) from page_views where at > now() - interval '7 days'),
    'errors_24h',    (select count(*) from client_errors where at > now() - interval '24 hours'),
    'tickets_open',  (select count(*) from tickets where status = 'open'),
    'tickets_waiting', (select count(*) from tickets where status = 'waiting'),
    'tickets_urgent',  (select count(*) from tickets where status = 'open' and priority in ('high','urgent')),
    'tickets_oldest_hours', (select round(extract(epoch from now() - min(updated_at)) / 3600) from tickets where status = 'open')
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_ticket_new(p_email text, p_subject text, p_body text, p_category text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare me text; uid uuid; t record;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select lower(email) into me from auth.users where id = auth.uid();
  select id into uid from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  insert into tickets(source, user_id, email, subject, category, status, last_from, team_last_at, assignee, message_count)
  values ('admin', uid, lower(btrim(p_email)), left(btrim(p_subject),140), coalesce(nullif(p_category,''),'question'), 'waiting', 'team', now(), me, 1)
  returning id, number into t;
  insert into ticket_messages(ticket_id, author, author_email, body) values (t.id, 'team', me, left(btrim(p_body),5000));
  return json_build_object('id', t.id, 'number', t.number, 'in_app', uid is not null);
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_ticket_reply(p_ticket uuid, p_body text, p_internal boolean, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare me text;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  p_body := btrim(coalesce(p_body,'')); if p_body = '' then raise exception 'message required' using errcode = '22023'; end if;
  select lower(email) into me from auth.users where id = auth.uid();
  insert into ticket_messages(ticket_id, author, author_email, internal, body) values (p_ticket, 'team', me, coalesce(p_internal,false), left(p_body,5000));
  if coalesce(p_internal,false) then
    update tickets set updated_at = now(), assignee = coalesce(assignee, me) where id = p_ticket;
  else
    update tickets set status = case when p_status in ('open','waiting','resolved') then p_status else 'waiting' end,
      last_from = 'team', team_last_at = now(), updated_at = now(), assignee = coalesce(assignee, me), message_count = message_count + 1 where id = p_ticket;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_ticket_update(p_ticket uuid, p_status text, p_priority text, p_category text, p_assignee text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update tickets set
    status   = case when p_status in ('open','waiting','resolved') then p_status else status end,
    priority = case when p_priority in ('low','normal','high','urgent') then p_priority else priority end,
    category = case when p_category in ('question','bug','billing','account','idea','other') then p_category else category end,
    assignee = case when p_assignee is null then assignee when p_assignee = '' then null else lower(p_assignee) end,
    updated_at = now()
  where id = p_ticket;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_tickets(p_status text DEFAULT 'active'::text, p_q text DEFAULT ''::text)
 RETURNS TABLE(id uuid, number bigint, created_at timestamp with time zone, updated_at timestamp with time zone, source text, email text, name text, tribe_code text, tribe_name text, subject text, category text, priority text, status text, assignee text, last_from text, message_count integer, preview text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare me text := (select lower(u.email) from auth.users u where u.id = auth.uid());
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select t.id, t.number, t.created_at, t.updated_at, t.source, t.email, t.name, t.tribe_code, tr.name, t.subject, t.category, t.priority, t.status, t.assignee, t.last_from, t.message_count,
           (select left(m.body, 160) from ticket_messages m where m.ticket_id = t.id and not m.internal order by m.created_at desc limit 1)
    from tickets t left join tribes tr on tr.code = t.tribe_code
    where (p_status = 'all' or (p_status = 'active' and t.status <> 'resolved') or t.status = p_status or (p_status = 'mine' and t.assignee = me and t.status <> 'resolved'))
      and (coalesce(p_q,'') = '' or t.subject ilike '%'||p_q||'%' or t.email ilike '%'||p_q||'%' or t.number::text = btrim(p_q, '# ') or coalesce(t.name,'') ilike '%'||p_q||'%')
    order by case t.priority when 'urgent' then 0 when 'high' then 1 else 2 end, case when t.status = 'open' then 0 when t.status = 'waiting' then 1 else 2 end, t.updated_at desc
    limit 300;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_traffic(p_days integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1);
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'views',    (select count(*) from page_views where at >= since),
    'visitors', (select count(distinct vid) from page_views where at >= since),
    'app_opens',(select count(distinct vid) from page_views where at >= since and path like '/app%'),
    'daily', (select coalesce(json_agg(x order by x.day), '[]') from (
        select d::date as day, count(v.id) as views, count(distinct v.vid) as visitors
        from generate_series(since, date_trunc('day', now()), interval '1 day') d
        left join page_views v on v.at >= d and v.at < d + interval '1 day'
        group by d) x),
    'pages', (select coalesce(json_agg(x), '[]') from (
        select path, count(*) as views, count(distinct vid) as visitors from page_views where at >= since
        group by path order by count(*) desc limit 12) x),
    'sources', (select coalesce(json_agg(x), '[]') from (
        select coalesce(v.src, s.src) as src, coalesce(v.visitors, 0) as visitors, coalesce(s.signups, 0) as signups from
          (select src, count(distinct vid) as visitors from page_views where at >= since group by src) v
          full join (select coalesce(sub.source, 'unknown') as src, count(*) as signups from subscriptions sub join tribes t on t.code = sub.tribe_code
                     where t.created_at >= since and t.code <> 'SAMPLE' group by 1) s on s.src = v.src
        order by coalesce(s.signups, 0) desc, coalesce(v.visitors, 0) desc limit 12) x),
    'devices', (select coalesce(json_object_agg(device, n), '{}') from (
        select device, count(distinct vid) as n from page_views where at >= since group by device) x)
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_tribe_detail(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'counts', coalesce((select json_object_agg(col, n) from (select col, count(*) n from docs where tribe_code = p_code group by col) x), '{}'::json),
    'logins', coalesce((select json_agg(json_build_object('email', u.email, 'joined', m.joined_at) order by m.joined_at) from memberships m join auth.users u on u.id = m.user_id where m.tribe_code = p_code), '[]'::json)
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_tribes(p_q text DEFAULT ''::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(code text, name text, created_at timestamp with time zone, owner_email text, people bigint, logins bigint, items bigint, last_active timestamp with time zone, status text, trial_ends_at timestamp with time zone, current_period_end timestamp with time zone, total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  with f as (select t.* from tribes t where t.code <> 'SAMPLE' and (p_q = '' or t.name ilike '%' || p_q || '%' or t.code ilike '%' || p_q || '%'))
  select f.code, f.name, f.created_at, (select u.email::text from auth.users u where u.id = f.created_by),
    (select count(*) from docs d where d.tribe_code = f.code and d.col = 'members'),
    (select count(*) from memberships m where m.tribe_code = f.code),
    (select count(*) from docs d where d.tribe_code = f.code),
    (select max(d.updated_at) from docs d where d.tribe_code = f.code),
    s.status, s.trial_ends_at, s.current_period_end, count(*) over ()
  from f left join subscriptions s on s.tribe_code = f.code
  order by f.created_at desc limit least(p_limit, 200) offset greatest(p_offset, 0);
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_users(p_q text DEFAULT ''::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, confirmed boolean, tribes json, total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  with f as (select u.* from auth.users u where p_q = '' or u.email ilike '%' || p_q || '%')
  select f.id, f.email::text, f.created_at, f.last_sign_in_at, f.email_confirmed_at is not null,
    coalesce((select json_agg(json_build_object('code', t.code, 'name', t.name)) from memberships m join tribes t on t.code = m.tribe_code where m.user_id = f.id), '[]'::json),
    count(*) over ()
  from f order by f.created_at desc limit least(p_limit, 200) offset greatest(p_offset, 0);
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_whoami()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare e text;
begin
  if not public.is_admin() then return json_build_object('admin', false); end if;
  select lower(email) into e from auth.users where id = auth.uid();
  update public.admin_emails set user_id = auth.uid() where email = e and user_id is null;
  return json_build_object('admin', true, 'email', e);
end $function$
;
CREATE OR REPLACE FUNCTION public.ai_take_quota()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_bucket text;
  v_calls int;
  v_limit constant int := 50;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'auth');
  end if;
  select 't:' || min(m.tribe_code) into v_bucket
    from public.memberships m where m.user_id = v_uid and m.status = 'active';
  if v_bucket is null then v_bucket := 'u:' || v_uid::text; end if;

  insert into private.ai_usage as a (bucket, day, calls)
  values (v_bucket, (now() at time zone 'America/New_York')::date, 1)
  on conflict (bucket, day) do update set calls = a.calls + 1
    where a.calls < v_limit
  returning calls into v_calls;

  return jsonb_build_object('allowed', v_calls is not null, 'limit', v_limit);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.apple_sync(p_secret text, p_code text, p_otx text, p_status text, p_period_end timestamp with time zone)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_ref text := 'apple:' || p_otx;
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'billing_sync' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('active','past_due','canceled') or coalesce(p_otx, '') !~ '^[0-9]{1,30}$' then raise exception 'bad input' using errcode = '22023'; end if;

  if p_code is null then
    update subscriptions set
      status = case when status = 'comped' then status else p_status end,
      current_period_end = coalesce(p_period_end, current_period_end),
      updated_at = now()
    where stripe_subscription_id = v_ref;
    return case when found then 'ok' else 'unknown' end;
  end if;

  if not exists (select 1 from tribes where code = p_code and code <> 'SAMPLE') then return 'no_family'; end if;
  if exists (select 1 from subscriptions where stripe_subscription_id = v_ref and tribe_code <> p_code and status in ('active','past_due')) then
    return 'in_use';
  end if;
  update subscriptions set stripe_subscription_id = null where stripe_subscription_id = v_ref and tribe_code <> p_code;
  insert into subscriptions(tribe_code, status) values (p_code, p_status) on conflict (tribe_code) do nothing;
  update subscriptions set
    status = case when status = 'comped' then status else p_status end,
    stripe_subscription_id = v_ref,
    current_period_end = coalesce(p_period_end, current_period_end),
    updated_at = now()
  where tribe_code = p_code;
  return 'ok';
end $function$
;
CREATE OR REPLACE FUNCTION public.billing_sync(p_secret text, p_code text, p_status text, p_customer text, p_subscription text, p_period_end timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'billing_sync' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('active','past_due','canceled') then raise exception 'bad status' using errcode = '22023'; end if;
  if not exists (select 1 from tribes where code = p_code and code <> 'SAMPLE') then return false; end if;
  insert into subscriptions(tribe_code, status) values (p_code, p_status) on conflict (tribe_code) do nothing;
  update subscriptions set
    status = case when status = 'comped' then status else p_status end,
    stripe_customer_id = coalesce(p_customer, stripe_customer_id),
    stripe_subscription_id = coalesce(p_subscription, stripe_subscription_id),
    current_period_end = coalesce(p_period_end, current_period_end),
    updated_at = now()
  where tribe_code = p_code;
  return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.calendar_feed(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text;
begin
  select f.tribe_code into c from calendar_feeds f join tribes t on t.code = f.tribe_code where f.token = p_token and t.deleted_at is null;
  if c is null then return null; end if;
  return json_build_object(
    'tribe', (select name from tribes where code = c),
    'members', (select coalesce(json_agg(json_build_object('id', id, 'name', data->>'name')), '[]') from docs where tribe_code = c and col = 'members'),
    'events', (select coalesce(json_agg(jsonb_build_object('id', id) || data), '[]') from docs where tribe_code = c and col = 'events'),
    'countdowns', (select coalesce(json_agg(jsonb_build_object('id', id) || data), '[]') from docs where tribe_code = c and col = 'countdowns'),
    'trips', (select coalesce(json_agg(jsonb_build_object('id', id) || (data - 'packing' - 'plan' - 'petcare')), '[]') from docs where tribe_code = c and col = 'trips')
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.calendar_link(p_code text, p_reset boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tok text;
begin
  if p_code = 'SAMPLE' or not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  select token into tok from calendar_feeds where tribe_code = p_code;
  if tok is null or coalesce(p_reset, false) then
    tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into calendar_feeds(tribe_code, token) values (p_code, tok)
      on conflict (tribe_code) do update set token = excluded.token, created_at = now();
  end if;
  return tok;
end $function$
;
CREATE OR REPLACE FUNCTION public.can_read(p_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_code = 'SAMPLE' or public.is_member(p_code);
$function$
;
CREATE OR REPLACE FUNCTION public.close_tribe(p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if p_code = 'SAMPLE' or not public.is_parent(p_code) then raise exception 'only parents can delete the family' using errcode = '42501'; end if;
  update tribes set deleted_at = now() where code = p_code;
  update memberships set status = 'pending', removed_at = now() where tribe_code = p_code;
  update push_subscriptions set dead = true where tribe_code = p_code;
  update sitter_links set expires_at = now() where tribe_code = p_code;
  insert into deletion_requests(user_id, email, tribes, kind) values (auth.uid(), (select lower(email) from auth.users where id = auth.uid()), array[p_code], 'family');
end $function$
;
CREATE OR REPLACE FUNCTION public.contact_to_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tid uuid;
begin
  if new.kind <> 'contact' or coalesce(btrim(new.message),'') = '' then return new; end if;
  insert into tickets(source, email, name, subject, category, message_count, context)
  values ('website', lower(new.email), new.name, left(coalesce(nullif(btrim(new.topic),''), 'Website message') || ': ' || regexp_replace(new.message, '\s+', ' ', 'g'), 140),
          case new.topic when 'Help with the app' then 'bug' when 'Partnerships' then 'other' when 'Press' then 'other' when 'Something else' then 'other' else 'question' end,
          1, jsonb_build_object('topic', new.topic, 'phone', new.phone))
  returning id into tid;
  insert into ticket_messages(ticket_id, author, author_email, body) values (tid, 'customer', lower(new.email), left(new.message, 5000));
  new.status := 'done';
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.create_ticket(p_subject text, p_body text, p_category text, p_tribe text, p_context jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare u record; t record;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if (select count(*) from tickets where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many requests today' using errcode = '54000'; end if;
  p_subject := btrim(coalesce(p_subject,'')); p_body := btrim(coalesce(p_body,''));
  if p_body = '' then raise exception 'message required' using errcode = '22023'; end if;
  if p_subject = '' then p_subject := left(regexp_replace(p_body, '\s+', ' ', 'g'), 80); end if;
  select id, email into u from auth.users where id = auth.uid();
  insert into tickets(source, user_id, email, tribe_code, subject, category, context, message_count)
  values ('app', u.id, lower(u.email), case when p_tribe is not null and public.is_member(p_tribe) then p_tribe end, left(p_subject,140),
          case when p_category in ('question','bug','billing','account','idea','other') then p_category else 'question' end,
          coalesce(p_context, '{}'::jsonb) - 'email', 1)
  returning id, number into t;
  insert into ticket_messages(ticket_id, author, author_email, body) values (t.id, 'customer', lower(u.email), left(p_body, 5000));
  return json_build_object('id', t.id, 'number', t.number);
end $function$
;
CREATE OR REPLACE FUNCTION public.create_tribe(p_name text, p_you text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare alph text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int; tries int := 0; mid text := gen_random_uuid()::text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  p_name := btrim(coalesce(p_name,'')); p_you := btrim(coalesce(p_you,''));
  if p_name = '' or p_you = '' then raise exception 'name required' using errcode = '22023'; end if;
  loop
    c := ''; for i in 1..6 loop c := c || substr(alph, 1 + floor(random()*length(alph))::int, 1); end loop;
    exit when not exists (select 1 from tribes where code = c);
    tries := tries + 1; if tries > 20 then raise exception 'could not make a code'; end if;
  end loop;
  insert into tribes(code, name, created_by) values (c, left(p_name,60), auth.uid());
  insert into memberships(tribe_code, user_id, member_id) values (c, auth.uid(), mid);
  insert into docs(tribe_code, col, id, data) values (c, 'members', mid,
    jsonb_build_object('name', left(p_you,20), 'style','short', 'color','sage', 'skin','#E2B48C', 'hair','#3B2A22', 'order',0, 'status','home'));
  return json_build_object('code', c, 'member_id', mid);
end $function$
;
CREATE OR REPLACE FUNCTION public.doc_merge(p_code text, p_col text, p_id text, p_patch jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update docs set data = public.jsonb_deep_merge(data, p_patch) where tribe_code = p_code and col = p_col and id = p_id;
  if not found then
    insert into docs(tribe_code, col, id, data) values (p_code, p_col, p_id, public.jsonb_deep_merge('{}'::jsonb, p_patch))
    on conflict (tribe_code, col, id) do update set data = public.jsonb_deep_merge(docs.data, p_patch);
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.email_done(p_secret text, p_keys text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into email_log(key) select unnest(coalesce(p_keys, '{}')) on conflict do nothing;
end $function$
;
CREATE OR REPLACE FUNCTION public.email_feed(p_secret text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION public.ht_ai_take(p_code text, p_enforce boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_month text := to_char(now() at time zone 'utc', 'YYYY-MM'); v_used int; v_premium boolean;
begin
  if not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(s.status in ('active','comped','past_due') or (s.status = 'trialing' and s.trial_ends_at > now()), true)
    into v_premium from (select 1) x left join subscriptions s on s.tribe_code = p_code;
  select uses into v_used from ai_usage where tribe_code = p_code and month = v_month;
  if p_enforce and not v_premium and coalesce(v_used, 0) >= 10 then return false; end if;
  insert into ai_usage(tribe_code, month, uses) values (p_code, v_month, 1)
    on conflict (tribe_code, month) do update set uses = ai_usage.uses + 1;
  return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select exists (
    select 1 from public.admin_emails a join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid() and u.email_confirmed_at is not null and (a.user_id is null or a.user_id = u.id)
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_member(p_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.memberships m where m.tribe_code = p_code and m.user_id = auth.uid() and m.status = 'active');
$function$
;
CREATE OR REPLACE FUNCTION public.is_parent(p_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.memberships m where m.tribe_code = p_code and m.user_id = auth.uid() and m.status = 'active' and m.role = 'parent');
$function$
;
CREATE OR REPLACE FUNCTION public.join_tribe(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  p_code := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g'));
  if p_code = 'SAMPLE' or not exists (select 1 from tribes where code = p_code and deleted_at is null) then return false; end if;
  insert into memberships(tribe_code, user_id, role, status) values (p_code, auth.uid(), 'family', 'pending')
    on conflict (tribe_code, user_id) do update set status = 'pending', role = 'family', removed_at = null, joined_at = now()
    where memberships.removed_at is not null;
  return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.jsonb_deep_merge(a jsonb, b jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare k text; v jsonb; out jsonb;
begin
  if a is null or jsonb_typeof(a) <> 'object' then a := '{}'::jsonb; end if;
  if b is null or jsonb_typeof(b) <> 'object' then return b; end if;
  out := a;
  for k, v in select * from jsonb_each(b) loop
    if jsonb_typeof(v) = 'object' and v ? '__delete__' and (v->>'__delete__')::boolean then
      out := out - k;
    elsif jsonb_typeof(v) = 'object' then
      out := jsonb_set(out, array[k], public.jsonb_deep_merge(out->k, v), true);
    else
      out := jsonb_set(out, array[k], v, true);
    end if;
  end loop;
  return out;
end $function$
;
CREATE OR REPLACE FUNCTION public.leave_tribe(p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare heir uuid;
begin
  delete from memberships where tribe_code = p_code and user_id = auth.uid();
  if not exists (select 1 from memberships where tribe_code = p_code and status = 'active' and role = 'parent') then
    select user_id into heir from memberships where tribe_code = p_code and status = 'active' order by joined_at limit 1;
    if heir is not null then update memberships set role = 'parent' where tribe_code = p_code and user_id = heir; end if;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.make_sitter_link(p_code text, p_days integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tok text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); exp timestamptz;
begin
  if p_code = 'SAMPLE' or not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  exp := now() + make_interval(days => least(greatest(coalesce(p_days, 2), 1), 30));
  insert into sitter_links(token, tribe_code, expires_at) values (tok, p_code, exp)
    on conflict (tribe_code) do update set token = excluded.token, expires_at = excluded.expires_at, created_at = now();
  return json_build_object('token', tok, 'expires_at', exp);
end $function$
;
CREATE OR REPLACE FUNCTION public.manage_login(p_code text, p_user uuid, p_action text, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare parents int;
begin
  if not public.is_parent(p_code) then raise exception 'only parents can do that' using errcode = '42501'; end if;
  if p_action = 'approve' then
    update memberships set status = 'active', removed_at = null, role = case when p_role in ('parent','family') then p_role else 'family' end
      where tribe_code = p_code and user_id = p_user and removed_at is null;
  elsif p_action = 'role' then
    if p_role not in ('parent','family') then raise exception 'bad role' using errcode = '22023'; end if;
    select count(*) into parents from memberships where tribe_code = p_code and role = 'parent' and status = 'active' and user_id <> p_user;
    if p_role = 'family' and parents = 0 then raise exception 'a family needs at least one parent' using errcode = '22023'; end if;
    update memberships set role = p_role where tribe_code = p_code and user_id = p_user and status = 'active';
  elsif p_action = 'remove' then
    select count(*) into parents from memberships where tribe_code = p_code and role = 'parent' and status = 'active' and user_id <> p_user;
    if parents = 0 then raise exception 'a family needs at least one parent' using errcode = '22023'; end if;
    update memberships set status = 'pending', removed_at = now() where tribe_code = p_code and user_id = p_user;
  else raise exception 'bad action' using errcode = '22023'; end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.my_deletion_pending()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from deletion_requests where user_id = auth.uid() and kind = 'account' and done_at is null);
$function$
;
CREATE OR REPLACE FUNCTION public.reminder_done(p_secret text, p_keys text[], p_dead text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into push_log(key) select unnest(coalesce(p_keys, '{}')) on conflict do nothing;
  update push_subscriptions set dead = true where endpoint = any(coalesce(p_dead, '{}'));
end $function$
;
CREATE OR REPLACE FUNCTION public.reminder_feed(p_secret text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'subs', (select coalesce(json_agg(json_build_object('id', s.id, 'tribe', s.tribe_code, 'member', coalesce(s.member_id, m.member_id), 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'tz', s.tz, 'prefs', s.prefs)), '[]')
             from push_subscriptions s join memberships m on m.tribe_code = s.tribe_code and m.user_id = s.user_id where m.status = 'active' and not s.dead),
    'docs', (select coalesce(json_agg(json_build_object('tribe', d.tribe_code, 'col', d.col, 'id', d.id, 'data', d.data)), '[]') from docs d
             where d.col in ('events','meds','home','school','countdowns','members') and d.tribe_code in (select tribe_code from push_subscriptions where not dead)),
    'sent', (select coalesce(json_agg(key), '[]') from push_log where sent_at > now() - interval '3 days')
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.request_account_deletion()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare t record; closed text[] := '{}'; heir uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  for t in select tribe_code from memberships where user_id = auth.uid() and removed_at is null loop
    if not exists (select 1 from memberships where tribe_code = t.tribe_code and user_id <> auth.uid() and status = 'active') then
      update tribes set deleted_at = now() where code = t.tribe_code;
      update memberships set status = 'pending', removed_at = now() where tribe_code = t.tribe_code;
      closed := closed || t.tribe_code;
    else
      update memberships set status = 'pending', removed_at = now() where tribe_code = t.tribe_code and user_id = auth.uid();
      if not exists (select 1 from memberships where tribe_code = t.tribe_code and status = 'active' and role = 'parent') then
        select user_id into heir from memberships where tribe_code = t.tribe_code and status = 'active' order by joined_at limit 1;
        if heir is not null then update memberships set role = 'parent' where tribe_code = t.tribe_code and user_id = heir; end if;
      end if;
    end if;
  end loop;
  update push_subscriptions set dead = true where user_id = auth.uid();
  insert into deletion_requests(user_id, email, tribes, kind) values (auth.uid(), (select lower(email) from auth.users where id = auth.uid()), closed, 'account');
end $function$
;
CREATE OR REPLACE FUNCTION public.set_me(p_code text, p_member text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  update memberships set member_id = p_member where tribe_code = p_code and user_id = auth.uid();
$function$
;
CREATE OR REPLACE FUNCTION public.set_signup_source(p_code text, p_src text, p_campaign text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_member(p_code) then return; end if;
  update subscriptions set source = left(nullif(btrim(lower(p_src)), ''), 60), campaign = left(nullif(btrim(p_campaign), ''), 80)
  where tribe_code = p_code and source is null;
end $function$
;
CREATE OR REPLACE FUNCTION public.sitter_sheet(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text;
begin
  select l.tribe_code into c from sitter_links l join tribes t on t.code = l.tribe_code where l.token = p_token and l.expires_at > now() and t.deleted_at is null;
  if c is null then return null; end if;
  return json_build_object(
    'tribe', (select name from tribes where code = c),
    'expires_at', (select expires_at from sitter_links where token = p_token),
    'members', (select coalesce(json_agg(jsonb_build_object('id', id) || data), '[]') from docs where tribe_code = c and col = 'members'),
    'meds', (select coalesce(json_agg(jsonb_build_object('id', id) || data), '[]') from docs where tribe_code = c and col = 'meds'),
    'routines', (select coalesce(json_agg(jsonb_build_object('id', id) || data), '[]') from docs where tribe_code = c and col = 'routines'),
    'allergies', (select coalesce(json_agg(jsonb_build_object('id', id) || data), '[]') from docs where tribe_code = c and col = 'health' and data->>'kind' = 'allergy'),
    'contacts', (select coalesce(json_agg(jsonb_build_object('id', id) || data), '[]') from docs where tribe_code = c and col = 'contacts' and coalesce(data->>'role','other') in ('emergency','doctor','family','sitter')),
    'info', (select data from docs where tribe_code = c and col = 'info' and id = 'sitter')
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.start_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.code <> 'SAMPLE' then
    insert into public.subscriptions(tribe_code, status, trial_ends_at) values (new.code, 'trialing', now() + interval '14 days') on conflict do nothing;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.stop_sitter_link(p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  update sitter_links set expires_at = now() where tribe_code = p_code;
end $function$
;
CREATE OR REPLACE FUNCTION public.ticket_reply(p_ticket uuid, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not exists (select 1 from tickets where id = p_ticket and user_id = auth.uid()) then raise exception 'not allowed' using errcode = '42501'; end if;
  p_body := btrim(coalesce(p_body,'')); if p_body = '' then raise exception 'message required' using errcode = '22023'; end if;
  insert into ticket_messages(ticket_id, author, author_email, body) values (p_ticket, 'customer', (select lower(email) from auth.users where id = auth.uid()), left(p_body, 5000));
  update tickets set status = 'open', last_from = 'customer', updated_at = now(), customer_seen_at = now(), message_count = message_count + 1 where id = p_ticket;
end $function$
;
CREATE OR REPLACE FUNCTION public.ticket_seen(p_ticket uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update tickets set customer_seen_at = now() where id = p_ticket and user_id = auth.uid();
$function$
;
CREATE OR REPLACE FUNCTION public.touch_doc()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $function$
;
CREATE OR REPLACE FUNCTION public.tribe_logins(p_code text)
 RETURNS TABLE(user_id uuid, email text, role text, status text, member_id text, joined_at timestamp with time zone, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select m.user_id, lower(u.email)::text, m.role, m.status, m.member_id, m.joined_at, m.user_id = auth.uid()
    from memberships m join auth.users u on u.id = m.user_id where m.tribe_code = p_code and m.removed_at is null order by m.status desc, m.joined_at;
end $function$
;

-- Tables
create table public.admin_emails (
  email text not null,
  user_id uuid,
  added_at timestamp with time zone default now() not null
);
create table public.ai_usage (
  tribe_code text not null,
  month text not null,
  uses integer default 0 not null
);
create table public.announcements (
  id bigint generated always as identity not null,
  title text not null,
  body text,
  link text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);
create table public.calendar_feeds (
  tribe_code text not null,
  token text not null,
  created_at timestamp with time zone default now() not null
);
create table public.client_errors (
  id bigint generated always as identity not null,
  at timestamp with time zone default now() not null,
  area text not null,
  path text,
  message text not null,
  source text,
  line integer,
  ua text,
  vid text
);
create table public.deletion_requests (
  id bigint generated always as identity not null,
  user_id uuid not null,
  email text,
  tribes text[] default '{}'::text[] not null,
  kind text default 'account'::text not null,
  requested_at timestamp with time zone default now() not null,
  done_at timestamp with time zone
);
create table public.docs (
  tribe_code text not null,
  col text not null,
  id text not null,
  data jsonb default '{}'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid default auth.uid()
);
create table public.email_log (
  key text not null,
  sent_at timestamp with time zone default now() not null
);
create table public.memberships (
  tribe_code text not null,
  user_id uuid default auth.uid() not null,
  member_id text,
  joined_at timestamp with time zone default now() not null,
  role text default 'parent'::text not null,
  status text default 'active'::text not null,
  removed_at timestamp with time zone
);
create table public.page_views (
  id bigint generated always as identity not null,
  at timestamp with time zone default now() not null,
  path text not null,
  src text default 'direct'::text not null,
  campaign text,
  vid text not null,
  device text default 'desktop'::text not null,
  lang text
);
create table public.portfolio_goals (
  metric text not null,
  target numeric not null,
  updated_at timestamp with time zone default now() not null
);
create table public.push_log (
  key text not null,
  sent_at timestamp with time zone default now() not null
);
create table public.push_subscriptions (
  id bigint generated always as identity not null,
  user_id uuid default auth.uid() not null,
  tribe_code text not null,
  member_id text,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  tz text default 'America/New_York'::text not null,
  prefs jsonb default '{"meds": true, "bills": true, "plans": true, "school": true, "countdowns": true}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  dead boolean default false not null
);
create table public.roadmap_items (
  id uuid default gen_random_uuid() not null,
  title text not null,
  details text,
  status text default 'idea'::text not null,
  area text default 'app'::text not null,
  priority integer default 2 not null,
  target text,
  public boolean default false not null,
  sort double precision default EXTRACT(epoch FROM now()) not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table public.saved_replies (
  id bigint generated always as identity not null,
  title text not null,
  body text not null,
  created_at timestamp with time zone default now() not null
);
create table public.site_submissions (
  id bigint default nextval('site_submissions_id_seq'::regclass) not null,
  kind text not null,
  email text not null,
  name text,
  phone text,
  topic text,
  message text,
  created_at timestamp with time zone default now() not null,
  status text default 'new'::text not null,
  admin_note text
);
alter sequence public.site_submissions_id_seq owned by public.site_submissions.id;
create table public.sitter_links (
  token text not null,
  tribe_code text not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null
);
create table public.subscriptions (
  tribe_code text not null,
  status text default 'trialing'::text not null,
  plan text default 'premium'::text not null,
  trial_ends_at timestamp with time zone,
  current_period_end timestamp with time zone,
  stripe_customer_id text,
  stripe_subscription_id text,
  note text,
  updated_at timestamp with time zone default now() not null,
  source text,
  campaign text
);
create table public.ticket_messages (
  id bigint generated always as identity not null,
  ticket_id uuid not null,
  created_at timestamp with time zone default now() not null,
  author text not null,
  author_email text,
  internal boolean default false not null,
  body text not null
);
create table public.tickets (
  id uuid default gen_random_uuid() not null,
  number bigint generated always as identity (start with 1001) not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  source text default 'app'::text not null,
  user_id uuid,
  email text not null,
  name text,
  tribe_code text,
  subject text not null,
  category text default 'question'::text not null,
  priority text default 'normal'::text not null,
  status text default 'open'::text not null,
  assignee text,
  context jsonb default '{}'::jsonb not null,
  last_from text default 'customer'::text not null,
  team_last_at timestamp with time zone,
  customer_seen_at timestamp with time zone,
  message_count integer default 0 not null
);
create table public.tribes (
  code text not null,
  name text not null,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

-- Keys and checks
alter table public.admin_emails add constraint admin_emails_pkey PRIMARY KEY (email);
alter table public.ai_usage add constraint ai_usage_pkey PRIMARY KEY (tribe_code, month);
alter table public.announcements add constraint announcements_pkey PRIMARY KEY (id);
alter table public.calendar_feeds add constraint calendar_feeds_pkey PRIMARY KEY (tribe_code);
alter table public.client_errors add constraint client_errors_pkey PRIMARY KEY (id);
alter table public.deletion_requests add constraint deletion_requests_pkey PRIMARY KEY (id);
alter table public.docs add constraint docs_pkey PRIMARY KEY (tribe_code, col, id);
alter table public.email_log add constraint email_log_pkey PRIMARY KEY (key);
alter table public.memberships add constraint memberships_pkey PRIMARY KEY (tribe_code, user_id);
alter table public.page_views add constraint page_views_pkey PRIMARY KEY (id);
alter table public.portfolio_goals add constraint portfolio_goals_pkey PRIMARY KEY (metric);
alter table public.push_log add constraint push_log_pkey PRIMARY KEY (key);
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table public.roadmap_items add constraint roadmap_items_pkey PRIMARY KEY (id);
alter table public.saved_replies add constraint saved_replies_pkey PRIMARY KEY (id);
alter table public.site_submissions add constraint site_submissions_pkey PRIMARY KEY (id);
alter table public.sitter_links add constraint sitter_links_pkey PRIMARY KEY (token);
alter table public.subscriptions add constraint subscriptions_pkey PRIMARY KEY (tribe_code);
alter table public.ticket_messages add constraint ticket_messages_pkey PRIMARY KEY (id);
alter table public.tickets add constraint tickets_pkey PRIMARY KEY (id);
alter table public.tribes add constraint tribes_pkey PRIMARY KEY (code);
alter table public.calendar_feeds add constraint calendar_feeds_token_key UNIQUE (token);
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
alter table public.tickets add constraint tickets_number_key UNIQUE (number);
alter table public.admin_emails add constraint admin_emails_email_check CHECK ((email = lower(email)));
alter table public.announcements add constraint announcements_body_check CHECK ((char_length(body) <= 600));
alter table public.announcements add constraint announcements_link_check CHECK ((char_length(link) <= 300));
alter table public.announcements add constraint announcements_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 120)));
alter table public.client_errors add constraint client_errors_area_check CHECK ((area = ANY (ARRAY['site'::text, 'app'::text, 'admin'::text])));
alter table public.client_errors add constraint client_errors_message_check CHECK (((length(message) >= 1) AND (length(message) <= 300)));
alter table public.client_errors add constraint client_errors_path_check CHECK ((length(path) <= 200));
alter table public.client_errors add constraint client_errors_source_check CHECK ((length(source) <= 200));
alter table public.client_errors add constraint client_errors_ua_check CHECK ((length(ua) <= 200));
alter table public.client_errors add constraint client_errors_vid_check CHECK ((length(vid) <= 24));
alter table public.deletion_requests add constraint deletion_requests_kind_check CHECK ((kind = ANY (ARRAY['account'::text, 'family'::text])));
alter table public.docs add constraint docs_col_check CHECK ((col ~ '^[a-z]{2,20}$'::text));
alter table public.docs add constraint docs_data_size CHECK ((octet_length((data)::text) <= 100000));
alter table public.docs add constraint docs_id_check CHECK (((char_length(id) >= 1) AND (char_length(id) <= 120)));
alter table public.memberships add constraint memberships_role_check CHECK ((role = ANY (ARRAY['parent'::text, 'family'::text])));
alter table public.memberships add constraint memberships_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text])));
alter table public.page_views add constraint page_views_campaign_check CHECK ((length(campaign) <= 80));
alter table public.page_views add constraint page_views_device_check CHECK ((device = ANY (ARRAY['phone'::text, 'tablet'::text, 'desktop'::text])));
alter table public.page_views add constraint page_views_lang_check CHECK ((length(lang) <= 5));
alter table public.page_views add constraint page_views_path_check CHECK (((length(path) >= 1) AND (length(path) <= 200)));
alter table public.page_views add constraint page_views_src_check CHECK ((length(src) <= 60));
alter table public.page_views add constraint page_views_vid_check CHECK (((length(vid) >= 6) AND (length(vid) <= 24)));
alter table public.portfolio_goals add constraint portfolio_goals_metric_check CHECK ((metric = ANY (ARRAY['users'::text, 'new_users'::text, 'active30'::text, 'mrr'::text, 'revenue30'::text])));
alter table public.portfolio_goals add constraint portfolio_goals_target_check CHECK ((target >= (0)::numeric));
alter table public.push_subscriptions add constraint push_subscriptions_auth_check CHECK ((char_length(auth) < 100));
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_check CHECK ((char_length(endpoint) < 1000));
alter table public.push_subscriptions add constraint push_subscriptions_p256dh_check CHECK ((char_length(p256dh) < 300));
alter table public.push_subscriptions add constraint push_subscriptions_tz_check CHECK ((char_length(tz) < 60));
alter table public.roadmap_items add constraint roadmap_items_area_check CHECK ((area = ANY (ARRAY['app'::text, 'site'::text, 'billing'::text, 'launch'::text, 'growth'::text, 'ops'::text])));
alter table public.roadmap_items add constraint roadmap_items_details_check CHECK ((char_length(details) <= 4000));
alter table public.roadmap_items add constraint roadmap_items_priority_check CHECK (((priority >= 1) AND (priority <= 3)));
alter table public.roadmap_items add constraint roadmap_items_status_check CHECK ((status = ANY (ARRAY['idea'::text, 'planned'::text, 'in_progress'::text, 'shipped'::text])));
alter table public.roadmap_items add constraint roadmap_items_target_check CHECK ((char_length(target) <= 40));
alter table public.roadmap_items add constraint roadmap_items_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 140)));
alter table public.saved_replies add constraint saved_replies_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 5000)));
alter table public.saved_replies add constraint saved_replies_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)));
alter table public.site_submissions add constraint site_submissions_admin_note_check CHECK ((char_length(admin_note) <= 2000));
alter table public.site_submissions add constraint site_submissions_email_check CHECK (((char_length(email) >= 3) AND (char_length(email) <= 200)));
alter table public.site_submissions add constraint site_submissions_kind_check CHECK ((kind = ANY (ARRAY['waitlist'::text, 'contact'::text])));
alter table public.site_submissions add constraint site_submissions_message_check CHECK ((char_length(message) <= 5000));
alter table public.site_submissions add constraint site_submissions_name_check CHECK ((char_length(name) <= 120));
alter table public.site_submissions add constraint site_submissions_phone_check CHECK ((char_length(phone) <= 40));
alter table public.site_submissions add constraint site_submissions_status_check CHECK ((status = ANY (ARRAY['new'::text, 'replied'::text, 'done'::text])));
alter table public.site_submissions add constraint site_submissions_topic_check CHECK ((char_length(topic) <= 80));
alter table public.subscriptions add constraint subscriptions_status_check CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'comped'::text, 'free'::text])));
alter table public.ticket_messages add constraint ticket_messages_author_check CHECK ((author = ANY (ARRAY['customer'::text, 'team'::text])));
alter table public.ticket_messages add constraint ticket_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 5000)));
alter table public.tickets add constraint tickets_assignee_check CHECK ((char_length(assignee) <= 200));
alter table public.tickets add constraint tickets_category_check CHECK ((category = ANY (ARRAY['question'::text, 'bug'::text, 'billing'::text, 'account'::text, 'idea'::text, 'other'::text])));
alter table public.tickets add constraint tickets_email_check CHECK (((char_length(email) >= 3) AND (char_length(email) <= 200)));
alter table public.tickets add constraint tickets_last_from_check CHECK ((last_from = ANY (ARRAY['customer'::text, 'team'::text])));
alter table public.tickets add constraint tickets_name_check CHECK ((char_length(name) <= 120));
alter table public.tickets add constraint tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])));
alter table public.tickets add constraint tickets_source_check CHECK ((source = ANY (ARRAY['app'::text, 'website'::text, 'admin'::text])));
alter table public.tickets add constraint tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'waiting'::text, 'resolved'::text])));
alter table public.tickets add constraint tickets_subject_check CHECK (((char_length(subject) >= 1) AND (char_length(subject) <= 140)));
alter table public.tribes add constraint tribes_code_check CHECK ((code ~ '^[A-Z0-9]{4,8}$'::text));
alter table public.tribes add constraint tribes_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 60)));
alter table public.admin_emails add constraint admin_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.ai_usage add constraint ai_usage_tribe_code_fkey FOREIGN KEY (tribe_code) REFERENCES tribes(code) ON DELETE CASCADE;
alter table public.calendar_feeds add constraint calendar_feeds_tribe_code_fkey FOREIGN KEY (tribe_code) REFERENCES tribes(code) ON DELETE CASCADE;
alter table public.docs add constraint docs_tribe_code_fkey FOREIGN KEY (tribe_code) REFERENCES tribes(code) ON DELETE CASCADE;
alter table public.memberships add constraint memberships_tribe_code_fkey FOREIGN KEY (tribe_code) REFERENCES tribes(code) ON DELETE CASCADE;
alter table public.memberships add constraint memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_subscriptions add constraint push_subscriptions_tribe_code_fkey FOREIGN KEY (tribe_code) REFERENCES tribes(code) ON DELETE CASCADE;
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.sitter_links add constraint sitter_links_tribe_code_fkey FOREIGN KEY (tribe_code) REFERENCES tribes(code) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_tribe_code_fkey FOREIGN KEY (tribe_code) REFERENCES tribes(code) ON DELETE CASCADE;
alter table public.ticket_messages add constraint ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
alter table public.tickets add constraint tickets_tribe_code_fkey FOREIGN KEY (tribe_code) REFERENCES tribes(code) ON DELETE SET NULL;
alter table public.tickets add constraint tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.tribes add constraint tribes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX admin_emails_user_id_idx ON public.admin_emails USING btree (user_id);
CREATE INDEX client_errors_at ON public.client_errors USING btree (at);
CREATE INDEX memberships_tribe_idx ON public.memberships USING btree (tribe_code);
CREATE INDEX memberships_user_idx ON public.memberships USING btree (user_id);
CREATE INDEX page_views_at ON public.page_views USING btree (at);
CREATE INDEX push_log_sent_idx ON public.push_log USING btree (sent_at);
CREATE INDEX push_subscriptions_tribe_idx ON public.push_subscriptions USING btree (tribe_code);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id);
CREATE UNIQUE INDEX sitter_links_tribe ON public.sitter_links USING btree (tribe_code);
CREATE INDEX subscriptions_sub_id_idx ON public.subscriptions USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);
CREATE INDEX ticket_messages_ticket ON public.ticket_messages USING btree (ticket_id, created_at);
CREATE INDEX tickets_status ON public.tickets USING btree (status, updated_at DESC);
CREATE INDEX tickets_tribe_idx ON public.tickets USING btree (tribe_code);
CREATE INDEX tickets_user ON public.tickets USING btree (user_id);
CREATE INDEX tribes_created_by_idx ON public.tribes USING btree (created_by);

-- Row level security: on for every table. Tables without a policy are server-only.
alter table public.admin_emails enable row level security;
alter table public.ai_usage enable row level security;
alter table public.announcements enable row level security;
alter table public.calendar_feeds enable row level security;
alter table public.client_errors enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.docs enable row level security;
alter table public.email_log enable row level security;
alter table public.memberships enable row level security;
alter table public.page_views enable row level security;
alter table public.portfolio_goals enable row level security;
alter table public.push_log enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.roadmap_items enable row level security;
alter table public.saved_replies enable row level security;
alter table public.site_submissions enable row level security;
alter table public.sitter_links enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.tickets enable row level security;
alter table public.tribes enable row level security;

create policy admin_emails_admin_read on public.admin_emails as PERMISSIVE for SELECT to authenticated using (is_admin());
create policy announcements_admin on public.announcements as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy announcements_read on public.announcements as PERMISSIVE for SELECT to authenticated using ((active OR is_admin()));
create policy client_errors_insert on public.client_errors as PERMISSIVE for INSERT to anon, authenticated with check ((at > (now() - '00:05:00'::interval)));
create policy deletion_requests_admin on public.deletion_requests as PERMISSIVE for SELECT to authenticated using (is_admin());
create policy deletion_requests_admin_update on public.deletion_requests as PERMISSIVE for UPDATE to authenticated using (is_admin()) with check (is_admin());
create policy docs_delete on public.docs as PERMISSIVE for DELETE to authenticated using ((is_member(tribe_code) AND (tribe_code <> 'SAMPLE'::text)));
create policy docs_insert on public.docs as PERMISSIVE for INSERT to authenticated with check ((is_member(tribe_code) AND (tribe_code <> 'SAMPLE'::text)));
create policy docs_read on public.docs as PERMISSIVE for SELECT to public using (can_read(tribe_code));
create policy docs_update on public.docs as PERMISSIVE for UPDATE to authenticated using ((is_member(tribe_code) AND (tribe_code <> 'SAMPLE'::text))) with check ((is_member(tribe_code) AND (tribe_code <> 'SAMPLE'::text)));
create policy memberships_leave on public.memberships as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy memberships_read on public.memberships as PERMISSIVE for SELECT to authenticated using (is_member(tribe_code));
create policy memberships_read_own on public.memberships as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy memberships_update_own on public.memberships as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy page_views_insert on public.page_views as PERMISSIVE for INSERT to anon, authenticated with check ((at > (now() - '00:05:00'::interval)));
create policy push_own_insert on public.push_subscriptions as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND is_member(tribe_code)));
create policy push_own_read on public.push_subscriptions as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy push_own_remove on public.push_subscriptions as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy push_own_update on public.push_subscriptions as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND is_member(tribe_code)));
create policy roadmap_admin_delete on public.roadmap_items as PERMISSIVE for DELETE to authenticated using (is_admin());
create policy roadmap_admin_insert on public.roadmap_items as PERMISSIVE for INSERT to authenticated with check (is_admin());
create policy roadmap_admin_update on public.roadmap_items as PERMISSIVE for UPDATE to authenticated using (is_admin()) with check (is_admin());
create policy roadmap_public_read on public.roadmap_items as PERMISSIVE for SELECT to public using ((public OR is_admin()));
create policy saved_replies_admin on public.saved_replies as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy site_submissions_admin_read on public.site_submissions as PERMISSIVE for SELECT to authenticated using (is_admin());
create policy site_submissions_admin_update on public.site_submissions as PERMISSIVE for UPDATE to authenticated using (is_admin()) with check (is_admin());
create policy site_submissions_insert on public.site_submissions as PERMISSIVE for INSERT to anon, authenticated with check (true);
create policy sitter_links_read on public.sitter_links as PERMISSIVE for SELECT to authenticated using (is_member(tribe_code));
create policy subscriptions_admin_write on public.subscriptions as PERMISSIVE for UPDATE to authenticated using (is_admin()) with check (is_admin());
create policy subscriptions_member_read on public.subscriptions as PERMISSIVE for SELECT to authenticated using ((is_member(tribe_code) OR is_admin()));
create policy ticket_messages_read on public.ticket_messages as PERMISSIVE for SELECT to authenticated using ((is_admin() OR ((NOT internal) AND (EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = ticket_messages.ticket_id) AND (t.user_id = ( SELECT auth.uid() AS uid))))))));
create policy tickets_read on public.tickets as PERMISSIVE for SELECT to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR is_admin()));
create policy tribes_read on public.tribes as PERMISSIVE for SELECT to public using (can_read(code));
create policy tribes_rename on public.tribes as PERMISSIVE for UPDATE to authenticated using ((is_member(code) AND (code <> 'SAMPLE'::text))) with check ((is_member(code) AND (code <> 'SAMPLE'::text)));

-- Triggers
CREATE TRIGGER docs_touch BEFORE INSERT OR UPDATE ON public.docs FOR EACH ROW EXECUTE FUNCTION touch_doc();
CREATE TRIGGER site_submissions_ticket BEFORE INSERT ON public.site_submissions FOR EACH ROW EXECUTE FUNCTION contact_to_ticket();
CREATE TRIGGER tribes_start_trial AFTER INSERT ON public.tribes FOR EACH ROW EXECUTE FUNCTION start_trial();

-- Table access for the API roles (row level security still applies on top)
revoke all on all tables in schema public from public, anon, authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on
  public.admin_emails, public.announcements, public.calendar_feeds, public.client_errors, public.deletion_requests, public.docs,
  public.email_log, public.page_views, public.portfolio_goals, public.push_log, public.push_subscriptions, public.roadmap_items,
  public.saved_replies, public.site_submissions, public.sitter_links to anon, authenticated;
grant delete, insert, maintain, references, select, trigger, truncate on public.memberships to anon, authenticated;
grant maintain, references, select, trigger, truncate on public.subscriptions, public.ticket_messages, public.tickets to anon, authenticated;
grant delete, maintain, references, select, trigger, truncate on public.tribes to anon, authenticated;

-- Function access
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.admin_daily(p_days integer) to authenticated;
grant execute on function public.admin_errors(p_days integer) to authenticated;
grant execute on function public.admin_set_subscription(p_code text, p_status text, p_trial_days integer, p_note text) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_ticket_new(p_email text, p_subject text, p_body text, p_category text) to authenticated;
grant execute on function public.admin_ticket_reply(p_ticket uuid, p_body text, p_internal boolean, p_status text) to authenticated;
grant execute on function public.admin_ticket_update(p_ticket uuid, p_status text, p_priority text, p_category text, p_assignee text) to authenticated;
grant execute on function public.admin_tickets(p_status text, p_q text) to authenticated;
grant execute on function public.admin_traffic(p_days integer) to authenticated;
grant execute on function public.admin_tribe_detail(p_code text) to authenticated;
grant execute on function public.admin_tribes(p_q text, p_limit integer, p_offset integer) to authenticated;
grant execute on function public.admin_users(p_q text, p_limit integer, p_offset integer) to authenticated;
grant execute on function public.admin_whoami() to authenticated;
grant execute on function public.apple_sync(p_secret text, p_code text, p_otx text, p_status text, p_period_end timestamp with time zone) to anon, authenticated;
grant execute on function public.billing_sync(p_secret text, p_code text, p_status text, p_customer text, p_subscription text, p_period_end timestamp with time zone) to anon, authenticated;
grant execute on function public.calendar_feed(p_token text) to anon, authenticated;
grant execute on function public.calendar_link(p_code text, p_reset boolean) to authenticated;
grant execute on function public.can_read(p_code text) to public, anon, authenticated;
grant execute on function public.close_tribe(p_code text) to authenticated;
grant execute on function public.create_ticket(p_subject text, p_body text, p_category text, p_tribe text, p_context jsonb) to authenticated;
grant execute on function public.create_tribe(p_name text, p_you text) to authenticated;
grant execute on function public.doc_merge(p_code text, p_col text, p_id text, p_patch jsonb) to authenticated;
grant execute on function public.email_done(p_secret text, p_keys text[]) to anon, authenticated;
grant execute on function public.email_feed(p_secret text) to anon, authenticated;
grant execute on function public.ht_ai_take(p_code text, p_enforce boolean) to authenticated;
grant execute on function public.is_admin() to public, anon, authenticated;
grant execute on function public.is_member(p_code text) to public, anon, authenticated;
grant execute on function public.is_parent(p_code text) to authenticated;
grant execute on function public.join_tribe(p_code text) to authenticated;
grant execute on function public.jsonb_deep_merge(a jsonb, b jsonb) to public, anon, authenticated;
grant execute on function public.leave_tribe(p_code text) to authenticated;
grant execute on function public.make_sitter_link(p_code text, p_days integer) to authenticated;
grant execute on function public.manage_login(p_code text, p_user uuid, p_action text, p_role text) to authenticated;
grant execute on function public.my_deletion_pending() to authenticated;
grant execute on function public.reminder_done(p_secret text, p_keys text[], p_dead text[]) to anon, authenticated;
grant execute on function public.reminder_feed(p_secret text) to anon, authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.set_me(p_code text, p_member text) to authenticated;
grant execute on function public.set_signup_source(p_code text, p_src text, p_campaign text) to authenticated;
grant execute on function public.sitter_sheet(p_token text) to anon, authenticated;
grant execute on function public.start_trial() to authenticated;
grant execute on function public.stop_sitter_link(p_code text) to authenticated;
grant execute on function public.ticket_reply(p_ticket uuid, p_body text) to authenticated;
grant execute on function public.ticket_seen(p_ticket uuid) to authenticated;
grant execute on function public.touch_doc() to public, anon, authenticated;
grant execute on function public.tribe_logins(p_code text) to authenticated;

-- Live updates
alter publication supabase_realtime add table public.docs;
alter publication supabase_realtime add table public.tribes;

-- File storage for family documents, one folder per family code
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('family-files', 'family-files', false, 20971520, '{image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif,application/pdf}') on conflict (id) do nothing;
create policy family_files_delete on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'family-files'::text) AND is_member((storage.foldername(name))[1])));
create policy family_files_read on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'family-files'::text) AND is_member((storage.foldername(name))[1])));
create policy family_files_write on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'family-files'::text) AND is_member((storage.foldername(name))[1])));

-- Production also runs a pg_cron job every 5 minutes (heytribe-reminders) that posts to /api/reminders
-- with the secret in private.app_secrets. It is left out here so a local database never calls production.
