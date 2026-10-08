// P3-4 일관성 레인(P4CON) — 사이트 안 어긋남: 법정 링크 앵커(수정 2)·예시 문구 새는 곳(수정 3)·철회 정책 ↔ 결제 화면(수정 4)·쿠키 항목 ↔ 처리방침(수정 5).
// 정적 생성(install: false) — 설치·빌드 없음. 실제 원형·블록·콘텐츠 스키마를 쓴다.
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/stamp-consistency.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bindSection } from '../stamp/gen-pages.mjs'
import { applyWithdrawalPolicy, cookieCategoriesOf, linkLegalRoutes, LEGAL_ANCHORS, sectionsWithWithdrawalNotice } from '../stamp/site-consistency.mjs'
import { leaves } from '../stamp/site-bind.mjs'
import { draftLegalPages } from '../legal/drafts.mjs'
import { root, SAAS_BRIEF, saasContent, makeRun as makeRunIn, gen } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'stamp-consistency-test')
const makeRun = (brief, contentFor, opts) => makeRunIn(TMP, brief, contentFor, opts)
const siteOf = (s) => JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
const ROUTES = { home: '/', pricing: '/pricing', signup: '/signup', privacy: '/privacy', terms: '/terms', refund: '/refund', withdrawal: '/withdrawal' }

// ── 수정 2: 법정 링크 ───────────────────────────────────────────────────────
test('linkLegalRoutes: 법정 앵커(#terms·#privacy·#refund·#withdrawal)만 사이트맵 경로로 잇고 다른 앵커는 그대로 둔다', () => {
  const props = { copy: { terms: { href: '#terms', view: '약관 보기' }, privacy: { href: '#privacy' }, more: [{ href: '#refund' }, { href: '#withdrawal' }], other: { href: '#sign-in' }, note: '#terms 는 글 안의 말' } }
  const { linked, dead } = linkLegalRoutes(props, ROUTES)
  assert.deepEqual(props.copy.terms, { href: '/terms', view: '약관 보기' })
  assert.equal(props.copy.privacy.href, '/privacy')
  assert.deepEqual(props.copy.more, [{ href: '/refund' }, { href: '/withdrawal' }])
  assert.equal(props.copy.other.href, '#sign-in', '법정 앵커가 아닌 것은 건드리지 않는다')
  assert.equal(props.copy.note, '#terms 는 글 안의 말', '값 전체가 앵커일 때만')
  assert.equal(linked.length, 4)
  assert.deepEqual(dead, [])
  assert.deepEqual(Object.values(LEGAL_ANCHORS).sort(), ['privacy', 'refund', 'terms', 'withdrawal'])
})

test('linkLegalRoutes: 사이트맵에 그 법정 쪽이 없으면 앵커를 그대로 두고 dead 로 돌려준다(공개 불가 사유)', () => {
  const props = { a: { href: '#terms' }, b: { href: '#privacy' } }
  const { linked, dead } = linkLegalRoutes(props, { home: '/', privacy: '/privacy' })
  assert.equal(props.a.href, '#terms')
  assert.equal(props.b.href, '/privacy')
  assert.equal(linked.length, 1)
  assert.deepEqual(dead, [{ path: 'a.href', anchor: '#terms', page: 'terms' }])
})

