// 빌드 스모크 시험(LFSMOKE) — 브라우저·서버·빌드 없이 도는 부분. 실제 스모크(빌드→서버→Playwright)는 `npm run ci:smoke`, CI 의 build-smoke 작업이 돈다.
// 여기서 지키는 것: (1) live 가짜 환경 표가 실제 필수 이름·형식과 같다 (2) 쪽 목록·장면 규칙이 러너(template:screens)와 같다 (3) axe 기준선 비교 (4) CI 작업이 ci:verify 단계 전체를 덮는다
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { liveRequirements } from "../env-check.mjs"
import { routesFromApp as screensRoutes } from "../template-screens/plan.mjs"
import { STEPS as ROOT_STEPS } from "../ci/verify.mjs"
import { parseArgs, waitForMemory } from "../../template/scripts/ci/smoke.mjs"
import { AMBIENT_ENV, cleanEnv, compareAxe, LIVE_DUMMY, modeEnv, pickBrowser, summarizeStats } from "../../template/scripts/ci/smoke-lib.mjs"
import { BILLING_PATH, hasSignInPrompt, routesFromApp, sceneMarker, scenesFor } from "../../template/e2e/lib.ts"
import { templateEnv } from "../../template/lib/live-env.ts"
import { STEPS as TEMPLATE_STEPS } from "../../template/scripts/ci/verify.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), "utf8")

test("LIVE_DUMMY 는 실제 live 필수 이름과 정확히 같다 — 선택 이름은 일부러 없다", async () => {
  const { required, optional } = await liveRequirements()
  assert.deepEqual(Object.keys(LIVE_DUMMY).sort(), [...required].sort(), "새 필수 이름을 더했으면 template/scripts/ci/smoke-lib.mjs 의 LIVE_DUMMY 에도 더한다")
  for (const n of optional) assert.ok(!(n in LIVE_DUMMY), `선택 이름 ${n} 이 가짜 값 표에 있다 — 「선택 이름이 없어도 켜진다」를 못 본다`)
  for (const [n, v] of Object.entries(LIVE_DUMMY)) assert.ok(v.length > 0, `${n} 가 비었다`)
})

test("LIVE_DUMMY 는 실제 검증기(templateEnv)를 선택 이름 없이 통과한다 — 양성 대조: 필수 하나를 빼면 그 이름을 대며 실패", () => {
  assert.doesNotThrow(() => templateEnv({ ...LIVE_DUMMY }))
  for (const name of Object.keys(LIVE_DUMMY).filter((n) => n !== "LF_MODE")) {
    const rest = Object.fromEntries(Object.entries(LIVE_DUMMY).filter(([n]) => n !== name))
    assert.throws(() => templateEnv(rest), (e) => String(e.message).includes(name), `${name} 를 뺐는데 안 멈췄다`)
  }
})

test("쪽 목록·장면 규칙은 화면 관문 러너(template:screens)와 같다", () => {
  const app = join(ROOT, "template", "app")
  const a = routesFromApp(app)
  const b = screensRoutes(app)
  assert.deepEqual(a.routes, b.routes)
  assert.deepEqual(a.dynamic, b.dynamic)
  assert.ok(a.routes.includes("/") && a.routes.length >= 10, `쪽이 너무 적다: ${a.routes.length}`)
  assert.deepEqual(scenesFor("/"), ["signed-out", "signed-in"])
  assert.deepEqual(scenesFor("/pricing"), ["signed-out", "signed-in", "signed-in:sub=past_due"])
  assert.ok(BILLING_PATH.test("/account/billing/cancel") && !BILLING_PATH.test("/contact"))
})

test("응답 읽기: 장면 표지와 로그인 안내", () => {
  assert.equal(sceneMarker('<html lang="en" data-wf-session="signed-in:sub=past_due" data-x="1"><head>'), "signed-in:sub=past_due")
  assert.equal(sceneMarker('<html lang="en"><body data-wf-session="x">'), null, "html 태그 밖의 값은 표지가 아니다")
  assert.equal(hasSignInPrompt('<h1 id="sign-in-required-title">Sign in</h1>'), true)
  assert.equal(hasSignInPrompt("<h1>Account</h1>"), false)
})

test("axe 기준선: 새 위반은 fresh, 사라진 것은 fixed, 못 잰 셀은 fixed 로 세지 않는다", () => {
  const known = ["/a|signed-out|color-contrast", "/b|signed-in|label", "/c|signed-out|region"]
  const records = [
    { cell: "/a|signed-out", violations: [{ id: "color-contrast", impact: "serious", nodes: 2 }, { id: "image-alt", impact: "critical", nodes: 1 }] },
    { cell: "/b|signed-in", violations: [] },
    // /c|signed-out 은 이번에 못 쟀다(테스트가 실패해 axe 가 안 돌았다)
  ]
  const r = compareAxe(records, known)
  assert.deepEqual(r.fresh, ["/a|signed-out|image-alt"])
  assert.deepEqual(r.fixed, ["/b|signed-in|label"], "못 잰 /c 를 「고쳐졌다」로 읽었다")
  assert.equal(r.cells, 2)
  assert.deepEqual(compareAxe([], known).fixed, [], "아무것도 못 쟀을 때 전부 「고쳐졌다」가 되면 안 된다")
})

