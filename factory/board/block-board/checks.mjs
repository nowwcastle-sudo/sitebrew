// 블록 행 하나에서 재는 것들(P3-2 Task 7a) — 페이지 안 측정 스크립트(문자열)와 판정. 기존 도구를 다시 쓰지 않고 부른다:
//   본문 대비 = hero-contrast.mjs 의 글자 모으기·픽셀 표본(COLLECT·MEASURE·judgeBoxes) · 면 대비 = recipe-board gates.mjs FACE_CONTRAST ·
//   히트 영역 = hit-area.mjs pageMeasure·pageOverlaps·hitJudge · 동작 줄이기 = hero-motion.mjs judgeReduced · 마케팅·운영 규칙 = marketing-gate.mjs.
// 결과 모양(모든 검사 공통): { status: 'pass' | 'fail' | 'na', measured: <잰 수>, fails: [줄…], …세부 }.
//   na = 잰 것이 0 — 통과가 아니다(대장 A123). 실패 줄이 있으면 잰 수가 0 이어도 fail 이다. 요약은 na 를 따로 센다.
import { COLLECT, MEASURE, judgeBoxes, LARGE_MIN, BODY_MIN } from '../recipe-board/hero-contrast.mjs'
import { FACE_CONTRAST } from '../recipe-board/gates.mjs'
import { judgeReduced } from '../recipe-board/hero-motion.mjs'
import { pageMeasure, pageOverlaps, hitJudge, EXCEPTIONS } from '../../qa/hit-area.mjs'
import { sleep, fullHeight } from './page.mjs'

export const res = (measured, fails = [], extra = {}) => ({ status: fails.length ? 'fail' : measured === 0 ? 'na' : 'pass', measured, fails, ...extra })

// ── 렌더 ──────────────────────────────────────────────────────────────────────────────────────
// ready·error 는 openBlock 이 준다. 콘솔 오류(페이지 예외·console.error·네트워크 오류 로그)는 세션이 행 시작에 비우고 쌓는다.
export function renderResult(open, consoleErrors) {
  const fails = []
  if (!open.ready) fails.push(`블록이 그려지지 않았다: ${open.error}`)
  if (open.entered === 'stuck') fails.push('등장 끝 신호(data-wf-entered)가 10초 안에 없다')
  for (const e of consoleErrors.slice(0, 5)) fails.push(`콘솔 오류: ${e}`)
  return res(1, fails, { entered: open.entered, consoleErrors: consoleErrors.length })
}

// ── 가로 넘침 ─────────────────────────────────────────────────────────────────────────────────
export const OVERFLOW = `(() => {
  const de = document.documentElement
  const over = de.scrollWidth - de.clientWidth
  const scrolls = (el) => { for (let n = el.parentElement; n && n !== de; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o !== 'visible') return true } return false }
  const wide = [...document.querySelectorAll('[data-qa-block] *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !scrolls(e) }).slice(0, 4).map((e) => e.tagName.toLowerCase() + '.' + String(e.getAttribute('class') || '').split(' ')[0].slice(0, 30) + ' right ' + Math.round(e.getBoundingClientRect().right))
  return { over, bodyOver: document.body.scrollWidth - de.clientWidth, wide }
})()`
export function overflowResult(o) {
  const fails = []
  if (o.over > 0) fails.push(`문서 가로 스크롤 ${o.over}px`)
  else if (o.bodyOver > 0) fails.push(`body 가 문서보다 ${o.bodyOver}px 넓다`)
  for (const w of o.wide) fails.push(`화면 밖으로 나간 요소 ${w}`)
  return res(1, fails, { over: o.over })
}

