// 히어로 글자 대비 관문(Task 10d fix — 픽셀 표본): node factory/board/recipe-board/hero-contrast.mjs [origin=http://localhost:3000] [--only <id,id>]
// 첫 화면 히어로(scene=hero)의 글자마다 **그려진 화면의 픽셀**을 글자 칸 뒤에서 표본해 잰다 — 토큰 짝이 아니라 그림(SVG·그레인·겹친 면) 위 실제 바탕.
//   ① 페이지 안: [data-hero] 아래 보이는 글자 노드마다 줄 상자(조상의 overflow 자르기와 교차)와 글자색(캔버스로 풀어 oklch·color-mix 도 된다.
//      채움이 투명하면 -webkit-text-stroke 색)을 모은다. sr-only·투명도 < 0.99·SVG 안 글자는 뺀다.
//   ② 모든 글자를 투명하게 하고(색·획·밑줄·그림자) 화면을 찍는다 = 바탕만.
//   ③ 그 화면을 캔버스에 그려 상자 안을 2px 마다 표본하고 WCAG 비를 잰다 → 상자마다 최솟값과 p5(아래 5%).
//   판정(judgeBoxes): 큰 글자(24px 이상, 또는 18.66px 이상이면서 굵기 700 이상) p5 ≥ 4.5, 나머지(본문) p5 ≥ 7. p5 를 쓰는 까닭 — 글자 뒤를 지나는
//   1px 선(격자 세로선·치수선)이 상자 안 표본 몇 개를 차지해도 글자 판독성은 바탕 대부분이 정한다.
// 등장 중간 프레임(Task 11): 끝 화면 뒤 0.6초·1.2초에 모션 키트 장면을 멈추고 같은 판정 — 아직 보이지 않는 글자(불투명도 < 0.1 · clip-path 로 다 잘림)만 빼고
// 나머지는 잰다(반쯤 떠오른 글자는 섞인 색, 일부 잘린 글자는 보이는 부분 — Task 11 fix).
// 영상 프레임(Task 12): 영상이 있는 히어로는 등장 끝 글자 상자로 영상 재생 0·2·5초 화면과 포스터 화면을 따로 잰다(<폭>~v0s·~v2s·~v5s·~poster).
// 대상: 레시피마다 A · B(전체) · 보드가 고를 수 있는 교차 조합(B 색 × A 히어로, A 색 × B 히어로 — validCombos 에 있을 때), 기본 테마, 1440×900 · 375×812.
// 결과: .tmp/board/gates/hero-contrast.json · 종료 0 = 모두 통과, 1 = 실패 있음 또는 도구 실패(「도구 실패:」, 결과 파일 없음).
// board:gates(gates.mjs)가 이 모듈의 heroContrastJobs·measureHeroContrast 를 불러 장면 관문과 함께 돈다.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { loadHeads, OUT, GATE_CHROME_FLAGS } from './jobs.mjs'
import { QA_INIT, SETTLED, withInit } from './hero-motion.mjs'
import { validCombos, altAxesOf } from '../../scripts/recipe.mjs'

export const BODY_MIN = 7
export const LARGE_MIN = 4.5
export const VIEWPORTS = [[1440, 900, false], [375, 812, true]]
// 등장 중간 프레임(초, Task 11 §3) — 끝 화면과 함께 잰다.
export const FRAMES = [0.6, 1.2]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 글자 상자 하나가 큰 글자인가(WCAG 큰 글자: 24px 이상, 또는 18.66px 이상 굵게).
export const isLarge = (size, weight) => size >= 24 || (size >= 18.66 && weight >= 700)

