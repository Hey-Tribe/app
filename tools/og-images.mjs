// Makes the link preview images for guides (og/<page>.jpg, 1200x630) from each guide's title and category.
// Run: node tools/og-images.mjs [page-slug ...]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const font = fs.readFileSync(path.join(root, "assets/fonts/atkinson.woff2")).toString("base64");
const tone = { Chores: "#F3E6E2", Routines: "#F3E6E2", Teens: "#F3E6E2", "Kids and school": "#DEE7EE", School: "#DEE7EE", Planning: "#DEE7EE", Travel: "#DEE7EE", "New baby": "#E9EBDC", Childcare: "#E9EBDC", "Meal planning": "#F4EBDA", Home: "#E6EEE9", "Home admin": "#E6EEE9", "Home care": "#E6EEE9", Safety: "#E6EEE9", "Family life": "#F4EBDA" };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const only = process.argv.slice(2);
const slugs = fs.readdirSync(path.join(root, "og")).filter(f => f.endsWith(".jpg")).map(f => f.slice(0, -4)).filter(s => !only.length || only.includes(s));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const slug of slugs) {
  const html = fs.readFileSync(path.join(root, slug + ".html"), "utf8");
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const cat = (html.match(/<span class="eyebrow">([^<]+)<\/span>/) || [, "Guide"])[1].trim();
  const bg = tone[cat] || "#E6EEE9";
  await page.setContent(`<!doctype html><html><head><style>
@font-face{font-family:A;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:200 800}
html,body{margin:0;width:1200px;height:630px;background:${bg};font-family:A,sans-serif;color:#2F3B45}
.c{position:absolute;inset:56px;background:#FBFCFA;border-radius:28px;padding:56px 60px;display:flex;flex-direction:column}
.k{font-size:26px;font-weight:700;color:#555E67}
h1{margin:22px 0 0;font-size:${h1.length > 70 ? 58 : 66}px;line-height:1.08;font-weight:700;letter-spacing:-.02em;max-width:980px}
.f{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-size:26px;color:#555E67}
.f b{color:#46705F;font-size:34px;font-weight:800;letter-spacing:-.5px}.f b span{font-weight:400}
</style></head><body><div class="c"><div class="k">${esc(cat)}</div><h1>${esc(h1)}</h1><div class="f"><span>heytribe.app/guides</span><b><span>hey</span>tribe</b></div></div></body></html>`);
  await page.waitForTimeout(50);
  await page.screenshot({ path: path.join(root, "og", slug + ".jpg"), type: "jpeg", quality: 86 });
}
await browser.close();
console.log(slugs.length, "images");
