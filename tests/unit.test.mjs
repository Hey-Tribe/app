// Unit and contract tests for the server code. Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

process.env.SUPABASE_URL = "https://db.test";
process.env.SUPABASE_ANON_KEY = "anon";

// a fake response object like Vercel's
const resMock = () => { const r = { code: 0, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.send = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; return r; };
const withFetch = async (impl, fn) => { const old = globalThis.fetch; globalThis.fetch = impl; try { return await fn(); } finally { globalThis.fetch = old; } };

/* ---------- reminders: what fires when ---------- */
const { dueFor } = await import("../api/reminders.js");
const sub = { id: "s1", member: "m1", prefs: {} };
const members = [{ col: "members", id: "m1", data: { name: "Leo" } }];
test("a plan reminds 30 minutes before it starts", () => {
  const docs = [...members, { col: "events", id: "e1", data: { title: "Dentist", date: "2026-10-26", start: 600, member: "m1" } }];
  assert.equal(dueFor(sub, docs, { day: "2026-10-26", min: 570 }).length, 1);
  assert.equal(dueFor(sub, docs, { day: "2026-10-26", min: 560 }).length, 0, "too early");
  assert.equal(dueFor(sub, docs, { day: "2026-10-27", min: 570 }).length, 0, "other day");
});
test("weekly plans repeat on the same weekday only", () => {
  const docs = [...members, { col: "events", id: "e2", data: { title: "Soccer", date: "2026-10-05", start: 1020, member: "all", repeat: "weekly" } }];
  assert.equal(dueFor(sub, docs, { day: "2026-10-26", min: 990 }).length, 1, "Monday 3 weeks later");
  assert.equal(dueFor(sub, docs, { day: "2026-10-27", min: 990 }).length, 0, "Tuesday");
});
test("skipped dates and switched-off reminder types don't fire", () => {
  const docs = [...members, { col: "events", id: "e3", data: { title: "Swim", date: "2026-10-05", start: 600, member: "all", repeat: "weekly", skip: { "2026-10-26": true } } }];
  assert.equal(dueFor(sub, docs, { day: "2026-10-26", min: 570 }).length, 0);
  const docs2 = [...members, { col: "events", id: "e4", data: { title: "Swim", date: "2026-10-26", start: 600, member: "all" } }];
  assert.equal(dueFor({ ...sub, prefs: { plans: false } }, docs2, { day: "2026-10-26", min: 570 }).length, 0);
});
test("medicine fires at dose time unless already given", () => {
  const med = { col: "meds", id: "d1", data: { name: "Amoxicillin", member: "m1", times: ["08:00"] } };
  assert.equal(dueFor(sub, [...members, med], { day: "2026-10-26", min: 480 }).length, 1);
  const given = { ...med, data: { ...med.data, log: { "2026-10-26": { "08:00": "m2" } } } };
  assert.equal(dueFor(sub, [...members, given], { day: "2026-10-26", min: 480 }).length, 0);
});
test("bills remind 3 days before and on the due day, not when paid", () => {
  const bill = { col: "home", id: "b1", data: { kind: "bill", name: "Electric", dueDay: 29, amount: 142 } };
  assert.equal(dueFor(sub, [bill], { day: "2026-10-26", min: 540 }).length, 1, "3 days before");
  assert.equal(dueFor(sub, [bill], { day: "2026-10-29", min: 540 }).length, 1, "due day");
  const paid = { ...bill, data: { ...bill.data, paid: { "2026-10": true } } };
  assert.equal(dueFor(sub, [paid], { day: "2026-10-29", min: 540 }).length, 0);
});
test("each reminder has a stable key so it is sent once", () => {
  const docs = [...members, { col: "events", id: "e1", data: { title: "Dentist", date: "2026-10-26", start: 600, member: "m1" } }];
  const a = dueFor(sub, docs, { day: "2026-10-26", min: 570 })[0].key, b = dueFor(sub, docs, { day: "2026-10-26", min: 575 })[0].key;
  assert.equal(a, b);
});

/* ---------- Apple signed purchases ---------- */
const { verifyJws, txStatus } = await import("../api/_apple.js");
function fakeChain() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "ht-jws-")), sh = (...a) => execFileSync("openssl", a, { cwd: d, stdio: "pipe" });
  sh("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "root.key");
  sh("req", "-x509", "-new", "-key", "root.key", "-subj", "/CN=Test Root", "-days", "2", "-out", "root.pem", "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign");
  for (const [n, issuer, ext] of [["mid", "root", "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign\n1.2.840.113635.100.6.2.1=ASN1:NULL\n"], ["leaf", "mid", "1.2.840.113635.100.6.11.1=ASN1:NULL\n"]]) {
    sh("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", n + ".key");
    sh("req", "-new", "-key", n + ".key", "-subj", "/CN=" + n, "-out", n + ".csr");
    fs.writeFileSync(path.join(d, n + ".ext"), ext);
    sh("x509", "-req", "-in", n + ".csr", "-CA", issuer + ".pem", "-CAkey", issuer + ".key", "-CAcreateserial", "-days", "2", "-extfile", n + ".ext", "-out", n + ".pem");
  }
  const der = f => fs.readFileSync(path.join(d, f), "utf8").replace(/-----[^-]+-----|\s/g, "");
  const u = b => Buffer.from(b).toString("base64url");
  const sign = (payload, key = "leaf.key", chain = [der("leaf.pem"), der("mid.pem"), der("root.pem")]) => {
    const h = u(JSON.stringify({ alg: "ES256", x5c: chain })), p = u(JSON.stringify(payload));
    return h + "." + p + "." + u(crypto.sign("sha256", Buffer.from(h + "." + p), { key: fs.readFileSync(path.join(d, key)), dsaEncoding: "ieee-p1363" }));
  };
  return { root: der("root.pem"), sign, der };
}
const C = fakeChain();
const tx = { bundleId: "app.heytribe.ios", productId: "app.heytribe.premium.monthly", originalTransactionId: "1000", expiresDate: Date.now() + 864e5 };
test("a correctly signed App Store transaction is accepted", () => { assert.equal(verifyJws(C.sign(tx), C.root).originalTransactionId, "1000"); });
test("anything not chained to the real Apple root is rejected", () => { assert.throws(() => verifyJws(C.sign(tx)), /untrusted root/); });
test("a changed payload is rejected", () => {
  const p = C.sign(tx).split("."); p[1] = Buffer.from(JSON.stringify({ ...tx, expiresDate: 9e15 })).toString("base64url");
  assert.throws(() => verifyJws(p.join("."), C.root), /bad signature/);
});
test("a chain without Apple's marker extensions is rejected", () => {
  assert.throws(() => verifyJws(C.sign(tx, "leaf.key", [C.der("leaf.pem"), C.der("leaf.pem"), C.der("root.pem")]), C.root));
});
test("refunded or expired purchases don't give Premium", () => {
  assert.equal(txStatus(tx), "active");
  assert.equal(txStatus({ ...tx, revocationDate: Date.now() }), "canceled");
  assert.equal(txStatus({ ...tx, expiresDate: Date.now() - 1 }), "canceled");
});

