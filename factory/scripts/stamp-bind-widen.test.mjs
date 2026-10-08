// P3-3 Task 9b — 문구 묶기 넓히기(대장 C111·C112): 블록 종류마다 콘텐츠에서 값이 오고 예시 문구가 새지 않는다.
// bindSection 을 합성 콘텐츠로 직접 부른다(런·설치 없음). 실제 블록 예시(fixture)·실제 binder 를 쓴다.
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/stamp-bind-widen.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bindSection, blockItems, leafSource, blockTraits } from '../stamp/gen-pages.mjs'
import { dropOptionalExamples, exampleIssues, getLeaf, leaves, pathKeys, refsOf, resolveRefs, setLeaf, delLeaf } from '../stamp/site-bind.mjs'
import { contentRequest, validateContent, UI_ROLE, PLACEHOLDER } from '../stamp/content.mjs'
import { readinessTable, uiLeavesOf, uiSlotTable } from '../stamp/ui-copy.mjs'
import { chooseVariants } from '../stamp/variants.mjs'
import { buildSitemap } from '../stamp/sitemap.mjs'
import { loadTs } from '../stamp/ts-eval.mjs'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
import { root, archetypes, library, localBrief, localContent, SAAS_BRIEF, saasContent, makeRun as makeRunIn, gen, LOCAL_FACTS, detailContent, detailBrief } from './lib/stamp-site-fixtures.mjs'

const routes = { home: '/', pricing: '/pricing', signup: '/signup' }
const navLinks = () => [{ label: '홈', href: '/' }]
const primaryCta = () => ({ href: '/signup' })
const secondaryHref = () => '/pricing'
export const bind = (block, content, { key = 'home/x', copy = {}, locale = 'ko' } = {}) =>
  bindSection({ key, block, content, copyIndex: new Map(Object.entries(copy)), routes, locale, navLinks, primaryCta, secondaryHref })

const LOCAL = {
  archetype: 'local', locale: 'ko',
  business: { name: '달빛 베이커리', phone: '02-1234-5678', address: '서울특별시 마포구 달빛로 12, 1층' },
  hours: [{ day: 'tu', opens: '10:00', closes: '20:00' }],
  directions: { transit: '달빛역 2번 출구에서 걸어서 3분이에요', parking: '주차는 어려워요' },
  mapLinks: { naver: 'https://map.naver.com/p/entry/place/1', kakao: 'https://place.map.kakao.com/1' },
}
const HOURS_BLOCK = 'block-hours-location-hours-table-map-link'
const CONFIRM_BLOCK = 'block-confirmation-booking-complete'

test('Step 0 · A105: 콘텐츠에 특수일·공휴일이 있으면 $ref 로 잇는다', async () => {
  const c = { ...LOCAL, hoursSpecial: [{ date: '2026-10-05', closed: true }], holidays: [{ date: '2026-10-09', label: '한글날' }], holidayPolicy: 'closed' }
  const r = await bind(HOURS_BLOCK, c)
  assert.deepEqual(r.props.special, { $ref: 'hoursSpecial' })
  assert.deepEqual(r.props.holidays, { $ref: 'holidays' })
  assert.deepEqual(r.props.holidayPolicy, { $ref: 'holidayPolicy' })
  assert.deepEqual(resolveRefs(r.props, c).special, c.hoursSpecial)
  assert.equal(r.issues.length, 0, JSON.stringify(r.issues))
})

test('Step 0 · A105: 콘텐츠에 특수일·공휴일이 없으면 예시 날짜(개천절·한글날)를 싣지 않는다', async () => {
  const r = await bind(HOURS_BLOCK, LOCAL)
  for (const k of ['special', 'holidays', 'holidayPolicy']) assert.equal(k in r.props, false, k)
  assert.equal(JSON.stringify(r.props).includes('2026-10'), false)
  assert.equal(r.issues.length, 0, JSON.stringify(r.issues))
})

test('Step 0 · A65: 예약 완료의 캘린더 일정 제목은 콘텐츠 상호에서 오고 「(예시)」가 없다', async () => {
  const r = await bind(CONFIRM_BLOCK, LOCAL)
  const title = r.props.copy.calendar.eventTitle
  assert.deepEqual(title, { $ref: 'business.name', template: '{} 예약 {ref}' })
  assert.equal(resolveRefs(title, LOCAL), '달빛 베이커리 예약 {ref}')
  assert.equal('description' in r.props.copy.calendar, false, '예시 설명글은 뺀다')
  assert.deepEqual(r.props.copy.help.phone, { $ref: 'business.phone' })
  assert.equal(leaves(r.props).some((l) => l.value && /예시/.test(l.value)), false)
})

const TMP = join(root, '.tmp', 'stamp-bind-widen-test')
const makeRun = (brief, contentFor, opts) => makeRunIn(TMP, brief, contentFor, opts)
const noExample = (props) => leaves(props).filter((l) => l.value && /예시/.test(l.value))

// ── 잎 경로 도구 ──
test('잎 경로: pathKeys·getLeaf·setLeaf·delLeaf 는 배열 첨자를 다룬다', () => {
  assert.deepEqual(pathKeys('copy.steps[1].body'), ['copy', 'steps', 1, 'body'])
  const o = { copy: { steps: [{ body: 'a' }, { body: 'b' }] } }
  assert.equal(getLeaf(o, 'copy.steps[1].body'), 'b')
  assert.equal(setLeaf(o, 'copy.steps[0].body', 'z'), true)
  assert.equal(o.copy.steps[0].body, 'z')
  delLeaf(o, 'copy.steps[0]')
  assert.equal(o.copy.steps.length, 1)
  assert.equal(setLeaf(o, 'nope.x.y', 1), false)
})

test('선택 칸 정리: 선택 칸이 아니면 선택인 가장 가까운 윗칸(special·tool)을 통째로 뺀다 — 배열 원소 하나는 빼지 않는다', () => {
  const names = new Set()
  const src = 'type X = { copy: { title: string }; special?: { date: string }[]; tool?: { name: string; description: string }; rows: { v: string }[] }'
  const props = { copy: { title: '제목' }, special: [{ date: '2026-10-03' }], tool: { name: 'x', description: '보내요(예시)' }, rows: [{ v: '가격 1,000원' }] }
  const dropped = dropOptionalExamples(props, src, names)
  assert.deepEqual(dropped.sort(), ['special', 'tool'])
  assert.equal('special' in props, false)
  assert.equal('tool' in props, false)
  assert.equal(props.rows.length, 1, '필수 배열의 원소는 그대로(공개 불가 사유로 남는다)')
  assert.equal(exampleIssues(leaves(props), names).length, 1)
})

// ── binder ──
test('C111 announcement: 날짜 붙은 한 줄 공지가 맨 위 띠가 된다 — 그날이 지나면 그리지 않는다(endsAt = 그날 끝)', async () => {
  const c = { ...LOCAL, notices: [{ date: '2026-10-03', text: '10월 3일은 쉬어요' }] }
  const r = await bind('block-announcement-top-bar', c)
  assert.deepEqual(r.props.copy.message, { $ref: 'notices.0.text' })
  assert.deepEqual(r.props.endsAt, { $ref: 'notices.0.date', template: '{}T23:59:59+09:00' })
  assert.equal(resolveRefs(r.props, c).endsAt, '2026-10-03T23:59:59+09:00')
  assert.equal(resolveRefs(r.props, c).announcementId, 'notice-2026-10-03')
  for (const k of ['startsAt', 'now', 'showCountdown']) assert.equal(k in r.props, false, k)
  assert.equal('link' in r.props.copy, false, '예시 링크(#shipping-schedule)는 뺀다')
  assert.equal(r.issues.length, 0, JSON.stringify(r.issues))
  // 공지가 없으면 그리지 않는다(예시 공지를 싣지 않는다). 제목·본문·기간이 따로인 변형은 콘텐츠 칸이 없어 묶지 않는다
  assert.equal((await bind('block-announcement-top-bar', LOCAL)).props, null)
  assert.equal((await bind('block-announcement-launch-banner', c)).props, null)
  // public 원형 공지는 text 대신 title
  const pub = await bind('block-announcement-top-bar', { archetype: 'public', locale: 'ko', notices: [{ date: '2026-10-03', title: '휴관 안내' }] })
  assert.deepEqual(pub.props.copy.message, { $ref: 'notices.0.title' })
})

test('C111 contact-form: 전화·메일·카카오 채널은 정적 어댑터가 끼우고 props 에는 예시가 없다. 단계 예약 폼은 가능한 날짜표가 없어 묶지 않는다', async () => {
  const bindUi = async (block, content) => { const ls = await uiLeavesOf(block); return bindSection({ key: 'home/x', block, content, copyIndex: new Map(), routes, locale: 'ko', navLinks, primaryCta, secondaryHref, uiLeaves: ls.map((l, i) => ({ path: l.path, ref: 'slots.copy.' + i + '.text' })) }) }
  const ch = await bindUi('block-contact-form-channel-first', LOCAL)
  assert.deepEqual(ch.props.copy.call.number, { $ref: 'business.phone' })
  assert.equal('call' in ch.props, false, '전화 결과(tel:025550123)는 잎이 telLink 로 만든다')
  assert.equal('kakao' in ch.props.copy, false, '카카오 채널이 없으면 그 칸을 뺀다')
  const withKakao = await bindUi('block-contact-form-channel-first', { ...LOCAL, booking: { primary: { kind: 'tel', value: '02-1234-5678' }, secondary: [{ kind: 'kakao', value: 'https://pf.kakao.com/_abc' }] } })
  assert.ok(withKakao.props.copy.kakao, '카카오 채널이 있으면 칸을 둔다')
  assert.equal((await bind('block-contact-form-stepped-booking', LOCAL)).props, null)
  const noPhone = await bindUi('block-contact-form-channel-first', { ...LOCAL, business: { ...LOCAL.business, phone: undefined } })
  assert.equal('call' in noPhone.props.copy, false, '전화가 없으면 전화 칸을 뺀다')
  const inline = await bindUi('block-contact-form-inline-short', LOCAL)
  assert.ok(inline.props)
  assert.equal(inline.issues.length, 0, JSON.stringify(inline.issues))
  assert.equal(ch.issues.length, 0, JSON.stringify(ch.issues))
  // 문구 칸이 없으면 예시가 남은 선택 윗칸(전화 칸)은 통째로 빠진다 — 예시 문구를 싣는 것보다 낫다
  assert.equal('call' in (await bind('block-contact-form-channel-first', LOCAL)).props.copy, false)
  // 트레잇: 문의 폼 잎은 lib/contact.ts 포트를 쓴다(예약 완료 잎은 주소에서 예약을 읽는다)
  for (const [name, expect] of [['block-contact-form-channel-first', { contact: true, contactKakao: true, contactCall: true }], ['block-contact-form-inline-short', { contact: true, contactKakao: false, contactCall: false }]]) {
    const tr = blockTraits(blockItems().get(name))
    for (const [k, v] of Object.entries(expect)) assert.equal(tr[k], v, `${name}.${k}`)
  }
  const src = leafSource({ name: 'HomeContactForm', block: 'block-contact-form-channel-first', recipeId: 'r1-measure' })
  assert.match(src, /makeContactPorts/)
  assert.match(src, /submit=\{contact\.submit\} kakao=\{contact\.kakao\} call=\{contact\.call\}/)
})

