# HeyTribe

The family planning app and its marketing site, in one Vercel project backed by Supabase.

| Path | What it is |
| --- | --- |
| `/` | Marketing site (static HTML, `styles.css`, `site.js`) |
| `/app/` | The HeyTribe app (single page; `app/config.js` holds the public Supabase settings) |
| `/api/forms` | Saves waitlist and contact form posts to Supabase |
| `/api/heytribe` | Hey Tribe AI: turns a typed note into plans, list items and chores (optional) |
| `supabase/` | Database schema, security rules and the sample family |

## How it works

- **Accounts:** email and password through Supabase Auth.
- **Families:** each family is a *tribe* with a 6-character invite code. Logins join tribes through `memberships`.
- **Data:** everything a family adds lives in `public.docs` (one row per item, JSON data). Row level security only lets members of a tribe read or change it. Changes sync live through Supabase Realtime.
- **Files:** document photos go to the private `family-files` storage bucket, one folder per tribe.
- **Sample family:** the `SAMPLE` tribe is readable by anyone and read-only. The app shifts its dates to today, and edits stay on that device.

## Setup

1. **Supabase:** run `supabase/migrations/0001_heytribe.sql`, then `supabase/seed.sql`.
2. **Supabase Auth → URL configuration:** set *Site URL* to your domain and add `https://YOUR-DOMAIN/app/**` to the redirect URLs, so confirmation and password-reset emails land in the app.
3. **`app/config.js`:** fill in the project URL and anon key.
4. **Vercel environment variables:**
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` (needed by both API routes)
   - `ANTHROPIC_API_KEY` (optional; without it Hey Tribe uses the built-in parser)
   - `ANTHROPIC_MODEL` (optional)
5. Deploy. No build step is needed.

## Not built yet

- **Premium:** payments and Premium limits aren't enforced. Every feature is open.
- **Calendar sync:** no sync with Google or Apple calendars yet.
