// HeyTribe email through Resend. Sent from the 5-minute schedule (api/reminders.js):
// support replies to the customer, a receipt for website messages, new-request alerts to the team,
// and a reminder to parents 2 days before a free trial ends. Each email is sent once (email_log).
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const para = t => esc(t).split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`).join("");

export function layout(title, bodyHtml, cta) {
  return `<!doctype html><html><body style="margin:0;background:#F6F8F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2F3B45">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F6;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E1E6E1;border-radius:20px">
<tr><td style="padding:26px 28px 6px;font-size:19px"><span style="display:inline-block;width:26px;height:22px;border-radius:7px;background:#5E8C7A;vertical-align:-4px;margin-right:8px"></span>hey<b>tribe</b></td></tr>
<tr><td style="padding:12px 28px 6px"><h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.25">${esc(title)}</h1>
<div style="font-size:15.5px;line-height:1.55">${bodyHtml}</div>
${cta ? `<p style="margin:18px 0 6px"><a href="${esc(cta.url)}" style="display:inline-block;background:#2F3B45;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${esc(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:18px 28px 24px;font-size:12.5px;color:#7A848B;border-top:1px solid #EEF1EE">HeyTribe, the calm family planner · <a href="https://www.heytribe.app" style="color:#46705F">heytribe.app</a></td></tr>
</table></td></tr></table></body></html>`;
}

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
  const done = []; let count = 0;
  const go = async (key, msg) => { try { await send(msg); done.push(key); count++; } catch (e) { console.error("email", key, e.message); } };
  const appUrl = "https://www.heytribe.app/app/";

  for (const r of feed.replies || []) {
    const isApp = r.source === "app";
    await go(r.key, {
      to: r.to,
      subject: `Re: ${r.subject} [#${r.number}]`,
      html: layout(`We replied to request #${r.number}`, `${r.name ? `<p style="margin:0 0 14px">Hi ${esc(String(r.name).split(" ")[0])},</p>` : ""}${para(r.body)}<p style="margin:14px 0 0;color:#606A73;font-size:14px">${isApp ? "You can read and answer this in HeyTribe under Family &amp; settings → Help and support." : "Just reply to this email if you have more to add."}</p>`, isApp ? { url: appUrl, label: "Open HeyTribe" } : null),
      text: `${r.body}\n\n${isApp ? "Reply in HeyTribe under Family & settings → Help and support." : "Reply to this email if you have more to add."}`,
      replyTo: isApp ? undefined : (feed.team || [])[0]
    });
  }

  const team = feed.team || [];
  for (const t of feed.new_tickets || []) {
    const ok = [];
    if (team.length) {
      try {
        await send({
          to: team, replyTo: t.email || undefined,
          subject: `New support request #${t.number}: ${t.subject}`,
          html: layout(`New request #${t.number}`, `<p style="margin:0 0 6px"><b>${esc(t.subject)}</b></p><p style="margin:0 0 14px;color:#606A73;font-size:14px">${esc(t.name || "")} ${t.email ? "&lt;" + esc(t.email) + "&gt;" : ""} · ${t.source === "website" ? "from the website" : t.source === "admin" ? "started by the team" : "from the app"}</p>${para(t.body || "")}`, { url: "https://admin.heytribe.app/", label: "Open in admin" }),
          text: `${t.subject}\n${t.email || ""}\n\n${t.body || ""}\n\nhttps://admin.heytribe.app/`
        });
        ok.push(1);
      } catch (e) { console.error("email team", e.message); }
    }
    if (t.source === "website" && t.email) {
      try {
        await send({
          to: t.email, replyTo: team[0],
          subject: `We got your message [#${t.number}]`,
          html: layout("Thanks, we got your message", `<p style="margin:0 0 14px">Hi${t.name ? " " + esc(String(t.name).split(" ")[0]) : ""}, thanks for writing to HeyTribe. Your request number is <b>#${t.number}</b>. We usually answer within one business day.</p><p style="margin:0;color:#606A73;font-size:14px">Your message: “${esc(t.subject)}”</p>`),
          text: `Thanks for writing to HeyTribe. Your request number is #${t.number}. We usually answer within one business day.`
        });
      } catch (e) { console.error("email receipt", e.message); }
    }
    if (ok.length || !team.length) { done.push(t.key); count++; }
  }

  for (const t of feed.trials || []) {
    if (!t.to || !t.to.length) { done.push(t.key); continue; }
    const ends = new Date(t.ends).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });
    await go(t.key, {
      to: t.to,
      subject: `Your HeyTribe Premium trial ends ${ends}`,
      html: layout("Your free trial ends soon", `<p style="margin:0 0 14px">${esc(t.tribe)}'s 7 days of Premium end on <b>${esc(ends)}</b>.</p><p style="margin:0 0 14px">Keep unlimited Hey Tribe notes, the morning briefing, the medicine log and everything else for $4.99 a month, for your whole family. Or do nothing and stay on Free. You keep everything you've added either way.</p>`, { url: appUrl + "#family", label: "Keep Premium" }),
      text: `${t.tribe}'s Premium trial ends on ${ends}. Keep it for $4.99 a month in HeyTribe under Family & settings, or stay on Free. You keep everything you've added.`
    });
  }

  if (done.length) await rpc("email_done", { p_secret: secret, p_keys: done });
  return { emails: count };
}