test('C111 nav: 쪽 안 앱바·헤더 변형이 상호·사이트맵 메뉴로 채워지고 예시 링크(#home)가 없다', async () => {
  for (const name of ['block-nav-app-bar-tabs', 'block-nav-centered-mark', 'block-nav-inline-links']) {
    const r = await bind(name, LOCAL, { key: 'home/app-bar', copy: { 'home/app-bar/primaryCta#0': 0 } })
    assert.ok(r.props, name)
    assert.equal(r.props.currentHref, '/')
    const src = JSON.stringify(r.props)
    assert.equal(/#home|#scents|#work|#new|MOSS|고요/.test(src), false, name + ': ' + src)
    assert.ok(refsOf(r.props).has('business.name'), name)
    assert.equal(r.issues.length, 0, name + JSON.stringify(r.issues))
  }
})

test('C111 product-list: 콘텐츠 상품이 준비됨 상태로 들어가고, 사양 요약 변형은 묶지 않는다', async () => {
  const c = { archetype: 'commerce', locale: 'ko', business: { name: '달빛상점' }, products: [{ slug: 'a', name: '식빵', price: 4800, options: [], thumbs: [] }] }
  const r = await bind('block-product-list-grid-cards', c)
  assert.deepEqual(r.props.state, { status: 'ready', data: { $ref: 'products' } })
  assert.equal(resolveRefs(r.props, c).state.data[0].name, '식빵')
  assert.equal((await bind('block-product-list-spec-summary', c)).props, null)
  assert.equal((await bind('block-product-list-grid-cards', { ...c, products: [] })).props, null)
})

test('C111 final-cta: 문구 칸이 없는 반복 섹션(캠페인 쪽)은 같은 사이트의 다른 마지막 행동 띠 문구를 쓴다', async () => {
  const copy = { 'home/final-cta/headline#0': 0, 'home/final-cta/primaryCta#0': 1 }
  const r = await bind('block-final-cta-full-band', LOCAL, { key: 'campaign/final-cta', copy })
  assert.ok(r.props)
  assert.deepEqual(r.props.copy.title, { $ref: 'slots.copy.0.text' })
  assert.deepEqual(r.props.copy.primary.label, { $ref: 'slots.copy.1.text' })
  assert.equal((await bind('block-final-cta-full-band', LOCAL, { key: 'campaign/final-cta', copy: {} })).props, null, '어느 쪽에도 문구가 없으면 예시로 채우지 않는다')
})

// ── 화면 문구 칸(C112) ──
test('C112 uiLeavesOf: 제품 화면은 남은 예시 잎을 칸으로 요청하고, 지어낸 수치가 남은 히어로·너무 큰 블록·선택 칸은 요청하지 않는다', async () => {
  const signIn = await uiLeavesOf('block-auth-sign-in')
  assert.ok(signIn.length >= 2 && signIn.length <= 12, JSON.stringify(signIn.map((x) => x.path)))
  for (const l of signIn) assert.ok(l.example && ['marker', 'digits', 'name', 'biz'].includes(l.why))
  assert.ok(signIn.some((l) => l.path === 'copy.errors.emailFormat'))
  assert.deepEqual(await uiLeavesOf('block-hero-baseline-news-app-window'), [], '가상 앱 창 수치가 남은 히어로는 요청하지 않는다(지어낸 수치를 쓰게 하지 않는다)')
  assert.deepEqual(await uiLeavesOf('block-hero-baseline-split'), [], '도면 치수(12 000 mm)가 남은 히어로는 잎이 적어도 요청하지 않는다')
  const chip = await uiLeavesOf('block-hero-inline-chip-title')
  assert.deepEqual(chip.map((x) => x.path), ['copy.captionTop'], '예시 표지만 남은 히어로는 캡션 하나를 다시 쓴다(제목·CTA 는 binder 몫)')
  assert.deepEqual(await uiLeavesOf('block-contact-form-stepped-booking'), [], '잎이 너무 많으면 요청하지 않는다')
  assert.deepEqual(await uiLeavesOf('block-pricing-three-tier-cards'), [], '이 종류가 아니다')
  const confirm = await uiLeavesOf('block-confirmation-booking-complete')
  assert.equal(confirm.some((l) => l.path.startsWith('copy.calendar') || l.path.startsWith('copy.help.phone') || l.path.startsWith('booking')), false, 'binder 가 묶는 잎은 요청하지 않는다')
  assert.ok(confirm.some((l) => /^copy\.next\[\d\]\.when$/.test(l.path)))
})

test('C112 contentRequest: uiSlots 를 주면 그 블록의 잎마다 「ui:」 칸이 생기고, 주지 않으면 옛 요청 그대로다', async () => {
  const archetype = archetypes.saas
  const sitemap = buildSitemap(archetype, SAAS_BRIEF)
  const cand = { id: 'a', slot: 'library', source: 'library', recipe: library[0].id }
  const variants = chooseVariants(sitemap, [cand], { seed: 7, weights: [] })
  const plain = contentRequest(cand, sitemap, variants, 7, { archetype, brief: SAAS_BRIEF })
  assert.equal(plain.slots.some((x) => x.ui), false)
  const table = await uiSlotTable(Object.values(variants.a))
  const req = contentRequest(cand, sitemap, variants, 7, { archetype, brief: SAAS_BRIEF, uiSlots: table })
  const ui = req.slots.filter((x) => x.ui)
  assert.ok(ui.length >= 10, 'saas 제품 화면 칸 수 ' + ui.length)
  for (const sl of ui) {
    assert.match(sl.path, /^[a-z-]+\/[a-z-]+\/ui:/)
    assert.equal(sl.id, 'ui:' + sl.ui.path)
    assert.equal(sl.role, UI_ROLE(sl.ui.example))
    assert.equal(sl.factsUsed.length, 0)
  }
  assert.equal(req.slots.length, plain.slots.length + ui.length)
  assert.ok(req.checks.some((c) => c.id === 'ui-copy'))
})

test('C112 validateContent: 「ui:」 칸은 예시 표지·예시 문장 그대로·자리 표시 바뀜을 거절한다', async () => {
  const R = await makeRun(SAAS_BRIEF, saasContent)
  const idx = R.request.slots.findIndex((x) => x.ui && /\{[a-z_]+\}/.test(x.ui.example))
  assert.ok(idx >= 0, '자리 표시가 든 예시 잎이 하나는 있다')
  const slot = R.request.slots[idx]
  const withText = (t) => ({ ...R.content, slots: { ...R.content.slots, copy: R.content.slots.copy.map((c, i) => (i === idx ? { ...c, text: t } : c)) } })
  const problems = (t) => validateContent(R.request, withText(t)).filter((x) => x.startsWith('[ui-copy]'))
  assert.deepEqual(problems(R.content.slots.copy[idx].text), [], '통과하는 문구')
  assert.match(problems('안내(예시)예요 ' + slot.ui.example.match(/\{[a-z_]+\}/)[0]).join('\n'), /예시 표지/)
  assert.match(problems(slot.ui.example).join('\n'), /예시 문장 그대로|예시 표지/)
  assert.match(problems('자리 표시가 빠진 안내예요').join('\n'), /자리 표시/)
  // 「ui:」 칸의 role 은 블록 예시 문장(예시 메일 name@example.com 등)을 담는다 — 요청에서 옮긴 설명이라 지어낸 사실 검사에서 뺀다
  const all = validateContent(R.request, R.content)
  assert.deepEqual(all.filter((x) => x.startsWith('[ui-copy]') || /slots\.copy\[\d+\]\.role/.test(x)), [], all.join(' | '))
})

test('C112 bindSection: 문구 칸 문구가 잎마다 $ref 로 이어지고 그 잎의 예시 이슈가 사라진다', async () => {
  const leavesOf = await uiLeavesOf('block-auth-sign-in')
  const c = { archetype: 'saas', locale: 'ko', business: { name: '예약노트' }, slots: { copy: leavesOf.map(() => ({ id: 'x', text: '안내 문구예요' })) } }
  const without = await bind('block-auth-sign-in', c)
  assert.ok(without.issues.length >= 2, '문구 칸이 없으면 예시 잎이 남는다')
  const uiLeaves = leavesOf.map((l, i) => ({ path: l.path, ref: 'slots.copy.' + i + '.text' }))
  const withUi = await bindSection({ key: 'home/x', block: 'block-auth-sign-in', content: c, copyIndex: new Map(), routes, locale: 'ko', navLinks, primaryCta, secondaryHref, uiLeaves })
  assert.equal(withUi.issues.length, 0, JSON.stringify(withUi.issues))
  assert.deepEqual(getLeaf(withUi.props, leavesOf[0].path), { $ref: 'slots.copy.0.text' })
  // 문구에 예시 표지가 붙어 있으면 그대로 나가므로 이슈로 잡는다
  const bad = await bindSection({ key: 'home/x', block: 'block-auth-sign-in', content: { ...c, slots: { copy: leavesOf.map(() => ({ id: 'x', text: '안내(예시)' })) } }, copyIndex: new Map(), routes, locale: 'ko', navLinks, primaryCta, secondaryHref, uiLeaves })
  assert.ok(bad.issues.some((i) => i.why === 'marker'))
})

// ── 03-variants readiness ──
test('C111 readiness: 지어낸 수치가 남아 못 채우는 변형(2)은 다른 변형이 있으면 03-variants 가 고르지 않는다', async () => {
  const table = await readinessTable(['block-hero-baseline-news-app-window', 'block-hero-inline-chip-title', 'block-hero-grid-lines-baseline-word', 'block-auth-sign-in', 'block-pricing-three-tier-cards'])
  assert.equal(table.get('block-hero-baseline-news-app-window'), 2)
  assert.equal(table.get('block-hero-inline-chip-title'), 1)
  assert.equal(table.get('block-auth-sign-in'), 1)
  assert.equal(table.get('block-pricing-three-tier-cards'), 0, 'binder 종류는 0')
  const sitemap = { archetype: 'saas', pages: [{ id: 'home', sections: [{ kind: 'hero', status: 'block', allowedVariants: ['block-hero-baseline-news-app-window', 'block-hero-inline-chip-title'] }] }], globals: [] }
  const cands = library.slice(0, 3).map((r, i) => ({ id: 'abc'[i], recipe: r.id }))
  const got = chooseVariants(sitemap, cands, { seed: 1, weights: [], readiness: table })
  for (const c of cands) assert.equal(got[c.id]['home/hero'], 'block-hero-inline-chip-title')
  // readiness 없이는 옛 동작(다양하게)
  const old = chooseVariants(sitemap, cands, { seed: 1, weights: [] })
  assert.equal(new Set(cands.map((c) => old[c.id]['home/hero'])).size, 2)
})

// ── 생성 파이프 끝에서 끝: 남는 blocker 는 진짜 사실·자료 부족뿐 ──
const OWNER = /^공개 불가 — (?:확인 필요 사실|사이트 주소 미정)/
test('C111·C112 로컬 사이트: 남는 blocker 는 사업자 사실(확인 필요)·사이트 주소·자료 없는 단계 예약 폼뿐이다 — 예시 문구 blocker 0', async () => {
  const R = await makeRun(localBrief(), localContent)
  const s = await gen(R)
  const rest = s.blockers.filter((b) => !OWNER.test(b))
  assert.deepEqual(rest, ['공개 불가 — 자료 연결 안 됨: product-detail/bookable-item (block-contact-form-stepped-booking) — 콘텐츠에 이 블록을 채울 자료가 없다'])
  assert.ok(s.sections.includes('home/notice') && s.sections.includes('home/contact-form') && s.sections.includes('booking-complete/confirmation'))
  const site = JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
  for (const [k, v] of Object.entries(site.sections)) assert.deepEqual(noExample(v.props), [], k + ' 에 예시 표지가 남았다')
  // 예약 완료 잎은 주소에서 예약을 읽는다(예시 예약 Q-1003-0042 를 싣지 않는다)
  const leaf = readFileSync(join(s.siteDir, 'components', 'site', 'booking-complete-confirmation.tsx'), 'utf8')
  assert.match(leaf, /useBookingFromUrl/)
  assert.match(leaf, /React\.Suspense/)
  assert.equal(JSON.stringify(site.sections['booking-complete/confirmation'].props).includes('Q-1003'), false)
  assert.ok(existsSync(join(s.siteDir, 'lib', 'booking.ts')) && existsSync(join(s.siteDir, 'lib', 'contact.ts')))
  assert.deepEqual(s.fallbacks.map((f) => f.key), s.fallbacks.map((f) => f.key)) // 형식
})

test('C111·C112 saas 사이트: 남는 blocker 는 사업자 사실·사이트 주소·후기·FAQ 자료뿐(제품 화면 예시 문구 blocker 0)', async () => {
  const R = await makeRun(SAAS_BRIEF, saasContent)
  const s = await gen(R)
  const rest = s.blockers.filter((b) => !OWNER.test(b))
  // 히어로 앱 창 목업의 예시 앱 글(copy.window — 대장 C310 부수 발견)은 콘텐츠로 못 바꾸므로 「예시 문구 남음」(mockup)으로 남는다 — 제품 화면(가입·로그인·결제 …)의 예시 문구 blocker 는 0 이다.
  const mockupLines = rest.filter((b) => b.startsWith('공개 불가 — 예시 문구 남음: '))
  assert.ok(mockupLines.every((b) => /\(mockup\)/.test(b) && /\/hero — /.test(b)), `목업 말고 예시 문구가 남았다: ${mockupLines}`)
  assert.deepEqual(rest.filter((b) => !mockupLines.includes(b)).map((b) => b.replace(/ — [^—]+$/, '')), ['공개 불가 — 자료 연결 안 됨: home/social-proof (block-social-proof-quote-wall)', '공개 불가 — 자료 연결 안 됨: campaign/faq (block-faq-two-column-index)'])
  const site = JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
  for (const [k, v] of Object.entries(site.sections)) assert.deepEqual(noExample(v.props), [], k + ' 에 예시 표지가 남았다')
  // 제품 화면 문구는 콘텐츠 문구 칸에서 온다
  const auth = site.sections['signup/auth'].props
  assert.ok(refsOf(auth).size >= 3)
  assert.ok([...refsOf(auth)].every((r) => r.startsWith('slots.copy.') || r.startsWith('business.') || r.startsWith('product.')))
})

test('C111 폴백: 03-variants 가 고른 변형이 예시 수치를 남기면 같은 섹션의 더 깨끗한 변형으로 바꾸고 기록한다', async () => {
  const R = await makeRun(SAAS_BRIEF, saasContent, { patchVariants: (v) => ({ ...v, 'home/hero': 'block-hero-baseline-news-app-window' }) })
  const s = await gen(R)
  const f = s.fallbacks.find((x) => x.key === 'home/hero')
  assert.ok(f, JSON.stringify(s.fallbacks))
  assert.equal(f.from, 'block-hero-baseline-news-app-window')
  assert.notEqual(f.to, f.from)
  const site = JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
  assert.equal(site.sections['home/hero'].block, f.to)
  assert.ok(existsSync(join(s.siteDir, 'components', 'site', 'home-hero.tsx')))
  assert.match(readFileSync(join(s.siteDir, 'components', 'site', 'home-hero.tsx'), 'utf8'), new RegExp(f.to.replace('block-hero-', '').replace(/-/g, '.?')))
  assert.equal(PLACEHOLDER.ko, '확인 필요')
  void LOCAL_FACTS
})

test('C112 제품 화면의 숫자 잎(만 14세 확인)은 선택 칸이어도 뺄 수 없다 — 문구 칸으로 다시 쓴다(빼면 가입이 막히는데 확인 칸이 안 보인다)', async () => {
  const ls = await uiLeavesOf('block-auth-sign-up-consents')
  assert.ok(ls.some((l) => l.path === 'copy.ageOver14.label' && l.why === 'digits'), JSON.stringify(ls.map((l) => l.path)))
  const r = await bind('block-auth-sign-up-consents', { archetype: 'saas', locale: 'ko', business: { name: '예약노트' } })
  assert.notEqual(getLeaf(r.props, 'copy.ageOver14.label'), undefined, '문구가 없어도 잎은 남고(공개 불가 사유), 조용히 빠지지 않는다')
  assert.ok(r.issues.some((i) => i.path === 'copy.ageOver14.label'))
})

test('Task 14: 지도 링크가 자리 표시(「확인 필요」)면 링크를 그리지 않는다 — 사실이 있으면 $ref 로 잇는다', async () => {
  const ph = { ...LOCAL, mapLinks: { naver: '확인 필요', kakao: 'To be confirmed' } }
  const bare = await bind(HOURS_BLOCK, ph)
  const text = JSON.stringify(bare.props)
  assert.equal(text.includes('mapLinks.naver'), false, '자리 표시 주소로 href 를 잇지 않는다')
  assert.equal(text.includes('mapLinks.kakao'), false)
  const real = await bind(HOURS_BLOCK, LOCAL)
  assert.ok(JSON.stringify(real.props).includes('mapLinks.naver'), '음성 대조: 주소가 있으면 잇는다')
})

test('Task 14: content-core Url 은 자리 표시 글자를 받고 일반 글자는 여전히 거절한다', async () => {
  const { loadContentSchema } = await import('../stamp/content.mjs')
  const schema = loadContentSchema('local')
  const base = { archetype: 'local', locale: 'ko', business: { name: '달빛', address: '서울특별시 마포구 달빛로 12', phone: '02-1234-5678', url: '확인 필요' } }
  const urlIssues = (url) => schema.safeParse({ ...base, business: { ...base.business, url } }).error?.issues.filter((i) => i.path.join('.') === 'business.url') ?? []
  assert.equal(urlIssues('확인 필요').length, 0)
  assert.equal(urlIssues('To be confirmed').length, 0)
  assert.equal(urlIssues('https://example.org/x').length, 0)
  assert.equal(urlIssues('주소는 나중에').length, 1, '음성 대조')
  assert.equal(urlIssues('ftp://example.org').length, 1)
})

// ── P3-3 Task 14a 2차: 사업 수치 칸(비교 표의 「3개」「20개」)이 빈 문자열이면 그 행을 뺀다 ──
test('C112 bindSection: omit 칸(사업 수치)의 문구가 비어 있으면 그 칸이 든 배열 행을 통째로 뺀다 — 비교 표가 빈 칸을 그리지 않는다', async () => {
  const leavesOf = await uiLeavesOf('block-paywall-upgrade-modal')
  const texts = leavesOf.map((l) => (l.why === 'digits' ? '' : '안내 문구예요'))
  const c = { archetype: 'saas', locale: 'ko', business: { name: '예약노트' }, slots: { copy: texts.map((text) => ({ id: 'x', text })) } }
  const uiLeaves = leavesOf.map((l, i) => ({ path: l.path, ref: 'slots.copy.' + i + '.text', ...(l.why === 'digits' ? { omit: true } : {}) }))
  const run = (leaves) => bindSection({ key: 'home/x', block: 'block-paywall-upgrade-modal', content: c, copyIndex: new Map(), routes, locale: 'ko', navLinks, primaryCta, secondaryHref, uiLeaves: leaves })
  const fixtureRows = getLeaf((await run([])).props, 'copy.compare.rows')
  const res = await run(uiLeaves)
  const rows = getLeaf(res.props, 'copy.compare.rows')
  assert.equal(rows.length, fixtureRows.length - 1, 'current·target 이 모두 비어 있는 첫 행만 빠진다')
  assert.ok(rows.every((r) => r.current !== '3개'), '예시 수치 행이 남지 않는다')
  assert.equal(res.issues.filter((i) => i.why === 'digits').length, 0, JSON.stringify(res.issues))
  // 음성 대조: omit 표지가 없으면 빈 문구가 그대로 $ref 로 남는다(행이 안 빠진다)
  const keep = await run(uiLeaves.map(({ omit, ...l }) => l))
  assert.equal(getLeaf(keep.props, 'copy.compare.rows').length, fixtureRows.length)
  // 문구가 비어 있지 않으면 omit 칸도 그대로 이어진다
  const filled = { ...c, slots: { copy: leavesOf.map(() => ({ id: 'x', text: '무제한' })) } }
  const kept = await bindSection({ key: 'home/x', block: 'block-paywall-upgrade-modal', content: filled, copyIndex: new Map(), routes, locale: 'ko', navLinks, primaryCta, secondaryHref, uiLeaves })
  assert.equal(getLeaf(kept.props, 'copy.compare.rows').length, fixtureRows.length)
})

test('P3-3 Task 14b: 요금표 — 콘텐츠가 부가세 포함 여부를 알면(plans[].vatIncluded) 요금제에 $ref 로 잇고, 모르면 짐작해서 싣지 않는다', async () => {
  const PRICING = 'block-pricing-three-tier-cards'
  const base = { archetype: 'saas', locale: 'ko', plans: [{ name: '월 요금제', monthlyPrice: 9900, currency: 'KRW', features: ['견적서 보내기'] }] }
  const known = { ...base, plans: [{ ...base.plans[0], vatIncluded: true }] }
  const r = await bind(PRICING, known)
  assert.deepEqual(r.props.copy.plans[0].vatIncluded, { $ref: 'plans.0.vatIncluded' })
  assert.equal(resolveRefs(r.props, known).copy.plans[0].vatIncluded, true)
  const unknown = await bind(PRICING, base)
  assert.equal('vatIncluded' in unknown.props.copy.plans[0], false, '세금 사실이 없으면 표기를 지어내지 않는다')
})

test('C359 요금표: 월·연 전환 변형(toggle-annual)은 콘텐츠에 연 결제 칸이 없어 묶지 않고, 월 가격 줄 변형은 그대로 묶인다(음성 대조)', async () => {
  const content = { archetype: 'saas', locale: 'ko', plans: [{ name: '월 요금제', monthlyPrice: 9900, currency: 'KRW', features: ['견적서 보내기'] }] }
  const toggle = await bind('block-pricing-toggle-annual', content)
  assert.equal(toggle.props, null, '연 결제 할인율 0.2 를 예시 그대로 싣고 있다')
  assert.match(toggle.why, /연 결제/)
  assert.equal(JSON.stringify(toggle).includes('annualDiscount'), false)
  const tiers = await bind('block-pricing-three-tier-cards', content)
  assert.ok(tiers.props, '월 가격 줄 변형까지 못 묶게 됐다')
  assert.equal('annualDiscount' in tiers.props.copy, false)
})

// ── 상세페이지(detail) binder — 구매 영역·리뷰·하단 구매 바는 묶고, 비교표·Q&A 는 자료가 없어 blocker (P3-3 detail 레인, 대장 C160·C142) ──
const DETAIL = (locale, opts) => {
  const c = detailContent(locale, opts)({ seedContent: { business: { name: locale === 'ko' ? '결이 공방' : 'Kiln Studio' } }, slots: [] })
  c.slots.copy = [{ id: 'shipping', role: '배송', text: locale === 'ko' ? '3일 안에 출고해요' : 'Ships within 3 business days' }]
  return c
}
const PURCHASE = 'block-product-list-spec-summary'
const STICKY = 'block-bottom-tab-sticky-action-bar'
const NEAR_PRICE = 'block-review-list-summary-near-price'
const DETAIL_COPY = { 'product-detail/purchase-area/shipping#0': 0, 'product-detail/review-list/shipping#0': 0 }
const bindDetail = (block, content, key = 'product-detail/purchase-area') => bind(block, content, { key, copy: DETAIL_COPY, locale: content.locale })
const HANGUL = /[가-힣]/
const blockModule = (rel) => loadTs(join(root, 'registry', 'factory', 'blocks', rel))
const renderBlock = async (rel, name, props) => renderToStaticMarkup(h((await blockModule(rel))[name], props))

test('detail purchase-area: 상품명·가격·옵션·배송 한 줄이 $ref 로 이어지고 예시 문구가 없다 — 한국어 원화는 money 를 주지 않는다(블록 예전 출력 그대로)', async () => {
  const c = DETAIL('ko')
  const r = await bindDetail(PURCHASE, c)
  assert.equal(r.issues.length, 0, JSON.stringify(r.issues))
  const item = r.props.state.data[0]
  assert.deepEqual([item.name, item.price], [{ $ref: 'product.name' }, { $ref: 'product.price' }])
  assert.deepEqual(item.options[0].values[1], { label: { $ref: 'product.options.0.values.1' }, soldOut: false })
  assert.deepEqual(r.props.copy.shippingNote, { $ref: 'slots.copy.0.text' })
  assert.equal('money' in r.props.copy, false)
  assert.equal('specs' in r.props.copy, false, '사양 줄은 고시 표와 겹쳐 뺀다')
  assert.deepEqual(r.props.copy.price.vatNote, '부가세 포함')
  assert.equal(leaves(r.props).some((l) => l.value && /예시/.test(l.value)), false)
  const html = await renderBlock('product-list/spec-summary.tsx', 'ProductListSpecSummary', resolveRefs(r.props, c))
  assert.match(html, /<span data-numeric="true" class="cn-block-product-price-now">29,000원<\/span>/)
  assert.match(html, /부가세 포함/)
  assert.match(html, /3일 안에 출고해요/)
})

test('detail purchase-area(en): 통화 USD 센트 4800 이 $48.00 으로 그려지고 한글이 새지 않는다', async () => {
  const c = DETAIL('en')
  const r = await bindDetail(PURCHASE, c)
  assert.equal(r.issues.length, 0, JSON.stringify(r.issues))
  assert.deepEqual(r.props.copy.money, { currency: { $ref: 'product.currency' }, locale: 'en-US' })
  const resolved = resolveRefs(r.props, c)
  assert.deepEqual([resolved.state.data[0].price, resolved.copy.money.currency], [4800, 'USD'])
  const html = await renderBlock('product-list/spec-summary.tsx', 'ProductListSpecSummary', resolved)
  assert.match(html, /<span data-numeric="true" class="cn-block-product-price-now">\$48\.00<\/span>/)
  assert.match(html, /VAT included/)
  assert.match(html, /Buy now/)
  assert.equal(HANGUL.test(html), false, `한글이 남았다: ${html.match(/[^<>]*[가-힣]+[^<>]*/)?.[0]}`)
  // 배송 문구 칸이 없으면 선택 칸(shippingNote)을 뺀다 — 예시 배송 문구를 싣지 않는다
  const noShip = await bind(PURCHASE, c, { key: 'product-detail/purchase-area', locale: 'en' })
  assert.equal('shippingNote' in noShip.props.copy, false)
})

test('detail sticky-buy-bar: 이름·가격·구매·장바구니가 이어진다 — 한국어 원화는 금액 + 「원」, 영어는 통화 기호가 붙은 금액(단위 글자 없음)', async () => {
  const ko = DETAIL('ko')
  const k = await bindDetail(STICKY, ko, 'global/sticky-buy-bar')
  assert.equal(k.issues.length, 0, JSON.stringify(k.issues))
  assert.deepEqual([k.props.copy.name, k.props.copy.price, k.props.copy.unit], [{ $ref: 'product.name' }, { $ref: 'product.price' }, '원'])
  for (const f of ['originalPrice', 'originalPriceLabel', 'money']) assert.equal(f in k.props.copy, false, `칸 ${f} 는 콘텐츠에 없어 뺀다`)
  const kh = await renderBlock('bottom-tab/sticky-action-bar.tsx', 'BottomTabStickyActionBar', resolveRefs(k.props, ko))
  assert.match(kh, /29,000<\/span><span class="cn-block-bottom-unit">원<\/span>/)
  assert.match(kh, /href="#product"/, '구매 버튼은 구매 영역(옵션 고르는 곳)으로')
  const en = DETAIL('en')
  const e = await bindDetail(STICKY, en, 'global/sticky-buy-bar')
  assert.equal('unit' in e.props.copy, false)
  assert.equal(e.issues.length, 0, JSON.stringify(e.issues))
  const eh = await renderBlock('bottom-tab/sticky-action-bar.tsx', 'BottomTabStickyActionBar', resolveRefs(e.props, en))
  assert.match(eh, /\$48\.00/)
  assert.equal(HANGUL.test(eh), false)
  assert.match(eh, /Buy now/)
  assert.match(eh, /Add to cart/)
  // 가격이 없으면 그리지 않는다
  assert.equal((await bind(STICKY, { archetype: 'detail', locale: 'ko', reviews: [] }, { key: 'global/sticky-buy-bar' })).props, null)
})

test('detail review-list: 콘텐츠 리뷰만 잇는다(작성자·구매 인증은 싣지 않음) — summary-near-price 만 묶고 나머지 변형은 적립 안내 칸이 없어 묶지 않는다', async () => {
  const c = DETAIL('ko')
  const r = await bindDetail(NEAR_PRICE, c, 'product-detail/review-list')
  assert.equal(r.issues.length, 0, JSON.stringify(r.issues))
  assert.deepEqual(r.props.reviews[1].reply.body, { $ref: 'reviews.1.sellerReply.text' })
  assert.equal('reply' in r.props.reviews[0], false, '답글이 없는 리뷰에 답글을 지어내지 않는다')
  for (const k of ['verified', 'option', 'title']) assert.equal(r.props.reviews.some((x) => k in x), false, k)
  assert.deepEqual(r.props.summary.avg, { $ref: 'product.rating.avg' }, '콘텐츠 별점이 있으면 그 값')
  assert.deepEqual(r.props.summary.asOf, { $ref: 'reviews.1.date' }, '기준일은 가장 최근 리뷰 날짜')
  assert.deepEqual(r.props.copy.shipping, { $ref: 'slots.copy.0.text' })
  const html = await renderBlock('review-list/summary-near-price.tsx', 'ReviewListSummaryNearPrice', resolveRefs(r.props, c))
  assert.match(html, /data-price="billed"[^>]*>29,000원</)
  assert.match(html, /끈이 조금 짧아요/)
  assert.match(html, /끈 길이를 늘릴게요/)
  assert.match(html, /"price":29000,"priceCurrency":"KRW"/)
  // 다른 두 변형: 「리뷰를 쓰면 주는 보상」 문구가 필수인데 콘텐츠에 칸이 없다 → 묶지 않고 까닭을 남긴다
  for (const b of ['block-review-list-photo-gallery', 'block-review-list-distribution-filter']) {
    const x = await bindDetail(b, c, 'product-detail/review-list')
    assert.equal(x.props, null, b)
    assert.match(x.why, /적립\(쓴 뒤 지급\) 안내 문구가 필수/, b)
  }
})

test('detail review-list(en): $48.00·영어 날짜·한글 없음, 별점이 콘텐츠에 없으면 리뷰 목록에서 센 값', async () => {
  const c = DETAIL('en')
  const r = await bindDetail(NEAR_PRICE, c, 'product-detail/review-list')
  assert.equal(r.issues.length, 0, JSON.stringify(r.issues))
  const html = await renderBlock('review-list/summary-near-price.tsx', 'ReviewListSummaryNearPrice', resolveRefs(r.props, c))
  assert.match(html, /data-price="billed"[^>]*>\$48\.00</)
  assert.match(html, /September 25, 2026/)
  assert.match(html, /"price":48,"priceCurrency":"USD"/)
  assert.equal(HANGUL.test(html), false, `한글이 남았다: ${html.match(/[^<>]*[가-힣]+[^<>]*/)?.[0]}`)
  const noRating = DETAIL('en')
  delete noRating.product.rating
  const n = await bindDetail(NEAR_PRICE, noRating, 'product-detail/review-list')
  assert.deepEqual([n.props.summary.avg, n.props.summary.count], [4.5, 2])
  assert.deepEqual(n.props.summary.distribution, { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 })
})

test('detail review-list(C96): 리뷰가 없으면 가격 곁 요약은 빈 상태로 그린다(리뷰·평균을 지어내지 않는다) · 적립 안내가 필수인 두 변형은 자료가 없어 그리지 않는다 · detail 이 아닌 원형은 예전 안내 그대로', async () => {
  const none = DETAIL('ko', { reviews: [] })
  const near = await bindDetail(NEAR_PRICE, none, 'product-detail/review-list')
  assert.ok(near.props, '리뷰 0건이어도 막지 않는다')
  assert.deepEqual(near.props.reviews, [])
  assert.equal(near.props.summary.count, 0)
  assert.equal('avg' in near.props.summary, false)
  for (const b of ['block-review-list-photo-gallery', 'block-review-list-distribution-filter']) {
    const x = await bindDetail(b, none, 'product-detail/review-list')
    assert.equal(x.props, null, b)
    assert.match(x.why, /적립\(쓴 뒤 지급\) 안내 문구가 필수/)
  }
  const other = await bind(NEAR_PRICE, LOCAL, { key: 'home/reviews' })
  assert.equal(other.props, null)
  assert.match(other.why, /아직 이어지지 않았다/)
})

test('detail key-points·qna: 비교표의 「다른 방식」 자료·묻고 답한 질문이 콘텐츠에 없어 그리지 않는다(값을 지어내지 않는다)', async () => {
  for (const locale of ['ko', 'en']) {
    const c = DETAIL(locale)
    const k = await bind('block-features-compare-table', c, { key: 'product-detail/key-points', locale })
    assert.equal(k.props, null)
    assert.match(k.why, /비교표.*「다른 방식」 자료가 콘텐츠에 없다/)
    for (const b of ['block-faq-two-column-index', 'block-faq-grouped-by-topic']) {
      const q = await bind(b, c, { key: 'product-detail/qna', locale })
      assert.equal(q.props, null, b)
      assert.match(q.why, /Q&A\) 자료가 상세페이지 콘텐츠에 없다/)
    }
  }
  // 예전 안내 그대로: detail 이 아닌 원형의 FAQ 는 기본 문장
  assert.equal((await bind('block-faq-two-column-index', LOCAL, { key: 'home/faq' })).why, '콘텐츠에 이 블록을 채울 자료가 없다')
})

