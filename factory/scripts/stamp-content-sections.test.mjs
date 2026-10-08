// 본문 섹션 렌더러(대장 C70, 레인 CONTENT) — 원형 noBlock.mode content·part 섹션을 06 이 그린다.
//   ① 묶기(순수): 렌더러마다 콘텐츠 $ref 로 props 를 만들고(값은 콘텐츠에서만), 자료가 없으면 그리지 않고 까닭을 돌려준다.
//   ② 렌더(서버 렌더): 렌더러 9종이 묶은 값을 그린다 — h2(h1 없음)·data-numeric·첫 섹션 keep·「실제 사진 필요」 틀. 예시(fixture) 셋도 그려진다.
//   ③ 06 통합: brand·public·pwa·portfolio 를 찍어 그린 섹션·「자료 연결 안 됨 … (본문)」·「실제 사진 필요」 줄과 예시 문구 0·콘텐츠 값 중복 0 을 본다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-content-sections.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { bindContentSection, CONTENT_RENDERERS, CONTENT_UI, rendererBlock } from '../stamp/content-sections.mjs'
import { BLOCKER, duplicateProblems } from '../stamp/gen-pages.mjs'
import { resolveRefs, leaves, refsOf } from '../stamp/site-bind.mjs'
import { PLACEHOLDER } from '../stamp/content.mjs'
import { loadBlockIndex } from './archetypes.mjs'
import { root, archetypes, text, makeRun, gen } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'stamp-content-sections-test')
const siteOf = (s) => JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
const specOf = (arch, key) => { const [p, k] = key.split('/'); return archetypes[arch].pages.find((x) => x.id === p).sections.find((x) => x.kind === k).noBlock }

// ── ① 묶기(순수) ─────────────────────────────────────────────────────────
const SITEMAP = { pages: [{ id: 'home', route: '/', sections: [] }, { id: 'about', route: '/about', sections: [] }, { id: 'case-study', route: '/work', sections: [] }, { id: 'privacy', route: '/privacy', legal: true, sections: [] }, { id: 'terms', route: '/terms', legal: true, sections: [] }] }
const ROUTES = Object.fromEntries(SITEMAP.pages.map((p) => [p.id, p.route]))
function bind(arch, key, content, { copyIndex = new Map(), first = false, now, locale = 'ko', pageTitleOf = (id) => `쪽:${id}` } = {}) {
  const nb = specOf(arch, key)
  return bindContentSection({ key, pageId: key.split('/')[0], render: nb.render, missing: nb.missing, content, copyIndex, routes: ROUTES, locale, sitemap: SITEMAP, pageTitleOf, first, now })
}
const resolved = (r, content) => resolveRefs(r.props, content)

test('원형의 본문·부품 섹션 51곳은 모두 render(렌더러가 블록으로 있다) 또는 missing 하나다 — 렌더러 9종은 block-content-<as> 블록이다', () => {
  const { names } = loadBlockIndex()
  for (const as of CONTENT_RENDERERS) assert.ok(names.has(rendererBlock(as)), as)
  let n = 0
  for (const a of Object.values(archetypes)) for (const p of a.pages) for (const s of p.sections) if (s.noBlock && s.noBlock.mode !== 'pending') {
    n++
    assert.equal(!!s.noBlock.render !== !!s.noBlock.missing, true, `${a.id}/${p.id}/${s.kind}`)
    if (s.noBlock.render) assert.ok(names.has(rendererBlock(s.noBlock.render.as)), `${a.id}/${p.id}/${s.kind}`)
  }
  assert.equal(n, 51) // FV1 Task 5.9: 쪽 나누기(dashboard admin-list/pagination)가 pending 에서 part(목록 표가 그린다)로 와 하나 늘었다
})

