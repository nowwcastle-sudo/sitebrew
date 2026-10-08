// scripts/doctor.mjs — 키가 없을 때·있을 때·공급자가 거부할 때·비밀이 새지 않을 때(J14). 네트워크는 쓰지 않는다: fetch·DB 연결을 주입한다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import * as envPkg from "../../packages/env/src/index.ts"
import { CHECKS, PADDLE_SANDBOX_API, PLAIN_NAMES, SECRET_NAMES, renderReport, runDoctor } from "../doctor.mjs"

test("D193: doctor 와 @launch-factory/env 는 이름 목록을 한 원천에서 읽는다(같은 배열)", () => {
  assert.equal(SECRET_NAMES, envPkg.SECRET_NAMES)
  assert.equal(PLAIN_NAMES, envPkg.PLAIN_NAMES)
  // 공급자 비밀 여덟은 모두 그 목록 안에 있고, 앱이 선택적으로 읽는 이름(D27·D37·D52·D120)도 있다
  for (const n of envPkg.PROVIDER_SECRET_NAMES) assert.ok(SECRET_NAMES.includes(n), n)
  for (const n of ["SUBJECT_REF_KEY", "POSTHOG_PERSONAL_API_KEY", "CRON_SECRET", "GUMROAD_ACCESS_TOKEN"]) assert.ok(SECRET_NAMES.includes(n), n)
  for (const n of ["POSTHOG_HOST", "POSTHOG_PROJECT_ID", "EMAIL_FROM", "PADDLE_CLIENT_TOKEN", "LF_PADDLE_LIVE"]) assert.ok(PLAIN_NAMES.includes(n), n)
  // 비밀과 비밀 아닌 이름이 겹치지 않고 중복이 없다
  const all = [...SECRET_NAMES, ...PLAIN_NAMES]
  assert.equal(new Set(all).size, all.length)
})

// 시험용 값 — 실제 비밀이 아니다. 출력에 이 문자열이 하나라도 나오면 새는 것이다.
const SECRETS = {
  DATABASE_URL: "postgresql://postgres.leakref:LeakPassw0rd@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres",
  BETTER_AUTH_SECRET: "better-auth-secret-leakcheck-0123456789ab",
  SUBJECT_REF_KEY: "subject-ref-key-leakcheck-0123456789abcd",
  PADDLE_API_KEY: `pdl_sdbx_apikey_${"a1".repeat(13)}_${"B2".repeat(11)}_c3d`,
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_TESTTESTTEST_leakcheckWEBHOOKvalue",
  RESEND_API_KEY: "re_leakcheck_resend_key_1234567890",
  POSTHOG_PROJECT_KEY: "phc_leakcheck_project_key_abcdef",
  POSTHOG_PERSONAL_API_KEY: "phx_leakcheck_personal_key_abcdef",
  SENTRY_DSN: "https://leakpublickey@o123.ingest.sentry.io/456789",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAA_leakcheck_secret_key",
  CRON_SECRET: "cron-secret-leakcheck-1234",
  GITHUB_TOKEN: "ghp_leakcheck_token_abcdef0123456789",
}
const PLAIN = {
  LF_MODE: "live",
  PADDLE_CLIENT_TOKEN: "test_" + "AbCd1234".repeat(4).slice(0, 27),
  POSTHOG_HOST: "https://eu.i.posthog.com",
  POSTHOG_PROJECT_ID: "12345",
  EMAIL_FROM: "SampleCo <hello@sampleco.example>",
  TURNSTILE_SITE_KEY: "0x4AAAAAAA_sitekey_abcdef",
}
const FULL = { ...SECRETS, ...PLAIN }
const NOW = new Date("2026-09-30T12:00:00.000Z")
const noUserEnv = (names) => Object.fromEntries(names.map((n) => [n, null]))

/** 호출을 기록하는 가짜 fetch. routes(url, init) 가 { status?, body } 를 돌려주고, 없으면 예상 못 한 호출이라 던진다 */
function fakeFetch(routes) {
  const calls = []
  const fn = async (url, init = {}) => {
    const call = { url: String(url), method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body === undefined ? undefined : String(init.body) }
    calls.push(call)
    const r = routes(call)
    if (!r) throw new Error(`unexpected fetch ${call.url} — ${SECRETS.PADDLE_API_KEY}`) // 메시지에 비밀이 섞여도 출력에는 나오면 안 된다
    if (r.throw) throw r.throw
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } })
  }
  return { fn, calls }
}

const iso = (msAgo) => new Date(NOW.getTime() - msAgo).toISOString()
const HOUR = 3_600_000

