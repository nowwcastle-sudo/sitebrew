// FV1 Task 6.3 원인 고치기(QFIX) [3] — 원형 스키마에 칸이 없어 사실이 있어도 그릴 수 없던 본문(감사 known-gap · 04 구조 칸 밖 자료).
// 원인마다: 스키마에 선택 칸 → binder/렌더러 → 04 구조 칸(STRUCTURE_FACTS · FACT_NAMES) → 골든 브리프 2개의 가상 사실. 사실이 없으면 섹션은 예전처럼 「자료 연결 안 됨」.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-qfix-body.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadArchetypes } from './archetypes.mjs'
import { bindContentSection } from '../stamp/content-sections.mjs'
import { loadContentSchema, PLACEHOLDER } from '../stamp/content.mjs'
import { bindSection } from '../stamp/gen-pages.mjs'
import { KNOWN_GAPS } from '../stamp/binding-audit.mjs'
import { goldenOf, goldenRequest } from './lib/stamp-structure-fixtures.mjs'

const archetypes = await loadArchetypes()
const specOf = (arch, page, kind) => archetypes[arch].pages.find((p) => p.id === page).sections.find((s) => s.kind === kind)
const slotsOf = (...pairs) => ({ copy: pairs.map(([id, text]) => ({ id, role: '', text })), images: [] })
const routes = { home: '/' }
const sitemap = { pages: [] }
const contentBind = (arch, page, kind, content, copy = {}, locale = 'ko') => {
  const nb = specOf(arch, page, kind).noBlock
  return bindContentSection({ key: `${page}/${kind}`, pageId: page, render: nb.render, missing: nb.missing, content, copyIndex: new Map(Object.entries(copy)), routes, locale, sitemap, pageTitleOf: () => page, first: false })
}
const slotOf = (request, path) => request.structureSlots?.find((s) => s.path === path)

// ── 대시보드 ─────────────────────────────────────────────────────────────────────────────────────────────────
test('[3] dashboard admin-list/page-header: 주 행동 주소(primaryActionHref)가 있으면 문구 칸 primaryAction 이름으로 링크 하나를 그린다 · 주소나 이름이 없으면 가짜 버튼 없이 자료 없음', () => {
  const content = { archetype: 'dashboard', locale: 'ko', primaryActionHref: 'https://example.com/shipments/new', slots: slotsOf(['primaryAction', '출고 등록하기']) }
  const copy = { 'admin-list/page-header/primaryAction#0': 0 }
  const r = contentBind('dashboard', 'admin-list', 'page-header', content, copy)
  assert.ok(r.props, r.why)
  assert.equal(r.block, 'block-content-links')
  assert.deepEqual(r.props.links, [{ label: { $ref: 'slots.copy.0.text' }, href: { $ref: 'primaryActionHref' } }])
  const noHref = contentBind('dashboard', 'admin-list', 'page-header', { ...content, primaryActionHref: undefined }, copy)
  assert.equal(noHref.props, undefined)
  assert.match(noHref.why, /링크 자료/)
  const noLabel = contentBind('dashboard', 'admin-list', 'page-header', { ...content, slots: slotsOf(['primaryAction', PLACEHOLDER.ko]) }, copy)
  assert.equal(noLabel.props, undefined, '이름이 자리 표시면 이름 없는 링크를 그리지 않는다')
})

test('[3] dashboard 콘텐츠 스키마: primaryActionHref 는 선택 Href 칸 — 없어도 통과하고 잘못된 주소는 거절한다', () => {
  const schema = loadContentSchema('dashboard')
  const base = { archetype: 'dashboard', decision: { dashboard_type: 'operational', refresh: '5분마다' } }
  assert.equal(schema.safeParse(base).success, true)
  assert.equal(schema.safeParse({ ...base, primaryActionHref: 'https://example.com/new' }).success, true)
  assert.equal(schema.safeParse({ ...base, primaryActionHref: 'javascript:alert(1)' }).success, false)
})