test("브라우저 고르기: 지정 > 번들 > 설치된 Chrome > Edge > 없음", () => {
  const has = (...paths) => (p) => paths.includes(p)
  assert.deepEqual(pickBrowser({ env: { SMOKE_CHANNEL: "msedge" }, exists: () => false }), { channel: "msedge", label: "SMOKE_CHANNEL=msedge" })
  assert.equal(pickBrowser({ env: {}, bundled: "/b/chrome", exists: has("/b/chrome") }).channel, null)
  const env = { PROGRAMFILES: "C:\\PF", "PROGRAMFILES(X86)": "C:\\PF86", LOCALAPPDATA: "C:\\LA" }
  assert.equal(pickBrowser({ env, platform: "win32", bundled: "/b/none", exists: has(join("C:\\PF", "Google", "Chrome", "Application", "chrome.exe")) }).channel, "chrome")
  assert.equal(pickBrowser({ env, platform: "win32", exists: has(join("C:\\PF86", "Microsoft", "Edge", "Application", "msedge.exe")) }).channel, "msedge")
  assert.equal(pickBrowser({ env, platform: "win32", exists: () => false }), undefined)
  assert.equal(pickBrowser({ env: {}, platform: "linux", exists: has("/usr/bin/google-chrome") }).channel, "chrome")
})

test("환경: 이 PC 의 공급자·모드 이름은 스모크 서버에 새지 않는다. mock 은 장면 모드, live 는 필수 이름만", () => {
  const dirty = { PATH: "p", POSTHOG_HOST: "https://x", LF_MODE: "live", DATABASE_URL: "postgres://x", NODE_ENV: "development", INQUIRY_OWNER_EMAIL: "a@b.co", NEXT_PUBLIC_APP_URL: "https://x", LF_CI_BASE: "abc", LF_SMOKE_MIN_FREE_GB: "4", LF_ALLOW_MOCK_PROD: "1" }
  const c = cleanEnv(dirty)
  for (const n of ["POSTHOG_HOST", "LF_MODE", "DATABASE_URL", "NODE_ENV", "INQUIRY_OWNER_EMAIL", "NEXT_PUBLIC_APP_URL"]) assert.ok(!(n in c), `${n} 가 새었다`)
  assert.equal(c.PATH, "p")
  assert.equal(c.LF_CI_BASE, "abc", "CI 가 쓰는 이름은 지우지 않는다")
  assert.equal(c.LF_SMOKE_MIN_FREE_GB, "4", "스모크 자신의 설정은 지우지 않는다")
  assert.ok(AMBIENT_ENV.test("PADDLE_API_KEY") && !AMBIENT_ENV.test("PATH"))
  const mock = modeEnv("mock", dirty)
  assert.equal(mock.LF_MODE, "mock")
  assert.equal(mock.LF_MOCK_SCENES, "1")
  assert.equal(mock.LF_ALLOW_MOCK_PROD, "1", "mock 운영 빌드 스모크만 풀어 준다(E1)")
  assert.ok(!("DATABASE_URL" in mock) && !("POSTHOG_HOST" in mock))
  const live = modeEnv("live", dirty)
  assert.equal(live.LF_MODE, "live")
  assert.equal(live.LF_ALLOW_MOCK_PROD, undefined, "live 스모크에는 mock 해제 변수가 없다(이 PC 환경의 값도 새지 않는다)")
  assert.equal(live.POSTHOG_HOST, undefined, "live 스모크에 선택 이름이 들어갔다")
  assert.equal(live.INQUIRY_OWNER_EMAIL, undefined)
  assert.equal(live.DATABASE_URL, LIVE_DUMMY.DATABASE_URL, "이 PC 의 실제 DB 주소가 아니라 가짜 값이어야 한다")
  assert.throws(() => modeEnv("x"))
})

test("인자·메모리 대기·보고서 읽기", async () => {
  assert.deepEqual(parseArgs([]), { mode: "all", skipBuild: false, updateAxe: false })
  assert.deepEqual(parseArgs(["--mode", "live", "--skip-build", "--update-axe-baseline"]), { mode: "live", skipBuild: true, updateAxe: true })
  assert.throws(() => parseArgs(["--mode", "x"]))
  assert.throws(() => parseArgs(["--nope"]))
  const seq = [1.0, 2.0, 3.5]
  const waited = []
  const g = await waitForMemory(3, { free: () => seq.shift(), wait: async (ms) => waited.push(ms), log: () => {}, stepMs: 120_000 })
  assert.equal(g, 3.5)
  assert.deepEqual(waited, [120_000, 120_000])
  await assert.rejects(waitForMemory(3, { free: () => 0.5, wait: async () => {}, log: () => {}, steps: 2 }), /아래로/)
  const s = summarizeStats({ expected: 46, unexpected: 1, flaky: 1 })
  assert.equal(s.total, 48)
  assert.match(s.line, /flaky\(재시도 뒤 통과\) 1/)
})