/** 모든 공급자가 정상인 응답 */
function happy(over = {}) {
  return (call) => {
    const u = call.url
    for (const [prefix, r] of Object.entries(over)) if (u.startsWith(prefix)) return typeof r === "function" ? r(call) : r
    if (u === `${PADDLE_SANDBOX_API}/notification-settings?per_page=20`) return { body: { data: [{ id: "ntfset_1", active: true }] } }
    if (u === `${PADDLE_SANDBOX_API}/notification-settings/ntfset_1`) return { body: { data: { id: "ntfset_1", active: true, endpoint_secret_key: SECRETS.PADDLE_WEBHOOK_SECRET } } }
    if (u.startsWith(`${PADDLE_SANDBOX_API}/products`)) return { body: { data: [{ id: "pro_1" }] } }
    if (u.startsWith("https://api.resend.com/domains")) return { body: { object: "list", data: [{ name: "sampleco.example", status: "verified" }] } }
    if (u === "https://eu.i.posthog.com/flags?v=2") return { body: { flags: {} } }
    if (u === "https://eu.posthog.com/api/projects/12345/") return { body: { id: 12345, api_token: SECRETS.POSTHOG_PROJECT_KEY } }
    if (u === "https://challenges.cloudflare.com/turnstile/v0/siteverify") return { body: { success: false, "error-codes": ["invalid-input-response"] } }
    if (u.startsWith("https://api.github.com/repos/nowwcastle-sudo/sitebrew/actions/artifacts")) return { body: { artifacts: [{ name: "db-backup", expired: false, created_at: iso(2 * HOUR) }] } }
    if (u.startsWith("https://api.gumroad.com/v2/products")) return { body: { success: true, products: [] } }
    return null
  }
}

const dbOk = () => ({ ping: async () => {}, close: async () => {} })

async function run(stage, env, { routes = happy(), connectDb = dbOk } = {}) {
  const f = fakeFetch(routes)
  const report = await runDoctor({ stage, env, userEnv: noUserEnv, fetch: f.fn, connectDb, now: NOW })
  return { report, calls: f.calls, text: renderReport(report), by: Object.fromEntries(report.checks.map((c) => [c.id, c])) }
}

function assertNoLeak(text, extra = []) {
  for (const v of [...Object.values(SECRETS), ...extra]) {
    assert.ok(!text.includes(v), `출력에 비밀 값이 나왔다: 길이 ${v.length} 로 시작 ${v.slice(0, 4)}…`)
    assert.ok(!text.includes(encodeURIComponent(v)), "URL 인코딩된 비밀 값이 나왔다")
  }
}

test("dev: 키가 하나도 없어도 mock 으로 통과한다 — 호출 0건, 건너뜀 이유가 이름과 함께 나온다", async () => {
  const { report, calls, text, by } = await run("dev", {}, { routes: () => null })
  assert.equal(report.exit, 0)
  assert.equal(calls.length, 0, "키가 없으면 어떤 공급자도 부르지 않는다")
  assert.deepEqual(report.counts, { pass: 1, warn: 1, fail: 0, skip: 10 }, text)
  assert.equal(by.mode.status, "warn") // LF_MODE 미설정은 알린다
  assert.match(by.paddle.detail, /PADDLE_API_KEY/)
  assert.equal(by["paddle-live-guard"].status, "pass")
  assert.equal(report.mode, "mock")
})

test("dev + LF_MODE=mock 이면 경고 없이 깨끗이 통과한다", async () => {
  const { report } = await run("dev", { LF_MODE: "mock" }, { routes: () => null })
  assert.equal(report.exit, 0)
  assert.equal(report.counts.warn, 0)
})

test("sandbox·preview: 키가 없으면 빠진 이름을 모두 한 번에 알리고 종료 1 — 각 줄에 발급처와 O# 이 있다", async () => {
  for (const stage of ["sandbox", "preview"]) {
    const { report, calls, text } = await run(stage, {}, { routes: () => null })
    assert.equal(report.exit, 1, stage)
    assert.equal(calls.length, 0, `${stage}: 키가 없으면 호출하지 않는다(백업도 토큰이 없어 호출 전에 멈춘다)`)
    const required = ["DATABASE_URL", "BETTER_AUTH_SECRET", "SUBJECT_REF_KEY", "PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET", "PADDLE_CLIENT_TOKEN", "RESEND_API_KEY", "EMAIL_FROM", "POSTHOG_PROJECT_KEY", "POSTHOG_HOST", "POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID", "TURNSTILE_SECRET_KEY", "TURNSTILE_SITE_KEY", "SENTRY_DSN", "LF_MODE"]
    for (const name of required) assert.ok(text.includes(name), `${stage}: 빠진 이름 ${name} 이 출력에 없다`)
    for (const o of ["O2", "O3", "O4", "O5", "O6", "O7", "O28"]) assert.ok(text.includes(`운영자 할 일 ${o}`), `${stage}: ${o} 안내가 없다`)
    assert.ok(report.counts.fail >= 10)
  }
  const pre = await run("preview", {}, { routes: () => null })
  assert.match(pre.text, /CRON_SECRET/)
  assert.equal(pre.by.backup.status, "fail", "preview 는 백업 확인 못 함이 실패")
  const sand = await run("sandbox", {}, { routes: () => null })
  assert.equal(sand.by.backup.status, "warn", "sandbox 는 경고")
  assert.ok(!sand.report.checks.some((c) => c.id === "cron"), "sandbox 에는 CRON_SECRET 검사가 없다")
})

