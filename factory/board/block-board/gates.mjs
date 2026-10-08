// 블록 행렬 관문(P3-2 Task 7a Step 2): node factory/board/block-board/gates.mjs [origin=http://localhost:3000] [--only <블록|kind>,…] [--limit N] [--roles primary,face,quiet] [--skip run,aiTell,…] [--resume] [--out <폴더>]
// npm run blocks:gates -- <origin>. 서버는 npm start(빌드 뒤). 판정 행렬(jobs.mjs blockJobs)의 행마다 Chrome 하나·CDP 세션 하나로 차례대로(직렬) 잰다:
//   render(그려짐·콘솔 오류 0·등장 끝 신호) · overflow(가로 넘침 0) · entered(등장 뒤 [data-enter] 가시성) · contrast(본문 7·큰 글자 4.5, 픽셀 표본) ·
//   face(K6~K8 면 스코프 대비 + 면을 까는 블록의 면적 25%) · hit(히트 영역 — 넓은 화면 fine · 375 coarse) · marketing(factory-rules.md §22 규칙 21개, gateOnPage) · reduced(동작 줄이기 가시성).
//   같은 주소(블록×레시피)마다 한 번: run(run.mjs — ux-gate + behavior) · aiTell(ai-tell warn 점수 기록 — 판정 아님).
// 단계·창(대장 A121): SCENE_STEPS 의 행은 그 단계로 들어간 뒤(가입 2단계·해지 2단계·창 열기) 잰다 — 마케팅 규칙은 그 화면에서(pageFacts+judge), 대비·히트·넘침도 그 화면에서.
// 결과: <out>/summary.json(전부 돌았을 때만) · <out>/rows/*.json(행마다 — --resume 이 이어받는다) · 종료 0 = 실패 0 · na 필수 0, 1 = 판정 실패 또는 도구 실패(`도구 실패:` — summary.json 을 남기지 않는다).
// na 는 통과가 아니다(대장 A123): 요약이 na 를 따로 세고, 필수 표(REQUIRED_RULES·REQUIRED_CHECKS)에 있는 규칙이 그 블록의 어느 행에서도 잰 수 0 이면 실패다.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBlocks } from '../../scripts/blocks.mjs'
import { BOLD_LOGICS } from '../../scripts/recipe.mjs'
import { gateOnPage, RULES } from '../../qa/marketing-gate.mjs'
import { pageFacts, judge, failingIds, THRESHOLDS } from '../../qa/marketing-gate.mjs'
import { loadHeads } from '../recipe-board/jobs.mjs'
import { blockJobs, absUrl, OUT, ROOT, faceFamilies, recipeFaceFamily } from './jobs.mjs'
import { openSession, openBlock, sleep, HEIGHT } from './page.mjs'
import { res, renderResult, OVERFLOW, overflowResult, ENTER_VISIBLE, enteredResult, REDUCED, reducedResult, measureContrast, contrastResult, faceArea, FACE_CONTRAST_SCRIPT, faceResult, measureHit } from './checks.mjs'

const QA = join(fileURLToPath(new URL('../../qa/', import.meta.url)))
export const CHECKS = ['render', 'overflow', 'entered', 'contrast', 'face', 'hit', 'marketing', 'reduced']
export const URL_CHECKS = ['run', 'aiTell']

