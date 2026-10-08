// 프리셋 검수대 준비(P3-2 Task 16a): node factory/scripts/gen-presets-gallery.mjs [--force]  (npm run qa:presets — prebuild·predev·pretypecheck 에서도 돈다)
// 프리셋(references/styles/presets.json)마다 base.css + 그 프리셋의 축 값(9축, 레시피와 같은 순서 — composeStyleMap)으로 부품 몇 개(버튼·카드·내비·입력·배지·
// 디스플레이 제목·질감)만 컴파일해 .tmp/presets/<프리셋>/ui 에 두고(gitignore), 대표 초안 색(presetToRecipeHead — 사전 프리셋은 sample 팔레트, 레시피 프리셋은
// 제 팔레트)을 [data-preset] 구획 변수로 .tmp/presets/presets.css 에 쓴다. 페이지 app/qa/presets/page.tsx 가 .tmp/presets/gallery.tsx 를 읽는다.
// 서체는 싣지 않는다(검수대 기본 서체) — 축 모양과 색을 한눈에 보는 접촉 시트다. 입력 해시가 같으면 건너뛴다(.tmp/presets/.inputs-hash).
import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { compileSource, GENERATED } from './compile-styles.mjs'
import { composeStyleMap, UI_SRC } from './recipe.mjs'
import { AXES_DIR, BASE_CSS } from './axes.mjs'
import { loadPresets, loadPalettePool, presetToRecipeHead, hintPair, PRESETS_FILE, PALETTES_FILE, RECIPE_PALETTES_FILE } from './style-presets.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const OUT = join(root, '.tmp', 'presets')
const HASH_FILE = join(OUT, '.inputs-hash')
export const MODULES = ['button', 'card', 'navigation-menu', 'input', 'badge', 'display', 'texture']
const ident = (s) => s.replace(/[^a-z0-9]+/g, '_')

export function inputsHash() {
  const h = createHash('sha256')
  const add = (p) => { h.update(p.replace(root, '')); h.update(readFileSync(p)) }
  for (const m of MODULES) add(join(UI_SRC, `${m}.tsx`))
  for (const axis of readdirSync(AXES_DIR).sort()) for (const f of readdirSync(join(AXES_DIR, axis)).sort()) add(join(AXES_DIR, axis, f))
  for (const p of [BASE_CSS, PRESETS_FILE, PALETTES_FILE, RECIPE_PALETTES_FILE, fileURLToPath(import.meta.url), join(root, 'factory', 'scripts', 'style-presets.mjs'),
    join(root, 'factory', 'scripts', 'compile-styles.mjs'), join(root, 'node_modules', 'shadcn', 'package.json')]) add(p)
  return h.digest('hex')
}

// 프리셋 하나의 대표 초안(색). 사전 프리셋은 sample 팔레트 + 서체 힌트 짝, 레시피 프리셋은 제 팔레트·서체 짝.
export function sampleHead(p, pool) {
  if (p.source.startsWith('recipe:')) {
    const id = p.source.slice('recipe:'.length)
    const pal = pool.find((x) => x.id === `pal-recipe-${id}`)
    return presetToRecipeHead(p, pal, { fonts: {} })
  }
  return presetToRecipeHead(p, pool.find((x) => x.id === p.sample.palette), hintPair(p))
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const t0 = Date.now()
  const hash = inputsHash()
  if (!process.argv.includes('--force') && existsSync(join(OUT, 'gallery.tsx')) && existsSync(HASH_FILE) && readFileSync(HASH_FILE, 'utf8') === hash) {
    console.log(`gen-presets-gallery: 입력이 그대로다 — 건너뜀 (${hash.slice(0, 12)}, 다시 만들려면 --force)`)
    process.exit(0)
  }
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const presets = loadPresets()
  const pool = loadPalettePool()
  const src = Object.fromEntries(MODULES.map((m) => [m, readFileSync(join(UI_SRC, `${m}.tsx`), 'utf8')]))
  const imports = [], rows = [], cssRules = []
  for (const p of presets) {
    const dir = join(OUT, p.id, 'ui')
    mkdirSync(dir, { recursive: true })
    const map = composeStyleMap(p.axes)
    for (const m of MODULES) writeFileSync(join(dir, `${m}.tsx`), (await compileSource(src[m], map)).replaceAll('"@/registry/factory/ui/', '"./'))
    for (const m of MODULES) imports.push(`import * as ${ident(`${p.id}_${m}`)} from "./${p.id}/ui/${m}"`)
    const head = sampleHead(p, pool)
    const vars = (c) => Object.entries(c).map(([k, v]) => `--${k}: ${v};`).join(' ')
    cssRules.push(`[data-preset="${p.id}"] { ${vars(head.color.light)} }`, `.dark [data-preset="${p.id}"], [data-preset="${p.id}"].dark { ${vars(head.color.dark)} }`)
    const axes = Object.values(p.axes).join(' ')
    rows.push(`  { id: ${JSON.stringify(p.id)}, name: ${JSON.stringify(p.name)}, source: ${JSON.stringify(p.source)}, axes: ${JSON.stringify(axes)}, logic: ${JSON.stringify(head.colorLogic)}, motion: ${JSON.stringify(head.motion)}, novelty: ${p.novelty}, palette: ${JSON.stringify(p.sample?.palette ?? `pal-recipe-${p.source.slice(7)}`)}, ui: { ${MODULES.map((m) => `${JSON.stringify(m)}: ${ident(`${p.id}_${m}`)}`).join(', ')} } },`)
  }
  writeFileSync(join(OUT, 'presets.css'), [GENERATED.replace('compile-styles.mjs', 'gen-presets-gallery.mjs').replace(/^\/\/ (.*)$/, '/* $1 */'), ...cssRules, ''].join('\n'))
  writeFileSync(join(OUT, 'gallery.tsx'), [GENERATED.replace('compile-styles.mjs', 'gen-presets-gallery.mjs'), '// 프리셋 목록 — app/qa/presets/page.tsx 가 읽는다.', ...imports, '', `export const presets = [\n${rows.join('\n')}\n]`, ''].join('\n'))
  writeFileSync(HASH_FILE, hash)
  console.log(`gen-presets-gallery: 프리셋 ${presets.length}개 × 부품 ${MODULES.length} → .tmp/presets (${Date.now() - t0}ms)`)
}
