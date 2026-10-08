// 블록 예시(fixture)의 사업 내용 글이 콘텐츠로 묶이지 않고 사이트에 그대로 나가던 길(레인 EXLEAK, 골든 결선 화면을 눈으로 보고 찾았다).
//   · commerce-1 b(커피 로스터리): 홈 제목이 「이번 주 빵」·「많이 팔린 빵」, 같은 상품 목록이 홈에 세 번 되풀이됐다.
//   · brand-1 a(한옥 찻집): 히어로에 디자인 스튜디오 예시 「Loud ideas, quiet craft, signal for all.」·「[ Posters · Signs · Screens ]」·「SIGNAL」이 그대로 나갔다.
// 원인: exampleIssues 는 표지(「예시」)·숫자·가상 이름이 있는 글만 잡고 평범한 낱말(빵·ideas)은 못 본다. 06 은 fixture 와 같은 글이 콘텐츠 없이 남았는지를 따로 본다(leakIssues).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-fixture-leak.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLACEHOLDER } from '../stamp/content.mjs'
import { loadBrief } from '../stamp/brief.mjs'
import { bindSection, blockItems, fixtureOf, BLOCKER } from '../stamp/gen-pages.mjs'
import { exampleIssues, getLeaf, groupLeakIssues, leakIssues, leaves, ref } from '../stamp/site-bind.mjs'
import { root, saasContent, makeRun, gen, text } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'stamp-fixture-leak-test')
const HERO = 'block-hero-inline-chip-title' // brand-1 a 의 히어로 — 줄 객체(lines.chipBefore…)·captionBottom·cropWord 는 binder 가 묶지 못한다
const siteOf = (s) => JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
const lit = (props) => leaves(props).filter((l) => l.ref === null)
const routes = { home: '/', products: '/products' }
const bind = (block, content, { key = 'home/x', copy = {}, routes: r = routes, cta = { href: '/signup' }, locale = 'ko' } = {}) =>
  bindSection({ key, block, content, copyIndex: new Map(Object.entries(copy)), routes: r, locale, navLinks: () => [{ label: '홈', href: '/' }], primaryCta: () => cta, secondaryHref: () => '/pricing' })

const COMMERCE_BRIEF = loadBrief(join(root, 'factory', 'stamp', 'briefs', 'golden', 'commerce-1.json'))
const commerceContent = (request) => ({
  archetype: 'commerce', locale: 'ko', business: { ...request.seedContent.business },
  products: [
    { slug: 'haru-blend', name: '하루 블렌드 200g', price: 13000, options: [], thumbs: [{ id: 'product-thumb', aspect: '1:1', source: 'real-required', alt: '하루 블렌드 사진 자리' }] },
    { slug: 'dripbag', name: '드립백 10입', price: 9900, options: [], thumbs: [{ id: 'product-thumb', aspect: '1:1', source: 'real-required', alt: '드립백 사진 자리' }] },
  ],
  shipping: { fee: 3500, freeThreshold: 40000, courier: '한진택배', leadDays: 1 },
  facts: { ...request.seedContent.facts },
  slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: text(s, PLACEHOLDER.ko) })), images: [] },
})

test('leakIssues: fixture 와 같은 사업 내용 글(히어로 줄·CTA·제목)을 「leak」로 잡고, UI 이름표·$ref·콘텐츠에 있는 글·fixture 에 없던 글은 놓아 둔다', async () => {
  const fixture = await fixtureOf(blockItems().get(HERO))
  const found = leakIssues(lit(fixture), fixture, { kind: 'hero' })
  const paths = found.map((i) => i.path)
  for (const want of ['copy.title', 'copy.lines.chipBefore', 'copy.lines.last', 'copy.cropWord', 'copy.captionBottom', 'copy.primaryCta.label']) assert.ok(paths.includes(want), `${want} 를 못 잡았다: ${paths}`)
  assert.ok(found.every((i) => i.why === 'leak'))
  // 음성 대조: 화면 이름표(첫 화면)·링크·식별자는 사업 내용이 아니다
  for (const no of ['copy.label', 'copy.primaryCta.href', 'faces[0]']) assert.ok(!paths.includes(no), `${no} 는 누설이 아니다`)
  // 콘텐츠($ref)로 묶인 칸은 literal 이 아니라 여기 안 온다 / fixture 에 없던 글(콘텐츠가 직접 적은 literal)은 누설이 아니다
  const bound = { ...fixture, copy: { ...fixture.copy, title: ref('slots.copy.0.text'), cropWord: '솔결재', captionBottom: '[ 차 · 다식 · 다실 ]' } }
  const after = leakIssues(lit(bound), fixture, { kind: 'hero' }).map((i) => i.path)
  assert.ok(!after.includes('copy.title') && !after.includes('copy.cropWord') && !after.includes('copy.captionBottom'), after.join(','))
  // 콘텐츠에 같은 글이 있으면(사업이 정말 그 말을 쓴다) 누설이 아니다
  const sameAsContent = leakIssues(lit(fixture), fixture, { kind: 'hero', contentTexts: new Set(['SIGNAL']) }).map((i) => i.path)
  assert.ok(!sameAsContent.includes('copy.cropWord') && sameAsContent.includes('copy.captionBottom'))
})

