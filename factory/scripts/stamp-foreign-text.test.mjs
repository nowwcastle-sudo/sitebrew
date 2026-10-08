// 다른 언어·다른 사업의 화면 문구(대장 C359 · C333 와 겹침 — 문구 칸 설계 없이 새는 길만 막는다).
// 골든 실측: 영어 사이트(saas-2·pwa-2·portfolio-2)의 제품 화면·머리글 이름표가 통째로 한국어였고, 한국어 saas-1·pwa-1 온보딩·빈 화면에 예약·일정 사업의 문구
// (「손님 예약 받기」·「쓰던 예약 장부 옮기기」·「예약 페이지 만들기」)가 그대로 나가는데 08-board blockers 에는 아무것도 없었다(제품 화면 블록은 누설 대조가 안 보는 종류).
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/stamp-foreign-text.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BLOCKER, bindSection } from '../stamp/gen-pages.mjs'
import { contentTextsOf, foreignTextIssue, leaves } from '../stamp/site-bind.mjs'

const leaf = (path, value, ref = null) => ({ path, value, ref })
const routes = { home: '/', pricing: '/pricing', signup: '/signup' }
const bindIn = (block, content, locale) =>
  bindSection({ key: 'onboarding/onboarding', block, content, copyIndex: new Map(), routes, locale, navLinks: () => [{ label: 'Home', href: '/' }], primaryCta: () => ({ href: '/signup' }), secondaryHref: () => '/pricing' })

test('BLOCKER.foreign 접두가 정해져 있다(OWN_PREFIXES 에 들어 이 단계가 자기 줄만 바꾼다)', () => {
  assert.equal(BLOCKER.foreign, '공개 불가 — 다른 언어·다른 사업의 화면 문구 남음: ')
})

test('영어 사이트: 콘텐츠($ref)로 안 묶인 한글 글이 있으면 어느 블록 종류든 사유 · 한글이 $ref 값이거나 영어뿐이면 아니다', () => {
  const list = [leaf('copy.label', '첫 화면'), leaf('copy.title', 'Welcome'), leaf('copy.name', '모아', 'business.name')]
  const r = foreignTextIssue(list, { locale: 'en', kind: 'hero' })
  assert.equal(r.why, 'locale')
  assert.equal(r.count, 1, '$ref 로 묶인 한글(콘텐츠 값)까지 셌다')
  assert.equal(r.sample, '첫 화면')
  assert.equal(foreignTextIssue([leaf('copy.title', 'Welcome'), leaf('copy.cta', 'Get started')], { locale: 'en', kind: 'hero' }), null)
  // 한국어 사이트의 한글은 당연하다
  assert.equal(foreignTextIssue([leaf('copy.label', '첫 화면')], { locale: 'ko', kind: 'hero' }), null)
})

test('한국어 사이트: 제품 화면 블록에 예약 사업 문구가 남고 콘텐츠에 그 말이 없으면 사유 · 콘텐츠가 그 말을 쓰면(예약 앱) 아니다', () => {
  const list = [leaf('copy.question.options.0.label', '손님 예약 받기'), leaf('copy.take.action.label', '예약 페이지 만들기'), leaf('copy.title', '무엇부터 할까요?')]
  const none = contentTextsOf({ product: { name: '견적노트' }, slots: { copy: [{ text: '견적서를 링크로 보내요' }] } })
  const r = foreignTextIssue(list, { locale: 'ko', kind: 'onboarding', contentTexts: none })
  assert.equal(r.why, 'biz')
  assert.equal(r.count, 2)
  assert.ok(r.words.includes('손님') && r.words.some((w) => w.startsWith('예약 ')), JSON.stringify(r.words))
  // 콘텐츠가 예약·손님을 말하는 사업이면 같은 문구도 이 사업의 말이다
  const booking = contentTextsOf({ product: { name: '예약노트' }, slots: { copy: [{ text: '손님이 고른 시간이 달력에 들어와요' }] } })
  assert.equal(foreignTextIssue(list, { locale: 'ko', kind: 'onboarding', contentTexts: booking }), null)
  // 일정·방문·장부 중 하나만 말해도 예약·일정 사업이다 — 같은 도메인의 문구는 이 사업의 말
  for (const w of ['일정', '방문', '장부', '손님']) assert.equal(foreignTextIssue(list, { locale: 'ko', kind: 'onboarding', contentTexts: new Set([`${w}을 관리해요`]) }), null, w)
})

test('음성 대조: 어느 서비스에나 있는 말(「해지 예약」·「PDF·엑셀」)과 제품 화면 밖 블록은 걸리지 않는다', () => {
  const generic = [leaf('status.canceled', '해지 예약'), leaf('1.target', 'PDF·엑셀'), leaf('copy.title', '결제 관리'), leaf('copy.body', '방문 기록을 모아도 될까요?')]
  assert.equal(foreignTextIssue(generic, { locale: 'ko', kind: 'account', contentTexts: new Set() }), null)
  // 같은 예약 문구라도 제품 화면 종류가 아니면(히어로·FAQ 는 leakIssues 가 맡는다) 이 검사 대상이 아니다
  assert.equal(foreignTextIssue([leaf('copy.title', '손님 예약 받기')], { locale: 'ko', kind: 'hero', contentTexts: new Set() }), null)
})

test('실제 블록: onboarding setup-wizard·checklist-panel 한국어 예시는 사업 중립이라 더는 안 잡히고(FOLLOW·FINAL-WF2 AB16), 영어 사이트에서는 한글 잎으로 잡힌다', async () => {
  const content = { archetype: 'saas', locale: 'ko', product: { name: '견적노트' }, slots: { copy: [], images: [] } }
  const wizard = await bindIn('block-onboarding-setup-wizard', content, 'ko')
  assert.equal(foreignTextIssue(leaves(wizard.props), { locale: 'ko', kind: 'onboarding', contentTexts: contentTextsOf(content) }), null, 'FOLLOW: setup-wizard 한국어 예시는 사업 중립이다')
  const ko = await bindIn('block-onboarding-checklist-panel', content, 'ko')
  assert.ok(ko.props, ko.why)
  assert.equal(foreignTextIssue(leaves(ko.props), { locale: 'ko', kind: 'onboarding', contentTexts: contentTextsOf(content) }), null, 'FINAL-WF2 AB16: checklist-panel 한국어 예시도 사업 중립이다')
  const en = foreignTextIssue(leaves(ko.props), { locale: 'en', kind: 'onboarding', contentTexts: contentTextsOf(content) })
  assert.ok(en && en.why === 'locale' && en.count >= 3, JSON.stringify(en))
})
