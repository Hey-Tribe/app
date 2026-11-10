import { watch } from "../../lib/api/_watch.js";
import { sbHeaders } from "../../lib/api/_sb.js";
// The oldest phone app version still allowed: GET /api/app-version?platform=ios|android -> { min }.
// Source of truth is the app_versions table in Supabase (editable in the admin). MIN_SUPPORTED_APP_VERSION in
// Vercel overrides it in an emergency. Any failure answers "0.0.0" so the app is never locked out by mistake.
const ok = v => /^\d{1,3}(\.\d{1,3}){0,2}$/.test(String(v || ""));
async function handler(req, res) {
  res.setHeader("cache-control", "public, max-age=60");
  const platform = req.query && req.query.platform === "android" ? "android" : "ios";
  if (ok(process.env.MIN_SUPPORTED_APP_VERSION)) return res.status(200).json({ min: process.env.MIN_SUPPORTED_APP_VERSION, source: "env" });
  let min = "0.0.0";
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/app_versions?select=min_version&platform=eq.${platform}`, { headers: sbHeaders(), signal: AbortSignal.timeout(4000) });
    const rows = r.ok ? await r.json() : [];
    if (rows[0] && ok(rows[0].min_version)) min = rows[0].min_version;
  } catch (e) {}
  res.status(200).json({ min, platform });
}

export default watch(handler);
