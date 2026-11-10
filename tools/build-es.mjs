// Builds the Spanish site: content/es/<page>.html for every page in ES_PAGES, translated from i18n/es-site.json with the same
// rules the browser uses (i18n/ht-i18n.js). Each Spanish page gets its own address, <html lang="es">, its own canonical,
// hreflang links both ways, and translated title, description, social tags and structured data.
// Run after editing a page in ES_PAGES or i18n/es-site.json:  npm run build:es   (then npm run sitemap)
// Pages left out are not fully translated yet; they stay English-only and carry no Spanish hreflang.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = "https://www.heytribe.app";
export const ES_PAGES = [
  "index.html", "features.html", "pricing.html", "join.html", "hey-tribe.html", "about.html", "contact.html", "help.html",
  "blog.html", "post-chore-charts.html", "post-mental-load.html", "post-sunday-reset.html",
  "login.html", "privacy.html", "terms.html", "delete-account.html", "licenses.html",
  "feature-baby-log.html", "feature-calendar.html", "feature-chores.html", "feature-contacts.html", "feature-countdowns.html",
  "feature-dinner-menu.html", "feature-documents.html", "feature-family-sharing.html", "feature-fridge.html", "feature-health.html",
  "feature-home-bills.html", "feature-kid-view.html", "feature-lists.html", "feature-routines.html", "feature-school.html",
  "feature-sitter-sheet.html", "feature-today.html", "feature-trips.html"
];
export const enUrl = f => SITE + "/" + (f === "index.html" ? "" : f);
export const esUrl = f => SITE + "/es/" + (f === "index.html" ? "" : f);

