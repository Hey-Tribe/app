-- Applied live: soft removal, family closing and account deletion requests (see 0005 note).
alter table public.memberships add column if not exists removed_at timestamptz;
alter table public.tribes add column if not exists deleted_at timestamptz;
create unique index if not exists sitter_links_tribe on public.sitter_links(tribe_code);
alter table public.push_subscriptions add column if not exists dead boolean not null default false;
revoke update on public.memberships from authenticated, anon;
grant update (member_id) on public.memberships to authenticated;
-- deletion_requests table, join_tribe (rejoin after removal), tribe_logins (hides removed), manage_login (soft remove),
-- close_tribe, request_account_deletion, my_deletion_pending, make_sitter_link/stop_sitter_link (upsert / expire),
-- calendar_link (upsert), reminder_feed/reminder_done (dead flag) — exactly as applied via the Supabase connector.