/* ---------- API contracts ---------- */
test("Hey Tribe AI needs a login and a family, and respects the free limit", async () => {
  process.env.ANTHROPIC_API_KEY = "x";
  const { default: h } = await import("../api/heytribe.js");
  let r = resMock(); await h({ method: "POST", headers: {}, body: { text: "hi" } }, r); assert.equal(r.code, 401);
  await withFetch(async url => String(url).includes("/auth/v1/user") ? new Response(JSON.stringify({ id: "u" }), { status: 200 }) : new Response("false", { status: 200 }), async () => {
    r = resMock(); await h({ method: "POST", headers: { authorization: "Bearer t" }, body: { text: "hi", ctx: {} } }, r); assert.equal(r.code, 400, "no family");
    r = resMock(); await h({ method: "POST", headers: { authorization: "Bearer t" }, body: { text: "hi", ctx: { code: "ABC123" } } }, r); assert.equal(r.code, 402, "over the limit");
  });
  delete process.env.ANTHROPIC_API_KEY;
});
test("billing reports whether checkout and the yearly plan are on", async () => {
  const { default: h } = await import("../api/billing.js");
  let r = resMock(); await h({ method: "GET", headers: {} }, r); assert.deepEqual(r.body, { enabled: false, yearly: false });
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_ID: "p", STRIPE_PRICE_ID_YEARLY: "py" });
  r = resMock(); await h({ method: "GET", headers: {} }, r); assert.deepEqual(r.body, { enabled: true, yearly: true });
  r = resMock(); await h({ method: "POST", headers: {}, body: { action: "checkout", code: "ABC123" } }, r); assert.equal(r.code, 400, "no login");
  for (const k of ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_PRICE_ID_YEARLY"]) delete process.env[k];
});
test("Apple purchase check rejects bad input before touching the database", async () => {
  process.env.BILLING_SYNC_SECRET = "s";
  const { default: h } = await import("../api/apple-verify.js");
  let calls = 0;
  await withFetch(async () => { calls++; return new Response("{}", { status: 200 }); }, async () => {
    let r = resMock(); await h({ method: "POST", headers: {}, body: { jws: "a.b.c", code: "ABC123" } }, r); assert.equal(r.code, 400);
    r = resMock(); await h({ method: "POST", headers: { authorization: "Bearer t" }, body: { jws: "a.b.c", code: "ABC123" } }, r); assert.equal(r.code, 400);
  });
  assert.equal(calls, 0);
  delete process.env.BILLING_SYNC_SECRET;
});
test("Stripe webhook refuses unsigned events", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"; process.env.BILLING_SYNC_SECRET = "s";
  const { POST } = await import("../api/stripe-webhook.js");
  const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: "ABC123" } } });
  let r = await POST(new Request("https://x/api/stripe-webhook", { method: "POST", body, headers: { "stripe-signature": "t=1,v1=bad" } }));
  assert.equal(r.status, 400);
  const t = Math.floor(Date.now() / 1000), sig = crypto.createHmac("sha256", "whsec_test").update(`${t}.${body}`).digest("hex");
  let synced = null;
  await withFetch(async (url, o) => { synced = JSON.parse(o.body); return new Response("true", { status: 200 }); }, async () => {
    r = await POST(new Request("https://x/api/stripe-webhook", { method: "POST", body, headers: { "stripe-signature": `t=${t},v1=${sig}` } }));
  });
  assert.equal(r.status, 200); assert.equal(synced.p_code, "ABC123"); assert.equal(synced.p_status, "active");
  const old = t - 600, sig2 = crypto.createHmac("sha256", "whsec_test").update(`${old}.${body}`).digest("hex");
  r = await POST(new Request("https://x/api/stripe-webhook", { method: "POST", body, headers: { "stripe-signature": `t=${old},v1=${sig2}` } }));
  assert.equal(r.status, 400, "replayed old event");
});
test("calendar feed builds a valid iCalendar file", async () => {
  const { default: h } = await import("../api/calendar.js");
  const feed = { tribe: "Rivera", members: [{ id: "m1", name: "Leo" }], events: [{ id: "e1", title: "Soccer, practice", date: "2026-10-26", start: 1020, end: 1080, member: "m1", repeat: "weekly" }], countdowns: [], trips: [] };
  const r = resMock();
  await withFetch(async () => new Response(JSON.stringify(feed), { status: 200 }), () => h({ query: { t: "abc" }, headers: {} }, r));
  const ics = String(r.body);
  assert.match(ics, /^BEGIN:VCALENDAR/); assert.match(ics, /RRULE:FREQ=WEEKLY/); assert.match(ics, /Soccer\\, practice/); assert.match(ics, /END:VCALENDAR\s*$/);
});
test("health check reports database status without leaking values", async () => {
  process.env.RESEND_API_KEY = "re_secret_value";
  const { default: h } = await import("../api/health.js");
  const r = resMock();
  await withFetch(async () => new Response("[]", { status: 200 }), () => h({}, r));
  assert.equal(r.code, 200); assert.equal(r.body.configured.email, true);
  assert.ok(!JSON.stringify(r.body).includes("re_secret_value"));
  delete process.env.RESEND_API_KEY;
});

