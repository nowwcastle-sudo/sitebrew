// LFAX M03: 사람 승인 행동의 서버 액션은 확인 입력(confirmed: true) 없이는 실행하지 않는다 — 부수 효과(DB·결제 공급자·계정 포트) 0 으로 거절된다.
// 레지스트리가 싣는 진짜 서버 액션 파일(결제 Paddle·동의·탈퇴)을 그대로 불러, 세션·결제 포트·계정 포트만 대역으로 바꿔 부른다. 동의 저장은 진짜 DB(PGlite)다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { db, readMarketingConsents, user as userTable } from "@launch-factory/db"
import { notifyAdapter } from "@launch-factory/consent"
import { MESSAGES } from "@launch-factory/i18n"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort"],
  billing: ["billing"],
  config: ["DEFAULT_LOCALE"],
  db: ["database"],
  account: ["accountPort"],
  consents: ["notifyPort", "myConsentHistory"],
  security: ["guardAction"],
})

const at = new Date("2026-09-30T00:00:00.000Z")
const EMAIL = "me@example.com"
let d
let billingCalls = []
let accountCalls = []
let session = null
/** 결제 포트 대역: 부른 메서드를 적는다. 어떤 메서드도 성공을 돌려준다 */
const fakeBilling = () => new Proxy({}, { get: (_t, m) => (m === "then" ? undefined : async (arg) => (billingCalls.push([String(m), arg]), { ok: true, data: { planId: "pro", status: "active" } })) })

before(async () => {
  d = await db.local()
  await d.insert(userTable).values({ id: "me", name: "x", email: EMAIL, emailVerified: true, createdAt: at, updatedAt: at })
  stubs.config = { DEFAULT_LOCALE: "en" }
  stubs.db = { database: async () => d }
  stubs.security = { guardAction: async () => null } // 요청 제한은 checkout-guard-glue.test.mjs 가 진짜로 본다 — 여기서는 통과
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs.billing = { billing: async () => ({ port: () => fakeBilling() }) }
  stubs.account = {
    accountPort: async () => ({
      session: async () => ({ ok: true, data: session ? { ...session, twoFactor: false } : null }),
      deleteAccount: async () => (accountCalls.push("deleteAccount"), { ok: true, data: { graceUntil: "2026-10-11T00:00:00.000Z" } }),
      exportMyData: async () => (accountCalls.push("exportMyData"), { ok: true, data: { profile: {} } }),
    }),
  }
  stubs.consents = {
    notifyPort: async () => notifyAdapter({ db: d, userId: () => session?.userId ?? null, locale: "en" }),
    myConsentHistory: async () => [],
  }
})
after(async () => {
  await d?.$client.close()
})

const REFUSED = (r, label) => {
  assert.equal(r.ok, false, label)
  assert.equal(r.code, "confirmation_required", label)
  assert.equal(r.retryable, false, label)
  assert.deepEqual(r.fieldErrors, { confirmed: [MESSAGES.en.protect.confirmationRequired] }, label)
}

test("가격 변경 동의·해지: 확인 입력이 없으면 결제 포트를 부르지 않는다 — 있으면 실행한다(다른 칸은 그대로)", async () => {
  const a = await importRegistryFile("feature-billing-paddle/files/app/actions/billing.ts")
  session = { userId: "me", email: EMAIL }
  billingCalls = []
  for (const bad of [undefined, {}, { confirmed: false }, { confirmed: "no" }, { when: "now" }]) {
    REFUSED(await a.acceptPriceChange(bad), `acceptPriceChange ${JSON.stringify(bad)}`)
    REFUSED(await a.cancelAtPeriodEnd(bad), `cancelAtPeriodEnd ${JSON.stringify(bad)}`)
  }
  assert.deepEqual(billingCalls, [], "거절된 요청은 결제 포트에 닿지 않는다")
  assert.equal((await a.acceptPriceChange({ confirmed: true })).ok, true)
  assert.equal((await a.cancelAtPeriodEnd({ confirmed: true })).ok, true)
  assert.deepEqual(billingCalls, [["acceptPriceChange", undefined], ["cancel", { when: "period_end" }]], "confirmed 는 공급자 쪽으로 새지 않고, 해지는 항상 기간 끝이다")
})

