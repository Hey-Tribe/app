// Sign in with Apple, server side: revoking tokens when an account is deleted, trading the iPhone app's one-time
// code for a refresh token, and checking Apple's server-to-server notifications.
// Needs, from the Apple Developer account (Keys > the key with Sign in with Apple turned on):
//   APPLE_TEAM_ID, APPLE_SIGNIN_KEY_ID, APPLE_SIGNIN_KEY_P8 (the whole .p8 file).
// Client IDs: the website uses the Services ID (APPLE_SERVICES_ID, default app.heytribe.web), the iPhone app uses
// its bundle ID (APNS_BUNDLE_ID, default app.heytribe.ios). A token is revoked with the ID that issued it.
import crypto from "node:crypto";

export const WEB_ID = () => process.env.APPLE_SERVICES_ID || "app.heytribe.web";
export const IOS_ID = () => process.env.APNS_BUNDLE_ID || "app.heytribe.ios";
export const appleSigninReady = () => !!(process.env.APPLE_TEAM_ID && process.env.APPLE_SIGNIN_KEY_ID && process.env.APPLE_SIGNIN_KEY_P8);
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");

// The client secret Apple wants: a short-lived ES256 token signed with the Sign in with Apple key.
export function clientSecret(clientId = WEB_ID(), now = Math.floor(Date.now() / 1000)) {
  const head = b64u({ alg: "ES256", kid: process.env.APPLE_SIGNIN_KEY_ID });
  const body = b64u({ iss: process.env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: clientId });
  const key = String(process.env.APPLE_SIGNIN_KEY_P8).replace(/\\n/g, "\n");
  const sig = crypto.sign("sha256", Buffer.from(head + "." + body), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return head + "." + body + "." + sig;
}

async function applePost(path, form, fetchImpl) {
  return fetchImpl("https://appleid.apple.com/auth/" + path, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(), signal: AbortSignal.timeout(8000)
  });
}

// Revoke one refresh token at Apple. Resolves to null on success, or a short error message.
export async function revoke(refreshToken, clientId = WEB_ID(), fetchImpl = fetch) {
  if (!appleSigninReady()) return "Sign in with Apple key not set up";
  try {
    const r = await applePost("revoke", { client_id: clientId, client_secret: clientSecret(clientId), token: refreshToken, token_type_hint: "refresh_token" }, fetchImpl);
    if (r.ok) return null;
    return ("apple " + r.status + " " + (await r.text()).slice(0, 120)).trim();
  } catch (e) { return "apple " + String(e.message || e).slice(0, 120); }
}

// Trade the iPhone app's one-time authorization code (valid 5 minutes) for a refresh token.
export async function exchangeCode(code, clientId = IOS_ID(), fetchImpl = fetch) {
  const r = await applePost("token", { client_id: clientId, client_secret: clientSecret(clientId), code, grant_type: "authorization_code" }, fetchImpl);
  if (!r.ok) throw new Error("apple token " + r.status);
  const j = await r.json();
  if (!j.refresh_token) throw new Error("no refresh token");
  return j.refresh_token;
}

// Revoke every token waiting for an account deletion. rpc(name, body) calls Supabase as the server.
export async function revokePending(rpc, secret, fetchImpl = fetch) {
  const rows = await rpc("apple_revoke_pending", { p_secret: secret });
  let revoked = 0, failed = 0;
  for (const row of rows || []) {
    const err = await revoke(row.refresh_token, row.client_id || WEB_ID(), fetchImpl);
    await rpc("apple_revoke_done", { p_secret: secret, p_user: row.user_id, p_error: err });
    if (err) failed++; else revoked++;
  }
  return { revoked, failed };
}

// Apple's public keys for checking notification signatures (cached for an hour).
let KEYS = null, KEYS_AT = 0;
async function appleKeys(fetchImpl) {
  if (KEYS && Date.now() - KEYS_AT < 3600e3) return KEYS;
  const r = await fetchImpl("https://appleid.apple.com/auth/keys", { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error("apple keys " + r.status);
  KEYS = (await r.json()).keys || []; KEYS_AT = Date.now();
  return KEYS;
}

// Check a notification JWT from Apple and return its decoded payload, or throw.
export async function verifyNotification(jwt, { fetchImpl = fetch, keys } = {}) {
  const parts = String(jwt || "").split(".");
  if (parts.length !== 3) throw new Error("bad token");
  const head = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const body = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  if (head.alg !== "RS256") throw new Error("bad alg");
  const jwk = (keys || await appleKeys(fetchImpl)).find(k => k.kid === head.kid);
  if (!jwk) throw new Error("unknown key");
  const pub = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const good = crypto.verify("sha256", Buffer.from(parts[0] + "." + parts[1]), pub, Buffer.from(parts[2], "base64url"));
  if (!good) throw new Error("bad signature");
  if (body.iss !== "https://appleid.apple.com") throw new Error("bad issuer");
  if (![WEB_ID(), IOS_ID()].includes(body.aud)) throw new Error("bad audience");
  if (body.exp && body.exp < Date.now() / 1000 - 60) throw new Error("expired");
  return body;
}