// ── 필수 표(대장 A123) ────────────────────────────────────────────────────────────────────────
// 「이 블록은 이 규칙을 반드시 잰다」 — 블록의 어느 행에서도 잰 수가 0 이면(na) 실패다. 표지가 빠지거나 화면에 안 그려지면 통과로 읽히지 않는다.
// 손으로 적은 표다(소스에서 뽑으면 표지를 지웠을 때 기대도 같이 사라진다). gates.test.mjs 가 소스의 표지와 이 표가 맞는지 본다.
export const REQUIRED_RULES = {
  'block-retention-cancel-flow': ['cancel-steps', 'decline-parity'],
  'block-trust-guarantee-strip': ['guarantee-days'],
  'block-trust-payment-trust-panel': ['escrow-notice'],
  'block-review-list-distribution-filter': ['seller-reply-style'],
  'block-review-list-photo-gallery': ['seller-reply-style'],
  'block-review-list-summary-near-price': ['seller-reply-style'],
  'block-confirmation-booking-complete': ['next-action-one', 'rating-no-default'],
  'block-confirmation-order-complete': ['next-action-one'],
  'block-confirmation-signup-complete': ['next-action-one'],
  'block-confirmation-upgrade-complete': ['next-action-one'],
  'block-auth-sign-up-consents': ['optin-unchecked'],
  'block-consent-preference-dialog': ['optin-unchecked'],
  'block-lead-capture-cart-exit-offer': ['countdown-real'],
  'block-announcement-top-bar': ['countdown-real'],
}
// 모든 블록이 어느 행에선가 잰 수 ≥ 1 이어야 하는 검사: 글자가 그려지는 화면이 어디에도 없으면(닫힌 창만 있는 블록은 열린 행이 잰다) 대비를 못 잰 것이다.
export const REQUIRED_CHECKS = ['contrast']
// 필수 검사의 na 를 받아 주는 블록·검사(C376): 눈에 보이는 글자를 그리지 않는 틀은 contrast 가 어느 행에서도 na 가 정상이다. 이름 하나하나가 근거 있는 예외다 —
// 손으로 적은 표이고 gates.test.mjs 가 이름이 실제인지·예외 블록 소스에 그려지는 글자가 늘지 않았는지 본다.
export const CHECK_NA_OK = {
  // 로딩 뼈대: 그려진 것은 Skeleton 막대뿐이고 글자는 sr-only 이름 하나(aria-hidden 목록 + sr-only h2)
  'block-content-skeleton': ['contrast'],
}
// 소스의 표지 → 그 표지가 있으면 잴 규칙(gates.test.mjs 가 표와 맞는지 본다). 표지는 블록 자기 소스에 있을 때만 셈한다.
export const MARKER_RULES = {
  'data-guarantee': 'guarantee-days',
  'data-escrow': 'escrow-notice',
  'data-rating-ask': 'rating-no-default',
  'data-next-action': 'next-action-one',
}

// ── 단계(대장 A121) ───────────────────────────────────────────────────────────────────────────
const CLICK = (sel, text) => `(() => { const root = document.querySelector('[data-qa-block]'); const els = [...root.querySelectorAll(${JSON.stringify(sel)})].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled && ${text ? `new RegExp(${JSON.stringify(text)}).test(e.textContent)` : 'true'} }); if (!els.length) return false; els[0].click(); return true })()`
async function until(ev, expr, ms = 3000) {
  for (let i = 0; i < ms / 100; i++) { if (await ev(expr)) return true; await sleep(100) }
  return false
}
// 단계 구현: { ok, note }. 열지 못하면 행이 실패한다(조용히 기본 화면을 재지 않게).
export const STEPS = {
  'consents-step-2': async ({ ev }) => {
    if (!(await ev(CLICK('[data-flow=signup] button', '시작하기')))) return { ok: false, note: '가입 1단계에 「…시작하기」 버튼이 없다' }
    return { ok: await until(ev, `document.querySelector('[data-flow=signup]')?.getAttribute('data-step') === '2'`), note: '가입 2단계로 안 넘어갔다', rootSel: '[data-qa-block] [data-block]', skipRules: [] }
  },
  'cancel-step-2': async ({ ev }) => {
    if (!(await ev(CLICK('[data-flow=cancel] [data-choice=decline]')))) return { ok: false, note: '해지 1단계에 [data-choice=decline] 버튼이 없다' }
    return { ok: await until(ev, `document.querySelector('[data-flow=cancel]')?.getAttribute('data-step') === '2'`), note: '해지 2단계로 안 넘어갔다', rootSel: '[data-qa-block] [data-block]', skipRules: ['cancel-steps'] }
  },
  'open-dialog': async ({ ev }) => {
    // 트리거가 있으면 누르고, 없으면(나가려는 순간에 여는 창) 화면 위로 나가는 마우스 이벤트를 준다.
    const clicked = await ev(CLICK('[aria-haspopup=dialog]'))
    if (!clicked) await ev(`document.dispatchEvent(new MouseEvent('mouseout', { clientX: 400, clientY: -1, bubbles: true, relatedTarget: null }))`)
    const ok = await until(ev, `!!document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').checkVisibility()`)
    await sleep(700) // 열리는 동작이 끝나기를
    // 부하가 큰 기계에서는 700ms 가 모자라 열림·초기 포커스 전환이 진행 중인 색으로 재어진다(decline-parity 「글자 대비 차」 11.6 거짓 실패) — 끝나는 유한 애니메이션·전환이 없을 때까지 더 기다린다.
    await until(ev, `document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity)`, 4000)
    // 행동 줄([data-choice] 버튼)이 있는 창은 열린 첫 화면 안에 그 버튼이 통째로 보여야 한다 — 창이 스크롤 칸보다 길면 줄이 아래에 붙어 있어야 한다(대장 C386).
    const actionsInView = ok && (await ev(`(() => { const b = [...document.querySelectorAll('[role=dialog] [data-choice]')]; return b.every((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }) })()`))
    return { ok: ok && actionsInView, note: ok ? '창은 열렸지만 행동 줄([data-choice])이 첫 화면 밖이다 — 줄을 창 아래에 고정해야 한다(C386)' : '창이 열리지 않았다', rootSel: '[role=dialog]', skipRules: ['first-screen-modal'] }
  },
}

