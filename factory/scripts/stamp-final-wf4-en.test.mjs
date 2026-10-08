// FINAL-WF4 영어(en) 경로 고침(영어 골든 saas-2·landing-2 감사 EN1~EN11): 예시 글 누설 · 서버 HTML 의 「Loading」뿐인 쪽 · 보조 버튼 도착지 · 요금제 id ·
// 영어 사이트 서체의 한글 키트 · lead-capture 약속 · 한국 전용 사업자 칸·JSON-LD · 나이 동의·manifest 색. 한국어 사이트의 출력은 바뀌지 않는다(대조 시험 포함).
// 영어 법정 초안(EN9)은 legal.test.mjs 의 「FINAL-WF4 EN9」 절.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-final-wf4-en.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bindSection, fillBlankAddressEn, hasAgeGateFact } from '../stamp/gen-pages.mjs'
import { EN_SCENE_CLAIM_PATTERNS, SIGNIN_GUIDE_UI, foreignTextIssue, planIdsOf, resolveRefs, signInGuideProps } from '../stamp/site-bind.mjs'
import { uiLeavesOf, uiSlotTable } from '../stamp/ui-copy.mjs'
import { buildSitemap } from '../stamp/sitemap.mjs'
import { chooseVariants } from '../stamp/variants.mjs'
import { dropKoreanKitImports } from '../stamp/site-fonts.mjs'
import { loadTs } from '../stamp/ts-eval.mjs'
import { PLACEHOLDER } from '../legal/drafts.mjs'
import { archetypes, gen, makeRun, root, saasContent } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'final-wf4-test')
mkdirSync(TMP, { recursive: true })

const bind = (block, content, { key = 'home/x', copy = {}, routes = { home: '/', pricing: '/pricing', signup: '/signup', login: '/login' }, featuresHref, legal } = {}) =>
  bindSection({ key, block, content, copyIndex: new Map(Object.entries(copy)), routes, locale: content.locale ?? 'ko', navLinks: () => [], primaryCta: () => ({ href: '/signup' }), secondaryHref: () => routes.pricing ?? '#', featuresHref, legal })

// ── EN4·EN5 보조 버튼 도착지 ─────────────────────────────────────────────────────────────────────────────────
const heroContent = (label, locale = 'en') => ({ archetype: 'saas', locale, business: { name: 'Payloop', email: 'hello@example.com', phone: '02-1234-5678' }, slots: { copy: [{ id: 'headline', text: locale === 'en' ? 'Get paid on time' : '제때 받아요' }, { id: 'subhead', text: locale === 'en' ? 'Polite reminders' : '정중한 알림' }, { id: 'primaryCta', text: locale === 'en' ? 'Start free' : '무료로 시작' }, { id: 'secondaryCta', text: label }] } })
const heroCopy = { 'home/hero/headline#0': 0, 'home/hero/subhead#0': 1, 'home/hero/primaryCta#0': 2, 'home/hero/secondaryCta#0': 3 }
const HERO = 'block-hero-illustration-scene'
const secondary = async (label, opts = {}) => {
  const c = heroContent(label, opts.locale)
  const r = await bind(HERO, c, { key: 'home/hero', copy: heroCopy, ...opts })
  assert.ok(r.props, r.why)
  const s = r.props.copy.secondaryCta
  return s ? resolveRefs(s.href, c) : null
}

test('EN4 영어 보조 버튼: 「See how reminders work」는 요금제가 아니라 같은 쪽 기능 구획으로 간다 — 맞는 곳이 없으면 버튼을 뺀다', async () => {
  assert.equal(await secondary('See how reminders work', { featuresHref: () => '#features' }), '#features')
  assert.equal(await secondary('See how it works', { featuresHref: () => '#features' }), '#features')
  // 기능 구획이 없으면(한 쪽 사이트에 기능 구획이 없다) 버튼을 뺀다 — /pricing 으로 보내지 않는다
  assert.equal(await secondary('See how reminders work', { featuresHref: () => null }), null)
  assert.equal(await secondary('See how reminders work'), null)
  // 글이 가리키지 않는 곳은 지어내지 않는다
  assert.equal(await secondary('Browse the gallery', { featuresHref: () => '#features' }), null)
  // 글이 말하는 곳은 예전 그대로: 요금제·메일·전화
  assert.equal(await secondary('View pricing', { featuresHref: () => '#features' }), '/pricing')
  assert.equal(await secondary('Email our team', { featuresHref: () => '#features' }), 'mailto:hello@example.com')
  assert.match(String(await secondary('Call us', { featuresHref: () => '#features' })), /^tel:/)
})

