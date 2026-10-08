// FV1 Task 5.9 — 필수 섹션 블록(골든 1차 「필수 섹션 블록 없음」 22줄 · 「그리지 않음」 10줄, 레인 REQUIRED).
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/required-sections.test.mjs
// 방법: 원형 JSON·사이트맵·binder 는 순수 검사. 블록 원천(.tsx)은 typescript 로 .tmp 에 옮겨 예시 콘텐츠(.fixture.ts)로 정적 렌더(react-dom/server)한 뒤 마크업을 본다 — 브라우저 없음.
// 모션 장면·기법은 아무것도 안 하는 가짜로 바꾼다. 클릭·키보드·화면 배치(Chrome)는 갤러리 관문(blocks:gates·blocks:a11y — Task 5.17 몫)이 잰다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { loadArchetypes, loadBlockIndex, checkArchetypes } from './archetypes.mjs'
import { BLOCK_KINDS, BlockMeta, loadBlocks } from './blocks.mjs'
import { buildSitemap, sitemapBlockers } from '../stamp/sitemap.mjs'
import { bindSection } from '../stamp/gen-pages.mjs'
import { FACT_KINDS, paginationMergedIntoTable } from '../stamp/site-bind.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'required-sections-test')
const BLK = join(root, 'registry', 'factory', 'blocks')
const rd = (rel) => readFileSync(join(BLK, rel), 'utf8')

// ── 골든 1차에서 막힌 필수 섹션 — p3-4-summary.md 「알려진 한계」 ──────────────────────────────────────
const NEEDED = {
  commerce: ['category-list/list-toolbar', 'category-list/filter-chips'],
  dashboard: ['operational/filter-bar', 'analytics/filter-bar', 'admin-list/search-filter-bar', 'admin-list/data-table', 'admin-list/pagination', 'global/app-shell-sidebar', 'global/top-bar', 'global/state-screens'],
  detail: ['product-detail/spec-table', 'product-detail/notice-table', 'product-detail/shipping-returns'],
  pwa: ['settings/permissions', 'global/connection-banner', 'global/update-toast'],
}
/** `<쪽>/<섹션>` 또는 `global/<전역 섹션>` */
function findSection(a, key) {
  const [page, kind] = key.split('/')
  if (page === 'global') return a.globalSections.find((g) => g.kind === kind)
  return a.pages.find((p) => p.id === page)?.sections.find((s) => s.kind === kind)
}
const bound = (s) => s.allowedVariants?.length > 0 || s.noBlock?.mode === 'part' || s.noBlock?.mode === 'content'

for (const [arch, keys] of Object.entries(NEEDED)) test(`${arch}: 필수 섹션이 블록·부품을 갖는다`, async () => {
  const a = (await loadArchetypes())[arch]
  for (const k of keys) {
    const s = findSection(a, k)
    assert.ok(s, `${k} 섹션 없음`)
    assert.ok(bound(s), `${k}: 블록 없음(${s.noBlock?.mode})`)
    assert.notEqual(s.noBlock?.mode, 'pending', `${k}: 아직 pending`)
  }
})

test('원형 묶음 검사: 전역 섹션의 허용 변형도 실제 블록이고 그 원형을 archetypes 메타에 적었다', async () => {
  const all = await loadArchetypes()
  const idx = loadBlockIndex()
  assert.deepEqual(checkArchetypes(all, idx.names, idx.fit), [])
  // 음성 대조: 없는 블록·다른 kind·원형을 안 적은 블록을 전역 섹션에 적으면 잡는다
  const bad = structuredClone(all)
  const g = bad.pwa.globalSections.find((x) => x.kind === 'update-toast')
  g.allowedVariants = ['block-announcement-없는블록', 'block-faq-accordion', 'block-hero-kinetic-type-video']
  g.blockKinds = ['announcement']
  const issues = checkArchetypes(bad, idx.names, idx.fit)
  assert.ok(issues.some((i) => /global\/update-toast.*없는 블록/.test(i)), issues.join('\n'))
  assert.ok(issues.some((i) => /global\/update-toast.*다른 kind/.test(i)), issues.join('\n'))
})

