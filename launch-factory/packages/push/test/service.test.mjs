// 푸시 서비스: 구독 저장·소유자 이전·정리 정책(404/410 · 연속 실패 5회 초과 · 만료)·가짜 모드·설정 없는 live. PGlite 메모리 DB 하나를 파일 전체가 같이 쓴다.
import { test, before, after, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import { db, listPushSubscriptions, pushSubscriptions } from "@launch-factory/db"
import { MAX_CONSECUTIVE_FAILURES, MOCK_VAPID_PUBLIC_KEY, createPushService } from "../src/index.ts"
import { U1, U2, fakeTransport, insertUsers, makeSub, makeVapid } from "./fixtures.mjs"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
  await insertUsers(d, sql)
})
after(async () => {
  await d?.$client.close()
})
beforeEach(async () => {
  await d.delete(pushSubscriptions)
})

const T0 = new Date("2026-11-02T01:00:00Z")
const live = (extra = {}) => {
  const vapid = makeVapid()
  const transport = extra.transport ?? fakeTransport()
  const errors = []
  const service = createPushService({ db: d, mode: "live", vapid, transport, now: () => T0, onError: (e) => errors.push(e), ...extra })
  return { service, vapid, transport, errors }
}
const rows = (userId) => listPushSubscriptions(d, userId)
const GOOD = { title: "예약이 확정됐어요", body: "내일 10:00", url: "/book/B-1" }

test("subscribe: 검사를 통과하면 저장하고 subscribedAt 을 돌려준다", async () => {
  const { service } = live()
  const sub = makeSub({ expirationTime: 1_900_000_000_000 })
  const r = await service.subscribe(U1, sub)
  assert.deepEqual(r, { ok: true, data: { subscribedAt: T0.toISOString() } })
  const [row] = await rows(U1)
  assert.equal(row.endpoint, sub.endpoint)
  assert.equal(row.p256dh, sub.keys.p256dh)
  assert.equal(row.auth, sub.keys.auth)
  assert.equal(row.expirationTime, 1_900_000_000_000)
  assert.equal(row.failureCount, 0)
})

test("subscribe: 잘못된 입력은 칸 오류(invalid_input)이고 아무것도 저장하지 않는다", async () => {
  const { service } = live()
  const r = await service.subscribe(U1, makeSub({ endpoint: "http://fcm.googleapis.com/x" }))
  assert.equal(r.ok, false)
  assert.equal(r.code, "invalid_input")
  assert.equal(r.retryable, false)
  assert.ok(r.fieldErrors.endpoint.length)
  const r2 = await service.subscribe(U1, { endpoint: makeSub().endpoint, keys: { p256dh: "x", auth: "y" } })
  assert.ok(r2.fieldErrors.p256dh && r2.fieldErrors.auth)
  assert.equal((await rows(U1)).length, 0)
  assert.equal((await service.subscribe("", makeSub())).ok, false)
})

test("subscribe: 같은 endpoint 를 다른 사용자가 등록하면 소유자가 옮겨지고 실패 횟수는 0이 된다", async () => {
  const { service } = live()
  const sub = makeSub()
  await service.subscribe(U1, sub)
  await d.update(pushSubscriptions).set({ failureCount: 3 })
  const fresh = makeSub().keys
  const r = await service.subscribe(U2, { ...sub, keys: fresh })
  assert.equal(r.ok, true)
  assert.equal((await rows(U1)).length, 0)
  const [row] = await rows(U2)
  assert.equal(row.endpoint, sub.endpoint)
  assert.equal(row.p256dh, fresh.p256dh)
  assert.equal(row.failureCount, 0)
  assert.equal((await d.select().from(pushSubscriptions)).length, 1)
})

test("subscribe: 없는 사용자(외래키 위반)는 던지지 않고 retryable 값 + onError, 메시지에 내부 오류가 없다", async () => {
  const { service, errors } = live()
  const r = await service.subscribe("no-such-user", makeSub())
  assert.equal(r.ok, false)
  assert.equal(r.code, "provider_unavailable")
  assert.equal(r.retryable, true)
  assert.equal(errors.length, 1)
  assert.ok(!JSON.stringify(r).includes("constraint"))
})