test('EN4 한국어 보조 버튼은 예전 그대로 — 글이 어느 행동도 안 가리키면 요금제 쪽(출력 불변)', async () => {
  assert.equal(await secondary('둘러보기', { locale: 'ko', featuresHref: () => '#features' }), '/pricing')
  assert.equal(await secondary('작동 방식 보기', { locale: 'ko', featuresHref: () => '#features' }), '/pricing')
})

test('EN5 마지막 행동 띠 보조 버튼도 같은 길 — 영어는 도착지가 없으면 뺀다', async () => {
  const copy = { 'home/final-cta/headline#0': 0, 'home/final-cta/primaryCta#0': 1, 'home/final-cta/secondaryCta#0': 2 }
  const go = async (label, locale = 'en') => {
    const c = { archetype: 'saas', locale, business: { name: 'Payloop', email: 'hello@example.com' }, slots: { copy: [{ id: 'headline', text: 'Ready?' }, { id: 'primaryCta', text: 'Start free' }, { id: 'secondaryCta', text: label }] } }
    const r = await bind('block-final-cta-full-band', c, { key: 'home/final-cta', copy, featuresHref: () => '#features' })
    assert.ok(r.props, r.why)
    return r.props.copy.secondary ? resolveRefs(r.props.copy.secondary.href, c) : null
  }
  assert.equal(await go('Email our team'), 'mailto:hello@example.com')
  assert.equal(await go('Explore the features'), '#features')
  assert.equal(await go('Maybe later'), null)
})

// ── EN6 요금제 id ────────────────────────────────────────────────────────────────────────────────────────────
test('EN6 요금제 id: ?plan= 에 실리는 id 가 콘텐츠 요금제(Free·Pro)에서 온다 — 예시의 starter·team·multi 가 아니다', async () => {
  const plans = [{ name: 'Free', monthlyPrice: 0, currency: 'USD', features: ['Up to 3 clients'] }, { name: 'Pro', monthlyPrice: 12, currency: 'USD', features: ['Unlimited clients'] }]
  const c = { archetype: 'saas', locale: 'en', business: { name: 'Payloop' }, plans }
  for (const block of ['block-pricing-three-tier-cards', 'block-pricing-feature-matrix']) {
    const r = await bind(block, c, { key: 'pricing/pricing-plans' })
    if (!r.props) continue // 이 변형이 plans 를 못 묶으면 다른 변형이 시험한다
    assert.deepEqual(r.props.copy.planIds, ['free', 'pro'], block)
    assert.doesNotMatch(JSON.stringify(r.props), /starter|multi/)
  }
  const tiers = await bind('block-pricing-three-tier-cards', c, { key: 'pricing/pricing-plans' })
  assert.ok(tiers.props, tiers.why)
  assert.deepEqual(tiers.props.copy.planIds, ['free', 'pro'])
  assert.equal(tiers.issues.length, 0, '요금제 id 가 예시 문구 남음(digits 등)으로 읽히지 않는다')
})

test('EN6 planIdsOf: 영문 이름은 소문자 낱말 · 콘텐츠 id 가 우선 · 한글 이름은 plan-<글자> · 겹치면 글자를 붙여 가른다 · 숫자는 쓰지 않는다', () => {
  assert.deepEqual(planIdsOf([{ name: 'Free' }, { name: 'Pro Plus' }]), ['free', 'pro-plus'])
  assert.deepEqual(planIdsOf([{ id: 'Team 1', name: 'Other' }]), ['team'], '콘텐츠 id 가 이름보다 앞서고 숫자는 걸러진다')
  assert.deepEqual(planIdsOf([{ name: '무료' }, { name: '프로' }]), ['plan-a', 'plan-b'])
  assert.deepEqual(planIdsOf([{ name: 'Pro' }, { name: 'pro' }]), ['pro', 'pro-b'])
  for (const id of planIdsOf([{ name: '무료' }, { name: 'Plan 2' }])) assert.doesNotMatch(id, /\d/)
})