// 표본 결과([{ t, p5, min, large, fading? }]) → 판정. 표본이 하나도 없으면 「잰 것 없음」으로 실패한다(빈 결과를 통과로 읽지 않는다).
// fading(등장 중간 프레임에서 그 순간 불투명도가 트윈·CSS 애니메이션으로 바뀌는 중인 글자)은 잰 값을 그대로 남기되(fadingBelow) 판정에서 뺀다 —
// 「읽히는 채로 대비 밑에 머무는」 글자만 실패다(Task 11 §3 「Text must never sit below contrast while readable」). 머무는 반투명 글자·clip-path 아래 글자·
// 움직이는 바탕 위 글자는 모두 판정한다. strictFade(환경 WF_STRICT_FADE=1)면 떠오르는 중인 글자도 실패로 센다(브리프 fix 8 문자 그대로 — 컨트롤러 판정 대기).
export function judgeBoxes(res, { strictFade = process.env.WF_STRICT_FADE === '1' } = {}) {
  const need = (x) => (x.large ? LARGE_MIN : BODY_MIN)
  const below = res.filter((x) => x.p5 < need(x))
  const fadingBelow = below.filter((x) => x.fading).length
  const fails = strictFade ? below : below.filter((x) => !x.fading)
  const low = (large) => {
    const xs = res.filter((x) => x.large === large).map((x) => x.p5)
    return xs.length ? Math.min(...xs) : null
  }
  const problems = fails.map((x) => `${x.large ? '큰 글자' : '본문'} 「${x.t}」 p5 ${x.p5} < ${need(x)}`)
  if (!res.length) problems.push('잰 글자 상자 0개')
  return { boxes: res.length, fading: res.filter((x) => x.fading).length, fadingBelow, fails: problems, lowestBody: low(false), lowestLarge: low(true) }
}

