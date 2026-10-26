// 런북 장 고르기·전문가용 본문·대안·오래됨 비교(계획 5 Task 12) — 순수 모듈, 파일·시계 없음.
// 고정물은 LF 생성 파일과 모양이 같은 임시본이다 — 값이 아니라 규칙·모양을 본다(gid·성과 id 는 써도 된다).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { alternativesFor, expertText, pastDate, planRunbook } from './plan.mjs'

const DATA = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'runbook.generated.json'), 'utf8'))
const TODAY = '2026-10-22'

/** 넘겨진 것(Delivered) — 시험마다 필요한 칸만 바꾼다. */
const delivered = (over = {}) => ({
  version: 1, applied: [], unapplied: [], completion: 'site', locale: 'ko',
  tableHash: DATA.outcomesHash, deliveredAt: '2026-10-20T00:00:00.000Z', ...over,
})
const product = (over = {}) => delivered({ applied: ['signup', 'payments'], completion: 'composed', ...over })
const always = Object.values(DATA.chapters).filter((c) => c.card.need === 'always').map((c) => c.gid)

// ── planRunbook: 장 집합과 순서 ────────────────────────────────────────────────

test('소개형(적용된 성과 없음): 꼭 필요한 장만, 데이터 순서대로', () => {
  const plan = planRunbook(DATA, delivered(), { today: TODAY })
  assert.deepEqual(plan.chapters, DATA.order.filter((g) => always.includes(g)))
  assert.equal(plan.site, 'site')
  assert.equal(plan.lang, 'ko', 'lang 이 없으면 사이트 언어')
  assert.deepEqual(plan.missing, [])
})

test('제품형(가입+결제, 한국어): hosting → domain → db → auth → email → billing → biz-kr, 다시 정렬하지 않는다', () => {
  const plan = planRunbook(DATA, product(), { lang: 'ko', today: TODAY })
  assert.deepEqual(plan.chapters, ['G-hosting', 'G-domain', 'G-db', 'G-auth', 'G-email', 'G-billing', 'G-biz-kr'])
  assert.equal(plan.site, 'composed')
  // 순서의 주인은 데이터 order 다 — order 를 뒤집으면 결과도 뒤집힌다
  const reversed = structuredClone(DATA)
  reversed.order.reverse()
  assert.deepEqual(planRunbook(reversed, product(), { lang: 'ko', today: TODAY }).chapters, [...plan.chapters].reverse())
})

test('카드 when 은 AND: 한국어+결제만 넣고, 영어+결제·한국어+결제 없음은 뺀다', () => {
  const has = (d) => planRunbook(DATA, d, { lang: 'ko', today: TODAY }).chapters.includes('G-biz-kr')
  assert.equal(has(product({ locale: 'ko' })), true)
  assert.equal(has(product({ locale: 'en' })), false, '사이트 언어가 다르면 빠진다(런북 언어가 아니라 사이트 언어)')
  assert.equal(has(delivered({ locale: 'ko', applied: ['signup'] })), false, '결제가 없으면 빠진다')
})

test('when 에 locale 만 있으면 성과와 무관하게 그 언어 사이트에 든다', () => {
  const data = structuredClone(DATA)
  data.chapters['G-biz-kr'].card.when = { locale: 'ko' }
  assert.ok(planRunbook(data, delivered({ locale: 'ko' }), { today: TODAY }).chapters.includes('G-biz-kr'))
  assert.ok(!planRunbook(data, delivered({ locale: 'en' }), { today: TODAY }).chapters.includes('G-biz-kr'))
})

test('못 넣은 기능의 장은 넣지 않는다 — 다른 적용 성과나 꼭 필요한 장으로 닿는 장은 남는다', () => {
  const plan = planRunbook(DATA, delivered({ applied: ['signup'], unapplied: ['push'] }), { today: TODAY })
  assert.ok(!plan.chapters.includes('G-push'), 'push 로만 닿는 장은 빠진다')
  assert.ok(plan.chapters.includes('G-db'), '가입으로도 닿는 장은 남는다')
  // applied 와 unapplied 에 같이 있으면 못 넣은 쪽이 이긴다
  const both = planRunbook(DATA, delivered({ applied: ['signup', 'push'], unapplied: ['push'] }), { today: TODAY })
  assert.ok(!both.chapters.includes('G-push'))
  // 꼭 필요한 장은 그 장을 부르는 성과가 못 넣은 쪽이어도 남는다
  const data = structuredClone(DATA)
  data.outcomes.push.guides.unshift('G-hosting')
  assert.ok(planRunbook(data, delivered({ unapplied: ['push'] }), { today: TODAY }).chapters.includes('G-hosting'))
})

