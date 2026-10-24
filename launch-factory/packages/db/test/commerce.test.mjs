// 판매 표(stock_levels · cart_items · orders · order_items) — 계획 3a B3.
// DB 는 PGlite 메모리 하나를 파일 전체가 같이 쓴다. 규칙은 모두 DB 제약으로 막히는지 본다(앱 코드가 틀려도 음수 재고·합계 불일치가 못 들어가게).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import * as lf from "../src/index.ts"

const { db, ORDER_STATUSES, orders, orderItems, cartItems, stockLevels } = lf

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
  await d.execute(sql`insert into "user" (id, name, email) values ('buyer', 'Buyer', 'buyer@example.com'), ('other', 'Other', 'other@example.com')`)
})
after(async () => {
  await d?.$client.close()
})

async function sqlState(promise) {
  try {
    await promise
  } catch (e) {
    return e.cause?.code ?? e.code
  }
  return "no-error"
}
const CHECK_VIOLATION = "23514"
const UNIQUE_VIOLATION = "23505"
const FK_VIOLATION = "23503"
const NOW = new Date("2026-10-22T09:00:00Z")
const LATER = new Date("2026-10-22T09:30:00Z")
const ADDRESS = { recipient: "김예시", phone: "010-0000-0000", postcode: "00000", address1: "예시시 예시로 1" }
/** 주문 행 하나를 넣는다(기본값은 합계가 맞는 결제 대기 주문) */
const newOrder = (over = {}) =>
  d.insert(orders).values({ userId: "buyer", status: "pending_payment", subtotal: 30000, shipping: 3000, total: 33000, address: ADDRESS, createdAt: NOW, expiresAt: LATER, ...over }).returning()

test("ORDER_STATUSES: 계획의 7상태 그대로이고 DB CHECK 가 같은 목록이다", async () => {
  assert.deepEqual([...ORDER_STATUSES], ["pending_payment", "paid", "preparing", "shipped", "delivered", "canceled", "refunded"])
  for (const status of ORDER_STATUSES) {
    const [o] = await newOrder({ status, paymentId: `pay-status-${status}` })
    assert.equal(o?.status, status)
  }
  assert.equal(await sqlState(newOrder({ status: "shipping" })), CHECK_VIOLATION)
  const def = await d.execute(sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'orders_status_ck'`)
  for (const status of ORDER_STATUSES) assert.ok(String(def.rows[0].def).includes(`'${status}'`), status)
})

test("표 네 개가 스키마에 있고 칸 이름이 계획과 같다", async () => {
  const columns = async (table) => (await d.execute(sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = ${table} order by 1`)).rows.map((r) => r.column_name)
  assert.deepEqual(await columns("stock_levels"), ["quantity", "sku", "updated_at"])
  assert.deepEqual(await columns("cart_items"), ["product_id", "quantity", "user_id"])
  assert.deepEqual(await columns("order_items"), ["name", "order_id", "product_id", "quantity", "unit_amount"])
  assert.deepEqual(await columns("orders"), [
    "address", "canceled_at", "created_at", "currency", "expires_at", "id", "paid_at", "payment_id", "shipping", "status", "subtotal", "total", "tracking_number", "user_id",
  ])
  assert.equal(getTableConfig(stockLevels).name, "stock_levels")
})

test("stock_levels: sku 가 기본 키이고 재고는 음수가 될 수 없다(조건부 UPDATE 가 틀려도 DB 가 막는다)", async () => {
  await d.insert(stockLevels).values({ sku: "mug", quantity: 3, updatedAt: NOW })
  assert.equal(await sqlState(d.insert(stockLevels).values({ sku: "mug", quantity: 1, updatedAt: NOW })), UNIQUE_VIOLATION)
  assert.equal(await sqlState(d.execute(sql`update stock_levels set quantity = quantity - 4 where sku = 'mug'`)), CHECK_VIOLATION)
  // 안전한 갱신: 모자라면 0 행이 바뀐다
  const r = await d.execute(sql`update stock_levels set quantity = quantity - 4 where sku = 'mug' and quantity >= 4 returning sku`)
  assert.equal(r.rows.length, 0)
})

test("cart_items: (사용자, 상품) 기본 키 · 수량은 1 이상 · 사용자가 있어야 한다", async () => {
  await d.insert(cartItems).values({ userId: "buyer", productId: "mug", quantity: 2 })
  assert.equal(await sqlState(d.insert(cartItems).values({ userId: "buyer", productId: "mug", quantity: 1 })), UNIQUE_VIOLATION)
  assert.equal(await sqlState(d.insert(cartItems).values({ userId: "buyer", productId: "cup", quantity: 0 })), CHECK_VIOLATION)
  assert.equal(await sqlState(d.insert(cartItems).values({ userId: "nobody", productId: "mug", quantity: 1 })), FK_VIOLATION)
})