test('leakIssues: 제품 화면·본문·푸터·영업시간 같은 UI 이름표 블록은 보지 않고, 상품 목록·특징은 제목만 본다(오류·빈 상태 안내는 UI 낱말)', async () => {
  const productFx = await fixtureOf(blockItems().get('block-product-list-grid-cards'))
  // 표지가 붙은 글(lead: …(예시))은 exampleIssues 가 이미 잡는다 — bindSection 은 그 경로를 alreadyFlagged 로 넘겨 되풀이하지 않는다
  const flagged = exampleIssues(lit(productFx), new Set()).map((i) => i.path)
  assert.ok(flagged.includes('copy.lead'))
  const found = leakIssues(lit(productFx), productFx, { kind: 'product-list', alreadyFlagged: flagged })
  assert.deepEqual(found.map((i) => i.path), ['copy.title'], '이번 주 빵')
  assert.equal(found[0].value, '이번 주 빵')
  for (const kind of ['account', 'auth', 'content', 'footer', 'hours-location', 'consent', 'pricing']) assert.deepEqual(leakIssues(lit(productFx), productFx, { kind }), [], kind)
  const feat = await fixtureOf(blockItems().get('block-features-numbered-steps'))
  assert.ok(leakIssues(lit(feat), feat, { kind: 'features' }).some((i) => i.path === 'copy.title'), '특징 제목 「세 단계면 시작합니다」')
  // 생성기가 든 화면 이름표(상품 요약·전체 상품)는 fixture 와 같아도 누설이 아니다
  assert.deepEqual(leakIssues([{ path: 'copy.title', value: '상품 요약', ref: null }], { copy: { title: '상품 요약' } }, { kind: 'product-list' }), [])
})

test('leakIssues 는 exampleIssues 와 따로다 — 표지·숫자·이름이 없는 평범한 낱말은 exampleIssues 가 못 본다(양성 대조)', async () => {
  const fixture = await fixtureOf(blockItems().get(HERO))
  const base = exampleIssues(lit(fixture), new Set()).map((i) => i.path)
  for (const p of ['copy.title', 'copy.lines.chipBefore', 'copy.cropWord', 'copy.captionBottom']) assert.ok(!base.includes(p), `${p} 는 exampleIssues 가 이미 잡는다 — 이 검사가 필요 없다`)
})

test('bindSection: 히어로의 문구 칸이 없으면 예시 히어로 글이 「leak」 이슈로 남고, 제목 칸이 있으면 그 칸은 이슈가 아니다', async () => {
  const content = { archetype: 'brand', locale: 'ko', site: { name: '솔결재' }, slots: { copy: [{ id: 'headline', role: '', text: '숲 끝 다실, 저녁에만 엽니다' }] } }
  const none = await bind(HERO, content, { key: 'home/hero' })
  // 한 섹션의 누설 글은 몇 곳이어도 이슈 하나다(폴백 비용이 잎 수로 부풀어 더 나쁜 변형으로 바뀌지 않게) — 어느 칸들인지는 leaves 에 든다
  assert.equal(none.issues.filter((i) => i.why === 'leak').length, 1)
  const noneLeaks = none.issues.filter((i) => i.why === 'leak').flatMap((i) => i.leaves)
  for (const want of ['copy.captionBottom', 'copy.lines.chipBefore', 'copy.title', 'copy.primaryCta.label']) assert.ok(noneLeaks.includes(want), `${want}: ${noneLeaks}`)
  const withTitle = await bind(HERO, content, { key: 'home/hero', copy: { 'home/hero/headline#0': 0 } })
  const leaks = withTitle.issues.filter((i) => i.why === 'leak').flatMap((i) => i.leaves)
  assert.ok(!leaks.includes('copy.title'), '제목은 콘텐츠 문구 칸으로 묶였다')
  assert.ok(leaks.includes('copy.captionBottom') && leaks.includes('copy.lines.last'), '묶을 자료가 없는 필수 칸의 예시 글은 이슈로 남는다')
  assert.ok(withTitle.dropped.includes('copy.cropWord'), '선택 칸(cropWord?)에 남은 예시 큰 글자는 지운다')
})

