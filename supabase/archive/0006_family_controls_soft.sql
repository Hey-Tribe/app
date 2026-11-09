-- Soft removal, family closing, account deletion requests, and links that respect closed families.
-- Matches what is live (applied via the Supabase connector). Hard purges are done by an admin.

alter table public.memberships add column if not exists removed_at timestamptz;
alter table public.tribes add column if not exists deleted_at timestamptz;
create unique index if not exists sitter_links_tribe on public.sitter_links(tribe_code);
alter table public.push_subscriptions add column if not exists dead boolean not null default false;
revoke update on public.memberships from authenticated, anon;
grant update (member_id) on public.memberships to authenticated;

create table if not exists public.deletion_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  email text,
  tribes text[] not null default '{}',
  kind text not null default 'account',
  requested_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.deletion_requests enable row level security;
drop policy if exists deletion_requests_admin on public.deletion_requests;
create policy deletion_requests_admin on public.deletion_requests for select to authenticated using (public.is_admin());
drop policy if exists deletion_requests_admin_update on public.deletion_requests;
create policy deletion_requests_admin_update on public.deletion_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.is_member(p_code text) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.memberships m where m.tribe_code = p_code and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function public.is_parent(p_code text) returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.memberships m where m.tribe_code = p_code and m.user_id = auth.uid() and m.status = 'active' and m.role = 'parent');
$$;

create or replace function public.join_tribe(p_code text) returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  p_code := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g'));
  if p_code = 'SAMPLE' or not exists (select 1 from tribes where code = p_code and deleted_at is null) then return false; end if;
  insert into memberships(tribe_code, user_id, role, status) values (p_code, auth.uid(), 'family', 'pending')
    on conflict (tribe_code, user_id) do update set status = 'pending', role = 'family', removed_at = null, joined_at = now()
    where memberships.removed_at is not null;
  return true;
end $$;

create or replace function public.tribe_logins(p_code text)
returns table(user_id uuid, email text, role text, status text, member_id text, joined_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path to 'public', 'auth' as $$
begin
  if not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select m.user_id, lower(u.email)::text, m.role, m.status, m.member_id, m.joined_at, m.user_id = auth.uid()
    from memberships m join auth.users u on u.id = m.user_id where m.tribe_code = p_code and m.removed_at is null order by m.status desc, m.joined_at;
end $$;

create or replace function public.manage_login(p_code text, p_user uuid, p_action text, p_role text) returns void language plpgsql security definer set search_path to 'public' as $$
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
end $$;

create or replace function public.leave_tribe(p_code text) returns void language plpgsql security definer set search_path to 'public' as $$
declare heir uuid;
begin
  delete from memberships where tribe_code = p_code and user_id = auth.uid();
  if not exists (select 1 from memberships where tribe_code = p_code and status = 'active' and role = 'parent') then
    select user_id into heir from memberships where tribe_code = p_code and status = 'active' order by joined_at limit 1;
    if heir is not null then update memberships set role = 'parent' where tribe_code = p_code and user_id = heir; end if;
  end if;
end $$;

create or replace function public.close_tribe(p_code text) returns void language plpgsql security definer set search_path to 'public', 'auth' as $$
begin
  if p_code = 'SAMPLE' or not public.is_parent(p_code) then raise exception 'only parents can delete the family' using errcode = '42501'; end if;
  update tribes set deleted_at = now() where code = p_code;
  update memberships set status = 'pending', removed_at = now() where tribe_code = p_code;
  update push_subscriptions set dead = true where tribe_code = p_code;
  update sitter_links set expires_at = now() where tribe_code = p_code;
  insert into deletion_requests(user_id, email, tribes, kind) values (auth.uid(), (select lower(email) from auth.users where id = auth.uid()), array[p_code], 'family');
end $$;

create or replace function public.request_account_deletion() returns void language plpgsql security definer set search_path to 'public', 'auth' as $$
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
end $$;

create or replace function public.my_deletion_pending() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from deletion_requests where user_id = auth.uid() and kind = 'account' and done_at is null);
$$;

create or replace function public.make_sitter_link(p_code text, p_days integer) returns json language plpgsql security definer set search_path to 'public' as $$
declare tok text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); exp timestamptz;
begin
  if p_code = 'SAMPLE' or not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  exp := now() + make_interval(days => least(greatest(coalesce(p_days, 2), 1), 30));
  insert into sitter_links(token, tribe_code, expires_at) values (tok, p_code, exp)
    on conflict (tribe_code) do update set token = excluded.token, expires_at = excluded.expires_at, created_at = now();
  return json_build_object('token', tok, 'expires_at', exp);
end $$;

create or replace function public.stop_sitter_link(p_code text) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  update sitter_links set expires_at = now() where tribe_code = p_code;
end $$;

create or replace function public.sitter_sheet(p_token text) returns json language plpgsql stable security definer set search_path to 'public' as $$
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
end $$;

create or replace function public.calendar_link(p_code text, p_reset boolean) returns text language plpgsql security definer set search_path to 'public' as $$
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
end $$;

create or replace function public.calendar_feed(p_token text) returns json language plpgsql stable security definer set search_path to 'public' as $$
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
end $$;

create or replace function public.reminder_feed(p_secret text) returns json language plpgsql stable security definer set search_path to 'public', 'private' as $$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'subs', (select coalesce(json_agg(json_build_object('id', s.id, 'tribe', s.tribe_code, 'member', coalesce(s.member_id, m.member_id), 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'tz', s.tz, 'prefs', s.prefs)), '[]')
             from push_subscriptions s join memberships m on m.tribe_code = s.tribe_code and m.user_id = s.user_id where m.status = 'active' and not s.dead),
    'docs', (select coalesce(json_agg(json_build_object('tribe', d.tribe_code, 'col', d.col, 'id', d.id, 'data', d.data)), '[]') from docs d
             where d.col in ('events','meds','home','school','countdowns','members') and d.tribe_code in (select tribe_code from push_subscriptions where not dead)),
    'sent', (select coalesce(json_agg(key), '[]') from push_log where sent_at > now() - interval '3 days')
  );
end $$;

create or replace function public.reminder_done(p_secret text, p_keys text[], p_dead text[]) returns void language plpgsql security definer set search_path to 'public', 'private' as $$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into push_log(key) select unnest(coalesce(p_keys, '{}')) on conflict do nothing;
  update push_subscriptions set dead = true where endpoint = any(coalesce(p_dead, '{}'));
end $$;

grant execute on function public.sitter_sheet(text), public.calendar_feed(text), public.reminder_feed(text), public.reminder_done(text, text[], text[]) to anon, authenticated;

-- Reminder sender runs every 5 minutes (pg_cron + pg_net).
select cron.schedule('heytribe-reminders', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://www.heytribe.app/api/reminders',
    headers := jsonb_build_object('x-cron-secret', (select value from private.app_secrets where name = 'cron'), 'content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$cron$);
