// 잠금 파일 규칙 시험 — registry.npmjs.org 만 · https · integrity(sha512) 필수 · git/URL 의존 없음.
// 양성 대조: 같은 규칙을 어긴 잠금 파일·package.json 을 만들어 각각 실패하는지 본다(저장소 실제 파일은 통과해야 한다).
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { checkLockfile, checkManifest } from "../ci/lockfile-rules.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"))

const OK_PKG = { version: "1.0.0", resolved: "https://registry.npmjs.org/a/-/a-1.0.0.tgz", integrity: "sha512-AAAA" }
const clean = () => ({ lockfileVersion: 3, packages: { "": {}, "packages/x": { name: "x" }, "node_modules/x": { resolved: "packages/x", link: true }, "node_modules/a": { ...OK_PKG } } })

test("저장소의 package-lock.json 은 규칙을 모두 지킨다", () => {
  const lock = json("package-lock.json")
  assert.ok(Object.keys(lock.packages).length > 500, "잠금 파일이 너무 작다 — 읽기가 깨졌다")
  assert.deepEqual(checkLockfile(lock), [])
})

test("저장소의 모든 package.json 은 git·URL·파일 의존이 없다", () => {
  const manifests = ["package.json", "template/package.json", ...readdirSync(join(ROOT, "packages")).map((d) => `packages/${d}/package.json`)]
  assert.ok(manifests.length >= 14)
  for (const m of manifests) assert.deepEqual(checkManifest(json(m), m), [], m)
})

test("양성 대조: 깨끗한 잠금 파일은 통과한다(기준)", () => {
  assert.deepEqual(checkLockfile(clean()), [])
})

test("양성 대조: 규칙 하나씩 어기면 각각 잡힌다", () => {
  const cases = [
    ["다른 레지스트리", (l) => (l.packages["node_modules/a"].resolved = "https://evil.example.com/a/-/a-1.0.0.tgz"), /registry\.npmjs\.org 밖 출처/],
    ["http", (l) => (l.packages["node_modules/a"].resolved = "http://registry.npmjs.org/a/-/a-1.0.0.tgz"), /https 가 아니다/],
    ["integrity 없음", (l) => delete l.packages["node_modules/a"].integrity, /integrity 가 없다/],
    ["sha1 integrity", (l) => (l.packages["node_modules/a"].integrity = "sha1-AAAA"), /sha512 가 아니다/],
    ["git 의존(resolved)", (l) => (l.packages["node_modules/a"].resolved = "git+ssh://git@github.com/o/a.git#abc123"), /https 가 아니다|밖 출처/],
    ["resolved 없음", (l) => delete l.packages["node_modules/a"].resolved, /resolved 가 없다/],
    ["lockfileVersion 2", (l) => (l.lockfileVersion = 2), /lockfileVersion 2/],
  ]
  for (const [name, mutate, re] of cases) {
    const l = clean()
    mutate(l)
    const found = checkLockfile(l)
    console.log(`  양성 대조 [${name}]:`, found)
    assert.ok(found.some((m) => re.test(m)), `${name}: 못 잡았다 ${JSON.stringify(found)}`)
  }
})

test("양성 대조: package.json 의 git·URL·파일·깃허브 약식 의존을 잡고 평범한 판은 통과시킨다", () => {
  const bad = ["github:o/r", "git+https://github.com/o/r.git", "https://example.com/a.tgz", "file:../a", "o/r", "o/r#main", "link:../a"]
  for (const spec of bad) assert.equal(checkManifest({ dependencies: { a: spec } }, "p").length, 1, `${spec} 를 못 잡았다`)
  for (const spec of ["1.2.3", "^1.2.3", "~1.2", ">=1 <2", "0.0.0", "latest", "npm:other@1.0.0", "*"]) assert.deepEqual(checkManifest({ devDependencies: { a: spec } }, "p"), [], `${spec} 는 통과해야 한다`)
})
