// Writes public/sitemap.xml from the pages in content/: every English page and every Spanish page in content/es/,
// except pages marked noindex. lastmod is the page's own dateModified (guides and posts) when it has one, otherwise the
// date git last changed the file. Never the build time.
// Run: node tools/sitemap.mjs   (CI checks that the list of addresses matches the pages)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const SITE = "https://www.heytribe.app";

export function publicPages() {
  const files = [];
  for (const dir of ["", "es"]) {
    const d = path.join(root, "content", dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => f.endsWith(".html")).sort()) {
      const rel = dir ? `${dir}/${f}` : f;
      const html = fs.readFileSync(path.join(root, "content", rel), "utf8");
      if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
      files.push(rel);
    }
  }
  return files;
}
export const urlFor = rel => SITE + "/" + rel.replace(/(^|\/)index\.html$/, "$1");

function lastmod(rel) {
  const m = /"dateModified":\s*"(\d{4}-\d{2}-\d{2})/.exec(fs.readFileSync(path.join(root, "content", rel), "utf8"));
  if (m) return m[1];
  try { const d = execFileSync("git", ["log", "-1", "--follow", "--diff-filter=AM", "--format=%cs", "--", "content/" + rel], { cwd: root, encoding: "utf8" }).trim(); if (d) return d; } catch (e) {}
  return new Date().toISOString().slice(0, 10); // new file, not committed yet
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const rows = publicPages().map(rel => `  <url><loc>${urlFor(rel)}</loc><lastmod>${lastmod(rel)}</lastmod></url>`);
  fs.writeFileSync(path.join(root, "public/sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`);
  console.log(`sitemap.xml: ${rows.length} pages`);
}