test("결제 서버 액션 결과는 모든 실패에 code·retryable 을 갖는다(로그아웃 = sign_in_required)", async () => {
  const a = await importRegistryFile("feature-billing-paddle/files/app/actions/billing.ts")
  session = null
  for (const [name, args] of [["getSubscription", []], ["openPortal", []], ["acceptPriceChange", [{ confirmed: true }]], ["cancelAtPeriodEnd", [{ confirmed: true }]], ["resumeSubscription", []]]) {
    const r = await a[name](...args)
    assert.deepEqual([r.ok, r.code, r.retryable], [false, "sign_in_required", false], name)
  }
  const r = await a.startCheckout({ planId: "pro", withdrawalConsent: true })
  assert.deepEqual([r.ok, r.code, r.retryable], [false, "sign_in_required", false], "startCheckout")
})

test("마케팅 수신 동의 변경: 확인 입력이 없으면 DB 를 바꾸지 않는다 — 있으면 저장하고 이력을 남긴다", async () => {
  const a = await importRegistryFile("feature-consents/files/app/actions/consents.ts")
  session = { userId: "me", email: EMAIL }
  const before = await readMarketingConsents(d, "me")
  for (const bad of [{ email: true }, { email: true, confirmed: false }, undefined]) REFUSED(await a.setMarketingConsents(bad), JSON.stringify(bad))
  assert.deepEqual(await readMarketingConsents(d, "me"), before, "거절된 변경은 DB 에 닿지 않는다")
  const ok = await a.setMarketingConsents({ email: true, confirmed: true })
  assert.equal(ok.ok, true)
  assert.equal((await readMarketingConsents(d, "me")).email, true)
  // 확인이 있어도 채널 모양은 포트가 검사한다 — 모르는 칸은 invalid_input
  const bad = await a.setMarketingConsents({ fax: true, confirmed: true })
  assert.deepEqual([bad.ok, bad.code, bad.retryable], [false, "invalid_input", false])
  // 철회도 같은 입구라 확인이 필요하다(양방향)
  REFUSED(await a.setMarketingConsents({ email: false }), "withdraw")
  assert.equal((await readMarketingConsents(d, "me")).email, true)
})

test("탈퇴·내려받기: 확인 입력(과 입력한 이메일 주소) 없이는 계정 포트를 부르지 않는다", async () => {
  const a = await importRegistryFile("feature-account-lifecycle/files/app/actions/account.ts")
  session = { userId: "me", email: EMAIL }
  accountCalls = []
  REFUSED(await a.deleteAccount(undefined), "deleteAccount()")
  REFUSED(await a.deleteAccount({ confirmEmail: EMAIL }), "deleteAccount without confirmed")
  REFUSED(await a.exportMyData(undefined), "exportMyData()")
  REFUSED(await a.exportMyData({ confirmed: false }), "exportMyData false")
  const wrong = await a.deleteAccount({ confirmed: true, confirmEmail: "other@example.com" })
  assert.deepEqual([wrong.ok, wrong.code, wrong.retryable], [false, "confirmation_required", false])
  assert.deepEqual(wrong.fieldErrors, { confirmEmail: [MESSAGES.en.protect.confirmEmailMismatch] })
  assert.deepEqual(accountCalls, [], "거절된 탈퇴·내려받기는 계정 포트에 닿지 않는다")
  assert.equal((await a.deleteAccount({ confirmed: true, confirmEmail: EMAIL })).ok, true)
  assert.equal((await a.exportMyData({ confirmed: true })).ok, true)
  assert.deepEqual(accountCalls, ["deleteAccount", "exportMyData"])
})
