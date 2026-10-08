// 공공 히어로 「자주 찾는 서비스」 칸(대장 C299, 레인 DATA04) — 블록 예시의 서비스 이름(주민 등본·전입 신고 …)이 그대로 사이트로 나가던 길.
//   원인: 표지·숫자가 없는 literal 이라 예시 문구 검사가 못 잡았고, 본문 바로가기 섹션과 겹쳐 그려졌다.
//   ① 묶기: 히어로 서비스 칸은 콘텐츠 quickLinks 의 $ref 로만 채운다(예시 literal 0). 바로가기가 없으면 선택 칸은 빼고(그리지 않는다) 필수 칸이면 null(다른 변형으로 폴백).
//   ② 검사: 사실 목록 이름(FACT_LIST_PATH)이 literal 로 남으면 why 'list' 로 잡는다 — 같은 글자가 목록 칸 밖에 있을 때(옛 검사 범위)는 잡지 않는다(음성 대조).
//   ③ 06: 히어로가 바로가기를 그리면 본문 바로가기 섹션은 따로 그리지 않고(필수 섹션 blocker 도 없다), 바로가기가 없으면 본문 섹션이 「자료 연결 안 됨」을 남긴다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-hero-services.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bindSection, blockItems, exampleNames, fixtureOf, undrawnRequiredBlockers } from '../stamp/gen-pages.mjs'
import { exampleIssues, FACT_LIST_PATH, hasExampleMarker, leaves, refsOf, resolveRefs } from '../stamp/site-bind.mjs'
import { makeRun, gen, root } from './lib/stamp-site-fixtures.mjs'
import { goldenOf, public1, public2 } from './lib/stamp-structure-fixtures.mjs'

const HEROES = ['block-hero-identity-strip-banner', 'block-hero-crosshair-quadrants']
const FIXTURE_SERVICES = ['주민 등본', '전입 신고', '시설 예약', '여권 발급', '민원실 위치', '서식 내려받기']
const routes = { main: '/', sub: '/guide', privacy: '/privacy' }
const bindHero = (block, content, copyIndex = new Map()) => bindSection({ key: 'main/hero', block, content, copyIndex, routes, locale: 'ko', navLinks: () => [], primaryCta: () => ({ href: '/guide' }), secondaryHref: () => '/guide' })
const CONTENT = {
  archetype: 'public',
  quickLinks: [{ label: '도서 검색', href: 'https://example.com/catalog' }, { label: '대출 기간 연장', href: 'https://example.com/renew' }, { label: '이용 안내', href: '/guide' }, { label: '확인 필요', href: '/x' }, { label: '자리 표시', href: '확인 필요' }],
  slots: { copy: [{ id: 'oneLiner', text: '도서관 이용을 한곳에서 안내해요' }], images: [] },
}
const ONE_LINER = new Map([['main/hero/oneLiner#0', 0]])

test('재현: 두 공공 히어로의 블록 예시는 서비스 이름 여섯을 literal 로 갖고 표지·숫자·가상 이름이 없다 — 옛 검사가 못 잡던 이유', async () => {
  const names = await exampleNames()
  for (const block of HEROES) {
    const fx = await fixtureOf(blockItems().get(block))
    const items = fx.copy.services.items
    assert.deepEqual(items.map((i) => i.label), FIXTURE_SERVICES, block)
    for (const l of items.map((i) => i.label)) { assert.equal(hasExampleMarker(l), false); assert.equal(/\d/.test(l), false); assert.equal([...names].some((n) => n && l.includes(n)), false, l) }
  }
})

