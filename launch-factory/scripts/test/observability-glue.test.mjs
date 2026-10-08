// LFOBS: 분석 호스트(POSTHOG_HOST)가 없으면 서버 쪽도 던지지 않는다 — 서버 계측은 아무것도 보내지 않고, 탈퇴 파기 Cron 의 PostHog 지움 단계는 「지울 것이 없음」으로 지나간다.
// 레지스트리 조립 파일(feature-analytics-posthog/…/analytics.ts · feature-account-lifecycle/…/account.ts)을 진짜 그대로 불러
// 앱 조립 모듈(env·db·auth·config·mailer·account-billing)만 시험 대역으로 바꾼다(scripts/test/registry-glue.mjs).
import assert from "node:assert/strict"
import { before, test } from "node:test"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

// analytics() 는 첫 값을 캐시한다 — 시험마다 쿼리 문자열을 붙여 새 모듈로 불러온다
const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const fresh = (rel, tag) => import(`${pathToFileURL(join(ROOT, "registry", rel)).href}?${tag}`)

let mode = "live"
before(() => {
  stubs.config = { PRODUCT_NAME: "TestProduct", DEFAULT_LOCALE: "en", appUrl: () => "http://localhost:3000" }
  stubs.db = { database: async () => ({}) }
  stubs.auth = { authIO: () => ({}), getAuth: async () => ({}) }
  stubs["account-billing"] = { billingPorts: async () => ({}) }
  stubs.mailer = { mailer: () => ({ mode: "mock", send: async () => ({}) }) }
  // env(): 모드는 시험이 정한다. optional/required: 진짜 구현과 같다(process.env, 빈 문자열은 없음 · required 는 없으면 던진다)
  stubs.env = {
    env: () => ({ LF_MODE: mode }),
    optional: (n) => process.env[n] || undefined,
    required: (n) => {
      const v = process.env[n]
      if (!v) throw new Error(`${n} is not set (see .env.example)`)
      return v
    },
  }
})
installGlueStubs({
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  auth: ["authIO", "getAuth"],
  "account-billing": ["billingPorts"],
  env: ["env", "optional", "required"],
  mailer: ["mailer"],
})

const clear = () => {
  for (const n of ["POSTHOG_HOST", "POSTHOG_PROJECT_KEY", "POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID"]) delete process.env[n]
}

test("서버 계측: live 인데 POSTHOG_HOST 가 없으면 던지지 않고 아무것도 보내지 않는 계측(enabled false)을 준다", async () => {
  clear()
  mode = "live"
  process.env.POSTHOG_PROJECT_KEY = "phc_fake_not_secret"
  // 모듈은 캐시를 가지므로 시험마다 새로 불러온다(쿼리 문자열로 다른 모듈)
  const lib = await fresh("feature-analytics-posthog/files/lib/launch/analytics.ts", "off")
  const a = lib.analytics()
  assert.equal(a.enabled, false)
  const port = a.forRequest({ distinctId: "user_1", consent: { analytics: true, marketing: true, decidedAt: "2026-10-05T00:00:00Z" } })
  assert.doesNotThrow(() => port.track("page_view", { path: "/" }))
  await a.flush()
})

test("서버 계측(대조군): POSTHOG_HOST 가 있으면 켜진 어댑터(enabled true, 지역 US)", async () => {
  clear()
  mode = "live"
  process.env.POSTHOG_PROJECT_KEY = "phc_fake_not_secret"
  process.env.POSTHOG_HOST = "https://us.i.posthog.com"
  const lib = await fresh("feature-analytics-posthog/files/lib/launch/analytics.ts", "on")
  const a = lib.analytics()
  assert.equal(a.enabled, true)
  assert.equal(a.region.region, "us")
  await a.shutdown()
})

test("서버 계측: mock 은 값이 있어도 공급자에 보내지 않는다(enabled false)", async () => {
  clear()
  mode = "mock"
  process.env.POSTHOG_PROJECT_KEY = "phc_fake_not_secret"
  process.env.POSTHOG_HOST = "https://us.i.posthog.com"
  const lib = await fresh("feature-analytics-posthog/files/lib/launch/analytics.ts", "mock")
  assert.equal(lib.analytics().enabled, false)
})

