// Outage emails for the GitHub "Uptime" monitor, sent with the Resend key already in Vercel (no extra secret).
// POST {"state":"down"} or {"state":"up"}. Nothing in the request is trusted:
//  - "down" emails only if the newest GitHub issue labeled "outage" is open and under 15 minutes old,
//    AND this server's own checks also find something down.
//  - "up" emails only if the newest outage issue was closed in the last 15 minutes AND every check passes.
// Each outage issue gets at most one email of each kind per server instance.
// If Vercel itself is down this can't run; the GitHub issue (emailed by GitHub to repo watchers) still covers that.
import { send, layout } from "./_email.js";
import { checks, check } from "./_uptime.js";

export const config = { maxDuration: 60 };
const REPO = "Hey-Tribe/app";
const TO = () => (process.env.ALERT_EMAIL || "admin@kopimorehospitalitygroup.com,admin@kopimore.com").split(",").map(s => s.trim()).filter(Boolean);
const sent = new Set();
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const state = (req.body || {}).state === "up" ? "up" : "down";
  if (!process.env.RESEND_API_KEY) return res.status(200).json({ emailed: false, why: "email not set up" });

  let issue = null;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/issues?labels=outage&state=all&sort=created&direction=desc&per_page=1`,
      { headers: { accept: "application/vnd.github+json", "user-agent": "HeyTribe-uptime" }, signal: AbortSignal.timeout(8000) });
    issue = r.ok ? (await r.json())[0] : null;
  } catch (e) {}
  if (!issue || issue.pull_request) return res.status(200).json({ emailed: false, why: "no outage issue" });
  const fresh = t => t && Date.now() - new Date(t).getTime() < 15 * 60 * 1000;
  const key = `${state}:${issue.number}`;
  if (sent.has(key)) return res.status(200).json({ emailed: false, why: "already sent" });
  if (state === "down" && !(issue.state === "open" && fresh(issue.created_at))) return res.status(200).json({ emailed: false, why: "no new outage" });
  if (state === "up" && !(issue.state === "closed" && fresh(issue.closed_at))) return res.status(200).json({ emailed: false, why: "no recent recovery" });

  const results = await Promise.all(checks().map(c => check(c, 0)));
  const down = results.filter(r => !r.ok);
  if (state === "down" && !down.length) return res.status(200).json({ emailed: false, why: "everything answers from here" });
  if (state === "up" && down.length) return res.status(200).json({ emailed: false, why: "still down from here" });

  const lines = state === "down" ? down.map(r => `${r.name}: ${r.why}`) : results.map(r => `${r.name}: up (${r.ms} ms)`);
  const subject = state === "down" ? `HeyTribe is down: ${down.map(r => r.name).join(", ")}` : "HeyTribe is back up";
  const title = state === "down" ? "Something is down" : "Everything is back up";
  const body = `<p style="margin:0 0 14px">${state === "down" ? "The uptime monitor found a problem, and a second check from the server confirmed it:" : "Every check passed again:"}</p>`
    + `<ul style="margin:0 0 14px;padding-left:20px">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`
    + (state === "down" ? `<p style="margin:0 0 14px;color:#606A73;font-size:14px">First checks: Vercel status, Supabase status, and the latest deploy. Rollback steps are in docs/OPERATIONS.md section 5.</p>` : "");
  try {
    await send({ to: TO(), subject, html: layout(title, body, { url: issue.html_url, label: "Open the outage issue" }, { foot: "Sent to HeyTribe admins by the uptime monitor." }), text: `${lines.join("\n")}\n\n${issue.html_url}` });
    sent.add(key);
    return res.status(200).json({ emailed: true });
  } catch (e) {
    console.error("uptime-alert", e.message);
    return res.status(502).json({ emailed: false, why: "email failed" });
  }
}