test('prose: 문구 칸 → $ref 문단(값은 콘텐츠에서), 다른 쪽 같은 섹션 칸(slot:<섹션>/<칸>)도 — 칸이 없거나 「확인 필요」면 그리지 않는다', () => {
  const content = { slots: { copy: [{ id: 'mission', text: '오래된 한옥을 고쳐 사람이 머물게 해요' }, { id: 'summary', text: PLACEHOLDER.ko }] } }
  const copyIndex = new Map([['home/mission/mission#0', 0], ['about/summary/summary#0', 1]])
  const r = bind('brand', 'home/mission', content, { copyIndex, first: true })
  assert.equal(r.block, 'block-content-prose')
  assert.deepEqual(r.props.paragraphs, [{ $ref: 'slots.copy.0.text' }])
  assert.equal(r.props.first, true)
  assert.equal(r.props.copy.title, '미션')
  assert.deepEqual(resolved(r, content).paragraphs, ['오래된 한옥을 고쳐 사람이 머물게 해요'])
  assert.deepEqual(bind('brand', 'about/mission', content, { copyIndex }).props.paragraphs, [{ $ref: 'slots.copy.0.text' }], '회사소개 미션은 홈 미션 문구')
  assert.ok(bind('brand', 'about/summary', content, { copyIndex }).why, '「확인 필요」만 있으면 그리지 않는다')
  assert.ok(bind('brand', 'home/mission', { slots: { copy: [] } }).why)
})

test('list: 날짜 내림차순·개수 제한·첫 값은 서식 붙은 날짜 — 자료가 없으면 why, 변경 기록은 90일 넘으면 섹션을 뺀다(omit, blocker 아님)', () => {
  const news = Array.from({ length: 7 }, (_, i) => ({ date: `2026-0${i + 1}-15`, title: `소식 ${i + 1}`, url: `https://news.kr/${i}` }))
  const r = bind('brand', 'home/news', { news })
  assert.equal(r.block, 'block-content-list')
  assert.equal(r.props.items.length, 5)
  assert.deepEqual(r.props.items[0].meta, [{ value: { $ref: 'news.6.date' }, format: 'date' }])
  assert.deepEqual(resolved(r, { news }).items.map((x) => x.title), ['소식 7', '소식 6', '소식 5', '소식 4', '소식 3'])
  assert.match(bind('brand', 'home/news', { news: [] }).why, /목록 자료/)
  const changelog = [{ date: '2026-01-02', title: '새 달력', url: '/changelog' }]
  const old = bind('saas', 'home/changelog', { changelog }, { now: Date.parse('2026-10-01T00:00:00Z') })
  assert.equal(old.omit, true)
  assert.ok(bind('saas', 'home/changelog', { changelog }, { now: Date.parse('2026-02-01T00:00:00Z') }).props)
})

test('cards: 실사 필수 사진 칸에 src 가 없으면 photos 에 칸 경로(→ 「실제 사진 필요」) — src 가 있으면 없다', () => {
  const leaders = [{ name: '윤도현', title: '대표', bio: '한옥을 고쳐 왔어요', portrait: { id: 'portrait', aspect: '4:5', source: 'real-required', alt: '윤도현 대표' } }]
  const r = bind('brand', 'about/leadership', { leaders })
  assert.equal(r.block, 'block-content-cards')
  assert.deepEqual(r.photos, ['about/leadership/portrait'])
  assert.deepEqual(r.props.items[0], { title: { $ref: 'leaders.0.name' }, meta: [{ value: { $ref: 'leaders.0.title' } }], summary: { $ref: 'leaders.0.bio' }, image: { $ref: 'leaders.0.portrait' } })
  const withSrc = [{ ...leaders[0], portrait: { ...leaders[0].portrait, src: '/media/a.jpg' } }]
  assert.deepEqual(bind('brand', 'about/leadership', { leaders: withSrc }).photos, [])
})

