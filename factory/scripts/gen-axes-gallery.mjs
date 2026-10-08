// 축 갤러리 준비: node factory/scripts/gen-axes-gallery.mjs [--force]  (npm run qa:axes — prebuild·predev 에서도 돈다)
// 스타일 축 값마다 base.css 위에 그 값 CSS 를 얹어 ui-src 를 컴파일해 .tmp/axes/<값>/ui 에 두고(gitignore),
// 페이지 app/qa/axes/page.tsx 가 읽는 목록 .tmp/axes/gallery.tsx 를 만든다.
// 입력(ui-src·base.css·축 값·호환표·컴파일러·이 스크립트·shadcn 버전)의 해시가 지난번과 같으면 건너뛴다(.tmp/axes/.inputs-hash).
import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { loadStyleMap, compileDir, GENERATED } from './compile-styles.mjs'
import { listValues, styleMapOf, BASE_CSS, AXES_DIR, AXIS_ORDER } from './axes.mjs'
import { checkCompat } from './compat.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const OUT = join(root, '.tmp', 'axes')
const UI_SRC = join(root, 'registry', 'factory', 'ui-src')
const HASH_FILE = join(OUT, '.inputs-hash')

// 축마다 갤러리가 쓰는 부품 모듈(이름 → 파일).
export const MODULES = {
  button: ['button', 'button-group'],
  input: ['input', 'textarea', 'native-select', 'input-group', 'field'],
  surface: ['card', 'button', 'dialog'],
  table: ['table'],
  header: ['navigation-menu', 'button', 'sidebar', 'site-shell'],
  radius: ['badge', 'tabs', 'toggle-group', 'checkbox', 'switch', 'radio-group', 'alert', 'progress', 'kbd', 'avatar', 'label', 'alert-dialog', 'toast', 'button'],
  shadow: ['card', 'button'],
  // Task 16a: 디스플레이 규모(D)는 DisplayTitle, 질감(X)은 Texture 면 구획 — 칸 안 버튼은 base 모양.
  display: ['display', 'button'],
  texture: ['texture', 'button'],
}
// 짝 값: 그 값만으로는 명세대로 보이지 않는 칸에 호환되는 다른 축 값을 밑에 깐다(칸 제목에 표시).
// C3 의 깊이는 그림자 축이 맡고(S1), S2 는 0 계열 표면·반경(C2·R0) 위에서만, S3 는 R1 반경의 면 위에서만 쓴다.
// C6 굵은 테두리 색면 카드는 R0·S2 와만(호환표 conditional — Task 16a).
export const COMPANIONS = { C3: ['S1'], C6: ['R0', 'S2'], S0: ['C1'], S1: ['C3'], S2: ['C2', 'R0'], S3: ['C3', 'R1'] }
const ident = (s) => s.replace(/[^a-z0-9]+/g, '_')

export function inputsHash() {
  const h = createHash('sha256')
  const add = (p) => { h.update(p.replace(root, '')); h.update(readFileSync(p)) }
  for (const f of readdirSync(UI_SRC).filter((f) => f.endsWith('.tsx')).sort()) add(join(UI_SRC, f))
  for (const axis of readdirSync(AXES_DIR).sort()) for (const f of readdirSync(join(AXES_DIR, axis)).sort()) add(join(AXES_DIR, axis, f))
  for (const p of [BASE_CSS, join(root, 'registry', 'factory', 'styles', 'compat.json'), fileURLToPath(import.meta.url),
    join(root, 'factory', 'scripts', 'compile-styles.mjs'), join(root, 'factory', 'scripts', 'axes.mjs'), join(root, 'node_modules', 'shadcn', 'package.json')]) add(p)
  return h.digest('hex')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const t0 = Date.now()
  const hash = inputsHash()
  if (!process.argv.includes('--force') && existsSync(join(OUT, 'gallery.tsx')) && existsSync(HASH_FILE) && readFileSync(HASH_FILE, 'utf8') === hash) {
    console.log(`gen-axes-gallery: 입력이 그대로다 — 건너뜀 (${hash.slice(0, 12)}, 다시 만들려면 --force)`)
    process.exit(0)
  }
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const base = await loadStyleMap([BASE_CSS])
  const values = listValues()
  const byId = Object.fromEntries(values.map((v) => [v.id, v]))
  const imports = [], groups = {}
  for (const v of values) {
    const withIds = COMPANIONS[v.id] ?? []
    const sel = Object.fromEntries([v, ...withIds.map((id) => byId[id])].map((x) => [x.axis, x.id]))
    const bad = checkCompat(sel)
    if (bad.length) throw new Error(`${v.id} 짝 ${withIds.join('·')} 이 호환표에 어긋난다: ${bad.join(' / ')}`)
    // 적용 순서는 레시피와 같다(AXIS_ORDER).
    const layers = [v, ...withIds.map((id) => byId[id])].sort((a, b) => AXIS_ORDER.indexOf(a.axis) - AXIS_ORDER.indexOf(b.axis))
    const map = Object.assign({}, base, ...layers.map((x) => styleMapOf(x.file)))
    const uiDir = join(OUT, v.slug, 'ui')
    await compileDir(UI_SRC, uiDir, map)
    // 컴파일본끼리의 import 를 같은 폴더로 돌린다(기본 ui/ 가 섞이지 않게).
    for (const f of readdirSync(uiDir).filter((f) => f.endsWith('.tsx'))) {
      const p = join(uiDir, f)
      writeFileSync(p, readFileSync(p, 'utf8').replaceAll('"@/registry/factory/ui/', '"./'))
    }
    const note = (readFileSync(v.file, 'utf8').match(/\/\* (?:생성물[^\n]*\n\/\* )?([^\n]*?)(?: — |\. |$)/) ?? [])[1] ?? v.id
    const mods = [...new Set(MODULES[v.axis])]
    for (const m of mods) imports.push(`import * as ${ident(`${v.slug}_${m}`)} from "./${v.slug}/ui/${m}"`)
    ;(groups[v.axis] ??= []).push(`  { id: ${JSON.stringify(v.id)}, slug: ${JSON.stringify(v.slug)}, note: ${JSON.stringify(note)}, with: ${JSON.stringify(withIds)}, ui: { ${mods.map((m) => `${JSON.stringify(m)}: ${ident(`${v.slug}_${m}`)}`).join(', ')} } },`)
  }
  const body = [
    GENERATED.replace('compile-styles.mjs', 'gen-axes-gallery.mjs'),
    '// 축 값 목록 — app/qa/axes/page.tsx 가 읽는다. 값마다 base.css + 그 값 CSS(+ with 의 짝 값)로 컴파일한 부품.',
    ...imports,
    '',
    ...Object.entries(groups).map(([axis, rows]) => `export const ${axis} = [\n${rows.join('\n')}\n]`),
    '',
  ].join('\n')
  writeFileSync(join(OUT, 'gallery.tsx'), body)
  writeFileSync(HASH_FILE, hash)
  console.log(`gen-axes-gallery: 값 ${values.length}개 → .tmp/axes/<값>/ui, 목록 .tmp/axes/gallery.tsx (${Date.now() - t0}ms)`)
}
