// 접근성 행렬 관문(P3-4 Task 3): node a11y-gate.mjs <url> [--out <dir>] [--modes light,dark,forced-colors] [--widths 1440,375] [--require id,id]
// 한 쪽을 「모드 3개 × 폭 2개」로 열어 두 가지를 잰다.
//  1) axe-core(규칙 태그 wcag2a·wcag2aa·wcag21aa·wcag22aa) — 모드마다: 라이트 · 다크(prefers-color-scheme) · 강제 색(forced-colors: active). critical·serious 는 실패, 그 밖(moderate·minor)은 경고.
//     각 규칙에 KWCAG 2.2 검사항목을 붙인다(data/kwcag-map.json).
//  2) WCAG 2.2 행동 검사(라이트에서 폭마다 — axe 가 못 재는 것): focus-not-obscured(2.4.11) · redundant-entry(3.3.7) · authentication(3.3.8) · target-size(2.5.8).
// 모드는 Emulation.setEmulatedMedia 로 건다 — 걸렸는지는 matchMedia 로 다시 읽는다(안 걸렸으면 도구 실패). 동작 줄이기도 함께 걸어 등장 애니메이션 중간 색을 재지 않는다.
// 종료: 0 = 쟀고 실패 없음 · 1 = 쟀고 실패 있음(결과 파일 있음) 또는 도구 실패(「도구 실패:」를 적고 결과 파일을 남기지 않는다 — 이전 파일도 지운다) · 2 = 인자 오류. 표: docs/agents/agent-guide.md §3.
// 「잴 것이 없음」(na)은 통과가 아니다 — 요약에 따로 세고, --require 로 지목한 행동이 na 면 실패다(A123).
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertOpened, connect, navigateAndWait, startChrome } from './cdp.mjs'
import { ENTERED_WAIT, hitJudge, pageMeasure, EXCEPTIONS } from './hit-area.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const RULE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
export const MODES = ['light', 'dark', 'forced-colors']
export const WIDTHS = [1440, 375]
export const BEHAVIOR_IDS = ['focus-not-obscured', 'redundant-entry', 'authentication', 'target-size']
export const FAIL_IMPACTS = new Set(['critical', 'serious'])
export const KWCAG = JSON.parse(readFileSync(join(here, 'data', 'kwcag-map.json'), 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export class ToolFailure extends Error {}
const toolFail = (msg) => new ToolFailure(msg)

/** axe 규칙 id → { kwcag, item } (없으면 null 항목). */
export const kwcagFor = (rule) => {
  const id = KWCAG.axe[rule] ?? null
  return { kwcag: id, item: id ? KWCAG.items[id] : null }
}

/** 모드 → CDP 미디어 기능 목록(setEmulatedMedia 는 목록을 통째로 바꾼다). 동작 줄이기는 늘 켠다 — 등장 도중의 색을 재지 않게. */
export const featuresFor = (mode) => {
  if (!MODES.includes(mode)) throw new Error(`모르는 모드: ${mode}`)
  return [
    { name: 'prefers-color-scheme', value: mode === 'dark' ? 'dark' : 'light' },
    { name: 'forced-colors', value: mode === 'forced-colors' ? 'active' : 'none' },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]
}

// ── 판정(순수) ──────────────────────────────────────────────────────────────

/**
 * 잰 것 → 실패·경고 줄. violations: [{ rule, impact, mode, width, nodes }], behaviors: [{ id, status, detail? }].
 * critical·serious 는 실패, moderate·minor 는 경고. 행동이 fail 이면 실패. require 로 지목한 행동이 na 면 실패(잴 것이 없음은 통과가 아니다).
 */
export function judgeA11y({ violations = [], behaviors = [] }, { require = [] } = {}) {
  const failures = [], warnings = []
  for (const v of violations) {
    const line = `axe ${v.rule}(${v.impact}) ${v.mode}·${v.width}px ${v.nodes?.length ?? v.count ?? 0}곳`
    ;(FAIL_IMPACTS.has(v.impact) ? failures : warnings).push(line)
  }
  for (const b of behaviors) {
    if (b.status === 'fail') failures.push(`행동 ${b.id}: ${(b.detail?.fail ?? []).slice(0, 3).join(' | ') || '실패'}`)
    else if (b.status === 'na' && require.includes(b.id)) failures.push(`행동 ${b.id}: 잴 것이 없음(na)인데 필수로 지목됨 — 통과가 아니다`)
    for (const w of b.detail?.warn ?? []) warnings.push(`행동 ${b.id}: ${w}`)
  }
  return { failures, warnings }
}

/** 폭마다의 행동 결과 → 행동 하나: 하나라도 fail 이면 fail, 아니면 pass 가 하나라도 있으면 pass, 없으면 na. */
export function mergeBehavior(id, byWidth) {
  const list = Object.entries(byWidth)
  const status = list.some(([, r]) => r.status === 'fail') ? 'fail' : list.some(([, r]) => r.status === 'pass') ? 'pass' : 'na'
  const fail = list.flatMap(([w, r]) => (r.fail ?? []).map((f) => `${w}px ${f}`))
  const warn = list.flatMap(([w, r]) => (r.warn ?? []).map((f) => `${w}px ${f}`))
  const map = KWCAG.behaviors[id] ?? {}
  return { id, wcag: map.wcag ?? null, kwcag: map.kwcag ?? null, status, byWidth: Object.fromEntries(list.map(([w, r]) => [w, r.status])), detail: { fail, warn, measured: Object.fromEntries(list.map(([w, r]) => [w, r.measured ?? 0])) } }
}

// ── 페이지 안에서 도는 검사 ──────────────────────────────────────────────────
// 함수는 toString 으로 페이지에 보낸다(이스케이프 실수를 피한다). 밖의 값은 인자로만 받는다.

/** 초점 하나의 가림: 보이는 상자 안 9점을 elementFromPoint 로 눌러 보아, 초점 요소와 무관한 고정·스티키 요소가 덮은 점을 센다. */
function focusProbe(ignore) {
  const a = document.activeElement
  if (!a || a === document.body || a === document.documentElement) return null
  const seen = (window.__a11ySeen ??= new WeakSet())
  if (seen.has(a)) return { seen: true }
  seen.add(a)
  const name = (a.getAttribute('aria-label') || a.innerText || a.getAttribute('placeholder') || a.tagName).trim().replace(/\s+/g, ' ').slice(0, 28)
  const r = a.getBoundingClientRect()
  if (r.width < 4 || r.height < 4) return { skip: 'tiny', name } // 시각적으로 숨긴 입력(자리를 다른 요소가 그린다)
  const x0 = Math.max(r.left, 0), x1 = Math.min(r.right, innerWidth), y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, innerHeight)
  if (x1 - x0 < 2 || y1 - y0 < 2) return { skip: 'offscreen', name }
  const fixedOf = (n) => { for (let e = n; e && e !== document.documentElement; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e } return null }
  let covered = 0, total = 0, by = null
  for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.1, 0.5, 0.9]) {
    total++
    const h = document.elementFromPoint(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy)
    if (!h || h === a || a.contains(h) || h.contains(a)) continue
    const f = fixedOf(h)
    if (!f || f.contains(a) || a.contains(f) || (ignore && f.closest(ignore))) continue
    covered++
    by ??= `${f.tagName.toLowerCase()}${f.id ? `#${f.id}` : ''}${f.className && typeof f.className === 'string' ? `.${f.className.trim().split(/\s+/)[0]}` : ''}`
  }
  return { name, covered, total, by }
}

