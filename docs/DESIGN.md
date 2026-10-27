# HeyTribe look and copy rules

The site and app were made plainer in October 2026 because they read as AI-generated. Keep it that way.

## Type
- One typeface everywhere: Atkinson Hyperlegible Next (`assets/fonts/atkinson*.woff2`). Headings are bold, not a light serif.
- No handwriting font, no italic accent words in headlines, no text in a second color inside a heading.

## Headlines and copy
- Say what the thing does: "Weekly chore charts with stars and rewards", not "Chores, but make it a game."
- No two-beat taglines ("Say it once. It lands everywhere."), no "the HeyTribe way", no "actually", "finally", "calm", "seamless".
- No small uppercase labels above section headings. A guide's category label above its title is fine.
- Sentence case for headings on the main pages.

## Layout and decoration
- No tilted cards, stickers, tape, spinning badges, scrolling ticker bands, bobbing phones or floating faces.
- Feature lists are plain rows with a line above each, not grids of cards with icon squares.
- Phone screenshots stand straight.

## Keeping screenshots and share images current
- `npm run screenshots` re-shoots the app screens on the site (English and Spanish) from the sample family.
- `npm run og` remakes the guide link-preview images. `og.jpg` is a screenshot of the homepage at 1200 x 630.
- After changing English text on the site, run `npm run i18n:check` and add Spanish for anything new in `i18n/es-site.json`. Guides are English only.