test("탈퇴 파기 Cron 의 PostHog 지움: 분석을 켠 적이 없으면(호스트·키 모두 없음) 지울 것이 없어 던지지 않는다 — 예전엔 required(POSTHOG_HOST)로 Cron 전체가 멈췄다", async () => {
  clear()
  mode = "live"
  const { analyticsEraser } = await importRegistryFile("feature-account-lifecycle/files/lib/launch/account.ts")
  const eraser = analyticsEraser()
  await assert.doesNotReject(() => eraser.erase(["user_1"]))
})

test("탈퇴 파기 Cron 의 PostHog 지움: 일부만 설정돼 있으면 지울 수 없는 상태다 — 던지지 않고 지움 단계가 이름만 알리는 실패로 남는다(DB 파기는 막지 않는다)", async () => {
  mode = "live"
  const { analyticsEraser } = await importRegistryFile("feature-account-lifecycle/files/lib/launch/account.ts")
  for (const [set, missing] of [
    [{ POSTHOG_HOST: "https://us.i.posthog.com" }, ["POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID"]],
    [{ POSTHOG_PERSONAL_API_KEY: "phx_fake_not_secret", POSTHOG_PROJECT_ID: "123" }, ["POSTHOG_HOST"]],
  ]) {
    clear()
    Object.assign(process.env, set)
    const eraser = analyticsEraser() // 만드는 것은 던지지 않는다
    await assert.rejects(
      () => eraser.erase(["user_1"]),
      (e) => e.code === "not_configured" && missing.every((n) => e.message.includes(n)) && !e.message.includes("phx_fake_not_secret"),
      JSON.stringify(Object.keys(set)),
    )
  }
})

test("탈퇴 파기 Cron 의 PostHog 지움(대조군): 호스트·키·프로젝트 id 가 모두 있으면 PostHog 로 지운다", async () => {
  clear()
  mode = "live"
  Object.assign(process.env, { POSTHOG_HOST: "https://eu.i.posthog.com", POSTHOG_PERSONAL_API_KEY: "phx_fake_not_secret", POSTHOG_PROJECT_ID: "123" })
  const { analyticsEraser } = await importRegistryFile("feature-account-lifecycle/files/lib/launch/account.ts")
  const eraser = analyticsEraser()
  assert.equal(eraser.url, "https://eu.posthog.com/api/projects/123/persons/bulk_delete/", "앱 호스트(EU)로 부른다")
})

test("탈퇴 파기 Cron 의 PostHog 지움: mock 은 지우지 않는다(공급자가 없다)", async () => {
  clear()
  mode = "mock"
  Object.assign(process.env, { POSTHOG_HOST: "https://eu.i.posthog.com" })
  const { analyticsEraser } = await importRegistryFile("feature-account-lifecycle/files/lib/launch/account.ts")
  await assert.doesNotReject(() => analyticsEraser().erase(["user_1"]))
})

test("LFOBS2 서버 계측: live 인데 POSTHOG_PROJECT_KEY 가 없으면(호스트는 있음) 던지지 않고 꺼진 계측 — 예전엔 required(POSTHOG_PROJECT_KEY)가 던졌다", async () => {
  clear()
  mode = "live"
  process.env.POSTHOG_HOST = "https://us.i.posthog.com"
  const lib = await fresh("feature-analytics-posthog/files/lib/launch/analytics.ts", "no-key")
  const a = lib.analytics()
  assert.equal(a.enabled, false)
  const port = a.forRequest({ distinctId: "user_1", consent: { analytics: true, marketing: true, decidedAt: "2026-10-05T00:00:00Z" } })
  assert.doesNotThrow(() => port.track("page_view", { path: "/" }))
  await a.flush()
})

test("LFOBS2 서버 계측: 둘 다 없어도, 키가 공백뿐이어도 꺼진 계측(던지지 않음)", async () => {
  clear()
  mode = "live"
  const none = await fresh("feature-analytics-posthog/files/lib/launch/analytics.ts", "none")
  assert.equal(none.analytics().enabled, false)
})
