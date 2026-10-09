// Sends a test reminder to the signed-in person's device. POST { endpoint } with their login token.
import webpush from "web-push";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return res.status(501).json({ error: "Reminders aren't set up yet." });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const endpoint = String((req.body || {}).endpoint || "");
  if (!token || !endpoint) return res.status(400).json({ error: "Missing details" });
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth&endpoint=eq.${encodeURIComponent(endpoint)}`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: "Bearer " + token } }).catch(() => null);
  const rows = r && r.ok ? await r.json() : [];
  if (!rows.length) return res.status(404).json({ error: "This device isn't set up for reminders." });
  webpush.setVapidDetails("mailto:hello@heytribe.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  try {
    await webpush.sendNotification({ endpoint: rows[0].endpoint, keys: { p256dh: rows[0].p256dh, auth: rows[0].auth } }, JSON.stringify({ title: "Reminders are on", body: "This is how HeyTribe will nudge you about plans, meds and bills.", url: "/app/#family", tag: "test" }), { TTL: 600 });
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(502).json({ error: "Couldn't reach this device." }); }
}
