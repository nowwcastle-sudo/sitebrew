// FIT-7 — 찍어낸 사이트의 거짓 사유·빈 전화 버튼 (W1b 실측 C3·C4, 가상 사용자 「들꽃상회」: 전화·주소 비공개, 지도 링크 없음).
//  C3: 영업시간 표는 오시는 길(directions)이 이미 그리는데 선택 섹션 hours-table 이 「자료 연결 안 됨」으로 남았다 — 이미 그려진 사실의 섹션이면 거짓 사유를 내지 않는다.
//  C4: 전화번호가 비면(「확인 필요」) 머리글 행동 글이 「확인 필요」로 나가고, tel: 대상이 없는 「전화하기」 버튼이 눌렸다 — 대상 없는 행동은 그리지 않는다(사유는 「확인 필요 사실」 그대로).
// 실행: node --test --test-force-exit --test-timeout=600000 factory/scripts/stamp-fit7-defects.test.mjs
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BLOCKER, bindSection, unboundRedundantKeys } from '../stamp/gen-pages.mjs'
import { PLACEHOLDER } from '../stamp/content.mjs'
import { leaves, ref, resolveRefs } from '../stamp/site-bind.mjs'
import { isNeedsCheck } from '../stamp/needs-check.mjs'
import { localContent, makeRun as makeRunIn, gen } from './lib/stamp-site-fixtures.mjs'

const TMP = join(tmpdir(), 'fv1-fit-7', 'defects-test')
mkdirSync(TMP, { recursive: true })
after(() => rmSync(TMP, { recursive: true, force: true }))
const makeRun = (brief, contentFor, opts) => makeRunIn(TMP, brief, contentFor, opts)
const siteOf = (g) => JSON.parse(readFileSync(join(g.siteDir, 'content', 'site.json'), 'utf8'))
const PH = PLACEHOLDER.ko

// 들꽃상회(W1b): 이름·영업시간만 말하고 전화·주소·사업자번호·지도·교통은 비워 두었다
const W1B_FACTS = { name: '들꽃상회', audience: '망원동 30~40대 동네 주민', action: '전화로 꽃다발 주문', mood: '따뜻한', hours: '화~일 10:00-20:00, 월요일 휴무' }
const w1bBrief = () => ({ topic: '망원동 작은 꽃집, 전화로 꽃다발 주문을 받는다', archetype: 'local', locale: 'ko', facts: W1B_FACTS, previewOnly: true })
const w1bPatch = (c) => ({ ...c, mapLinks: { naver: PH, kakao: PH }, directions: { transit: PH, parking: PH } })

const R = await makeRun(w1bBrief(), localContent, { patch: w1bPatch })
const G = await gen(R)
const site = siteOf(G)

// 그려진 섹션의 props 를 콘텐츠로 풀어 (경로, 값)을 모은다
const resolvedLeaves = () => Object.entries(site.sections).flatMap(([key, sec]) => leaves(resolveRefs(sec.props, site)).map((l) => ({ key, ...l })))

test('C3 재현 확인: 이 실행에서 영업시간 표는 오시는 길(directions)이 그린다', () => {
  assert.ok(site.sections['home/directions'], '필수 섹션 directions 는 그려진다')
  assert.ok(Array.isArray(site.sections['home/directions'].props.hours) && site.sections['home/directions'].props.hours.length > 0, 'directions 가 요일 표(hours)를 그린다')
})

test('C3: 같은 사실(영업시간)을 다른 블록이 이미 그리면 선택 섹션 hours-table 은 「자료 연결 안 됨」 거짓 사유를 내지 않는다', () => {
  assert.deepEqual(G.blockers.filter((b) => b.startsWith(BLOCKER.unbound) && b.includes('home/hours-table')), [], G.blockers.join('\n'))
  const sk = G.skipped.find((s) => s.key === 'home/hours-table')
  assert.ok(sk && /같은 사실/.test(sk.why), `건너뜀 까닭에 「같은 사실」이 보인다: ${JSON.stringify(sk)}`)
  assert.equal(site.sections['home/hours-table'], undefined)
  // 필수 섹션이 아니니 「그리지 않음」 사유도 없다
  assert.deepEqual(G.blockers.filter((b) => b.startsWith(BLOCKER.undrawn) && b.includes('hours-table')), [])
})