test('facts: 줄마다 첫 출처(사례 본문 → 문구 칸), 금액·일수 서식 — 빈 줄은 빼고 모두 비면 why', () => {
  const shipping = { fee: 3000, freeThreshold: 50000, courier: '한진택배', leadDays: 2 }
  const r = bind('commerce', 'home/shipping-pickup-info', { shipping })
  assert.equal(r.block, 'block-content-facts')
  assert.deepEqual(r.props.rows.map((x) => x.label), ['배송비', '무료배송 기준', '택배사', '출고'])
  assert.deepEqual(r.props.rows[0].value, { value: { $ref: 'shipping.fee' }, format: 'money', currency: 'KRW' })
  assert.deepEqual(r.props.rows[3].value, { value: { $ref: 'shipping.leadDays' }, format: 'days' })
  const noFree = bind('commerce', 'home/shipping-pickup-info', { shipping: { fee: 3000, courier: 'CJ', leadDays: 1 } })
  assert.equal(noFree.props.rows.length, 3)
  const copyIndex = new Map([['case-study/case-meta/client#0', 0], ['case-study/case-meta/year#0', 1]])
  const meta = bind('portfolio', 'case-study/case-meta', { slots: { copy: [{ id: 'client', text: '시장 상인회' }, { id: 'year', text: '2025' }] } }, { copyIndex })
  assert.deepEqual(meta.props.rows.map((x) => x.label), ['의뢰인', '연도'])
  const cs = bind('portfolio', 'case-study/case-meta', { caseStudies: [{ meta: { client: '출판사', services: ['촬영'], year: 2024, role: '촬영' } }] })
  assert.deepEqual(cs.props.rows[0].value.value, { $ref: 'caseStudies.0.meta.client' }, '구조 자료가 문구 칸보다 먼저')
  assert.ok(bind('commerce', 'home/shipping-pickup-info', {}).why)
  const origin = bind('commerce', 'home/origin-info', { products: [{ name: '원두', origin: '에티오피아' }, { name: '드립백' }] })
  assert.deepEqual(origin.props.rows, [{ label: { $ref: 'products.0.name' }, value: { value: { $ref: 'products.0.origin' } } }])
})

test('links: 콘텐츠 주소(채용)·콘텐츠 배열(바로가기)·사이트맵(법정 쪽·쪽 메뉴 aria-current·쪽 앵커) — 주소가 없으면 why', () => {
  assert.deepEqual(bind('brand', 'home/careers', { careersUrl: 'https://jobs.kr' }).props.links, [{ label: '채용 공고 보기', href: { $ref: 'careersUrl' } }])
  assert.ok(bind('brand', 'home/careers', {}).why)
  const q = bind('public', 'main/quick-links', { quickLinks: [{ label: '민원 신청', href: '/guide' }] })
  assert.deepEqual(q.props.links, [{ label: { $ref: 'quickLinks.0.label' }, href: { $ref: 'quickLinks.0.href' } }])
  assert.deepEqual(bind('pwa', 'settings/utility-links', {}).props.links.map((l) => l.href), ['/privacy', '/terms'])
  const menu = bind('public', 'sub/side-menu', {}, { pageTitleOf: (id) => (id === 'about' ? { $ref: 'slots.copy.3.text' } : id) })
  assert.equal(menu.props.mode, 'menu')
  assert.deepEqual(menu.props.links.map((l) => l.href), ['/', '/about', '/work'])
  assert.deepEqual(menu.props.links[1].label, { $ref: 'slots.copy.3.text' })
  assert.deepEqual(bind('portfolio', 'case-study/next-work', {}).props.links, [{ label: '다른 작업 보기', href: '/#work-grid' }])
})

