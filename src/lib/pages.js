// Website pages for the Next.js app. Each page is authored as an HTML file in content/ (English) or content/es/
// (Spanish, built by tools/build-es.mjs). This module reads a page once and splits it into the parts the layouts
// render: the language, the head tags and the body.
import fs from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";

const CONTENT = path.join(process.cwd(), "content");
const dirFor = lang => (lang === "es" ? path.join(CONTENT, "es") : CONTENT);
const cache = new Map();

// Page files that get their own address, e.g. "pricing.html". The home page and the 404 page are routed separately.
export function pageFiles(lang) {
  return fs.readdirSync(dirFor(lang)).filter(f => f.endsWith(".html") && f !== "index.html" && f !== "404.html").sort();
}

export function loadPage(lang, file) {
  const key = lang + "/" + file;
  if (cache.has(key)) return cache.get(key);
  const full = path.join(dirFor(lang), file);
  if (!/^[a-z0-9-]+\.html$/.test(file) || !fs.existsSync(full)) return null;
  const root = parse(fs.readFileSync(full, "utf8"), { comment: false, blockTextElements: { script: true, style: true, noscript: true } });
  const html = root.querySelector("html");
  const head = root.querySelector("head");
  const body = root.querySelector("body");
  const nodes = [];
  for (const el of head ? head.childNodes : []) {
    if (el.nodeType !== 1) continue;
    const tag = el.rawTagName.toLowerCase();
    const attrs = el.attributes;
    // Next.js writes the charset and viewport tags itself
    if (tag === "meta" && (attrs.charset || attrs.name === "viewport")) continue;
    // script and style keep their raw source; the title is text, so entities like &amp; are decoded (React escapes it again)
    const text = tag === "script" || tag === "style" ? el.rawText : tag === "title" ? el.text : "";
    nodes.push({ tag, attrs, text });
  }
  const page = { lang: (html && html.getAttribute("lang")) || (lang === "es" ? "es" : "en"), head: nodes, body: body ? body.innerHTML : "" };
  cache.set(key, page);
  return page;
}