test('commerce 상품 목록: 제목이 예시 「이번 주 빵」·「많이 팔린 빵」이 아니라 생성기의 화면 이름표이고, 누설 이슈가 없다', async () => {
  const content = { archetype: 'commerce', locale: 'ko', business: { name: '하루볶음' }, products: [{ slug: 'a', name: '하루 블렌드', price: 13000, options: [], thumbs: [] }] }
  for (const block of ['block-product-list-grid-cards']) {
    const r = await bind(block, content, { key: 'home/new-arrivals' })
    assert.ok(r.props, r.why)
    assert.equal(r.props.copy.title, '전체 상품', block)
    assert.deepEqual(r.issues.filter((i) => i.why === 'leak'), [], block)
  }
  const en = await bindSection({ key: 'home/new-arrivals', block: 'block-product-list-grid-cards', content: { ...content, locale: 'en' }, copyIndex: new Map(), routes, locale: 'en', navLinks: () => [], primaryCta: () => null, secondaryHref: () => '#' })
  assert.equal(en.props.copy.title, 'All products')
})

test('C334 순위 목록: 판매 순위 자료가 없으면 ranked-list 를 그리지 않는다(null + 까닭) — 순위를 말하지 않는 목록은 그대로 그린다, 순위 자료(오름차순 salesRank)가 있으면 그린다', async () => {
  const base = { archetype: 'commerce', locale: 'ko', business: { name: '하루볶음' } }
  const products = [{ slug: 'a', name: '하루 블렌드', price: 13000, options: [], thumbs: [] }, { slug: 'b', name: '예가체프', price: 15000, options: [], thumbs: [] }]
  const none = await bind('block-product-list-ranked-list', { ...base, products }, { key: 'home/best' })
  assert.equal(none.props, null)
  assert.match(none.why, /판매 순위 자료가 없다/)
  assert.equal(none.omit, true, 'D238: 순위 자료가 없어 못 그린 것은 omit 표지가 붙는다(선택 섹션이면 06 이 막지 않고 뺀다)')
  assert.ok((await bind('block-product-list-grid-cards', { ...base, products }, { key: 'home/best' })).props, '순위를 안 말하는 목록은 그대로 그린다(음성 대조)')
  // 자료가 있을 때만(양의 정수·배열이 순위 오름차순) 그린다 — 뒤섞였거나 일부만 있으면 그리지 않는다
  const ranked = products.map((p, i) => ({ ...p, salesRank: i + 1 }))
  assert.ok((await bind('block-product-list-ranked-list', { ...base, products: ranked }, { key: 'home/best' })).props)
  assert.equal((await bind('block-product-list-ranked-list', { ...base, products: [ranked[1], ranked[0]] }, { key: 'home/best' })).props, null)
  assert.equal((await bind('block-product-list-ranked-list', { ...base, products: [ranked[0], products[1]] }, { key: 'home/best' })).props, null)
})

test('D238 음성 대조: home/best 가 필수 섹션이면 순위 자료가 없을 때 여전히 「자료 연결 안 됨」으로 공개를 막는다 — 선택일 때만 뺀다', async () => {
  const r = await makeRun(TMP, COMMERCE_BRIEF, commerceContent)
  const file = join(r.runDir, 'a', '02-sitemap.json')
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  const best = saved.data.pages.find((p) => p.id === 'home').sections.find((s) => s.kind === 'best')
  assert.ok(best, 'commerce 홈에 best 섹션이 있다')
  assert.equal(best.required, false, 'best 는 원형 JSON 에서 선택 섹션이다(D238)')
  best.required = true
  writeFileSync(file, JSON.stringify(saved))
  await gen(r)
  const candidate = JSON.parse(readFileSync(join(r.runDir, 'a', 'candidate.json'), 'utf8'))
  assert.ok(candidate.blockers.some((b) => b.startsWith(BLOCKER.unbound) && b.includes('home/best')), `필수면 막아야 한다: ${candidate.blockers.join('\n')}`)
})