/** 로그인·인증 칸: 붙여넣기 이벤트를 막는지(취소 가능한 paste 를 보내 defaultPrevented 를 읽는다) · autocomplete · 인지 시험(글자 그림·보안 질문). */
function authProbe() {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const ac = (e) => (e.getAttribute('autocomplete') || '').trim().toLowerCase()
  const last = (e) => ac(e).split(/\s+/).filter(Boolean).at(-1) ?? ''
  const inputs = [...document.querySelectorAll('input')].filter((e) => vis(e) && !e.disabled && !['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(e.type))
  const hasPw = (e) => e.form && [...e.form.elements].some((x) => x.type === 'password')
  const auth = inputs.filter((e) => e.type === 'password' || last(e) === 'one-time-code' || (['username', 'email'].includes(last(e)) && hasPw(e)))
  const fields = auth.map((e) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', 'x')
    const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt })
    e.dispatchEvent(ev)
    return { name: e.name || e.id || e.type, type: e.type, autocomplete: ac(e), pasteBlocked: ev.defaultPrevented }
  })
  const qRe = /보안 ?질문|어머니.{0,6}(성|이름)|첫 ?애완|mother'?s maiden|first pet|security question/i
  const cognitive = []
  for (const c of document.querySelectorAll('[class*="captcha" i],[id*="captcha" i],[data-captcha]')) {
    if (!vis(c)) continue
    const typed = c.querySelector('input[type=text],input:not([type])')
    const alt = !!c.closest('[data-auth-alternative]') || !!c.querySelector('[data-auth-alternative]')
    if (typed && !alt) cognitive.push(`글자·수식을 입력하는 캡차(${c.id || String(c.className).slice(0, 30)})`)
  }
  for (const e of inputs) {
    const label = (e.labels?.[0]?.innerText || e.getAttribute('aria-label') || e.placeholder || '').trim()
    if (qRe.test(label) && !e.closest('[data-auth-alternative]')) cognitive.push(`보안 질문 칸(${label.slice(0, 24)})`)
  }
  return { fields, cognitive }
}

