// 상품표 검사(catalog) — 잘못된 표는 켤 때 한 번에 모아서 던진다. 가격은 원 단위 정수, 통화는 KRW 만.
import { test } from "node:test"
import assert from "node:assert/strict"
import { CatalogError, defineCatalog } from "../src/catalog.ts"

const ok = [
  { id: "mug", name: "머그컵(예시)", price: 12000, stock: 5 },
  { id: "tote", name: "에코백(예시)", price: 8000 },
]

test("올바른 표: 계약 CatalogItem 모양(Money, vatIncluded)으로 바뀌고 stock 이 없으면 null(제한 없음)이다", () => {
  const c = defineCatalog(ok)
  assert.deepEqual(c.items[0], { id: "mug", name: "머그컵(예시)", price: { amount: 12000, currency: "KRW", vatIncluded: true }, stock: 5 })
  assert.equal(c.get("tote")?.stock, null)
  assert.equal(c.get("nope"), undefined)
  assert.equal(c.items.length, 2)
})

test("Money 로 적어도 된다(KRW 만) — 다른 통화는 거절", () => {
  assert.equal(defineCatalog([{ id: "a", name: "a", price: { amount: 100, currency: "KRW", vatIncluded: true } }]).get("a")?.price.amount, 100)
  assert.throws(() => defineCatalog([{ id: "a", name: "a", price: { amount: 100, currency: "USD", vatIncluded: true } }]), CatalogError)
})

test("나쁜 표는 문제를 모두 모아 한 번에 던진다", () => {
  const bad = [
    { id: "dup", name: "a", price: 1000 },
    { id: "dup", name: "b", price: 1000 },
    { id: "Bad Id!", name: "c", price: 1000 },
    { id: "free", name: "d", price: 0 },
    { id: "frac", name: "e", price: 10.5 },
    { id: "neg-stock", name: "f", price: 1000, stock: -1 },
    { id: "frac-stock", name: "g", price: 1000, stock: 1.5 },
    { id: "noname", name: "  ", price: 1000 },
    { id: "img", name: "h", price: 1000, imageUrl: "http://insecure.example/x.png" },
  ]
  assert.throws(
    () => defineCatalog(bad),
    (e) => {
      assert.ok(e instanceof CatalogError)
      const text = e.problems.join("\n")
      for (const needle of ["dup", "Bad Id!", "free", "frac", "neg-stock", "frac-stock", "noname", "img"]) assert.match(text, new RegExp(needle.replace(/[!]/g, "\\!")), needle)
      return true
    },
  )
})

test("빈 표도 거절한다(켜 놓고 팔 것이 없는 상점을 만들지 않는다)", () => {
  assert.throws(() => defineCatalog([]), CatalogError)
})

test("imageUrl 은 https 주소 또는 / 로 시작하는 사이트 안 경로만", () => {
  assert.equal(defineCatalog([{ id: "a", name: "a", price: 1, imageUrl: "/img/a.webp" }]).get("a")?.imageUrl, "/img/a.webp")
  assert.equal(defineCatalog([{ id: "a", name: "a", price: 1, imageUrl: "https://cdn.example.com/a.webp" }]).get("a")?.imageUrl, "https://cdn.example.com/a.webp")
  assert.throws(() => defineCatalog([{ id: "a", name: "a", price: 1, imageUrl: "//evil.example/a.webp" }]), CatalogError)
})

test("돌려준 표는 바꿀 수 없다(얼려 있다)", () => {
  const c = defineCatalog(ok)
  assert.throws(() => {
    "use strict"
    c.items[0].price.amount = 1
  }, TypeError)
})
