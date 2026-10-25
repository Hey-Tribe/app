// Makes the "Secret Key" Supabase needs for Sign in with Apple on the website.
// Apple limits it to 6 months, so run this again before it expires and paste the new one into Supabase.
// Usage: node tools/apple-client-secret.mjs <path to AuthKey_XXXX.p8> <Key ID> <Team ID> [Services ID, default app.heytribe.web]
import fs from "node:fs";
import crypto from "node:crypto";

const [file, keyId, teamId, clientId = "app.heytribe.web"] = process.argv.slice(2);
if (!file || !keyId || !teamId) {
  console.error("Usage: node tools/apple-client-secret.mjs AuthKey_XXXX.p8 KEY_ID TEAM_ID [SERVICES_ID]");
  process.exit(1);
}
const u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000), exp = now + 180 * 86400 - 3600;
const head = u({ alg: "ES256", kid: keyId, typ: "JWT" });
const body = u({ iss: teamId, iat: now, exp, aud: "https://appleid.apple.com", sub: clientId });
const sig = crypto.sign("sha256", Buffer.from(head + "." + body), { key: fs.readFileSync(file, "utf8"), dsaEncoding: "ieee-p1363" }).toString("base64url");
console.log(head + "." + body + "." + sig);
console.error("Expires " + new Date(exp * 1000).toDateString() + ". Set a reminder to make a new one before then.");