test('06 commerce: 사이트 어디에도 「이번 주 빵」·「많이 팔린 빵」이 없고, 같은 상품 목록은 홈에 한 번만 그려진다 — 나머지는 「그리지 않음」으로 남고 필수 섹션 blocker 도 아니다', async () => {
  const r = await makeRun(TMP, COMMERCE_BRIEF, commerceContent)
  const g = await gen(r)
  const site = siteOf(g)
  const json = JSON.stringify(site)
  for (const t of ['이번 주 빵', '많이 팔린 빵']) assert.ok(!json.includes(t), `${t} 가 사이트에 남았다`)
  const homeLists = Object.entries(site.sections).filter(([k, s]) => k.startsWith('home/') && s.block.includes('product-list'))
  assert.equal(homeLists.length, 1, `홈 상품 목록이 ${homeLists.map(([k]) => k)}`)
  assert.equal(homeLists[0][0], 'home/categories', '필수 섹션(categories)이 먼저라 그것이 남는다')
  for (const key of ['home/new-arrivals', 'home/curated']) {
    assert.ok(g.skipped.some((s) => s.key === key && /같은 쪽|앞 섹션/.test(s.why)), `${key} 가 이유와 함께 그리지 않음으로 남아야 한다: ${JSON.stringify(g.skipped)}`)
  }
  // C334: home/best 는 순위 목록(ranked-list) 하나뿐인 섹션인데 콘텐츠에 판매 순위 자료가 없다 → 「1위…」를 지어 그리지 않고 「자료 연결 안 됨」으로 남는다(되풀이 합침이 아니다)
  assert.ok(g.skipped.some((s) => s.key === 'home/best' && /판매 순위 자료가 없다/.test(s.why)), `home/best 는 판매 순위 자료 없음으로 그리지 않아야 한다: ${JSON.stringify(g.skipped)}`)
  assert.ok(!json.includes('block-product-list-ranked-list'), '순위 목록 블록이 사이트에 없다')
  const candidate = JSON.parse(readFileSync(join(r.runDir, 'a', 'candidate.json'), 'utf8'))
  // D238: home/best 는 선택 섹션(required false)이라 순위 자료가 없으면 공개 불가로 막지 않고 뺀다(자료가 생기면 그때 그린다)
  assert.ok(!candidate.blockers.some((b) => b.includes('home/best')), `선택 섹션 home/best 가 blocker 로 남았다: ${candidate.blockers.join('\n')}`)
  assert.ok(!candidate.blockers.some((b) => b.startsWith(BLOCKER.undrawn) && /home\/(?:best|new-arrivals|curated)/.test(b)), candidate.blockers.join('\n'))
  // 다른 쪽(/products)의 목록은 그대로 — 쪽이 다르면 되풀이가 아니다
  assert.ok(site.sections['category-list/product-grid'], '상품 목록 쪽은 그려진다')
})