test("sandbox 정상: 키마다 정해진 읽기 호출을 정확한 주소·머리로 한 번씩 부른다", async () => {
  const { report, calls, text, by } = await run("sandbox", FULL)
  assert.equal(report.exit, 0, text)
  assert.equal(report.counts.fail, 0)
  const at = (prefix) => calls.filter((c) => c.url.startsWith(prefix))
  const paddle = at(`${PADDLE_SANDBOX_API}/products`)
  assert.equal(paddle.length, 1)
  assert.equal(paddle[0].method, "GET")
  assert.equal(paddle[0].headers.authorization, `Bearer ${SECRETS.PADDLE_API_KEY}`)
  assert.match(paddle[0].url, /per_page=1$/)
  assert.equal(at("https://api.paddle.com").length, 0, "실결제 호스트는 부르지 않는다")
  const resend = at("https://api.resend.com/domains")
  assert.equal(resend.length, 1)
  assert.equal(resend[0].headers.authorization, `Bearer ${SECRETS.RESEND_API_KEY}`)
  const flags = calls.find((c) => c.url === "https://eu.i.posthog.com/flags?v=2")
  assert.equal(flags.method, "POST")
  assert.equal(JSON.parse(flags.body).api_key, SECRETS.POSTHOG_PROJECT_KEY)
  const project = calls.find((c) => c.url === "https://eu.posthog.com/api/projects/12345/")
  assert.equal(project.headers.authorization, `Bearer ${SECRETS.POSTHOG_PERSONAL_API_KEY}`)
  const ts = calls.find((c) => c.url.startsWith("https://challenges.cloudflare.com/"))
  assert.equal(ts.method, "POST")
  assert.equal(new URLSearchParams(ts.body).get("secret"), SECRETS.TURNSTILE_SECRET_KEY)
  const gh = at("https://api.github.com/repos/nowwcastle-sudo/sitebrew/actions/artifacts")
  assert.equal(gh.length, 1)
  assert.equal(gh[0].headers.authorization, `Bearer ${SECRETS.GITHUB_TOKEN}`)
  assert.equal(calls.length, 8, "Paddle(상품·알림 대상 목록·한 건)·Resend·PostHog 둘·Turnstile·GitHub — 그 밖의 호출은 없다")
  assert.equal(by["paddle-webhook"].status, "pass", "알림 대상의 비밀과 같다")
  assert.deepEqual(at(`${PADDLE_SANDBOX_API}/notification-settings`).map((c) => c.method), ["GET", "GET"], "알림 대상은 읽기만 한다")
  assert.equal(by.database.status, "pass")
  assert.equal(by.sentry.status, "warn", "Sentry 는 형식만 본다 — 경고로 그 사실을 밝힌다")
  assert.equal(by.gumroad.status, "skip")
  assertNoLeak(text)
})

test("preview 정상: sandbox + CRON_SECRET + 26시간 안 백업", async () => {
  const { report, by, text } = await run("preview", FULL)
  assert.equal(report.exit, 0, text)
  assert.equal(by.cron.status, "pass")
  assert.equal(by.backup.status, "pass")
  assert.match(by.backup.detail, /마지막 백업 2시간 전/)
  assertNoLeak(text)
})

test("어디서든 비밀 값은 출력에 나오지 않는다 — 오류 문구·연결 실패·fetch 예외에 섞여도", async () => {
  const leaky = new Error(`connect failed ${SECRETS.DATABASE_URL} with ${SECRETS.PADDLE_API_KEY}`)
  leaky.code = "28P01"
  const { text, by } = await run("preview", FULL, {
    routes: happy({ [PADDLE_SANDBOX_API]: { throw: new Error(`socket ${SECRETS.PADDLE_API_KEY}`) } }),
    connectDb: async () => ({ ping: async () => Promise.reject(leaky), close: async () => {} }),
  })
  assertNoLeak(text)
  assert.equal(by.database.status, "fail")
  assert.match(by.database.detail, /28P01/, "코드는 남는다")
  assert.equal(by.paddle.status, "fail")
  // JSON 출력도 같다
  assertNoLeak(JSON.stringify(await runDoctor({ stage: "preview", env: FULL, userEnv: noUserEnv, fetch: fakeFetch(happy()).fn, connectDb: dbOk, now: NOW })))
})

test("Paddle: 401 은 키 거부, 403 은 product.read 권한 없음, 실결제 키는 호출 전에 막는다", async () => {
  let r = await run("sandbox", FULL, { routes: happy({ [PADDLE_SANDBOX_API]: { status: 401, body: { error: { code: "authentication_malformed" } } } }) })
  assert.equal(r.by.paddle.status, "fail")
  assert.match(r.by.paddle.detail, /GET \/products 401 — 키가 거부됐다/)
  r = await run("sandbox", FULL, { routes: happy({ [PADDLE_SANDBOX_API]: { status: 403, body: {} } }) })
  assert.match(r.by.paddle.detail, /product\.read/)
  const live = { ...FULL, PADDLE_API_KEY: `pdl_live_apikey_${"a1".repeat(13)}_${"B2".repeat(11)}_c3d` }
  r = await run("sandbox", live)
  assert.equal(r.by.paddle.status, "fail")
  assert.match(r.by.paddle.detail, /실결제 키/)
  assert.ok(!r.calls.some((c) => c.url.startsWith(PADDLE_SANDBOX_API)), "실결제 키로는 어느 호스트도 부르지 않는다")
  r = await run("sandbox", { ...FULL, PADDLE_CLIENT_TOKEN: "live_" + "x".repeat(27) })
  assert.match(r.by["paddle-client-token"].detail, /실결제 토큰/)
  r = await run("sandbox", { ...FULL, PADDLE_WEBHOOK_SECRET: "not-a-paddle-secret" })
  assert.equal(r.by["paddle-webhook"].status, "fail")
  r = await run("sandbox", { ...FULL, LF_PADDLE_LIVE: "1" })
  assert.equal(r.by["paddle-live-guard"].status, "fail")
  r = await run("sandbox", FULL, { routes: happy({ [PADDLE_SANDBOX_API]: { body: { data: [] } } }) })
  assert.equal(r.by.paddle.status, "warn", "상품 0개는 경고")
})

