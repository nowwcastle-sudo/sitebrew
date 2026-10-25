// v0.2.2 SEO 패치(C411 광고 쪽 noindex · C413 ItemList/Event · C414 OG 로고 · C416 행사 사실). 실행: node --test --test-force-exit factory/scripts/seo-patch.test.mjs
// 케이스마다 서로 다른 사고 하나를 잡는다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { tsLoader } from './gen-favicons.mjs'
import { loadArchetypes, PAGE_KINDS as ARCHETYPE_KINDS } from './archetypes.mjs'
import { isEventBrief, requiredFacts } from '../stamp/brief.mjs'
import { questionsFor } from '../intake/questions.mjs'
import { missingFacts, toBrief } from '../intake/to-brief.mjs'

const load = tsLoader('seo-patch-test')
const meta = await load('ax/seo-meta.ts')
const geo = await load('ax/geo-entity.ts')
const { ogImage, readOgFont, markImage } = await load('ax/og-image.tsx')

const SITE = { url: 'https://example.test', name: '예시 사이트' }
const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 64"><rect width="128" height="64" fill="currentColor"/></svg>'

test('쪽 종류 목록은 원형 JSON 쪽(archetypes.mjs)과 키트(seo-meta.ts)가 같고, 모든 원형 쪽이 kind 를 갖는다 — 목록이 따로 낡는 사고', async () => {
  assert.deepEqual([...ARCHETYPE_KINDS].sort(), [...meta.PAGE_KINDS].sort())
  assert.deepEqual(Object.keys(meta.KIND_POLICY).sort(), [...meta.PAGE_KINDS].sort())
  const all = await loadArchetypes()
  const missing = Object.values(all).flatMap((a) => a.pages.filter((p) => !p.kind).map((p) => `${a.id}/${p.id}`))
  assert.deepEqual(missing, [])
  assert.equal(all.saas.pages.find((p) => p.id === 'campaign').kind, 'campaign')
})

test('isIndexed: 광고·앱 종류는 기본 색인 제외, 명시한 noindex 가 종류 기본값보다 앞선다 — 메타 robots 도 같은 함수를 따른다', () => {
  assert.equal(meta.isIndexed({ type: 'campaign' }), false)
  assert.equal(meta.isIndexed({ type: 'app' }), false)
  assert.equal(meta.isIndexed({ type: 'home' }), true)
  assert.equal(meta.isIndexed({ type: 'campaign', noindex: false }), true)
  assert.equal(meta.isIndexed({ type: 'home', noindex: true }), false)
  const c = { site: SITE }
  assert.equal(meta.seoMetadata(c, { path: '/campaign', type: 'campaign', title: 'a', description: 'b' }).robots.index, false)
  assert.equal(meta.seoMetadata(c, { path: '/campaign', type: 'campaign', noindex: false, title: 'a', description: 'b' }).robots.index, true)
  assert.equal(meta.seoMetadata(c, { path: '/legal', type: 'legal', title: 'a', description: 'b' }).robots.index, true, '법정 쪽은 색인 대상')
})

test('Event JSON-LD: 콘텐츠에 event 사실이 있을 때만 — 없으면 지어내지 않고, 있으면 일시·장소가 그대로 실린다', () => {
  const landing = { archetype: 'landing', site: SITE, oneLiner: 'x' }
  const kinds = (c) => geo.jsonLdFor(c, { path: '/', type: 'home' }).map((o) => o['@type'])
  assert.ok(!kinds(landing).includes('Event'))
  const withEvent = { ...landing, event: { name: '가을 북페어', startDate: '2026-11-14T14:00', venue: '서울 예시홀 3층' } }
  const ev = geo.jsonLdFor(withEvent, { path: '/', type: 'home' }).find((o) => o['@type'] === 'Event')
  assert.equal(ev.startDate, '2026-11-14T14:00')
  assert.equal(ev.location.name, '서울 예시홀 3층')
  assert.equal(ev.eventAttendanceMode, 'https://schema.org/OfflineEventAttendanceMode')
  // 다른 원형에 event 칸이 있어도(있을 수 없지만) landing 이 아니면 싣지 않는다
  assert.ok(!geo.jsonLdFor({ archetype: 'saas', site: SITE, product: { name: '제품' }, plans: [], event: withEvent.event }, { path: '/', type: 'home' }).some((o) => o['@type'] === 'Event'))
  // 화면 글자 대조는 이름·장소 이름을 본다 — 화면에 없으면 잡힌다
  const issues = geo.jsonLdVisibleIssues([ev], '가을 북페어 2026-11-14 서울 예시홀 3층')
  assert.deepEqual(issues, [])
  assert.equal(geo.jsonLdVisibleIssues([ev], '다른 글자').length, 2)
})

