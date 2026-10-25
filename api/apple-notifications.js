// App Store Server Notifications V2: Apple tells us about renewals, failed payments, cancellations and refunds.
// In App Store Connect › App Information › App Store Server Notifications, set both URLs (production and sandbox) to
//   https://www.heytribe.app/api/apple-notifications   (Version 2)
// Needs: BILLING_SYNC_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY.
import { verifyJws, txStatus, appleSync, BUNDLE_ID, isPremiumProduct } from "./_apple.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.BILLING_SYNC_SECRET) return res.status(501).send("Billing not set up");
  let note, tx;
  try {
    note = verifyJws((req.body || {}).signedPayload);
    const d = note.data || {};
    if (d.bundleId && d.bundleId !== BUNDLE_ID()) return res.status(200).json({ ignored: "other app" });
    if (!d.signedTransactionInfo) return res.status(200).json({ ignored: note.notificationType || "no transaction" });
    tx = verifyJws(d.signedTransactionInfo);
  } catch (e) { return res.status(400).send("Bad signature"); }
  if (!isPremiumProduct(tx.productId) || !tx.originalTransactionId) return res.status(200).json({ ignored: "other product" });

  const type = note.notificationType, sub = note.subtype;
  let status = txStatus(tx);
  if (type === "REFUND" || type === "REVOKE" || type === "EXPIRED" || type === "GRACE_PERIOD_EXPIRED") status = "canceled";
  else if (type === "DID_FAIL_TO_RENEW") status = sub === "GRACE_PERIOD" ? "past_due" : "canceled";
  try {
    await appleSync({ p_code: null, p_otx: String(tx.originalTransactionId), p_status: status, p_period_end: tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null });
  } catch (e) { return res.status(500).send("Try again"); } // Apple retries
  return res.status(200).json({ ok: true });
}
