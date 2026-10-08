// 대표 장면 관문(Task 8 Step 1b): node factory/board/recipe-board/gates.mjs [origin=http://localhost:3000] [--only <id,id>] [--scene <장면,장면>] [--skip-run]
// --scene(Task 12): 대표 장면 행을 그 장면만 돈다(예: hero — 히어로만 바꾼 작업). ⑤ 히어로 대비·⑥ 히어로 모션은 그대로 돈다. 요약 파일 이름에 붙는다.
// 레시피 × 선택지(A, B) × 대표 장면마다:
//   ① run.mjs(ux-gate + behavior) — **--strict 아님**: 장면은 부품 조합이라 동작 표식(confirm-open·toast-trigger·filter 두 개)이 없다.
//      표식이 없으면 behavior 는 'n/a'로 건너뛰고 ux-gate(상단 내비·스크롤 뒤 고정·본문 7:1·가로 스크롤·잘린 글자)가 판정한다.
//   ② hit-area fine·coarse 실패 0.
//   ③ 면 관문(CDP — 첫 화면 1440×900·375×812, 다크 기본 레시피는 다크 렌더로 판정):
//      K6~K8 비대시보드 선택지 → 첫 화면에서 bg-field-*·bg-block-* 가 칠한 면적 ≥ 25%(점 표본 8px, 가장 가까운 칠한 조상이 면일 때만 센다).
//      K6~K8 × dashboard → 첫 화면에 [data-face] 상단 바(위 200px 안에서 시작하고 폭 50% 이상)가 있는지(면적 조건 없음).
//      히어로 장면(Task 10f §2b — 컨트롤러 판정)은 둘 다 아니다: 1440 첫 화면을 찍어 유채 픽셀(OKLCH C ≥ 0.06, 2px 표본) 비율을 잰다
//      (데모 발견의 「색 면적」과 같은 잣대). K6~K8 선택지는 25% 이상. K1~K5 히어로도 비율은 잰다(판정 없음, 보고용).
//      찍기 전에 등장을 끝내고 유휴 반복(GSAP·CSS)을 첫 위상에 멈춘다(Task 11 묶음 2 — 반복 위상에 따라 비율이 흔들리지 않게, pixelShareNow).
//   ④ 면 대비(두 테마): 모든 [data-face] 구획의 스코프 토큰을 계산된 색으로 잰다 — lint face-contrast 와 같은 짝·문턱
//      (muted-foreground/background·muted 4.5, foreground/muted 4.5, primary-foreground/primary 4.5, primary·ring·border·input/background 3).
//      그리고 구획 안 조작 요소(button·input·checkbox·select·textarea)의 글자/자기 바탕 4.5, 테두리가 있으면 테두리/면 3.
//   ⑤ 히어로 글자 대비(Task 10d fix — hero-contrast.mjs): 첫 화면 히어로의 글자마다 그려진 픽셀 바탕을 표본해 본문 7 · 큰 글자 4.5(p5).
//      레시피마다 A · B · 보드 교차 조합(B 색 × A 히어로, A 색 × B 히어로), 기본 테마, 1440×900 · 375×812. --skip-run 이어도 돈다.
//      등장 끝 화면과 함께 등장 중간 0.6초·1.2초(모션 키트 장면을 그 시각에 멈춤 — Task 11)도 잰다.
//   ⑥ 히어로 모션(Task 11 — hero-motion.mjs): 최소 글자 14px(1440·375 끝 화면) · 동작 줄이기 실행 중 0 · 등장 구간 longtask ≤ 200ms. --skip-run 이어도 돈다.
// 결과: .tmp/board/gates/summary.json · 종료 0 = 모두 통과, 1 = 실패 있음 또는 도구 실패(「도구 실패:」).
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { loadHeads, optionsOf, faceGateKind, sceneUrl, OUT, GATE_CHROME_FLAGS } from './jobs.mjs'
import { heroContrastJobs, measureHeroContrast, contrastCell, FRAMES } from './hero-contrast.mjs'
import { heroMotionJobs, measureHeroMotion, motionLine, SETTLED, FREEZE_IDLE, QA_INIT, withInit } from './hero-motion.mjs'

