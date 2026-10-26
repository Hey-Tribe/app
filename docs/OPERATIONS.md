# HeyTribe operations handbook

How HeyTribe is built, deployed, monitored and recovered. Keep this next to the code; update it when something here changes.

## 1. What runs where

| Piece | Where | Notes |
|---|---|---|
| Marketing site (`*.html`, `styles.css`, `site.js`) | Vercel, static | Spanish text in `i18n/es-site.json` |
| Family app (`/app`) | Vercel, static, built from `app/src` | Offline shell in `app/sw.js` |
| Admin dashboard (`admin.heytribe.app`) | Vercel, same project | `middleware.js` serves `/admin/index.html` on that host |
| Sitter page (`/sitter`) | Vercel, static | Read-only, token link |
| Server functions (`api/*.js`) | Vercel functions (Node 20+) | Billing, Apple, reminders, email, AI, calendar feed, health |
| Database, logins, files, live updates | Supabase project `ayafbypcbsfmqckuwqom` | Row level security on every table |
| Scheduled job | Supabase pg_cron `heytribe-reminders`, every 5 min | Calls `/api/reminders` (reminders, emails, billing cleanup) |
| Email | Resend, domain heytribe.app | Templates in `api/_email.js` and `supabase/templates/` |
| iPhone app | `mobile/` (Capacitor 8) | Loads www.heytribe.app/app; native Apple sign-in, purchases, push |
| Android app | `mobile/android` (Capacitor 8) | Same web app; browser-tab sign-in, Firebase push. Guide: `mobile/PLAY_STORE.md` |

Trust boundaries: the browser and phone are untrusted. Everything they can do is limited by Supabase row level security and server functions that check the login. Server-to-server calls (cron, Stripe, Apple) use shared secrets (`CRON_SECRET`, `BILLING_SYNC_SECRET`) stored in Vercel and in `private.app_secrets` in Supabase.

## 2. Local setup from a clean checkout

```
git clone https://github.com/Hey-Tribe/app && cd app
npm ci
npm run build:app        # builds app/src into app/index.html + app/assets
npm test                 # server tests (no network needed)
npm run test:e2e         # browser smoke test (needs: npx playwright install chromium)
python3 -m http.server 8080   # then open http://localhost:8080/ and /app/
```

The app talks to the production Supabase project even locally. The sample family ("Look around with a sample family") works without signing in and never writes to the server.

## 3. Environment variables (Vercel)

Values live only in Vercel. Never commit them.

| Name | Needed for | Set? (Oct 26, 2026) |
|---|---|---|
| SUPABASE_URL, SUPABASE_ANON_KEY | Everything | Yes |
| CRON_SECRET | Reminder job, email queue | Yes |
| BILLING_SYNC_SECRET | Stripe and Apple purchase updates | Yes |
| RESEND_API_KEY, EMAIL_FROM | Email | Yes |
| VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY | Web push reminders | Yes |
| STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_PRICE_ID_YEARLY, STRIPE_WEBHOOK_SECRET | Card payments on the web | No |
| ANTHROPIC_API_KEY (ANTHROPIC_MODEL optional) | Hey Tribe AI (falls back to the built-in parser) | No |
| APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID (APNS_BUNDLE_ID, APNS_SANDBOX optional) | iPhone push | No |
| APPLE_TEAM_ID (APPLE_BUNDLE_ID, APPLE_PRODUCT_ID, APPLE_PRODUCT_ID_YEARLY optional) | Universal links, Apple purchase checks | No |
| FCM_SERVICE_ACCOUNT | Android push (also set `androidPush: true` in `app/config.js`) | No |
| ANDROID_CERT_SHA256 (ANDROID_PACKAGE optional) | Android app links | No |
| PREMIUM_LIMITS=1 (optional) | Enforce free limits on the server before Stripe is live | No |
| SITE_URL (optional) | Stripe return links | No |

`GET /api/health` shows which of these are configured (true/false only).

GitHub repository secrets for the TestFlight build: APPLE_TEAM_ID, ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8.

## 4. Deploying

1. Edit source. For the app, edit `app/src/*` and run `npm run build:app`. Never hand-edit `app/index.html` or `app/assets/`.
2. `npm test` and `npm run test:e2e`.
3. Commit (including built files) and push to `main`. GitHub Actions ("Checks") runs the same tests. Vercel deploys `main` to production automatically.
4. Check `https://www.heytribe.app/api/health` returns `"ok": true`, and open the app.

Every Vercel deployment is tied to a commit. To find what's live: Vercel › Deployments › Production.

## 5. Rolling back

- **Site or app:** Vercel › Deployments › pick the last good one › "Promote to Production". It takes effect in seconds. Then revert the bad commit in git so the next push doesn't bring it back.
- **iPhone app:** the app loads the website, so a site rollback also rolls back the app's screens. Native changes need a new App Store build. Keep the previous build available in TestFlight.
- **Database:** migrations are in `supabase/migrations/`, numbered in order. There are no automatic down-migrations. To undo one, write a new migration that reverses it. Changes that remove data need a backup first (see 7).

## 6. Database changes

1. Write `supabase/migrations/00NN_name.sql`. Make it safe to run against live data, for example `add column if not exists`, `create or replace function`, and no `drop` of anything still in use.
2. The app and server must keep working with both the old and new database during the deploy. Add first, switch code, remove later.
3. Apply it in Supabase (SQL editor or the Supabase tools), then commit the file.
4. Run Supabase › Advisors (security and performance) afterwards.

## 7. Backups and restore

- **Current state: not verified.** On the Supabase free plan there are no downloadable or point-in-time backups.
- **Action for the owner:** move to Supabase Pro (daily backups kept 7 days) and consider the point-in-time recovery add-on.
- **Restore drill:** once a quarter, restore the latest backup into a new Supabase project. Point a local copy of the app at it (`app/config.js`), sign in and check that a family's plans, lists and files are there. Write down the date and how long it took.
- **Targets to agree on:** how much data you can lose (suggested: 24 hours on Pro, minutes with point-in-time recovery) and how long you can be down (suggested: 4 hours).

## 8. Monitoring

- **Uptime:** point an uptime service (UptimeRobot, Better Stack or similar) at `https://www.heytribe.app/api/health` every 5 minutes, alerting hello@heytribe.app. Not set up yet.
- **Browser errors:** collected in `client_errors` and shown in the admin dashboard › Errors.
- **Server errors:** Vercel › Logs (functions) and Supabase › Logs.
- **Reminder job:** Supabase › Database › Cron › heytribe-reminders shows each run. `/api/reminders` returns counts of reminders, emails and billing cleanups.
- **Costs:** Vercel usage, Supabase usage, Resend, and Anthropic (AI quick adds) dashboards. Hey Tribe AI is capped on the server at 10 a month per free family once Premium can be bought (or with PREMIUM_LIMITS=1).

## 9. When something breaks

1. Check `/api/health`, Vercel status, Supabase status, Resend status.
2. If a deploy caused it, roll back (section 5) first and investigate after.
3. If data looks wrong, don't run fixes against production by hand. Take a backup, then write a migration.
4. Tell affected families through the admin dashboard › Announcements, and answer support tickets.

Owner: Austin Shission (hello@heytribe.app). There is no second on-call person yet.

## 10. Accounts the business must control

GitHub org Hey-Tribe, Vercel team, Supabase org, Resend, domain registrar for heytribe.app (DNS is on Vercel), Google Analytics, Apple Developer and App Store Connect, Google Play Console (when Android starts), Stripe, Anthropic. Each should use a company email with two-factor sign-in and at least two people with access.
