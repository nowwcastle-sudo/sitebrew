// UX gate: node ux-gate.mjs <url> <outDir>
// - Page is captured as viewport tiles (tile_<w>_<n>.png) instead of captureBeyondViewport,
//   which repeated the hero at the end under mobile emulation.
// - ux_gate.json: nav, persistent nav after scroll, body contrast >= 7:1 (fails when nothing was measured), horizontal scroll, clipped text,
//   text-box overlap + text clipped by an overflow-hidden/clip ancestor (text-boxes.mjs, C296 — fails when no text box was measured).
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startChrome, navigateAndWait, connect, assertOpened } from './cdp.mjs';
import { textBoxScan, stableText, textBoxFailures } from './text-boxes.mjs';
const [url, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
rmSync(join(outDir, 'ux_gate.json'), { force: true }); // 앞 실행의 결과를 도구 실패 뒤에 남기지 않는다
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome;
let exitCode = 0;
try {
chrome = await startChrome(['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], { prefix: 'shots-' });
const { ws, send, ev } = await connect(chrome.wsUrl); // 호출마다 기한(cdp.mjs session)
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, name + '.png'), Buffer.from(r.result.data, 'base64'));
};
const tiles = async (w, maxTiles = 14) => {
  const vh = await ev('innerHeight'); const H = await ev('document.documentElement.scrollHeight');
  let n = 0;
  for (let y = 0; y < H && n < maxTiles; y += vh, n++) {
    await ev(`window.scrollTo(0,${y})`); await sleep(450);
    await shot(`tile_${w}_${String(n).padStart(2, '0')}`);
  }
  await ev('window.scrollTo(0,0)'); await sleep(300);
  return { tiles: n, pageHeight: H, truncated: n * vh < H };
};

// Runs in the page. Colours are resolved through a canvas so oklch()/color-mix() work.
const GATE = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0,0,1,1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r,g,b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };
  const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && !stack.length) return null; const c = rgba(s.backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 0.99) break; } } { let anc = null; for (let e = el; e; e = e.parentElement) { if (rgba(getComputedStyle(e).backgroundColor)[3] >= 0.99) { anc = e; break; } } const b0 = el.getBoundingClientRect(); const under = document.elementsFromPoint(b0.left + b0.width / 2, b0.top + b0.height / 2); const i0 = under.findIndex((u) => u === el || el.contains(u)); for (const u of under.slice(i0 < 0 ? 0 : i0 + 1)) { if (u === anc) break; if (u === el || el.contains(u) || u.contains(el)) continue; const c = rgba(getComputedStyle(u).backgroundColor); if (c[3] >= 0.99) return c; } } let out = rgba(getComputedStyle(document.body).backgroundColor); if (out[3] < 0.99) out = [255,255,255,1]; for (const c of stack.reverse()) out = out.map((v,i) => i < 3 ? v*(1-c[3]) + c[i]*c[3] : 1); return out; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && +s.opacity > 0.05; };
  // Screen-reader-only text (Tailwind sr-only, Base UI internals, ...) is visually hidden on
  // purpose and must not count as clipped: a <=1px box, a non-auto clip, or an inset(50%)-style
  // clip-path are all standard visually-hidden techniques.
  const visuallyHidden = (e) => { const r = e.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) return true; const s = getComputedStyle(e); if (s.clip && s.clip !== 'auto') return true; if (/^inset\\(\\s*50%/i.test(s.clipPath || '')) return true; return false; };
  // body text = p/li/td/dd/figcaption, plus leaf div/span (no child elements), with >= 20 chars; visually-hidden text is not body text
  const isBody = (e) => !e.matches('div, span') || e.children.length === 0;
  const body = [...document.querySelectorAll('p, li, td, dd, figcaption, div, span')].filter((e) => isBody(e) && vis(e) && !visuallyHidden(e) && (e.textContent || '').trim().length >= 20).slice(0, 400);
  // QFIX3: 20자를 넘는 글 상자가 하나도 없는 쪽(표 칸·이름표뿐인 관리 목록)은 「본문 측정 없음」으로 떨어졌다. 그런 쪽만 짧은 글(표 칸·문단·목록 항목·이름표, 2자 이상)로 대비를 잰다 —
  // 문턱(7:1)은 그대로이고, 머리·내비·푸터·버튼 안 글은 여전히 본문이 아니라서 잴 글이 하나도 없는 쪽은 그대로 「측정 없음」 실패다.
  const shortBody = () => [...document.querySelectorAll('p, li, td, th, dd, figcaption, label, div, span')].filter((e) => isBody(e) && vis(e) && !visuallyHidden(e) && !e.closest('nav, header, footer, button, select, [role=button], [role=navigation]') && (e.textContent || '').trim().length >= 2).slice(0, 400);
  const low = []; let checked = 0, skipped = 0;
  for (const e of body.length ? body : shortBody()) { const bg = bgOf(e); if (!bg) { skipped++; continue; } const fg = rgba(getComputedStyle(e).color); const mixed = fg.map((v,i) => i < 3 ? v*fg[3] + bg[i]*(1-fg[3]) : 1); const r = ratio(mixed, bg); checked++; if (r < 7) low.push({ text: e.textContent.trim().slice(0, 40), ratio: +r.toFixed(2) }); }
  const navs = [...document.querySelectorAll('nav, [role=navigation], header')].filter(vis);
  const topNav = navs.some((n) => n.getBoundingClientRect().top < 120);
  const clipped = [...document.querySelectorAll('h1,h2,h3,p,li,a,button,td,th,span,label')].filter((e) => { if (!vis(e) || !e.textContent.trim() || visuallyHidden(e)) return false; const s = getComputedStyle(e); if (s.textOverflow === 'ellipsis') return false; return (s.overflowX !== 'visible' || s.overflow === 'hidden') && e.scrollWidth > e.clientWidth + 2; }).slice(0, 10).map((e) => e.tagName + ': ' + e.textContent.trim().slice(0, 30));
  return { bodyChecked: checked, bodySkippedOnImage: skipped, bodyBelow7: low.length, bodyBelow7Samples: low.slice(0, 6), topNav, clipped, hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
})()`;
const stickyAfterScroll = async () => {
  await ev('window.scrollTo(0, Math.min(document.documentElement.scrollHeight - innerHeight, innerHeight * 3))'); await sleep(500);
  // 붙어 있는 것 = 내비·헤더 자신이 fixed/sticky 이거나, 그 조상 중 가장 가까운 fixed/sticky 상자(H2 떠 있는 섬은 헤더가 static 이고 안쪽 줄이 fixed 다 — C257)가
  // 스크롤한 뒤에도 화면 안에 보이고, 내비 자신도 그 상자 안쪽으로 화면에 들어와 있을 때. 조상이 붙어 있어도 내비 줄이 화면 밖으로 올라갔으면(H5 제호 줄만 올라가는 경우는 내비가 레일에 남아 통과) 아니다.
  const r = await ev(`(() => {
    const els = [...document.querySelectorAll('[data-sticky-nav], nav, [role=navigation], header')];
    const shown = (b, s) => b.height > 20 && b.bottom > 0 && b.top < innerHeight && s.visibility !== 'hidden' && +s.opacity > 0.1;
    const pinned = (e) => { for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') return a; } return null; };
    return els.some((e) => {
      const box = pinned(e);
      if (!box) return false;
      if (!shown(box.getBoundingClientRect(), getComputedStyle(box))) return false;
      if (box === e) return true;
      const b = e.getBoundingClientRect();
      return b.height > 0 && b.width > 0 && b.bottom > 0 && b.top < innerHeight;
    });
  })()`);
  await ev('window.scrollTo(0,0)'); await sleep(300);
  return r;
};

// 글자 상자 겹침·잘림(C296, text-boxes.mjs): 등장 연출이 끝난 뒤(1.2초 더) 700ms 간격으로 두 번 재서 두 번 다 나온 것만 센다.
const scanTextBoxes = async () => {
  await sleep(1200);
  const scan = () => ev(`(${textBoxScan})(${JSON.stringify({})})`);
  const first = await scan(); await sleep(700);
  return stableText(first, await scan());
};
await send('Page.enable'); await send('Runtime.enable');
async function load(w, h, mobile, scheme) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await assertOpened(await navigateAndWait(send, ev, url), ev, url); // 열리지 않는 쪽은 도구 실패(C123)
  await ev('document.fonts.ready.then(()=>1)'); await sleep(2200);
}
const gate = {};
for (const [w, h, mobile] of [[1440, 900, false], [375, 812, false]]) {
  for (const scheme of ['light', 'dark']) {
    await load(w, h, mobile, scheme);
    await shot(`hero-${w}-${scheme}`);
    const g = await ev(GATE); g.textBoxes = await scanTextBoxes(); g.persistentNav = await stickyAfterScroll();
    if (scheme === 'light') g.tiles = await tiles(w);
    gate[`${w}-${scheme}`] = g;
  }
}
const fail = [];
for (const [k, g] of Object.entries(gate)) {
  if (!g.topNav) fail.push(`${k}: no nav at top`);
  if (!g.persistentNav) fail.push(`${k}: nav not persistent after scroll`);
  if (!g.bodyChecked) fail.push(`${k}: no body text measured (bodyChecked 0)`);
  if (g.bodyBelow7) fail.push(`${k}: ${g.bodyBelow7}/${g.bodyChecked} body blocks < 7:1`);
  if (g.hScroll > 0) fail.push(`${k}: horizontal scroll ${g.hScroll}px`);
  if (g.clipped.length) fail.push(`${k}: clipped text x${g.clipped.length}`);
  fail.push(...textBoxFailures(k, g.textBoxes));
}
writeFileSync(join(outDir, 'ux_gate.json'), JSON.stringify({ url, pass: fail.length === 0, fail, gate }, null, 2));
console.log(JSON.stringify({ pass: fail.length === 0, fail }));
ws.close();
exitCode = fail.length ? 3 : 0;
} catch (e) {
  console.error(`도구 실패: ${e.message}`);
  rmSync(join(outDir, 'ux_gate.json'), { force: true });
  exitCode = 1;
} finally {
  await chrome?.close();
}
process.exit(exitCode);
