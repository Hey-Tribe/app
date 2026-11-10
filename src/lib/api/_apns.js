// Apple push for the iPhone app. Uses a token-based APNs key (.p8) from the Apple Developer account.
// Needs: APNS_KEY_P8 (the whole .p8 file), APNS_KEY_ID, APNS_TEAM_ID. Optional: APNS_BUNDLE_ID (default app.heytribe.ios),
// APNS_SANDBOX=1 only for builds run straight from Xcode (TestFlight and App Store builds use production).
import http2 from "node:http2";
import crypto from "node:crypto";

export const apnsReady = () => !!(process.env.APNS_KEY_P8 && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);
let JWT = null, JWT_AT = 0;
function jwt() {
  if (JWT && Date.now() - JWT_AT < 45 * 60e3) return JWT;
  const u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = u({ alg: "ES256", kid: process.env.APNS_KEY_ID }), body = u({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) });
  const key = String(process.env.APNS_KEY_P8).replace(/\\n/g, "\n");
  const sig = crypto.sign("sha256", Buffer.from(head + "." + body), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  JWT = head + "." + body + "." + sig; JWT_AT = Date.now();
  return JWT;
}

// one connection per run; send({ token, title, body, url, tag }) -> { ok, dead }
export function apnsClient() {
  let session = null;
  const host = process.env.APNS_SANDBOX === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const open = () => { if (!session || session.closed || session.destroyed) { session = http2.connect(host); session.on("error", () => {}); } return session; };
  function send(n) {
    return new Promise(resolve => {
      const payload = JSON.stringify({ aps: { alert: { title: n.title, body: n.body }, sound: "default", "thread-id": "heytribe" }, url: n.url || "/app/" });
      let req;
      try {
        req = open().request({
          ":method": "POST", ":path": "/3/device/" + n.token,
          authorization: "bearer " + jwt(),
          "apns-topic": process.env.APNS_BUNDLE_ID || "app.heytribe.ios",
          "apns-push-type": "alert", "apns-priority": "10",
          "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600),
          ...(n.tag ? { "apns-collapse-id": crypto.createHash("sha1").update(String(n.tag)).digest("hex") } : {}),
          "content-type": "application/json"
        });
      } catch (e) { return resolve({ ok: false }); }
      let status = 0, data = "";
      const timer = setTimeout(() => { try { req.close(); } catch (e) {} resolve({ ok: false }); }, 10000);
      req.on("response", h => { status = h[":status"]; });
      req.on("data", c => { data += c; });
      req.on("end", () => {
        clearTimeout(timer);
        let reason = ""; try { reason = JSON.parse(data).reason || ""; } catch (e) {}
        resolve({ ok: status === 200, dead: status === 410 || reason === "BadDeviceToken" || reason === "Unregistered", reason });
      });
      req.on("error", () => { clearTimeout(timer); resolve({ ok: false }); });
      req.end(payload);
    });
  }
  return { send, close() { try { session && session.close(); } catch (e) {} } };
}
