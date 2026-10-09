/* HeyTribe visitor stats and error reports. No cookies, no personal details: a random visitor id kept in this browser,
   the page path, where the visit came from, the device size and the language. */
(function(){
  "use strict";
  var U = "https://ayafbypcbsfmqckuwqom.supabase.co/rest/v1/", K = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5YWZieXBjYnNmbXFja3V3cW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDY0NzcsImV4cCI6MjEwNzEyMjQ3N30.LhKcVqZtz9xbrbo72ORBoHg6BfzPmIZrd7kSj_9FXRU";
  if (navigator.webdriver || /^(localhost|127\.)/.test(location.hostname)) return;
  var ls = function(k, v){ try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch(e){ return null; } };
  var ss = function(k, v){ try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch(e){ return null; } };
  var vid = ls("ht-vid"); if (!vid) { vid = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-6); ls("ht-vid", vid); }
  var admin = /^admin\./.test(location.hostname);
  function post(table, row){
    try { fetch(U + table, { method: "POST", keepalive: true, headers: { apikey: K, authorization: "Bearer " + K, "content-type": "application/json", prefer: "return=minimal" }, body: JSON.stringify(row) }).catch(function(){}); } catch(e){}
  }
  // where this visit came from: ?utm_source=..., else the referring site, else "direct"
  var q = new URLSearchParams(location.search), src = ss("ht-ses-src"), camp = ss("ht-ses-camp");
  if (!src) {
    var ref = ""; try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch(e){}
    if (/heytribe\.(app|vercel\.app)$/.test(ref)) ref = "";
    if (/(^|\.)google\./.test(ref)) ref = "google"; else if (/(^|\.)(facebook|fb)\.com$|^l\.facebook/.test(ref)) ref = "facebook"; else if (/instagram\.com$/.test(ref)) ref = "instagram";
    else if (/(^|\.)bing\.com$/.test(ref)) ref = "bing"; else if (/(^|\.)(t\.co|twitter\.com|x\.com)$/.test(ref)) ref = "x"; else if (/tiktok\.com$/.test(ref)) ref = "tiktok"; else if (/pinterest\./.test(ref)) ref = "pinterest";
    src = (q.get("utm_source") || q.get("ref") || ref || "direct").toLowerCase().slice(0, 60);
    camp = (q.get("utm_campaign") || "").slice(0, 80);
    ss("ht-ses-src", src); ss("ht-ses-camp", camp);
    if (!ls("ht-src") && src !== "direct") ls("ht-src", JSON.stringify({ src: src, campaign: camp || null }));
  }
  var w = Math.min(screen.width || innerWidth, innerWidth), device = w < 700 ? "phone" : w < 1024 ? "tablet" : "desktop";
  var lang = (ls("ht-lang") || "en").slice(0, 5);
  if (!admin) post("page_views", { path: (location.pathname || "/").slice(0, 200), src: src, campaign: camp || null, vid: vid, device: device, lang: lang });
  // errors: up to 5 distinct ones per page load
  var area = admin ? "admin" : /^\/app(\/|$)/.test(location.pathname) ? "app" : "site", seen = {}, sent = 0;
  function report(msg, source, line){
    msg = String(msg || "Unknown error").slice(0, 300); if (seen[msg] || sent >= 5) return; seen[msg] = 1; sent++;
    post("client_errors", { area: area, path: location.pathname.slice(0, 200), message: msg, source: source ? String(source).slice(0, 200) : null, line: line || null, ua: navigator.userAgent.slice(0, 200), vid: vid });
  }
  addEventListener("error", function(e){ if (e.message) report(e.message, e.filename, e.lineno); });
  addEventListener("unhandledrejection", function(e){ var r = e.reason; report("Unhandled: " + (r && (r.message || r.msg) || r)); });
})();