// midFrame(등장 중간 프레임 — Task 11 fix b1 M1, 덜 빼기): 아직 보이지 않는 글자만 뺀다 —
//   · 불투명도 곱 < 0.1(FAINT) → 뺀다. 그 밖(0.1 이상)은 잰다: 글자색을 그 불투명도로 바탕 픽셀과 섞은 색으로 잰다(반쯤 떠오른 글자는 그만큼 흐리게 보인다).
//   · clip-path 가 걸린 조상 → 그 모양(inset·ellipse·circle)의 상자로 글자 상자를 자른다. 다 잘리면(0 면적) 뺀다, 일부면 보이는 부분만 잰다.
//     모양을 읽지 못하는 clip-path(polygon 등)는 자르지 않고 잰다(빼지 않는다).
// 끝 화면(midFrame 아님)은 이전 그대로: 불투명도 < 0.99 인 글자는 뺀다(디자인상 옅은 장식 글자), clip-path 는 보지 않는다.
// 떠오르는 중(fading): 글자나 조상의 불투명도(opacity·autoAlpha)를 바꾸는 GSAP 트윈이 그 순간 0 < progress < 1 이거나, 불투명도 키프레임을 가진
// CSS 애니메이션이 끝나지 않았으면 표시한다(판정은 judgeBoxes — 잰 값은 남긴다).
// 돌려주는 값: 잰 상자 수. window.__heroSkip 에 뺀 수(faint·clipped)를 남긴다.
export const FAINT = 0.1
export const COLLECT_WITH = ({ midFrame = false } = {}) => `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true })
  const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3]] }
  const len = (v, ref) => (String(v).endsWith('%') ? (parseFloat(v) / 100) * ref : parseFloat(v) || 0)
  const clipBox = (a, cp) => {
    const b = a.getBoundingClientRect()
    let m = cp.match(/^inset\\(([^)]*)\\)/)
    if (m) { const v = m[1].split(/\\s+round\\s+/)[0].trim().split(/\\s+/); const [t, r = t, bo = t, l = r] = v; return { left: b.left + len(l, b.width), top: b.top + len(t, b.height), right: b.right - len(r, b.width), bottom: b.bottom - len(bo, b.height) } }
    m = cp.match(/^ellipse\\(\\s*(\\S+)\\s+(\\S+)\\s+at\\s+(\\S+)\\s+(\\S+)\\s*\\)/)
    if (m) { const rx = len(m[1], b.width), ry = len(m[2], b.height), x0 = b.left + len(m[3], b.width), y0 = b.top + len(m[4], b.height); return { left: x0 - rx, right: x0 + rx, top: y0 - ry, bottom: y0 + ry } }
    m = cp.match(/^circle\\(\\s*(\\S+)\\s+at\\s+(\\S+)\\s+(\\S+)\\s*\\)/)
    if (m) { const rr = len(m[1], Math.hypot(b.width, b.height) / Math.SQRT2), x0 = b.left + len(m[2], b.width), y0 = b.top + len(m[3], b.height); return { left: x0 - rr, right: x0 + rr, top: y0 - rr, bottom: y0 + rr } }
    return null
  }
  const g = window.__wfGsap
  const opVar = (v) => v && ('opacity' in v || 'autoAlpha' in v)
  const fadingOf = (el) => {
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      if (g) for (const tw of g.getTweensOf(a)) { const p = tw.progress(); if (p > 0 && p < 1 && (opVar(tw.vars) || opVar(tw.vars && tw.vars.startAt))) return true }
      for (const an of a.getAnimations ? a.getAnimations() : []) { if (an.playState === 'finished') continue; const kf = an.effect && an.effect.getKeyframes ? an.effect.getKeyframes() : []; if (kf.some((k) => 'opacity' in k)) return true }
    }
    return false
  }
  // 접힌 <details> 의 내용(요약 summary 밖)은 그려지지 않는다(::details-content content-visibility: hidden) — 그런데도 Range 줄 상자는 낡은 자리에 남아
  // 그 자리의 바탕 픽셀로 보이지 않는 글자를 재면 거짓 실패가 난다(nav/top-bar 계정 메뉴 「도움말」 p5 1.81, GATES2). 안 그려지는 글은 재지 않는다.
  const inClosedDetails = (e) => { for (let d = e.closest('details:not([open])'); d; d = d.parentElement && d.parentElement.closest('details:not([open])')) { const sm = d.querySelector(':scope > summary'); if (!sm || !sm.contains(e)) return true } return false }
  const root = document.querySelector('[data-hero]'); if (!root) return -1
  const out = [], skip = { faint: 0, clipped: 0 }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.replace(/\\s+/g, ' ').trim(); if (!t) continue
    const el = n.parentElement; if (el.closest('svg') || el.closest('.sr-only')) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || inClosedDetails(el)) continue
    let op = 1; for (let a = el; a; a = a.parentElement) op *= Number(getComputedStyle(a).opacity)
    if (${midFrame} ? op < ${FAINT} : op < 0.99) { if (${midFrame}) skip.faint++; continue }
    const cut = []
    if (${midFrame}) for (let a = el; a && a !== document.body; a = a.parentElement) { const cp = getComputedStyle(a).clipPath; if (cp && cp !== 'none') { const c = clipBox(a, cp); if (c) cut.push(c) } }
    const r = document.createRange(); r.selectNodeContents(n)
    let col = rgb(cs.color); if (col[3] === 0) col = rgb(cs.webkitTextStrokeColor || cs.color)
    if (col[3] === 0) continue
    const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight)
    const clips = []; for (let p = el; p; p = p.parentElement) { const s2 = getComputedStyle(p); if (s2.overflowX !== 'visible' || s2.overflowY !== 'visible') clips.push(p.getBoundingClientRect())
      // 테두리(칩·배지·동그라미 번호): 글자 줄 상자(글꼴 content area)는 줄 높이보다 커서 얇은 테두리 줄에 걸친다 — 테두리 색이 바탕 표본에 섞여 글자 대비가 가짜로 낮게 잰다(4.03·4.77).
      // 글자는 테두리 안쪽(padding 상자)에만 그려지므로 가장 가까운 테두리 있는 조상의 안쪽으로 자른다(그 위 조상은 더 바깥이라 영향 없다).
      const bt = parseFloat(s2.borderTopWidth) || 0, br = parseFloat(s2.borderRightWidth) || 0, bb = parseFloat(s2.borderBottomWidth) || 0, bl = parseFloat(s2.borderLeftWidth) || 0
      if ((bt || br || bb || bl) && s2.display !== 'inline') { const q = p.getBoundingClientRect(); clips.push({ left: q.left + bl + 1, top: q.top + bt + 1, right: q.right - br - 1, bottom: q.bottom - bb - 1 }) } }
    let pushed = 0, rects = 0
    for (const b0 of r.getClientRects()) {
      rects++
      let L0 = b0.left, T0 = b0.top, R0 = b0.right, B0 = b0.bottom
      for (const c of [...clips, ...cut]) { L0 = Math.max(L0, c.left); T0 = Math.max(T0, c.top); R0 = Math.min(R0, c.right); B0 = Math.min(B0, c.bottom) }
      // 글꼴 content area(한글 글꼴은 1.4em 안팎)는 글자 잉크 띠보다 위아래로 넉넉해서, 글자 바로 뒤 칠(mark 형광·칩 배경)이 잉크 띠 정도만 칠하면 그 위아래의 바탕 픽셀이
      // 글자색과 같은 색으로 섞인다(흰 글자 + 붉은 형광 → 형광 밖 흰 바탕이 표본에 들어 p5 1.03). 잉크가 놓이는 가운데 0.9em 띠만 잰다(세로쓰기는 건드리지 않는다).
      if (!String(cs.writingMode).startsWith('vertical')) { const ex = (B0 - T0) - size * 0.9; if (ex > 0) { T0 += ex / 2; B0 -= ex / 2 } }
      if (R0 - L0 < 2 || B0 - T0 < 2 || B0 <= 0 || T0 >= innerHeight || R0 <= 0 || L0 >= innerWidth) continue
      out.push({ t: t.slice(0, 40), x: L0, y: T0, w: R0 - L0, h: B0 - T0, col, op: +Math.min(1, op).toFixed(3), size, weight, ...(${midFrame} && fadingOf(el) ? { fading: true } : {}) })
      pushed++
    }
    if (cut.length && rects && !pushed) skip.clipped++
  }
  window.__heroPx = out; window.__heroSkip = skip; return out.length
})()`
export const COLLECT = COLLECT_WITH()

