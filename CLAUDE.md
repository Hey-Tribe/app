# HeyTribe repo notes

## The app (/app) is built from source
- Edit `app/src/index.html` (page shell), `app/src/app.js` (all app code) and `app/src/app.css` (styles).
- Then run `npm install` (once) and `npm run build:app`. That writes `app/index.html`, minified files in
  `app/assets/app.<hash>.js|css`, and updates the offline cache list in `app/sw.js`.
- Never edit `app/index.html` or `app/assets/*` by hand: the next build overwrites them.
- Commit the built files too. Vercel serves the repo as static files with no build step.

## Site
- Marketing pages are plain HTML at the repo root (`styles.css`, `site.js`). Spanish text lives in `i18n/es-site.json`.
- Fonts are self-hosted in `assets/fonts/`.