test('C3 음성 대조: 영업시간 자료가 아예 없어 아무도 못 그리면 필수 섹션 directions 의 「자료 연결 안 됨」은 그대로 남는다(거둔 것은 거짓 사유뿐)', async () => {
  const none = await makeRun({ ...w1bBrief(), facts: { ...W1B_FACTS, hours: '' } }, (r) => { const c = w1bPatch(localContent(r)); delete c.hours; return c })
  const g = await gen(none)
  assert.ok(g.blockers.some((b) => b.startsWith(BLOCKER.unbound) && b.includes('home/directions')), g.blockers.join('\n'))
})

test('C3 순수: unboundRedundantKeys — 선택이고 필수 사실(영업시간)을 다른 잎·전역 잎이 이미 그릴 때만', () => {
  const ref = (p) => ({ $ref: p })
  const sections = { 'home/dir': { props: { hours: [ref('hours.0')], address: ref('business.address') } }, 'global/footer': { props: { a: ref('business.phone') } } }
  const unbound = [{ key: 'home/hours-table', kind: 'hours-location' }, { key: 'home/menu-price', kind: 'menu-price' }]
  assert.deepEqual(unboundRedundantKeys({ unbound, leaves: [{ key: 'home/dir' }], globals: [], sections }), ['home/hours-table'])
  // 영업시간을 그린 잎이 없으면 거짓이 아니다
  assert.deepEqual(unboundRedundantKeys({ unbound, leaves: [], globals: [{ key: 'global/footer' }], sections }), [])
  // 사실을 말하지 않는 종류(menu-price)는 대상이 아니다
  assert.deepEqual(unboundRedundantKeys({ unbound: [unbound[1]], leaves: [{ key: 'home/dir' }], globals: [], sections }), [])
})

test('C4: 전화번호가 비면 머리글 행동은 「확인 필요」 글·빈 링크로 나가지 않는다', () => {
  assert.equal(site.business.phone, PH)
  const a = site.shell.action
  assert.ok(a === undefined || a === null || (typeof a.label === 'string' || a.label?.$ref) , '모양')
  if (a) {
    const got = resolveRefs(a, site)
    assert.ok(typeof got.label === 'string' && !isNeedsCheck(got.label), `머리글 행동 글: ${got.label}`)
    assert.ok(typeof got.href === 'string' && got.href !== '#' && got.href !== 'tel:' && !/확인 필요/.test(got.href), `머리글 행동 링크: ${got.href}`)
  }
})

test('C4: 전화가 없으면 하단 고정 줄의 「전화하기」 버튼(tel: 대상 없음)을 그리지 않고, 그 까닭은 「확인 필요 사실」 하나로만 남는다', () => {
  assert.equal(site.sections['global/sticky-booking-bar'], undefined, '대상 없는 전화 버튼 줄을 그리지 않는다')
  for (const p of ['business.phone', 'booking.primary.value', 'home/hero-visit-info/primaryCta']) assert.ok(G.blockers.includes(`${BLOCKER.fact}${p}`), `입력 대기 사유는 그대로: ${p}`)
  assert.deepEqual(G.blockers.filter((b) => /sticky-booking-bar/.test(b)), [], '같은 일을 품질 사유로 한 번 더 세지 않는다')
})

