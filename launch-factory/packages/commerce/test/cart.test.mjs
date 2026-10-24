// 장바구니(cart) — 로그인 사용자의 DB 장바구니. 가격은 서버 상품표에서 읽고, 클라이언트가 보낸 값은 상품 id 와 수량뿐이다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { clearCart, readCart, setLine } from "../src/cart.ts"
import { seedStock } from "../src/stock.ts"
import { makeDeps, newDb, putCart } from "./helpers.mjs"
import { withDefaults } from "../src/deps.ts"

let d
let ctx
before(async () => {
  d = await newDb()
  ctx = withDefaults(makeDeps(d).deps)
})
after(async () => {
  await d?.$client.close()
})

test("빈 장바구니: 줄 없음, 합계 0(배송비도 없다)", async () => {
  assert.deepEqual(await readCart(d, ctx, "buyer"), { lines: [], subtotal: 0, shipping: 0, total: 0 })
})

test("담기: 서버 상품표의 이름·단가로 줄을 만들고 합계를 계산한다", async () => {
  const r = await setLine(d, ctx, "buyer", "tote", 2)
  assert.equal(r.ok, true)
  assert.deepEqual(r.value.cart.lines, [{ productId: "tote", name: "에코백(예시)", unitAmount: 8000, quantity: 2 }])
  assert.deepEqual([r.value.cart.subtotal, r.value.cart.shipping, r.value.cart.total], [16000, 3000, 19000])
  assert.equal(r.value.added, 2)
})

test("수량 바꾸기와 빼기(0): 줄이 바뀌고 added 는 늘어난 만큼만(줄이면 0)", async () => {
  await setLine(d, ctx, "buyer", "tote", 5)
  const down = await setLine(d, ctx, "buyer", "tote", 1)
  assert.equal(down.value.added, 0)
  assert.equal(down.value.cart.lines[0].quantity, 1)
  const gone = await setLine(d, ctx, "buyer", "tote", 0)
  assert.deepEqual(gone.value.cart.lines, [])
})

test("재고 제한이 있는 상품: available 을 싣고, 재고보다 많이 담으면 out_of_stock + 남은 수", async () => {
  await seedStock(d, [{ sku: "mug", quantity: 5 }], new Date())
  const ok = await setLine(d, ctx, "buyer", "mug", 5)
  assert.equal(ok.ok, true)
  assert.equal(ok.value.cart.lines[0].available, 5)
  const over = await setLine(d, ctx, "buyer", "mug", 6)
  assert.deepEqual(over, { ok: false, code: "out_of_stock", productId: "mug", available: 5 })
  assert.equal((await readCart(d, ctx, "buyer")).lines[0].quantity, 5, "실패한 요청은 줄을 바꾸지 않는다")
  await setLine(d, ctx, "buyer", "mug", 0)
})

test("아직 DB 에 재고 행이 없으면 상품표의 시작 수량이 available 이다", async () => {
  const r = await setLine(d, ctx, "buyer", "pen", 3) // 상품표 stock 3, 행 없음
  assert.equal(r.ok, true)
  assert.equal(r.value.cart.lines[0].available, 3)
  assert.equal((await setLine(d, ctx, "buyer", "pen", 4)).code, "out_of_stock")
  await setLine(d, ctx, "buyer", "pen", 0)
})

test("재고 제한이 없는 상품은 available 이 없고, 상한(99)까지 담을 수 있다", async () => {
  const r = await setLine(d, ctx, "buyer", "tote", 99)
  assert.equal(r.ok, true)
  assert.equal("available" in r.value.cart.lines[0], false)
  assert.equal((await setLine(d, ctx, "buyer", "tote", 100)).code, "invalid_quantity")
  await setLine(d, ctx, "buyer", "tote", 0)
})

test("모르는 상품·잘못된 수량은 거절하고 아무것도 쓰지 않는다", async () => {
  assert.deepEqual(await setLine(d, ctx, "buyer", "ghost", 1), { ok: false, code: "unknown_product", productId: "ghost" })
  for (const bad of [-1, 1.5, Number.NaN, "2", null, undefined, 2 ** 53]) assert.equal((await setLine(d, ctx, "buyer", "tote", bad)).code, "invalid_quantity", String(bad))
  assert.deepEqual((await readCart(d, ctx, "buyer")).lines, [])
})

test("사용자별로 갈린다: 한 사람의 장바구니는 다른 사람에게 보이지 않는다", async () => {
  await setLine(d, ctx, "buyer", "tote", 1)
  await setLine(d, ctx, "other", "mug", 2)
  assert.deepEqual((await readCart(d, ctx, "buyer")).lines.map((l) => l.productId), ["tote"])
  assert.deepEqual((await readCart(d, ctx, "other")).lines.map((l) => l.productId), ["mug"])
  assert.deepEqual((await readCart(d, ctx, "third")).lines, [])
  await clearCart(d, "buyer")
  await clearCart(d, "other")
})

test("상품표에서 사라진 상품의 줄은 읽기에서 빠진다(가격을 모르는 줄은 그리지 않는다)", async () => {
  await putCart(d, "third", [["retired", 1], ["tote", 1]])
  const cart = await readCart(d, ctx, "third")
  assert.deepEqual(cart.lines.map((l) => l.productId), ["tote"])
  assert.equal(cart.subtotal, 8000)
  await clearCart(d, "third")
})

test("무료 배송 기준을 넘으면 배송비가 0", async () => {
  await setLine(d, ctx, "buyer", "lamp", 1) // 60,000
  const c = await readCart(d, ctx, "buyer")
  assert.deepEqual([c.subtotal, c.shipping, c.total], [60000, 0, 60000])
  await clearCart(d, "buyer")
})
