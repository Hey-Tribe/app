// Firebase Cloud Messaging (HTTP v1) for the Android app's reminders.
// Needs FCM_SERVICE_ACCOUNT: the whole JSON key of a Firebase service account with the "Firebase Cloud Messaging API Admin" role.
import crypto from "node:crypto";

export const fcmReady = () => !!process.env.FCM_SERVICE_ACCOUNT;
let TOKEN = null, TOKEN_EXP = 0, ACCOUNT = null;
const account = () => ACCOUNT || (ACCOUNT = JSON.parse(process.env.FCM_SERVICE_ACCOUNT));

async function accessToken() {
  if (TOKEN && Date.now() < TOKEN_EXP - 60e3) return TOKEN;
  const a = account(), now = Math.floor(Date.now() / 1000), u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = u({ alg: "RS256", typ: "JWT" });
  const body = u({ iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: a.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const sig = crypto.sign("RSA-SHA256", Buffer.from(head + "." + body), a.private_key).toString("base64url");
  const r = await fetch(a.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + body + "." + sig })
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error("fcm auth " + r.status);
  TOKEN = j.access_token; TOKEN_EXP = Date.now() + (j.expires_in || 3600) * 1000;
  return TOKEN;
}

// send({ token, title, body, url, tag }) -> { ok, dead }
export async function fcmSend(n) {
  try {
    const a = account(), tok = await accessToken();
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
      method: "POST", headers: { authorization: "Bearer " + tok, "content-type": "application/json" },
      body: JSON.stringify({ message: {
        token: n.token,
        notification: { title: n.title, body: n.body },
        data: { url: n.url || "/app/" },
        android: { priority: "high", ttl: "3600s", collapse_key: n.tag ? crypto.createHash("sha1").update(String(n.tag)).digest("hex").slice(0, 32) : undefined,
          notification: { channel_id: "reminders", tag: n.tag ? String(n.tag).slice(0, 60) : undefined, icon: "ic_stat_heytribe", color: "#5E8C7A" } }
      } })
    });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    const code = j.error && (j.error.status || "");
    const dead = r.status === 404 || code === "NOT_FOUND" || code === "UNREGISTERED" || (j.error && JSON.stringify(j.error).includes("UNREGISTERED"));
    return { ok: false, dead };
  } catch (e) { return { ok: false }; }
}
