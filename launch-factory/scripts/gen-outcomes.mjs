// features/outcomes.yaml(원본) + 패키지·레지스트리 → features/outcomes.generated.json(web-factory 가 읽는 기능 표).
// 사용법: node scripts/gen-outcomes.mjs          (쓴다)
//         node scripts/gen-outcomes.mjs --check  (생성본과 다르면 종료 1 — CI·게이트용)
// 원본에 없는 값(closure·needs·routes·hash)은 여기서 계산한다. 목록·문장은 이 파일에 두지 않는다.
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"
import { ROOT, workspacePackages } from "./gen-registry.mjs"

export { ROOT }
export const SOURCE = "features/outcomes.yaml"
export const OUT = "features/outcomes.generated.json"
const NAMESPACE = "@launch-factory/"
const GUIDE = /^G-[a-z]+(?:-[a-z]+)*$/

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), "utf8"))
const uniq = (list) => [...new Set(list)]
const sorted = (list) => [...list].sort()

// ── 읽기 ──────────────────────────────────────────────────────────
export const readSource = (root) => parse(readFileSync(join(root, SOURCE), "utf8"))

/** 패키지 폴더 이름 → 그 패키지가 런타임으로 쓰는 워크스페이스 패키지 이름들 */
export const readPackages = (root) =>
  new Map(
    workspacePackages(root).map((p) => [
      p.dir.replace("packages/", ""),
      Object.keys(p.dependencies ?? {}).filter((n) => n.startsWith(NAMESPACE)).map((n) => n.slice(NAMESPACE.length)),
    ]),
  )

function envVarsOf(name, item) {
  if (!Array.isArray(item.envVars)) throw new Error(`registry/${name}/item.json: envVars 배열이 없다`)
  return item.envVars
}

/** registry 항목 이름 → envVars */
export const readItems = (root) =>
  new Map(
    readdirSync(join(root, "registry"))
      .filter((d) => existsSync(join(root, "registry", d, "item.json")))
      .map((d) => [d, envVarsOf(d, readJson(root, `registry/${d}/item.json`))]),
  )

/** registry 항목 이름 → meta.launch.routes */
export const readRegistryRoutes = (root) =>
  new Map(readJson(root, "registry.json").items.map((i) => [i.name, i.meta?.launch?.routes ?? []]))

export const readFacts = (root) => ({
  packages: readPackages(root),
  items: readItems(root),
  routes: readRegistryRoutes(root),
  hasPage: (file) => existsSync(join(root, "template", file)),
})

// ── 검사 ──────────────────────────────────────────────────────────
function checkKnown(label, names, known) {
  for (const n of names) if (!known.has(n)) throw new Error(`${SOURCE}: ${label} 에 모르는 이름 ${n}`)
}

export function checkSource(source, facts) {
  const partNames = new Set(Object.keys(source.parts))
  const ids = new Set(source.outcomes.map((o) => o.id))
  if (ids.size !== source.outcomes.length) throw new Error(`${SOURCE}: outcomes 에 같은 id 가 둘 이상 있다`)
  checkKnown("infra", source.infra, facts.packages)
  checkKnown("productParts", source.productParts, facts.packages)
  checkKnown("parts", partNames, facts.packages)
  for (const e of source.baseEnv) {
    if (![...facts.items.values()].every((vars) => vars.includes(e))) throw new Error(`${SOURCE}: baseEnv ${e} 가 모든 feature 항목 envVars 에 있지 않다`)
  }
  for (const [name, part] of Object.entries(source.parts)) {
    if (part.feature && !facts.items.has(part.feature)) throw new Error(`${SOURCE}: parts.${name}.feature ${part.feature} 항목이 registry 에 없다`)
    for (const g of part.guides) if (!GUIDE.test(g)) throw new Error(`${SOURCE}: parts.${name} 안내 번호 ${g} 형식이 G-[a-z]+(-[a-z]+)* 가 아니다`)
  }
  for (const page of source.pages) {
    checkKnown("pages.owners", page.owners, partNames)
    for (const f of page.files) if (!facts.hasPage(f)) throw new Error(`${SOURCE}: pages 의 ${f} 파일이 template/ 에 없다`)
  }
  for (const o of source.outcomes) {
    for (const field of ["say", "question"]) {
      for (const lang of ["ko", "en"]) if (!o[field]?.[lang]) throw new Error(`${SOURCE}: outcomes.${o.id}.${field}.${lang} 문장이 없다`)
    }
    checkKnown(`outcomes.${o.id}.parts`, o.parts, partNames)
    checkKnown(`outcomes.${o.id}.requires`, o.requires ?? [], ids)
  }
}

