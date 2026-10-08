// 07-qa 관문 묶음(P3-3 Task 11) — 가짜 관문 결과로 종료 코드 해석·판정 합치기·summary.json 모양을 본다. Chrome·서버를 띄우지 않는다.
// legal-gate 만은 진짜를 부른다(Chrome 없이 도는 판정 도구 — pendingReview 흐름을 끝까지 본다).
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/stamp-qa.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { interpretGate, QA_PREFIX, routeSlug, runCandidateQa, runToolDefault, writeQaBlockers } from '../stamp/qa.mjs'
import { MANUAL_CHECKS } from '../qa/marketing-site.mjs'
import { ToolFailure } from '../qa/ops-gate.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = join(root, '.tmp', 'stamp-qa-test')
mkdirSync(TMP, { recursive: true })

const j = (o) => JSON.stringify(o, null, 2) + '\n'
const readJ = (f) => JSON.parse(readFileSync(f, 'utf8'))
const OK_REVIEW = [{ clause: 'c1', verdict: 'ok', basis: [{ law: '개인정보 보호법', article: '제15조', url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=1', mst: '1', effectiveDate: '20250101', fetchedAt: '2026-09-30' }], note: '' }]

// ─── 1. 종료 코드 읽기: 도구마다 1의 뜻이 다르다(J10) ───

const I = (tool, exit, result = null, stderr = '') => interpretGate(tool, { exit, result, stderr })

test('interpret ai-tell: 0=쟀다 · 1=측정 없음(파일이 있어도 도구 실패) · 3=block 초과 · 2=인자 오류', () => {
  assert.equal(I('ai-tell', 0, { score: 12, scoreG: 12, maxG: 239 }).verdict, 'pass')
  assert.equal(I('ai-tell', 0, null).verdict, 'tool', '0 인데 결과 파일 없음 = 통과가 아니라 검증 대상')
  assert.equal(I('ai-tell', 0, {}).verdict, 'tool', '0 인데 점수 없음')
  assert.equal(I('ai-tell', 1, null).verdict, 'tool', '1 + 결과 파일 없음 = 도구 실패')
  const withFile = I('ai-tell', 1, { score: 30, scoreG: 30 })
  assert.equal(withFile.verdict, 'tool', 'ai-tell 의 1 은 결과 파일이 있어도 판정이 아니다(kill-ai-slop 실패)')
  assert.match(withFile.note, /측정 없음/)
  assert.equal(I('ai-tell', 3, { score: 80, scoreG: 80, threshold: 50 }).verdict, 'fail')
  assert.equal(I('ai-tell', 3, null).verdict, 'tool')
  assert.equal(I('ai-tell', 2, null).verdict, 'tool')
  assert.equal(I('ai-tell', null, null).verdict, 'tool', '시간 초과·신호')
})

test('interpret marketing: 1 + 결과 파일 = 판정 실패 · 1 + 결과 파일 없음 = 도구 실패 · stderr 도구 실패가 이긴다 · 0 인데 전부 na 는 통과가 아니다', () => {
  const rules = [{ id: 'a', status: 'pass' }, { id: 'b', status: 'na' }]
  assert.equal(I('marketing', 0, { rules, fail: [], warn: [] }).verdict, 'pass')
  const f = I('marketing', 1, { rules: [{ id: 'x', status: 'fail' }], fail: ['x'], warn: [] })
  assert.equal(f.verdict, 'fail')
  assert.match(f.note, /x/)
  assert.equal(I('marketing', 1, null).verdict, 'tool')
  assert.equal(I('marketing', 1, { rules, fail: ['a'] }, '도구 실패: Chrome 시작 실패').verdict, 'tool', '결과 파일이 이전 실행 것이라도 stderr 도구 실패면 도구 실패')
  assert.equal(I('marketing', 0, { rules: [{ id: 'a', status: 'na' }] }).verdict, 'tool', '전부 na = 재지 못함')
  assert.equal(I('marketing', 0, null).verdict, 'tool')
  assert.equal(I('marketing', 0, { rules: [] }).verdict, 'tool')
})

test('interpret ux(run.mjs): 3 은 report.json 의 자식 코드로 다시 읽는다 — 자식 1 = 도구 예외, 자식 3 = 판정', () => {
  assert.equal(I('ux', 0, { gate: 0, behavior: 0 }).verdict, 'pass')
  assert.equal(I('ux', 0, null).verdict, 'tool')
  assert.equal(I('ux', 3, { gate: 3, behavior: 0 }).verdict, 'fail')
  assert.equal(I('ux', 3, { gate: 0, behavior: 3 }).verdict, 'fail')
  const broken = I('ux', 3, { gate: 1, behavior: 0 })
  assert.equal(broken.verdict, 'tool')
  assert.match(broken.note, /ux-gate 종료 1/)
  assert.equal(I('ux', 3, { gate: 3, behavior: 1 }).verdict, 'tool', '하나라도 도구 예외면 판정이 아니다')
  assert.equal(I('ux', 3, null).verdict, 'tool')
  assert.equal(I('ux', 1, null).verdict, 'tool')
})

test('interpret legal: 0=ok · 1+결과=판정(전부 unverified 면 pendingReview) · 1+결과 없음=도구 실패', () => {
  assert.equal(I('legal', 0, { ok: true, pages: {} }).verdict, 'pass')
  assert.equal(I('legal', 0, { ok: false, pages: {} }).verdict, 'tool')
  const pend = I('legal', 1, { ok: false, pages: { privacy: { failures: [{ rule: 'verdict-unverified' }, { rule: 'verdict-unverified' }] } } })
  assert.deepEqual([pend.verdict, pend.pendingReview], ['fail', true])
  const fix = I('legal', 1, { ok: false, pages: { privacy: { failures: [{ rule: 'verdict-unverified' }, { rule: 'verdict-fix' }] } } })
  assert.deepEqual([fix.verdict, fix.pendingReview], ['fail', false])
  assert.equal(I('legal', 1, { ok: false, pages: { p: { failures: [{ rule: 'basis-host' }] } } }).pendingReview, false)
  assert.equal(I('legal', 1, null, '도구 실패: 검토 파일(*.review.json) 없음').verdict, 'tool')
  assert.equal(I('legal', 1, null).verdict, 'tool')
})

test('interpret doctor: 1 은 정보(fail) · 도구가 아닌 것을 모르는 이름은 던진다', () => {
  assert.equal(I('doctor', 0).verdict, 'pass')
  assert.equal(I('doctor', 1, null, '도구 실패: LAW_API_OC 없음').verdict, 'fail')
  assert.throws(() => I('lint-ui', 0), /모르는 관문 도구/)
})

// ─── 2. 묶음: 가짜 관문 + 가짜 서버 ───
// ops·marketing-site·a11y 는 진짜 후보 어댑터(opsGateForCandidate 등)를 부르고, 안쪽 측정기만 가짜로 바꾼다(opsOptions.runOps · marketingSiteOptions.measure · a11yOptions.runTool).
// 그래서 어댑터의 종료 코드 읽기(판정 실패 · 도구 실패 · 통과 · 필수 na)가 묶음 배선까지 그대로 흐르는지 본다.

/** 열리는 쪽 표(200) — over 로 쪽을 고쳐 404·연결 실패를 만든다. 묶음은 쪽이 열리는지만 fetch 로 본다(나머지 점검은 관문이 한다). */
const openFetch = (over = {}) => async (u) => {
  const path = new URL(u).pathname
  const r = { '/': 200, '/privacy': 200, '/signup': 200, ...over }[path]
  if (r instanceof Error) throw r
  return { status: r ?? 404 }
}

let n = 0
/** 후보 폴더 하나(사이트 파일·candidate.json·사이트맵·법정 초안)를 만든다. */
function fixture({ blockers = [], siteJson = {}, review = 'ok' } = {}) {
  const runDir = mkdtempSync(join(TMP, `run${n++}-`))
  const cand = { id: 'a' }
  const candDir = join(runDir, 'a')
  const siteDir = join(candDir, 'site')
  mkdirSync(join(siteDir, 'content'), { recursive: true })
  writeFileSync(join(siteDir, 'content', 'site.json'), j({
    locale: 'ko', archetype: 'local', business: { name: '달빛 베이커리', phone: '02-1234-5678' },
    pages: { '/': { id: 'home', title: '홈' }, '/privacy': { id: 'privacy', title: '개인정보', legal: true } },
    legal: { privacy: { title: '개인정보', draft: true, clauses: [{ title: 't', text: '조항' }] } },
    ...siteJson,
  }))
  writeFileSync(join(candDir, 'candidate.json'), j({ id: 'a', blockers }))
  writeFileSync(join(candDir, '02-sitemap.json'), j({ pages: [{ id: 'home', route: '/' }, { id: 'privacy', route: '/privacy', legal: true }] }))
  const legalDir = join(candDir, '07-qa', 'legal')
  mkdirSync(legalDir, { recursive: true })
  writeFileSync(join(legalDir, 'privacy.draft.json'), j({ markdown: '# 개인정보', clauses: [{ id: 'c1', title: 't', text: '조항', needs: [] }] }))
  if (review === 'ok') writeFileSync(join(legalDir, 'privacy.review.json'), j(OK_REVIEW))
  return { runDir, cand, candDir, legalDir }
}

// 안쪽 측정기의 통과 기본값
const OK_CHECKS = [{ id: 'lh-perf', level: 'must', status: 'pass', route: '/' }, { id: 'security-headers', level: 'must', status: 'pass' }, { id: 'bf-cache', level: 'must', status: 'na' }]
const okOps = () => ({ checks: OK_CHECKS, exit: 0, summary: { pass: 2, fail: 0, warn: 0, na: 1, lighthouse: '1/2' } })
const SITE_RULES_PASS = [{ id: 'flow-reach', status: 'pass' }, { id: 'conv-reaches-receiver', status: 'na' }]
const okSite = () => ({ pages: [{ route: '/', legal: false, result: { rules: [{ id: 'cta-label', status: 'pass' }], fail: [], warn: [] } }], rules: SITE_RULES_PASS, flows: [], conversion: [], tone: [], fail: [], warn: [], manualChecks: [], exit: 0 })
const a11yWrite = (args, body) => { mkdirSync(args[2], { recursive: true }); writeFileSync(join(args[2], 'a11y-gate.json'), j(body)) }
const okA11y = (args) => { a11yWrite(args, { failures: [], warnings: [], summary: { cells: 6 } }); return { exit: 0 } }
// strict(원형 엄격 기준 — P3-4 Task 4): 안쪽 측정기 measure(origin, routes) 만 가짜로. 모든 사실이 첫 화면(0.2)에 있다.
const STRICT_FACTS = { vh: 900, width: 1440, tel: 0.2, hours: 0.2, location: 0.2, price: 0.2, shipping: 0.2, cta: 0.2, pricingLink: 0.2, nav: 0.2, chart: 0.2, numbers: 0.2, works: 0.2, contact: 0.2, services: 0.2, manifest: 0 }
const okStrict = async (origin, routes) => routes.map((route) => ({ route, profiles: { desktop: STRICT_FACTS, mobile: STRICT_FACTS } }))

/** 가짜 관문 — 통과 기본값, 이름별로 덮어쓴다. legal 은 덮어쓰지 않으면 진짜를 부른다. 부른 기록은 calls(도구 이름 · 어댑터 이름). */
function tools(over = {}) {
  const calls = []
  const outOf = (args) => args[args.indexOf('--out') + 1]
  const impl = {
    ux: (args) => { writeFileSync(join(args[1], 'report.json'), j({ gate: 0, behavior: 0, strict: false, pass: true })); return { exit: 0 } },
    'ai-tell': (args) => { writeFileSync(join(outOf(args), 'ai-tell.json'), j({ score: 14, scoreG: 14, maxG: 239, threshold: null })); return { exit: 0 } },
    doctor: () => ({ exit: 0, stdout: 'ok', stderr: '' }),
    ...over.tools,
  }
  const runTool = async (tool, args) => {
    calls.push({ tool, args })
    if (tool === 'ux') mkdirSync(args[1], { recursive: true })
    if (tool === 'ai-tell') mkdirSync(outOf(args), { recursive: true })
    if (!impl[tool]) return runToolDefault(tool, args)
    return { stderr: '', stdout: '', ...impl[tool](args, calls.filter((c) => c.tool === tool).length) }
  }
  const spy = (name, fn) => async (...a) => { calls.push({ tool: name, args: a }); return fn(...a, calls.filter((c) => c.tool === name).length) }
  const adapterOpts = {
    opsOptions: { runOps: spy('ops', over.ops ?? okOps) },
    marketingSiteOptions: { measure: spy('marketing-site', over.site ?? okSite) },
    a11yOptions: { runTool: spy('a11y', over.a11y ?? okA11y) },
    strictOptions: { measure: spy('strict', over.strict ?? okStrict) },
  }
  return { runTool, calls, adapterOpts }
}
/** over = { tools: {…}, ops, site, a11y } — 각각 안쪽 측정기 함수(마지막 인자는 그 측정기를 부른 횟수). */
const qa = (f, over = {}, opts = {}) => {
  const t = tools(over)
  return runCandidateQa(f.runDir, f.cand, { url: 'http://x.test', fetch: openFetch(), runTool: t.runTool, toolRetries: 1, ...t.adapterOpts, ...opts }).then((s) => ({ s, calls: t.calls }))
}
const gateOf = (s, id) => s.gates.find((g) => g.id === id)

test('runCandidateQa: 전부 통과면 publishable=true · blockers 비어 있음 · summary.json 모양 · 게이트 순서', async () => {
  const f = fixture()
  const { s, calls } = await qa(f)
  assert.equal(s.publishable, true, JSON.stringify(s.blockers))
  assert.deepEqual(s.blockers, [])
  // 게이트 = doctor-legal + legal + ops + (쪽 2 × (열림 + ux + ai-tell)) + marketing-site + a11y — 쪽마다 marketing-gate 는 없다(marketing-site 안에 들어 있다)
  assert.deepEqual(s.gates.map((g) => g.id), ['doctor-legal', 'legal', 'ops', 'open:/', 'ux:/', 'ai-tell:/', 'open:/privacy', 'ux:/privacy', 'ai-tell:/privacy', 'marketing-site', 'a11y', 'strict'])
  for (const g of s.gates) {
    assert.equal(typeof g.id, 'string')
    assert.equal(typeof g.exit, 'number')
    assert.equal(g.toolFailure, false, g.id)
    assert.equal(g.verdict, 'pass', `${g.id}: ${g.note}`)
    assert.equal(typeof g.seconds, 'number', `${g.id} 걸린 시간(marketing-site 어댑터는 안 적어 묶음이 채운다)`)
    if (g.tool !== 'doctor' && !g.id.startsWith('open:')) assert.ok(g.resultFile && existsSync(join(f.candDir, g.resultFile)), `${g.id} resultFile`)
  }
  assert.deepEqual(['ops', 'marketing-site', 'a11y', 'strict'].map((id) => gateOf(s, id).resultFile), ['07-qa/ops-gate.json', '07-qa/marketing-site/marketing-site.json', '07-qa/a11y/a11y-gate.json', '07-qa/strict/strict.json'])
  const saved = readJ(join(f.candDir, '07-qa', 'summary.json'))
  assert.deepEqual(Object.keys(saved).sort(), ['aiTell', 'blockerKinds', 'blockers', 'candidate', 'exclude', 'finishedAt', 'gates', 'manualChecks', 'publishable', 'routes', 'seconds', 'url', 'warnings'])
  assert.equal(saved.publishable, true)
  assert.deepEqual(saved.blockerKinds, { input: [], quality: [] }, '사유가 없으면 두 갈래 모두 비어 있다(blockerKinds 는 늘 있다)')
  assert.deepEqual(saved.aiTell.scores, { '/': 14, '/privacy': 14 })
  assert.equal(saved.exclude, null)
  // 사람 확인 9개는 summary 한 곳에만(게이트 칸에는 없다)
  assert.equal(saved.manualChecks.length, MANUAL_CHECKS.length)
  assert.ok(saved.manualChecks.every((m) => m.id && m.how && m.example))
  assert.ok(saved.gates.every((g) => !('manualChecks' in g)))
  // 도구 호출: ai-tell 은 warn 모드(문턱 없음), legal 은 로캘·쪽을 받는다
  assert.deepEqual(calls.find((c) => c.tool === 'ai-tell').args.slice(1), ['--out', join(f.candDir, '07-qa', 'ai-tell', 'home'), '--mode', 'warn'])
  assert.deepEqual(calls.find((c) => c.tool === 'legal').args.slice(1), ['--locale', 'ko', '--pages', 'privacy'])
  assert.equal(calls.filter((c) => c.tool === 'marketing').length, 0, '쪽 단위 marketing-gate 는 부르지 않는다')
  // ops: 주소·정적 앞면이라 hash CSP·사이트 JSON 이 안쪽 측정기까지 간다
  const [origin, opsOpts] = calls.find((c) => c.tool === 'ops').args
  assert.equal(origin, 'http://x.test')
  assert.deepEqual([opsOpts.security, opsOpts.archetype, opsOpts.routes, opsOpts.locale], ['hash', 'local', ['/', '/privacy'], 'ko'])
  assert.equal(opsOpts.siteJson.business.name, '달빛 베이커리')
  // marketing-site: 후보의 02-sitemap, a11y: 열린 쪽 전부
  assert.deepEqual(calls.find((c) => c.tool === 'marketing-site').args[1].pages.map((p) => p.route), ['/', '/privacy'])
  assert.deepEqual(calls.filter((c) => c.tool === 'a11y').map((c) => c.args[0][0]), ['http://x.test/', 'http://x.test/privacy'])
})

test('blockers 병합: Task 6·9 가 candidate.json 에 남긴 공개 불가 줄이 publishable=false 로 흐르고 QA 줄은 자기 접두만 바꾼다', async () => {
  const site = '공개 불가 — 사이트 주소 미정'
  const ex = '공개 불가 — 예시 문구 남음: home/hero — copy.title(예시 표지)'
  const f = fixture({ blockers: [site, ex] })
  const { s } = await qa(f)
  assert.equal(s.publishable, false)
  assert.deepEqual(s.blockers, [site, ex], '이 단계 관문은 통과했지만 앞 단계 blockers 가 남는다')
  // Task 6.1(D19): 사유를 두 갈래로 가른 것이 summary 에 실린다 — 사이트 주소 미정 = 입력 대기, 예시 문구 남음 = 품질. 기계 기준은 quality 0.
  assert.deepEqual(s.blockerKinds, { input: [site], quality: [ex] })
  assert.deepEqual(readJ(join(f.candDir, '07-qa', 'summary.json')).blockerKinds, { input: [site], quality: [ex] }, 'summary.json 에도 같다')
  // 관문이 떨어지면 QA 줄이 뒤에 붙고, 다시 통과하면 QA 줄만 사라진다
  const bad = await qa(f, { site: () => ({ ...okSite(), rules: [{ id: 'flow-reach', status: 'fail' }] }) })
  assert.equal(bad.s.blockers.slice(0, 2).join('|'), [site, ex].join('|'))
  assert.ok(bad.s.blockers.some((b) => b.startsWith(QA_PREFIX.gate) && b.includes('marketing-site') && b.includes('flow-reach')))
  assert.deepEqual(bad.s.blockerKinds.input, [site], '관문 실패 줄은 quality 로 간다 — 입력 갈래는 그대로')
  assert.equal(bad.s.blockerKinds.quality.length, 2); assert.ok(bad.s.blockerKinds.quality[1].startsWith(QA_PREFIX.gate))
  assert.deepEqual(readJ(join(f.candDir, 'candidate.json')).blockers, bad.s.blockers, 'candidate.json 에도 같은 줄')
  const again = await qa(f)
  assert.deepEqual(again.s.blockers, [site, ex])
  assert.deepEqual(readJ(join(f.candDir, 'candidate.json')).blockers, [site, ex])
  assert.equal(readJ(join(f.candDir, 'candidate.json')).id, 'a', '다른 칸은 그대로')
})

test('ai-tell 1 + 결과 파일 없음 = 도구 실패(다시 돈 뒤): 문턱 없으면 경고만, 문턱이 있으면 공개 불가', async () => {
  const dead = { tools: { 'ai-tell': () => ({ exit: 1, stderr: 'ai-tell: 측정 없음(도구 실패) — Chrome' }) } }
  const f = fixture()
  const { s, calls } = await qa(f, dead)
  const g = gateOf(s, 'ai-tell:/')
  assert.deepEqual([g.exit, g.toolFailure, g.attempts], [1, true, 2], '도구 실패는 1회 다시 돈다')
  assert.equal(calls.filter((c) => c.tool === 'ai-tell').length, 4, '두 쪽 × 2회')
  assert.equal(g.resultFile, undefined)
  assert.equal(s.publishable, true, '문턱이 없는 재기 전용 관문의 측정 실패는 공개를 막지 않는다')
  assert.ok(s.warnings.some((w) => w.includes('ai-tell') || w.includes('AI 티')))
  const t = await qa(fixture(), dead, { aiTellThreshold: 40 })
  assert.equal(t.s.publishable, false)
  assert.ok(t.s.blockers.some((b) => b.startsWith(QA_PREFIX.tool) && b.includes('ai-tell:/')))
})

test('ux run.mjs 3 + 자식 1 = 도구 실패 · 자식 3 = 판정 실패', async () => {
  const mk = (children) => ({ tools: { ux: (args) => { writeFileSync(join(args[1], 'report.json'), j({ ...children, pass: false })); return { exit: 3 } } } })
  const a = await qa(fixture(), mk({ gate: 1, behavior: 0 }))
  assert.equal(gateOf(a.s, 'ux:/').toolFailure, true)
  const b = await qa(fixture(), mk({ gate: 3, behavior: 0 }))
  const g = gateOf(b.s, 'ux:/')
  assert.deepEqual([g.toolFailure, g.verdict], [false, 'fail'])
  assert.deepEqual(g.children, { gate: 3, behavior: 0 })
  assert.equal(b.s.publishable, false)
})

test('legal: 검토 파일이 없으면 pendingReview 로 채우고 legal-gate 1 → 「법률 검토 미완」(공개 불가)', async () => {
  const f = fixture({ review: null })
  const { s } = await qa(f, { tools: { doctor: () => ({ exit: 1, stderr: '도구 실패: LAW_API_OC 없음' }) } })
  const g = gateOf(s, 'legal')
  assert.deepEqual([g.exit, g.toolFailure, g.pendingReview], [1, false, true])
  assert.ok(g.resultFile && existsSync(join(f.candDir, g.resultFile)), 'legal-gate.json 이 남는다')
  const rows = readJ(join(f.legalDir, 'privacy.review.json'))
  assert.deepEqual(rows.map((r) => [r.clause, r.verdict]), [['c1', 'unverified']])
  assert.match(rows[0].note, /doctor --stage legal 이 실패/)
  assert.equal(s.publishable, false)
  assert.ok(s.blockers.some((b) => b.startsWith(QA_PREFIX.legalPending) && b.includes('privacy')))
  assert.ok(s.blockerKinds.input.some((b) => b.startsWith(QA_PREFIX.legalPending)), '검토 파일이 없어 미완인 것은 입력 대기 갈래')
  assert.deepEqual(s.blockerKinds.quality, [])
  assert.ok(s.warnings.some((w) => w.startsWith('doctor-legal')), 'doctor 실패는 경고로 보인다')
  // 이미 있는 검토 파일은 덮지 않는다
  writeFileSync(join(f.legalDir, 'privacy.review.json'), j(OK_REVIEW))
  const again = await qa(f)
  assert.equal(gateOf(again.s, 'legal').verdict, 'pass')
  assert.equal(again.s.publishable, true)
  assert.equal(readJ(join(f.legalDir, 'privacy.review.json'))[0].verdict, 'ok')
})

test('legal: fix 판정이 섞이면 pendingReview 가 아니라 「법률 검토 실패」', async () => {
  const f = fixture({ review: null })
  writeFileSync(join(f.legalDir, 'privacy.review.json'), j([{ clause: 'c1', verdict: 'fix', basis: [], note: '고쳐라' }]))
  const { s } = await qa(f)
  const g = gateOf(s, 'legal')
  assert.deepEqual([g.exit, g.pendingReview], [1, false])
  assert.ok(s.blockers.some((b) => b.startsWith(QA_PREFIX.legalFail)))
  assert.ok(!s.blockers.some((b) => b.startsWith(QA_PREFIX.legalPending)))
  assert.ok(s.blockerKinds.quality.some((b) => b.startsWith(QA_PREFIX.legalFail)), '검토를 했는데 조항이 틀린 것은 품질 갈래')
  assert.deepEqual(s.blockerKinds.input, [])
})

// ─── ops-gate(Task 1 어댑터) ───

test('ops: 판정 실패 = 다시 돌지 않고 「운영 점검 실패」 줄 · 필수 검사의 na 도 실패 · naOk 행의 na 는 통과', async () => {
  const fail = await qa(fixture(), { ops: () => ({ checks: [{ id: 'lh-perf', level: 'must', status: 'fail', route: '/', value: 72, threshold: 90, detail: ['LCP 요소 img'] }, ...OK_CHECKS.slice(1)], exit: 1, summary: { lighthouse: '1/2' } }) })
  const g = gateOf(fail.s, 'ops')
  assert.deepEqual([g.exit, g.verdict, g.toolFailure, g.attempts], [1, 'fail', false, 1])
  assert.equal(fail.calls.filter((c) => c.tool === 'ops').length, 1, '판정 실패는 다시 안 돈다')
  assert.ok(fail.s.blockers.some((b) => b.startsWith(QA_PREFIX.ops) && b.includes('lh-perf 72')), JSON.stringify(fail.s.blockers))
  assert.equal(fail.s.publishable, false)
  // 필수 규칙의 na(naOk 가 아닌 행) = 통과가 아니라 실패
  const na = await qa(fixture(), { ops: () => ({ checks: [{ id: 'security-headers', level: 'must', status: 'na' }, { id: 'bf-cache', level: 'must', status: 'na' }], exit: 1, summary: { lighthouse: '0/2' } }) })
  assert.equal(gateOf(na.s, 'ops').verdict, 'fail')
  assert.deepEqual(gateOf(na.s, 'ops').problems.map((p) => p.replace(/^\[[^\]]*\] /, '').split(' ')[0]), ['security-headers'], 'bf-cache(naOk) 의 na 는 문제가 아니다')
  assert.ok(na.s.blockers.some((b) => b.startsWith(QA_PREFIX.ops) && b.includes('security-headers')))
  // naOk 행의 na 만 있으면 통과(okOps 가 bf-cache na 를 품고 있다)
  assert.equal(gateOf((await qa(fixture())).s, 'ops').verdict, 'pass')
})

test('ops: 도구 실패(홈이 안 열림 등) = 다시 돈 뒤 「관문 도구 실패」 줄이고 옛 결과 파일은 지운다 · 회복하면 통과', async () => {
  const f = fixture()
  mkdirSync(join(f.candDir, '07-qa'), { recursive: true })
  writeFileSync(join(f.candDir, '07-qa', 'ops-gate.json'), j({ stale: true }))
  const dead = await qa(f, { ops: () => { throw new ToolFailure('홈(/)이 500 — 사이트가 열리지 않는다') } })
  const g = gateOf(dead.s, 'ops')
  assert.deepEqual([g.exit, g.toolFailure, g.verdict, g.attempts, g.resultFile], [1, true, 'tool', 2, undefined])
  assert.equal(existsSync(join(f.candDir, '07-qa', 'ops-gate.json')), false, '이전 실행의 파일을 남기지 않는다')
  assert.ok(dead.s.blockers.some((b) => b.startsWith(QA_PREFIX.tool) && b.includes('ops')))
  assert.ok(!dead.s.blockers.some((b) => b.startsWith(QA_PREFIX.ops)), '도구 실패는 「운영 점검 실패」 줄이 아니다')
  const healed = await qa(fixture(), { ops: (_o, _p, calls) => { if (calls === 1) throw new ToolFailure('Chrome 을 못 띄웠다'); return okOps() } })
  assert.deepEqual([gateOf(healed.s, 'ops').verdict, gateOf(healed.s, 'ops').attempts], ['pass', 2])
  assert.equal(healed.s.publishable, true)
  // 안쪽의 예상 못 한 예외(ToolFailure 가 아닌 버그)는 삼키지 않고 던진다
  await assert.rejects(qa(fixture(), { ops: () => { throw new TypeError('버그') } }), /버그/)
})

test('ops: 후보에 원형이 없으면 법정 쪽 요구를 알 수 없어 판정이 아니라 도구 실패', async () => {
  const f = fixture({ siteJson: { archetype: undefined } })
  const { s } = await qa(f)
  const g = gateOf(s, 'ops')
  assert.deepEqual([g.toolFailure, g.verdict], [true, 'tool'])
  assert.match(g.note, /archetype/)
})

// ─── marketing-site(Task 2 어댑터) ───

test('marketing-site: 쪽 단위 MUST 어김도 실패 · 사람 확인 9개는 실패여도 summary 에 남는다 · 판정 실패는 다시 안 돈다', async () => {
  const site = () => ({ ...okSite(), pages: [{ route: '/', legal: false, result: { rules: [{ id: 'cta-label', status: 'fail' }], fail: ['cta-label'], warn: ['cta-count'] } }], warn: ['tone-page-mixed'], rules: [...SITE_RULES_PASS, { id: 'tone-page-mixed', status: 'warn' }] })
  const { s, calls } = await qa(fixture(), { site })
  const g = gateOf(s, 'marketing-site')
  assert.deepEqual([g.exit, g.verdict, g.toolFailure, g.attempts], [1, 'fail', false, 1])
  assert.deepEqual(g.fail, ['page:/:cta-label'])
  assert.equal(calls.filter((c) => c.tool === 'marketing-site').length, 1)
  assert.ok(s.blockers.some((b) => b.startsWith(QA_PREFIX.gate) && b.includes('marketing-site') && b.includes('page:/:cta-label')))
  assert.ok(!s.blockers.some((b) => b.startsWith(QA_PREFIX.tool)), '판정 실패는 「도구 실패」 줄이 아니다')
  assert.ok(s.warnings.some((w) => w.startsWith('마케팅 사이트') && w.includes('tone-page-mixed') && w.includes('page:/:cta-count')))
  assert.equal(s.manualChecks.length, MANUAL_CHECKS.length)
  assert.equal(s.publishable, false)
})

test('marketing-site: 규칙이 전부 na 면 통과가 아니라 도구 실패(다시 돈 뒤) · 측정기 예외도 도구 실패 · 일부만 na 면 통과', async () => {
  const allNa = () => ({ ...okSite(), pages: [{ route: '/', legal: false, result: { rules: [{ id: 'x', status: 'na' }], fail: [], warn: [] } }], rules: [{ id: 'flow-reach', status: 'na' }] })
  const a = await qa(fixture(), { site: allNa })
  const g = gateOf(a.s, 'marketing-site')
  assert.deepEqual([g.toolFailure, g.verdict, g.attempts, g.resultFile !== undefined], [true, 'tool', 2, true], '결과 파일은 측정기가 돌려준 뒤에 쓰이지만 판정은 도구 실패다')
  assert.match(g.note, /전부 na/)
  assert.ok(a.s.blockers.some((b) => b.startsWith(QA_PREFIX.tool) && b.includes('marketing-site')))
  assert.equal(a.s.manualChecks.length, MANUAL_CHECKS.length, '도구 실패여도 사람 확인 목록은 싣는다')
  const boom = await qa(fixture(), { site: () => { throw new Error('도구 실패: Chrome 시작 실패') } })
  const b = gateOf(boom.s, 'marketing-site')
  assert.deepEqual([b.toolFailure, b.attempts, b.resultFile], [true, 2, undefined])
  assert.equal(gateOf((await qa(fixture())).s, 'marketing-site').verdict, 'pass', 'okSite 는 사이트 규칙 하나가 na 여도 다른 규칙을 쟀다')
})

test('marketing-site: 02-sitemap.json 이 없으면 판정이 아니라 도구 실패', async () => {
  const f = fixture()
  rmSync(join(f.candDir, '02-sitemap.json'))
  const { s } = await qa(f)
  const g = gateOf(s, 'marketing-site')
  assert.deepEqual([g.toolFailure, g.verdict], [true, 'tool'])
  assert.match(g.note, /02-sitemap/)
})

// ─── a11y(Task 3 어댑터) ───

test('a11y: 한 쪽이라도 axe·행동 실패면 판정 실패(다시 안 돈다) · 경고는 경고로만 · 쪽마다 요약이 남는다', async () => {
  const a11y = (args) => {
    const bad = args[0].endsWith('/privacy')
    a11yWrite(args, { failures: bad ? ['axe color-contrast (dark·1440)', 'target-size'] : [], warnings: ['moderate'], summary: {} })
    return { exit: bad ? 1 : 0 }
  }
  const f = fixture()
  const { s, calls } = await qa(f, { a11y })
  const g = gateOf(s, 'a11y')
  assert.deepEqual([g.exit, g.verdict, g.toolFailure, g.attempts], [1, 'fail', false, 1])
  assert.equal(calls.filter((c) => c.tool === 'a11y').length, 2, '쪽 둘을 한 번씩(판정 실패는 다시 안 돈다)')
  assert.deepEqual(Object.fromEntries(Object.entries(g.routes).map(([r, x]) => [r, x.verdict])), { '/': 'pass', '/privacy': 'fail' })
  assert.match(g.note, /\/privacy\(2건\)/)
  assert.ok(s.blockers.some((b) => b.startsWith(QA_PREFIX.gate) && b.includes('a11y') && b.includes('/privacy')))
  assert.ok(s.warnings.some((w) => w.startsWith('접근성 경고')))
  assert.equal(s.publishable, false)
  assert.ok(g.resultFile && existsSync(join(f.candDir, g.resultFile)), '판정 실패는 결과 파일이 있다')
})

test('a11y: 종료 0 인데 결과 파일이 없거나 열리지 않는 쪽(도구 실패)은 통과가 아니라 도구 실패 — 다시 돈 뒤 「도구 실패」 줄, 회복하면 통과', async () => {
  const noFile = await qa(fixture(), { a11y: () => ({ exit: 0 }) })
  const g = gateOf(noFile.s, 'a11y')
  assert.deepEqual([g.toolFailure, g.verdict, g.attempts, g.resultFile], [true, 'tool', 2, undefined])
  assert.match(g.note, /결과 파일이 없다/)
  assert.ok(noFile.s.blockers.some((b) => b.startsWith(QA_PREFIX.tool) && b.includes('a11y')))
  const opened = await qa(fixture(), { a11y: () => ({ exit: 1, stderr: '도구 실패: Chrome 오류 페이지' }) })
  assert.equal(gateOf(opened.s, 'a11y').toolFailure, true)
  const healed = await qa(fixture(), { a11y: (args, _o, calls) => (calls <= 2 ? { exit: 1, stderr: '도구 실패: 미디어 에뮬레이션 안 걸림' } : okA11y(args)) })
  assert.deepEqual([gateOf(healed.s, 'a11y').verdict, gateOf(healed.s, 'a11y').attempts], ['pass', 2])
  assert.equal(healed.s.publishable, true)
})

test('a11y: 열린 쪽만 잰다(404 쪽은 ops·open 관문이 잡는다) · 하나도 안 열리면 돌지 않는다', async () => {
  const a = await qa(fixture(), {}, { fetch: openFetch({ '/privacy': 404 }) })
  assert.deepEqual(a.calls.filter((c) => c.tool === 'a11y').map((c) => c.args[0][0]), ['http://x.test/'])
  const none = await qa(fixture(), {}, { fetch: openFetch({ '/': 404, '/privacy': 404 }) })
  assert.equal(none.calls.filter((c) => c.tool === 'a11y').length, 0)
  assert.equal(gateOf(none.s, 'a11y'), undefined)
  assert.equal(none.s.publishable, false)
})

// ─── strict: 원형 엄격 기준(P3-4 Task 4) ───

test('strict: 어김 → 「원형 엄격 기준」 줄로 공개 불가 · 판정 실패는 다시 안 돈다 · 열린 쪽만(entry 쪽은 잰다)', async () => {
  const f = fixture()
  const farHours = async (o, routes) => routes.map((route) => ({ route, profiles: { desktop: { ...STRICT_FACTS, hours: 3.4 }, mobile: { ...STRICT_FACTS, tel: null } } }))
  const { s, calls } = await qa(f, { strict: farHours })
  const g = gateOf(s, 'strict')
  assert.equal(g.verdict, 'fail'); assert.equal(g.exit, 1); assert.equal(g.toolFailure, false)
  assert.equal(calls.filter((c) => c.tool === 'strict').length, 1, '판정 실패는 다시 안 돈다')
  assert.deepEqual(calls.find((c) => c.tool === 'strict').args[1], ['/'], '원형 local 은 entry 쪽만 잰다(법정 쪽은 재지 않는다)')
  assert.equal(s.publishable, false)
  const lines = s.blockers.filter((b) => b.startsWith(QA_PREFIX.strict))
  assert.ok(lines.some((b) => b.includes('[local-first-screen] / desktop(1440): hours 가 3.4화면째')), lines.join('\n'))
  assert.ok(lines.some((b) => b.includes('mobile(375): tel 없음')))
  assert.ok(existsSync(join(f.candDir, g.resultFile)))
})

test('strict: 측정기 예외·열리지 않는 쪽은 도구 실패(다시 돈 뒤) · 회복하면 통과 · strict:false 면 건너뛴다 · 기준 없는 원형이면 게이트가 없다', async () => {
  const flaky = await qa(fixture(), { strict: async (o, routes, n) => { if (n === 1) throw new Error('탐색 실패(net::ERR_CONNECTION_REFUSED)'); return okStrict(o, routes) } })
  assert.deepEqual([gateOf(flaky.s, 'strict').verdict, gateOf(flaky.s, 'strict').attempts], ['pass', 2])
  const dead = await qa(fixture(), { strict: async () => { throw new Error('탐색 실패(net::ERR_CONNECTION_REFUSED)') } })
  assert.equal(gateOf(dead.s, 'strict').toolFailure, true)
  assert.ok(dead.s.blockers.some((b) => b.startsWith(QA_PREFIX.tool) && b.includes('strict')))
  assert.equal(gateOf(dead.s, 'strict').resultFile, undefined, '도구 실패면 결과 파일이 없다')
  const off = await qa(fixture(), {}, { strict: false })
  assert.equal(gateOf(off.s, 'strict'), undefined); assert.equal(off.calls.filter((c) => c.tool === 'strict').length, 0)
  const noRules = await qa(fixture({ siteJson: { archetype: 'no-such-archetype' } }))
  assert.equal(gateOf(noRules.s, 'strict'), undefined)
  const none = await qa(fixture(), {}, { fetch: openFetch({ '/': 404, '/privacy': 404 }) })
  assert.equal(gateOf(none.s, 'strict'), undefined, '열린 쪽이 하나도 없으면 재지 않는다')
})

// ─── bold-safety: 대담안 안전(factory v1 Task 4.2, D20) — 대담안(cand.boldness "bold")만 돌고 앞선 ops·a11y 결과를 읽는다 ───

const opsWithVitals = (lcp = 1800, cls = 0.02) => () => ({ ...okOps(), checks: [...OK_CHECKS, { id: 'lcp', level: 'must', status: 'pass', route: '/', value: lcp }, { id: 'cls', level: 'must', status: 'pass', route: '/', value: cls }] })
const boldFixture = (siteJson, cand = {}) => { const f = fixture({ siteJson }); Object.assign(f.cand, { boldness: 'bold', boldMode: 'motion', ...cand }); return f }
const boldMeasure = (calls, over = {}) => async (origin, routes) => { calls.push({ origin, routes }); return routes.map((route) => ({ route, static: true, problems: [], flashesPerSec: 0, ...over })) }

test('bold-safety: 대담안이 아니면 게이트도 측정도 없다(standard·표시 없음)', async () => {
  const calls = []
  for (const boldness of [undefined, 'standard']) {
    const f = fixture(); if (boldness) f.cand.boldness = boldness
    const { s } = await qa(f, { ops: opsWithVitals() }, { boldOptions: { measure: boldMeasure(calls) } })
    assert.equal(gateOf(s, 'bold-safety'), undefined, String(boldness))
  }
  assert.equal(calls.length, 0)
})

test('bold-safety: 대담안은 앞선 ops·a11y 결과를 읽어 통과 · 열린 쪽 전부를 동작 줄이기 측정에 넘긴다 · 마지막 게이트 · 결과 파일', async () => {
  const f = boldFixture()
  const calls = []
  const { s } = await qa(f, { ops: opsWithVitals() }, { boldOptions: { measure: boldMeasure(calls) } })
  const g = gateOf(s, 'bold-safety')
  assert.deepEqual([g.verdict, g.exit, g.toolFailure, g.tool], ['pass', 0, false, 'bold-safety'], g.note)
  assert.equal(s.gates.at(-1).id, 'bold-safety')
  assert.equal(g.resultFile, '07-qa/bold-safety/bold-safety.json')
  assert.ok(existsSync(join(f.candDir, g.resultFile)))
  assert.deepEqual(calls, [{ origin: 'http://x.test', routes: ['/', '/privacy'] }])
  assert.deepEqual(g.measured, { lcpMs: 1800, cls: 0.02, flashesPerSec: 0, reducedMotionStatic: true, contrastOk: true })
  assert.equal(s.publishable, true, JSON.stringify(s.blockers))
})

test('bold-safety: 어김 → 「대담안 안전 기준」 줄로 공개 불가 · 판정 실패는 다시 안 돈다(동작 줄이기에서 움직임 · LCP 초과)', async () => {
  const f = boldFixture()
  const calls = []
  const moving = async (o, routes) => { calls.push(routes); return routes.map((route) => ({ route, static: false, problems: [`${route} 375px: 동작 줄이기에서 값이 바뀌는 요소 1개 — section[hero-gradient]`], flashesPerSec: 0 })) }
  const { s } = await qa(f, { ops: opsWithVitals(3000, 0.02) }, { boldOptions: { measure: moving } })
  const g = gateOf(s, 'bold-safety')
  assert.deepEqual([g.verdict, g.exit, g.toolFailure], ['fail', 1, false])
  assert.equal(calls.length, 1, '판정 실패는 다시 안 돈다')
  assert.equal(s.publishable, false)
  const lines = s.blockers.filter((b) => b.startsWith(QA_PREFIX.bold))
  assert.ok(lines.some((b) => b.includes('모바일 LCP ≤ 2500 ms') && b.includes('3000 ms')), lines.join('\n'))
  assert.ok(lines.some((b) => b.includes('section[hero-gradient]')), lines.join('\n'))
})

test('bold-safety: ops 가 LCP·CLS 를 남기지 않았으면(재지 못함) 도구 실패 · 측정기가 던져도 다시 돈 뒤 도구 실패 · public 이 motion 이면 판정 실패 · bold:false 면 건너뛴다', async () => {
  const calls = []
  const lacking = await qa(boldFixture(), {}, { boldOptions: { measure: boldMeasure(calls) } }) // 기본 okOps 는 lcp·cls 행이 없다
  const g = gateOf(lacking.s, 'bold-safety')
  assert.equal(g.toolFailure, true)
  assert.equal(calls.length, 0, 'Chrome 측정을 부르지 않는다')
  assert.ok(lacking.s.blockers.some((b) => b.startsWith(QA_PREFIX.tool) && b.includes('bold-safety') && b.includes('재사용할 LCP·CLS')))
  const boom = await qa(boldFixture(), { ops: opsWithVitals() }, { boldOptions: { measure: async () => { throw new Error('탐색 실패(net::ERR_CONNECTION_REFUSED)') } } })
  assert.deepEqual([gateOf(boom.s, 'bold-safety').toolFailure, gateOf(boom.s, 'bold-safety').attempts], [true, 2])
  const pub = await qa(boldFixture({ archetype: 'public' }), { ops: opsWithVitals() }, { boldOptions: { measure: boldMeasure([]) } })
  assert.equal(gateOf(pub.s, 'bold-safety').verdict, 'fail')
  assert.ok(pub.s.blockers.some((b) => b.startsWith(QA_PREFIX.bold) && b.includes('public·dashboard 는 모션 대신 배치·서체로만')))
  const layout = await qa(boldFixture({ archetype: 'public' }, { boldMode: 'layout' }), { ops: opsWithVitals() }, { boldOptions: { measure: boldMeasure([]) } })
  assert.equal(gateOf(layout.s, 'bold-safety').verdict, 'pass')
  const off = await qa(boldFixture(), { ops: opsWithVitals() }, { bold: false })
  assert.equal(gateOf(off.s, 'bold-safety'), undefined)
  const none = await qa(boldFixture(), { ops: opsWithVitals() }, { fetch: openFetch({ '/': 404, '/privacy': 404 }) })
  assert.equal(gateOf(none.s, 'bold-safety'), undefined, '열린 쪽이 하나도 없으면 재지 않는다')
})

// ─── 열림·쪽 목록·필수 입력 ───

test('열리지 않는 쪽은 Chrome 관문을 돌리지 않는다: 404 = 판정 실패(open), 서버 응답 없음 = 도구 실패 — ux-gate 는 오류 페이지를 재서 3 을 내기 때문이다', async () => {
  const a = await qa(fixture(), {}, { fetch: openFetch({ '/privacy': 404 }), routes: ['/', '/privacy'] })
  const open = gateOf(a.s, 'open:/privacy')
  assert.deepEqual([open.exit, open.verdict, open.toolFailure], [1, 'fail', false])
  assert.equal(a.s.gates.filter((g) => g.route === '/privacy' && g.tool !== 'ops').length, 0, '열리지 않는 쪽의 ux·ai-tell 은 안 돈다')
  assert.equal(a.calls.filter((c) => c.tool === 'ux').length, 1)
  assert.ok(a.s.blockers.some((b) => b.startsWith(QA_PREFIX.ops) && b.includes('/privacy 가 404')))
  const b = await qa(fixture(), {}, { fetch: openFetch({ '/privacy': new Error('ECONNRESET') }), routes: ['/', '/privacy'] })
  const o2 = gateOf(b.s, 'open:/privacy')
  assert.deepEqual([o2.verdict, o2.toolFailure], ['tool', true])
  assert.equal(b.calls.filter((c) => c.tool === 'ux').length, 1)
  assert.ok(b.s.blockers.some((x) => x.startsWith(QA_PREFIX.tool) && x.includes('open:/privacy')))
})

test('AI 티 문턱을 주면 block 모드로 부르고, 넘으면 공개 불가 + pickDirections exclude 사유(ai-tell:<점수>)를 낸다', async () => {
  const over = { tools: { 'ai-tell': (args) => { writeFileSync(join(args[args.indexOf('--out') + 1], 'ai-tell.json'), j({ score: 88, scoreG: 88, maxG: 239, threshold: 50 })); return { exit: 3 } } } }
  const { s, calls } = await qa(fixture(), over, { aiTellThreshold: 50 })
  assert.deepEqual(calls.find((c) => c.tool === 'ai-tell').args.slice(-4), ['--mode', 'block', '--threshold', '50'])
  assert.equal(s.publishable, false)
  assert.ok(s.blockers.some((b) => b.startsWith(QA_PREFIX.gate) && b.includes('ai-tell:/') && b.includes('88')))
  assert.deepEqual(s.exclude, [{ id: 'a', reasons: ['ai-tell:88', 'ai-tell:88'] }])
})

test('쪽 목록 옵션: routes 를 주면 그 쪽만 ux·ai-tell 을 돌고 ops 어댑터에도 같은 쪽 목록이 간다 · security 옵션은 어댑터 기본(hash)을 바꾼다', async () => {
  const f = fixture({ siteJson: { pages: { '/': { id: 'home' }, '/signup': { id: 'signup' } } } })
  const { s, calls } = await qa(f, {}, { routes: ['/', '/signup'], security: 'nonce' })
  assert.deepEqual(s.routes, ['/', '/signup'])
  assert.deepEqual(calls.filter((c) => c.tool === 'ux').map((c) => c.args[0]), ['http://x.test/', 'http://x.test/signup'])
  const opsOpts = calls.find((c) => c.tool === 'ops').args[1]
  assert.deepEqual([opsOpts.routes, opsOpts.security], [['/', '/signup'], 'nonce'])
})

test('필수 입력 검사: site.json·빌드 없으면 통과가 아니라 도구 실패로 던진다', async () => {
  const runDir = mkdtempSync(join(TMP, `run${n++}-`))
  await assert.rejects(runCandidateQa(runDir, { id: 'a' }, { url: 'http://x.test' }), /도구 실패: .*site\.json 없음/)
  const f = fixture()
  await assert.rejects(runCandidateQa(f.runDir, f.cand, {}), /도구 실패: .*(next 없음|next.*없음|BUILD_ID)/)
})

test('작은 함수들: routeSlug·writeQaBlockers', () => {
  assert.equal(routeSlug('/'), 'home')
  assert.equal(routeSlug('/booking/complete'), 'booking-complete')
  const runDir = mkdtempSync(join(TMP, `run${n++}-`))
  const a = writeQaBlockers(runDir, 'c', [`${QA_PREFIX.ops}x`])
  assert.deepEqual(a, [`${QA_PREFIX.ops}x`])
  writeFileSync(join(runDir, 'c', 'candidate.json'), j({ keep: 1, blockers: ['공개 불가 — 사이트 주소 미정', `${QA_PREFIX.ops}old`] }))
  assert.deepEqual(writeQaBlockers(runDir, 'c', []), ['공개 불가 — 사이트 주소 미정'])
  assert.equal(readJ(join(runDir, 'c', 'candidate.json')).keep, 1)
})

test('runToolDefault: 실제 노드 스크립트를 비동기로 부르고 종료 코드·stderr 를 돌려준다(legal-gate 인자 오류 = 2)', async () => {
  const r = await runToolDefault('legal', [])
  assert.equal(r.exit, 2)
  assert.match(r.stderr, /인자 오류/)
})
