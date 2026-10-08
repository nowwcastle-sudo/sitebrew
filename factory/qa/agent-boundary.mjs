// 에이전트 승인 경계 관문(P3-7 AXWF · 감사 M02, 규칙 G11·R18·R19, factory-rules.md §23-7 U20):
//   node factory/qa/agent-boundary.mjs <url>… --out <dir> [--width 1440] [--session <장면>]       렌더된 쪽(주소 여럿)
//   node factory/qa/agent-boundary.mjs --gallery <origin> --out <dir> [--recipe r1-measure] [--blocks a,b]   갤러리 블록(행동 표의 블록 전부)
//   node factory/qa/agent-boundary.mjs --source [--out <dir>]                                     원천 검사(브라우저 없음)
// 행동 표의 정본은 `registry/factory/contract/human-actions.ts` 한 곳이다(에이전트가 해도 되는 행동 / 사람 승인이 필요한 행동 / 사람이 마지막에 누르는 폼).
// 렌더 판정(쪽마다):
//   · toolname-contains-human-approval — WebMCP `toolname` 이 달린 <form> 안에 승인 표지(`data-requires-human`)·비밀번호 칸이 있다(R19).
//   · toolname-contains-consent        — `toolname` 폼 안에 동의 칸(`[data-consent]`·`withdrawalConsent`·이름에 consent 가 든 체크)이 있다 — 에이전트가 사람 대신 동의를 누를 수 있다(G11a).
//   · toolname-is-human-approval       — `toolname` 이 승인 행동의 이름(표의 id·결제·삭제·해지·가입·구독·동의·비밀번호 낱말)이다.
//   · toolautosubmit-present           — `toolautosubmit` 속성이 쪽 어디에든 있다(에이전트는 채우고 사람이 누른다 — §20-6).
//   · human-control-no-hint            — `data-requires-human` 컨트롤이 가리키는(aria-describedby) 눈에 보이는 안내 글이 없다(없거나·숨겨졌거나·화면 밖 글 sr-only·비었다).
//   · hint-too-long                    — 안내 글이 60자를 넘는다(「짧은」 안내 한 줄).
//   · unknown-action                   — `data-requires-human` 값이 표의 승인 행동 id 가 아니다.
// 원천 판정(--source): 표에 적힌 블록이 정말 표지를 단다 · 승인 포트 메서드(`.run(() => checkout(` …)를 부르는데 표에 없다 · `agentFormAttrs` 를 쓰는 블록이 승인 표지를 단다 ·
//   `toolautosubmit` 속성 코드 · 표 자체의 모양(id 유일·블록 존재·단계 모순).
// 종료: 0 = 쟀고 어김 없음 · 1 = 어김 있음 · 잰 것 0(na — 통과 아님)(둘 다 결과 파일 있음) **또는** 도구 실패(`도구 실패:` — 열리지 않는 쪽 등, 결과 파일 없음) · 2 = 인자 오류
// 결과: <out>/agent-boundary.json { mode, pages:[{ url, scene, controls, toolForms, findings, status }], source?, summary:{ pages, controls, toolForms, pass, fail, na, ok } }
// 새 관문(관찰 단계) — 막는 관문이 아니다(docs/agents/agent-guide.md 관문 표).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { startChrome, closeChrome, connect, navigateAndWait, assertOpened, startWatchdog, SESSION_SCENE, NAV_TIMEOUT_MS } from './cdp.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TABLE_FILE = ['registry', 'factory', 'contract', 'human-actions.ts']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 행동 표 읽기 ─────────────────────────────────────────────────────────────────────────────
export async function loadActionTable(root = ROOT) {
  const text = readFileSync(join(root, ...TABLE_FILE), 'utf8')
  const { outputText } = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

// toolname 이 승인 행동을 가리키는 낱말(표의 id 와 따로 — 이름이 표에 없어도 낱말로 잡는다). 문의·예약 요청·질문의 이름(send-inquiry·request-booking·ask-product-question)은 걸리지 않는다.
export const APPROVAL_WORDS = /(?:^|[-_])(checkout|payment|pay|purchase|buy|order|delete|remove-account|cancel|unsubscribe|subscribe|signup|sign-up|register|consent|opt-?in|password|upgrade|downgrade|resume|billing|email-change|change-email)(?:$|[-_])/i

export function toolNameProblem(name, humanIds) {
  const n = String(name).trim().toLowerCase()
  if (humanIds.includes(n)) return `이름이 승인 행동 id 와 같다(${n})`
  const hit = humanIds.find((id) => n.startsWith(`${id}-`) || n.endsWith(`-${id}`))
  if (hit) return `이름이 승인 행동 id(${hit})를 담는다`
  const m = n.match(APPROVAL_WORDS)
  return m ? `이름에 승인 행동 낱말(${m[1]})이 있다` : null
}

// ── 순수 판정(Chrome 없이 시험한다) ───────────────────────────────────────────────────────────────
/**
 * facts = collectScript() 결과: { forms: [{ toolname, selector, humanControls, consents, passwordFields }], autoSubmit: [{ selector, tag }],
 *   controls: [{ action, selector, label, inToolForm, hint: { described, visible, text, length } }] }
 * table = loadActionTable() 결과(HUMAN_APPROVAL_ACTIONS·HINT_MAX_CHARS 를 읽는다)
 */
export function judgePage(facts, table) {
  const humanIds = [...table.HUMAN_APPROVAL_ACTIONS]
  const max = table.HINT_MAX_CHARS ?? 60
  const findings = []
  const add = (rule, selector, detail) => findings.push({ rule, selector, detail })
  for (const f of facts.forms) {
    if (f.humanControls > 0) add('toolname-contains-human-approval', f.selector, `toolname="${f.toolname}" 폼 안에 승인 표지 컨트롤 ${f.humanControls}개 — WebMCP 선언은 사람이 마지막에 누르는 폼에만 단다`)
    if (f.consents > 0) add('toolname-contains-consent', f.selector, `toolname="${f.toolname}" 폼 안에 동의 칸 ${f.consents}개`)
    if (f.passwordFields > 0) add('toolname-contains-human-approval', f.selector, `toolname="${f.toolname}" 폼 안에 비밀번호 칸 ${f.passwordFields}개`)
    const p = toolNameProblem(f.toolname, humanIds)
    if (p) add('toolname-is-human-approval', f.selector, `toolname="${f.toolname}" — ${p}`)
  }
  for (const a of facts.autoSubmit) add('toolautosubmit-present', a.selector, `<${a.tag}> 에 toolautosubmit — 에이전트는 채우고 사람이 누른다`)
  for (const c of facts.controls) {
    if (!humanIds.includes(c.action)) add('unknown-action', c.selector, `data-requires-human="${c.action}" 는 표의 승인 행동 id 가 아니다`)
    if (c.inToolForm) add('toolname-contains-human-approval', c.selector, `승인 컨트롤(${c.action})이 toolname 폼 안에 있다`)
    if (!c.hint.visible) add('human-control-no-hint', c.selector, `승인 컨트롤(${c.action} · ${c.label})이 가리키는 눈에 보이는 안내 글이 없다${c.hint.described ? '(aria-describedby 는 있으나 안 보이거나 비었다)' : '(aria-describedby 없음)'}`)
    else if (c.hint.length > max) add('hint-too-long', c.selector, `안내 글 ${c.hint.length}자 > ${max}자: ${JSON.stringify(c.hint.text.slice(0, 40))}…`)
  }
  const measured = facts.controls.length + facts.forms.length + facts.autoSubmit.length
  return { findings, measured, status: findings.length ? 'fail' : measured ? 'pass' : 'na' }
}

// ── 쪽 안에서 도는 수집 함수(자기완결 — JSON.stringify 한 인자만 받는다) ──────────────────────────────────────────
export function collectScript() {
  return `(() => {
  const sel = (el) => {
    const parts = []
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      const id = e.getAttribute('id'); const b = e.getAttribute('data-block')
      parts.unshift(e.tagName.toLowerCase() + (id ? '#' + id : b ? '[data-block=' + b + ']' : ''))
      if (id || b) break
    }
    return parts.join(' > ')
  }
  const rendered = (el) => (el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true, opacityProperty: true }) : true)
  // 눈에 보이는 안내 글: 그려지고(display·visibility·opacity) 상자가 4px 이상이고 aria-hidden 안쪽이 아니고 화면 밖으로 밀어낸 sr-only 가 아니다
  const visibleText = (el) => {
    if (!el || !rendered(el) || el.closest('[aria-hidden="true"]')) return false
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    const cs = getComputedStyle(el)
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\\(50%\\)/.test(cs.clipPath || '')) return false
    return true
  }
  const toolForms = [...document.querySelectorAll('form[toolname]')]
  const forms = toolForms.map((f) => ({
    toolname: f.getAttribute('toolname') || '',
    selector: sel(f),
    humanControls: f.querySelectorAll('[data-requires-human]').length,
    consents: f.querySelectorAll('[data-consent], input[name="withdrawalConsent"], input[type="checkbox"][name*="consent" i]').length,
    passwordFields: f.querySelectorAll('input[type="password"]').length,
  }))
  const autoSubmit = []
  for (const el of document.querySelectorAll('*')) {
    for (const n of el.getAttributeNames()) if (n.toLowerCase() === 'toolautosubmit') autoSubmit.push({ selector: sel(el), tag: el.tagName.toLowerCase() })
  }
  const controls = []
  for (const el of document.querySelectorAll('[data-requires-human]')) {
    if (!rendered(el)) continue // 접힌 패널·닫힌 창 안은 지금 화면에 없다 — 보일 때(다른 장면) 잰다
    const described = (el.getAttribute('aria-describedby') || '').split(/\\s+/).filter(Boolean)
    let hint = { described: described.length > 0, visible: false, text: '', length: 0 }
    for (const id of described) {
      const h = document.getElementById(id)
      const text = (h?.textContent || '').replace(/\\s+/g, ' ').trim()
      if (h && text && visibleText(h) && h.hasAttribute('data-human-hint')) { hint = { described: true, visible: true, text, length: [...text].length }; break }
    }
    controls.push({
      action: el.getAttribute('data-requires-human') || '',
      selector: sel(el),
      label: (el.textContent || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
      inToolForm: !!el.closest('form[toolname]'),
      hint,
    })
  }
  return { forms, autoSubmit, controls }
})()`
}

// ── 원천 검사(브라우저 없음) ─────────────────────────────────────────────────────────────────────
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
const listBlockFiles = (root) => {
  const dir = join(root, 'registry', 'factory', 'blocks')
  const out = []
  for (const kind of readdirSync(dir)) {
    if (kind.startsWith('_') || kind === 'registry.json') continue
    const kd = join(dir, kind)
    for (const f of readdirSync(kd)) if (f.endsWith('.tsx') && !f.endsWith('.fixture.tsx')) out.push({ name: `${kind}/${f.slice(0, -4)}`, file: join(kd, f) })
  }
  return out
}
// 한 블록이 부르는 공유 조각(`../_shared/<이름>`) 두 단계까지의 소스 — 표지는 조각(plan-offer·port-form …)이 달 수도 있다
function closureText(root, file, seen = new Set(), depth = 0) {
  if (seen.has(file) || !existsSync(file)) return ''
  seen.add(file)
  const text = stripComments(readFileSync(file, 'utf8'))
  if (depth >= 2) return text
  const shared = [...text.matchAll(/from\s+["']\.\.?\/(?:_shared\/)?([a-z0-9-]+)["']/g)].map((m) => join(root, 'registry', 'factory', 'blocks', '_shared', `${m[1]}.tsx`))
  return [text, ...shared.map((f) => closureText(root, f, seen, depth + 1))].join('\n')
}
// 정의(조각 안의 `humanApprovalProps(action…`)가 아니라 실제 쓰임 — 첫 인자가 글자 행동 id 이거나 `approval={{ action: "…" }}`
const USES_MARKER = /humanApprovalProps\(\s*["']|approval=\{\{\s*action:/
const marksAction = (text, id) => new RegExp(`humanApprovalProps\\(\\s*["']${id}["']|approval=\\{\\{\\s*action:\\s*["']${id}["']`).test(text)

export function sourceProblems(table, root = ROOT) {
  const out = []
  const add = (rule, where, detail) => out.push({ rule, where, detail })
  const actions = table.AGENT_ACTIONS
  const ids = actions.map((a) => a.id)
  for (const id of ids) if (ids.indexOf(id) !== ids.lastIndexOf(id)) add('table', id, '행동 id 가 두 번 나온다')
  for (const a of actions) if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(a.id)) add('table', a.id, 'id 는 영문 소문자 kebab 이어야 한다')
  const files = listBlockFiles(root)
  const byName = new Map(files.map((f) => [f.name, f]))
  const tierOf = new Map()
  for (const a of actions) for (const b of a.blocks ?? []) {
    if (!byName.has(b)) add('table', a.id, `표에 적힌 블록 ${b} 의 원천이 없다`)
    const prev = tierOf.get(b)
    if (prev && ((prev === 'human-approval') !== (a.tier === 'human-approval') || (prev === 'fill-human-press') !== (a.tier === 'fill-human-press')) && a.tier !== 'agent-ok') add('table', b, `한 블록이 ${prev} 와 ${a.tier} 로 함께 적혀 있다 — 사람이 마지막에 누르는 폼과 승인 컨트롤은 한 블록에 섞지 않는다`)
    tierOf.set(b, a.tier)
  }
  const humanPorts = new Map() // 포트 메서드 → 행동 id
  for (const a of actions) if (a.tier === 'human-approval') for (const p of a.ports ?? []) humanPorts.set(p, a.id)
  for (const { name, file } of files) {
    const own = stripComments(readFileSync(file, 'utf8'))
    const text = closureText(root, file)
    const listed = actions.filter((a) => a.tier === 'human-approval' && (a.blocks ?? []).includes(name))
    for (const a of listed) if (!marksAction(text, a.id)) add('missing-marker', name, `표가 ${a.id} 를 이 블록의 승인 행동이라 적었는데 표지(humanApprovalProps("${a.id}", …) · SubmitButton approval)가 없다`)
    // 거꾸로: 승인 포트 메서드를 폼 흐름(.run(() => 메서드()))으로 부르는데 표가 이 블록을 적지 않았다
    for (const m of own.matchAll(/\.run\(\s*(?:async\s*)?\(\)\s*=>\s*([a-zA-Z]+)\(/g)) {
      const id = humanPorts.get(m[1])
      if (id && !listed.some((a) => a.id === id)) add('unlisted-approval-call', name, `${m[1]}() 은 승인 행동(${id})의 포트 메서드인데 표의 blocks 에 이 블록이 없다`)
    }
    // 승인 표지를 달았는데 표가 모른다
    for (const m of text.matchAll(/humanApprovalProps\(\s*["']([a-z0-9-]+)["']/g)) if (!listed.some((a) => a.id === m[1]) && !ids.includes(m[1])) add('unknown-action', name, `표지의 행동 ${m[1]} 가 표에 없다`)
    // toolname 폼(WebMCP)을 쓰는 블록은 승인 표지를 달지 않는다
    if (/agentFormAttrs\(/.test(own) && USES_MARKER.test(text)) add('toolname-with-approval', name, 'agentFormAttrs(WebMCP toolname)를 쓰는 블록이 승인 표지도 단다 — 둘은 한 블록에 섞지 않는다(R19)')
    if (/agentFormAttrs\(/.test(own) && !actions.some((a) => a.tier === 'fill-human-press' && (a.blocks ?? []).includes(name))) add('table', name, 'agentFormAttrs(WebMCP toolname)를 쓰는데 표의 fill-human-press 에 이 블록이 없다')
    // 승인 컨트롤은 안내 글 조각과 함께만 단다
    if (/humanApprovalProps\(/.test(own) && !/ApprovalHint/.test(text)) add('marker-without-hint', name, 'humanApprovalProps 를 쓰는데 ApprovalHint(눈에 보이는 안내 글)가 없다')
  }
  // toolautosubmit 속성 코드(주석 제외) — 레지스트리 원천 전체
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '_compiled' || e.name === 'r' || e.name === 'node_modules' ? [] : walk(join(d, e.name))) : /\.(tsx?|mjs)$/.test(e.name) ? [join(d, e.name)] : []))
  for (const f of walk(join(root, 'registry', 'factory'))) {
    const t = stripComments(readFileSync(f, 'utf8'))
    if (/toolautosubmit\s*[=:]|["']toolautosubmit["']/i.test(t)) add('toolautosubmit-code', f.slice(root.length + 1).split('\\').join('/'), 'toolautosubmit 속성을 만드는 코드가 있다')
  }
  return out
}

// ── 인자 ─────────────────────────────────────────────────────────────────────────────────
export const USAGE = '사용: node factory/qa/agent-boundary.mjs <url>… --out <dir> [--width 1440] [--session <장면>]\n' +
  '      node factory/qa/agent-boundary.mjs --gallery <origin> --out <dir> [--recipe r1-measure] [--blocks a/b,c/d]\n' +
  '      node factory/qa/agent-boundary.mjs --source [--out <dir>]\n' +
  '종료: 0 = 쟀고 어김 없음 · 1 = 어김 있음 · 잰 것 0(na) 또는 도구 실패(결과 파일 없음) · 2 = 인자 오류'
export function parseArgs(argv) {
  const a = { urls: [], width: 1440, recipe: 'r1-measure', source: false }
  const rest = [...argv]
  while (rest.length) {
    const t = rest.shift()
    if (t === '--out') a.out = rest.shift()
    else if (t === '--width') a.width = Number(rest.shift())
    else if (t === '--gallery') a.gallery = rest.shift()
    else if (t === '--recipe') a.recipe = rest.shift()
    else if (t === '--blocks') a.blocks = (rest.shift() ?? '').split(',').filter(Boolean)
    else if (t === '--source') a.source = true
    else if (t.startsWith('--')) throw new Error(`모르는 인자: ${t}`)
    else a.urls.push(t)
  }
  const modes = [a.source, !!a.gallery, a.urls.length > 0].filter(Boolean).length
  if (modes !== 1) throw new Error('쪽 주소들 · --gallery <origin> · --source 중 하나만 준다')
  if (!a.source && !a.out) throw new Error('--out <dir> 이 필요하다')
  if (!Number.isFinite(a.width) || a.width < 200) throw new Error('--width 가 숫자가 아니다')
  return a
}

export function summarize(pages, source) {
  const fail = pages.filter((p) => p.status === 'fail').length
  const controls = pages.reduce((n, p) => n + p.controls, 0)
  const toolForms = pages.reduce((n, p) => n + p.toolForms, 0)
  const srcFail = source ? source.length : 0
  return { pages: pages.length, controls, toolForms, pass: pages.filter((p) => p.status === 'pass').length, fail, na: pages.filter((p) => p.status === 'na').length, skip: pages.filter((p) => p.status === 'skip').length, sourceProblems: srcFail, ok: fail === 0 && srcFail === 0 && pages.every((p) => p.status !== 'na') }
}

// 갤러리 블록이 승인 컨트롤을 그리려고 열어야 하는 화면(클릭 한 번) — 기본 그림만으로는 안 나오는 것. 구현은 CLICK 으로 마지막 요소를 눌러 본다.
//   steps 는 block-board gates.mjs STEPS(가입 2단계·해지 2단계·창 열기)를 그대로 쓰고, 그 밖에 이 표가 더한다.
export const REACH = {
  'account/billing-manage': [{ click: 'button[aria-pressed="false"]' }],
  'account/security': [{ click: '[data-two-factor-trigger]' }],
  'paywall/limit-meter': [{ click: '[data-block="paywall-limit-meter"] button:not([data-snooze])' }],
}
// 이 관문의 갤러리 행으로는 승인 컨트롤에 닿지 못하는 블록(어느 장면에서도 0개) — 이유를 적는다. 원천 검사(--source)가 표지 여부를 본다. 새로 닿지 못하는 블록은 여기에 적어야 한다(na 는 통과가 아니다).
export const UNREACHED_OK = {
  'contact-form/channel-first': '예시(fixture)에 tool 이 없어 toolname 폼이 없다 — 재볼 것이 없다(원천 검사가 agentFormAttrs 블록과 표를 맞춘다)',
  'retention/cancel-flow': '해지 흐름 1단계 해지 버튼은 제안(offer)이 없을 때만 나타나고 갤러리 기본 그림은 제안이 있다 — 2단계(cancel-step-2)가 닿는다',
}

export async function main(argv) {
  let a
  try { a = parseArgs(argv) } catch (e) { console.error(`agent-boundary: ${e.message}\n${USAGE}`); return 2 }
  let table
  try { table = await loadActionTable() } catch (e) { console.error(`도구 실패: agent-boundary 행동 표를 못 읽었다 — ${e.message}`); return 1 }
  if (a.out) mkdirSync(a.out, { recursive: true })
  const jsonPath = a.out ? join(a.out, 'agent-boundary.json') : null
  if (jsonPath) rmSync(jsonPath, { force: true }) // 재지 못하고 끝나면(도구 실패) 이전 실행의 결과가 남아 읽히지 않게

  const pages = []
  let source = null
  try {
    if (a.source) source = sourceProblems(table)
    if (!a.source) {
      let chrome
      const state = { chrome: null, stage: 'Chrome 시작' }
      const targets = await planTargets(a, table)
      const stopDog = startWatchdog('agent-boundary', 90000 + 40000 * targets.length, state)
      try {
        chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb'], { prefix: 'agent-boundary-' })
        state.chrome = chrome
        state.stage = 'DevTools 연결'
        const { ws, send, ev } = await connect(chrome.wsUrl, { throwOnException: true })
        await send('Emulation.setDeviceMetricsOverride', { width: a.width, height: 900, deviceScaleFactor: 1, mobile: false })
        const gates = a.gallery ? await import('../board/block-board/gates.mjs') : null
        for (const t of targets) {
          state.stage = `쪽 열기 ${t.url}`
          await assertOpened(await navigateAndWait(send, ev, t.url), ev, t.url)
          await settle(ev, a.gallery ? '[data-qa-ready]' : null)
          if (t.step) {
            const r = await gates.STEPS[t.step]({ send, ev })
            if (!r.ok) throw new Error(`${t.url} — 단계 ${t.step} 로 들어가지 못했다: ${r.note}`)
          }
          let missed = null
          for (const c of t.clicks ?? []) {
            const hit = await ev(`(() => { const el = document.querySelector(${JSON.stringify(c.click)}); if (!el) return false; el.click(); return true })()`)
            if (!hit) { missed = c.click; break }
            await sleep(500)
          }
          if (missed) { pages.push({ url: t.url, block: t.block, scene: t.scene, controls: 0, toolForms: 0, findings: [], status: 'na', note: `클릭할 요소 ${missed} 가 없다` }); continue }
          const facts = await ev(collectScript())
          const j = judgePage(facts, table)
          pages.push({ url: t.url, block: t.block, scene: t.scene, controls: facts.controls.length, toolForms: facts.forms.length, autoSubmit: facts.autoSubmit.length, actions: [...new Set(facts.controls.map((c) => c.action))], findings: j.findings, status: j.status })
        }
        ws.close()
      } finally { stopDog(); if (chrome) await closeChrome(chrome) }
      if (a.gallery) coverageFindings(pages, table)
    }
  } catch (e) {
    console.error(`도구 실패: agent-boundary 측정 없음 — ${e.message}`)
    return 1
  }

  const summary = summarize(pages, source)
  if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ mode: a.source ? 'source' : a.gallery ? 'gallery' : 'url', scene: SESSION_SCENE, pages, source, summary }, null, 2) + '\n')
  console.log(`agent-boundary[${a.source ? 'source' : a.gallery ? 'gallery' : 'url'}${SESSION_SCENE ? ` · ${SESSION_SCENE}` : ''}]: 쪽 ${summary.pages} · 승인 컨트롤 ${summary.controls} · toolname 폼 ${summary.toolForms} — 통과 ${summary.pass} · 실패 ${summary.fail} · na ${summary.na}${summary.skip ? ` · skip ${summary.skip}` : ""}${source ? ` · 원천 문제 ${source.length}` : ''}`)
  for (const p of pages) {
    console.log(`  ${p.status.toUpperCase()} ${p.block ?? p.url}${p.scene ? ` [${p.scene}]` : ''} (승인 컨트롤 ${p.controls} · toolname 폼 ${p.toolForms})${p.note ? ` — ${p.note}` : ''}`)
    for (const f of p.findings) console.log(`    ${f.rule} [${f.selector}] ${f.detail}`)
  }
  for (const s of source ?? []) console.log(`  SOURCE ${s.rule} [${s.where}] ${s.detail}`)
  return summary.ok ? 0 : 1
}

// 갤러리·주소 목표 정하기
async function planTargets(a, table) {
  if (!a.gallery) return a.urls.map((url) => ({ url, scene: 'page' }))
  const { blockName } = await import('../scripts/blocks.mjs')
  const { SCENE_STEPS } = await import('../board/block-board/jobs.mjs')
  const { EXTRA_SCENES } = await import('./marketing-blocks.mjs')
  const listed = [...new Set(table.AGENT_ACTIONS.filter((x) => x.tier !== 'agent-ok').flatMap((x) => x.blocks ?? []))]
  const names = (a.blocks ?? listed).filter((b) => listed.includes(b))
  const base = a.gallery.replace(/\/$/, '')
  const targets = []
  for (const b of names) {
    const [kind, variant] = b.split('/')
    const name = blockName(kind, variant)
    const url = (extra) => `${base}/qa/blocks?b=${name}&r=${a.recipe}&theme=light&frame=1${extra ? `&${extra}` : ''}`
    targets.push({ url: url(), block: b, scene: 'default' })
    for (const q of EXTRA_SCENES[name] ?? []) targets.push({ url: url(q), block: b, scene: q })
    for (const s of SCENE_STEPS[name] ?? []) targets.push({ url: url(), block: b, scene: s, step: s })
    for (const [i, r] of (REACH[b] ?? []).entries()) targets.push({ url: url(), block: b, scene: `click-${i + 1}`, clicks: [r] })
  }
  return targets
}
// 기다림: 갤러리는 [data-qa-ready], 일반 쪽은 글자 수가 두 번 연달아 같을 때까지
async function settle(ev, readySel) {
  const deadline = Date.now() + NAV_TIMEOUT_MS
  let last = -1, stable = 0
  while (Date.now() < deadline && stable < 2) {
    const n = await ev(`${readySel ? `document.querySelector(${JSON.stringify(readySel)}) ? ` : ''}(document.body?.innerText.length ?? 0)${readySel ? ' : -2' : ''}`)
    stable = n === last && n >= 0 ? stable + 1 : 0
    last = n
    await sleep(300)
  }
  await sleep(700) // 등장 연출(opacity)이 끝나기를 — 안내 글이 아직 투명이면 「안 보임」으로 잴 수 있다
}
// 갤러리 모드: 표에 적힌 블록이 어느 장면에서도 승인 컨트롤 0개면 na(UNREACHED_OK 에 적은 블록만 면제)
function coverageFindings(pages, table) {
  const byBlock = new Map()
  for (const p of pages) byBlock.set(p.block, [...(byBlock.get(p.block) ?? []), p])
  for (const [block, ps] of byBlock) {
    // 한 블록의 여러 장면 중 어느 하나가 재졌으면 나머지 빈 장면(닫힌 창·1단계)은 na 가 아니라 skip — 블록 전체가 0 이면 na(UNREACHED_OK 만 면제)
    const reached = ps.some((p) => p.status !== 'na')
    for (const p of ps) if (p.status === 'na' && (reached || UNREACHED_OK[block])) { p.status = 'skip'; p.note = reached ? '같은 블록의 다른 장면이 쟀다' : UNREACHED_OK[block] }
    const expect = table.AGENT_ACTIONS.filter((x) => x.tier === 'human-approval' && (x.blocks ?? []).includes(block)).map((x) => x.id)
    if (!expect.length) continue
    const got = new Set(ps.flatMap((p) => p.actions ?? []))
    const missing = expect.filter((id) => !got.has(id))
    if (missing.length && !UNREACHED_OK[block]) {
      const home = ps[0]
      home.findings.push({ rule: 'expected-control-not-reached', selector: block, detail: `표가 적은 승인 행동 ${missing.join('·')} 컨트롤을 어느 장면에서도 찾지 못했다 — 장면(REACH)을 더하거나 UNREACHED_OK 에 까닭을 적는다` })
      home.status = 'fail'
    }
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  // 끝나면 곧바로 나간다 — 닫힌 Chrome 에 붙었던 소켓 같은 남은 핸들이 프로세스를 붙잡는 일이 있었다(UXGATE1 실측).
  const code = await main(process.argv.slice(2))
  process.exitCode = code
  setTimeout(() => process.exit(code), 1500).unref()
}
