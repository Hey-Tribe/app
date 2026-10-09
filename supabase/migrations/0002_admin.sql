-- HeyTribe admin (admin.heytribe.app)
-- Admins are listed by email. The first time a confirmed login with that email opens the admin site,
-- the account is bound to that user id, so the email alone can't be reused by anyone else.
-- Every admin function checks is_admin() and family content is never shown, only counts.

create table if not exists public.admin_emails (
  email      text primary key check (email = lower(email)),
  user_id    uuid references auth.users(id) on delete set null,
  added_at   timestamptz not null default now()
);
alter table public.admin_emails enable row level security;
insert into public.admin_emails(email) values ('admin@kopimorehospitalitygroup.com'), ('admin@kopimore.com') on conflict do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.admin_emails a join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid() and u.email_confirmed_at is not null and (a.user_id is null or a.user_id = u.id)
  );
$$;

-- called by the admin site after login: binds the admin email to this account the first time
create or replace function public.admin_whoami()
returns json language plpgsql security definer set search_path = public, auth as $$
declare e text;
begin
  if not public.is_admin() then return json_build_object('admin', false); end if;
  select lower(email) into e from auth.users where id = auth.uid();
  update public.admin_emails set user_id = auth.uid() where email = e and user_id is null;
  return json_build_object('admin', true, 'email', e);
end $$;

create policy admin_emails_admin_read on public.admin_emails for select to authenticated using (public.is_admin());

-- ---------- billing ----------
create table if not exists public.subscriptions (
  tribe_code             text primary key references public.tribes(code) on delete cascade,
  status                 text not null default 'trialing' check (status in ('trialing','active','past_due','canceled','comped','free')),
  plan                   text not null default 'premium',
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text,
  note                   text,
  updated_at             timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subscriptions_member_read on public.subscriptions for select to authenticated using (public.is_member(tribe_code) or public.is_admin());
create policy subscriptions_admin_write on public.subscriptions for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- every new tribe starts a 7-day Premium trial
create or replace function public.start_trial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.code <> 'SAMPLE' then
    insert into public.subscriptions(tribe_code, status, trial_ends_at) values (new.code, 'trialing', now() + interval '7 days') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger tribes_start_trial after insert on public.tribes for each row execute function public.start_trial();
insert into public.subscriptions(tribe_code, status, trial_ends_at)
  select code, 'trialing', created_at + interval '7 days' from public.tribes where code <> 'SAMPLE' on conflict do nothing;

-- ---------- roadmap ----------
create table if not exists public.roadmap_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 140),
  details     text check (char_length(details) <= 4000),
  status      text not null default 'idea' check (status in ('idea','planned','in_progress','shipped')),
  area        text not null default 'app' check (area in ('app','site','billing','launch','growth','ops')),
  priority    int not null default 2 check (priority between 1 and 3),
  target      text check (char_length(target) <= 40),
  public      boolean not null default false,
  sort        double precision not null default extract(epoch from now()),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.roadmap_items enable row level security;
create policy roadmap_public_read on public.roadmap_items for select using (public or public.is_admin());
create policy roadmap_admin_insert on public.roadmap_items for insert to authenticated with check (public.is_admin());
create policy roadmap_admin_update on public.roadmap_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy roadmap_admin_delete on public.roadmap_items for delete to authenticated using (public.is_admin());

-- ---------- inbox: website forms ----------
alter table public.site_submissions add column if not exists status text not null default 'new' check (status in ('new','replied','done'));
alter table public.site_submissions add column if not exists admin_note text check (char_length(admin_note) <= 2000);
create policy site_submissions_admin_read on public.site_submissions for select to authenticated using (public.is_admin());
create policy site_submissions_admin_update on public.site_submissions for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- admin read models (counts only, never family content) ----------
create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = public, auth as $$
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
    'inbox_new',     (select count(*) from site_submissions where status = 'new')
  );
end $$;

create or replace function public.admin_daily(p_days int default 30)
returns table(day date, signups bigint, tribes bigint) language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select d::date,
    (select count(*) from auth.users u where u.created_at >= d and u.created_at < d + interval '1 day'),
    (select count(*) from tribes t where t.code <> 'SAMPLE' and t.created_at >= d and t.created_at < d + interval '1 day')
  from generate_series(date_trunc('day', now()) - make_interval(days => greatest(1, least(p_days, 365)) - 1), date_trunc('day', now()), interval '1 day') d
  order by 1;
end $$;