test("unsubscribe: 내 기기만 지운다 · 남의 것·없는 것은 같은 성공(존재 노출 금지)", async () => {
  const { service } = live()
  const mine = makeSub()
  const theirs = makeSub()
  await service.subscribe(U1, mine)
  await service.subscribe(U2, theirs)
  assert.deepEqual(await service.unsubscribe(U1, theirs.endpoint), { ok: true, data: { removed: false } })
  assert.equal((await rows(U2)).length, 1, "남의 기기는 그대로")
  assert.deepEqual(await service.unsubscribe(U1, "https://nope.example.com/x"), { ok: true, data: { removed: false } })
  assert.deepEqual(await service.unsubscribe(U1, mine.endpoint), { ok: true, data: { removed: true } })
  assert.equal((await rows(U1)).length, 0)
  assert.equal((await service.unsubscribe(U1, undefined)).code, "invalid_input")
  assert.equal((await service.unsubscribe(U1, 42)).ok, false)
})

test("sendToUser: 성공은 sent, lastSuccessAt 을 적고 이전 실패 횟수를 0으로 돌린다 · 알림은 전송기에 JSON 으로 간다", async () => {
  const { service, transport } = live()
  const sub = makeSub()
  await service.subscribe(U1, sub)
  await d.update(pushSubscriptions).set({ failureCount: 2 })
  const r = await service.sendToUser(U1, GOOD, { urgency: "high", ttlSeconds: 120 })
  assert.deepEqual(r, { ok: true, sent: 1, pruned: 0, failed: 0 })
  assert.equal(transport.calls.length, 1)
  assert.deepEqual(transport.calls[0].sub, { endpoint: sub.endpoint, keys: sub.keys })
  assert.deepEqual(JSON.parse(transport.calls[0].payload), GOOD)
  assert.deepEqual(transport.calls[0].opts, { urgency: "high", ttlSeconds: 120 })
  const [row] = await rows(U1)
  assert.equal(row.failureCount, 0)
  assert.equal(row.lastSuccessAt.toISOString(), T0.toISOString())
})

test("sendToUser: 404·410 이면 구독을 바로 지운다(pruned)", async () => {
  const gone404 = makeSub()
  const gone410 = makeSub()
  const ok = makeSub()
  const transport = fakeTransport({ [gone404.endpoint]: { ok: false, statusCode: 404, message: "x" }, [gone410.endpoint]: { ok: false, statusCode: 410, message: "x" } })
  const { service } = live({ transport })
  for (const s of [gone404, gone410, ok]) await service.subscribe(U1, s)
  assert.deepEqual(await service.sendToUser(U1, GOOD), { ok: true, sent: 1, pruned: 2, failed: 0 })
  assert.deepEqual((await rows(U1)).map((r) => r.endpoint), [ok.endpoint])
})

test("sendToUser: 그 밖의 실패는 횟수만 올리고, 5회까지 남고 6번째에 지운다 · 상태 코드 없는 실패(네트워크)도 같다", async () => {
  assert.equal(MAX_CONSECUTIVE_FAILURES, 5)
  const sub = makeSub()
  const codes = [500, 429, 502, undefined, 413]
  let n = 0
  const transport = fakeTransport(() => {
    const statusCode = codes[n++ % codes.length]
    return { ok: false, ...(statusCode && { statusCode }), message: "boom" }
  })
  const { service } = live({ transport })
  await service.subscribe(U1, sub)
  for (let i = 1; i <= 5; i++) {
    assert.deepEqual(await service.sendToUser(U1, GOOD), { ok: true, sent: 0, pruned: 0, failed: 1 }, `${i}번째`)
    assert.equal((await rows(U1))[0].failureCount, i)
  }
  assert.deepEqual(await service.sendToUser(U1, GOOD), { ok: true, sent: 0, pruned: 1, failed: 0 }, "6번째는 지운다")
  assert.equal((await rows(U1)).length, 0)
})

test("sendToUser: 401·403 은 우리 VAPID 설정 문제라 구독을 세지도 지우지도 않고 onError 로 알린다", async () => {
  const sub = makeSub()
  const errors = []
  const { service } = live({ transport: fakeTransport(() => ({ ok: false, statusCode: 403, message: "x" })), onError: (e) => errors.push(e) })
  await service.subscribe(U1, sub)
  for (let i = 0; i < 8; i++) assert.deepEqual(await service.sendToUser(U1, GOOD), { ok: true, sent: 0, pruned: 0, failed: 1 })
  const [row] = await rows(U1)
  assert.equal(row.failureCount, 0)
  assert.equal(errors.length, 8)
})

