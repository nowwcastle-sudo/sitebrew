// 탈퇴·내려받기와 주문(계획 3d L4). 근거: 전자상거래법 시행령 제6조제1항(대금결제·재화 공급 기록 5년).
// 주문 행은 지우지 않고 user_id 만 끊는다. 결제된 주문은 가명 참조(retained_transactions)로 사람과 이어 두고,
// 거래가 끝난 주문의 배송지(받는 분·전화·주소·메모)는 비운다. 진행 중인 주문의 배송지는 배송이 끝날 때까지 두었다가 다음 Cron 이 비운다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { eq, inArray } from "drizzle-orm"
import { db, orderItems, orders, retainedTransactions, user } from "@launch-factory/db"
import { NO_ANALYTICS_ERASER, deidentifyOrphanOrders, exportMyData, findRetainedByEmail, identifyingKeys, requestAccountDeletion, runPurge } from "../src/index.ts"

// 고정 시험값 — 실제 비밀이 아니다.
const KEY = "lf-test-subject-key-not-real-0123456789"
const DAY = 24 * 3600 * 1000

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

const noSubscription = () => ({
  subscription: async () => ({ ok: true, data: { planId: null, status: "none" } }),
  cancel: async () => ({ ok: true, data: { planId: null, status: "none" } }),
})

const address = (tag) => ({ recipient: `받는분${tag}`, phone: `010-0000-${tag}`, postcode: "06000", address1: `서울시 예시구 ${tag}길 1`, address2: `${tag}호`, note: `문앞 ${tag}` })

let seq = 0
async function seedUser() {
  const id = `usr_ord_${++seq}_${Math.random().toString(36).slice(2, 8)}`
  const at = new Date(Date.now() - 30 * DAY)
  await d.insert(user).values({ id, name: `Order Person ${seq}`, email: `order.person.${seq}@example.test`, emailVerified: true, createdAt: at, updatedAt: at })
  return { id, email: `order.person.${seq}@example.test` }
}

/** 상태별 주문 하나. 결제 전 주문은 paymentId·paidAt 이 없다 */
async function seedOrder(userId, status, tag) {
  const at = new Date(Date.now() - 10 * DAY)
  const paid = !["pending_payment", "canceled"].includes(status)
  const [o] = await d
    .insert(orders)
    .values({
      userId,
      status,
      subtotal: 20000,
      shipping: 3000,
      total: 23000,
      paymentId: paid ? `pay_${tag}` : null,
      address: address(tag),
      trackingNumber: ["shipped", "delivered"].includes(status) ? `TRK${tag}` : null,
      createdAt: at,
      paidAt: paid ? at : null,
      canceledAt: ["canceled", "refunded"].includes(status) ? at : null,
      expiresAt: new Date(at.getTime() + 1800_000),
    })
    .returning()
  await d.insert(orderItems).values([
    { orderId: o.id, productId: "sku-a", name: "예시 상품 A", unitAmount: 10000, quantity: 1 },
    { orderId: o.id, productId: "sku-b", name: "예시 상품 B", unitAmount: 5000, quantity: 2 },
  ])
  return o
}

async function purgeUser(id, now = new Date(Date.now() + 8 * DAY)) {
  const t0 = new Date(now.getTime() - 8 * DAY)
  await requestAccountDeletion({ db: d, billingFor: noSubscription, now: () => t0 }, id)
  const r = await runPurge({ db: d, billingFor: noSubscription, subjectKey: KEY, analytics: NO_ANALYTICS_ERASER, now: () => now })
  assert.deepEqual(r.failures, [])
  return r
}

const PII = /받는분|010-0000|서울시 예시구|문앞|호$/

test("탈퇴 파기: 거래가 끝난 주문은 배송지가 비고 금액·상태·결제 id·줄은 남으며 user_id 는 끊긴다", async () => {
  const u = await seedUser()
  const delivered = await seedOrder(u.id, "delivered", "1111")
  const refunded = await seedOrder(u.id, "refunded", "2222")
  const canceled = await seedOrder(u.id, "canceled", "3333")
  await purgeUser(u.id)

  for (const [before_, tag] of [[delivered, "1111"], [refunded, "2222"], [canceled, "3333"]]) {
    const [o] = await d.select().from(orders).where(eq(orders.id, before_.id))
    assert.equal(o.userId, null, "사용자 연결이 끊긴다")
    assert.equal(o.address, null, `배송지가 비워진다 (${tag})`)
    assert.equal(o.total, 23000)
    assert.equal(o.subtotal, 20000)
    assert.equal(o.shipping, 3000)
    assert.equal(o.status, before_.status)
    assert.equal(o.paymentId, before_.paymentId)
    const lines = await d.select().from(orderItems).where(eq(orderItems.orderId, o.id))
    assert.equal(lines.length, 2, "주문 줄은 남는다")
  }
})

