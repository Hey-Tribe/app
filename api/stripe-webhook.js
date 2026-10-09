// Stripe webhook: keeps public.subscriptions in sync with Stripe.
// Point a Stripe webhook at https://www.heytribe.app/api/stripe-webhook with these events:
//   checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted
// Needs: STRIPE_WEBHOOK_SECRET (whsec_...), BILLING_SYNC_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY.
import crypto from "node:crypto";

function verify(raw, header, secret) {
  const parts = Object.fromEntries(String(header || "").split(",").map(x => x.split("=")).filter(x => x.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = String(header || "").split(",").filter(x => x.startsWith("v1=")).map(x => x.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const want = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return sigs.some(s => s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)));
}

const STATUS = { active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due", incomplete: "past_due", canceled: "canceled", incomplete_expired: "canceled", paused: "canceled" };

async function sync(code, status, customer, subscription, periodEnd) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/billing_sync`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ p_secret: process.env.BILLING_SYNC_SECRET, p_code: code, p_status: status, p_customer: customer || null, p_subscription: subscription || null, p_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null })
  });
  if (!r.ok) throw new Error("sync failed " + r.status);
}

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.BILLING_SYNC_SECRET) return new Response("Billing not set up", { status: 501 });
  const raw = await request.text();
  if (!verify(raw, request.headers.get("stripe-signature"), secret)) return new Response("Bad signature", { status: 400 });
  let ev; try { ev = JSON.parse(raw); } catch (e) { return new Response("Bad JSON", { status: 400 }); }
  const o = (ev.data && ev.data.object) || {};
  try {
    if (ev.type === "checkout.session.completed" && o.mode === "subscription") {
      const code = o.client_reference_id || (o.metadata && o.metadata.tribe_code);
      if (code) await sync(code, "active", o.customer, o.subscription, null);
    } else if (/^customer\.subscription\.(created|updated|deleted)$/.test(ev.type)) {
      const code = o.metadata && o.metadata.tribe_code;
      const status = ev.type.endsWith("deleted") ? "canceled" : (STATUS[o.status] || "past_due");
      const item = o.items && o.items.data && o.items.data[0];
      const end = o.status === "trialing" ? o.trial_end : (o.current_period_end || (item && item.current_period_end));
      if (code) await sync(code, status, o.customer, o.id, end);
    }
  } catch (e) {
    return new Response("Try again", { status: 500 }); // Stripe retries
  }
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
}
