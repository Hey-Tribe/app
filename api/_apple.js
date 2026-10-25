// Checks App Store signed data (JWS) from StoreKit 2 and App Store Server Notifications V2.
// A JWS is trusted only if its certificate chain ends at Apple Root CA - G3 (pinned below), every link
// is signed by the next, each certificate is in date, the Apple marker extensions are present, and the
// ES256 signature checks out with the leaf key. Anything else is rejected.
import crypto from "node:crypto";

const APPLE_ROOT_G3 = "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";
const OID_LEAF = Buffer.from("060a2a864886f76364060b01", "hex");   // 1.2.840.113635.100.6.11.1 (App Store receipt signing)
const OID_MID  = Buffer.from("060a2a864886f76364060201", "hex");          // 1.2.840.113635.100.6.2.1 (Apple WWDR intermediate)

const b64u = s => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function verifyJws(jws, root = APPLE_ROOT_G3, now = new Date()) {
  const parts = String(jws || "").split(".");
  if (parts.length !== 3) throw new Error("bad jws");
  const header = JSON.parse(b64u(parts[0]).toString("utf8"));
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length !== 3) throw new Error("bad header");
  const [leaf, mid, top] = header.x5c.map(c => new crypto.X509Certificate(Buffer.from(c, "base64")));
  const pinned = new crypto.X509Certificate(Buffer.from(root, "base64"));
  if (!top.raw.equals(pinned.raw)) throw new Error("untrusted root");
  for (const [child, parent] of [[leaf, mid], [mid, pinned]]) {
    if (!child.checkIssued(parent) || !child.verify(parent.publicKey)) throw new Error("broken chain");
  }
  for (const c of [leaf, mid, pinned]) if (now < new Date(c.validFrom) || now > new Date(c.validTo)) throw new Error("expired certificate");
  if (!leaf.raw.includes(OID_LEAF) || !mid.raw.includes(OID_MID)) throw new Error("not an App Store certificate");
  const ok = crypto.verify("sha256", Buffer.from(parts[0] + "." + parts[1]), { key: leaf.publicKey, dsaEncoding: "ieee-p1363" }, b64u(parts[2]));
  if (!ok) throw new Error("bad signature");
  return JSON.parse(b64u(parts[1]).toString("utf8"));
}

export const BUNDLE_ID = () => process.env.APPLE_BUNDLE_ID || "app.heytribe.ios";
export const PRODUCT_IDS = () => [process.env.APPLE_PRODUCT_ID || "app.heytribe.premium.monthly", process.env.APPLE_PRODUCT_ID_YEARLY || "app.heytribe.premium.yearly"];
export const isPremiumProduct = id => PRODUCT_IDS().includes(id);

// what a signed transaction means for the family's plan
export function txStatus(tx, now = Date.now()) {
  if (!tx || tx.revocationDate) return "canceled";
  return tx.expiresDate && tx.expiresDate > now ? "active" : "canceled";
}

export async function appleSync(body) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/apple_sync`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ p_secret: process.env.BILLING_SYNC_SECRET, ...body })
  });
  if (!r.ok) throw new Error("apple_sync " + r.status);
  return r.json();
}
