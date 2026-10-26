-- HeyTribe hardening from the Oct 2026 audit.

-- 1. Only the family name can be changed directly. Deleting a family (parents only) and ownership
--    go through close_tribe / request_account_deletion, which check roles.
revoke insert, update on public.tribes from anon, authenticated;
grant update (name) on public.tribes to authenticated;

-- 2. Tables that are only written by server functions: no direct writes from the browser.
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke insert, update, delete on public.tickets from anon, authenticated;
revoke insert, update, delete on public.ticket_messages from anon, authenticated;

-- 3. Keep a single family document to a sane size (largest today is about 1 KB).
alter table public.docs drop constraint if exists docs_data_size;
alter table public.docs add constraint docs_data_size check (octet_length(data::text) <= 100000) not valid;
alter table public.docs validate constraint docs_data_size;

-- 4. Uploaded family files: photos and PDFs only, 20 MB each (already the size limit).
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif','application/pdf']
where id = 'family-files';

-- 5. Unused older function.
revoke execute on function public.ai_take_quota() from public, anon, authenticated;
