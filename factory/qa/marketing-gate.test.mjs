// 마케팅 관문(marketing-gate.mjs) 시험. 실행: node --test --test-force-exit --test-timeout=400000 factory/qa/marketing-gate.test.mjs
// ① 규칙표·음성 대조 표 무결성(브라우저 없음) ② 순수 판정 ③ 소스 검사 ④ 브라우저: 통과 페이지 하나 + 나쁜 페이지 전부(규칙마다 그 규칙만 실패) ⑤ CLI 종료 코드.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startChrome, connect } from './cdp.mjs'
import { RULES, THRESHOLDS, judge, failingIds, gateOnPage, galleryRef, sourceCheck } from './marketing-gate.mjs'
import { MUTATIONS, PASSING_VARIANTS, GOOD, mutate, writeFixtures } from './marketing-fixtures.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const tool = join(here, 'marketing-gate.mjs')
const run = (args) => new Promise((res) => {
  let err = '', out = ''
  const p = spawn(process.execPath, [tool, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { err += d })
  p.on('exit', (code) => res({ code, err, out }))
})
const fileUrl = (f) => pathToFileURL(f).href

// ── ① 표 무결성 ──
test('규칙표: id 유일 · 필드 · 근거(factory-rules.md §22) · 21개', () => {
  assert.equal(RULES.length, 21)
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length)
  for (const r of RULES) {
    assert.match(r.level, /^(must|should)$/, r.id)
    assert.match(r.src, /factory-rules\.md §22/, `${r.id} 근거`)
    assert.ok(r.what && r.how, `${r.id} 무엇·어떻게`)
  }
})

test('음성 대조 표: 규칙마다 나쁜 페이지가 하나 이상 있고 기대 상태가 규칙 수준과 맞다', () => {
  for (const r of RULES) {
    const ms = MUTATIONS.filter((m) => m.rule === r.id)
    assert.ok(ms.length >= 1, `${r.id} 음성 대조 없음`)
    for (const m of ms) assert.equal(m.expect, r.level === 'must' ? 'fail' : 'warn', m.name)
  }
  assert.equal(new Set(MUTATIONS.map((m) => m.name)).size, MUTATIONS.length)
})

test('mutate: 고칠 글이 없으면 던진다(좋은 페이지가 바뀌어도 대조가 조용히 무뎌지지 않는다)', () => {
  assert.throws(() => mutate('<p>x</p>', [['없는 글', 'y']], 't'), /고칠 글이 없다/)
  assert.equal(mutate('a b', [[/b/, '$&$&']], 't'), 'a $&$&')
})

test('모든 음성 대조가 좋은 페이지와 실제로 다른 글을 만든다', () => {
  const good = readFileSync(GOOD, 'utf8')
  for (const m of MUTATIONS) assert.notEqual(mutate(good, m.edit, m.name), good, m.name)
})

// ── ② 순수 판정 ──
const EMPTY = {
  text: 0, fakeButtons: [], names: [], priceEls: [], imgPrices: [], priceTables: [], krw: false, vat: false, total: null, extra: [], optIn: [], pairs: [], flows: [], countdowns: [], looseCounters: [], clockTexts: [], modals: [],
  ld: { parseErrors: 0, values: [], hosts: [], micro: [] }, guarantees: [], escrow: [], replies: [], ratingAsk: [], nextActions: [],
}
const by = (rules, id) => rules.find((r) => r.id === id)

test('judge: 잴 것이 없으면 통과가 아니라 na(measured 0) — 첫 화면 모달만 늘 잰다', () => {
  const rules = judge(EMPTY)
  assert.equal(rules.length, RULES.length)
  for (const r of rules) assert.equal(r.status, r.id === 'first-screen-modal' ? 'pass' : 'na', r.id)
  assert.deepEqual(failingIds(rules), [])
})

test('judge: 문턱 경계 — 크기 비 0.85 는 통과, 0.84 는 실패', () => {
  const pair = (w) => ({ via: 'marker', decline: { name: '해지', w, h: 48, font: 16, fill: 1, labelContrast: 15 }, primary: { name: '계속', w: 100, h: 48, font: 16, fill: 1, labelContrast: 15 } })
  assert.equal(by(judge({ ...EMPTY, pairs: [pair(85)] }), 'decline-parity').status, 'pass')
  assert.equal(by(judge({ ...EMPTY, pairs: [pair(84)] }), 'decline-parity').status, 'fail')
  assert.equal(THRESHOLDS.sizeRatioMin, 0.85)
})

test('judge: 가입 기준이 없으면 해지 비교를 못 한 것으로 실패시킨다(조용히 통과 금지)', () => {
  const f = { ...EMPTY, flows: [{ flow: 'cancel', steps: '3', step: '1' }], cancelWalk: { clicks: 2, stepsSeen: [1, 2, 3], missingDecline: [], reachedEnd: true } }
  assert.equal(by(judge(f), 'cancel-steps').status, 'fail')
  assert.equal(by(judge({ ...f, signupSteps: 3 }), 'cancel-steps').status, 'pass')
  assert.equal(by(judge({ ...f, signupSteps: 2 }), 'cancel-steps').status, 'fail')
})

