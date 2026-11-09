-- 1. Which version of the Terms and the Privacy Policy each person agreed to, and when.
--    The app records it at sign-up and asks again when either document changes.
create table public.terms_acceptances (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  terms_version text not null check (terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  privacy_version text not null check (privacy_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  source text not null default 'prompt' check (source in ('sign_up', 'prompt')),
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version, privacy_version)
);
alter table public.terms_acceptances enable row level security;
create policy terms_acceptances_read on public.terms_acceptances for select to authenticated using ((user_id = (select auth.uid())) or is_admin());
create policy terms_acceptances_insert on public.terms_acceptances for insert to authenticated with check (user_id = (select auth.uid()));
revoke all on public.terms_acceptances from anon, authenticated;
grant select on public.terms_acceptances to authenticated;
-- Only these columns: the person and the time are always filled in by the database.
grant insert (terms_version, privacy_version, source) on public.terms_acceptances to authenticated;

-- 2. Sign in with Apple. Apple requires that deleting an account also revokes the app's Apple tokens.
--    Apple's refresh token is saved right after an Apple sign-in (website: from the sign-in session; iPhone app: the
--    server trades Apple's one-time code for it). It is kept where no API role can read it.
--    The 5-minute server schedule revokes it at Apple for accounts being deleted.
create table private.apple_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null check (char_length(refresh_token) between 10 and 2000),
  client_id text not null check (client_id in ('app.heytribe.web', 'app.heytribe.ios')),
  saved_at timestamptz not null default now()
);
alter table private.apple_tokens enable row level security;

-- Apple relay addresses (@privaterelay.appleid.com) whose forwarding the person turned off. No email goes to these.
create table private.email_stops (
  email text primary key check (email = lower(email)),
  reason text not null,
  at timestamptz not null default now()
);
alter table private.email_stops enable row level security;

alter table public.deletion_requests add column apple_revoked_at timestamptz;
alter table public.deletion_requests add column apple_revoke_error text check (char_length(apple_revoke_error) <= 300);

-- Called by the app right after an Apple sign-in.
create or replace function public.apple_token_save(p_token text, p_client text default 'app.heytribe.web')
returns boolean language plpgsql security definer set search_path = public, private, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if coalesce(char_length(p_token), 0) not between 10 and 2000 or p_client not in ('app.heytribe.web', 'app.heytribe.ios') then raise exception 'bad token' using errcode = '22023'; end if;
  if not exists (select 1 from auth.identities i where i.user_id = auth.uid() and i.provider = 'apple') then return false; end if;
  insert into private.apple_tokens(user_id, refresh_token, client_id) values (auth.uid(), p_token, p_client)
    on conflict (user_id) do update set refresh_token = excluded.refresh_token, client_id = excluded.client_id, saved_at = now();
  return true;
end $$;
revoke all on function public.apple_token_save(text, text) from public, anon, authenticated;
grant execute on function public.apple_token_save(text, text) to authenticated;

-- Server only (cron secret): Apple tokens of accounts that asked to be deleted and were not revoked yet.
create or replace function public.apple_revoke_pending(p_secret text)
returns table(user_id uuid, refresh_token text, client_id text) language plpgsql stable security definer set search_path = public, private as $$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query select t.user_id, t.refresh_token, t.client_id from private.apple_tokens t
    where exists (select 1 from deletion_requests d where d.user_id = t.user_id and d.kind = 'account' and d.done_at is null)
    order by t.saved_at limit 50;
end $$;

-- Server only: record the result. On success the token is thrown away.
create or replace function public.apple_revoke_done(p_secret text, p_user uuid, p_error text)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_error is null then
    delete from private.apple_tokens where user_id = p_user;
    update deletion_requests set apple_revoked_at = now(), apple_revoke_error = null where user_id = p_user and kind = 'account' and done_at is null;
  else
    update deletion_requests set apple_revoke_error = left(p_error, 300) where user_id = p_user and kind = 'account' and done_at is null;
  end if;
end $$;

-- Server only: Sign in with Apple server-to-server notifications (verified by the server before calling this).
--   consent-revoked: the person stopped using Apple sign-in for HeyTribe. Throw away the token.
--   account-delete:  the person deleted their Apple account. Delete their HeyTribe account the same way the app does.
--   email-disabled / email-enabled: the person turned Apple's email forwarding off or on for HeyTribe.
create or replace function public.apple_event(p_secret text, p_sub text, p_type text, p_email text)
returns text language plpgsql security definer set search_path = public, private, auth as $$
declare v_user uuid;
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select i.user_id into v_user from auth.identities i where i.provider = 'apple' and i.provider_id = p_sub limit 1;
  if p_type in ('email-disabled', 'email-enabled') and coalesce(p_email, '') <> '' then
    if p_type = 'email-disabled' then
      insert into private.email_stops(email, reason) values (lower(p_email), 'Apple email forwarding turned off') on conflict (email) do nothing;
    else
      delete from private.email_stops where email = lower(p_email);
    end if;
    return 'ok';
  end if;
  if v_user is null then return 'unknown'; end if;
  if p_type = 'consent-revoked' then
    delete from private.apple_tokens where user_id = v_user;
    return 'ok';
  end if;
  if p_type = 'account-delete' then
    delete from private.apple_tokens where user_id = v_user;
    if not exists (select 1 from deletion_requests where user_id = v_user and kind = 'account' and done_at is null) then
      -- run the app's own deletion as that person (auth.uid() reads this setting for the rest of this call)
      perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', v_user::text, true);
      perform public.request_account_deletion();
      update deletion_requests set apple_revoked_at = now() where user_id = v_user and kind = 'account' and done_at is null;
    end if;
    return 'ok';
  end if;
  return 'ignored';
end $$;

-- Server only: addresses that must not get email.
create or replace function public.email_stops_list(p_secret text)
returns text[] language plpgsql stable security definer set search_path = public, private as $$
begin
  if p_secret is null or not exists (select 1 from private.app_secrets where name = 'cron' and value = p_secret) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((select array_agg(email) from private.email_stops), '{}');
end $$;

-- The server calls Supabase with the public key plus the cron secret, so these must be callable by anon.
-- Each one refuses to do anything without the secret.
revoke all on function public.apple_revoke_pending(text), public.apple_revoke_done(text, uuid, text),
  public.apple_event(text, text, text, text), public.email_stops_list(text) from public, anon, authenticated;
grant execute on function public.apple_revoke_pending(text), public.apple_revoke_done(text, uuid, text),
  public.apple_event(text, text, text, text), public.email_stops_list(text) to anon;
