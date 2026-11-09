-- Oldest phone app version still allowed, per platform. The app checks this at launch and shows an update
-- screen when it is older. Change it in the admin (Settings) or with:
--   update public.app_versions set min_version = '1.1.0', updated_at = now() where platform = 'ios';
create table public.app_versions (
  platform text primary key check (platform in ('ios', 'android')),
  min_version text not null default '0.0.0' check (min_version ~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,2}$'),
  note text check (char_length(note) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.app_versions enable row level security;
create policy app_versions_read on public.app_versions for select to anon, authenticated using (true);
create policy app_versions_admin_update on public.app_versions for update to authenticated using (is_admin()) with check (is_admin());
revoke all on public.app_versions from anon, authenticated;
grant select on public.app_versions to anon, authenticated;
grant update (min_version, note, updated_at) on public.app_versions to authenticated;
insert into public.app_versions (platform) values ('ios'), ('android');
