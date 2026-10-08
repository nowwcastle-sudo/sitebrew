// 원형별 엄격 기준(P3-4 Task 4) — 순수 판정(judgeStrict)·후보 어댑터(strictGateForCandidate, 가짜 측정기)·표 모양. 브라우저 없음 — 실제 페이지 측정은 strict-archetype.browser.test.mjs(잠금 안).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ARCHETYPE_IDS } from '../stamp/brief.mjs'
import { FACT_KINDS, PROFILES, STRICT_BY_ARCHETYPE, WHAT_IT_DOES, isWhatItDoes, judgeStrict, strictGateForCandidate } from './strict-archetype.mjs'

const TMP = mkdtempSync(join(tmpdir(), 'strict-'))
const ALL = Object.keys(FACT_KINDS)

/** 모든 사실을 첫 화면(0.2)에 둔 측정값. over 로 덮는다(null = 없음). */
const facts = (over = {}) => ({ vh: 900, width: 1440, ...Object.fromEntries(ALL.map((k) => [k, 0.2])), ...over })
const both = (over) => ({ desktop: facts(over), mobile: facts(over) })
const page = (route, over, extra = {}) => ({ route, id: route === '/' ? 'home' : route.slice(1), entry: route === '/', legal: false, profiles: both(over), ...extra })

test('표: 9개 원형 모두 규칙이 있고, 규칙마다 scope·needs(kind ∈ FACT_KINDS · within 1 또는 2)를 갖는다', () => {
  assert.deepEqual(Object.keys(STRICT_BY_ARCHETYPE).sort(), [...ARCHETYPE_IDS].sort())
  for (const [arch, rules] of Object.entries(STRICT_BY_ARCHETYPE)) {
    assert.ok(rules.length >= 1, arch)
    for (const r of rules) {
      assert.match(r.id, /^[a-z]+(-[a-z]+)+$/)
      assert.ok(['entry', 'any'].includes(r.scope), `${arch}/${r.id} scope`)
      assert.ok(r.needs.length >= 1)
      for (const n of r.needs) {
        assert.ok(n.kind in FACT_KINDS, `${arch}/${r.id}: 모르는 사실 ${n.kind}`)
        assert.ok([1, 2].includes(n.within), `${arch}/${r.id}/${n.kind} within`)
      }
    }
  }
  assert.deepEqual(PROFILES.map((p) => p.width), [1440, 375])
})

test('judgeStrict: 모든 사실이 첫 화면에 있으면 9개 원형 모두 통과(pass)', () => {
  for (const arch of ARCHETYPE_IDS) {
    const j = judgeStrict(arch, [page('/', {})])
    assert.deepEqual(j.fail, [], arch)
    assert.deepEqual(j.na, [], arch)
    assert.ok(j.rules.every((r) => r.status === 'pass'), arch)
  }
})

test('음성 대조: 규칙이 요구하는 사실 하나씩을 없애면 그 사실 이름을 대고 그 원형만 실패한다', () => {
  for (const [arch, rules] of Object.entries(STRICT_BY_ARCHETYPE)) {
    for (const r of rules) for (const need of r.needs) {
      const j = judgeStrict(arch, [page('/', { [need.kind]: null })])
      const hit = j.rules.find((x) => x.id === r.id)
      assert.equal(hit.status, 'fail', `${arch}/${r.id} — ${need.kind} 없음이 통과했다`)
      assert.ok(hit.problems.some((p) => p.includes(`${need.kind} 없음`)), hit.problems.join(' | '))
      // 다른 사실은 그대로이니 문제는 그 사실 하나(두 프로필 × 1)다
      assert.equal(hit.problems.length, PROFILES.length, hit.problems.join(' | '))
    }
  }
})

test('음성 대조: 사실이 있어도 정한 화면 수 밖(within 이상)이면 실패 — 한 프로필(375)에서만 밖이어도 실패', () => {
  for (const [arch, rules] of Object.entries(STRICT_BY_ARCHETYPE)) {
    for (const r of rules) for (const need of r.needs) {
      const farMobile = { desktop: facts(), mobile: facts({ [need.kind]: need.within + 0.01 }) }
      const j = judgeStrict(arch, [{ ...page('/', {}), profiles: farMobile }])
      const hit = j.rules.find((x) => x.id === r.id)
      assert.equal(hit.status, 'fail', `${arch}/${r.id} — ${need.kind} 가 ${need.within + 0.01}화면인데 통과했다`)
      assert.ok(hit.problems.every((p) => p.includes('mobile(375)')) && hit.problems.some((p) => p.includes(need.kind)), hit.problems.join(' | '))
      // 경계: 정확히 within 미만(0.99 · 1.99)이면 통과
      const edge = { desktop: facts(), mobile: facts({ [need.kind]: need.within - 0.01 }) }
      assert.equal(judgeStrict(arch, [{ ...page('/', {}), profiles: edge }]).rules.find((x) => x.id === r.id).status, 'pass')
    }
  }
})

