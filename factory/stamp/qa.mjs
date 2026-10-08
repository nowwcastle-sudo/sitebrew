// 후보 관문 묶음(P3-3 Task 11, 07-qa) — 만든 사이트(Task 9)를 기존 관문들로 재고, 도구마다 종료 코드를 따로 읽어 「공개 가능」을 판정한다.
//   runCandidateQa(runDir, cand, opts) → { gates[{ id, exit, resultFile?, toolFailure, … }], publishable, blockers, warnings, … }
//   결과 파일: <runDir>/<cand.id>/07-qa/summary.json. 공개 불가 사유는 candidate.json blockers 에도 자기 접두로 남긴다(C95 — 결선 보드·공개 관문이 읽는다).
//
// 종료 코드는 docs/agents/agent-guide.md 「관문 도구의 종료 코드」 표대로 도구마다 다르게 읽는다(J10) — 합치지 않는다.
//   ux(run.mjs)      0 통과 · 3 자식 중 하나가 0 아님(report.json 의 gate·behavior 코드로 다시 읽는다: 1 이면 도구 실패, 3 이면 판정 실패) · 1 도구 예외
//   ai-tell          0 쟀다(warn 은 점수 무관) · 3 block 에서 문턱 초과 · 1 측정 없음(**파일이 있어도** 판정이 아니다 — kill-ai-slop 실패) · 2 인자 오류
//   marketing-gate   0 MUST 어김 없음 · 1 어김(결과 파일 있고 stderr 에 `도구 실패:` 없음) 또는 도구 실패(그 밖)
//   legal-gate       0 모든 조항 ok · 1 판정 실패(결과 파일 있음 — 조항이 전부 unverified 면 pendingReview) 또는 도구 실패
//   doctor           0 전부 ok · 1 점검 실패(정보 — 법률 검토 사유로만 쓴다)
//   ops·marketing-site·a11y(P3-4 — 후보 어댑터가 자기 종료 코드를 이미 읽어 { verdict, toolFailure, … } 기록으로 돌려준다. 여기서는 그 기록을 그대로 믿고 합친다)
//     ops-gate         0 필수 검사 어김 없음(필수 `na` 는 `naOk` 행만 통과) · 1 어김 또는 도구 실패(홈이 안 열림·Chrome·Lighthouse) — 보안 헤더는 정적 앞면이라 hash CSP(`security` 로 바꾼다)
//     marketing-site   0 사이트·쪽 MUST 어김 없음 · 1 어김 또는 도구 실패(규칙 전부 `na` 포함) — 쪽 단위 marketing-gate 결과는 이 안에 들어 있다(쪽마다 따로 돌리지 않는다)
//     a11y-gate        0 실패 없음 · 1 axe critical·serious/행동 검사 실패 또는 도구 실패(열리지 않는 쪽·미디어 에뮬레이션 안 걸림) — 쪽마다 CLI 를 따로 돌려 하나라도 도구 실패면 도구 실패
//     strict(P3-4 Task 4) 0 원형 엄격 기준 어김 없음 · 1 어김(규칙이 요구한 쪽을 못 잰 `na` 포함) 또는 도구 실패(쪽이 안 열림·Chrome) — 원형마다 첫 화면에 있어야 할 것(`STRICT_BY_ARCHETYPE`), 열린 쪽만
//     bold-safety(factory v1 Task 4.2, D20) 대담안(cand.boldness "bold")만. 0 안전 기준 어김 없음 · 1 어김(LCP·CLS·깜빡임·대비·동작 줄이기 정지·public/dashboard 모션 금지, 못 잰 값 포함) 또는 도구 실패
//       (앞선 ops·a11y 결과가 없거나 Chrome 측정 예외) — LCP·CLS·대비는 앞선 관문 결과를 읽는다. 끄려면 opts.bold:false, 안쪽 측정기는 opts.boldOptions.measure
//   공통: 2 = 인자 오류(묶음이 도구를 잘못 불렀다) · 신호·시간 초과 = 도구 실패 · 0 인데 결과 파일이 없거나 모양이 틀리면 도구 실패(「통과」가 아니라 검증 대상).
// 도구 실패(측정 못 함)는 공개 가능이 아니다 — 다만 AI 티는 문턱이 없는 동안(대장 C80) 재기만 하는 관문이라 경고로만 남긴다.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pendingReview } from '../legal/drafts.mjs'
import { a11yGateForCandidate } from '../qa/a11y-gate.mjs'
import { marketingSiteForCandidate } from '../qa/marketing-site.mjs'
import { opsGateForCandidate } from '../qa/ops-gate.mjs'
import { boldSafetyForCandidate } from '../qa/bold-safety.mjs'
import { STRICT_BY_ARCHETYPE, strictGateForCandidate } from '../qa/strict-archetype.mjs'
import { MOCK_PREVIEW_BLOCKER } from './blocker-class.mjs'
import { splitBlockers } from './blocker-class.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FACTORY = join(ROOT, 'factory')