// 치수 라벨 줄바꿈 관문(Task 14 — r1 B 「3600」이 375에서 「3 / 60 / 0」으로 잘린 자리). 375 표본에서만 돈다(measureHeroContrast).
// 라벨 판정: 글자 전체가 숫자·공백·,.:×xX- 뿐이거나(단위 mm·MM·cm·px·%·° 는 있어도 없어도) [data-dim-label] 조상이 표시한 글자.
export const DIM_LABEL_RE = /^[\d\s.,:×xX-]+(mm|MM|cm|px|%|°)?$/
// Task 16(리뷰 14 #6): 글자 마디가 아니라 **요소 상자**로 잰다 — 「3 <span>600</span>」처럼 마디가 나뉜 라벨은 마디마다 한 줄씩이라 줄바꿈을 놓쳤다.
// 라벨 = 제 글자 마디가 있고, 글자 전체(마디를 합친 것)가 정규식에 맞거나 [data-dim-label] 안인 요소 가운데 가장 바깥 것(부모는 맞지 않는다). 줄 수 = 그 요소 내용의 줄 조각을
// 블록 축으로 묶은 수(가로쓰기는 세로 위치, 세로쓰기는 가로 위치 — 같은 줄의 여러 조각은 한 줄). rects 는 이 줄 수다(dimensionLabelProblems 가 읽는다).
// control: 양성 대조(Task 16) — 잰 라벨마다 줄바꿈을 억지로 만든다(white-space normal · 폭 1ch · 글자 단위 끊기, 옛 CSS 처럼 nowrap 이 없는 좁은 칸).
//   재고 나면 바로 되돌린다. 두 글자 이상인 라벨에서 하나도 잡지 못하면 수집기가 눈먼 것이다.
export const DIM_COLLECT_WITH = ({ control = false } = {}) => `(() => {
  const RE = ${DIM_LABEL_RE.toString()}
  const root = document.querySelector('[data-hero]'); if (!root) return -1
  const norm = (s) => s.replace(/\\s+/g, ' ').trim()
  // 제 글자 마디가 있어야 라벨이다 — 단추 묶음(「90」「100」… 크기 단추를 가진 flex 줄)의 이어 붙인 글 「90100110130」을 라벨 하나로 읽지 않는다.
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  const isLabel = (el) => { const t = norm(el.textContent); return !!t && ownText(el) && (!!el.closest('[data-dim-label]') || RE.test(t)) }
  const out = []
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('svg') || el.closest('.sr-only') || !isLabel(el)) continue
    if (el.parentElement && el.parentElement !== root && root.contains(el.parentElement) && isLabel(el.parentElement)) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.5 || cs.display === 'none') continue
    const saved = el.getAttribute('style')
    // 인라인 상자에는 폭이 먹지 않는다(r6 접수번호 같은 span) — 대조 동안만 inline-block 으로 둔다. 플렉스 항목은 최소 폭을 풀어 준다.
    if (${control}) { if (cs.display === 'inline') el.style.setProperty('display', 'inline-block', 'important'); el.style.setProperty('white-space', 'normal', 'important'); el.style.setProperty('inline-size', '1ch', 'important'); el.style.setProperty('min-inline-size', '0', 'important'); el.style.setProperty('word-break', 'break-all', 'important') }
    const r = document.createRange(); r.selectNodeContents(el)
    const frags = [...r.getClientRects()].filter((b) => b.width > 1 && b.height > 1 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth)
    const vertical = cs.writingMode.startsWith('vertical') || cs.writingMode.startsWith('sideways')
    const spans = frags.map((b) => (vertical ? [b.left, b.right] : [b.top, b.bottom])).sort((a, b) => a[0] - b[0])
    const lines = []
    for (const [a, b] of spans) {
      const last = lines[lines.length - 1]
      if (last && Math.min(last[1], b) - Math.max(last[0], a) > 0.5 * Math.min(last[1] - last[0], b - a)) { last[0] = Math.min(last[0], a); last[1] = Math.max(last[1], b) } else lines.push([a, b])
    }
    if (${control}) { if (saved == null) el.removeAttribute('style'); else el.setAttribute('style', saved) }
    if (!frags.length) continue
    out.push({ t: norm(el.textContent).slice(0, 40), rects: lines.length, frags: frags.length, vertical })
  }
  return out
})()`
export const DIM_COLLECT = DIM_COLLECT_WITH()
export const DIM_CONTROL = DIM_COLLECT_WITH({ control: true })
// 줄이 하나뿐이어야 한다 — 세로쓰기(writing-mode: vertical-rl)로 「한 칸」에 담긴 라벨도 칸이 나뉘면 여러 개다. w: 잰 폭(메시지용).
export function dimensionLabelProblems(rows, w = 375) {
  return (rows ?? []).filter((r) => r.rects > 1).map((r) => `치수 라벨 「${r.t}」 이(가) ${r.rects}줄(칸)로 잘렸다(${w})`)
}
// 양성 대조 판정: 두 글자 이상(공백 빼고) 라벨이 있는데 억지 줄바꿈을 하나도 잡지 못하면 실패. 라벨이 없으면 대조할 것이 없다(실패 아님).
export function dimensionControlProblems(rows, w = 375) {
  const eligible = (rows ?? []).filter((r) => r.t.replace(/\s/g, '').length >= 2)
  if (!eligible.length) return []
  return eligible.some((r) => r.rects > 1) ? [] : [`치수 라벨 대조(${w}): 줄바꿈을 억지로 만들었는데 수집기가 잡지 못했다 — 검사가 눈멀었다`]
}

