# HeyTribe repo notes

## The app (/app) is built from source
- Edit `app/src/index.html` (page shell), `app/src/app.js` (all app code) and `app/src/app.css` (styles).
- Then run `npm install` (once) and `npm run build:app`. That writes `app/index.html`, minified files in
  `app/assets/app.<hash>.js|css`, and updates the offline cache list in `app/sw.js`.
- Never edit `app/index.html` or `app/assets/*` by hand: the next build overwrites them.
- Commit the built files too. Vercel serves the repo as static files with no build step.

## Site
- Marketing pages are plain HTML at the repo root (`styles.css`, `site.js`). Spanish text lives in `i18n/es-site.json`.
- Spanish pages are built into `es/` from those English pages and `i18n/es-site.json`. After editing a page listed in
  `tools/build-es.mjs` or the Spanish text, run `npm run build:es` (it also rebuilds `sitemap.xml`). Never edit `es/` by hand.
- After adding or removing a public page, run `npm run sitemap`.
- Fonts are self-hosted in `assets/fonts/`.

## Database
- Schema changes are new files in `supabase/migrations/` (see `supabase/README.md`), applied to production with the
  same SQL. Then regenerate `supabase/types.ts` and run `npx supabase@2 test db`.
