// Android App Links: served at /.well-known/assetlinks.json so www.heytribe.app/app links open the Android app.
// Needs ANDROID_CERT_SHA256: the app signing certificate's SHA-256 fingerprint from Play Console › App integrity
// (comma-separate several, e.g. the Play key and the upload key). Until it's set, links open in the browser.
export default function handler(req, res) {
  const prints = String(process.env.ANDROID_CERT_SHA256 || "").split(",").map(s => s.trim().toUpperCase()).filter(s => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "public, max-age=3600");
  res.status(200).send(JSON.stringify(prints.length ? [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: process.env.ANDROID_PACKAGE || "app.heytribe.android", sha256_cert_fingerprints: prints }
  }] : []));
}
