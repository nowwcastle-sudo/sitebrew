// 대담안 안전 관문 bold-safety(factory v1 Task 4.2 · 합의안 D20) — 3안 중 대담안(boldness "bold")이 대담해도 안전한가.
//   D20: 동작 줄이기면 정지 화면 · 모바일 LCP ≤ 2.5 s · CLS < 0.1 · 깜빡임 초당 3회 이하 · 대비 규칙 그대로 · public·dashboard 는 모션 대신 배치·서체로만 대담.
//
//   judgeBold(...)        순수 판정 — 측정값 → { ok, failures[{ id, message }] }. 측정값이 없으면(null·undefined) 통과가 아니라 실패다(A123 — 잴 것이 없음은 통과가 아니다).
//   evidenceFromGates(..) 07-qa 가 이미 돌린 ops-gate(LCP·CLS, 모바일 Lighthouse)와 a11y 행렬(color-contrast)의 결과를 다시 잰다 없이 읽는다.
//   staticFlashRate(css)  CSS 만 읽는 깜빡임 상한(초당 횟수) — 아래 한계 참고.
//   measureBold(...)      Chrome 으로 「동작 줄이기(prefers-reduced-motion: reduce)에서 정지 화면」을 잰다. 1440·375 둘 다.
//   boldSafetyForCandidate(...)  07-qa 가 부르는 후보 어댑터 — 기록 모양은 ops·a11y·strict 어댑터와 같다.
//
//   한계(숨기지 않는다): 깜빡임은 CSS `@keyframes`(불투명도·색·필터 등을 바꾸는 것)의 무한 반복 주기로만 상한을 잡는다. JS(GSAP)가 만드는 깜빡임은 못 잰다 —
//   다만 동작 줄이기 정지 확인은 JS 장면도 잡는다(여러 번 표본한 화면 값이 바뀌면 움직이는 것이다).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const BOLD_THRESHOLDS = Object.freeze({ lcpMs: 2500, cls: 0.1, flashesPerSec: 3 })
/** 모션 대신 배치·서체로만 대담해야 하는 원형(D20). */
export const BOLD_LAYOUT_ARCHETYPES = Object.freeze(['public', 'dashboard'])
export const boldModeFor = (archetype) => (BOLD_LAYOUT_ARCHETYPES.includes(archetype) ? 'layout' : 'motion')

const RULES = {
  'layout-only': 'public·dashboard 는 모션 대신 배치·서체로만 대담해야 한다(boldMode "layout")',
  'reduced-motion-static': '동작 줄이기에서 모든 장면이 정지 화면이어야 하고 글이 숨지 않는다',
  lcp: `모바일 LCP ≤ ${BOLD_THRESHOLDS.lcpMs} ms`,
  cls: `CLS < ${BOLD_THRESHOLDS.cls}`,
  flashes: `깜빡임 초당 ${BOLD_THRESHOLDS.flashesPerSec}회 이하`,
  contrast: '대비 규칙(axe color-contrast)을 그대로 지킨다',
}
export const BOLD_RULES = Object.freeze(RULES)

const num = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * @param {{ archetype: string, boldMode?: 'motion'|'layout', reducedMotionStatic?: boolean|null, lcpMs?: number|null, cls?: number|null, flashesPerSec?: number|null, contrastOk?: boolean|null }} m
 * @returns {{ ok: boolean, boldMode: string, failures: { id: string, message: string }[] }}
 */
export function judgeBold({ archetype, boldMode, reducedMotionStatic, lcpMs, cls, flashesPerSec, contrastOk } = {}) {
  const mode = boldMode ?? boldModeFor(archetype)
  const failures = []
  const fail = (id, message) => failures.push({ id, message: `${RULES[id]} — ${message}` })
  if (BOLD_LAYOUT_ARCHETYPES.includes(archetype) && mode !== 'layout') fail('layout-only', `${archetype} 의 대담안 모드가 ${mode} 이다`)
  if (reducedMotionStatic !== true) fail('reduced-motion-static', reducedMotionStatic === false ? '동작 줄이기에서 움직이거나 글이 숨은 장면이 있다' : '재지 못했다(통과가 아니다)')
  if (!num(lcpMs)) fail('lcp', '재지 못했다(통과가 아니다)')
  else if (lcpMs > BOLD_THRESHOLDS.lcpMs) fail('lcp', `${Math.round(lcpMs)} ms`)
  if (!num(cls)) fail('cls', '재지 못했다(통과가 아니다)')
  else if (!(cls < BOLD_THRESHOLDS.cls)) fail('cls', `${cls}`)
  if (!num(flashesPerSec)) fail('flashes', '재지 못했다(통과가 아니다)')
  else if (flashesPerSec > BOLD_THRESHOLDS.flashesPerSec) fail('flashes', `초당 ${Math.round(flashesPerSec * 10) / 10}회`)
  if (contrastOk !== true) fail('contrast', contrastOk === false ? 'color-contrast 실패가 있다' : '재지 못했다(통과가 아니다)')
  return { ok: failures.length === 0, boldMode: mode, failures }
}

