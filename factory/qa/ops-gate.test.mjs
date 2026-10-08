// ops-gate 시험(P3-4 Task 1) — 브라우저 없이. 판정 순수 함수 · 픽스처 서버(작은 node http) 위의 사이트 수준 검사 · 후보 어댑터 · CLI 종료 코드.
// Chrome·Lighthouse 를 도는 시험은 ops-gate.browser.test.mjs(실행 잠금 안에서).
// 실행: node --test --test-force-exit --test-timeout=180000 factory/qa/ops-gate.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import {
  completionOf, confirmBfCacheRow, describeCheck, hasFormFields, icoSizes, inlineScriptHashes, isTrackingRequest, judgeConsent, judgeCsp, judgeCspHash, judgeExit, judgeSecurityHeaders, judgeSecurityHeadersHash, judgeSitemapRobots, judgeViewport, lhrEnvironment, lhrToChecks,
  OPS_CHECKS, opsGate, opsGateForCandidate, pickLighthouseRoutes, settlePerfOnSlowPc, THRESHOLDS, ToolFailure,
} from './ops-gate.mjs'
import { BROKEN, startFixtureServer } from './ops-fixtures/server.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const GATE = join(here, 'ops-gate.mjs')
const ROUTES = ['/', '/pricing', '/privacy', '/thanks']
const okConsent = async () => ({ banner: true, before: [], after: [{ url: 'http://x/ingest', method: 'POST', type: 'Fetch', postData: '{"event":"page_view"}' }] })
const site = (broken, o = {}) => startFixtureServer({ broken, ...o })
const run = (s, extra = {}) => opsGate(s.origin, { routes: ROUTES, archetype: 'local', siteDir: s.siteDir, lhRoutes: 'none', consentProbe: okConsent, siteJson: { locale: 'ko', pages: {} }, ...extra })
const failing = (r) => r.checks.filter((c) => c.status === 'fail').map((c) => c.id)

// ─── 표 ───

test('OPS_CHECKS: 계획표의 검사 id 와 문턱이 그대로 있다', () => {
  for (const id of ['lh-perf', 'lh-seo', 'lcp', 'cls', 'bf-cache', 'legal-routes', 'og-image', 'favicon-set', 'error-pages', 'security-headers', 'sitemap-robots', 'analytics-consent', 'viewport-fit', 'lh-a11y', 'js-budget', 'tbt', 'agentic-browsing']) assert.ok(OPS_CHECKS[id], id)
  assert.deepEqual(THRESHOLDS, { 'lh-perf': 90, 'lh-seo': 95, lcp: 2500, cls: 0.1, 'lh-a11y': 95, 'js-budget': 170, tbt: 200 })
  assert.equal(OPS_CHECKS['lh-a11y'].level, 'should', '접근성 점수는 참고(규칙 검사는 Task 3)')
  for (const id of ['js-budget', 'tbt', 'agentic-browsing']) assert.equal(OPS_CHECKS[id].level, 'should', `${id} 는 should 행이다(FV1 Task 5.10)`)
  for (const [id, c] of Object.entries(OPS_CHECKS)) assert.ok(['must', 'should'].includes(c.level) && c.src && c.what, id)
})

// ─── 순수 판정 ───

test('judgeExit: 필수 fail 은 1 · 필수 na 는 naOk 가 아니면 1(A123) · should 의 warn 은 0', () => {
  const m = (id, status) => ({ id, level: OPS_CHECKS[id].level, status })
  assert.equal(judgeExit([m('lh-perf', 'pass'), m('cls', 'pass')]), 0)
  assert.equal(judgeExit([m('lh-perf', 'fail')]), 1)
  assert.equal(judgeExit([m('lh-perf', 'na')]), 1, '필수인데 못 쟀다 = 통과가 아니다')
  assert.equal(judgeExit([m('analytics-consent', 'na')]), 0, 'naOk 행은 na 가 실패가 아니다')
  assert.equal(judgeExit([m('bf-cache', 'na')]), 0)
  assert.equal(judgeExit([m('lh-a11y', 'warn'), m('error-pages', 'pass')]), 0)
  assert.equal(judgeExit([]), 0)
})

test('isTrackingRequest: 비콘·다른 출처 fetch·POST·다른 출처 스크립트·알려진 계측 호스트는 계측, 같은 출처 GET·이미지·글꼴은 아니다', () => {
  const o = 'http://127.0.0.1:3000'
  const T = (r) => isTrackingRequest(r, o)
  assert.equal(T({ url: `${o}/ingest`, method: 'POST', type: 'Fetch' }), true)
  assert.equal(T({ url: `${o}/ingest`, method: 'POST', type: 'Ping' }), true)
  assert.equal(T({ url: 'https://eu.i.posthog.com/e/', method: 'POST', type: 'XHR' }), true)
  assert.equal(T({ url: 'https://www.googletagmanager.com/gtag/js?id=G-1', method: 'GET', type: 'Script' }), true)
  assert.equal(T({ url: 'https://cdn.example.com/lib.js', method: 'GET', type: 'Script' }), true)
  assert.equal(T({ url: `${o}/_next/static/a.js`, method: 'GET', type: 'Script' }), false)
  assert.equal(T({ url: `${o}/data.json`, method: 'GET', type: 'Fetch' }), false)
  assert.equal(T({ url: 'https://images.pexels.com/a.jpg', method: 'GET', type: 'Image' }), false)
  assert.equal(T({ url: 'https://fonts.gstatic.com/x.woff2', method: 'GET', type: 'Font' }), false)
})

