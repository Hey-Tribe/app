-- NOTE: applied live in parts. Join approval, roles, sitter links, calendar feeds, push and announcements as below.
-- Removing people, closing a family and deleting an account are "soft" (access is removed immediately, rows are
-- erased later by the team); see 0006_family_controls_soft.sql which supersedes manage_login/delete functions here,
-- and 0007_purge.sql for the hard-delete step.
-- HeyTribe: join approval and parent roles, account and family deletion, sitter links,
-- calendar feeds, phone reminders (web push) and announcements.

-- ---------- roles and join approval ----------
alter table public.memberships add column if not exists role   text not null default 'parent' check (role in ('parent','family'));
alter table public.memberships add column if not exists status text not null default 'active' check (status in ('active','pending'));
create index if not exists memberships_tribe_idx on public.memberships(tribe_code);

-- only approved people count as members
create or replace function public.is_member(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.tribe_code = p_code and m.user_id = auth.uid() and m.status = 'active');
$$;
create or replace function public.is_parent(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.tribe_code = p_code and m.user_id = auth.uid() and m.status = 'active' and m.role = 'parent');
$$;

-- people can always see their own membership (so a pending request shows as pending)
create policy memberships_read_own on public.memberships for select to authenticated using (user_id = auth.uid());
-- a login may only change which person it is, never its own role or approval
revoke update on public.memberships from authenticated;
grant update (member_id) on public.memberships to authenticated;