test('06 saas: 같은 쪽에 같은 블록·같은 props 인 섹션이 둘 이상 그려지지 않는다(음성 대조: 다른 쪽의 같은 블록은 그대로)', async () => {
  // 골든 saas-1 브리프는 campaign 쪽에 how-it-works 와 workflow-features 를 함께 싣는다(둘 다 같은 4단계 블록·같은 workflowSteps) — SAAS_BRIEF 는 한 섹션뿐이라 이 길을 못 탄다
  const r = await makeRun(TMP, loadBrief(join(root, 'factory', 'stamp', 'briefs', 'golden', 'saas-1.json')), saasContent)
  const g = await gen(r)
  const site = siteOf(g)
  assert.ok(g.skipped.some((s) => s.key === 'campaign/workflow-features' && /같은 쪽/.test(s.why)), JSON.stringify(g.skipped.map((s) => s.key)))
  assert.ok(site.sections['campaign/how-it-works'] && !site.sections['campaign/workflow-features'])
  assert.ok(site.sections['home/workflow-features'], '홈의 같은 블록은 다른 쪽이라 그대로 그려진다')
  const seen = new Map()
  const dups = []
  for (const [key, s] of Object.entries(site.sections)) {
    const page = key.split('/')[0]
    if (page === 'global') continue
    const sig = `${page}|${s.block}|${JSON.stringify(s.props)}`
    if (seen.has(sig)) dups.push(`${seen.get(sig)} = ${key}`)
    else seen.set(sig, key)
  }
  assert.deepEqual(dups, [], '같은 쪽의 되풀이')
  const blocks = (page) => Object.entries(site.sections).filter(([k]) => k.startsWith(`${page}/`)).map(([, s]) => s.block)
  assert.ok(blocks('home').length > 0 && blocks('pricing').length > 0, '쪽마다 섹션이 그려진다')
})

test('다른 쪽에 같은 블록·같은 데이터는 되풀이가 아니다 — 같은 쪽 안에서만 합친다', async () => {
  const { dedupeKey } = await import('../stamp/gen-pages.mjs')
  const a = { block: 'block-product-list-grid-cards', props: { state: { status: 'ready', data: ref('products') }, copy: { title: '전체 상품' } } }
  const b = { block: 'block-product-list-ranked-list', props: { state: { status: 'ready', data: ref('products') }, copy: { title: '전체 상품' } } }
  assert.equal(dedupeKey('home/best', b), dedupeKey('home/curated', a), '같은 쪽의 상품 목록은 변형이 달라도 같은 자료라 같은 키')
  assert.notEqual(dedupeKey('home/best', b), dedupeKey('category-list/product-grid', b), '다른 쪽은 다른 키')
  const c = { block: 'block-features-numbered-steps', props: { copy: { title: ref('x') } } }
  const d = { block: 'block-features-numbered-steps', props: { copy: { title: ref('y') } } }
  assert.notEqual(dedupeKey('home/a', c), dedupeKey('home/b', d), 'props 가 다르면 되풀이가 아니다')
})

test('groupLeakIssues: 잎이 몇 개든 이슈 하나(경로는 첫 잎, leaves 에 전부), 없으면 빈 배열', () => {
  assert.deepEqual(groupLeakIssues([]), [])
  const one = groupLeakIssues([{ path: 'copy.a', why: 'leak', value: 'x' }, { path: 'copy.b', why: 'leak', value: 'y' }, { path: 'copy.c', why: 'leak', value: 'z' }])
  assert.equal(one.length, 1)
  assert.deepEqual([one[0].path, one[0].why, one[0].value, one[0].leaves], ['copy.a', 'leak', 'x 외 2곳', ['copy.a', 'copy.b', 'copy.c']])
})

test('히어로 주 행동 버튼: 문구 칸이 없어도 버튼이 가는 곳의 이름표(생성기)로 쓴다 — 예시 버튼 글이 남지 않는다. 갈 곳이 없으면 선택 칸은 빼고 필수 칸이면 누설 이슈', async () => {
  const content = { archetype: 'commerce', locale: 'ko', business: { name: '하루볶음' } }
  const fx = await fixtureOf(blockItems().get(HERO))
  assert.equal(fx.copy.primaryCta.label, '작업 의뢰', '예시 버튼 글')
  const cases = [
    [{ routes: { home: '/', 'category-list': '/products' }, cta: { href: '/products' } }, '상품 보기'],
    [{ routes: { home: '/', signup: '/signup' }, cta: { href: '/signup' } }, '시작하기'],
    [{ routes: { home: '/', pricing: '/pricing' }, cta: { href: '/pricing' } }, '요금제 보기'],
    [{ routes: { home: '/' }, cta: { href: ref('booking.primary.value', { as: 'tel' }) } }, '전화하기'],
    [{ routes: { home: '/' }, cta: { href: ref('booking.primary.value') } }, '문의하기'],
    [{ routes: { home: '/', about: '/about' }, cta: { href: '/about' } }, '소개 보기'],
  ]
  for (const [opts, label] of cases) {
    const r = await bind(HERO, content, { key: 'home/hero', ...opts })
    assert.equal(r.props.copy.primaryCta.label, label)
    assert.deepEqual(r.props.copy.primaryCta.href, opts.cta.href)
    assert.ok(!r.issues.flatMap((i) => i.leaves ?? [i.path]).includes('copy.primaryCta.label'), label)
  }
  // 갈 곳이 없으면 예시 글을 싣지 않는다: 선택 칸이면 버튼을 뺀다, 필수 칸이면 누설 이슈로 남는다
  const none = await bind(HERO, content, { key: 'home/hero', routes: { home: '/' }, cta: { href: '#' } })
  const left = none.props.copy.primaryCta
  assert.ok(left === undefined || none.issues.flatMap((i) => i.leaves ?? [i.path]).includes('copy.primaryCta.label'), '예시 버튼 글이 조용히 남았다')
  // 영어
  const en = await bind(HERO, content, { key: 'home/hero', routes: { home: '/', signup: '/signup' }, cta: { href: '/signup' }, locale: 'en' })
  assert.equal(en.props.copy.primaryCta.label, 'Get started')
})