export const QA_PREFIX = {
  gate: '공개 불가 — 관문 실패: ',
  tool: '공개 불가 — 관문 도구 실패(측정 못 함): ',
  legalPending: '공개 불가 — 법률 검토 미완: ',
  legalFail: '공개 불가 — 법률 검토 실패: ',
  ops: '공개 불가 — 운영 점검 실패: ',
  strict: '공개 불가 — 원형 엄격 기준: ',
  bold: '공개 불가 — 대담안 안전 기준: ',
  mockPreview: MOCK_PREVIEW_BLOCKER, // product 후보의 미리보기 배포 — stamp.mjs 가 더한다(blocker-class.mjs)
}
const QA_PREFIXES = Object.values(QA_PREFIX)

/** 도구 → 스크립트·결과 파일 이름. */
export const TOOLS = {
  ux: { script: join(FACTORY, 'qa', 'run.mjs'), result: 'report.json' },
  'ai-tell': { script: join(FACTORY, 'qa', 'ai-tell.mjs'), result: 'ai-tell.json' },
  marketing: { script: join(FACTORY, 'qa', 'marketing-gate.mjs'), result: 'marketing-gate.json' },
  legal: { script: join(FACTORY, 'qa', 'legal-gate.mjs'), result: 'legal-gate.json' },
  doctor: { script: join(FACTORY, 'doctor.mjs'), result: null },
}

// ── 종료 코드 읽기 ──────────────────────────────────────────────────────────

/**
 * 도구 하나의 종료 코드·결과 파일·stderr → 판정. 순수 함수(파일을 읽지 않는다).
 * @param {'ux'|'ai-tell'|'marketing'|'legal'|'doctor'} tool
 * @param {{ exit: number|null, result?: object|null, stderr?: string }} r  result = 결과 파일을 읽은 JSON(없으면 null)
 * @returns {{ verdict: 'pass'|'fail'|'tool', note: string, pendingReview?: boolean }}
 */
