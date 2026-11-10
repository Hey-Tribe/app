// Maps a site address to the file behind it, for the local test servers in tools/ and tests/.
// Pages live in content/ (English) and content/es/ (Spanish); everything else (styles, scripts, images,
// the app, admin and sitter pages) lives in public/. Production serves the same files through Next.js.
import fs from "node:fs";
import path from "node:path";
export function siteFile(root, p) {
  for (const dir of ["public", "content"]) {
    const f = path.join(root, dir, p);
    if (f.startsWith(path.join(root, dir)) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return path.join(root, "public", p);
}
