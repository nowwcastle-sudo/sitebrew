// 구획 구조 조작(FIT-1) — 「후기 섹션 추가해줘」·「FAQ 빼줘」·「위치를 히어로 바로 아래로 올려줘」가 section 교체(다른 변형)로 잘못 사상되던 길을 막는다.
// parseRevision 의 순수 시험(실행 폴더·Chrome 없음): 말 → { scope: add|remove|order } 또는 되묻기. 구획 이름이 없는 말·기존 section/axis/copy 사상은 그대로여야 한다(회귀).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRevision } from '../stamp/revise.mjs'

const siteOf = (archetype, keys) => ({ archetype, sections: Object.fromEntries(keys.map((k) => [k, { block: 'block-x' }])) })
// 대표 감사의 사이트 구획: hero · menu · hours · location · faq · footer (local 원형의 실제 섹션 이름)
const local = siteOf('local', ['home/hero-visit-info', 'home/menu-price', 'home/hours-table', 'home/directions', 'home/faq', 'global/footer'])
const saas = siteOf('saas', ['home/hero', 'home/social-proof', 'home/workflow-features', 'home/integrations', 'home/faq', 'home/final-cta', 'pricing/pricing-plans', 'campaign/hero', 'campaign/final-cta', 'global/footer'])
const P = (text, site = local) => parseRevision(text, site)
const brief = (r) => [r.scope, r.target]

test('구획 더하기 — 사이트에 없는 선택 구획이면 add (한국어·영어)', () => {
  assert.deepEqual(brief(P('후기 섹션 추가해줘')), ['add', 'home/external-reviews'])
  assert.deepEqual(brief(P('후기 넣어줘')), ['add', 'home/external-reviews'])
  assert.deepEqual(brief(P('add a reviews section')), ['add', 'home/external-reviews'])
  assert.deepEqual(brief(P('add reviews')), ['add', 'home/external-reviews'])
  assert.deepEqual(brief(P('지점 안내를 더해줘')), ['add', 'home/branches'])
  assert.deepEqual(brief(P('후기 섹션 추가해줘', saas)), ['add', 'home/testimonials'], '이미 있는 구획(social-proof)이 아니라 없는 구획(testimonials)을 더한다')
  assert.equal(P('후기 섹션 추가해줘').intent, 'add')
  assert.equal(P('후기 섹션 추가해줘').text, '후기 섹션 추가해줘')
})

test('구획 더하기 — 이미 있거나 이 원형이 받을 수 없으면 정직하게 되묻는다(엉뚱한 구획 교체 없음)', () => {
  const asks = [
    ['FAQ 추가해줘', local, /이미/], // 이미 있는 구획
    ['메뉴 추가해줘', saas, /더할 수 있는/], // saas 원형에는 없는 구획
    ['add a menu section', saas, /can add|Sections you can add/i],
    ['갤러리 추가해줘', local, /더할 수 있는/], // 본문으로 그리는 구획은 이 길로 더하지 않는다
    ['섹션 추가해줘', local, /더할 수 있는/], // 어떤 구획인지 모름
  ]
  for (const [text, site, re] of asks) {
    const r = P(text, site)
    assert.deepEqual(Object.keys(r), ['ask'], `${text} → ${JSON.stringify(r)}`)
    assert.ok(r.ask.length < 80, `${text}: ${r.ask.length}자`)
    assert.match(r.ask, re, text)
  }
  assert.match(P('add a menu section', saas).ask, /^[\x00-\x7F…]+$/, '영어 요청에는 영어로')
  assert.match(P('메뉴 추가해줘', saas).ask, /[가-힣]/)
})

test('구획 빼기 — 선택 구획이면 remove, 필수 구획이면 꼭 있어야 한다고 되묻는다', () => {
  assert.deepEqual(brief(P('FAQ 빼줘')), ['remove', 'home/faq'])
  assert.deepEqual(brief(P('자주 묻는 질문 삭제해줘')), ['remove', 'home/faq'])
  assert.deepEqual(brief(P('영업시간 지워줘')), ['remove', 'home/hours-table'])
  assert.deepEqual(brief(P('영업시간 구획 없애줘')), ['remove', 'home/hours-table'])
  assert.deepEqual(brief(P('remove the FAQ')), ['remove', 'home/faq'])
  assert.deepEqual(brief(P('delete the opening hours')), ['remove', 'home/hours-table'])
  assert.deepEqual(brief(P('drop the faq section')), ['remove', 'home/faq'])
  assert.equal(P('FAQ 빼줘').intent, 'remove')
  for (const text of ['히어로 빼줘', '푸터 없애줘', '메뉴 삭제해줘', 'remove the hero', 'delete the menu']) {
    const r = P(text)
    assert.deepEqual(Object.keys(r), ['ask'], `${text} → ${JSON.stringify(r)}`)
    assert.ok(r.ask.length < 80)
    assert.match(r.ask, text.match(/[가-힣]/) ? /꼭 있어야/ : /must/i, text)
  }
  assert.ok(P('가격 빼줘', saas).ask, '필수 구획(요금제 쪽 pricing-plans)은 뺄 수 없다')
})

