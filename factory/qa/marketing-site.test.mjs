// 마케팅 사이트 관문(marketing-site.mjs) 시험. 실행: node --test --test-force-exit --test-timeout=400000 factory/qa/marketing-site.test.mjs
// ① 규칙표·음성 대조 표 무결성(브라우저 없음) ② 순수 판정(문체·흐름·수신 경로·사이트·종료 코드) ③ marketingSiteForCandidate(가짜 측정)
// ④ 브라우저: 픽스처 사이트를 작은 서버에 올려 양성 대조(통과 사이트) + 음성 대조(규칙마다 그 규칙만 실패) ⑤ CLI 종료 코드.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect } from './cdp.mjs'
import {
  SITE_RULES, MANUAL_CHECKS, FLOW_IDS, classifyEnding, splitSentences, judgeTone, finishWalk, classifyHits, judgeSite, interpretSite,
  pickStart, routesOf, marketingSite, marketingSiteForCandidate, RESULT_NAME,
} from './marketing-site.mjs'
import { VARIANTS, MULTI, PASSING, buildSite, serveSite, sitemapOf, siteNames, SITES_DIR } from './marketing-site-fixtures.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const tool = join(here, 'marketing-site.mjs')
const run = (args) => new Promise((res) => {
  let err = '', out = ''
  const p = spawn(process.execPath, [tool, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { err += d })
  p.on('exit', (code) => res({ code, err, out }))
})
const TMP = join(root, '.tmp', 'marketing-site-test')
mkdirSync(TMP, { recursive: true })

// ── ① 표 무결성 ──
test('규칙표: id 유일 · 수준 · 근거 · 무엇·어떻게', () => {
  assert.equal(SITE_RULES.length, 7)
  assert.equal(new Set(SITE_RULES.map((r) => r.id)).size, SITE_RULES.length)
  for (const r of SITE_RULES) {
    assert.match(r.level, /^(must|should)$/, r.id)
    assert.ok(r.src && r.what && r.how, r.id)
  }
})

test('음성 대조 표: 규칙마다 나쁜 사이트가 하나 이상 있고 기대 상태가 수준과 맞다 · 사이트 폴더가 실제로 있다', () => {
  for (const r of SITE_RULES) {
    const vs = VARIANTS.filter((v) => v.rule === r.id)
    const ms = MULTI.filter((m) => m.rules.includes(r.id))
    assert.ok(vs.length + ms.length >= 1, `${r.id} 음성 대조 없음`)
    for (const v of vs) assert.equal(v.expect, r.level === 'must' ? 'fail' : 'warn', v.name)
  }
  const names = [...VARIANTS, ...MULTI, ...PASSING].map((v) => v.name)
  for (const n of new Set(names)) assert.ok(siteNames().includes(n), `픽스처 폴더 없음: ${n}`)
  assert.equal(new Set(VARIANTS.map((v) => v.name)).size, VARIANTS.length)
})

test('사람 확인 목록(A122): 9개 · id 유일 · 방법·예시가 있다', () => {
  assert.equal(MANUAL_CHECKS.length, 9)
  assert.equal(new Set(MANUAL_CHECKS.map((c) => c.id)).size, MANUAL_CHECKS.length)
  for (const c of MANUAL_CHECKS) assert.ok(c.id && c.how.length > 10 && c.example.length > 3, c.id)
  for (const id of ['P2', 'L6', 'L7', 'A1', 'A2', 'A3']) assert.ok(MANUAL_CHECKS.some((c) => c.id === id), id)
})

// ── ② 순수 판정 ──
test('classifyEnding: 합쇼체·해요체·그 밖', () => {
  const cases = [
    ['지금 시작합니다.', 'hapsyo'], ['정말 그렇습니까?', 'hapsyo'], ['이쪽으로 오십시오', 'hapsyo'], ['감사합니다!', 'hapsyo'], ['입니다', 'hapsyo'],
    ['무료로 시작해요', 'haeyo'], ['저희예요.', 'haeyo'], ['눌러 보세요', 'haeyo'], ['그렇죠?', 'haeyo'], ['곧 답해 드릴게요', 'haeyo'], ['좋아요 😊', 'haeyo'], ['이게 뭐예요?', 'haeyo'],
    ['시작하기', 'other'], ['요금', 'other'], ['가입 필요', 'other'], ['중요', 'other'], ['필요', 'other'], ['문의', 'other'], ['', 'other'],
  ]
  for (const [t, k] of cases) assert.equal(classifyEnding(t), k, t)
})

test('splitSentences: 마침표류 뒤 공백·줄바꿈으로 쪼갠다', () => {
  assert.deepEqual(splitSentences('손님 예약을 받아요. 문자로 알려 줘요!\n곧 시작해요'), ['손님 예약을 받아요.', '문자로 알려 줘요!', '곧 시작해요'])
  assert.deepEqual(splitSentences('  '), [])
})

test('judgeTone: 섞임·CTA 섞임·법정 쪽 제외·재는 것 0', () => {
  const t = judgeTone([
    { route: '/', body: ['손님 예약을 받아요. 모든 예약은 보관합니다.'], ctas: ['무료로 시작해요', '지금 문의합니다', '더 알아보기'] },
    { route: '/only-haeyo', body: ['쉬워요. 빨라요.'], ctas: ['시작해요'] },
    { route: '/privacy', legal: true, body: ['개인정보를 다룹니다.', '쉬워요.'], ctas: ['a합니다', 'b해요'] },
    { route: '/nouns', body: ['요금표'], ctas: ['시작하기'] },
  ])
  assert.deepEqual([t[0].mixed, t[0].ctaMixed, t[0].dominant], [true, true, 'tie'])
  assert.deepEqual(t[0].ctaTexts, { hapsyo: ['지금 문의합니다'], haeyo: ['무료로 시작해요'] })
  assert.deepEqual([t[1].mixed, t[1].ctaMixed, t[1].dominant], [false, false, 'haeyo'])
  assert.equal(t[2].excluded, true)
  assert.deepEqual([t[2].mixed, t[2].ctaMixed], [false, false])
  assert.deepEqual([t[3].counts, t[3].dominant], [{ hapsyo: 0, haeyo: 0, other: 1 }, null])
  const rules = judgeSite({ tone: t })
  const by = (id) => rules.find((r) => r.id === id)
  assert.deepEqual([by('tone-cta-mixed').status, by('tone-page-mixed').status], ['fail', 'warn'])
  const ok = judgeSite({ tone: t.slice(1, 2) })
  assert.deepEqual([ok.find((r) => r.id === 'tone-cta-mixed').status, ok.find((r) => r.id === 'tone-page-mixed').status], ['pass', 'pass'])
  const nothing = judgeSite({ tone: [t[2], t[3]] })
  assert.deepEqual([nothing.find((r) => r.id === 'tone-cta-mixed').status, nothing.find((r) => r.id === 'tone-page-mixed').status], ['na', 'na'])
})

const W = (o) => finishWalk({ pages: [], stepsSeen: [], entryClicks: 0, basis: 'walked', clicks: 0, steps: null, reachedEnd: false, ...o })
test('finishWalk·judgeFlows: 가입 선언 대체 · 해지 ≤ 가입(클릭·단계) · 가입 없으면 비교 실패 · 끝 못 닿음', () => {
  const rules = (walks) => Object.fromEntries(judgeSite({ walks }).map((r) => [r.id, r]))
  const signup = W({ id: 'signup', clicks: 2, steps: 2, reachedEnd: true, pages: ['/', '/signup'] })
  assert.equal(rules([signup, W({ id: 'cancel', clicks: 2, steps: 2, reachedEnd: true })])['flow-cancel-le-signup'].status, 'pass')
  const more = rules([signup, W({ id: 'cancel', clicks: 4, steps: 3, reachedEnd: true })])['flow-cancel-le-signup']
  assert.equal(more.status, 'fail')
  assert.match(more.detail.join('|'), /해지 클릭 4 > 가입 클릭 2/)
  assert.match(more.detail.join('|'), /해지 3단계 > 가입 2단계/)
  assert.match(rules([W({ id: 'cancel', clicks: 1, steps: 2, reachedEnd: true })])['flow-cancel-le-signup'].detail[0], /가입 흐름이 없어/)
  assert.equal(rules([W({ id: 'onboarding', clicks: 1, steps: 2, reachedEnd: true })])['flow-cancel-le-signup'].status, 'na')
  // 가입만 눌러 걸을 수 없으면 선언한 단계로
  const declared = W({ id: 'signup', clicks: 0, steps: 3, entryClicks: 1, reachedEnd: false, noControl: '/signup' })
  assert.deepEqual([declared.basis, declared.clicks, declared.reachedEnd], ['declared', 3, true])
  assert.equal(W({ id: 'signup', clicks: 0, steps: null, reachedEnd: false }).reachedEnd, false)
  const onb = W({ id: 'onboarding', clicks: 0, steps: 3, reachedEnd: false, noControl: '/onboarding' })
  assert.deepEqual([onb.basis, onb.clicks, onb.reachedEnd], ['declared', 2, true])
  assert.equal(W({ id: 'cancel', clicks: 0, steps: 3, reachedEnd: false }).basis, 'walked')
  // 해지는 선언으로 바꾸지 않는다 — 끝에 못 닿으면 실패
  const stuck = rules([signup, W({ id: 'cancel', clicks: 1, steps: 2, reachedEnd: false, stuck: '/cancel' })])['flow-reach']
  assert.equal(stuck.status, 'fail')
  assert.match(stuck.detail[0], /cancel: 끝에 닿지 못했다/)
  assert.equal(rules([])['flow-reach'].status, 'na')
})

test('pickStart: 진입 링크가 있는 첫 쪽 → 없으면 단계가 가장 낮은 흐름 쪽 · 법정 쪽은 건너뛴다', () => {
  const p = (route, flows = [], entries = [], legal = false) => ({ route, legal, probe: { flows, entries } })
  const probes = [p('/'), p('/cancel/done', [{ flow: 'cancel', step: 2 }]), p('/cancel', [{ flow: 'cancel', step: 1 }]), p('/account', [], [{ flow: 'cancel' }]), p('/privacy', [], [{ flow: 'cancel' }], true)]
  assert.deepEqual(pickStart('cancel', probes), { route: '/account', entry: true })
  assert.deepEqual(pickStart('cancel', probes.filter((x) => x.route !== '/account')), { route: '/cancel', entry: false })
  assert.equal(pickStart('signup', probes), null)
})

test('classifyHits: 수신 경로 종류 · 잡음 제외 · 오류 응답', () => {
  const o = 'http://x.test'
  assert.equal(classifyHits([{ kind: 'fetch', method: 'POST', url: `${o}/api/contact`, status: 200 }], o).via, 'network')
  assert.equal(classifyHits([{ kind: 'xhr', method: 'PUT', url: `${o}/a`, status: 204 }], o).via, 'network')
  assert.equal(classifyHits([{ kind: 'nav', url: 'mailto:a@b.co?subject=x' }], o).via, 'mailto')
  assert.equal(classifyHits([{ kind: 'nav', url: 'tel:0212345678' }], o).via, 'tel')
  assert.equal(classifyHits([{ kind: 'open', url: 'https://pf.kakao.com/x' }], o).via, 'open')
  assert.equal(classifyHits([{ kind: 'navdoc', url: `${o}/thanks`, status: 200 }], o).via, 'form-nav')
  // GET 은 수신이 아니다 · 분석·프리페치 잡음은 수신이 아니다
  assert.equal(classifyHits([{ kind: 'fetch', method: 'GET', url: `${o}/api/x`, status: 200 }], o).via, null)
  assert.equal(classifyHits([{ kind: 'fetch', method: 'POST', url: `${o}/api/track`, status: 200 }, { kind: 'fetch', method: 'POST', url: `${o}/_next/x`, status: 200 }], o).via, null)
  const err = classifyHits([{ kind: 'fetch', method: 'POST', url: `${o}/api/receive`, status: 500 }], o)
  assert.equal(err.via, null)
  assert.match(err.errors[0], /500/)
  assert.equal(classifyHits([{ kind: 'navdoc', url: `${o}/x`, status: 404 }], o).via, null)
  assert.equal(classifyHits([], o).via, null)
})

test('judgeConversion·judgeSite: 수신 없음(화면 안 성공 포함)·확인 없음·mailto action · 폼 없음은 na', () => {
  const rule = (convs, id) => judgeSite({ conversions: convs }).find((r) => r.id === id)
  const good = { route: '/contact', via: 'network', errors: [], status: '접수했어요' }
  for (const id of ['conv-reaches-receiver', 'conv-confirmation', 'conv-no-mailto-action']) assert.equal(rule([good], id).status, 'pass', id)
  const fake = { route: '/contact', via: null, errors: [], status: '접수했어요' }
  assert.equal(rule([fake], 'conv-reaches-receiver').status, 'fail')
  assert.match(rule([fake], 'conv-reaches-receiver').detail[0], /화면 안에서만/)
  assert.equal(rule([fake], 'conv-confirmation').status, 'pass')
  assert.equal(rule([{ ...good, status: null }], 'conv-confirmation').status, 'fail')
  assert.equal(rule([{ ...good, mailtoAction: 'mailto:a@b.co' }], 'conv-no-mailto-action').status, 'fail')
  assert.equal(rule([{ ...good, via: null, errors: ['POST /a → 500'] }], 'conv-reaches-receiver').status, 'fail')
  assert.equal(rule([{ ...good, errors: ['POST /a → 500'] }], 'conv-reaches-receiver').status, 'fail')
  assert.equal(rule([{ route: '/x', via: null, errors: [], status: null, blocked: 'email' }], 'conv-reaches-receiver').detail[0].includes('입력 검증에 막혔다'), true)
  const none = [{ route: '/', skipped: true, why: 'no-form' }]
  for (const id of ['conv-reaches-receiver', 'conv-confirmation', 'conv-no-mailto-action']) assert.equal(rule(none, id).status, 'na', id)
  assert.equal(rule([], 'conv-reaches-receiver').status, 'na')
})

test('interpretSite: 어김·경고·쪽 규칙 어김 포함 · 전부 na 이면 도구 실패(통과가 아니다)', () => {
  const pageOk = { route: '/', result: { fail: [], warn: [], rules: [{ status: 'pass' }] } }
  const rules = (over = {}) => SITE_RULES.map((r) => ({ id: r.id, level: r.level, status: 'pass', measured: 1, detail: [], ...(over[r.id] ?? {}) }))
  let v = interpretSite({ pages: [pageOk], rules: rules() })
  assert.deepEqual([v.exit, v.verdict, v.toolFailure], [0, 'pass', false])
  v = interpretSite({ pages: [pageOk], rules: rules({ 'flow-reach': { status: 'fail' } }) })
  assert.deepEqual([v.exit, v.verdict, v.fail], [1, 'fail', ['flow-reach']])
  v = interpretSite({ pages: [{ route: '/cancel', result: { fail: ['cancel-steps'], warn: ['flow-markers'], rules: [{ status: 'fail' }] } }], rules: rules() })
  assert.deepEqual([v.exit, v.fail, v.warn], [1, ['page:/cancel:cancel-steps'], ['page:/cancel:flow-markers']])
  v = interpretSite({ pages: [pageOk], rules: rules({ 'tone-page-mixed': { status: 'warn' } }) })
  assert.deepEqual([v.exit, v.warn], [0, ['tone-page-mixed']])
  const allNa = rules(Object.fromEntries(SITE_RULES.map((r) => [r.id, { status: 'na', measured: 0 }])))
  v = interpretSite({ pages: [{ route: '/', result: { fail: [], warn: [], rules: [{ status: 'na' }] } }], rules: allNa })
  assert.deepEqual([v.exit, v.verdict, v.toolFailure], [1, 'tool', true])
  assert.match(v.note, /^도구 실패:/)
  // 사이트 규칙이 na 여도 쪽 규칙이 재었다면 도구 실패가 아니다
  v = interpretSite({ pages: [pageOk], rules: allNa })
  assert.deepEqual([v.exit, v.verdict], [0, 'pass'])
})

test('routesOf: 중복 없이 순서를 지킨다', () => {
  assert.deepEqual(routesOf({ pages: [{ route: '/' }, { route: '/a' }, { route: '/' }, { id: 'x' }] }), ['/', '/a'])
  assert.deepEqual(routesOf(null), [])
  assert.deepEqual(FLOW_IDS, ['signup', 'cancel', 'onboarding'])
})

// ── ③ marketingSiteForCandidate(가짜 측정 — 브라우저 없음) ──
const candRun = (sitemap, wrapped = true) => {
  const runDir = mkdtempSync(join(tmpdir(), 'mkt-site-run-'))
  const candDir = join(runDir, 'a')
  mkdirSync(candDir, { recursive: true })
  if (sitemap) writeFileSync(join(candDir, '02-sitemap.json'), JSON.stringify(wrapped ? { inputHash: 'h', data: sitemap } : sitemap))
  return runDir
}
const fakeResult = (over = {}) => ({
  origin: 'http://x', pages: [{ route: '/', result: { fail: [], warn: [], rules: [{ status: 'pass' }] } }], flows: [], conversion: [], tone: [],
  rules: SITE_RULES.map((r) => ({ id: r.id, level: r.level, status: 'pass', measured: 1, detail: [] })), manualChecks: MANUAL_CHECKS, ...over,
})
test('marketingSiteForCandidate: 통과·판정 실패·도구 실패(결과 파일 지움)·사람 확인 목록', async () => {
  const sm = { pages: [{ id: 'home', route: '/' }] }
  const runDir = candRun(sm)
  const seen = []
  const measure = async (origin, sitemap, opts) => { seen.push({ origin, routes: routesOf(sitemap), opts }); return fakeResult() }
  const ok = await marketingSiteForCandidate(runDir, { id: 'a' }, { origin: 'http://127.0.0.1:1', measure })
  assert.deepEqual([ok.id, ok.exit, ok.verdict, ok.toolFailure], ['marketing-site', 0, 'pass', false])
  assert.equal(ok.resultFile, '07-qa/marketing-site/marketing-site.json')
  assert.equal(ok.manualChecks.length, 9)
  assert.deepEqual(seen, [{ origin: 'http://127.0.0.1:1', routes: ['/'], opts: { width: undefined } }])
  const saved = JSON.parse(readFileSync(join(runDir, 'a', ok.resultFile), 'utf8'))
  assert.equal(saved.candidate, 'a')
  assert.equal(saved.manualChecks.length, 9)
  // 판정 실패: 결과 파일이 있다
  const bad = await marketingSiteForCandidate(runDir, { id: 'a' }, { origin: 'http://x', measure: async () => fakeResult({ rules: fakeResult().rules.map((r) => (r.id === 'conv-confirmation' ? { ...r, status: 'fail', detail: ['x'] } : r)) }) })
  assert.deepEqual([bad.exit, bad.verdict, bad.toolFailure, bad.fail], [1, 'fail', false, ['conv-confirmation']])
  assert.ok(existsSync(join(runDir, 'a', bad.resultFile)))
  // 도구 실패 ① 측정이 던진다 → 결과 파일(앞 실행 것도)을 지운다 ② 전부 na ③ origin 없음 ④ 사이트맵 없음
  const thrown = await marketingSiteForCandidate(runDir, { id: 'a' }, { origin: 'http://x', measure: async () => { throw new Error('탐색 실패') } })
  assert.deepEqual([thrown.exit, thrown.verdict, thrown.toolFailure], [1, 'tool', true])
  assert.match(thrown.note, /^도구 실패: 탐색 실패/)
  assert.equal(existsSync(join(runDir, 'a', '07-qa', 'marketing-site', RESULT_NAME)), false)
  assert.equal(thrown.manualChecks.length, 9)
  const na = await marketingSiteForCandidate(runDir, { id: 'a' }, { origin: 'http://x', measure: async () => fakeResult({ pages: [{ route: '/', result: { fail: [], warn: [], rules: [{ status: 'na' }] } }], rules: fakeResult().rules.map((r) => ({ ...r, status: 'na', measured: 0 })) }) })
  assert.deepEqual([na.exit, na.verdict, na.toolFailure], [1, 'tool', true])
  assert.match((await marketingSiteForCandidate(runDir, { id: 'a' }, { measure })).note, /origin 이 없다/)
  const empty = await marketingSiteForCandidate(candRun(null), { id: 'a' }, { origin: 'http://x', measure })
  assert.equal(empty.toolFailure, true)
  assert.match(empty.note, /02-sitemap\.json 이 없거나/)
  // 벗기지 않은 사이트맵(래핑 없음)도 읽는다
  assert.equal((await marketingSiteForCandidate(candRun(sm, false), { id: 'a' }, { origin: 'http://x', measure })).exit, 0)
})

// ── ④ 브라우저 ──
let chrome, ws, live
const servers = []
const env = () => (live ??= (async () => {
  chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb'], { prefix: 'mkt-site-test-' })
  const c = await connect(chrome.wsUrl)
  ws = c.ws
  return { session: { send: c.send, ev: c.ev } }
})())
after(async () => {
  try { ws?.close() } catch {}
  await chrome?.close()
  for (const s of servers) await s.stop()
})
const measureSite = async (name, opts = {}) => {
  const { session } = await env()
  const dir = buildSite(name, TMP)
  const srv = await serveSite(dir)
  servers.push(srv)
  const r = await marketingSite(srv.origin, sitemapOf(dir), { session, pageGate: !name.startsWith('form-') || name === 'form-native-get', ...opts })
  return { r, srv, dir }
}
const rulesOf = (r) => Object.fromEntries(r.rules.map((x) => [x.id, x]))
const nonPass = (r) => r.rules.filter((x) => x.status !== 'pass').map((x) => `${x.id}:${x.status}:${x.detail.join('|')}`)

for (const v of PASSING) {
  test(`양성 대조 ${v.name}: 사이트 규칙 어김·경고 0, 7규칙이 모두 실제로 쟀다(measured ≥ 1) — ${v.why}`, async () => {
    const { r, srv } = await measureSite(v.name)
    assert.deepEqual(nonPass(r), [], JSON.stringify(r.tone.map((t) => [t.route, t.counts, t.ctaCounts])))
    for (const x of r.rules) assert.ok(x.measured >= 1, `${x.id} measured ${x.measured}`)
    assert.deepEqual(r.fail, [])
    assert.equal(r.exit, 0)
    assert.equal(r.manualChecks.length, 9)
    assert.equal(r.pages.length, sitemapOf(buildSite(v.name, TMP)).pages.length)
    for (const p of r.pages) assert.deepEqual(p.result.fail, [], `${p.route}: ${JSON.stringify(p.result.rules.filter((x) => x.status === 'fail'))}`)
    const flow = Object.fromEntries(r.flows.map((w) => [w.id, w]))
    if (v.name === 'good') {
      assert.deepEqual([flow.signup.clicks, flow.signup.steps, flow.signup.basis, flow.signup.reachedEnd], [2, 2, 'walked', true])
      assert.deepEqual([flow.cancel.clicks, flow.cancel.steps, flow.cancel.basis, flow.cancel.reachedEnd], [2, 2, 'walked', true])
      assert.deepEqual(flow.cancel.pages, ['/account', '/cancel', '/cancel/done'])
      assert.deepEqual(flow.signup.pages, ['/', '/signup', '/signup/done'])
      assert.equal(srv.received.length, 1, '서버도 문의 본문을 하나 받았다(양성 대조 — 관문의 「닿았다」가 서버 쪽 사실과 맞다)')
      assert.match(srv.received[0], /test@example\.com/)
      // 합쇼체 인용·합쇼체 법정 문구·합쇼체 법정 쪽이 제외 규칙으로 걸러졌다
      const home = r.tone.find((t) => t.route === '/')
      assert.deepEqual([home.mixed, home.ctaMixed, home.counts.hapsyo], [false, false, 0])
      assert.equal(r.tone.find((t) => t.route === '/privacy').excluded, true)
      assert.equal(r.conversion.find((c) => c.route === '/contact').via, 'network')
    }
    if (v.name === 'signup-declared') {
      assert.deepEqual([flow.signup.basis, flow.signup.clicks, flow.signup.steps], ['declared', 1, 2])
      assert.deepEqual([flow.cancel.basis, flow.cancel.clicks], ['walked', 1])
    }
    if (v.name === 'form-native-get') assert.equal(r.conversion.find((c) => c.route === '/contact').via, 'form-nav')
  })
}

for (const v of VARIANTS) {
  test(`음성 대조 ${v.name}: ${v.rule} 만 ${v.expect === 'fail' ? '실패' : '경고'} — ${v.why}`, async () => {
    const { r, srv } = await measureSite(v.name)
    const hit = rulesOf(r)[v.rule]
    assert.equal(hit.status, v.expect, `${v.rule} → ${hit.status} ${JSON.stringify(hit.detail)}`)
    assert.ok(hit.detail.length > 0)
    const others = r.rules.filter((x) => x.id !== v.rule && x.status !== 'pass')
    assert.deepEqual(others.map((x) => `${x.id}:${x.status}:${x.detail.join('|')}`), [], '다른 사이트 규칙은 그대로 통과')
    // 쪽 단위 규칙: 표에 적은 것만(쪽 단위를 돌린 사이트에서)
    if (r.pages.length) assert.deepEqual(r.fail.filter((f) => f.startsWith('page:')).sort(), [...(v.pageFail ?? [])].sort())
    assert.equal(r.exit, v.expect === 'fail' ? 1 : 0)
    if (v.name === 'form-fake-success') assert.equal(srv.received.length, 0, '서버는 아무것도 받지 못했다(음성 대조 — 화면만 완료였다)')
    if (v.name === 'form-no-confirmation') assert.equal(srv.received.length, 1, '수신은 됐다')
  })
}

for (const m of MULTI) {
  test(`음성 대조 ${m.name}: ${m.rules.join('·')} 이(가) 실패 — ${m.why}`, async () => {
    const { r, srv } = await measureSite(m.name)
    assert.deepEqual(r.rules.filter((x) => x.status === 'fail').map((x) => x.id).sort(), [...m.rules].sort())
    assert.equal(srv.received.length, 0)
    assert.equal(r.exit, 1)
  })
}

test('여러 쪽 해지: 쪽을 건너 클릭 4 · 단계 3 을 세고, 어느 한 쪽에서도 단계 수는 세지 못한다(리뷰 초점 2)', async () => {
  const { r } = await measureSite('cancel-long', { pageGate: false })
  const cancel = r.flows.find((w) => w.id === 'cancel')
  assert.deepEqual([cancel.clicks, cancel.entryClicks, cancel.steps, cancel.reachedEnd], [4, 1, 3, true])
  assert.deepEqual(cancel.pages, ['/account', '/cancel/why', '/cancel/offer', '/cancel/confirm', '/cancel/done'])
  assert.deepEqual(cancel.stepsSeen, [1, 2, 3])
  const signup = r.flows.find((w) => w.id === 'signup')
  assert.deepEqual([signup.clicks, signup.steps], [2, 2])
  // 쪽 하나만 재는 marketing-gate 는 /cancel/why 에서 「가입 2단계 < 해지 3단계」만 본다 — 사이트 단위가 없으면 클릭 수(4 > 2)는 아무도 못 센다
  const detail = rulesOf(r)['flow-cancel-le-signup'].detail.join('|')
  assert.match(detail, /해지 클릭 4 > 가입 클릭 2/)
})

test('marketingSiteForCandidate(실제 측정): 통과 사이트는 pass·결과 파일·사람 확인 9개, 죽은 origin 은 도구 실패', async () => {
  const { session } = await env()
  const dir = buildSite('good', TMP)
  const srv = await serveSite(dir)
  servers.push(srv)
  const runDir = candRun(sitemapOf(dir))
  const ok = await marketingSiteForCandidate(runDir, { id: 'a' }, { origin: srv.origin, measure: (o, s, opts) => marketingSite(o, s, { ...opts, session, pageGate: false }) })
  assert.deepEqual([ok.exit, ok.verdict, ok.toolFailure], [0, 'pass', false], ok.note)
  const saved = JSON.parse(readFileSync(join(runDir, 'a', ok.resultFile), 'utf8'))
  assert.equal(saved.manualChecks.length, 9)
  assert.equal(saved.flows.length, 2)
  const dead = await marketingSiteForCandidate(runDir, { id: 'a' }, { origin: 'http://127.0.0.1:1', measure: (o, s, opts) => marketingSite(o, s, { ...opts, session, pageGate: false }) })
  assert.deepEqual([dead.exit, dead.verdict, dead.toolFailure], [1, 'tool', true])
  assert.match(dead.note, /^도구 실패:/)
  assert.equal(existsSync(join(runDir, 'a', '07-qa', 'marketing-site', RESULT_NAME)), false)
})

// ── ⑤ CLI ──
test('CLI: 통과 0(결과 파일) · 판정 실패 1(결과 파일 + FAIL) · 도구 실패 1(파일 없음 + 「도구 실패:」) · 인자 오류 2', async () => {
  const good = buildSite('good', TMP), bad = buildSite('cancel-long', TMP)
  const gs = await serveSite(good), bs = await serveSite(bad)
  servers.push(gs, bs)
  const out = mkdtempSync(join(tmpdir(), 'mkt-site-cli-'))
  const ok = await run([gs.origin, '--sitemap', join(good, 'sitemap.json'), '--out', out])
  assert.equal(ok.code, 0, ok.err)
  const j = JSON.parse(readFileSync(join(out, RESULT_NAME), 'utf8'))
  assert.deepEqual(j.fail, [])
  assert.equal(j.rules.length, SITE_RULES.length)
  assert.equal(j.manualChecks.length, 9)
  assert.ok(JSON.parse(ok.out).flows.some((w) => w.id === 'cancel' && w.clicks === 2))

  const no = await run([bs.origin, '--sitemap', join(bad, 'sitemap.json'), '--out', out])
  assert.equal(no.code, 1)
  assert.match(no.err, /FAIL flow-cancel-le-signup/)
  assert.ok(JSON.parse(readFileSync(join(out, RESULT_NAME), 'utf8')).fail.includes('flow-cancel-le-signup'))

  const tf = await run(['http://127.0.0.1:1', '--sitemap', join(good, 'sitemap.json'), '--out', out])
  assert.equal(tf.code, 1)
  assert.match(tf.err, /도구 실패:/)
  assert.equal(existsSync(join(out, RESULT_NAME)), false, '도구 실패는 앞 실행의 결과 파일까지 지운다')
  const nf = await run([gs.origin, '--sitemap', join(out, '없는.json'), '--out', out])
  assert.equal(nf.code, 1)
  assert.match(nf.err, /도구 실패: 사이트맵 파일이 없다/)

  assert.equal((await run([])).code, 2)
  assert.equal((await run([gs.origin])).code, 2)
  assert.equal((await run(['not-a-url', '--sitemap', 'x'])).code, 2)
  assert.equal((await run([gs.origin, '--sitemap'])).code, 2)
  assert.equal((await run([gs.origin, 'extra', '--sitemap', 'x'])).code, 2)
  assert.equal((await run([gs.origin, '--sitemap', 'x', '--width', '10'])).code, 2)
})

test('픽스처 폴더 구성: good 이 전체 사이트이고 겹침은 쪽 일부만 가진다', () => {
  assert.ok(existsSync(join(SITES_DIR, 'good', 'sitemap.json')))
  assert.ok(sitemapOf(join(SITES_DIR, 'good')).pages.some((p) => p.legal === true))
})
