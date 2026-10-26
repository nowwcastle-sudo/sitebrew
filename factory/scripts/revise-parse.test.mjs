// 구획 단위 수정(factory v1 Task 4.3)의 순수 부분 — 말 → 요청 사상(모호하면 되묻기, Review Focus 4) · 구획 순위 rankSection(학습 가중치는 동점의 꼬리표일 뿐) · 명령줄 인자.
// 실행 폴더·Chrome 이 필요 없다(빠른 시험). 사이트 모양은 06 이 만든 content/site.json 의 섹션 키만 흉내 낸다 — 실제 사이트로 도는 시험은 revise.test.mjs.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boldScore, parseRevision, rankSection } from '../stamp/revise.mjs'
import { emptyPreferences, recordPick } from '../board/preferences.mjs'
import { grammar } from '../vocab/grammar.mjs'
import { designContext } from '../stamp/design-context.mjs'
import { valuePair } from '../stamp/revise-parse.mjs'
import { parseArgs, UsageError } from '../stamp/stamp.mjs'

const siteOf = (keys) => ({ sections: Object.fromEntries(keys.map((k) => [k, { block: 'block-x' }])) })
// saas 사이트(06 결과)의 섹션 키 — 히어로·기능·연동·마지막 행동은 홈과 캠페인에 있고 요금제는 두 곳(pricing 쪽의 pricing-plans · 캠페인의 pricing)이다
const site = siteOf(['home/hero', 'home/workflow-features', 'home/integrations', 'home/final-cta', 'pricing/pricing-plans', 'campaign/hero', 'campaign/workflow-features', 'campaign/integrations', 'campaign/pricing', 'campaign/final-cta', 'signup/auth', 'login/auth', 'billing/paywall', 'global/footer'])
// local 사이트
const localSite = siteOf(['home/hero-visit-info', 'home/notice', 'home/menu-price', 'home/hours-table', 'home/directions', 'home/faq', 'home/contact-form', 'product-detail/booking-cta', 'global/sticky-booking-bar', 'global/footer'])

test('빈 말은 바로 되묻는다 — 질문 하나·80자 미만, 범위는 정하지 않는다(Review Focus 4)', () => {
  for (const text of ['', '   ', undefined, null]) {
    const r = parseRevision(text, site)
    assert.ok(typeof r.ask === 'string' && r.ask.length > 0 && r.ask.length < 80, `${JSON.stringify(text)} → ${JSON.stringify(r)}`)
    assert.deepEqual(Object.keys(r), ['ask'], '되묻는 결과는 질문뿐이다')
  }
})

test('사전이 못 읽는 말은 scope design 에 근사·모름 분류를 싣는다 — 되묻는 일은 revise() 몫이고 질문은 요청 언어로(Review Focus 4)', () => {
  // 옛 표는 낱말 하나 없으면 바로 {ask} 였다. 이제는 사전 분류가 먼저라 {scope: design, classification, text} 이고 classification.ask 가 질문이다.
  for (const text of ['더 예쁘게 해줘', '좀 더 좋게', '다시 해줘', 'make it prettier', 'improve it', '마음에 안 들어']) {
    const r = parseRevision(text, site)
    assert.deepEqual(Object.keys(r), ['scope', 'classification', 'text'], text)
    assert.equal(r.scope, 'design')
    assert.ok(['near', 'unknown'].includes(r.classification.result), `${text} → ${r.classification.result}`)
    assert.ok(r.classification.ask.length > 0 && r.classification.ask.length < 80, r.classification.ask)
  }
  assert.match(parseRevision('더 예쁘게 해줘', site).classification.ask, /[가-힣]/, '한국어 요청에는 한국어로')
  assert.doesNotMatch(parseRevision('make it prettier', site).classification.ask, /[가-힣]/, '영어 요청에는 영어로')
})