export function interpretGate(tool, { exit, result = null, stderr = '' }) {
  const toolFail = (note) => ({ verdict: 'tool', note })
  const pass = (note = '') => ({ verdict: 'pass', note })
  const fail = (note, extra = {}) => ({ verdict: 'fail', note, ...extra })
  if (!TOOLS[tool]) throw new Error(`모르는 관문 도구: ${tool}`)
  if (exit === null || exit === undefined) return toolFail('신호·시간 초과로 끝났다(종료 코드 없음)')
  if (exit === 2) return toolFail('인자 오류(종료 2) — 묶음이 도구를 잘못 불렀다')
  const say = /도구 실패:/.test(stderr) ? stderr.match(/도구 실패:[^\n]*/)[0] : ''
  if (exit !== 0 && say && tool !== 'doctor') return toolFail(say)

  switch (tool) {
    case 'ux': {
      if (exit === 0) return result && result.gate === 0 && result.behavior === 0 ? pass() : toolFail('종료 0 인데 report.json 이 없거나 gate·behavior 가 0 이 아니다')
      if (exit === 3) {
        if (!result || typeof result.gate !== 'number' || typeof result.behavior !== 'number') return toolFail('종료 3 인데 report.json 이 없다 — 자식 코드를 읽지 못했다')
        const bad = [['ux-gate', result.gate], ['behavior', result.behavior]].filter(([, c]) => c !== 0)
        const broken = bad.filter(([, c]) => c !== 3)
        if (broken.length) return toolFail(`자식 도구 예외: ${broken.map(([n, c]) => `${n} 종료 ${c}`).join(' · ')}(판정이 아니다)`)
        return fail(`판정 실패: ${bad.map(([n]) => n).join(' · ')}`)
      }
      return toolFail(`종료 ${exit}(표에 없는 코드 — 1 = 도구 예외)`)
    }
    case 'ai-tell': {
      if (exit === 0) return result && typeof result.score === 'number' ? pass(`점수 ${result.scoreG ?? result.score}/${result.maxG ?? '?'}`) : toolFail('종료 0 인데 ai-tell.json 이 없거나 점수가 없다')
      if (exit === 3) return result && typeof result.score === 'number' ? fail(`문턱 초과: 점수 ${result.scoreG ?? result.score} > ${result.threshold}`) : toolFail('종료 3 인데 ai-tell.json 이 없다')
      if (exit === 1) return toolFail(`측정 없음(종료 1${result ? ' — 결과 파일은 있지만 kill-ai-slop 실패라 판정이 아니다' : ''})`)
      return toolFail(`종료 ${exit}(표에 없는 코드)`)
    }
    case 'marketing': {
      if (exit === 0) {
        if (!result || !Array.isArray(result.rules)) return toolFail('종료 0 인데 marketing-gate.json 이 없거나 모양이 틀리다')
        if (result.rules.length === 0 || result.rules.every((x) => x.status === 'na')) return toolFail('종료 0 인데 규칙 전부 na — 아무것도 재지 못했다(통과가 아니다)')
        return pass(`규칙 ${result.rules.length}개 중 어김 0 · 경고 ${(result.warn ?? []).length} · na ${result.rules.filter((x) => x.status === 'na').length}`)
      }
      if (exit === 1) return result && Array.isArray(result.rules) ? fail(`MUST 어김: ${(result.fail ?? []).join(' · ') || '(id 없음)'}`) : toolFail('종료 1 이고 marketing-gate.json 이 없다(도구 실패)')
      return toolFail(`종료 ${exit}(표에 없는 코드)`)
    }
    case 'legal': {
      if (exit === 0) return result && result.ok === true ? pass('모든 조항 ok') : toolFail('종료 0 인데 legal-gate.json 이 없거나 ok 가 아니다')
      if (exit === 1) {
        if (!result || typeof result.pages !== 'object') return toolFail('종료 1 이고 legal-gate.json 이 없다(도구 실패 — 검토 파일 없음·모양 틀림)')
        const failures = Object.values(result.pages).flatMap((p) => p.failures ?? [])
        const pending = failures.length > 0 && failures.every((f) => f.rule === 'verdict-unverified')
        return fail(pending ? `법률 검토 미완: 조항 ${failures.length}개 unverified` : `판정 실패: 조항 ${failures.length}개`, { pendingReview: pending })
      }
      return toolFail(`종료 ${exit}(표에 없는 코드)`)
    }
    case 'doctor':
      return exit === 0 ? pass() : fail('점검 실패(종료 1) — 법률 검토 환경이 안 된다')
    default:
      return toolFail('알 수 없는 도구')
  }
}

// ── 도구 실행 ───────────────────────────────────────────────────────────────

function killTree(child) {
  if (!child.pid) return
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  else child.kill('SIGKILL')
}