/** 보이는 입력칸 목록(체크·라디오·버튼 제외). 키 = autocomplete 토큰(있으면) 아니면 name·id. 비밀번호·일회용 코드는 보안 예외라 security. */
function fieldsProbe() {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const els = [...document.querySelectorAll('input, textarea, select')].filter((e) => vis(e) && !e.disabled && !['hidden', 'submit', 'button', 'reset', 'image', 'file', 'checkbox', 'radio', 'range', 'color'].includes(e.type))
  const old = new WeakSet(window.__a11yF ?? [])
  window.__a11yF = els
  return els.map((e, i) => {
    const ac = (e.getAttribute('autocomplete') || '').trim().toLowerCase()
    const tokens = ac.split(/\s+/).filter((t) => t && !t.startsWith('section-'))
    const generic = tokens.length === 0 || ['on', 'off'].includes(tokens.at(-1))
    return {
      i, fresh: !old.has(e), key: generic ? (e.name || e.id || '') : tokens.join(' '),
      security: e.type === 'password' || /password|one-time-code/.test(ac),
      value: e.value, name: e.name || e.id || '', form: e.form ? [...document.forms].indexOf(e.form) : -1,
      label: (e.labels?.[0]?.innerText || e.getAttribute('aria-label') || e.placeholder || '').trim().slice(0, 30),
    }
  })
}