// ── 이미 돈 관문 결과 읽기 ───────────────────────────────────────────────────

/**
 * @param {{ ops?: { checks?: { id: string, status: string, value?: number }[] } | null, a11y?: { verdict?: string, routes?: Record<string, { failures?: string[] }> } | null }} src
 *   ops = ops-gate.json 내용 · a11y = a11y 어댑터 기록. 없거나 도구 실패면 그 값은 null(재지 못함).
 * @returns {{ lcpMs: number|null, cls: number|null, contrastOk: boolean|null }}
 */
export function evidenceFromGates({ ops, a11y } = {}) {
  const worst = (id) => {
    const v = (ops?.checks ?? []).filter((c) => c.id === id && (c.status === 'pass' || c.status === 'fail') && num(c.value)).map((c) => c.value)
    return v.length ? Math.max(...v) : null
  }
  let contrastOk = null
  if (a11y && a11y.verdict !== 'tool' && a11y.routes) {
    const rows = Object.values(a11y.routes)
    contrastOk = rows.length && rows.every((r) => r.verdict !== 'tool') ? !rows.some((r) => (r.failures ?? []).some((f) => /color-contrast/.test(f))) : null
  }
  return { lcpMs: worst('lcp'), cls: worst('cls'), contrastOk }
}

// ── 깜빡임 상한(CSS) ─────────────────────────────────────────────────────────

const FLASH_PROPS = /(?:^|[{;\s])(opacity|background(?:-color)?|color|filter|visibility|box-shadow|outline(?:-color)?|border-color)\s*:/
const toSeconds = (n, unit) => (unit === 'ms' ? Number(n) / 1000 : Number(n))

function blocksOf(css, openRe) {
  const out = []
  for (const m of css.matchAll(openRe)) {
    let depth = 1, i = m.index + m[0].length
    const start = i
    while (i < css.length && depth > 0) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++ }
    out.push({ head: m[1], body: css.slice(start, i - 1) })
  }
  return out
}

/**
 * 무한 반복하는 「깜빡이는」 @keyframes(불투명도·색·필터·그림자 … 를 바꾸는 것)의 초당 반복 횟수 중 가장 큰 값. 한 번 반복 = 깜빡임 한 번(상한).
 * 회전·이동(transform 만 바꾸는 것)은 깜빡임이 아니라 센 대상이 아니다. 없으면 0.
 */
