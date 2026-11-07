import { watch } from "./_watch.js";
// The oldest phone app version still allowed. Set MIN_SUPPORTED_APP_VERSION in Vercel (for example "1.2.0").
// Unset means no minimum. Read by the update gate in app/src/app.js.
function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json({ min: process.env.MIN_SUPPORTED_APP_VERSION || "0.0.0" });
}

export default watch(handler);
