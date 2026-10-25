// Renders the iPhone app icon (1024, no transparency) and launch images from the HeyTribe mark.
const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets');
const mark = (w, color = '#5E8C7A') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w * 112 / 120}" viewBox="0 0 120 112"><path d="M30 0H90A30 30 0 0 1 120 30V58A30 30 0 0 1 90 88H46L22 110V88A22 24 0 0 1 0 64V30A30 30 0 0 1 30 0Z" fill="${color}"/><circle cx="35" cy="44" r="11" fill="#fff"/><circle cx="63" cy="44" r="11" fill="#fff"/><circle cx="88" cy="49" r="7" fill="#fff"/></svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;width:1024px;height:1024px;background:#FBFCFA;display:flex;align-items:center;justify-content:center"><div style="margin-top:46px">${mark(640)}</div></body></html>`);
  await p.screenshot({ path: path.join(out, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), omitBackground: false });
  await p.setViewportSize({ width: 2732, height: 2732 });
  await p.setContent(`<html><body style="margin:0;width:2732px;height:2732px;background:#FBFCFA;display:flex;align-items:center;justify-content:center"><div style="display:flex;align-items:center;gap:40px">${mark(300)}<span style="font:500 190px -apple-system,Helvetica,Arial,sans-serif;color:#2F3B45;letter-spacing:-4px">hey<b style="font-weight:800">tribe</b></span></div></body></html>`);
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await p.screenshot({ path: path.join(out, 'Splash.imageset', f) });
  await b.close();
})();
