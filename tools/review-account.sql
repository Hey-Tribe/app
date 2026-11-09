-- Store reviewer account: gives review@heytribe.app a full family (a copy of the sample family) with Premium on.
-- 1. Austin: sign up in the app as review@heytribe.app with the review password and confirm the email.
-- 2. Run this in Supabase › SQL editor (safe to run again: it replaces the review family's data).
-- 3. Put the email and password in App Store Connect › App Review and Play Console › App access.
do $$
declare v_user uuid; v_code constant text := 'APPREVW'; v_me text;
begin
  select id into v_user from auth.users where lower(email) = 'review@heytribe.app' and email_confirmed_at is not null;
  if v_user is null then raise exception 'Sign up and confirm review@heytribe.app first'; end if;
  select id into v_me from public.docs where tribe_code = 'SAMPLE' and col = 'members' and data->>'name' = 'Alex';
  insert into public.tribes(code, name, created_by) values (v_code, 'The Review Family', v_user)
    on conflict (code) do update set name = excluded.name, deleted_at = null;
  delete from public.docs where tribe_code = v_code;
  insert into public.docs(tribe_code, col, id, data) select v_code, col, id, data from public.docs where tribe_code = 'SAMPLE';
  insert into public.memberships(tribe_code, user_id, member_id, role, status) values (v_code, v_user, v_me, 'parent', 'active')
    on conflict (tribe_code, user_id) do update set member_id = excluded.member_id, role = 'parent', status = 'active', removed_at = null;
  insert into public.subscriptions(tribe_code, status, note) values (v_code, 'comped', 'App store reviewer account')
    on conflict (tribe_code) do update set status = 'comped', note = excluded.note, updated_at = now();
end $$;