export function staticFlashRate(css) {
  const flashy = new Set(blocksOf(css, /@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{/g).filter((k) => FLASH_PROPS.test(k.body)).map((k) => k.head))
  if (!flashy.size) return 0
  let rate = 0
  for (const rule of blocksOf(css, /([^{}@]+)\{/g)) {
    // 선언 한 줄씩: animation 단축형 · animation-name/-duration/-iteration-count 나뉜 것
    const decls = Object.fromEntries(rule.body.split(';').map((d) => d.split(/:(.*)/s).map((x) => x?.trim())).filter(([k, v]) => k && v).map(([k, v]) => [k.toLowerCase(), v]))
    const short = decls.animation ?? decls['-webkit-animation']
    const name = short ? (short.split(/\s+/).find((t) => flashy.has(t))) : decls['animation-name']?.split(',').map((x) => x.trim()).find((t) => flashy.has(t))
    if (!name) continue
    const infinite = short ? /\binfinite\b/.test(short) : /\binfinite\b/.test(decls['animation-iteration-count'] ?? '')
    if (!infinite) continue
    const t = (short ?? decls['animation-duration'] ?? '').match(/(\d*\.?\d+)\s*(ms|s)\b/)
    if (!t) continue
    const secs = toSeconds(t[1], t[2])
    if (secs > 0) rate = Math.max(rate, 1 / secs)
  }
  return Math.round(rate * 1000) / 1000
}

// ── Chrome: 동작 줄이기에서 정지 화면인가 ────────────────────────────────────

const PROFILES = [{ id: 'desktop', width: 1440, height: 900 }, { id: 'mobile', width: 375, height: 812 }]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 쪽 안에서 도는 자기완결 함수(toString 으로 보낸다) — 동작 줄이기가 걸린 뒤 호출한다. */
export async function reducedProbe() {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms))
  const elements = () => [...document.body.querySelectorAll('*')].slice(0, 1500)
  const sig = (el) => { const c = getComputedStyle(el); return [c.opacity, c.transform, c.backgroundColor, c.color, c.filter, c.clipPath, c.visibility].join('|') }
  const name = (el) => `${el.tagName.toLowerCase()}${el.getAttribute('data-block') ? `[${el.getAttribute('data-block')}]` : el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/)[0]}` : ''}`
  await pause(1500) // 등장 연출이 있어도 끝난 뒤(동작 줄이기면 이미 끝 상태여야 한다)
  // 표본을 어긋난 간격(310·470·650 ms)으로 네 번 잡는다 — 같은 간격으로 두 번만 보면 주기와 간격이 맞물려(예: 100 ms 깜빡임을 800 ms 간격으로) 같은 위상만 보게 된다.
  const first = elements(); const a = first.map(sig)
  const changed = new Set(); let countChanged = false
  for (const gap of [310, 470, 650]) {
    await pause(gap)
    const next = elements()
    if (next.length !== first.length) { countChanged = true; continue }
    next.forEach((el, i) => { if (sig(el) !== a[i]) changed.add(i) })
  }
  const moving = countChanged ? ['요소 수가 바뀜'] : [...changed].map((i) => name(first[i]))
  const infinite = document.getAnimations().filter((x) => x.playState === 'running' && x.effect?.getComputedTiming().iterations === Infinity).map((x) => x.animationName ?? x.constructor.name)
  const videos = [...document.querySelectorAll('video')].filter((v) => !v.paused && !v.ended).map(() => 'video 재생 중')
  const hidden = []
  for (const el of elements()) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    if (el.closest('[aria-hidden="true"], [hidden], script, style, noscript, template')) continue
    const r = el.getBoundingClientRect()
    if (!(r.width > 1 && r.height > 1)) continue
    let eff = 1, vis = true
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const c = getComputedStyle(n); eff *= Number(c.opacity); if (c.display === 'none') vis = false }
    if (!vis) continue
    if (eff < 0.95 || getComputedStyle(el).visibility === 'hidden') hidden.push(`${name(el)} 불투명도 ${Math.round(eff * 100) / 100}`)
  }
  let css = ''
  for (const sh of document.styleSheets) { try { for (const rule of sh.cssRules) css += rule.cssText + '\n' } catch { /* 다른 출처 CSS */ } }
  return { moving: moving.slice(0, 5), movingCount: moving.length, infinite: [...infinite, ...videos].slice(0, 5), infiniteCount: infinite.length + videos.length, hidden: hidden.slice(0, 5), hiddenCount: hidden.length, css: css.slice(0, 2_000_000) }
}

/**
 * 쪽마다 1440·375 에서 동작 줄이기를 걸고 정지 화면인지 잰다. 열리지 않으면 던진다(`도구 실패:` 로 읽힌다).
 * @returns {Promise<{ route: string, static: boolean, problems: string[], flashesPerSec: number }[]>}
 */
export async function measureBold(origin, routes, { chromeArgs = [] } = {}) {
  // cdp.mjs 는 읽을 때 명령줄에서 --session 을 떼어 가므로, 판정만 쓰는 쪽(directions.mjs 가 boldModeFor 를 부른다)이 끌려오지 않게 쓸 때 읽는다.
  const { assertOpened, connect, navigateAndWait, startChrome } = await import('./cdp.mjs')
  const chrome = await startChrome(['--hide-scrollbars', ...chromeArgs], { prefix: 'bold-' })
  try {
    const s = await connect(chrome.wsUrl)
    await s.send('Page.enable'); await s.send('Runtime.enable')
    await s.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const out = []
    for (const route of routes) {
      const problems = []
      let flashes = 0
      for (const prof of PROFILES) {
        await s.send('Emulation.setDeviceMetricsOverride', { width: prof.width, height: prof.height, deviceScaleFactor: 1, mobile: false })
        const target = `${origin}${route}`
        await assertOpened(await navigateAndWait(s.send, s.ev, target, { timeoutMs: 60000 }), s.ev, target)
        await s.ev('document.fonts.ready.then(() => 1)'); await sleep(300)
        const reduced = await s.ev('matchMedia("(prefers-reduced-motion: reduce)").matches')
        if (reduced !== true) throw new Error(`동작 줄이기 에뮬레이션이 안 걸렸다: ${target}`)
        const r = await s.ev(`(${reducedProbe.toString()})()`)
        if (!r) throw new Error(`페이지 측정 실패(reducedProbe 가 값을 안 줬다): ${target}`)
        if (r.movingCount) problems.push(`${route} ${prof.width}px: 동작 줄이기에서 값이 바뀌는 요소 ${r.movingCount}개 — ${r.moving.join(', ')}`)
        if (r.infiniteCount) problems.push(`${route} ${prof.width}px: 동작 줄이기에서 무한 반복·재생 중인 것 ${r.infiniteCount}개 — ${r.infinite.join(', ')}`)
        if (r.hiddenCount) problems.push(`${route} ${prof.width}px: 동작 줄이기에서 숨은 글 ${r.hiddenCount}곳 — ${r.hidden.join(', ')}`)
        flashes = Math.max(flashes, staticFlashRate(r.css))
      }
      out.push({ route, static: problems.length === 0, problems, flashesPerSec: flashes })
    }
    s.ws.close()
    return out
  } finally {
    await chrome.close()
  }
}

// ── 후보 어댑터(07-qa 가 부른다) ─────────────────────────────────────────────

/**
 * 대담안 후보 하나를 판정한다. 기록 모양은 ops·a11y·strict 어댑터와 같다: { id, tool, exit, verdict, toolFailure, note, problems, resultFile? }.
 * LCP·CLS·대비는 07-qa 가 이미 돌린 ops·a11y 결과를 읽고(다시 재지 않는다), 이 어댑터가 새로 재는 것은 동작 줄이기 정지 확인과 깜빡임 상한뿐이다.
 * @param {{ origin: string, routes: string[], archetype: string, boldMode?: string, ops?: object|null, a11y?: object|null, measure?: Function }} opts
 *   ops = ops-gate.json 내용 · a11y = a11y 어댑터 기록(둘 다 없거나 도구 실패면 재지 못한 것이라 도구 실패) · measure(origin, routes) = measureBold 모양(시험이 가짜로 바꾼다)
 */
export async function boldSafetyForCandidate(runDir, cand, { origin, routes, archetype, boldMode, ops, a11y, measure = measureBold } = {}) {
  if (!origin || !routes?.length || !archetype) throw new Error('boldSafetyForCandidate: origin·routes·archetype 가 필요하다')
  const candDir = join(runDir, cand.id)
  const dir = join(candDir, '07-qa', 'bold-safety')
  const file = join(dir, 'bold-safety.json')
  rmSync(file, { force: true })
  mkdirSync(dir, { recursive: true })
  const t0 = Date.now()
  const secs = () => Math.round((Date.now() - t0) / 100) / 10
  const base = { id: 'bold-safety', tool: 'bold-safety', attempts: 1 }
  const tool = (note) => ({ ...base, exit: 1, verdict: 'tool', toolFailure: true, note: `도구 실패: ${note}`, seconds: secs() })

  const ev = evidenceFromGates({ ops, a11y })
  const lacking = [ev.lcpMs === null && 'LCP', ev.cls === null && 'CLS', ev.contrastOk === null && '대비'].filter(Boolean)
  if (lacking.length) return tool(`재사용할 ${lacking.join('·')} 결과가 없다 — ops-gate·a11y 가 먼저 돌아 결과를 남겨야 한다`)
  let pages
  try { pages = await measure(origin, routes) } catch (e) { return tool(e.message.replace(/^도구 실패:\s*/, '')) }
  if (!pages?.length) return tool('동작 줄이기 정지 확인에서 잰 쪽이 없다')

  const measured = { archetype, boldMode, reducedMotionStatic: pages.every((p) => p.static), lcpMs: ev.lcpMs, cls: ev.cls, flashesPerSec: Math.max(...pages.map((p) => p.flashesPerSec ?? 0)), contrastOk: ev.contrastOk }
  const j = judgeBold(measured)
  const problems = [...j.failures.map((f) => f.message), ...pages.flatMap((p) => p.problems ?? [])]
  const record = {
    ...base, exit: j.ok ? 0 : 1, verdict: j.ok ? 'pass' : 'fail', toolFailure: false,
    note: j.ok ? '' : `대담안 안전 기준 ${j.failures.length}건: ${j.failures.map((f) => f.id).join('·')}`, problems: j.ok ? [] : problems,
    boldMode: j.boldMode, measured: { lcpMs: measured.lcpMs, cls: measured.cls, flashesPerSec: measured.flashesPerSec, reducedMotionStatic: measured.reducedMotionStatic, contrastOk: measured.contrastOk }, seconds: secs(),
  }
  writeFileSync(file, JSON.stringify({ candidate: cand.id, archetype, origin, measured, judge: j, pages }, null, 2) + '\n')
  record.resultFile = file.slice(candDir.length + 1).replace(/\\/g, '/')
  return record
}