test("sendToUser: 실패 사이에 한 번 성공하면 횟수가 0부터 다시 센다", async () => {
  const sub = makeSub()
  const plan = [false, false, false, true, false, false, false, false, false]
  let i = 0
  const { service } = live({ transport: fakeTransport(() => (plan[i++] ? { ok: true } : { ok: false, statusCode: 500, message: "x" })) })
  await service.subscribe(U1, sub)
  const outcomes = []
  for (let k = 0; k < plan.length; k++) outcomes.push((await service.sendToUser(U1, GOOD)).failed)
  assert.deepEqual(outcomes, [1, 1, 1, 0, 1, 1, 1, 1, 1])
  assert.equal((await rows(U1)).length, 1, "연속 5번이라 아직 남아 있다")
})

test("sendToUser: 만료 시각이 지난 구독은 보내지 않고 지운다", async () => {
  const expired = makeSub({ expirationTime: T0.getTime() - 1 })
  const alive = makeSub({ expirationTime: T0.getTime() + 60_000 })
  const { service, transport } = live()
  await service.subscribe(U1, expired)
  await service.subscribe(U1, alive)
  assert.deepEqual(await service.sendToUser(U1, GOOD), { ok: true, sent: 1, pruned: 1, failed: 0 })
  assert.deepEqual(transport.calls.map((c) => c.sub.endpoint), [alive.endpoint])
})

test("sendToUser: 그 사용자의 기기에만 보내고, 기기가 5대를 넘어도 모두 처리한다", async () => {
  const { service, transport } = live()
  const mine = Array.from({ length: 7 }, () => makeSub())
  for (const s of mine) await service.subscribe(U1, s)
  await service.subscribe(U2, makeSub())
  assert.deepEqual(await service.sendToUser(U1, GOOD), { ok: true, sent: 7, pruned: 0, failed: 0 })
  assert.equal(transport.calls.length, 7)
  assert.deepEqual(new Set(transport.calls.map((c) => c.sub.endpoint)), new Set(mine.map((s) => s.endpoint)))
  assert.deepEqual(await service.sendToUser("nobody", GOOD), { ok: true, sent: 0, pruned: 0, failed: 0 })
})

test("sendToUser: 잘못된 페이로드는 invalid_input 이고 전송기를 부르지 않는다(크기 초과 포함)", async () => {
  const { service, transport } = live()
  await service.subscribe(U1, makeSub())
  const bad = await service.sendToUser(U1, { title: "t", url: "https://evil.example.com" })
  assert.equal(bad.code, "invalid_input")
  assert.ok(bad.fieldErrors.url)
  const big = await service.sendToUser(U1, { title: "가".repeat(120), body: "가".repeat(1000), url: `/${"가".repeat(300)}` })
  assert.equal(big.code, "invalid_input")
  assert.ok(big.fieldErrors.payload)
  assert.equal(transport.calls.length, 0)
  assert.match((await service.sendToUser(U1, {}, { locale: "en" })).fieldErrors.title[0], /title/i)
})

test("sendToUser: 주입한 전송기가 던져도 그 기기만 failed 로 세고 나머지는 계속 보낸다", async () => {
  const bad = makeSub()
  const good = makeSub()
  const errors = []
  const transport = async (sub) => {
    if (sub.endpoint === bad.endpoint) throw new Error("전송기 버그")
    return { ok: true }
  }
  const { service } = live({ transport, onError: (e) => errors.push(e) })
  await service.subscribe(U1, bad)
  await service.subscribe(U1, good)
  assert.deepEqual(await service.sendToUser(U1, GOOD), { ok: true, sent: 1, pruned: 0, failed: 1 })
  assert.equal(errors.length, 1)
})

test("mock 모드: 전송기를 주지 않으면 기록만 하고 fetch·web-push 호출은 0 — 성공 처리(markPushSuccess)는 한다", async () => {
  const realFetch = globalThis.fetch
  let fetched = 0
  globalThis.fetch = (...a) => (fetched++, realFetch(...a))
  try {
    const service = createPushService({ db: d, mode: "mock", now: () => T0 })
    const sub = makeSub()
    assert.equal((await service.subscribe(U1, sub)).ok, true)
    assert.deepEqual(await service.sendToUser(U1, GOOD), { ok: true, sent: 1, pruned: 0, failed: 0 })
    assert.equal(fetched, 0)
    assert.equal(service.recorded.length, 1)
    assert.equal(service.recorded[0].endpoint, sub.endpoint)
    assert.deepEqual(JSON.parse(service.recorded[0].payload), GOOD)
    assert.equal((await rows(U1))[0].lastSuccessAt.toISOString(), T0.toISOString())
    assert.ok(!JSON.stringify(service.recorded).includes(sub.keys.auth), "기록에 키 없음")
  } finally {
    globalThis.fetch = realFetch
  }
})

