// HeyTribe email through Resend. Everything here is sent from the 5-minute schedule (api/reminders.js), once each (email_log).
// The sign-up / password emails are Supabase templates (supabase/templates), built from the same layout.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const para = t => esc(t).split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`).join("");
const P = (h, muted) => `<p style="margin:0 0 14px${muted ? ";color:#606A73;font-size:14px" : ""}">${h}</p>`;
const first = n => esc(String(n || "").trim().split(/[\s@]/)[0]);
const APP = "https://www.heytribe.app/app/";
const fmtDay = d => new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });

const MARK = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle;padding-right:8px"><div style="width:30px;height:26px;border-radius:9px;background:#5E8C7A;text-align:center;line-height:26px;color:#fff;font-size:15px;letter-spacing:1px;font-weight:700">&bull;&bull;&bull;</div></td><td style="vertical-align:middle;font-size:20px;color:#2F3B45">hey<b>tribe</b></td></tr></table>`;

export function layout(title, bodyHtml, cta, opts = {}) {
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#F3F5F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2F3B45">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F1"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">
<tr><td style="padding:0 6px 18px">${MARK}</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E1E6E1;border-radius:22px;padding:32px 30px 28px">
<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.2;color:#2F3B45">${title}</h1>
<div style="font-size:16px;line-height:1.6;color:#2F3B45">${bodyHtml}</div>
${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td style="border-radius:999px;background:#2F3B45"><a href="${cta.url}" style="display:inline-block;padding:14px 26px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15.5px;border-radius:999px">${esc(cta.label)}</a></td></tr></table>` : ""}
${opts.after || ""}
</td></tr>
<tr><td style="padding:18px 8px 0;font-size:12.5px;line-height:1.6;color:#7A848B;text-align:center">${opts.foot || "You're getting this because you use HeyTribe."}<br>HeyTribe, the calm family planner &middot; <a href="https://www.heytribe.app" style="color:#46705F">heytribe.app</a></td></tr>
</table></td></tr></table></body></html>`;
}
const em = (title, body, cta, opts) => ({ html: layout(title, body, cta, opts), title });

// ---------- templates (also used by the preview) ----------
export const T = {
  supportReply: r => ({ subject: `Re: ${r.subject} [#${r.number}]`, ...em(`We replied to request #${r.number}`,
      (r.name ? P(`Hi ${first(r.name)},`) : "") + para(r.body) + P(r.source === "app" ? "You can read and answer this in HeyTribe under Family &amp; settings &rarr; Help and support." : "Just reply to this email if you have more to add.", true),
      r.source === "app" ? { url: APP, label: "Open HeyTribe" } : null, { preheader: String(r.body || "").slice(0, 90) }),
    text: `${r.body}\n\n${r.source === "app" ? "Reply in HeyTribe under Family & settings → Help and support." : "Reply to this email if you have more to add."}` }),
  supportReceipt: t => ({ subject: `We got your message [#${t.number}]`, ...em("Thanks, we got your message",
      P(`Hi${t.name ? " " + first(t.name) : ""}, thanks for writing to HeyTribe. Your request number is <b>#${t.number}</b>, and we usually answer within one business day.`) + P(`Your message: &ldquo;${esc(t.subject)}&rdquo;`, true),
      null, { preheader: `Request #${t.number}. We usually answer within one business day.` }),
    text: `Thanks for writing to HeyTribe. Your request number is #${t.number}. We usually answer within one business day.` }),
  teamAlert: t => ({ subject: `New support request #${t.number}: ${t.subject}`, ...em(`New request #${t.number}`,
      P(`<b>${esc(t.subject)}</b>`) + P(`${esc(t.name || "")} ${t.email ? "&lt;" + esc(t.email) + "&gt;" : ""} &middot; ${t.source === "website" ? "from the website" : t.source === "admin" ? "started by the team" : "from the app"}`, true) + para(t.body || ""),
      { url: "https://admin.heytribe.app/", label: "Open in admin" }, { foot: "Sent to HeyTribe admins." }),
    text: `${t.subject}\n${t.email || ""}\n\n${t.body || ""}\n\nhttps://admin.heytribe.app/` }),
  welcome: w => ({ subject: `${w.tribe} is ready on HeyTribe`, ...em(`Welcome to HeyTribe`,
      P(`<b>${esc(w.tribe)}</b> is set up, and your 7 days of Premium have started. Here's your invite code for the people who help run your house:`) +
      `<div style="margin:6px 0 18px;padding:16px;border-radius:16px;background:#E6EEE9;text-align:center;font-family:Georgia,serif;font-size:34px;letter-spacing:8px;color:#2F3B45">${esc(w.code)}</div>` +
      P("Three things to do first:") +
      `<ol style="margin:0 0 6px;padding-left:20px;line-height:1.7"><li>Add the people in your house, kids included.</li><li>Send your invite code to your partner or family. You approve them when they join.</li><li>Tell Hey Tribe what's coming up this week.</li></ol>`,
      { url: APP, label: "Open HeyTribe" }, { preheader: `Your invite code is ${w.code}.` }),
    text: `${w.tribe} is set up on HeyTribe. Your invite code is ${w.code}. Open the app: ${APP}` }),
  joinRequest: j => ({ subject: `${j.who} wants to join ${j.tribe}`, ...em(`Someone wants to join ${esc(j.tribe)}`,
      P(`<b>${esc(j.who)}</b> used your invite code and is waiting for a parent to say yes.`) + P("Approve them in Family &amp; settings. If you don't know who this is, you can decline.", true),
      { url: APP + "#family", label: "Review request" }, { preheader: "Approve or decline in Family & settings." }),
    text: `${j.who} wants to join ${j.tribe} on HeyTribe. Approve or decline in Family & settings: ${APP}#family` }),
  approved: a => ({ subject: `You're in: ${a.tribe} on HeyTribe`, ...em(`You're in`,
      P(`A parent approved you, so you can now see and add to <b>${esc(a.tribe)}</b>'s plans, lists and chores.`) + P(a.role === "parent" ? "You're set up as a parent, so you can also approve new people and manage the family." : "Changes you make show up for everyone right away.", true),
      { url: APP, label: "Open HeyTribe" }, { preheader: `You can now see ${a.tribe}'s plans.` }),
    text: `You're in. A parent approved you for ${a.tribe} on HeyTribe: ${APP}` }),
  trialEnding: t => ({ subject: `Your HeyTribe Premium trial ends ${fmtDay(t.ends)}`, ...em("Your free trial ends soon",
      P(`${esc(t.tribe)}'s 7 days of Premium end on <b>${esc(fmtDay(t.ends))}</b>.`) +
      P("Keep unlimited Hey Tribe notes, the morning briefing, the medicine log and more for $4.99 a month, for your whole family. Or do nothing and stay on Free. You keep everything you've added either way."),
      { url: APP + "#family", label: "Keep Premium" }, { preheader: "Keep Premium for $4.99 a month, or stay on Free." }),
    text: `${t.tribe}'s Premium trial ends on ${fmtDay(t.ends)}. Keep it for $4.99 a month in Family & settings, or stay on Free.` }),
  premiumStarted: b => ({ subject: `Welcome to HeyTribe Premium`, ...em("Thanks for going Premium",
      P(`<b>${esc(b.tribe)}</b> is on Premium: unlimited Hey Tribe notes, the morning briefing, the medicine log and every limit lifted, for everyone in your family.`) +
      P(`It's $4.99 a month${b.period_end ? `, and your next payment is on ${esc(fmtDay(b.period_end))}` : ""}. Stripe emails your receipt. You can change or cancel anytime under Family &amp; settings &rarr; Manage billing.`, true),
      { url: APP, label: "Open HeyTribe" }, { preheader: "Every limit is lifted for your whole family." }),
    text: `${b.tribe} is on HeyTribe Premium. $4.99 a month. Manage billing in Family & settings.` }),
  paymentProblem: b => ({ subject: `Action needed: your HeyTribe payment didn't go through`, ...em("Your payment didn't go through",
      P(`We couldn't charge the card on file for <b>${esc(b.tribe)}</b>'s Premium plan. Stripe will try again over the next few days.`) +
      P("Update your card under Family &amp; settings &rarr; Manage billing to keep Premium. Nothing you've added will be lost.", true),
      { url: APP + "#family", label: "Update payment" }, { preheader: "Update your card to keep Premium." }),
    text: `We couldn't charge your card for ${b.tribe}'s HeyTribe Premium. Update it in Family & settings → Manage billing.` }),
  premiumCanceled: b => ({ subject: `Your HeyTribe Premium has ended`, ...em("Premium has ended",
      P(`<b>${esc(b.tribe)}</b> is back on Free. Everything you've added is still there, and the whole family can keep using every feature with Free's everyday limits.`) +
      P("Changed your mind? You can restart Premium anytime from Family &amp; settings.", true),
      { url: APP + "#family", label: "Restart Premium" }, { preheader: "You keep everything you've added." }),
    text: `${b.tribe} is back on HeyTribe Free. You keep everything. Restart Premium anytime in Family & settings.` }),
  deletion: d => ({ subject: d.kind === "family" ? `${d.tribe || "Your family"} was deleted from HeyTribe` : "Your HeyTribe account is being deleted", ...em(d.kind === "family" ? "Your family was deleted" : "Your account is being deleted",
      P(d.kind === "family" ? `<b>${esc(d.tribe || "Your family")}</b> was deleted. Everyone lost access right away, and its information will be erased within 30 days.` : "We got your request. You've been signed out, and your account and information will be erased within 30 days.") +
      P("If this wasn't you or you changed your mind, reply to this email right away and we'll stop it.", true),
      null, { foot: "Sent because of a request in HeyTribe." }),
    text: d.kind === "family" ? "Your family was deleted from HeyTribe. Information is erased within 30 days. Reply if this wasn't you." : "Your HeyTribe account is being deleted within 30 days. Reply if this wasn't you." }),
};

// Supabase Auth templates (Go template variables are filled in by Supabase).
export const AUTH = {
  confirm: () => ({ subject: "Confirm your email for HeyTribe", html: layout("Confirm your email", P("Tap the button to confirm your email and finish making your HeyTribe login.") + P("If you didn't sign up, you can ignore this email.", true), { url: "{{ .ConfirmationURL }}", label: "Confirm my email" }, { preheader: "One tap and you're in.", foot: "Sent because someone signed up for HeyTribe with this email." }) }),
  reset: () => ({ subject: "Reset your HeyTribe password", html: layout("Reset your password", P("Someone asked to reset the password for your HeyTribe login. Tap the button to choose a new one. The link works for one hour.") + P("If this wasn't you, ignore this email. Your password stays the same.", true), { url: "{{ .ConfirmationURL }}", label: "Choose a new password" }, { preheader: "This link works for one hour.", foot: "Sent because a password reset was requested." }) }),
  magic: () => ({ subject: "Your HeyTribe login link", html: layout("Your login link", P("Tap the button to log in to HeyTribe. The link works once, for one hour.") + P("If you didn't ask for this, you can ignore it.", true), { url: "{{ .ConfirmationURL }}", label: "Log in to HeyTribe" }, { preheader: "Tap to log in.", foot: "Sent because a login link was requested." }) }),
  change: () => ({ subject: "Confirm your new email for HeyTribe", html: layout("Confirm your new email", P("Tap the button to change the email on your HeyTribe login from <b>{{ .Email }}</b> to <b>{{ .NewEmail }}</b>.") + P("If you didn't ask for this, ignore this email and nothing changes.", true), { url: "{{ .ConfirmationURL }}", label: "Confirm new email" }, { preheader: "Confirm the change to your login email.", foot: "Sent because an email change was requested." }) }),
  invite: () => ({ subject: "You're invited to HeyTribe", html: layout("You're invited to HeyTribe", P("You've been invited to HeyTribe, the calm family planner. Tap the button to make your login.") , { url: "{{ .ConfirmationURL }}", label: "Accept the invite" }, { preheader: "Make your login in a minute.", foot: "Sent because someone invited this email to HeyTribe." }) }),
};

export async function send({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("email not set up");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "HeyTribe <hello@heytribe.app>", to: Array.isArray(to) ? to : [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) })
  });
  if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}

