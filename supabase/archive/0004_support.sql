-- HeyTribe support tickets.
-- Families open tickets from the app (signed in) and the website contact form (becomes a ticket automatically).
-- The team answers in admin.heytribe.app → Support. Families see replies inside the app.

create table if not exists public.tickets (
  id               uuid primary key default gen_random_uuid(),
  number           bigint generated always as identity (start with 1001) unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  source           text not null default 'app' check (source in ('app','website','admin')),
  user_id          uuid references auth.users(id) on delete set null,
  email            text not null check (char_length(email) between 3 and 200),
  name             text check (char_length(name) <= 120),
  tribe_code       text references public.tribes(code) on delete set null,
  subject          text not null check (char_length(subject) between 1 and 140),
  category         text not null default 'question' check (category in ('question','bug','billing','account','idea','other')),
  priority         text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status           text not null default 'open' check (status in ('open','waiting','resolved')),
  assignee         text check (char_length(assignee) <= 200),
  context          jsonb not null default '{}'::jsonb,
  last_from        text not null default 'customer' check (last_from in ('customer','team')),
  team_last_at     timestamptz,
  customer_seen_at timestamptz,
  message_count    int not null default 0
);
create index if not exists tickets_user on public.tickets(user_id);
create index if not exists tickets_status on public.tickets(status, updated_at desc);

create table if not exists public.ticket_messages (
  id           bigint generated always as identity primary key,
  ticket_id    uuid not null references public.tickets(id) on delete cascade,
  created_at   timestamptz not null default now(),
  author       text not null check (author in ('customer','team')),
  author_email text,
  internal     boolean not null default false,
  body         text not null check (char_length(body) between 1 and 5000)
);
create index if not exists ticket_messages_ticket on public.ticket_messages(ticket_id, created_at);

create table if not exists public.saved_replies (
  id         bigint generated always as identity primary key,
  title      text not null check (char_length(title) between 1 and 80),
  body       text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.saved_replies enable row level security;
create policy tickets_read on public.tickets for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy ticket_messages_read on public.ticket_messages for select to authenticated using (
  public.is_admin() or (not internal and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())));
