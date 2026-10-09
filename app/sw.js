/* HeyTribe service worker: opens offline with the last saved app, and shows reminders. */
const CACHE = "ht-app-v2";
const SHELL = ["/app/", "/app/config.js", "/app/vendor/supabase.js", "/app/vendor/591.supabase.js", "/i18n/ht-i18n.js", "/app/i18n/es-app.json", "/app/manifest.webmanifest", "/app/icons/icon-192.png", "/favicon.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
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
