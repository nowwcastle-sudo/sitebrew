// registry/<항목>/item.json(원천) → registry.json(shadcn 레지스트리 색인) + registry/dist/<항목>.json(파일 내용을 넣은 설치용 항목).
// 사용법: node scripts/gen-registry.mjs          (쓴다)
//         node scripts/gen-registry.mjs --check  (디스크와 다르면 종료 1 — CI·게이트용)
//
// 스키마: https://ui.shadcn.com/docs/registry/registry-item-json (확인 2026-09-30). registry:file 은 target 이 필수다.
// CLI 는 스크립트를 돌리지 않는다("The CLI does not execute scripts") — 설치 뒤 할 일(마이그레이션 명령)은 docs 에 적는다.
//
// 항목의 값은 사람이 적지 않고 워크스페이스에서 끌어온다(어긋나면 생성이 던진다):
//   - dependencies: `@launch-factory/*` 는 그 패키지의 package.json 판, 그 밖은 워크스페이스 패키지들이 정확히 고정한 판(서로 다르면 던진다)
//   - 스키마 조각·마이그레이션 SQL 은 packages/db 원본을 그대로 싣는다(복사본을 두지 않는다 → 어긋날 수 없다)
//   - meta.launch.tables 는 스키마 조각의 pgTable 이름에서 뽑는다
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, posix, relative } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = fileURLToPath(new URL("..", import.meta.url))
export const REGISTRY_NAME = "launch-factory"
export const NAMESPACE = "@launch-factory"
export const ITEM_SCHEMA = "https://ui.shadcn.com/schema/registry-item.json"
export const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json"
export const HOMEPAGE = "https://github.com/nowwcastle-sudo/sitebrew"
/** 설치 순서(의존이 앞에 온다) */
export const ITEM_ORDER = [
  "feature-email-resend",
  "feature-analytics-posthog",
  "feature-auth-betterauth",
  "feature-security",
  "feature-billing-paddle",
  "feature-billing-gumroad",
  "feature-inquiry",
  "feature-consents",
  "feature-admin",
  "feature-account-lifecycle",
]

const slash = (p) => p.split("\\").join("/")
const read = (rel, root) => readFileSync(join(root, rel), "utf8")
const readJson = (rel, root) => JSON.parse(read(rel, root))

/** 워크스페이스 패키지 목록: { name, version, dependencies, dir } */
export function workspacePackages(root = ROOT) {
  return readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, "packages", d.name, "package.json")))
    .map((d) => ({ dir: `packages/${d.name}`, ...readJson(`packages/${d.name}/package.json`, root) }))
}

/** 이름 → "이름@정확한 판" */
export function pin(name, packages) {
  const own = packages.find((p) => p.name === name)
  if (name.startsWith(`${NAMESPACE}/`)) {
    if (!own) throw new Error(`unknown workspace package ${name}`)
    return `${name}@${own.version}`
  }
  const versions = new Set(packages.map((p) => p.dependencies?.[name]).filter(Boolean))
  if (versions.size !== 1) throw new Error(`cannot pin ${name}: workspace declares ${versions.size} different versions (${[...versions].join(", ") || "none"})`)
  const [version] = versions
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`${name}@${version} is not an exact version`)
  return `${name}@${version}`
}

/** 파일 원천 경로 → 설치 위치. `files/` 또는 `_shared/` 아래 경로가 그대로 앱 루트 기준 위치다 */
export function targetOf(source) {
  const m = /(?:^|\/)(?:files|_shared)\/(.+)$/.exec(slash(source))
  if (!m) throw new Error(`file ${source} must live under files/ or _shared/`)
  return m[1]
}

/** 항목과 그 registryDependencies 가 싣는 항목 이름 전체 */
function closureItems(name, root, seen = new Set()) {
  if (seen.has(name)) return seen
  seen.add(name)
  for (const d of readJson(`registry/${name}/item.json`, root).registryDependencies ?? []) closureItems(d, root, seen)
  return seen
}

/**
 * 설치하는 앱이 손으로 맞춰야 하는 설정(대장 D183·D184). 패키지는 TypeScript 원본을 내보내므로 쓰는 `@launch-factory/*` 는 전이 의존까지 모두
 * next.config 의 transpilePackages 에 적어야 한다(빠지면 next build 가 실패한다). 목록은 워크스페이스 package.json 의 의존에서 만든다.
 * shadcn CLI 는 npm install 로 의존을 넣으므로 .npmrc save-exact=true 가 없으면 ^ 범위가 적힌다.
 */
export function setupOf(name, root = ROOT) {
  const packages = workspacePackages(root)
  const ours = new Set()
  const queue = [...closureItems(name, root)].flatMap((n) => readJson(`registry/${n}/item.json`, root).npm ?? []).filter((n) => n.startsWith(`${NAMESPACE}/`))
  while (queue.length) {
    const n = queue.pop()
    if (ours.has(n)) continue
    const own = packages.find((p) => p.name === n)
    if (!own) throw new Error(`unknown workspace package ${n}`)
    ours.add(n)
    for (const d of Object.keys(own.dependencies ?? {})) if (d.startsWith(`${NAMESPACE}/`)) queue.push(d)
  }
  return {
    npmrc: ["save-exact=true"],
    transpilePackages: [...ours].sort(),
    serverExternalPackages: ours.has(`${NAMESPACE}/db`) ? ["@electric-sql/pglite"] : [],
  }
}