/** 기본 실행기: 노드 스크립트 하나를 비동기 spawn 한다(spawnSync 를 쓰지 않는다). 기한이 지나면 죽이고 exit = null. */
export function runToolDefault(tool, args, { timeoutMs = 300_000 } = {}) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [TOOLS[tool].script, ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let stdout = '', stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    const timer = setTimeout(() => { stderr += `\n도구 실패: ${timeoutMs / 1000}초 안에 끝나지 않아 죽였다`; killTree(child) }, timeoutMs)
    let finished = false
    const end = (exit) => { if (finished) return; finished = true; clearTimeout(timer); done({ exit, stdout, stderr }) }
    child.on('error', (e) => { stderr += `\n도구 실패: ${e.message}`; end(null) })
    child.on('close', (code) => end(stderr.includes('안에 끝나지 않아 죽였다') ? null : code))
  })
}

const readJsonMaybe = (file) => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}
const writeAtomic = (file, text) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, text)
  renameSync(`${file}.tmp`, file)
}
export const routeSlug = (route) => (route === '/' ? 'home' : route.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase())

// ── 사이트 띄우기 ───────────────────────────────────────────────────────────

const freePort = () => new Promise((res, rej) => {
  const s = net.createServer()
  s.once('error', rej)
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)) })
})

/** `next start` 를 빈 포트에 띄운다. → { url, stop() }. 관문 잠금 안에서만 부른다. */
export async function startSite(siteDir, { timeoutMs = 90_000 } = {}) {
  const nextBin = join(siteDir, 'node_modules', 'next', 'dist', 'bin', 'next')
  if (!existsSync(nextBin)) throw new Error(`도구 실패: ${nextBin} 없음 — 사이트에 npm 설치가 안 됐다`)
  if (!existsSync(join(siteDir, '.next', 'BUILD_ID'))) throw new Error(`도구 실패: ${join(siteDir, '.next', 'BUILD_ID')} 없음 — 사이트가 빌드되지 않았다`)
  const port = await freePort()
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: siteDir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let out = ''
  child.stdout.on('data', (d) => { out += d })
  child.stderr.on('data', (d) => { out += d })
  let exited = null
  child.on('close', (c) => { exited = c ?? -1 })
  const url = `http://127.0.0.1:${port}`
  const stop = async () => {
    if (exited === null) { killTree(child); for (let i = 0; i < 50 && exited === null; i++) await new Promise((r) => setTimeout(r, 100)) }
  }
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (exited !== null) throw new Error(`도구 실패: next start 가 종료 ${exited} 로 끝났다 — ${out.trim().split('\n').slice(-3).join(' | ')}`)
    try { const r = await fetch(`${url}/`, { signal: AbortSignal.timeout(3000) }); if (r.ok) return { url, stop } } catch { /* 아직 안 떴다 */ }
    await new Promise((r) => setTimeout(r, 400))
  }
  await stop()
  throw new Error(`도구 실패: next start 가 ${timeoutMs / 1000}초 안에 응답하지 않았다 — ${out.trim().split('\n').slice(-3).join(' | ')}`)
}

// ── candidate.json blockers ─────────────────────────────────────────────────

/** candidate.json blockers 중 이 묶음이 남긴 줄(QA 접두)만 바꾼다. 다른 단계의 줄·다른 칸은 그대로. → 합친 blockers */
export function writeQaBlockers(runDir, candId, lines) {
  const file = join(runDir, candId, 'candidate.json')
  const cur = readJsonMaybe(file) ?? {}
  const keep = (cur.blockers ?? []).filter((b) => !QA_PREFIXES.some((p) => b.startsWith(p)))
  const next = { ...cur, blockers: [...keep, ...lines] }
  writeAtomic(file, JSON.stringify(next, null, 2) + '\n')
  return next.blockers
}

// ── 묶음 ────────────────────────────────────────────────────────────────────