test('C4: 그려진 어느 섹션에도 「확인 필요」 글이 행동 글(label)·링크(href)·전화 걸기 칸(call.phone·call.number·telephone)으로 나가지 않고, 대상 없는 tel:·# 링크가 없다', () => {
  // 푸터의 사업자 정보 표(copy.business.*)는 행동이 아니라 전자상거래법 제10조 표시 칸이다 — 빈 값은 「확인 필요」 표지로 남겨 비었음을 화면에서도 보인다(이 시험의 대상이 아니다)
  const bad = resolvedLeaves().filter((l) => /(?:^|\.)(?:label|href|telephone)$|(?:^|\.)call\.(?:phone|number)$/.test(l.path) && typeof l.value === 'string' && (isNeedsCheck(l.value) || l.value === 'tel:' || l.value === 'mailto:' || l.value === '#'))
  assert.deepEqual(bad.map((l) => `${l.key} ${l.path}=${l.value}`), [])
})

test('C4: 히어로 필수 버튼 — 글이 「확인 필요」이거나 가는 곳(예약 수단 값)이 비면 그 변형은 쓰지 않고(입력 대기), 둘 다 있으면 그대로 잇는다(양성 대조)', async () => {
  const content = (booking, label) => ({ archetype: 'local', locale: 'ko', business: { name: '들꽃상회', phone: '02-1234-5678', address: '서울특별시 마포구 달빛로 12' }, booking: { primary: { kind: 'tel', value: booking } }, hours: [{ day: 'tu', opens: '10:00', closes: '20:00' }], slots: { copy: [{ id: 'primaryCta', role: 'r', text: label }] } })
  const bind = (block, c) => bindSection({ key: 'home/hero-visit-info', block, content: c, copyIndex: new Map([['home/hero-visit-info/primaryCta#0', 0]]), routes: { home: '/' }, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: ref('booking.primary.value', { as: 'tel' }) }), secondaryHref: () => '#', uiLeaves: [] })
  const ok = await bind('block-hero-banded-full-bleed', content('02-1234-5678', '전화로 주문하기'))
  assert.deepEqual(ok.props.copy.primaryCta, { label: { $ref: 'slots.copy.0.text' }, href: { $ref: 'booking.primary.value', as: 'tel' } }, '양성 대조: 버튼이 그대로 이어진다')
  for (const [why, c] of [['가는 곳이 「확인 필요」', content(PH, '전화로 주문하기')], ['글이 「확인 필요」', content('02-1234-5678', PH)]]) {
    const r = await bind('block-hero-banded-full-bleed', c)
    assert.equal(r.props, null, why)
    assert.equal(r.inputWait, true, `${why}: 입력 대기로 센다`)
  }
  // filmCta(한 낱말 히어로의 필수 버튼)도 갈 곳이 비면 같다
  const film = await bind('block-hero-grid-lines-baseline-word', content(PH, '전화로 주문하기'))
  assert.equal(film.props, null)
  assert.equal(film.inputWait, true)
})

test('C4: 문의 폼·예약 완료의 전화 칸도 번호가 「확인 필요」면 그리지 않는다', async () => {
  const base = { archetype: 'local', locale: 'ko', business: { name: '들꽃상회', phone: PH, address: PH }, booking: { primary: { kind: 'tel', value: PH } }, hours: [], slots: { copy: [] } }
  const run = (block, content) => bindSection({ key: 'home/x', block, content, copyIndex: new Map(), routes: { home: '/' }, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: '#' }), secondaryHref: () => '#', uiLeaves: [] })
  const form = await run('block-contact-form-channel-first', base)
  assert.equal('call' in form.props.copy, false)
  const done = await run('block-confirmation-booking-complete', base)
  assert.ok(done.props, '예약 완료 블록은 그려진다')
  assert.equal(done.props.copy?.help?.phone, undefined, '도움 전화 칸을 뺀다')
})

test('C4: 교통·주차가 「확인 필요」이면 그 칸을 그리지 않는다(주소 글자는 입력 대기 표지로 남는다)', () => {
  const props = site.sections['home/directions'].props
  assert.equal(props.copy.transit, undefined)
  assert.equal(props.copy.parking, undefined)
  for (const p of ['directions.transit', 'directions.parking', 'business.address']) assert.ok(G.blockers.includes(`${BLOCKER.fact}${p}`), p)
})