test('exampleIssues: 사실 목록 이름이 literal 이면 list — 같은 글자가 목록 칸 밖에 있으면(옛 검사 범위) 잡지 않는다(음성 대조)', async () => {
  const names = await exampleNames()
  const asServices = { copy: { services: { label: '자주 찾는 서비스', items: FIXTURE_SERVICES.map((label) => ({ label, href: '#top', icon: 'file' })) } } }
  const hit = exampleIssues(leaves(asServices), names)
  assert.deepEqual(hit.map((i) => [i.path, i.why]), FIXTURE_SERVICES.map((_, i) => [`copy.services.items[${i}].label`, 'list']))
  // 옛 동작: 같은 literal 이 사실 목록 칸이 아닌 곳에 있으면 표지·숫자·이름이 없어 하나도 안 잡힌다
  const elsewhere = { copy: { tabs: FIXTURE_SERVICES.map((label) => ({ label, href: '#top' })) } }
  assert.deepEqual(exampleIssues(leaves(elsewhere), names), [])
  // 콘텐츠로 묶인 목록($ref)은 literal 이 아니라 걸리지 않고, 서비스 칸의 라벨(제목 문구)·링크 주소·아이콘도 아니다
  const bound = { copy: { services: { label: '자주 찾는 서비스', items: [{ label: { $ref: 'quickLinks.0.label' }, href: { $ref: 'quickLinks.0.href' }, icon: 'file' }] } } }
  assert.deepEqual(exampleIssues(leaves(bound).filter((l) => l.ref === null), names), [])
  assert.deepEqual(exampleIssues(leaves({ copy: { services: { label: '자주 찾는 서비스' } } }), names), [])
  for (const p of ['copy.services.items[0].label', 'copy.quickLinks[2].label', 'doctors[1].name', 'branches[0].name', 'departments[3].title']) assert.ok(FACT_LIST_PATH.test(p), p)
  for (const p of ['copy.services.label', 'copy.services.items[0].href', 'copy.tabs[0].label', 'copy.items[0].name', 'copy.columns[0].links[1].label']) assert.equal(FACT_LIST_PATH.test(p), false, p)
})

test('bindSection: 히어로 서비스 칸은 콘텐츠 바로가기($ref)로 채우고 예시 서비스 literal 이 하나도 없다 — 쓸 수 없는 바로가기(자리 표시)는 거른다', async () => {
  for (const block of HEROES) {
    const r = await bindHero(block, CONTENT, ONE_LINER)
    assert.ok(r.props, block)
    const items = r.props.copy.services.items
    assert.deepEqual(items.map((i) => i.label.$ref), ['quickLinks.0.label', 'quickLinks.1.label', 'quickLinks.2.label'], '자리 표시 라벨·href 는 거른다')
    assert.ok(items.every((i) => i.href.$ref && i.icon), '링크는 콘텐츠, 아이콘은 장식')
    const resolved = resolveRefs(r.props, CONTENT).copy.services.items.map((i) => i.label)
    for (const s of FIXTURE_SERVICES) assert.equal(JSON.stringify([r.props.copy.services, r.props.copy.lede]).includes(s), false, `${block} 에 예시 서비스 「${s}」 가 남았다(서비스 칸·부제)`) // crosshair 의 접수 영수증 데모(「전입 신고 — 검토 단계예요」·접수번호 숫자)는 숫자 때문에 예시 이슈로 잡혀 06 폴백이 다룬다 — 이 시험 밖
    assert.deepEqual(r.props.copy.lede, { $ref: 'slots.copy.0.text' }, '부제(예시 「주민 등본부터 건축 서류까지…」)는 한 줄 설명 문구 칸(oneLiner)으로')
    assert.deepEqual(resolved.slice(0, 3), ['도서 검색', '대출 기간 연장', '이용 안내'])
    assert.equal(r.issues.filter((i) => i.why === 'list').length, 0)
  }
})

test('bindSection: 바로가기가 없으면 선택 칸(identity-strip-banner)은 서비스 칸을 빼고 필수 칸(crosshair-quadrants)은 null 이다 — 예시 서비스를 싣지 않는다', async () => {
  const bare = { archetype: 'public', slots: { copy: [{ id: 'oneLiner', text: '도서관 이용을 한곳에서 안내해요' }], images: [] } }
  const banner = await bindHero('block-hero-identity-strip-banner', bare, ONE_LINER)
  assert.ok(banner.props, '선택 칸이라 히어로는 그려진다')
  assert.equal('services' in banner.props.copy, false)
  assert.equal(JSON.stringify(banner.props).includes('주민 등본'), false)
  assert.equal(banner.issues.filter((i) => i.why === 'list').length, 0)
  const quad = await bindHero('block-hero-crosshair-quadrants', bare, ONE_LINER)
  assert.equal(quad.props, null)
  assert.match(quad.why, /quickLinks/)
  // 쓸 수 있는 바로가기가 하나도 없는 경우(전부 자리 표시)도 같다
  const onlyPlaceholders = { ...bare, quickLinks: [{ label: '확인 필요', href: '확인 필요' }] }
  assert.equal('services' in (await bindHero('block-hero-identity-strip-banner', onlyPlaceholders, ONE_LINER)).props.copy, false)
})

