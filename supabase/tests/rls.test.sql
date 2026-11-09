-- Row level security tests. Run with: supabase test db (CI runs them on every change).
-- Acts as a signed-out visitor (anon) and as two different signed-in users, and proves each one
-- only reaches what they should. Also guards the rules that keep new tables and functions safe.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(67);

-- Two people, each with their own family; plus a third who asked to join family A and is still pending.
insert into auth.users (id, aud, role, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'ana@example.com', now()),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'ben@example.com', now()),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'cy@example.com', now());

create temp table t_codes (who text primary key, code text);
grant all on t_codes to anon, authenticated;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

-- Ana and Ben each create a family through the app's own function.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into t_codes select 'ana', (create_tribe('Ana family', 'Ana'))->>'code';
insert into docs(tribe_code, col, id, data) select code, 'lists', 'groceries', '{"title":"Groceries"}' from t_codes where who = 'ana';
select create_ticket('Help', 'Ana needs help', 'question', null, '{}');
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into t_codes select 'ben', (create_tribe('Ben family', 'Ben'))->>'code';
reset role;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select join_tribe((select code from t_codes where who = 'ana'));
reset role;

-- 1. Signed-out visitor
select pg_temp.as_anon();
select ok((select count(*) from tribes where code = 'SAMPLE') = 1, 'anon can read the sample family');
select is((select count(*)::int from tribes where code <> 'SAMPLE'), 0, 'anon cannot read real families');
select is((select count(*)::int from docs where tribe_code <> 'SAMPLE'), 0, 'anon cannot read family data');
select is((select count(*)::int from memberships), 0, 'anon cannot read memberships');
select is((select count(*)::int from subscriptions), 0, 'anon cannot read subscriptions');
select is((select count(*)::int from tickets), 0, 'anon cannot read support tickets');
select is((select count(*)::int from ticket_messages), 0, 'anon cannot read support messages');
select is((select count(*)::int from deletion_requests), 0, 'anon cannot read deletion requests');
select is((select count(*)::int from site_submissions), 0, 'anon cannot read contact form messages');
select is((select count(*)::int from admin_emails), 0, 'anon cannot read the admin list');
select is((select count(*)::int from roadmap_items where not public), 0, 'anon cannot read private roadmap items');
select throws_ok($$ insert into docs(tribe_code, col, id, data) values ('SAMPLE', 'lists', 'x', '{}') $$, '42501', null, 'anon cannot write family data');
select throws_ok($$ insert into tribes(code, name) values ('ZZZZ', 'x') $$, '42501', null, 'anon cannot create families directly');
select throws_ok($$ select create_tribe('x', 'y') $$, '42501', null, 'anon cannot call create_tribe');
select throws_ok($$ select billing_sync('wrong', 'SAMPLE', 'active', null, null, null) $$, '42501', null, 'billing_sync refuses a wrong secret');
select throws_ok($$ select reminder_feed('wrong') $$, '42501', null, 'reminder_feed refuses a wrong secret');
select throws_ok($$ select email_feed(null) $$, '42501', null, 'email_feed refuses no secret');
select ok(sitter_sheet('not-a-token') is null, 'sitter_sheet returns nothing for a bad token');
select ok(calendar_feed('not-a-token') is null, 'calendar_feed returns nothing for a bad token');
select lives_ok($$ insert into page_views(path, vid) values ('/', 'abcdef12') $$, 'anon can record a page view');
reset role;