// transition 을 먼저 끈다(Task 11) — 색 전환이 있는 글자(줄 강조 자취 750ms)는 투명으로 바로 가지 않고 서서히 흐려져, 150ms 뒤 바탕 사진에 회색 글자가 남았다.
export const HIDE = `(() => { for (const el of document.querySelectorAll('[data-hero], [data-hero] *')) for (const [p, v] of [['transition', 'none'], ['color', 'transparent'], ['-webkit-text-stroke-color', 'transparent'], ['text-decoration-color', 'transparent'], ['text-shadow', 'none'], ['caret-color', 'transparent']]) el.style.setProperty(p, v, 'important'); return 1 })()`

export const MEASURE = (b64) => `(async () => {
  const img = new Image(); img.src = 'data:image/png;base64,${b64}'; await img.decode()
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0)
  const px = cx.getImageData(0, 0, cv.width, cv.height).data
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const large = (s, w) => s >= 24 || (s >= 18.66 && w >= 700)
  const res = []
  for (const b of window.__heroPx) {
    // 반쯤 떠오른 글자(등장 중간 프레임, 불투명도 0.1~0.99): 글자색을 그 불투명도로 바탕 픽셀과 섞은 색(sRGB 합성)으로 잰다.
    const op = b.op == null || b.op >= 0.99 ? 1 : b.op
    const lt0 = L(b.col[0], b.col[1], b.col[2]); const rs = []
    for (let y = Math.max(0, Math.floor(b.y)); y < Math.min(cv.height, b.y + b.h); y += 2) for (let x = Math.max(0, Math.floor(b.x)); x < Math.min(cv.width, b.x + b.w); x += 2) {
      const i = (y * cv.width + x) * 4; const lb = L(px[i], px[i + 1], px[i + 2])
      const lt = op === 1 ? lt0 : L(op * b.col[0] + (1 - op) * px[i], op * b.col[1] + (1 - op) * px[i + 1], op * b.col[2] + (1 - op) * px[i + 2])
      const hi = Math.max(lt, lb), lo = Math.min(lt, lb); rs.push((hi + 0.05) / (lo + 0.05))
    }
    if (!rs.length) continue
    rs.sort((a, c) => a - c)
    res.push({ t: b.t, min: +rs[0].toFixed(2), p5: +rs[Math.floor(rs.length * 0.05)].toFixed(2), large: large(b.size, b.weight), size: b.size, at: [Math.round(b.x), Math.round(b.y)], ...(op < 1 ? { op } : {}), ...(b.fading ? { fading: true } : {}) })
  }
  return res
})()`