// ── 등장 뒤 가시성 ────────────────────────────────────────────────────────────────────────────
// [data-enter] 가 등장 끝(또는 동작 줄이기)에 모두 보이는가: 자기와 조상의 불투명도 곱 ≥ 0.99, clip-path inset 이 0, 보이는 상자. 안 그려지는 것(display none·hidden)은 잰 수에서 뺀다.
export const ENTER_VISIBLE = `(() => {
  const root = document.querySelector('[data-qa-block]')
  const els = [...root.querySelectorAll('[data-enter]')]
  let measured = 0, skipped = 0
  const hidden = []
  for (const el of els) {
    if (!el.checkVisibility({ checkVisibilityCSS: true }) || el.closest('[hidden],[inert]')) { skipped++; continue }
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) { skipped++; continue }
    measured++
    let op = 1, clipped = false
    for (let a = el; a && a !== root; a = a.parentElement) {
      const cs = getComputedStyle(a)
      op *= Number(cs.opacity)
      const m = cs.clipPath.match(/^inset\\(([^)]*)\\)/)
      if (m && /[1-9]/.test(m[1].split(/\\s+round\\s+/)[0].replace(/0(\\.0+)?(px|%)?/g, ''))) clipped = true
    }
    if (op < 0.99 || clipped) hidden.push(el.tagName.toLowerCase() + '[data-enter="' + (el.getAttribute('data-enter') || '') + '"] ' + (clipped ? 'clip-path ' : '') + 'opacity ' + op.toFixed(2) + ' 「' + (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 24) + '」')
  }
  return { total: els.length, measured, skipped, hidden: hidden.slice(0, 6), hiddenCount: hidden.length, scene: root.querySelector('[data-wf-scene]')?.getAttribute('data-wf-scene') ?? null, entered: !!root.querySelector('[data-wf-entered]') }
})()`
export function enteredResult(v, { label = '등장 뒤' } = {}) {
  const fails = v.hidden.map((h) => `${label}에도 안 보인다 ${h}`)
  if (v.hiddenCount > v.hidden.length) fails.push(`…외 ${v.hiddenCount - v.hidden.length}개`)
  return res(v.measured, fails, { total: v.total, skipped: v.skipped, scene: v.scene })
}

// ── 동작 줄이기 ───────────────────────────────────────────────────────────────────────────────
export const REDUCED = `(() => {
  const root = document.querySelector('[data-qa-block]')
  const running = document.getAnimations().filter((a) => a.playState === 'running' && root.contains(a.effect?.target ?? null)).map((a) => (a.animationName || a.transitionProperty || a.id || 'anim') + '@' + (a.effect?.target?.tagName ?? '').toLowerCase())
  return { running, scene: root.querySelector('[data-wf-scene]')?.getAttribute('data-wf-scene') ?? null, videos: [...root.querySelectorAll('video')].filter((v) => !v.paused).length }
})()`
export function reducedResult(r, visible) {
  const j = judgeReduced({ running: r.running.length, scene: r.scene, videos: r.videos })
  const fails = [...j.fails, ...(r.running.length ? [`실행 중: ${r.running.slice(0, 4).join(', ')}`] : []), ...enteredResult(visible, { label: '동작 줄이기에서' }).fails]
  return res(1 + visible.measured, fails, { running: r.running.length, scene: r.scene, enterMeasured: visible.measured })
}