/** 비어 있는 칸을 채우고(입력 이벤트 포함) 다음으로 넘어가는 버튼을 누른다 → 누른 버튼 글자 또는 null. */
function fillAndAdvance() {
  const sample = (e) => ({ email: 'qa@example.com', tel: '01012345678', number: '1', date: '2026-01-01', url: 'https://example.com', password: 'Passw0rd!x1' }[e.type] ?? 'test')
  for (const e of window.__a11yF ?? []) {
    if (!e.isConnected) continue
    let v = e.value
    if (e.tagName === 'SELECT') { if (!v) v = [...e.options].find((o) => o.value)?.value ?? '' } else if (!v) v = sample(e)
    if (v === e.value) continue
    const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, v)
    e.dispatchEvent(new Event('input', { bubbles: true }))
    e.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const last = (window.__a11yF ?? []).filter((e) => e.isConnected).at(-1)
  if (!last) return null
  const scope = last.closest('form') ?? last.closest('[data-flow]') ?? document
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' }
  const back = /이전|뒤로|back|cancel|취소|건너|skip|닫기/i
  const btns = [...scope.querySelectorAll('button, input[type=submit], [role=button]')].filter((b) => vis(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true')
  const text = (b) => (b.innerText || b.value || b.getAttribute('aria-label') || '').trim()
  const b = btns.find((x) => x.type === 'submit' && !back.test(text(x))) ?? btns.find((x) => /다음|계속|next|continue|확인|시작/i.test(text(x)) && !back.test(text(x)))
  if (!b) return null
  const label = text(b)
  b.click()
  return label || b.tagName
}

// ── 행동 검사(Node 쪽) ──────────────────────────────────────────────────────

const tab = async (send, shift = false) => {
  const base = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: shift ? 8 : 0 }
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  await sleep(60)
}

/** 2.4.11 — Tab 으로 초점을 옮기며 초점 요소가 고정·스티키 요소에 통째로 가려지는지. */
export async function checkFocusNotObscured({ send, ev }, { maxTabs = 80, ignore = null } = {}) {
  await ev(`window.__a11ySeen = new WeakSet(); scrollTo(0, 0); document.activeElement?.blur?.()`)
  const fail = [], warn = []
  let measured = 0, partial = 0, nulls = 0
  for (let i = 0; i < maxTabs; i++) {
    await tab(send)
    const s = await ev(`(${focusProbe.toString()})(${JSON.stringify(ignore)})`)
    if (s === null) { if (++nulls >= 2) break; continue }
    nulls = 0
    if (s.seen) break
    if (s.skip) continue
    measured++
    if (s.covered === s.total) fail.push(`「${s.name}」이(가) ${s.by} 에 통째로 가려진다`)
    else if (s.covered > 0) partial++
  }
  if (partial) warn.push(`초점 ${partial}곳이 일부 가려진다(2.4.11 은 통째로만 실패)`)
  await ev('scrollTo(0, 0)')
  return { status: measured === 0 ? 'na' : fail.length ? 'fail' : 'pass', measured, fail, warn }
}

/** 3.3.8 — 인증 칸에서 붙여넣기를 막지 않고, autocomplete 가 꺼져 있지 않고, 인지 시험(글자 캡차·보안 질문)이 없는지. */
export async function checkAuthentication({ ev }) {
  const r = await ev(`(${authProbe.toString()})()`)
  const fail = [], warn = []
  for (const f of r.fields) {
    if (f.pasteBlocked) fail.push(`${f.name}: 붙여넣기를 막는다`)
    if (/^(off|nope)$/.test(f.autocomplete)) fail.push(`${f.name}: autocomplete="${f.autocomplete}" — 비밀번호 관리자 입력을 막는다`)
    else if (!f.autocomplete) warn.push(`${f.name}: autocomplete 가 없다(current-password·new-password·one-time-code·username 권장)`)
  }
  for (const c of r.cognitive) fail.push(`인지 시험: ${c}`)
  const measured = r.fields.length + r.cognitive.length
  return { status: measured === 0 ? 'na' : fail.length ? 'fail' : 'pass', measured, fail, warn }
}

/** 3.3.7 — 같은 화면에 같은 값을 두 번 묻지 않고, 여러 단계 폼에서 앞 단계 값을 다시 비워 묻지 않는지(값을 채워 걷는다 — 마지막에 실행한다). */
export async function checkRedundantEntry({ ev }, { maxSteps = 5 } = {}) {
  const fail = [], warn = []
  const snap = async () => (await ev(`(${fieldsProbe.toString()})()`)) ?? []
  let fields = await snap()
  if (fields.length === 0) return { status: 'na', measured: 0, fail, warn }
  // 같은 화면 안의 겹침(보안 예외인 비밀번호 확인은 뺀다) — 단계마다 본다
  const sameScreen = (list, step) => {
    const dup = new Map()
    for (const f of list.filter((x) => x.key && !x.security)) { const k = `${f.form}|${f.key}`; dup.set(k, [...(dup.get(k) ?? []), f]) }
    for (const g of dup.values()) if (g.length > 1) fail.push(`${step}단계 한 화면에서 같은 값을 두 번 묻는다: ${g.map((f) => `「${f.label || f.name}」`).join('·')}(${g[0].key})`)
  }
  sameScreen(fields, 1)
  const filled = new Set()
  let steps = 0
  for (let n = 0; n < maxSteps; n++) {
    for (const f of fields) if (f.key && !f.security) filled.add(f.key)
    const url0 = await ev('location.href')
    let clicked
    try { clicked = await ev(`(${fillAndAdvance.toString()})()`) } catch { break }
    if (!clicked) break
    await sleep(500)
    if ((await ev('location.href')) !== url0) break // 실제 이동 — 이 문서는 끝
    const next = await snap()
    if (next.length === 0) break
    const same = next.length === fields.length && next.every((f, i) => f.name === fields[i].name && f.key === fields[i].key)
    if (same) break // 검증에 막혀 안 넘어갔다
    steps++
    sameScreen(next, steps + 1)
    for (const f of next) if (f.fresh && f.key && !f.security && filled.has(f.key) && f.value === '') fail.push(`${steps + 1}단계가 앞에서 넣은 「${f.label || f.name}」(${f.key})을 다시 비워 묻는다`)
    fields = next
  }
  return { status: steps === 0 && !fail.length ? 'na' : fail.length ? 'fail' : 'pass', measured: steps, fail, warn }
}

/** 2.5.8 — 누를 수 있는 것이 24 CSS px 이상인가. 부품 슬롯 안은 hit-area 와 같은 측정·예외 표(문턱만 24), 모든 요소는 axe target-size(간격 예외 포함)가 함께 본다. */
export async function checkTargetSize({ ev }, axeResult) {
  const rows = (await ev(`(${pageMeasure.toString()})(${JSON.stringify(EXCEPTIONS.exceptions.filter((r) => !r.pointer || r.pointer === 'fine'))})`)) ?? []
  const { fail } = hitJudge(rows, [], 24)
  const axeTs = axeResult.violations.find((v) => v.id === 'target-size')
  if (axeTs) for (const n of axeTs.nodes) fail.push(`axe target-size: ${(n.target ?? []).join(' ')}`)
  const axeApplicable = axeResult.passes.includes('target-size') || !!axeTs || axeResult.incomplete.some((x) => x.id === 'target-size')
  const measured = rows.length + (axeApplicable ? 1 : 0)
  return { status: measured === 0 ? 'na' : fail.length ? 'fail' : 'pass', measured, fail, warn: [] }
}

// ── axe ─────────────────────────────────────────────────────────────────────

// 면제(운영자 결정 A180·A5): 플랫폼 로그인 버튼([data-social] — 네이버 #03C75A 위 흰 글자 등)은 플랫폼 규격색이라 대비를 고치지 않는다. blocks:gates 의 contrast 는 이미 이 표지를 뺀다(A5).
// 여기서는 axe color-contrast 규칙의 결과 노드 중 [data-social] 요소와 그 자손만 뺀다 — 다른 규칙·다른 노드는 그대로 실패한다. 뺀 것은 결과 파일 exempt 에 남긴다(조용히 지우지 않는다).
export const A11Y_EXEMPT = { selector: '[data-social]', rules: ['color-contrast'], reason: '플랫폼 로그인 규격색 — 운영자 결정 A180·A5' }

let axeSource = null
const axeJs = () => (axeSource ??= readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8'))

// 강제 색(forced-colors: active)에서 Chrome 은 `color` 는 시스템 색으로 바꾸지만 `-webkit-text-fill-color`(기본 currentcolor)의 계산 값은 작성자 색 그대로 돌려준다(실측 2026-09-30: 버튼 color rgb(0,0,0) ·
// -webkit-text-fill-color #f1f2ef, 화면은 검정 글씨). axe 4.13 은 그 칸을 `color` 보다 먼저 읽어(getTextColor) 실제로는 읽히는 글씨를 대비 실패로 센다 — 갤러리 120블록 중 52블록이 이 거짓 양성이었다.
// 그래서 강제 색일 때만 페이지의 getComputedStyle 을 감싸, UA 가 색을 강제하는 요소(forced-color-adjust 가 none 이 아닌 것)의 -webkit-text-fill-color 를 빈 값으로 돌려준다 —
// axe 는 빈 값이면 `color`(강제된 값)로 넘어간다. currentcolor 로 다시 못 박는 방법은 소용없었다(currentcolor 도 강제 전 색으로 풀린다, 실측). 작성자가 forced-color-adjust: none 으로 깨뜨린 색
// (음성 대조 픽스처)은 그대로 잡힌다.
const FORCED_FILL_FIX = `(() => {
  if (window.__a11yForcedFill) return
  window.__a11yForcedFill = true
  const orig = window.getComputedStyle.bind(window)
  window.getComputedStyle = (el, pseudo) => {
    const cs = orig(el, pseudo)
    return new Proxy(cs, { get(t, k) {
      if (k === 'getPropertyValue') return (p) => (p === '-webkit-text-fill-color' && t.forcedColorAdjust !== 'none' ? '' : t.getPropertyValue(p))
      const v = Reflect.get(t, k, t)
      return typeof v === 'function' ? v.bind(t) : v
    } })
  }
})()`

async function runAxe({ ev }, ignore, { forced = false } = {}) {
  await ev(`${axeJs()}\n;1`)
  if (forced) await ev(FORCED_FILL_FIX)
  const context = ignore ? `{ include: [document], exclude: [[${JSON.stringify(ignore)}]] }` : 'document'
  const r = await ev(`(async () => {
    const r = await axe.run(${context}, { runOnly: { type: 'tag', values: ${JSON.stringify(RULE_TAGS)} }, resultTypes: ['violations', 'incomplete', 'passes'] })
    const cut = (n) => ({ target: n.target, html: (n.html || '').slice(0, 200), summary: (n.failureSummary || '').slice(0, 240) })
    const EX = ${JSON.stringify(A11Y_EXEMPT)}
    const exempt = []
    const inside = (n) => { try { return n.target.length === 1 && !!document.querySelector(n.target[0])?.closest(EX.selector) } catch { return false } }
    const violations = []
    for (const v of r.violations) {
      const out = EX.rules.includes(v.id) ? v.nodes.filter(inside) : []
      for (const n of out) exempt.push({ rule: v.id, selector: n.target.join(' '), reason: EX.reason })
      const nodes = out.length ? v.nodes.filter((n) => !out.includes(n)) : v.nodes
      if (nodes.length) violations.push({ ...v, nodes })
    }
    return { version: axe.version, passes: r.passes.map((x) => x.id), inapplicable: r.inapplicable.length, exempt,
      violations: violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, tags: v.tags.filter((t) => /^wcag/.test(t)), count: v.nodes.length, nodes: v.nodes.slice(0, 6).map(cut) })),
      incomplete: r.incomplete.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length, nodes: v.nodes.slice(0, 3).map(cut) })) }
  })()`)
  if (!r || !Array.isArray(r.violations)) throw toolFail('axe 가 결과를 돌려주지 않았다')
  return r
}

// ── 관문 ────────────────────────────────────────────────────────────────────

const MEDIA_CHECK = (mode) => `[matchMedia('(prefers-color-scheme: ${mode === 'dark' ? 'dark' : 'light'})').matches, matchMedia('(forced-colors: ${mode === 'forced-colors' ? 'active' : 'none'})').matches, matchMedia('(prefers-reduced-motion: reduce)').matches]`

async function load(s, url, mode, width, { modeUrl, sceneWait }) {
  await s.send('Emulation.setDeviceMetricsOverride', { width, height: width >= 1000 ? 900 : 812, deviceScaleFactor: 1, mobile: false })
  await s.send('Emulation.setEmulatedMedia', { features: featuresFor(mode) })
  const target = modeUrl ? modeUrl(mode, url) : url
  // 새 Chrome 의 첫 탐색은 프로필·디스크가 차가워 15초를 넘기기도 한다(실측: 갤러리 첫 쪽) — 기한 60초. 못 읽거나 열리지 않으면 판정이 아니라 도구 실패(C123).
  try { await assertOpened(await navigateAndWait(s.send, s.ev, target, { timeoutMs: 60000 }), s.ev, target) } catch (e) { throw toolFail(e.message) }
  const media = await s.ev(MEDIA_CHECK(mode))
  if (!media.every(Boolean)) throw toolFail(`미디어 에뮬레이션이 페이지에 걸리지 않았다(${mode}): [${media}] — 색 구성·강제 색·동작 줄이기 순서`)
  await s.ev('document.fonts.ready.then(() => 1)')
  const entered = sceneWait ? await s.ev(ENTERED_WAIT) : 'skipped'
  await sleep(300)
  return entered
}

/** Chrome 하나와 CDP 세션 하나(호출마다 기한, 페이지 예외는 던진다). 여러 쪽을 한 Chrome 으로 잴 때 a11yGate 의 session 으로 넘긴다. 끝나면 close(). */
export async function openSession() {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'a11y-' })
  try {
    const s = await connect(chrome.wsUrl, { throwOnException: true })
    await s.send('Page.enable'); await s.send('Runtime.enable')
    await s.send('Emulation.setFocusEmulationEnabled', { enabled: true }) // activeElement 가 실제 초점을 가리키게
    return { ...s, close: async () => { try { s.ws.close() } catch {} await chrome.close() } }
  } catch (e) { await chrome.close(); throw e }
}