// ── 한 행 ─────────────────────────────────────────────────────────────────────────────────────
const isBold = (head) => BOLD_LOGICS.includes(head.colorLogic)
// 마케팅 검사를 한 화면에서 지금 그대로(단계 안 — gateOnPage 는 새로 불러오므로 못 쓴다): 사실 모으기 + 판정.
async function marketingHere({ ev }, width, skip) {
  const facts = await ev(`(${pageFacts.toString()})(${JSON.stringify({ modalCoverMin: THRESHOLDS.modalCoverMin })})`)
  if (!facts) throw new Error('마케팅 사실 모으기가 값을 안 줬다(단계 화면)')
  const rules = judge(facts, {}).filter((r) => !skip.includes(r.id))
  return { rules, fail: failingIds(rules), measured: Object.fromEntries(rules.map((r) => [r.id, r.measured])) }
}
const marketingResult = (m) => {
  const fails = m.rules.filter((r) => r.status === 'fail').map((r) => `${r.id}: ${(r.detail ?? []).slice(0, 2).join(' / ') || '어김'}`)
  return res(m.rules.filter((r) => r.measured > 0).length, fails, { rules: Object.fromEntries(m.rules.map((r) => [r.id, { status: r.status, measured: r.measured }])), warn: m.rules.filter((r) => r.status === 'warn').map((r) => r.id) })
}

