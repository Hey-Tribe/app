/* HeyTribe service worker: opens offline with the last saved app, and shows reminders. */
const CACHE = "ht-app-07258b70";
const SHELL = ["/app/", "/app/assets/app.4167197fe0.js", "/app/assets/app.a4d99c47aa.css", "/app/config.js", "/app/vendor/supabase.js", "/app/vendor/591.supabase.js", "/i18n/ht-i18n.js", "/app/i18n/es-app.json", "/app/manifest.webmanifest", "/app/icons/icon-192.png", "/favicon.svg", "/assets/fonts/atkinson.woff2", "/assets/fonts/atkinson-italic.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  // Fonts, icons and the Supabase library rarely change: answer from the cache right away and refresh it in the background.
  if (u.pathname.startsWith("/assets/fonts/") || u.pathname.startsWith("/app/assets/") || u.pathname.startsWith("/app/vendor/") || u.pathname.startsWith("/app/icons/")) {
    e.respondWith(caches.open(CACHE).then(c => c.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  const shell = SHELL.includes(u.pathname) || u.pathname.startsWith("/app/") || u.pathname.startsWith("/i18n/") || r.mode === "navigate";
  if (!shell || u.pathname.startsWith("/api/")) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r.mode === "navigate" ? "/app/" : r, copy)); } return res; })
    .catch(() => caches.match(r.mode === "navigate" ? "/app/" : r).then(m => m || caches.match("/app/"))));
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "HeyTribe", { body: d.body || "", icon: "/app/icons/icon-192.png", badge: "/app/icons/icon-192.png", tag: d.tag, data: { url: d.url || "/app/" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/app/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.includes("/app/")) { c.focus(); c.navigate(url).catch(() => {}); return; } }
    return self.clients.openWindow(url);
  }));
});