const QA = join(fileURLToPath(new URL('../../qa/', import.meta.url)))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// sRGB 8비트 → OKLab 채도 C(= OKLCH C). 페이지 안 표본도 이 함수 소스를 그대로 싣는다(한 구현).
export function oklabChroma(r, g, b) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const R = lin(r), G = lin(g), B = lin(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return Math.hypot(1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s)
}
export const CHROMA_MIN = 0.06
export const PIXEL_SHARE_MIN = 0.25
// 페이지 안: 찍은 PNG(b64)를 캔버스에 그려 step px 마다 C ≥ CHROMA_MIN 인 표본의 비율.
export const CHROMA_SHARE = (b64, step = 2) => `(async () => {
  const oklabChroma = ${oklabChroma.toString()}
  const img = new Image(); img.src = 'data:image/png;base64,${b64}'; await img.decode()
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0)
  const px = cx.getImageData(0, 0, cv.width, cv.height).data
  let hit = 0, tot = 0
  for (let y = 0; y < cv.height; y += ${step}) for (let x = 0; x < cv.width; x += ${step}) { const i = (y * cv.width + x) * 4; tot++; if (oklabChroma(px[i], px[i + 1], px[i + 2]) >= ${CHROMA_MIN}) hit++ }
  return +(hit / tot).toFixed(4)
})()`
// 유한 애니메이션(등장 연출)이 끝나기를 기다린다(최대 4초) — 반복 애니메이션은 기다리지 않는다(hero-contrast.mjs 와 같은 식).
const FINITE_ANIMATIONS = `Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => 0))), new Promise((r) => setTimeout(r, 4000))]).then(() => 1)`

const run = (args) => new Promise((res) => { const p = spawn(process.execPath, args, { stdio: 'ignore' }); p.on('exit', (c) => res(c)) })

// 페이지 안: 캔버스로 색을 풀어(oklch·color-mix) 대비를 잰다.
const PAGE_LIB = `
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0,0,1,1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r,g,b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };
  const over = (fg, bg) => fg.map((v, i) => i < 3 ? v * fg[3] + bg[i] * (1 - fg[3]) : 1);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  const transparent = (c) => c === 'transparent' || /rgba\\(.*,\\s*0\\)$/.test(c);
`

export const AREA = `(() => {
  const W = innerWidth, H = innerHeight; let hit = 0, tot = 0;
  const faceCls = (n) => /(^|\\s)bg-(field|block)-\\d(\\s|$)/.test(typeof n.className === 'string' ? n.className : '');
  for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) {
    tot++;
    for (let n = document.elementFromPoint(x, y); n && n !== document.documentElement; n = n.parentElement) {
      if (faceCls(n)) { hit++; break; }
      const bg = getComputedStyle(n).backgroundColor;
      if (!(bg === 'transparent' || /rgba\\(.*,\\s*0\\)$/.test(bg))) break;
    }
  }
  const topBar = [...document.querySelectorAll('[data-face]')].some((f) => { const b = f.getBoundingClientRect(); return b.top < 200 && b.bottom > 0 && b.width >= W * 0.5 && b.height > 0; });
  return { ratio: +(hit / tot).toFixed(3), topBar, faces: document.querySelectorAll('[data-face]').length };
})()`