test("Resend: 발송 전용 키(401 restricted_api_key)는 경고, 꺼진 키(403)는 실패, 도메인 미인증·없음은 실패", async () => {
  const D = "https://api.resend.com/domains"
  let r = await run("sandbox", FULL, { routes: happy({ [D]: { status: 401, body: { name: "restricted_api_key", message: "This API key is restricted to only send emails" } } }) })
  assert.equal(r.by.resend.status, "warn")
  assert.match(r.by.resend.detail, /확인 안 됨/)
  assert.equal(r.report.exit, 0)
  r = await run("sandbox", FULL, { routes: happy({ [D]: { status: 403, body: { name: "restricted_api_key" } } }) })
  assert.equal(r.by.resend.status, "fail")
  r = await run("sandbox", FULL, { routes: happy({ [D]: { body: { data: [{ name: "sampleco.example", status: "pending" }] } } }) })
  assert.equal(r.by.resend.status, "fail")
  assert.match(r.by.resend.detail, /pending/)
  r = await run("sandbox", FULL, { routes: happy({ [D]: { body: { data: [{ name: "other.example", status: "verified" }] } } }) })
  assert.match(r.by.resend.detail, /sampleco\.example 이 이 계정에 없다/)
  r = await run("sandbox", { ...FULL, EMAIL_FROM: "not-an-address" })
  assert.equal(r.by.resend.status, "fail")
  r = await run("sandbox", { ...FULL, EMAIL_FROM: undefined })
  assert.match(r.by.resend.detail, /없음 EMAIL_FROM/)
})

test("PostHog: 프로젝트 키가 다른 프로젝트 것이면 실패, 개인 키 401·프로젝트 404 를 가른다, 모르는 호스트는 지역을 요구한다", async () => {
  const P = "https://eu.posthog.com/api/projects/12345/"
  let r = await run("sandbox", FULL, { routes: happy({ [P]: { body: { api_token: "phc_someone_elses_project_key" } } }) })
  assert.equal(r.by.posthog.status, "fail")
  assert.match(r.by.posthog.detail, /다른 프로젝트/)
  assertNoLeak(r.text, ["phc_someone_elses_project_key"])
  r = await run("sandbox", FULL, { routes: happy({ [P]: { status: 401, body: {} } }) })
  assert.match(r.by.posthog.detail, /개인 API 키가 거부/)
  r = await run("sandbox", FULL, { routes: happy({ [P]: { status: 404, body: {} } }) })
  assert.match(r.by.posthog.detail, /POSTHOG_PROJECT_ID/)
  r = await run("sandbox", FULL, { routes: happy({ [P]: { body: { id: 12345 } } }) })
  assert.equal(r.by.posthog.status, "warn", "api_token 이 없으면 짝을 못 본 것 — 경고로 밝힌다")
  r = await run("sandbox", FULL, { routes: happy({ "https://eu.i.posthog.com/flags": { status: 401, body: {} } }) })
  assert.match(r.by.posthog.detail, /프로젝트 키가 거부/)
  r = await run("sandbox", { ...FULL, POSTHOG_HOST: "https://analytics.example.test" })
  assert.equal(r.by.posthog.status, "fail")
  r = await run("sandbox", { ...FULL, POSTHOG_PROJECT_ID: "abc" })
  assert.match(r.by.posthog.detail, /숫자/)
})