create policy saved_replies_admin on public.saved_replies for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- family side ----------
create or replace function public.create_ticket(p_subject text, p_body text, p_category text, p_tribe text, p_context jsonb)
returns json language plpgsql security definer set search_path = public, auth as $$
declare u record; t record;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if (select count(*) from tickets where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many requests today' using errcode = '54000'; end if;
  p_subject := btrim(coalesce(p_subject,'')); p_body := btrim(coalesce(p_body,''));
  if p_body = '' then raise exception 'message required' using errcode = '22023'; end if;
  if p_subject = '' then p_subject := left(regexp_replace(p_body, '\s+', ' ', 'g'), 80); end if;
  select id, email into u from auth.users where id = auth.uid();
  insert into tickets(source, user_id, email, tribe_code, subject, category, context, message_count)
  values ('app', u.id, lower(u.email), case when p_tribe is not null and public.is_member(p_tribe) then p_tribe end, left(p_subject,140),
          case when p_category in ('question','bug','billing','account','idea','other') then p_category else 'question' end,
          coalesce(p_context, '{}'::jsonb) - 'email', 1)
  returning id, number into t;
  insert into ticket_messages(ticket_id, author, author_email, body) values (t.id, 'customer', lower(u.email), left(p_body, 5000));
  return json_build_object('id', t.id, 'number', t.number);
end $$;

create or replace function public.ticket_reply(p_ticket uuid, p_body text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from tickets where id = p_ticket and user_id = auth.uid()) then raise exception 'not allowed' using errcode = '42501'; end if;
  p_body := btrim(coalesce(p_body,'')); if p_body = '' then raise exception 'message required' using errcode = '22023'; end if;
  insert into ticket_messages(ticket_id, author, author_email, body) values (p_ticket, 'customer', (select lower(email) from auth.users where id = auth.uid()), left(p_body, 5000));
  update tickets set status = 'open', last_from = 'customer', updated_at = now(), customer_seen_at = now(), message_count = message_count + 1 where id = p_ticket;
end $$;

create or replace function public.ticket_seen(p_ticket uuid)
returns void language sql security definer set search_path = public as $$
  update tickets set customer_seen_at = now() where id = p_ticket and user_id = auth.uid();
$$;

-- website contact form → ticket
create or replace function public.contact_to_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if new.kind <> 'contact' or coalesce(btrim(new.message),'') = '' then return new; end if;
  insert into tickets(source, email, name, subject, category, message_count, context)
  values ('website', lower(new.email), new.name, left(coalesce(nullif(btrim(new.topic),''), 'Website message') || ': ' || regexp_replace(new.message, '\s+', ' ', 'g'), 140),
          case new.topic when 'Help with the app' then 'bug' when 'Partnerships' then 'other' when 'Press' then 'other' when 'Something else' then 'other' else 'question' end,
          1, jsonb_build_object('topic', new.topic, 'phone', new.phone))
  returning id into tid;
  insert into ticket_messages(ticket_id, author, author_email, body) values (tid, 'customer', lower(new.email), left(new.message, 5000));
  new.status := 'done';
  return new;
end $$;
create trigger site_submissions_ticket before insert on public.site_submissions for each row execute function public.contact_to_ticket();

-- ---------- team side ----------
create or replace function public.admin_tickets(p_status text default 'active', p_q text default '')
returns table(id uuid, number bigint, created_at timestamptz, updated_at timestamptz, source text, email text, name text, tribe_code text, tribe_name text,
              subject text, category text, priority text, status text, assignee text, last_from text, message_count int, preview text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me text := (select lower(u.email) from auth.users u where u.id = auth.uid());
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select t.id, t.number, t.created_at, t.updated_at, t.source, t.email, t.name, t.tribe_code, tr.name, t.subject, t.category, t.priority, t.status, t.assignee, t.last_from, t.message_count,
           (select left(m.body, 160) from ticket_messages m where m.ticket_id = t.id and not m.internal order by m.created_at desc limit 1)
    from tickets t left join tribes tr on tr.code = t.tribe_code
    where (p_status = 'all' or (p_status = 'active' and t.status <> 'resolved') or t.status = p_status or (p_status = 'mine' and t.assignee = me and t.status <> 'resolved'))
      and (coalesce(p_q,'') = '' or t.subject ilike '%'||p_q||'%' or t.email ilike '%'||p_q||'%' or t.number::text = btrim(p_q, '# ') or coalesce(t.name,'') ilike '%'||p_q||'%')
    order by case t.priority when 'urgent' then 0 when 'high' then 1 else 2 end, case when t.status = 'open' then 0 when t.status = 'waiting' then 1 else 2 end, t.updated_at desc
    limit 300;
end $$;

create or replace function public.admin_ticket_reply(p_ticket uuid, p_body text, p_internal boolean, p_status text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare me text;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  p_body := btrim(coalesce(p_body,'')); if p_body = '' then raise exception 'message required' using errcode = '22023'; end if;
  select lower(email) into me from auth.users where id = auth.uid();
  insert into ticket_messages(ticket_id, author, author_email, internal, body) values (p_ticket, 'team', me, coalesce(p_internal,false), left(p_body,5000));
  if coalesce(p_internal,false) then
    update tickets set updated_at = now(), assignee = coalesce(assignee, me) where id = p_ticket;
  else
    update tickets set status = case when p_status in ('open','waiting','resolved') then p_status else 'waiting' end,
      last_from = 'team', team_last_at = now(), updated_at = now(), assignee = coalesce(assignee, me), message_count = message_count + 1 where id = p_ticket;
  end if;
end $$;

create or replace function public.admin_ticket_update(p_ticket uuid, p_status text, p_priority text, p_category text, p_assignee text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update tickets set
    status   = case when p_status in ('open','waiting','resolved') then p_status else status end,
    priority = case when p_priority in ('low','normal','high','urgent') then p_priority else priority end,
    category = case when p_category in ('question','bug','billing','account','idea','other') then p_category else category end,
    assignee = case when p_assignee is null then assignee when p_assignee = '' then null else lower(p_assignee) end,
    updated_at = now()
  where id = p_ticket;
end $$;

create or replace function public.admin_ticket_new(p_email text, p_subject text, p_body text, p_category text)
returns json language plpgsql security definer set search_path = public, auth as $$
declare me text; uid uuid; t record;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select lower(email) into me from auth.users where id = auth.uid();
  select id into uid from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  insert into tickets(source, user_id, email, subject, category, status, last_from, team_last_at, assignee, message_count)
  values ('admin', uid, lower(btrim(p_email)), left(btrim(p_subject),140), coalesce(nullif(p_category,''),'question'), 'waiting', 'team', now(), me, 1)
  returning id, number into t;
  insert into ticket_messages(ticket_id, author, author_email, body) values (t.id, 'team', me, left(btrim(p_body),5000));
  return json_build_object('id', t.id, 'number', t.number, 'in_app', uid is not null);
end $$;

-- the latest admin_stats, plus ticket counts
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
    'errors_24h',    (select count(*) from client_errors where at > now() - interval '24 hours'),
    'tickets_open',  (select count(*) from tickets where status = 'open'),
    'tickets_waiting', (select count(*) from tickets where status = 'waiting'),
    'tickets_urgent',  (select count(*) from tickets where status = 'open' and priority in ('high','urgent')),
    'tickets_oldest_hours', (select round(extract(epoch from now() - min(updated_at)) / 3600) from tickets where status = 'open')
  );
end $$;

revoke all on function public.create_ticket(text, text, text, text, jsonb) from public, anon;
revoke all on function public.ticket_reply(uuid, text) from public, anon;
revoke all on function public.ticket_seen(uuid) from public, anon;
revoke all on function public.admin_tickets(text, text) from public, anon;
revoke all on function public.admin_ticket_reply(uuid, text, boolean, text) from public, anon;
revoke all on function public.admin_ticket_update(uuid, text, text, text, text) from public, anon;
revoke all on function public.admin_ticket_new(text, text, text, text) from public, anon;
revoke all on function public.contact_to_ticket() from public, anon, authenticated;
grant execute on function public.create_ticket(text, text, text, text, jsonb) to authenticated;
grant execute on function public.ticket_reply(uuid, text) to authenticated;
grant execute on function public.ticket_seen(uuid) to authenticated;
grant execute on function public.admin_tickets(text, text) to authenticated;
grant execute on function public.admin_ticket_reply(uuid, text, boolean, text) to authenticated;
grant execute on function public.admin_ticket_update(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_ticket_new(text, text, text, text) to authenticated;

insert into public.saved_replies(title, body) values
 ('Thanks, looking into it', 'Thanks for writing in! I''m looking into this now and will get back to you shortly.'),
 ('Fixed', 'Good news: this is fixed now. Close and reopen HeyTribe (or refresh the page) and it should work. Let me know if anything still looks off.'),
 ('Invite code help', 'To join your family''s tribe: open HeyTribe, log in, tap "Join with an invite code" and type the 6-character code from Family & settings on the other person''s phone. Then tap "That''s me" next to your name.'),
 ('Password reset', 'You can reset your password from the login screen: tap "Forgot password?", enter your email, and follow the link we send you.'),
 ('Cancel Premium', 'You can cancel anytime in Family & settings → Manage billing. You keep Premium until the end of the month you''ve paid for, and your tribe keeps everything on the free plan.');

-- the only earlier website message was a setup test; mark it handled
update public.site_submissions set status = 'done' where kind = 'contact';