test("탈퇴 파기: 진행 중인 주문(결제 완료·준비 중·배송 중·결제 대기)의 배송지는 두고, 끝난 뒤 다음 정리에서 비운다", async () => {
  const u = await seedUser()
  const inflight = []
  for (const [status, tag] of [["pending_payment", "4001"], ["paid", "4002"], ["preparing", "4003"], ["shipped", "4004"]]) inflight.push(await seedOrder(u.id, status, tag))
  await purgeUser(u.id)

  for (const o of inflight) {
    const [row] = await d.select().from(orders).where(eq(orders.id, o.id))
    assert.equal(row.userId, null)
    assert.ok(row.address, `${o.status}: 배송에 필요해 아직 둔다`)
  }
  // 배송이 끝나면 다음 정리가 비운다(주문 상태가 끝난 것만)
  await d.update(orders).set({ status: "delivered" }).where(eq(orders.id, inflight[3].id))
  const n = await deidentifyOrphanOrders(d)
  assert.equal(n, 1)
  const [done] = await d.select().from(orders).where(eq(orders.id, inflight[3].id))
  assert.equal(done.address, null)
  const [still] = await d.select().from(orders).where(eq(orders.id, inflight[1].id))
  assert.ok(still.address, "아직 진행 중인 주문은 그대로")
  // 사용자가 살아 있는 주문은 건드리지 않는다
  const alive = await seedUser()
  const mine = await seedOrder(alive.id, "delivered", "5001")
  await deidentifyOrphanOrders(d)
  const [kept] = await d.select().from(orders).where(eq(orders.id, mine.id))
  assert.ok(kept.address, "살아 있는 사용자의 배송지는 그대로")
})

test("탈퇴 파기: 결제된 주문은 가명 참조로 5년 남고(식별 칸 없음), 이메일로 찾을 수 있으며 결제 전 주문은 옮기지 않는다", async () => {
  const u = await seedUser()
  const paid = await seedOrder(u.id, "delivered", "6001")
  const refunded = await seedOrder(u.id, "refunded", "6002")
  const unpaid = await seedOrder(u.id, "canceled", "6003")
  const now = new Date(Date.now() + 8 * DAY)
  await purgeUser(u.id, now)

  const kept = (await findRetainedByEmail(d, KEY, u.email)).filter((r) => r.record?.type === "order")
  assert.deepEqual(kept.map((r) => r.providerRef).sort(), [`order:${paid.id}`, `order:${refunded.id}`].sort())
  for (const r of kept) {
    assert.equal(r.kind, "payment")
    assert.deepEqual(identifyingKeys(r.record), [])
    assert.equal(r.retainUntil.getTime() > now.getTime() + 59 * 30 * DAY, true, "5년(60개월)")
    assert.equal(r.record.total, 23000)
    assert.ok(r.record.paymentId.startsWith("pay_"))
    assert.deepEqual(r.record.lines.map((l) => [l.productId, l.quantity, l.unitAmount]), [["sku-a", 1, 10000], ["sku-b", 2, 5000]])
  }
  const text = JSON.stringify(kept)
  assert.ok(!PII.test(text), "배송지·이름이 보존 기록에 새지 않는다")
  assert.ok(!text.includes(u.email) && !text.includes(u.id))
  const rows = await d.select().from(retainedTransactions).where(inArray(retainedTransactions.providerRef, [`order:${unpaid.id}`]))
  assert.equal(rows.length, 0)
})

test("내려받기: 본인 주문(줄·금액·상태·배송지)이 들어가고 다른 사용자 주문은 없다", async () => {
  const a = await seedUser()
  const b = await seedUser()
  const mine = await seedOrder(a.id, "shipped", "7001")
  await seedOrder(b.id, "paid", "7002")
  const out = await exportMyData(d, a.id)
  assert.equal(out.orders.length, 1)
  const o = out.orders[0]
  assert.equal(o.orderId, mine.id)
  assert.equal(o.status, "shipped")
  assert.deepEqual([o.subtotal, o.shipping, o.total, o.currency], [20000, 3000, 23000, "KRW"])
  assert.equal(o.trackingNumber, "TRK7001")
  assert.equal(o.paymentId, "pay_7001")
  assert.deepEqual(o.items.map((i) => [i.productId, i.name, i.quantity, i.unitAmount]), [["sku-a", "예시 상품 A", 1, 10000], ["sku-b", "예시 상품 B", 2, 5000]])
  assert.equal(o.shippingAddress.recipient, "받는분7001")
  const text = JSON.stringify(out)
  assert.ok(!text.includes("7002") && !text.includes(b.id), "다른 사용자 주문 없음")
  // 주문이 없으면 빈 목록
  const c = await seedUser()
  assert.deepEqual((await exportMyData(d, c.id)).orders, [])
})

test("탈퇴 파기: 다른 사용자의 주문은 그대로다", async () => {
  const gone = await seedUser()
  const stay = await seedUser()
  await seedOrder(gone.id, "delivered", "8001")
  const other = await seedOrder(stay.id, "delivered", "8002")
  await purgeUser(gone.id)
  const [o] = await d.select().from(orders).where(eq(orders.id, other.id))
  assert.equal(o.userId, stay.id)
  assert.equal(o.address.recipient, "받는분8002")
})