test('[3] dashboard 04 구조 칸: 주 행동 주소(primaryActionHref)와 목록 표(table)를 요청한다 — 골든 사실이 있으면 채울 칸, 없으면 empty', () => {
  for (const id of ['dashboard-1', 'dashboard-2']) {
    const { request } = goldenRequest(id)
    const act = slotOf(request, 'primaryActionHref')
    const table = slotOf(request, 'table')
    assert.ok(act && table, `${id}: ${JSON.stringify(request.structureSlots?.map((s) => s.path))}`)
    assert.equal(act.empty, false, id)
    assert.equal(table.empty, false, id)
    assert.deepEqual(act.factsWanted, ['primaryActionUrl'])
    assert.deepEqual(table.factsWanted, ['tableColumns', 'tableRows'])
    assert.ok(table.sections.includes('admin-list/data-table') && table.sections.includes('admin-list/search-filter-bar'), table.sections.join())
    assert.equal(table.shape.type ?? 'object', 'object')
  }
  const brief = structuredClone(goldenOf('dashboard-1').brief)
  delete brief.facts.tableColumns
  delete brief.facts.tableRows
  delete brief.facts.primaryActionUrl
  const { request } = goldenRequest('dashboard-1', { brief })
  assert.equal(slotOf(request, 'table').empty, true)
  assert.equal(slotOf(request, 'primaryActionHref').empty, true)
})

test('[3] 감사: dashboard page-header 는 더는 known-gap 이 아니다(낡은 알려진 빈자리 줄을 지운다)', () => {
  assert.equal(KNOWN_GAPS.some((g) => g.archetype === 'dashboard' && g.section === 'admin-list/page-header'), false)
})

// ── pwa — 앱 고유 화면(주 화면 목록 · 상세 · 결과)의 안내 글 ──────────────────────────────────────────────────────────
// 제품의 실제 데이터는 launch-factory 가 실행 때 채운다. 정적 사이트는 이 화면이 무엇을 보이는지 말하는 사실 글(브리프)만 싣는다 — 사실이 없으면 예전처럼 「자료 연결 안 됨」.
test('[3] pwa 주 화면·상세·결과: 브리프 사실에서 온 칸(homeItems · detailBody · resultBody)이 카드 목록·본문 글로 그려지고, 칸이 없으면 자료 없음', () => {
  const content = {
    archetype: 'pwa', locale: 'ko',
    homeItems: [{ title: '오늘의 기록', body: '달린 거리와 시간을 적어 둬요' }, { title: '주간 목표' }],
    detailBody: ['기록을 누르면 달린 거리와 시간을 볼 수 있어요'],
    resultBody: ['오늘 기록을 저장했어요'],
    slots: slotsOf(),
  }
  const home = contentBind('pwa', 'home', 'primary-content', content)
  assert.ok(home.props, home.why)
  assert.equal(home.block, 'block-content-cards')
  assert.deepEqual(home.props.items[0], { title: { $ref: 'homeItems.0.title' }, summary: { $ref: 'homeItems.0.body' } })
  assert.deepEqual(home.props.items[1], { title: { $ref: 'homeItems.1.title' } }, '본문이 없는 항목은 제목만')
  const detail = contentBind('pwa', 'sub-detail', 'detail-content', content)
  assert.equal(detail.block, 'block-content-prose')
  assert.deepEqual(detail.props.paragraphs, [{ $ref: 'detailBody.0' }])
  const result = contentBind('pwa', 'completion', 'result', content)
  assert.deepEqual(result.props.paragraphs, [{ $ref: 'resultBody.0' }])
  for (const [page, kind] of [['home', 'primary-content'], ['sub-detail', 'detail-content'], ['completion', 'result']]) {
    const none = contentBind('pwa', page, kind, { archetype: 'pwa', locale: 'ko', slots: slotsOf() })
    assert.equal(none.props, undefined, `${page}/${kind}`)
    assert.ok(none.why, `${page}/${kind}`)
  }
})

