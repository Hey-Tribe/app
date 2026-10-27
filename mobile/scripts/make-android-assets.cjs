// Renders the Android launcher icons (legacy, round, adaptive foreground), launch images and Play Store graphics
// from the HeyTribe mark. Run: node scripts/make-android-assets.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const res = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const store = path.join(__dirname, '..', 'store', 'android');
fs.mkdirSync(store, { recursive: true });
const BG = '#FBFCFA';
const mark = (w, color = '#5E8C7A') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w * 112 / 120}" viewBox="0 0 120 112"><path d="M30 0H90A30 30 0 0 1 120 30V58A30 30 0 0 1 90 88H46L22 110V88A22 24 0 0 1 0 64V30A30 30 0 0 1 30 0Z" fill="${color}"/><circle cx="35" cy="44" r="11" fill="#fff"/><circle cx="63" cy="44" r="11" fill="#fff"/><circle cx="88" cy="49" r="7" fill="#fff"/></svg>`;
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  const shot = async (w, h, html, file, transparent = false) => {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;${transparent ? '' : 'background:' + BG};display:flex;align-items:center;justify-content:center">${html}</body></html>`);
    await p.screenshot({ path: file, omitBackground: transparent });
  };
  for (const [d, s] of Object.entries(D)) {
    const dir = path.join(res, 'mipmap-' + d);
    const icon = Math.round(48 * s), fg = Math.round(108 * s);
    // legacy square icon with rounded corners, and the round one
    await shot(icon, icon, `<div style="width:${icon}px;height:${icon}px;border-radius:${icon * 0.2}px;background:${BG};display:flex;align-items:center;justify-content:center"><div style="margin-top:${icon * 0.05}px">${mark(icon * 0.62)}</div></div>`, path.join(dir, 'ic_launcher.png'), true);
    await shot(icon, icon, `<div style="width:${icon}px;height:${icon}px;border-radius:50%;background:${BG};display:flex;align-items:center;justify-content:center"><div style="margin-top:${icon * 0.05}px">${mark(icon * 0.58)}</div></div>`, path.join(dir, 'ic_launcher_round.png'), true);
    // adaptive foreground: 108dp canvas, the mark inside the 66dp safe circle
    await shot(fg, fg, `<div style="margin-top:${fg * 0.035}px">${mark(fg * 0.5)}</div>`, path.join(dir, 'ic_launcher_foreground.png'), true);
  }
  // launch images for Android 11 and older (12+ uses the icon on the background color)
  const ports = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
  const splash = (w, h) => `<div style="display:flex;align-items:center;gap:${w * 0.03}px">${mark(w * 0.12)}<span style="font:500 ${w * 0.075}px Helvetica,Arial,sans-serif;color:#2F3B45;letter-spacing:-1px">hey<b style="font-weight:800">tribe</b></span></div>`;
  for (const [d, [w, h]] of Object.entries(ports)) {
    await shot(w, h, splash(w, h), path.join(res, 'drawable-port-' + d, 'splash.png'));
    await shot(h, w, splash(w, h), path.join(res, 'drawable-land-' + d, 'splash.png'));
  }
  await shot(480, 320, splash(320, 480), path.join(res, 'drawable', 'splash.png'));
  // Play Store: 512 icon (no transparency) and the 1024x500 feature graphic
  await shot(512, 512, `<div style="margin-top:22px">${mark(320)}</div>`, path.join(store, 'icon-512.png'));
  await shot(1024, 500, `<div style="display:flex;flex-direction:column;align-items:center;gap:22px"><div style="display:flex;align-items:center;gap:22px">${mark(110)}<span style="font:500 92px Helvetica,Arial,sans-serif;color:#2F3B45;letter-spacing:-2px">hey<b style="font-weight:800">tribe</b></span></div><span style="font:400 34px Helvetica,Arial,sans-serif;color:#555E67">Family calendar, chores and lists</span></div>`, path.join(store, 'feature-graphic.png'));
  await b.close();
})();