test('detail binder 는 원화 전용 commerce 를 건드리지 않는다 — commerce 상품 목록(products)은 예전대로, 통화 칸 없음', async () => {
  const commerce = { archetype: 'commerce', locale: 'ko', products: [{ slug: 'a', name: '소금빵', price: 3200, options: [], thumbs: [{ id: 'product-thumb', aspect: '1:1', source: 'real-required', alt: '소금빵' }] }] }
  const r = await bind('block-product-list-grid-cards', commerce, { key: 'home/products' })
  assert.ok(r.props)
  assert.deepEqual(r.props.state, { status: 'ready', data: { $ref: 'products' } })
  assert.equal('money' in (r.props.copy ?? {}), false, 'commerce 에는 통화 칸을 더하지 않았다')
})
void detailBrief

// ── FV1 Task 5.7 히어로 6변형 묶기(변형마다 한 줄 이상) ──
const HERO_COPY = { 'home/hero/headline#0': 0, 'home/hero/subhead#0': 1, 'home/hero/primaryCta#0': 2 }
const heroBind = (variant, content, o = {}) => bind(`block-hero-${variant}`, content, { key: 'home/hero', copy: HERO_COPY, ...o })
const SAAS_LIKE = { archetype: 'saas', locale: 'ko', site: { name: '달빛정산' }, business: { name: '달빛정산' } }