const setupDoc = (setup) =>
  `공통 설정(자동 생성 — 설치하는 항목이 여럿이면 합집합): 앱 루트 .npmrc 에 ${setup.npmrc.join(", ")}. next.config.ts 의 transpilePackages: ${JSON.stringify(setup.transpilePackages)}` +
  (setup.serverExternalPackages.length ? `, serverExternalPackages: ${JSON.stringify(setup.serverExternalPackages)}` : "") +
  "."

export const tablesOf = (schemaSource) => [...schemaSource.matchAll(/pgTable\(\s*"([a-z_]+)"/g)].map((m) => m[1])

function entrypoints(files) {
  const routes = files.filter((f) => /^app\/api\/.+\/route\.ts$/.test(f.target)).map((f) => f.target)
  const actions = files.filter((f) => f.target.startsWith("app/actions/") && /^["']use server["']/.test(f.content)).map((f) => f.target)
  return { routes, actions }
}

export function buildItem(name, root = ROOT) {
  const packages = workspacePackages(root)
  const src = readJson(`registry/${name}/item.json`, root)
  if (src.name !== name) throw new Error(`registry/${name}/item.json name is ${src.name}`)
  const files = []
  const add = (path, target, content) => {
    if (files.some((f) => f.target === target)) throw new Error(`${name}: duplicate target ${target}`)
    files.push({ path, type: "registry:file", target, content })
  }
  for (const f of src.files ?? []) {
    const path = posix.normalize(posix.join(`registry/${name}`, f))
    add(path, targetOf(f), read(path, root))
  }
  const tables = []
  const schema = []
  for (const s of src.schema ?? []) {
    const path = `packages/db/src/schema/${s}`
    const content = read(path, root)
    add(path, `db/schema/${s}`, content)
    schema.push(`db/schema/${s}`)
    tables.push(...tablesOf(content))
  }
  const migrations = []
  if (src.migrations) {
    const dir = join(root, "packages/db/migrations")
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
      add(`packages/db/migrations/${f}`, `db/migrations/${f}`, read(`packages/db/migrations/${f}`, root))
      migrations.push(`db/migrations/${f}`)
    }
    add("packages/db/migrations/meta/_journal.json", "db/migrations/meta/_journal.json", read("packages/db/migrations/meta/_journal.json", root))
  }
  const setup = setupOf(name, root)
  const item = {
    $schema: ITEM_SCHEMA,
    name,
    type: "registry:item",
    title: src.title,
    description: src.description,
    dependencies: (src.npm ?? []).map((n) => pin(n, packages)),
    registryDependencies: (src.registryDependencies ?? []).map((n) => `${NAMESPACE}/${n}`),
    files,
    envVars: Object.fromEntries((src.envVars ?? []).map((n) => [n, ""])),
    docs: [...(src.docs ?? []), setupDoc(setup)].join("\n"),
    meta: { launch: { tables: [...new Set(tables)].sort(), schema, migrations, ...entrypoints(files), noEntrypointReason: src.noEntrypointReason ?? null, setup } },
  }
  return item
}

const stringify = (value) => `${JSON.stringify(value, null, 2)}\n`

/** { "registry.json": 문자열, "registry/dist/<이름>.json": 문자열 } — 디스크에 있어야 할 생성물 전부 */
export function generate(root = ROOT) {
  const out = {}
  const index = { $schema: REGISTRY_SCHEMA, name: REGISTRY_NAME, homepage: HOMEPAGE, items: [] }
  for (const name of ITEM_ORDER) {
    const item = buildItem(name, root)
    out[`registry/dist/${name}.json`] = stringify(item)
    index.items.push({ ...item, files: item.files.map(({ path, type, target }) => ({ path, type, target })) })
  }
  out["registry.json"] = stringify(index)
  return out
}

export function main(argv = process.argv.slice(2), root = ROOT) {
  const check = argv.includes("--check")
  const want = generate(root)
  const distDir = join(root, "registry/dist")
  const onDisk = existsSync(distDir) ? readdirSync(distDir).map((n) => `registry/dist/${n}`) : []
  const stale = onDisk.filter((p) => !(p in want))
  const problems = []
  for (const [path, text] of Object.entries(want)) {
    const abs = join(root, path)
    if (!existsSync(abs) || readFileSync(abs, "utf8") !== text) problems.push(path)
  }
  if (check) {
    for (const p of stale) problems.push(`${p} (없어야 하는 파일)`)
    if (problems.length) {
      console.error(`registry 생성물이 원천과 다릅니다(${problems.length}개): ${problems.join(", ")} — npm run registry:build`)
      return 1
    }
    console.log(`registry 최신: 항목 ${ITEM_ORDER.length}개, 파일 ${Object.keys(want).length}개`)
    return 0
  }
  mkdirSync(distDir, { recursive: true })
  for (const p of stale) rmSync(join(root, p))
  for (const [path, text] of Object.entries(want)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  console.log(`registry 생성: 항목 ${ITEM_ORDER.length}개 → ${relative(root, join(root, "registry.json"))} + registry/dist/`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main()
