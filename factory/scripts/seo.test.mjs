// SEO·GEO·파비콘 AX 부품(P3-2 Task 13). 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/seo.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { tsLoader, genFavicons, packIco } from './gen-favicons.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const load = tsLoader('seo-test')
const core = await load('content/content-core.ts')
const { LocalContent } = await load('content/schemas/local.ts')
const meta = await load('ax/seo-meta.ts')
const geo = await load('ax/geo-entity.ts')
const { UpdatedAt, pingIndexNow } = await load('ax/freshness.tsx')
const seo = await load('ax/seo-files.ts')
const { faviconSet, manifestIcons, themeColor, MASKABLE_SAFE_RADIUS } = await load('ax/favicon-kit.ts')
const { ogImage, readOgFont } = await load('ax/og-image.tsx')
const { toHex } = await load('ax/brand-color.ts')
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement
const HANGUL = /[가-힣]/

// ── 예시 콘텐츠(가상 이름 + 「예시」) — 콘텐츠 객체 하나에서 화면·메타·JSON-LD 가 나온다(J9) ─────────────
const SITE = { url: 'https://bakery.example.com', description: '마포구 예시로의 동네 식빵집입니다(예시).', sameAs: ['https://pf.kakao.com/_Example'], verification: { google: 'g-token', naver: 'n-token', bing: 'b-token' } }
const LOCAL = {
  ...core.parseContent(LocalContent, {
    archetype: 'local',
    business: { name: '달빛베이커리(예시)', representative: '김예시', bizRegNo: '123-45-67890', address: '서울특별시 마포구 예시로 12, 1층', phone: '02-1234-5678', email: 'hello@example.com', subtype: 'Bakery' },
    hours: [{ day: 'tu', opens: '10:00', closes: '20:00' }],
    menu: [{ name: '우유식빵(예시)', price: 4800 }],
    booking: { primary: { kind: 'tel', value: '02-1234-5678' } },
    mapLinks: { naver: 'https://map.naver.com/p/entry/place/0', kakao: 'https://place.map.kakao.com/0' },
    directions: { transit: '예시역 2번 출구에서 걸어서 3분', parking: '주차 불가' },
    faq: [{ q: '주차되나요?', a: '주차는 안 됩니다(예시).' }],
  }),
  site: core.Site.parse(SITE),
}
const UPDATED = '2026-09-30'

// 화면(같은 객체에서 그린 푸터·메뉴·갱신일). 테스트용 최소 화면이다.
const screen = (c) => renderToStaticMarkup(h('main', null,
  h('h1', null, c.business.name),
  h('ul', null, c.menu.map((m) => h('li', { key: m.name }, `${m.name} ${m.price.toLocaleString('ko-KR')}원`))),
  h(UpdatedAt, { date: UPDATED }),
  h('footer', null, `${c.business.name} · 대표 ${c.business.representative} · 사업자등록번호 ${c.business.bizRegNo} · ${c.business.address} · ${c.business.phone} · ${c.business.email}`),
))
const textOf = (html) => html.replace(/<[^>]+>/g, ' ')

