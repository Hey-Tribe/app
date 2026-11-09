-- HeyTribe: Stripe billing sync, visitor stats, sign-up sources and error reports.

-- ---------- billing ----------
-- The Stripe webhook (api/stripe-webhook.js) calls billing_sync with a shared secret.
-- The secret lives in a schema the public API can't read; set it once with:
--   insert into private.app_secrets(name, value) values ('billing_sync', '<BILLING_SYNC_SECRET>');
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.app_secrets (name text primary key, value text not null);

alter table public.subscriptions add column if not exists source   text;
alter table public.subscriptions add column if not exists campaign text;

create or replace function public.billing_sync(p_secret text, p_code text, p_status text, p_customer text, p_subscription text, p_period_end timestamptz)
returns boolean language plpgsql security definer set search_path = public, private as $$
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
end $$;
revoke all on function public.billing_sync(text, text, text, text, text, timestamptz) from public;
grant execute on function public.billing_sync(text, text, text, text, text, timestamptz) to anon, authenticated;

-- first-touch source for a new tribe (where the family came from), set once by a member
create or replace function public.set_signup_source(p_code text, p_src text, p_campaign text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_code) then return; end if;
  update subscriptions set source = left(nullif(btrim(lower(p_src)), ''), 60), campaign = left(nullif(btrim(p_campaign), ''), 80)
  where tribe_code = p_code and source is null;
end $$;
revoke all on function public.set_signup_source(text, text, text) from public, anon;
grant execute on function public.set_signup_source(text, text, text) to authenticated;

-- ---------- visitor stats ----------
create table if not exists public.page_views (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  path     text not null check (length(path) between 1 and 200),
  src      text not null default 'direct' check (length(src) <= 60),
  campaign text check (length(campaign) <= 80),
  vid      text not null check (length(vid) between 6 and 24),
  device   text not null default 'desktop' check (device in ('phone','tablet','desktop')),
  lang     text check (length(lang) <= 5)
);
create index if not exists page_views_at on public.page_views(at);
alter table public.page_views enable row level security;
create policy page_views_insert on public.page_views for insert to anon, authenticated with check (at > now() - interval '5 minutes');

-- ---------- error reports ----------
create table if not exists public.client_errors (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  area    text not null check (area in ('site','app','admin')),
  path    text check (length(path) <= 200),
  message text not null check (length(message) between 1 and 300),
  source  text check (length(source) <= 200),
  line    int,
  ua      text check (length(ua) <= 200),
  vid     text check (length(vid) <= 24)
);
create index if not exists client_errors_at on public.client_errors(at);
alter table public.client_errors enable row level security;
create policy client_errors_insert on public.client_errors for insert to anon, authenticated with check (at > now() - interval '5 minutes');

-- ---------- admin reads ----------
create or replace function public.admin_traffic(p_days int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
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
end $$;

create or replace function public.admin_errors(p_days int default 7)
returns table(area text, message text, n bigint, visitors bigint, last_at timestamptz, path text, source text, line int, ua text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select e.area, e.message, count(*), count(distinct e.vid), max(e.at),
           (array_agg(e.path order by e.at desc))[1], (array_agg(e.source order by e.at desc))[1],
           (array_agg(e.line order by e.at desc))[1], (array_agg(e.ua order by e.at desc))[1]
    from client_errors e where e.at > now() - make_interval(days => greatest(p_days, 1))
    group by e.area, e.message order by max(e.at) desc limit 100;
end $$;

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
    'inbox_new',     (select count(*) from site_submissions where status = 'new'),
    'visitors_7d',   (select count(distinct vid) from page_views where at > now() - interval '7 days'),
    'errors_24h',    (select count(*) from client_errors where at > now() - interval '24 hours')
  );
end $$;

revoke all on function public.admin_traffic(int) from public, anon;
revoke all on function public.admin_errors(int) from public, anon;
grant execute on function public.admin_traffic(int) to authenticated;
grant execute on function public.admin_errors(int) to authenticated;

update public.roadmap_items set details = 'Privacy-friendly page views, sources and sign-up sources, shown in the admin Traffic tab.', status = 'shipped' where title = 'Analytics';
update public.roadmap_items set status = 'shipped' where title = 'Point the site at www.heytribe.app everywhere';
