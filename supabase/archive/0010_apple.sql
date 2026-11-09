-- HeyTribe: Premium bought in the iPhone app (Apple in-app purchase).
-- The Apple subscription is stored on the family's subscriptions row as stripe_subscription_id = 'apple:<originalTransactionId>'.
-- Both functions need the same shared secret as billing_sync and are only called by the server (api/apple-*.js).

-- after a purchase or restore in the app: link the Apple subscription to a family and set its status
create or replace function public.apple_sync(p_secret text, p_code text, p_otx text, p_status text, p_period_end timestamptz)
returns text language plpgsql security definer set search_path = public, private as $$
declare v_ref text := 'apple:' || p_otx;
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'billing_sync' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('active','past_due','canceled') or coalesce(p_otx, '') !~ '^[0-9]{1,30}$' then raise exception 'bad input' using errcode = '22023'; end if;

  -- notifications from Apple only know the transaction, not the family
  if p_code is null then
    update subscriptions set
      status = case when status = 'comped' then status else p_status end,
      current_period_end = coalesce(p_period_end, current_period_end),
      updated_at = now()
    where stripe_subscription_id = v_ref;
    return case when found then 'ok' else 'unknown' end;
  end if;

  if not exists (select 1 from tribes where code = p_code and code <> 'SAMPLE') then return 'no_family'; end if;
  -- one Apple subscription pays for one family at a time
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
end $$;
revoke all on function public.apple_sync(text, text, text, text, timestamptz) from public;
grant execute on function public.apple_sync(text, text, text, text, timestamptz) to anon, authenticated;

create index if not exists subscriptions_sub_id_idx on public.subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;