-- 2. Ana, signed in
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from tribes where code = (select code from t_codes where who = 'ana')), 1, 'Ana sees her family');
select is((select count(*)::int from tribes where code = (select code from t_codes where who = 'ben')), 0, 'Ana cannot see Ben''s family');
select is((select count(*)::int from docs where tribe_code = (select code from t_codes where who = 'ben')), 0, 'Ana cannot read Ben''s family data');
select throws_ok($$ insert into docs(tribe_code, col, id, data) select code, 'lists', 'x', '{}' from t_codes where who = 'ben' $$, '42501', null, 'Ana cannot write into Ben''s family');
select is((select count(*)::int from memberships where tribe_code = (select code from t_codes where who = 'ben')), 0, 'Ana cannot see Ben''s logins');
select is((select count(*)::int from subscriptions where tribe_code = (select code from t_codes where who = 'ana')), 1, 'Ana sees her own plan');
select is((select count(*)::int from subscriptions where tribe_code = (select code from t_codes where who = 'ben')), 0, 'Ana cannot see Ben''s plan');
select throws_ok($$ update subscriptions set status = 'active' $$, '42501', null, 'Ana cannot change a plan herself');
select is((select count(*)::int from tickets), 1, 'Ana sees only her own ticket');
select throws_ok($$ select admin_stats() $$, '42501', null, 'admin functions refuse a normal user');
select throws_ok($$ select admin_users('', 50, 0) $$, '42501', null, 'admin user list refuses a normal user');
select is((admin_whoami())->>'admin', 'false', 'admin_whoami says no for a normal user');
select throws_ok($$ select tribe_logins((select code from t_codes where who = 'ben')) $$, '42501', null, 'Ana cannot list Ben''s logins');
select throws_ok($$ select make_sitter_link((select code from t_codes where who = 'ben'), 2) $$, '42501', null, 'Ana cannot make a sitter link for Ben''s family');
select throws_ok($$ insert into docs(tribe_code, col, id, data) values ('SAMPLE', 'lists', 'x', '{}') $$, '42501', null, 'nobody can change the sample family');
reset role;

-- 3. Cy asked to join Ana's family and is not approved yet
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is((select count(*)::int from docs where tribe_code = (select code from t_codes where who = 'ana')), 0, 'a pending login cannot read the family yet');
select throws_ok($$ insert into docs(tribe_code, col, id, data) select code, 'lists', 'y', '{}' from t_codes where who = 'ana' $$, '42501', null, 'a pending login cannot write');
reset role;

-- 4. Server-only tables: no API role can read or write them.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select ok(not has_table_privilege('authenticated', 'public.ai_usage', 'select'), 'ai_usage is closed to signed-in users');
select is((select count(*)::int from calendar_feeds) + (select count(*)::int from email_log)
  + (select count(*)::int from portfolio_goals) + (select count(*)::int from push_log), 0, 'server-only tables return nothing to a signed-in user');
select throws_ok($$ insert into email_log(key) values ('x') $$, '42501', null, 'server-only tables refuse writes');
reset role;

-- 5. Rules that keep future changes safe
select is((select count(*)::int from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity), 0,
  'every public table has row level security on');
select is((select count(*)::int from pg_namespace n where n.nspname = 'private' and has_schema_privilege('anon', n.oid, 'usage')), 0,
  'the private schema is closed to the API');
-- Functions that run with full rights and can be called without signing in. Each one is reviewed:
-- feeds take an unguessable token, sync functions take a server secret, the rest only answer about the caller.
select is((select coalesce(array_agg(p.proname::text order by p.proname), '{}') from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
    and p.proname not in ('apple_event', 'apple_revoke_done', 'apple_revoke_pending', 'apple_sync', 'billing_orphans', 'billing_sync',
                          'calendar_feed', 'can_read', 'email_done', 'email_feed', 'email_stops_list',
                          'is_admin', 'is_member', 'reminder_done', 'reminder_feed', 'sitter_sheet')),
  '{}'::text[], 'no unreviewed full-rights function is open to signed-out visitors');
-- Every admin function a signed-in user can call must check is_admin() itself.
select is((select coalesce(array_agg(p.proname::text order by p.proname), '{}') from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname like 'admin\_%' and has_function_privilege('authenticated', p.oid, 'execute')
    and pg_get_functiondef(p.oid) !~ 'if not public\.is_admin\(\) then'),
  '{}'::text[], 'every callable admin function checks the caller is an admin');