// 영상 프레임(Task 12 — 미디어): 히어로에 영상이 있으면 등장 끝 화면과 같은 글자 상자로, 영상을 그 재생 시각(초)에 멈춘 화면과
// 포스터(영상을 숨겨 포스터 그림만)를 따로 잰다 — 글자 뒤 바탕이 영상의 어느 순간이어도 대비를 지키는지. 보이지 않는 영상(좁은 화면에서 숨긴 칸)은 뺀다.
export const VIDEO_TIMES = [0, 2, 5]
export const VIDEO_AT = (t) => `(async () => {
  const vs = [...document.querySelectorAll('[data-hero] video')].filter((v) => v.getClientRects().length)
  const wait = (v, ev, ms) => new Promise((r) => { const done = () => r(1); v.addEventListener(ev, done, { once: true }); setTimeout(done, ms) })
  for (const v of vs) {
    v.pause()
    if (${t === 'poster'}) { v.style.setProperty('visibility', 'hidden', 'important'); continue }
    v.style.removeProperty('visibility')
    if (v.readyState < 1) { v.preload = 'auto'; const p = wait(v, 'loadedmetadata', 8000); v.load(); await p }
    const to = Math.min(${t === 'poster' ? 0 : Number(t)}, Math.max(0, (v.duration || 8) - 0.05))
    const p = wait(v, 'seeked', 8000); v.currentTime = to; await p
    if (v.readyState < 2) await wait(v, 'loadeddata', 8000)
    v.setAttribute('data-playing', '')
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  return vs.map((v) => ({ t: +v.currentTime.toFixed(2), ready: v.readyState, shown: getComputedStyle(v).visibility !== 'hidden' && Number(getComputedStyle(v).opacity) > 0.5 }))
})()`

// 글자를 숨긴 뒤(sample 다음) 영상 상태마다 다시 찍어 잰다 → { [`v<초>s` | 'poster']: judgeBoxes 결과 + videos }. 영상이 없으면 {}.
async function sampleVideoFrames(send, ev) {
  const out = {}
  if (!(await ev(`[...document.querySelectorAll('[data-hero] video')].filter((v) => v.getClientRects().length).length`))) return out
  for (const t of [...VIDEO_TIMES, 'poster']) {
    const videos = await ev(VIDEO_AT(t))
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const res = await ev(MEASURE(shot.result.data))
    if (!Array.isArray(res)) throw new Error('영상 프레임 표본 실패')
    out[t === 'poster' ? 'poster' : `v${t}s`] = { ...judgeBoxes(res), videos, worst: [...res].sort((a, b) => a.p5 / (a.large ? LARGE_MIN : BODY_MIN) - b.p5 / (b.large ? LARGE_MIN : BODY_MIN)).slice(0, 3) }
  }
  return out
}

// 한 칸 요약(hero-contrast 단독 실행·board:gates). 중간 프레임은 잰 상자 수·섞어 잰 수·떠오르는 중(그중 기준 밑)·뺀 수(희미·다 잘림)를 싣는다.
export const contrastCell = (w, x) => x.dimOnly
  ? `${w}: 치수 라벨 ${x.dimLabels.length}${x.dimLabels.length ? ` (대조 잡음 ${x.dimControl.filter((r) => r.rects > 1).length})` : ''}`
  : x.skipped
  ? `${w}: 장면 없음`
  : `${w}: 상자 ${x.boxes} · 본문 최저 ${x.lowestBody ?? '-'} · 큰 글자 최저 ${x.lowestLarge ?? '-'}${x.excluded ? ` · 섞음 ${x.blended} · 떠오르는 중 ${x.fading}(기준 밑 ${x.fadingBelow}) · 뺌 희미 ${x.excluded.faint}·잘림 ${x.excluded.clipped}` : ''}`