test("Turnstile: 비밀 키가 틀리면(invalid-input-secret) 실패, 틀린 토큰만 거부하면 비밀 키는 맞는 것, 시험 키는 경고", async () => {
  const S = "https://challenges.cloudflare.com/"
  let r = await run("sandbox", FULL, { routes: happy({ [S]: { body: { success: false, "error-codes": ["invalid-input-secret"] } } }) })
  assert.equal(r.by.turnstile.status, "fail")
  assert.equal((await run("sandbox", FULL)).by.turnstile.status, "pass")
  const testKeys = { ...FULL, TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA", TURNSTILE_SITE_KEY: "1x00000000000000000000AA" }
  r = await run("sandbox", testKeys, { routes: happy({ [S]: { body: { success: true } } }) })
  assert.equal(r.by.turnstile.status, "warn")
  assert.match(r.by.turnstile.detail, /시험 키/)
  r = await run("sandbox", FULL, { routes: happy({ [S]: { status: 500, body: {} } }) })
  assert.equal(r.by.turnstile.status, "fail")
})

test("Supabase: select 1 실패는 코드만 알리고, 형식 오류·직접 연결·세션 풀러는 각각 다르게 말한다", async () => {
  let r = await run("sandbox", { ...FULL, DATABASE_URL: "mysql://x" })
  assert.match(r.by.database.detail, /형식이/)
  r = await run("sandbox", { ...FULL, DATABASE_URL: "postgresql://postgres.ref:pw@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres" })
  assert.equal(r.by.database.status, "warn")
  assert.match(r.by.database.detail, /6543/)
})

test("Supabase: 응답 없는 연결은 시간 제한 뒤 실패로 끝난다(멈추지 않는다)", async () => {
  const f = fakeFetch(happy())
  const report = await runDoctor({ stage: "sandbox", env: FULL, userEnv: noUserEnv, fetch: f.fn, connectDb: async () => ({ ping: () => new Promise(() => {}), close: async () => {} }), now: NOW, timeoutMs: 200 })
  const db = report.checks.find((c) => c.id === "database")
  assert.equal(db.status, "fail")
  assert.match(db.detail, /TIMEOUT/)
})

test("백업: 26시간을 넘기면 preview 는 실패, sandbox 는 경고 · artifact 없음·토큰 없음도 이유를 말한다", async () => {
  const A = "https://api.github.com/repos/nowwcastle-sudo/sitebrew/actions/artifacts"
  const stale = { [A]: { body: { artifacts: [{ name: "db-backup", expired: false, created_at: iso(30 * HOUR) }] } } }
  let r = await run("preview", FULL, { routes: happy(stale) })
  assert.equal(r.by.backup.status, "fail")
  assert.match(r.by.backup.detail, /30시간 전.*26시간 초과/)
  r = await run("sandbox", FULL, { routes: happy(stale) })
  assert.equal(r.by.backup.status, "warn")
  assert.equal(r.report.exit, 0)
  r = await run("preview", FULL, { routes: happy({ [A]: { body: { artifacts: [] } } }) })
  assert.match(r.by.backup.detail, /없음/)
  r = await run("preview", { ...FULL, GITHUB_TOKEN: undefined }, { routes: happy() })
  assert.match(r.by.backup.detail, /GITHUB_TOKEN 또는 GH_TOKEN/)
  r = await run("preview", { ...FULL, GITHUB_TOKEN: undefined, GH_TOKEN: "gho_leakcheck_alt_token_012345" }, { routes: happy() })
  assert.equal(r.by.backup.status, "pass", "GH_TOKEN 도 받는다")
  r = await run("preview", FULL, { routes: happy({ [A]: { status: 404, body: {} } }) })
  assert.match(r.by.backup.detail, /응답 404/)
})

test("dev 에서 넣어 둔 키가 틀리면 부르되 경고로 낮춘다(mock 은 그 키를 쓰지 않는다) — LF_MODE=live 면 실패", async () => {
  const routes = happy({ [PADDLE_SANDBOX_API]: { status: 401, body: {} } })
  let r = await run("dev", { LF_MODE: "mock", PADDLE_API_KEY: SECRETS.PADDLE_API_KEY }, { routes })
  assert.equal(r.by.paddle.status, "warn")
  assert.match(r.by.paddle.detail, /mock 모드라 앱은 이 값을 쓰지 않는다/)
  assert.equal(r.report.exit, 0)
  assert.equal(r.calls.length, 1, "넣은 키는 부른다")
  r = await run("dev", { ...FULL }, { routes })
  assert.equal(r.by.paddle.status, "fail")
  assert.equal(r.report.exit, 1)
  // 일부만 넣은 경우: mock 에서는 알리고, live 에서는 실패
  r = await run("dev", { LF_MODE: "mock", RESEND_API_KEY: SECRETS.RESEND_API_KEY }, { routes: () => null })
  assert.equal(r.by.resend.status, "warn")
  assert.match(r.by.resend.detail, /EMAIL_FROM/)
})

test("LF_MODE 가 mock·live 가 아니면 어느 단계든 실패, sandbox 에 LF_MODE=mock 도 실패", async () => {
  assert.equal((await run("dev", { LF_MODE: "prod" }, { routes: () => null })).by.mode.status, "fail")
  const r = await run("sandbox", { ...FULL, LF_MODE: "mock" })
  assert.equal(r.by.mode.status, "fail")
  assert.equal(r.report.exit, 1)
})

test("Gumroad: 넣은 것이 하나라도 있으면 둘 다 필요하고, 토큰은 GET /products 로 확인한다", async () => {
  let r = await run("sandbox", { ...FULL, GUMROAD_ACCESS_TOKEN: "gum_leakcheck_token_0123456789" })
  assert.equal(r.by.gumroad.status, "fail")
  assert.match(r.by.gumroad.detail, /없음 GUMROAD_PING_SECRET/)
  assert.match(r.by.gumroad.detail, /O29/)
  const gum = { ...FULL, GUMROAD_ACCESS_TOKEN: "gum_leakcheck_token_0123456789", GUMROAD_PING_SECRET: "gum_ping_leakcheck_secret_0123" }
  r = await run("sandbox", gum)
  assert.equal(r.by.gumroad.status, "pass")
  const call = r.calls.find((c) => c.url.startsWith("https://api.gumroad.com/v2/products"))
  assert.equal(call.headers.authorization, `Bearer ${gum.GUMROAD_ACCESS_TOKEN}`)
  assert.ok(!r.text.includes(gum.GUMROAD_ACCESS_TOKEN) && !r.text.includes(gum.GUMROAD_PING_SECRET))
  r = await run("sandbox", gum, { routes: happy({ "https://api.gumroad.com/": { status: 401, body: { success: false, message: "bad token" } } }) })
  assert.equal(r.by.gumroad.status, "fail")
})

test("Sentry: DSN 은 형식만 본다 — 경로가 있는 자체 호스팅 모양은 받고, 프로젝트 번호가 없거나 http 면 실패", async () => {
  let r = await run("sandbox", { ...FULL, SENTRY_DSN: "https://pub@sentry.example.test/prefix/42" })
  assert.equal(r.by.sentry.status, "warn")
  assert.match(r.by.sentry.detail, /읽기 확인 엔드포인트가 없다/)
  for (const bad of ["https://pub@o1.ingest.sentry.io/notnumber", "http://pub@o1.ingest.sentry.io/1", "https://o1.ingest.sentry.io/1", "not a url"]) {
    r = await run("sandbox", { ...FULL, SENTRY_DSN: bad })
    assert.equal(r.by.sentry.status, "fail", bad)
  }
})

test("짧은 비밀·같은 비밀은 호출 없이 실패한다", async () => {
  let r = await run("sandbox", { ...FULL, BETTER_AUTH_SECRET: "short" })
  assert.equal(r.by["secrets-local"].status, "fail")
  assert.match(r.by["secrets-local"].detail, /BETTER_AUTH_SECRET 길이 5/)
  r = await run("sandbox", { ...FULL, SUBJECT_REF_KEY: FULL.BETTER_AUTH_SECRET })
  assert.match(r.by["secrets-local"].detail, /두 값이 같다/)
  r = await run("preview", { ...FULL, CRON_SECRET: "tiny" })
  assert.equal(r.by.cron.status, "fail")
})

test("--only 로 검사를 고르면 그것만 돈다", async () => {
  const f = fakeFetch(happy())
  const report = await runDoctor({ stage: "sandbox", env: FULL, userEnv: noUserEnv, fetch: f.fn, connectDb: dbOk, now: NOW, only: ["paddle"] })
  assert.deepEqual(report.checks.map((c) => c.id), ["paddle"])
  assert.equal(f.calls.length, 1)
})

test("모든 비밀 이름이 SECRET_NAMES 에 있고, 검사마다 id 가 하나뿐이다", () => {
  const ids = CHECKS.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const n of Object.keys(SECRETS)) assert.ok(SECRET_NAMES.includes(n), `${n} 이 SECRET_NAMES 에 없다 — 출력 가림에서 빠진다`)
  assert.ok(SECRET_NAMES.includes("GUMROAD_ACCESS_TOKEN") && SECRET_NAMES.includes("GUMROAD_PING_SECRET") && SECRET_NAMES.includes("POSTHOG_PERSONAL_API_KEY"))
})

