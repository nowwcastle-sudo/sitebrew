// D130(⑥): 결제 시작 서버 액션 앞에 요청 제한(checkoutStart)이 걸려 있다 — 막히면 결제 포트(= Paddle 거래 만들기)도 청약철회 동의 기록도 만들지 않는다.
// 레지스트리가 싣는 진짜 서버 액션(결제 Paddle·Gumroad)과 진짜 보안 조립(feature-security 의 guardAction → 진짜 제한기 + PGlite 저장소)을 그대로 불러 쓴다.
// 세션·결제 포트·설정만 대역이다. 제한 규칙은 패키지 기본값 checkoutStart = 60초에 10번(RATE_LIMIT_DEFAULTS).
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { eq } from "drizzle-orm"
import { consentRecords, db, user as userTable } from "@launch-factory/db"
import { RATE_LIMIT_DEFAULTS } from "@launch-factory/security/rate-limit"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))

installGlueStubs({
  auth: ["authPort"],
  billing: ["billing"],
  gumroad: ["gumroad"],
  config: ["DEFAULT_LOCALE"],
  db: ["database"],
  env: ["env", "required"],
  "paddle-plans": ["PLANS"],
  security: ["guardAction"],
})

const at = new Date("2026-09-30T00:00:00.000Z")
const MAX = RATE_LIMIT_DEFAULTS.checkoutStart.max
let d
let calls = []
let session = null
let ip = "203.0.113.9"
/** 결제 포트 대역: 부른 메서드를 적는다(= Paddle·Gumroad 거래를 만들려는 시도). 어떤 메서드도 성공을 돌려준다 */
const fakePort = () => new Proxy({}, { get: (_t, m) => (m === "then" ? undefined : async (arg) => (calls.push(String(m)), { ok: true, data: { redirectUrl: `https://pay.example/${String(m)}` }, arg })) })
const consentRows = async (userId) => (await d.select().from(consentRecords).where(eq(consentRecords.userId, userId))).length

before(async () => {
  process.env.LF_CLIENT_IP_HEADER = "x-test-ip" // 믿을 IP 머리(ipAddressFromEnv) — 시험 요청이 머리로 IP 를 알린다
  d = await db.local()
  for (const id of ["u1", "u2"]) await d.insert(userTable).values({ id, name: "x", email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
  stubs.config = { DEFAULT_LOCALE: "ko" }
  stubs["paddle-plans"] = { PLANS: [] }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "mock" }), required: (n) => `x-${n}` }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }), methods: async () => ({ ok: true, data: [] }) }) }
  stubs.billing = { billing: async () => ({ port: () => fakePort() }) }
  stubs.gumroad = { gumroad: async () => ({ port: () => fakePort() }) }
  stubs["next/headers"] = { headers: async () => new Headers({ "x-test-ip": ip }) }
  // 진짜 보안 조립. 앱의 `@/lib/launch/security` 자리를 이 파일이 채운다(대역 모듈이 진짜 파일로 위임)
  const security = await importRegistryFile("feature-security/files/lib/launch/security.ts")
  stubs.security = { guardAction: (...a) => security.guardAction(...a) }
})
after(async () => {
  await d?.$client.close()
})

const GO = { planId: "pro", withdrawalConsent: true }

test("D130 Paddle: 한도(60초 10번)를 넘긴 결제 시작은 rate_limited(기계 값·retryAfter)로 막히고 결제 포트도 동의 기록도 만들지 않는다", async () => {
  const a = await importRegistryFile("feature-billing-paddle/files/app/actions/billing.ts")
  session = { userId: "u1", email: "u1@example.com" }
  calls = []
  const rowsBefore = await consentRows("u1")
  for (let i = 0; i < MAX; i++) assert.equal((await a.startCheckout(GO)).ok, true, `${i + 1}번째는 통과`)
  assert.equal(calls.length, MAX)
  const refused = await a.startCheckout(GO)
  assert.equal(refused.ok, false)
  assert.equal(refused.code, "rate_limited")
  assert.equal(refused.retryable, true)
  assert.ok(Number.isInteger(refused.retryAfter) && refused.retryAfter >= 1 && refused.retryAfter <= 60, `retryAfter=${refused.retryAfter}`)
  assert.ok(refused.formError, "사람이 읽는 문구도 있다")
  assert.equal(calls.length, MAX, "막힌 요청은 결제 포트(거래 만들기)를 부르지 않는다")
  assert.equal(await consentRows("u1"), rowsBefore + MAX, "막힌 요청에 청약철회 동의 기록이 남지 않는다")
})

