# HeyTribe repo notes

The repo is a Next.js app (App Router, `src/app`). `npm run dev` runs it locally; Vercel builds it with `next build`.

## Layout
- `content/*.html` and `content/es/*.html`: the website pages, still authored as HTML. Next.js serves each one at its
  old address (`/pricing.html`, `/es/pricing.html`) through `src/app/(en)` and `src/app/(es)`; see `src/lib/pages.js`.
- `public/`: everything served as a file: styles, scripts, images, fonts, `sitemap.xml`, `robots.txt`, and the
  app (`public/app`), admin (`public/admin`) and sitter (`public/sitter`) pages.
- `src/pages/api/*.js`: server functions at `/api/...` (same handlers as before). Shared server code in `src/lib/api/`.
  The Stripe webhook is a route handler in `src/app/api/stripe-webhook/route.js`.
- Security headers and redirects live in `vercel.json`; rewrites (`/app/`, `/admin/`, `/sitter/`, `.well-known`) in
  `next.config.mjs`. The admin host is routed by `src/middleware.js`.

## The app (/app) is built from source
- Edit `spa/index.html` (page shell), `spa/app.js` (all app code) and `spa/app.css` (styles).
- Then run `npm install` (once) and `npm run build:app`. That writes `public/app/index.html`, minified files in
  `public/app/assets/app.<hash>.js|css`, and updates the offline cache list in `public/app/sw.js`.
- Never edit `public/app/index.html` or `public/app/assets/*` by hand: the next build overwrites them. Commit the built files.

## Site
- Spanish text lives in `public/i18n/es-site.json`. Spanish pages are built into `content/es/` from the English pages.
  After editing a page listed in `tools/build-es.mjs` or the Spanish text, run `npm run build:es` (it also rebuilds
  `public/sitemap.xml`). Never edit `content/es/` by hand.
- After adding or removing a public page, run `npm run sitemap`.
- Fonts are self-hosted in `public/assets/fonts/`.

## Checks before each commit
- `npm test`, `npm run build`, then `npm start` and `SITE_URL=http://localhost:3000 npm run test:e2e`.

## Database
- Schema changes are new files in `supabase/migrations/` (see `supabase/README.md`), applied to production with the
  same SQL. Then regenerate `supabase/types.ts` and run `npx supabase@2 test db`.