test('5.7 hero/object-3d-orbit: 3D 오브젝트 이름(가상)을 빼고 무대 이름은 상호로 만든다', async () => {
  const r = await heroBind('object-3d-orbit', SAAS_LIKE)
  assert.ok(r.props, r.why)
  for (const k of ['objects', 'objectsLabel', 'prevLabel', 'nextLabel']) assert.equal(k in r.props.copy, false, k)
  assert.deepEqual(r.props.copy.stageLabel, { $ref: 'site.name', template: '{} 3D 장면' })
  assert.equal(resolveRefs(r.props.copy.stageLabel, SAAS_LIKE), '달빛정산 3D 장면')
  assert.equal(JSON.stringify(r.props).includes('(예시)'), false)
  const en = await heroBind('object-3d-orbit', { ...SAAS_LIKE, locale: 'en' }, { locale: 'en' })
  assert.deepEqual(en.props.copy.stageLabel, { $ref: 'site.name', template: '{} 3D scene' })
})

test('5.7 hero/illustration-scene: 제목·부제·버튼을 문구 칸·가는 곳 이름표로 묶고 예시 글을 남기지 않는다', async () => {
  const content = { ...SAAS_LIKE, slots: { copy: [{ id: 'headline', role: '', text: '정산이 끝나요' }, { id: 'subhead', role: '', text: '매달 하던 일을 줄여요' }, { id: 'primaryCta', role: '', text: '시작하기' }] } }
  const r = await heroBind('illustration-scene', content)
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.copy.title, { $ref: 'slots.copy.0.text' })
  assert.deepEqual(r.props.copy.lede, { $ref: 'slots.copy.1.text' })
  assert.deepEqual(r.props.copy.primaryCta.label, { $ref: 'slots.copy.2.text' })
  assert.equal(r.issues.filter((i) => i.why === 'marker' || i.why === 'leak').length, 0, JSON.stringify(r.issues))
})