test("orders: 소계 + 배송비 = 합계, 음수 금액 없음, 통화는 KRW 만", async () => {
  assert.equal(await sqlState(newOrder({ total: 32999, paymentId: "pay-sum-1" })), CHECK_VIOLATION)
  assert.equal(await sqlState(newOrder({ subtotal: -1, shipping: 0, total: -1, paymentId: "pay-neg-1" })), CHECK_VIOLATION)
  assert.equal(await sqlState(newOrder({ currency: "USD", paymentId: "pay-cur-1" })), CHECK_VIOLATION)
  const [ok] = await newOrder({ subtotal: 50000, shipping: 0, total: 50000, paymentId: "pay-free-ship" })
  assert.equal(ok?.currency, "KRW")
})

test("orders: payment_id 는 겹칠 수 없지만 아직 없는(null) 주문은 여럿이어도 된다", async () => {
  await newOrder({ paymentId: "pay-dup" })
  assert.equal(await sqlState(newOrder({ paymentId: "pay-dup" })), UNIQUE_VIOLATION)
  await newOrder({ paymentId: null })
  await newOrder({ paymentId: null })
})

test("order_items: (주문, 상품) 기본 키 · 수량 1 이상 · 단가 0 이상 · 주문이 지워지면 같이 지워진다", async () => {
  const [o] = await newOrder({ paymentId: "pay-items" })
  const orderId = o.id
  await d.insert(orderItems).values({ orderId, productId: "mug", name: "머그컵", unitAmount: 15000, quantity: 2 })
  assert.equal(await sqlState(d.insert(orderItems).values({ orderId, productId: "mug", name: "머그컵", unitAmount: 15000, quantity: 1 })), UNIQUE_VIOLATION)
  assert.equal(await sqlState(d.insert(orderItems).values({ orderId, productId: "cup", name: "컵", unitAmount: 100, quantity: 0 })), CHECK_VIOLATION)
  assert.equal(await sqlState(d.insert(orderItems).values({ orderId, productId: "cup", name: "컵", unitAmount: -1, quantity: 1 })), CHECK_VIOLATION)
  assert.equal(await sqlState(d.insert(orderItems).values({ orderId: "00000000-0000-4000-8000-000000000000", productId: "cup", name: "컵", unitAmount: 1, quantity: 1 })), FK_VIOLATION)
  await d.execute(sql`delete from orders where id = ${orderId}`)
  const left = await d.execute(sql`select count(*)::int as n from order_items where order_id = ${orderId}`)
  assert.equal(left.rows[0].n, 0)
})

test("사용자를 지우면: 장바구니는 같이 지워지고, 주문은 남되 사용자 연결만 끊긴다(전자상거래법 거래기록 보존)", async () => {
  await d.execute(sql`insert into "user" (id, name, email) values ('leaver', 'Leaver', 'leaver@example.com')`)
  await d.insert(cartItems).values({ userId: "leaver", productId: "mug", quantity: 1 })
  const [o] = await newOrder({ userId: "leaver", status: "paid", paymentId: "pay-leaver", paidAt: NOW })
  await d.insert(orderItems).values({ orderId: o.id, productId: "mug", name: "머그컵", unitAmount: 30000, quantity: 1 })

  await d.execute(sql`delete from "user" where id = 'leaver'`)

  const cart = await d.execute(sql`select count(*)::int as n from cart_items where user_id = 'leaver'`)
  assert.equal(cart.rows[0].n, 0)
  const kept = await d.execute(sql`select user_id, status, total from orders where id = ${o.id}`)
  assert.deepEqual(kept.rows, [{ user_id: null, status: "paid", total: 33000 }])
  const items = await d.execute(sql`select count(*)::int as n from order_items where order_id = ${o.id}`)
  assert.equal(items.rows[0].n, 1)
})

test("주소 칸은 비울 수 있다(탈퇴 파기에서 개인 식별 칸만 지우고 주문 기록은 남기는 길)", async () => {
  const [o] = await newOrder({ paymentId: "pay-redact" })
  await d.execute(sql`update orders set address = null where id = ${o.id}`)
  const r = await d.execute(sql`select address from orders where id = ${o.id}`)
  assert.equal(r.rows[0].address, null)
})

test("조회 색인: 내 주문 목록(user_id, created_at)과 만료 Cron(status, expires_at)", async () => {
  const idx = await d.execute(sql`select indexname from pg_indexes where schemaname = 'public' and tablename = 'orders' order by 1`)
  const names = idx.rows.map((r) => r.indexname)
  assert.ok(names.includes("orders_user_created_idx"), names.join())
  assert.ok(names.includes("orders_status_expires_idx"), names.join())
  assert.ok(names.includes("orders_payment_id_unique") || names.some((n) => n.includes("payment_id")), names.join())
})