// ── 본문 대비(글자 뒤 그려진 픽셀 표본 — hero-contrast.mjs 를 블록 섹션 상자에 적용) ───────────────
// COLLECT 의 뿌리(document.querySelector('[data-hero]'))만 갈아 끼운다 — 다른 것은 그대로다. 바뀌지 않으면 던진다(원천이 바뀐 것을 조용히 놓치지 않게).
const HERO_ROOT = "document.querySelector('[data-hero]')"
export const collectFor = (rootSel) => {
  if (!COLLECT.includes(HERO_ROOT)) throw new Error('hero-contrast COLLECT 의 뿌리 식이 바뀌었다 — checks.mjs collectFor 를 맞춰야 한다')
  return COLLECT.replace(HERO_ROOT, `document.querySelector(${JSON.stringify(rootSel)})`)
}
// 글자를 투명하게(hero-contrast HIDE 와 같은 속성) — 되돌릴 수 있게 원래 인라인 값을 적어 둔다(타일마다 다시 재야 한다).
export const hideText = (rootSel) => `(() => {
  const root = document.querySelector(${JSON.stringify(rootSel)}); const props = [['transition', 'none'], ['color', 'transparent'], ['-webkit-text-stroke-color', 'transparent'], ['text-decoration-color', 'transparent'], ['text-shadow', 'none'], ['caret-color', 'transparent']]
  const saved = window.__wfSaved = []
  for (const el of [root, ...root.querySelectorAll('*')]) { saved.push([el, props.map(([p]) => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)])]); for (const [p, v] of props) el.style.setProperty(p, v, 'important') }
  return saved.length
})()`
// 되돌릴 때 transition 을 맨 나중에 되돌린다 — 색을 먼저 원래대로 두고(그동안 transition 은 none) 스타일을 한 번 밀어 낸 뒤에야 transition 을 되돌려야 되돌리는 일이 스스로 색 전환을 시작하지 않는다
// (시작하면 다음 타일의 정지 상태 기다리기가 우리가 시작한 전환을 블록의 것으로 읽는다).
export const showText = `(() => { const saved = window.__wfSaved || []; for (const [el, prev] of saved) for (const [p, v, pr] of prev) { if (p === 'transition') continue; if (v) el.style.setProperty(p, v, pr); else el.style.removeProperty(p) }
  void document.body.offsetWidth
  for (const [el, prev] of saved) for (const [p, v, pr] of prev) { if (p !== 'transition') continue; if (v) el.style.setProperty(p, v, pr); else el.style.removeProperty(p) }
  window.__wfSaved = []; return 1 })()`

// 규격이 색을 정한 글자(대장 A5): 플랫폼 로그인 버튼(카카오·네이버·구글 — 각 사 이용 지침의 색·글자)은 본문 대비 표본에서 뺀다. 뺀 수는 exempt 로 남긴다.
export const EXEMPT_SELECTORS = ['[data-social]']
const EXEMPT_SEL = EXEMPT_SELECTORS.flatMap((x) => [x, x + ' *']).join(',')
// 또 하나: 장식 글리프 — aria-hidden 이면서 글자·숫자가 하나도 없는 글(★ ☆ · • ✓ × 같은 기호). 값은 다른 글자로도 전해지고 WCAG 1.4.3 의 장식 예외다. 숫자·글자가 든 aria-hidden 은 뺀다(잰다).
export const exemptOn = `(() => { const saved = window.__wfEx = []; const glyphs = [...document.querySelectorAll('[aria-hidden="true"]')].filter((e) => e.textContent.trim() && !/[\\p{L}\\p{N}]/u.test(e.textContent)); for (const el of [...document.querySelectorAll(${JSON.stringify(EXEMPT_SEL)}), ...glyphs.flatMap((g) => [g, ...g.querySelectorAll('*')])]) { saved.push([el, el.style.getPropertyValue('color'), el.style.getPropertyPriority('color'), el.style.getPropertyValue('-webkit-text-stroke-color'), el.style.getPropertyValue('transition'), el.style.getPropertyPriority('transition')]); el.style.setProperty('transition', 'none', 'important'); el.style.setProperty('color', 'transparent', 'important'); el.style.setProperty('-webkit-text-stroke-color', 'transparent', 'important') } return document.querySelectorAll(${JSON.stringify(EXEMPT_SELECTORS.join(','))}).length })()`
export const exemptOff = `(() => { const saved = window.__wfEx || []; for (const [el, c, pr, st] of saved) { if (c) el.style.setProperty('color', c, pr); else el.style.removeProperty('color'); if (st) el.style.setProperty('-webkit-text-stroke-color', st); else el.style.removeProperty('-webkit-text-stroke-color') }
  void document.body.offsetWidth
  for (const [el, , , , tv, tp] of saved) { if (tv) el.style.setProperty('transition', tv, tp); else el.style.removeProperty('transition') }
  window.__wfEx = []; return 1 })()`

