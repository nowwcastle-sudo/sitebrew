// 부품 원천(cn-* 훅) + 스타일 CSS(.cn-* { @apply }) → 컴파일된 부품. shadcn/utils 의 createStyleMap·transformStyle 을 쓴다.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStyleMap, transformStyle } from 'shadcn/utils'

// CSS·MD 생성기가 쓰는 머리줄. 컴파일한 .tsx 에는 붙이지 않는다 — 설치하는 쪽 파일까지 따라가기 때문이다.
export const GENERATED = '// 생성물 — factory/scripts/compile-styles.mjs 로 다시 만든다. 손으로 고치지 않는다.'
// 생성물 폴더 표지 파일. 부품 파일 대신 폴더에 둔다.
export const MARKER = 'GENERATED.md'
export const markerText = (srcDir) => `${GENERATED.replace(/^\/\/ /, '')} 원천: ${srcDir.split('\\').join('/')}\n`

export async function loadStyleMap(cssPaths) {
  const map = {}
  for (const p of cssPaths) Object.assign(map, createStyleMap(readFileSync(p, 'utf8')))
  return map
}

// 아이콘 정본 모듈(@/registry/factory/icons) → 어댑터(@/registry/factory/icons/<adapter>). 기본 모양은 lucide(ui/ 의 아이콘은 그대로),
// 레시피는 recipe.mjs 가 icons.library·weight 로 고른 어댑터를 넘긴다(판정 T9-icons).
export const ICONS_MODULE = '@/registry/factory/icons'
export const iconImports = (source, adapter = 'lucide') =>
  source.replace(/(from\s+)(["'])@\/registry\/factory\/icons\2/g, `$1$2${ICONS_MODULE}/${adapter}$2`)

export async function compileSource(tsx, styleMap, { iconAdapter = 'lucide' } = {}) {
  return iconImports(await transformStyle(tsx, { styleMap }), iconAdapter)
}

export async function compileDir(srcDir, outDir, styleMap) {
  mkdirSync(outDir, { recursive: true })
  const src = readdirSync(srcDir).filter((f) => f.endsWith('.tsx'))
  for (const f of readdirSync(outDir).filter((f) => f.endsWith('.tsx') && !src.includes(f))) rmSync(join(outDir, f))
  for (const f of src) writeFileSync(join(outDir, f), await compileSource(readFileSync(join(srcDir, f), 'utf8'), styleMap))
  writeFileSync(join(outDir, MARKER), markerText(srcDir))
  return { files: src.length }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const a = process.argv.slice(2)
  const get = (k) => {
    const i = a.indexOf(k)
    if (i === -1) return undefined
    const v = a[i + 1]
    return v === undefined || v.startsWith('--') ? undefined : v
  }
  const css = a.flatMap((x, i) => (x === '--css' ? [a[i + 1]] : []))
  // --css 가 마지막 인자이거나 값 대신 다른 플래그가 오면 인자 오류(2)다 — 없는 파일을 읽다 1로 끝나지 않게(Task 2 CLI 규약).
  if (!get('--src') || !get('--out') || !css.length || css.some((c) => c === undefined || c.startsWith('--'))) { console.error('사용: --src <dir> --out <dir> --css <file> [...]'); process.exit(2) }
  const r = await compileDir(get('--src'), get('--out'), await loadStyleMap(css))
  console.log(`compile-styles: ${r.files}개 → ${get('--out')}`)
}