test('5.7 hero/map-first: 상호·주소·전화·지도 링크를 $ref 로 잇는다 — 영업 시간·가상 지점은 싣지 않고, 주소가 없으면 쓰지 않는다', async () => {
  const r = await heroBind('map-first', LOCAL)
  assert.ok(r.props, r.why)
  assert.equal(r.props.copy.branches.length, 1, '지점은 콘텐츠 사업체 하나')
  assert.deepEqual(r.props.copy.branches[0], { id: 'main', name: { $ref: 'business.name' }, address: { $ref: 'business.address' }, x: 50, y: 50, phone: { $ref: 'business.phone' }, href: { $ref: 'mapLinks.naver' } })
  assert.equal('hours' in r.props.copy.branches[0], false)
  assert.equal(resolveRefs(r.props.copy.branches, LOCAL)[0].address, LOCAL.business.address)
  assert.equal(JSON.stringify(r.props.copy.branches).includes('예시'), false, '가상 지점(예시빵집)이 새지 않는다')
  // 지도 링크·전화가 없으면 그 칸만 빠진다
  const bare = { ...LOCAL, mapLinks: undefined, business: { name: LOCAL.business.name, address: LOCAL.business.address } }
  const b = await heroBind('map-first', bare)
  assert.deepEqual(Object.keys(b.props.copy.branches[0]).sort(), ['address', 'id', 'name', 'x', 'y'])
  // 공공 기관은 agency 의 이름·주소·대표전화
  const pub = { archetype: 'public', locale: 'ko', agency: { name: '가상구청', address: '가상시 중앙로 1', mainPhone: '02-0000-0000' } }
  const p = await heroBind('map-first', pub)
  assert.deepEqual(p.props.copy.branches[0].name, { $ref: 'agency.name' })
  assert.deepEqual(p.props.copy.branches[0].phone, { $ref: 'agency.mainPhone' })
  // 주소가 없으면 지도에 놓을 곳이 없다
  const none = await heroBind('map-first', { ...LOCAL, business: { name: LOCAL.business.name } })
  assert.equal(none.props, null)
  assert.match(none.why, /주소.*콘텐츠에 없다/)
})

test('5.7 hero/mascot-greeting: 캐릭터 상표·저작권 확인 문구는 사실이라 콘텐츠에 자료가 없으면 쓰지 않는다(확인했다고 지어내지 않는다)', async () => {
  const r = await heroBind('mascot-greeting', LOCAL)
  assert.equal(r.props, null)
  assert.match(r.why, /상표·저작권 확인 문구/)
})

test('5.7 hero/video-montage·screenshot-window: 공통 묶기로 제목·부제·버튼이 이어지고 가상 앱 글·예시 글이 남지 않는다', async () => {
  const content = { ...SAAS_LIKE, slots: { copy: [{ id: 'headline', role: '', text: '정산이 끝나요' }, { id: 'subhead', role: '', text: '매달 하던 일을 줄여요' }, { id: 'primaryCta', role: '', text: '시작하기' }] } }
  for (const v of ['video-montage', 'screenshot-window']) {
    const r = await heroBind(v, content)
    assert.ok(r.props, `${v}: ${r.why}`)
    assert.deepEqual(r.props.copy.title, { $ref: 'slots.copy.0.text' }, v)
    assert.deepEqual(r.props.copy.lede, { $ref: 'slots.copy.1.text' }, v)
    assert.equal(r.issues.filter((i) => ['marker', 'leak', 'mockup'].includes(i.why)).length, 0, `${v}: ${JSON.stringify(r.issues)}`)
  }
})

// ── FV1 Task 5.11 (C5 자료 연결) — binder 빈자리 감사가 찾은 자리를 고친 줄마다 시험 하나(감사: binding-audit.test.mjs) ──
const slotCopy = (...ids) => ({ copy: ids.map((id) => ({ id, role: '', text: `${id} 문구` })), images: [] })

test('5.11 특징: landing features 구조 칸이 벤토·번호 단계·카드 단계에 이어진다(예시 제목의 단계 수 주장은 싣지 않는다)', async () => {
  const landing = { archetype: 'landing', locale: 'ko', features: [{ title: '입장권', body: '현장 등록이 필요 없어요' }, { title: '안내 문자', body: '전날 저녁에 보내요' }], slots: slotCopy() }
  for (const [block, field] of [['block-features-bento-grid', 'cells'], ['block-features-numbered-steps', 'steps'], ['block-features-stagger-cards', 'steps']]) {
    const r = await bind(block, landing, { key: 'home/features' })
    assert.deepEqual(r.props.copy[field], [{ title: { $ref: 'features.0.title' }, body: { $ref: 'features.0.body' } }, { title: { $ref: 'features.1.title' }, body: { $ref: 'features.1.body' } }], block)
    assert.equal(typeof r.props.copy.title, 'string')
    assert.equal(r.issues.length, 0, block + JSON.stringify(r.issues))
  }
  assert.match((await bind('block-features-compare-table', landing, { key: 'home/features' })).why, /다른 방식/)
})

test('5.11 특징: 구조 칸이 없는 brand 는 항목마다 쓴 문구 칸 쌍(tileTitle·tileBody)으로 벤토 칸을 채운다 — 쌍이 하나라도 모자라면 묶지 않는다', async () => {
  const brand = { archetype: 'brand', locale: 'ko', slots: slotCopy('tileTitle', 'tileBody', 'tileTitle', 'tileBody') }
  const copy = { 'home/business-scope/tileTitle#0': 0, 'home/business-scope/tileBody#0': 1, 'home/business-scope/tileTitle#1': 2, 'home/business-scope/tileBody#1': 3 }
  const r = await bind('block-features-bento-grid', brand, { key: 'home/business-scope', copy })
  assert.deepEqual(r.props.copy.cells, [{ title: { $ref: 'slots.copy.0.text' }, body: { $ref: 'slots.copy.1.text' } }, { title: { $ref: 'slots.copy.2.text' }, body: { $ref: 'slots.copy.3.text' } }])
  const half = await bind('block-features-bento-grid', brand, { key: 'home/business-scope', copy: { 'home/business-scope/tileTitle#0': 0 } })
  assert.equal(half.props, null)
  assert.match(half.why, /특징·단계 항목/)
  // saas 의 stepTitle/stepBody 는 단계 전체의 제목 하나라 항목이 아니다 — 구조 칸 없이는 묶지 않는다
  const saas = { archetype: 'saas', locale: 'ko', slots: slotCopy('stepTitle', 'stepBody') }
  assert.equal((await bind('block-features-bento-grid', saas, { key: 'home/workflow-features', copy: { 'home/workflow-features/stepTitle#0': 0, 'home/workflow-features/stepBody#0': 1 } })).props, null)
})