// ── 정지 상태 기다리기(CFLAKE) ────────────────────────────────────────────────────────────────────
// 블록이 스스로 하는 전환(예: hero/baseline-news-app-window 가 1.4초 뒤 행 하나를 스스로 고른다 — 글·배지 색 CSS 전환 7개 + View Transition 의사 요소 애니메이션 10개)이
// 표본 도중에 돌면 글자색(COLLECT 의 계산값)은 전환 중간색이고 바탕(글자를 투명하게 한 화면)은 transition:none 으로 끝색이거나 전환 스냅샷 겹침이라 짝이 어긋나 대비가 1~6.99 로 흔들린다.
// 그래서 타일마다 재기 직전에 블록 상자 안의 유한 애니메이션·전환·GSAP 트윈과 문서 전환(::view-transition-*)이 끝나기를 기다리고, 한도(settleMs)를 넘으면 그 사실을 남긴다(unsettled).
// 무한 반복(iterations Infinity·repeat -1)과 스크롤 타임라인 애니메이션은 끝나지 않으므로 기다리지 않는다. 재는 동안 새 전환이 시작됐으면(표본 뒤 다시 보아) 그 타일을 다시 잰다.
export const SETTLE_MS = 3000
export const SETTLE_RETRIES = 3
export const BUSY = (rootSel) => `(() => {
  const root = document.querySelector(${JSON.stringify(rootSel)}); if (!root) return { n: 0, what: [] }
  const what = []
  for (const a of document.getAnimations()) {
    if (a.playState !== 'running' || a.timeline !== document.timeline || !a.effect) continue
    if (!Number.isFinite(a.effect.getComputedTiming().endTime)) continue
    const pe = a.effect.pseudoElement || '', t = a.effect.target
    if (pe.startsWith('::view-transition')) what.push('vt' + pe.slice(17, 40))
    else if (t && root.contains(t)) what.push((a.transitionProperty || a.animationName || 'anim') + '@' + t.tagName.toLowerCase())
  }
  const g = window.__wfGsap
  if (g && g.globalTimeline) {
    const infinite = (n) => { for (let p = n; p; p = p.parent) if (p.repeat && p.repeat() === -1) return true; return false }
    for (const tw of g.globalTimeline.getChildren(true, true, false)) {
      try { if (tw.isActive() && !infinite(tw) && (tw.targets() || []).some((x) => x instanceof Element && root.contains(x))) what.push('gsap@' + (tw.targets()[0].tagName || '').toLowerCase()) } catch {}
    }
  }
  return { n: what.length, what: what.slice(0, 5) }
})()`
/** 끝나기를 기다린다. → { waited(ms), busy(한도를 넘었을 때 아직 도는 것들 | null) } */
export async function settle(ev, rootSel, settleMs = SETTLE_MS) {
  const t0 = Date.now()
  for (;;) {
    const b = await ev(BUSY(rootSel))
    const waited = Date.now() - t0
    if (!b.n) return { waited, busy: null }
    if (waited >= settleMs) return { waited, busy: b.what }
    await sleep(40)
  }
}

/** rootSel 안 글자의 본문 7·큰 글자 4.5 를 화면 타일마다 표본한다(뷰포트보다 긴 블록은 위에서 아래로).
 *  rootSel 이 스크롤 칸(max-h + overflow-y:auto — 창 블록의 대화상자)이면 창이 아니라 그 칸을 위에서 아래로 굴리며 타일을 만든다 — 칸 아래에 붙는 줄(sticky)이 글을 덮은
 *  채로 재면 반쯤 덮인 글자 뒤 픽셀(줄의 배경·테두리)이 표본에 섞여 거짓 실패가 난다(C386). 타일 동안만 칸 안 sticky 를 제자리(static)에 두어 가리지 않게 하고 되돌린다. */
