# SEO playbook

The search standard for every Squared Away Labs app. The same file sits in every repo, so each app follows the same rules.

This file is written for two readers:

- **You (the owner)**, to know what good looks like.
- **Claude, working inside this repo**, which runs it: audit the site, fix what is missing, check the fixes, then write a report. Part 1 is the job. Parts 2 to 14 are the rules it follows.

Checked against Google Search Central guidance as of November 2026. Search changes often, so treat anything marked "check" as something to confirm against current docs before acting on it.

---

## Part 1. The job: audit, fix, check, report

Work through these steps in order. Don't skip the audit, because every fix should come from something you found.

### Step 0. Learn the repo before touching it

1. Read `CLAUDE.md`, `README.md` and anything in `docs/` first. Repo rules beat this file wherever they conflict. Note any conflict in the report.
2. Work out the stack, because the how-to differs. The three stacks are covered in Part 13:
   - **Next.js App Router:** look for `app/` with `layout.tsx` and `next.config.*`.
   - **Plain HTML web app:** `.html` files served as-is, often with Capacitor for the phone apps.
   - **Vite single-page app:** `vite.config.*`, one `index.html`, with routing on the client.
3. List every public page: the marketing site, pricing, help, legal, blog, and any pages built from data (cafés, members of Congress, destinations). Separate them from logged-in app screens and admin pages. Write the list down; the audit uses it.
4. Find the production domain, and decide whether `www` or the bare domain is the main one (Part 3.4). The table in Part 2 has each app's domain.
5. Check whether the public marketing site lives in this repo or in a separate one. Some apps keep a separate marketing site; Ospelia's is a separate Vercel project. If the public pages aren't here, do what applies here (app screens set to `noindex`, metadata, app links) and say in the report that the marketing site needs this same pass in its own repo.

### Step 1. Audit (change nothing yet)

Check each item and record **pass, fail or not applicable**, with the file or address as evidence. Use the live production site where you can reach it, and the code otherwise.

**Crawling and indexing**
- [ ] `robots.txt` exists at the root, allows public pages, blocks admin, API and logged-in areas, and lists the sitemap.
- [ ] `sitemap.xml` exists. It lists every public page that should be indexed (and only those), uses absolute URLs on the main domain, and has a correct `lastmod`.
- [ ] Every public page returns status 200, carries a self-referencing canonical, and has no `noindex`.
- [ ] Logged-in screens, admin, checkout, account, search results and thank-you pages carry `noindex` (or sit behind sign-in).
- [ ] Only one version of the site resolves: http goes to https, and either www goes to the bare domain or the other way round, as a single 301 or 308 hop.
- [ ] Missing pages return a real 404 status with a helpful page, never a 200 (no "soft 404s").
- [ ] Removed or renamed pages 301 to their closest replacement.
- [ ] Important content is in the HTML the server sends. To check, fetch the page with JavaScript off, for example `curl -s URL | grep "key sentence"`.

**On-page**
- [ ] Every indexable page has a unique `<title>` of about 50 to 60 characters, with the topic first and the brand last.
- [ ] Every indexable page has a unique meta description of about 140 to 160 characters that says what the page offers.
- [ ] Exactly one `<h1>` per page, with headings in order (h2, then h3) and none skipped for styling.
- [ ] Images have useful `alt` text (or `alt=""` when purely decorative), real width and height, and modern formats.
- [ ] Internal links use real `<a href>` elements with descriptive anchor text, and every public page is reachable by links from the homepage in about three clicks.
- [ ] `<html lang>` is set correctly on every page.

**Structured data**
- [ ] Organization and WebSite markup on the homepage.
- [ ] SoftwareApplication (or MobileApplication or WebApplication) markup on the app's main page, with price and operating system.
- [ ] BreadcrumbList on deeper pages.
- [ ] Type-specific markup where it fits (Part 6).
- [ ] All of it passes the Rich Results Test and the Schema.org validator. Mark up nothing that isn't visible on the page.

**Social sharing**
- [ ] Open Graph tags (`og:title`, `og:description`, `og:image` at 1200×630, `og:url`, `og:type`) and `twitter:card` set to `summary_large_image`, on every public page.

**Speed and experience (Core Web Vitals)**
- [ ] Run Lighthouse in mobile mode on the homepage, pricing and the top data page, and record LCP, CLS, INP (or Total Blocking Time as a lab stand-in) and the performance score.
- [ ] The viewport meta tag is set, the layout works at 360px wide, and nothing scrolls sideways.

**Languages** (only if the app has more than one)
- [ ] Each language has its own address, `hreflang` links pair every language with every other plus `x-default`, and each language version has its own canonical.