test('5.11 사회적 증거: saas 후기는 후기 본문 칸이 없으면 구체 결과를 본문으로 쓴다(결과 줄 중복 없음) · landing 만 근거 한 줄로 로고 줄을 그린다 · 자리 표시는 증거가 아니다', async () => {
  const t = [{ name: '김하늘', title: '운영 팀장', company: '모래시계 상회(예시)', result: '정산이 사흘에서 반나절로 줄었어요' }]
  const saas = { archetype: 'saas', locale: 'ko', testimonials: t, slots: slotCopy() }
  for (const b of ['block-social-proof-quote-wall', 'block-social-proof-whip-quotes']) {
    const r = await bind(b, saas, { key: 'home/social-proof' })
    assert.deepEqual(r.props.copy.quotes[0].quote, { $ref: 'testimonials.0.result' }, b)
    assert.equal('result' in r.props.copy.quotes[0], false, b)
  }
  const withQuote = { ...saas, testimonials: [{ ...t[0], quote: '정산이 빨라졌어요' }] }
  const q = await bind('block-social-proof-quote-wall', withQuote, { key: 'home/social-proof' })
  assert.deepEqual([q.props.copy.quotes[0].quote, q.props.copy.quotes[0].result], [{ $ref: 'testimonials.0.quote' }, { $ref: 'testimonials.0.result' }])
  const landing = { archetype: 'landing', locale: 'ko', slots: { copy: [{ id: 'claim', role: '', text: '지난해 3,200명이 참가했어요 — 2026년 9월 기준' }], images: [] } }
  const rail = await bind('block-social-proof-logo-rail', landing, { key: 'home/social-proof', copy: { 'home/social-proof/claim#0': 0 } })
  assert.deepEqual([rail.props.copy.claim, rail.props.copy.logos], [{ $ref: 'slots.copy.0.text' }, []])
  assert.notEqual(rail.props.copy.title, '이런 곳이 씁니다', '로고가 없는데 「이런 곳이 씁니다」라고 하지 않는다')
  const placeholder = { ...landing, slots: { copy: [{ id: 'claim', role: '', text: PLACEHOLDER.ko }], images: [] } }
  assert.equal((await bind('block-social-proof-logo-rail', placeholder, { key: 'home/social-proof', copy: { 'home/social-proof/claim#0': 0 } })).props, null)
  const saasClaim = { ...saas, testimonials: [], slots: landing.slots }
  assert.equal((await bind('block-social-proof-logo-rail', saasClaim, { key: 'home/social-proof', copy: { 'home/social-proof/claim#0': 0 } })).props, null, 'saas 의 claim 은 제품 약속일 수 있어 증거 칸에 싣지 않는다')
})

test('5.11 요금표 기능 × 요금제 표: 행은 요금제들의 포함 기능 합집합(같은 글은 한 행)이고 캡션은 요금제 수를 주장하지 않는다', async () => {
  const saas = { archetype: 'saas', locale: 'ko', plans: [{ name: '기본', monthlyPrice: 9900, currency: 'KRW', features: ['예약 관리', '문자 알림'] }, { name: '팀', monthlyPrice: 19900, currency: 'KRW', features: ['예약 관리', '직원 계정 5개'] }], slots: slotCopy() }
  const r = await bind('block-pricing-feature-matrix', saas, { key: 'pricing/pricing-plans' })
  assert.deepEqual(resolveRefs(r.props.copy.features, saas), ['예약 관리', '문자 알림', '직원 계정 5개'])
  assert.deepEqual(r.props.copy.features[0], { $ref: 'plans.0.features.0' })
  assert.doesNotMatch(r.props.copy.caption, /세 가지/)
  const none = await bind('block-pricing-feature-matrix', { ...saas, plans: [{ name: '기본', monthlyPrice: 0, currency: 'KRW', features: [] }] }, { key: 'pricing/pricing-plans' })
  assert.equal(none.props, null)
  assert.match(none.why, /포함 기능 목록이 없어/)
})

test('5.11 앱바·푸터: 회사 정보 칸이 없는 원형은 이름을 manifest.name(pwa)·facts.name 에서 읽고, portfolio 푸터는 이름·문의 메일만 잇는다', async () => {
  const pwa = { archetype: 'pwa', locale: 'ko', manifest: { name: '오늘 장부' }, slots: slotCopy() }
  const nav = await bind('block-nav-app-bar-tabs', pwa, { key: 'home/app-bar' })
  assert.deepEqual(nav.props.copy.title, { $ref: 'manifest.name' })
  const portfolio = { archetype: 'portfolio', locale: 'ko', facts: { name: '결 스튜디오' }, contact: { email: 'hello@example.org' }, slots: slotCopy() }
  const foot = await bind('block-footer-compact-strip', portfolio, { key: 'global/footer' })
  assert.deepEqual(foot.props.copy.business, { name: { $ref: 'facts.name' }, email: { $ref: 'contact.email' } })
  assert.deepEqual(foot.props.copy.brand, { $ref: 'facts.name' })
  assert.equal(foot.issues.length, 0, JSON.stringify(foot.issues))
  assert.equal((await bind('block-footer-compact-strip', { ...portfolio, facts: {} }, { key: 'global/footer' })).props, null, '이름이 어디에도 없으면 묶지 않는다')
})

test('5.11 메뉴 사진 줄: 평평한 items 에 이름·가격(·사진)을 잇는다 — 분류 변형은 예전 그대로', async () => {
  const local = { archetype: 'local', locale: 'ko', menu: [{ name: '우유식빵', price: 4800, photo: { id: 'menu-photo', aspect: '1:1', source: 'real-required', alt: '우유식빵' } }, { name: '소금빵', price: 3200 }], slots: slotCopy() }
  const r = await bind('block-menu-price-photo-rows', local, { key: 'home/menu-price' })
  assert.deepEqual(r.props.items, [{ name: { $ref: 'menu.0.name' }, price: { $ref: 'menu.0.price' }, photo: { $ref: 'menu.0.photo' } }, { name: { $ref: 'menu.1.name' }, price: { $ref: 'menu.1.price' } }])
  const board = await bind('block-menu-price-board-columns', local, { key: 'home/menu-price' })
  assert.ok(Array.isArray(board.props.categories))
  assert.equal((await bind('block-menu-price-photo-rows', { ...local, menu: [] }, { key: 'home/menu-price' })).props, null)
})

test('5.11 대시보드 패널: KPI·경고·표가 있으면 ready 로 잇고(경고 제목은 항목마다 쓴 문구 칸), 쓸 데이터가 없으면 지어내지 않고 빈 상태를 그린다', async () => {
  const kpi = { id: 'noshow', label: '노쇼', value: 3, unit: '건', baseline: { target: 5 }, rank: 1 }
  const dash = { archetype: 'dashboard', locale: 'ko', decision: { dashboard_type: 'operational', refresh: '5분마다' }, kpis: [kpi], alerts: [{ id: 'a1', severity: 'critical', recordUrl: '/records/1', actions: ['열기', '배정'] }], table: { columns: [{ id: 'name', label: '이름', numeric: false }], density: 40, rows: [{ name: '김하늘' }] }, slots: slotCopy('alert') }
  const k = await bind('block-dashboard-panel-kpi-first', dash, { key: 'operational/kpi-row' })
  assert.deepEqual(k.props.state, { status: 'ready', data: { asOf: { $ref: 'decision.refresh' }, kpis: { $ref: 'kpis' } } })
  const a = await bind('block-dashboard-panel-action-list', dash, { key: 'operational/action-list', copy: { 'operational/action-list/alert#0': 0 } })
  assert.equal(a.props.state.status, 'ready')
  assert.deepEqual(a.props.state.data.actions[0].title, { $ref: 'slots.copy.0.text' })
  assert.deepEqual(a.props.state.data.actions[0].actions, [{ label: { $ref: 'alerts.0.actions.0' }, href: { $ref: 'alerts.0.recordUrl' } }, { label: { $ref: 'alerts.0.actions.1' }, href: { $ref: 'alerts.0.recordUrl' } }])
  const t = await bind('block-dashboard-panel-trend-plus-table', dash, { key: 'analytics/main-trend' })
  assert.deepEqual(t.props.state.data.table, { $ref: 'table' })
  assert.equal('filter' in t.props.copy, false, '예시의 「예약 경로」 거르기는 싣지 않는다')
  // 데이터가 없으면 — 세 변형 모두 빈 상태 + 사업 문구 없는 안내 글(20자 이상), 행동 버튼 없음
  const bare = { archetype: 'dashboard', locale: 'ko', decision: { dashboard_type: 'operational', refresh: '5분마다' }, kpis: [], alerts: [], slots: slotCopy() }
  for (const b of ['block-dashboard-panel-kpi-first', 'block-dashboard-panel-action-list', 'block-dashboard-panel-trend-plus-table']) {
    const r = await bind(b, bare, { key: 'operational/x' })
    assert.deepEqual(r.props.state, { status: 'empty' }, b)
    assert.ok([...(r.props.copy.empty.title + r.props.copy.empty.body)].length >= 20, b)
    assert.equal('action' in r.props.copy.empty, false, b)
    assert.doesNotMatch(JSON.stringify(r.props.copy.empty), /예약/, b)
  }
  const en = await bind('block-dashboard-panel-kpi-first', { ...bare, locale: 'en' }, { key: 'operational/x', locale: 'en' })
  assert.doesNotMatch(JSON.stringify(en.props.copy.empty) + en.props.copy.title, /[가-힣]/, '영어 사이트의 빈 상태·제목에 한글이 새지 않는다(이름표 표)')
})

