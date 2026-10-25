// Premium bought in the iPhone app. After a purchase or "Restore purchases", the app posts the signed
// transaction from StoreKit here: POST { jws, code } with the signed-in user's token.
// Needs: BILLING_SYNC_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY. Optional: APPLE_BUNDLE_ID, APPLE_PRODUCT_ID.
import { verifyJws, txStatus, appleSync, BUNDLE_ID, PRODUCT_ID } from "./_apple.js";

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.BILLING_SYNC_SECRET) return res.status(503).json({ error: "Premium isn't set up yet." });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { jws, code: rawCode } = req.body || {};
  const code = String(rawCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (!token || !code || code === "SAMPLE" || !jws) return res.status(400).json({ error: "Sign in first." });

  let tx;
  try { tx = verifyJws(jws); } catch (e) { return res.status(400).json({ error: "We couldn't confirm that purchase with Apple." }); }
  if (tx.bundleId !== BUNDLE_ID() || tx.productId !== PRODUCT_ID() || !tx.originalTransactionId) return res.status(400).json({ error: "That isn't a HeyTribe Premium purchase." });

  const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY;
  const auth = { apikey: KEY, authorization: "Bearer " + token };
  const ur = await fetch(SB + "/auth/v1/user", { headers: auth }).catch(() => null);
  if (!ur || !ur.ok) return res.status(401).json({ error: "Please sign in again." });
  const user = await ur.json();
  // the app sets appAccountToken to the HeyTribe login id, so a receipt can't be replayed by someone else
  if (tx.appAccountToken && String(tx.appAccountToken).toLowerCase() !== String(user.id).toLowerCase()) return res.status(403).json({ error: "This purchase belongs to a different HeyTribe login." });
  // the subscriptions row is only readable by members of that family, so this doubles as the membership check
  const sr = await fetch(`${SB}/rest/v1/subscriptions?tribe_code=eq.${code}&select=status`, { headers: auth }).catch(() => null);
  const rows = sr && sr.ok ? await sr.json() : [];
  if (!rows.length) return res.status(403).json({ error: "You're not in that family." });

  const status = txStatus(tx);
  try {
    const out = await appleSync({ p_code: code, p_otx: String(tx.originalTransactionId), p_status: status, p_period_end: tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null });
    if (out === "in_use") return res.status(409).json({ error: "This Apple subscription already pays for another family." });
    if (out !== "ok") return res.status(400).json({ error: "Couldn't find that family." });
  } catch (e) { return res.status(502).json({ error: "Couldn't save your purchase. Try Restore purchases in a minute." }); }
  return res.status(200).json({ ok: true, active: status === "active" });
}
