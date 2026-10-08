// 설치 닫힘 탐침(최종 리뷰 I1·권고 2): 레지스트리 항목 하나를 소비자에 `add` 하면 깔리는 파일 묶음(registryDependencies 닫힘) 안에서
// 모든 import 가 풀리는지, npm import 가 dependencies 에 선언됐는지 네트워크 없이 본다.
//   ① 빌드 출력: `shadcn build` 가 쓰는 것과 같은 항목(루트 registry.json include → 항목마다 파일 내용 인라인)을 저장소에서 바로 만든다.
//      실제 빌드 출력 폴더를 --build <dir> 로 주면 그것을 읽는다(`npm run registry:check` 가 .tmp/r 에 쓴다).
//   ② 닫힘: registryDependencies 를 이름으로 따라간다(`nowwcastle-sudo/sitebrew/<이름>#<태그>` → <이름>).
//   ③ 설치 자리와 import 바꾸기: shadcn 4.21.0 을 그대로 옮겼다 — 파일 자리는 add 의 `ar`·`wl`·`xl`·`bl`,
//      import 는 `updateImportAliases`(`Jc`)다(node_modules/shadcn/dist/chunk-B2MD6U5O.js). 소비자는 `shadcn init` 기본 aliases.
//   ④ 판정: 바꾼 `@/…` import 가 닫힘이 까는 파일 하나에 떨어지는가 · npm import 가 닫힘의 dependencies 에 있는가.
// 사용: node factory/scripts/install-closure.mjs [--build <dir>]   종료 코드 0 = 문제 없음, 1 = 풀리지 않는 import·선언 안 된 npm·없는 의존이 있다.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REPO_PREFIX = 'nowwcastle-sudo/sitebrew/'
// 소비자 쪽에 늘 있는 패키지(registry-lib BUILTIN 과 같다).
const BUILTIN = new Set(['react', 'react-dom', 'next'])

// `shadcn init` 기본 components.json 의 aliases 와 그 실제 자리(cwd 기준, src 폴더 없음).
export const CONSUMER = {
  aliases: { components: '@/components', ui: '@/components/ui', lib: '@/lib', hooks: '@/hooks', utils: '@/lib/utils' },
  resolvedPaths: { components: 'components', ui: 'components/ui', lib: 'lib', hooks: 'hooks', utils: 'lib/utils' },
  css: 'app/globals.css', // components.json tailwind.css(init -t next 기본) — 항목 css 필드가 들어가는 파일
}
const ALIAS_KEYS = ['components', 'ui', 'lib', 'hooks']

// ① 저장소 → 빌드 출력과 같은 모양의 항목들(path 는 저장소 루트 기준 posix, content 인라인).
export function buildItems(root = ROOT) {
  const reg = JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8'))
  const items = []
  for (const inc of reg.include) {
    const dir = posix.dirname(inc)
    for (const it of JSON.parse(readFileSync(join(root, inc), 'utf8')).items) {
      const files = (it.files ?? []).map((f) => {
        const path = posix.join(dir, f.path)
        return { ...f, path, content: readFileSync(join(root, path), 'utf8') }
      })
      items.push({ ...it, files })
    }
  }
  return items
}

// 실제 `shadcn build -o <dir>` 출력(항목마다 <이름>.json, 목록 registry.json 은 뺀다).
export function readBuildDir(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'registry.json').map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
}

