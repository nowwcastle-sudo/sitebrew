// FINAL-WF3 블록·셸·고름 규칙 시험(브라우저 없음) — 소비자에게 나가는 컴파일본(_compiled)을 정적 렌더(react-dom/server)해 마크업을 본다(blocks-rules-d2.test.mjs 와 같은 방법).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/final-wf3-blocks.test.mjs   (먼저 npm run gen:all)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'final-wf3-test')
const FACTORY = join(root, 'registry', 'factory')
const COMPILED = join(FACTORY, 'blocks', '_compiled')
const STUBS = {
  [join(FACTORY, 'motion', 'use-gsap-scene.ts')]: 'export function useGsapScene() {}\n',
  [join(FACTORY, 'motion', 'gsap-techniques.ts')]: 'export function rise() {}\nexport function blurToSharp() {}\nexport function countUp() {}\nexport function kineticType() {}\nexport function scrubTimeline() {}\n',
}
const loaded = new Map()
const outPath = (abs) => join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
const resolveSource = (base) => [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = outPath(abs)
  loaded.set(abs, out)
  let text
  if (STUBS[abs] !== undefined) text = STUBS[abs]
  else {
    text = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    text = text.replace(/(from\s+|import\s*\(\s*|import\s+|export\s+\*\s+from\s+)(["'])(@\/|\.{1,2}\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
      const base = pre === '@/' ? join(root, p) : resolve(dirname(abs), pre + p)
      const src = resolveSource(base)
      if (!src) throw new Error(`import 대상 없음: ${pre}${p} (${relative(root, abs)})`)
      return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
    })
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, text)
  return out
}
const load = async (abs) => import(pathToFileURL(transpile(abs)).href)
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const el = (C, props) => renderToStaticMarkup(React.createElement(C, props))
const pascal = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')
async function block(kv) {
  const [kind, variant] = kv.split('/')
  const mod = await load(join(COMPILED, kind, `${variant}.tsx`))
  const fx = await load(join(FACTORY, 'blocks', kind, `${variant}.fixture.ts`))
  return { C: mod[pascal(kind) + pascal(variant)], fx }
}
const idx = (h, re) => h.search(re)

// ── 항목 1·2: inline-newsletter ──────────────────────────────────────────
test('WF3-1·2 inline-newsletter: 안내 글은 입력 줄 밖, 쪽 순서는 이메일 → 필수 동의 → 제출, 필수 동의에 aria-required', async () => {
  const { C, fx } = await block('lead-capture/inline-newsletter')
  const h = el(C, fx.fixture)
  const form = h.slice(h.indexOf('<form'))
  const email = idx(form, /type="email"/), box = idx(form, /role="checkbox"/), hint = idx(form, /data-human-hint/), submit = idx(form, /type="submit"/)
  assert.ok(email >= 0 && box > email && hint > box && submit > hint, `순서 이메일 ${email} < 동의 ${box} < 안내 ${hint} < 제출 ${submit}`)
  assert.match(form.slice(box, form.indexOf('>', box)), /aria-required="true"/, '필수 동의 aria-required')
  assert.doesNotMatch(form, /sm:flex-row/, '입력칸·버튼이 같은 가로 줄(flex-row)에 앉지 않는다 — 안내 글이 줄 안에 들어가 입력칸을 눌렀다')
  assert.match(form.slice(submit - 400, submit + 400), /aria-describedby="[^"]*approval-hint/, '제출 버튼이 안내 글을 가리킨다')
})
test('WF3-1 SubmitButton: 안내 글 위치가 가로 줄 밖이면 approval.outside 로 버튼만 그린다', async () => {
  const src = readFileSync(join(FACTORY, 'blocks', '_shared', 'port-form.tsx'), 'utf8')
  assert.match(src, /outside\?: boolean/)
  const lcn = readFileSync(join(FACTORY, 'blocks', 'lead-capture', 'inline-newsletter.tsx'), 'utf8')
  assert.match(lcn, /outside: true/)
  assert.doesNotMatch(lcn, /cn-block-lcn-row/)
})

// ── 항목 4: 쪽 제목 소유 ─────────────────────────────────────────────────
test('WF3-4 BlockHeading: PageHeading level=1 로 감싸면 h1, 아니면 h2', async () => {
  const { BlockHeading } = await load(join(COMPILED, '_shared', 'block-heading.tsx'))
  const { PageHeading } = await load(join(COMPILED, '_shared', 'heading-level.tsx'))
  assert.match(el(BlockHeading, { id: 't', title: '요금제' }), /<h2 id="t"/)
  assert.match(renderToStaticMarkup(React.createElement(PageHeading, { level: 1 }, React.createElement(BlockHeading, { id: 't', title: '요금제' }))), /<h1 id="t"/)
})
test('WF3-4 gen-pages: 쪽 제목을 맡은 잎만 PageHeading 으로 감싼다(다른 잎의 출력은 그대로)', async () => {
  const { leafSource } = await import('../stamp/gen-pages.mjs')
  const a = leafSource({ name: 'PricingPricing', block: 'block-pricing-three-tier-cards', recipeId: 'r1-measure' })
  const b = leafSource({ name: 'PricingPricing', block: 'block-pricing-three-tier-cards', recipeId: 'r1-measure', h1: true })
  assert.doesNotMatch(a, /PageHeading/)
  assert.match(b, /import \{ PageHeading \} from "@\/components\/blocks\/_shared\/heading-level"/)
  assert.match(b, /<PageHeading level=\{1\}>/)
  // 블록 머리를 BlockHeading 으로 그리지 않는 블록(히어로 등)은 h1 요청이 와도 감싸지 않는다
  assert.doesNotMatch(leafSource({ name: 'HomeHero', block: 'block-hero-punch-in-statement', recipeId: 'r1-measure', h1: true }), /PageHeading/)
})

// ── 항목 5: 푸터 랜드마크 ────────────────────────────────────────────────
test('WF3-5 SiteShell: 푸터 블록(자기 <footer>)을 주면 바깥은 div, 사업자 정보만이면 <footer>', async () => {
  const { SiteShell } = await load(join(FACTORY, 'ui', 'site-shell.tsx'))
  const base = { archetype: 'local', logo: 'x', pageTitle: 't' }
  const withBlock = el(SiteShell, { ...base, footer: React.createElement('footer', { 'data-block': 'footer-x' }, 'f') })
  assert.match(withBlock, /<div data-slot="site-shell-footer"/)
  assert.equal((withBlock.match(/<footer\b/g) ?? []).length, 1, 'contentinfo 는 하나')
  const only = el(SiteShell, { ...base, business: { name: '예시', representative: '김', bizRegNo: '1', address: 'a', phone: '02-1234-5678' } })
  assert.match(only, /<footer data-slot="site-shell-footer"/)
})

// ── 항목 3: 접이식 메뉴(서버 HTML 은 펼친 띠 그대로, 클라이언트가 접는다) ─────────
test('WF3-3 SiteShell: 서버 HTML 은 예전과 같은 펼친 띠이고, 접이식 메뉴 부품은 진짜 button·aria-expanded·aria-controls·Esc 를 갖는다', async () => {
  const { SiteShell } = await load(join(FACTORY, 'ui', 'site-shell.tsx'))
  const h = el(SiteShell, { archetype: 'local', logo: 'x', pageTitle: 't', nav: [{ label: '메뉴', href: '#a' }, { label: '예약', href: '#b' }], actions: React.createElement('a', { href: 'tel:1' }, '전화') })
  assert.match(h, /data-slot="site-shell-strip"/)
  assert.doesNotMatch(h, /site-shell-menu-button/, '서버에서는 접지 않는다(하이드레이션 뒤 폭을 재서 접는다)')
  assert.match(h, /data-slot="site-shell-nav"/)
  const src = readFileSync(join(FACTORY, 'ui-src', 'site-shell-nav.tsx'), 'utf8')
  assert.match(src, /<button[\s\S]*?type="button"/)
  for (const t of ['aria-expanded', 'aria-controls', 'Escape', 'hidden={!open}', 'button.current?.focus()']) assert.ok(src.includes(t), t)
  assert.match(readFileSync(join(FACTORY, 'ui-src', 'locale-labels.tsx'), 'utf8'), /siteMenu: "메뉴"[\s\S]*siteMenu: "Menu"/)
})

// ── 항목 7: 번호 라벨 ────────────────────────────────────────────────────
test('WF3-7 faq/two-column-index: 질문 목차에 번호(01·02…)와 ol 이 없다 — 단계 목록(이용 방법)만 번호를 둔다', async () => {
  const { C, fx } = await block('faq/two-column-index')
  const h = el(C, fx.fixture)
  assert.doesNotMatch(h, />\s*0[1-9]\s*</)
  assert.doesNotMatch(h, /<ol\b/)
  const steps = await block('features/numbered-steps')
  assert.match(el(steps.C, steps.fx.fixture), />\s*0?1\s*</, '단계 목록은 번호를 유지한다')
})

// ── 항목 8: 카드 열 수 ───────────────────────────────────────────────────
test('WF3-8 gridCols: 항목 수에 맞는 열 — 3+1·빈 칸 없음', async () => {
  const { gridCols } = await load(join(COMPILED, '_shared', 'grid-cols.tsx'))
  const orphan = (n, c) => n > c && n % c === 1
  for (let n = 1; n <= 12; n++) for (const prefer of [[3, 2, 4], [4, 3, 2]]) {
    const c = gridCols(n, { prefer })
    assert.ok(c <= 4, `n=${n} 열 ${c}`)
    if (n >= 4) assert.ok(!orphan(n, c), `n=${n} prefer=${prefer} → ${c}열은 마지막 줄 1개`)
    if (n <= 3) assert.equal(c, n, `n=${n} 은 한 줄 그대로`)
  }
  assert.equal(gridCols(4), 2, '카드 4개는 2×2')
  assert.equal(gridCols(4, { prefer: [4, 3, 2] }), 4, '작은 타일 4개는 4열')
  assert.equal(gridCols(3), 3)
})
test('WF3-8 content/cards·integrations/icon-grid 는 data-cols 로 열 수를 건다', async () => {
  const cards = await block('content/cards')
  const base = cards.fx.fixture
  const items = (n) => Array.from({ length: n }, (_, i) => ({ ...(base.items?.[0] ?? { title: '항목' }), title: `항목 ${i + 1}` }))
  for (const [n, cols] of [[3, 3], [4, 2], [7, 4]]) assert.match(el(cards.C, { ...base, items: items(n) }), new RegExp(`data-cols="${cols}"`), `카드 ${n}개 → ${cols}열`)
  const grid = await block('integrations/icon-grid')
  const g = grid.fx.fixture
  for (const [n, cols] of [[3, 3], [4, 4], [5, 3]]) {
    const h = el(grid.C, { ...g, copy: { ...g.copy, items: Array.from({ length: n }, (_, i) => ({ ...g.copy.items[0], name: `연동 ${i + 1}` })) } })
    assert.match(h, new RegExp(`data-cols="${cols}"`), `타일 ${n}개 → ${cols}열`)
  }
})

// ── 항목 9: 사진 자리 표지 ───────────────────────────────────────────────
test('WF3-9 product-thumb: 사진이 없으면 「실제 사진 필요」 글을 보인다(en 은 영어)', async () => {
  const { ProductThumb } = await load(join(COMPILED, '_shared', 'product-thumb.tsx'))
  const thumb = { src: '', alt: '', aspect: '1:1' }
  const ko = el(ProductThumb, { thumb })
  assert.match(ko, /실제 사진 필요/)
  assert.match(ko, /data-photo-needed/)
  assert.match(el(ProductThumb, { thumb, locale: 'en' }), /Real photo needed/)
  assert.doesNotMatch(el(ProductThumb, { thumb: { ...thumb, src: '/a.jpg' } }), /실제 사진 필요/, '사진이 있으면 표지를 달지 않는다')
})
// (hero/object-3d-orbit 의 빈 판 표지는 FINAL-WF2 가 copy.emptyLabel 로 했다 — 이 레인은 product-thumb 만 맡는다)

// ── 항목 11: 링크에 role=button ──────────────────────────────────────────
test('WF3-11 Button render={<a href>}: 이동하는 링크에 role=button 이 붙지 않는다', async () => {
  const { Button } = await load(join(FACTORY, 'ui', 'button.tsx'))
  const link = el(Button, { nativeButton: false, render: React.createElement('a', { href: 'tel:0212345678' }), children: '전화' })
  assert.match(link, /^<a /)
  assert.doesNotMatch(link, /role="button"/)
  assert.match(link, /href="tel:0212345678"/)
  assert.match(link, /data-slot="button"/)
  assert.match(link, />전화</)
  assert.match(el(Button, { children: '보내기' }), /<button\b/)
})

// ── 항목 12: aria-labelledby 를 div 에 달지 않는다 ───────────────────────────
for (const kv of ['features/bento-grid', 'pricing/three-tier-cards']) {
  test(`WF3-12 ${kv}: aria-labelledby 가 달린 div 는 role=group 이다(aria-prohibited-attr)`, async () => {
    const { C, fx } = await block(kv)
    const h = el(C, fx.fixture)
    const bad = [...h.matchAll(/<div\b[^>]*aria-labelledby="[^"]*"[^>]*>/g)].map((m) => m[0]).filter((t) => !/\brole="/.test(t))
    assert.deepEqual(bad, [])
    assert.match(h, /<div[^>]*role="group"[^>]*aria-labelledby|<div[^>]*aria-labelledby[^>]*role="group"/)
  })
}

// ── 항목 14: 고름 규칙 ───────────────────────────────────────────────────
test('WF3-14① 모든 레시피의 제목 서체 스택에서 라틴 표시 서체 바로 뒤에 한글 글리프가 있는 서체가 온다', async () => {
  const R = await import('../scripts/recipe.mjs')
  for (const id of R.recipeIds()) {
    const head = R.parseRecipe(readFileSync(join(FACTORY, 'recipes', id, 'DESIGN.md'), 'utf8'))
    const ko = R.headingKoFace(head.fonts)
    assert.ok(ko?.family && R.isKorean(ko.family), `${id}: 한글 제목 대체 서체 ${ko?.family}`)
    const stack = String(R.fontStacks(head.fonts)['font-heading'])
    assert.ok(stack.includes(`"${ko.family}"`), `${id}: font-heading 스택에 ${ko.family}`)
  }
})
test('WF3-14② 돌봄·의료 업종 브리프는 세로쓰기 히어로를 고르지 않는다(다른 업종은 영향 없음)', async () => {
  const V = await import('../stamp/variants.mjs')
  const care = V.unfitBlocks({ topic: '재가 방문요양 센터 소개', facts: {} })
  assert.ok(care.has('block-hero-vertical-title-slides'))
  assert.ok(V.unfitBlocks({ topic: '치과 의원', facts: { name: '예시 치과' } }).has('block-hero-vertical-title-slides'))
  assert.equal(V.unfitBlocks({ topic: '한옥 찻집', facts: { name: '예시 찻집' } }).size, 0)
  assert.equal(V.unfitBlocks({}).size, 0)
  // 03 고름: 같은 섹션에 다른 변형이 있으면 막은 변형을 고르지 않는다(못 채움과 같은 길 — readiness 2)
  const sitemap = { archetype: 'local', pages: [{ id: 'home', sections: [{ kind: 'hero', status: 'block', allowedVariants: ['block-hero-vertical-title-slides', 'block-hero-map-first'] }] }], globals: [] }
  const readiness = new Map([...care].map((b) => [b, 2]))
  const picked = V.chooseVariants(sitemap, [{ id: 'a', recipe: 'r8-dusk' }, { id: 'b', recipe: 'r8-dusk' }, { id: 'c', recipe: 'r8-dusk' }], { seed: 1, weights: [], readiness })
  for (const id of ['a', 'b', 'c']) assert.equal(picked[id]['home/hero'], 'block-hero-map-first', `${id}`)
})