// Point the English page's hreflang links at its Spanish address (or drop them when there is none).
export function fixEnglishHead(html, f) {
  html = html.replace(/\n?\s*<link rel="alternate" hreflang="(?:en|es|x-default)" href="[^"]*">/g, "");
  if (!ES_PAGES.includes(f)) return html;
  const links = `\n<link rel="alternate" hreflang="en" href="${enUrl(f)}">\n<link rel="alternate" hreflang="es" href="${esUrl(f)}">\n<link rel="alternate" hreflang="x-default" href="${enUrl(f)}">`;
  return html.replace(/(<link rel="canonical" href="[^"]*">)/, "$1" + links);
}

async function main() {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const dict = JSON.parse(fs.readFileSync(path.join(root, "public/i18n/es-site.json"), "utf8"));
  const i18nSrc = fs.readFileSync(path.join(root, "public/i18n/ht-i18n.js"), "utf8");
  fs.mkdirSync(path.join(root, "content/es"), { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  let n = 0;
  for (const f of fs.readdirSync(path.join(root, "content")).filter(x => x.endsWith(".html"))) {
    const src = fs.readFileSync(path.join(root, "content", f), "utf8");
    const fixed = fixEnglishHead(src, f);
    if (fixed !== src) fs.writeFileSync(path.join(root, "content", f), fixed);
  }
  for (const f of ES_PAGES) {
    const src = fs.readFileSync(path.join(root, "content", f), "utf8");
    await page.setContent(src, { waitUntil: "domcontentloaded" });
    const out = await page.evaluate(({ i18nSrc, dict, f, SITE, ES_PAGES }) => {
      // load the translator without running the rest of the site
      const w = { location: { search: "?lang=en", pathname: "/" }, localStorage: { getItem() {}, setItem() {} } };
      new Function("window", "location", "localStorage", "document", i18nSrc)(w, w.location, w.localStorage, { documentElement: { classList: { remove() {} } } });
      const tr = s => w.HTi18n._tr(dict, s);
      const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1 };
      const ATTRS = ["placeholder", "aria-label", "title", "alt", "data-success", "data-name", "data-sub", "data-words", "data-label"];
      const walk = node => {
        if (node.nodeType === 3) {
          const p = node.parentNode; if (!p || SKIP[p.nodeName] || (p.closest && p.closest("svg,[data-no-tr]"))) return;
          const o = tr(node.nodeValue);
          if (o != null) { const lead = /^\s*/.exec(node.nodeValue)[0], tail = /\s*$/.exec(node.nodeValue)[0]; node.nodeValue = lead + o + tail; }
          return;
        }
        if (node.nodeType !== 1 || SKIP[node.nodeName] || node.nodeName.toLowerCase() === "svg" || node.hasAttribute("data-no-tr")) return;
        for (const a of ATTRS) { const v = node.getAttribute(a); if (!v) continue; const o = a === "data-words" ? v.split("|").map(x => tr(x) || x).join("|") : tr(v); if (o != null) node.setAttribute(a, o); }
        for (const k of [...node.childNodes]) walk(k);
      };
      walk(document.body);
      document.title = tr(document.title) || document.title;
      for (const m of document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"],meta[property="og:image:alt"]')) {
        const o = tr(m.getAttribute("content") || ""); if (o) m.setAttribute("content", o);
      }
      const esHref = file => "/es/" + (file === "index.html" ? "" : file);
      // links and files: Spanish pages link to Spanish pages; everything else points at the shared file
      const fix = v => {
        if (!v || /^(#|[a-z]+:|\/\/|data:)/i.test(v)) return v;
        const [p, rest = ""] = v.split(/(?=[?#])/);
        const file = p.replace(/^\//, "") || "index.html";
        if (/\.html$/.test(file) && ES_PAGES.includes(file)) return esHref(file) + rest;
        return v.startsWith("/") ? v : "/" + v;
      };
      for (const el of document.querySelectorAll("[href],[src],[poster],[data-src]")) for (const a of ["href", "src", "poster", "data-src"]) if (el.hasAttribute(a) && !(el.tagName === "LINK" && /canonical|alternate/.test(el.rel))) el.setAttribute(a, fix(el.getAttribute(a)));
      for (const el of document.querySelectorAll("[srcset],[data-srcset]")) for (const a of ["srcset", "data-srcset"]) if (el.hasAttribute(a)) el.setAttribute(a, el.getAttribute(a).split(",").map(s => { const [u, d] = s.trim().split(/\s+/); return fix(u) + (d ? " " + d : ""); }).join(", "));
      // app screenshots: use the Spanish ones in the HTML itself (site.js used to swap them after load, which slowed the page)
      for (const el of document.querySelectorAll("img,source,link[rel=preload]")) for (const a of ["src", "srcset", "data-src", "data-srcset", "href", "imagesrcset"]) {
        const v = el.getAttribute(a); if (v && v.includes("assets/f/") && !v.includes("assets/f/es/")) el.setAttribute(a, v.replace(/assets\/f\//g, "assets/f/es/"));
      }
      // head: language, addresses and the two-way language links
      document.documentElement.lang = "es";
      const en = SITE + "/" + (f === "index.html" ? "" : f), es = SITE + esHref(f);
      document.querySelector('link[rel="canonical"]').href = es;
      for (const l of document.querySelectorAll('link[rel="alternate"][hreflang]')) l.remove();
      const canon = document.querySelector('link[rel="canonical"]');
      [["en", en], ["es", es], ["x-default", en]].reverse().forEach(([h, u]) => { const l = document.createElement("link"); l.rel = "alternate"; l.hreflang = h; l.href = u; canon.after(l); });
      const ogu = document.querySelector('meta[property="og:url"]'); if (ogu) ogu.content = es;
      let loc = document.querySelector('meta[property="og:locale"]');
      if (!loc) { loc = document.createElement("meta"); loc.setAttribute("property", "og:locale"); (ogu || canon).after(loc); }
      loc.content = "es_US";
      // structured data: translate the visible text fields and point page addresses at the Spanish pages
      const ldUrl = u => { if (typeof u !== "string" || !u.startsWith(SITE + "/")) return u; const p = u.slice(SITE.length + 1).split("#")[0] || "index.html"; return ES_PAGES.includes(p) ? SITE + esHref(p) + (u.includes("#") ? u.slice(u.indexOf("#")) : "") : u; };
      const ld = o => {
        if (Array.isArray(o)) return o.map(ld);
        if (!o || typeof o !== "object") return o;
        const r = {};
        for (const [k, v] of Object.entries(o)) {
          if (["name", "headline", "description", "text", "alternateName"].includes(k) && typeof v === "string") r[k] = tr(v) || v;
          else if (["item", "url", "mainEntityOfPage", "@id"].includes(k) && typeof v === "string" && !/#(org|site|app)$/.test(v)) r[k] = ldUrl(v);
          else if (k === "inLanguage" && typeof v === "string") r[k] = "es";
          else r[k] = ld(v);
        }
        return r;
      };
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { try { s.textContent = JSON.stringify(ld(JSON.parse(s.textContent))); } catch (e) {} }
      return "<!doctype html>\n" + document.documentElement.outerHTML + "\n";
    }, { i18nSrc, dict, f, SITE, ES_PAGES });
    fs.writeFileSync(path.join(root, "content/es", f), out);
    n++;
  }
  await browser.close();
  console.log(`es/: ${n} Spanish pages`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) await main();
