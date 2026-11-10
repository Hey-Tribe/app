// Uptime checks shared by tools/uptime-check.mjs (GitHub "Uptime" workflow) and api/uptime-alert.js.
export function checks(SITE = "https://www.heytribe.app", ADMIN = "https://admin.heytribe.app") {
  return [
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
}

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

export async function check(c, retryMs = 20000) {
  let r = await once(c);
  if (!r.ok && retryMs) { await new Promise(s => setTimeout(s, retryMs)); r = await once(c); }
  return { ...c, ...r };
}