// ── EN7 영어 사이트 서체 ─────────────────────────────────────────────────────────────────────────────────────
const GLOBALS = `@import "tailwindcss";
@import "tw-animate-css";
@import url("https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css");
@import "./fonts/fonts.css";
@theme inline { --font-heading: var(--font-newsreader-wf, "Newsreader", "MaruBuri", "Noto Sans KR", sans-serif); }
`
const HEAD = { fonts: { display: { family: 'Newsreader', item: 'font-newsreader' }, displayKo: { family: 'MaruBuri', item: 'font-maru-buri' }, body: { family: 'Noto Sans KR', item: 'font-noto-sans-kr' }, mono: { family: 'IBM Plex Mono', item: 'font-ibm-plex-mono' } } }
const siteWithGlobals = (css = GLOBALS) => {
  const dir = mkdtempSync(join(TMP, 'fonts-'))
  mkdirSync(join(dir, 'app'), { recursive: true })
  writeFileSync(join(dir, 'app', 'globals.css'), css)
  return dir
}
test('EN7 영어 사이트: 한글 제목체(displayKo)의 키트 @import(네이버 CDN)를 globals.css 에서 뺀다 — 다른 줄은 그대로', () => {
  const dir = siteWithGlobals()
  const r = dropKoreanKitImports(dir, HEAD, 'en')
  assert.deepEqual(r.removed, ['@import url("https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css");'])
  const after = readFileSync(join(dir, 'app', 'globals.css'), 'utf8')
  assert.doesNotMatch(after, /hangeul\.pstatic\.net|maru-buri\.css/)
  assert.match(after, /@import "tailwindcss";/)
  assert.match(after, /@import "\.\/fonts\/fonts\.css";/)
  assert.match(after, /--font-heading: var\(--font-newsreader-wf, "Newsreader", "MaruBuri"/, '서체 스택은 건드리지 않는다(면이 없으면 다음 서체로 내려간다)')
  rmSync(dir, { recursive: true, force: true })
})
test('EN7 한국어 사이트는 그대로 · 한글 제목체가 본문·제목과 같은 서체면 빼지 않는다 · 한글 키트가 아닌 항목은 건드리지 않는다', () => {
  const ko = siteWithGlobals()
  assert.deepEqual(dropKoreanKitImports(ko, HEAD, 'ko').removed, [])
  assert.equal(readFileSync(join(ko, 'app', 'globals.css'), 'utf8'), GLOBALS, '한국어 출력 불변')
  const same = siteWithGlobals()
  assert.deepEqual(dropKoreanKitImports(same, { fonts: { ...HEAD.fonts, display: { family: 'MaruBuri', item: 'font-maru-buri' } } }, 'en').removed, [], '제목 서체가 같은 키트면 영어 글자도 그린다')
  const none = siteWithGlobals()
  assert.deepEqual(dropKoreanKitImports(none, { fonts: { display: HEAD.fonts.display, body: HEAD.fonts.body } }, 'en').removed, [], '한글 제목체가 없으면 할 일이 없다')
  for (const d of [ko, same, none]) rmSync(d, { recursive: true, force: true })
})

// ── EN8 lead-capture 해지 약속 ───────────────────────────────────────────────────────────────────────────────
const leadContent = (locale, extra = {}) => ({
  archetype: 'landing', locale, business: { name: 'Payloop' },
  slots: { copy: [{ id: 'leadTitle', text: locale === 'en' ? 'Join the waitlist' : '대기 명단' }, { id: 'leadWhat', text: locale === 'en' ? 'Early access news' : '출시 소식' }, { id: 'submitLabel', text: locale === 'en' ? 'Join' : '신청' }, { id: 'consentNote', text: locale === 'en' ? 'I agree to receive launch emails' : '출시 메일 수신 동의' }, { id: 'riskReducer', text: locale === 'en' ? 'One email at launch' : '출시 때 한 번' }, ...(extra.slots ?? [])] },
  ...(extra.facts ? { facts: extra.facts } : {}),
})
const leadCopy = { 'home/lead-capture/leadTitle#0': 0, 'home/lead-capture/leadWhat#0': 1, 'home/lead-capture/submitLabel#0': 2, 'home/lead-capture/consentNote#0': 3, 'home/lead-capture/riskReducer#0': 4 }
test('EN8 영어 신청 폼: 콘텐츠가 해지 수단을 말하지 않으면 「Unsubscribe anytime」 약속 줄을 싣지 않는다 — 말하면 싣는다 · 한국어는 예전 그대로', async () => {
  const go = (c) => bind('block-lead-capture-inline-newsletter', c, { key: 'home/lead-capture', copy: leadCopy })
  const none = await go(leadContent('en'))
  assert.ok(none.props, none.why)
  assert.equal(none.props.copy.unsubscribe, undefined, '근거 없는 약속')
  assert.doesNotMatch(JSON.stringify(none.props), /Unsubscribe/i)
  const said = await go(leadContent('en', { slots: [{ id: 'extra', text: 'Every email has an unsubscribe link at the bottom' }] }))
  assert.match(said.props.copy.unsubscribe, /Unsubscribe/)
  const fact = await go(leadContent('en', { facts: { unsubscribe: 'Unsubscribe from the footer link' } }))
  assert.match(fact.props.copy.unsubscribe, /Unsubscribe/)
  const ko = await go(leadContent('ko'))
  assert.match(ko.props.copy.unsubscribe, /수신 거부/, '한국어 사이트는 예전 그대로')
})

// ── EN10 한국 전용 사업자 칸·JSON-LD ─────────────────────────────────────────────────────────────────────────
const bizContent = (locale) => ({ archetype: 'saas', locale, business: { name: 'Payloop', representative: 'Jordan Lee', bizRegNo: '123-45-67890', mailOrderNo: '제2026-서울-0001호', ftcLookupUrl: 'https://www.ftc.go.kr/x', address: '12 Example Street', phone: '+82-2-1234-5678', email: 'hello@example.com' } })
test('EN10 영어 푸터: 사업자등록번호·통신판매업 번호·공정위 조회는 싣지 않는다 — 한국어 푸터는 그대로 싣는다', async () => {
  for (const block of ['block-footer-columns-business', 'block-footer-product-legal', 'block-footer-compact-strip']) {
    const en = await bind(block, bizContent('en'), { key: 'global/footer' })
    const ko = await bind(block, bizContent('ko'), { key: 'global/footer' })
    if (!en.props || !ko.props) continue
    const keys = (r) => Object.keys(r.props.business ?? r.props.copy.business ?? {})
    for (const k of ['bizRegNo', 'mailOrderNo', 'registrationNo', 'ftcLookupUrl']) assert.ok(!keys(en).includes(k), `${block} en 에 ${k} 칸이 없다`)
    assert.ok(keys(en).includes('email') && keys(en).includes('address'), `${block} en 은 다른 칸을 싣는다`)
    assert.ok(keys(ko).includes('bizRegNo') || keys(ko).includes('registrationNo'), `${block} ko 는 예전 그대로`)
  }
})
const site = (locale) => ({ url: 'https://payloop.example.com', locale, name: 'Payloop' })
test('EN10 영어 JSON-LD: taxID(한국 사업자등록번호)·addressCountry "KR" 고정값이 없다 — 국가는 콘텐츠 주소 사실(addressCountry)에서만 · 한국어는 예전 그대로', async () => {
  const geo = await loadTs(join(root, 'registry', 'factory', 'ax', 'geo-entity.ts'))
  const biz = bizContent('en').business
  const jsonLd = (locale, b = biz) => geo.jsonLdFor({ archetype: 'saas', business: b, product: { name: 'Payloop' }, plans: [], site: site(locale) }, { path: '/', type: 'home', title: 'Payloop' })
  const org = (list) => list.find((x) => x['@type'] === 'Organization')
  const en = org(jsonLd('en'))
  assert.ok(en, 'Organization 이 있다')
  assert.equal(en.taxID, undefined)
  assert.equal(en.address.addressCountry, undefined)
  assert.equal(en.address.streetAddress, '12 Example Street')
  assert.equal(org(jsonLd('en', { ...biz, addressCountry: 'US' })).address.addressCountry, 'US', '콘텐츠가 말한 국가는 싣는다')
  const ko = org(jsonLd('ko'))
  assert.equal(ko.taxID, '123-45-67890')
  assert.equal(ko.address.addressCountry, 'KR')
})

// ── EN11 나이 동의·manifest 색·메타 설명 ─────────────────────────────────────────────────────────────────────
test('EN11 영어 가입: 「14세 이상」 동의는 콘텐츠 법정 사실(legal.ageGate)이 나이 기준을 말할 때만 — 한국어는 늘 둔다', async () => {
  const c = (locale) => ({ archetype: 'saas', locale, business: { name: 'Payloop' } })
  const auth = (locale, legal) => bind('block-auth-sign-up-consents', c(locale), { key: 'signup/auth', legal })
  const withAge = (r) => r.props?.copy?.ageOver14 !== undefined
  const en = await auth('en')
  assert.ok(en.props, en.why)
  assert.equal(withAge(en), false)
  assert.equal(withAge(await auth('en', { ageGate: 14 })), true)
  assert.equal(withAge(await auth('en', { ageGate: 'guardian' })), true)
  assert.equal(withAge(await auth('en', { ageGate: PLACEHOLDER.en })), false, '자리표시는 사실이 아니다')
  assert.equal(withAge(await auth('ko')), true, '한국어 사이트는 예전 그대로')
  assert.equal(hasAgeGateFact({ ageGate: 14 }), true)
  assert.equal(hasAgeGateFact(undefined), false)
})

test('EN11 manifest 색: 웹 앱 매니페스트의 theme_color·background_color 는 #hex 다(oklch 를 브라우저가 못 읽는다)', async () => {
  const bc = await loadTs(join(root, 'registry', 'factory', 'ax', 'brand-color.ts'))
  assert.match(bc.toHex('oklch(0.4234 0.1112 255.11)'), /^#[0-9a-f]{6}$/)
  const src = readFileSync(join(root, 'factory', 'stamp', 'site-template', 'lib', 'site.tsx'), 'utf8')
  const fn = src.slice(src.indexOf('export function manifestProps()'), src.indexOf('export function ogProps()'))
  assert.match(fn, /background: hex\(build\.og\.background\), theme: hex\(build\.og\.accent\)/)
  assert.match(src, /import \{ toHex \} from "@\/components\/ax\/brand-color"/)
})

// ── EN1 예시 글 누설 ─────────────────────────────────────────────────────────────────────────────────────────
test('EN1 영어 화면 문구: 영어 장면의 사업 주장(project·teammate·report·Excel …)이 literal 로 남으면 사유로 낸다 — 콘텐츠가 그 말을 하면 이 사업의 말이다', () => {
  const lit = (value, path = 'copy.title') => [{ path, value, ref: null }]
  const issue = (value, contentTexts) => foreignTextIssue(lit(value), { locale: 'en', kind: 'onboarding', contentTexts })
  assert.equal(issue('Create your first project')?.why, 'biz')
  assert.deepEqual(issue('Create your first project').words, ['project'])
  assert.equal(issue('Report export is on the Pro plan')?.why, 'biz')
  assert.equal(issue('Invite a teammate')?.why, 'biz')
  // 음성 대조: 어느 제품에나 맞는 말·식별자 칸·제품 화면이 아닌 블록은 걸지 않는다
  assert.equal(issue('Sign in'), null)
  assert.equal(issue('Print or save as PDF'), null)
  assert.equal(issue('The card on file has expired.'), null)
  assert.equal(foreignTextIssue(lit('projects', 'limitKey'), { locale: 'en', kind: 'paywall' }), null)
  assert.equal(foreignTextIssue(lit('Create your first project'), { locale: 'en', kind: 'hero' }), null)
  // 콘텐츠가 프로젝트를 말하면(프로젝트 관리 도구) 그 낱말은 걸리지 않는다
  assert.equal(issue('Create your first project', new Set(['Track every project in one place'])), null)
  // 한국어 사이트의 판정은 그대로(영어 낱말을 보지 않는다)
  assert.equal(foreignTextIssue(lit('Create your first project'), { locale: 'ko', kind: 'onboarding' }), null)
  assert.ok(EN_SCENE_CLAIM_PATTERNS.length >= 6)
})

test('EN1 영어 화면 문구 칸 요청: 영어 장면의 사업 주장 잎을 04 가 이 서비스의 말로 다시 쓰게 한다(why biz) — 한국어 요청은 그대로', async () => {
  const check = await uiLeavesOf('block-onboarding-checklist-panel', { locale: 'en' })
  assert.ok(check.length > 0 && check.every((l) => l.why === 'biz'), JSON.stringify(check.map((l) => l.path)))
  assert.ok(check.some((l) => l.path === 'copy.items[0].title' && l.example === 'Create your first project'))
  // 사업 주장이 든 항목은 항목의 글 전부(제목·본문·버튼)를 다시 쓰게 한다 — 제목만 새 말이면 한 항목 안에서 말이 어긋난다
  for (const path of ['copy.items[3].title', 'copy.items[3].body', 'copy.items[3].action.label', 'copy.items[1].action.label']) assert.ok(check.some((l) => l.path === path), path)
  assert.ok(!check.some((l) => l.path.startsWith('copy.items[2].')), '주장이 없는 항목(알림 켜기)은 그대로')
  const paywall = await uiLeavesOf('block-paywall-upgrade-modal', { locale: 'en' })
  assert.ok(paywall.some((l) => l.path === 'copy.title' && /Report export/.test(l.example)))
  assert.ok(!paywall.some((l) => /^trigger$|limitKey|Href$/.test(l.path)), '식별자 칸은 요청하지 않는다')
  // 한글 잎(locale)은 예전처럼 따로 센다
  assert.deepEqual((await uiLeavesOf('block-onboarding-checklist-panel', { locale: 'ko' })).filter((l) => l.why === 'biz'), [] , '한국어 요청에는 영어 사업 주장 잎이 없다')
  // 모든 영어 장면 블록이 한도(12칸) 안이라 확장이 접히지 않는다
  for (const n of ['block-auth-sign-up-consents', 'block-confirmation-signup-complete', 'block-onboarding-checklist-panel', 'block-onboarding-setup-wizard', 'block-paywall-upgrade-modal', 'block-paywall-limit-meter']) {
    const list = await uiLeavesOf(n, { locale: 'en' })
    assert.ok(list.length <= 12, n)
    assert.ok(list.some((l) => l.why === 'biz'), `${n}: 사업 주장 잎이 요청에 있다`)
  }
})

test('EN1 업그레이드 단추 글: 요금제 이름이 읽히기 전에도 「See the … plan」 이 아니다 — 자리 표시 없는 글 · 한국어는 그대로', async () => {
  const open = async (locale) => (await bind('block-paywall-upgrade-modal', { archetype: 'saas', locale, business: { name: 'Payloop' } }, { key: 'billing/paywall' })).props?.copy?.open
  assert.equal(await open('en'), 'See upgrade options')
  assert.match(await open('ko'), /\{plan\}/, '한국어는 예시 글 그대로(요금제 이름 자리 표시)')
})

test('EN1 확인 메일 안내의 빈 주소: {email} 자리를 비워 두지 않는다 — 주소 값이 있으면 그대로', () => {
  const props = { copy: { confirm: { body: 'We sent a confirmation email to {email}. Click the link.' } } }
  fillBlankAddressEn(props)
  assert.equal(props.copy.confirm.body, 'We sent a confirmation email to the address you signed up with. Click the link.')
  const withEmail = { email: 'a@b.co', copy: { confirm: { body: 'To {email}.' } } }
  fillBlankAddressEn(withEmail)
  assert.equal(withEmail.copy.confirm.body, 'To {email}.')
})

test('EN1 bindSection(en 확인 안내): 빈 주소 문장이 없고 예시 주소가 새지 않는다', async () => {
  const c = { archetype: 'saas', locale: 'en', business: { name: 'Payloop' } }
  const r = await bind('block-confirmation-signup-complete', c, { key: 'onboarding/confirmation' })
  assert.ok(r.props, r.why)
  const text = JSON.stringify(r.props)
  assert.doesNotMatch(text, /\{email\}|kim@example\.com/)
  assert.match(text, /the address you signed up with/)
})

// ── EN2 로그인해야 보이는 쪽의 서버 HTML ─────────────────────────────────────────────────────────────────────
test('EN2 영어 제품 화면 머리: 뺀 한 줄 설명을 화면 설명으로 되돌린다 — 한국어는 그대로', async () => {
  const lead = async (block, locale) => {
    const r = await bind(block, { archetype: 'saas', locale, business: { name: 'Payloop' } }, { key: 'x/y' })
    assert.ok(r.props, r.why)
    return r.props.copy.lead
  }
  assert.equal(await lead('block-account-billing-manage', 'en'), 'Change your plan, next billing date and payment method here.')
  assert.equal(await lead('block-account-profile-settings', 'en'), 'Change your sign-in details and security settings here.')
  assert.equal(await lead('block-retention-cancel-flow', 'en'), 'Cancel your subscription here.')
  assert.equal(await lead('block-account-billing-manage', 'ko'), undefined, '한국어 사이트는 예전 그대로')
})

test('EN2 signInGuideProps: 영어만 · 로그인 주소가 있을 때만', () => {
  const g = signInGuideProps('en', '/login')
  assert.deepEqual(g.copy.primary, { label: 'Sign in', href: '/login' })
  assert.equal(g.copy.title, SIGNIN_GUIDE_UI.en.title)
  assert.equal(signInGuideProps('ko', '/login'), null)
  assert.equal(signInGuideProps('en', undefined), null)
})

// 영어 saas 사이트를 06 으로 만들어(설치·빌드 없음) 정적 출력을 본다 — 서버 HTML 에 글이 있다는 것은 쪽 파일이 그 잎을 그린다는 것이다.
const EN_BRIEF = { topic: 'Late-invoice reminders for freelancers (fictional business — example)', archetype: 'saas', locale: 'en', facts: { name: 'Payloop', email: 'hello@example.com', price: 'Free for 3 clients; Pro $12 per month', address: '12 Example Street, Seoul', phone: '+82-2-1234-5678', productUrl: 'https://payloop.example.com' } }
const EN_TEXT = { headline: 'Get paid on time, politely', subhead: 'Polite reminders that stop when an invoice is paid', primaryCta: 'Start the free plan', secondaryCta: 'See how reminders work', claim: 'Reminders on your schedule', body: 'Pick a schedule and let reminders run' }
function enContent(request) {
  const business = { ...request.seedContent.business, address: '12 Example Street, Seoul', phone: '+82-2-1234-5678' }
  const ui = (slot) => `This is a screen guide ${[...String(slot.ui.example).matchAll(/\{[A-Za-z_]+\}/g)].map((m) => m[0]).join(' ')}`.trim()
  return {
    archetype: 'saas', locale: 'en', business,
    product: { name: request.seedContent.business.name, url: 'https://payloop.example.com' },
    plans: [{ name: 'Free', monthlyPrice: 0, currency: 'USD', features: ['Up to 3 clients'] }, { name: 'Pro', monthlyPrice: 12, currency: 'USD', features: ['Unlimited clients'] }],
    integrations: [{ name: 'Calendar', url: 'https://calendar.example.org/integration', kind: 'native' }],
    testimonials: [], workflowSteps: [{ title: 'Connect your invoices', body: 'Link the tool you already use', uiCrop: { id: 'step-ui-crop', aspect: '4:3', source: 'real-required', alt: 'Invoices screen' } }, { title: 'Pick a schedule', body: 'Choose when reminders go out', uiCrop: { id: 'step-ui-crop', aspect: '4:3', source: 'real-required', alt: 'Schedule screen' } }, { title: 'Watch it update', body: 'Paid invoices stop the reminders', uiCrop: { id: 'step-ui-crop', aspect: '4:3', source: 'real-required', alt: 'Status screen' } }],
    facts: { ...request.seedContent.facts },
    slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: s.ui ? ui(s) : s.placeholder ? PLACEHOLDER.en : EN_TEXT[s.id] ?? 'Details are on this page' })), images: [] },
  }
}
test('EN2·EN4·EN11 06 정적 출력(영어 saas): 로그인해야 보이는 쪽에 설명 한 줄과 로그인 길이 있다 · 보조 버튼은 요금제로 가지 않는다 · 나이 동의 없음 · 목 포트가 14세 확인을 요구하지 않는다', async () => {
  const recipe = 'r1-measure'
  const enVariants = chooseVariants(buildSitemap(archetypes.saas, EN_BRIEF), [{ id: 'a', slot: 'library', source: 'library', recipe }], { seed: 7, weights: [] }).a
  const r = await makeRun(TMP, EN_BRIEF, enContent, { recipe, uiSlots: await uiSlotTable(Object.values(enVariants), { locale: 'en' }) })
  const out = await gen(r)
  const siteJson = JSON.parse(readFileSync(join(out.siteDir, 'content', 'site.json'), 'utf8'))
  for (const page of ['account', 'billing', 'cancel']) {
    const key = `${page}/signin-guide`
    assert.deepEqual(siteJson.sections[key]?.props.copy.primary, { label: 'Sign in', href: '/login' }, key)
    const src = readFileSync(join(out.siteDir, 'app', page, 'page.tsx'), 'utf8')
    assert.match(src, new RegExp(`${page[0].toUpperCase()}${page.slice(1)}SigninGuide`), `${page} 쪽 파일이 안내 잎을 그린다`)
  }
  assert.match(siteJson.sections['billing/subscription'].props.copy.lead, /^Change your plan/)
  assert.equal(siteJson.pages['/billing'].description, siteJson.sections['billing/subscription'].props.copy.lead, '메타 설명이 제목 한 낱말이 아니다')
  assert.equal(siteJson.sections['home/hero'].props.copy.secondaryCta?.href === '/pricing' && /how reminders work/i.test(JSON.stringify(siteJson.slots.copy)), false, '「See how reminders work」가 요금제로 가지 않는다')
  const build = JSON.parse(readFileSync(join(out.siteDir, 'lib', 'build.json'), 'utf8'))
  assert.equal(build.requireAgeOver14, false)
  assert.equal(JSON.stringify(siteJson.sections['signup/auth']?.props ?? {}).includes('ageOver14'), false)
  assert.equal(existsSync(join(out.siteDir, 'app', 'signup', 'page.tsx')), true)
  // 한국어 사이트: 안내 잎·나이 칸 값·build.json 칸은 예전 그대로(만들어지지 않는다)
  const ko = await makeRun(TMP, { topic: '예약 관리 도구', archetype: 'saas', locale: 'ko', facts: { name: '예약노트', email: 'hello@example.com', price: '월 9,900원', address: '서울특별시 마포구 달빛로 12', phone: '02-1234-5678', productUrl: 'https://yeyaknote.kr' } }, saasContent)
  const koOut = await gen(ko)
  const koJson = JSON.parse(readFileSync(join(koOut.siteDir, 'content', 'site.json'), 'utf8'))
  assert.deepEqual(Object.keys(koJson.sections).filter((k) => /signin-guide/.test(k)), [])
  assert.equal(JSON.parse(readFileSync(join(koOut.siteDir, 'lib', 'build.json'), 'utf8')).requireAgeOver14, undefined)
  for (const d of [r.runDir, ko.runDir]) rmSync(d, { recursive: true, force: true })
})