test('단계 특징(numbered-steps): 제목은 예시 「세 단계면 시작합니다」가 아니라 생성기 이름표이고 단계는 콘텐츠로 묶인다', async () => {
  const content = { archetype: 'saas', locale: 'ko', workflowSteps: [{ title: '예약 받기', body: '손님이 고른 시간이 달력에 들어와요' }, { title: '알림 보내기', body: '방문 전날 문자가 나가요' }] }
  const r = await bind('block-features-numbered-steps', content, { key: 'home/workflow-features' })
  assert.ok(r.props, r.why)
  assert.equal(r.props.copy.title, '이용 방법')
  assert.deepEqual(r.issues.filter((i) => i.why === 'leak'), [])
  assert.equal(r.props.copy.steps.length, 2)
})

test('히어로가 직접 그리는 그림의 설명(figureAlt)·화면 이름표(…Label)는 사업 내용이 아니라 누설이 아니다 — 음성 대조', () => {
  const fixture = { copy: { figureAlt: '겹쳐 쌓인 서류 세 장', listLabel: '작업 목록', backers: ['누리 병원'] } }
  const found = leakIssues(leaves(fixture), fixture, { kind: 'hero' }).map((i) => i.path)
  assert.deepEqual(found, ['copy.backers[0]'])
})

test('portfolio 첫 화면(statement)의 한 문장 칸(h1)이 히어로 제목으로 묶인다 — 예시 제목이 남지 않는다', async () => {
  const content = { archetype: 'portfolio', locale: 'ko', slots: { copy: [{ id: 'h1', role: '', text: '골목과 시장, 사람이 지나간 자리를 기록해요' }] } }
  const r = await bind(HERO, content, { key: 'home/statement', copy: { 'home/statement/h1#0': 0 } })
  assert.deepEqual(r.props.copy.title, { $ref: 'slots.copy.0.text' })
  assert.ok(!r.issues.flatMap((i) => i.leaves ?? [i.path]).includes('copy.title'))
})

test('선택 칸(?:)에 남은 예시 사업 글은 지운다 — 없는 편이 거짓 문구보다 낫다. 필수 칸에 남은 글은 누설 이슈로 남는다', async () => {
  const content = { archetype: 'brand', locale: 'ko' }
  const fx = await fixtureOf(blockItems().get(HERO))
  const r = await bind(HERO, content, { key: 'home/hero', routes: { home: '/' }, cta: { href: '#' } })
  const src = blockItems().get(HERO).source
  const dropped = new Set(r.dropped)
  const left = new Set(r.issues.filter((i) => i.why === 'leak').flatMap((i) => i.leaves))
  // 예시 글은 지워졌거나 이슈로 남았거나 둘 중 하나다(조용히 남지 않는다)
  for (const l of leaves(fx).filter((x) => typeof x.value === 'string' && ['copy.captionBottom', 'copy.cropWord', 'copy.title', 'copy.lines.last'].includes(x.path))) {
    assert.ok(dropped.has(l.path) || left.has(l.path) || getLeaf(r.props, l.path) !== l.value, `${l.path} 가 조용히 남았다`)
  }
  // 타입에 ?: 인 칸이 실제로 지워지는 길을 본다 — 선택 칸이 있는 히어로(captionBottom?·cropWord? 등)
  const optional = ['captionBottom', 'cropWord'].filter((k) => src.includes(`${k}?:`))
  for (const k of optional) assert.ok(dropped.has(`copy.${k}`) && getLeaf(r.props, `copy.${k}`) === undefined, `${k} 는 선택 칸이라 지워야 한다: ${[...dropped]}`)
})

