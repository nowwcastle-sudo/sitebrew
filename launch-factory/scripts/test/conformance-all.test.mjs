// scripts/conformance-all.mjs · scripts/lib/judge.mjs — 판정 규칙(검사 수 고정·예상 실패 정확 일치)과 종료 코드.
import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { judge, renderTable } from "../lib/judge.mjs"
import { LIVE_SANDBOX_KEYS, RUNNERS, renderReport, runAll } from "../conformance-all.mjs"
import { loadWfConformance } from "../lib/wf-conformance.mjs"

// CI 에는 web-factory 체크아웃이 없다 — 실제 일괄은 이유를 달아 건너뛴다(대장 D10·D45). 나머지(판정 규칙·종료 코드)는 어디서나 돈다.
const wf = await loadWfConformance()
process.on("exit", () => wf.cleanup?.())

const ok = (id) => ({ id, ok: true, message: "ok" })
const bad = (id, message) => ({ id, ok: false, message })
const run = (results, pins) => ({ adapter: "x", suite: "s", results, pins })

test("judge: 다 통과하고 검사 수가 맞아야 PASS", () => {
  const j = judge(run([ok("a"), ok("b")], { total: 2, expectedFailures: {} }))
  assert.equal(j.status, "PASS")
  assert.deepEqual([j.total, j.passed, j.expectedFail, j.problems.length], [2, 2, 0, 0])
})

test("judge: 0건·모자란 검사 수는 통과가 아니다", () => {
  assert.equal(judge(run([], { total: 2, expectedFailures: {} })).status, "FAIL")
  const j = judge(run([ok("a")], { total: 2, expectedFailures: {} }))
  assert.equal(j.status, "FAIL")
  assert.match(j.problems[0], /검사 수 1개 — 기대 2개/)
})

test("judge: 목록 밖 실패는 FAIL, 예상 실패는 정해진 이유일 때만 PASS", () => {
  const pins = { total: 3, expectedFailures: { b: "provider_unsupported" } }
  assert.equal(judge(run([ok("a"), bad("b", "던짐: provider_unsupported: 해지 API 없음"), ok("c")], pins)).status, "PASS")
  const outside = judge(run([bad("a", "깨짐"), bad("b", "provider_unsupported"), ok("c")], pins))
  assert.equal(outside.status, "FAIL")
  assert.match(outside.problems.join("\n"), /목록 밖 실패: a/)
  const wrongReason = judge(run([ok("a"), bad("b", "다른 이유"), ok("c")], pins))
  assert.match(wrongReason.problems.join("\n"), /예상 실패 이유가 다르다: b/)
})

test("judge: 지원 안 함으로 고정했는데 통과하거나 아예 돌지 않으면 FAIL", () => {
  const pins = { total: 2, expectedFailures: { b: "provider_unsupported" } }
  assert.match(judge(run([ok("a"), ok("b")], pins)).problems.join("\n"), /통과: b/)
  assert.match(judge(run([ok("a"), ok("c")], pins)).problems.join("\n"), /돌지 않은 예상 실패: b/)
  assert.match(judge(run([ok("a"), ok("a")], { total: 2, expectedFailures: {} })).problems.join("\n"), /id 가 겹친다/)
})

test("renderTable: 열이 맞고 판정이 보인다", () => {
  const t = renderTable([judge(run([ok("a")], { total: 1, expectedFailures: {} }))])
  assert.match(t, /adapter\s+\| suite\s+\| checks/)
  assert.match(t, /PASS/)
})

test("실제 일괄: 어댑터 6개·검사 185개가 판정대로 — Gumroad 지원 안 함 20개는 예상 실패로 고정", { skip: wf.skip ?? false, timeout: 180_000 }, async () => {
  const report = await runAll({ loaded: { ...wf, cleanup() {} } })
  assert.equal(report.skipped, undefined, report.skipped)
  assert.equal(report.exit, 0, renderReport(report))
  assert.deepEqual(report.rows.map((r) => r.adapter), ["billing-paddle", "billing-gumroad", "analytics-posthog/client", "analytics-posthog/server", "auth", "consent/notify"])
  const by = Object.fromEntries(report.rows.map((r) => [r.adapter, r]))
  assert.deepEqual([by["billing-paddle"].total, by["billing-paddle"].passed, by["billing-paddle"].expectedFail], [44, 44, 0]) // 40 + billing.confirmation.* 4(requireConfirmation, LFPIN11)
  assert.deepEqual([by["billing-gumroad"].total, by["billing-gumroad"].passed, by["billing-gumroad"].expectedFail], [40, 20, 20])
  assert.equal(by["consent/notify"].total, 5) // 4 + notify.confirmation.* 1
  assert.equal(by.auth.total, 12) // 9 + auth.confirmation.* 3(requireConfirmation — 탈퇴·내려받기는 account-lifecycle 과 합친 조립 포트로, LFCI)
  assert.equal(report.rows.reduce((a, r) => a + r.total, 0), 185)
  // web-factory 의 네 묶음이 모두 어댑터를 하나 이상 만났다
  assert.deepEqual(Object.keys(report.suites).sort(), ["analyticsConformance", "authConformance", "billingConformance", "notifyConformance"])
  assert.equal(report.live.status, "not-requested")
})