export async function runRow(session, origin, job, { heads, faceBlocks }) {
  const head = heads.find((h) => h.id === job.recipe)
  const url = absUrl(origin, job)
  const pointer = job.width <= 500 ? 'coarse' : 'fine'
  const theme = job.theme
  const view = { width: job.width, theme, pointer }
  const t0 = Date.now()
  session.takeErrors()
  const checks = {}
  const open = await openBlock(session, url, view)
  checks.render = renderResult(open, session.takeErrors())
  if (!open.ready) {
    // 그려지지 않으면 나머지는 잴 수 없다 — 실패 하나로 끝(다른 검사를 na 로 채워 통과로 읽히지 않게 「못 잼」 표시).
    for (const c of CHECKS.slice(1)) checks[c] = res(0, [`블록이 안 그려져 못 쟀다`])
    return finish(job, checks, Date.now() - t0)
  }
  let step = null
  if (job.step) {
    step = await STEPS[job.step](session)
    if (!step.ok) checks.render.fails.push(`단계 ${job.step}: ${step.note}`)
    else session.takeErrors().forEach((e) => checks.render.fails.push(`콘솔 오류(단계 뒤): ${e}`))
    if (checks.render.fails.length) checks.render.status = 'fail'
  }
  const rootSel = step?.rootSel ?? '[data-qa-block] [data-block]'
  const { ev } = session
  checks.overflow = overflowResult(await ev(OVERFLOW))
  checks.entered = job.step ? res(0, [], { note: '단계 행은 재지 않는다' }) : enteredResult(await ev(ENTER_VISIBLE))
  // 본문 대비: 글자가 하나도 안 그려지면(닫힌 창·숨은 블록) na — 필수 표(REQUIRED_CHECKS)가 어느 행에선가 재는지 본다.
  {
    const j = await measureContrast(session, rootSel, { height: HEIGHT[job.width] ?? 900 })
    checks.contrast = j.boxes === 0 && !j.fails.some((f) => !f.startsWith('잰 글자 상자 0개')) ? res(0, [], { note: '그려진 글자가 없다' }) : contrastResult({ ...j, fails: j.fails.filter((f) => !f.startsWith('잰 글자 상자 0개')) })
  }
  {
    const bold = isBold(head)
    let area = { faces: 0, ratio: 0 }, contrast = []
    const family = recipeFaceFamily(head)
    if (bold) { area = (await ev(faceArea(family))) ?? area; contrast = ((await ev(FACE_CONTRAST_SCRIPT)) ?? []).filter((c) => c.startsWith(`${family}-`)) }
    checks.face = faceResult({ bold, faceBlock: !!faceBlocks.get(job.block)?.has(family) && !job.step, area, contrast })
  }
  checks.hit = await measureHit(session, pointer)
  // 마케팅: 기본 행은 새로 불러 전부(가입 단계 수·해지 걷기 포함), 단계 행은 지금 화면에서 사실만.
  if (job.step) checks.marketing = marketingResult(await marketingHere(session, job.width, step.skipRules ?? []))
  else checks.marketing = marketingResult(await gateOnPage(session, url, { width: job.width, height: HEIGHT[job.width] ?? 900 }))
  // 동작 줄이기: 다시 열고(등장을 기다리지 않는다) 0.6초 뒤 잰다. 단계 행은 뺀다(열어야 하는 화면이라 같은 잣대가 없다).
  if (job.step) checks.reduced = res(0, [], { note: '단계 행은 재지 않는다' })
  else {
    const o2 = await openBlock(session, url, { ...view, motion: 'reduce' }, { waitEntered: false })
    await sleep(600)
    checks.reduced = o2.ready ? reducedResult(await ev(REDUCED), await ev(ENTER_VISIBLE)) : res(0, [`동작 줄이기에서 블록이 안 그려졌다: ${o2.error}`])
  }
  return finish(job, checks, Date.now() - t0)
}

function finish(job, checks, ms) {
  const failed = CHECKS.filter((c) => checks[c].status === 'fail')
  const na = CHECKS.filter((c) => checks[c].status === 'na')
  const j = { ...job }
  delete j.mode
  return { ...j, ms, checks, pass: failed.length === 0, failed, na }
}