/**
 * @param {string} url
 * @param {{ modes?: string[], widths?: number[], require?: string[], session?: {send, ev}, modeUrl?: (mode: string, url: string) => string, ignore?: string|null, sceneWait?: boolean }} [opts]
 *   session: 이미 열린 CDP 세션을 쓴다(여러 쪽을 한 Chrome 으로). modeUrl: 모드마다 주소를 바꾼다(갤러리의 &theme=). ignore: 재지 않을 검수대 띠 선택자. sceneWait: 모션 키트 장면의 등장 끝 신호를 기다린다(기본 켬 — 장면 없는 쪽은 3초 헛기다림이라 시험은 끈다).
 * @returns {Promise<{ url, axeVersion, matrix, violations, exempt, incomplete, behaviors, failures, warnings, summary, exit }>} 도구 실패는 ToolFailure 를 던진다.
 */
export async function a11yGate(url, { modes = MODES, widths = WIDTHS, require = [], session = null, modeUrl = null, ignore = null, sceneWait = true } = {}) {
  let own = null
  try {
    let s = session
    if (!s) s = own = await openSession()
    const matrix = [], violations = [], incomplete = [], exempt = []
    const beh = Object.fromEntries(BEHAVIOR_IDS.map((id) => [id, {}]))
    let axeVersion = null
    for (const width of widths) {
      for (const mode of modes) {
        const entered = await load(s, url, mode, width, { modeUrl, sceneWait })
        const axe = await runAxe(s, ignore, { forced: mode === 'forced-colors' })
        axeVersion = axe.version
        const measured = { passes: axe.passes.length, violations: axe.violations.length, incomplete: axe.incomplete.length, inapplicable: axe.inapplicable }
        if (measured.passes + measured.violations + measured.incomplete === 0) throw toolFail(`axe 가 규칙을 하나도 적용하지 못했다(${mode}·${width}px) — 빈 문서?`)
        matrix.push({ mode, width, entered, ...measured })
        for (const e of axe.exempt ?? []) exempt.push({ ...e, mode, width })
        for (const v of axe.violations) violations.push({ rule: v.id, impact: v.impact, mode, width, help: v.help, helpUrl: v.helpUrl, wcag: v.tags, ...kwcagFor(v.id), count: v.count, nodes: v.nodes })
        for (const v of axe.incomplete) incomplete.push({ rule: v.id, impact: v.impact, mode, width, count: v.count, nodes: v.nodes })
        if (mode === 'light') {
          // 행동 검사는 라이트에서 폭마다 한 번 — 읽기만 하는 것을 먼저, 값을 채우며 걷는 3.3.7 은 마지막.
          beh['focus-not-obscured'][width] = await checkFocusNotObscured(s, { ignore })
          beh.authentication[width] = await checkAuthentication(s)
          beh['target-size'][width] = await checkTargetSize(s, axe)
          beh['redundant-entry'][width] = await checkRedundantEntry(s)
        }
      }
    }
    const behaviors = BEHAVIOR_IDS.map((id) => mergeBehavior(id, beh[id])).filter((b) => Object.keys(beh[b.id]).length)
    const { failures, warnings } = judgeA11y({ violations, behaviors }, { require })
    const summary = {
      cells: matrix.length, violations: violations.length, failingRules: [...new Set(violations.filter((v) => FAIL_IMPACTS.has(v.impact)).map((v) => v.rule))],
      warnRules: [...new Set(violations.filter((v) => !FAIL_IMPACTS.has(v.impact)).map((v) => v.rule))],
      behaviors: Object.fromEntries(['pass', 'fail', 'na'].map((k) => [k, behaviors.filter((b) => b.status === k).length])),
    }
    return { url, axeVersion, modes, widths, matrix, violations, exempt, incomplete, behaviors, failures, warnings, summary: { ...summary, exempt: exempt.length }, exit: failures.length ? 1 : 0 }
  } finally {
    await own?.close()
  }
}

