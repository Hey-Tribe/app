# Database

- `migrations/` is the source of truth. `20261109000000_baseline.sql` is the production schema as of 9 Nov 2026
  (checked object by object against production). Every change after that is a new file here, named
  `YYYYMMDDHHMMSS_what_it_does.sql`, and the same SQL is applied to production.
- `archive/` holds the older migrations (0001-0013) for history. They don't run. `0013_billing_order.sql` was never
  applied to production.
- `tests/rls.test.sql` proves who can read and write what (signed-out visitor, two families, a pending login),
  plus rules for future changes: row level security on every table, no new full-rights function open to visitors,
  every admin function checks the caller.
- `types.ts` is generated from the migrations. Regenerate it after any schema change.

Run locally (needs Docker):

    npx supabase@2 db start            # fresh database from migrations/ plus seed.sql
    npx supabase@2 test db             # row level security tests
    npx supabase@2 gen types typescript --local --schema public > supabase/types.ts

CI (GitHub > Actions > Checks > database) runs all three on every push. With the `SUPABASE_ACCESS_TOKEN`
repository secret it also compares `types.ts` with production, so a change made straight in production fails CI.

To check production matches the migrations object by object, run `tools/db-fingerprint.sql` in the Supabase SQL
editor and against the local database (`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f tools/db-fingerprint.sql`).
Every row should be the same.
