-- HeyTribe plan changes: 14-day free trial, and Hey Tribe AI limits checked on the server.

-- new families get 14 days of Premium (was 7); families in a trial right now get the extra week too
create or replace function public.start_trial()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.code <> 'SAMPLE' then
    insert into public.subscriptions(tribe_code, status, trial_ends_at) values (new.code, 'trialing', now() + interval '14 days') on conflict do nothing;
  end if;
  return new;
end $$;
update public.subscriptions set trial_ends_at = trial_ends_at + interval '7 days', updated_at = now()
where status = 'trialing' and trial_ends_at > now();

-- Hey Tribe AI uses per family per month. Free families get 10; Premium and trials are unlimited.
create table if not exists public.ai_usage (
  tribe_code text not null references public.tribes(code) on delete cascade,
  month text not null,
  uses int not null default 0,
  primary key (tribe_code, month)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- called by /api/heytribe with the signed-in person's login; true = go ahead (and counted), false = over the free limit
create or replace function public.ht_ai_take(p_code text, p_enforce boolean)
returns boolean language plpgsql security definer set search_path = public as $$
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
end $$;
revoke all on function public.ht_ai_take(text, boolean) from public, anon;
grant execute on function public.ht_ai_take(text, boolean) to authenticated;