test('ItemList JSON-LD: 상품 목록 쪽(list)은 이름만 싣고 가격은 싣지 않는다 — 가격 블록이 안 그려진 쪽은 싣지 않는다', () => {
  const commerce = { archetype: 'commerce', site: SITE, products: [{ slug: 'a', name: '상품 가', price: 1000 }, { slug: 'b', name: '상품 나', price: 2000 }] }
  const list = geo.jsonLdFor(commerce, { path: '/products', type: 'list' }).find((o) => o['@type'] === 'ItemList')
  assert.deepEqual(list.itemListElement.map((i) => [i.position, i.name]), [[1, '상품 가'], [2, '상품 나']])
  assert.ok(!JSON.stringify(list).includes('price'))
  assert.ok(!geo.jsonLdFor(commerce, { path: '/products', type: 'list', showsPrice: false }).some((o) => o['@type'] === 'ItemList'))
  assert.ok(!geo.jsonLdFor({ ...commerce, products: [] }, { path: '/products', type: 'list' }).some((o) => o['@type'] === 'ItemList'))
})

test('OG 로고: currentColor 는 accent 로 바뀌고 가로 비율이 유지되며, 로고가 있는 카드는 글자 카드와 다른 그림이다', async () => {
  const img = markImage({ svg: MARK }, '#ff0000')
  assert.equal(img.height, 56)
  assert.equal(img.width, 112, '128:64 비율')
  const svg = Buffer.from(img.src.split(',')[1], 'base64').toString('utf8')
  assert.ok(svg.includes('#ff0000') && !svg.includes('currentColor'))
  assert.equal(markImage({ svg: '<svg viewBox="0 0 1000 10"/>' }, '#000').width, 160, '너무 긴 로고는 160 에서 멈춘다')
  const font = await readOgFont()
  const colors = { background: '#ffffff', foreground: '#000000', accent: '#0000ff' }
  const raw = async (mark) => sharp(Buffer.from(await ogImage({ title: '제목', name: '이름', colors, mark, fonts: [font] }).arrayBuffer())).raw().toBuffer()
  const [plain, withLogo] = [await raw(undefined), await raw({ svg: MARK })]
  assert.notDeepEqual(plain, withLogo)
  // 로고 칸(왼쪽 위 80px 안쪽)에 accent(파랑) 픽셀이 있다
  const blue = (buf) => { let n = 0; for (let i = 0; i < buf.length; i += 3) if (buf[i] < 60 && buf[i + 2] > 200) n++; return n }
  assert.ok(blue(withLogo) > 3000, String(blue(withLogo)))
})

test('행사 사실: 행사형 브리프에서만 일시·장소가 필수다 — 일반 랜딩은 영향이 없고, 질문 순서는 그대로다', () => {
  const ids = (a) => questionsFor(a).map((q) => q.id)
  assert.deepEqual(ids('landing').slice(0, 6), ['name', 'audience', 'action', 'contact', 'logo', 'mood'])
  assert.deepEqual(ids('landing').slice(-3), ['claim', 'eventDate', 'eventVenue'])
  assert.deepEqual(requiredFacts('landing', { archetype: 'landing', topic: '앱 출시 대기 명단', facts: {} }), ['name', 'email'])
  assert.deepEqual(requiredFacts('landing', { archetype: 'landing', topic: '가을 북페어 사전 등록', facts: {} }), ['name', 'email', 'eventDate', 'eventVenue'])
  assert.equal(isEventBrief({ archetype: 'landing', topic: '앱 출시 대기 명단', facts: { eventVenue: '서울 홀' } }), true, '사실이 하나라도 있으면 행사형')
  assert.equal(isEventBrief({ archetype: 'saas', topic: '북페어', facts: {} }), false, 'landing 만 행사형')
  const answers = { name: '예시', audience: '독자', action: '등록', contact: 'a@example.test', mood: '따뜻한', claim: '한 문장' }
  const plain = toBrief({ topic: '앱 출시 대기 명단', archetype: 'landing', answers })
  assert.ok(!missingFacts(plain).includes('eventDate'), '일반 랜딩은 일시를 빠진 사실로 세지 않는다')
  const event = toBrief({ topic: '가을 북페어 사전 등록', archetype: 'landing', answers })
  assert.deepEqual(missingFacts(event).filter((m) => m.startsWith('event')), ['eventDate', 'eventVenue'])
  const done = toBrief({ topic: '가을 북페어 사전 등록', archetype: 'landing', answers: { ...answers, eventDate: '2026-11-14 14:00', eventVenue: '서울 예시홀' } })
  assert.deepEqual(missingFacts(done).filter((m) => m.startsWith('event')), [])
})