test('원형 JSON 의 필수 pending 은 이 레인 네 원형에서 장바구니(v0.2)만 남는다', async () => {
  const all = await loadArchetypes()
  for (const id of Object.keys(NEEDED)) {
    const pend = all[id].pages.filter((p) => (p.phase ?? 'v0') === 'v0').flatMap((p) => p.sections.filter((s) => s.required && s.noBlock?.mode === 'pending').map((s) => `${p.id}/${s.kind}`))
    assert.deepEqual(pend, [], `${id}: 필수 pending 이 남았다`)
  }
})

// ── 사이트맵: 필수 섹션 블록 없음 blocker 0 · 전역 섹션이 블록으로 묶인다 ───────────────────────────────
test('02 사이트맵: 네 원형 모두 「필수 섹션 블록 없음」 줄이 없다', async () => {
  const all = await loadArchetypes()
  for (const id of Object.keys(NEEDED)) {
    const sm = buildSitemap(all[id], { archetype: id, facts: {} })
    assert.deepEqual(sitemapBlockers(sm), [], `${id}`)
  }
})
test('02 사이트맵: 전역 섹션은 상태 block 이고 허용 변형이 그 kind 의 블록이다', async () => {
  const all = await loadArchetypes()
  const want = { dashboard: { 'app-shell-sidebar': 'nav', 'top-bar': 'nav', 'state-screens': 'state-screen' }, pwa: { 'connection-banner': 'state-screen', 'update-toast': 'announcement' } }
  for (const [id, kinds] of Object.entries(want)) {
    const sm = buildSitemap(all[id], { archetype: id, facts: {} })
    for (const [kind, blockKind] of Object.entries(kinds)) {
      const g = sm.globals.find((x) => x.kind === kind)
      assert.equal(g?.status, 'block', `${id}/global/${kind} 상태 ${g?.status}`)
      assert.ok(g.allowedVariants.length > 0 && g.allowedVariants.every((v) => v.startsWith(`block-${blockKind}-`)), `${id}/global/${kind}: ${g.allowedVariants}`)
    }
  }
  // 앱 사이드바와 상단 바는 서로 다른 블록이다(같은 kind 의 두 변형을 두 전역 자리가 나눠 쓴다)
  const dash = buildSitemap(all.dashboard, { archetype: 'dashboard', facts: {} })
  assert.deepEqual(dash.globals.find((g) => g.kind === 'app-shell-sidebar').allowedVariants, ['block-nav-app-sidebar'])
  assert.deepEqual(dash.globals.find((g) => g.kind === 'top-bar').allowedVariants, ['block-nav-top-bar'])
  const pwa = buildSitemap(all.pwa, { archetype: 'pwa', facts: {} })
  assert.deepEqual(pwa.globals.find((g) => g.kind === 'connection-banner').allowedVariants, ['block-state-screen-offline-cached'])
  assert.deepEqual(pwa.globals.find((g) => g.kind === 'update-toast').allowedVariants, ['block-announcement-update-toast'])
})

// ── 정적 렌더 도구 ─────────────────────────────────────────────────────────────────────────────────
const STUBS = {
  [join(root, 'registry', 'factory', 'motion', 'use-gsap-scene.ts')]: 'export function useGsapScene() {}\n',
  [join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts')]: 'export function rise() {}\n',
}
const loaded = new Map()
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let outputText
  if (STUBS[abs]) outputText = STUBS[abs]
  else ({ outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }))
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const load = (rel) => import(pathToFileURL(transpile(join(root, rel))).href)
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement
const comp = (kind, variant) => `${kind}-${variant}`.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')
async function renderFixtureHtml(path, fx = 'fixture', extra = {}) {
  const [kind, variant] = path.split('/')
  const mod = await load(`registry/factory/blocks/${path}.tsx`)
  const f = await load(`registry/factory/blocks/${path}.fixture.ts`)
  return renderToStaticMarkup(h(mod[comp(kind, variant)], { ...f[fx], ...extra }))
}
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ')

const FILTER = ['chips', 'toolbar', 'search-filter']
const NEW_BLOCKS = [...FILTER.map((v) => `filter-bar/${v}`), 'nav/app-sidebar', 'nav/top-bar', 'account/permissions']