test('공공 히어로: 문구 칸이 없고 갈 곳(가입·요금제…)도 없으면 콘텐츠 바로가기(quickLinks) 첫 항목이 주 버튼이다 — 예시 「발급 신청」이 남지 않는다', async () => {
  const content = { archetype: 'public', locale: 'ko', quickLinks: [{ label: '도서 검색', href: '/catalog' }, { label: '이용 안내', href: '/guide' }] }
  const r = await bind('block-hero-identity-strip-banner', content, { key: 'main/hero', routes: { main: '/' }, cta: { href: '#' } })
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.copy.primaryCta, { label: { $ref: 'quickLinks.0.label' }, href: { $ref: 'quickLinks.0.href' } })
  assert.ok(!r.issues.flatMap((i) => i.leaves ?? [i.path]).includes('copy.primaryCta.label'))
  // 바로가기가 없으면(음성 대조) 예시 글을 싣지 않는다: 지우거나 이슈로 남긴다
  const none = await bind('block-hero-identity-strip-banner', { archetype: 'public', locale: 'ko', quickLinks: [] }, { key: 'main/hero', routes: { main: '/' }, cta: { href: '#' } })
  assert.ok(none.props === null || none.props.copy.primaryCta === undefined || none.issues.flatMap((i) => i.leaves ?? [i.path]).includes('copy.primaryCta.label'))
})

test('pickTie: 폴백에서 비용이 같은 변형이 여럿이면 후보 칸(a·b·c)마다 돌려 고른다 — 한 사이트 a·b·c 가 같은 블록으로 모이지 않게(칸을 모르면 첫 번째)', async () => {
  const { pickTie } = await import('../stamp/gen-pages.mjs')
  const ties = [{ alt: 'x' }, { alt: 'y' }, { alt: 'z' }]
  assert.deepEqual(['a', 'b', 'c'].map((c) => pickTie(ties, c).alt), ['x', 'y', 'z'])
  assert.equal(pickTie(ties, 'd').alt, 'x')
  assert.equal(pickTie(ties, undefined).alt, 'x')
  assert.deepEqual(['a', 'b', 'c'].map((c) => pickTie([{ alt: 'x' }, { alt: 'y' }], c).alt), ['x', 'y', 'x'], '둘뿐이면 돌아온다')
  assert.equal(pickTie([{ alt: 'only' }], 'c').alt, 'only')
})

test('한 낱말 히어로의 필수 버튼 filmCta(예시 「숲 소리 듣기」)도 버튼이 가는 곳의 이름표로 쓴다 — 어느 사업에나 맞는 구역 제목(자주 묻는 질문)은 누설이 아니다(음성 대조)', async () => {
  const GRID = 'block-hero-grid-lines-baseline-word'
  const fx = await fixtureOf(blockItems().get(GRID))
  assert.equal(fx.copy.filmCta.label, '숲 소리 듣기')
  const r = await bind(GRID, { archetype: 'local', locale: 'ko', business: { name: '달빛' } }, { key: 'home/hero', routes: { home: '/', signup: '/signup' }, cta: { href: '/signup' } })
  assert.deepEqual([r.props.copy.filmCta.label, r.props.copy.filmCta.href], ['시작하기', '/signup'])
  assert.ok(!r.issues.flatMap((i) => i.leaves ?? [i.path]).includes('copy.filmCta.label'))
  // 구역 제목 표
  const faq = await fixtureOf(blockItems().get('block-faq-single-accordion'))
  assert.deepEqual(leakIssues(leaves(faq).filter((l) => l.path === 'copy.title'), faq, { kind: 'faq' }), [], '「자주 묻는 질문」은 어느 사업에나 맞는다')
  const feat = await fixtureOf(blockItems().get('block-features-bento-grid'))
  assert.equal(leakIssues(leaves(feat).filter((l) => l.path === 'copy.title'), feat, { kind: 'features' }).length, 1, '「하루 마감을 한 화면에서」는 사업 이야기')
})
