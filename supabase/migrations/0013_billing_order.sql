-- STATUS: not applied yet (waiting on approval in Supabase). The code does not depend on it until applied.
-- HeyTribe billing reliability (Oct 2026 audit):
--  * ignore payment events that arrive out of order (an older "active" can't undo a newer "canceled")
--  * find paid Stripe subscriptions on families that were deleted, so the server can stop the billing
--  * slow down website form spam

alter table public.subscriptions add column if not exists billing_event_at timestamptz;

drop function if exists public.billing_sync(text, text, text, text, text, timestamptz);
create or replace function public.billing_sync(p_secret text, p_code text, p_status text, p_customer text, p_subscription text, p_period_end timestamptz, p_event_at timestamptz default null)
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
    billing_event_at = greatest(coalesce(p_event_at, now()), coalesce(billing_event_at, '-infinity')),
    updated_at = now()
  where tribe_code = p_code
    and (p_event_at is null or billing_event_at is null or p_event_at >= billing_event_at);
  return true;
end $$;
revoke all on function public.billing_sync(text, text, text, text, text, timestamptz, timestamptz) from public;
grant execute on function public.billing_sync(text, text, text, text, text, timestamptz, timestamptz) to anon, authenticated;

drop function if exists public.apple_sync(text, text, text, text, timestamptz);
create or replace function public.apple_sync(p_secret text, p_code text, p_otx text, p_status text, p_period_end timestamptz, p_event_at timestamptz default null)
returns text language plpgsql security definer set search_path = public, private as $$
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
      billing_event_at = greatest(coalesce(p_event_at, now()), coalesce(billing_event_at, '-infinity')),
      updated_at = now()
    where stripe_subscription_id = v_ref
      and (p_event_at is null or billing_event_at is null or p_event_at >= billing_event_at);
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
    billing_event_at = greatest(coalesce(p_event_at, now()), coalesce(billing_event_at, '-infinity')),
    updated_at = now()
  where tribe_code = p_code;
  return 'ok';
end $$;
revoke all on function public.apple_sync(text, text, text, text, timestamptz, timestamptz) from public;
grant execute on function public.apple_sync(text, text, text, text, timestamptz, timestamptz) to anon, authenticated;

-- Stripe subscriptions still running on deleted families (the cron job cancels them in Stripe)
create or replace function public.billing_orphans(p_secret text)
returns table(tribe_code text, stripe_subscription_id text) language plpgsql stable security definer set search_path = public, private as $$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query select s.tribe_code, s.stripe_subscription_id from subscriptions s join tribes t on t.code = s.tribe_code
    where t.deleted_at is not null and s.status in ('active','past_due') and s.stripe_subscription_id like 'sub\_%';
end $$;
revoke all on function public.billing_orphans(text) from public;
grant execute on function public.billing_orphans(text) to anon;

-- website forms: at most 5 messages an hour from one email, 300 an hour overall
create or replace function public.site_submissions_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from site_submissions where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from site_submissions where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'too many messages, try again later' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists site_submissions_limit on public.site_submissions;
create trigger site_submissions_limit before insert on public.site_submissions for each row execute function public.site_submissions_limit();