export async function measureContrast(session, rootSel, { height, maxTiles = 12, settleMs = SETTLE_MS } = {}) {
  const { send, ev } = session
  const q = JSON.stringify(rootSel)
  const box = await ev(`(() => { const r = document.querySelector(${q}); if (!r || r.scrollHeight <= r.clientHeight + 1 || !/(auto|scroll)/.test(getComputedStyle(r).overflowY)) return null; return { sh: r.scrollHeight, ch: r.clientHeight } })()`)
  const total = box ? box.sh : await ev('document.documentElement.scrollHeight')
  const span = box ? box.ch : height
  const bar = box ? 0 : (await ev(`document.querySelector('[data-sticky-nav]')?.getBoundingClientRect().height ?? 0`)) || 0
  const step = span - 90
  const last = box ? box.sh - box.ch : Math.max(0, total - 90 - 1)
  const scrollTo = (y) => ev(box ? `document.querySelector(${q}).scrollTop = ${y}` : `window.scrollTo(0, ${y})`)
  if (box) await ev(`(() => { const r = document.querySelector(${q}); window.__wfSticky = []; for (const el of r.querySelectorAll('*')) if (getComputedStyle(el).position === 'sticky') { window.__wfSticky.push([el, el.style.getPropertyValue('position'), el.style.getPropertyPriority('position')]); el.style.setProperty('position', 'static', 'important') } })()`)
  const boxes = []
  let tiles = 0, exempt = 0
  const ys = []
  for (let y = 0; ys.length < maxTiles && y <= last; y += step) ys.push(y)
  if (box && ys[ys.length - 1] < last && ys.length < maxTiles) ys.push(last)
  if (!ys.length) ys.push(0)
  const settleInfo = { waitedMs: 0, retries: 0, unsettled: 0, still: [] }
  // 한 타일을 한 번 잰다: 글자 모으기 → (있으면) 글자를 투명하게 하고 화면 표본. → { rootMissing } | { out, stale? } | { stale }
  // probe 면 두 번 본다 — 글자를 모은 직후(글자색 계산값이 전환 중간색이 아닌가; 글자를 투명하게 하면 transition:none 이 진행 중인 CSS 전환을 끝색으로 확정해 버려 그 뒤에는 안 보인다)
  // 와 화면을 찍은 뒤(문서 전환·GSAP 은 글자를 투명하게 해도 계속 돈다). 도는 것이 있으면 stale 로 돌려 그 타일을 다시 잰다.
  const tileOnce = async (probe) => {
    exempt = (await ev(exemptOn)) || exempt
    const n = await ev(collectFor(rootSel))
    await ev(exemptOff)
    if (n === -1) return { rootMissing: true }
    if (n <= 0) return { out: [] }
    if (probe) { const mid = await ev(BUSY(rootSel)); if (mid.n) return { stale: mid.what } }
    await ev(exemptOn)
    await ev(hideText(rootSel))
    await sleep(60)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const out = await ev(MEASURE(shot.result.data))
    await ev(showText)
    await ev(exemptOff)
    if (!Array.isArray(out)) throw new Error('대비 표본 실패')
    if (probe) { const after = await ev(BUSY(rootSel)); if (after.n) return { out, stale: after.what } }
    return { out }
  }
  for (const y of ys) {
    tiles++
    await scrollTo(y)
    await sleep(120)
    let tile = null
    for (let attempt = 1; ; attempt++) {
      const s = await settle(ev, rootSel, settleMs)
      settleInfo.waitedMs += s.waited
      // 한도 안에 안 끝났다 — 더 기다려도 소용없다: 그대로 재고 사실만 남긴다
      if (s.busy) { tile = await tileOnce(false); settleInfo.unsettled++; settleInfo.still.push(...s.busy.slice(0, 3)); break }
      tile = await tileOnce(true)
      if (tile.rootMissing || !tile.stale) break
      if (attempt >= SETTLE_RETRIES) {
        settleInfo.unsettled++; settleInfo.still.push(...tile.stale.slice(0, 3))
        if (!tile.out) tile = await tileOnce(false)
        break
      }
      settleInfo.retries++
    }
    if (tile.rootMissing) return { ...judgeBoxes([]), fails: [`대비 뿌리 ${rootSel} 가 화면에 없다`], tiles, truncated: false, settle: settleInfo }
    // 첫 타일이 아니면 위 고정 띠(검수대)가 덮은 줄은 앞 타일이 이미 쟀다
    boxes.push(...tile.out.filter((b) => y === 0 || b.at[1] >= bar + 2))
  }
  if (box) await ev(`(() => { for (const [el, v, pr] of window.__wfSticky || []) { if (v) el.style.setProperty('position', v, pr); else el.style.removeProperty('position') } window.__wfSticky = []; document.querySelector(${q}).scrollTop = 0 })()`)
  await ev('window.scrollTo(0, 0)')
  const j = judgeBoxes(boxes)
  return { ...j, tiles, exempt, truncated: tiles >= maxTiles && tiles * step < total, settle: settleInfo }
}
export function contrastResult(j) {
  return res(j.boxes, j.fails, { lowestBody: j.lowestBody, lowestLarge: j.lowestLarge, tiles: j.tiles, exempt: j.exempt, bodyMin: BODY_MIN, largeMin: LARGE_MIN, settle: j.settle })
}