// ── 계산 ──────────────────────────────────────────────────────────
/** 부품들이 런타임으로 끌어오는 워크스페이스 패키지 전부(infra 는 호출 쪽이 뺀다) */
export function closureOf(parts, packages) {
  const seen = new Set()
  const visit = (name) => {
    for (const dep of packages.get(name) ?? []) {
      if (seen.has(dep)) continue
      seen.add(dep)
      visit(dep)
    }
  }
  parts.forEach(visit)
  return seen
}

export function needsOf(names, source, items) {
  const vars = names.flatMap((n) => items.get(source.parts[n]?.feature) ?? [])
  return sorted(uniq(vars).filter((v) => !source.baseEnv.includes(v)))
}

/** 템플릿 파일 경로 → 방문자가 보는 주소: 라우트 그룹 (x) 과 파일 이름을 뗀다 */
export const urlOf = (file) => "/" + file.split("/").slice(1, -1).filter((seg) => !/^\(.*\)$/.test(seg)).join("/")

/** 같은 파일의 주인을 합쳐 file 순서 그대로 낸다 */
function collectOwners(entries) {
  const byFile = new Map()
  for (const { file, owners } of entries) byFile.set(file, uniq([...(byFile.get(file) ?? []), ...owners]))
  return [...byFile].map(([file, owners]) => ({ file, url: urlOf(file), owners }))
}

export const pageOwnersOf = (source) =>
  collectOwners(source.pages.flatMap((p) => p.files.map((file) => ({ file, owners: p.owners }))))

export function routeOwnersOf(source, routes) {
  const entries = Object.entries(source.parts).flatMap(([part, { feature }]) => (routes.get(feature) ?? []).map((file) => ({ file, owners: [part] })))
  return collectOwners(entries)
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    .map((r) => ({ ...r, cron: r.file.startsWith("app/api/cron/") }))
}

function outcomeOf(o, index, source, facts) {
  const closure = sorted([...closureOf(o.parts, facts.packages)].filter((n) => !source.infra.includes(n)))
  checkKnown(`outcomes.${o.id} closure`, closure, new Set(Object.keys(source.parts)))
  return {
    id: o.id,
    order: index + 1,
    say: o.say,
    question: o.question,
    archetypes: o.archetypes,
    parts: o.parts,
    requires: o.requires ?? [],
    closure,
    needs: needsOf(uniq([...o.parts, ...closure]), source, facts.items),
    // 안내 번호는 부품 자신 것만 모은다 — closure 부품의 안내는 그 부품의 질문 줄이 가져온다(계획 설계)
    guides: uniq(o.parts.flatMap((p) => source.parts[p].guides)),
    product: o.parts.some((p) => source.productParts.includes(p)),
  }
}

export function buildTable(source, facts) {
  checkSource(source, facts)
  const body = {
    version: 1,
    outcomes: source.outcomes.map((o, i) => outcomeOf(o, i, source, facts)),
    pages: pageOwnersOf(source),
    routes: routeOwnersOf(source, facts.routes),
  }
  const hash = createHash("sha256").update(render(body)).digest("hex").slice(0, 12)
  return { version: body.version, hash, outcomes: body.outcomes, pages: body.pages, routes: body.routes }
}

// ── 쓰기 ──────────────────────────────────────────────────────────
export const render = (table) => JSON.stringify(table, null, 2) + "\n"

export function main(argv = process.argv.slice(2), root = ROOT, out = join(root, OUT)) {
  const text = render(buildTable(readSource(root), readFacts(root)))
  if (argv.includes("--check")) {
    const same = existsSync(out) && readFileSync(out, "utf8") === text
    if (same) console.log(`${OUT} 최신`)
    else console.error(`${OUT} 가 원본과 다르다 — npm run outcomes:gen`)
    return same ? 0 : 1
  }
  writeFileSync(out, text)
  console.log(`${OUT} 썼다`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main()