export const FACE_CONTRAST = `(() => {${PAGE_LIB}
  const out = [];
  const PAIRS = [['muted-foreground','background',4.5],['muted-foreground','muted',4.5],['foreground','muted',4.5],['primary-foreground','primary',4.5],['primary','background',3],['ring','background',3],['border','background',3],['input','background',3]];
  for (const face of document.querySelectorAll('[data-face]')) {
    const k = face.getAttribute('data-face');
    const probe = document.createElement('span'); face.appendChild(probe);
    const tok = (t) => { probe.style.color = 'var(--' + t + ')'; return rgba(getComputedStyle(probe).color); };
    const faceBg = rgba(getComputedStyle(face).backgroundColor);
    for (const [a, b, min] of PAIRS) { const x = ratio(over(tok(a), faceBg), over(tok(b), faceBg)); if (x < min) out.push(k + ' token ' + a + '/' + b + ' ' + x + ' < ' + min); }
    probe.remove();
    const mine = (el) => el.closest('[data-face]') === face && !el.closest('[data-face-reset], [data-slot="card"]:not([data-face])');
    for (const el of face.querySelectorAll('button, input, textarea, select, [role="checkbox"], [data-slot="checkbox"]')) {
      if (!mine(el)) continue;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); if (!r.width || !r.height || cs.visibility === 'hidden') continue;
      const own = rgba(cs.backgroundColor); const base = own[3] > 0.5 ? over(own, faceBg) : faceBg;
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 20);
      if ((el.textContent || '').trim()) { const x = ratio(over(rgba(cs.color), base), base); if (x < 4.5) out.push(k + ' 글자 ' + label + ' ' + x + ' < 4.5'); }
      if (parseFloat(cs.borderTopWidth) > 0 && !transparent(cs.borderTopColor)) { const x = ratio(over(rgba(cs.borderTopColor), faceBg), faceBg); if (x < 3 && ratio(base, faceBg) < 3) out.push(k + ' 테두리 ' + label + ' ' + x + ' < 3'); }
    }
  }
  return out;
})()`

// 지금 열린 히어로 화면의 유채 픽셀 비율: 등장이 끝나기를 기다리고(모션 키트 장면은 등장 끝 신호 data-wf-entered — getAnimations 에 잡히지 않는다, Task 11 fix),
// 유휴 반복을 첫 위상에 멈춘 뒤(FREEZE_IDLE — 페이지가 QA_INIT 으로 열렸어야 GSAP 반복까지 멈춘다) 1440 첫 화면을 찍어 잰다.
export async function pixelShareNow(send, ev) {
  await ev(SETTLED)
  await ev(FINITE_ANIMATIONS)
  const frozen = await ev(FREEZE_IDLE)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const share = shot.result?.data ? await ev(CHROMA_SHARE(shot.result.data)) : undefined
  return { share, frozen }
}

// 히어로 장면은 QA_INIT(멈춤 없음)을 심고 연다 — 모션 키트가 gsap 을 내어 줘 FREEZE_IDLE 이 GSAP 유휴 반복까지 멈춘다.
const measureFaces = (send, ev, url, kind, themes, scene) => (scene === 'hero' ? withInit(send, QA_INIT(null), () => measureFacesOpen(send, ev, url, kind, themes, scene)) : measureFacesOpen(send, ev, url, kind, themes, scene))