test('bindSection: 가입 동의·결제 제안·쿠키 띠의 법정 링크가 실제 경로가 된다', async () => {
  const bind = (block, routes = ROUTES) => bindSection({ key: 'x/y', block, content: { archetype: 'saas', locale: 'ko' }, copyIndex: new Map(), routes, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: '/signup' }), secondaryHref: () => '/pricing' })
  const signup = await bind('block-auth-sign-up-consents')
  assert.equal(signup.props.copy.terms.href, '/terms')
  assert.equal(signup.props.copy.privacy.href, '/privacy')
  assert.deepEqual(signup.deadLinks, [])
  const pay = await bind('block-paywall-upgrade-modal')
  assert.equal(pay.props.copy.offer.termsHref, '/terms')
  assert.equal(pay.props.copy.offer.privacyHref, '/privacy')
  const banner = await bind('block-consent-bottom-banner')
  assert.equal(banner.props.copy.policy.href, '/privacy')
  assert.equal(banner.props.copy.settings.href, '#cookie-settings', '쿠키 설정 앵커는 법정 쪽이 아니다')
  // 음성 대조: 법정 쪽이 없는 사이트맵이면 앵커가 남고 dead 로 잡힌다
  const dead = await bind('block-auth-sign-up-consents', { home: '/' })
  assert.equal(dead.props.copy.terms.href, '#terms')
  assert.deepEqual(dead.deadLinks.map((d) => d.page).sort(), ['privacy', 'terms'])
})