create or replace function public.admin_users(p_q text default '', p_limit int default 50, p_offset int default 0)
returns table(id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean, tribes json, total bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  with f as (select u.* from auth.users u where p_q = '' or u.email ilike '%' || p_q || '%')
  select f.id, f.email::text, f.created_at, f.last_sign_in_at, f.email_confirmed_at is not null,
    coalesce((select json_agg(json_build_object('code', t.code, 'name', t.name)) from memberships m join tribes t on t.code = m.tribe_code where m.user_id = f.id), '[]'::json),
    count(*) over ()
  from f order by f.created_at desc limit least(p_limit, 200) offset greatest(p_offset, 0);
end $$;

create or replace function public.admin_tribes(p_q text default '', p_limit int default 50, p_offset int default 0)
returns table(code text, name text, created_at timestamptz, owner_email text, people bigint, logins bigint, items bigint, last_active timestamptz,
              status text, trial_ends_at timestamptz, current_period_end timestamptz, total bigint)
language plpgsql stable security definer set search_path = public, auth as $$
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
end $$;

create or replace function public.admin_tribe_detail(p_code text)
returns json language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'counts', coalesce((select json_object_agg(col, n) from (select col, count(*) n from docs where tribe_code = p_code group by col) x), '{}'::json),
    'logins', coalesce((select json_agg(json_build_object('email', u.email, 'joined', m.joined_at) order by m.joined_at) from memberships m join auth.users u on u.id = m.user_id where m.tribe_code = p_code), '[]'::json)
  );
end $$;

create or replace function public.admin_set_subscription(p_code text, p_status text, p_trial_days int default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into subscriptions(tribe_code, status) values (p_code, p_status) on conflict (tribe_code) do update set status = excluded.status;
  update subscriptions set
    trial_ends_at = case when p_trial_days is not null then greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => p_trial_days) else trial_ends_at end,
    note = coalesce(p_note, note), updated_at = now()
  where tribe_code = p_code;
end $$;

revoke all on function public.admin_whoami() from public, anon;
revoke all on function public.admin_stats() from public, anon;
revoke all on function public.admin_daily(int) from public, anon;
revoke all on function public.admin_users(text, int, int) from public, anon;
revoke all on function public.admin_tribes(text, int, int) from public, anon;
revoke all on function public.admin_tribe_detail(text) from public, anon;
revoke all on function public.admin_set_subscription(text, text, int, text) from public, anon;
grant execute on function public.admin_whoami() to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_daily(int) to authenticated;
grant execute on function public.admin_users(text, int, int) to authenticated;
grant execute on function public.admin_tribes(text, int, int) to authenticated;
grant execute on function public.admin_tribe_detail(text) to authenticated;
grant execute on function public.admin_set_subscription(text, text, int, text) to authenticated;

-- ---------- starting roadmap: what's left before and after launch ----------
insert into public.roadmap_items(title, details, status, area, priority, target) values
 ('Turn off "Confirm email" or add an email service', 'Supabase only sends ~2 emails an hour to team addresses. Either disable Confirm email or add SMTP (Resend free tier) so families can finish signing up.', 'planned', 'launch', 1, 'Now'),
 ('Set Supabase Site URL to www.heytribe.app', 'Authentication → URL Configuration. Add https://www.heytribe.app/app/** to redirect URLs so password resets open the app.', 'planned', 'launch', 1, 'Now'),
 ('Stripe checkout for Premium ($4.99/mo, 7-day trial)', 'Checkout + customer portal, webhook updates the subscriptions table. Then the app can enforce Free vs Premium limits.', 'planned', 'billing', 1, 'Before launch'),
 ('Enforce Free vs Premium limits in the app', 'Read the tribe''s subscription and gate the Premium extras listed on the pricing page.', 'planned', 'billing', 1, 'Before launch'),
 ('Hey Tribe AI key', 'Add ANTHROPIC_API_KEY in Vercel so Hey Tribe understands longer, messier notes (and Spanish).', 'planned', 'app', 2, 'Before launch'),
 ('Fill in legal placeholders', 'Support email, company name and address in Privacy, Terms and Contact. Have a lawyer review both.', 'planned', 'launch', 1, 'Before launch'),
 ('Founder story on About', 'Replace the placeholder with why you built HeyTribe.', 'idea', 'site', 3, null),
 ('Point the site at www.heytribe.app everywhere', 'Links, install instructions and share previews still mention heytribe.vercel.app in a few places.', 'planned', 'site', 2, 'Now'),
 ('Calendar sync (Google / Apple)', 'Two-way sync for plans.', 'idea', 'app', 2, null),
 ('Push notifications', 'Reminders for meds, bills, forms and countdowns on the phone''s lock screen.', 'idea', 'app', 2, null),
 ('iPhone and Android store apps', 'Wrap the web app for the App Store and Google Play.', 'idea', 'app', 2, null),
 ('Analytics', 'Privacy-friendly page and sign-up tracking (Vercel Analytics or Plausible).', 'idea', 'growth', 3, null),
 ('Automated backups check', 'Confirm Supabase daily backups and point-in-time recovery on the paid plan.', 'idea', 'ops', 2, null),
 ('Spanish: app screenshots and Hey Tribe demo', 'The site''s app screenshots and typing demo are still in English.', 'idea', 'site', 3, null),
 ('Countdowns on the Today screen', 'Parents add big days; cards count down on Today.', 'shipped', 'app', 2, null),
 ('Customizable Today screen', 'Show, hide and reorder sections per person.', 'shipped', 'app', 2, null),
 ('Desktop web app', 'Sidebar layout and two-column Today on computers.', 'shipped', 'app', 2, null),
 ('Spanish', 'Language switch on the site and in the app.', 'shipped', 'app', 2, null);
