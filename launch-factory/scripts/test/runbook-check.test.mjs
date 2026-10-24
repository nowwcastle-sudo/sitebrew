// runbook:check 시험(오프라인). 좋은 고정 원천은 엄격 검사를 통과하고, 위반 하나씩 만든 사본은 정확히 그 규칙으로 실패한다.
import assert from "node:assert/strict"
import { cpSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { main } from "../runbook/runbook.mjs"
import { editJson, editText, fakeKey, outcomes, registry, tree } from "./runbook-fixture.mjs"

const TODAY = "2026-10-22"

/** check 를 돌려 종료 코드와 오류·경고 규칙 id 를 돌려준다 */
function check(dir, flags = [], { reg = registry() } = {}) {
  const lines = []
  const code = main(["check", ...flags], { dir, outcomes: outcomes(), registry: reg, today: TODAY, stdout: () => {}, stderr: (l) => lines.push(l) })
  const ids = (kind) => lines.filter((l) => l.startsWith(`${kind} `)).map((l) => l.split(" ")[1].replace(/:$/, ""))
  return { code, errors: ids("error"), warnings: ids("warning"), lines }
}

test("좋은 원천은 엄격 검사를 통과한다", () => {
  assert.deepEqual(check(tree()), { code: 0, errors: [], warnings: [], lines: [] })
})

test("규칙 1: guides id 에 장 글 또는 카드가 없으면 실패, --partial 이면 경고", () => {
  const reg = registry()
  reg.parts.lonely.guides.push("G-later")
  assert.deepEqual(check(tree(), [], { reg }).errors, ["guide-missing"])
  const partial = check(tree(), ["--partial"], { reg })
  assert.deepEqual([partial.code, partial.errors, partial.warnings], [0, [], ["guide-missing"]])
})

test("규칙 1·4 는 --partial 에서 경고: 카드 없는 장은 데이터에서 빠지고 그 성과가 덮이지 않는다", () => {
  const dir = tree()
  rmSync(join(dir, "cards/G-beta.json"))
  assert.deepEqual(check(dir).errors, ["guide-missing", "uncovered"])
  const partial = check(dir, ["--partial"])
  assert.deepEqual([partial.code, partial.warnings], [0, ["guide-missing", "uncovered"]])
})

test("규칙 2: 장 없는 카드 · 모르는 after · 순환", () => {
  const orphan = tree()
  cpSync(join(orphan, "cards/G-beta.json"), join(orphan, "cards/G-ghost.json"))
  assert.deepEqual(check(orphan).errors, ["card-orphan"])
  const unknown = tree()
  editJson(unknown, "cards/G-beta.json", (c) => void c.after.push("G-nope"))
  assert.deepEqual(check(unknown).errors, ["after-unknown"])
  const cyclic = tree()
  editJson(cyclic, "cards/G-hosting.json", (c) => Object.assign(c, { after: ["G-beta"] }))
  assert.deepEqual(check(cyclic).errors, ["cycle"])
})

test("규칙 3: 장의 환경 이름은 needs·레지스트리 envVars 에 있어야 한다(notEnv·devOnly 는 예외)", () => {
  const dir = tree()
  editText(dir, "alpha-beta.md", (t) => t.replace("- 설정: `A_KEY` 를 넣는다.", "- 설정: `A_KEY` 와 `A_KYE` 를 넣는다."))
  const bad = check(dir)
  assert.deepEqual(bad.errors, ["env-unknown"])
  assert.ok(bad.lines.some((l) => l.includes("G-alpha") && l.includes("A_KYE")))
  editJson(dir, "cards/G-alpha.json", (c) => Object.assign(c, { notEnv: ["A_KYE"] }))
  assert.deepEqual(check(dir).errors, [])
})

test("규칙 4: 성과의 needs 가 그 성과의 장 어디에도 없으면 실패", () => {
  const dir = tree()
  editText(dir, "alpha-beta.md", (t) => t.replaceAll("`A_KEY`", "the key"))
  const r = check(dir)
  assert.deepEqual(r.errors, ["uncovered"])
  assert.ok(r.lines.some((l) => l.includes("one") && l.includes("A_KEY")))
})

test("규칙 5: 대안 역할은 카드의 역할 · builtin 은 어떤 성과에 닿아야 · support enum", () => {
  const role = tree()
  cpSync(join(role, "alternatives/database.json"), join(role, "alternatives/storage.json"))
  assert.deepEqual(check(role).errors, ["alt-role"])
  const far = tree()
  editJson(far, "alternatives/database.json", (list) => void (list[0].item = "lonely"))
  assert.deepEqual(check(far).errors, ["alt-unreachable"])
  const shape = tree()
  editJson(shape, "alternatives/database.json", (list) => void (list[1].support = "maybe"))
  assert.deepEqual(check(shape).errors, ["shape"])
})

test("규칙 6: 금액 모양은 장 글·카드·대안에서 실패, 용량·날수는 금액이 아니다", () => {
  const dir = tree()
  editText(dir, "base.md", (t) => t.replace("- 확인: 첫 배포가 끝난다.", "- 확인: 첫 배포가 끝난다. 2MB 까지, 14일 안에."))
  assert.deepEqual(check(dir).errors, [])
  editText(dir, "base.md", (t) => t.replace("14일 안에.", "월 9,900원."))
  editJson(dir, "cards/G-beta.json", (c) => void (c.ifSkipped.en = "Costs $5 later."))
  editJson(dir, "alternatives/database.json", (list) => void (list[1].note.en = "From 3 USD."))
  const r = check(dir)
  assert.deepEqual(r.errors, ["amount", "amount", "amount"])
})

test("규칙 9: 고정 안 된 npx 류 실행기는 실패하고, 버전을 박으면 통과한다", () => {
  const dir = tree()
  editText(dir, "base.md", (t) => t.replace("- 확인: 첫 배포가 끝난다.", "- 확인: 첫 배포가 끝난다. `npx tool-x@latest run` 도 된다."))
  const bad = check(dir)
  assert.deepEqual(bad.errors, ["launcher-unpinned"])
  assert.ok(bad.lines.some((l) => l.includes("base.md") && l.includes("npx tool-x@latest")))
  editText(dir, "base.md", (t) => t.replace("npx tool-x@latest", "npx tool-x@1.2.3"))
  assert.deepEqual(check(dir).errors, [])
})

test("규칙 7: 키 모양 문자열은 실패하고, 문제 글에 그 값을 되풀이하지 않는다", () => {
  const dir = tree()
  const key = fakeKey()
  editText(dir, "alpha-beta.md", (t) => t.replace("- 등록 1 — 베타 계정을 만든다.", `- 등록 1 — 베타 계정을 만든다. ${key}`))
  editJson(dir, "rubric.json", (r) => void (r.closing.en = `Done ${key}`))
  const r = check(dir)
  assert.deepEqual(r.errors, ["secret", "secret"])
  assert.ok(r.lines.every((l) => !l.includes(key)))
})

test("규칙 8: 확인일은 오늘 이하 · --fresh <일> 은 확인일 + 일수가 지난 항목을 잡는다(같은 날은 통과)", () => {
  const future = tree()
  editJson(future, "cards/G-db.json", (c) => Object.assign(c, { checked: "2026-10-23" }))
  assert.deepEqual(check(future).errors, ["checked-future"])
  assert.deepEqual(check(tree(), ["--fresh", "40", "--today", "2026-12-01"]).errors, [])
  const stale = check(tree(), ["--fresh", "39", "--today", "2026-12-01"])
  assert.equal(stale.code, 1)
  assert.deepEqual([...new Set(stale.errors)], ["stale"])
  assert.equal(stale.errors.length, 6, "four cards and two alternatives")
})

test("인자 오류는 2", () => {
  const dir = tree()
  for (const flags of [["--bogus"], ["--fresh"], ["--fresh", "x"], ["--today", "2026-13-01"]]) assert.equal(check(dir, flags).code, 2, flags.join(" "))
  writeFileSync(join(dir, "README.md"), "# 규약은 검사하지 않는다\n")
  assert.equal(check(dir).code, 0)
})