const depName = (d) => (d.startsWith(REPO_PREFIX) ? d.slice(REPO_PREFIX.length) : d).replace(/#.*$/, '')

// ② 이름 → 닫힘 항목들(자기 포함). 없는 의존은 missing 으로.
export function closureOf(name, byName) {
  const seen = new Map(), missing = []
  const stack = [name]
  while (stack.length) {
    const n = stack.pop()
    if (seen.has(n)) continue
    const it = byName.get(n)
    if (!it) { missing.push(n); continue }
    seen.set(n, it)
    for (const d of it.registryDependencies ?? []) stack.push(depName(d))
  }
  return { items: [...seen.values()], missing }
}

// ③-a 파일이 깔리는 자리(shadcn `ar` — r.path 없는 add 경로).
export function installPath(file, cfg = CONSUMER) {
  const rp = cfg.resolvedPaths
  if (file.target) {
    if (file.target.startsWith('~/')) return file.target.slice(2)
    const m = file.target.match(/^@([^/]+)\/(.+)$/)
    if (m && ALIAS_KEYS.includes(m[1])) return posix.join(rp[m[1]], m[2])
    const t = m ? `${m[1]}/${m[2]}` : file.target
    return t.replace('src/', '')
  }
  const dir = file.type === 'registry:ui' ? rp.ui
    : file.type === 'registry:lib' ? rp.lib
      : file.type === 'registry:block' || file.type === 'registry:component' ? rp.components
        : file.type === 'registry:hook' ? rp.hooks : rp.components
  // shadcn `bl`: 원천 경로에서 설치 폴더의 마지막 이름을 찾으면 그 뒤를, 없으면 파일 이름만.
  const segs = file.path.replace(/^\/|\/$/g, '').split('/')
  const last = dir.replace(/^\/|\/$/g, '').split('/').pop()
  const k = segs.indexOf(last)
  return posix.join(dir, k === -1 ? segs[segs.length - 1] : segs.slice(k + 1).join('/'))
}

// ③-b import 바꾸기(shadcn `Jc`, isRemote=false, # aliases 없음).
export function rewriteImport(spec, cfg = CONSUMER) {
  const a = cfg.aliases
  if (!spec.startsWith('@/')) return spec
  if (spec === '@/registry') return a.components
  if (!spec.startsWith('@/registry/')) {
    if (spec === '@/lib/utils' && a.utils) return a.utils
    if (a.ui && /^@\/components\/ui(?=\/|$)/.test(spec)) return spec.replace(/^@\/components\/ui/, a.ui)
    if (a.components && /^@\/components(?=\/|$)/.test(spec)) return spec.replace(/^@\/components/, a.components)
    if (a.hooks && /^@\/hooks(?=\/|$)/.test(spec)) return spec.replace(/^@\/hooks/, a.hooks)
    if (a.lib && /^@\/lib(?=\/|$)/.test(spec)) return spec.replace(/^@\/lib/, a.lib)
    return spec.replace(/^@\//, `${a.components.split('/')[0]}/`)
  }
  if (/^@\/registry\/(.+)\/ui/.test(spec)) return spec.replace(/^@\/registry\/(.+)\/ui/, a.ui ?? `${a.components}/ui`)
  if (a.utils && /^@\/registry\/(.+)\/lib\/utils$/.test(spec)) return a.utils
  if (a.components && /^@\/registry\/(.+)\/components/.test(spec)) return spec.replace(/^@\/registry\/(.+)\/components/, a.components)
  if (a.lib && /^@\/registry\/(.+)\/lib/.test(spec)) return spec.replace(/^@\/registry\/(.+)\/lib/, a.lib)
  if (a.hooks && /^@\/registry\/(.+)\/hooks/.test(spec)) return spec.replace(/^@\/registry\/(.+)\/hooks/, a.hooks)
  return spec.replace(/^@\/registry\/[^/]+/, a.components)
}

const CODE = /\.(tsx?|jsx?)$/
const importsOf = (src) => [...src.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1])
const pkgOf = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0])
const depPkg = (d) => d.slice(0, d.lastIndexOf('@') > 0 ? d.lastIndexOf('@') : d.length)
const EXT = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']

// 블록(registry:block, meta.requires 'recipe' — P3-2)은 레시피 base 하나와 함께 설치한다: ui 부품·아이콘 어댑터는 레시피가 깐다.
// 그래서 블록의 닫힘은 「블록 항목 닫힘 + 레시피 base 닫힘」 묶음으로 본다. 기준 레시피는 r1-measure(모든 레시피 base 가 같은 부품 목록을 깐다).
export const RECIPE_BASE = 'r1-measure'
export const needsRecipe = (it) => it?.meta?.requires === 'recipe'

