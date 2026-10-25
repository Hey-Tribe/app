// Universal links for the iPhone app: served at /.well-known/apple-app-site-association.
// Needs APPLE_TEAM_ID (10 characters, from developer.apple.com › Membership). Until it's set, no links open in the app.
export default function handler(req, res) {
  const team = String(process.env.APPLE_TEAM_ID || "").trim();
  const id = `${team}.${process.env.APPLE_BUNDLE_ID || "app.heytribe.ios"}`;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "public, max-age=3600");
  res.status(200).send(JSON.stringify({
    applinks: { details: team ? [{ appIDs: [id], components: [{ "/": "/app/*" }] }] : [] },
    webcredentials: { apps: team ? [id] : [] }
  }));
}