test('judge: 카운트다운 시각이 늘어나면 실패, 줄어들면 통과', () => {
  const base = { ...EMPTY, countdowns: [{ endsAt: '2030-01-01T00:00:00.000Z', text: '01:00:00' }] }
  assert.equal(by(judge({ ...base, clockSamples: [['01:00:00'], ['00:59:58'], ['00:59:57']] }), 'countdown-real').status, 'pass')
  assert.equal(by(judge({ ...base, clockSamples: [['01:00:00'], ['01:00:02']] }), 'countdown-real').status, 'fail')
})

test('judge: JSON-LD 값이 화면에 없으면 실패, 별점이 조직에 달리면 실패, Product 는 통과', () => {
  const ld = (values, hosts) => ({ ...EMPTY, ld: { parseErrors: 0, micro: [], values, hosts } })
  assert.equal(by(judge(ld([{ key: 'price', value: '8900', type: 'Offer', found: false }], [])), 'jsonld-visible').status, 'fail')
  assert.equal(by(judge(ld([{ key: 'price', value: '9900', type: 'Offer', found: true }], [])), 'jsonld-visible').status, 'pass')
  assert.equal(by(judge(ld([], [{ prop: 'aggregateRating', hostType: 'Organization' }])), 'no-self-rating').status, 'fail')
  assert.equal(by(judge(ld([], [{ prop: 'aggregateRating', hostType: 'Product' }])), 'no-self-rating').status, 'pass')
  assert.equal(by(judge({ ...EMPTY, ld: { parseErrors: 1, micro: [], values: [], hosts: [] } }), 'jsonld-visible').status, 'fail')
})

test('galleryRef: 갤러리 주소면 같은 레시피의 다른 블록 주소를 만들고, 아니면 null', () => {
  const g = galleryRef('http://localhost:3961/qa/blocks?b=block-retention-cancel-flow&r=r7&frame=1', 'auth/sign-up-consents')
  assert.equal(g, 'http://localhost:3961/qa/blocks?b=block-auth-sign-up-consents&r=r7&frame=1')
  assert.equal(galleryRef('file:///x/good.html', 'auth/sign-up-consents'), null)
})

// ── ③ 소스 검사 ──
function fakeBlocks(files) {
  const dir = mkdtempSync(join(tmpdir(), 'mkt-src-'))
  for (const [rel, src] of Object.entries(files)) { mkdirSync(dirname(join(dir, 'registry/factory/blocks', rel)), { recursive: true }); writeFileSync(join(dir, 'registry/factory/blocks', rel), src) }
  return dir
}
test('sourceCheck: 음성 대조 — 가짜 타이머·박아 넣은 endsAt·Math.random 을 각각 잡는다', () => {
  const r = sourceCheck(fakeBlocks({
    'a/no-ends.tsx': 'export const A = () => <span data-countdown>3일</span>\n',
    'a/rolling.tsx': 'const endsAt = Date.now() + 3600000\nexport const B = () => <span data-countdown data-ends-at={endsAt} />\n',
    'a/hardcoded.tsx': 'const endsAt = "2026-12-31T00:00:00Z"\nexport const C = () => <span data-countdown data-ends-at={endsAt} />\n',
    'a/viewers.tsx': 'export const D = () => <p>{Math.floor(Math.random() * 40)}명이 보는 중</p>\n',
    'a/ok.tsx': 'export const E = ({ endsAt }) => <span data-countdown data-ends-at={endsAt} />\n',
  }))
  assert.equal(r.checked, 5)
  assert.equal(r.problems.length, 4, r.problems.join('\n'))
  for (const f of ['no-ends', 'rolling', 'hardcoded', 'viewers']) assert.ok(r.problems.some((p) => p.includes(`a/${f}.tsx`)), f)
  assert.ok(!r.problems.some((p) => p.includes('a/ok.tsx')))
})

test('sourceCheck: 실제 블록 소스 전부(양성 대조 — 표지가 있는 블록을 실제로 봤다)', () => {
  const r = sourceCheck(root)
  assert.ok(r.checked > 100, `검사한 소스 ${r.checked}`)
  assert.deepEqual(r.problems, [])
})

// ── ④ 브라우저 ──
// Chrome 은 브라우저 시험이 처음 부를 때 띄운다(순수 시험만 돌릴 때는 안 띄운다).
let chrome, ws, live
const env = () => (live ??= (async () => {
  const files = writeFixtures(join(root, '.tmp', 'marketing-fixtures'))
  chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb'], { prefix: 'mkt-test-' })
  const c = await connect(chrome.wsUrl)
  ws = c.ws
  return { files, session: { send: c.send, ev: c.ev } }
})())
after(async () => { try { ws?.close() } catch {} await chrome?.close() })