/**
 * @param {string} runDir
 * @param {{ id: string }} cand
 * @param {{ url?: string, routes?: string[], aiTellThreshold?: number|null, toolRetries?: number, timeoutMs?: number, security?: 'auto'|'hash'|'nonce',
 *           runTool?: Function, fetch?: Function, log?: Function, opsOptions?: object, marketingSiteOptions?: object, a11yOptions?: object, strict?: boolean, strictOptions?: object }} [opts]
 *   url 을 안 주면 `next start` 를 빈 포트에 띄운다(관문 잠금 안에서만). 도구 실패는 toolRetries(기본 1, 최대 2)번 다시 돈다.
 *   strict(기본 켬)는 원형 엄격 기준 관문이다 — false 면 건너뛴다. strictOptions 는 어댑터(`strictGateForCandidate`)에 그대로 넘긴다(시험용 가짜 측정기 `measure`).
 *   bold(기본 켬)는 대담안 안전 관문이다 — cand.boldness 가 "bold" 일 때만 돌고, false 면 건너뛴다. boldOptions 는 어댑터(`boldSafetyForCandidate`)에 그대로 넘긴다(시험용 가짜 측정기 `measure`).
 *   opsOptions·marketingSiteOptions·a11yOptions 는 후보 어댑터(`opsGateForCandidate` 등)에 그대로 넘긴다(Lighthouse 쪽 고르기·시험용 가짜 측정기).
 */