test('적용된 선택을 모르면(applied: null) 추정하지 않고 던진다 — 묻는 일은 부르는 쪽 몫', () => {
  assert.throws(() => planRunbook(DATA, delivered({ applied: null }), { today: TODAY }), /applied is null/)
})

// ── planRunbook: 빠진 것(던지지 않는다) ─────────────────────────────────────────

test('장 글 없음 · 카드 없음 · 영어 글 없음은 missing 으로, 던지지 않는다', () => {
  const data = structuredClone(DATA)
  data.outcomes.signup.guides.push('G-nowhere')       // 장 자체가 없다
  delete data.chapters['G-auth'].card                 // 카드가 없다
  const plan = planRunbook(data, product({ locale: 'en' }), { lang: 'en', today: TODAY })
  const why = Object.fromEntries(plan.missing.map((m) => [m.gid, m.why]))
  assert.equal(why['G-nowhere'], 'noChapter')
  assert.equal(why['G-auth'], 'noCard')
  assert.equal(why['G-db'], 'noText', '영어 글이 비어 있는 장')
  assert.ok(plan.missing.every((m) => m.lang === 'en'))
  for (const g of ['G-nowhere', 'G-auth', 'G-db']) assert.ok(!plan.chapters.includes(g), `${g} 는 본문 장이 아니다`)
  // 같은 장을 한국어로 고르면 noText 가 아니다
  assert.ok(!planRunbook(DATA, product(), { lang: 'ko', today: TODAY }).missing.some((m) => m.gid === 'G-db'))
})

// ── 오래됨 ──────────────────────────────────────────────────────────────────

test('pastDate 는 엄격한 문자열 비교 — 같은 날은 지나지 않았다', () => {
  assert.equal(pastDate('2026-08-30', '2026-08-31'), true)
  assert.equal(pastDate('2026-08-30', '2026-08-30'), false)
  assert.equal(pastDate('2026-08-31', '2026-08-30'), false)
  assert.throws(() => pastDate('2026-8-30', '2026-08-31'), /YYYY-MM-DD/)
})

test('stale: staleAfter 가 오늘보다 앞일 때만, 고른 장 안에서만', () => {
  const push = delivered({ applied: ['push'] })
  const after = DATA.chapters['G-push'].staleAfter
  assert.deepEqual(planRunbook(DATA, push, { today: after }).stale, [], '경계일 당일은 오래되지 않았다')
  assert.deepEqual(planRunbook(DATA, push, { today: TODAY }).stale, ['G-push'])
  assert.deepEqual(planRunbook(DATA, delivered(), { today: TODAY }).stale, [], '고르지 않은 장은 세지 않는다')
})

// ── expertText ──────────────────────────────────────────────────────────────

test('개요 표: rubric 의 열 이름 다섯과 장마다 한 줄(비용·필수 낱말도 rubric 에서)', () => {
  const plan = planRunbook(DATA, product(), { lang: 'ko', today: TODAY })
  const text = expertText(plan, DATA, { lang: 'ko', today: TODAY })
  const L = DATA.rubric.labels
  const header = `| ${['chapter', 'service', 'cost', 'need', 'ifSkipped'].map((k) => L.columns[k].ko).join(' | ')} |`
  const lines = text.split('\n')
  const at = lines.indexOf(header)
  assert.ok(at > 0, '표 머리')
  assert.match(lines[at + 1], /^\|(\s*-+\s*\|){5}$/)
  const rows = lines.slice(at + 2).filter((l, i, a) => a.slice(0, i + 1).every((x) => x.startsWith('|')))
  assert.equal(rows.length, plan.chapters.length)
  const billing = rows.find((r) => r.startsWith(`| ${DATA.chapters['G-billing'].text.ko.title} |`))
  const c = DATA.chapters['G-billing'].card
  assert.ok(billing.includes(c.service) && billing.includes(L.cost['per-sale'].ko) && billing.includes(L.need.feature.ko) && billing.includes(c.ifSkipped.ko))
  // 첫 줄: 사이트 종류 · 언어
  assert.ok(lines[0].includes(L.site.composed.ko) && lines[0].includes(L.langName.ko.ko))
})

