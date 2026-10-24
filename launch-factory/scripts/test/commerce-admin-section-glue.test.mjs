// 관리 화면 구획 「주문」·「재고」(계획 3d L2a) — 진짜 서버 액션(app/actions/admin-console.ts) → 진짜 콘솔 조립(admin-console.ts · admin-identity.ts) → 진짜 구획(admin-sections/orders.ts · stock.ts)
// → 진짜 상점 서비스(PGlite). 예전 관리자 서버 액션(commerce-admin.ts)이 지키던 것을 콘솔 포트 경유로 옮긴 시험이다. 세션·설정·DB 핸들·메일만 대역. 모드는 mock(모의 결제).
// 지키는 것: 접근 벽(로그아웃 · 일반 사용자 · 2단계 없음 · 정지 · 대리 세션 · 입력의 role 무시) · 확인 입력 벽(주문 취소) · 목록→상세→송장 저장→앞걸음 한 바퀴 · 상태 불가(invalid_state) ·
// 연락처 가림(목록) · 재고 고치기 · 개요의 할 일 · 접속·행동 기록.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { eq, sql } from "drizzle-orm"
import { accessLogs, adminActions, db, orders, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort"],
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  enabled: ["hasPart"],
  env: ["env", "required"],
  mailer: ["mailer"],
  security: ["guardAction"],
  "@/content/copy.admin-messages.en": ["adminMessages"],
})

const at = new Date("2026-10-22T00:00:00.000Z")
const ADDRESS = { recipient: "김예시", phone: "010-0000-1234", postcode: "00000", address1: "예시시 예시로 1", address2: "101호", note: "문 앞에 놓아 주세요" }
const MESSAGES = {
  sign_in_required: "sign in",
  forbidden: "forbidden",
  two_factor_required: "two factor",
  impersonation_blocked: "impersonation",
  provider_unavailable: "unavailable",
  not_found: "not found",
  invalid_input: "invalid input",
  confirmation_required: "confirm first",
  invalid_state: "invalid state",
  action_failed: "failed",
}

let d
let session = null
let ip = "203.0.113.80"
let shop
let admin

const setSession = (userId, extra = {}) => (session = userId ? { userId, impersonatedBy: null, ...extra } : null)
const stockOf = async (sku) => (await d.execute(sql`select quantity from stock_levels where sku = ${sku}`)).rows[0]?.quantity
const statusOf = async (id) => (await d.select().from(orders).where(eq(orders.id, id)))[0]?.status
const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data
}

/** u1 이 상품을 담아 주문하고 모의 결제까지 마친 주문 id (pay=false 면 결제 대기) */
async function buy(productId, quantity, { pay = true } = {}) {
  const prev = session
  setSession("u1")
  ok(await shop.setCartLine({ productId, quantity }))
  const placed = ok(await shop.placeOrder({ address: ADDRESS, confirmed: true }))
  if (pay) ok(await shop.payWithMock({ orderId: placed.order.id }))
  session = prev
  return placed.order.id
}
const act = (id, action, extra = {}) => admin.adminAct({ section: "orders", id, action, ...extra })
const rec = async (id) => ok(await admin.adminRecord({ section: "orders", id }))

before(async () => {
  process.env.LF_CLIENT_IP_HEADER = "x-test-ip"
  d = await db.local()
  for (const [id, role, two] of [["u1", null, false], ["plain", null, false], ["root", "admin", true], ["root2", "admin", true], ["admin-no2fa", "admin", false], ["banned-admin", "admin", true]]) {
    await d.insert(userTable).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, role, twoFactorEnabled: two, banned: id === "banned-admin", createdAt: at, updatedAt: at })
  }
  const mock = createMailer({ mode: "mock", log: () => {} })
  stubs.config = { PRODUCT_NAME: "예시 상점", DEFAULT_LOCALE: "ko", appUrl: () => "https://shop.example.test" }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "mock" }), required: (n) => `x-${n}` }
  stubs.enabled = { hasPart: () => true }
  stubs.mailer = { mailer: () => mock }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs["next/headers"] = { headers: async () => new Headers({ "x-test-ip": ip }) }
  stubs["@/content/copy.admin-messages.en"] = { adminMessages: MESSAGES }
  const security = await importRegistryFile("feature-security/files/lib/launch/security.ts")
  stubs.security = { guardAction: (...a) => security.guardAction(...a) }
  shop = await importRegistryFile("feature-commerce/files/app/actions/commerce.ts")
  admin = await importRegistryFile("feature-admin-console/files/app/actions/admin-console.ts")
  // 구획은 시험이 콘솔 등록부에 밀어 넣는다(registry 의 등록부 사본은 비어 있다 — 템플릿 사본의 등록 줄은 다른 시험이 글자로 본다)
  const consoleMod = await importRegistryFile("feature-admin-console/files/lib/launch/admin-console.ts")
  for (const name of ["orders", "stock"]) consoleMod.ADMIN_SECTIONS.push((await importRegistryFile(`feature-commerce/files/lib/launch/admin-sections/${name}.ts`)).default)
})
after(async () => {
  await d?.$client.close()
})