**App store links** (if the app is in the App Store or Google Play)
- [ ] The Apple Smart App Banner meta tag is set, the `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` files are served correctly, and the store links on the site work.

**Measurement**
- [ ] Google Search Console is verified for the domain property, the sitemap is submitted, and the same is done in Bing Webmaster Tools. If you can't check this from the repo, say so and leave it for the owner.
- [ ] Analytics tracks organic landing pages: GA4 is already live, and PostHog events follow `docs/analytics-events.md` in the admin repo.

### Step 2. Fix

Fix the failures in this order, because earlier items stop later ones from working:

1. Anything that blocks indexing: a stray `noindex`, a `robots.txt` that blocks the site, wrong canonicals, server errors.
2. Domain and redirect problems.
3. Content missing from the server-sent HTML on public pages (Part 13 has the fix for each stack).
4. Sitemap and `robots.txt`.
5. Titles, descriptions, headings, internal links and alt text.
6. Structured data.
7. Open Graph and social images.
8. Core Web Vitals problems.
9. Language versions and app store links.

**Rules while fixing**
- **Don't change a public address unless you have to.** If one must change, add a permanent redirect from the old address in the same change, and list it in the report.
- **Don't delete public pages.** Improve them or redirect them.
- **Don't invent anything.** No made-up reviews, ratings, prices, statistics, awards, customer names, author credentials or press quotes. If structured data needs a value that isn't true and visible on the page, leave that property out.
- **Don't stuff keywords** or add hidden text, and don't write pages made only to rank.
- **Don't block CSS or JavaScript** in `robots.txt`; Google needs both to render pages.
- **Keep `noindex` on app and admin screens**, and never remove sign-in protection to "help" SEO.
- **Keep changes small and reviewable**: one concern per commit, with a plain commit message.
- **Run the build and tests** before every commit, and fix anything you break.
- **Copy:** plain, specific language and no marketing filler (Part 5.3). When a page needs new copy and the facts aren't in the repo, write a short placeholder marked `TODO(owner)` and list it in the report instead of guessing.

### Step 3. Check your work

1. Build the site and run it locally. Fetch every changed page with `curl` and confirm that the title, description, canonical, robots tag, hreflang and JSON-LD are all in the raw HTML.
2. Validate `sitemap.xml` (it must be well-formed XML, with every URL returning 200) and `robots.txt` (every listed path must be correct).
3. Paste each kind of structured data into the Schema.org validator, or validate it with a script, and fix every error. Warnings are fine when the property truly doesn't apply.
4. Run Lighthouse again on the same pages and compare with the audit numbers.
5. If a preview deployment is available, repeat the `curl` checks against it.

### Step 4. Report

Write `docs/SEO-REPORT.md` in this repo with:

- The date and the commit range.
- The audit table: each item with pass, fail or not applicable, before and after.
- A list of every change, with the files touched.
- Any redirects you added (from → to).
- Lighthouse numbers before and after.
- **Owner to-dos**: anything that needs a person, such as Search Console access, copy that needs facts, store listing changes, decisions or anything outside this repo.
- **Next content opportunities**: the 5 to 10 best page ideas from Part 7 for this app, each with the search intent it serves.

Then commit, push, and give the owner a five-line summary in plain words.

---

## Part 2. The apps

| App | Main domain | What it is | Audience | Languages |
|---|---|---|---|---|
| Kopetta | kopetta.com | A map of more than 1,500 independent cafés, with hours, what's on the bar and a shop for each café's beans | Coffee drinkers, independent cafés, roasters | Check the repo |
| Andamos | andamos.app | A trip planner: day-by-day plans on a map, offline tickets, shared budget | Solo travelers, couples, families, friend groups | English and Spanish |
| Hey Tribe | www.heytribe.app | A shared family calendar, shopping list, chore chart and messages | Busy families | Check the repo |
| Take it Back | www.takeitback.app | Reads an unfair bill, denial or notice, writes the letter to fight it and tracks deadlines | People stuck with medical bills, insurance denials, landlord or collector notices | Check the repo |
| Capitol Receipts | www.capitolreceipts.com | Who funds each member of Congress, their stock trades and votes, from public filings | Voters, reporters, watchdog groups | English and Spanish |
| Kindred | kindredfile.app | A free file after an accident (evidence, journal, costs), with an optional request to attorneys | People hurt in car, work or slip-and-fall accidents | Check the repo |
| Ospelia | www.ospelia.com | Restaurant operations and marketing connected to the Square register | Independent restaurants and cafés, multi-location groups | English and Spanish |
| UpStack CRM | upstackcrm.com | A CRM for courses and coaching: contacts, campaigns, bookings, courses, payments | Course creators, coaches, agencies | Check the repo |
| Squared Away Labs | www.squaredawaylabs.com | The studio that builds and runs these apps, and builds apps for clients | Small businesses and founders | English and Spanish |

