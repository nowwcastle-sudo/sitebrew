// template-sync blocks 가 template/package.json 의 의존을 몰래 올리지 않는다(LFPIN12 — LFPIN11 §1 「바꾸지 않은 것」·P1AB 후속).
// 원인: shadcn add 가 의존을 ^ 범위(최신)로 다시 적고, 예전 코드는 설치된 판을 모든 이름에 덮어썼다 — 이미 정확히 고정한 lucide-react 등이 sync 때마다 올라갔다.
// 규칙: 이미 템플릿에 있는 의존은 판을 그대로 두고, 없는 의존만 더한다(더하는 판은 설치된 정확한 판).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import * as sync from "../template-sync.mjs"

const SRC = readFileSync(fileURLToPath(new URL("../template-sync.mjs", import.meta.url)), "utf8")
const installedVersion = (table) => (name) => {
  if (!(name in table)) throw new Error(`설치 판을 모른다: ${name}`)
  return table[name]
}

test("이미 있는 의존은 sync 가 올려 써도 판을 그대로 둔다(lucide-react 1.49.0 은 설치된 1.52.0 으로 안 올라간다)", () => {
  const tpl = { dependencies: { "lucide-react": "1.49.0", next: "16.3.6" }, devDependencies: { typescript: "5.9.3" } }
  const installed = { dependencies: { "lucide-react": "^1.52.0", next: "^16.3.6" }, devDependencies: { typescript: "^5.9.3" } }
  const out = sync.mergeDependencies(tpl, installed, installedVersion({ "lucide-react": "1.52.0", next: "16.4.0", typescript: "6.0.0" }))
  assert.deepEqual(out.dependencies, { "lucide-react": "1.49.0", next: "16.3.6" })
  assert.deepEqual(out.devDependencies, { typescript: "5.9.3" })
})

test("없는 의존만 더하고, 더하는 판은 설치된 정확한 판이다(^ 범위가 아니다)", () => {
  const tpl = { dependencies: { next: "16.3.6" } }
  const installed = { dependencies: { next: "^16.3.6", "embla-carousel-react": "^8.6.0" }, devDependencies: { "@types/node": "^25.0.0" } }
  const out = sync.mergeDependencies(tpl, installed, installedVersion({ "embla-carousel-react": "8.6.0", "@types/node": "25.0.1" }))
  assert.deepEqual(out.dependencies, { "embla-carousel-react": "8.6.0", next: "16.3.6" })
  assert.deepEqual(out.devDependencies, { "@types/node": "25.0.1" })
})

test("@launch-factory/* 는 게시 전이라 더하지 않고, 다른 섹션에 이미 있는 이름은 두 번 적지 않는다", () => {
  const tpl = { dependencies: { next: "16.3.6" }, devDependencies: { tailwindcss: "4.2.0" } }
  const installed = { dependencies: { "@launch-factory/contract": "^0.0.0", tailwindcss: "^4.2.0" }, devDependencies: { next: "^16.3.6" } }
  const out = sync.mergeDependencies(tpl, installed, installedVersion({}))
  assert.deepEqual(out.dependencies, { next: "16.3.6" })
  assert.deepEqual(out.devDependencies, { tailwindcss: "4.2.0" })
})

test("결과는 이름순이고, 넘겨받은 package.json 객체와 다른 필드는 건드리지 않는다", () => {
  const tpl = { name: "t", private: true, dependencies: { zod: "4.0.0", ai: "1.0.0" } }
  const before = JSON.stringify(tpl)
  const out = sync.mergeDependencies(tpl, { dependencies: { clsx: "^2.0.0" } }, installedVersion({ clsx: "2.1.1" }))
  assert.deepEqual(Object.keys(out.dependencies), ["ai", "clsx", "zod"])
  assert.equal(out.name, "t")
  assert.equal(out.private, true)
  assert.equal(JSON.stringify(tpl), before, "입력을 바꾸지 않는다")
})

test("syncBlocks 가 이 합치기를 쓴다(예전의 모든 이름 덮어쓰기 줄이 없다)", () => {
  assert.match(SRC, /mergeDependencies\(tpl, installed, exact\)/)
  assert.doesNotMatch(SRC, /tpl\[section\]\[name\] = exact\(name\)/)
})