test('구획 순서 — 같은 쪽 안에서 옮기기 order, 히어로는 처음·푸터는 끝 고정', () => {
  assert.deepEqual(P('위치를 히어로 바로 아래로 올려줘'), { scope: 'order', target: 'home/directions', anchor: 'home/hero-visit-info', place: 'after', intent: 'order', text: '위치를 히어로 바로 아래로 올려줘' })
  assert.deepEqual(brief(P('move location below the hero')), ['order', 'home/directions'])
  assert.equal(P('move location below the hero').anchor, 'home/hero-visit-info')
  assert.equal(P('move location below the hero').place, 'after')
  const hoursAboveMenu = P('영업시간을 메뉴 위로 옮겨줘')
  assert.deepEqual([hoursAboveMenu.scope, hoursAboveMenu.target, hoursAboveMenu.anchor, hoursAboveMenu.place], ['order', 'home/hours-table', 'home/menu-price', 'before'])
  const faqAfterMenu = P('FAQ를 메뉴 다음으로')
  assert.deepEqual([faqAfterMenu.scope, faqAfterMenu.target, faqAfterMenu.anchor, faqAfterMenu.place], ['order', 'home/faq', 'home/menu-price', 'after'])
  const faqBeforeHours = P('put the FAQ before the hours')
  assert.deepEqual([faqBeforeHours.scope, faqBeforeHours.target, faqBeforeHours.anchor, faqBeforeHours.place], ['order', 'home/faq', 'home/hours-table', 'before'])
  // 처음·끝
  const faqLast = P('FAQ를 맨 아래로 내려줘')
  assert.deepEqual([faqLast.scope, faqLast.target, faqLast.anchor, faqLast.place], ['order', 'home/faq', null, 'end'])
  const hoursFirstButHero = P('영업시간을 맨 위로 올려줘')
  assert.deepEqual(Object.keys(hoursFirstButHero), ['ask'], '히어로가 처음에 고정이라 맨 위에는 둘 수 없다')
  assert.match(hoursFirstButHero.ask, /히어로/)
  // 어기면 되묻는다: 히어로를 옮기기 · 히어로 위로 · 푸터(전역) 옮기기 · 한 구획만 말하고 어디인지 없음 · 다른 쪽 구획
  for (const text of ['히어로를 FAQ 아래로 옮겨줘', 'FAQ를 히어로 위로 올려줘', '푸터를 메뉴 위로 올려줘', '메뉴를 위로 올려줘', 'move the hero below the faq', 'move the faq above the hero']) {
    const r = P(text)
    assert.deepEqual(Object.keys(r), ['ask'], `${text} → ${JSON.stringify(r)}`)
    assert.ok(r.ask.length < 80, text)
  }
  assert.deepEqual(Object.keys(P('가격 구획을 히어로 아래로 옮겨줘', saas)), ['ask'], '요금제 쪽(pricing)과 홈은 다른 쪽이다')
})

test('더하면서 자리 말하기 — 「후기를 FAQ 아래에 추가」는 그 자리에 더한다', () => {
  const r = P('후기를 메뉴 아래에 추가해줘')
  assert.deepEqual([r.scope, r.target, r.anchor, r.place], ['add', 'home/external-reviews', 'home/menu-price', 'after'])
})

test('회귀 — 구획 이름이 없는 말과 기존 section·axis·copy 사상은 그대로다', () => {
  // 구조 낱말이 없을 때: 기존과 똑같다
  assert.deepEqual(P('히어로를 더 대담하게'), { scope: 'section', target: 'home/hero-visit-info', intent: 'bolder', text: '히어로를 더 대담하게' })
  assert.deepEqual(P('FAQ 문구 짧게'), { scope: 'copy', target: 'home/faq', intent: 'shorter', text: 'FAQ 문구 짧게' })
  assert.deepEqual(Object.keys(P('장식 없애줘')), ['ask'], '구획 이름 없는 「없애줘」는 지금처럼 되묻는다')
  assert.equal(P('장식 없애줘').ask, '어느 부분을 바꿀까요? 구획(예: 히어로)·색/서체/모션·문구 중 하나를 알려 주세요.')
  assert.deepEqual(P('히어로 장식 없애줘'), { scope: 'section', target: 'home/hero-visit-info', intent: 'calmer', text: '히어로 장식 없애줘' }, '장식을 줄이라는 말은 구획 삭제가 아니다')
  assert.deepEqual(P('FAQ를 다른 걸로 바꿔줘'), { scope: 'section', target: 'home/faq', intent: 'different', text: 'FAQ를 다른 걸로 바꿔줘' })
  assert.deepEqual(P('swap the hero'), { scope: 'section', target: 'home/hero-visit-info', intent: 'different', text: 'swap the hero' })
  assert.deepEqual(P('색을 바꿔줘'), { scope: 'axis', target: 'color', intent: 'different', text: '색을 바꿔줘' })
  assert.deepEqual(P('모션 강도를 낮춰줘'), { scope: 'axis', target: 'motion', intent: 'calmer', text: '모션 강도를 낮춰줘' })
  assert.deepEqual(P('히어로 문구를 더 짧게'), { scope: 'copy', target: 'home/hero-visit-info', intent: 'shorter', text: '히어로 문구를 더 짧게' })
  assert.deepEqual(Object.keys(P('더 예쁘게 해줘')), ['ask'])
  // 원형을 모르는 사이트(archetype 칸 없음)에서는 더하기를 판단할 수 없어 예전처럼 되묻는다 — 엉뚱한 교체로 가지 않는다
  const noArch = { sections: { 'home/hero': { block: 'b' }, 'home/faq': { block: 'b' } } }
  assert.deepEqual(Object.keys(parseRevision('후기 섹션 추가해줘', noArch)), ['ask'])
  assert.deepEqual(parseRevision('FAQ 빼줘', noArch).scope, 'remove', '빼기는 원형을 몰라도 사이트에 있는 구획이면 말뜻이 분명하다')
})
