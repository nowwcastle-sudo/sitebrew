// 층 폴더의 원본 파일 → shadcn registry.json. 사용: node factory/scripts/gen-registry.mjs [--ref <태그> | --ref=<태그>]
// --ref 를 주면 registryDependencies 를 <repo>/<이름>#<태그> 로 고정한다(shadcn은 ref 없는 주소를 HEAD로 읽는다).
// npm 의존은 package.json 의 버전 범위로 고정한다(pkg@^x.y.z). 버전이 이미 붙은 의존은 그대로 둔다.
// 레시피 층 r(registry/factory/r/registry.json)은 recipe.mjs recipeRegistry() 가 만든다 — npm run gen:all 순서(recipe → gen-registry)로 돌린다.
// CSS 층(themes·base)은 파일을 내보내지 않고 CSS를 읽어 cssVars·css 로 바꾼다 — shadcn 은 이 두 필드만 globals.css 에 합친다.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, relative, basename, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE_ITEM, parseImports, pinDependency, parseRef, parseCss } from './lib/registry-lib.mjs'

export { BASE_ITEM, parseImports, pinDependency, parseRef, parseCss }

const TYPE = { ui: 'registry:ui', lib: 'registry:lib', hooks: 'registry:hook', themes: 'registry:theme', base: 'registry:item', contract: 'registry:lib', content: 'registry:lib', ax: 'registry:lib' }
// ax 층의 .tsx(JsonLd)는 컴포넌트다. 모양 훅이 있는 셸(site-shell)은 레시피마다 컴파일되도록 ui-src 에 있다(Task 11).
const TSX_TYPE = { ax: 'registry:component' }
// 계약 층(Task 10)은 registry:lib 이지만 소비자의 lib 가 아니라 components/contract 에 둔다 — shadcn 은 aliases 에 없는
// @/registry/factory/contract/… import 를 @/components/contract/… 로 바꾸므로 파일 자리를 거기에 맞춘다(아이콘 키트와 같은 방식).
const TARGET = { contract: (f) => `@components/contract/${f}`, content: (f) => `@components/content/${f}`, ax: (f) => `@components/ax/${f}` }
// 층 안의 하위 폴더 → 항목 이름 접두어. content/schemas/<원형>.ts 는 항목 content-<원형>, 소비자 자리 components/content/schemas/<원형>.ts(Task 11).
const SUBDIRS = { content: { schemas: 'content-' } }
// 층 안의 하위 폴더 → 파일 여럿을 묶은 항목 하나. contract/conformance/*.ts 는 항목 contract-conformance(어댑터 적합성 묶음, P3-3 Task 15),
// 소비자 자리 components/contract/conformance/<파일>. 묶음 안 파일끼리는 상대 경로(./…)로 부른다 — 하위 경로 @/registry/… import 는 멈춘다.
const BUNDLES = { contract: { conformance: 'contract-conformance' } }
const CSS_LAYERS = new Set(['themes', 'base'])

// 규칙 트리 → shadcn registry-item 의 css 객체({ "@layer base": { "body": { "font-size": "1rem" } } }).
const toCssObject = (rules) => Object.fromEntries(rules.map((r) => [r.sel, { ...Object.fromEntries(r.decls), ...toCssObject(r.children) }]))

// 테마 CSS: :root 의 --변수 → cssVars.light, .dark → cssVars.dark, @theme(inline) → cssVars.theme.
// 변수가 아닌 선언(color-scheme 등)은 같은 선택자로 css 에 남긴다.
export function themeFromCss(source) {
  const SLOT = { ':root': 'light', '.dark': 'dark', '@theme': 'theme', '@theme inline': 'theme' }
  const cssVars = {}, css = {}
  for (const r of parseCss(source)) {
    const slot = SLOT[r.sel]
    if (!slot || r.children.length) throw new Error(`테마 CSS에 예상 밖 규칙이 있습니다: ${r.sel}`)
    for (const [p, v] of r.decls) {
      if (p.startsWith('--')) (cssVars[slot] ??= {})[p.slice(2)] = v
      else (css[r.sel] ??= {})[p] = v
    }
  }
  return { cssVars, css }
}