test('judgeConsent: 동의 전 계측 0 · 동의하면 page_view 1회 — 어긋나면 fail, 계측도 배너도 없으면 na', () => {
  const o = 'http://127.0.0.1:3000'
  const pv = { url: `${o}/ingest`, method: 'POST', type: 'Fetch', postData: '{"event":"page_view"}' }
  assert.equal(judgeConsent({ banner: true, before: [], after: [pv] }, o).status, 'pass')
  const early = judgeConsent({ banner: true, before: [pv], after: [pv] }, o)
  assert.equal(early.status, 'fail')
  assert.match(early.detail[0], /동의 전/)
  const silent = judgeConsent({ banner: true, before: [], after: [] }, o)
  assert.equal(silent.status, 'na', '어댑터가 없는 사이트 — 동의 뒤에도 계측이 없으면 잴 것이 없다')
  assert.match(judgeConsent({ banner: true, before: [], after: [] }, o, { requireAnalytics: true }).detail[0], /page_view 가 안 나갔다/)
  assert.equal(judgeConsent({ banner: true, before: [], after: [] }, o, { requireAnalytics: true }).status, 'fail')
  assert.equal(judgeConsent({ banner: false, before: [], after: [] }, o, { requireAnalytics: true }).status, 'fail', '어댑터가 붙은 사이트는 배너가 있어야 한다')
  assert.match(judgeConsent({ banner: true, before: [], after: [pv, pv] }, o).detail[0], /2번/)
  assert.equal(judgeConsent({ banner: false, before: [], after: [] }, o).status, 'na')
  assert.equal(judgeConsent({ banner: false, before: [], after: [pv] }, o).status, 'fail', '배너 없이 계측')
  const pixel = { url: `${o}/img.gif`, method: 'GET', type: 'Image' }
  assert.equal(judgeConsent({ banner: true, before: [pixel], after: [pv] }, o).status, 'pass', '계측 아닌 요청은 세지 않는다')
})

test('pickLighthouseRoutes: 홈·요금·법정 하나·문의 순으로 최대 4 — 나머지는 안 잰다', () => {
  assert.deepEqual(pickLighthouseRoutes(['/', '/pricing', '/privacy', '/terms', '/contact', '/about']), ['/', '/pricing', '/privacy', '/contact'])
  assert.deepEqual(pickLighthouseRoutes(['/', '/services', '/privacy']), ['/', '/services', '/privacy'])
  assert.deepEqual(pickLighthouseRoutes(['/x']), [])
})

test('icoSizes: ICO 디렉터리를 읽고, ICO 가 아니면 null', () => {
  const b = Buffer.alloc(6 + 32)
  b.writeUInt16LE(1, 2); b.writeUInt16LE(2, 4); b[6] = 16; b[7] = 16; b[22] = 32; b[23] = 32
  assert.deepEqual(icoSizes(b), [{ w: 16, h: 16 }, { w: 32, h: 32 }])
  assert.equal(icoSizes(Buffer.from('<svg/>')), null)
})

test('judgeViewport: viewport-fit=cover 필수 · 입력칸이 있는 쪽은 interactive-widget=resizes-content', () => {
  const page = (content, body = '') => ({ route: '/x', html: `<html><head><meta name="viewport" content="${content}"></head><body>${body}</body></html>` })
  assert.equal(judgeViewport([page('width=device-width, initial-scale=1, viewport-fit=cover')]).status, 'pass')
  assert.equal(judgeViewport([page('width=device-width, initial-scale=1')]).status, 'fail')
  assert.equal(judgeViewport([{ route: '/x', html: '<html><head></head></html>' }]).status, 'fail')
  const form = '<form><input type="email"></form>'
  assert.equal(judgeViewport([page('width=device-width, viewport-fit=cover', form)]).status, 'fail')
  assert.equal(judgeViewport([page('width=device-width, viewport-fit=cover, interactive-widget=resizes-content', form)]).status, 'pass')
  assert.equal(hasFormFields('<input type="hidden"><button>x</button>'), false)
  assert.equal(hasFormFields('<textarea></textarea>'), true)
})