test('gallery·timeline·breadcrumb·skeleton — 상세 조각은 $ref 로 그림 모양을 짓고, 연혁은 연도 오름차순', () => {
  const slices = [{ src: '/s/1.jpg', width: 860, height: 1100, altText: '첫 조각 글' }]
  const g = bind('detail', 'product-detail/story', { slices })
  assert.equal(g.props.mode, 'stack')
  assert.deepEqual(g.props.images, [{ src: { $ref: 'slices.0.src' }, alt: { $ref: 'slices.0.altText' }, width: { $ref: 'slices.0.width' }, height: { $ref: 'slices.0.height' }, source: 'real-required' }])
  const sp = bind('local', 'home/gallery', { slots: { images: [{ id: 'space', aspect: '4:3', source: 'real-required', alt: '창가' }] } })
  assert.deepEqual(sp.props.images, [{ $ref: 'slots.images.0' }])
  assert.deepEqual(sp.photos, ['home/gallery/space'])
  const t = bind('brand', 'about/history', { history: [{ year: 2021, event: '나' }, { year: 2019, event: '가' }] })
  assert.deepEqual(t.props.entries, [{ when: { value: { $ref: 'history.1.year' }, format: 'year' }, text: { $ref: 'history.1.event' } }, { when: { value: { $ref: 'history.0.year' }, format: 'year' }, text: { $ref: 'history.0.event' } }])
  const b = bind('public', 'sub/breadcrumb', {}, { pageTitleOf: () => ({ $ref: 'slots.copy.0.text' }) })
  assert.deepEqual(b.props.trail, [{ label: '홈', href: '/' }, { label: { $ref: 'slots.copy.0.text' } }])
  assert.equal(bind('pwa', 'home/skeleton', {}).block, 'block-content-skeleton')
})

test('missing 섹션은 까닭(스키마에 없는 자료)을 그대로 돌려준다 — 렌더러를 부르지 않는다', () => {
  for (const [arch, key] of [['portfolio', 'home/news'], ['commerce', 'home/brand-story']]) {
    const r = bind(arch, key, {})
    assert.equal(r.props, undefined)
    assert.equal(r.why, specOf(arch, key).missing)
  }
  // QFIX [3]: pwa 앱 안내 글·public 하위 쪽 본문은 칸이 생겨 그리는 법(render)을 가진다 — 사실이 없으면 자료 없음 까닭이 나온다
  for (const [arch, key] of [['pwa', 'home/primary-content'], ['pwa', 'sub-detail/detail-content'], ['pwa', 'completion/result'], ['public', 'sub/content']]) {
    assert.equal(specOf(arch, key).missing, undefined, key)
    const r = bind(arch, key, {})
    assert.equal(r.props, undefined, key)
    assert.match(r.why, /콘텐츠에 없다/, key)
  }
})