// ── 면(K6~K8) ────────────────────────────────────────────────────────────────────────────────
// 면 스코프 대비(recipe-board gates FACE_CONTRAST — 두 테마가 아니라 그 행의 테마) + 블록이 까는 면의 면적(블록 상자 대비 [data-face=field-*|block-*] 합집합, 8px 표본).
// family: 레시피가 정의한 면 이름 — K6·K7 은 field-*, K8 은 block-*(그 밖 이름의 data-face 는 그 레시피에서 스코프가 없다 — 블록이 카드 색으로 그린다).
export const faceArea = (family) => `(() => {
  const root = document.querySelector('[data-qa-block] [data-block]'); if (!root) return { faces: 0, ratio: 0 }
  const box = root.getBoundingClientRect(), sx = scrollX, sy = scrollY
  const faces = [...root.querySelectorAll('[data-face]')].filter((f) => /^${family}-\\d$/.test(f.getAttribute('data-face') || '') && f.checkVisibility({ checkVisibilityCSS: true })).map((f) => f.getBoundingClientRect())
  if (!faces.length) return { faces: 0, ratio: 0 }
  let hit = 0, tot = 0
  for (let y = box.top + 4; y < box.bottom; y += 8) for (let x = box.left + 4; x < box.right; x += 8) { tot++; if (faces.some((r) => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) hit++ }
  return { faces: faces.length, ratio: tot ? +(hit / tot).toFixed(3) : 0 }
})()`
export const FACE_AREA_MIN = 0.25
export const FACE_CONTRAST_SCRIPT = FACE_CONTRAST
export function faceResult({ bold, faceBlock, area, contrast }) {
  if (!bold) return res(0, [], { note: 'K6~K8 레시피가 아니다' })
  const fails = contrast.map((c) => `face-contrast: ${c}`)
  let measured = area.faces
  if (faceBlock) {
    // 면을 까는 블록인데 면이 0 이면 통과가 아니라 실패다(표지가 빠진 것 — A123).
    if (!area.faces) fails.push('face-area: 면을 까는 블록인데 [data-face=field|block] 가 화면에 0개')
    else if (area.ratio < FACE_AREA_MIN) fails.push(`face-area: 블록 상자의 ${(area.ratio * 100).toFixed(1)}% < ${FACE_AREA_MIN * 100}%`)
    measured = Math.max(measured, 1)
  }
  return res(measured, fails, { faces: area.faces, ratio: area.ratio, faceBlock })
}

