// ops-gate 브라우저 시험(P3-4 Task 1) — 진짜 Chrome + Lighthouse 를 픽스처 서버에 돈다. 실행 잠금(원장 gate 줄) 안에서만 돌린다.
//   좋은 쪽은 전부 통과하고, 무거운 히어로·늦게 뜨는 배너·unload 쪽은 각각 그 검사만 어긴다. 계측 동의 4종은 진짜 CDP 요청으로 센다.
// 실행: node --test --test-force-exit --test-timeout=900000 factory/qa/ops-gate.browser.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opsGate } from './ops-gate.mjs'
import { startFixtureServer } from './ops-fixtures/server.mjs'

const LH_ROUTES = ['/', '/heavy-hero', '/shift', '/unload']
const on = (r, id, route) => r.checks.find((c) => c.id === id && (route === undefined || c.route === route))
const bad = (r, route) => r.checks.filter((c) => c.route === route && (c.status === 'fail')).map((c) => c.id).sort()

test('Lighthouse 모바일: 좋은 쪽 통과 · 무거운 히어로(lh-perf·lcp) · 밀리는 배너(cls) · unload(bf-cache) 각각 그 검사만 실패', { timeout: 900_000 }, async () => {
  const s = await startFixtureServer()
  try {
    const r = await opsGate(s.origin, { routes: LH_ROUTES, archetype: 'local', siteDir: s.siteDir, lhRoutes: 'all', recipe: 'fixture' })
    assert.equal(r.summary.lighthouse, '4/4')

    // 좋은 쪽
    assert.deepEqual(bad(r, '/'), [], JSON.stringify(r.checks.filter((c) => c.route === '/')))
    assert.ok(on(r, 'lh-perf', '/').value >= 90)
    assert.ok(on(r, 'lh-seo', '/').value >= 95)
    assert.equal(on(r, 'bf-cache', '/').status, 'pass')
    // FV1 Task 5.10 참고 행 셋: 설치된 Lighthouse(13.5 — agentic-browsing 범주가 있는 판)가 값을 내므로 na 가 아니다. 좋은 쪽은 JS 가 거의 없어 예산 안이다.
    for (const id of ['js-budget', 'tbt', 'agentic-browsing']) assert.notEqual(on(r, id, '/').status, 'na', `${id}: ${JSON.stringify(on(r, id, '/'))}`)
    assert.equal(on(r, 'js-budget', '/').status, 'pass', JSON.stringify(on(r, 'js-budget', '/')))
    assert.equal(on(r, 'tbt', '/').status, 'pass', JSON.stringify(on(r, 'tbt', '/')))
    assert.ok(typeof on(r, 'agentic-browsing', '/').value === 'number', JSON.stringify(on(r, 'agentic-browsing', '/')))

    // 무거운 히어로: 성능·LCP 만, 그리고 LCP 요소가 img 로 이름이 대어진다
    assert.deepEqual(bad(r, '/heavy-hero'), ['lcp', 'lh-perf'], JSON.stringify(r.checks.filter((c) => c.route === '/heavy-hero')))
    assert.match(on(r, 'lcp', '/heavy-hero').detail[0], /img/i)
    assert.match(on(r, 'lh-perf', '/heavy-hero').detail[0], /img/i)

    // 늦게 뜨는 배너
    // CLS 는 성능 점수에도 들어가므로(가중치 25%) 크게 밀리면 lh-perf 도 함께 떨어질 수 있다 — 다른 검사는 그대로여야 한다
    const shift = bad(r, '/shift')
    assert.ok(shift.includes('cls') && shift.every((id) => ['cls', 'lh-perf'].includes(id)), `shift 실패 ${shift}`)
    assert.ok(on(r, 'cls', '/shift').value > 0.1)
    assert.match(on(r, 'cls', '/shift').detail[0], /main/)

    // unload 처리기
    assert.deepEqual(bad(r, '/unload'), ['bf-cache'], JSON.stringify(r.checks.filter((c) => c.route === '/unload')))

    // 사이트 수준 + 진짜 계측 탐사(좋은 사이트 = 동의 전 0, 동의 뒤 page_view 1)
    assert.equal(on(r, 'analytics-consent').status, 'pass', JSON.stringify(on(r, 'analytics-consent')))
    assert.equal(r.exit, 1)
    globalThis.__opsValues = r.checks.filter((c) => c.route !== undefined).map((c) => `${c.route} ${c.id}=${c.value} ${c.status}`)
    console.log(globalThis.__opsValues.join('\n'))
  } finally { await s.close() }
})

