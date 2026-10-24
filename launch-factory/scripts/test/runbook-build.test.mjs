// 런북 생성기 시험(오프라인). 작은 고정 원천·성과표·레지스트리로 파생값(이름·순서·범위·도달·오래됨)을 한 번에 계산하는지 본다.
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { addDays, buildRunbook, isStale, renderRunbook } from "../runbook/build.mjs"
import { main, readRegistry } from "../runbook/runbook.mjs"
import { readSources } from "../runbook/sources.mjs"
import { editJson, editText, outcomes, registry, tree } from "./runbook-fixture.mjs"

const build = (dir, { reg = registry(), table = outcomes() } = {}) => buildRunbook(readSources(dir), table, reg)
const rules = (problems) => problems.map((p) => p.rule)
const quiet = { stdout: () => {}, stderr: () => {} }

test("환경 이름: 장은 공유 절을 물려받고, mustName 은 장 본문에서 devOnly·notEnv 를 뺀 것", () => {
  const dir = tree()
  editText(dir, "alpha-beta.md", (t) => t.replace("- 설정: `A_KEY` 를 넣는다.", "- 설정: `A_KEY` 를 넣는다. `NOT_ENV_X` · `DEV_ONLY_Y`"))
  editJson(dir, "cards/G-alpha.json", (c) => Object.assign(c, { notEnv: ["NOT_ENV_X"], devOnly: ["DEV_ONLY_Y"] }))
  const { data, problems } = build(dir)
  assert.deepEqual(problems, [])
  assert.deepEqual(data.chapters["G-beta"].envNames, ["B_TOKEN"])
  assert.deepEqual(data.chapters["G-beta"].mustName, [])
  assert.deepEqual(data.chapters["G-alpha"].envNames, ["A_KEY", "B_TOKEN", "DEV_ONLY_Y", "NOT_ENV_X"])
  assert.deepEqual(data.chapters["G-alpha"].mustName, ["A_KEY"])
  assert.deepEqual(data.chapters["G-alpha"].actions, { ko: 1, en: 1 })
  assert.deepEqual(data.chapters["G-db"].text.en, { title: "", body: "- Register 1 — make a database.\n- Config: put the connection address in `DATABASE_URL`." })
  assert.match(data.shared["alpha-beta.md"].ko, /^## 1\. 환경 변수/)
})

test("순서: after 위상 정렬, 같은 칸은 gid 순 · 순환은 문제(순서에는 남는다) · 모르는 after 는 문제, 장 없는 guides id 는 건너뜀", () => {
  assert.deepEqual(build(tree()).data.order, ["G-hosting", "G-db", "G-alpha", "G-beta"])

  const cyclic = tree()
  editJson(cyclic, "cards/G-hosting.json", (c) => Object.assign(c, { after: ["G-beta"] }))
  const r = build(cyclic)
  assert.deepEqual(rules(r.problems), ["cycle"])
  assert.match(r.problems[0].detail, /G-beta.*G-db.*G-hosting/)
  assert.deepEqual([...r.data.order].sort(), ["G-alpha", "G-beta", "G-db", "G-hosting"])

  const unknown = tree()
  editJson(unknown, "cards/G-beta.json", (c) => Object.assign(c, { after: ["G-db", "G-later", "G-nope"] }))
  const reg = registry()
  reg.parts.beta.guides.push("G-later")
  const u = build(unknown, { reg })
  assert.deepEqual(u.problems, [{ rule: "after-unknown", detail: "G-beta: after G-nope" }])
})

test("성과: guides 는 parts·closure 부품의 합집합(order 순, 장 없는 id 는 뒤에) · uncovered 는 성과의 장 + always 장 밖의 needs", () => {
  const reg = registry()
  reg.parts.alpha.guides.push("G-later")
  assert.deepEqual(build(tree(), { reg }).data.outcomes.one.guides, ["G-db", "G-alpha", "G-later"])

  const dir = tree()
  editText(dir, "alpha-beta.md", (t) => t.replaceAll("`A_KEY`", "A key"))
  assert.deepEqual(build(dir).data.outcomes.one.uncovered, ["A_KEY"])
  editJson(dir, "cards/G-db.json", (c) => Object.assign(c, { notEnv: ["A_KEY"] }))
  assert.deepEqual(build(dir).data.outcomes.one.uncovered, [], "a notEnv name of one of the outcome's chapters is not required")

  // always 장이 말한 이름은 모든 성과를 덮는다
  const always = tree()
  editText(always, "base.md", (t) => t.replaceAll("`DATABASE_URL`", "the address"))
  assert.deepEqual(build(always).data.outcomes.two.uncovered, ["DATABASE_URL"])
  editText(always, "base.md", (t) => t.replace("- 확인: 첫 배포가 끝난다.", "- 확인: `DATABASE_URL` 이 보인다."))
  assert.deepEqual(build(always).data.outcomes.two.uncovered, [])
  assert.deepEqual(build(always).data.outcomes.two.say, { ko: "둘", en: "Two" })
})

test("카드 없는 장은 데이터에서 빠지고, 장 없는 카드는 card-orphan · 성과 문장이 비면 outcome-text", () => {
  const dir = tree()
  writeFileSync(join(dir, "cards/G-ghost.json"), readFileSync(join(dir, "cards/G-beta.json")))
  const table = outcomes()
  delete table.outcomes[1].question.en
  const { data, problems } = build(dir, { table })
  assert.deepEqual(problems, [
    { rule: "card-orphan", detail: "G-ghost: card without chapter text" },
    { rule: "outcome-text", detail: "two: question.en" },
  ])
  assert.ok(!("G-ghost" in data.chapters))
})

test("대안 via: builtin 부품에 닿는 성과(정렬) · 닿지 않으면 alt-unreachable · code 에는 via 가 없다", () => {
  const ok = build(tree()).data.alternatives.database
  assert.deepEqual(ok[0].via, ["one", "two"])
  assert.ok(!("via" in ok[1]))
  const dir = tree()
  editJson(dir, "alternatives/database.json", (list) => void (list[0].item = "lonely"))
  const r = build(dir)
  assert.deepEqual(r.data.alternatives.database[0].via, [])
  assert.deepEqual(r.problems, [{ rule: "alt-unreachable", detail: "database: Other DB (item lonely)" }])
})

test("오래됨: staleAfter = 확인일 + 90일, 같은 날은 아직 아님, 윤년", () => {
  assert.equal(build(tree()).data.chapters["G-db"].staleAfter, "2027-01-20")
  assert.equal(addDays("2023-12-01", 90), "2024-02-29")
  assert.equal(addDays("2025-12-01", 90), "2026-03-01")
  assert.equal(isStale("2023-12-01", "2024-02-29", 90), false)
  assert.equal(isStale("2023-12-01", "2024-03-01", 90), true)
})

test("같은 입력 → 같은 바이트: 칸 순서 고정, 맵 키 정렬, 끝 줄바꿈", () => {
  const { data } = build(tree())
  const text = renderRunbook(data)
  assert.equal(text, renderRunbook(build(tree()).data))
  assert.ok(text.endsWith("}\n"))
  assert.deepEqual(Object.keys(data), ["version", "outcomesHash", "staleAfterDays", "order", "chapters", "shared", "outcomes", "alternatives", "rubric", "secretShapes"])
  assert.deepEqual(Object.keys(data.chapters), ["G-alpha", "G-beta", "G-db", "G-hosting"])
  assert.deepEqual(Object.keys(data.chapters["G-db"]), ["gid", "file", "card", "text", "envNames", "mustName", "actions", "staleAfter"])
  assert.deepEqual(Object.keys(data.chapters["G-hosting"].card), ["service", "role", "need", "cost", "after", "home", "checked", "ifSkipped", "devOnly", "notEnv"])
  assert.deepEqual([data.version, data.outcomesHash, data.staleAfterDays], [1, "fixturehash1", 90])
})

test("runbook:gen 이 쓰고, --check 는 손으로 고친 생성물을 잡는다", () => {
  const dir = tree()
  const out = join(dir, "runbook.generated.json")
  const opts = { dir, out, outcomes: outcomes(), registry: registry(), ...quiet }
  assert.equal(main(["gen", "--check"], opts), 1, "missing file is not current")
  assert.equal(main(["gen"], opts), 0)
  assert.equal(main(["gen", "--check"], opts), 0)
  editText(dir, "runbook.generated.json", (t) => t.replace('"staleAfterDays": 90', '"staleAfterDays": 91'))
  assert.equal(main(["gen", "--check"], opts), 1)
  assert.equal(main(["gen", "--nope"], opts), 2)
})

test("readRegistry: 저장소의 registry 항목 envVars 와 outcomes.yaml 부품", () => {
  const reg = readRegistry(join(import.meta.dirname, "..", ".."))
  assert.ok(reg.items["feature-booking"].includes("BOOKING_OWNER_EMAIL"))
  assert.deepEqual(reg.parts.booking, { feature: "feature-booking", guides: ["G-booking", "G-db", "G-email"] })
})
