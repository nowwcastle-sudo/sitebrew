// 블록 갤러리 준비: node factory/scripts/gen-blocks-gallery.mjs [--force]  (npm run qa:blocks — prebuild·predev·pretypecheck 에서도 돈다)
// 만드는 것(.tmp/blocks, gitignore):
//   <레시피>/<kind>/<variant>.tsx · <레시피>/_shared/<이름>.tsx
//       블록 컴파일본(gen-blocks compileBlock — 소비자에게 나가는 것과 같은 base 값)을 레시피마다 한 벌씩. 부품 import 는 recipeLocalImports 로
//       그 레시피 컴파일본(r/<id>/ui)을, 아이콘 정본 모듈은 그 레시피의 어댑터(icons/<adapter>)를 가리킨다 — 소비자에서 레시피 base 가 까는 것과 같다.
//       _shared 상대 import 는 같은 레시피 폴더의 _shared 로 풀린다.
//   meta.ts      BLOCK_META(블록 이름 → 메타) · BLOCK_RECIPES(레시피 id·이름·기본 테마·색 논리) — 색인 페이지(서버 컴포넌트)가 읽는다.
//   gallery.tsx  BLOCKS(블록 이름 → 메타·레시피별 동적 import·예시 콘텐츠 동적 import) — 보기(클라이언트)가 읽는다.
//                동적 import 라 /qa/blocks 한 페이지가 모든 사본을 한 번에 싣지 않는다.
//   .inputs-hash 입력(블록 원천·조각·base.css·레시피 원천·생성기)의 해시가 같으면 건너뛴다(강제는 --force).
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { loadBlocks, loadShared, blockName, blockComponent } from './blocks.mjs'
import { compileBlock, baseStyleMap } from './gen-blocks.mjs'
import { recipeIds, parseRecipe, recipeLocalImports, RECIPES_DIR, DISPLAY_TITLE_VALUES, TEXTURE_VALUES } from './recipe.mjs'
import { listValues, axisValue } from './axes.mjs'
import { iconAdapter } from './gen-kits.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const OUT = join(root, '.tmp', 'blocks')
const HASH_FILE = join(OUT, '.inputs-hash')
const BANNER = '// 생성물 — factory/scripts/gen-blocks-gallery.mjs 로 다시 만든다. 손으로 고치지 않는다.'
const BLOCKS_SRC = join(root, 'registry', 'factory', 'blocks')