// ── ② 서버 렌더 ──────────────────────────────────────────────────────────
const OUT = join(TMP, 'ssr')
const loaded = new Map()
function transpile(abs) {
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(src.endsWith('.mjs') ? src : transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const pascal = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')
const renderer = async (as) => (await import(pathToFileURL(transpile(join(root, 'registry', 'factory', 'blocks', 'content', `${as}.tsx`))).href))[`Content${pascal(as)}`]
const html = async (as, props) => renderToStaticMarkup(React.createElement(await renderer(as), props))

test('렌더러 9종: 예시(fixture·Max·Min)가 모두 그려지고 h1 이 없다 — 루트 data-block', async () => {
  for (const as of CONTENT_RENDERERS) {
    const fx = await import(pathToFileURL(transpile(join(root, 'registry', 'factory', 'blocks', 'content', `${as}.fixture.ts`))).href)
    for (const k of ['fixture', 'fixtureMax', 'fixtureMin']) {
      const out = await html(as, fx[k])
      assert.ok(out.includes(`data-block="content-${as}"`), `${as} ${k}`)
      assert.equal(/<h1[\s>]/.test(out), false, `${as} ${k}: h1 없음`)
    }
  }
})

test('렌더: 묶은 값이 그대로 나온다 — 날짜·금액·연도는 data-numeric, 첫 섹션은 data-enter="keep", 빈 사진 칸은 「실제 사진 필요」 틀', async () => {
  const content = {
    news: [{ date: '2026-09-18', title: '가을 찻자리 예약', url: 'https://news.kr/1' }],
    shipping: { fee: 3000, freeThreshold: 50000, courier: '한진택배', leadDays: 2 },
    leaders: [{ name: '윤도현', title: '대표', bio: '한옥을 고쳐 왔어요', portrait: { id: 'portrait', aspect: '4:5', source: 'real-required', alt: '윤도현 대표' } }],
  }
  const list = await html('list', resolved(bind('brand', 'home/news', content, { first: true }), content))
  assert.match(list, /<h2 [^>]*>소식<\/h2>/)
  assert.match(list, /<time datetime="2026-09-18" data-numeric="true">2026년 9월 18일<\/time>/i)
  assert.match(list, /data-enter="keep"/)
  const facts = await html('facts', resolved(bind('commerce', 'home/shipping-pickup-info', content), content))
  assert.match(facts, /<dt[^>]*>배송비<\/dt><dd[^>]*><span data-numeric="true">3,000원<\/span>/)
  assert.match(facts, /2영업일/)
  assert.equal(/data-enter="keep"/.test(facts), false, '첫 섹션이 아니면 장면이 올린다')
  const cards = await html('cards', resolved(bind('brand', 'about/leadership', content), content))
  assert.match(cards, /aria-label="윤도현 대표 — 실제 사진 필요"/)
  assert.match(cards, /data-photo-needed=""/)
  const en = await html('list', resolved(bind('brand', 'home/news', content, { locale: 'en' }), content))
  assert.match(en, /September 18, 2026/)
  assert.match(en, />News</)
})

// ── ③ 06 통합 ────────────────────────────────────────────────────────────
const contentFrom = (archetype, request, extra) => {
  const { facts, ...seed } = request.seedContent
  return { archetype, locale: request.locale, ...seed, ...extra, facts: { ...facts }, slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: text(s, PLACEHOLDER.ko) })), images: [] } }
}
const contentBlockers = (s, key) => s.blockers.filter((b) => b.includes(` ${key} `) || b.endsWith(key) || b.includes(`${key}/`) || b.includes(`${key} (`))