If the code shows a different main domain (www or bare), the code and the live redirects win; fix the table in the report rather than the site.

---

## Part 3. Crawling and indexing

### 3.1 robots.txt

- Serve it at `/robots.txt` with status 200 and type `text/plain`.
- **Allow:** all public marketing and content pages, plus the CSS, JavaScript and image files they need.
- **Disallow:** `/api/`, `/admin`, `/dashboard`, `/app` (or wherever logged-in screens live), `/account`, `/checkout`, and internal search result pages.
- Add a line `Sitemap: https://<main domain>/sitemap.xml`.
- `robots.txt` stops crawling, not indexing. Use `noindex` (3.3) to keep a page out of results; Google has to be able to crawl the page to see that tag, so don't also block it in `robots.txt`.
- **AI crawlers.** This is a business decision, so leave the current setting alone unless the repo says otherwise, and record what's there in the report. Googlebot and Bingbot must always be allowed. `Google-Extended` controls only whether Google may use the content to train Gemini; it does not affect Google Search or AI Overviews. `GPTBot`, `ClaudeBot`, `PerplexityBot` and `CCBot` are the other common ones. Default for these apps: allow them on public marketing pages, because being cited in AI answers brings people in.

### 3.2 Sitemaps

- Serve at `/sitemap.xml`, generated from the same data that builds the pages, so it never lists a missing page or misses a new one.
- List only the canonical, indexable version of each URL with status 200: absolute, https, main domain.
- Set `<lastmod>` to the real date the content last changed, never the build time. Leave out `changefreq` and `priority`; Google ignores both.
- A single file holds at most 50,000 URLs and 50 MB uncompressed. Past that, use a sitemap index file with child sitemaps split by type (pages, cafés, members, guides).
- For language versions, either add `xhtml:link rel="alternate" hreflang` entries in the sitemap or use tags in the page `<head>`. Pick one way and use it everywhere.
- Image sitemap entries are optional; use them only for important images loaded in a way crawlers might miss.

### 3.3 Indexing controls

- **Public pages:** no robots meta tag at all (index, follow is the default).
- **Keep out of results:** use `<meta name="robots" content="noindex">` in the page, or the `X-Robots-Tag: noindex` response header for files like PDFs. Use it for:
  - logged-in screens, settings, checkout and thank-you pages
  - internal search results
  - staging and preview deployments (set it on any non-production host)
  - thin filter combinations
- **Preview deployments:** make sure `*.vercel.app` preview addresses send `noindex` or `X-Robots-Tag: noindex`, so they never compete with the real domain.
- **Canonical:** every indexable page has `<link rel="canonical" href="https://<main domain>/<path>">` pointing to itself. Duplicates, tracking variants like `?utm_` and sort orders point to the clean version. Canonicals are absolute URLs with one consistent trailing-slash style.
- Don't mix signals. A page shouldn't be canonical to page A while also being `noindex`, or listed in the sitemap while carrying `noindex`.

### 3.4 Domains, HTTPS and redirects

- **One main host:** choose www or the bare domain and 301 or 308 the other to it, in a single hop, keeping the path and query.
- **HTTPS everywhere,** with HSTS, and no mixed content.
- **Trailing slash:** pick one style and redirect the other.
- **Uppercase:** redirect uppercase paths to lowercase if the server treats them as different pages.
- **When a page moves,** 301 or 308 to the most relevant new page, not the homepage. Keep redirects in place for at least a year (ideally forever) and update internal links to the new address.
- **Redirect chains:** avoid them. Each old address should reach its final destination in one hop.

### 3.5 Status codes

- **200:** real pages.
- **301 or 308:** permanent moves. **302 or 307:** temporary moves only.
- **404:** missing pages. **410:** pages removed on purpose.
- A data page whose record is gone (a café that closed, an old member of Congress) returns 404 or 410, or stays up and clearly says it's closed or historic. Never a blank 200.
- **5xx:** server errors. Long runs of them make Google crawl less, so watch the error rate.
- For planned downtime, return 503 with a `Retry-After` header.

### 3.6 JavaScript and rendering

- Google renders JavaScript, but later and less reliably than plain HTML, and many AI crawlers don't render it at all. **Public content must be in the HTML the server sends.**
- **Links:** use real `<a href="/path">`. Crawlers don't follow `onclick` navigation, `#` links or buttons pretending to be links.
- **Lazy loading:** don't hide main content behind clicks, tabs that load data later, or infinite scroll without paginated addresses.
- **Single-page apps:** see Part 13.3.