test('사전이 읽는 디자인 말은 확정 읽기를 싣는다 — 옛 축 낱말(색·서체·모션)·「크게」 단독이 아니라 사전이 정한다', () => {
  const read = (text) => parseRevision(text, site).classification
  assert.deepEqual([parseRevision('여백 넓게', site).scope, read('여백 넓게').result, read('여백 넓게').readings[0].axis, read('여백 넓게').readings[0].direction], ['design', 'confirmed', 'spacing', 'airy'])
  assert.equal(parseRevision('크게', site).scope, 'design', '「크게」 단독은 옛 표에서는 되묻기였다 — 이제 사전이 글자 크기로 읽는다')
  assert.equal(read('크게').readings[0].axis, 'type-scale')
  assert.equal(read('제목을 크게').readings[0].scope, 'element:제목', '「제목」은 문구 낱말이기도 하지만 사전이 읽은 말은 디자인이다')
  assert.deepEqual([read('색을 초록색으로 바꿔줘').readings[0].axis, read('색을 초록색으로 바꿔줘').readings[0].value], ['color-hue', 'green'])
  assert.deepEqual([read('서체를 명조로 바꿔줘').readings[0].axis, read('서체를 명조로 바꿔줘').readings[0].value], ['type-family', 'serif'])
  assert.equal(read('더 대담하게').result, 'confirmed', '옛 표는 「더 대담하게」를 되물었다 — 사전은 대담함을 읽는다')
  // 사전이 못 읽는 옛 축 말은 확정이 아니다 — revise() 가 되묻는다
  for (const text of ['색을 바꿔줘', '서체를 다른 걸로', '모션 강도를 낮춰줘', 'less motion', '검색 결과가 색다르게 보였으면']) assert.notEqual(read(text).result, 'confirmed', text)
})