// ── filter-bar kind ──────────────────────────────────────────────────────────────────────────────
test('filter-bar 는 kind 표에 있고 변형 3개, 메타 모양이 맞다', () => {
  assert.ok(BLOCK_KINDS.includes('filter-bar'))
  const names = readdirSync(join(BLK, 'filter-bar')).filter((f) => f.endsWith('.block.json')).map((f) => f.replace('.block.json', '')).sort()
  assert.deepEqual(names, [...FILTER].sort())
  for (const f of NEW_BLOCKS) {
    const m = BlockMeta.safeParse(JSON.parse(rd(`${f}.block.json`)))
    assert.ok(m.success, `${f}: ${m.error?.issues.map((i) => i.message)}`)
    assert.ok(existsSync(join(BLK, `${f}.fixture.ts`)), `${f}: 예시 없음`)
  }
})

test('새 블록 7개는 원형 연결 메타를 갖는다(archetypes · archetypeKinds)', () => {
  const meta = (f) => JSON.parse(rd(`${f}.block.json`))
  assert.ok(meta('filter-bar/chips').archetypes.includes('commerce'))
  assert.ok(meta('filter-bar/toolbar').archetypes.includes('commerce') && meta('filter-bar/toolbar').archetypes.includes('dashboard'))
  assert.ok(meta('filter-bar/search-filter').archetypes.includes('dashboard'))
  assert.ok(meta('nav/app-sidebar').archetypes.includes('dashboard') && meta('nav/top-bar').archetypes.includes('dashboard'))
  assert.deepEqual(meta('account/permissions').archetypes, ['pwa'])
  assert.ok(meta('nav/app-sidebar').archetypeKinds.includes('app-shell-sidebar'))
  assert.ok(meta('nav/top-bar').archetypeKinds.includes('top-bar'))
})

test('거르기 순수 함수: 주소 쿼리 읽기·바꾸기 — 빈 값과 쪽 번호는 지운다', async () => {
  const q = await load('registry/factory/blocks/_shared/filter-query.tsx')
  assert.equal(q.paramsOf('?q=%EC%BB%A4%ED%94%BC&sort=new').get('q'), '커피')
  assert.equal(q.nextSearch('?q=a&page=3', { q: 'b' }), '?q=b')
  assert.equal(q.nextSearch('?q=a&category=x', { q: '' }), '?category=x')
  assert.equal(q.nextSearch('', { category: '원두' }), '?category=%EC%9B%90%EB%91%90')
  assert.equal(q.nextSearch('?category=x', { category: null }), '')
  assert.deepEqual(q.listOf('a,b,,c'), ['a', 'b', 'c'])
  assert.equal(q.toList(['a', 'b']), 'a,b')
})

test('거르기 DOM 규칙: 검색어·분류가 목록 항목을 보이거나 숨긴다(순수 판정)', async () => {
  const q = await load('registry/factory/blocks/_shared/filter-query.tsx')
  const item = (attrs, text) => ({ text, attr: (n) => attrs[n] ?? null })
  assert.equal(q.itemVisible(item({}, '하루 블렌드 200g'), { q: '블렌드' }), true)
  assert.equal(q.itemVisible(item({}, '하루 블렌드 200g'), { q: '드립' }), false)
  assert.equal(q.itemVisible(item({ 'data-filter-category': '원두' }, '하루 블렌드'), { category: '원두' }), true)
  assert.equal(q.itemVisible(item({ 'data-filter-category': '드립백' }, '하루 블렌드'), { category: '원두' }), false)
  assert.equal(q.itemVisible(item({ 'data-filter-category': '원두' }, 'x'), { category: '원두,드립백' }), true) // 여러 값은 하나라도 맞으면
  assert.equal(q.itemVisible(item({}, 'x'), {}), true)
})