export async function sendQueued(rpc, secret) {
  if (!process.env.RESEND_API_KEY) return { emails: 0, skipped: "not set up" };
  const feed = await rpc("email_feed", { p_secret: secret });
  const team = feed.team || [], reply = team[0], done = []; let count = 0;
  const go = async (key, to, mail, replyTo = reply) => {
    const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
    if (!list.length) { done.push(key); return; }
    try { await send({ to: list, subject: mail.subject, html: mail.html, text: mail.text, replyTo }); done.push(key); count++; }
    catch (e) { console.error("email", key, e.message); }
  };
  for (const r of feed.replies || []) await go(r.key, r.to, T.supportReply(r), r.source === "app" ? undefined : reply);
  for (const t of feed.new_tickets || []) {
    if (t.source === "website" && t.email) { try { await send({ to: [t.email], replyTo: reply, ...T.supportReceipt(t) }); } catch (e) { console.error("receipt", e.message); } }
    await go(t.key, team, T.teamAlert(t), t.email || undefined);
  }
  for (const w of feed.welcomes || []) await go(w.key, w.to, T.welcome(w));
  for (const j of feed.join_requests || []) await go(j.key, j.to, T.joinRequest(j));
  for (const a of feed.approvals || []) await go(a.key, a.to, T.approved(a));
  for (const t of feed.trials || []) await go(t.key, t.to, T.trialEnding(t));
  for (const b of feed.billing || []) await go(b.key, b.to, b.kind === "active" ? T.premiumStarted(b) : b.kind === "past_due" ? T.paymentProblem(b) : T.premiumCanceled(b));
  for (const d of feed.deletions || []) await go(d.key, d.to, T.deletion(d));
  if (done.length) await rpc("email_done", { p_secret: secret, p_keys: done });
  return { emails: count };
}