-- Two permissive SELECT policies on one table widen each other. These tables were reviewed; a new one fails here.
select is((select coalesce(array_agg(tablename::text order by tablename), '{}') from (
    select tablename from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' and cmd in ('SELECT', 'ALL')
    group by tablename having count(*) > 1) x
  where tablename not in ('announcements', 'memberships')),
  '{}'::text[], 'no unreviewed table has overlapping read policies');
select is((select count(*)::int from pg_extension e where e.extname = 'pg_net' and e.extnamespace = 'public'::regnamespace), 0,
  'pg_net is not installed in the public schema');

-- 6. Terms records, app versions and Sign in with Apple
select pg_temp.as_anon();
select is((select count(*)::int from app_versions), 2, 'anyone can read the minimum app versions');
select throws_ok($$ update app_versions set min_version = '9.9.9' $$, '42501', null, 'visitors cannot change the minimum app version');
select ok(not has_table_privilege('anon', 'public.terms_acceptances', 'select'), 'visitors cannot read terms records');
select throws_ok($$ select apple_revoke_pending('wrong') $$, '42501', null, 'apple_revoke_pending refuses a wrong secret');
select throws_ok($$ select apple_event('wrong', 'x', 'account-delete', null) $$, '42501', null, 'apple_event refuses a wrong secret');
select throws_ok($$ select email_stops_list(null) $$, '42501', null, 'email_stops_list refuses no secret');
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok($$ insert into terms_acceptances(terms_version, privacy_version, source) values ('2026-11-06', '2026-11-06', 'sign_up') $$, 'Ana can record that she agreed');
select throws_ok($$ insert into terms_acceptances(user_id, terms_version, privacy_version) values ('22222222-2222-2222-2222-222222222222', '2026-11-06', '2026-11-06') $$, '42501', null, 'Ana cannot record an agreement for Ben');
select throws_ok($$ update terms_acceptances set terms_version = '2020-01-01' $$, '42501', null, 'agreements cannot be changed afterwards');
update app_versions set min_version = '9.9.9';
select is((select max(min_version) from app_versions), '0.0.0', 'a normal user cannot change the minimum app version');
select is(apple_token_save('a-refresh-token-value'), false, 'an Apple token is only kept for people who signed in with Apple');
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from terms_acceptances), 0, 'Ben cannot see Ana''s agreement');
reset role;
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'apple-sub-ben', 'apple', '{"sub":"apple-sub-ben"}', now(), now());
insert into private.app_secrets(name, value) values ('cron', 'test-cron-secret') on conflict (name) do update set value = excluded.value;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(apple_token_save('ben-apple-refresh-token'), true, 'Ben''s Apple token is kept after an Apple sign-in');
select throws_ok($$ select * from private.apple_tokens $$, '42501', null, 'nobody signed in can read Apple tokens');
select lives_ok($$ select request_account_deletion() $$, 'Ben deletes his account');
reset role;
select pg_temp.as_anon();
select is((select count(*)::int from apple_revoke_pending('test-cron-secret')), 1, 'the server finds Ben''s token to revoke');
select lives_ok($$ select apple_revoke_done('test-cron-secret', '22222222-2222-2222-2222-222222222222', null) $$, 'the server records the revoke');
select is((select count(*)::int from apple_revoke_pending('test-cron-secret')), 0, 'nothing left to revoke');
select is(apple_event('test-cron-secret', 'nobody', 'email-disabled', 'X@privaterelay.appleid.com'), 'ok', 'Apple email-disabled event is stored');
select ok('x@privaterelay.appleid.com' = any(email_stops_list('test-cron-secret')), 'that address is now on the no-email list');
reset role;
select ok((select apple_revoked_at is not null from deletion_requests where user_id = '22222222-2222-2222-2222-222222222222'), 'the deletion request shows the Apple revoke time');

select * from finish();
rollback;