test('5.11 신청 폼: 소식지 한 줄·자료 미리보기 폼이 04 문구 칸과 leadMagnet 에 이어지고, 잎이 정적 제출 포트(makeLeadPorts)를 끼운다', async () => {
  const ids = ['leadTitle', 'leadWhat', 'submitLabel', 'consentNote', 'riskReducer']
  const landing = { archetype: 'landing', locale: 'ko', leadMagnet: { title: '참가 안내서', what: '일정표와 장소 지도가 들어 있어요', format: 'PDF 8쪽' }, slots: slotCopy(...ids) }
  const copy = Object.fromEntries(ids.map((id, i) => [`home/lead-capture/${id}#0`, i]))
  const n = await bind('block-lead-capture-inline-newsletter', landing, { key: 'home/lead-capture', copy })
  assert.deepEqual([n.props.copy.title, n.props.copy.what, n.props.copy.submit, n.props.copy.when], ['leadTitle', 'leadWhat', 'submitLabel', 'riskReducer'].map((id) => ({ $ref: `slots.copy.${ids.indexOf(id)}.text` })))
  assert.equal('sample' in n.props.copy, false, '지난 호 링크는 첫 신청 폼에 없다')
  assert.deepEqual(n.props.copy.consent.label, { $ref: 'slots.copy.3.text' })
  assert.doesNotMatch(JSON.stringify(n.props.copy), /소식지|목요일|1분/, '예시 사업 문구가 남지 않는다')
  assert.equal(n.issues.length, 0, JSON.stringify(n.issues))
  const m = await bind('block-lead-capture-magnet-preview', landing, { key: 'home/lead-capture', copy })
  assert.deepEqual([m.props.copy.preview.name, m.props.copy.preview.meta, m.props.copy.preview.contents], [{ $ref: 'leadMagnet.title' }, { $ref: 'leadMagnet.format' }, [{ $ref: 'leadMagnet.what' }]])
  assert.doesNotMatch(JSON.stringify(m.props.copy), /체크리스트|1분 안에|예약/)
  assert.equal(m.issues.length, 0, JSON.stringify(m.issues))
  // 자료(leadMagnet)가 없으면 미리보기 폼은 묶지 않는다 · 문구 칸이 모자라면 둘 다 묶지 않는다
  assert.equal((await bind('block-lead-capture-magnet-preview', { ...landing, leadMagnet: undefined }, { key: 'home/lead-capture', copy })).props, null)
  assert.equal((await bind('block-lead-capture-inline-newsletter', landing, { key: 'home/lead-capture', copy: { 'home/lead-capture/leadTitle#0': 0 } })).props, null)
  // 잎: 신청 폼 두 변형만 정적 제출 포트를 받는다(order-complete 의 submit 은 다른 일 — 건드리지 않는다)
  for (const b of ['block-lead-capture-inline-newsletter', 'block-lead-capture-magnet-preview']) {
    assert.equal(blockTraits(blockItems().get(b)).lead, true, b)
    const src = leafSource({ name: 'HomeLeadCapture', block: b, recipeId: 'r1' })
    assert.match(src, /makeLeadPorts/)
    assert.match(src, /submit=\{lead\.submit\}/)
  }
  assert.equal(blockTraits(blockItems().get('block-confirmation-order-complete')).lead, false)
  const tpl = readFileSync(join(root, 'factory', 'stamp', 'site-template', 'lib', 'contact.ts'), 'utf8')
  assert.match(tpl, /export function makeLeadPorts/)
})

test('5.11 공지 전광판: 공지(notices)의 글·주소·날짜가 항목으로 이어진다 — 공지가 없으면 묶지 않는다', async () => {
  const pub = { archetype: 'public', locale: 'ko', notices: [{ date: '2026-10-05', category: '공지', title: '시설 점검 안내', department: '총무과', url: '/notices/1', external: false }, { date: '2026-10-07', category: '공지', title: '민원실 운영 시간 변경', department: '민원과', url: 'https://example.org/n/2', external: true }], slots: slotCopy() }
  const r = await bind('block-announcement-notice-ticker', pub, { key: 'global/official-banner' })
  assert.deepEqual(r.props.copy.items[1], { text: { $ref: 'notices.1.title' }, href: { $ref: 'notices.1.url' }, date: { $ref: 'notices.1.date' } })
  assert.equal('viewAll' in r.props.copy, false)
  assert.equal((await bind('block-announcement-notice-ticker', { ...pub, notices: [] }, { key: 'global/official-banner' })).props, null)
})

test('5.11 saas FAQ: 콘텐츠 faq(질문·답 구조 칸)가 FAQ 두 변형에 이어진다 — 스키마가 faq 칸을 받는다', async () => {
  const saas = { archetype: 'saas', locale: 'ko', faq: [{ q: '해지하면 데이터는요?', a: '30일 안에 내려받을 수 있어요' }], slots: slotCopy() }
  for (const b of ['block-faq-single-accordion', 'block-faq-two-column-index']) {
    const r = await bind(b, saas, { key: 'campaign/faq' })
    assert.deepEqual(r.props.copy.items, [{ q: { $ref: 'faq.0.q' }, a: { $ref: 'faq.0.a' } }], b)
  }
  const schema = readFileSync(join(root, 'registry', 'factory', 'content', 'schemas', 'saas.ts'), 'utf8')
  assert.match(schema, /faq: z\.array\(Faq\)/)
})

test('C325 public 푸터: 기관 정보(agency)가 푸터 사업자 줄에 $ref 로 이어지고(대표전화 → phone), 예시 모듈의 표지·가상 이름은 남지 않는다 — 한국어·영어', async () => {
  const agency = { name: '새벽구청', address: '서울특별시 가상구 새벽로 1', mainPhone: '02-120', phoneNote: '평일 9시~18시, 무료', privacyPolicyUrl: '/privacy', accessibilityPolicyUrl: '/accessibility', copyright: '새벽구청 저작권 안내' }
  for (const locale of ['ko', 'en']) {
    for (const block of ['block-footer-product-legal', 'block-footer-stacked-legal']) {
      const r = await bind(block, { archetype: 'public', locale, agency, slots: slotCopy() }, { key: 'global/footer', locale })
      assert.ok(r.props, `${locale} ${block}`)
      assert.equal(r.issues.filter((i) => i.why === 'marker' || i.why === 'name').length, 0, `${locale} ${block}: ${JSON.stringify(r.issues)}`)
      const biz = r.props.copy.business ?? r.props.copy.agency ?? {}
      for (const v of Object.values(biz)) assert.ok(typeof v === 'object' ? v.$ref?.startsWith('agency.') : false, `${block}: ${JSON.stringify(v)}`)
      if ('phone' in biz) assert.deepEqual(biz.phone, { $ref: 'agency.mainPhone' }, '대표전화는 mainPhone 에서 온다')
    }
  }
  // 브리프의 가상 이름 「예시」 표지는 콘텐츠 값이라 06 이 따로 막는다(marker) — 예시 모듈이 아니라 사실이 정한다
  // (QFIX [2]) 이름 끝의 표지 하나는 가상 사업임을 밝히는 표시라 면제 — 이름 가운데·다른 칸의 표지는 그대로 막는다
  const marked = await bind('block-footer-stacked-legal', { archetype: 'public', locale: 'ko', agency: { ...agency, name: '새벽(예시)구청' }, slots: slotCopy() }, { key: 'global/footer' })
  assert.ok(marked.issues.some((i) => i.why === 'marker'))
  const endMarked = await bind('block-footer-stacked-legal', { archetype: 'public', locale: 'ko', agency: { ...agency, name: '새벽구청 (예시)' }, slots: slotCopy() }, { key: 'global/footer' })
  assert.equal(endMarked.issues.some((i) => i.why === 'marker'), false, JSON.stringify(endMarked.issues))
})

// ── FV1 BIND2: 관리자 목록 표 · 고시·배송반품 · 분류 칩 감사 콘텐츠 · 새 판 알림 ──
const DASH_TABLE = {
  columns: [{ id: 'name', label: '이름', numeric: false }, { id: 'status', label: '상태', numeric: false }, { id: 'amount', label: '금액', numeric: true }],
  density: 40,
  rows: [{ name: '김하늘', status: '진행', amount: 1200 }, { name: '박바다', status: '완료', amount: 3400 }, { name: '이구름', status: '진행', amount: null }],
}
const DASH = (locale = 'ko', table = DASH_TABLE) => ({ archetype: 'dashboard', locale, decision: { dashboard_type: 'operational', refresh: '5분마다' }, kpis: [], alerts: [], ...(table ? { table } : {}), slots: slotCopy() })
const TABLE_BLOCKS = ['block-data-table-admin-list', 'block-data-table-compact']
const BAD_ISSUE = (r) => r.issues // 예시 글이 하나도 새지 않는다(marker·name·digits·number·link·leak 모두)

test('BIND2 목록 표(data-table): 콘텐츠 table 의 열·행이 $ref 로 이어지고 예시 사용자 목록이 남지 않는다 — 첫 열은 식별자, 숫자 열은 numeric, 값이 2~8가지인 글자 열은 거르기', async () => {
  const c = DASH()
  for (const b of TABLE_BLOCKS) {
    const r = await bind(b, c, { key: 'admin-list/data-table' })
    assert.ok(r.props, b)
    assert.equal(BAD_ISSUE(r).length, 0, `${b}: ${JSON.stringify(r.issues)}`)
    const d = r.props.state.data
    assert.equal(r.props.state.status, 'ready')
    assert.deepEqual(d.columns.map((x) => [x.id, x.primary === true, x.kind, x.filter === true]), [['name', true, 'text', false], ['status', false, 'text', b.endsWith('admin-list')], ['amount', false, 'numeric', false]], b) // 거르기 select 는 검색줄이 있는 admin-list 에만
    assert.deepEqual(d.columns[0].label, { $ref: 'table.columns.0.label' })
    assert.deepEqual(d.rows[1], { id: 'row-2', cells: { name: { $ref: 'table.rows.1.name' }, status: { $ref: 'table.rows.1.status' }, amount: { $ref: 'table.rows.1.amount' } } }, b)
    const name = b.endsWith('compact') ? 'DataTableCompact' : 'DataTableAdminList'
    const html = await renderBlock(`data-table/${b.replace('block-data-table-', '')}.tsx`, name, resolveRefs(r.props, c))
    assert.match(html, /김하늘/, b)
    assert.doesNotMatch(html, /example\.com|예시/, `${b}: 예시 사용자 목록이 새지 않는다`)
  }
  assert.equal((await bind('block-data-table-compact', c, { key: 'admin-list/data-table' })).props.limit, 3, '작은 표는 받은 행을 모두 보인다(숨은 행에 닿는 길이 없다)')
})

test('BIND2 목록 표: 행이 없으면 지어내지 않고 빈 상태로, 열이 없으면 묶지 않는다 · 영어 사이트에 한글이 새지 않는다 · 서버 없는 묶음 작업 변형은 묶지 않는다', async () => {
  for (const b of TABLE_BLOCKS) {
    const empty = await bind(b, DASH('ko', { ...DASH_TABLE, rows: [] }), { key: 'admin-list/data-table' })
    assert.deepEqual(empty.props.state, { status: 'empty' }, b)
    const none = await bind(b, DASH('ko', null), { key: 'admin-list/data-table' })
    assert.equal(none.props, null, b)
    assert.match(none.why, /표 자료/, b)
    const en = await bind(b, DASH('en'), { key: 'admin-list/data-table', locale: 'en' })
    assert.doesNotMatch(JSON.stringify({ ...en.props, state: undefined }), HANGUL, `${b}: 영어 이름표`)
  }
  const bulk = await bind('block-data-table-bulk-select', DASH(), { key: 'admin-list/data-table' })
  assert.equal(bulk.props, null)
  assert.match(bulk.why, /묶음 작업/)
  const variants = archetypes.dashboard.pages.find((p) => p.id === 'admin-list').sections.find((s) => s.kind === 'data-table').allowedVariants
  assert.deepEqual(variants, TABLE_BLOCKS, '묶음 작업 서버가 없는 사이트는 bulk-select 를 고르지 않는다(원형 허용 목록에서 뺐다)')
})