// ── CI 가 ci:verify 단계 전체를 덮는다 ────────────────────────────────────────────────────

/** 워크플로 글에서 verify·build-smoke 작업의 규칙을 점검해 문제 목록을 돌려준다 */
function smokeJobProblems(text, { name }) {
  const problems = []
  const jobs = text.split(/^ {2}(?=[a-z][\w-]*:\s*$)/m)
  const verify = jobs.find((j) => /^verify:/.test(j))
  const smoke = jobs.find((j) => /^build-smoke:/.test(j))
  if (!verify) problems.push(`${name}: verify 작업이 없다`)
  else if (!/run: npm run ci:verify -- --skip smoke\b/.test(verify)) problems.push(`${name}: verify 작업이 「--skip smoke」 로 스모크를 따로 돌리지 않는다(둘 다 돌면 분이 두 배, 둘 다 안 돌면 구멍)`)
  if (!smoke) problems.push(`${name}: build-smoke 작업이 없다`)
  else {
    if (!/needs: verify\b/.test(smoke)) problems.push(`${name}: build-smoke 는 verify 뒤에 돌아야 한다(needs: verify)`)
    if (!/run: npx playwright install --with-deps chromium/.test(smoke)) problems.push(`${name}: build-smoke 가 Playwright 브라우저를 설치하지 않는다`)
    if (!/run: npm run ci:verify -- --only smoke\b/.test(smoke)) problems.push(`${name}: build-smoke 가 smoke 단계를 돌리지 않는다`)
    if (!/actions\/upload-artifact@[0-9a-f]{40}/.test(smoke) || !/failure\(\)/.test(smoke)) problems.push(`${name}: build-smoke 가 실패 때 보고서·추적을 올리지 않는다`)
    if (!/timeout-minutes: \d+/.test(smoke)) problems.push(`${name}: build-smoke 에 timeout-minutes 가 없다`)
  }
  return problems
}

const WORKFLOWS = ["../.github/workflows/launch-factory-ci.yml", "template/.github/workflows/ci.yml", "../.github/workflows/launch-product-ci.yml"]

test("CI: verify 작업은 smoke 만 빼고, build-smoke 작업이 smoke 를 돈다 — 합치면 ci:verify 전체", () => {
  for (const f of WORKFLOWS) assert.deepEqual(smokeJobProblems(read(f), { name: f }), [])
  for (const [label, steps] of [["launch-factory", ROOT_STEPS], ["제품 템플릿", TEMPLATE_STEPS]]) {
    assert.ok(steps.some((s) => s.id === "smoke"), `${label} ci:verify 에 smoke 단계가 없다`)
    assert.equal(steps.filter((s) => s.id === "smoke").length, 1)
  }
})

test("CI 양성 대조: build-smoke 를 지우거나 verify 의 --skip 을 빼면 잡는다", () => {
  const ci = read("../.github/workflows/launch-factory-ci.yml")
  const noSkip = ci.replace("npm run ci:verify -- --skip smoke", "npm run ci:verify")
  assert.ok(smokeJobProblems(noSkip, { name: "x" }).some((p) => /--skip smoke/.test(p)))
  const noJob = ci.slice(0, ci.indexOf("  build-smoke:")) // 작업 통째로 삭제
  assert.ok(smokeJobProblems(noJob, { name: "x" }).some((p) => /build-smoke 작업이 없다/.test(p)))
  const noInstall = ci.replace("run: npx playwright install --with-deps chromium", "run: echo skip")
  assert.ok(smokeJobProblems(noInstall, { name: "x" }).some((p) => /브라우저를 설치하지/.test(p)))
  const noNeeds = ci.replace("    needs: verify\n", "")
  assert.ok(smokeJobProblems(noNeeds, { name: "x" }).some((p) => /needs: verify/.test(p)))
})

test("Playwright 설정: workers 1 · retries 1 · forbidOnly, 의존성은 정확한 판 고정", () => {
  const cfg = read("template/playwright.config.ts")
  assert.match(cfg, /workers: 1,/)
  assert.match(cfg, /retries: 1,/)
  assert.match(cfg, /forbidOnly: true,/)
  const pkg = JSON.parse(read("template/package.json"))
  for (const n of ["@playwright/test", "@axe-core/playwright"]) assert.match(pkg.devDependencies[n] ?? "", /^\d+\.\d+\.\d+$/, `${n} 는 정확한 판으로 고정한다`)
  assert.ok(!pkg.dependencies["@playwright/test"], "브라우저 시험 도구는 devDependencies 다")
})

test("a11y 기준선 파일 모양", () => {
  const j = JSON.parse(read("template/e2e/a11y-known.json"))
  assert.ok(Array.isArray(j.known))
  for (const k of j.known) assert.match(k, /^\/[^|]*\|[^|]+\|[a-z0-9-]+$/, `키 모양이 다르다: ${k}`)
  assert.deepEqual([...j.known], [...j.known].sort(), "정렬돼 있어야 diff 가 읽힌다")
})
