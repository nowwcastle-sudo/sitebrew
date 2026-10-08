// 구획 단위 수정(factory v1 Task 4.3)의 순수 부분 — 말 → 요청 사상(모호하면 되묻기, Review Focus 4) · 구획 순위 rankSection(학습 가중치는 동점의 꼬리표일 뿐) · 명령줄 인자.
// 실행 폴더·Chrome 이 필요 없다(빠른 시험). 사이트 모양은 06 이 만든 content/site.json 의 섹션 키만 흉내 낸다 — 실제 사이트로 도는 시험은 revise.test.mjs.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boldScore, parseRevision, rankSection } from '../stamp/revise.mjs'
import { emptyPreferences, recordPick } from '../board/preferences.mjs'
import { parseArgs, UsageError } from '../stamp/stamp.mjs'

const siteOf = (keys) => ({ sections: Object.fromEntries(keys.map((k) => [k, { block: 'block-x' }])) })
// saas 사이트(06 결과)의 섹션 키 — 히어로·기능·연동·마지막 행동은 홈과 캠페인에 있고 요금제는 두 곳(pricing 쪽의 pricing-plans · 캠페인의 pricing)이다
const site = siteOf(['home/hero', 'home/workflow-features', 'home/integrations', 'home/final-cta', 'pricing/pricing-plans', 'campaign/hero', 'campaign/workflow-features', 'campaign/integrations', 'campaign/pricing', 'campaign/final-cta', 'signup/auth', 'login/auth', 'billing/paywall', 'global/footer'])
// local 사이트
const localSite = siteOf(['home/hero-visit-info', 'home/notice', 'home/menu-price', 'home/hours-table', 'home/directions', 'home/faq', 'home/contact-form', 'product-detail/booking-cta', 'global/sticky-booking-bar', 'global/footer'])

test('모호한 요청은 되묻는다 — 질문 하나·80자 미만·요청 언어로, 범위는 정하지 않는다(Review Focus 4)', () => {
  for (const text of ['더 예쁘게 해줘', '좀 더 좋게', '다시 해줘', '', '   ', 'make it prettier', 'improve it', '더 대담하게', '마음에 안 들어', undefined, null]) {
    const r = parseRevision(text, site)
    assert.ok(typeof r.ask === 'string' && r.ask.length > 0 && r.ask.length < 80, `${JSON.stringify(text)} → ${JSON.stringify(r)}`)
    assert.deepEqual(Object.keys(r), ['ask'], '되묻는 결과는 질문뿐이다')
  }
  assert.match(parseRevision('더 예쁘게 해줘', site).ask, /[가-힣]/, '한국어 요청에는 한국어로')
  assert.doesNotMatch(parseRevision('make it prettier', site).ask, /[가-힣]/, '영어 요청에는 영어로')
})