// ── 주소 단위(블록×레시피 한 번) ────────────────────────────────────────────────────────────────
const spawnNode = (args, { timeoutMs = 300000 } = {}) => new Promise((resolve) => {
  const p = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let err = '', out = ''
  p.stderr.on('data', (d) => { err += d })
  p.stdout.on('data', (d) => { out += d })
  const t = setTimeout(() => { p.kill(); err += '\n도구 실패: 시간 초과' }, timeoutMs)
  p.on('exit', (code) => { clearTimeout(t); resolve({ code, err, out }) })
})
export async function runUrlChecks(origin, job, dir, skip) {
  const url = absUrl(origin, job)
  const tag = `${job.block}--${job.recipe}`
  const out = {}
  if (!skip.includes('run')) {
    const t0 = Date.now()
    const r = await spawnNode([join(QA, 'run.mjs'), url, join(dir, tag, 'run')])
    const rep = join(dir, tag, 'run', 'report.json')
    const report = existsSync(rep) ? JSON.parse(readFileSync(rep, 'utf8')) : null
    // run.mjs 는 자식 코드를 report.json 에 적는다: 자식이 1 이면 도구 예외, 3 이면 판정 실패.
    if (!report || report.gate === 1 || report.behavior === 1 || r.err.includes('도구 실패:')) throw new Error(`run.mjs 도구 실패 ${tag}: ${r.err.split('\n').filter(Boolean).slice(-2).join(' | ')}`)
    const ux = join(dir, tag, 'run', 'gate', 'ux_gate.json')
    const fails = [...(report.gate ? (existsSync(ux) ? JSON.parse(readFileSync(ux, 'utf8')).fail : ['ux-gate 실패']) : []), ...(report.behavior ? ['behavior 실패'] : [])]
    out.run = res(1, fails, { gate: report.gate, behavior: report.behavior, ms: Date.now() - t0 })
  }
  if (!skip.includes('aiTell')) {
    const d = join(dir, tag, 'ai-tell')
    const t1 = Date.now()
    const r = await spawnNode([join(QA, 'ai-tell.mjs'), url, '--out', d, '--mode', 'warn'])
    const f = join(d, 'ai-tell.json')
    if (r.code !== 0 || !existsSync(f)) throw new Error(`ai-tell.mjs 도구 실패 ${tag}: ${r.err.split('\n').filter(Boolean).slice(-2).join(' | ')}`)
    const j = JSON.parse(readFileSync(f, 'utf8'))
    out.aiTell = res(1, [], { ms: Date.now() - t1, score: j.score, max: j.max, hits: (j.hits ?? []).map((h) => h.id) }) // warn 모드 — 점수만 기록한다
  }
  return out
}

// ── 요약(순수) ─────────────────────────────────────────────────────────────────────────────────
export function summarize(rows, urlRows = [], { required = REQUIRED_RULES, requiredChecks = REQUIRED_CHECKS } = {}) {
  const perCheck = Object.fromEntries([...CHECKS, ...URL_CHECKS].map((c) => [c, { pass: 0, fail: 0, na: 0 }]))
  for (const r of rows) for (const c of CHECKS) perCheck[c][r.checks[c].status]++
  for (const u of urlRows) for (const c of URL_CHECKS) if (u.checks[c]) perCheck[c][u.checks[c].status]++
  const perRule = Object.fromEntries(RULES.map((r) => [r.id, { pass: 0, fail: 0, warn: 0, na: 0 }]))
  for (const r of rows) for (const [id, x] of Object.entries(r.checks.marketing.rules ?? {})) perRule[id][x.status]++
  // 블록마다 어느 행에선가 잰 것들의 합집합
  const byBlock = new Map()
  for (const r of rows) {
    const b = byBlock.get(r.block) ?? { rules: new Set(), checks: new Set() }
    for (const [id, x] of Object.entries(r.checks.marketing.rules ?? {})) if (x.measured > 0) b.rules.add(id)
    for (const c of CHECKS) if (r.checks[c].status !== 'na') b.checks.add(c)
    byBlock.set(r.block, b)
  }
  const naRequired = []
  for (const [block, b] of byBlock) {
    for (const id of required[block] ?? []) if (!b.rules.has(id)) naRequired.push({ block, kind: 'rule', id, why: `필수 규칙 ${id} 를 어느 행에서도 못 쟀다(na)` })
    for (const c of requiredChecks) if (!b.checks.has(c) && !(CHECK_NA_OK[block] ?? []).includes(c)) naRequired.push({ block, kind: 'check', id: c, why: `필수 검사 ${c} 를 어느 행에서도 못 쟀다(na)` })
  }
  const failedRows = rows.filter((r) => !r.pass)
  const failedUrls = urlRows.filter((u) => URL_CHECKS.some((c) => u.checks[c]?.status === 'fail'))
  return {
    rows: rows.length, failedRows: failedRows.length, urls: urlRows.length, failedUrls: failedUrls.length, naRequired,
    // na 는 통과에 넣지 않는다: 검사마다 pass·fail·na 를 따로 센다.
    perCheck, perRule,
    ok: failedRows.length === 0 && failedUrls.length === 0 && naRequired.length === 0,
  }
}