// ① 메타 ─────────────────────────────────────────────────────────────────────
test('seoMetadata: 「제목 | 이름」 한 번, canonical·OG·트위터 절대 주소, OG 1200×630, hreflang 기본 끔, 소유확인은 홈만', () => {
  const m = meta.seoMetadata(LOCAL, { path: '/menu', title: '메뉴', description: '식빵 가격표(예시)', type: 'other' })
  assert.equal(m.title.absolute, '메뉴 | 달빛베이커리(예시)')
  assert.equal([...m.title.absolute].length, 15)
  assert.equal(meta.pageTitle(LOCAL, { path: '/', title: '달빛베이커리(예시) — 동네 식빵', type: 'home' }), '달빛베이커리(예시) — 동네 식빵') // 이름을 두 번 붙이지 않는다
  assert.equal(meta.pageTitle(LOCAL, { path: '/', type: 'home' }), '달빛베이커리(예시)')
  assert.equal(m.alternates.canonical, 'https://bakery.example.com/menu')
  assert.equal(m.alternates.languages, undefined) // §9 Q4: 사이트마다 한 언어
  assert.equal(m.openGraph.images[0].url, 'https://bakery.example.com/opengraph-image')
  assert.deepEqual([m.openGraph.images[0].width, m.openGraph.images[0].height], [1200, 630])
  assert.equal(m.openGraph.locale, 'ko_KR')
  assert.equal(m.twitter.card, 'summary_large_image')
  assert.match(m.twitter.images[0], /^https:\/\//)
  assert.deepEqual(m.robots, { index: true, follow: true })
  assert.equal(m.verification, undefined)
  const home = meta.seoMetadata(LOCAL, { path: '/', type: 'home' })
  assert.deepEqual(home.verification, { google: 'g-token', other: { 'naver-site-verification': 'n-token', 'msvalidate.01': 'b-token' } })
  assert.equal(home.description, SITE.description)
  assert.equal(meta.seoMetadata(LOCAL, { path: '/terms', title: '이용약관', type: 'legal' }).robots.index, true) // 법정 페이지는 noindex 하지 않는다
  const en = meta.seoMetadata({ ...LOCAL, site: { ...LOCAL.site, locale: 'en', hreflang: { ko: 'https://ko.example.com' } } }, { path: '/menu', title: 'Menu', type: 'other', ogImage: '/og/menu.png' })
  assert.deepEqual(en.alternates.languages, { en: 'https://bakery.example.com/menu', ko: 'https://ko.example.com/menu' })
  assert.equal(en.openGraph.locale, 'en_US')
  assert.equal(en.openGraph.images[0].url, 'https://bakery.example.com/og/menu.png')
  assert.throws(() => meta.pageUrl(LOCAL, '//evil.example.com/x'), (e) => HANGUL.test(e.message))
  assert.throws(() => meta.pageUrl(LOCAL, 'menu'), (e) => HANGUL.test(e.message))
})

test('metaIssues: 빈 사실은 「확인 필요」로 나가 오류, 겹치는 제목·설명 오류, 권고보다 긴 설명은 경고(J12)', () => {
  const bare = { archetype: 'saas', site: { url: 'https://x.example.com' } }
  const m = meta.seoMetadata(bare, { path: '/about', type: 'about' })
  assert.equal(m.title.absolute, core.NEEDS_CHECK)
  assert.equal(m.description, core.NEEDS_CHECK)
  const issues = meta.metaIssues(LOCAL, [
    { path: '/', type: 'home' },
    { path: '/a', title: '소개', description: '같은 설명(예시)', type: 'about' },
    { path: '/b', title: '소개', description: '같은 설명(예시)', type: 'other' },
    { path: '/c', title: '긴 설명', description: '가'.repeat(81), type: 'other' },
    { path: '/d', type: 'other' },
  ])
  const at = (p) => issues.filter((i) => i.path === p)
  assert.deepEqual(at('/'), [])
  assert.equal(at('/b').filter((i) => i.level === 'error').length, 2)
  assert.deepEqual(at('/c').map((i) => i.level), ['warn'])
  assert.ok(at('/d').some((i) => i.level === 'error' && i.message.includes(core.NEEDS_CHECK)))
  assert.equal(meta.metaIssues({ ...LOCAL, site: { ...LOCAL.site, locale: 'en' } }, [{ path: '/', type: 'home', description: 'a'.repeat(155) }]).length, 0)
})

// ② JSON-LD ───────────────────────────────────────────────────────────────────
test('jsonLdFor: 홈은 WebSite + LocalBusiness(taxID·sameAs) + WebPage(dateModified = 화면 갱신일), 값은 모두 화면 글자에 있다(X4)', () => {
  const page = { path: '/', type: 'home', title: '달빛베이커리(예시)', updatedAt: UPDATED }
  const ld = geo.jsonLdFor(LOCAL, page)
  assert.deepEqual(ld.map((o) => o['@type']), ['WebSite', 'Bakery', 'WebPage'])
  const biz = ld[1]
  assert.equal(biz.taxID, '123-45-67890')
  assert.deepEqual(biz.sameAs, ['https://pf.kakao.com/_Example'])
  assert.equal(biz.aggregateRating, undefined)
  assert.equal(ld[2].dateModified, UPDATED)
  const html = screen(LOCAL)
  assert.match(html, /<time dateTime="2026-09-30">2026-09-30<\/time>/)
  assert.deepEqual(geo.jsonLdVisibleIssues(ld, textOf(html)), [])
  // 음성 대조: 화면에서 전화번호를 빼면 잡힌다
  const noPhone = textOf(html).replace('02-1234-5678', '')
  assert.deepEqual(geo.jsonLdVisibleIssues(ld, noPhone).map((i) => i.value), ['+82-2-1234-5678'])
  // JSON-LD 이름을 화면과 다르게 바꿔도 잡힌다
  assert.equal(geo.jsonLdVisibleIssues([{ ...biz, name: '다른 가게' }], textOf(html)).length, 1)
})

test('jsonLdFor: 페이지 종류 표 — Organization 은 홈만, FAQPage 기본 끔, 이동 경로는 절대 주소, 원형별 엔티티', () => {
  for (const kind of meta.PAGE_KINDS) assert.ok(geo.JSONLD_BY_PAGE[kind], kind)
  const about = geo.jsonLdFor(LOCAL, { path: '/about', type: 'about', breadcrumb: [{ label: '홈', href: '/' }, { label: '소개', href: '/about' }] })
  assert.deepEqual(about.map((o) => o['@type']), ['BreadcrumbList'])
  assert.equal(about[0].itemListElement[1].item, 'https://bakery.example.com/about')
  const loc = geo.jsonLdFor(LOCAL, { path: '/location', type: 'location' })
  assert.deepEqual(loc.map((o) => o['@type']), ['Bakery'])
  assert.ok(!geo.jsonLdFor(LOCAL, { path: '/', type: 'home' }).some((o) => o['@type'] === 'FAQPage'))
  const faq = geo.jsonLdFor(LOCAL, { path: '/faq', type: 'other', faqPage: true })
  assert.equal(faq[0]['@type'], 'FAQPage')
  const saas = {
    archetype: 'saas', site: { url: 'https://app.example.com', sameAs: [] },
    product: { name: '예시노트', url: 'https://app.example.com', category: 'BusinessApplication', os: 'Web' },
    business: { name: '예시랩(예시)', bizRegNo: '234-56-78901', address: '서울특별시 예시구 1', phone: '02-555-0000' },
    plans: [{ name: '기본', monthlyPrice: 9900, currency: 'KRW', features: [] }],
  }
  assert.deepEqual(geo.jsonLdFor(saas, { path: '/', type: 'home' }).map((o) => o['@type']), ['WebSite', 'Organization', 'SoftwareApplication'])
  assert.equal(geo.jsonLdFor(saas, { path: '/', type: 'home' })[1].taxID, '234-56-78901')
  assert.deepEqual(geo.jsonLdFor(saas, { path: '/pricing', type: 'pricing' }).map((o) => o['@type']), ['SoftwareApplication'])
  // 화면에 가격이 없는 쪽(showsPrice: false — 찍어내기 06 이 가격 블록 유무로 정한다)은 가격(Offer)을 싣지 않는다(P3-3 Task 14b: 요금표 없는 홈의 Offer 가 marketing jsonld-visible 에 떨어졌다)
  assert.deepEqual(geo.jsonLdFor(saas, { path: '/', type: 'home', showsPrice: false }).map((o) => o['@type']), ['WebSite', 'Organization'])
  assert.deepEqual(geo.jsonLdFor(saas, { path: '/pricing', type: 'pricing', showsPrice: true }).map((o) => o['@type']), ['SoftwareApplication'])
  const detail ={ archetype: 'detail', site: { url: 'https://shop.example.com', name: '예시상점' }, product: { name: '예시 텀블러', price: 12900, taxIncluded: true, rating: { avg: 4.5, count: 12 } } }
  const d = geo.jsonLdFor(detail, { path: '/', type: 'home' })
  assert.deepEqual(d.map((o) => o['@type']), ['WebSite', 'Organization', 'Product'])
  assert.equal(d[2].offers.url, 'https://shop.example.com/')
  assert.deepEqual(geo.jsonLdFor(detail, { path: '/', type: 'home', showsPrice: false }).map((o) => o['@type']), ['WebSite', 'Organization'])
  assert.equal(d[2].aggregateRating.reviewCount, 12) // 별점은 Product 에만
  assert.equal(d[1].aggregateRating, undefined)
  assert.deepEqual(geo.jsonLdVisibleIssues([d[2]], '예시 텀블러 12,900원'), [])
  // 통화(ports Money 최소 단위): USD·EUR 은 센트라 Offer.price 는 100 으로 나눈 값, 통화 코드가 함께 나간다 — 없으면 KRW
  assert.deepEqual([d[2].offers.price, d[2].offers.priceCurrency], [12900, 'KRW'])
  const usd = geo.jsonLdFor({ ...detail, product: { ...detail.product, price: 4800, currency: 'USD' } }, { path: '/', type: 'home' })[2]
  assert.deepEqual([usd.offers.price, usd.offers.priceCurrency], [48, 'USD'])
  const jpy = geo.jsonLdFor({ ...detail, product: { ...detail.product, price: 4800, currency: 'JPY' } }, { path: '/', type: 'home' })[2]
  assert.deepEqual([jpy.offers.price, jpy.offers.priceCurrency], [4800, 'JPY'])
  assert.throws(() => geo.jsonLdFor(LOCAL, { path: '/', type: 'home', updatedAt: '2026-02-30' }), (e) => HANGUL.test(e.message))
})

// ③ 갱신일·IndexNow ───────────────────────────────────────────────────────────
test('UpdatedAt 은 실제 날짜만, 영어 사이트는 Updated; pingIndexNow 는 키가 없으면 보내지 않고, 키·주소를 검사해 두 곳에 보낸다', async () => {
  assert.match(renderToStaticMarkup(h(UpdatedAt, { date: UPDATED, locale: 'en' })), /^<p data-updated-at="">Updated <time/)
  assert.throws(() => renderToStaticMarkup(h(UpdatedAt, { date: '2026-13-01' })), (e) => HANGUL.test(e.message))
  const saved = process.env.INDEXNOW_KEY
  delete process.env.INDEXNOW_KEY
  const calls = []
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { status: 202 } }
  assert.deepEqual(await pingIndexNow({ siteUrl: SITE.url, urls: ['/'], fetchImpl }), [])
  const res = await pingIndexNow({ siteUrl: SITE.url, urls: ['/', '/menu', '/'], key: 'abcd1234-ef', fetchImpl })
  assert.deepEqual(res.map((r) => r.status), [202, 202])
  assert.deepEqual(calls.map((c) => c.url), ['https://api.indexnow.org/indexnow', 'https://searchadvisor.naver.com/indexnow'])
  assert.deepEqual(JSON.parse(calls[0].init.body), { host: 'bakery.example.com', key: 'abcd1234-ef', urlList: ['https://bakery.example.com/', 'https://bakery.example.com/menu'] })
  await assert.rejects(pingIndexNow({ siteUrl: SITE.url, urls: ['/'], key: 'short', fetchImpl }), (e) => HANGUL.test(e.message) && !e.message.includes('short'))
  await assert.rejects(pingIndexNow({ siteUrl: SITE.url, urls: ['https://other.example.com/'], key: 'abcd1234', fetchImpl }), (e) => /같은 사이트/.test(e.message))
  if (saved !== undefined) process.env.INDEXNOW_KEY = saved
})

