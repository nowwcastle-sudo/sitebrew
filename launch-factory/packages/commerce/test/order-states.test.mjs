// 주문 상태 전이 표(데이터) — DB 의 상태 목록과 같은 열쇠, 모든 전이의 허용·거절.
import { test } from "node:test"
import assert from "node:assert/strict"
import { ORDER_STATUSES } from "@launch-factory/db"
import { canMove, CUSTOMER_CANCELABLE, FORWARD_STEPS, TRANSITIONS } from "../src/order-states.ts"

test("전이 표의 열쇠는 DB 상태 목록과 같다(CHECK 와 표가 어긋나지 않는다)", () => {
  assert.deepEqual(Object.keys(TRANSITIONS).sort(), [...ORDER_STATUSES].sort())
  for (const targets of Object.values(TRANSITIONS)) for (const t of targets) assert.ok(ORDER_STATUSES.includes(t), t)
})

test("계획의 전이 표 그대로", () => {
  assert.deepEqual(TRANSITIONS, {
    pending_payment: ["paid", "canceled"],
    paid: ["preparing", "refunded"],
    preparing: ["shipped", "refunded"],
    shipped: ["delivered"],
    delivered: [],
    canceled: [],
    refunded: [],
  })
})

test("canMove: 표에 있는 전이만 true — 모든 쌍을 센다", () => {
  let allowed = 0
  for (const from of ORDER_STATUSES) for (const to of ORDER_STATUSES) {
    const expect = TRANSITIONS[from].includes(to)
    assert.equal(canMove(from, to), expect, `${from} -> ${to}`)
    if (expect) allowed++
  }
  assert.equal(allowed, 7)
  assert.equal(canMove("delivered", "paid"), false)
  assert.equal(canMove("canceled", "paid"), false)
})

test("관리자가 밀 수 있는 앞걸음은 준비·배송·완료뿐이고 모두 표 안에 있다", () => {
  assert.deepEqual([...FORWARD_STEPS], ["preparing", "shipped", "delivered"])
  for (const to of FORWARD_STEPS) assert.ok(Object.values(TRANSITIONS).some((l) => l.includes(to)))
})

test("손님이 취소할 수 있는 상태는 결제 대기·결제 완료·준비 중뿐(배송 시작부터는 판매자에게 문의)", () => {
  assert.deepEqual([...CUSTOMER_CANCELABLE], ["pending_payment", "paid", "preparing"])
})