// ── EN3 375 첫 화면의 주 CTA ─────────────────────────────────────────────────────────────────────────────────
test('EN3 히어로 illustration-scene: 좁은 화면에서 문단·버튼 카드가 그림 앞에 선다(첫 화면 안 주 CTA) — 넓은 화면은 그림 위에 얹은 카드 그대로', () => {
  const css = readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8')
  const rule = (sel) => css.slice(css.indexOf(`${sel} {`), css.indexOf('}', css.indexOf(`${sel} {`)))
  assert.match(rule('.cn-block-hero-illustration-scene-stage'), /flex flex-col md:block/)
  const card = rule('.cn-block-hero-illustration-scene-card')
  assert.match(card, /order-first/)
  assert.match(card, /md:order-none md:absolute/, '넓은 화면은 그림 위 오른쪽 아래 카드 그대로')
  assert.doesNotMatch(card, /\bmt-4\b/, '카드가 그림 아래에 붙던 위 간격이 없다')
  // 컴파일본(소비자에게 가는 블록)도 같다 — gen:all 이 base.css 훅 값을 옮긴다
  const compiled = readFileSync(join(root, 'registry', 'factory', 'blocks', '_compiled', 'hero', 'illustration-scene.tsx'), 'utf8')
  assert.match(compiled, /order-first/)
})