export function buildItems(layerDir, layer, repo, root = layerDir, ref, versions) {
  const pin = ref ? `#${ref}` : ''
  // 항목 이름 순으로 정렬 — 파일 시스템마다 readdirSync 순서가 달라 생성물 diff 가 흔들리지 않게.
  const stem = (f) => basename(f, extname(f))
  const list = (dir) => readdirSync(dir).filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith('.test.ts'))
  const entries = [
    ...list(layerDir).map((f) => ({ fs: [f], name: stem(f) })),
    ...Object.entries(SUBDIRS[layer] ?? {}).flatMap(([sub, prefix]) =>
      existsSync(join(layerDir, sub)) ? list(join(layerDir, sub)).map((f) => ({ fs: [`${sub}/${f}`], name: prefix + stem(f) })) : []),
    ...Object.entries(BUNDLES[layer] ?? {}).flatMap(([sub, name]) =>
      existsSync(join(layerDir, sub)) ? [{ fs: list(join(layerDir, sub)).sort().map((f) => `${sub}/${f}`), name }] : []),
  ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const typeOf = (f) => (f.endsWith('.tsx') && TSX_TYPE[layer]) || TYPE[layer]
  return entries.map(({ fs, name }) => {
    const sources = fs.map((f) => readFileSync(join(layerDir, f), 'utf8'))
    const type = typeOf(fs[0])
    const head = { name, type, title: name, description: `web-factory ${layer}: ${name}` }
    if (CSS_LAYERS.has(layer)) {
      const body = layer === 'themes' ? themeFromCss(sources[0]) : { css: toCssObject(parseCss(sources[0])) }
      if (body.css && !Object.keys(body.css).length) delete body.css
      return { ...head, ...body }
    }
    const imports = sources.map((src) => parseImports(src))
    const npm = [...new Set(imports.flatMap((i) => i.npm))]
    const deps = [...new Set(imports.flatMap((i) => i.internal))].filter((d) => d !== name)
    if (layer === 'ui') deps.push(BASE_ITEM)
    const fileOf = (f) => ({ path: relative(root, join(layerDir, f)).split('\\').join('/'), type: typeOf(f), ...(TARGET[layer] && { target: TARGET[layer](f) }) })
    return {
      ...head,
      files: fs.map(fileOf),
      dependencies: npm.sort().map((d) => pinDependency(d, versions)),
      registryDependencies: deps.sort().map((d) => `${repo}/${d}${pin}`),
    }
  })
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const REPO = 'nowwcastle-sudo/sitebrew'
  const REF = parseRef(process.argv.slice(2))
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
  const versions = { ...pkg.devDependencies, ...pkg.dependencies }
  for (const layer of ['ui', 'lib', 'hooks', 'themes', 'base', 'contract', 'content', 'ax']) {
    const dir = join(repoRoot, 'registry', 'factory', layer)
    if (!existsSync(dir)) continue
    const items = buildItems(dir, layer, REPO, dir, REF, versions)
    writeFileSync(join(dir, 'registry.json'), JSON.stringify({ $schema: 'https://ui.shadcn.com/schema/registry.json', items }, null, 2) + '\n')
    console.log(layer, items.length)
  }
  // 레시피 층(r): recipe.mjs 가 컴파일해 둔 r/<id>/ui 와 recipes/<id>/DESIGN.md → 부품·registry:base·registry:theme 항목.
  // 다른 층을 다 쓴 뒤에 돈다(항목 이름 충돌·있는 키트 항목을 방금 쓴 층에서 읽는다). 동적 import 로 순환 의존을 피한다.
  const { recipeRegistry } = await import('./recipe.mjs')
  const rDir = join(repoRoot, 'registry', 'factory', 'r')
  const rItems = recipeRegistry({ repo: REPO, ref: REF, versions, root: repoRoot })
  mkdirSync(rDir, { recursive: true })
  writeFileSync(join(rDir, 'registry.json'), JSON.stringify({ $schema: 'https://ui.shadcn.com/schema/registry.json', items: rItems }, null, 2) + '\n')
  console.log('r', rItems.length)
}