test('요청 사상표 — 한국어·영어 구획 이름 · 문구', () => {
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
  // 구획 이름이 붙어도 사전이 읽은 축이 구획 교체로 못 하는 축(색·글꼴·모서리 …)이면 사이트 전체에 적용된다고 되묻는다 — 옛 axisSection 질문과 같다
  const siteWide = grammar.text.ask.siteWide
  for (const text of ['히어로 색을 바꿔줘', '히어로 서체를 바꿔줘', '히어로 모션 바꿔줘', '메인 배너 글꼴 바꿔', '푸터 색 바꿔', '히어로 색을 초록으로', '히어로 색 더 따뜻하게', '히어로 서체를 명조로', '히어로 모서리 둥글게', '히어로 색을 #0B6E4F 로']) assert.deepEqual(parseRevision(text, site), { ask: siteWide.ko }, text)
  // 구획 교체로 할 수 있는 축(대담·차분·글자 크기·움직임)은 예전 그대로 구획 교체 의도다
  assert.deepEqual(T('히어로를 크게'), ['section', 'home/hero', 'bolder'], '「크게」는 구획 이름이 있을 때만 구획 교체 의도다')
  assert.deepEqual(T('히어로를 더 화려하게'), ['section', 'home/hero', 'bolder'])
  assert.deepEqual(T('히어로 글자 크게'), ['section', 'home/hero', 'bolder'])
  assert.deepEqual(T('히어로 움직임 줄여줘'), ['section', 'home/hero', 'calmer'])
  assert.deepEqual(T('히어로 장식 없애줘'), ['section', 'home/hero', 'calmer'])
  // 여백을 구획 범위로 말했으면 구획 교체 계획(sectionPlan)이 밀도로 고른다 — 읽기는 구획·쪽 범위 것만 싣는다
  for (const [text, direction] of [['히어로 여백 넓게', 'airy'], ['히어로 여백을 좁게', 'tight']]) {
    const r = parseRevision(text, site)
    assert.equal(r.scope, 'design', text)
    assert.deepEqual(r.classification.readings.map((x) => [x.axis, x.direction, x.scope]), [['spacing', direction, 'section:hero']], text)
  }
  // 문구
  assert.deepEqual(T('히어로 문구를 더 짧게'), ['copy', 'home/hero', 'shorter'])
  assert.deepEqual(T('히어로 카피를 다시 써줘'), ['copy', 'home/hero', 'different'])
  assert.deepEqual(T('rewrite the hero copy, friendlier'), ['copy', 'home/hero', 'warmer'])
  assert.deepEqual(L('FAQ 문장을 더 정중하게'), ['copy', 'home/faq', 'formal'])
  // 원문이 요청에 남는다(보드에 적는다)
  assert.equal(parseRevision('히어로를 더 대담하게', site).text, '히어로를 더 대담하게')
  // 모자란 정보·충돌은 되묻는다 — 한 번에 하나만
  for (const text of ['문구를 바꿔줘', 'rewrite the copy', '갤러리를 바꿔줘', 'FAQ 바꿔줘', '요금제 구획 바꿔줘']) {
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

// ── 값을 빼 달라는 말 · 섞인 요청 · 요청 언어 · 문구 낱말 순서 ──────────────────────────────────────────

test('값 읽기: 같은 문장에 부정·싫음 낱말이 있으면 값 읽기를 내지 않고 어떤 값인지 되묻는다(옛 negated 와 같다)', () => {
  const ask = grammar.text.ask.valueNegated
  for (const text of ['Noto Serif KR 말고', '#0B6E4F 말고', '#0B6E4F 는 싫어요', '서체는 Pretendard 빼고']) assert.deepEqual(parseRevision(text, site), { ask: ask.ko }, text)
  assert.deepEqual(parseRevision('not #0B6E4F', site), { ask: ask.en }, '요청 언어로 묻는다')
  assert.equal(parseRevision('메인 색을 #0B6E4F 로', site).scope, 'design', '부정 낱말이 없으면 그대로')
})

test('구획·쪽 읽기와 사이트 전체 읽기가 한 문장에 섞이면 한 번에 하나씩 묻는다 — 한쪽을 조용히 버리지 않는다', () => {
  // 사이트 전체를 분명히 말한 읽기가 구획 읽기와 섞이면 한 번에 하나씩
  assert.deepEqual(parseRevision('히어로 글자 크게 하고 전체 색은 초록으로', site), { ask: grammar.text.ask.oneKindAtATime.ko })
  assert.deepEqual(parseRevision('make the hero bigger and the whole site color green', site), { ask: grammar.text.ask.oneKindAtATime.en })
  // 구획 이름 바로 뒤의 전체(「히어로 전체」)는 그 구획 전체지 사이트 전체가 아니다 — 「전체 색」은 사이트 전체
  assert.deepEqual([parseRevision('히어로 전체를 대담하게', site).scope, parseRevision('히어로 전체를 대담하게', site).intent], ['section', 'bolder'])
  assert.deepEqual(parseRevision('히어로 글자 크게 하고 전체 색은 초록으로', site), { ask: grammar.text.ask.oneKindAtATime.ko })
  // 구획 이름이 하나뿐이면 범위 없이 읽힌 읽기도 그 구획의 것이다 — 구획 교체로 못 하는 축(색)을 따로 말하면 사이트 전체 질문
  for (const text of ['히어로 글자 크게 하고 색은 초록으로', '히어로 여백 넓게 하고 색은 초록으로']) assert.deepEqual(parseRevision(text, site), { ask: grammar.text.ask.siteWide.ko }, text)
  // 둘 다 구획 교체로 할 수 있으면 한 요청이다 — 대담한 쪽 + 여백(밀도)
  for (const text of ['히어로 글자 크게 하고 여백 넓게', '히어로 여백 넓게 하고 글자 크게']) {
    const r = parseRevision(text, site)
    assert.equal(r.scope, 'design', text)
    assert.deepEqual(r.classification.readings.map((x) => [x.axis, x.scope]).sort(), [['spacing', 'section:hero'], ['type-scale', 'section:hero']], text)
  }
  assert.equal(parseRevision('히어로 여백 넓게', site).scope, 'design', '같은 축이 사이트 전체로도 읽힌 것(여백 넓게 ×2)은 섞임이 아니다')
})

test('되묻는 글은 요청 언어를 따른다 — 영어 문장은 영어로, 한글이 있으면 한국어로', () => {
  const T = grammar.text.ask
  assert.deepEqual(parseRevision('make the hero color green', site), { ask: T.siteWide.en })
  assert.deepEqual(parseRevision('히어로 색을 초록으로', site), { ask: T.siteWide.ko })
  assert.deepEqual(parseRevision('background is too white', site), { ask: T.otherRole.en })
  assert.deepEqual(parseRevision('make the background green', site), { ask: T.otherRole.en })
  assert.deepEqual(parseRevision('배경색을 초록으로', site), { ask: T.otherRole.ko })
  assert.ok(Object.values(T).every((p) => p.ko && p.en))
})

test('문구 낱말·여러 요청 확인이 값 읽기보다 먼저다 — 옛 순서: 한 번에 하나씩 · 문구면 구획을 묻는다', () => {
  assert.deepEqual(parseRevision('메인 색을 #0B6E4F 로 하고 서체는 명조로', site), { ask: grammar.text.ask.oneAxisAtATime.ko }, '색과 서체를 함께 말하면 한 번에 하나씩 묻는다(조용히 하나를 버리지 않는다)')
  assert.deepEqual(parseRevision('색이랑 서체 바꿔줘', site), { ask: grammar.text.ask.oneAxisAtATime.ko })
  assert.deepEqual(parseRevision('change the color and the font', site), { ask: grammar.text.ask.oneAxisAtATime.en })
  assert.match(parseRevision('Ultra bold headline', site).ask, /copy should change/, '문구 낱말뿐이고 축 이름이 없으면 서체 이름(Ultra)으로 읽지 않는다')
  assert.equal(parseRevision('제목을 크게', site).scope, 'design', '문구 낱말이 요소(제목)로 읽히면 디자인이다')
  assert.equal(parseRevision('제목 서체를 Sora 로', site).scope, 'design', '축 이름(서체)이 있으면 서체 이름을 읽는다')
})

test('한 축에서 서로 다른 값을 둘 말하면(빨강이랑 파랑) 두 값을 모두 읽는다 — 되묻지 않고 planReadings 가 값마다 한 안으로 낸다', () => {
  for (const text of ['색을 빨강이랑 파랑으로', 'color red or blue']) {
    const c = parseRevision(text, site).classification
    assert.equal(c.result, 'confirmed', text)
    assert.deepEqual(c.readings.map((r) => [r.axis, r.value]), [['color-hue', 'red'], ['color-hue', 'blue']], text)
    assert.ok(c.say.length > 0)
  }
  assert.ok(parseRevision('색을 빨강 말고 파랑으로', site).classification.readings.some((r) => r.cap), '값을 빼 달라는 말은 이 길이 아니다(상한 읽기)')
})

test('후보 둘이 같은 구획 범위의 여백끼리면 밀도 길로 간다(두 해석이 안 a·b) — 아니면 예전 그대로', () => {
  const { lex, examples, cfg } = designContext()
  const clone = structuredClone(lex)
  const entry = clone.entries.find((e) => e.label === '답답함')
  const cause = (axis, direction) => ({ reading: [{ axis, direction, strength: 1 }], say: '여백', sayEn: 'spacing' }) // 범위는 「히어로」 낱말이 구획 범위로 붙인다
  entry.causes = [cause('spacing', 'airy'), cause('spacing', 'tight')]
  const same = parseRevision('히어로가 답답해', site, { lex: clone, examples, cfg })
  assert.deepEqual([same.scope, same.classification.result], ['design', 'two'])
  entry.causes = [cause('spacing', 'airy'), cause('type-scale', 'larger')]
  const other = parseRevision('히어로가 답답해', site, { lex: clone, examples, cfg })
  assert.equal(other.scope, 'section', '둘 다 여백이 아닌 후보 둘은 예전 그대로 구획 교체 사상')
})

test('구획 이름 + 문구 낱말 + 축 이름이면 축이 먼저다 — 문구 요청이 아니라 옛 질문(사이트 전체)이다', () => {
  for (const text of ['히어로 제목 서체를 Sora 로', '히어로 제목 색을 #0B6E4F 로']) assert.deepEqual(parseRevision(text, site), { ask: grammar.text.ask.siteWide.ko }, text)
  assert.equal(parseRevision('히어로 문구를 더 짧게', site).scope, 'copy', '축 이름이 없으면 문구 요청 그대로')
})

test('valuePair: 해석기가 실어 준 부딪친 읽기(clash)를 그대로 쓴다 — 같은 축·같은 범위의 값 둘만, 상한·다른 범위·같은 값은 이 길이 아니다', () => {
  const { lex } = designContext()
  const v = (value, o = {}) => ({ axis: 'color-hue', value, strength: 1, scope: 'site', source: `hue-${value}`, ...o })
  const unknown = (clash) => ({ result: 'unknown', ask: '?', choices: [], clash })
  const pair = valuePair(unknown([v('red'), v('blue')]), lex, '')
  assert.deepEqual([pair.result, pair.readings.map((r) => r.value), pair.sources], ['confirmed', ['red', 'blue'], ['hue-red', 'hue-blue']])
  assert.equal(valuePair(unknown([v('red'), v('blue')]), lex, '빨강 말고 파랑'), null, '값을 빼 달라는 말')
  assert.equal(valuePair(unknown([v('red', { cap: true, strength: 0 }), v('blue')]), lex, ''), null, '상한 읽기')
  assert.equal(valuePair(unknown([v('red', { scope: 'element:버튼' }), v('blue')]), lex, ''), null, '범위가 다른 둘')
  assert.equal(valuePair(unknown([v('red'), v('red')]), lex, ''), null, '같은 값')
  assert.equal(valuePair(unknown([v('red'), { axis: 'contrast', direction: 'crisp', strength: 1, scope: 'site', source: 'x' }]), lex, ''), null, '다른 축/방향 읽기')
  assert.equal(valuePair(unknown([v('red')]), lex, ''), null)
  assert.equal(valuePair({ result: 'unknown', ask: '?', choices: ['a', 'b'] }, lex, ''), null, 'clash 가 없는 되물음(문구 일치로는 찾지 않는다)')
  assert.equal(valuePair({ result: 'confirmed', readings: [] }, lex, ''), null)
  // 실제 문장: 한 축의 값 둘은 두 값을 모두 읽는다
  for (const text of ['서체를 명조랑 고딕으로', 'use a serif or sans font']) {
    const c = parseRevision(text, site).classification
    assert.deepEqual([c.result, c.readings.map((r) => r.value)], ['confirmed', ['serif', 'sans']], text)
  }
})

test('원래 값→바뀔 값을 말하면(빨강을 파랑으로 · 초록에서 파랑으로) 바뀔 값 하나만 읽는다 — 원래 값은 안 a 가 되지 않는다', () => {
  for (const text of ['빨간색을 파란색으로 바꿔줘', '초록색에서 파란색으로', '메인 색을 빨강에서 파랑으로', 'change red to blue', 'from red to blue', 'switch green to blue', '빨간 색을 파란색으로 바꿔줘', '빨간 색에서 파란 색으로', '빨간색을 좀 더 파란색으로', '빨간색 대신 파란색으로', '메인 색을 빨간 색 대신 파란 색으로']) {
    const c = parseRevision(text, site).classification
    assert.equal(c.result, 'confirmed', text)
    assert.deepEqual(c.readings.map((r) => [r.axis, r.value]), [['color-hue', 'blue']], `${text} → 바뀔 값만`)
  }
})

test('나란히 말한 값(빨강이랑 파랑 · 빨강이나 파랑 · red and blue)은 그대로 두 값이다 — 원래→바뀔 틀이 아니다', () => {
  for (const text of ['빨강이랑 파랑', '빨강이나 파랑', '메인 색을 빨강이랑 파랑으로', 'red and blue']) {
    const c = parseRevision(text, site).classification
    assert.deepEqual(c.readings.map((r) => r.value), ['red', 'blue'], text)
  }
})

test('구획 이름이 붙은 말은 사전이 읽은 방향이 구획 뜻을 정한다 — 「덜 화려하게」는 차분, 낱말 표(화려 → 대담)는 읽은 것이 없을 때만', () => {
  const hero = (text) => parseRevision(text, site)
  assert.equal(hero('히어로 덜 화려하게').intent, 'calmer', '낱말 표만 보면 화려 → bolder 였다')
  assert.equal(hero('히어로 더 화려하게').intent, 'bolder')
  assert.equal(hero('히어로 더 차분하게').intent, 'calmer')
  assert.equal(hero('히어로 크게').intent, 'bolder')
  // 읽은 것이 없을 때 낱말 표는 방향을 추측하지 않는다 — 대담/차분 낱말이 함께 있거나 덜·않 같은 뒤집는 말이 붙으면 묻는다(반대로 읽지 않는다)
  assert.equal(hero('히어로 덜 대담하게').ask, grammar.text.ask.intentUnclear.ko)
  assert.equal(hero('히어로 대담하지 않게').ask, grammar.text.ask.intentUnclear.ko)
  assert.equal(parseRevision('make the hero less bold', site).ask, grammar.text.ask.intentUnclear.en)
  // 읽은 것이 없으면 낱말 표
  assert.equal(hero('히어로 확 바꿔줘').intent, 'different')
  assert.equal(hero('히어로를 과감하게').intent, 'bolder')
  // 요청에 읽기를 실어 --explain 이 보인다 — 구획 범위로 읽혀 있다
  const r = hero('히어로 덜 화려하게')
  assert.deepEqual([r.scope, r.target], ['section', 'home/hero'])
  assert.ok(r.classification.readings.length >= 1 && r.classification.readings.every((x) => x.scope === 'section:hero'))
})