test('chips: 묶음 이름·눌림 상태·전체 칩·결과 수(role=status)가 있다', async () => {
  const html = await renderFixtureHtml('filter-bar/chips')
  assert.match(html, /data-block="filter-bar-chips"/)
  assert.match(html, /role="group"/)
  assert.match(html, /aria-pressed="(true|false)"/)
  assert.match(html, /role="status"/)
  assert.doesNotMatch(html, /<h1[\s>]/)
  assert.match(textOf(html), /전체/)
})
test('chips: 최대·최소 예시도 그려지고 칩이 버튼이다', async () => {
  for (const fx of ['fixtureMax', 'fixtureMin']) {
    const html = await renderFixtureHtml('filter-bar/chips', fx)
    assert.match(html, /<button[^>]*type="button"/, fx)
    assert.match(html, /data-block="filter-bar-chips"/, fx)
  }
})
test('toolbar: 결과 수(role=status)·정렬/기간 select 에 보이는 라벨이 있다', async () => {
  const html = await renderFixtureHtml('filter-bar/toolbar')
  assert.match(html, /data-block="filter-bar-toolbar"/)
  assert.match(html, /role="status"/)
  assert.match(html, /<select/)
  assert.match(html, /<label[^>]*for=/)
})
test('toolbar: 갱신 시각 줄은 <time> 으로, 비교 스위치는 이름이 있다', async () => {
  const html = await renderFixtureHtml('filter-bar/toolbar', 'fixtureMax')
  assert.match(html, /<time[^>]*datetime=/i)
  assert.match(html, /role="switch"|type="checkbox"/)
})
test('search-filter: 검색 칸에 보이는 라벨, [필터 초기화]는 걸렸을 때만, 결과 수 role=status', async () => {
  const html = await renderFixtureHtml('filter-bar/search-filter')
  assert.match(html, /data-block="filter-bar-search-filter"/)
  assert.match(html, /type="search"/)
  assert.match(html, /<label[^>]*for=/)
  assert.match(html, /role="status"/)
  assert.doesNotMatch(html, /data-reset/)
  const on = await renderFixtureHtml('filter-bar/search-filter', 'fixture', { initial: { q: '출고' } })
  assert.match(on, /data-reset/)
})

test('filter-bar 세 변형의 원천은 주소 쿼리 훅을 쓰고 서버 렌더에서 window 를 만지지 않는다', () => {
  for (const v of FILTER) {
    const s = rd(`filter-bar/${v}.tsx`)
    assert.match(s, /useQueryState|useFilterQuery/, v)
    assert.doesNotMatch(s.replace(/\/\/.*$/gm, ''), /\bwindow\./, `${v}: 훅 밖에서 window 직접 접근`)
  }
  const kit = rd('_shared/filter-query.tsx')
  assert.match(kit, /history\.replaceState/)
  assert.match(kit, /useSyncExternalStore/)
})

// ── 앱 셸 ─────────────────────────────────────────────────────────────────────────────────────
test('nav/app-sidebar: nav 이름·현재 쪽 aria-current·글자 이름표·접힘 단추가 있다', async () => {
  const html = await renderFixtureHtml('nav/app-sidebar')
  assert.match(html, /data-block="nav-app-sidebar"/)
  assert.match(html, /<nav[^>]*aria-label=/)
  assert.match(html, /aria-current="page"/)
  assert.match(html, /aria-expanded="(true|false)"/) // 접힘 단추
  assert.match(textOf(html), /대시보드|재고|출고/)
  assert.doesNotMatch(html, /<h1[\s>]/)
})
test('nav/app-sidebar: 기본은 펼침(글자 이름표 보임), 접으면 아이콘 + 도움말(이름은 aria-label/title 이 아니라 접근 이름으로 남는다)', async () => {
  const open = await renderFixtureHtml('nav/app-sidebar', 'fixture')
  assert.match(open, /data-collapsed="false"/)
  const collapsed = await renderFixtureHtml('nav/app-sidebar', 'fixture', { defaultCollapsed: true })
  assert.match(collapsed, /data-collapsed="true"/)
  // 접혀도 링크마다 접근 가능한 이름이 있다(글자는 sr-only)
  assert.match(collapsed, /class="[^"]*sr-only[^"]*"/)
})
test('nav/top-bar: 전역 검색(role=search)·알림 링크·계정 메뉴를 갖는다 — 붙지 않는 줄이라 sticky 표지(data-sticky-nav)는 없다', async () => {
  const html = await renderFixtureHtml('nav/top-bar')
  assert.match(html, /data-block="nav-top-bar"/)
  assert.match(html, /role="search"/)
  assert.match(html, /type="search"/)
  // GATES2: 이 줄은 쪽 흐름 안에 앉고 붙지 않는다. data-sticky-nav 를 달면 관문이 검수대 띠로 읽어 안쪽(검색 칸·알림·계정 단추)을 히트 영역·axe 에서 통째로 뺀다(hit na 13/13).
  assert.doesNotMatch(html, /data-sticky-nav/)
  assert.match(textOf(html), /알림/)
  assert.doesNotMatch(html, /<h1[\s>]/)
})