test("접근 벽: 로그아웃 · 일반 사용자 · 2단계 없는 관리자 · 정지된 관리자 · 대리 세션은 두 구획 어디서도 읽고 쓰지 못한다", async () => {
  ip = "203.0.113.81"
  const id = await buy("example-notebook", 2)
  const before = await stockOf("example-notebook")
  const cases = [
    [null, "sign_in_required"],
    ["plain", "forbidden"],
    ["admin-no2fa", "two_factor_required"],
    ["banned-admin", "forbidden"],
    ["root", "impersonation_blocked"],
  ]
  for (const [who, code] of cases) {
    setSession(who, who === "root" ? { impersonatedBy: "someone" } : {})
    const calls = [
      () => admin.adminTable({ section: "orders" }),
      () => admin.adminRecord({ section: "orders", id }),
      () => act(id, "mark-preparing"),
      () => act(id, "cancel", { confirmed: true }),
      () => admin.adminTable({ section: "stock" }),
      () => admin.adminAct({ section: "stock", id: "example-mug", action: "save", fields: { quantity: "1" } }),
    ]
    for (const call of calls) {
      const r = await call()
      assert.equal(r.ok, false, `${who}`)
      assert.equal(r.code, code, `${who}`)
    }
  }
  assert.equal(await statusOf(id), "paid", "막힌 요청은 주문을 바꾸지 않았다")
  assert.equal(await stockOf("example-notebook"), before)
  assert.equal(await stockOf("example-mug"), undefined)
})

test("입력의 role·userId 는 읽지 않는다 — 일반 사용자가 role: admin 을 실어도 막힌다", async () => {
  ip = "203.0.113.82"
  const id = await buy("example-notebook", 1)
  setSession("plain")
  const r = await act(id, "cancel", { confirmed: true, role: "admin", userId: "root", via: "admin" })
  assert.deepEqual([r.ok, r.code], [false, "forbidden"])
  assert.equal(await statusOf(id), "paid")
})

