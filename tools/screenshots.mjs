// Makes the phone screenshots used on the website (assets/f, assets/f/sm, assets/f/es, assets/f/es/sm)
// from the sample family in the real app, framed as a phone. Run: npm run build:app && node tools/screenshots.mjs [names...]
// Then convert: python3 tools/screenshots-webp.py
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/__frame?")) { res.writeHead(200, { "content-type": "text/html" }); return res.end(FRAME(new URL(req.url, "http://x").searchParams.get("src"))); }
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;

// what each screenshot shows: [file name, app view, extra steps run inside the app frame]
const SHOTS = [
  ["today", "today"],
  ["countdowns", "today", f => f.evaluate(() => { const h = [...document.querySelectorAll("h2,h3,b")].find(e => /Counting down|Cuenta regresiva/.test(e.textContent)); if (h) h.closest(".dsec, section, div").scrollIntoView({ block: "start" }); window.scrollBy(0, -8); })],
  ["fridge", "today", f => f.evaluate(() => { const h = [...document.querySelectorAll("h2,h3,b")].find(e => /On the fridge|En el refri/.test(e.textContent)); if (h) h.closest(".dsec, section, div").scrollIntoView({ block: "start" }); window.scrollBy(0, -8); })],
  ["calendar", "calendar"],
  ["heytribe", "today", async f => { await f.click('#nav [data-act="ht"]'); await f.waitForTimeout(500); await f.click(".ht-chip"); await f.waitForTimeout(200); await f.click('form[data-form="ht"] .btn'); await f.waitForTimeout(900); }],
  ["menu", "menu"],
  ["lists", "lists"],
  ["chores", "chores"],
  ["routines", "routines"],
  ["kid", "family", async f => { const b = await f.$('[data-act="kid-go"]'); if (b) { await b.click(); await f.waitForTimeout(800); } }],
  ["school", "school"],
  ["health", "health"],
  ["baby", "baby"],
  ["home", "home"],
  ["docs", "docs"],
  ["trips", "trips", async f => { const b = await f.$('[data-act="trip-open"]'); if (b) { await b.click(); await f.waitForTimeout(800); } }],
  ["contacts", "contacts"],
  ["sitter", "sitter"],
  ["family", "family"]
];

const FRAME = (src) => `<!doctype html><html><head><style>
html,body{margin:0;background:transparent}
.ph{width:328px;height:690px;border-radius:54px;background:#1F2429;padding:8px;box-sizing:border-box;position:relative}
.sc{width:312px;height:674px;border-radius:46px;overflow:hidden;position:relative;background:#F6F8F5}
.in{width:390px;height:844px;transform:scale(.8);transform-origin:0 0;position:absolute;left:0;top:0}
.sb{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 34px 0 44px;font:600 17px -apple-system,system-ui,sans-serif;color:#1F2429;background:#F6F8F5;position:relative}
.is{position:absolute;left:50%;top:12px;width:122px;height:34px;margin-left:-61px;border-radius:20px;background:#1F2429}
iframe{border:0;width:390px;height:790px;display:block;background:#F6F8F5}
</style></head><body><div class="ph"><div class="sc"><div class="in"><div class="sb"><span>9:41</span><span class="is"></span><svg width="62" height="14" viewBox="0 0 62 14"><g fill="#1F2429"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/><rect x="34" y="1" width="24" height="12" rx="3.5" fill="none" stroke="#1F2429" stroke-width="1.5"/><rect x="36.5" y="3.5" width="19" height="7" rx="2"/><rect x="59.5" y="5" width="2" height="4" rx="1"/></g></svg></div><iframe id="app" src="${src}"></iframe></div></div></div></body></html>`;

const browser = await chromium.launch();
for (const lang of ["en", "es"]) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 760 }, deviceScaleFactor: 2 });
  await ctx.route(/googletagmanager|google-analytics/, r => r.abort());
  const page = await ctx.newPage();
  // start the sample family once so it is stored for this browser
  await page.goto(`${base}/app/?lang=${lang}`); await page.waitForTimeout(1200);
  await page.click('[data-act="try-sample"]'); await page.waitForTimeout(2500);
  const outDir = path.join(root, "assets/f", lang === "es" ? "es" : "");
  fs.mkdirSync(path.join(outDir, "sm"), { recursive: true });
  const only = process.argv.slice(2);
  for (const [name, view, step] of SHOTS.filter(x => !only.length || only.includes(x[0]))) {
    await page.goto(`${base}/__frame?src=${encodeURIComponent(`/app/?lang=${lang}#${view}`)}`);
    const frame = await (await page.waitForSelector("#app")).contentFrame();
    await frame.waitForTimeout(1200);
    const sample = await frame.$('[data-act="try-sample"]');
    if (sample) { await sample.click(); await frame.waitForTimeout(2000); await frame.evaluate(v => { location.hash = "#" + v; }, view); await frame.waitForTimeout(800); }
    try { await frame.waitForSelector("#nav button", { timeout: 15000 }); } catch (e) { await page.screenshot({ path: path.join(root, "debug-shot.png") }); throw e; } await frame.waitForTimeout(1200);
    await frame.addStyleTag({ content: ".samplebar{display:none!important}" }); await frame.waitForTimeout(200);
    if (step) await step(frame);
    await frame.waitForTimeout(400);
    const el = await page.$(".ph");
    const file = path.join(outDir, `${name}.png`);
    await el.screenshot({ path: file, omitBackground: true });
    console.log(lang, name);
  }
  await ctx.close();
}
await browser.close(); server.close();