-- joining with a code now asks the parents first
create or replace function public.join_tribe(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  p_code := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g'));
  if p_code = 'SAMPLE' or not exists (select 1 from tribes where code = p_code) then return false; end if;
  insert into memberships(tribe_code, user_id, role, status) values (p_code, auth.uid(), 'family', 'pending') on conflict do nothing;
  return true;
end $$;

-- everyone in the family sees who has a login (with email), parents use it to approve and remove
create or replace function public.tribe_logins(p_code text)
returns table(user_id uuid, email text, role text, status text, member_id text, joined_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select m.user_id, lower(u.email)::text, m.role, m.status, m.member_id, m.joined_at, m.user_id = auth.uid()
    from memberships m join auth.users u on u.id = m.user_id where m.tribe_code = p_code order by m.status desc, m.joined_at;
end $$;

create or replace function public.manage_login(p_code text, p_user uuid, p_action text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare parents int;
begin
  if not public.is_parent(p_code) then raise exception 'only parents can do that' using errcode = '42501'; end if;
  if p_action = 'approve' then
    update memberships set status = 'active', role = case when p_role in ('parent','family') then p_role else 'family' end where tribe_code = p_code and user_id = p_user;
  elsif p_action = 'role' then
    if p_role not in ('parent','family') then raise exception 'bad role' using errcode = '22023'; end if;
    select count(*) into parents from memberships where tribe_code = p_code and role = 'parent' and status = 'active' and user_id <> p_user;
    if p_role = 'family' and parents = 0 then raise exception 'a family needs at least one parent' using errcode = '22023'; end if;
    update memberships set role = p_role where tribe_code = p_code and user_id = p_user and status = 'active';
  elsif p_action = 'remove' then
    select count(*) into parents from memberships where tribe_code = p_code and role = 'parent' and status = 'active' and user_id <> p_user;
    if parents = 0 then raise exception 'a family needs at least one parent' using errcode = '22023'; end if;
    delete from memberships where tribe_code = p_code and user_id = p_user;
  else raise exception 'bad action' using errcode = '22023'; end if;
end $$;

-- leaving: if the last parent leaves, the longest-standing member becomes a parent
create or replace function public.leave_tribe(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare heir uuid;
begin
  delete from memberships where tribe_code = p_code and user_id = auth.uid();
  if not exists (select 1 from memberships where tribe_code = p_code and status = 'active' and role = 'parent') then
    select user_id into heir from memberships where tribe_code = p_code and status = 'active' order by joined_at limit 1;
    if heir is not null then update memberships set role = 'parent' where tribe_code = p_code and user_id = heir; end if;
  end if;
end $$;

-- ---------- deleting a family or an account ----------
create or replace function public.delete_tribe(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_code = 'SAMPLE' or not public.is_parent(p_code) then raise exception 'only parents can delete the family' using errcode = '42501'; end if;
  delete from tribes where code = p_code;
end $$;

-- families where you are the only member are deleted with you; otherwise you just leave them
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare t record;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  for t in select tribe_code from memberships where user_id = auth.uid() loop
    if not exists (select 1 from memberships where tribe_code = t.tribe_code and user_id <> auth.uid() and status = 'active') then
      delete from tribes where code = t.tribe_code;
    else
      perform public.leave_tribe(t.tribe_code);
    end if;
  end loop;
  delete from push_subscriptions where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

-- ---------- sitter link (read-only, no login) ----------
create table if not exists public.sitter_links (
  token      text primary key,
  tribe_code text not null references public.tribes(code) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.sitter_links enable row level security;
create policy sitter_links_read on public.sitter_links for select to authenticated using (public.is_member(tribe_code));

create or replace function public.make_sitter_link(p_code text, p_days int)
returns json language plpgsql security definer set search_path = public as $$
declare tok text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); exp timestamptz;
begin
  if p_code = 'SAMPLE' or not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  exp := now() + make_interval(days => least(greatest(coalesce(p_days, 2), 1), 30));
  delete from sitter_links where tribe_code = p_code;
  insert into sitter_links(token, tribe_code, expires_at) values (tok, p_code, exp);
  return json_build_object('token', tok, 'expires_at', exp);
end $$;
create or replace function public.stop_sitter_link(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from sitter_links where tribe_code = p_code;
end $$;
-- what the sitter page shows: kids, their allergies, medicine and routines, key contacts and house notes
create or replace function public.sitter_sheet(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare c text;
begin
  select tribe_code into c from sitter_links where token = p_token and expires_at > now();
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

-- ---------- calendar feed (subscribe in Google, Apple or Outlook) ----------
create table if not exists public.calendar_feeds (
  tribe_code text primary key references public.tribes(code) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;
create or replace function public.calendar_link(p_code text, p_reset boolean)
returns text language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if p_code = 'SAMPLE' or not public.is_member(p_code) then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(p_reset, false) then delete from calendar_feeds where tribe_code = p_code; end if;
  select token into tok from calendar_feeds where tribe_code = p_code;
  if tok is null then
    tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into calendar_feeds(tribe_code, token) values (p_code, tok);
  end if;
  return tok;
end $$;
create or replace function public.calendar_feed(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare c text;
begin
  select tribe_code into c from calendar_feeds where token = p_token;
  if c is null then return null; end if;
  return json_build_object(
    'tribe', (select name from tribes where code = c),
    'members', (select coalesce(json_agg(json_build_object('id', id, 'name', data->>'name')), '[]') from docs where tribe_code = c and col = 'members'),
    'events', (select coalesce(json_agg(jsonb_build_object('id', id) || data), '[]') from docs where tribe_code = c and col = 'events'),
    'countdowns', (select coalesce(json_agg(jsonb_build_object('id', id) || data), '[]') from docs where tribe_code = c and col = 'countdowns'),
    'trips', (select coalesce(json_agg(jsonb_build_object('id', id) || (data - 'packing' - 'plan' - 'petcare')), '[]') from docs where tribe_code = c and col = 'trips')
  );
end $$;

-- ---------- phone reminders (web push) ----------
create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  tribe_code text not null references public.tribes(code) on delete cascade,
  member_id  text,
  endpoint   text not null unique check (char_length(endpoint) < 1000),
  p256dh     text not null check (char_length(p256dh) < 300),
  auth       text not null check (char_length(auth) < 100),
  tz         text not null default 'America/New_York' check (char_length(tz) < 60),
  prefs      jsonb not null default '{"plans":true,"meds":true,"bills":true,"school":true,"countdowns":true}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_own_read on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_own_insert on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid() and public.is_member(tribe_code));
create policy push_own_update on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(tribe_code));
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

create table if not exists public.push_log (key text primary key, sent_at timestamptz not null default now());
alter table public.push_log enable row level security;

-- the reminder sender (api/reminders) reads what it needs with a shared secret
create or replace function public.reminder_feed(p_secret text)
returns json language plpgsql stable security definer set search_path = public, private as $$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'subs', (select coalesce(json_agg(json_build_object('id', s.id, 'tribe', s.tribe_code, 'member', coalesce(s.member_id, m.member_id), 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'tz', s.tz, 'prefs', s.prefs)), '[]')
             from push_subscriptions s left join memberships m on m.tribe_code = s.tribe_code and m.user_id = s.user_id where m.status = 'active'),
    'docs', (select coalesce(json_agg(json_build_object('tribe', d.tribe_code, 'col', d.col, 'id', d.id, 'data', d.data)), '[]') from docs d
             where d.col in ('events','meds','home','school','countdowns','members') and d.tribe_code in (select tribe_code from push_subscriptions)),
    'sent', (select coalesce(json_agg(key), '[]') from push_log where sent_at > now() - interval '3 days')
  );
end $$;
create or replace function public.reminder_done(p_secret text, p_keys text[], p_dead text[])
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into push_log(key) select unnest(coalesce(p_keys, '{}')) on conflict do nothing;
  delete from push_subscriptions where endpoint = any(coalesce(p_dead, '{}'));
  delete from push_log where sent_at < now() - interval '7 days';
end $$;

-- ---------- announcements from the team ----------
create table if not exists public.announcements (
  id         bigint generated always as identity primary key,
  title      text not null check (char_length(title) between 1 and 120),
  body       text check (char_length(body) <= 600),
  link       text check (char_length(link) <= 300),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
create policy announcements_read on public.announcements for select to authenticated using (active or public.is_admin());
create policy announcements_admin on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- grants ----------
revoke all on function public.is_parent(text) from public, anon;
revoke all on function public.tribe_logins(text) from public, anon;
revoke all on function public.manage_login(text, uuid, text, text) from public, anon;
revoke all on function public.leave_tribe(text) from public, anon;
revoke all on function public.delete_tribe(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.make_sitter_link(text, int) from public, anon;
revoke all on function public.stop_sitter_link(text) from public, anon;
revoke all on function public.calendar_link(text, boolean) from public, anon;
revoke all on function public.sitter_sheet(text) from public;
revoke all on function public.calendar_feed(text) from public;
revoke all on function public.reminder_feed(text) from public;
revoke all on function public.reminder_done(text, text[], text[]) from public;
grant execute on function public.is_parent(text) to authenticated;
grant execute on function public.tribe_logins(text) to authenticated;
grant execute on function public.manage_login(text, uuid, text, text) to authenticated;
grant execute on function public.leave_tribe(text) to authenticated;
grant execute on function public.delete_tribe(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.make_sitter_link(text, int) to authenticated;
grant execute on function public.stop_sitter_link(text) to authenticated;
grant execute on function public.calendar_link(text, boolean) to authenticated;
grant execute on function public.sitter_sheet(text) to anon, authenticated;
grant execute on function public.calendar_feed(text) to anon, authenticated;
grant execute on function public.reminder_feed(text) to anon, authenticated;
grant execute on function public.reminder_done(text, text[], text[]) to anon, authenticated;
