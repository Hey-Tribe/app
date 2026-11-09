import { watch } from "./_watch.js";
import { sbHeaders, sbKey } from "./_sb.js";
import { verifyNotification, exchangeCode, appleSigninReady, IOS_ID } from "./_applesignin.js";
// Sign in with Apple, two jobs at one address:
// 1. Apple's server-to-server notifications. Set https://www.heytribe.app/api/apple-signin in the Apple Developer
//    account (Identifiers > app.heytribe.web > Sign in with Apple > Server-to-Server Notification Endpoint).
//    Apple posts { payload: "<signed token>" } holding { events: "<json>" } with type, sub and, for email events, email.
// 2. The iPhone app, right after a native Apple sign-in, posts { code } with the person's login. The server trades
//    the one-time code for Apple's refresh token and keeps it, so the account can be revoked at Apple when deleted.

async function rpc(name, body, auth) {
  const headers = { ...sbHeaders(), "content-type": "application/json" };
  if (auth) headers.authorization = auth;
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(name + " " + r.status);
  return r.status === 204 ? null : r.json();
}

async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = { payload: body }; } }

  if (body.code) {
    const auth = String(req.headers.authorization || "");
    if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) return res.status(401).json({ error: "sign in first" });
    if (!appleSigninReady()) return res.status(200).json({ saved: false, why: "not set up" });
    const u = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: sbKey(), authorization: auth }, signal: AbortSignal.timeout(5000) });
    if (!u.ok) return res.status(401).json({ error: "sign in first" });
    let token;
    try { token = await exchangeCode(String(body.code).slice(0, 500)); } catch (e) { return res.status(400).json({ saved: false, why: "Apple didn't accept the code" }); }
    const saved = await rpc("apple_token_save", { p_token: token, p_client: IOS_ID() }, auth);
    return res.status(200).json({ saved: !!saved });
  }

  if (!process.env.CRON_SECRET) return res.status(503).json({ error: "not set up" });
  let claims;
  try { claims = await verifyNotification(body.payload); } catch (e) { return res.status(400).json({ error: "not a valid Apple notification" }); }
  let ev = claims.events;
  if (typeof ev === "string") { try { ev = JSON.parse(ev); } catch (e) { ev = null; } }
  if (!ev || !ev.type || !ev.sub) return res.status(400).json({ error: "no event" });
  const result = await rpc("apple_event", { p_secret: process.env.CRON_SECRET, p_sub: String(ev.sub), p_type: String(ev.type), p_email: ev.email ? String(ev.email) : null });
  res.status(200).json({ ok: true, result });
}

export default watch(handler);