test("한 바퀴: 목록(연락처 가림) → 상세(줄·배송지·송장) → 송장 저장 → 준비 → 배송(송장이 같이 간다) → 완료, 건너뛰기·되돌리기는 invalid_state", async () => {
  ip = "203.0.113.83"
  const id = await buy("example-tote", 1)
  const pending = await buy("example-tote", 1, { pay: false })
  setSession("root")

  const sections = ok(await admin.adminSections())
  assert.deepEqual(sections.map((s) => s.id).filter((s) => s === "orders" || s === "stock"), ["orders", "stock"])

  const table = ok(await admin.adminTable({ section: "orders" }))
  const row = table.rows.find((r) => r.id === id)
  assert.equal(row.href, `/admin/orders/${id}`)
  assert.equal(row.cells.id, id.slice(0, 8))
  assert.equal(row.cells.status, "paid")
  assert.equal(row.cells.total, 8000 + 3000)
  assert.equal(row.cells.recipient, "김***", "받는 분은 연락처 열이라 가려서 나간다")
  assert.doesNotMatch(JSON.stringify(table), /010-0000-1234|예시시/, "목록에는 전화·주소가 없다")
  // 앞선 시험이 만든 주문도 같은 DB 에 있다 — 이 시험의 주문이 걸러진 표 안에 있는지만 본다
  assert.ok(ok(await admin.adminTable({ section: "orders", status: "paid" })).rows.some((r) => r.id === id))
  const waiting = ok(await admin.adminTable({ section: "orders", status: "pending_payment" })).rows
  assert.ok(waiting.some((r) => r.id === pending) && waiting.every((r) => r.cells.status === "pending_payment"))
  assert.equal((await admin.adminTable({ section: "orders", status: "weird" })).code, "invalid_input")

  const r1 = await rec(id)
  assert.equal(r1.title, `Order ${id.slice(0, 8)}`)
  const line = (label) => r1.summary.find((s) => s.label === label)?.value
  assert.equal(line("Status"), "paid")
  assert.equal(line("에코백(예시)"), "1 × ₩8,000")
  assert.equal(line("Total"), "₩11,000")
  assert.equal(line("Phone"), "010-0000-1234", "배송에 쓰는 상세는 전체 값이다(읽기는 접속 기록에 남는다)")
  assert.equal(line("Address"), "00000 예시시 예시로 1 101호")
  assert.deepEqual(r1.fields.map((f) => [f.name, f.value, f.required]), [["trackingNumber", "", true]])
  assert.equal(r1.save, "save")
  assert.deepEqual(r1.actions.map((a) => a.id), ["mark-preparing"], "지금 할 수 있는 한 칸만 단추로 나간다")
  assert.deepEqual(r1.danger, { id: "cancel", label: "Cancel order" })

  assert.equal((await act(id, "mark-shipped")).code, "invalid_state", "건너뛰지 못한다")
  assert.equal((await act(id, "mark-delivered")).code, "invalid_state")
  assert.equal((await act(id, "save", { fields: { trackingNumber: "   " } })).code, "invalid_input", "빈 송장 번호")
  assert.equal((await act(id, "save", { fields: { trackingNumber: "x".repeat(101) } })).ok, false)
  assert.equal((await act(id, "save", { fields: { status: "shipped" } })).code, "invalid_input", "선언하지 않은 칸은 받지 않는다")
  ok(await act(id, "save", { fields: { trackingNumber: "TRACK-0001" } }))
  assert.equal((await rec(id)).fields[0].value, "TRACK-0001")
  assert.equal(await statusOf(id), "paid", "송장 저장은 상태를 바꾸지 않는다")

  ok(await act(id, "mark-preparing"))
  assert.equal((await act(id, "mark-preparing")).code, "invalid_state", "두 번 눌러도 한 번")
  ok(await act(id, "save", { fields: { trackingNumber: "TRACK-0002" } }))
  ok(await act(id, "mark-shipped"))
  const shipped = await rec(id)
  assert.equal(shipped.summary.find((s) => s.label === "Tracking number").value, "TRACK-0002", "저장해 둔 송장 번호가 배송에 그대로 간다")
  assert.deepEqual(shipped.fields, [], "배송이 시작되면 송장 칸은 없다")
  assert.deepEqual(shipped.actions.map((a) => a.id), ["mark-delivered"])
  assert.equal(shipped.danger, undefined, "배송 중 주문은 취소할 수 없다 — 단추도 없다")
  assert.equal((await act(id, "save", { fields: { trackingNumber: "CHANGED" } })).code, "invalid_input")
  assert.equal((await act(id, "save")).ok, false, "칸 없는 저장도 송장을 바꾸지 못한다")
  assert.equal((await act(id, "cancel", { confirmed: true })).code, "invalid_state")
  assert.equal((await rec(id)).summary.find((s) => s.label === "Tracking number").value, "TRACK-0002")

  ok(await act(id, "mark-delivered"))
  const done = await rec(id)
  assert.deepEqual([done.actions, done.fields, done.danger], [[], [], undefined])
  assert.equal(await statusOf(id), "delivered")
  assert.equal((await act(id, "mark-delivered")).code, "invalid_state")
  assert.equal((await act("no-such-order", "mark-preparing")).code, "not_found")
  assert.equal((await act("00000000-0000-4000-8000-000000000000", "mark-preparing")).code, "not_found")
  ok(await act(pending, "cancel", { confirmed: true })) // 뒤 시험이 깨끗하게 시작하도록 정리
})

test("확인 입력 벽: 주문 취소는 confirmed: true 가 정확히 true 일 때만 — 결제된 주문은 환불·재고 복구, 결제 대기는 취소·재고 복구", async () => {
  ip = "203.0.113.84"
  const paid = await buy("example-notebook", 4)
  const waiting = await buy("example-notebook", 2, { pay: false })
  const held = await stockOf("example-notebook")
  setSession("root")
  for (const confirmed of [undefined, false, "true", 1]) {
    const r = await act(paid, "cancel", confirmed === undefined ? {} : { confirmed })
    assert.equal(r.ok, false, String(confirmed))
    assert.ok(["confirmation_required", "invalid_input"].includes(r.code), String(confirmed))
  }
  assert.equal(await statusOf(paid), "paid", "확인 없이는 환불도 취소도 없다")
  assert.equal(await stockOf("example-notebook"), held)

  const refunded = ok(await act(paid, "cancel", { confirmed: true }))
  assert.equal(refunded.message, "Order canceled and refunded.")
  assert.equal(await statusOf(paid), "refunded")
  assert.equal(await stockOf("example-notebook"), held + 4, "환불하면 재고가 돌아온다")
  const canceled = ok(await act(waiting, "cancel", { confirmed: true }))
  assert.equal(canceled.message, "Order canceled.")
  assert.equal(await statusOf(waiting), "canceled")
  assert.equal(await stockOf("example-notebook"), held + 6)
  assert.equal((await act(paid, "cancel", { confirmed: true })).code, "invalid_state", "끝난 주문은 다시 취소하지 않는다")
  assert.equal(await stockOf("example-notebook"), held + 6, "두 번 눌러도 재고는 한 번만 돌아온다")
})

