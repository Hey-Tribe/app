import { watch } from "../../lib/api/_watch.js";
// Health check for uptime monitoring: GET /api/health -> 200 when the database answers, 503 when it doesn't.
// Shows which services are configured (true/false only, never values).
import { sbHeaders } from "../../lib/api/_sb.js";
async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  // Test hook for Sentry: GET /api/health?sentry-test=1 with the x-cron-secret header throws one deliberate error.
  if (req.query && req.query["sentry-test"] === "1" && process.env.CRON_SECRET && req.headers && req.headers["x-cron-secret"] === process.env.CRON_SECRET) {
    throw new Error("HeyTribe server Sentry test error (deliberate)");
  }
  const t0 = Date.now();
  let db = false;
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/tribes?select=code&code=eq.SAMPLE`, {
      headers: { ...sbHeaders() },
      signal: AbortSignal.timeout(5000)
    });
    db = r.ok;
  } catch (e) { db = false; }
  const on = k => !!process.env[k];
  res.status(db ? 200 : 503).json({
    ok: db, database: db, ms: Date.now() - t0,
    configured: {
      email: on("RESEND_API_KEY"), web_push: on("VAPID_PRIVATE_KEY"), apple_push: on("APNS_KEY_P8"), android_push: on("FCM_SERVICE_ACCOUNT"),
      stripe: on("STRIPE_SECRET_KEY") && on("STRIPE_PRICE_ID"), stripe_yearly: on("STRIPE_PRICE_ID_YEARLY"),
      billing_sync: on("BILLING_SYNC_SECRET"), ai: on("ANTHROPIC_API_KEY"), cron: on("CRON_SECRET"), apple_team: on("APPLE_TEAM_ID"), apple_signin: on("APPLE_SIGNIN_KEY_P8") && on("APPLE_SIGNIN_KEY_ID")
    }
  });
}

export default watch(handler);
