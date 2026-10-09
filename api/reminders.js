// Phone reminders (web push). Called every 5 minutes by a schedule in Supabase (pg_cron) with the cron secret.
// Sends: plans 30 min before (all-day plans at 7:30am), medicine at dose time, bills on the due day and 3 days before (9am),
// school forms the evening before they're due (6pm), and countdowns on the big day (8am). Each reminder is sent once.
import webpush from "web-push";

const pad = n => String(n).padStart(2, "0");
function localNow(tz) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
  } catch (e) { return localNow("America/New_York"); }
}
const fromYmd = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(Date.UTC(y, (m || 1) - 1, d || 1)); };
const ymd = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = fromYmd(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const dow = s => (fromYmd(s).getUTCDay() + 6) % 7;
const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
function occursOn(e, day) {
  if (e.skip && e.skip[day]) return false;
  if (e.date === day) return true;
  if (e.endDate && e.date < day && day <= e.endDate) return true;
  if (!e.repeat || !e.date || e.date > day || (e.until && e.until < day)) return false;
  const a = fromYmd(e.date), b = fromYmd(day);
  if (e.repeat === "weekly") return dow(e.date) === dow(day);
  if (e.repeat === "biweekly") return dow(e.date) === dow(day) && Math.round((b - a) / 864e5 / 7) % 2 === 0;
  if (e.repeat === "monthly") return b.getUTCDate() === Math.min(a.getUTCDate(), daysIn(b.getUTCFullYear(), b.getUTCMonth()));
  if (e.repeat === "yearly") return a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
  return false;
}
const fmtT = m => { let h = Math.floor(m / 60), mm = m % 60; const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return h + (mm ? ":" + pad(mm) : "") + ap; };
const hm = s => { const [h, m] = String(s || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };

async function rpc(name, body) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(name + " " + r.status);
  return r.status === 204 ? null : r.json();
}

// what should fire for one subscription right now (trigger time within the last 10 minutes)
export function dueFor(sub, docs, now) {
  const out = [], pref = sub.prefs || {}, names = {}, { day, min } = now;
  docs.filter(d => d.col === "members").forEach(d => { names[d.id] = d.data.name; });
  const fire = (key, at, title, body, url) => { if (at <= min && at > min - 10) out.push({ key: `${sub.id}|${key}`, title, body, url }); };
  const mine = e => !sub.member || e.member === "all" || e.member === sub.member || e.driver === sub.member;
  if (pref.plans !== false) for (const d of docs.filter(x => x.col === "events")) {
    const e = d.data; if (!e.title || !occursOn(e, day) || !mine(e)) continue;
    if (e.allDay) fire(`ev|${d.id}|${day}`, 450, "Today: " + e.title, e.member && e.member !== "all" && names[e.member] ? names[e.member] : "Everyone", "/app/#today");
    else fire(`ev|${d.id}|${day}`, (+e.start || 0) - 30, `${e.title} at ${fmtT(+e.start || 0)}`, [e.member === "all" ? "Everyone" : names[e.member], e.driver && names[e.driver] ? names[e.driver] + " drives" : "", e.place].filter(Boolean).join(" · ") || "In 30 minutes", "/app/#calendar");
  }
  if (pref.meds !== false) for (const d of docs.filter(x => x.col === "meds")) {
    const m = d.data; if ((m.start && m.start > day) || (m.until && m.until < day)) continue;
    for (const t of m.times || []) { if (m.log && m.log[day] && m.log[day][t]) continue; fire(`med|${d.id}|${day}|${t}`, hm(t), `Time for ${names[m.member] ? names[m.member] + "'s " : ""}${m.name}`, [m.dose, m.note].filter(Boolean).join(" · ") || "Tap to mark it given", "/app/#health"); }
  }
  if (pref.bills !== false) for (const d of docs.filter(x => x.col === "home" && x.data.kind === "bill" && !x.data.autopay)) {
    const b = d.data, t = fromYmd(day), y = t.getUTCFullYear(), mo = t.getUTCMonth();
    const due = `${y}-${pad(mo + 1)}-${pad(Math.min(Math.max(1, +b.dueDay || 1), daysIn(y, mo)))}`, mk = due.slice(0, 7);
    if (b.paid && b.paid[mk]) continue;
    const amt = b.amount ? ` ($${b.amount})` : "";
    if (day === due) fire(`bill|${d.id}|${mk}|0`, 540, `${b.name}${amt} is due today`, "Tap to mark it paid", "/app/#home");
    if (day === addDays(due, -3)) fire(`bill|${d.id}|${mk}|3`, 540, `${b.name}${amt} is due in 3 days`, "Heads up from HeyTribe", "/app/#home");
  }
  if (pref.school !== false) for (const d of docs.filter(x => x.col === "school" && x.data.kind === "slip" && !x.data.done && x.data.due)) {
    if (addDays(d.data.due, -1) === day) fire(`slip|${d.id}|${d.data.due}`, 1080, `Sign “${d.data.title}” tonight`, "It's due tomorrow", "/app/#school");
  }
  if (pref.countdowns !== false) for (const d of docs.filter(x => x.col === "countdowns")) {
    const c = d.data; if (!c.date) continue;
    const hit = c.yearly ? c.date.slice(5) === day.slice(5) : c.date === day;
    if (hit) fire(`cd|${d.id}|${day}`, 480, `Today's the day: ${c.title}!`, "From your family on HeyTribe", "/app/#today");
  }
  return out;
}

export default async function handler(req, res) {
  const secret = req.headers["x-cron-secret"] || req.query.key;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return res.status(401).json({ error: "no" });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return res.status(501).json({ error: "push not set up" });
  webpush.setVapidDetails("mailto:hello@heytribe.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const feed = await rpc("reminder_feed", { p_secret: process.env.CRON_SECRET });
  const sent = new Set(feed.sent || []), byTribe = {};
  (feed.docs || []).forEach(d => { (byTribe[d.tribe] = byTribe[d.tribe] || []).push(d); });
  const keys = [], dead = []; let count = 0;
  await Promise.all((feed.subs || []).map(async sub => {
    const due = dueFor(sub, byTribe[sub.tribe] || [], localNow(sub.tz)).filter(x => !sent.has(x.key));
    for (const n of due) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.key }), { TTL: 3600 });
        keys.push(n.key); count++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { dead.push(sub.endpoint); break; }
      }
    }
  }));
  if (keys.length || dead.length) await rpc("reminder_done", { p_secret: process.env.CRON_SECRET, p_keys: keys, p_dead: dead });
  res.status(200).json({ ok: true, sent: count, subs: (feed.subs || []).length });
}