test('블록: identity-strip-banner 의 서비스 칸은 선택 칸(타입 `services?:`) — 서버 렌더가 서비스 칸 없이 그려진다', async () => {
  const src = readFileSync(join(root, 'registry', 'factory', 'blocks', 'hero', 'identity-strip-banner.tsx'), 'utf8')
  assert.match(src, /services\?: \{ label: string/)
  assert.match(src, /copy\.services \? \(/)
  const crosshair = readFileSync(join(root, 'registry', 'factory', 'blocks', 'hero', 'crosshair-quadrants.tsx'), 'utf8')
  assert.match(crosshair, /services: \{ label: string/, 'crosshair 는 4분면 한 칸이라 서비스 칸이 필수 — 바로가기가 없으면 다른 변형으로 폴백')
})

const BUILD = async (id, contentFor, briefMutate) => {
  const g = goldenOf(id)
  const brief = structuredClone(g.brief)
  briefMutate?.(brief)
  const r = await makeRun(join(root, '.tmp', 'stamp-hero-services-test'), brief, contentFor, { patchVariants: (v) => ({ ...v, 'main/hero': 'block-hero-identity-strip-banner' }) })
  const s = await gen(r)
  return { r, s, site: JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8')) }
}

test('06 (public-1): 히어로가 콘텐츠 바로가기를 그리고 본문 바로가기 섹션은 따로 그리지 않는다 — 「필수 섹션 그리지 않음」·예시 서비스 0', async () => {
  const { s, site } = await BUILD('public-1', public1)
  const hero = site.sections['main/hero']
  assert.equal(hero.block, 'block-hero-identity-strip-banner')
  assert.ok(hero.props.copy.services.items.every((i) => i.label.$ref?.startsWith('quickLinks.')))
  assert.equal(site.sections['main/quick-links'], undefined)
  assert.ok(s.skipped.some((k) => k.key === 'main/quick-links' && /같은 바로가기/.test(k.why)))
  assert.equal(s.blockers.some((b) => /main\/quick-links/.test(b)), false, '필수 섹션 blocker 도 자료 연결 안 됨 blocker 도 없다')
  assert.equal(JSON.stringify(site.sections).includes('주민 등본'), false)
  assert.equal(s.blockers.some((b) => b.startsWith('공개 불가 — 예시 문구 남음: main/hero')), false)
  // 히어로·본문 어디에도 literal 서비스 이름이 없고 화면 값은 콘텐츠($ref)다
  const refs = [...refsOf(hero.props)].filter((r) => r.startsWith('quickLinks.'))
  assert.equal(refs.length, 8, '링크 4개의 label·href')
})

test('06 (public-2): 바로가기 사실이 3개여도 같은 길 — 지어낸 바로가기를 더하지 않는다', async () => {
  const { site } = await BUILD('public-2', public2)
  assert.equal(site.sections['main/hero'].props.copy.services.items.length, 3)
  assert.equal(site.sections['main/quick-links'], undefined)
})

test('06 대조(옛 동작이 막는 구멍): 바로가기 사실이 없으면 히어로는 서비스 칸 없이 그려지고 본문 바로가기 섹션이 「자료 연결 안 됨」을 남긴다 — 예시 서비스는 어디에도 없다', async () => {
  const noLinks = (request) => { const c = public1(request); delete c.quickLinks; return c }
  const { s, site } = await BUILD('public-1', noLinks, (b) => { delete b.facts.quickLinks })
  assert.equal('services' in site.sections['main/hero'].props.copy, false)
  assert.equal(site.sections['main/quick-links'], undefined)
  assert.ok(s.blockers.some((b) => b.startsWith('공개 불가 — 자료 연결 안 됨: main/quick-links')), JSON.stringify(s.blockers.filter((b) => /quick/.test(b))))
  assert.equal(JSON.stringify(site.sections).includes('주민 등본'), false)
})

test('undrawnRequiredBlockers: merged(다른 섹션이 같은 자료를 그림)에 든 필수 섹션은 그리지 않은 섹션 blocker 에서 빠진다 — 비어 있으면 그대로 막는다', () => {
  const SM = { pages: [{ id: 'main', route: '/', sections: [{ kind: 'hero', required: true, status: 'block' }, { kind: 'quick-links', required: true, status: 'content' }] }], globals: [] }
  const drawn = { 'main/hero': {} }
  assert.deepEqual(undrawnRequiredBlockers(SM, drawn, []), ['공개 불가 — 필수 섹션 그리지 않음: main/quick-links'])
  assert.deepEqual(undrawnRequiredBlockers(SM, drawn, [], new Set(['main/quick-links'])), [])
})