---

## Part 4. URL structure

- Short, lowercase, words separated by hyphens, readable by people: `/cafes/philadelphia/la-colombe-fishtown`, not `/c?id=8812`.
- Group by topic in folders that match how people browse: `/guides/`, `/cafes/<city>/`, `/members/<state>/`.
- Leave out dates unless the content is truly dated, like news.
- Make addresses stable. Create each one from a unique, stable slug. If a name changes, keep the old slug as a redirect.
- Query parameters are for filters and tracking, never for core content. Pages built from filter combinations are `noindex` unless each one has real demand and enough unique content to stand alone.
- Spanish pages live under `/es/` (or the pattern the repo already uses), with translated slugs where the repo supports them.

---

## Part 5. On-page

### 5.1 Titles

- **Unique per page.** About 50 to 60 characters, or roughly 580 pixels, before Google cuts it off.
- **Pattern:** `Main topic, with a specific detail | Brand`. The homepage leads with what the product does, not the brand name alone.
- Match how people search ("Fight a medical bill" rather than "Billing dispute resolution").
- For pages built from data, fill a template with real fields: `La Colombe Fishtown: hours, menu and beans | Kopetta`.

### 5.2 Meta descriptions

- **Unique per page,** about 140 to 160 characters. Say what's on the page and why it's worth the click. Google often rewrites descriptions, but a good one still raises clicks.
- No keyword lists, and no repeating the title.

### 5.3 Writing on the page

- Write for the person searching. Answer the question in the first paragraph, then go deeper.
- Use plain, specific language: name the thing, give the number, show the step.
- Avoid stylized marketing voice:
  - contrast tricks ("not X, but Y") and "from A to B" ranges
  - strings of three short fragments
  - words like elevate, unlock, seamless, game-changing, revolutionize
- **One `<h1>` per page** that says what the page is.
- **Use `<h2>` sections** for the main questions people have, written as plain statements or questions.
- **Show who's behind it.** Say who made the product and how to reach them, and for advice pages (bills, injuries, money), say who wrote or checked it (Part 10).
- Keep information accurate and current. Put a visible "Updated" date on guides and data pages, and only change it when the content changes.

### 5.4 Internal linking

- Every public page should be reachable from the homepage in about three clicks.
- **Hub pages** (city lists, guide indexes, state lists) link to every page under them, and each of those pages links back to its hub and to closely related pages.
- **Anchor text** says what the target page is ("insurance denial letter template"), not "click here".
- **The footer** links to the main hubs, pricing, help, and the privacy and terms pages. Don't put hundreds of links in it.
- **Breadcrumbs** go on pages more than one level deep, with matching BreadcrumbList markup.
- **No orphans:** every page in the sitemap needs at least one internal link to it.

### 5.5 Images and video

- Write descriptive `alt` text for images that carry meaning, and use `alt=""` for decoration.
- **Files:** descriptive file names (`kopetta-cafe-map.webp`). Serve AVIF or WebP at the right size with `srcset`, and set width and height to prevent layout shift.
- **Loading:** lazy-load images below the fold, and don't lazy-load the main image at the top of the page; give it `fetchpriority="high"` instead.
- **Video:** give it a crawlable page, a poster image and VideoObject markup when the video is a main piece of content.

---

## Part 6. Structured data (JSON-LD)

Use JSON-LD in a `<script type="application/ld+json">` tag. Mark up only what is visible on the page and true. Validate everything.

**Every site**
- **Organization** on the homepage: `name`, `url`, `logo`, and `sameAs` links to real social, App Store and Google Play pages. Add `contactPoint` if there's a support email.
- **WebSite** on the homepage: `name` and `url`. Add a `SearchAction` only if the site has real search with a URL template.
- **BreadcrumbList** on every page more than one level deep.

**The product page**
- Use **SoftwareApplication**, or the more specific **MobileApplication** or **WebApplication**, with:
  - `name`, `applicationCategory` (for example `TravelApplication`, `LifestyleApplication`, `BusinessApplication`, `FinanceApplication`) and `operatingSystem` ("iOS, Android, Web")
  - `offers` (an Offer with `price` and `priceCurrency`; use price `0` for free)
  - `aggregateRating` only if real ratings are shown on the page, taken from a real source. Never invent or carry over store ratings that aren't displayed.

