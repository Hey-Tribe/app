# Deploys

This repo deploys to three Vercel projects in the Hey Tribe team. Every push to `main` builds all three.

| Part | Vercel project | Address |
|---|---|---|
| Site | heytribe-site | www.heytribe.app (heytribe.app redirects here) |
| App | heytribe | app.heytribe.app |
| Admin | heytribe-admin | admin.heytribe.app |

## Still to do

The app still lives under `/app/`, so for now it opens at app.heytribe.app/app/. Serving it at the root of
app.heytribe.app, and sending heytribe.app/app/ there, is the next code change. Supabase sign-in addresses
need app.heytribe.app added at the same time.

## Keys

- Each project needs the keys its part uses. Secret keys aren't shared between projects, so add them to each one.
- Only the App project gets `CRON_SECRET`.