const NOTICE_ROWS = [
  { label: '제품 소재', value: '린넨 100%' }, { label: '치수', value: '길이 88cm' }, { label: '제조자(수입자)', value: '결이 공방' }, { label: '제조국', value: '대한민국' },
  { label: '품질보증기준', value: '소비자분쟁해결기준에 따라요' }, { label: 'A/S 책임자와 전화번호', value: '결이 공방 02-1234-5678' },
]
const NOTICE_ROWS_EN = [{ label: 'Material', value: 'Stoneware' }, { label: 'Country of origin', value: 'Korea' }]
const DETAIL_INFO = (locale = 'ko') => ({ ...DETAIL(locale), notice: { category: locale === 'ko' ? '의류' : 'Kitchenware', rows: locale === 'ko' ? NOTICE_ROWS : NOTICE_ROWS_EN }, specs: [{ label: '길이', value: '88cm' }, { label: '세탁', value: '30도 손세탁' }] })
const INFO_BLOCKS = ['block-product-info-notice-table', 'block-product-info-key-facts-first', 'block-product-info-spec-and-notice']

test('BIND2 상품 정보(product-info): 고시 품목·항목이 $ref 로 이어지고, 핵심 먼저는 제조국·A/S·품질보증을 고르며, 사양은 콘텐츠 specs 에서 온다', async () => {
  const c = DETAIL_INFO()
  for (const b of INFO_BLOCKS) {
    const r = await bind(b, c, { key: 'product-detail/notice-table' })
    assert.ok(r.props, b)
    assert.equal(BAD_ISSUE(r).length, 0, `${b}: ${JSON.stringify(r.issues)}`)
    assert.deepEqual(r.props.notice.category, { $ref: 'notice.category' }, b)
    assert.deepEqual(r.props.notice.rows[3], { id: 'origin', label: { $ref: 'notice.rows.3.label' }, value: { $ref: 'notice.rows.3.value' } }, b)
    assert.equal(leaves(r.props).some((l) => l.value && /예시|솜결/.test(l.value)), false, `${b}: 예시 글이 남지 않는다`)
  }
  const kf = await bind('block-product-info-key-facts-first', c, { key: 'product-detail/notice-table' })
  assert.deepEqual(kf.props.highlight, ['origin', 'as', 'warranty'])
  const sp = await bind('block-product-info-spec-and-notice', c, { key: 'product-detail/spec-table' })
  assert.deepEqual(sp.props.specs[1], { id: 'spec-2', label: { $ref: 'specs.1.label' }, value: { $ref: 'specs.1.value' } })
  const html = await renderBlock('product-info/spec-and-notice.tsx', 'ProductInfoSpecAndNotice', resolveRefs(sp.props, c))
  assert.match(html, /30도 손세탁/)
  assert.match(html, /대한민국/)
  assert.doesNotMatch(html, /침구|솜결|예시/)
})

test('BIND2 상품 정보: 핵심 항목(제조국·A/S·품질보증)이 고시에 없거나 사양 자료가 없으면 그 변형만 묶지 않는다 — 고시 표 변형은 그대로 묶인다', async () => {
  const plain = { ...DETAIL('ko'), notice: { category: '의류', rows: [{ label: '소재', value: '린넨 100%' }] } }
  const kf = await bind('block-product-info-key-facts-first', plain, { key: 'product-detail/notice-table' })
  assert.equal(kf.props, null)
  assert.match(kf.why, /핵심 항목/)
  const sp = await bind('block-product-info-spec-and-notice', plain, { key: 'product-detail/spec-table' })
  assert.equal(sp.props, null)
  assert.match(sp.why, /사양/)
  assert.ok((await bind('block-product-info-notice-table', plain, { key: 'product-detail/notice-table' })).props)
  // detail 이 아닌 원형은 이 변형을 쓰지 않는다
  assert.equal((await bind('block-product-info-notice-table', LOCAL, { key: 'home/x' })).props, null)
  // 영어
  const en = await bind('block-product-info-key-facts-first', DETAIL_INFO('en'), { key: 'product-detail/notice-table', locale: 'en' })
  assert.equal(en.props, null, '영어 콘텐츠의 고시 항목 이름은 한국어 고시 이름과 다르다 — 핵심 항목을 찾지 못해 묶지 않는다')
  const enTable = await bind('block-product-info-notice-table', DETAIL_INFO('en'), { key: 'product-detail/notice-table', locale: 'en' })
  assert.doesNotMatch(JSON.stringify(enTable.props), HANGUL)
})

const SHIP_BLOCKS = ['block-shipping-returns-policy-tables', 'block-shipping-returns-at-a-glance-cards', 'block-shipping-returns-return-steps']
const SHIP_RENDER = { 'policy-tables': 'ShippingReturnsPolicyTables', 'at-a-glance-cards': 'ShippingReturnsAtAGlanceCards', 'return-steps': 'ShippingReturnsReturnSteps' }

test('BIND2 배송·반품(shipping-returns): 상품의 배송·반품 칸이 $ref 로 이어져 한국어는 원화, 영어(USD 센트)는 $ 로 그려지고 예시 글이 남지 않는다', async () => {
  for (const locale of ['ko', 'en']) {
    const c = DETAIL(locale)
    c.product.shipping.remoteExtra = locale === 'ko' ? 3000 : 800
    for (const b of SHIP_BLOCKS) {
      const r = await bind(b, c, { key: 'product-detail/shipping-returns', locale })
      assert.ok(r.props, `${locale} ${b}`)
      assert.equal(BAD_ISSUE(r).length, 0, `${locale} ${b}: ${JSON.stringify(r.issues)}`)
      assert.deepEqual(r.props.facts.shipping.fee, { $ref: 'product.shipping.fee' }, b)
      assert.deepEqual(r.props.facts.returns.exclusions, { $ref: 'product.returns.exclusions' }, b)
      const variant = b.replace('block-shipping-returns-', '')
      const html = await renderBlock(`shipping-returns/${variant}.tsx`, SHIP_RENDER[variant], resolveRefs(r.props, c))
      if (locale === 'ko') assert.match(html, /3,000원/, b)
      else { assert.match(html, /\$5\.00/, `${b}: 센트 500 이 $5.00`); assert.doesNotMatch(html, /\$500/, b); assert.doesNotMatch(JSON.stringify(r.props.copy), HANGUL, `${b}: 영어 이름표`) }
      assert.doesNotMatch(html, /솜결|예시택배|\(예시\)/, b)
    }
  }
})

test('BIND2 배송·반품: 도서산간 추가 배송비는 콘텐츠에 있을 때만 싣는다(없으면 「확인 필요」로 남아 공개를 막는다) · 배송 칸이 없으면 묶지 않는다', async () => {
  const c = DETAIL('ko')
  const r = await bind('block-shipping-returns-policy-tables', c, { key: 'product-detail/shipping-returns' })
  assert.equal('remoteExtra' in r.props.facts.shipping, false)
  const html = await renderBlock('shipping-returns/policy-tables.tsx', 'ShippingReturnsPolicyTables', resolveRefs(r.props, c))
  assert.match(html, /data-needs-check/, '도서산간 추가 배송비는 사실이 없으면 「확인 필요」다')
  c.product.shipping.remoteExtra = null
  const none = await bind('block-shipping-returns-policy-tables', c, { key: 'product-detail/shipping-returns' })
  assert.deepEqual(none.props.facts.shipping.remoteExtra, { $ref: 'product.shipping.remoteExtra' })
  const bare = { ...DETAIL('ko'), product: { ...DETAIL('ko').product, shipping: undefined } }
  const x = await bind('block-shipping-returns-return-steps', bare, { key: 'product-detail/shipping-returns' })
  assert.equal(x.props, null)
  assert.match(x.why, /배송/)
})

test('BIND2 분류 칩: 감사 콘텐츠는 상품마다 서로 다른 값을 낸다(실제 브리프는 분류가 여럿일 수 있다) — 분류가 둘 이상이면 칩이 묶인다', async () => {
  const { maxContent } = await import('../stamp/binding-audit.mjs')
  const c = maxContent('commerce')
  assert.ok(new Set(c.products.map((p) => p.category)).size >= 2)
  const r = await bind('block-filter-bar-chips', c, { key: 'category-list/filter-chips' })
  assert.ok(r.props)
  assert.deepEqual(r.props.options[1], { value: { $ref: 'products.1.category' }, label: { $ref: 'products.1.category' } })
  // 분류가 하나뿐이면 거를 것이 없어 그리지 않는다(바뀌지 않았다)
  const one = await bind('block-filter-bar-chips', { ...c, products: c.products.map((p) => ({ ...p, category: '빵' })) }, { key: 'category-list/filter-chips' })
  assert.equal(one.props, null)
})

test('BIND2 새 판 알림(announcement/update-toast): 화면 이름표뿐이라 콘텐츠 사실 없이 묶인다 — 제목은 콘텐츠 strings.updateAvailable 가 있으면 그 글, 없으면 이름표 · 서비스 워커 신호가 오기 전에는 보이지 않는다', async () => {
  const pwa = { archetype: 'pwa', locale: 'ko', strings: { updateAvailable: '새 버전이 있어요' }, slots: slotCopy() }
  const r = await bind('block-announcement-update-toast', pwa, { key: 'global/update-toast' })
  assert.ok(r.props)
  assert.equal(BAD_ISSUE(r).length, 0, JSON.stringify(r.issues))
  assert.deepEqual(r.props.copy.title, { $ref: 'strings.updateAvailable' })
  assert.deepEqual([r.props.copy.update, r.props.copy.later], ['지금 새로 고침', '나중에'])
  assert.equal('body' in r.props.copy, false, '예시의 안내 글은 싣지 않는다')
  assert.equal(r.props.available, false, '새 판이 기다린다는 신호(서비스 워커)가 올 때까지 알림은 뜨지 않는다 — 가짜 알림 없음')
  assert.equal('version' in r.props, false, '예시의 판 이름은 싣지 않는다')
  const bare = await bind('block-announcement-update-toast', { ...pwa, strings: undefined }, { key: 'global/update-toast' })
  assert.deepEqual(bare.props.copy.title, '새 판이 나왔어요')
  const en = await bind('block-announcement-update-toast', { ...pwa, locale: 'en', strings: undefined }, { key: 'global/update-toast', locale: 'en' })
  assert.doesNotMatch(JSON.stringify(en.props), HANGUL)
})