**By app (use where it fits and is true)**
- **Kopetta:** `CafeOrCoffeeShop` (a LocalBusiness type) on each café page, with `name`, `address` (PostalAddress), `geo`, `openingHoursSpecification`, `url`, `image` and `servesCuisine`. Use `Product` with `offers` for beans sold, and `Event` for café events (only with real dates and places).
- **Andamos:** `TouristTrip` or `Trip` (with `itinerary`) on public itinerary or guide pages, `TouristDestination` on destination pages, and `Article` on guides.
- **Hey Tribe:** SoftwareApplication, plus `Article` on guide pages.
- **Take it Back:** `Article` on guides, with `author`, `datePublished` and `dateModified`; `HowTo` text is fine on the page, but Google no longer shows HowTo rich results. FAQPage markup is allowed, but Google shows FAQ rich results only for well-known government and health sites, so don't expect them.
- **Capitol Receipts:** `Person` on each member page (`name`, `jobTitle`, `affiliation`, `memberOf`), `Dataset` on data pages that describe a downloadable or browsable dataset (`name`, `description`, `creator`, `license`, `temporalCoverage`, `distribution`), and `NewsArticle` or `Article` on stories.
- **Kindred:** `Article` on guides, with reviewer details only when a real, named reviewer exists. LegalService markup only if the business really is one; a file that sends requests to attorneys is not a law firm.
- **Ospelia and UpStack:** SoftwareApplication with `offers` for each plan (`priceSpecification` with a monthly unit), plus `Article` on guides and comparisons.

**Skip:** markup for content that isn't shown, self-serving review markup on your own business, and any rich result type Google has retired. Check Google's search gallery before adding a type.

---

## Part 7. Content strategy

### 7.1 Principles

- Google rewards helpful, original content written for people. Its spam policies punish:
  - **scaled content abuse:** mass-produced pages with little value, whoever or whatever writes them
  - **doorway pages**
  - **site reputation abuse**
  - **thin affiliate pages**
- **AI help is fine.** Unedited, generic AI text at scale is not. Every page needs something the reader can't get elsewhere: our data, our product, our experience or a clear, complete answer.
- **Build topic clusters:** a hub page for a broad topic, with linked pages for each specific question underneath.
- **Data-driven pages** (one per café, member, destination, bill type) are the biggest opportunity and the biggest risk. Each needs enough real, unique data to stand alone. Pages with almost no data should be `noindex` until they fill in, or be merged into a hub.

### 7.2 Page ideas by app (each needs real data or real expertise behind it)

