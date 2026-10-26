// vendor — @launch-factory/* 는 npm 에 게시 전이라 받을 수 없다. package.json 에 적힌 패키지(와 그 패키지 안에서 쓰는 패키지)를
// <lfDir>/packages/<p> 에서 출력 vendor/launch-factory/<p> 로 복사하고 package.json 은 상대 경로 file: 로 가리킨다(폴더를 옮기거나 배포해도 깨지지 않는다).
// 복사는 git 이 추적하는 파일만이다. 소스가 package.json 에 없는 @launch-factory 패키지를 import 하면 던진다 — 이 저장소에서는 워크스페이스가
// 풀어 주지만 출력에서는 없으면 빌드가 멈추므로, 템플릿 package.json 에 적는 것이 고치는 길이다. drop 블록이 지운 기능의 import 는 이미 없으므로 걸리지 않는다.
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { copyFileTo, listFiles, readJson, walk, withSecrets, writeJson } from "../lib.mjs"

export const id = "vendor"

const SECTIONS = ["dependencies", "devDependencies"]
const scoped = (pkg, scope) => SECTIONS.flatMap((s) => Object.keys(pkg[s] ?? {})).filter((n) => n.startsWith(scope))
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\"'`])\/\/[^\n]*/g, "$1")

/** 소스가 import 하는 `<scope><이름>`(하위 경로 import 는 이름만) → 이름: 파일 목록. 주석 안의 글자는 세지 않는다 */
function importedPackages(dir, scope, skip) {
  const spec = new RegExp(`["']${scope.replace(/[/]/g, "\\/")}([a-z0-9-]+)(?:\\/[^"']*)?["']`, "g")
  const found = new Map()
  for (const rel of walk(dir, skip).filter((f) => /\.(?:tsx?|jsx?|mjs)$/.test(f))) {
    for (const m of stripComments(readFileSync(join(dir, rel), "utf8")).matchAll(spec)) {
      const name = `${scope}${m[1]}`
      found.set(name, [...new Set([...(found.get(name) ?? []), rel])])
    }
  }
  return found
}

export function run(state) {
  const { scope, from, to: dest, exclude, scanSkip } = state.rules.steps.vendor
  const rootFile = join(state.to, "package.json")
  const root = readJson(rootFile)
  const declared = new Set(scoped(root, scope))
  const undeclared = [...importedPackages(state.to, scope, scanSkip)].filter(([name]) => !declared.has(name))
  if (undeclared.length) {
    throw new Error(`소스가 import 하는데 package.json 에 없는 ${scope}* 패키지 ${undeclared.length}개 — 템플릿 package.json 에 적는다:\n  ${undeclared.map(([name, files]) => `${name} ← ${files.join(", ")}`).join("\n  ")}`)
  }
  const queue = [...declared]
  const done = new Set()
  while (queue.length) {
    const name = queue.shift()
    if (done.has(name)) continue
    done.add(name)
    const p = name.slice(scope.length)
    const source = join(state.lfDir, from, p)
    if (!existsSync(join(source, "package.json"))) throw new Error(`${name} 을 쓰는데 ${join(from, p)} 에 패키지가 없다`)
    const target = join(state.to, dest, p)
    for (const rel of listFiles(source, withSecrets(state.rules, exclude))) copyFileTo(join(source, rel), join(target, rel))
    const pkgFile = join(target, "package.json")
    const pkg = readJson(pkgFile)
    queue.push(...scoped(pkg, scope))
    for (const section of SECTIONS) {
      for (const dep of Object.keys(pkg[section] ?? {}).filter((n) => n.startsWith(scope))) pkg[section][dep] = `file:../${dep.slice(scope.length)}`
    }
    writeJson(pkgFile, pkg)
  }
  for (const name of done) {
    const section = root.devDependencies?.[name] ? "devDependencies" : "dependencies"
    root[section][name] = `file:./${dest}/${name.slice(scope.length)}`
  }
  root.dependencies = Object.fromEntries(Object.entries(root.dependencies).sort(([a], [b]) => a.localeCompare(b)))
  writeJson(rootFile, root)
  state.vendored.push(...[...done].sort())
  return state
}