// ── 소셜 로그인 키(v0 소셜 레인) ─────────────────────────────────────────────────
const GOOGLE_KEYS = { GOOGLE_CLIENT_ID: "1234567890-lfdoctorleakcheck.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "GOCSPX-doctor-leakcheck-not-real" }

test("social: 키가 없으면 건너뜀(호출 없음) · 둘 다 있으면 통과(길이만, 값은 안 나온다) · 하나만 있으면 경고(앱이 켜지 않는다) · dev 단계에서는 돌지 않는다", async () => {
  // 없음
  const none = await run("sandbox", FULL)
  assert.equal(none.by.social.status, "skip", none.text)
  assert.equal(none.report.exit, 0)
  // 둘 다
  const both = await run("sandbox", { ...FULL, ...GOOGLE_KEYS })
  assert.equal(both.by.social.status, "pass", both.text)
  assert.match(both.by.social.detail, /켜짐 google\(GOOGLE_CLIENT_ID 길이 \d+ · GOOGLE_CLIENT_SECRET 길이 \d+\)/)
  assert.match(both.by.social.detail, /꺼짐 kakao, naver/)
  assert.equal(both.report.exit, 0)
  assertNoLeak(both.text, Object.values(GOOGLE_KEYS))
  // 하나만(비밀 없음): 경고 + 빠진 이름 + 발급 안내(O8). 종료 코드는 그대로 0 — 경고는 실패가 아니다
  const half = await run("preview", { ...FULL, CRON_SECRET: SECRETS.CRON_SECRET, GOOGLE_CLIENT_ID: GOOGLE_KEYS.GOOGLE_CLIENT_ID })
  assert.equal(half.by.social.status, "warn", half.text)
  assert.match(half.by.social.detail, /google 는 GOOGLE_CLIENT_SECRET 가 없어 앱이 켜지 않는다/)
  assert.match(half.by.social.detail, /O8/)
  assertNoLeak(half.text, [GOOGLE_KEYS.GOOGLE_CLIENT_ID])
  // 모양이 이상한 구글 클라이언트 ID 는 경고
  const odd = await run("sandbox", { ...FULL, GOOGLE_CLIENT_ID: "not-a-google-id", GOOGLE_CLIENT_SECRET: GOOGLE_KEYS.GOOGLE_CLIENT_SECRET })
  assert.equal(odd.by.social.status, "warn")
  assert.match(odd.by.social.detail, /apps\.googleusercontent\.com/)
  // 공급자 호출은 하지 않는다(Google 호스트 0건)
  assert.equal(both.calls.filter((c) => /google/i.test(c.url)).length, 0)
  // dev 단계에는 없다
  const dev = await run("dev", { LF_MODE: "mock", ...GOOGLE_KEYS })
  assert.ok(!dev.by.social)
})

// ── CLI(별도 프로세스) ──────────────────────────────────────────────────────────
const DOCTOR = fileURLToPath(new URL("../doctor.mjs", import.meta.url))
/** 이 기계의 실제 키가 시험에 섞이지 않게 점검 대상 이름을 모두 지운다 */
function cleanEnv() {
  const env = { ...process.env }
  for (const n of [...SECRET_NAMES, ...PLAIN_NAMES]) delete env[n]
  return env
}
const cli = (...args) => spawnSync(process.execPath, [DOCTOR, ...args], { env: cleanEnv(), encoding: "utf8", timeout: 60_000 })

test("CLI: 키 없이 --stage dev 는 종료 0, sandbox·preview 는 종료 1, 잘못된 인자는 종료 2", () => {
  const dev = cli("--stage", "dev", "--no-user-env")
  assert.equal(dev.status, 0, dev.stdout + dev.stderr)
  assert.match(dev.stdout, /검사 12개 · 통과 1 · 경고 1 · 실패 0 · 건너뜀 10 → 종료 0/)
  for (const stage of ["sandbox", "preview"]) {
    const r = cli("--stage", stage, "--no-user-env")
    assert.equal(r.status, 1, `${stage}: ${r.stdout}`)
    for (const name of ["DATABASE_URL", "PADDLE_API_KEY", "RESEND_API_KEY", "POSTHOG_PROJECT_KEY", "TURNSTILE_SECRET_KEY", "SENTRY_DSN"]) assert.ok(r.stdout.includes(name), `${stage}: ${name}`)
  }
  assert.equal(cli("--stage", "prod").status, 2)
  assert.equal(cli().status, 2)
  assert.equal(cli("--stage", "dev", "--only", "nope").status, 2)
  const json = JSON.parse(cli("--stage", "dev", "--no-user-env", "--json").stdout)
  assert.equal(json.exit, 0)
  assert.equal(json.checks.length, 12)
})

test("F10 paddle-webhook: 자리표시자·알림 대상 0개·다른 비밀은 실패, 읽기 권한이 없으면 경고(형식만), 값은 출력하지 않는다", async () => {
  const list = `${PADDLE_SANDBOX_API}/notification-settings?per_page=20`
  // 자리표시자(LF12 가 live 환경 검사를 넘기려 넣은 값)는 형식이 맞아도 실패 — 호출 없이 막는다
  const placeholder = "pdl_ntfset_local_placeholder_" + "0".repeat(32)
  let r = await run("sandbox", { ...FULL, PADDLE_WEBHOOK_SECRET: placeholder })
  assert.equal(r.by["paddle-webhook"].status, "fail")
  assert.match(r.by["paddle-webhook"].detail, /자리표시자/)
  assert.ok(!r.calls.some((c) => c.url.includes("/notification-settings")), "자리표시자는 호출 전에 거른다")
  assertNoLeak(r.text, [placeholder])
  // 알림 대상이 하나도 없다
  r = await run("sandbox", FULL, { routes: happy({ [list]: { body: { data: [] } } }) })
  assert.equal(r.by["paddle-webhook"].status, "fail")
  assert.match(r.by["paddle-webhook"].detail, /알림 대상이 하나도 없다/)
  // 있지만 비밀이 다르다
  r = await run("sandbox", FULL, { routes: happy({ [`${PADDLE_SANDBOX_API}/notification-settings/ntfset_1`]: { body: { data: { id: "ntfset_1", active: true, endpoint_secret_key: "pdl_ntfset_OTHERvalue_leakcheck" } } } }) })
  assert.equal(r.by["paddle-webhook"].status, "fail")
  assert.match(r.by["paddle-webhook"].detail, /다르다/)
  assertNoLeak(r.text, ["pdl_ntfset_OTHERvalue_leakcheck"])
  // 꺼진 알림 대상은 세지 않는다
  r = await run("sandbox", FULL, { routes: happy({ [list]: { body: { data: [{ id: "ntfset_1", active: false }] } } }) })
  assert.equal(r.by["paddle-webhook"].status, "fail")
  // 목록 응답이 비밀을 같이 주면 한 건 조회 없이 같은 결과
  r = await run("sandbox", FULL, { routes: happy({ [list]: { body: { data: [{ id: "ntfset_9", active: true, endpoint_secret_key: SECRETS.PADDLE_WEBHOOK_SECRET }] } } }) })
  assert.equal(r.by["paddle-webhook"].status, "pass")
  assert.equal(r.calls.filter((c) => c.url.includes("/notification-settings/")).length, 0)
  // 읽기 권한이 없다 → 실패가 아니라 경고(형식만 확인했다고 밝힌다)
  r = await run("sandbox", FULL, { routes: happy({ [list]: { status: 403, body: { error: { code: "forbidden" } } } }) })
  assert.equal(r.by["paddle-webhook"].status, "warn")
  assert.match(r.by["paddle-webhook"].detail, /형식만 확인/)
  assertNoLeak(r.text)
})

// ── K03: 사업자 정보 경고 ────────────────────────────────────────────────────────
const BUSINESS_FAKE = {
  LF_BUSINESS_NAME: "Example Co.",
  LF_BUSINESS_OWNER: "Example Owner",
  LF_BUSINESS_ADDRESS: "1 Example Street, Example City",
  LF_BUSINESS_PHONE: "+82 10-0000-0000",
  LF_BUSINESS_EMAIL: "hello@example.test",
  LF_BUSINESS_REG_NO: "000-00-00000",
  LF_HOSTING_PROVIDER: "Example Hosting Inc.",
}

test("K03 business-info: sandbox·preview(live)에서 표시 의무 칸이 비면 경고 — 빠진 이름만 알리고 값은 싣지 않으며 종료 코드는 바꾸지 않는다", async () => {
  for (const stage of ["sandbox", "preview"]) {
    const empty = await run(stage, FULL)
    assert.equal(empty.by["business-info"].status, "warn", stage)
    for (const n of ["LF_BUSINESS_NAME", "LF_BUSINESS_OWNER", "LF_BUSINESS_ADDRESS", "LF_BUSINESS_PHONE", "LF_BUSINESS_EMAIL", "LF_BUSINESS_REG_NO", "LF_HOSTING_PROVIDER"]) assert.ok(empty.by["business-info"].detail.includes(n), `${stage}: ${n}`)
    assert.match(empty.by["business-info"].detail, /전자상거래법 제10조/)
    // 통신판매업 신고번호는 면제 사업자면 비워도 되는 칸이라 「비어 있음」 목록에 없다(안내 문장에만 나온다)
    assert.ok(!/비어 있음 [^—]*LF_MAIL_ORDER_NO/.test(empty.by["business-info"].detail))
    // 일부만 채우면 나머지만
    const some = await run(stage, { ...FULL, LF_BUSINESS_NAME: "Example Co.", LF_BUSINESS_PHONE: "+82 10-0000-0000" })
    const head = some.by["business-info"].detail.split("—")[0]
    assert.ok(!head.includes("LF_BUSINESS_NAME") && !head.includes("LF_BUSINESS_PHONE"), "채운 칸은 빠진 목록에 없다")
    assert.ok(head.includes("LF_BUSINESS_REG_NO"))
    assertNoLeak(some.text, ["Example Co.", "+82 10-0000-0000"])
    assert.ok(!some.text.includes("+82 10-0000-0000") && !some.text.includes("Example Co."), "값은 출력하지 않는다")
    // 경고라서 다른 검사의 종료 코드를 바꾸지 않는다(양성 대조: 빈 값이든 채운 값이든 같은 종료 코드)
    const full = await run(stage, { ...FULL, ...BUSINESS_FAKE })
    assert.equal(full.by["business-info"].status, "pass", stage)
    assert.equal(empty.report.exit, full.report.exit)
  }
})

test("K03 business-info: dev 단계에는 이 점검이 없다(비워 두어도 된다)", async () => {
  const dev = await run("dev", {}, { routes: () => null })
  assert.ok(!dev.by["business-info"])
})

test("K01 legal-pages: placeholder·draft 는 경고(공개 불가)·세 쪽이 모두 final 이면 통과·dev 단계에는 없다 — 읽지 못하는 쪽도 경고", async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = mkdtempSync(join(tmpdir(), "lf-legal-"))
  try {
    const write = (statuses) => {
      for (const [slug, status] of Object.entries(statuses)) writeFileSync(join(dir, `${slug}.json`), JSON.stringify({ status, contact: "x", clauses: [] }))
    }
    const go = async (stage) => {
      const f = fakeFetch(happy())
      const report = await runDoctor({ stage, env: FULL, userEnv: noUserEnv, fetch: f.fn, connectDb: dbOk, now: NOW, legalDir: dir })
      return Object.fromEntries(report.checks.map((c) => [c.id, c]))["legal-pages"]
    }
    for (const stage of ["sandbox", "preview"]) {
      write({ terms: "draft", privacy: "draft", refund: "placeholder" })
      const some = await go(stage)
      assert.equal(some.status, "warn", stage)
      assert.match(some.detail, /terms: draft/)
      assert.match(some.detail, /refund: placeholder/)
      write({ terms: "final", privacy: "final", refund: "draft" })
      const one = await go(stage)
      assert.equal(one.status, "warn")
      assert.ok(!/terms: final|privacy: final/.test(one.detail) && /refund: draft/.test(one.detail), "final 쪽은 목록에 없다")
      write({ terms: "final", privacy: "final", refund: "final" })
      assert.equal((await go(stage)).status, "pass", stage)
    }
    rmSync(join(dir, "refund.json"))
    assert.equal((await go("sandbox")).status, "warn", "파일이 없으면 final 이 아니다")
    const dev = await runDoctor({ stage: "dev", env: {}, userEnv: noUserEnv, fetch: fakeFetch(() => null).fn, connectDb: dbOk, now: NOW, legalDir: dir })
    assert.ok(!dev.checks.some((c) => c.id === "legal-pages"))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