// ④ 항목 하나의 닫힘 판정.
export function checkItem(name, byName, cfg = CONSUMER, { recipeBase = RECIPE_BASE } = {}) {
  const own = closureOf(name, byName)
  const withRecipe = needsRecipe(byName.get(name)) ? closureOf(recipeBase, byName) : { items: [], missing: [] }
  const items = [...new Map([...own.items, ...withRecipe.items].map((it) => [it.name, it])).values()]
  const missing = [...new Set([...own.missing, ...withRecipe.missing])]
  const installed = new Set(items.flatMap((it) => (it.files ?? []).map((f) => installPath(f, cfg))))
  const declared = new Set(items.flatMap((it) => (it.dependencies ?? []).map(depPkg)))
  const unresolved = [], undeclared = []
  for (const it of items) {
    // css 필드의 상대 @import(Task 15 — 면 파일 styles/wf-fonts/<slug>.css): shadcn 은 문자열을 소비자 전역 CSS 에 그대로 넣는다 →
    // 전역 CSS 자리(cfg.css) 기준으로 풀어 닫힘이 까는 파일 하나에 떨어지는지 본다.
    for (const k of Object.keys(it.css ?? {})) {
      const spec = k.match(/^@import\s+"(\.{1,2}\/[^"]+)"$/)?.[1]
      if (!spec) continue
      const to = posix.join(posix.dirname(cfg.css), spec)
      if (!installed.has(to)) unresolved.push({ item: it.name, file: `${it.name} css`, spec, rewritten: to })
    }
    for (const f of it.files ?? []) {
      if (!CODE.test(f.path)) continue
      const at = installPath(f, cfg)
      for (const spec of importsOf(f.content)) {
        if (spec.startsWith('.') || spec.startsWith('@/')) {
          const to = spec.startsWith('.') ? posix.join(posix.dirname(at), spec) : rewriteImport(spec, cfg).replace(/^@\//, '')
          if (!EXT.some((e) => installed.has(to + e))) unresolved.push({ item: it.name, file: f.path, spec, rewritten: spec.startsWith('.') ? to : rewriteImport(spec, cfg) })
        } else if (!spec.startsWith('node:')) {
          const pkg = pkgOf(spec)
          if (!BUILTIN.has(pkg) && !declared.has(pkg)) undeclared.push({ item: it.name, file: f.path, pkg })
        }
      }
    }
  }
  return { unresolved, undeclared, missing }
}

// 모든 항목. 같은 문제가 여러 뿌리에서 보이므로 (파일·import) 한 종으로 묶어 센다.
export function checkAll(items, cfg = CONSUMER) {
  const byName = new Map(items.map((it) => [it.name, it]))
  const unresolved = new Map(), undeclared = new Map(), missing = new Map()
  const add = (map, key, root, v) => { if (!map.has(key)) map.set(key, { ...v, roots: [] }); map.get(key).roots.push(root) }
  for (const it of items) {
    const r = checkItem(it.name, byName, cfg)
    for (const u of r.unresolved) add(unresolved, `${u.file} → ${u.spec}`, it.name, u)
    for (const u of r.undeclared) add(undeclared, `${u.file} → ${u.pkg}`, it.name, u)
    for (const m of r.missing) add(missing, m, it.name, { name: m })
  }
  return { count: items.length, unresolved: [...unresolved.values()], undeclared: [...undeclared.values()], missing: [...missing.values()] }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const k = argv.indexOf('--build')
  const items = k >= 0 ? readBuildDir(argv[k + 1]) : buildItems()
  const r = checkAll(items)
  const show = (label, list, fmt) => { for (const x of list) console.log(`  ${label} ${fmt(x)} (뿌리 ${x.roots.length}개: ${x.roots.slice(0, 3).join(', ')}${x.roots.length > 3 ? ' …' : ''})`) }
  show('풀리지 않는 import', r.unresolved, (x) => `${x.file}: ${x.spec} → ${x.rewritten}`)
  show('선언 안 된 npm', r.undeclared, (x) => `${x.file}: ${x.pkg}`)
  show('없는 의존', r.missing, (x) => x.name)
  console.log(`install-closure: 항목 ${r.count}개(${k >= 0 ? `빌드 출력 ${argv[k + 1]}` : '저장소'}) · 풀리지 않는 import ${r.unresolved.length}종 · 선언 안 된 npm ${r.undeclared.length}종 · 없는 의존 ${r.missing.length}종`)
  process.exitCode = r.unresolved.length + r.undeclared.length + r.missing.length ? 1 : 0
}