test('요청 사상표 — 한국어·영어 구획 이름 · 축(색·서체·모션 강도) · 문구', () => {
  const T = (text) => { const r = parseRevision(text, site); return [r.scope, r.target, r.intent] }
  const L = (text) => { const r = parseRevision(text, localSite); return [r.scope, r.target, r.intent] }
  // 구획
  assert.deepEqual(T('히어로를 더 대담하게'), ['section', 'home/hero', 'bolder'])
  assert.deepEqual(T('첫 화면을 좀 차분하게'), ['section', 'home/hero', 'calmer'])
  assert.deepEqual(T('make the hero bolder'), ['section', 'home/hero', 'bolder'])
  assert.deepEqual(T('hero section: calmer please'), ['section', 'home/hero', 'calmer'])
  assert.deepEqual(T('캠페인 히어로 다르게'), ['section', 'campaign/hero', 'different'])
  assert.deepEqual(T('swap the campaign hero'), ['section', 'campaign/hero', 'different'])
  assert.deepEqual(T('연동 구획을 다른 걸로 바꿔줘'), ['section', 'home/integrations', 'different'])
  assert.deepEqual(T('기능 소개를 더 대담하게'), ['section', 'home/workflow-features', 'bolder'])
  assert.deepEqual(T('마지막 행동 유도 띠를 바꿔줘'), ['section', 'home/final-cta', 'different'])
  assert.deepEqual(T('히어로를 더 예쁘게'), ['section', 'home/hero', 'different'], '구획은 정해졌으니 되묻지 않는다')
  assert.deepEqual(T('푸터를 단순하게'), ['section', 'global/footer', 'calmer'])
  assert.deepEqual(L('FAQ를 다른 걸로 바꿔줘'), ['section', 'home/faq', 'different'])
  assert.deepEqual(L('자주 묻는 질문 구획 바꿔줘'), ['section', 'home/faq', 'different'])
  assert.deepEqual(L('히어로를 더 대담하게'), ['section', 'home/hero-visit-info', 'bolder'], '구획 이름은 쪽이 달라도 같은 말로 부른다')
  assert.deepEqual(L('메뉴판을 다르게'), ['section', 'home/menu-price', 'different'])
  // 축
  assert.deepEqual(T('색을 바꿔줘'), ['axis', 'color', 'different'])
  assert.deepEqual(T('change the color palette'), ['axis', 'color', 'different'])
  assert.deepEqual(T('서체를 다른 걸로'), ['axis', 'type', 'different'])
  assert.deepEqual(T('use a different font'), ['axis', 'type', 'different'])
  assert.deepEqual(T('글꼴을 더 차분하게'), ['axis', 'type', 'calmer'])
  assert.deepEqual(T('모션 강도를 낮춰줘'), ['axis', 'motion', 'calmer'])
  assert.deepEqual(T('움직임을 더 강하게'), ['axis', 'motion', 'bolder'])
  assert.deepEqual(T('less motion'), ['axis', 'motion', 'calmer'])
  assert.deepEqual(T('more animation'), ['axis', 'motion', 'bolder'])
  assert.ok(parseRevision('검색 결과가 색다르게 보였으면', site).ask, '「검색」·「색다르게」의 색은 색 축이 아니다 — 되묻는다')
  // 문구
  assert.deepEqual(T('히어로 문구를 더 짧게'), ['copy', 'home/hero', 'shorter'])
  assert.deepEqual(T('히어로 카피를 다시 써줘'), ['copy', 'home/hero', 'different'])
  assert.deepEqual(T('rewrite the hero copy, friendlier'), ['copy', 'home/hero', 'warmer'])
  assert.deepEqual(L('FAQ 문장을 더 정중하게'), ['copy', 'home/faq', 'formal'])
  // 원문이 요청에 남는다(보드에 적는다)
  assert.equal(parseRevision('히어로를 더 대담하게', site).text, '히어로를 더 대담하게')
  // 모자란 정보·충돌은 되묻는다 — 한 번에 하나만
  for (const text of ['문구를 바꿔줘', 'rewrite the copy', '히어로 색을 바꿔줘', '갤러리를 바꿔줘', 'FAQ 바꿔줘', '요금제 구획 바꿔줘', '색이랑 서체 바꿔줘']) {
    const r = parseRevision(text, site)
    assert.ok(r.ask && r.ask.length < 80 && !r.scope, `${text} → ${JSON.stringify(r)}`)
  }
  assert.match(parseRevision('갤러리를 바꿔줘', site).ask, /갤러리|구획/)
})

