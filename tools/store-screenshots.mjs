// Store screenshots from the sample family, no frame: mobile/store/screenshots/{ios,android}/{en,es}/NN-name.png
// iPhone 6.9" = 1320 x 2868 (440 x 956 at 3x). Google Play phone = 1080 x 2160 (360 x 720 at 3x, 2:1).
// Run: npm run build:app && node tools/store-screenshots.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const SHOTS = [["01-today", "today"], ["02-calendar", "calendar"], ["03-chores", "chores"], ["04-lists", "lists"], ["05-dinner", "menu"], ["06-kid-view", "family", async p => { const b = await p.$('[data-act="kid-go"]'); if (b) { await b.click(); await p.waitForTimeout(800); } }]];
const SIZES = { ios: { width: 440, height: 956 }, android: { width: 360, height: 720 } };
const browser = await chromium.launch();
for (const [store, vp] of Object.entries(SIZES)) for (const lang of ["en", "es"]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.route(/googletagmanager|google-analytics/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(`${base}/app/?lang=${lang}`); await page.waitForTimeout(1200);
  await page.click('[data-act="try-sample"]'); await page.waitForTimeout(3000);
  await page.addStyleTag({ content: ".samplebar{display:none!important}" });
  const out = path.join(root, "mobile/store/screenshots", store, lang); fs.mkdirSync(out, { recursive: true });
  for (const [name, view, step] of SHOTS) {
    await page.evaluate(v => { location.hash = "#" + v; }, view); await page.waitForTimeout(1300);
    if (step) await step(page);
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, name + ".png") });
    if (name === "06-kid-view") { const x = await page.$('[data-act="kid-exit"]'); if (x) await x.click(); }
    console.log(store, lang, name);
  }
  await ctx.close();
}
await browser.close(); server.close();
