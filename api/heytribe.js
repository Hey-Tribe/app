// Hey Tribe: turns a quick note ("Dentist for Leo Tuesday at 3, Maria drives") into app actions.
// Needs ANTHROPIC_API_KEY. Without it the app quietly uses its built-in parser instead.
// Only signed-in HeyTribe users can call it, and the prompt is built here, not by the browser.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

async function signedInUser(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, authorization: auth }
  });
  return r.ok ? r.json() : null;
}

const clip = (v, n) => String(v ?? "").slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(501).json({ error: "Hey Tribe AI is not set up" });
  const user = await signedInUser(req).catch(() => null);
  if (!user) return res.status(401).json({ error: "Sign in first" });

  const { text, ctx = {} } = req.body || {};
  const note = clip(text, 600).replace(/"""/g, "'");
  if (!note.trim()) return res.status(400).json({ error: "Empty note" });
  const members = (Array.isArray(ctx.members) ? ctx.members : []).slice(0, 20).map(m => `${clip(m.id, 60)}: ${clip(m.name, 30)}`).join(", ");
  const lists = (Array.isArray(ctx.lists) ? ctx.lists : []).slice(0, 12).map(l => clip(l, 30)).join(", ");

  const prompt = `You turn a family member's quick note into actions for a family planner app.
Today is ${clip(ctx.dow, 12)} ${clip(ctx.today, 10)}, current time ${clip(ctx.time, 5)}. The person writing is ${clip(ctx.me, 30)}.
Family members (id: name): ${members}.
Shopping lists: ${lists}.
Reply with only JSON: {"actions":[...]} where each action is one of:
{"type":"event","title":string,"member":member id or "all","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","driver":member id or null,"repeat":"weekly" or null}
{"type":"item","text":string,"list":one of the list names}
{"type":"chore","title":string,"member":member id,"days":[weekday numbers, Monday=0]}
{"type":"note","text":string}
Use 1 hour when no end time is given. "Next Tuesday" means the coming Tuesday. "Every Saturday" means repeat weekly starting the coming Saturday. Keep titles short and capitalized. Split several shopping items into separate item actions.
Note: """${note}"""`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: "user", content: prompt }] })
    });
    if (!r.ok) return res.status(502).json({ error: "AI request failed" });
    const out = await r.json();
    const raw = (out.content || []).map(c => c.text || "").join("");
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return res.status(200).json({ actions: Array.isArray(json.actions) ? json.actions.slice(0, 20) : [] });
  } catch (e) {
    return res.status(502).json({ error: "Couldn't understand that" });
  }
}
