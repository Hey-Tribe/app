// Uptime check for every public HeyTribe surface. Used by .github/workflows/uptime.yml every 5 minutes.
// Each check gets two tries 20 seconds apart, so one slow response doesn't raise an alarm.
// Prints one line per check and writes failures to $GITHUB_OUTPUT (down=..., report=...). Exit code 1 if anything is down.
import { appendFileSync } from "node:fs";
import { checks, check } from "../api/_uptime.js";

const CHECKS = checks(process.env.UPTIME_SITE || undefined, process.env.UPTIME_ADMIN || undefined);
const results = await Promise.all(CHECKS.map(c => check(c)));
for (const r of results) console.log(`${r.ok ? "UP  " : "DOWN"} ${r.name.padEnd(26)} ${String(r.ms).padStart(5)} ms  ${r.url}${r.ok ? "" : "  -> " + r.why}`);
const down = results.filter(r => !r.ok);
if (process.env.GITHUB_OUTPUT) {
  const report = down.map(r => `- **${r.name}** (${r.url}): ${r.why}`).join("\n");
  appendFileSync(process.env.GITHUB_OUTPUT, `down=${down.map(r => r.name).join(", ")}\nreport<<EOF_REPORT\n${report}\nEOF_REPORT\n`);
}
process.exit(down.length ? 1 : 0);