test('브라우저: 통과 페이지 — 실패 0·경고 0, 규칙 21개가 모두 실제로 쟀다(measured ≥ 1)', async () => {
  const { files, session } = await env()
  const r = await gateOnPage(session, fileUrl(files.good))
  assert.deepEqual(r.fail, [], JSON.stringify(r.rules.filter((x) => x.status !== 'pass')))
  assert.deepEqual(r.warn, [])
  for (const x of r.rules) assert.ok(x.measured >= 1, `${x.id} measured ${x.measured}`)
})

for (const m of MUTATIONS) {
  test(`음성 대조 ${m.name}: ${m.rule} 만 ${m.expect === 'fail' ? '실패' : '경고'}`, async () => {
    const { files, session } = await env()
    const r = await gateOnPage(session, fileUrl(files[m.name]))
    const hit = r.rules.find((x) => x.id === m.rule)
    assert.equal(hit.status, m.expect === 'fail' ? 'fail' : 'warn', `${m.rule} → ${hit.status} ${JSON.stringify(hit.detail)}`)
    assert.ok(hit.detail.length > 0)
    const others = r.rules.filter((x) => x.id !== m.rule && (x.status === 'fail' || (m.expect === 'fail' && x.status === 'warn')))
    assert.deepEqual(others.map((x) => `${x.id}:${x.detail.join('|')}`), [], '다른 규칙은 그대로 통과')
  })
}

for (const v of PASSING_VARIANTS) {
  test(`양성 대조 ${v.name}: 좋은 페이지를 이렇게 바꿔도 실패·경고 0`, async () => {
    const { files, session } = await env()
    const r = await gateOnPage(session, fileUrl(files[v.name]))
    assert.deepEqual([r.fail, r.warn], [[], []], JSON.stringify(r.rules.filter((x) => x.status === 'fail' || x.status === 'warn')))
  })
}

test('브라우저: 375 폭에서도 통과 페이지는 통과(행렬이 375 를 돌린다)', async () => {
  const { files, session } = await env()
  const r = await gateOnPage(session, fileUrl(files.good), { width: 375, height: 812 })
  assert.deepEqual(r.fail, [], JSON.stringify(r.rules.filter((x) => x.status === 'fail')))
})

// ── ⑤ CLI ──
test('CLI: 종료 코드 — 통과 0(결과 파일 있음) · 판정 실패 1(결과 파일 있음) · 도구 실패 1(파일 없음 + 「도구 실패:」) · 인자 오류 2', async () => {
  const { files } = await env()
  const out = mkdtempSync(join(tmpdir(), 'mkt-cli-'))
  const ok = await run([fileUrl(files.good), '--out', out])
  assert.equal(ok.code, 0, ok.err)
  const j = JSON.parse(readFileSync(join(out, 'marketing-gate.json'), 'utf8'))
  assert.deepEqual(j.fail, [])
  assert.equal(j.rules.length, RULES.length)

  const bad = await run([fileUrl(files['optional-consent-prechecked']), '--out', out])
  assert.equal(bad.code, 1)
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'marketing-gate.json'), 'utf8')).fail, ['optin-unchecked'])
  assert.match(bad.err, /FAIL optin-unchecked/)

  const tf = await run([fileUrl(join(out, '없는-페이지.html')), '--out', out])
  assert.equal(tf.code, 1)
  assert.match(tf.err, /도구 실패:/)
  assert.equal(existsSync(join(out, 'marketing-gate.json')), false, '도구 실패는 앞 실행의 결과 파일까지 지운다')

  assert.equal((await run([])).code, 2)
  assert.equal((await run(['a', 'b'])).code, 2)
  assert.equal((await run([fileUrl(files.good), '--width'])).code, 2)
  assert.equal((await run([fileUrl(files.good), '--signup-steps', '0'])).code, 2)
  assert.equal((await run(['--source', fileUrl(files.good)])).code, 2)
})

test('CLI --source: 실제 저장소 0 · 나쁜 저장소 1(결과 파일 있음)', async () => {
  const out = mkdtempSync(join(tmpdir(), 'mkt-src-cli-'))
  const ok = await run(['--source', '--out', out])
  assert.equal(ok.code, 0, ok.err)
  assert.ok(JSON.parse(readFileSync(join(out, 'marketing-source.json'), 'utf8')).checked > 100)
  const dir = fakeBlocks({ 'a/x.tsx': 'export const X = () => <p>{Math.random()}</p>\n' })
  const bad = await run(['--source', '--root', dir, '--out', out])
  assert.equal(bad.code, 1)
  assert.match(bad.err, /Math\.random/)
  const none = await run(['--source', '--root', mkdtempSync(join(tmpdir(), 'mkt-empty-')), '--out', out])
  assert.equal(none.code, 1)
  assert.match(none.err, /도구 실패:/)
})
