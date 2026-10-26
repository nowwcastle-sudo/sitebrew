// NotifyPort 에 얹는 두 메서드: 로그인 안 했으면 signInRequired, 했으면 서비스로. 서비스는 실제 PGlite 위에서.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import { db, listPushSubscriptions } from "@launch-factory/db"
import { createPushService, pushPortMethods } from "../src/index.ts"
import { U1, U2, insertUsers, makeSub } from "./fixtures.mjs"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
  await insertUsers(d, sql)
})
after(async () => {
  await d?.$client.close()
})
const service = () => createPushService({ db: d, mode: "mock", now: () => new Date("2026-11-02T01:00:00Z") })

test("로그인 안 함(null·undefined·빈 문자열·함수가 null): 두 메서드 모두 signInRequired — 저장하지 않는다", async () => {
  for (const who of [null, undefined, "", () => null, async () => undefined]) {
    const port = pushPortMethods(service(), who)
    for (const r of [await port.subscribePush(makeSub()), await port.unsubscribePush({ endpoint: makeSub().endpoint })]) {
      assert.deepEqual(Object.keys(r).sort(), ["code", "formError", "ok", "retryable"])
      assert.equal(r.ok, false)
      assert.equal(r.code, "signInRequired")
      assert.equal(r.retryable, false)
      assert.ok(r.formError)
    }
  }
  assert.equal((await listPushSubscriptions(d, U1)).length, 0)
})

test("로그인함: subscribePush 는 subscribedAt, unsubscribePush 는 빈 data — 사용자는 요청마다 읽는다", async () => {
  let current = U1
  const port = pushPortMethods(service(), async () => current)
  const sub = makeSub()
  assert.deepEqual(await port.subscribePush(sub), { ok: true, data: { subscribedAt: "2026-11-02T01:00:00.000Z" } })
  assert.equal((await listPushSubscriptions(d, U1)).length, 1)
  // 다른 사람이 같은 함수를 부르면 그 사람 몫이다: 남의 기기는 지워지지 않는다
  current = U2
  assert.deepEqual(await port.unsubscribePush({ endpoint: sub.endpoint }), { ok: true, data: {} })
  assert.equal((await listPushSubscriptions(d, U1)).length, 1)
  current = U1
  assert.deepEqual(await port.unsubscribePush({ endpoint: sub.endpoint }), { ok: true, data: {} })
  assert.equal((await listPushSubscriptions(d, U1)).length, 0)
})

test("입력 검사 실패는 서비스의 칸 오류 그대로, 입력이 이상해도 던지지 않는다", async () => {
  const port = pushPortMethods(service(), U1)
  const r = await port.subscribePush({ endpoint: "http://fcm.googleapis.com/x", keys: {} })
  assert.equal(r.ok, false)
  assert.equal(r.code, "invalid_input")
  assert.ok(r.fieldErrors.endpoint && r.fieldErrors.p256dh && r.fieldErrors.auth)
  for (const bad of [undefined, null, "x", {}, { endpoint: 1 }]) assert.equal((await port.unsubscribePush(bad)).ok, false)
  assert.equal((await port.subscribePush(undefined)).ok, false)
})

test("영어 로캘 옵션", async () => {
  const port = pushPortMethods(service(), null, { locale: "en" })
  assert.equal((await port.subscribePush(makeSub())).formError, "Please sign in.")
})