// ── 히트 영역(fine @ 넓은 화면 · coarse @ 375 — 행의 폭이 포인터를 정한다) ──────────────────────
const scoped = (list, pointer) => (list ?? []).filter((r) => !r.pointer || r.pointer === pointer)
// 부품 밖 눌림 요소(대장 A123 — 「재지 못한 것은 통과가 아니다」): hit-area pageMeasure 는 data-slot 이 없는 요소(블록이 직접 그린 a·button)를 건너뛴다 —
// 카드 전체 링크·푸터 링크 같은 것이 한 번도 안 재진다. 잴 때만 data-slot="block-target" 을 달아 같은 식으로 재고(가상 요소 확장·예외 표 그대로) 바로 뗀다.
// 글 속 인라인 링크는 pageMeasure 가 스스로 뺀다.
const TARGET_SEL = ['a[href]', 'button', 'summary', '[role=button]', '[role=link]', '[role=tab]', '[role=checkbox]', '[role=switch]', '[tabindex]:not([tabindex="-1"])'].map((x) => `[data-qa-block] ${x}`).join(',')
// 뻗은 링크(stretched link — 글 속 인라인 앵커의 ::after 가 카드 전체를 덮는다)는 pageMeasure 가 「글 속 인라인 링크」로 보고 건너뛴다 — 잴 때만 inline-block 으로 바꿔
// ::after 확장이 재지게 하고 뗄 때 되돌린다. 검수대 띠([data-sticky-nav])는 블록이 아니라 뺀다.
export const MARK_ORPHANS = `(() => { const list = window.__wfOrphans = []; for (const el of document.querySelectorAll(${JSON.stringify(TARGET_SEL)})) { if (el.hasAttribute('data-slot') || el.closest('[data-slot], [data-sticky-nav]')) continue; const after = getComputedStyle(el, '::after'); const stretched = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && after.content !== 'none' && after.position === 'absolute'; list.push([el, stretched ? el.style.display : null]); el.setAttribute('data-slot', 'block-target'); if (stretched) el.style.display = 'inline-block' } return list.length })()`
export const UNMARK_ORPHANS = `(() => { for (const [el, d] of window.__wfOrphans || []) { el.removeAttribute('data-slot'); if (d !== null) el.style.display = d } window.__wfOrphans = []; return 1 })()`
export async function measureHit({ ev }, pointer) {
  const orphans = await ev(MARK_ORPHANS)
  if (!(await ev(`matchMedia('(pointer: ${pointer})').matches`))) throw new Error(`(pointer: ${pointer}) 가 페이지에서 맞지 않는다 — 포인터 에뮬레이션 실패`)
  const measured = (await ev(`(${pageMeasure.toString()})(${JSON.stringify(scoped(EXCEPTIONS.exceptions, pointer))})`)) ?? []
  const overlaps = (await ev(`(${pageOverlaps.toString()})(${JSON.stringify(scoped(EXCEPTIONS.overlaps, pointer))})`)) ?? []
  await ev(UNMARK_ORPHANS)
  await ev('window.scrollTo(0, 0)')
  // 부품 밖 글자 링크(푸터 링크 목록처럼 짧은 말)는 높이 44 를 채우면 너비는 24 이상이면 된다(WCAG 2.5.8 최소 24 — 낱말 하나 너비를 44 로 늘리지 않는다). 높이가 모자라면 그대로 실패다.
  const relaxed = measured.map((r) => (r.slot === 'block-target' && !r.exception && r.h >= 44 && r.w >= 24 ? { ...r, exception: 'block-text-link' } : r))
  const { rows, fail } = hitJudge(relaxed, overlaps, 44)
  return res(rows.length, fail, { pointer, overlaps: overlaps.length, exceptions: rows.filter((r) => r.exception).length, orphans })
}

export { fullHeight }