test('[3] pwa 콘텐츠 스키마: homeItems · detailBody · resultBody 는 선택 칸 — 없어도 통과하고 모양이 틀리면 거절한다', () => {
  const schema = loadContentSchema('pwa')
  const base = {
    archetype: 'pwa',
    manifest: { name: '달림장', short_name: '달림장', description: '달리기 기록 앱', start_url: '/', display: 'standalone', theme_color: '#112233', background_color: '#ffffff', icons: [{ src: '/icon-192.png', sizes: '192x192', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', purpose: 'any' }, { src: '/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' }] },
    offline: { fallbackUrl: '/offline' },
    strings: { offline: '연결이 끊겼어요', serviceDown: '점검 중이에요', savedPending: '저장했어요', synced: '동기화했어요', updateAvailable: '새 버전이 있어요' },
  }
  const ok = schema.safeParse(base)
  assert.equal(ok.success, true, ok.success ? '' : JSON.stringify(ok.error.issues.slice(0, 3)))
  assert.equal(schema.safeParse({ ...base, homeItems: [{ title: '오늘의 기록', body: '거리와 시간' }], detailBody: ['글'], resultBody: ['글'] }).success, true)
  assert.equal(schema.safeParse({ ...base, homeItems: [{ body: '제목 없음' }] }).success, false)
  assert.equal(schema.safeParse({ ...base, detailBody: [''] }).success, false)
})

test('[3] pwa 04 구조 칸: homeItems · detailBody · resultBody 를 요청한다 — 골든 둘 모두 사실이 있고, 사실이 없으면 empty', () => {
  for (const id of ['pwa-1', 'pwa-2']) {
    const { request } = goldenRequest(id)
    for (const root of ['homeItems', 'detailBody', 'resultBody']) {
      const s = slotOf(request, root)
      assert.ok(s, `${id}.${root}: ${JSON.stringify(request.structureSlots?.map((x) => x.path))}`)
      assert.equal(s.empty, false, `${id}.${root}`)
      assert.deepEqual(s.factsWanted, [root])
    }
  }
  const brief = structuredClone(goldenOf('pwa-1').brief)
  for (const n of ['homeItems', 'detailBody', 'resultBody']) delete brief.facts[n]
  const { request } = goldenRequest('pwa-1', { brief })
  for (const root of ['homeItems', 'detailBody', 'resultBody']) assert.equal(slotOf(request, root).empty, true, root)
})

test('[3] 감사: pwa 주 화면·상세·결과는 더는 known-gap 이 아니다', () => {
  assert.deepEqual(KNOWN_GAPS.filter((g) => g.archetype === 'pwa').map((g) => g.section), [])
})

// ── public — 기관 안내(영업시간 표 + 오시는 길 + 지도 링크)와 하위 쪽 본문 ──────────────────────────────────────────────────
const PUBLIC = {
  archetype: 'public', locale: 'ko',
  agency: { name: '해오름구립도서관', address: '서울특별시 해오름구 예시로 100', mainPhone: '02-1234-5678' },
  hours: [{ day: 'tu', opens: '09:00', closes: '20:00' }, { day: 'sa', opens: '09:00', closes: '17:00' }],
  directions: { transit: '가까운 지하철역 3번 출구에서 걸어서 5분', parking: '지하 주차장 40면(2시간 무료)' },
  mapLinks: { naver: 'https://example.com/maps/naver/lib', kakao: 'https://example.com/maps/kakao/lib' },
  slots: slotsOf(),
}
const bindIn = (block, content, key = 'main/agency-info') => bindSection({ key, block, content, copyIndex: new Map(), routes: { home: '/' }, locale: content.locale, navLinks: () => [], primaryCta: () => ({ href: '#' }), secondaryHref: () => '#' })

test('[3] public main/agency-info: 기관 정보(agency)와 영업시간·오시는 길·지도 링크가 영업시간 표 블록에 이어진다 — 예시 영업시간·주소·전화가 새지 않는다', async () => {
  const r = await bindIn('block-hours-location-hours-table-map-link', PUBLIC)
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.copy.address, { $ref: 'agency.address' })
  assert.deepEqual(r.props.hours, [{ $ref: 'hours.0' }, { $ref: 'hours.1' }])
  assert.deepEqual(r.props.copy.transit.text, { $ref: 'directions.transit' })
  assert.deepEqual(r.props.copy.parking.text, { $ref: 'directions.parking' })
  assert.deepEqual(r.props.copy.maps.map((m) => m.href), [{ $ref: 'mapLinks.naver' }, { $ref: 'mapLinks.kakao' }])
  assert.equal(r.issues.filter((i) => ['marker', 'name', 'digits', 'link', 'leak'].includes(i.why)).length, 0, JSON.stringify(r.issues))
  // 오시는 길·지도 링크가 없으면 그 칸만 빠진다(지어내지 않는다) — 영업시간이 없으면 자료 없음
  const bare = await bindIn('block-hours-location-hours-table-map-link', { ...PUBLIC, directions: undefined, mapLinks: undefined })
  assert.ok(bare.props, bare.why)
  assert.equal(bare.props.copy.transit, undefined)
  assert.deepEqual(bare.props.copy.maps, [])
  const noHours = await bindIn('block-hours-location-hours-table-map-link', { ...PUBLIC, hours: undefined })
  assert.equal(noHours.props, null)
})

test('[3] 영업시간 표 블록: 지도 링크가 없으면 빈 이동 영역(nav)을 그리지 않는다', async () => {
  const { loadTs } = await import('../stamp/ts-eval.mjs')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { createElement: h } = await import('react')
  const { join } = await import('node:path')
  const root = join(import.meta.dirname, '..', '..')
  const mod = await loadTs(join(root, 'registry', 'factory', 'blocks', 'hours-location', 'hours-table-map-link.tsx'))
  const fx = await loadTs(join(root, 'registry', 'factory', 'blocks', 'hours-location', 'hours-table-map-link.fixture.ts'))
  const props = structuredClone(fx.fixture)
  props.now = fx.NOW_OPEN
  assert.match(renderToStaticMarkup(h(mod.HoursLocationHoursTableMapLink, props)), /<nav /, '지도 링크가 있으면 nav 가 있다(양성 대조)')
  props.copy.maps = []
  assert.doesNotMatch(renderToStaticMarkup(h(mod.HoursLocationHoursTableMapLink, props)), /<nav /)
})

test('[3] public sub/content: 하위 쪽 본문 문단(subBody)이 본문 글 렌더러에 이어지고, 없으면 자료 없음', () => {
  const content = { ...PUBLIC, subBody: ['도서는 한 번에 열 권까지 빌려요', '반납은 열린 시간에 무인 반납함에도 할 수 있어요'] }
  const r = contentBind('public', 'sub', 'content', content)
  assert.ok(r.props, r.why)
  assert.equal(r.block, 'block-content-prose')
  assert.deepEqual(r.props.paragraphs, [{ $ref: 'subBody.0' }, { $ref: 'subBody.1' }])
  assert.equal(contentBind('public', 'sub', 'content', PUBLIC).props, undefined)
})

test('[3] public 콘텐츠 스키마: hours · directions · mapLinks · subBody 는 선택 칸이다 — 없어도 통과, 틀린 모양은 거절', () => {
  const schema = loadContentSchema('public')
  const base = {
    archetype: 'public',
    decision: { krds_scope: { agencyType: 'local-gov', level: 'standard', officialBanner: false, identifier: false } },
    agency: { name: '해오름구립도서관', address: '서울특별시 해오름구 예시로 100', mainPhone: '02-1234-5678', phoneNote: '평일에 받아요', privacyPolicyUrl: '/privacy', accessibilityPolicyUrl: '/accessibility', copyright: '© 해오름구립도서관' },
    quickLinks: [{ label: '도서 검색', href: 'https://example.com/catalog' }],
  }
  const ok = schema.safeParse(base)
  assert.equal(ok.success, true, ok.success ? '' : JSON.stringify(ok.error.issues.slice(0, 3)))
  assert.equal(schema.safeParse({ ...base, hours: PUBLIC.hours, directions: PUBLIC.directions, mapLinks: PUBLIC.mapLinks, subBody: ['글'] }).success, true)
  assert.equal(schema.safeParse({ ...base, hours: [{ day: 'xx', opens: '09:00', closes: '18:00' }] }).success, false)
  assert.equal(schema.safeParse({ ...base, subBody: [''] }).success, false)
})

test('[3] public 04 구조 칸: 영업시간·오시는 길·지도 링크·하위 쪽 본문을 요청한다 — 골든 둘 모두 사실이 있고, 지도 링크 사실이 없으면 empty', () => {
  for (const id of ['public-1', 'public-2']) {
    const { request } = goldenRequest(id)
    for (const root of ['hours', 'subBody']) assert.equal(slotOf(request, root)?.empty, false, `${id}.${root}: ${JSON.stringify(request.structureSlots?.map((x) => x.path))}`)
    assert.deepEqual(slotOf(request, 'mapLinks')?.factsWanted, ['naverMapUrl', 'kakaoMapUrl'])
    assert.deepEqual(slotOf(request, 'directions')?.factsWanted, ['transit', 'parking'])
    assert.ok(slotOf(request, 'hours').sections.includes('main/agency-info'))
  }
  const brief = structuredClone(goldenOf('public-1').brief)
  for (const n of ['naverMapUrl', 'kakaoMapUrl', 'guide']) delete brief.facts[n]
  const { request } = goldenRequest('public-1', { brief })
  assert.equal(slotOf(request, 'mapLinks').empty, true)
  assert.equal(slotOf(request, 'subBody').empty, true)
})

test('[3] 감사: public 영업시간 표와 하위 쪽 본문은 더는 known-gap 이 아니다', () => {
  assert.deepEqual(KNOWN_GAPS.filter((g) => g.archetype === 'public').map((g) => g.section), [])
})

// ── detail — 묻고 답한 질문(Q&A) · 다른 방식 비교 · 상세 이미지 조각 ──────────────────────────────────────────────────────────
const DETAIL = {
  archetype: 'detail', locale: 'ko',
  faq: [
    { q: '세탁은 어떻게 하나요?', a: '찬물에 손세탁하고 그늘에서 말려요', topic: '관리' },
    { q: '어깨끈 길이를 조절할 수 있나요?', a: '길이를 조절할 수 있어요', topic: '사용' },
    { q: '선물 포장이 되나요?', a: '주문할 때 요청하면 포장해 드려요', topic: '관리' },
  ],
  compare: { usLabel: '손바느질 린넨 앞치마', themLabel: '일반 공장제 앞치마', rows: [{ label: '박음질', us: '한 장씩 손으로 박아요', them: '기계로 대량 박아요' }, { label: '어깨끈', us: '길이를 조절해요', them: '길이가 고정이에요' }] },
  slices: [{ width: 860, height: 1000, altText: '린넨 원단을 고르는 모습' }],
  slots: slotsOf(),
}
const bindDetail = (block, content, key) => bindSection({ key, block, content, copyIndex: new Map(), routes: { home: '/' }, locale: content.locale, navLinks: () => [], primaryCta: () => ({ href: '#' }), secondaryHref: () => '#' })

test('[3] detail product-detail/qna: 질문·답(faq)이 두 열 목차 변형에 이어지고, 모든 질문에 주제(topic)가 있으면 주제별 변형에도 이어진다 — 주제가 모자라면 주제를 지어내지 않는다', async () => {
  const two = await bindDetail('block-faq-two-column-index', DETAIL, 'product-detail/qna')
  assert.ok(two.props, two.why)
  assert.deepEqual(two.props.copy.items[0], { q: { $ref: 'faq.0.q' }, a: { $ref: 'faq.0.a' } })
  const grouped = await bindDetail('block-faq-grouped-by-topic', DETAIL, 'product-detail/qna')
  assert.ok(grouped.props, grouped.why)
  const names = grouped.props.copy.topics.map((t) => t.name)
  assert.deepEqual(names, [{ $ref: 'faq.0.topic' }, { $ref: 'faq.1.topic' }], '주제는 처음 나온 순서, 같은 주제는 한 칸')
  assert.deepEqual(grouped.props.copy.topics[0].items.map((i) => i.q), [{ $ref: 'faq.0.q' }, { $ref: 'faq.2.q' }])
  assert.equal(typeof grouped.props.copy.countUnit, 'string')
  const noTopic = await bindDetail('block-faq-grouped-by-topic', { ...DETAIL, faq: DETAIL.faq.map(({ topic, ...q }, i) => (i === 1 ? q : { topic, ...q })) }, 'product-detail/qna')
  assert.equal(noTopic.props, null)
  assert.match(noTopic.why, /주제/)
  const none = await bindDetail('block-faq-two-column-index', { ...DETAIL, faq: undefined }, 'product-detail/qna')
  assert.equal(none.props, null)
})

test('[3] detail product-detail/key-points: 비교 자료(compare)가 있으면 우리 대 다른 방식 비교표가 되고, 없으면 비교 값을 지어내지 않는다', async () => {
  const r = await bindDetail('block-features-compare-table', DETAIL, 'product-detail/key-points')
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.copy.us, { $ref: 'compare.usLabel' })
  assert.deepEqual(r.props.copy.them, [{ $ref: 'compare.themLabel' }])
  assert.deepEqual(r.props.copy.rows[1], { label: { $ref: 'compare.rows.1.label' }, us: { $ref: 'compare.rows.1.us' }, them: [{ $ref: 'compare.rows.1.them' }] })
  assert.equal(r.props.copy.footnote, undefined, '예시 각주는 싣지 않는다')
  assert.equal(r.issues.filter((i) => ['marker', 'name', 'digits', 'leak'].includes(i.why)).length, 0, JSON.stringify(r.issues))
  const none = await bindDetail('block-features-compare-table', { ...DETAIL, compare: undefined }, 'product-detail/key-points')
  assert.equal(none.props, null)
  assert.match(none.why, /다른 방식/)
})

test('[3] detail product-detail/story: 상세 이미지 조각(slices)은 사진 파일이 없어도 글(altText)로 틀이 그려져 「실제 사진 필요」 입력 대기가 된다 — 조각이 없으면 자료 없음', () => {
  const r = contentBind('detail', 'product-detail', 'story', DETAIL)
  assert.ok(r.props, r.why)
  assert.equal(r.block, 'block-content-gallery')
  assert.deepEqual(r.photos, ['product-detail/story/story'], '사진 파일이 없는 조각은 입력 대기 사유(실제 사진 필요)로 남는다')
  assert.equal(r.props.images[0].src, undefined)
  assert.deepEqual(r.props.images[0].alt, { $ref: 'slices.0.altText' })
  const none = contentBind('detail', 'product-detail', 'story', { ...DETAIL, slices: [] })
  assert.equal(none.props, undefined)
})

test('[3] detail 콘텐츠 스키마: faq(주제 선택) · compare · slices(사진 경로 선택)를 받는다 — 틀린 모양은 거절', () => {
  const schema = loadContentSchema('detail')
  const base = {
    archetype: 'detail',
    product: { name: '린넨 앞치마', price: 39000, currency: 'KRW', taxIncluded: true, shipping: { fee: 3000, courier: '택배 협력사', leadDays: 3 }, returns: { feePayer: 'buyer', withdrawalDays: 7 } },
    notice: { category: '의류', rows: [{ label: '제조국', value: '대한민국' }] },
  }
  const ok = schema.safeParse(base)
  assert.equal(ok.success, true, ok.success ? '' : JSON.stringify(ok.error.issues.slice(0, 3)))
  const full = schema.safeParse({ ...base, faq: DETAIL.faq, compare: DETAIL.compare, slices: DETAIL.slices })
  assert.equal(full.success, true, full.success ? '' : JSON.stringify(full.error.issues.slice(0, 3)))
  assert.equal(schema.safeParse({ ...base, faq: [{ q: '질문만' }] }).success, false)
  assert.equal(schema.safeParse({ ...base, compare: { usLabel: '우리', themLabel: '다른', rows: [] } }).success, false, '기준 줄이 하나도 없는 비교표는 거절')
  assert.equal(schema.safeParse({ ...base, slices: [{ width: 500, height: 1000, altText: '글' }] }).success, false, '폭은 860')
})

test('[3] detail 04 구조 칸: 질문·답(faq) · 비교(compare) · 상세 이미지 조각(slices)을 요청한다 — 골든 둘 모두 사실이 있고, 사실이 없으면 empty', () => {
  for (const id of ['detail-1', 'detail-2']) {
    const { request } = goldenRequest(id)
    for (const [root, wanted] of [['faq', ['faq']], ['compare', ['compare']], ['slices', ['story']]]) {
      const s = slotOf(request, root)
      assert.ok(s, `${id}.${root}: ${JSON.stringify(request.structureSlots?.map((x) => x.path))}`)
      assert.equal(s.empty, false, `${id}.${root}`)
      assert.deepEqual(s.factsWanted, wanted, `${id}.${root}`)
    }
  }
  const brief = structuredClone(goldenOf('detail-1').brief)
  for (const n of ['faq', 'compare', 'story']) delete brief.facts[n]
  const { request } = goldenRequest('detail-1', { brief })
  for (const root of ['faq', 'compare']) assert.equal(slotOf(request, root).empty, true, root)
  assert.equal(slotOf(request, 'slices'), undefined, '상세 설명(story) 사실이 없으면 선택 섹션이 사이트맵에 없다 — 칸도 없다')
})

test('[3] 감사: detail 핵심 구매 포인트(비교표)와 Q&A 는 더는 known-gap 이 아니다', () => {
  assert.deepEqual(KNOWN_GAPS.filter((g) => g.archetype === 'detail').map((g) => g.section), [])
})