export async function runCandidateQa(runDir, cand, opts = {}) {
  const { aiTellThreshold = null, timeoutMs = 300_000, log = () => {} } = opts
  const retries = Math.min(2, Math.max(0, opts.toolRetries ?? 1))
  const runTool = opts.runTool ?? ((tool, args) => runToolDefault(tool, args, { timeoutMs }))
  const candDir = join(runDir, cand.id)
  const siteDir = join(candDir, 'site')
  const qaDir = join(candDir, '07-qa')
  const siteJson = readJsonMaybe(join(siteDir, 'content', 'site.json'))
  if (!siteJson) throw new Error(`도구 실패: ${join(siteDir, 'content', 'site.json')} 없음 — 06-pages 를 먼저 돌린다`)
  const routes = opts.routes ?? Object.keys(siteJson.pages ?? {})
  if (!routes.length) throw new Error('도구 실패: site.json 에 쪽이 하나도 없다')
  mkdirSync(qaDir, { recursive: true })

  const started = Date.now()
  let server = null
  let url = opts.url
  if (!url) { server = await startSite(siteDir); url = server.url }
  const rel = (f) => relative(candDir, f).replace(/\\/g, '/')

  const gates = []
  const legalPages = Object.keys(siteJson.legal ?? {})
  /** 도구 하나를 돌려 게이트 한 칸을 만든다(도구 실패는 retries 번 다시). */
  const gate = async (id, tool, args, resultPath, extra = {}) => {
    let attempts = 0, verdict, run, result, t0
    do {
      if (resultPath) rmSync(resultPath, { force: true })
      t0 = Date.now()
      run = await runTool(tool, args)
      result = resultPath ? readJsonMaybe(resultPath) : null
      verdict = interpretGate(tool, { exit: run.exit ?? null, result, stderr: run.stderr ?? '' })
      attempts++
      if (verdict.verdict === 'tool') log(`${id}: 도구 실패(시도 ${attempts}) — ${verdict.note}`)
    } while (verdict.verdict === 'tool' && attempts <= retries && run.exit !== 2)
    const g = {
      id, tool, exit: run.exit ?? null, verdict: verdict.verdict, toolFailure: verdict.verdict === 'tool', note: verdict.note, attempts,
      seconds: Math.round((Date.now() - t0) / 100) / 10, ...(resultPath && result ? { resultFile: rel(resultPath) } : {}), ...(tool === 'legal' ? { pendingReview: verdict.pendingReview === true } : {}), ...extra,
    }
    if (tool === 'ai-tell' && result) { g.score = result.scoreG ?? result.score; g.maxScore = result.maxG }
    if (tool === 'ux' && result) g.children = { gate: result.gate, behavior: result.behavior }
    gates.push(g)
    log(`${id}: exit ${g.exit} → ${g.verdict}${g.note ? ` (${g.note})` : ''}`)
    return g
  }

  /** 어댑터 하나(ops·marketing-site·a11y)를 돌려 게이트 한 칸을 만든다. 어댑터가 자기 종료 코드를 이미 읽어 돌려준 기록을 믿고, 도구 실패만 retries 번 다시 돈다. */
  const adapterGate = async (id, run) => {
    let rec, attempts = 0, t0
    do {
      t0 = Date.now()
      rec = await run()
      attempts++
      if (rec.toolFailure) log(`${id}: 도구 실패(시도 ${attempts}) — ${rec.note}`)
    } while (rec.toolFailure && attempts <= retries)
    const g = { ...rec, attempts, seconds: rec.seconds ?? Math.round((Date.now() - t0) / 100) / 10 } // marketing-site 어댑터는 시간을 안 적는다
    gates.push(g)
    log(`${id}: exit ${g.exit} → ${g.verdict}${g.note ? ` (${g.note})` : ''}`)
    return g
  }

  try {
    // 1. 법률: doctor(정보) → 검토 파일이 없는 쪽은 pendingReview 로 채우고 → legal-gate
    if (legalPages.length) {
      const doctor = await gate('doctor-legal', 'doctor', ['--stage', 'legal'], null, { informational: true })
      const legalDir = join(qaDir, 'legal')
      mkdirSync(legalDir, { recursive: true })
      const reason = doctor.exit === 0 ? '법률 에이전트 검토 전 — 검토 파일(review.json)이 없다' : `${doctor.note} — doctor --stage legal 이 실패해 검토를 못 했다`
      for (const page of legalPages) {
        const review = join(legalDir, `${page}.review.json`)
        if (existsSync(review)) continue
        const draft = readJsonMaybe(join(legalDir, `${page}.draft.json`))
        if (!draft?.clauses?.length) throw new Error(`도구 실패: ${page}.draft.json 이 없거나 조항이 없다 — 06-pages 가 초안을 써야 한다`)
        writeAtomic(review, JSON.stringify(pendingReview({ [page]: draft }, reason)[page], null, 2) + '\n')
      }
      await gate('legal', 'legal', [legalDir, '--locale', siteJson.locale === 'en' ? 'en' : 'ko', '--pages', legalPages.join(',')], join(legalDir, 'legal-gate.json'))
    }

    // 2. ops-gate(P3-4 Task 1 — 최소판을 대체): 사실 빈칸·법정 경로·파비콘 세트·오류 쪽·보안 헤더·sitemap·robots·Lighthouse(대표 쪽만)·bf-cache …
    //    보안 헤더는 정적 앞면이라 hash CSP(어댑터 기본값 — 원형 completion 이 product 여도 nonce 는 launch-factory 몫, C231). 바꾸려면 opts.security.
    await adapterGate('ops', () => opsGateForCandidate(runDir, cand, { origin: url, ...(opts.routes ? { routes: opts.routes } : {}), ...(opts.security ? { security: opts.security } : {}), ...(opts.opsOptions ?? {}) }))

    // 3. 쪽마다: 먼저 열리는지(open) → ux(run.mjs) · ai-tell.
    //    ux-gate 는 열리지 않는 쪽(Chrome 오류 페이지)도 「본문 대비 실패」로 재서 판정 실패처럼 보이므로(실측 — 죽은 주소에서 종료 3),
    //    열리지 않는 쪽에서는 Chrome 관문을 돌리지 않는다. 마케팅·접근성은 아래에서 사이트 단위로 한 번씩(열린 쪽만).
    const fetchImpl = opts.fetch ?? globalThis.fetch
    const openedRoutes = []
    for (const route of routes) {
      const slug = routeSlug(route)
      const pageUrl = `${url}${route}`
      const t0 = Date.now()
      let status = null, err = null
      try { status = (await fetchImpl(pageUrl, { signal: AbortSignal.timeout(15_000) })).status } catch (e) { err = e?.message ?? String(e) }
      const opened = err === null && status === 200
      gates.push({
        id: `open:${route}`, tool: 'ops', route, exit: opened ? 0 : 1, verdict: opened ? 'pass' : err ? 'tool' : 'fail', toolFailure: err !== null, attempts: 1, seconds: Math.round((Date.now() - t0) / 100) / 10,
        note: opened ? '' : err ? `도구 실패: ${route} 를 읽지 못했다: ${err}` : `${route} 가 ${status} — Chrome 관문을 돌리지 않았다`, ...(err || opened ? {} : { problems: [`${route} 가 ${status}`] }),
      })
      log(`open:${route}: ${opened ? 'pass' : gates.at(-1).note}`)
      if (!opened) continue
      openedRoutes.push(route)

      const dirOf = (tool) => join(qaDir, tool, slug)
      await gate(`ux:${route}`, 'ux', [pageUrl, dirOf('ux')], join(dirOf('ux'), TOOLS.ux.result), { route })
      const aiArgs = [pageUrl, '--out', dirOf('ai-tell'), ...(aiTellThreshold === null ? ['--mode', 'warn'] : ['--mode', 'block', '--threshold', String(aiTellThreshold)])]
      await gate(`ai-tell:${route}`, 'ai-tell', aiArgs, join(dirOf('ai-tell'), TOOLS['ai-tell'].result), { route })
    }

    // 4. 마케팅 사이트 관문(P3-4 Task 2 — 쪽 단위 marketing-gate 는 그 안 pages[] 에 들어 있어 쪽마다 따로 돌리지 않는다): 02-sitemap 을 읽어 흐름·전환·문체
    await adapterGate('marketing-site', () => marketingSiteForCandidate(runDir, cand, { origin: url, ...(opts.marketingSiteOptions ?? {}) }))

    // 5. 접근성 행렬(P3-4 Task 3 — 라이트·다크·강제 색 × 1440·375, axe + WCAG 2.2 행동): 열린 쪽만. 안 열린 쪽은 ops·open 관문이 이미 잡았다.
    if (openedRoutes.length) await adapterGate('a11y', () => a11yGateForCandidate(runDir, cand, { origin: url, routes: openedRoutes, ...(opts.a11yOptions ?? {}) }))

    // 6. 원형 엄격 기준(P3-4 Task 4 — 원형마다 첫 화면에 있어야 할 것): 열린 쪽만, 기준이 있는 원형만.
    if (opts.strict !== false && openedRoutes.length && STRICT_BY_ARCHETYPE[siteJson.archetype]) await adapterGate('strict', () => strictGateForCandidate(runDir, cand, { origin: url, routes: openedRoutes, archetype: siteJson.archetype, ...(opts.strictOptions ?? {}) }))

    // 7. 대담안 안전(factory v1 Task 4.2 · D20 — 대담안(cand.boldness "bold")만): LCP·CLS 는 위 ops-gate, 대비는 위 a11y 행렬의 결과를 읽고(다시 재지 않는다),
    //    새로 재는 것은 동작 줄이기에서 정지 화면인지와 깜빡임 상한뿐이다. 위 두 관문이 결과를 못 남겼으면 재지 못한 것이라 도구 실패다.
    if (opts.bold !== false && cand.boldness === 'bold' && openedRoutes.length) {
      const opsRec = gates.find((g) => g.id === 'ops')
      const ops = opsRec?.resultFile ? readJsonMaybe(join(candDir, opsRec.resultFile)) : null
      await adapterGate('bold-safety', () => boldSafetyForCandidate(runDir, cand, { origin: url, routes: openedRoutes, archetype: siteJson.archetype, boldMode: cand.boldMode, ops, a11y: gates.find((g) => g.id === 'a11y') ?? null, ...(opts.boldOptions ?? {}) }))
    }
  } finally {
    await server?.stop()
  }

  // ── 판정 합치기 ──
  const qaLines = []
  const warnings = []
  const noThreshold = aiTellThreshold === null
  for (const g of gates) {
    if (g.tool === 'doctor') { if (g.verdict !== 'pass') warnings.push(`${g.id}: ${g.note}`); continue }
    if (g.tool === 'ai-tell') {
      if (g.verdict === 'pass') warnings.push(`AI 티 ${g.route}: ${g.note}(문턱 없음 — 대장 C80)`)
      else if (noThreshold) warnings.push(`AI 티 ${g.route}: ${g.note}`)
    }
    if (g.tool === 'marketing-site' && g.verdict !== 'tool' && g.warn?.length) warnings.push(`마케팅 사이트: SHOULD 경고 ${g.warn.join('·')}`)
    if (g.tool === 'a11y' && g.verdict !== 'tool') {
      const n = Object.entries(g.routes ?? {}).filter(([, r]) => r.warnings > 0)
      if (n.length) warnings.push(`접근성 경고: ${n.map(([r, x]) => `${r} ${x.warnings}건`).join(' · ')}`)
    }
    if (g.verdict === 'pass') continue
    if (g.tool === 'ai-tell' && noThreshold && g.verdict === 'tool') continue // 문턱이 없는 재기 전용 — 측정 실패는 경고로만
    if (g.verdict === 'tool') { qaLines.push(`${QA_PREFIX.tool}${g.id} — ${g.note}`); continue }
    if (g.tool === 'legal') qaLines.push(`${g.pendingReview ? QA_PREFIX.legalPending : QA_PREFIX.legalFail}${g.pendingReview ? legalPages.join('·') : g.note}${g.pendingReview ? ` — 조항 검토 전(${g.note})` : ''}`)
    else if (g.tool === 'ops') for (const p of g.problems?.length ? g.problems : [g.note || `${g.id} 실패`]) qaLines.push(`${QA_PREFIX.ops}${p}`)
    else if (g.tool === 'strict') for (const p of g.problems?.length ? g.problems : [g.note || `${g.id} 실패`]) qaLines.push(`${QA_PREFIX.strict}${p}`)
    else if (g.tool === 'bold-safety') for (const p of g.problems?.length ? g.problems : [g.note || `${g.id} 실패`]) qaLines.push(`${QA_PREFIX.bold}${p}`)
    else qaLines.push(`${QA_PREFIX.gate}${g.id} — ${g.note}`)
  }
  const blockers = writeQaBlockers(runDir, cand.id, [...new Set(qaLines)])
  const aiGates = gates.filter((g) => g.tool === 'ai-tell')
  const failedAi = aiGates.filter((g) => g.verdict === 'fail')
  // 사람 확인(관문이 못 재는 것 — marketing-site 의 manualChecks 9개)은 게이트 칸이 아니라 summary 한 곳에만 싣는다(보드 카드가 「사람 확인 n개」로 읽는다)
  const manualChecks = gates.find((g) => g.tool === 'marketing-site')?.manualChecks ?? []
  for (const g of gates) delete g.manualChecks
  const summary = {
    candidate: cand.id, url, finishedAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 100) / 10,
    routes, gates, publishable: blockers.length === 0, blockers,
    // Task 6.1(D19): 사유를 두 갈래로 가른다 — input = 대표 입력 대기, quality = 그 밖. 기계 기준은 quality 가 비는 것(publishable 은 둘 다 비어야 true 로 그대로).
    blockerKinds: splitBlockers(blockers),
    warnings, manualChecks,
    aiTell: { threshold: aiTellThreshold, scores: Object.fromEntries(aiGates.filter((g) => g.score !== undefined).map((g) => [g.route, g.score])) },
    // 문턱을 준 실행에서 떨어졌으면 pickDirections 의 exclude 로 넘긴다(대장 C80)
    exclude: failedAi.length ? [{ id: cand.id, reasons: failedAi.map((g) => `ai-tell:${g.score ?? '?'}`) }] : null,
  }
  writeAtomic(join(qaDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
  return summary
}