// ── 실행 ──────────────────────────────────────────────────────────────────────────────────────
const rowFile = (dir, job) => join(dir, 'rows', `${createHash('sha1').update(job.id).digest('hex').slice(0, 16)}.json`)
const line = (r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.block} ${r.recipe} ${r.width}${r.theme === 'dark' ? 'D' : ''}${r.fx !== 'default' ? ` fx=${r.fx}` : ''}${r.state ? ` ${r.state}` : ''}${r.extra ? ` ?${r.extra}` : ''}${r.step ? ` [${r.step}]` : ''} ${(r.ms / 1000).toFixed(1)}s${r.na.length ? ` na:${r.na.join(',')}` : ''}${r.pass ? '' : `\n  ${r.failed.map((c) => `${c}: ${r.checks[c].fails.slice(0, 3).join(' | ')}`).join('\n  ')}`}`

export async function main(argv) {
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const only = flag('--only')?.split(',').filter(Boolean)
  const limit = Number(flag('--limit') ?? 0) || null
  const roles = flag('--roles')?.split(',').filter(Boolean)
  const skip = (flag('--skip') ?? '').split(',').filter(Boolean)
  const out = flag('--out') ?? OUT
  const resume = argv.includes('--resume')
  // 나눠 돌리기(수 시간짜리 전체 실행을 잠금 사이에 끊는다): --rows-only 는 행만, --urls-only 는 주소 검사만 하고 요약을 쓰지 않는다.
  // 마지막에 행·주소 캐시 폴더를 한 폴더로 모아 --resume 으로 부르면 다시 재지 않고 전체 요약 하나를 낸다.
  const rowsOnly = argv.includes('--rows-only')
  const urlsOnly = argv.includes('--urls-only')
  if (rowsOnly && urlsOnly) { console.error('--rows-only 와 --urls-only 는 같이 못 쓴다'); return 2 }
  const origin = (argv.filter((a) => !a.startsWith('--'))[0] ?? 'http://localhost:3000').replace(/\/$/, '')
  if (skip.some((s) => ![...URL_CHECKS].includes(s))) { console.error(`--skip 은 ${URL_CHECKS.join('·')} 만 받는다`); return 2 }
  const summaryFile = join(out, 'summary.json')
  mkdirSync(join(out, 'rows'), { recursive: true })
  mkdirSync(join(out, 'urlrows'), { recursive: true })
  rmSync(summaryFile, { force: true }) // 앞 실행의 요약을 도구 실패 뒤에 남기지 않는다
  if (!resume) for (const d of ['rows', 'urlrows']) for (const f of readdirSync(join(out, d))) rmSync(join(out, d, f))
  let session
  try {
    const heads = loadHeads()
    const blocks = loadBlocks(ROOT).filter((b) => b.meta.success && (!only || only.includes(`block-${b.kind}-${b.variant}`) || only.includes(b.kind)))
    if (!blocks.length) throw new Error('고른 블록이 0개다')
    let jobs = blockJobs({ blocks, recipes: heads })
    if (roles) jobs = jobs.filter((j) => roles.includes(j.role))
    if (limit) jobs = jobs.slice(0, limit)
    const faceBlocks = faceFamilies(blocks)
    session = await openSession()
    const rows = []
    let n = 0
    for (const job of urlsOnly ? [] : jobs) {
      const f = rowFile(out, job)
      let row = resume && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null
      if (!row) {
        // 도구 예외(탐색·CDP 기한·표본 실패)는 Chrome 을 새로 띄워 한 번 다시 한다. 두 번째도 던지면 도구 실패다(요약 없음).
        try { row = await runRow(session, origin, job, { heads, faceBlocks }) } catch (e1) {
          console.error(`재시도(도구 예외): ${job.id} — ${e1.message}`)
          await session.close().catch(() => {})
          session = await openSession()
          row = await runRow(session, origin, job, { heads, faceBlocks })
        }
        writeFileSync(f, JSON.stringify(row))
      }
      rows.push(row)
      console.log(`[${++n}/${jobs.length}] ${line(row)}`)
      if (n % 80 === 0) { await session.close(); session = await openSession() } // 누적을 끊는다
    }
    await session.close(); session = null
    if (rowsOnly) {
      const failed = rows.filter((r) => !r.pass).length
      console.log(`행만: 행 ${rows.length}개 중 실패 ${failed}`)
      return failed ? 1 : 0
    }
    const urlRows = []
    const seen = new Set()
    for (const job of jobs.filter((j) => !j.state && !j.extra && !j.step && j.width === 1440 && j.theme === 'light' && j.fx === 'default')) {
      const key = `${job.block}|${job.recipe}`
      if (seen.has(key)) continue
      seen.add(key)
      const uf = join(out, 'urlrows', `${createHash('sha1').update(key).digest('hex').slice(0, 16)}.json`)
      let urlChecks = resume && existsSync(uf) ? JSON.parse(readFileSync(uf, 'utf8')) : null
      if (!urlChecks) {
        // 도구 예외(자식 프로세스 죽음·기한)는 한 번 다시 한다 — 행과 같은 규칙. 두 번째도 던지면 도구 실패다.
        try { urlChecks = await runUrlChecks(origin, job, join(out, 'urls'), skip) } catch (e1) {
          console.error(`재시도(도구 예외): 주소 ${key} — ${String(e1.message).slice(0, 160)}`)
          urlChecks = await runUrlChecks(origin, job, join(out, 'urls'), skip)
        }
        writeFileSync(uf, JSON.stringify(urlChecks))
      }
      urlRows.push({ block: job.block, recipe: job.recipe, checks: urlChecks })
      const bad = Object.entries(urlChecks).filter(([, x]) => x.status === 'fail')
      console.log(`${bad.length ? 'FAIL' : 'PASS'} url ${key} ${Object.entries(urlChecks).map(([c, x]) => `${c}:${c === 'aiTell' ? x.score : x.status}`).join(' ')}${bad.length ? `\n  ${bad.map(([c, x]) => `${c}: ${x.fails.slice(0, 3).join(' | ')}`).join('\n  ')}` : ''}`)
    }
    if (urlsOnly) {
      const failed = urlRows.filter((u) => URL_CHECKS.some((c) => u.checks[c]?.status === 'fail')).length
      console.log(`주소만: 주소 ${urlRows.length}개 중 실패 ${failed}`)
      return failed ? 1 : 0
    }
    const s = summarize(rows, urlRows)
    writeFileSync(summaryFile, JSON.stringify({ origin, skip, ...s, rowsDetail: rows, urlRows }, null, 2) + '\n')
    console.log(`블록 행렬 관문: 행 ${s.rows}개 중 실패 ${s.failedRows} · 주소 ${s.urls}개 중 실패 ${s.failedUrls} · na 필수 어김 ${s.naRequired.length}`)
    console.log(`검사별 통과·실패·na: ${Object.entries(s.perCheck).map(([c, x]) => `${c} ${x.pass}/${x.fail}/${x.na}`).join(' · ')}`)
    for (const x of s.naRequired) console.error(`NA-REQUIRED ${x.block} ${x.id}: ${x.why}`)
    return s.ok ? 0 : 1
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    rmSync(summaryFile, { force: true })
    return 1
  } finally {
    await session?.close().catch(() => {})
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await main(process.argv.slice(2)))