test('local: 전화는 첫 화면 1, 영업시간·위치는 두 화면 — 영업시간이 1.5화면째면 통과, 전화가 1.5화면째면 실패', () => {
  assert.equal(judgeStrict('local', [page('/', { hours: 1.5, location: 1.9 })]).rules[0].status, 'pass')
  const j = judgeStrict('local', [page('/', { tel: 1.5 })])
  assert.equal(j.rules[0].status, 'fail')
  assert.match(j.rules[0].problems[0], /\[local-first-screen\] \/ desktop\(1440\): tel 가 1\.5화면째/)
})

test('scope any(commerce): 일반 쪽 중 한 쪽이 채우면 통과 · 아무 쪽도 못 채우면 가장 적게 어긴 쪽의 문제를 보인다 · 법정 쪽은 세지 않는다', () => {
  const home = page('/', { price: null, shipping: null })
  const list = page('/category', { price: 0.4, shipping: 1.2 })
  const ok = judgeStrict('commerce', [home, list])
  assert.equal(ok.rules[0].status, 'pass')
  assert.equal(ok.rules[0].route, '/category')
  const badList = page('/category', { price: 0.4, shipping: null })
  const bad = judgeStrict('commerce', [home, badList])
  assert.equal(bad.rules[0].status, 'fail')
  assert.ok(bad.rules[0].problems.every((p) => p.includes('/category')), '가장 적게 어긴 쪽(배송만 없음)의 문제')
  const legalOnly = page('/refund', {}, { legal: true, entry: false })
  const na = judgeStrict('commerce', [home, legalOnly])
  assert.equal(na.rules[0].status, 'fail')
  assert.equal(judgeStrict('commerce', [legalOnly]).rules[0].status, 'na')
})

test('na: 첫 쪽을 못 찾으면(entry 없음)·측정값이 없으면 통과가 아니라 na', () => {
  assert.equal(judgeStrict('local', []).rules[0].status, 'na')
  assert.equal(judgeStrict('local', [page('/x', {}, { entry: false })]).rules[0].status, 'na')
  const unmeasured = { ...page('/', {}), profiles: { desktop: null, mobile: null } }
  const j = judgeStrict('local', [unmeasured])
  assert.equal(j.rules[0].status, 'na')
  assert.deepEqual(j.na, ['local-first-screen'])
  assert.throws(() => judgeStrict('nope', []), /엄격 기준이 없는 원형/)
})

// ── 후보 어댑터 ──

function candidate(archetype, pages) {
  const runDir = mkdtempSync(join(TMP, 'run-'))
  const candDir = join(runDir, 'a')
  mkdirSync(join(candDir, 'site', 'content'), { recursive: true })
  writeFileSync(join(candDir, 'site', 'content', 'site.json'), JSON.stringify({ archetype, pages }))
  return { runDir, cand: { id: 'a' }, candDir }
}
const PAGES = { '/': { id: 'home', title: '홈' }, '/category': { id: 'category-list', title: '목록' }, '/privacy': { id: 'privacy', title: '개인정보', legal: true } }
const fake = (by) => { const calls = []; const measure = async (origin, routes) => { calls.push(routes); return routes.map((r) => ({ route: r, profiles: by[r] ?? both({}) })) }; return { measure, calls } }

test('strictGateForCandidate: 통과 — 기록 모양·결과 파일·entry 쪽만 잰다(scope entry 원형은 일반 쪽을 더 재지 않는다)', async () => {
  const f = candidate('local', PAGES)
  const m = fake({})
  const rec = await strictGateForCandidate(f.runDir, f.cand, { origin: 'http://x.test', routes: Object.keys(PAGES), measure: m.measure })
  assert.equal(rec.verdict, 'pass'); assert.equal(rec.exit, 0); assert.equal(rec.toolFailure, false)
  assert.deepEqual(m.calls, [['/']])
  assert.equal(rec.resultFile, '07-qa/strict/strict.json')
  const saved = JSON.parse(readFileSync(join(f.candDir, rec.resultFile), 'utf8'))
  assert.equal(saved.judge.rules[0].status, 'pass')
})

test('strictGateForCandidate: 어김 → exit 1 · verdict fail · problems 에 규칙·쪽·프로필 · commerce(any)는 일반 쪽 전부를 잰다(법정 쪽 제외)', async () => {
  const f = candidate('commerce', PAGES)
  const m = fake({ '/': both({ price: null }), '/category': both({ shipping: 2.5 }) })
  const rec = await strictGateForCandidate(f.runDir, f.cand, { origin: 'http://x.test', routes: Object.keys(PAGES), measure: m.measure })
  assert.deepEqual(m.calls, [['/', '/category']])
  assert.equal(rec.verdict, 'fail'); assert.equal(rec.exit, 1); assert.equal(rec.toolFailure, false)
  assert.match(rec.note, /원형 엄격 기준 1건: commerce-price-shipping/)
  assert.ok(rec.problems.length >= 1 && rec.problems.every((p) => p.startsWith('[commerce-price-shipping]')))
})

