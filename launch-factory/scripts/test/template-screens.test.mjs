// 제품 화면 관문 러너(scripts/template-screens.mjs · template-screens/plan.mjs)의 순수 부분 시험. 빌드·서버·Chrome 없이 돈다.
// 실제 관문 실행은 `npm run template:screens` (docs/qa/template-screens.md).
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { buildJobs, parseArgs, waitForMemory } from "../template-screens.mjs"
import { aggregate, buildPlan, classifyExit, extractFindings, isProtected, readResult, redirectsToSignIn, renderTable, routesFromApp } from "../template-screens/plan.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))

// ── 쪽 목록 ───────────────────────────────────────────────────────────────────────────

test("routesFromApp — 라우트 그룹은 주소에서 빠지고 [동적] 쪽은 따로 센다", () => {
  const dir = mkdtempSync(join(tmpdir(), "lfscreens-"))
  try {
    const put = (rel) => {
      const f = join(dir, rel)
      mkdirSync(join(f, ".."), { recursive: true })
      writeFileSync(f, "export default () => null")
    }
    put("(product)/page.tsx")
    put("(product)/pricing/page.tsx")
    put("(legal)/terms/page.tsx")
    put("(product)/account/billing/page.tsx")
    put("(product)/blog/[slug]/page.tsx")
    put("(product)/layout.tsx") // 쪽이 아니다
    put("api/health/route.ts") // 쪽이 아니다
    const { routes, dynamic } = routesFromApp(dir)
    assert.deepEqual(routes, ["/", "/account/billing", "/pricing", "/terms"])
    assert.deepEqual(dynamic, ["/blog/[slug]"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("실제 템플릿 — 앱의 page.tsx 가 하나도 빠지지 않고, 공개 쪽 목록(lib/public-paths.json)과 맞는다", () => {
  const { routes, dynamic } = routesFromApp(join(ROOT, "template", "app"))
  // 러너가 주소를 못 만드는 [동적] 쪽은 알려진 것뿐이다 — 주문 상세는 주문 번호가 있어야 열린다(주문 목록 쪽이 같은 블록 틀을 덮는다).
  // 관리 구획 목록·기록(/admin/[section], /admin/[section]/[id])은 구획 id·기록 id 가 있어야 열린다 — 개요(/admin)가 같은 관리 틀(사이드바·위 띠·접근 거절)을 덮는다. 새 동적 쪽이 생기면 여기에 까닭과 함께 적는다
  assert.deepEqual(dynamic, ["/admin/[section]", "/admin/[section]/[id]", "/orders/[id]"], `[동적] 쪽 목록이 달라졌다 — 러너가 주소를 못 만든다: ${dynamic}`)
  for (const p of ["/", "/pricing", "/cart", "/checkout", "/checkout/return", "/orders", "/contact", "/terms", "/privacy", "/refund", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/upgrade", "/billing/return", "/account", "/account/billing", "/account/billing/cancel", "/account/billing/price-change", "/account/cancel", "/email", "/admin"]) {
    assert.ok(routes.includes(p), `${p} 가 쪽 목록에 없다`)
  }
  const publicPaths = JSON.parse(readFileSync(join(ROOT, "template", "lib", "public-paths.json"), "utf8"))
  assert.ok(publicPaths.length >= 6)
  for (const p of publicPaths) assert.ok(routes.includes(p), `공개 쪽 ${p} 가 목록에 없다`)
})

test("buildPlan — 결제 쪽만 구독 상태 장면을 더 받고, 확인 안 된 로그인 장면은 배너·주소 안내가 있는 쪽만 더 받고, 보호된 쪽은 표시된다", () => {
  const plan = buildPlan(["/", "/pricing", "/account/billing", "/account/cancel", "/upgrade", "/billing/return", "/sign-in", "/account/billing/price-change", "/verify-email"], { protectedPaths: ["/account/billing", "/upgrade"] })
  const by = Object.fromEntries(plan.map((p) => [p.path, p]))
  // P1AB: 위 배너(모든 쪽)·결제 직전 주소(/upgrade)·확인 쪽(/verify-email)은 확인 안 된 사용자에게만 보인다 — 관문이 그 장면으로도 본다
  assert.deepEqual(by["/"].scenes, ["signed-out", "signed-in", "signed-in:unverified"])
  assert.deepEqual(by["/verify-email"].scenes, ["signed-out", "signed-in", "signed-in:unverified"])
  assert.deepEqual(by["/sign-in"].scenes, ["signed-out", "signed-in"])
  assert.deepEqual(by["/upgrade"].scenes, ["signed-out", "signed-in", "signed-in:sub=past_due", "signed-in:unverified"])
  for (const p of ["/pricing", "/account/billing", "/account/cancel", "/billing/return", "/account/billing/price-change"]) {
    assert.deepEqual(by[p].scenes, ["signed-out", "signed-in", "signed-in:sub=past_due"], p)
    assert.equal(by[p].billing, true)
  }
  assert.equal(by["/upgrade"].protected, true)
  assert.equal(by["/pricing"].protected, false)
})

test("보호된 쪽 판정 — 이동 표지·안내 제목·이름 힌트", () => {
  const meta = '<meta http-equiv="refresh" content="1;url=/sign-in?next=%2Faccount"/>'
  assert.equal(redirectsToSignIn(200, null, meta), true)
  assert.equal(redirectsToSignIn(307, "/sign-in?next=%2Fx", ""), true)
  assert.equal(redirectsToSignIn(200, null, "<h1>Pricing</h1>"), false)
  assert.equal(isProtected("/upgrade", 200, null, '<h1 id="sign-in-required-title">Sign in to continue</h1>'), true)
  assert.equal(isProtected("/account", 200, null, "<main>client rendered</main>"), true, "클라이언트가 묻는 /account 는 이름 힌트로")
  assert.equal(isProtected("/pricing", 200, null, "<h1>Pricing</h1>"), false)
  assert.equal(isProtected("/sign-in", 200, null, "<h1>Sign in</h1>"), false)
})

// ── 종료 코드 읽기(web-factory docs/agents/agent-guide.md 관문 표) ──────────────────────────────────────────

test("classifyExit — 도구마다 1·3 의 뜻이 다르다", () => {
  // a11y · lang · signed-out: 1 + 결과 파일 = 실패, 1 + 파일 없음 = 도구 실패
  for (const g of ["a11y", "lang", "signed-out"]) {
    assert.equal(classifyExit(g, 0, true), "pass", g)
    assert.equal(classifyExit(g, 1, true), "fail", g)
    assert.equal(classifyExit(g, 1, false), "tool", `${g}: 결과 파일 없음 = 도구 실패`)
    assert.equal(classifyExit(g, 2, false), "args", g)
    assert.equal(classifyExit(g, null, false), "tool", `${g}: 기한 초과로 죽임`)
  }
  // ux-gate: 3 = 판정 실패, 1 = 도구 실패(파일이 있어도)
  assert.equal(classifyExit("ux", 0, true), "pass")
  assert.equal(classifyExit("ux", 3, true), "fail")
  assert.equal(classifyExit("ux", 1, true), "tool")
  assert.equal(classifyExit("ux", 1, false), "tool")
  assert.equal(classifyExit("ux", 2, false), "args")
  assert.equal(classifyExit("a11y", 7, true), "tool", "모르는 코드는 통과가 아니다")
})

test("extractFindings — 관문별 결과 JSON 을 같은 모양으로", () => {
  assert.deepEqual(extractFindings("a11y", { failures: ["serious color-contrast 1440px light x"] }), [{ gate: "a11y", width: "1440", message: "serious color-contrast 1440px light x" }])
  assert.deepEqual(extractFindings("ux", { fail: ["375-dark: nav not persistent after scroll"] }), [{ gate: "ux", width: "375", message: "375-dark: nav not persistent after scroll" }])
  const lang = { pages: [{ url: "http://h/a", status: "fail", strings: 3, findings: [{ rule: "hangul", src: "text", match: "닫기", text: "닫기", count: 2 }] }, { url: "http://h/b", status: "na", strings: 0, findings: [] }] }
  assert.match(extractFindings("lang", lang, { url: "http://h/a" })[0].message, /hangul \[text\] "닫기".*×2/)
  assert.deepEqual(extractFindings("lang", lang, { url: "http://h/b" }).map((f) => f.message), ["na: 잰 글이 0개 — 통과가 아니다"], "잰 글 0개(na)는 통과가 아니다")
  const so = { pages: [{ path: "/account", pass: true, fails: [] }, { path: "/upgrade", pass: false, fails: ["no-return-param: x"] }] }
  assert.deepEqual(extractFindings("signed-out", so).map((f) => f.message), ["/upgrade: no-return-param: x"])
  assert.deepEqual(extractFindings("a11y", null), [])
})

test("readResult — 파일이 없거나 깨졌으면 null(통과로 읽지 않는다)", () => {
  const dir = mkdtempSync(join(tmpdir(), "lfscreens-"))
  try {
    assert.equal(readResult("a11y", dir), null)
    writeFileSync(join(dir, "a11y-gate.json"), "{ not json")
    assert.equal(readResult("a11y", dir), null)
    writeFileSync(join(dir, "a11y-gate.json"), JSON.stringify({ failures: [] }))
    assert.deepEqual(readResult("a11y", dir), { failures: [] })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 모으기 ───────────────────────────────────────────────────────────────────────────

const cell = (o) => ({ page: "/p", scene: "signed-in", width: null, findings: [], ...o })

test("aggregate — 실패·도구 실패·인자 오류가 있으면 ok 가 아니고, 셀이 0개여도 통과가 아니다", () => {
  assert.equal(aggregate([]).ok, false, "0건은 결과가 아니라 검증 대상이다")
  assert.equal(aggregate([cell({ gate: "a11y", status: "pass" })]).ok, true)
  assert.equal(aggregate([cell({ gate: "a11y", status: "pass" }), cell({ gate: "ux", status: "tool", findings: [{ gate: "ux", message: "도구 실패" }] })]).ok, false)
  assert.equal(aggregate([cell({ gate: "a11y", status: "args" })]).ok, false)
  const r = aggregate([cell({ gate: "ux", status: "fail", findings: [{ gate: "ux", width: "375", message: "m" }] }), cell({ gate: "a11y", status: "pass" })])
  assert.deepEqual(r.counts, { cells: 2, pass: 1, fail: 1, tool: 0, args: 0 })
  assert.deepEqual(r.findings, [{ page: "/p", scene: "signed-in", width: "375", gate: "ux", message: "m" }])
})

test("renderTable — 쪽×장면 한 줄, 관문 칸에 PASS/FAIL(n)/TOOL, 안 돈 관문은 —", () => {
  const t = renderTable([
    cell({ gate: "a11y", status: "pass" }),
    cell({ gate: "ux", status: "fail", findings: [{ gate: "ux", message: "a" }, { gate: "ux", message: "b" }] }),
    cell({ gate: "lang", width: 1440, status: "pass" }),
    cell({ gate: "lang", width: 375, status: "tool" }),
  ])
  const lines = t.split("\n")
  assert.equal(lines[0], "| page | scene | a11y | ux | lang | signed-out |")
  assert.equal(lines[2], "| /p | signed-in | PASS | FAIL(2) | PASS@1440 TOOL@375 | — |")
})

// ── 작업 만들기·메모리·인자 ──────────────────────────────────────────────────────────────

test("buildJobs — 쪽×장면마다 a11y·ux, 장면×너비마다 lang, 보호된 쪽만 signed-out, 모든 작업이 --session 을 단다", () => {
  const plan = buildPlan(["/", "/pricing", "/account"], { protectedPaths: ["/account"] })
  const a = parseArgs([])
  const jobs = buildJobs(plan, "http://127.0.0.1:1", a, join(ROOT, ".tmp", "x"))
  const of = (g) => jobs.filter((j) => j.gate === g)
  // 쪽 3 · 장면: / = 3(확인 안 된 장면 포함), /pricing = 3, /account = 2(이름이 결제 규칙에 안 걸림) → 8
  assert.equal(of("a11y").length, 8)
  assert.equal(of("ux").length, 8)
  assert.equal(of("lang").length, 8, "장면 4 × 너비 2")
  assert.equal(of("signed-out").length, 1)
  assert.deepEqual(of("signed-out")[0].pages, ["/account"])
  for (const j of of("a11y")) assert.ok(j.args.includes("1440,375") && j.args.includes("--session"), j.id)
  for (const j of of("ux")) assert.equal(j.args[j.args.indexOf("--session") + 1], j.scene)
  const pastDueLang = of("lang").filter((j) => j.scene === "signed-in:sub=past_due")
  assert.deepEqual(pastDueLang[0].pages, ["/pricing"], "past_due 장면은 결제 쪽만")
  assert.deepEqual(of("lang").filter((j) => j.scene === "signed-out")[0].pages, ["/", "/pricing", "/account"])
  assert.ok(of("lang").every((j) => j.args.includes("--locale") && j.args[j.args.indexOf("--locale") + 1] === "en"))
  assert.ok(of("signed-out")[0].args.includes("signed-out"))
  // 관문 선택
  assert.equal(buildJobs(plan, "http://x", parseArgs(["--gates", "ux"]), "o").every((j) => j.gate === "ux"), true)
})

test("parseArgs — 동시 실행은 둘까지, 모르는 관문·인자는 거절", () => {
  assert.equal(parseArgs([]).concurrency, 2)
  assert.throws(() => parseArgs(["--concurrency", "3"]), /1 또는 2/)
  assert.throws(() => parseArgs(["--gates", "visual"]), /--gates/)
  assert.throws(() => parseArgs(["--nope"]), /모르는 인자/)
  assert.deepEqual(parseArgs(["--only", "/a,/b"]).only, ["/a", "/b"])
})

test("waitForMemory — 모자라면 2분 단계로 기다리고, 끝내 모자라면 던진다", async () => {
  const waits = []
  const seq = [1.0, 2.5, 3.2]
  const got = await waitForMemory(3, { free: () => seq.shift(), wait: async (ms) => waits.push(ms), log: () => {} })
  assert.equal(got, 3.2)
  assert.deepEqual(waits, [120_000, 120_000], "2분 단계")
  await assert.rejects(waitForMemory(3, { steps: 2, free: () => 0.5, wait: async () => {}, log: () => {} }), /아래로/)
  assert.equal(await waitForMemory(3, { free: () => 8, wait: async () => assert.fail("기다리면 안 된다"), log: () => {} }), 8)
})

test("groupFindings — 같은 원인을 관문+메시지로 묶고 많이 걸린 것부터", async () => {
  const { groupFindings } = await import("../template-screens/plan.mjs")
  const f = (page, scene, width, gate, message) => ({ page, scene, width, gate, message })
  const g = groupFindings([
    f("/a", "signed-in", "375", "ux", "375-light: nav not persistent after scroll"),
    f("/b", "signed-out", "375", "ux", "375-light: nav not persistent after scroll"),
    f("/b", "signed-in", "375", "ux", "375-light: nav not persistent after scroll"),
    f("/a", "signed-in", "1440", "a11y", "x"),
  ])
  assert.equal(g.length, 2)
  assert.deepEqual(g[0], { gate: "ux", message: "375-light: nav not persistent after scroll", count: 3, pages: ["/a", "/b"], scenes: ["signed-in", "signed-out"], widths: ["375"] })
  assert.equal(g[1].gate, "a11y")
})

test("readPrevCells — summary.json 과 cells.jsonl 둘 다 읽는다(--resume)", async () => {
  const { readPrevCells } = await import("../template-screens.mjs")
  const dir = mkdtempSync(join(tmpdir(), "lfscreens-"))
  try {
    const cells = [{ gate: "a11y", page: "/a", scene: "signed-in", status: "pass" }, { gate: "ux", page: "/a", scene: "signed-in", status: "tool" }]
    writeFileSync(join(dir, "summary.json"), JSON.stringify({ cells }))
    writeFileSync(join(dir, "cells.jsonl"), cells.map((c) => JSON.stringify(c)).join("\n") + "\n")
    assert.deepEqual(readPrevCells(join(dir, "summary.json")), cells)
    assert.deepEqual(readPrevCells(join(dir, "cells.jsonl")), cells)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
