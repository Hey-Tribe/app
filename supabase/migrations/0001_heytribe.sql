-- HeyTribe schema
-- Every family ("tribe") has a short invite code. Signed-in users join tribes through memberships.
-- All family data lives in one flexible table, `docs`, keyed by tribe, collection and id.
-- Row level security makes sure people only see and change tribes they belong to.
-- The SAMPLE tribe is read-only and readable by anyone, so visitors can try the app.

-- ---------- tables ----------
create table if not exists public.tribes (
  code        text primary key check (code ~ '^[A-Z0-9]{4,8}$'),
  name        text not null check (char_length(name) between 1 and 60),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.memberships (
  tribe_code  text not null references public.tribes(code) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  member_id   text,                       -- which person in the family this login is
  joined_at   timestamptz not null default now(),
  primary key (tribe_code, user_id)
);
create index if not exists memberships_user_idx on public.memberships(user_id);

create table if not exists public.docs (
  tribe_code  text not null references public.tribes(code) on delete cascade,
  col         text not null check (col ~ '^[a-z]{2,20}$'),
  id          text not null check (char_length(id) between 1 and 120),
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  primary key (tribe_code, col, id)
);
-- realtime needs the old row on delete so the tribe filter still matches
alter table public.docs replica identity full;

-- ---------- helpers ----------
create or replace function public.is_member(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.tribe_code = p_code and m.user_id = auth.uid());
$$;

create or replace function public.can_read(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_code = 'SAMPLE' or public.is_member(p_code);
$$;

-- deep merge for partial updates: objects merge key by key, everything else replaces,
-- and {"__delete__": true} removes a key
create or replace function public.jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb language plpgsql immutable as $$
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
end $$;

create or replace function public.touch_doc()
returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.touch_doc();

-- ---------- row level security ----------
alter table public.tribes enable row level security;
alter table public.memberships enable row level security;
alter table public.docs enable row level security;

drop policy if exists tribes_read on public.tribes;
create policy tribes_read on public.tribes for select using (public.can_read(code));
drop policy if exists tribes_rename on public.tribes;
create policy tribes_rename on public.tribes for update to authenticated
  using (public.is_member(code) and code <> 'SAMPLE') with check (public.is_member(code) and code <> 'SAMPLE');

drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select to authenticated using (public.is_member(tribe_code));
drop policy if exists memberships_update_own on public.memberships;
create policy memberships_update_own on public.memberships for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists memberships_leave on public.memberships;
create policy memberships_leave on public.memberships for delete to authenticated using (user_id = auth.uid());

drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select using (public.can_read(tribe_code));
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated
  with check (public.is_member(tribe_code) and tribe_code <> 'SAMPLE');
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
  using (public.is_member(tribe_code) and tribe_code <> 'SAMPLE')
  with check (public.is_member(tribe_code) and tribe_code <> 'SAMPLE');
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated
  using (public.is_member(tribe_code) and tribe_code <> 'SAMPLE');

-- ---------- RPCs ----------
-- create a tribe, join it, and add the creator as the first family member
create or replace function public.create_tribe(p_name text, p_you text)
returns json language plpgsql security definer set search_path = public as $$
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
end $$;

-- join with an invite code; returns false when the code doesn't exist
create or replace function public.join_tribe(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  p_code := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g'));
  if p_code = 'SAMPLE' or not exists (select 1 from tribes where code = p_code) then return false; end if;
  insert into memberships(tribe_code, user_id) values (p_code, auth.uid()) on conflict do nothing;
  return true;
end $$;

-- remember which family member this login is
create or replace function public.set_me(p_code text, p_member text)
returns void language sql security invoker set search_path = public as $$
  update memberships set member_id = p_member where tribe_code = p_code and user_id = auth.uid();
$$;

-- partial update that deep-merges into a document (creates it if missing)
create or replace function public.doc_merge(p_code text, p_col text, p_id text, p_patch jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update docs set data = public.jsonb_deep_merge(data, p_patch) where tribe_code = p_code and col = p_col and id = p_id;
  if not found then
    insert into docs(tribe_code, col, id, data) values (p_code, p_col, p_id, public.jsonb_deep_merge('{}'::jsonb, p_patch))
    on conflict (tribe_code, col, id) do update set data = public.jsonb_deep_merge(docs.data, p_patch);
  end if;
end $$;

revoke all on function public.create_tribe(text, text) from public, anon;
revoke all on function public.join_tribe(text) from public, anon;
revoke all on function public.set_me(text, text) from public, anon;
revoke all on function public.doc_merge(text, text, text, jsonb) from public, anon;
grant execute on function public.create_tribe(text, text) to authenticated;
grant execute on function public.join_tribe(text) to authenticated;
grant execute on function public.set_me(text, text) to authenticated;
grant execute on function public.doc_merge(text, text, text, jsonb) to authenticated;

-- ---------- realtime ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.docs; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.tribes; exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------- file storage: private bucket, one folder per tribe ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('family-files', 'family-files', false, 20971520)
on conflict (id) do nothing;

drop policy if exists family_files_read on storage.objects;
create policy family_files_read on storage.objects for select to authenticated
  using (bucket_id = 'family-files' and public.is_member((storage.foldername(name))[1]));
drop policy if exists family_files_write on storage.objects;
create policy family_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'family-files' and public.is_member((storage.foldername(name))[1]));
drop policy if exists family_files_delete on storage.objects;
create policy family_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'family-files' and public.is_member((storage.foldername(name))[1]));

-- ---------- marketing site forms (waitlist + contact) ----------
-- Anyone can send one; only you can read them (Supabase dashboard -> Table editor).
create table if not exists public.site_submissions (
  id          bigserial primary key,
  kind        text not null check (kind in ('waitlist', 'contact')),
  email       text not null check (char_length(email) between 3 and 200),
  name        text check (char_length(name) <= 120),
  phone       text check (char_length(phone) <= 40),
  topic       text check (char_length(topic) <= 80),
  message     text check (char_length(message) <= 5000),
  created_at  timestamptz not null default now()
);
alter table public.site_submissions enable row level security;
drop policy if exists site_submissions_insert on public.site_submissions;
create policy site_submissions_insert on public.site_submissions for insert to anon, authenticated with check (true);