test("web-factory 묶음을 못 불러오면 통과가 아니라 종료 3", async () => {
  const r = await runAll({ loaded: { skip: "web-factory 체크아웃 없음(시험)" } })
  assert.equal(r.exit, 3)
  assert.equal(r.rows.length, 0)
  assert.match(renderReport(r), /돌리지 못함: web-factory 체크아웃 없음/)
})

test("어댑터를 하나도 돌리지 못하면(0건) 종료 0 이 아니다", async () => {
  const r = await runAll({ loaded: { commit: "test", cleanup() {} }, runners: [] })
  assert.equal(r.exit, 3)
})

const passingRunner = { name: "fake", suite: "s", load: async () => ({}), run: () => ({ adapter: "fake", suite: "s", results: [ok("a")], pins: { total: 1, expectedFailures: {} } }) }
const loadedFake = () => ({ commit: "test", cleanup() {} })
const noUserEnv = (names) => Object.fromEntries(names.map((n) => [n, null]))

test("--live-sandbox: 샌드박스 키가 없으면 건너뜀이라고 말하고 종료 3(녹화 결과가 통과여도 0 이 아니다)", async () => {
  const r = await runAll({ loaded: loadedFake(), runners: [passingRunner], liveSandbox: true, env: {}, userEnv: noUserEnv })
  assert.equal(r.live.status, "skipped")
  for (const n of LIVE_SANDBOX_KEYS) assert.ok(r.live.detail.includes(n), n)
  assert.match(r.live.detail, /O3/)
  assert.equal(r.rows[0].status, "PASS")
  assert.equal(r.exit, 3)
  assert.match(renderReport(r), /live-sandbox: skipped/)
})

test("--live-sandbox: 키가 있으면 doctor 의 Paddle 읽기 호출을 돌리고, 실패하면 종료 1", async () => {
  const env = { PADDLE_API_KEY: "k".repeat(20), PADDLE_WEBHOOK_SECRET: "w".repeat(20), PADDLE_CLIENT_TOKEN: "t".repeat(20) }
  let seen
  const fakeDoctor = (exit) => ({
    runDoctor: async (opts) => {
      seen = opts
      return { checks: [{ id: "paddle", status: exit ? "fail" : "pass", detail: "x" }], counts: { pass: exit ? 0 : 1, warn: 0, fail: exit ? 1 : 0, skip: 0 }, exit }
    },
  })
  let r = await runAll({ loaded: loadedFake(), runners: [passingRunner], liveSandbox: true, env, userEnv: noUserEnv, doctor: fakeDoctor(0) })
  assert.equal(r.live.status, "ran")
  assert.equal(r.exit, 0)
  assert.equal(seen.stage, "sandbox")
  assert.deepEqual(seen.only, ["paddle", "paddle-webhook", "paddle-client-token", "paddle-live-guard"])
  r = await runAll({ loaded: loadedFake(), runners: [passingRunner], liveSandbox: true, env, userEnv: noUserEnv, doctor: fakeDoctor(1) })
  assert.equal(r.exit, 1)
  assert.ok(!JSON.stringify(r).includes("k".repeat(20)), "키 값은 보고서에 없다")
})

test("판정 실패는 돌리지 못한 것(3)보다 앞선다 — 종료 1", async () => {
  const broken = { ...passingRunner, run: () => ({ adapter: "fake", suite: "s", results: [bad("a", "깨짐")], pins: { total: 1, expectedFailures: {} } }) }
  const r = await runAll({ loaded: loadedFake(), runners: [broken], liveSandbox: true, env: {}, userEnv: noUserEnv })
  assert.equal(r.exit, 1)
})

test("RUNNERS: web-factory 묶음 네 개(billing·auth·analytics·notify)를 모두 덮는다", () => {
  assert.deepEqual([...new Set(RUNNERS.map((r) => r.suite))].sort(), ["analytics", "auth", "billing", "notify"])
})

const SCRIPT = fileURLToPath(new URL("../conformance-all.mjs", import.meta.url))
const cli = (env, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...process.env, ...env }, encoding: "utf8", timeout: 60_000 })

test("CLI: 모르는 인자·어댑터는 종료 2, web-factory 저장소가 없으면 종료 3", () => {
  assert.equal(cli({}, "--bogus").status, 2)
  assert.equal(cli({}, "--only", "nope").status, 2)
  const r = cli({ LF_WF_REPO: "D:/does/not/exist" })
  assert.equal(r.status, 3, r.stdout + r.stderr)
  assert.match(r.stdout, /돌리지 못함/)
})
