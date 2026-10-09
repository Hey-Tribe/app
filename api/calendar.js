// Family calendar feed (iCalendar) for Google, Apple and Outlook. /api/calendar?t=<private token>
// Times are "floating" (no time zone), so each phone shows them in its own local time, like the app does.
const pad = n => String(n).padStart(2, "0");
const d8 = s => String(s || "").replace(/-/g, "");
const addDay = (s, n) => { const [y, m, d] = s.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.getUTCFullYear() + pad(x.getUTCMonth() + 1) + pad(x.getUTCDate()); };
const hm = m => pad(Math.floor((+m || 0) / 60)) + pad((+m || 0) % 60) + "00";
const txt = s => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const fold = line => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); } out.push(s); return out.join("\r\n"); };
const RR = { weekly: "FREQ=WEEKLY", biweekly: "FREQ=WEEKLY;INTERVAL=2", monthly: "FREQ=MONTHLY", yearly: "FREQ=YEARLY" };

export default async function handler(req, res) {
  const t = String(req.query.t || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 80);
  if (!t) return res.status(400).send("Missing link");
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/calendar_feed`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ p_token: t })
  }).catch(() => null);
  const feed = r && r.ok ? await r.json() : null;
  if (!feed) return res.status(404).send("This calendar link isn't active anymore.");
  const names = Object.fromEntries((feed.members || []).map(m => [m.id, m.name]));
  const now = new Date(), stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + "T" + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + "00Z";
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HeyTribe//Family calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + txt((feed.tribe || "Family") + " · HeyTribe"), "X-PUBLISHED-TTL:PT3H", "REFRESH-INTERVAL;VALUE=DURATION:PT3H"];
  const ev = (uid, lines) => { L.push("BEGIN:VEVENT", "UID:" + uid + "@heytribe.app", "DTSTAMP:" + stamp, ...lines, "END:VEVENT"); };
  for (const e of feed.events || []) {
    if (!e.date || !e.title) continue;
    const who = e.member === "all" ? "Everyone" : names[e.member];
    const desc = [who && "Who: " + who, e.driver && names[e.driver] && "Driving: " + names[e.driver], e.note].filter(Boolean).join("\n");
    const lines = ["SUMMARY:" + txt(e.title + (who && e.member !== "all" ? " (" + who + ")" : ""))];
    if (e.allDay) { lines.push("DTSTART;VALUE=DATE:" + d8(e.date), "DTEND;VALUE=DATE:" + addDay(e.endDate && e.endDate > e.date ? e.endDate : e.date, 1)); }
    else { lines.push("DTSTART:" + d8(e.date) + "T" + hm(e.start), "DTEND:" + d8(e.date) + "T" + hm(Math.max(+e.end || 0, (+e.start || 0) + 15))); }
    if (e.repeat && RR[e.repeat]) lines.push("RRULE:" + RR[e.repeat] + (e.until ? ";UNTIL=" + d8(e.until) + (e.allDay ? "" : "T235959") : ""));
    const skips = Object.keys(e.skip || {}).filter(k => e.skip[k]);
    if (skips.length) lines.push(e.allDay ? "EXDATE;VALUE=DATE:" + skips.map(d8).join(",") : "EXDATE:" + skips.map(k => d8(k) + "T" + hm(e.start)).join(","));
    if (e.place) lines.push("LOCATION:" + txt(e.place));
    if (desc) lines.push("DESCRIPTION:" + txt(desc));
    ev("e-" + e.id, lines);
  }
  for (const c of feed.countdowns || []) {
    if (!c.date || !c.title) continue;
    ev("c-" + c.id, ["SUMMARY:" + txt(c.title), "DTSTART;VALUE=DATE:" + d8(c.date), "DTEND;VALUE=DATE:" + addDay(c.date, 1), ...(c.yearly ? ["RRULE:FREQ=YEARLY"] : []), "TRANSP:TRANSPARENT"]);
  }
  for (const tr of feed.trips || []) {
    if (!tr.start || !tr.name) continue;
    ev("t-" + tr.id, ["SUMMARY:" + txt("Trip: " + tr.name), "DTSTART;VALUE=DATE:" + d8(tr.start), "DTEND;VALUE=DATE:" + addDay(tr.end && tr.end >= tr.start ? tr.end : tr.start, 1), ...(tr.where ? ["LOCATION:" + txt(tr.where)] : []), "TRANSP:TRANSPARENT"]);
  }
  L.push("END:VCALENDAR");
  res.setHeader("content-type", "text/calendar; charset=utf-8");
  res.setHeader("content-disposition", 'inline; filename="heytribe.ics"');
  res.setHeader("cache-control", "public, max-age=900");
  res.status(200).send(L.map(fold).join("\r\n") + "\r\n");
}
