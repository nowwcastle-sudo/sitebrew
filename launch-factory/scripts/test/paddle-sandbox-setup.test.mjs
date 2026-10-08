import assert from "node:assert/strict"
import { test } from "node:test"
import { assertSandboxUrl, ensureSandboxCatalog, PRODUCT_NAME } from "../paddle-sandbox-setup.mjs"

function fakePaddle() {
  const state = { products: [], prices: [], calls: [] }
  const f = async (url, init) => {
    const u = new URL(url)
    state.calls.push(`${init.method} ${u.hostname}${u.pathname}`)
    const body = init.body ? JSON.parse(init.body) : null
    const reply = (data, status = 200) => ({ ok: status < 300, status, json: async () => ({ data }) })
    if (u.pathname === "/products" && init.method === "GET") return reply(state.products)
    if (u.pathname === "/products") {
      const p = { id: `pro_${state.products.length}`, ...body }
      state.products.push(p)
      return reply(p, 201)
    }
    if (u.pathname === "/prices" && init.method === "GET") return reply(state.prices.filter((p) => p.product_id === u.searchParams.get("product_id")))
    const p = { id: `pri_${state.prices.length}`, ...body }
    state.prices.push(p)
    return reply(p, 201)
  }
  return { f, state }
}

test("호스트 검사: 샌드박스만 통과, 라이브·http 는 던진다", () => {
  assert.doesNotThrow(() => assertSandboxUrl("https://sandbox-api.paddle.com/products"))
  assert.throws(() => assertSandboxUrl("https://api.paddle.com/products"), /멈춘다/)
  assert.throws(() => assertSandboxUrl("http://sandbox-api.paddle.com/products"), /멈춘다/)
  assert.throws(() => assertSandboxUrl("https://sandbox-api.paddle.com.evil.example/products"), /멈춘다/)
})

test("실결제 키는 요청 전에 거절한다", async () => {
  const { f, state } = fakePaddle()
  await assert.rejects(ensureSandboxCatalog({ key: "pdl_live_x", fetch: f }), /pdl_live_/)
  assert.equal(state.calls.length, 0)
})

test("상품 1개·가격 3개(월·연·체험 있는 월)를 만들고 두 번째 실행은 아무것도 만들지 않는다(멱등)", async () => {
  const { f, state } = fakePaddle()
  const a = await ensureSandboxCatalog({ key: "pdl_sdbx_test", fetch: f })
  assert.equal(a.created.length, 4)
  assert.equal(state.products.length, 1)
  assert.equal(state.products[0].name, PRODUCT_NAME)
  assert.deepEqual(state.prices.map((p) => [p.billing_cycle.interval, p.unit_price.amount, p.tax_mode]), [["month", "900", "external"], ["year", "9000", "external"], ["month", "900", "external"]])
  // 체험 가격만 trial_period(day 14)를 갖는다. 같은 월 주기라도 trial_period 로 구분하므로 두 번째 실행도 멱등이다
  assert.deepEqual(state.prices.map((p) => p.trial_period ?? null), [null, null, { interval: "day", frequency: 14 }])
  assert.deepEqual(Object.keys(a.prices), ["month", "year", "month-trial"])
  const b = await ensureSandboxCatalog({ key: "pdl_sdbx_test", fetch: f })
  assert.equal(b.created.length, 0)
  assert.deepEqual(b.prices, a.prices)
  assert.ok(state.calls.every((c) => c.includes("sandbox-api.paddle.com")))
})