// 계측 동의: 진짜 Chrome 이 요청을 세는 음성 대조. Lighthouse 는 안 돈다.
for (const [broken, want, requireAnalytics] of [['track-before-consent', /동의 전/], ['no-pageview', /page_view 가 안 나갔다/, true], ['pageview-twice', /2번/]]) {
  test(`계측 동의 음성 대조 ${broken}: analytics-consent 만 실패`, { timeout: 120_000 }, async () => {
    const s = await startFixtureServer({ broken })
    try {
      const r = await opsGate(s.origin, { routes: ['/', '/pricing', '/privacy'], archetype: 'local', siteDir: s.siteDir, lhRoutes: 'none', requireAnalytics: requireAnalytics === true })
      assert.deepEqual(r.checks.filter((c) => c.status === 'fail').map((c) => c.id), ['analytics-consent'], JSON.stringify(r.checks.filter((c) => c.status !== 'pass')))
      assert.match(on(r, 'analytics-consent').detail[0], want)
    } finally { await s.close() }
  })
}

test('계측·배너가 없는 사이트는 analytics-consent 가 na(통과 아님)이고 종료는 0 — naOk', { timeout: 120_000 }, async () => {
  const s = await startFixtureServer({ broken: 'no-analytics' })
  try {
    const r = await opsGate(s.origin, { routes: ['/', '/pricing', '/privacy'], archetype: 'local', siteDir: s.siteDir, lhRoutes: 'none', siteJson: { locale: 'ko', pages: {} } })
    assert.equal(on(r, 'analytics-consent').status, 'na')
    assert.equal(r.summary.na, 1)
    assert.equal(r.exit, 0)
  } finally { await s.close() }
})

test('동의 뒤에도 계측이 없는 사이트는 기본에서 na, requireAnalytics 면 실패', { timeout: 120_000 }, async () => {
  const s = await startFixtureServer({ broken: 'no-pageview' })
  try {
    const opts = { routes: ['/', '/pricing', '/privacy'], archetype: 'local', siteDir: s.siteDir, lhRoutes: 'none' }
    const lenient = await opsGate(s.origin, opts)
    assert.equal(on(lenient, 'analytics-consent').status, 'na')
    assert.equal(lenient.exit, 0)
    const strict = await opsGate(s.origin, { ...opts, requireAnalytics: true })
    assert.equal(on(strict, 'analytics-consent').status, 'fail')
    assert.equal(strict.exit, 1)
  } finally { await s.close() }
})

test('bf-cache 「복원 도중 취소」 하나뿐이면 한 번 다시 잰다 — 다른 이유(unload)는 다시 재지 않는다', { timeout: 120_000 }, async () => {
  const mk = (bf) => ({
    categories: { performance: { score: 1 }, seo: { score: 1 }, accessibility: { score: 1 } },
    audits: { 'largest-contentful-paint': { numericValue: 500 }, 'cumulative-layout-shift': { numericValue: 0 }, 'bf-cache': bf },
  })
  const cancelled = { score: 0, scoreDisplayMode: 'binary', details: { items: [{ reason: 'Navigation was cancelled before the page could be restored from back/forward cache.' }] } }
  const unload = { score: 0, scoreDisplayMode: 'binary', details: { items: [{ reason: 'The page has an unload handler in the main frame.' }] } }
  const s = await startFixtureServer()
  try {
    const base = { routes: ['/'], archetype: 'local', siteDir: s.siteDir, lhRoutes: ['/'], consentProbe: async () => ({ banner: true, before: [], after: [{ url: 'http://x/ingest', method: 'POST', type: 'Fetch', postData: 'page_view' }] }) }
    let calls = 0
    const once = await opsGate(s.origin, { ...base, runLighthouse: async () => { calls++; return mk(calls === 1 ? cancelled : { score: 1, scoreDisplayMode: 'binary' }) } })
    assert.equal(calls, 2)
    assert.equal(on(once, 'bf-cache', '/').status, 'pass')
    calls = 0
    const real = await opsGate(s.origin, { ...base, runLighthouse: async () => { calls++; return mk(unload) } })
    assert.equal(calls, 1)
    assert.equal(on(real, 'bf-cache', '/').status, 'fail')
  } finally { await s.close() }
})

test('Lighthouse 실패(Chrome 이 열지 못하는 쪽)는 도구 실패로 던진다 — 판정 실패가 아니다', { timeout: 300_000 }, async () => {
  const s = await startFixtureServer()
  try {
    await assert.rejects(() => opsGate(s.origin, { routes: ['/'], archetype: 'local', siteDir: s.siteDir, lhRoutes: ['/'], consentProbe: async () => ({ banner: true, before: [], after: [] }), runLighthouse: async () => { throw new Error('Chrome 연결 끊김') } }), /Lighthouse 실패/)
  } finally { await s.close() }
})
