// End-to-end smoke test: clicks through the site and the sample family in a real browser. With SITE_URL set
// (for example the Next.js server, `npm start`) it tests that; otherwise it serves the files directly. Fails on any page error or a missing key element. Run: npm run test:e2e
import { siteFile } from "../tools/site-file.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = siteFile(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = process.env.SITE_URL || `http://localhost:${server.address().port}`;

const fails = [];
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails.push(what); };
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  // the app talks to the real Supabase only for sign-in; the sample family runs on this device
  for (const [url, text] of [["/", "HeyTribe"], ["/pricing.html", "$39.99"], ["/features.html", "Shared calendar"], ["/delete-account.html", "Delete my account"], ["/help.html", "Help"]]) {
    await page.goto(base + url, { waitUntil: "load" });
    check((await page.content()).includes(text), `${url} shows "${text}"`);
  }
  await page.goto(base + "/app/");
  await page.waitForSelector('[data-act="try-sample"]', { timeout: 15000 });
  check(true, "app opens to the log-in screen");
  await page.click('[data-act="try-sample"]');
  await page.waitForFunction(() => document.body.innerText.includes("Sample family"), null, { timeout: 15000 });
  for (const v of ["today", "calendar", "lists", "chores", "menu", "health", "home", "docs", "trips", "family"]) {
    await page.evaluate(v => { location.hash = "#" + v; }, v);
    await page.waitForTimeout(500);
    const n = await page.evaluate(() => document.querySelector("#app, main, body").innerText.length);
    check(n > 100, `sample family: ${v} screen renders`);
  }
  await page.evaluate(() => { location.hash = "#lists"; }); await page.waitForTimeout(400);
  const before = await page.locator(".item, [data-act='item']").count();
  const input = page.locator('form[data-form="item"] input, input[name="text"]').first();
  if (await input.count()) { await input.fill("Smoke test bananas"); await input.press("Enter"); await page.waitForTimeout(600); }
  check((await page.content()).includes("Smoke test bananas"), "sample family: adding a grocery item shows it");
  check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));

  // sign-up screen links the Terms and Privacy Policy
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p2.goto(base + "/app/#signup");
  await p2.waitForSelector('a[href="/terms.html"]', { timeout: 15000 }).catch(() => {});
  check(await p2.locator('a[href="/terms.html"]').count() > 0 && await p2.locator('a[href="/privacy.html"]').count() > 0, "sign-up screen links the Terms and Privacy Policy");
  await p2.close();

  // forced-update gate: a phone app older than the minimum sees the update screen, a current one doesn't
  for (const [min, want] of [["2.0.0", true], ["0.0.0", false]]) {
    const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p3.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: { App: { getInfo: async () => ({ version: "1.0.0" }) } } }; });
    await p3.route("**/api/app-version**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ min }) }));
    await p3.goto(base + "/app/");
    await p3.waitForTimeout(2500);
    const shown = (await p3.content()).includes("Please update HeyTribe");
    check(shown === want, `update screen ${want ? "shows" : "stays hidden"} when the minimum is ${min}`);
    await p3.close();
  }
} finally {
  await browser.close(); server.close();
}
if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log("\nall smoke checks passed");