test('학습 가중치: 앞 순서 기준(못 채움)이 같은 변형 사이에서만 차례를 바꾼다(rankSection, 합성 사이트맵)', async () => {
  const names = ['block-hero-q1', 'block-hero-q2', 'block-hero-q3', 'block-hero-q4', 'block-hero-q5']
  const sm = { archetype: 'saas', pages: [{ id: 'home', route: '/', sections: [{ kind: 'hero', status: 'block', allowedVariants: names }] }], globals: [] }
  const readiness = new Map([['block-hero-q5', 2]]) // q5 는 문구로 못 채운다
  const base = { sitemap: sm, key: 'home/hero', head: 'r1-measure', exclude: [], count: 2, intent: 'different', readiness, leaks: new Map(), seed: 3 }
  const plain = await rankSection(base)
  assert.equal(plain.picks.length, 2)
  assert.notEqual(plain.picks[0], plain.picks[1])
  assert.ok(!plain.picks.includes('block-hero-q5'), '못 채우는 변형은 다른 변형이 있으면 고르지 않는다')
  const order = (await rankSection({ ...base, count: 5 })).picks
  assert.equal(order.length, 5)
  assert.equal(new Set(order).size, 5, '차례로 하나씩 — 되풀이가 없다')
  assert.equal(order.at(-1), 'block-hero-q5')
  const boost = (block) => { let p = emptyPreferences(); for (let i = 0; i < 8; i++) p = recordPick(p, { archetype: 'saas', winner: block, loser: 'block-hero-zz', kind: 'section' }); return p }
  // 같은 무리(q1~q4)의 꼴찌를 올리면 첫 안이 된다
  const lastOfGroup = order[3]
  assert.notEqual(lastOfGroup, plain.picks[0])
  assert.equal((await rankSection({ ...base, preferences: boost(lastOfGroup) })).picks[0], lastOfGroup)
  // 앞 순서 기준이 나쁜 q5 는 가중치를 2 까지 줘도 첫 안이 되지 못한다
  assert.notEqual((await rankSection({ ...base, preferences: boost('block-hero-q5') })).picks[0], 'block-hero-q5')
  // 지금 변형(exclude)은 가중치가 아무리 커도 다시 나오지 않는다
  const ex = await rankSection({ ...base, exclude: [lastOfGroup], preferences: boost(lastOfGroup) })
  assert.ok(!ex.picks.includes(lastOfGroup))
  // 학습이 없거나 모두 1 이면 같은 순서
  assert.deepEqual((await rankSection({ ...base, preferences: emptyPreferences() })).picks, plain.picks)
  // 구획이 아닌 키는 던진다
  await assert.rejects(() => rankSection({ ...base, key: 'home/nothing' }), /블록 섹션이 아니다/)
})

test('boldScore: 움직임 기법이 많고 여유로운 블록이 더 대담하다 — 모르는 블록은 0', () => {
  assert.ok(boldScore('block-hero-punch-in-statement') > boldScore('block-hero-baseline-news-app-window'))
  assert.equal(boldScore('block-nothing-here'), 0)
})

test('CLI 인자: --revise 는 --run 과 --pick 이 있어야 하고 --brief 없이 돈다 · --revise-pick <번호>:<안>', () => {
  const o = parseArgs(['--run', 'out/x', '--pick', 'a', '--revise', '히어로를 더 대담하게'])
  assert.equal(o.revise, '히어로를 더 대담하게')
  assert.equal(o.brief, null)
  assert.deepEqual(parseArgs(['--run', 'out/x', '--pick', 'a', '--revise-pick', '2:v1']).revisePick, { index: 2, id: 'v1' })
  assert.equal(parseArgs(['--run', 'out/x', '--pick', 'a', '--revise', '']).revise, '', '빈 요청은 되묻기로 간다')
  assert.throws(() => parseArgs(['--pick', 'a', '--revise', '히어로']), (e) => e instanceof UsageError && /--run/.test(e.message))
  assert.throws(() => parseArgs(['--run', 'x', '--revise', '히어로']), (e) => e instanceof UsageError && /--pick/.test(e.message))
  assert.throws(() => parseArgs(['--run', 'x', '--pick', 'a', '--revise', '히어로', '--revise-pick', '1:v1']), UsageError)
  assert.throws(() => parseArgs(['--run', 'x', '--pick', 'a', '--revise-pick', 'abc']), (e) => e instanceof UsageError && /번호>:<안/.test(e.message))
  assert.throws(() => parseArgs(['--run', 'x', '--pick', 'a', '--revise', '히어로', '--deploy-preview']), UsageError)
  assert.throws(() => parseArgs(['--run', 'x', '--pick', 'a', '--revise', '히어로', '--brief', 'b.json']), UsageError)
  // 옛 모양은 그대로
  assert.throws(() => parseArgs(['--run', 'x', '--pick', 'a']), UsageError)
  assert.equal(parseArgs(['--brief', 'b.json']).revise ?? null, null)
})
