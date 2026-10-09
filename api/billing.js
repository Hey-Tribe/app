// Premium billing with Stripe.
// GET  /api/billing                                  -> { enabled } (true once Stripe keys are set in Vercel)
// POST /api/billing { action: "checkout"|"portal", code } with the signed-in user's token
// Needs: STRIPE_SECRET_KEY, STRIPE_PRICE_ID (the $4.99/month price), SUPABASE_URL, SUPABASE_ANON_KEY.
const SITE = process.env.SITE_URL || "https://www.heytribe.app";

async function stripe(path, params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") body.append(k, String(v));
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method: "POST",
    headers: { authorization: "Bearer " + process.env.STRIPE_SECRET_KEY, "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || "Stripe error");
  return j;
}

export default async function handler(req, res) {
  const enabled = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
  res.setHeader("cache-control", "no-store");
  if (req.method === "GET") return res.status(200).json({ enabled });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!enabled) return res.status(503).json({ error: "Premium checkout opens soon." });

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { action, code: rawCode, lang } = req.body || {};
  const code = String(rawCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (!token || !code || code === "SAMPLE") return res.status(400).json({ error: "Sign in first." });

  const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY;
  const auth = { apikey: KEY, authorization: "Bearer " + token };
  const ur = await fetch(SB + "/auth/v1/user", { headers: auth }).catch(() => null);
  if (!ur || !ur.ok) return res.status(401).json({ error: "Please sign in again." });
  const user = await ur.json();
  // the subscriptions row is only readable by members of that tribe, so this doubles as the membership check
  const sr = await fetch(`${SB}/rest/v1/subscriptions?tribe_code=eq.${code}&select=status,trial_ends_at,stripe_customer_id`, { headers: auth }).catch(() => null);
  const rows = sr && sr.ok ? await sr.json() : [];
  if (!rows.length) return res.status(403).json({ error: "You're not in that tribe." });
  const sub = rows[0];

  try {
    if (action === "portal") {
      if (!sub.stripe_customer_id) return res.status(400).json({ error: "No billing account yet." });
      const s = await stripe("billing_portal/sessions", { customer: sub.stripe_customer_id, return_url: SITE + "/app/", locale: lang === "es" ? "es" : "auto" });
      return res.status(200).json({ url: s.url });
    }
    if (action !== "checkout") return res.status(400).json({ error: "Unknown action" });
    if (sub.status === "active" || sub.status === "comped") return res.status(409).json({ error: "Your tribe already has Premium." });
    const p = {
      mode: "subscription",
      "line_items[0][price]": process.env.STRIPE_PRICE_ID,
      "line_items[0][quantity]": 1,
      success_url: SITE + "/app/?billing=success",
      cancel_url: SITE + "/app/?billing=cancel",
      client_reference_id: code,
      "metadata[tribe_code]": code,
      "subscription_data[metadata][tribe_code]": code,
      allow_promotion_codes: "true",
      locale: lang === "es" ? "es" : "auto"
    };
    if (sub.stripe_customer_id) p.customer = sub.stripe_customer_id; else p.customer_email = user.email;
    // upgrading during the free trial: keep the remaining trial days, first charge when the trial ends
    const end = sub.status === "trialing" && sub.trial_ends_at ? Math.floor(new Date(sub.trial_ends_at).getTime() / 1000) : 0;
    if (end > Date.now() / 1000 + 49 * 3600) p["subscription_data[trial_end]"] = end;
    const s = await stripe("checkout/sessions", p);
    return res.status(200).json({ url: s.url });
  } catch (e) {
    return res.status(502).json({ error: "Couldn't reach the payment service. Try again in a minute." });
  }
}