/* ---------- Android push ---------- */
test("Android reminders go to Firebase with the right token and mark dead tokens", async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.FCM_SERVICE_ACCOUNT = JSON.stringify({ project_id: "heytribe-test", client_email: "push@heytribe-test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth2.googleapis.com/token" });
  const { fcmSend } = await import("../api/_fcm.js");
  const sent = [];
  let r = await withFetch(async (url, o) => {
    if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 });
    sent.push({ url: String(url), body: JSON.parse(o.body), auth: o.headers.authorization });
    return new Response("{}", { status: 200 });
  }, () => fcmSend({ token: "tok123", title: "Dentist at 10am", body: "Leo", url: "/app/#calendar", tag: "k1" }));
  assert.equal(r.ok, true);
  assert.match(sent[0].url, /projects\/heytribe-test\/messages:send$/);
  assert.equal(sent[0].auth, "Bearer at");
  assert.equal(sent[0].body.message.token, "tok123");
  assert.equal(sent[0].body.message.android.notification.channel_id, "reminders");
  r = await withFetch(async (url) => String(url).includes("oauth2") ? new Response(JSON.stringify({ access_token: "at" }), { status: 200 }) : new Response(JSON.stringify({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 }),
    () => fcmSend({ token: "old", title: "t", body: "b" }));
  assert.deepEqual(r, { ok: false, dead: true });
  delete process.env.FCM_SERVICE_ACCOUNT;
});