test('strictGateForCandidate: na 는 실패(A123) · 도구 실패(측정기가 던짐·기준 없는 원형·잴 쪽 없음)는 toolFailure', async () => {
  const f = candidate('local', { '/privacy': { id: 'privacy', legal: true } })
  const none = await strictGateForCandidate(f.runDir, f.cand, { origin: 'http://x.test', measure: async () => [] })
  assert.equal(none.verdict, 'tool'); assert.equal(none.toolFailure, true); assert.match(none.note, /잴 쪽이 없다/)

  const g = candidate('local', PAGES)
  const empty = await strictGateForCandidate(g.runDir, g.cand, { origin: 'http://x.test', measure: async () => [] }) // 측정기가 쪽을 하나도 안 돌려줌 → 프로필 없음 → na → 실패
  assert.equal(empty.verdict, 'fail'); assert.equal(empty.exit, 1); assert.match(empty.note, /local-first-screen\(na\)/)

  const boom = await strictGateForCandidate(g.runDir, g.cand, { origin: 'http://x.test', measure: async () => { throw new Error('열리지 않는 쪽') } })
  assert.equal(boom.verdict, 'tool'); assert.match(boom.note, /도구 실패: 열리지 않는 쪽/)
  assert.equal(existsSync(join(g.candDir, '07-qa', 'strict', 'strict.json')), false, '도구 실패면 결과 파일을 지운다')

  const h = candidate('unknown', PAGES)
  assert.equal((await strictGateForCandidate(h.runDir, h.cand, { origin: 'http://x.test', measure: async () => [] })).verdict, 'tool')
})

// ── FV1 Task 5.12: 「무엇을 하는지」 행(lp-demo-clarity) ───────────────────────────────────────────────────────────────────────────────
test('what-it-does: saas·landing 에 규칙이 있다(landing 의 landing-first-screen 은 그대로) — 첫 화면에 whatItDoes 가 와야 한다', () => {
  for (const arch of ['saas', 'landing']) {
    const r = STRICT_BY_ARCHETYPE[arch].find((x) => x.id === 'what-it-does')
    assert.ok(r, `${arch} 에 what-it-does 규칙이 없다`)
    assert.deepEqual(r.needs, [{ kind: 'whatItDoes', within: 1 }])
    assert.equal(r.scope, 'entry')
  }
  assert.ok(STRICT_BY_ARCHETYPE.landing.some((x) => x.id === 'landing-first-screen'), 'landing 엄격 규칙(5.5)을 지우지 않았다')
  assert.ok(STRICT_BY_ARCHETYPE.saas.some((x) => x.id === 'saas-cta-pricing'))
  for (const arch of ARCHETYPE_IDS.filter((a) => !['saas', 'landing'].includes(a))) assert.ok(!STRICT_BY_ARCHETYPE[arch].some((x) => x.id === 'what-it-does'), `${arch} 에는 이 행이 없다`)
})

test('what-it-does: whatItDoes 가 없으면 이름을 대고 실패, 첫 화면 밖(1.01)이면 실패, 0.99 면 통과', () => {
  for (const arch of ['saas', 'landing']) {
    const none = judgeStrict(arch, [page('/', { whatItDoes: null })]).rules.find((r) => r.id === 'what-it-does')
    assert.equal(none.status, 'fail')
    assert.ok(none.problems.some((p) => p.includes('whatItDoes 없음')))
    assert.equal(judgeStrict(arch, [page('/', { whatItDoes: 1.01 })]).rules.find((r) => r.id === 'what-it-does').status, 'fail')
    assert.equal(judgeStrict(arch, [page('/', { whatItDoes: 0.99 })]).rules.find((r) => r.id === 'what-it-does').status, 'pass')
  }
})

test('isWhatItDoes: 구호는 아니고 일을 말하는 문장은 맞다(ko 해요체·en 동사) — 40자를 넘거나 어절이 모자라면 아니다', () => {
  for (const ok of ['예약 장부를 자동으로 정리해요', '견적서를 보내고 승인 상태를 확인해요', 'Send quotes and track approvals', 'A ledger that helps you track bookings']) assert.equal(isWhatItDoes(ok), true, ok)
  for (const no of ['내일을 바꾸다', '새로운 기준, 더 나은 내일', 'Reimagine tomorrow', 'Quotes', '정리해요', '', '견적서를 링크로 보내고 고객이 열어 봤는지, 승인했는지를 한 화면에서 확인해요']) assert.equal(isWhatItDoes(no), false, no)
  assert.equal(WHAT_IT_DOES.max, 40)
})
