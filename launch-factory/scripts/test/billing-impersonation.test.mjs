// D204: 대리 로그인(관리자가 사용자 대신 들어온 세션) 중에는 결제 서버 액션이 막힌다.
// 레지스트리가 싣는 진짜 서버 액션 파일(결제 Paddle·Gumroad)을 그대로 불러, 세션·결제 포트만 대역으로 바꿔 부른다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { eq } from "drizzle-orm"
import { consentRecords, db, user as userTable } from "@launch-factory/db"
import { MESSAGES } from "@launch-factory/i18n"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort"],
  billing: ["billing"],
  gumroad: ["gumroad"],
  config: ["DEFAULT_LOCALE"],
  db: ["database"],
  security: ["guardAction"],
})

const BLOCKED = { ok: false, status: 403, code: "impersonation_blocked", formError: MESSAGES.ko.auth.impersonationBlocked, retryable: false }
const at = new Date("2026-09-30T00:00:00.000Z")

let d
let calls = []
let session = null
/** 결제 포트 대역: 부른 메서드를 적는다. 어떤 메서드도 성공을 돌려준다 */
const fakePort = () =>
  new Proxy({}, { get: (_t, m) => m === "then" ? undefined : async (arg) => (calls.push(String(m)), { ok: true, data: { redirectUrl: `https://pay.example/${String(m)}` }, arg }) })

before(async () => {
  d = await db.local()
  await d.insert(userTable).values({ id: "victim", name: "x", email: "victim@example.com", emailVerified: true, createdAt: at, updatedAt: at })
  stubs.config = { DEFAULT_LOCALE: "ko" }
  stubs.db = { database: async () => d }
  stubs.security = { guardAction: async () => null } // 요청 제한은 checkout-guard-glue.test.mjs 가 진짜로 본다 — 여기서는 통과
  stubs.auth = { authPort: async () => ({ session: async () => (session ? { ok: true, data: session } : { ok: true, data: null }) }) }
  stubs.billing = { billing: async () => ({ port: () => fakePort() }) }
  stubs.gumroad = { gumroad: async () => ({ port: () => fakePort() }) }
})
after(async () => {
  await d?.$client.close()
})

const consentRows = async () => (await d.select().from(consentRecords).where(eq(consentRecords.userId, "victim"))).length
const own = { userId: "victim", email: "victim@example.com" }
const impersonated = { ...own, impersonatedBy: "admin-1" }

test("D204 Paddle: 대리 세션에서 읽기(getSubscription)만 통과하고 결제 서버 액션은 결제 포트를 부르지 않고 403 impersonation_blocked", async () => {
  const a = await importRegistryFile("feature-billing-paddle/files/app/actions/billing.ts")
  session = impersonated
  calls = []
  const before = await consentRows()
  assert.equal((await a.getSubscription()).ok, true)
  assert.deepEqual(calls, ["subscription"])
  calls = []
  for (const [name, args] of [
    ["startCheckout", [{ planId: "pro", withdrawalConsent: true }]],
    ["openPortal", []],
    ["acceptPriceChange", [{ confirmed: true }]],
    ["cancelAtPeriodEnd", [{ confirmed: true }]],
    ["resumeSubscription", []],
  ]) {
    assert.deepEqual(await a[name](...args), BLOCKED, name)
  }
  assert.deepEqual(calls, [], "결제 포트는 한 번도 불리지 않는다")
  assert.equal(await consentRows(), before, "막힌 결제에 청약철회 동의 기록이 남지 않는다")
})

test("D204 Paddle: 본인 세션이면 모두 통과하고 결제 시작은 동의 기록을 남긴다(양성 대조)", async () => {
  const a = await importRegistryFile("feature-billing-paddle/files/app/actions/billing.ts")
  session = own
  calls = []
  const before = await consentRows()
  assert.equal((await a.getSubscription()).ok, true)
  assert.deepEqual(await a.startCheckout({ planId: "pro", withdrawalConsent: true }), { ok: true, data: { redirectUrl: "https://pay.example/checkout" } })
  for (const [name, args] of [["openPortal", []], ["acceptPriceChange", [{ confirmed: true }]], ["cancelAtPeriodEnd", [{ confirmed: true }]], ["resumeSubscription", []]]) assert.equal((await a[name](...args)).ok, true, name)
  assert.deepEqual(calls, ["subscription", "checkout", "portal", "acceptPriceChange", "cancel", "resume"])
  assert.equal(await consentRows(), before + 1)
})

test("D204 Paddle: 로그아웃이면 로그인 요구(대리 차단과 다른 응답)", async () => {
  const a = await importRegistryFile("feature-billing-paddle/files/app/actions/billing.ts")
  session = null
  assert.deepEqual(await a.cancelAtPeriodEnd({ confirmed: true }), { ok: false, code: "sign_in_required", retryable: false, formError: MESSAGES.ko.auth.signInRequired })
})

test("D204 Gumroad: 대리 세션에서 결제 시작이 막히고 동의 기록도 남지 않는다 / 본인은 통과", async () => {
  const a = await importRegistryFile("feature-billing-gumroad/files/app/actions/gumroad-billing.ts")
  session = impersonated
  calls = []
  const before = await consentRows()
  assert.deepEqual(await a.startGumroadCheckout({ planId: "pro", withdrawalConsent: true }), BLOCKED)
  assert.deepEqual(calls, [])
  assert.equal(await consentRows(), before)
  assert.equal((await a.getGumroadSubscription()).ok, true, "읽기는 통과")
  session = own
  assert.equal((await a.startGumroadCheckout({ planId: "pro", withdrawalConsent: true })).ok, true)
  assert.equal(await consentRows(), before + 1)
})