// ── 후보 묶음 어댑터(07-qa 가 부른다 — qa.mjs 배선은 컨트롤러 몫) ─────────────────

const slugOf = (route) => (route === '/' ? 'home' : route.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase())

/** 노드 스크립트를 비동기로 돌린다(spawnSync 를 쓰지 않는다). 기한이 지나면 죽이고 exit = null. */
export function runA11yTool(args, { timeoutMs = 600_000 } = {}) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [join(here, 'a11y-gate.mjs'), ...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let stderr = ''
    child.stderr.on('data', (d) => { stderr += d })
    let over = false
    const timer = setTimeout(() => { over = true; stderr += `\n도구 실패: ${timeoutMs / 1000}초 안에 끝나지 않아 죽였다`; child.kill() }, timeoutMs)
    child.on('error', (e) => { clearTimeout(timer); done({ exit: null, stderr: `${stderr}\n도구 실패: ${e.message}` }) })
    child.on('close', (code) => { clearTimeout(timer); done({ exit: over ? null : code, stderr }) })
  })
}

/**
 * 후보 하나의 쪽마다 a11y-gate 를 돌려 07-qa 게이트 칸 하나를 만든다(qa.mjs 의 게이트 기록과 같은 모양).
 * 결과 파일: <runDir>/<cand.id>/07-qa/a11y/a11y-gate.json(쪽별 요약 합본). 도구 실패(쪽 하나라도)는 exit 1 + toolFailure — 판정이 아니다.
 * @returns {Promise<{ id: 'a11y', tool: 'a11y', exit: number, verdict: 'pass'|'fail'|'tool', toolFailure: boolean, resultFile?: string, note: string, routes: object }>}
 */