/* ---------- uptime alerts: only email for a real, fresh outage ---------- */
const { default: uptimeAlert } = await import("../api/uptime-alert.js");
test("uptime alert ignores calls without a fresh outage issue", async () => {
  process.env.RESEND_API_KEY = "re_test";
  const sentMail = [];
  const old = new Date(Date.now() - 3600e3).toISOString();
  await withFetch(async (url, opt) => {
    url = String(url);
    if (url.includes("api.github.com")) return new Response(JSON.stringify([{ number: 1, state: "open", created_at: old, html_url: "x" }]), { status: 200 });
    if (url.includes("resend.com")) { sentMail.push(opt); return new Response("{}", { status: 200 }); }
    return new Response("down", { status: 500 });
  }, async () => {
    const r = resMock(); await uptimeAlert({ method: "POST", body: { state: "down" } }, r);
    assert.equal(r.body.emailed, false); assert.equal(sentMail.length, 0);
  });
  delete process.env.RESEND_API_KEY;
});
test("uptime alert emails when a fresh outage is confirmed from the server", async () => {
  process.env.RESEND_API_KEY = "re_test";
  const sentMail = [];
  await withFetch(async (url, opt) => {
    url = String(url);
    if (url.includes("api.github.com")) return new Response(JSON.stringify([{ number: 2, state: "open", created_at: new Date().toISOString(), html_url: "https://github.com/x" }]), { status: 200 });
    if (url.includes("resend.com")) { sentMail.push(JSON.parse(opt.body)); return new Response("{}", { status: 200 }); }
    return new Response("down", { status: 500 });
  }, async () => {
    const r = resMock(); await uptimeAlert({ method: "POST", body: { state: "down" } }, r);
    assert.equal(r.body.emailed, true); assert.equal(sentMail.length, 1);
    assert.match(sentMail[0].subject, /^HeyTribe is down/);
    const again = resMock(); await uptimeAlert({ method: "POST", body: { state: "down" } }, again);
    assert.equal(again.body.emailed, false, "one email per outage");
  });
  delete process.env.RESEND_API_KEY;
});
