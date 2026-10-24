// 런북 원천 읽기 시험(오프라인). 좋은 고정 폴더는 문제 0, 하나씩 어긴 사본은 그 칸을 problems 로 낸다(던지지 않는다).
import assert from "node:assert/strict"
import { cpSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { readSources } from "../runbook/sources.mjs"
import { editJson, FIX, tree } from "./runbook-fixture.mjs"

const TODAY = "2026-10-22"
const details = (problems, rule) => problems.filter((p) => p.rule === rule).map((p) => p.detail)

test("좋은 원천: 문제 0, 장 파일·카드·대안·rubric·키 모양 표를 읽고 README 는 건너뛴다", () => {
  const dir = tree()
  writeFileSync(join(dir, "README.md"), "# 규약\n\n## G-readme — 장이 아니다\n")
  const s = readSources(dir, { today: TODAY })
  assert.deepEqual(s.problems, [])
  assert.deepEqual(s.files.map((f) => f.file), ["alpha-beta.md", "base.md"])
  assert.deepEqual(s.files[0].chapters.map((c) => c.gid), ["G-alpha", "G-beta"])
  assert.deepEqual(Object.keys(s.cards), ["G-alpha", "G-beta", "G-db", "G-hosting"])
  assert.deepEqual(Object.keys(s.alternatives), ["database"])
  assert.equal(s.alternatives.database[0].item, "db")
  assert.ok(s.rubric.helpLine.ko && s.secretShapes.length > 0)
})

test("카드 모양: enum 밖·미래 날짜·경로 붙은 home·빈 cost·모르는 칸·파일 이름이 장 id 가 아님", () => {
  const dir = tree()
  editJson(dir, "cards/G-alpha.json", (c) => Object.assign(c, { need: "sometimes", home: "https://alpha.example.com/docs" }))
  editJson(dir, "cards/G-beta.json", (c) => Object.assign(c, { checked: "2026-10-23", cost: [] }))
  editJson(dir, "cards/G-db.json", (c) => Object.assign(c, { colour: "blue", when: { locale: "jp" } }))
  cpSync(join(dir, "cards/G-db.json"), join(dir, "cards/db.json"))
  const s = readSources(dir, { today: TODAY })
  const shape = details(s.problems, "shape")
  for (const want of ["cards/G-alpha.json: need", "cards/G-alpha.json: home", "cards/G-beta.json: cost", "cards/G-db.json: colour", "cards/G-db.json: when.locale", "cards/db.json: file name"]) {
    assert.ok(shape.some((d) => d.startsWith(want)), `${want} in ${JSON.stringify(shape)}`)
  }
  assert.deepEqual(details(s.problems, "checked-future"), ["cards/G-beta.json: 2026-10-23"])
  // 모양이 틀린 카드는 싣지 않는다 — 생성기가 틀린 값을 쓰지 않게
  assert.deepEqual(Object.keys(s.cards), ["G-hosting"])
  // 오늘을 주지 않으면 미래 날짜는 보지 않는다(생성기는 시계를 모른다)
  assert.deepEqual(details(readSources(dir).problems, "checked-future"), [])
})

test("대안 모양: support·tags enum, builtin 은 item 필수, builtin 이 아니면 item 금지, 배열이 아니면 문제", () => {
  const dir = tree()
  editJson(dir, "alternatives/database.json", (list) => {
    list[0].support = "maybe"
    list[1].tags = ["fast"]
    list.push({ ...list[1], tags: [], support: "builtin" }, { ...list[1], tags: [], item: "db" })
  })
  writeFileSync(join(dir, "alternatives/hosting.json"), "{}")
  const shape = details(readSources(dir, { today: TODAY }).problems, "shape")
  for (const want of ["alternatives/database.json[0]: support", "alternatives/database.json[1]: tags", "alternatives/database.json[2]: item", "alternatives/database.json[3]: item", "alternatives/hosting.json: not an array"]) {
    assert.ok(shape.some((d) => d.startsWith(want)), `${want} in ${JSON.stringify(shape)}`)
  }
})

test("깨진 장 글은 parse 문제로 모으고 나머지 파일은 읽는다", () => {
  const dir = tree()
  cpSync(join(FIX, "no-rule.md"), join(dir, "no-rule.md"))
  const s = readSources(dir, { today: TODAY })
  assert.deepEqual(s.problems.map((p) => p.rule), ["parse"])
  assert.match(s.problems[0].detail, /no-rule\.md/)
  assert.deepEqual(s.files.map((f) => f.file), ["alpha-beta.md", "base.md"])
})

test("rubric·키 모양 표: 없는 파일·컴파일 안 되는 정규식은 문제", () => {
  const dir = tree()
  writeFileSync(join(dir, "secret-shapes.json"), JSON.stringify([{ id: "bad", re: "(" }]))
  writeFileSync(join(dir, "rubric.json"), JSON.stringify({ helpLine: { ko: "x" } }))
  const shape = details(readSources(dir, { today: TODAY }).problems, "shape")
  assert.ok(shape.some((d) => d.startsWith("secret-shapes.json[0]: re")))
  assert.ok(shape.some((d) => d.startsWith("rubric.json: helpLine.en")))
  assert.ok(shape.some((d) => d.startsWith("rubric.json: staleLine")))
})