export async function a11yGateForCandidate(runDir, cand, { origin, routes, runTool = runA11yTool, timeoutMs } = {}) {
  if (!origin || !routes?.length) throw new Error('a11yGateForCandidate: origin 과 routes 가 필요하다')
  const candDir = join(runDir, cand.id)
  const dir = join(candDir, '07-qa', 'a11y')
  const file = join(dir, 'a11y-gate.json')
  rmSync(file, { force: true })
  mkdirSync(dir, { recursive: true })
  const t0 = Date.now()
  const per = {}
  for (const route of routes) {
    const out = join(dir, slugOf(route))
    rmSync(join(out, 'a11y-gate.json'), { force: true })
    const run = await runTool([`${origin}${route}`, '--out', out], timeoutMs ? { timeoutMs } : undefined)
    let result = null
    try { result = JSON.parse(readFileSync(join(out, 'a11y-gate.json'), 'utf8')) } catch {}
    const say = /도구 실패:[^\n]*/.exec(run.stderr ?? '')?.[0]
    if (run.exit === null || run.exit === 2 || (run.exit !== 0 && (say || !result)) || (run.exit === 0 && !result)) {
      per[route] = { verdict: 'tool', exit: run.exit, note: say ?? (run.exit === 2 ? '인자 오류(종료 2)' : run.exit === null ? '신호·시간 초과' : run.exit === 0 ? '종료 0 인데 결과 파일이 없다' : `종료 ${run.exit} 인데 결과 파일이 없다`) }
    } else per[route] = { verdict: run.exit === 0 ? 'pass' : 'fail', exit: run.exit, failures: result.failures, warnings: result.warnings.length, summary: result.summary }
  }
  const tool = Object.entries(per).filter(([, r]) => r.verdict === 'tool')
  const bad = Object.entries(per).filter(([, r]) => r.verdict === 'fail')
  const verdict = tool.length ? 'tool' : bad.length ? 'fail' : 'pass'
  const note = tool.length ? tool.map(([r, x]) => `${r}: ${x.note}`).join(' · ') : bad.length ? `접근성 실패 ${bad.length}쪽: ${bad.map(([r, x]) => `${r}(${x.failures.length}건)`).join(' · ')}` : ''
  const record = { id: 'a11y', tool: 'a11y', exit: verdict === 'pass' ? 0 : 1, verdict, toolFailure: verdict === 'tool', note, attempts: 1, seconds: Math.round((Date.now() - t0) / 100) / 10, routes: per }
  if (verdict !== 'tool') {
    writeFileSync(file, JSON.stringify({ candidate: cand.id, origin, routes: per }, null, 2) + '\n')
    record.resultFile = file.slice(candDir.length + 1).replace(/\\/g, '/')
  }
  return record
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const main = async () => {
  const argv = process.argv.slice(2)
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d }
  const out = flag('--out', join('.tmp', 'a11y-gate'))
  const modes = flag('--modes', MODES.join(',')).split(',')
  const widths = flag('--widths', WIDTHS.join(',')).split(',').map(Number)
  const require = flag('--require', '').split(',').filter(Boolean)
  const sceneWait = !argv.includes('--no-scene-wait')
  if (!sceneWait) argv.splice(argv.indexOf('--no-scene-wait'), 1)
  const [url] = argv
  if (!url || !modes.every((m) => MODES.includes(m)) || widths.some((w) => !(w > 0)) || !require.every((r) => BEHAVIOR_IDS.includes(r))) {
    console.error(`사용: a11y-gate.mjs <url> [--out dir] [--modes ${MODES.join(',')}] [--widths 1440,375] [--require ${BEHAVIOR_IDS.join(',')}]`)
    process.exit(2)
  }
  const file = join(out, 'a11y-gate.json')
  mkdirSync(out, { recursive: true })
  rmSync(file, { force: true }) // 앞 실행의 결과를 도구 실패 뒤에 남기지 않는다
  let code = 0
  try {
    const r = await a11yGate(url, { modes, widths, require, sceneWait })
    writeFileSync(file, JSON.stringify(r, null, 2) + '\n')
    console.log(JSON.stringify({ url, cells: r.matrix.length, axe: r.axeVersion, violations: r.violations.length, exempt: r.exempt.length, behaviors: Object.fromEntries(r.behaviors.map((b) => [b.id, b.status])), fail: r.failures.length, warn: r.warnings.length }))
    for (const f of r.failures) console.error(`FAIL ${f}`)
    code = r.exit
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    rmSync(file, { force: true })
    code = 1
  }
  process.exit(code)
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
