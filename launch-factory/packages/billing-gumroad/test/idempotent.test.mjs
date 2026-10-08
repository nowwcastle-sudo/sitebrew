// D188: Vercel Cron 은 최선 노력 전달이고 같은 실행이 두 번 올 수 있다(Vercel 문서, 2026-08-11). Gumroad 의 정기 대조 `reconcile()` 을 연달아(그리고 동시에) 돌려도
// 안전한지 단정한다 — 바뀐 것이 없으면 DB 의 구독 내용은 그대로이고, 메일은 한 번 보낸 것을 되풀이하지 않는다.
// 「DB 내용」은 구독 행의 모든 칸에서 처리 순서 표시(updated_from_event_at)·갱신 시각(updated_at)을 뺀 것이다 — 두 칸은 처리가 일어난 시각이라 대조할 때마다 앞으로 간다(옛 스냅숏이 새 상태를 못 덮게 하는 장치).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import { signRef } from "../src/index.ts"
import { TEST_PING_SECRET } from "./fake-gumroad.mjs"
import { DAY, setup } from "./harness.mjs"

let h
before(async () => {
  h = await setup()
})
after(async () => {
  await h?.close()
})

async function subscribed(billing) {
  const userId = await h.newUser()
  const r = h.fake.purchase({ productId: "prod_pro", urlParams: { lf_ref: signRef(TEST_PING_SECRET, userId, new Date()) } })
  const res = await h.deliver(r.ping, undefined, billing)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  return { userId, r, subId: r.sub.id }
}
/** 구독 행(순서·갱신 시각 칸 제외)과 웹훅 이벤트 표 전체 */
async function content() {
  const subs = await h.d.execute(sql`select * from subscriptions where provider = 'gumroad' order by provider_sub_id`)
  const rows = (subs.rows ?? subs).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "updated_from_event_at" && k !== "updated_at")))
  const evs = await h.d.execute(sql`select provider, event_id from webhook_events where provider = 'gumroad' order by event_id`)
  return JSON.stringify([rows, evs.rows ?? evs])
}
const stamps = async () => {
  const subs = await h.d.execute(sql`select provider_sub_id, updated_from_event_at from subscriptions where provider = 'gumroad' order by provider_sub_id`)
  return (subs.rows ?? subs).map((r) => [r.provider_sub_id, new Date(r.updated_from_event_at).getTime()])
}

test("D188 reconcile 두 번: 바뀐 것이 없으면 두 번째는 DB 내용·메일·이벤트 표를 한 글자도 바꾸지 않는다(주문·해지 메일을 켠 설정)", async () => {
  const billing = h.make({ mail: { ...h.mail, sendBillingEmails: true } })
  const a = await subscribed(billing)
  const b = await subscribed(billing)
  // 알림을 놓친 변경(해지 예약) — 첫 reconcile 이 따라잡는다
  h.fake.mutate(a.subId, (s) => {
    s.status = "pending_cancellation"
    s.cancelled_at = new Date(Date.now() + 4 * DAY).toISOString()
  })
  const first = await billing.reconcile()
  assert.ok(first.checked >= 2)
  assert.equal(first.failed, 0)
  const mailsAfterFirst = h.sent.length
  const contentAfterFirst = await content()
  assert.equal(JSON.parse(contentAfterFirst)[0].find((r) => r.provider_sub_id === a.subId).cancel_at !== null, true, "첫 reconcile 이 해지 예약을 따라잡았다")
  const second = await billing.reconcile()
  assert.deepEqual(second, { checked: first.checked, failed: 0 })
  assert.equal(await content(), contentAfterFirst, "두 번째 reconcile 이 DB 내용을 바꿨다")
  assert.equal(h.sent.length, mailsAfterFirst, "두 번째 reconcile 이 메일을 더 보냈다")
  // 세 번째·네 번째도 같다
  await billing.reconcile()
  await billing.reconcile()
  assert.equal(await content(), contentAfterFirst)
  assert.equal(h.sent.length, mailsAfterFirst)
  void b
})

test("D188 reconcile 두 번: 해지 확인 메일(cancellation)은 알림이 먼저 보냈으면 reconcile 이 되풀이하지 않는다", async () => {
  const billing = h.make({ mail: { ...h.mail, sendBillingEmails: true } })
  const { subId } = await subscribed(billing)
  const cancelPing = h.fake.requestCancel(subId, new Date(Date.now() + 9 * DAY))
  await h.deliver(cancelPing, undefined, billing)
  const cancelMails = () => h.sent.filter((m) => m.template === "cancellation" && m.idempotencyKey.includes(subId)).length
  assert.equal(cancelMails(), 1)
  const mails = h.sent.length
  await billing.reconcile()
  await billing.reconcile()
  assert.equal(cancelMails(), 1, "reconcile 이 해지 확인 메일을 또 보냈다")
  assert.equal(h.sent.length, mails)
})

test("D188 reconcile 이 동시에 두 번 와도(Promise.all) 최종 DB 내용은 한 번 돌린 것과 같고 메일은 늘지 않는다", async () => {
  const billing = h.make({ mail: { ...h.mail, sendBillingEmails: true } })
  const { subId } = await subscribed(billing)
  h.fake.mutate(subId, (s) => {
    s.status = "pending_cancellation"
    s.cancelled_at = new Date(Date.now() + 6 * DAY).toISOString()
  })
  const mailsBefore = h.sent.length
  const [x, y] = await Promise.all([billing.reconcile(), billing.reconcile()])
  assert.equal(x.failed + y.failed, 0)
  const settled = await content()
  const cancelMails = h.sent.filter((m) => m.template === "cancellation" && m.idempotencyKey.includes(subId)).length
  assert.ok(cancelMails <= 1, `해지 확인 메일이 ${cancelMails}통 나갔다`)
  assert.ok(h.sent.length - mailsBefore <= 1)
  await billing.reconcile()
  assert.equal(await content(), settled, "동시 실행 뒤 한 번 더 돌려도 내용이 같다")
})

test("D188 reconcile 은 처리 순서 표시만 앞으로 보낸다 — 옛 스냅숏 방지 장치가 되감기지 않는다(단조 증가)", async () => {
  const billing = h.make()
  await subscribed(billing)
  const before = await stamps()
  await billing.reconcile()
  const after = await stamps()
  for (const [id, t] of before) assert.ok(after.find(([i]) => i === id)[1] >= t, `${id} 의 순서 표시가 뒤로 갔다`)
})