test('장 본문은 계획 순서대로 그대로 들어가고, 모든 장의 환경 이름(공유 절 포함)이 남는다', () => {
  const data = structuredClone(DATA)
  // 같은 파일의 공유 절에서 물려받은 이름 — 본문에는 없다
  data.shared['billing.md'] = { ko: '## 1. 환경 변수\n- `SHARED_ONLY_NAME` 은 이 파일의 모든 장이 써요.' }
  data.chapters['G-billing'].envNames.push('SHARED_ONLY_NAME')
  const plan = planRunbook(data, product(), { lang: 'ko', today: TODAY })
  const text = expertText(plan, data, { lang: 'ko', today: TODAY })
  let from = 0
  for (const g of plan.chapters) {
    const at = text.indexOf(data.chapters[g].text.ko.body, from)
    assert.ok(at >= from, `${g} 본문이 그대로, 순서대로`)
    from = at
  }
  for (const g of plan.chapters) for (const n of data.chapters[g].envNames) assert.ok(text.includes(n), `${g}: ${n}`)
  assert.equal(text.split(data.shared['billing.md'].ko).length, 2, '공유 절은 한 번만')
})

test('오래됨 문장은 오래된 장이 있을 때만, 어느 장인지와 함께; 빠진 장은 rubric 이름의 절로 끝에', () => {
  const R = DATA.rubric
  const fresh = expertText(planRunbook(DATA, product(), { lang: 'ko', today: TODAY }), DATA, { lang: 'ko', today: TODAY })
  assert.ok(!fresh.includes(R.staleLine.ko))
  assert.ok(!fresh.includes(R.labels.missing.ko), '빠진 것이 없으면 절도 없다')

  const plan = planRunbook(DATA, product({ applied: ['signup', 'payments', 'push'], locale: 'en' }), { lang: 'en', today: TODAY })
  const text = expertText(plan, DATA, { lang: 'en', today: TODAY })
  const staleLine = text.split('\n').find((l) => l.includes(R.staleLine.en))
  assert.ok(staleLine?.includes(DATA.chapters['G-push'].text.en.title), '오래된 장 이름')
  const tail = text.slice(text.lastIndexOf(R.labels.missing.en))
  assert.ok(text.lastIndexOf(R.labels.missing.en) > text.indexOf(DATA.chapters['G-push'].text.en.body), '맨 끝')
  assert.ok(tail.includes('G-db'), '영어 글이 없는 장')
})

test('expertText 의 문장은 모두 rubric·장 글에서 온다 — rubric 낱말을 바꾸면 출력도 바뀐다', () => {
  const data = structuredClone(DATA)
  data.rubric.labels.columns.service.ko = '열머리표지'
  data.rubric.labels.headline.ko = '머리표지 {site} / {lang}'
  const text = expertText(planRunbook(data, delivered(), { today: TODAY }), data, { lang: 'ko', today: TODAY })
  assert.ok(text.includes('열머리표지'))
  assert.ok(text.split('\n')[0].startsWith('머리표지 '))
})

// ── alternativesFor ─────────────────────────────────────────────────────────

test('대안: 네 가지 switch — builtin 은 via 성과가 적용됐으면 on, 아니면 reselect', () => {
  const by = (applied) => Object.fromEntries(alternativesFor(DATA, 'G-email', { applied }).options.map((o) => [o.support, o.switch]))
  assert.deepEqual(by(['payments']), { builtin: 'on', code: 'code', no: 'no' })
  assert.deepEqual(by(['signup']), { builtin: 'reselect', code: 'code', no: 'no' })
  const r = alternativesFor(DATA, 'G-email', { applied: [] })
  assert.deepEqual(r.current, { service: DATA.chapters['G-email'].card.service, role: 'email' })
})

test('대안: 태그로 거른다', () => {
  const all = DATA.alternatives.email
  for (const want of ['free', 'cheaper', 'better', 'ko']) {
    const got = alternativesFor(DATA, 'G-email', { want, applied: [] }).options.map((o) => o.service)
    assert.deepEqual(got, all.filter((a) => a.tags.includes(want)).map((a) => a.service), want)
  }
  assert.equal(alternativesFor(DATA, 'G-email', { applied: [] }).options.length, all.length, 'want 없으면 전부')
})

test('대안: 역할에 대안이 없으면 none (지금 서비스는 알려 준다)', () => {
  const r = alternativesFor(DATA, 'G-hosting', { applied: [] })
  assert.equal(r.none, true)
  assert.equal(r.current.role, 'hosting')
  assert.ok(!('options' in r))
})

test('대안: 금액 칸을 만들지도 옮기지도 않는다(데이터에 끼어든 금액 칸도 버린다)', () => {
  const data = structuredClone(DATA)
  for (const a of data.alternatives.email) Object.assign(a, { price: 1, amount: 2, monthly: 3 })
  const allowed = new Set(['service', 'tags', 'support', 'via', 'switchCost', 'note', 'home', 'checked', 'item', 'switch'])
  const r = alternativesFor(data, 'G-email', { applied: ['payments'] })
  for (const o of r.options) for (const k of Object.keys(o)) assert.ok(allowed.has(k), `칸 ${k}`)
  assert.ok(!/price|amount|monthly/.test(JSON.stringify(r)))
})