test("D130 Paddle: 한도는 사용자·IP 별이다 — 다른 사용자는 영향이 없고(양성 대조), 로그아웃이면 제한기에 닿기 전에 로그인 요구", async () => {
  const a = await importRegistryFile("feature-billing-paddle/files/app/actions/billing.ts")
  calls = []
  session = { userId: "u2", email: "u2@example.com" }
  assert.deepEqual(await a.startCheckout(GO), { ok: true, data: { redirectUrl: "https://pay.example/checkout" } }, "u1 이 막혀도 u2 는 그대로 결제된다")
  assert.deepEqual(calls, ["checkout"])
  session = null
  const out = await a.startCheckout(GO)
  assert.equal(out.ok, false)
  assert.equal(out.code, "sign_in_required")
})

test("D130 Gumroad: 같은 한도가 걸려 있다 — 한도 밖은 막히고 결제 포트·동의 기록이 없다", async () => {
  const a = await importRegistryFile("feature-billing-gumroad/files/app/actions/gumroad-billing.ts")
  ip = "198.51.100.20" // 다른 IP 라 위 시험의 통을 쓰지 않는다
  session = { userId: "u1", email: "u1@example.com" }
  calls = []
  const rowsBefore = await consentRows("u1")
  for (let i = 0; i < MAX; i++) assert.equal((await a.startGumroadCheckout(GO)).ok, true, `${i + 1}번째는 통과`)
  const refused = await a.startGumroadCheckout(GO)
  assert.equal(refused.ok, false)
  assert.equal(refused.code, "rate_limited")
  assert.equal(calls.length, MAX)
  assert.equal(await consentRows("u1"), rowsBefore + MAX)
})

test("F10 EU 관문(v0.1.1 리뷰 P1-2): 진짜 서버 액션 둘 다 — 접속 지역이 EU 면 고른 나라가 한국이어도 region_unavailable, 결제 포트·동의 기록 없음 / 한국 접속은 통과(양성 대조)", async () => {
  const paddle = await importRegistryFile("feature-billing-paddle/files/app/actions/billing.ts")
  const gum = await importRegistryFile("feature-billing-gumroad/files/app/actions/gumroad-billing.ts")
  const prevSales = process.env.LF_EU_SALES
  process.env.LF_EU_SALES = "off" // 닫은 상태의 관문을 본다(기본은 열림 — 운영자 결정 2026-10-08)
  const prevHeaders = stubs["next/headers"]
  let country = "DE"
  stubs["next/headers"] = { headers: async () => new Headers({ "x-test-ip": "192.0.2.77", "x-vercel-ip-country": country }) }
  try {
    session = { userId: "u2", email: "u2@example.com" }
    calls = []
    const rowsBefore = await consentRows("u2")
    for (const go of [() => paddle.startCheckout({ ...GO, billingCountry: "KR" }), () => gum.startGumroadCheckout({ ...GO, billingCountry: "KR" })]) {
      const out = await go()
      assert.equal(out.ok, false)
      assert.equal(out.code, "region_unavailable")
    }
    assert.deepEqual(calls, [], "막힌 요청은 결제 포트를 부르지 않는다")
    assert.equal(await consentRows("u2"), rowsBefore, "막힌 요청에 동의 기록이 남지 않는다")
    country = "KR"
    assert.equal((await paddle.startCheckout({ ...GO, billingCountry: "KR" })).ok, true)
    assert.equal((await gum.startGumroadCheckout(GO)).ok, true)
    assert.deepEqual(calls, ["checkout", "checkout"])
  } finally {
    stubs["next/headers"] = prevHeaders
    if (prevSales === undefined) delete process.env.LF_EU_SALES
    else process.env.LF_EU_SALES = prevSales
  }
})

test("D130 live 포트(UI 가 실제로 부르는 길 — product.ts → ports.live.ts): 같은 한도가 걸려 있고, 막힌 요청은 결제 포트·동의 기록이 없다", async () => {
  const { livePorts } = await import(pathToFileURL(join(ROOT, "template", "lib", "ports.live.ts")).href)
  const live = await livePorts()
  ip = "192.0.2.55" // 다른 IP — 앞 시험의 통을 쓰지 않는다
  session = { userId: "u1", email: "u1@example.com" }
  calls = []
  const rowsBefore = await consentRows("u1")
  for (let i = 0; i < MAX; i++) assert.equal((await live.billing.checkout(GO)).ok, true, `${i + 1}번째는 통과`)
  const refused = await live.billing.checkout(GO)
  assert.equal(refused.ok, false)
  assert.equal(refused.code, "rate_limited")
  assert.equal(refused.retryable, true)
  assert.equal(calls.length, MAX, "막힌 요청은 결제 포트(거래 만들기)를 부르지 않는다")
  assert.equal(await consentRows("u1"), rowsBefore + MAX)
  // 양성 대조: 다른 사용자는 같은 IP 에서도 그대로 결제된다(한도는 사용자·IP 별)
  session = { userId: "u2", email: "u2@example.com" }
  assert.equal((await live.billing.checkout(GO)).ok, true)
  // 로그아웃은 제한기에 닿기 전에 로그인 요구
  session = null
  assert.equal((await live.billing.checkout(GO)).code, "sign_in_required")
})