- **Kopetta:**
  - **Data pages:** one page per café (hours, address, map, what's on the bar, beans for sale), city hubs ("Independent coffee shops in Philadelphia"), and neighborhood pages only where there are enough cafés.
  - **Roaster pages:** each with its beans.
  - **Guides:** brew guides and an origin glossary.
- **Andamos:**
  - **Destinations:** guides with real day-by-day sample itineraries ("3 days in Lisbon"), public shareable itineraries (only with the owner's consent, set to `noindex` by default), and offline-travel tips.
  - **Spanish:** versions for Spanish-speaking travelers.
- **Hey Tribe:** Guides for family organization: a shared family calendar, chore charts by age, meal planning, and back-to-school checklists. Use printable templates where they fit.
- **Take it Back:**
  - **Problem guides:** one per problem ("How to dispute a medical bill", "Appeal an insurance denial", "Respond to a debt collector letter", "Get your security deposit back"), with letter templates and the real deadlines and laws, cited.
  - **State pages:** only where the rules really differ by state.
- **Capitol Receipts:**
  - **Data pages:** one per member of Congress (funding, trades, votes), state hubs, committee pages, industry pages ("Who the oil and gas industry funds"), and pages for notable trades and votes.
  - **Accuracy:** neutral, sourced language, with a methodology page explaining how the data works.
- **Kindred:**
  - **Guides:** after-accident guides ("What to do after a car accident", "What evidence to keep", "How long you have to file in each state"), checked for accuracy and dated.
  - **State statute of limitations pages:** these need careful, cited, current information.
- **Ospelia:**
  - **Guides:** restaurant operations guides (labor cost percentage, food cost, prime cost, forecasting, scheduling).
  - **Comparisons:** honest comparison pages against named alternatives (factual and fair).
  - **Square:** the Square integration page and a restaurant P&L template.
- **UpStack CRM:**
  - **Comparisons:** "best CRM for coaches" style pages with honest criteria, and comparisons against named alternatives.
  - **Guides:** course launch, email sequences for coaches, booking setup.
  - **Use-case pages:** one per type of creator.
- **Squared Away Labs:** service pages, industry pages, case studies of the eight apps, pricing explanations, and cost guides ("How much does an app cost to build").

### 7.3 Keeping content fresh

- Review data pages automatically: when the underlying data changes, update the page and its `lastmod`.
- Review guides every 6 to 12 months, change the "Updated" date only when content changes, and fix or redirect anything outdated.

---

## Part 8. Core Web Vitals and speed

**Targets (measured at the 75th percentile of real users on mobile):**

| Measure | Good | What it measures |
|---|---|---|
| **LCP** (Largest Contentful Paint) | 2.5 s or less | How long until the main content shows |
| **INP** (Interaction to Next Paint) | 200 ms or less | How fast the page responds to taps; it replaced FID in March 2024 |
| **CLS** (Cumulative Layout Shift) | 0.1 or less | How much the layout jumps around |

**How to hit them**
- **LCP:**
  - Render the main content on the server.
  - Preload or prioritize the hero image (`fetchpriority="high"`, no lazy loading).
  - Serve images at the right size in AVIF or WebP.
  - Keep render-blocking CSS small and inline what's critical.
  - Self-host fonts with `font-display: swap`, and preload one or two at most.
  - Use a CDN; Vercel already provides one.
- **INP:**
  - Ship less JavaScript and split it by route.
  - Avoid long tasks over 50 ms.
  - Defer third-party scripts (chat widgets, extra trackers) or load them after interaction.
  - Debounce heavy input handlers.
- **CLS:**
  - Set width and height (or `aspect-ratio`) on images, video and embeds.
  - Reserve space for banners and ads.
  - Don't insert content above what's already shown.
  - Use `size-adjust` or a matching fallback font to limit font swap shift.
- **Real-user data:** measure with Search Console's Core Web Vitals report and Vercel Speed Insights. Lab tests (Lighthouse, PageSpeed Insights) guide fixes; real-user data is what counts.

---

## Part 9. Mobile and accessibility

- Google indexes the mobile version of each page. The mobile page must have the same content, structured data and metadata as desktop.
- **Viewport:** set `<meta name="viewport" content="width=device-width, initial-scale=1">`. Readable text needs no zooming, and tap targets are at least 44 by 44 points.
- **Pop-ups:** no intrusive interstitials that cover content on arrival from search. Cookie notices and legally required age checks are fine.
- **Accessibility helps search and people alike:**
  - semantic HTML (header, nav, main, footer, real buttons and links)
  - labels on form fields
  - visible focus styles
  - WCAG AA contrast

---

## Part 10. Trust, especially for money, health and legal topics

Google holds pages that can affect someone's money, health, safety or legal rights to a higher standard ("Your Money or Your Life"). Take it Back, Kindred and Capitol Receipts sit squarely here, and UpStack and Ospelia touch money.

- **About and contact:** a real About page (who runs the product), a contact method, and the business address or legal entity (Squared Away Labs LLC) in the footer or on About.
- **Authors and reviewers:**
  - Advice and guide pages show who wrote them, with their background.
  - Show a reviewer only when a qualified person really reviewed the page (for example a licensed attorney for legal guides). Never invent credentials.
- **Sources:**
  - Cite laws, regulations and official sources with links (CFPB, CMS, state statutes, FEC, House and Senate disclosure sites).
  - Show "Updated" dates.
- **Disclaimers where needed:**
  - "This is general information, not legal advice" on legal guides.
  - Make clear that Kindred is not a law firm, and how attorney requests work.
- **Capitol Receipts:** strictly neutral wording, every figure traceable to a public filing, a methodology page, and a corrections process.
- **Privacy:** clear privacy and terms pages. Hey Tribe may involve children's data, so check that the policy covers children's privacy rules, and say so in the report. Don't change legal text yourself.

---

## Part 11. Languages (hreflang)

For apps with English and Spanish (Andamos, Capitol Receipts, Ospelia, Squared Away Labs, and any others the repo shows):

- **Addresses:** each language gets its own address (`/es/...`). Never switch language on the same address based on cookies or browser settings.
- **hreflang links:**
  - Every version links to every other and to itself: `<link rel="alternate" hreflang="en" href="...">`, `hreflang="es"`, plus `hreflang="x-default"` pointing to the default (usually English).
  - The links must point both ways; if English points to Spanish, Spanish must point back.
- **Canonicals:** each language version's canonical points to itself, never to the English page.
- **Language attribute:** `<html lang="es">` on Spanish pages.
- **Translation:** translate the title, description, headings and structured data text too. Machine translation is fine if a person checks it; unchecked machine translation at scale counts as low quality.
- **Language switcher:** a visible switcher that links to the same page in the other language, not to the homepage.

---

## Part 12. App store connection

For apps in the App Store or Google Play:

- **Smart App Banner** on iPhone: `<meta name="apple-itunes-app" content="app-id=<App Store id>">` on public pages, and optionally `app-argument` for deep links.
- **Universal links and App Links:** serve `/.well-known/apple-app-site-association` (JSON, no `.json` extension, served as `application/json`) and `/.well-known/assetlinks.json` from the main domain, so links open in the app when it's installed.
- **Store pages:** link the App Store and Google Play pages from the site (official badges), and add them to Organization `sameAs`.
- **Store listings (ASO):** titles, subtitles, keywords, screenshots and descriptions also drive installs from store search. They live outside this repo, so list suggested changes in the report under owner to-dos.

---

## Part 13. Recipes by stack

### 13.1 Next.js App Router

- **Metadata:** in each `page.tsx` or `layout.tsx`, export `metadata` or `generateMetadata`. Set `metadataBase` in the root layout to the main domain so relative addresses become absolute.

```ts
// app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL("https://www.example.com"),
  title: { default: "What the product does | Brand", template: "%s | Brand" },
  description: "One plain sentence on what it does and who it's for.",
  openGraph: { type: "website", siteName: "Brand" },
  twitter: { card: "summary_large_image" },
};

// app/guides/[slug]/page.tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGuide(slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.summary,
    alternates: { canonical: `/guides/${slug}`, languages: { en: `/guides/${slug}`, es: `/es/guias/${g.slugEs}`, "x-default": `/guides/${slug}` } },
    openGraph: { title: g.title, description: g.summary, url: `/guides/${slug}`, type: "article" },
  };
}
```

- **Missing records:** call `notFound()` in the page so a missing record returns a real 404.
- **Sitemap and robots:** use `app/sitemap.ts` and `app/robots.ts`. For large sites, use `generateSitemaps()` to split into several files.

```ts
// app/robots.ts
export default function robots(): MetadataRoute.Robots {
  const prod = process.env.VERCEL_ENV === "production";
  return prod
    ? { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/dashboard", "/account"] }], sitemap: "https://www.example.com/sitemap.xml" }
    : { rules: [{ userAgent: "*", disallow: "/" }] };
}
```

- **Logged-in areas:** `export const metadata = { robots: { index: false, follow: false } }` in the logged-in layout.
- **JSON-LD:** render `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />` inside a Server Component.
- **Social images:** `opengraph-image.tsx` per route creates them automatically. Keep text large and readable at small sizes.
- **Speed:**
  - Use `next/image` (with `priority` on the image at the top) and `next/font`.
  - Use Server Components by default.
  - Load third-party scripts with `next/script` and `strategy="lazyOnload"` or `afterInteractive`.
- **Redirects:** put them in `next.config` `redirects()` with `permanent: true`, or in middleware for large lists.
- **Static pages:** prefer static or ISR (`revalidate`) for public pages; keep `force-dynamic` off public pages unless they need it.

### 13.2 Plain HTML web apps (Hey Tribe, Capitol Receipts, Ospelia today)

- **Every public page needs its own `.html` file** (or server-rendered route) with a full `<head>`: title, description, canonical, Open Graph, hreflang, JSON-LD. A shared header include or build step keeps them in line.
- **The `<head>` template:**

```html
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Topic first, then detail | Brand</title>
  <meta name="description" content="What this page gives the reader, in one or two sentences.">
  <link rel="canonical" href="https://www.example.com/path">
  <link rel="alternate" hreflang="en" href="https://www.example.com/path">
  <link rel="alternate" hreflang="es" href="https://www.example.com/es/path">
  <link rel="alternate" hreflang="x-default" href="https://www.example.com/path">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Same as the title, without the brand if long">
  <meta property="og:description" content="Same idea as the description">
  <meta property="og:url" content="https://www.example.com/path">
  <meta property="og:image" content="https://www.example.com/og/path.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{ "@context": "https://schema.org", "@type": "WebPage", "name": "..." }</script>
</head>
```

- **Sitemap:** generate `sitemap.xml` with a small script at build time (walk the public `.html` files, or query the data for data pages) instead of editing it by hand.
- **Data pages loaded in the browser:** if member, café or similar pages load their data with JavaScript after the page opens, the content is invisible to many crawlers. Fixes, best first:
  1. Generate a static HTML page per record at build time, or on a schedule, from Supabase.
  2. Serve the HTML from a server function (a Vercel Function) that fills in the data.
  3. At minimum, put the title, description, `h1` and a text summary in the HTML, with the interactive part loading after.
- **Vercel:** set redirects, headers (including `X-Robots-Tag` on non-production hosts) and `cleanUrls` in `vercel.json`.
- **Migration:** the stack plan moves Hey Tribe and Capitol Receipts to Next.js later; keep every public address and page so rankings carry over.

### 13.3 Vite single-page app (Kindred today)

- **The problem:** an SPA sends one nearly empty `index.html` for every address, so every page has the same title and no content until JavaScript runs.
- **The fix, best first:**
  1. **Prerender** public routes to static HTML at build time, for example with `vite-plugin-ssg`, `vite-react-ssg`, or a Playwright script that renders each public route and saves the HTML. Each route gets its own title, description, canonical and content.
  2. **Move public pages to static HTML,** or to the planned Next.js app, and keep the SPA for logged-in screens only.
- **Head tags:** set them per route (React 19 supports `<title>` and `<meta>` in components, or use `react-helmet-async`), but prerendering is still what makes them visible to crawlers.
- **Status codes:** make sure unknown addresses return a real 404 status. Vercel SPA fallbacks usually return 200 for everything, so configure `vercel.json` to serve the app only for known app routes and a 404 page otherwise.
- **Migration:** the stack plan moves Kindred to Next.js soon. Build anything new for public pages with that move in mind.

---

## Part 14. Off-site, measurement and upkeep

### 14.1 Links and mentions

- **Earn links;** never buy them or swap them in schemes. Good sources for these apps:
  - App directories and launch sites (Product Hunt, App Store editorial pitches).
  - Software review sites for the business tools (G2 and Capterra for Ospelia and UpStack).
  - Local and industry press for Kopetta and Ospelia.
  - Journalists and researchers citing Capitol Receipts data. Make data pages easy to cite, with a "cite this" line and a stable address.
  - Partner pages (roasters for Kopetta, Square's app marketplace for Ospelia if it qualifies).
- **Cross-linking:** link the apps to each other only where it's useful to the reader. The Squared Away Labs site already links to all of them.
- **Business profiles:** keep the business name, address and phone the same everywhere they appear, if the business is listed anywhere.

### 14.2 Measurement

- **Google Search Console:** verify a domain property per app (DNS verification covers every subdomain and protocol). Submit the sitemap. Watch the Pages (indexing), Performance (queries and clicks), Core Web Vitals and Enhancements (structured data) reports.
- **Bing Webmaster Tools:** import from Search Console. Bing also feeds several AI assistants' search.
- **IndexNow:** optional. Lets Bing and others know about changed addresses right away (a key file at the root plus a call on publish). Google doesn't use it.
- **GA4 (live in every app) and PostHog:** report organic landing pages, and sign-ups and purchases from organic visitors. Follow `docs/analytics-events.md` in the admin repo for event names, including the `app` and `platform` properties.
- **Before major changes:** keep a record of rankings and clicks so you can compare after.

### 14.3 Upkeep schedule

| How often | What to do |
|---|---|
| Weekly | Search Console coverage errors and Core Web Vitals; 404s and 5xx in logs. |
| Monthly | Top queries and pages, pages losing clicks, new content opportunities, broken links. |
| Every release | Run the Step 3 checks on changed public pages (titles, canonicals, robots, sitemap, JSON-LD). |
| Every 6 to 12 months | Refresh guides, re-run this whole playbook, and update this file if Google's guidance changed. |

---

## Appendix A. Quick reference

- **Title:** about 50 to 60 characters, unique, topic first, brand last.
- **Description:** about 140 to 160 characters, unique, says what the page gives.
- **Headings:** one `h1`, then `h2` and `h3` in order.
- **Canonical:** absolute, self-referencing, main domain, https.
- **Indexing:** public pages have no robots tag; logged-in, admin, preview, search and checkout pages get `noindex`.
- **Sitemap:** canonical 200 pages only, a real `lastmod`, split past 50,000 URLs.
- **robots.txt:** allow public pages and their files, disallow private areas, list the sitemap.
- **Redirects:** 301 or 308, one hop, to the closest page, kept long-term.
- **Status codes:** 404 or 410 for missing pages, never a 200 "not found" page.
- **Core Web Vitals:** LCP at or under 2.5 s, INP at or under 200 ms, CLS at or under 0.1 (mobile, 75th percentile).
- **Structured data:** JSON-LD, visible and true content only, validated.
- **hreflang:** both ways, self-referencing, `x-default`, separate addresses per language.
- **Social:** Open Graph with a 1200×630 image, plus `summary_large_image`.
- **Never:** invented reviews or ratings, hidden text, keyword stuffing, doorway pages, mass-produced thin pages, or bought links.

## Appendix B. Useful tools

- Google Search Console, Rich Results Test, URL Inspection, PageSpeed Insights.
- Schema.org validator (validator.schema.org).
- Lighthouse (in Chrome or `npx lighthouse URL --preset=desktop` or the mobile default).
- Bing Webmaster Tools.
- Vercel Speed Insights and Analytics.
- `curl -sI URL` for status codes and headers, and `curl -s URL` for raw HTML.