test('judgeCsp·judgeSecurityHeaders: nonce·frame-ancestors, 요청마다 다른 nonce, HTML script 의 nonce 일치', () => {
  assert.deepEqual(judgeCsp("script-src 'self' 'nonce-abc' 'strict-dynamic'; frame-ancestors 'none'").detail, [])
  assert.equal(judgeCsp("script-src 'self' 'unsafe-inline'").nonce, null)
  const resp = (nonce, extra = {}, scripts = `<script nonce="${nonce}">1</script>`) => ({
    headers: new Headers({ 'content-security-policy': `script-src 'nonce-${nonce}'; frame-ancestors 'none'`, 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=()', ...extra }),
    html: `<html>${scripts}</html>`,
  })
  assert.equal(judgeSecurityHeaders(resp('a'), resp('b')).status, 'pass')
  assert.match(judgeSecurityHeaders(resp('a'), resp('a')).detail[0], /요청마다 같다/)
  assert.match(judgeSecurityHeaders(resp('a', {}, '<script>1</script>'), resp('b')).detail.join(), /nonce/)
  assert.match(judgeSecurityHeaders(resp('a', { 'referrer-policy': 'unsafe-url' }), resp('b')).detail[0], /느슨/)
})

// ─── 정적 사이트(completion "site") 보안 헤더 — nonce 없이 script-src 'self' + 인라인 script 해시(P3-4 perf, 대장 C171) ───

const sha = (text, alg = 'sha256') => `'${alg}-${createHash(alg).update(text, 'utf8').digest('base64')}'`
const CSP_TAIL = "style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"

test('completionOf: 원형 JSON 의 completion 을 그대로 읽는다(site · product) — 모르는 원형은 도구 실패', () => {
  assert.equal(completionOf('local'), 'site')
  assert.equal(completionOf('brand'), 'site')
  assert.equal(completionOf('saas'), 'product')
  assert.equal(completionOf('pwa'), 'product')
  assert.throws(() => completionOf('no-such-archetype'), ToolFailure)
})

test('inlineScriptHashes: 실행되는 인라인 script 만 sha256(브라우저가 계산하는 그대로 — 태그 사이 글자 통째)', () => {
  const html = '<script>a()</script><script src="/x.js"></script><script type="application/ld+json">{"a":1}</script><script type="module">import("/m.js")</script><script nonce="n">b()</script>'
  assert.deepEqual(inlineScriptHashes(html), [sha('a()'), sha('import("/m.js")'), sha('b()')])
  assert.deepEqual(inlineScriptHashes('<script> </script>'), [sha(' ')], '공백만 있어도 글자가 있으면 해시 대상')
  assert.deepEqual(inlineScriptHashes('<script></script>'), [], '빈 script 는 실행할 것이 없다')
})

test('judgeCspHash: script-src 는 self + 해시뿐, 실제 인라인 script 가 전부 해시에 있고, frame-ancestors·base-uri·object-src 가 있다', () => {
  const html = '<script>a()</script><script>b()</script><script type="application/ld+json">{}</script>'
  const csp = (script) => `default-src 'self'; script-src ${script}; ${CSP_TAIL}`
  const good = csp(`'self' ${sha('a()')} ${sha('b()')}`)
  assert.deepEqual(judgeCspHash(good, html).detail, [])
  assert.match(judgeCspHash(null, html).detail[0], /헤더가 없다/)
  assert.match(judgeCspHash(csp(`'self' 'unsafe-inline'`), '<p>x</p>').detail.join(), /unsafe-inline/)
  assert.match(judgeCspHash(csp(`'self' 'unsafe-eval' ${sha('a()')} ${sha('b()')}`), html).detail.join(), /unsafe-eval/)
  assert.match(judgeCspHash(csp(`'self' https: ${sha('a()')} ${sha('b()')}`), html).detail.join(), /https:/)
  assert.match(judgeCspHash(csp(`${sha('a()')} ${sha('b()')}`), html).detail.join(), /'self'/)
  assert.match(judgeCspHash(csp(`'self' ${sha('a()')}`), html).detail.join(), /1개가 script-src 해시에 없다/)
  assert.deepEqual(judgeCspHash(csp(`'self' ${sha('a()', 'sha384')} ${sha('b()', 'sha512')}`), html).detail, [], 'sha384·sha512 도 인정')
  for (const [drop, re] of [['frame-ancestors', /frame-ancestors/], ['base-uri', /base-uri/], ['object-src', /object-src/]]) {
    const cut = good.split(';').filter((d) => !d.trim().startsWith(drop)).join(';')
    assert.match(judgeCspHash(cut, html).detail.join(), re, drop)
  }
  assert.match(judgeCspHash(good.replace("object-src 'none'", "object-src 'self'"), html).detail.join(), /object-src/)
  assert.match(judgeCspHash(good.replace("frame-ancestors 'none'", 'frame-ancestors *'), html).detail.join(), /frame-ancestors/)
})

test('judgeSecurityHeadersHash: 쪽마다 그 쪽 헤더로 해시를 대조하고, 첫 응답에서 nosniff·Referrer-Policy·Permissions-Policy 를 본다', () => {
  const trio = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=()' }
  const resp = (route, script, extra = {}) => ({ route, html: `<html><script>${script}</script></html>`, headers: new Headers({ 'content-security-policy': `script-src 'self' ${sha(script)}; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, ...trio, ...extra }) })
  assert.equal(judgeSecurityHeadersHash([resp('/', 'a()'), resp('/pricing', 'b()')]).status, 'pass')
  const wrong = resp('/pricing', 'b()')
  wrong.html = '<html><script>zzz()</script></html>'
  const r = judgeSecurityHeadersHash([resp('/', 'a()'), wrong])
  assert.equal(r.status, 'fail')
  assert.match(r.detail.join(), /\/pricing/)
  assert.match(judgeSecurityHeadersHash([resp('/', 'a()', { 'x-content-type-options': '' })]).detail.join(), /nosniff/)
  assert.match(judgeSecurityHeadersHash([resp('/', 'a()', { 'referrer-policy': 'unsafe-url' })]).detail.join(), /느슨/)
  assert.match(judgeSecurityHeadersHash([resp('/', 'a()', { 'permissions-policy': '' })]).detail.join(), /Permissions-Policy/)
})

test('judgeSitemapRobots: 색인 쪽 전부·noindex 제외·절대 주소·robots 의 Sitemap', () => {
  const pages = [{ route: '/', noindex: false }, { route: '/pricing', noindex: false }, { route: '/thanks', noindex: true }]
  const xml = (...p) => `<urlset>${p.map((x) => `<url><loc>https://a.example${x}</loc></url>`).join('')}</urlset>`
  const ok = { pages, sitemapStatus: 200, sitemapXml: xml('/', '/pricing'), robotsStatus: 200, robotsTxt: 'User-agent: *\nAllow: /\nSitemap: https://a.example/sitemap.xml\n' }
  assert.equal(judgeSitemapRobots(ok).status, 'pass')
  assert.match(judgeSitemapRobots({ ...ok, sitemapXml: xml('/') }).detail[0], /\/pricing: sitemap 에 없다/)
  assert.match(judgeSitemapRobots({ ...ok, sitemapXml: xml('/', '/pricing', '/thanks') }).detail[0], /noindex/)
  assert.match(judgeSitemapRobots({ ...ok, robotsTxt: 'User-agent: *\nAllow: /\n' }).detail[0], /Sitemap/)
  assert.match(judgeSitemapRobots({ ...ok, robotsTxt: 'User-agent: *\nDisallow: /\nSitemap: https://a.example/sitemap.xml\n' }).detail[0], /Disallow/)
  assert.match(judgeSitemapRobots({ ...ok, sitemapXml: `<urlset><url><loc>/</loc></url></urlset>` }).detail[0], /절대 주소/)
})

test('C61: 찍어내는 쪽 소스(gen-pages pageSource)가 viewport 내보내기로 viewport-fit·interactive-widget 을 낸다', async () => {
  const { pageSource } = await import('../stamp/gen-pages.mjs')
  const src = pageSource({ route: '/', leaves: [], hero: false, legal: null, footer: null, bar: null })
  assert.match(src, /import type \{ Metadata, Viewport \} from "next"/)
  assert.match(src, /export const viewport: Viewport = \{ viewportFit: "cover", interactiveWidget: "resizes-content" \}/)
})

// ─── Lighthouse 결과 읽기(가짜 LHR) ───

const lhr = ({ perf = 0.98, seo = 1, a11y = 1, lcp = 1200, cls = 0, bf = { score: 1, scoreDisplayMode: 'binary' }, element = null, tbt = 80, scriptBytes = 90_000, agentic = 1, agenticFailed = [] } = {}) => ({
  categories: { performance: { score: perf, auditRefs: [] }, seo: { score: seo, auditRefs: [] }, accessibility: { score: a11y, auditRefs: [] }, ...(agentic === null ? {} : { 'agentic-browsing': { score: agentic, auditRefs: ['agent-accessibility-tree', 'llms-txt', 'ard-schema'].map((id) => ({ id, weight: 1 })) } }) },
  audits: {
    'largest-contentful-paint': { numericValue: lcp },
    'cumulative-layout-shift': { numericValue: cls },
    'bf-cache': bf,
    'total-blocking-time': { numericValue: tbt },
    'resource-summary': { details: { items: [{ resourceType: 'total', transferSize: scriptBytes + 50_000 }, { resourceType: 'script', requestCount: 6, transferSize: scriptBytes }, { resourceType: 'image', transferSize: 50_000 }] } },
    ...Object.fromEntries(['agent-accessibility-tree', 'llms-txt', 'ard-schema'].map((id) => [id, { score: agenticFailed.includes(id) ? 0 : 1 }])),
    'lcp-breakdown-insight': { details: element ? { type: 'list', items: [{ type: 'table', items: [{ node: { type: 'node', selector: element.selector, snippet: element.snippet } }] }] } : { type: 'list', items: [] } },
  },
})

// FINAL-WF P2: 느린 PC(benchmarkIndex < 2000)에서 lh-perf·tbt 가 문턱 미달이면 그 행만 2번 더 재서 중앙값으로 판정한다. 가짜 LHR — 실제 Lighthouse 는 돌리지 않는다.
const withBench = (b, o = {}) => ({ ...lhr(o), environment: { benchmarkIndex: b } })
const measureOf = (l) => ({ lhr: l, rows: lhrToChecks(l, '/') })
const queue = (...lhrs) => { const calls = { n: 0 }; return { calls, fn: async () => { const l = lhrs[calls.n++]; if (l instanceof Error) throw l; return measureOf(l) } } }

test('settlePerfOnSlowPc: 느린 PC 에서 lh-perf 미달이면 두 번 더 재서 중앙값으로 판정 — 중앙값이 통과면 통과(문턱은 그대로 90)', async () => {
  const q = queue(withBench(1500, { perf: 0.93, tbt: 90 }), withBench(1600, { perf: 0.95, tbt: 90 }))
  const s = await settlePerfOnSlowPc(measureOf(withBench(1500, { perf: 0.69, tbt: 90 })), q.fn)
  assert.equal(q.calls.n, 2, '2번 더 잰다')
  assert.equal(s.remeasured, 2)
  const perf = s.rows.find((c) => c.id === 'lh-perf')
  assert.equal(perf.status, 'pass')
  assert.equal(perf.value, 93, '69·93·95 의 중앙값')
  assert.equal(THRESHOLDS['lh-perf'], 90, '문턱은 바뀌지 않는다')
})

test('settlePerfOnSlowPc: 그래도 미달이면 실패 줄 detail 에 benchmarkIndex 문구가 붙고 tbt 도 같다 · 다른 행은 첫 측정 그대로', async () => {
  const q = queue(withBench(1500, { perf: 0.7, tbt: 500 }), withBench(1500, { perf: 0.72, tbt: 450 }))
  const first = measureOf(withBench(1500, { perf: 0.68, tbt: 600 }))
  const s = await settlePerfOnSlowPc(first, q.fn)
  const perf = s.rows.find((c) => c.id === 'lh-perf')
  assert.equal(perf.status, 'fail')
  assert.match(perf.detail.join(' '), /이 PC 의 측정 속도 benchmarkIndex 1500 — 느린 PC 에서는 점수가 낮게 나온다/)
  assert.match(perf.detail.join(' '), /3회 측정 중앙값/)
  const tbt = s.rows.find((c) => c.id === 'tbt')
  assert.equal(tbt.status, 'warn')
  assert.equal(tbt.value, 500, '600·500·450 의 중앙값')
  assert.match(tbt.detail.join(' '), /benchmarkIndex 1500/)
  for (const id of ['lcp', 'cls', 'lh-seo']) assert.deepEqual(s.rows.find((c) => c.id === id), first.rows.find((c) => c.id === id), `${id} 는 첫 측정 그대로`)
})

test('settlePerfOnSlowPc: 빠른 PC(≥ 2000)·통과·benchmarkIndex 없음이면 다시 재지 않고 문구도 붙이지 않는다(음성 대조) · 재측정이 ToolFailure 여도 첫 값으로 판정', async () => {
  for (const [bench, perf] of [[2900, 0.69], [1500, 0.98], [null, 0.69]]) {
    const q = queue(withBench(1500, {}), withBench(1500, {}))
    const l = bench === null ? lhr({ perf }) : withBench(bench, { perf })
    const first = measureOf(l)
    const s = await settlePerfOnSlowPc(first, q.fn)
    assert.equal(q.calls.n, 0, `bench=${bench} perf=${perf}`)
    assert.equal(s.remeasured, 0)
    assert.deepEqual(s.rows, first.rows)
    assert.doesNotMatch(JSON.stringify(s.rows), /느린 PC/)
  }
  const q = queue(new ToolFailure('x'), new ToolFailure('y'))
  const s = await settlePerfOnSlowPc(measureOf(withBench(1000, { perf: 0.6 })), q.fn)
  assert.equal(s.rows.find((c) => c.id === 'lh-perf').status, 'fail')
  assert.match(s.rows.find((c) => c.id === 'lh-perf').detail.join(' '), /1회 측정 중앙값/)
})

test('lhrToChecks: 점수·LCP·CLS·bf-cache 문턱, LCP 요소를 이름으로 댄다', () => {
  const good = lhrToChecks(lhr(), '/')
  assert.deepEqual(good.map((c) => `${c.id}:${c.status}`), ['lh-perf:pass', 'lh-seo:pass', 'lcp:pass', 'cls:pass', 'lh-a11y:pass', 'js-budget:pass', 'tbt:pass', 'agentic-browsing:pass', 'bf-cache:pass'])
  const heavy = lhrToChecks(lhr({ perf: 0.61, lcp: 9000, element: { selector: 'main > img', snippet: '<img src="/hero-big.jpg">' } }), '/heavy-hero')
  assert.equal(heavy.find((c) => c.id === 'lh-perf').status, 'fail')
  assert.equal(heavy.find((c) => c.id === 'lh-perf').value, 61)
  assert.match(heavy.find((c) => c.id === 'lcp').detail[0], /img/)
  assert.equal(heavy.find((c) => c.id === 'lcp').route, '/heavy-hero')
  assert.equal(lhrToChecks(lhr({ cls: 0.31 }), '/s').find((c) => c.id === 'cls').status, 'fail')
  assert.equal(lhrToChecks(lhr({ a11y: 0.9 }), '/').find((c) => c.id === 'lh-a11y').status, 'warn', '접근성 점수는 참고 — 경고만')
  assert.equal(lhrToChecks(lhr({ bf: { score: 0, scoreDisplayMode: 'binary', details: { items: [{ reason: 'UnloadHandler' }] } } }), '/u').find((c) => c.id === 'bf-cache').detail[0], 'UnloadHandler')
  assert.equal(lhrToChecks(lhr(), '/login', { authRoute: true }).find((c) => c.id === 'bf-cache').status, 'na')
  const nx = lhrToChecks(lhr({ seo: 0.66 }), '/booking/complete', { noindex: true }).find((c) => c.id === 'lh-seo')
  assert.equal(nx.status, 'na', 'noindex 쪽은 SEO 점수를 안 잰다(is-crawlable 이 의도대로 실패)')
  assert.equal(judgeExit([{ id: 'lh-seo', level: 'must', status: 'na' }]), 0)
  assert.match(lhrToChecks(lhr({ lcp: 9000, element: { selector: 'p', snippet: '<p>' } }), '/').find((c) => c.id === 'lcp').detail.join(' '), /요소/)
  assert.throws(() => lhrToChecks({ categories: { performance: { score: null } }, audits: {}, runtimeError: { code: 'NO_FCP', message: 'x' } }, '/'), ToolFailure)
  assert.throws(() => lhrToChecks(lhr({ bf: { scoreDisplayMode: 'error', errorMessage: 'boom' } }), '/'), /bf-cache/)
})

test('lhrToChecks(FV1 5.10): js-budget(첫 화면 JS 전송량 ≤ 170 KB) · tbt(≤ 200 ms) · agentic-browsing(Lighthouse 범주 — 참고) 는 should 라 경고만 하고 종료 코드를 안 바꾼다', () => {
  const pick = (r, id) => r.find((c) => c.id === id)
  const heavy = lhrToChecks(lhr({ scriptBytes: 260 * 1024, tbt: 640 }), '/')
  assert.equal(pick(heavy, 'js-budget').status, 'warn')
  assert.equal(pick(heavy, 'js-budget').value, 260)
  assert.match(pick(heavy, 'js-budget').detail.join(' '), /260 KB/)
  assert.equal(pick(heavy, 'tbt').status, 'warn')
  assert.equal(pick(heavy, 'tbt').value, 640)
  assert.equal(judgeExit(heavy), 0, 'should 행의 경고는 종료 코드를 바꾸지 않는다')
  // 문턱 바로 위·아래: 170 KB = 170×1024 바이트
  assert.equal(pick(lhrToChecks(lhr({ scriptBytes: 170 * 1024 }), '/'), 'js-budget').status, 'pass')
  assert.equal(pick(lhrToChecks(lhr({ scriptBytes: 170 * 1024 + 1 }), '/'), 'js-budget').status, 'warn')
  assert.equal(pick(lhrToChecks(lhr({ tbt: 200 }), '/'), 'tbt').status, 'pass')
  assert.equal(pick(lhrToChecks(lhr({ tbt: 201 }), '/'), 'tbt').status, 'warn')
  // 감사 범주가 없거나 값이 없으면 통과가 아니라 na (잰 것이 없다)
  assert.equal(pick(lhrToChecks({ ...lhr(), audits: { ...lhr().audits, 'total-blocking-time': undefined } }, '/'), 'tbt').status, 'na')
  assert.equal(pick(lhrToChecks({ ...lhr(), audits: { ...lhr().audits, 'resource-summary': undefined } }, '/'), 'js-budget').status, 'na')
  const noCat = pick(lhrToChecks(lhr({ agentic: null }), '/'), 'agentic-browsing')
  assert.equal(noCat.status, 'na')
  assert.match(noCat.detail.join(' '), /범주/)
  const ag = pick(lhrToChecks(lhr({ agentic: 0.67, agenticFailed: ['llms-txt', 'ard-schema'] }), '/'), 'agentic-browsing')
  assert.equal(ag.status, 'warn')
  assert.equal(ag.value, 67)
  assert.match(ag.detail.join(' '), /llms-txt/)
  // 인증 화면이어도 js-budget·tbt 는 잰다(bf-cache 만 na)
  assert.equal(pick(lhrToChecks(lhr(), '/login', { authRoute: true }), 'js-budget').status, 'pass')
})

test('confirmBfCacheRow(FV1 5.10): Lighthouse 가 「복원 도중 이동이 취소됨」 이유만 대면 직접 복원 시험으로 가린다 — 통과하면 pass, 아니면 그 이유를 붙여 실패, 다른 이유는 시험하지 않고 그대로 실패', async () => {
  const cancelled = { id: 'bf-cache', level: 'must', status: 'fail', route: '/', detail: ['Navigation cancelled while restoring from back/forward cache.'] }
  let calls = 0
  const okProbe = async () => { calls++; return { ok: true, restored: 2, tries: 3, reasons: ['TimeoutPuttingInCache'] } }
  const pass = await confirmBfCacheRow(cancelled, { route: '/', url: 'http://x/', probe: okProbe })
  assert.equal(pass.status, 'pass')
  assert.equal(calls, 1)
  assert.match(pass.detail.join(' '), /3번 중 2번 복원/)
  assert.equal(pass.route, '/')

  const notOk = await confirmBfCacheRow(cancelled, { route: '/', url: 'http://x/', probe: async () => ({ ok: false, restored: 1, tries: 4, reasons: ['UnloadHandlerExistsInMainFrame'] }) })
  assert.equal(notOk.status, 'fail', '쪽이 고쳐야 하는 이유가 나왔거나 복원이 모자라면 통과가 아니다')
  assert.match(notOk.detail.join(' '), /직접 확인: 4번 중 1번 복원/)
  assert.match(notOk.detail.join(' '), /UnloadHandlerExistsInMainFrame/)

  const unload = { ...cancelled, detail: ['UnloadHandlerExistsInMainFrame'] }
  calls = 0
  const same = await confirmBfCacheRow(unload, { route: '/', url: 'http://x/', probe: okProbe })
  assert.equal(same, unload, '진짜 막는 이유(unload 등)는 직접 시험하지 않고 그대로 실패')
  assert.equal(calls, 0)
  const mixed = { ...cancelled, detail: ['Navigation cancelled while restoring from back/forward cache.', 'UnloadHandlerExistsInMainFrame'] }
  assert.equal(await confirmBfCacheRow(mixed, { route: '/', url: 'http://x/', probe: okProbe }), mixed, '취소 말고 다른 이유가 함께 있으면 시험하지 않는다')
  const passRow = { ...cancelled, status: 'pass', detail: [] }
  assert.equal(await confirmBfCacheRow(passRow, { route: '/', url: 'http://x/', probe: okProbe }), passRow)

  const broken = await confirmBfCacheRow(cancelled, { route: '/', url: 'http://x/', probe: async () => { throw new Error('Chrome 없음') } })
  assert.equal(broken.status, 'fail', '직접 시험이 못 돌면 Lighthouse 판정을 지우지 않는다')
  assert.match(broken.detail.join(' '), /직접 확인 못 함: Chrome 없음/)
})

test('lhrEnvironment: 측정 환경(benchmarkIndex·throttling)과 LCP 구간을 결과에 남기고, LCP 실패 행에도 환경을 적는다(PERF2)', () => {
  const base = lhr({ lcp: 4400, element: { selector: 'h2', snippet: '<h2>' } })
  const full = {
    ...base,
    environment: { benchmarkIndex: 3585, networkUserAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022))' },
    configSettings: { throttlingMethod: 'simulate', throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 } },
    audits: {
      ...base.audits,
      'first-contentful-paint': { numericValue: 1274.4 },
      'lcp-breakdown-insight': { details: { type: 'list', items: [{ type: 'table', items: [{ subpart: 'timeToFirstByte', duration: 17.6 }, { subpart: 'elementRenderDelay', duration: 485.2 }] }] } },
    },
  }
  const e = lhrEnvironment(full, '/')
  assert.deepEqual(e, { route: '/', benchmarkIndex: 3585, networkUserAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022))', throttlingMethod: 'simulate', cpuSlowdownMultiplier: 4, rttMs: 150, throughputKbps: 1638.4, lcpMs: 4400, fcpMs: 1274, lcpPhases: { timeToFirstByte: 18, elementRenderDelay: 485 } })
  const failRow = lhrToChecks(full, '/').find((c) => c.id === 'lcp')
  assert.equal(failRow.status, 'fail')
  assert.match(failRow.detail.join(' '), /benchmarkIndex 3585 · simulate · CPU 4배 감속/)
  assert.doesNotMatch(lhrToChecks(lhr(), '/').find((c) => c.id === 'lcp').detail.join(' '), /benchmarkIndex/, 'LCP 가 통과면 환경 줄은 안 붙는다')
  const none = lhrEnvironment(lhr(), '/x') // 환경 정보가 없는 LHR 도 던지지 않는다
  assert.equal(none.benchmarkIndex, null)
  assert.deepEqual(none.lcpPhases, {})
})

test('describeCheck: 레시피·쪽 이름을 대고, 값·문턱·이유를 한 줄로', () => {
  const s = describeCheck({ id: 'lh-perf', route: '/pricing', value: 72, threshold: 90, detail: ['LCP 4100 ms · LCP 요소 img.hero'] }, { recipe: 'r3-woodblock' })
  assert.match(s, /^\[r3-woodblock \/pricing\] lh-perf 72 \(문턱 90\) — LCP 4100 ms/)
})

// ─── 픽스처 위의 사이트 수준 검사 ───

test('좋은 사이트: 사이트 수준 검사 전부 통과(종료 0)', async () => {
  const s = await site(null)
  try {
    const r = await run(s)
    assert.equal(r.exit, 0, JSON.stringify(r.checks.filter((c) => c.status !== 'pass')))
    assert.deepEqual(r.checks.map((c) => c.id).sort(), ['analytics-consent', 'error-pages', 'facts-empty', 'favicon-set', 'legal-routes', 'og-image', 'page-structure', 'routes-open', 'security-headers', 'sitemap-robots', 'viewport-fit'])
    assert.ok(r.checks.every((c) => c.status === 'pass'))
    assert.equal(r.summary.lighthouse, '0/4', 'lhRoutes none — 잰 쪽 0/4')
  } finally { await s.close() }
})

// 음성 대조: 깨진 값 하나 → 그 검사 하나만 실패한다. no-analytics 는 실제 Chrome 이 필요해 ops-gate.browser.test.mjs.
const NEG = [
  ['og-size', 'og-image'], ['og-relative', 'og-image'], ['og-missing', 'og-image'],
  ['csp-unsafe-inline', 'security-headers'], ['csp-missing-hash', 'security-headers'], ['csp-none', 'security-headers'], ['no-base-uri', 'security-headers'], ['no-object-src', 'security-headers'], ['no-frame-ancestors', 'security-headers'], ['no-nosniff', 'security-headers'], ['no-referrer-policy', 'security-headers'], ['no-permissions-policy', 'security-headers'],
  ['error-default', 'error-pages'], ['error-soft-200', 'error-pages'], ['no-boundary', 'error-pages'],
  ['sitemap-missing-route', 'sitemap-robots'], ['sitemap-noindex', 'sitemap-robots'], ['robots-no-sitemap', 'sitemap-robots'],
  ['legal-404', 'legal-routes'], ['no-h1', 'page-structure'], ['two-h1', 'page-structure'], ['wrong-lang', 'page-structure'], ['no-title', 'page-structure'], ['no-jsonld', 'page-structure'], ['no-manifest', 'favicon-set'], ['apple-size', 'favicon-set'], ['no-ico-16', 'favicon-set'], ['no-viewport-fit', 'viewport-fit'],
]
for (const [broken, id] of NEG) {
  test(`음성 대조 ${broken}: ${id} 만 실패한다`, async () => {
    const s = await site(broken)
    try {
      // 법정 쪽이 404 인 픽스처는 그 쪽을 routes 에 주지 않는다(routes-open 이 따로 잡는 것이라 legal-routes 만 보려면)
      const r = await run(s, broken === 'legal-404' ? { routes: ['/', '/pricing', '/thanks'] } : {})
      // 잘못된 lang 은 사이트 셸(404 쪽)의 lang 도 같이 틀려 error-pages 도 잡는다 — 그 둘만이어야 한다
      assert.deepEqual(failing(r).sort(), broken === 'wrong-lang' ? ['error-pages', 'page-structure'] : [id], JSON.stringify(r.checks.filter((c) => c.status !== 'pass')))
      assert.equal(r.exit, 1)
      assert.ok(r.checks.find((c) => c.id === id).detail.length > 0, '이유를 적는다')
    } finally { await s.close() }
  })
}

test('facts-empty: site.json 에 「확인 필요」가 남으면 그 경로를 대고 실패 · site.json 이 없으면 na(naOk)', async () => {
  const s = await site(null)
  try {
    const bad = await run(s, { siteJson: { locale: 'ko', business: { phone: '확인 필요' }, legal: { privacy: { officer: { name: 'To be confirmed' } } } } })
    assert.deepEqual(failing(bad), ['facts-empty'])
    assert.match(bad.checks.find((c) => c.id === 'facts-empty').detail[0], /business\.phone/)
    const none = await run(s, { siteJson: null })
    assert.equal(none.checks.find((c) => c.id === 'facts-empty').status, 'na')
    assert.equal(none.exit, 0)
  } finally { await s.close() }
})

// 제품(completion "product")은 nonce — 원형 completion 으로 규칙이 갈린다. 픽스처는 csp: 'nonce' 로 띄우고, 저장소 원형 saas(product)로 잰다(법정 쪽은 픽스처가 가진 /privacy 로).
const PRODUCT = { archetype: 'saas', legalRoutes: ['/privacy'] }
const NEG_NONCE = [['csp-no-nonce', 'security-headers'], ['csp-static-nonce', 'security-headers']]
test('제품 원형(completion product): nonce 를 쓰는 좋은 사이트는 통과한다', async () => {
  const s = await site(null, { csp: 'nonce' })
  try {
    const r = await run(s, PRODUCT)
    assert.equal(r.checks.find((c) => c.id === 'security-headers').status, 'pass', JSON.stringify(r.checks.find((c) => c.id === 'security-headers')))
  } finally { await s.close() }
})
for (const [broken, id] of NEG_NONCE) {
  test(`음성 대조 ${broken}(제품 원형, nonce): ${id} 만 실패한다`, async () => {
    const s = await site(broken, { csp: 'nonce' })
    try {
      const r = await run(s, PRODUCT)
      assert.deepEqual(failing(r), [id], JSON.stringify(r.checks.filter((c) => c.status !== 'pass')))
    } finally { await s.close() }
  })
}
test('규칙은 completion 으로 갈린다: 해시 사이트를 제품 원형으로 재면 nonce 가 없어 실패, 정적 앞면임을 밝히면(security: hash) 통과 — 반대로 nonce 사이트를 정적 원형으로 재면 인라인 script 가 해시에 없어 실패', async () => {
  const hashSite = await site(null, { csp: 'hash' })
  try {
    assert.deepEqual(failing(await run(hashSite, PRODUCT)), ['security-headers'], '제품 원형은 nonce 를 요구한다')
    assert.deepEqual(failing(await run(hashSite, { ...PRODUCT, security: 'hash' })), [], '정적 앞면(07-qa 어댑터의 기본)')
  } finally { await hashSite.close() }
  const nonceSite = await site(null, { csp: 'nonce' })
  try {
    assert.deepEqual(failing(await run(nonceSite)), ['security-headers'], "정적 원형(local)에 nonce 정책은 해시가 없어 브라우저가 인라인 script 를 막는다")
  } finally { await nonceSite.close() }
})

test('NEG 표는 깨짐 값을 하나도 빠뜨리지 않는다(브라우저 시험이 맡는 것만 제외)', () => {
  const browserOnly = ['track-before-consent', 'no-pageview', 'pageview-twice', 'no-analytics']
  assert.deepEqual([...NEG.map(([b]) => b), ...NEG_NONCE.map(([b]) => b), ...browserOnly].sort(), [...BROKEN].sort())
})

test('sitemap 이 법정 쪽을 빼도 색인 쪽이 routes 에 있으면 잡는다 / routes 밖 쪽은 요구하지 않는다', async () => {
  const s = await site('sitemap-missing-route')
  try {
    const only = await run(s, { routes: ['/', '/privacy'] })
    assert.equal(only.exit, 0, '/pricing 을 routes 에 안 주면 sitemap 에 없어도 요구하지 않는다')
  } finally { await s.close() }
})

test('routes 에 404 쪽이 있으면 routes-open 이 그 쪽 이름을 대고 실패한다', async () => {
  const s = await site(null)
  try {
    const r = await run(s, { routes: ['/', '/nope'] })
    assert.deepEqual(failing(r), ['routes-open'])
    assert.match(r.checks.find((c) => c.id === 'routes-open').detail[0], /\/nope → 404/)
  } finally { await s.close() }
})

test('--site 없이는 500 경계를 못 재므로 warn 으로 남긴다(통과가 아니다)', async () => {
  const s = await site('no-boundary')
  try {
    const r = await run(s, { siteDir: null })
    const ep = r.checks.find((c) => c.id === 'error-pages')
    assert.equal(ep.status, 'warn')
    assert.match(ep.detail[0], /500 경계/)
    assert.equal(r.exit, 0)
  } finally { await s.close() }
})

test('archetype 도 legalRoutes 도 없으면 도구 실패(ToolFailure)', async () => {
  const s = await site(null)
  try { await assert.rejects(() => opsGate(s.origin, { routes: ['/'], lhRoutes: 'none', consentProbe: okConsent }), ToolFailure) } finally { await s.close() }
})

test('없는 원형 id 는 도구 실패', async () => {
  const s = await site(null)
  try { await assert.rejects(() => run(s, { archetype: 'no-such-archetype' }), /원형 파일이 없다/) } finally { await s.close() }
})

test('홈이 안 열리는 주소는 도구 실패다 — 판정 실패가 아니다', async () => {
  await assert.rejects(() => opsGate('http://127.0.0.1:1', { routes: ['/'], archetype: 'local', lhRoutes: 'none', consentProbe: okConsent }), ToolFailure)
})

// ─── 후보 어댑터 ───

function candDir(pages = { '/': {}, '/pricing': {}, '/privacy': {} }, locale = 'ko') {
  const runDir = mkdtempSync(join(tmpdir(), 'p4t1-run-'))
  const dir = join(runDir, 'cand-a')
  mkdirSync(join(dir, 'site', 'content'), { recursive: true })
  mkdirSync(join(dir, 'site', 'app'), { recursive: true })
  for (const f of ['error', 'global-error']) writeFileSync(join(dir, 'site', 'app', `${f}.tsx`), '"use client"\nexport default function X() { return null }\n')
  writeFileSync(join(dir, 'site', 'content', 'site.json'), JSON.stringify({ locale, pages, legal: { privacy: {} } }))
  writeFileSync(join(dir, 'candidate.json'), JSON.stringify({ id: 'cand-a', archetype: 'local', recipe: 'r1-measure', blockers: [] }))
  return { runDir, dir }
}

test('opsGateForCandidate: qa.mjs 게이트 기록 모양 — 통과·판정 실패·도구 실패, 결과 파일은 07-qa/ops-gate.json', async () => {
  const { runDir, dir } = candDir()
  try {
    const seen = []
    const pass = await opsGateForCandidate(runDir, { id: 'cand-a' }, { origin: 'http://o', runOps: async (o, opts) => { seen.push({ o, opts }); return { checks: [{ id: 'lh-perf', level: 'must', status: 'pass', route: '/' }], exit: 0, summary: { pass: 1, fail: 0, warn: 0, na: 0, lighthouse: '1/3' } } } })
    assert.deepEqual({ id: pass.id, tool: pass.tool, exit: pass.exit, verdict: pass.verdict, toolFailure: pass.toolFailure, resultFile: pass.resultFile }, { id: 'ops', tool: 'ops', exit: 0, verdict: 'pass', toolFailure: false, resultFile: '07-qa/ops-gate.json' })
    assert.match(pass.note, /Lighthouse 잰 쪽 1\/3/)
    assert.deepEqual(seen[0].opts.routes, ['/', '/pricing', '/privacy'])
    assert.equal(seen[0].opts.archetype, 'local')
    assert.equal(seen[0].opts.recipe, 'r1-measure')
    assert.equal(seen[0].opts.siteDir, join(dir, 'site'))
    assert.equal(seen[0].opts.locale, 'ko')
    const file = join(dir, '07-qa', 'ops-gate.json')
    assert.ok(existsSync(file))
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).candidate, 'cand-a')

    const fail = await opsGateForCandidate(runDir, { id: 'cand-a' }, { origin: 'http://o', runOps: async () => ({ checks: [{ id: 'lh-perf', level: 'must', status: 'fail', route: '/pricing', value: 72, threshold: 90, detail: ['LCP 요소 img'] }, { id: 'cls', level: 'must', status: 'pass' }], exit: 1, summary: { lighthouse: '1/3' } }) })
    assert.equal(fail.verdict, 'fail')
    assert.equal(fail.exit, 1)
    assert.equal(fail.toolFailure, false)
    assert.equal(fail.problems.length, 1)
    assert.match(fail.problems[0], /^\[r1-measure \/pricing\] lh-perf 72/)
    assert.ok(existsSync(file))

    const tool = await opsGateForCandidate(runDir, { id: 'cand-a' }, { origin: 'http://o', runOps: async () => { throw new ToolFailure('Chrome 을 못 띄웠다') } })
    assert.equal(tool.verdict, 'tool')
    assert.equal(tool.toolFailure, true)
    assert.equal(tool.exit, 1)
    assert.match(tool.note, /^도구 실패: Chrome/)
    assert.equal(existsSync(file), false, '도구 실패면 이전 결과 파일도 지운다')
    assert.equal(tool.resultFile, undefined)

    await assert.rejects(() => opsGateForCandidate(runDir, { id: 'cand-a' }, { origin: 'http://o', runOps: async () => { throw new TypeError('버그') } }), TypeError)
  } finally { rmSync(runDir, { recursive: true, force: true }) }
})

test('opsGateForCandidate: site.json 이 없으면 도구 실패 기록', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'p4t1-run-'))
  try {
    const r = await opsGateForCandidate(runDir, { id: 'nope' }, { origin: 'http://o', runOps: async () => { throw new Error('부르면 안 된다') } })
    assert.equal(r.verdict, 'tool')
    assert.match(r.note, /site\.json 없음/)
  } finally { rmSync(runDir, { recursive: true, force: true }) }
})

test('opsGateForCandidate: 진짜 opsGate 로 픽스처 사이트를 재고 법정 쪽 요구는 원형에서 읽는다', async () => {
  const { runDir, dir } = candDir({ '/': {}, '/pricing': {}, '/privacy': {}, '/thanks': {} })
  const s = await site('no-manifest')
  try {
    const r = await opsGateForCandidate(runDir, { id: 'cand-a' }, { origin: s.origin, lhRoutes: 'none', consentProbe: okConsent })
    assert.equal(r.verdict, 'fail')
    assert.equal(r.problems.length, 1)
    assert.match(r.problems[0], /^\[r1-measure\] favicon-set/)
    const out = JSON.parse(readFileSync(join(dir, '07-qa', 'ops-gate.json'), 'utf8'))
    assert.equal(out.recipe, 'r1-measure')
    assert.equal(out.archetype, 'local')
    assert.equal(out.checks.find((c) => c.id === 'legal-routes').status, 'pass')
  } finally { await s.close(); rmSync(runDir, { recursive: true, force: true }) }
})

// ─── CLI 종료 코드(비동기 spawn — 프로세스 안 서버와 spawnSync 를 섞지 않는다) ───

const cli = (args) => new Promise((done) => {
  const child = spawn(process.execPath, [GATE, ...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let stdout = '', stderr = ''
  child.stdout.on('data', (d) => { stdout += d })
  child.stderr.on('data', (d) => { stderr += d })
  child.on('close', (code) => done({ code, stdout, stderr }))
})

test('CLI: 열리지 않는 주소는 종료 1 + 「도구 실패:」 + 결과 파일 없음(이전 파일도 지운다)', async () => {
  const out = mkdtempSync(join(tmpdir(), 'p4t1-cli-'))
  try {
    writeFileSync(join(out, 'ops-gate.json'), '{"old":true}')
    const r = await cli(['http://127.0.0.1:1', '--out', out, '--archetype', 'local', '--lh-routes', 'none'])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /도구 실패:/)
    assert.equal(existsSync(join(out, 'ops-gate.json')), false)
  } finally { rmSync(out, { recursive: true, force: true }) }
})

test('CLI: 인자 오류는 종료 2(origin 없음·--out 없음·http 아님·잘못된 form-factor)', async () => {
  assert.equal((await cli([])).code, 2)
  assert.equal((await cli(['http://127.0.0.1:1'])).code, 2)
  assert.equal((await cli(['ftp://x', '--out', 'x'])).code, 2)
  assert.equal((await cli(['http://127.0.0.1:1', '--out', 'x', '--form-factor', 'tablet'])).code, 2)
})

test('CLI: --archetype 도 --site 도 없으면 도구 실패(법정 쪽 요구를 모른다)', async () => {
  const out = mkdtempSync(join(tmpdir(), 'p4t1-cli-'))
  try {
    const r = await cli(['http://127.0.0.1:1', '--out', out])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /도구 실패: --archetype/)
  } finally { rmSync(out, { recursive: true, force: true }) }
})
