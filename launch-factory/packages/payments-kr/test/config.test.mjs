// resolvePayments — 환경에서 게이트웨이를 고른다. mock 이면 mock, live 이면 PortOne 값이 다 있어야 켜고 아니면 상점만 끈다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { resolvePayments, PaymentsConfigError, PORTONE_ENV } from "../src/index.ts"
import { fakePortOne } from "./fake-portone.mjs"

// 시험용 가짜 값(실제 키 아님)
const FAKE = { NEXT_PUBLIC_PORTONE_STORE_ID: "store-fake", NEXT_PUBLIC_PORTONE_CHANNEL_KEY: "channel-fake", PORTONE_API_SECRET: "secret-fake-not-real", PORTONE_WEBHOOK_SECRET: "whsec_ZmFrZQ==" }

test("mock 모드: 키가 없어도 켜지고 mock 게이트웨이(markPaid 가 있다)", async () => {
  const r = resolvePayments({ LF_MODE: "mock" })
  assert.deepEqual([r.enabled, r.mode], [true, "mock"])
  assert.equal(typeof r.gateway.markPaid, "function")
  const s = await r.gateway.prepare({ orderId: "o", orderName: "x", total: { amount: 1000, currency: "KRW", vatIncluded: true } })
  assert.equal(s.provider, "mock")
})

test("mock 모드: PortOne 값이 들어 있어도 mock 을 쓴다(미리보기가 실결제로 새지 않는다)", () => {
  const r = resolvePayments({ LF_MODE: "mock", ...FAKE })
  assert.equal(r.mode, "mock")
})

test("live 모드: 네 값이 다 있으면 PortOne 게이트웨이 + 웹훅 비밀", async () => {
  const seen = []
  const f = fakePortOne()
  const r = resolvePayments({ LF_MODE: "live", ...FAKE }, { createClient: (secret) => (seen.push(secret), f.client) })
  assert.deepEqual([r.enabled, r.mode], [true, "live"])
  assert.equal(r.webhookSecret, FAKE.PORTONE_WEBHOOK_SECRET)
  assert.deepEqual(seen, [FAKE.PORTONE_API_SECRET])
  const s = await r.gateway.prepare({ orderId: "o", orderName: "x", total: { amount: 1000, currency: "KRW", vatIncluded: true } })
  assert.deepEqual(s.client, { storeId: "store-fake", channelKey: "channel-fake", orderId: "o" })
})

test("live 모드: 하나라도 없으면 상점만 꺼진다 — 빠진 이름을 모두 알리고 값은 싣지 않는다", () => {
  const partial = { ...FAKE }
  delete partial.PORTONE_API_SECRET
  delete partial.PORTONE_WEBHOOK_SECRET
  let created = false
  const r = resolvePayments({ LF_MODE: "live", ...partial }, { createClient: () => ((created = true), {}) })
  assert.equal(r.enabled, false)
  assert.deepEqual(r.missing, ["PORTONE_API_SECRET", "PORTONE_WEBHOOK_SECRET"])
  assert.match(r.reason, /PORTONE_API_SECRET/)
  assert.match(r.reason, /PORTONE_WEBHOOK_SECRET/)
  assert.ok(!r.reason.includes("store-fake"), "값이 사유에 섞이면 안 된다")
  assert.equal(created, false, "빠진 채로는 클라이언트를 만들지 않는다")
})

test("live 모드: 빈 문자열·공백만은 없는 것으로 본다", () => {
  const r = resolvePayments({ LF_MODE: "live", ...FAKE, PORTONE_API_SECRET: "", NEXT_PUBLIC_PORTONE_STORE_ID: "   " })
  assert.equal(r.enabled, false)
  assert.deepEqual(r.missing.sort(), ["NEXT_PUBLIC_PORTONE_STORE_ID", "PORTONE_API_SECRET"])
})

test("live 모드에 값이 하나도 없어도 던지지 않는다(사이트는 켜지고 상점만 꺼진다)", () => {
  const r = resolvePayments({ LF_MODE: "live" })
  assert.equal(r.enabled, false)
  assert.deepEqual(r.missing, [...PORTONE_ENV])
})

test("LF_MODE 가 없거나 mock·live 가 아니면 설정 오류(조용히 mock 으로 켜지 않는다)", () => {
  assert.throws(() => resolvePayments({}), PaymentsConfigError)
  assert.throws(() => resolvePayments({ LF_MODE: "staging" }), PaymentsConfigError)
})