// ④ robots·sitemap ────────────────────────────────────────────────────────────
const FILES = { siteUrl: SITE.url, name: '달빛베이커리(예시)', summary: '동네 식빵집(예시)', pages: [{ url: '/', title: '홈', lastModified: UPDATED, images: ['/img/bread.jpg'] }, { url: '/menu', title: '메뉴' }] }
const groupOf = (robots, bot) => {
  const ls = robots.split('\n')
  let j = ls.indexOf(`User-agent: ${bot}`)
  assert.ok(j >= 0, bot)
  while (ls[j].startsWith('User-agent:')) j++
  return ls[j]
}

test('robots 기본값: 검색 봇(Googlebot·Bingbot·Yeti)·AI 검색 봇·사용자 요청 봇 허용, 학습 봇만 따로 막을 수 있다; llms.txt 기본 끔', () => {
  const { robots, llmsTxt } = seo.seoFiles(FILES)
  for (const bot of ['*', 'Googlebot', 'Bingbot', 'Yeti', 'Daum', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'ChatGPT-User', 'Claude-User', 'Perplexity-User', 'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'])
    assert.equal(groupOf(robots, bot), 'Allow: /', bot)
  const shut = seo.seoFiles(FILES, { ai: { training: false } }).robots
  for (const bot of seo.AI_BOTS.training) assert.equal(groupOf(shut, bot), 'Disallow: /', bot)
  for (const bot of [...seo.SEARCH_BOTS, ...seo.AI_BOTS.search, ...seo.AI_BOTS.user]) assert.equal(groupOf(shut, bot), 'Allow: /', bot)
  assert.equal(llmsTxt, null)
  assert.match(seo.seoFiles(FILES, { llms: true }).llmsTxt, /^# 달빛베이커리\(예시\)/)
})

test('sitemap: lastmod(갱신일 하나에서), 이미지 사이트맵은 이미지가 있을 때만 이름공간과 함께', () => {
  const x = seo.seoFiles(FILES).sitemap()
  assert.match(x, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9" xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1">/)
  assert.match(x, /<loc>https:\/\/bakery\.example\.com\/<\/loc><lastmod>2026-09-30<\/lastmod><image:image><image:loc>https:\/\/bakery\.example\.com\/img\/bread\.jpg<\/image:loc><\/image:image><\/url>/)
  assert.doesNotMatch(seo.seoFiles({ ...FILES, pages: [{ url: '/', title: '홈' }] }).sitemap(), /xmlns:image/)
  assert.throws(() => seo.seoFiles(FILES).sitemap([{ url: '/', title: 'x', images: ['javascript:alert(1)'] }]), (e) => HANGUL.test(e.message))
})

// ⑤ 파비콘 ──────────────────────────────────────────────────────────────────────
const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" fill="currentColor"/></svg>'
const OUT = join(root, '.tmp', 'seo-test', 'favicons')

test('파비콘: 파일 목록·픽셀 크기·ICO 16/32·maskable 안전 영역·다크 SVG·매니페스트·theme-color', async () => {
  rmSync(OUT, { recursive: true, force: true })
  const written = await genFavicons({ svg: MARK, color: 'oklch(0.2662 0.0251 244.06)', darkColor: '#f0f0f0', background: '#ffffff', out: OUT })
  assert.deepEqual(written.map((w) => w.path), ['app/icon.svg', 'app/favicon.ico', 'app/apple-icon.png', 'public/icon-192.png', 'public/icon-512.png', 'public/icon-maskable-512.png'])
  for (const [p, size] of [['app/apple-icon.png', 180], ['public/icon-192.png', 192], ['public/icon-512.png', 512], ['public/icon-maskable-512.png', 512]]) {
    const m = await sharp(join(OUT, p)).metadata()
    assert.deepEqual([m.format, m.width, m.height], ['png', size, size], p)
  }
  // ICO: 머리(형식 1, 2장) + PNG 두 장 16·32
  const ico = readFileSync(join(OUT, 'app/favicon.ico'))
  assert.deepEqual([ico.readUInt16LE(2), ico.readUInt16LE(4)], [1, 2])
  const sizes = []
  for (let i = 0; i < 2; i++) {
    const [len, off] = [ico.readUInt32LE(6 + 16 * i + 8), ico.readUInt32LE(6 + 16 * i + 12)]
    const m = await sharp(ico.subarray(off, off + len)).metadata()
    assert.equal(ico[6 + 16 * i], m.width)
    sizes.push(m.width)
  }
  assert.deepEqual(sizes, [16, 32])
  // 표지 색 = 레시피 색(oklch → hex), 192 는 가득 칠한 사각형이라 가운데 픽셀이 그 색
  const hex = toHex('oklch(0.2662 0.0251 244.06)')
  const { data: px } = await sharp(join(OUT, 'public/icon-192.png')).extract({ left: 96, top: 96, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true })
  assert.equal('#' + [...px.subarray(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join(''), hex)
  // maskable: 바탕(흰색)과 다른 픽셀은 모두 가운데 원(반지름 40%) 안에 있다 — 음성 대조로 any 512 는 밖에도 있다
  const outside = async (p) => {
    const { data, info } = await sharp(join(OUT, p)).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true })
    const r = MASKABLE_SAFE_RADIUS * info.width, c = info.width / 2
    let n = 0, ink = 0
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels
      if (data[i] + data[i + 1] + data[i + 2] < 700) { ink++; if (Math.hypot(x + 0.5 - c, y + 0.5 - c) > r) n++ }
    }
    return { n, ink }
  }
  const mk = await outside('public/icon-maskable-512.png')
  assert.ok(mk.ink > 10000, `표지가 그려져야 한다: ${mk.ink}`)
  assert.equal(mk.n, 0)
  assert.ok((await outside('public/icon-512.png')).n > 0)
  // 다크 대응 SVG
  const svg = readFileSync(join(OUT, 'app/icon.svg'), 'utf8')
  assert.match(svg, /@media \(prefers-color-scheme: dark\)\{svg\{color:#f0f0f0\}\}/)
  assert.ok(svg.includes(`svg{color:${hex}}`))
  assert.deepEqual(manifestIcons(faviconSet(MARK, { color: '#000', darkColor: '#fff' })), [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ])
  assert.deepEqual(themeColor('#fff', 'oklch(0 0 0)').themeColor, [{ media: '(prefers-color-scheme: light)', color: '#ffffff' }, { media: '(prefers-color-scheme: dark)', color: '#000000' }])
  for (const bad of ['<svg viewBox="0 0 1 1"><script>x</script><path fill="currentColor"/></svg>', '<svg viewBox="0 0 1 1"><image href="https://x.example.com/a.png" fill="currentColor"/></svg>', '<svg viewBox="0 0 1 1"><path fill="#000"/></svg>', '<svg><path fill="currentColor"/></svg>'])
    assert.throws(() => faviconSet(bad, { color: '#000', darkColor: '#fff' }), (e) => HANGUL.test(e.message), bad)
  assert.equal(packIco([{ size: 256, data: Buffer.from([1]) }])[6], 0) // 256 은 0 으로 적는다
})

// ⑥ OG 이미지 ───────────────────────────────────────────────────────────────────
test('og-image: 1200×630 PNG, 한글을 키트 서체(Pretendard)로 그린다 — 두 글자가 서로 다른 모양, 레시피 oklch 색', async () => {
  const font = await readOgFont()
  const colors = { background: 'oklch(0.2197 0.0360 255.94)', foreground: '#ffffff', accent: 'oklch(0.5102 0.1145 46.26)' }
  const render = async (title) => {
    const buf = Buffer.from(await ogImage({ title, name: '달빛베이커리(예시)', colors, fonts: [font] }).arrayBuffer())
    return sharp(buf).raw().toBuffer({ resolveWithObject: true })
  }
  const a = await render('가'), b = await render('힣')
  assert.deepEqual([a.info.width, a.info.height], [1200, 630])
  assert.equal('#' + [...a.data.subarray(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join(''), toHex(colors.background))
  // 제목 줄(아래쪽)에 흰 글자 픽셀이 있고, 두 글자 그림이 다르다(글자 없음 네모면 같다)
  const inkRows = (img) => { let n = 0; for (let i = img.info.width * 400 * 4; i < img.data.length; i += 4) if (img.data[i] > 200 && img.data[i + 1] > 200) n++; return n }
  assert.ok(inkRows(a) > 500 && inkRows(b) > 500, `${inkRows(a)} ${inkRows(b)}`)
  assert.notDeepEqual(a.data.subarray(1200 * 400 * 4), b.data.subarray(1200 * 400 * 4))
  await assert.rejects(readOgFont('node_modules/없는/서체.otf'), (e) => HANGUL.test(e.message))
  assert.throws(() => ogImage({ title: 'x', name: 'y', colors, fonts: [] }), (e) => HANGUL.test(e.message))
})

// ⑤ 빈 사실 자리 표시(P3-3 Task 9 · 대장 C102) — JSON-LD 에는 그 칸을 싣지 않는다(X4) ────────────────────────
test('C102: 자리 표시 전화·사업자번호·메일을 스키마가 받고, JSON-LD 는 그 칸을 뺀다(던지지 않는다)', () => {
  assert.equal(core.NEEDS_CHECK_EN, 'To be confirmed')
  for (const v of [core.NEEDS_CHECK, core.NEEDS_CHECK_EN, ` ${core.NEEDS_CHECK} `]) assert.equal(core.isNeedsCheck(v), true, v)
  for (const v of ['', '확인', 'to be confirmed?', undefined, 0]) assert.equal(core.isNeedsCheck(v), false, String(v))
  for (const ph of [core.NEEDS_CHECK, core.NEEDS_CHECK_EN]) {
    assert.ok(core.Phone.safeParse(ph).success, `Phone ${ph}`)
    assert.ok(core.Business.shape.bizRegNo.safeParse(ph).success, `bizRegNo ${ph}`)
    assert.ok(core.Business.shape.email.safeParse(ph).success, `email ${ph}`)
  }
  // 음성 대조: 형식이 틀린 값은 여전히 떨어진다(자리 표시만 예외)
  assert.equal(core.Phone.safeParse('확인').success, false)
  assert.equal(core.Business.shape.bizRegNo.safeParse('12345').success, false)
  assert.equal(core.Business.shape.email.safeParse('not-an-email').success, false)

  const blank = core.parseContent(LocalContent, {
    archetype: 'local',
    business: { name: '달빛베이커리(예시)', bizRegNo: core.NEEDS_CHECK, address: '서울특별시 마포구 예시로 12, 1층', phone: core.NEEDS_CHECK, email: core.NEEDS_CHECK },
    hours: [{ day: 'tu', opens: '10:00', closes: '20:00' }],
    menu: [{ name: '우유식빵(예시)', price: 4800 }],
    booking: { primary: { kind: 'tel', value: '02-1234-5678' } },
    mapLinks: { naver: 'https://map.naver.com/p/entry/place/0', kakao: 'https://place.map.kakao.com/0' },
    directions: { transit: '예시역 2번 출구에서 걸어서 3분', parking: '주차 불가' },
    branches: [{ name: '본점(예시)', url: 'https://bakery.example.com/main', address: '서울특별시 마포구 예시로 12', todayHours: '10:00~20:00', telephone: core.NEEDS_CHECK, naverMapUrl: 'https://map.naver.com/p/entry/place/1', kakaoMapUrl: 'https://place.map.kakao.com/1' }],
  })
  const ld = geo.jsonLdFor({ ...blank, site: core.Site.parse(SITE) }, { path: '/', type: 'home', title: '달빛베이커리(예시)', updatedAt: UPDATED })
  const text = JSON.stringify(ld)
  for (const ph of [core.NEEDS_CHECK, core.NEEDS_CHECK_EN]) assert.equal(text.includes(ph), false, `JSON-LD 에 ${ph} 가 남았다`)
  const biz = ld.find((o) => o['@type'] === 'LocalBusiness')
  assert.ok(biz, 'LocalBusiness 엔티티는 남는다')
  for (const k of ['telephone', 'taxID', 'email']) assert.equal(k in biz, false, `${k} 는 빠진다`)
  assert.equal(biz.name, '달빛베이커리(예시)')
  // 이름이 자리 표시면 엔티티째 뺀다(WebSite)
  const noName = geo.jsonLdFor({ ...blank, business: { ...blank.business, name: core.NEEDS_CHECK }, site: core.Site.parse({ ...SITE }) }, { path: '/', type: 'home', title: 't', updatedAt: UPDATED })
  assert.equal(JSON.stringify(noName).includes(core.NEEDS_CHECK), false)
  assert.equal(noName.some((o) => o['@type'] === 'WebSite'), false, '이름 없는 WebSite 는 싣지 않는다')
})
