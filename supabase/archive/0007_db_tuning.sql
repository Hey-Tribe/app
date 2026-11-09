-- Performance and hardening from the Supabase advisors. No data changes.
alter policy memberships_update_own on public.memberships using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy memberships_leave on public.memberships using (user_id = (select auth.uid()));
alter policy memberships_read_own on public.memberships using (user_id = (select auth.uid()));
alter policy tickets_read on public.tickets using ((user_id = (select auth.uid())) or public.is_admin());
alter policy ticket_messages_read on public.ticket_messages using (public.is_admin() or ((not internal) and exists (select 1 from public.tickets t where t.id = ticket_messages.ticket_id and t.user_id = (select auth.uid()))));
alter policy push_own_read on public.push_subscriptions using (user_id = (select auth.uid()));
alter policy push_own_insert on public.push_subscriptions with check ((user_id = (select auth.uid())) and public.is_member(tribe_code));
alter policy push_own_update on public.push_subscriptions using (user_id = (select auth.uid())) with check ((user_id = (select auth.uid())) and public.is_member(tribe_code));
alter policy push_own_remove on public.push_subscriptions using (user_id = (select auth.uid()));

create index if not exists admin_emails_user_id_idx on public.admin_emails(user_id);
create index if not exists push_subscriptions_tribe_idx on public.push_subscriptions(tribe_code);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index if not exists tickets_tribe_idx on public.tickets(tribe_code);
create index if not exists tribes_created_by_idx on public.tribes(created_by);
create index if not exists push_log_sent_idx on public.push_log(sent_at);

-- Signed-out visitors never need these.
revoke execute on function public.start_trial() from anon, public;
grant execute on function public.start_trial() to authenticated;