// 레시피 한 벌의 잴 조합: A · B 전체 · 교차(B 색 × A 히어로, A 색 × B 히어로) — 보드가 버튼으로 내는 조합(validCombos)에 있는 것만.
export function heroContrastJobs(head) {
  const theme = head.defaultTheme === 'dark' ? 'dark' : 'light'
  const jobs = [{ key: 'A', alt: null }]
  if (head.alternates) {
    const all = altAxesOf(head.alternates)
    jobs.push({ key: 'B', alt: 'B' })
    const combos = validCombos(head).map((p) => p.join('+'))
    const cross = [
      { key: 'B색×A히어로', axes: all.filter((k) => k !== 'hero') },
      { key: 'A색×B히어로', axes: all.filter((k) => k !== 'colorLogic') },
    ]
    for (const c of cross) if (c.axes.length && c.axes.length < all.length && combos.includes(c.axes.join('+'))) jobs.push({ key: c.key, alt: c.axes.join('+') })
  }
  return jobs.map((j) => ({ ...j, recipe: head.id, theme, query: `&theme=${theme}${j.alt ? `&alt=${j.alt}` : ''}` }))
}

// 멈춘 화면 한 장을 잰다(글자 모으기 → 글자 숨기기 → 바탕 찍기 → 표본).
async function sample(send, ev, url, collect) {
  const n = await ev(collect)
  if (n === -1) throw new Error(`[data-hero] 가 없다 — ${url}`)
  await ev(HIDE)
  await sleep(150)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const res = await ev(MEASURE(shot.result.data))
  if (!Array.isArray(res)) throw new Error(`표본 실패 — ${url}`)
  const excluded = await ev('window.__heroSkip ?? null')
  return { ...judgeBoxes(res), excluded, blended: res.filter((x) => x.op != null).length, worst: [...res].sort((a, b) => a.p5 / (a.large ? LARGE_MIN : BODY_MIN) - b.p5 / (b.large ? LARGE_MIN : BODY_MIN)).slice(0, 3) }
}

// 치수 라벨만 재는 폭(Task 16 — 리뷰 14 #6, 브리프 「768 도」).
export const DIM_ONLY = [768, 1024]
// 한 폭의 치수 라벨 표본 + 양성 대조(억지 줄바꿈 — 재고 곧바로 되돌린다).
async function dimSample(ev, url, w) {
  const dimLabels = await ev(DIM_COLLECT)
  if (!Array.isArray(dimLabels)) throw new Error(`치수 라벨 표본 실패(${w}) — ${url}`)
  const dimControl = await ev(DIM_CONTROL)
  if (!Array.isArray(dimControl)) throw new Error(`치수 라벨 대조 실패(${w}) — ${url}`)
  return { dimLabels, dimControl }
}

