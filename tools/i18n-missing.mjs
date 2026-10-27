// Lists English text on the site that has no Spanish translation in i18n/es-site.json (or app/i18n/es-app.json with --app).
// Run: node tools/i18n-missing.mjs [page.html ...]   (defaults to every .html page at the repo root, plus sitter)
// Serves the repo on a local port, opens each page in English and checks every text node and label the same way the
// translator does. Prints "page: text" lines; exit code 1 if anything is missing.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const pages = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(root).filter(f => f.endsWith(".html") && f !== "404.html").sort();
const dict = JSON.parse(fs.readFileSync(path.join(root, "i18n/es-site.json"), "utf8"));

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.route(/googletagmanager|google-analytics|supabase\.co/, r => r.abort());
let missing = 0;
for (const pg of pages) {
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/${pg}?lang=en`, { waitUntil: "load" });
  await page.waitForFunction(() => window.HTi18n && window.HTi18n._tr, null, { timeout: 5000 }).catch(() => {});
  const out = await page.evaluate(d => {
    const tr = window.HTi18n && window.HTi18n._tr; if (!tr) return ["(translator not loaded)"];
    const ATTRS = ["placeholder", "aria-label", "title", "alt", "data-success", "data-name", "data-sub", "data-words", "data-label"];
    const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, NOSCRIPT: 1 };
    const miss = new Set();
    const want = t => { t = t.replace(/\s+/g, " ").trim(); return t && /[A-Za-z]{2}/.test(t) && !/^https?:|^[\w.-]+@[\w.-]+$|^#\d+$/.test(t); };
    const check = t => { if (want(t) && tr(d, t) == null) miss.add(t.replace(/\s+/g, " ").trim()); };
    const walk = n => {
      if (n.nodeType === 3) { const p = n.parentNode; if (!p || SKIP[p.nodeName] || p.closest("svg,[data-no-tr],[contenteditable]")) return; check(n.nodeValue); return; }
      if (n.nodeType !== 1 || SKIP[n.nodeName] || n.nodeName === "svg" || n.hasAttribute("data-no-tr")) return;
      for (const a of ATTRS) { const v = n.getAttribute(a); if (v) (a === "data-words" ? v.split("|") : [v]).forEach(check); }
      if (n.nodeName === "META" && n.getAttribute("name") === "description") check(n.getAttribute("content") || "");
      n.childNodes.forEach(walk);
    };
    walk(document.documentElement); check(document.title);
    return [...miss];
  }, dict);
  for (const t of out) { console.log(`${pg}: ${t}`); missing++; }
  await page.close();
}
await browser.close(); server.close();
console.error(`${missing} untranslated across ${pages.length} pages`);
process.exit(missing ? 1 : 0);