test('생성한 saas 사이트: 법정 앵커가 하나도 남지 않고, 법정 경로 링크는 모두 사이트에 있는 쪽이다', async () => {
  const r = await makeRun(SAAS_BRIEF, saasContent)
  const s = await gen(r)
  const site = siteOf(s)
  const all = leaves(site.sections).filter((l) => typeof l.value === 'string')
  assert.deepEqual(all.filter((l) => /^#(?:terms|privacy|refund|withdrawal)$/.test(l.value.trim())).map((l) => l.path), [], '앵커가 남았다')
  const legalLinks = all.filter((l) => /^\/(?:terms|privacy|refund|withdrawal)$/.test(l.value))
  assert.ok(legalLinks.length >= 3, `법정 링크 ${legalLinks.length}개 — 가입·결제·푸터에서 이어진다`)
  for (const l of legalLinks) assert.ok(s.routes.includes(l.value), `${l.path} → ${l.value} 쪽이 없다`)
  for (const route of ['/terms', '/privacy']) assert.ok(existsSync(join(s.siteDir, 'app', route.slice(1), 'page.tsx')), route)
  assert.equal(s.blockers.some((b) => b.startsWith('공개 불가 — 법정 링크')), false, s.blockers.join('\n'))
})

// ── 수정 4: 철회 정책 ↔ 결제 화면 ─────────────────────────────────────────────
const policyRun = (legal) => makeRun(SAAS_BRIEF, saasContent, { patch: (c) => ({ ...c, ...(legal ? { legal } : {}) }) })
const refundLimits = (site) => site.legal.refund.clauses.find((c) => c.title === '철회가 제한되는 경우')?.text ?? ''
const withdrawalLimits = (site) => site.legal.withdrawal.clauses.find((c) => c.title === '철회가 제한되는 경우')?.text ?? ''

test('applyWithdrawalPolicy: full 이면 결제 제안의 철회 고지·체크 칸만 뺀다, limited·미정이면 그대로', () => {
  const mk = () => ({ 'billing/paywall': { block: 'b', props: { copy: { offer: { termsHref: '/terms', withdrawal: { notice: 'n', consentLabel: 'c', consentRequired: 'r' } } } } }, 'cancel/retention': { block: 'c', props: { copy: { offer: { title: '대안' } } } } })
  const full = mk()
  assert.deepEqual(applyWithdrawalPolicy(full, 'full'), ['billing/paywall'])
  assert.equal('withdrawal' in full['billing/paywall'].props.copy.offer, false)
  assert.equal(full['billing/paywall'].props.copy.offer.termsHref, '/terms')
  assert.deepEqual(full['cancel/retention'].props.copy.offer, { title: '대안' }, '해지 대안 제안은 건드리지 않는다')
  for (const p of ['limited', undefined, '']) {
    const keep = mk()
    assert.deepEqual(applyWithdrawalPolicy(keep, p), [])
    assert.equal(sectionsWithWithdrawalNotice(keep).length, 1)
  }
})

test('철회 정책 full: 결제 화면에 철회 고지·필수 체크가 없고 환불·철회 쪽은 「이용 여부와 상관없이 철회」 — 서로 어긋나지 않는다', async () => {
  const s = await gen(await policyRun({ withdrawalPolicy: 'full' }))
  const site = siteOf(s)
  assert.deepEqual(s.withdrawalStripped, ['billing/paywall'])
  assert.deepEqual(sectionsWithWithdrawalNotice(site.sections), [])
  assert.match(refundLimits(site), /이용했는지와 상관없이 철회할 수 있어요/)
  assert.match(withdrawalLimits(site), /이용했는지와 상관없이 철회할 수 있어요/, '철회 안내 쪽도 같은 글')
  assert.doesNotMatch(refundLimits(site), /철회할 수 없어요/)
  assert.equal(s.blockers.includes('공개 불가 — 확인 필요 사실: legal.withdrawalPolicy'), false, '정책이 있으면 빈 사실이 아니다')
})

test('철회 정책 limited: 결제 화면이 고지·필수 체크를 그리고 환불·철회 쪽은 「이미 제공된 부분은 철회할 수 없어요」', async () => {
  const s = await gen(await policyRun({ withdrawalPolicy: 'limited' }))
  const site = siteOf(s)
  assert.deepEqual(s.withdrawalStripped, [])
  assert.deepEqual(sectionsWithWithdrawalNotice(site.sections), ['billing/paywall'])
  assert.match(refundLimits(site), /이미 제공된 부분은 철회할 수 없어요/)
  assert.match(withdrawalLimits(site), /이미 제공된 부분은 철회할 수 없어요/)
  assert.doesNotMatch(refundLimits(site), /이용했는지와 상관없이/)
  assert.equal(s.blockers.includes('공개 불가 — 확인 필요 사실: legal.withdrawalPolicy'), false)
})

test('철회 정책 없음: 「확인 필요」 공개 불가 사유가 남고 결제 화면 고지는 그대로(기본값을 고르지 않는다)', async () => {
  const s = await gen(await policyRun(null))
  const site = siteOf(s)
  assert.ok(s.blockers.includes('공개 불가 — 확인 필요 사실: legal.withdrawalPolicy'), s.blockers.join('\n'))
  assert.deepEqual(sectionsWithWithdrawalNotice(site.sections), ['billing/paywall'])
  assert.match(refundLimits(site), /확인 필요/)
  assert.deepEqual(s.withdrawalStripped, [])
})

// ── 수정 5: 쿠키 항목 ↔ 처리방침 ──────────────────────────────────────────────
const dialog = (over = {}) => ({ block: 'block-consent-preference-dialog', props: { copy: { categories: { analytics: { label: '방문 분석', body: '많이 보는 메뉴를 알아 고치는 데 써요.' }, marketing: { label: '마케팅', body: '다른 사이트에서 광고를 보여 주는 데 써요.' } } } }, ...over })

test('cookieCategoriesOf: 설정 창은 분석·마케팅 둘(블록 문구 그대로), 하단 띠도 둘, 지도 자리 안내는 그 항목 하나, 동의 블록이 없으면 빈 목록', () => {
  const both = cookieCategoriesOf({ 'signup/consent': dialog() }, {}, 'ko')
  assert.deepEqual(both.map((c) => c.id), ['analytics', 'marketing'])
  assert.equal(both[1].body, '다른 사이트에서 광고를 보여 주는 데 써요.')
  assert.deepEqual(cookieCategoriesOf({ 'home/consent': { block: 'block-consent-bottom-banner', props: { copy: {} } } }, {}, 'ko').map((c) => c.label), ['방문 분석', '마케팅'])
  const only = cookieCategoriesOf({ 'home/consent': { block: 'block-consent-inline-notice', props: { category: 'marketing', copy: {} } } }, {}, 'ko')
  assert.deepEqual(only.map((c) => c.id), ['marketing'])
  assert.deepEqual(cookieCategoriesOf({ 'home/hero': { block: 'block-hero-narrow-title-wide-window', props: {} } }, {}, 'ko'), [])
  // $ref 문구도 콘텐츠 값으로 푼다
  const ref = cookieCategoriesOf({ 'signup/consent': dialog({ props: { copy: { categories: { analytics: { label: '방문 분석', body: { $ref: 'slots.copy.0.text' } }, marketing: { label: '마케팅', body: { $ref: 'slots.copy.1.text' } } } } } }) }, { slots: { copy: [{ text: '통계에 써요' }, { text: '광고에 써요' }] } }, 'ko')
  assert.deepEqual(ref.map((c) => c.body), ['통계에 써요', '광고에 써요'])
})

test('처리방침 초안: legal.cookieCategories 가 있으면 그 항목만 적는다(분석만이면 마케팅 문장이 없다), 없으면 종전 문장', () => {
  const arch = { id: 'saas', legal: { pages: ['privacy', 'terms', 'refund', 'withdrawal'], laws: { ko: [], en: [] } } }
  const base = { business: { name: '견적노트', representative: '김하늘', address: '서울', phone: '02-1', email: 'a@b.kr' }, legal: { autoCollect: true, autoCollectItems: ['방문한 쪽 · 통계 도구'] } }
  const clause = (c) => draftLegalPages(c, arch, 'ko').privacy.clauses.find((x) => x.id === 'privacy.autoCollect')
  const both = clause({ ...base, legal: { ...base.legal, cookieCategories: [{ id: 'analytics', label: '방문 분석', body: '많이 보는 메뉴를 알아 고치는 데 써요.' }, { id: 'marketing', label: '마케팅', body: '다른 사이트에서 광고를 보여 주는 데 써요.' }] } })
  assert.match(both.text, /- 방문 분석 — 많이 보는 메뉴를 알아 고치는 데 써요\./)
  assert.match(both.text, /- 마케팅 — 다른 사이트에서 광고를 보여 주는 데 써요\./)
  assert.equal(both.title, '쿠키와 자동으로 수집하는 정보')
  assert.equal(both.missing, undefined)
  const one = clause({ ...base, legal: { ...base.legal, cookieCategories: [{ id: 'analytics', label: '방문 분석' }] } })
  assert.match(one.text, /- 방문 분석/)
  assert.doesNotMatch(one.text, /마케팅/, '화면이 묻지 않는 항목은 쓰지 않는다')
  const legacy = clause(base)
  assert.match(legacy.text, /이용 통계를 내려고/)
  assert.doesNotMatch(legacy.text, /쿠키 항목/)
  // 항목·도구(수집 도구 사실)는 여전히 대표 몫 — 없으면 빈 사실
  assert.deepEqual(clause({ ...base, legal: { autoCollect: true, cookieCategories: [{ id: 'analytics', label: '방문 분석' }] } }).missing, ['legal.autoCollectItems'])
})

test('생성한 saas 사이트: 설정 창이 묻는 쿠키 항목(분석·마케팅)이 처리방침에도 그대로 있다', async () => {
  const r = await makeRun(SAAS_BRIEF, saasContent, { patchVariants: (v) => ({ ...v, 'signup/consent': 'block-consent-preference-dialog' }) })
  const s = await gen(r)
  assert.deepEqual(s.cookieCategories.map((c) => c.id), ['analytics', 'marketing'])
  const site = siteOf(s)
  const auto = site.legal.privacy.clauses.find((c) => c.title === '쿠키와 자동으로 수집하는 정보')
  assert.ok(auto, '쿠키 항목 조항')
  assert.match(auto.text, /- 방문 분석/)
  assert.match(auto.text, /- 마케팅/)
  // 같은 문구가 화면(동의 블록)에 있다
  const prefs = site.sections['signup/consent'].props.copy.categories
  assert.ok(prefs.marketing.label)
})
