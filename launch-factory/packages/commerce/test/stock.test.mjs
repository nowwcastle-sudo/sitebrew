// 재고(stock) — 조건부 UPDATE 로 예약한다. 동시에 마지막 한 개를 사려는 둘 중 한 명만 성공해야 하고, 음수 재고는 어디서도 안 생긴다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { OutOfStock, release, reserve, seedStock, setStock, stockLevelsOf } from "../src/stock.ts"
import { newDb, stockOf } from "./helpers.mjs"

let d
before(async () => {
  d = await newDb()
})
after(async () => {
  await d?.$client.close()
})
const NOW = new Date("2026-10-22T09:00:00Z")

test("seedStock: 없는 상품만 채우고 있는 값은 건드리지 않는다", async () => {
  await seedStock(d, [{ sku: "seed-a", quantity: 5 }], NOW)
  await seedStock(d, [{ sku: "seed-a", quantity: 99 }, { sku: "seed-b", quantity: 2 }], NOW)
  assert.equal(await stockOf(d, "seed-a"), 5)
  assert.equal(await stockOf(d, "seed-b"), 2)
  assert.deepEqual([...(await stockLevelsOf(d, ["seed-a", "seed-b", "nope"])).entries()].sort(), [["seed-a", 5], ["seed-b", 2]])
})

test("reserve: 재고만큼 차감하고, 부족하면 OutOfStock 으로 던지며 아무것도 바꾸지 않는다(트랜잭션)", async () => {
  await seedStock(d, [{ sku: "r1", quantity: 3 }, { sku: "r2", quantity: 1 }], NOW)
  await d.transaction((tx) => reserve(tx, [{ sku: "r1", quantity: 2 }], NOW))
  assert.equal(await stockOf(d, "r1"), 1)

  await assert.rejects(
    d.transaction((tx) => reserve(tx, [{ sku: "r1", quantity: 1 }, { sku: "r2", quantity: 2 }], NOW)),
    (e) => e instanceof OutOfStock && e.sku === "r2",
  )
  assert.equal(await stockOf(d, "r1"), 1, "롤백되어 r1 도 그대로")
  assert.equal(await stockOf(d, "r2"), 1)
})

test("reserve: 행이 없는 상품(채워지지 않음)은 부족으로 본다", async () => {
  await assert.rejects(d.transaction((tx) => reserve(tx, [{ sku: "ghost", quantity: 1 }], NOW)), OutOfStock)
})

test("동시에 마지막 한 개: 둘이 같이 사려 하면 한 명만 성공한다(음수 재고 없음)", async () => {
  await seedStock(d, [{ sku: "last-one", quantity: 1 }], NOW)
  const attempt = () => d.transaction((tx) => reserve(tx, [{ sku: "last-one", quantity: 1 }], NOW))
  const results = await Promise.allSettled([attempt(), attempt(), attempt()])
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
  assert.equal(results.filter((r) => r.status === "rejected" && r.reason instanceof OutOfStock).length, 2)
  assert.equal(await stockOf(d, "last-one"), 0)
})

test("release: 돌려주고, 돌려준 뒤 다시 예약할 수 있다", async () => {
  await seedStock(d, [{ sku: "rel", quantity: 2 }], NOW)
  await d.transaction((tx) => reserve(tx, [{ sku: "rel", quantity: 2 }], NOW))
  assert.equal(await stockOf(d, "rel"), 0)
  await d.transaction((tx) => release(tx, [{ sku: "rel", quantity: 2 }], NOW))
  assert.equal(await stockOf(d, "rel"), 2)
  await d.transaction((tx) => reserve(tx, [{ sku: "rel", quantity: 1 }], NOW))
  assert.equal(await stockOf(d, "rel"), 1)
})

test("reserve 는 상품 이름순으로 잠근다 — 서로 반대 순서로 같은 두 상품을 사도 교착이 없다", async () => {
  await seedStock(d, [{ sku: "dl-a", quantity: 5 }, { sku: "dl-b", quantity: 5 }], NOW)
  await Promise.all([
    d.transaction((tx) => reserve(tx, [{ sku: "dl-a", quantity: 1 }, { sku: "dl-b", quantity: 1 }], NOW)),
    d.transaction((tx) => reserve(tx, [{ sku: "dl-b", quantity: 1 }, { sku: "dl-a", quantity: 1 }], NOW)),
  ])
  assert.equal(await stockOf(d, "dl-a"), 3)
  assert.equal(await stockOf(d, "dl-b"), 3)
})

test("setStock: 운영자가 수량을 정한다(없으면 만든다). 음수·소수는 거절", async () => {
  await setStock(d, "set-me", 7, NOW)
  assert.equal(await stockOf(d, "set-me"), 7)
  await setStock(d, "set-me", 0, NOW)
  assert.equal(await stockOf(d, "set-me"), 0)
  await assert.rejects(setStock(d, "set-me", -1, NOW))
  await assert.rejects(setStock(d, "set-me", 1.5, NOW))
})

test("수량이 1 미만이거나 소수인 줄은 거절한다", async () => {
  await assert.rejects(d.transaction((tx) => reserve(tx, [{ sku: "r1", quantity: 0 }], NOW)))
  await assert.rejects(d.transaction((tx) => release(tx, [{ sku: "r1", quantity: 1.5 }], NOW)))
})
