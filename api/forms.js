// Marketing site forms (waitlist and contact). Saves into the Supabase table site_submissions.
const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = req.body || {};
  if (b["bot-field"]) return res.status(200).json({ ok: true }); // honeypot: quietly ignore bots
  const kind = b["form-name"] === "contact" ? "contact" : b["form-name"] === "waitlist" ? "waitlist" : null;
  const email = clip(b.email, 200);
  if (!kind || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Check your email" });
  const row = { kind, email, name: clip(b.name, 120), phone: clip(b.phone, 40), topic: clip(b.topic, 80), message: clip(b.message, 5000) };
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/site_submissions`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify(row)
  }).catch(() => null);
  if (!r || !r.ok) return res.status(502).json({ error: "Couldn't save" });
  return res.status(200).json({ ok: true });
}
