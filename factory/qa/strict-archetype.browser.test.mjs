// 원형별 엄격 기준 — 실제 Chrome 으로 픽스처 쪽을 재는 시험(P3-4 Task 4). Chrome 을 띄우므로 실행 잠금 안에서만 돌린다.
//   strictFacts() 가 사실마다 「첫 일치의 화면 위치」를 바르게 읽는지(양성 sink · 음성 empty), 첫 화면 밖에 둔 사실은 밖으로 읽히는지(local-bad),
//   그 값으로 judgeStrict 가 local 좋은 쪽은 통과·나쁜 쪽은 사실 이름을 대고 실패하는지를 본다.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FACT_KINDS, judgeStrict, measureStrict } from './strict-archetype.mjs'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'strict')
const srv = http.createServer((req, res) => {
  try {
    const body = readFileSync(join(dir, req.url.replace(/^\/+/, '')))
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body)
  } catch { res.writeHead(404).end('not found') }
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${srv.address().port}`
after(() => srv.close())

// 측정은 한 번에 끝낸다 — 시험을 등록하기 전에 await 가 두 번이면 앞 시험이 끝난 순간 실행기가 파일을 끝낸 것으로 읽어 뒤 시험을 잃는다.
const FOUR_RULES = ['dashboard-overview', 'portfolio-works-contact', 'commerce-price-shipping', 'public-contact-services']
const measured = await measureStrict(origin, ['/local-good.html', '/local-bad.html', '/sink.html', '/empty.html', ...FOUR_RULES.flatMap((r) => [`/${r}-good.html`, `/${r}-bad.html`]), '/what-it-does-good.html', '/what-it-does-subtitle.html', '/what-it-does-bad.html', '/portfolio-works-contact-linkimg-bad.html'])
const at = (route) => measured.find((m) => m.route === route).profiles
const asPage = (route, entry = true) => ({ route, id: 'home', entry, legal: false, profiles: at(route) })

test('양성: sink 는 모든 사실 종류를 찾고, 데스크톱 첫 화면(< 1)에 있다 · 모바일은 두 화면(< 2) 안', () => {
  for (const k of Object.keys(FACT_KINDS)) {
    assert.notEqual(at('/sink.html').desktop[k], null, `desktop ${k} 를 못 찾았다`)
    assert.ok(at('/sink.html').desktop[k] < 1, `desktop ${k} = ${at('/sink.html').desktop[k]}`)
    assert.notEqual(at('/sink.html').mobile[k], null, `mobile ${k} 를 못 찾았다`)
    assert.ok(at('/sink.html').mobile[k] < 2, `mobile ${k} = ${at('/sink.html').mobile[k]}`)
  }
})

test('음성: 아무것도 없는 쪽은 nav 포함 모든 사실이 null 이다(거짓 양성 없음)', () => {
  for (const prof of ['desktop', 'mobile']) {
    const { vh, width, ...rest } = at('/empty.html')[prof]
    assert.ok(vh > 0 && width > 0)
    assert.deepEqual(Object.entries(rest).filter(([, v]) => v !== null), [], prof)
  }
})

test('화면 크기: desktop 은 1440×900 · mobile 은 375×812 에서 잰다', () => {
  assert.deepEqual([at('/empty.html').desktop.width, at('/empty.html').desktop.vh], [1440, 900])
  assert.deepEqual([at('/empty.html').mobile.width, at('/empty.html').mobile.vh], [375, 812])
})

test('local: 좋은 쪽은 통과, 전화·영업시간·주소를 3화면 아래에 둔 쪽은 그 사실 이름을 대고 실패', () => {
  assert.deepEqual(judgeStrict('local', [asPage('/local-good.html')]).fail, [])
  const bad = at('/local-bad.html')
  for (const k of ['tel', 'hours', 'location']) assert.ok(bad.desktop[k] > 3, `${k} = ${bad.desktop[k]}`)
  const j = judgeStrict('local', [asPage('/local-bad.html')])
  assert.deepEqual(j.fail, ['local-first-screen'])
  for (const k of ['tel', 'hours', 'location']) assert.ok(j.rules[0].problems.some((p) => p.includes(`${k} 가`)), `${k} 문제 없음: ${j.rules[0].problems.join(' | ')}`)
})

// ── FV1 Task 5.12 (대장 C271·C326): 6/6 실패 규칙 넷 — 좋은 쪽 픽스처(실제 블록의 마크업 모양)는 통과, 나쁜 쪽은 실패 ───────────────────
// 좋은 쪽이 떨어지면 문턱·찾는 식이 틀린 것이다(dashboard-overview 는 지표 값 뒤 단위를 안쪽 span 에 둔 KpiTile 모양을 못 읽었고, portfolio-works-contact 는 그림과 링크가 형제인
// ContentCards 모양을 못 읽었다). 좋은 쪽이 통과하는데 골든에서만 떨어지는 규칙(commerce-price-shipping·public-contact-services)은 블록·binder 쪽 원인이다 — docs/qa/p3-4-golden.md.
const FOUR = [['dashboard-overview', 'dashboard'], ['portfolio-works-contact', 'portfolio'], ['commerce-price-shipping', 'commerce'], ['public-contact-services', 'public']]
const measured2 = measured
const judgeFixture = async (rule, kind, arch) => {
  const route = `/${rule}-${kind}.html`
  const profiles = measured2.find((m) => m.route === route).profiles
  const j = judgeStrict(arch, [{ route, id: 'home', entry: true, legal: false, profiles }])
  return j.rules.find((r) => r.id === rule)
}
for (const [rule, arch] of FOUR) {
  test(`${rule}: 좋은 쪽은 통과, 나쁜 쪽은 실패`, async () => {
    const good = await judgeFixture(rule, 'good', arch)
    assert.equal(good.status, 'pass', good.problems.join(' | '))
    const bad = await judgeFixture(rule, 'bad', arch)
    assert.equal(bad.status, 'fail', '나쁜 쪽이 통과했다')
    assert.ok(bad.problems.length >= 1)
  })
}

test('dashboard-overview: 값 뒤 단위를 안쪽 span 에 둔 지표(KpiTile)를 숫자로 읽고, 보조 기술에서 숨긴 증감(aria-hidden)은 세지 않는다', () => {
  const g = measured2.find((m) => m.route === '/dashboard-overview-good.html').profiles
  for (const prof of ['desktop', 'mobile']) {
    assert.ok(g[prof].numbers !== null && g[prof].numbers < 1, `${prof} numbers = ${g[prof].numbers}`)
    assert.ok(g[prof].chart !== null && g[prof].chart < 2, `${prof} chart = ${g[prof].chart}`)
  }
})

test('portfolio-works-contact: 그림 칸과 제목 링크가 한 카드에 있으면 작업 카드로 읽고, 링크 끝의 장식 아이콘(svg)은 그림이 아니다', () => {
  const g = measured2.find((m) => m.route === '/portfolio-works-contact-good.html').profiles
  for (const prof of ['desktop', 'mobile']) assert.ok(g[prof].works !== null && g[prof].works < 2, `${prof} works = ${g[prof].works}`)
  const b = measured2.find((m) => m.route === '/portfolio-works-contact-bad.html').profiles
  assert.equal(b.desktop.works, null, '카드 둘뿐인 쪽은 작업 3개가 아니다')
})

// FINAL-WF B4(S1-6): 「링크 안 그림 + 형제 제목」 카드는 링크와 카드가 둘 다 홀더로 잡혀 카드 둘이 넷으로 셌다 — 안쪽 하나만 센다.
test('portfolio-works-contact: 링크 안 그림 + 형제 제목 카드 둘은 작업 3개가 아니다(포함 관계의 홀더는 안쪽 하나만)', async () => {
  const b = measured2.find((m) => m.route === '/portfolio-works-contact-linkimg-bad.html').profiles
  for (const prof of ['desktop', 'mobile']) assert.equal(b[prof].works, null, `${prof} works = ${b[prof].works} — 카드 둘이 셋 이상으로 셌다`)
  const r = await judgeFixture('portfolio-works-contact', 'linkimg-bad', 'portfolio')
  assert.equal(r.status, 'fail')
  assert.ok(r.problems.some((p) => p.includes('works 없음')), r.problems.join(' | '))
})

test('what-it-does(saas·landing): H1 또는 바로 뒤 부제에 동사 문장이 있으면 통과, 구호만 있으면 실패 — 같은 규칙이 두 원형에', () => {
  for (const arch of ['saas', 'landing']) {
    const run = (name) => judgeStrict(arch, [{ route: `/${name}.html`, id: 'home', entry: true, legal: false, profiles: measured2.find((m) => m.route === `/${name}.html`).profiles }]).rules.find((r) => r.id === 'what-it-does')
    assert.equal(run('what-it-does-good').status, 'pass', arch)
    assert.equal(run('what-it-does-subtitle').status, 'pass', `${arch} — 부제 문장`)
    const bad = run('what-it-does-bad')
    assert.equal(bad.status, 'fail', arch)
    assert.ok(bad.problems.some((p) => p.includes('whatItDoes 없음')), bad.problems.join(' | '))
  }
})