test('06 통합(brand): 자료가 있는 본문 섹션은 그리고(연혁·리더십·소식·채용·요약), 없는 것은 「자료 연결 안 됨 … (본문)」 — 예시 문구 0·콘텐츠 값 중복 0', async () => {
  const brief = { topic: '한옥 찻집 브랜드', archetype: 'brand', locale: 'ko', facts: { name: '솔결재', legalName: '주식회사 솔결재', representative: '윤도현', bizNo: '123-45-67890', email: 'hello@solgyeol.kr', address: '전북 전주시 완산구 솔길 45', phone: '063-123-4567', history: '2019년 문을 열었어요', leadership: '대표 윤도현', mission: '한옥에 사람이 머물게' } }
  const R = await makeRun(TMP, brief, (request) => contentFrom('brand', request, {
    organization: { ...request.seedContent.organization, url: 'https://solgyeol.kr' },
    tagline: '한옥에서 차 한 잔',
    news: [{ date: '2026-09-18', title: '가을 찻자리 예약을 받아요', url: 'https://solgyeol.kr/news/1' }, { date: '2026-08-02', title: '마루를 고쳤어요', url: 'https://solgyeol.kr/news/2' }],
    history: [{ year: 2019, event: '한옥 찻집의 문을 열었어요' }, { year: 2023, event: '스테이 방 두 칸을 열었어요' }],
    leaders: [{ name: '윤도현', title: '대표', bio: '한옥을 고쳐 왔어요', portrait: { id: 'portrait', aspect: '4:5', source: 'real-required', alt: '윤도현 대표' } }],
    careersUrl: 'https://solgyeol.kr/careers',
  }))
  const s = await gen(R)
  const site = siteOf(s)
  for (const k of ['home/news', 'home/careers', 'about/summary', 'about/history', 'about/leadership', 'news/press-list', 'careers/job-list']) {
    assert.ok(s.sections.includes(k), `${k} 그림\n${s.blockers.join('\n')}`)
    assert.match(site.sections[k].block, /^block-content-/)
  }
  // 리더십 사진 칸은 실사 필수인데 src 가 없다 → 「실제 사진 필요」
  assert.ok(s.blockers.includes(`${BLOCKER.photo}about/leadership/portrait`), s.blockers.join('\n'))
  // 예시 문구·콘텐츠 값 중복 없음(값은 $ref 로만 들어간다)
  assert.deepEqual(s.blockers.filter((b) => b.startsWith(BLOCKER.example)), [])
  assert.deepEqual(duplicateProblems(s.siteDir), [])
  for (const k of s.sections.filter((x) => site.sections[x].block.startsWith('block-content-'))) {
    assert.ok(refsOf(site.sections[k].props).size > 0 || /breadcrumb|skeleton|links/.test(site.sections[k].block), `${k}: 값은 $ref`)
    for (const l of leaves(site.sections[k].props).filter((x) => x.ref === null && typeof x.value === 'string')) assert.equal(/예시|\(example\)/.test(l.value), false, `${k}.${l.path}`)
  }
  // 회사소개 쪽은 히어로가 없다 — 첫 본문 섹션(요약)이 keep, 쪽 제목은 쪽 이름표(본문 머리 「회사 요약」이 아니다)
  assert.equal(site.sections['about/summary'].props.first, true)
  assert.equal(site.pages['/about'].title, '소개')
  const about = readFileSync(join(s.siteDir, 'app', 'about', 'page.tsx'), 'utf8')
  assert.match(about, /data-wf-first="" className="contents">\s*<AboutSummary /, '본문 섹션이 쪽의 첫 섹션이어도 첫 화면 구획에 든다')
  // 잎 파일이 렌더러 블록을 부른다
  assert.match(readFileSync(join(s.siteDir, 'components', 'site', 'about-history.tsx'), 'utf8'), /from "@\/components\/blocks\/content\/timeline"/)
})