// 한 주소(한 조합)를 두 폭에서 잰다 → { [폭]: judgeBoxes 결과, [폭@초]: 등장 중간 프레임 결과, [768]: 치수 라벨만 }.
// frames(초, Task 11 §3): 모션 키트 장면(data-wf-t0)이 시작한 뒤 그 시각에 GSAP 전체·CSS 애니메이션을 멈추고(hero-motion.mjs QA_INIT) 잰다.
// 그 순간 아직 보이지 않는 글자(불투명도 < 0.1, clip-path 로 다 잘림)만 빼고 나머지를 판정한다 — 반투명은 섞인 색, 일부 잘림은 보이는 부분(COLLECT_WITH midFrame).
// 장면이 없는 히어로(모션 키트를 쓰지 않는 구성)는 중간 프레임을 { skipped } 로 남긴다(실패 아님).
export async function measureHeroContrast(send, ev, url, { wait = 3800, frames = [] } = {}) {
  const out = {}
  for (const [w, h, mobile] of VIEWPORTS) {
    const at0 = async () => {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile })
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
    }
    // 등장 끝(먼저 — 서체·청크를 데워 중간 프레임이 대체 서체로 찍히지 않게).
    await at0()
    await navigateAndWait(send, ev, url, { timeoutMs: 60000 })
    await ev('document.fonts.ready.then(() => 1)')
    await sleep(wait)
    // 등장 연출이 끝나기를 기다린다 — GSAP 장면은 t0 + 3.2초, 유한 CSS 애니메이션은 끝날 때까지(최대 4초). 반복 애니메이션은 기다리지 않는다.
    await ev(SETTLED)
    out[w] = await sample(send, ev, url, COLLECT)
    // 치수 라벨 줄바꿈(Task 14 · Task 16) — 두 폭 모두 + 768(아래 DIM_ONLY). 같은 「fails」 목록에 얹어 gates.mjs·CLI 요약이 그대로 잡는다.
    Object.assign(out[w], await dimSample(ev, url, w))
    out[w].fails.push(...dimensionLabelProblems(out[w].dimLabels, w), ...dimensionControlProblems(out[w].dimControl, w))
    for (const [k, x] of Object.entries(await sampleVideoFrames(send, ev))) out[`${w}~${k}`] = x
    for (const at of frames) {
      await at0()
      out[`${w}@${at}s`] = await withInit(send, QA_INIT(Math.round(at * 1000)), async () => {
        await navigateAndWait(send, ev, url, { timeoutMs: 60000 })
        let paused = null
        for (let i = 0; i < 120 && paused == null; i++) { paused = await ev('window.__wfPaused ?? null'); if (paused == null) await sleep(50) }
        if (paused == null) return { skipped: '장면 없음(data-wf-t0) — 중간 프레임을 재지 않았다', fails: [], lowestBody: null, lowestLarge: null }
        return { pausedAt: paused, ...(await sample(send, ev, url, COLLECT_WITH({ midFrame: true }))) }
      })
    }
  }
  {
    // 768(태블릿 — 리뷰 14 #6): 치수 라벨만 잰다(대비 표본은 1440·375 두 폭 그대로).
    const [dw, dh] = DIM_ONLY
    await send('Emulation.setDeviceMetricsOverride', { width: dw, height: dh, deviceScaleFactor: 1, mobile: false })
    await navigateAndWait(send, ev, url, { timeoutMs: 60000 })
    await ev('document.fonts.ready.then(() => 1)')
    await ev(SETTLED)
    const d = await dimSample(ev, url, dw)
    out[dw] = { ...d, fails: [...dimensionLabelProblems(d.dimLabels, dw), ...dimensionControlProblems(d.dimControl, dw)], dimOnly: true }
  }
  return out
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const only = flag('--only')?.split(',')
  const origin = (argv.filter((a) => !a.startsWith('--'))[0] ?? 'http://localhost:3000').replace(/\/$/, '')
  const dir = join(OUT, 'gates')
  const file = join(dir, only ? `hero-contrast-${only.join('_')}.json` : 'hero-contrast.json')
  mkdirSync(dir, { recursive: true })
  rmSync(file, { force: true })
  let code = 0, chrome
  try {
    chrome = await startChrome(GATE_CHROME_FLAGS, { prefix: 'hero-contrast-' })
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    const rows = []
    for (const h of loadHeads().filter((x) => !only || only.includes(x.id))) for (const j of heroContrastJobs(h)) {
      const url = `${origin}/qa/recipes?r=${h.id}&scene=hero${j.query}`
      const m = await measureHeroContrast(send, ev, url, { frames: FRAMES })
      const fails = Object.entries(m).flatMap(([w, x]) => x.fails.map((f) => `${w}: ${f}`))
      rows.push({ recipe: h.id, option: j.key, theme: j.theme, url, pass: !fails.length, fails, byWidth: m })
      console.log(`${fails.length ? 'FAIL' : 'PASS'} ${h.id} ${j.key}(${j.theme}) ${Object.entries(m).map(([w, x]) => contrastCell(w, x)).join(' | ')}${fails.length ? `\n  ${fails.join('\n  ')}` : ''}`)
    }
    ws.close()
    const failed = rows.filter((r) => !r.pass)
    writeFileSync(file, JSON.stringify({ origin, bodyMin: BODY_MIN, largeMin: LARGE_MIN, count: rows.length, failed: failed.length, rows }, null, 2) + '\n')
    console.log(`히어로 글자 대비: ${rows.length}개 조합 중 실패 ${failed.length}`)
    code = failed.length ? 1 : 0
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    rmSync(file, { force: true })
    code = 1
  } finally {
    await chrome?.close()
  }
  process.exit(code)
}