// 레시피 사본: 부품 → 레시피 컴파일본, 아이콘 정본 모듈 → 레시피 어댑터.
// 둘 다 따옴표·모양(import from · export from · import())을 가리지 않는다(리뷰 I-5).
export const recipeCopy = (compiled, id, adapter) =>
  recipeLocalImports(compiled, id).replace(/(["'`])@\/registry\/factory\/icons\1/g, `$1@/registry/factory/icons/${adapter}$1`)

const metaRow = (b) => ({ kind: b.kind, variant: b.variant, component: blockComponent(b.kind, b.variant), ...b.meta })

// 순수 함수: 메타 모듈 글(meta.ts — 동적 import 없음, 서버 컴포넌트인 색인 페이지가 읽는다).
export function metaModule(blocks, recipes) {
  return [
    BANNER,
    '// 블록 메타·레시피 목록 — app/qa/blocks 색인(서버)과 gallery.tsx 가 읽는다.',
    'export type BlockMetaRow = { kind: string; variant: string; component: string; title: string; layout: string; density: string; archetypes: string[]; archetypeKinds: string[]; states: string[]; media: string[]; motion: string[]; rules?: string[]; titleWidth?: string; titleMaxUnits?: number; boldness?: string; boldMode?: string; notes?: string }',
    `export const BLOCK_RECIPES: { id: string; name: string; defaultTheme: string; colorLogic: string; display: string; texture: string }[] = ${JSON.stringify(recipes.map(({ id, name, defaultTheme, colorLogic, display, texture }) => ({ id, name, defaultTheme, colorLogic, display, texture })))}`,
    `export const BLOCK_META: Record<string, BlockMetaRow> = ${JSON.stringify(Object.fromEntries(blocks.map((b) => [blockName(b.kind, b.variant), metaRow(b)])), null, 2)}`,
    '',
  ].join('\n')
}

// 순수 함수: 갤러리 색인 모듈 글(gallery.tsx — 클라이언트 보기가 읽는다). blocks: [{ kind, variant, meta }], recipes: [{ id }].
// 블록마다 레시피 수만큼 동적 import 사본 경로를 둔다.
export function galleryModule(blocks, recipes) {
  const rows = blocks.map((b) => {
    const name = blockName(b.kind, b.variant)
    const comp = blockComponent(b.kind, b.variant)
    const byRecipe = recipes.map((r) => `      ${JSON.stringify(r.id)}: () => import("./${r.id}/${b.kind}/${b.variant}").then((m) => m.${comp}),`).join('\n')
    return [
      `  ${JSON.stringify(name)}: {`,
      `    meta: BLOCK_META[${JSON.stringify(name)}],`,
      `    byRecipe: {\n${byRecipe}\n    },`,
      `    fixtures: () => import("@/registry/factory/blocks/${b.kind}/${b.variant}.fixture"),`,
      '  },',
    ].join('\n')
  })
  return [
    BANNER,
    '// 블록 × 레시피 갤러리 색인 — app/qa/blocks/view.tsx 가 읽는다. 사본은 이 폴더의 <레시피>/<kind>/<variant>.tsx(컴파일본 + 레시피 부품).',
    'import type * as React from "react"',
    'import { BLOCK_META, type BlockMetaRow } from "./meta"',
    'export { BLOCK_META, BLOCK_RECIPES, type BlockMetaRow } from "./meta"',
    '',
    '// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 블록마다 props 가 다르다(예시 콘텐츠가 그 블록의 props 타입이다)',
    'export type AnyBlock = React.ComponentType<any>',
    '// fixtureStates: 상태 주입 재료(선택 — adapter-mock FixtureStates<블록 props>, app/qa/blocks/states.ts withStates 가 읽는다).',
    '// fixturePorts: 포트 목 주입(선택 — (쿼리, { fx, onTrack }) => 포트 메서드 props, states.ts withPorts 가 부른다. 있으면 withStates 대신 쓴다).',
    '// eslint-disable-next-line @typescript-eslint/no-explicit-any',
    'export type BlockFixtures = { fixture: any; fixtureMax: any; fixtureMin: any; fixtureStates?: any; fixturePorts?: any }',
    'export type BlockEntry = { meta: BlockMetaRow; byRecipe: Record<string, () => Promise<AnyBlock>>; fixtures: () => Promise<BlockFixtures> }',
    '',
    `export const BLOCKS: Record<string, BlockEntry> = {\n${rows.join('\n')}\n}`,
    '',
  ].join('\n')
}

// 순수 함수: 새 축 D·X 부품 모듈 글(axis-parts.ts — P3-2 Task 8, 대장 A20). 히어로가 받는 display(DisplayTitle)·texture(Texture)를
// 축 값마다 그 값 하나로 컴파일한 부품(.tmp/axes/<값>/ui — qa:axes)에서 부른다. 레시피 머리 값이든 주소의 &d=·&x= 시험 값이든 같은 모양이다
// (레시피 컴파일에서 두 부품의 훅은 D·X 축 값만 덮는다).
export function axisPartsModule(values = listValues()) {
  const slug = (id) => values.find((v) => v.id === id)?.slug
  const row = (id, part, comp) => `  ${id}: () => import("@/.tmp/axes/${slug(id)}/ui/${part}").then((m) => m.${comp} as AxisPart),`
  const missing = [...DISPLAY_TITLE_VALUES, ...TEXTURE_VALUES].filter((id) => !slug(id))
  if (missing.length) throw new Error(`axis-parts: 축 값 파일이 없다 — ${missing.join(', ')}`)
  return [
    BANNER,
    '// 히어로 새 축 부품(D2·D3 DisplayTitle, X1~X8 Texture) — app/qa/blocks/view.tsx 가 레시피 머리(BLOCK_RECIPES display·texture)나 &d=·&x= 로 고른다.',
    'import type * as React from "react"',
    '// eslint-disable-next-line @typescript-eslint/no-explicit-any -- DisplayTitle·Texture 는 props 모양이 다르다(히어로 props display·texture 가 모양을 정한다)',
    'export type AxisPart = React.ComponentType<any>',
    `export const DISPLAY_TITLE_VALUES = ${JSON.stringify(DISPLAY_TITLE_VALUES)}`,
    `export const TEXTURE_VALUES = ${JSON.stringify(TEXTURE_VALUES)}`,
    'export const AXIS_PARTS: Record<string, () => Promise<AxisPart>> = {',
    ...DISPLAY_TITLE_VALUES.map((id) => row(id, 'display', 'DisplayTitle')),
    ...TEXTURE_VALUES.map((id) => row(id, 'texture', 'Texture')),
    '}',
    '',
  ].join('\n')
}

const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? (d.name === '_compiled' ? [] : walk(join(dir, d.name))) : [join(dir, d.name)])) : [])
export function inputsHash() {
  const h = createHash('sha256')
  const add = (p) => { h.update(p.replace(root, '').split('\\').join('/')); h.update(readFileSync(p)) }
  for (const p of walk(BLOCKS_SRC).filter((p) => !p.endsWith('registry.json')).sort()) add(p)
  for (const id of recipeIds()) add(join(RECIPES_DIR, id, 'DESIGN.md'))
  // 사본을 바꾸는 생성기 코드도 넣는다(리뷰 M-10): recipeLocalImports(recipe.mjs)·iconAdapter(gen-kits.mjs)·컴파일러(compile-styles.mjs)·상태 표.
  const S = (f) => join(root, 'factory', 'scripts', f)
  for (const p of [join(root, 'registry', 'factory', 'styles', 'base.css'), fileURLToPath(import.meta.url), S('blocks.mjs'), S('block-states.mjs'), S('gen-blocks.mjs'),
    S('recipe.mjs'), S('gen-kits.mjs'), S('compile-styles.mjs'), S('axes.mjs'), join(root, 'node_modules', 'shadcn', 'package.json')]) add(p)
  return h.digest('hex')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const t0 = Date.now()
  const hash = inputsHash()
  if (!process.argv.includes('--force') && existsSync(join(OUT, 'gallery.tsx')) && existsSync(HASH_FILE) && readFileSync(HASH_FILE, 'utf8') === hash) {
    console.log(`gen-blocks-gallery: 입력이 그대로다 — 건너뜀 (${hash.slice(0, 12)}, 다시 만들려면 --force)`)
    process.exit(0)
  }
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const map = baseStyleMap(root)
  const blocks = loadBlocks(root).filter((b) => b.meta.success && b.source)
  const shared = loadShared(root)
  const compiled = [
    ...await Promise.all(blocks.map(async (b) => ({ rel: `${b.kind}/${b.variant}.tsx`, text: await compileBlock(b.source, map) }))),
    ...await Promise.all(shared.map(async (s) => ({ rel: `_shared/${s.name}.tsx`, text: await compileBlock(s.source, map) }))),
  ]
  const recipes = recipeIds().map((id) => {
    const r = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
    return { id, name: r.name, defaultTheme: r.defaultTheme ?? 'light', colorLogic: r.colorLogic, display: axisValue(r.axes, 'display'), texture: axisValue(r.axes, 'texture'), adapter: iconAdapter(r.icons) }
  })
  let files = 0
  for (const r of recipes) for (const c of compiled) {
    const p = join(OUT, r.id, c.rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, recipeCopy(c.text, r.id, r.adapter))
    files++
  }
  const rows = blocks.map((b) => ({ kind: b.kind, variant: b.variant, meta: b.meta.data }))
  writeFileSync(join(OUT, 'meta.ts'), metaModule(rows, recipes))
  writeFileSync(join(OUT, 'gallery.tsx'), galleryModule(rows, recipes))
  writeFileSync(join(OUT, 'axis-parts.ts'), axisPartsModule())
  writeFileSync(HASH_FILE, hash)
  console.log(`gen-blocks-gallery: 블록 ${blocks.length}개 · 조각 ${shared.length}개 × 레시피 ${recipes.length}벌 → 사본 ${files}개, gallery.tsx (${Date.now() - t0}ms)`)
}
