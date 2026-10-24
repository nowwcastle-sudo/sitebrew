// 시험 재료 — PGlite 메모리 DB(파일마다 하나) · mock 게이트웨이 · 진짜 mock 메일러(렌더 검사 포함)를 감싼 기록기 · 고정 시계.
import { sql } from "drizzle-orm"
import { db } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { mockGateway } from "@launch-factory/payments-kr"
import { defineCatalog } from "../src/catalog.ts"
import { defineShipping } from "../src/pricing.ts"

export const ADDRESS = { recipient: "김예시", phone: "010-0000-0000", postcode: "00000", address1: "예시시 예시로 1", address2: "101호", note: "문 앞에 놓아 주세요" }

export async function newDb() {
  const d = await db.local()
  await d.execute(sql`insert into "user" (id, name, email) values ('buyer', '구매자', 'buyer@example.test'), ('other', '다른 사람', 'other@example.test'), ('third', '세 번째', 'third@example.test')`)
  return d
}

/** 시계: 시험이 원할 때만 흐른다 */
export function clock(iso = "2026-10-22T09:00:00.000Z") {
  const c = { at: new Date(iso), now: () => c.at, tick: (ms) => (c.at = new Date(c.at.getTime() + ms)) }
  return c
}

/** 진짜 mock 메일러를 감싸 보낸 요청과 결과를 기록한다. fail 을 켜면 공급자 실패를 흉내 낸다 */
export function spyMailer() {
  const inner = createMailer({ mode: "mock", log: () => {} })
  const spy = {
    mode: "mock",
    sent: [],
    fail: false,
    async send(request) {
      if (spy.fail) {
        const result = { ok: false, mode: "mock", error: { name: "provider_down", statusCode: 503, message: "down" } }
        spy.sent.push({ request, result })
        return result
      }
      const result = await inner.send(request)
      spy.sent.push({ request, result })
      return result
    },
  }
  return spy
}

export const CATALOG_ENTRIES = [
  { id: "mug", name: "머그컵(예시)", price: 12000, stock: 5 },
  { id: "tote", name: "에코백(예시)", price: 8000 },
  { id: "lamp", name: "무드등(예시)", price: 60000, stock: 1 },
  { id: "pen", name: "펜(예시)", price: 1500, stock: 3 },
]

/** 주문 id 순번은 파일 전체에서 이어진다 — 한 파일의 시험들이 DB 하나를 나눠 쓰므로 id 가 겹치면 안 된다 */
let seq = 0

export function makeDeps(d, over = {}) {
  const c = over.clock ?? clock()
  const gateway = over.gateway ?? mockGateway()
  const mailer = over.mailer ?? spyMailer()
  const errors = []
  const events = []
  const deps = {
    db: d,
    gateway,
    mailer,
    catalog: defineCatalog(CATALOG_ENTRIES),
    shipping: defineShipping({ fee: 3000, freeOver: 50000 }),
    productName: "예시 상점",
    ordersUrl: "https://shop.example.test/orders",
    locale: "ko",
    now: c.now,
    newId: () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
    track: (name, props) => events.push({ name, props }),
    onError: (e) => errors.push(e),
    ...over.deps,
  }
  return { deps, gateway, mailer, clock: c, errors, events }
}

/** 장바구니 줄을 DB 에 직접 넣는다(수량 검사 없이) */
export async function putCart(d, userId, lines) {
  const { cartItems } = await import("@launch-factory/db")
  await d.insert(cartItems).values(lines.map(([productId, quantity]) => ({ userId, productId, quantity })))
}

export async function stockOf(d, sku) {
  const r = await d.execute(sql`select quantity from stock_levels where sku = ${sku}`)
  return r.rows[0]?.quantity
}