// ── 권한 설정(pwa) ───────────────────────────────────────────────────────────────────────────
test('account/permissions: 알림·위치 권한 상태를 글자로 보이고 바꾸는 길(브라우저 설정 안내)을 준다', async () => {
  const html = await renderFixtureHtml('account/permissions')
  assert.match(html, /data-block="account-permissions"/)
  assert.match(textOf(html), /알림/)
  assert.match(textOf(html), /위치/)
  assert.match(html, /data-permission="notifications"/)
  assert.match(html, /data-state="(granted|denied|prompt|unknown)"/)
  assert.doesNotMatch(html, /<h1[\s>]/)
})
test('account/permissions: 브라우저 권한 API 는 읽기(permissions.query)만 — 요청 함수를 부르지 않는다', () => {
  const s = rd('account/permissions.tsx').replace(/\/\/.*$/gm, '')
  assert.match(s, /permissions\??\.query\(/)
  assert.doesNotMatch(s, /requestPermission\s*\(/)
  assert.doesNotMatch(s, /getCurrentPosition\s*\(|watchPosition\s*\(/)
  assert.doesNotMatch(s, /pushManager\.subscribe\s*\(/)
})
test('account/permissions: 권한을 못 읽는 브라우저는 「알 수 없음」이고 바꾸는 길은 늘 보인다', async () => {
  const html = await renderFixtureHtml('account/permissions', 'fixtureMin')
  assert.match(html, /data-state="unknown"/)
  assert.match(textOf(html), /브라우저/)
})

// ── 블록 규약 ────────────────────────────────────────────────────────────────────────────────
test('새 블록은 _compiled 와 registry.json 항목을 갖는다(gen:all 이 돌았다)', () => {
  const reg = JSON.parse(rd('registry.json'))
  for (const f of NEW_BLOCKS) {
    const [k, v] = f.split('/')
    assert.ok(reg.items.some((i) => i.name === `block-${k}-${v}`), `${f}: registry 항목 없음`)
    assert.ok(existsSync(join(BLK, '_compiled', k, `${v}.tsx`)), `${f}: 컴파일본 없음`)
  }
  assert.ok(reg.items.some((i) => i.name === 'block-shared-filter-query'))
})
test('블록 로더가 새 블록 7개를 메타 오류 없이 읽는다', () => {
  const all = loadBlocks(root)
  for (const f of NEW_BLOCKS) {
    const [k, v] = f.split('/')
    const b = all.find((x) => x.kind === k && x.variant === v)
    assert.ok(b?.meta.success, `${f}: ${b?.meta.error?.issues.map((i) => i.message)}`)
  }
})

// ── 정렬 순수 함수 ────────────────────────────────────────────────────────────────────────────
test('정렬: 「price-asc」 를 읽고 순서(order)를 센다 — 값이 없는 항목은 뒤, 같은 값은 원래 순서', async () => {
  const q = await load('registry/factory/blocks/_shared/filter-query.tsx')
  assert.deepEqual(q.parseSort('price-asc'), { key: 'price', dir: 1 })
  assert.deepEqual(q.parseSort('price-desc'), { key: 'price', dir: -1 })
  assert.equal(q.parseSort('recommended'), null)
  assert.equal(q.parseSort(''), null)
  assert.deepEqual(q.sortRanks([30, 10, 20], 1), [2, 0, 1])
  assert.deepEqual(q.sortRanks([30, 10, 20], -1), [0, 2, 1])
  assert.deepEqual(q.sortRanks([10, null, 10, 5], 1), [1, 3, 2, 0]) // 5 → 10(앞 항목 먼저) → 10 → null 은 맨 뒤
})
test('상품 카드가 거르기·정렬 속성을 단다(data-filter-item · data-filter-category · data-sort-price)', () => {
  for (const v of ['grid-cards', 'ranked-list']) {
    const s = rd(`product-list/${v}.tsx`)
    assert.match(s, /data-filter-item=""/, v)
    assert.match(s, /data-filter-category=\{p\.category\}/, v)
    assert.match(s, /data-sort-price=\{p\.price\}/, v)
  }
})

// ── binder: 거르기 이름은 콘텐츠에서만 ─────────────────────────────────────────────────────────────
const routes = { home: '/', 'category-list': '/products' }
const bind = (block, content, { key = 'category-list/x', locale = 'ko' } = {}) =>
  bindSection({ key, block, content, copyIndex: new Map(), routes, locale, navLinks: () => [], primaryCta: () => ({ href: '#' }), secondaryHref: () => '#' })
const prod = (slug, name, price, category) => ({ slug, name, price, ...(category ? { category } : {}) })
const COMMERCE = (cats) => ({ archetype: 'commerce', locale: 'ko', products: [prod('a', '하루 블렌드 200g', 13000, cats[0]), prod('b', '예가체프 200g', 16000, cats[1]), prod('c', '드립백 10입', 9900, cats[2])] })

test('binder chips: 모든 상품의 분류에서 칩을 만든다(서로 다른 것만, 첫 상품의 $ref) — 예시 문구·고정 결과 수는 지운다', async () => {
  const r = await bind('block-filter-bar-chips', COMMERCE(['원두', '원두', '드립백']))
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.options, [{ value: { $ref: 'products.0.category' }, label: { $ref: 'products.0.category' } }, { value: { $ref: 'products.2.category' }, label: { $ref: 'products.2.category' } }])
  assert.equal(r.props.target, '[data-filter-item]')
  assert.equal(r.props.param, 'category')
  assert.ok(!('resultCount' in r.props) && !('initial' in r.props))
  assert.deepEqual(r.issues, [])
})
test('binder chips: 분류가 하나라도 빠졌거나 하나뿐이면 그리지 않는다 — 거를 것 없는 칩을 만들지 않는다', async () => {
  const miss = await bind('block-filter-bar-chips', COMMERCE(['원두', undefined, '드립백']))
  assert.equal(miss.props, null)
  assert.match(miss.why, /분류/)
  const one = await bind('block-filter-bar-chips', COMMERCE(['원두', '원두', '원두']))
  assert.equal(one.props, null)
  assert.match(one.why, /하나뿐/)
  assert.equal((await bind('block-filter-bar-chips', { archetype: 'commerce', locale: 'ko', products: [prod('a', '단품', 1000, '원두')] })).props, null)
})
test('binder chips: 영어 사이트는 영어 이름표', async () => {
  const r = await bind('block-filter-bar-chips', { ...COMMERCE(['Beans', 'Beans', 'Drip bags']), locale: 'en' }, { locale: 'en' })
  assert.equal(r.props.copy.allLabel, 'All')
  assert.equal(r.props.locale, 'en')
  assert.doesNotMatch(JSON.stringify(r.props.copy), /[가-힣]/)
})
test('binder toolbar(commerce): 가격순 정렬 + 결과 수, 항목은 상품 카드(target = sortTarget)', async () => {
  const r = await bind('block-filter-bar-toolbar', COMMERCE([]))
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.controls[0].options.map((o) => o.value), ['recommended', 'price-asc', 'price-desc'])
  assert.equal(r.props.controls[0].defaultValue, 'recommended')
  assert.equal(r.props.sortTarget, '[data-filter-item]')
  assert.equal(r.props.target, '[data-filter-item]')
  assert.ok(!('resultCount' in r.props))
  assert.deepEqual(r.issues, [])
  assert.equal((await bind('block-filter-bar-toolbar', { archetype: 'commerce', locale: 'ko', products: [prod('a', '단품', 1000)] })).props, null)
})
test('binder toolbar(dashboard): 갱신 주기 줄만 — 기간 select 는 콘텐츠에 없어 그리지 않는다', async () => {
  const content = { archetype: 'dashboard', locale: 'ko', decision: { dashboard_type: 'operational', refresh: '5분마다 새로 고쳐요' } }
  const r = await bind('block-filter-bar-toolbar', content, { key: 'operational/filter-bar' })
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.controls, [])
  assert.deepEqual(r.props.copy.asOf.value, { $ref: 'decision.refresh' })
  assert.ok(!('count' in r.props.copy))
  assert.equal((await bind('block-filter-bar-toolbar', { archetype: 'dashboard', locale: 'ko' }, { key: 'operational/filter-bar' })).props, null)
})
test('binder search-filter: 표 행이 있을 때만 — 거르기 select 는 값이 2~8가지인 글자 열(첫 열 빼고)에서', async () => {
  const content = {
    archetype: 'dashboard', locale: 'ko',
    table: { density: 40, columns: [{ id: 'name', label: '주문', numeric: false }, { id: 'status', label: '상태', numeric: false }, { id: 'qty', label: '수량', numeric: true }], rows: [{ name: 'A-1', status: '출고 준비', qty: 3 }, { name: 'A-2', status: '배송 중', qty: 5 }, { name: 'A-3', status: '출고 준비', qty: 2 }] },
  }
  const r = await bind('block-filter-bar-search-filter', content, { key: 'admin-list/search-filter-bar' })
  assert.ok(r.props, r.why)
  assert.equal(r.props.facets.length, 1)
  assert.deepEqual(r.props.facets[0].label, { $ref: 'table.columns.1.label' })
  assert.deepEqual(r.props.facets[0].options.map((o) => o.value), [{ $ref: 'table.rows.0.status' }, { $ref: 'table.rows.1.status' }])
  assert.equal(r.props.target, '[data-block^="data-table-"] [data-row]')
  assert.deepEqual(r.issues, [])
  const none = await bind('block-filter-bar-search-filter', { archetype: 'dashboard', locale: 'ko' }, { key: 'admin-list/search-filter-bar' })
  assert.equal(none.props, null)
  assert.match(none.why, /표/)
})
test('FACT_KINDS: 거르기 줄·목록 표·상품 정보·배송 반품은 사실 블록이다 — 묶는 binder 가 없으면 예시 사실을 싣지 않고 그리지 않는다', async () => {
  for (const k of ['filter-bar', 'data-table', 'product-info', 'shipping-returns']) assert.ok(FACT_KINDS.has(k), k)
  const r = await bind('block-product-info-notice-table', { archetype: 'detail', locale: 'ko' }, { key: 'product-detail/notice-table' })
  assert.equal(r.props, null)
})

// ── 06: 쪽 나누기는 표가 그린다 ───────────────────────────────────────────────────────────────────
test('06 gen-pages: 쪽 나누기 부품 섹션은 같은 쪽에 data-table 블록 섹션이 있을 때 따로 그리지 않는다(병합) — 규칙은 site-bind 한 곳이고 06 과 binder 빈자리 감사가 같이 쓴다', () => {
  const src = readFileSync(join(root, 'factory', 'stamp', 'gen-pages.mjs'), 'utf8')
  assert.ok(src.includes('paginationMergedIntoTable(page, s)'))
  assert.ok(src.includes('merged.add(key)'))
  const pager = { status: 'part', parts: ['pagination'] }
  const table = { status: 'block', blockKinds: ['data-table'] }
  assert.equal(paginationMergedIntoTable({ sections: [pager, table] }, pager), true)
  assert.equal(paginationMergedIntoTable({ sections: [pager] }, pager), false, '표 블록이 없으면 쪽 나누기를 병합하지 않는다')
  assert.equal(paginationMergedIntoTable({ sections: [pager, { status: 'content', blockKinds: ['data-table'] }] }, pager), false)
  assert.equal(paginationMergedIntoTable({ sections: [table] }, table), false, '쪽 나누기 부품이 아닌 섹션은 병합 대상이 아니다')
})