test("mock 모드: vapid 없이도 켜져 있고, 전송기를 주입하면 그것을 쓴다", async () => {
  const transport = fakeTransport()
  const service = createPushService({ db: d, mode: "mock", transport, now: () => T0 })
  assert.equal(service.enabled, true)
  await service.subscribe(U1, makeSub())
  await service.sendToUser(U1, GOOD)
  assert.equal(transport.calls.length, 1)
  assert.equal(service.recorded.length, 0)
})

test("publicKey 규칙: live=설정한 키(없거나 틀리면 null) · mock=설정한 키 또는 가짜 키", () => {
  const vapid = makeVapid()
  assert.equal(createPushService({ db: d, mode: "live", vapid }).publicKey(), vapid.publicKey)
  assert.equal(createPushService({ db: d, mode: "live" }).publicKey(), null)
  assert.equal(createPushService({ db: d, mode: "live", vapid: { ...vapid, privateKey: "short" } }).publicKey(), null)
  assert.equal(createPushService({ db: d, mode: "mock" }).publicKey(), MOCK_VAPID_PUBLIC_KEY)
  assert.equal(createPushService({ db: d, mode: "mock", vapid }).publicKey(), vapid.publicKey)
  assert.equal(Buffer.from(MOCK_VAPID_PUBLIC_KEY, "base64url").length, 65)
})

test("live 인데 vapid 가 없거나 틀리면 provider_unavailable 값 — subscribe·sendToUser 모두, 전송기는 부르지 않는다", async () => {
  const good = makeVapid()
  const variants = [undefined, { ...good, subject: "ops@example.com" }, { ...good, publicKey: "AAAA" }, { ...good, privateKey: "" }]
  for (const vapid of variants) {
    const transport = fakeTransport()
    const service = createPushService({ db: d, mode: "live", vapid, transport })
    assert.equal(service.enabled, false)
    for (const r of [await service.subscribe(U1, makeSub()), await service.sendToUser(U1, GOOD)]) {
      assert.equal(r.ok, false)
      assert.equal(r.code, "provider_unavailable")
      assert.ok(r.formError)
      assert.ok(!JSON.stringify(r).includes(good.privateKey))
    }
    assert.equal(transport.calls.length, 0)
    assert.equal((await rows(U1)).length, 0)
    assert.equal((await service.unsubscribe(U1, "https://push.example.com/x")).ok, true, "정리는 설정과 무관하게 된다")
  }
})

test("비밀: 결과·오류 콜백·기록 어디에도 VAPID 개인키가 없다(전송기가 키를 오류에 실어도)", async () => {
  const vapid = makeVapid()
  const seen = []
  const leakyTransport = async () => ({ ok: false, statusCode: 500, message: "failed" })
  const service = createPushService({ db: d, mode: "live", vapid, transport: leakyTransport, onError: (e) => seen.push(String(e?.message ?? e)) })
  await service.subscribe(U1, makeSub())
  const results = [await service.sendToUser(U1, GOOD), await service.sendToUser(U1, {}), await service.subscribe(U1, {})]
  const dump = JSON.stringify([results, seen, service.recorded, await rows(U1)])
  assert.ok(!dump.includes(vapid.privateKey))
  assert.ok(!JSON.stringify(service).includes(vapid.privateKey))
})

test("만들 때 mode 가 틀리면 던진다", () => {
  assert.throws(() => createPushService({ db: d, mode: "prod" }), /mode/)
})

test("영어 로캘: 오류 문구가 영어로 나온다", async () => {
  const { service } = live({ locale: "en" })
  const r = await service.subscribe(U1, makeSub({ endpoint: "http://fcm.googleapis.com/x" }))
  assert.match(r.formError, /check/i)
  assert.match(r.fieldErrors.endpoint[0], /https/)
})
