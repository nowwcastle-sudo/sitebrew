// 판매 포트 적합성(계획 3d L4): web-factory 의 commerceConformance 묶음을 우리 commercePort 구현(진짜 도메인 함수 + mock 게이트웨이 + PGlite)에 돌린다.
// 묶음은 계약 가져오기(@launch-factory/contract/conformance/commerce — contract.lock.json 에 고정)로 받은 사본이라 web-factory 체크아웃이 없어도 건너뛰지 않는다.
// 장면(?cart=·?stock=·?order=)은 make 가 만든다: 검사마다 표를 비우고 상품·재고를 다시 깔고, 그 장면의 장바구니·주문을 도메인 함수로 만든다(DB 에 직접 쓰지 않는다 — 상태 전이 표를 지난다).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import { withDefaults, advanceOrder, setStock, commercePort } from "../src/index.ts"
import { commerceConformance } from "@launch-factory/contract/conformance/commerce"
import { ADDRESS, CATALOG_ENTRIES, makeDeps, newDb } from "./helpers.mjs"

/** 묶음이 돌려야 하는 검사 수 — requireConfirmation 을 켜면 확인 검사 둘이 늘어난다. 줄거나 늘면 묶음이 바뀐 것이니 확인한다 */
const TOTAL = 40

let d
before(async () => {
  d = await newDb()
})
after(async () => {
  await d?.$client.close()
})

async function reset() {
  await d.execute(sql`truncate table order_items, orders, cart_items, stock_levels cascade`)
  const now = new Date()
  for (const e of CATALOG_ENTRIES) if (e.stock !== undefined) await setStock(d, e.id, e.stock, now)
}

/** 결제창을 닫은 뒤의 확정 경로를 흉내 낸다: 공급자(mock)가 결제를 끝낸 것으로 한 뒤 확정을 부른다. 모르는 결제 번호는 mock 이 던지므로 그대로 확정에 넘겨 거절을 본다 */
function withPaidGateway(port, gateway) {
  return {
    ...port,
    confirmPayment: async (input) => {
      try {
        gateway.markPaid(input.paymentId)
      } catch {
        /* 모르는 결제 번호 — 확정이 거절해야 한다 */
      }
      return port.confirmPayment(input)
    },
  }
}

const make = async ({ cart, stock, order }) => {
  await reset()
  const made = makeDeps(d)
  const raw = commercePort({ ...made.deps, userId: "buyer", requireConfirmation: true })
  const port = withPaidGateway(raw, made.gateway)
  const ctx = withDefaults(made.deps)
  const must = (r, what) => {
    assert.equal(r.ok, true, `${what}: ${JSON.stringify(r)}`)
    return r.data
  }

  if (order !== "none") {
    must(await port.setCartLine({ productId: "mug", quantity: 1 }), "담기")
    must(await port.setCartLine({ productId: "tote", quantity: 1 }), "담기")
    const { order: placed, payment } = must(await port.placeOrder({ address: ADDRESS, confirmed: true }), "주문")
    const pay = () => port.confirmPayment({ orderId: placed.id, paymentId: payment.paymentId }).then((r) => must(r, "결제 확정"))
    const advance = async (to, trackingNumber) => must((await advanceOrder(ctx, { orderId: placed.id, to, ...(trackingNumber ? { trackingNumber } : {}) })).ok ? { ok: true, data: null } : { ok: false }, `앞걸음 ${to}`)
    if (order === "canceled") must(await port.cancelOrder({ orderId: placed.id, confirmed: true }), "취소")
    if (order !== "pending_payment" && order !== "canceled") await pay()
    if (["preparing", "shipped", "delivered"].includes(order)) await advance("preparing")
    if (["shipped", "delivered"].includes(order)) await advance("shipped", "TRK-CONF-1")
    if (order === "delivered") await advance("delivered")
    if (order === "refunded") must(await port.cancelOrder({ orderId: placed.id, confirmed: true }), "환불")
  }
  if (cart === "filled") {
    must(await port.setCartLine({ productId: "mug", quantity: 1 }), "담기")
    must(await port.setCartLine({ productId: "tote", quantity: 2 }), "담기")
    // 품절 장면: 담긴 뒤에 한 줄의 재고가 바닥난다(다른 손님이 먼저 샀다)
    if (stock === "out") await setStock(d, "mug", 0, new Date())
  }
  return port
}

test("적합성: commerceConformance — 우리 commercePort(진짜 도메인 함수 + mock 게이트웨이 + PGlite), 확인 입력 포함", { timeout: 300_000 }, async () => {
  const results = await commerceConformance(make, { requireConfirmation: true, timeoutMs: 30_000 })
  const failed = results.filter((r) => !r.ok)
  assert.deepEqual(failed, [], `실패한 검사: ${failed.map((f) => `${f.id}: ${f.message}`).join(" | ")}`)
  assert.equal(results.length, TOTAL, "묶음이 돌려주는 검사 수가 달라졌어요 — 묶음이 바뀌었는지 확인하세요")
  assert.equal(new Set(results.map((r) => r.id)).size, results.length, "검사 id 는 겹치지 않는다")
})
