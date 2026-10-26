// Uptime check for every public HeyTribe surface. Used by .github/workflows/uptime.yml every 5 minutes.
// Each check gets two tries 20 seconds apart, so one slow response doesn't raise an alarm.
// Prints one line per check and writes failures to $GITHUB_OUTPUT (down=..., report=...). Exit code 1 if anything is down.
import { appendFileSync } from "node:fs";

const SITE = process.env.UPTIME_SITE || "https://www.heytribe.app";
const ADMIN = process.env.UPTIME_ADMIN || "https://admin.heytribe.app";

const CHECKS = [
  { name: "Marketing site", url: `${SITE}/`, text: "HeyTribe" },
  { name: "Family app", url: `${SITE}/app/`, text: "HeyTribe" },
  { name: "Server and database", url: `${SITE}/api/health`, json: j => j.ok === true && j.database === true },
  { name: "Help center", url: `${SITE}/help.html`, text: "HeyTribe" },
  { name: "Contact page", url: `${SITE}/contact.html`, text: "HeyTribe" },
  { name: "Sitter page", url: `${SITE}/sitter/`, text: "HeyTribe" },
  { name: "Admin dashboard", url: `${ADMIN}/`, text: "HeyTribe" },
  { name: "App links file (iPhone)", url: `${SITE}/.well-known/apple-app-site-association`, status: [200] },
  { name: "App links file (Android)", url: `${SITE}/.well-known/assetlinks.json`, status: [200] }
];

async function once(c) {
  const t0 = Date.now();
  try {
    const r = await fetch(c.url, { redirect: "follow", headers: { "user-agent": "HeyTribe-uptime/1.0", "cache-control": "no-cache" }, signal: AbortSignal.timeout(15000) });
    const ms = Date.now() - t0;
    if (c.status ? !c.status.includes(r.status) : !r.ok) return { ok: false, ms, why: `HTTP ${r.status}` };
    if (c.json) {
      let j = null; try { j = await r.json(); } catch (e) {}
      if (!j || !c.json(j)) return { ok: false, ms, why: `unhealthy: ${JSON.stringify(j).slice(0, 200)}` };
    } else if (c.text) {
      const body = await r.text();
      if (!body.includes(c.text)) return { ok: false, ms, why: "page loaded but looks wrong" };
    }
    return { ok: true, ms };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, why: e.name === "TimeoutError" ? "no answer in 15 seconds" : e.message };
  }
}

async function check(c) {
  let r = await once(c);
  if (!r.ok) { await new Promise(s => setTimeout(s, 20000)); r = await once(c); }
  return { ...c, ...r };
}

const results = await Promise.all(CHECKS.map(check));
for (const r of results) console.log(`${r.ok ? "UP  " : "DOWN"} ${r.name.padEnd(26)} ${String(r.ms).padStart(5)} ms  ${r.url}${r.ok ? "" : "  -> " + r.why}`);
const down = results.filter(r => !r.ok);
if (process.env.GITHUB_OUTPUT) {
  const report = down.map(r => `- **${r.name}** (${r.url}): ${r.why}`).join("\n");
  appendFileSync(process.env.GITHUB_OUTPUT, `down=${down.map(r => r.name).join(", ")}\nreport<<EOF_REPORT\n${report}\nEOF_REPORT\n`);
}
process.exit(down.length ? 1 : 0);