test("재고 구획: 재고 제한이 있는 상품만, 남은 수는 DB 가 정본, 폼 저장으로 정하고 잘못된 수는 거절한다", async () => {
  ip = "203.0.113.85"
  setSession("root2")
  const table = ok(await admin.adminTable({ section: "stock" }))
  assert.deepEqual(table.rows.map((r) => r.id).sort(), ["example-mug", "example-notebook"], "재고 제한이 없는 에코백은 없다")
  const mug = table.rows.find((r) => r.id === "example-mug")
  assert.equal(mug.cells.quantity, 20, "한 번도 팔리지 않았으면 상품표의 수")
  assert.equal(table.rows.find((r) => r.id === "example-notebook").cells.quantity, await stockOf("example-notebook"), "팔린 상품은 DB 의 수")
  assert.deepEqual(ok(await admin.adminTable({ section: "stock", search: "머그" })).rows.map((r) => r.id), ["example-mug"])
  assert.equal((await admin.adminRecord({ section: "stock", id: "example-tote" })).code, "not_found")
  assert.equal((await admin.adminRecord({ section: "stock", id: "ghost" })).code, "not_found")

  const record = ok(await admin.adminRecord({ section: "stock", id: "example-mug" }))
  assert.deepEqual(record.fields.map((f) => [f.name, f.type, f.value]), [["quantity", "number", "20"]])
  assert.deepEqual(record.actions, [])
  const save = (id, quantity) => admin.adminAct({ section: "stock", id, action: "save", fields: { quantity } })
  ok(await save("example-mug", "7"))
  assert.equal(await stockOf("example-mug"), 7)
  assert.equal(ok(await admin.adminRecord({ section: "stock", id: "example-mug" })).fields[0].value, "7")
  ok(await save("example-mug", "0"))
  assert.equal(await stockOf("example-mug"), 0)
  for (const bad of ["-1", "1.5", "abc", "", "  ", "1000001", "99999999"]) {
    const r = await save("example-mug", bad)
    assert.equal(r.ok, false, bad)
    assert.ok(["invalid_input"].includes(r.code), bad)
  }
  assert.equal(await stockOf("example-mug"), 0, "잘못된 수는 재고를 바꾸지 않았다")
  assert.equal((await save("example-tote", "3")).code, "not_found", "재고 제한이 없는 상품에는 재고 수가 없다")
  assert.equal((await save("ghost", "3")).code, "not_found")
  assert.equal(await stockOf("example-tote"), undefined)
})

test("개요: 준비할 주문과 품절 상품이 할 일로 나가고, 일이 없으면 그 줄은 없다", async () => {
  ip = "203.0.113.86"
  setSession("root")
  const id = await buy("example-notebook", 1)
  const todo = ok(await admin.adminOverview()).todo
  const paid = todo.find((t) => t.id === "orders-paid")
  assert.deepEqual([paid.count >= 1, paid.href], [true, "/admin/orders?status=paid"])
  assert.deepEqual(todo.find((t) => t.id === "stock-out"), { id: "stock-out", severity: "critical", title: "Products out of stock", href: "/admin/stock", count: 1 }, "머그컵 재고를 0 으로 정해 둔 상태")
  ok(await act(id, "mark-preparing"))
  const after = ok(await admin.adminOverview()).todo
  assert.ok(after.find((t) => t.id === "orders-preparing").count >= 1)
  ok(await admin.adminAct({ section: "stock", id: "example-mug", action: "save", fields: { quantity: "5" } }))
  assert.equal(ok(await admin.adminOverview()).todo.find((t) => t.id === "stock-out"), undefined)
})

test("기록: 읽기는 접속 기록, 행동은 행동 기록(구획.행동) — 송장 번호 같은 폼 값은 남기지 않는다", async () => {
  const access = await d.select().from(accessLogs)
  assert.ok(access.some((r) => r.actorId === "root" && r.target === "admin/orders/table"))
  assert.ok(access.some((r) => r.actorId === "root" && r.target === "admin/orders/record" && r.subjects.length === 1))
  assert.ok(access.some((r) => r.actorId === "root2" && r.target === "admin/stock/table"))
  const done = (await d.select().from(adminActions)).filter((r) => r.adminUserId === "root" || r.adminUserId === "root2")
  const names = new Set(done.map((r) => r.action))
  for (const n of ["orders.mark-preparing", "orders.mark-shipped", "orders.mark-delivered", "orders.cancel", "orders.save", "stock.save"]) assert.ok(names.has(n), n)
  assert.doesNotMatch(JSON.stringify(done), /TRACK-000|김예시|010-0000/, "행동 기록에 폼 값·개인정보는 없다")
  assert.ok(access.every((r) => r.actorId !== "plain" && r.actorId !== "admin-no2fa" && r.actorId !== "banned-admin"), "벽에 막힌 사람은 접속 기록도 없다")
})