async function measureFacesOpen(send, ev, url, kind, themes, scene) {
  const fails = [], seen = {}
  for (const [w, h, mobile] of [[1440, 900, false], [375, 812, true]]) {
    for (const theme of themes) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile })
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] })
      await navigateAndWait(send, ev, `${url}&theme=${theme}`, { timeoutMs: 30000 })
      await ev('document.fonts.ready.then(() => 1)')
      for (let i = 0; i < 40 && !(await ev('!!document.querySelector("article[data-scene]")')); i++) await sleep(150)
      await sleep(2500)
      const key = `${w}-${theme}`
      const [area, contrast] = [await ev(AREA), await ev(FACE_CONTRAST)]
      if (!area || !contrast) throw new Error(`면 측정 실패 ${url} ${key}`)
      seen[key] = { ...area, contrast: contrast.length }
      for (const c of contrast) fails.push(`${key} face-contrast: ${c}`)
      // 면적·상단 바는 판정 테마(첫 테마 — 다크 기본은 다크)에서만.
      if (theme !== themes[0]) continue
      if (scene === 'hero' && w === 1440) {
        const { share, frozen } = await pixelShareNow(send, ev)
        if (typeof share !== 'number') throw new Error(`유채 픽셀 측정 실패 ${url} ${key}`)
        seen[key].pixelShare = share
        seen[key].frozen = frozen
        // 유휴 정지 기록(Task 11 fix b2 M1): 강제로 끝낸 것을 이름과 함께 남기고, 등장 줄이 끝나지 않은 채였으면 경고한다(유채 줄이 멈춘 등장을 가리지 않게).
        if (frozen?.stuckEntrance) console.warn(`경고: ${url} ${key} — 등장 줄(wf-enter)이 끝나지 않은 채 유휴 정지가 강제로 끝냈다: ${JSON.stringify(frozen.forced)}`)
        else if (frozen?.forced?.length) console.log(`  유휴 정지: 유한 반복 ${frozen.forced.length}개를 끝냈다(등장 아님) — ${frozen.forced.map((f) => `${f.name} ${f.totalProgress}→1 (repeat ${f.repeat})`).join(', ')}`)
        if (kind === 'pixel' && share < PIXEL_SHARE_MIN) fails.push(`${key} face-pixel: 유채 픽셀 ${(share * 100).toFixed(1)}% < ${PIXEL_SHARE_MIN * 100}%`)
      }
      if (kind === 'area' && area.ratio < 0.25) fails.push(`${key} face-area: ${(area.ratio * 100).toFixed(1)}% < 25%`)
      if (kind === 'top-bar' && !area.topBar) fails.push(`${key} face-top-bar: 첫 화면에 [data-face] 상단 바가 없다`)
    }
  }
  return { fails, seen }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const only = flag('--only')?.split(',')
  const scenes = flag('--scene')?.split(',')
  const skipRun = argv.includes('--skip-run')
  const origin = (argv.filter((a) => !a.startsWith('--'))[0] ?? 'http://localhost:3000').replace(/\/$/, '')
  const dir = join(OUT, 'gates')
  mkdirSync(dir, { recursive: true })
  const heads = loadHeads().filter((h) => !only || only.includes(h.id))
  const rows = []
  let code = 0, chrome
  try {
    chrome = await startChrome(GATE_CHROME_FLAGS, { prefix: 'board-gate-' })
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    for (const h of heads) for (const opt of optionsOf(h)) for (const scene of (h.signature ?? []).filter((x) => !scenes || scenes.includes(x))) {
      const url = sceneUrl(origin, h.id, scene, opt)
      const tag = `${h.id}-${opt.key}-${scene}`
      const row = { recipe: h.id, option: opt.key, scene, url, faceGate: faceGateKind(opt.head, scene) }
      if (!skipRun) {
        row.run = await run([join(QA, 'run.mjs'), url, join(dir, tag, 'run')])
        row.hitFine = await run([join(QA, 'hit-area.mjs'), '--pointer', 'fine', url, join(dir, tag, 'hit-fine.json')])
        row.hitCoarse = await run([join(QA, 'hit-area.mjs'), '--pointer', 'coarse', url, join(dir, tag, 'hit-coarse.json')])
        const rep = join(dir, tag, 'run', 'report.json')
        row.runReport = existsSync(rep) ? JSON.parse(readFileSync(rep, 'utf8')) : null
        const ux = join(dir, tag, 'run', 'gate', 'ux_gate.json')
        if (row.run !== 0 && existsSync(ux)) row.uxFail = JSON.parse(readFileSync(ux, 'utf8')).fail
        for (const p of ['fine', 'coarse']) { const f = join(dir, tag, `hit-${p}.json`); if (row[`hit${p === 'fine' ? 'Fine' : 'Coarse'}`] !== 0 && existsSync(f)) row[`hit_${p}_fail`] = JSON.parse(readFileSync(f, 'utf8')).fail }
      }
      const themes = h.defaultTheme === 'dark' ? ['dark', 'light'] : ['light', 'dark']
      const m = await measureFaces(send, ev, url, row.faceGate, themes, scene)
      row.faces = m.seen
      row.faceFails = m.fails
      row.pass = (skipRun || (row.run === 0 && row.hitFine === 0 && row.hitCoarse === 0)) && !m.fails.length
      rows.push(row)
      console.log(`${row.pass ? 'PASS' : 'FAIL'} ${tag} run=${row.run ?? '-'} hit=${row.hitFine ?? '-'}/${row.hitCoarse ?? '-'} face=${row.faceGate ?? '없음'} ${Object.entries(m.seen).map(([k, v]) => `${k}:${(v.ratio * 100).toFixed(0)}%${v.topBar ? '·bar' : ''}${v.pixelShare != null ? `·px ${(v.pixelShare * 100).toFixed(1)}%` : ''}`).join(' ')}${m.fails.length ? `\n  ${m.fails.join('\n  ')}` : ''}${row.uxFail ? `\n  ux: ${row.uxFail.join(' | ')}` : ''}${row.hit_fine_fail ? `\n  hit fine: ${JSON.stringify(row.hit_fine_fail).slice(0, 300)}` : ''}${row.hit_coarse_fail ? `\n  hit coarse: ${JSON.stringify(row.hit_coarse_fail).slice(0, 300)}` : ''}`)
    }
    // ⑤ 히어로 픽셀 글자 대비 — 장면 행과 같은 요약에 싣는다(scene: 'hero-contrast').
    for (const h of heads) for (const j of heroContrastJobs(h)) {
      const url = `${origin}/qa/recipes?r=${h.id}&scene=hero${j.query}`
      const m = await measureHeroContrast(send, ev, url, { frames: FRAMES })
      const fails = Object.entries(m).flatMap(([w, x]) => x.fails.map((f) => `${w} hero-contrast: ${f}`))
      rows.push({ recipe: h.id, option: j.key, scene: 'hero-contrast', url, heroContrast: m, faceFails: fails, pass: !fails.length })
      console.log(`${fails.length ? 'FAIL' : 'PASS'} ${h.id}-${j.key}-hero-contrast ${Object.entries(m).map(([w, x]) => contrastCell(w, x)).join(' | ')}${fails.length ? `\n  ${fails.join('\n  ')}` : ''}`)
    }
    // ⑥ 히어로 모션(Task 11 — hero-motion.mjs): 최소 글자 14px(1440·375) · 동작 줄이기 실행 0 · 등장 구간 longtask ≤ 200ms.
    for (const j of heroMotionJobs(heads)) {
      const url = `${origin}/qa/recipes?r=${j.recipe}&scene=hero${j.query}`
      const m = await measureHeroMotion(send, ev, url)
      rows.push({ recipe: j.recipe, option: j.option, scene: 'hero-motion', url, heroMotion: m, faceFails: m.fails, pass: !m.fails.length })
      console.log(`${m.fails.length ? 'FAIL' : 'PASS'} ${j.recipe}-${j.option}-hero-motion ${motionLine(m)}`)
    }
    ws.close()
    const failed = rows.filter((r) => !r.pass)
    // 유휴 정지 기록 요약: 강제로 끝낸 것 전체와 그 가운데 등장 줄(멈춘 등장).
    const frozenAll = rows.flatMap((r) => Object.values(r.faces ?? {}).map((v) => v.frozen).filter(Boolean).map((f) => ({ row: `${r.recipe}-${r.option}-${r.scene}`, ...f })))
    const freeze = { forced: frozenAll.flatMap((f) => f.forced.map((x) => ({ row: f.row, ...x }))), stuckEntrances: frozenAll.reduce((a, f) => a + (f.stuckEntrance ?? 0), 0) }
    writeFileSync(join(dir, `summary${only ? `-${only.join('_')}` : ''}${scenes ? `-scene-${scenes.join('_')}` : ''}.json`), JSON.stringify({ origin, strict: false, count: rows.length, failed: failed.length, freeze, rows }, null, 2) + '\n')
    console.log(`유휴 정지 기록: 강제로 끝낸 것 ${freeze.forced.length}개(${freeze.forced.map((x) => `${x.row} ${x.name}`).join(', ') || '없음'}) · 멈춘 등장 ${freeze.stuckEntrances}개`)
    if (freeze.stuckEntrances) console.warn(`경고: 멈춘 등장 ${freeze.stuckEntrances}개 — 위 「경고:」 줄을 본다`)
    console.log(`장면 관문: ${rows.length}개 중 실패 ${failed.length}`)
    code = failed.length ? 1 : 0
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    code = 1
  } finally {
    await chrome?.close()
  }
  process.exit(code)
}