test('06 통합(public·pwa·portfolio): 부품 섹션(경로·하위 메뉴·뼈대)을 그리고, 스키마에 자료가 없는 섹션은 그 까닭으로 「자료 연결 안 됨」 — 쪽 제목은 본문 h1 칸', async () => {
  const pub = { topic: '구립 도서관', archetype: 'public', locale: 'ko', facts: { name: '해오름구립도서관', address: '서울특별시 해오름구 도서관로 100', phone: '02-1234-5678', email: 'lib@haeoreum.go.kr' } }
  const R = await makeRun(TMP, pub, (request) => contentFrom('public', request, {
    decision: { krds_scope: { agencyType: 'local-gov', level: 'standard', officialBanner: false, identifier: false } },
    agency: { name: '해오름구립도서관', address: '서울특별시 해오름구 도서관로 100', mainPhone: '02-1234-5678', phoneNote: '평일 9시부터 18시까지, 통화료는 거는 분이 내요', privacyPolicyUrl: '/privacy', accessibilityPolicyUrl: '/accessibility', copyright: '해오름구립도서관' },
    quickLinks: [{ label: '이용 안내 보기', href: '/guide' }, { label: '전화로 문의하기', href: 'tel:02-1234-5678' }],
    notices: [{ date: '2026-09-20', category: '휴관', title: '추석 연휴에 쉬어요', department: '운영팀', url: '/guide' }],
  }))
  const s = await gen(R)
  const site = siteOf(s)
  for (const k of ['main/news-tabs', 'sub/breadcrumb', 'sub/side-menu']) assert.ok(s.sections.includes(k), `${k}\n${s.blockers.join('\n')}`)
  // 바로가기는 한 곳에서만 그린다(C299): 히어로의 「자주 찾는 서비스」 칸이 콘텐츠 바로가기를 그리면 본문 바로가기 섹션은 되풀이하지 않고, 아니면 본문 섹션이 그린다
  const heroLinks = [...refsOf(site.sections['main/hero'].props)].some((r) => r.startsWith('quickLinks.'))
  assert.equal(s.sections.includes('main/quick-links'), !heroLinks, `바로가기를 그린 곳이 하나여야 한다 — hero ${heroLinks}\n${s.blockers.join('\n')}`)
  assert.equal(s.blockers.some((b) => /main\/quick-links/.test(b)), false, '그리든 합치든 blocker 가 없다')
  // QFIX [3]: 하위 쪽 본문은 subBody 사실이 있어야 그린다 — 이 콘텐츠는 사실이 없어 「자료 연결 안 됨」
  assert.ok(s.blockers.some((b) => b.startsWith(`${BLOCKER.unbound}sub/content (본문) — `)), s.blockers.join('\n'))
  assert.equal(s.blockers.some((b) => b.startsWith(`${BLOCKER.undrawn}sub/`)), false, '「자료 연결 안 됨」과 겹쳐 적지 않는다')
  const h1 = R.request.slots.findIndex((x) => x.path === 'sub/content/h1')
  assert.deepEqual(site.pages['/guide'].title, { $ref: `slots.copy.${h1}.text` }, '서브 쪽 제목 = 본문 h1 칸')
  assert.deepEqual(site.sections['sub/breadcrumb'].props.trail[1].label, { $ref: `slots.copy.${h1}.text` })
  assert.deepEqual(s.blockers.filter((b) => b.startsWith(BLOCKER.example)), [])
  // 푸터 사업자 정보 줄의 전화 = 기관 대표전화(agency.mainPhone) — 빠지면 business-info 가 전화 없이 정규화를 불러 next build 가 멈췄다(골든 public-1)
  const foot = site.sections['global/footer']?.props?.copy?.business
  if (foot) assert.deepEqual(foot.phone, { $ref: 'agency.mainPhone' })
  // 첫 화면 구획(PERF2 data-wf-first): 현재 위치 띠는 얇은 띠라 다음 섹션(하위 메뉴)까지 감싼다
  const guide = readFileSync(join(s.siteDir, 'app', 'guide', 'page.tsx'), 'utf8')
  const wrap = guide.slice(guide.indexOf('data-wf-first'), guide.indexOf('</div>', guide.indexOf('data-wf-first')))
  assert.ok(wrap.includes('"sub/breadcrumb"') && wrap.includes('"sub/side-menu"'), guide)

  const pwa = { topic: '습관 기록 앱', archetype: 'pwa', locale: 'ko', facts: { name: '하루셈', email: 'hello@harusem.kr' } }
  const P = await makeRun(TMP, pwa, (request) => contentFrom('pwa', request, {
    manifest: { name: '하루셈', short_name: '하루셈', description: '습관을 두 번 눌러 기록해요', icons: [{ src: '/icon-192.png', sizes: '192x192', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', purpose: 'any' }, { src: '/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' }], start_url: '/', display: 'standalone', theme_color: '#1f2933', background_color: '#ffffff', screenshots: [] },
    offline: { fallbackUrl: '/offline', precache: [] },
    strings: { offline: '인터넷 연결이 끊겼어요', serviceDown: '서비스를 점검하고 있어요', savedPending: '저장됨 · 연결되면 보내요', synced: '동기화했어요', updateAvailable: '새 버전이 있어요 — 새로고침' },
  }))
  const ps = await gen(P)
  assert.ok(ps.sections.includes('home/skeleton'), ps.blockers.join('\n'))
  for (const k of ['home/primary-content', 'completion/result']) assert.ok(ps.blockers.some((b) => b.startsWith(`${BLOCKER.unbound}${k} (본문) — `)), k)
})
