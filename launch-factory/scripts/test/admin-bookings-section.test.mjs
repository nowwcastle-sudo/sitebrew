// 관리 화면 구획 「예약」(계획 3d L2b) — 진짜 콘솔 조립(feature-admin-console) + 진짜 구획(feature-booking) + 진짜 예약 서비스(PGlite, 가짜 결제 훅).
// 세션·설정·DB 핸들만 대역이다. 예전 서버 액션(app/actions/booking-admin.ts)이 하던 일 — 대표·관리자만 확정, 대신 취소 — 을 콘솔 포트(adminAct) 경유로 같게 지킨다.
// 지키는 것: 접근 벽(로그아웃 · 일반 사용자 · 메일 미확인 · 2단계 없음 · 정지 · 대리 세션 · 입력의 role 무시) · 소유자/관리자 입장 · 확인 입력 벽(취소) ·
// 목록(연락처 가림 · 예약금 열 · 거르기 · 접수 번호 찾기) → 상세(전체 값) → 확정 → 취소 한 바퀴 · 상태 불가(invalid_state) · 환불 실패는 거절이고 취소하지 않는다 · 기록.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { eq } from "drizzle-orm"
import { createBookingService, fakeDeposit, BOOKING_RATE_RULES } from "@launch-factory/booking"
import { accessLogs, adminActions, bookings, db, hitRateLimit, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort"],
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  env: ["env", "required"],
  enabled: ["hasPart"],
  security: ["guardAction"],
  booking: ["booking", "bookingOwnerEmail"],
  "@/content/copy.admin-messages.en": ["adminMessages"],
})

const at = new Date("2026-10-22T00:00:00.000Z")
const OWNER_EMAIL = "owner@shop.test"
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
let actions
let svc
let deposit
let failRefund = false
const setSession = (userId, extra = {}) => (session = userId ? { userId, impersonatedBy: null, ...extra } : null)

/** 시험 날짜: 지금부터 사흘 뒤 이후의 평일(서울 10:00) — 영업시간·예약 가능 기간 안, 실제 시계가 가도 늘 미래 */
const days = []
for (let i = 3; days.length < 12; i++) {
  const day = new Date(Date.now() + i * 86_400_000)
  if (day.getUTCDay() >= 1 && day.getUTCDay() <= 5) days.push(day.toISOString().slice(0, 10))
}
let dayIdx = 0
let ipSeq = 0
const contactOf = (n) => `guest${n}@example.com`

before(async () => {
  d = await db.local()
  const rows = [
    ["plain", null, false, true],
    ["owner", null, false, true, OWNER_EMAIL],
    ["owner-unverified", null, false, false, "Owner@Shop.Test"],
    ["root", "admin", true, true],
    ["admin-no2fa", "admin", false, true],
    ["banned-admin", "admin", true, true, null, true],
  ]
  for (const [id, role, two, verified, email, banned = false] of rows) await d.insert(userTable).values({ id, name: id, email: email ?? `${id}@example.com`, emailVerified: verified, role, twoFactorEnabled: two, banned, createdAt: at, updatedAt: at })
  deposit = fakeDeposit({ failRefund: () => failRefund })
  svc = createBookingService({
    db: d,
    mailer: createMailer({ mode: "mock", log: () => {} }),
    limiter: createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, rules: BOOKING_RATE_RULES }),
    turnstile: createTurnstile({ mode: "mock" }),
    config: {
      timeZone: "Asia/Seoul",
      mode: "request",
      services: [
        { id: "cut", name: { ko: "커트", en: "Haircut" }, durationMin: 60, capacity: 20, partyMax: 3 },
        { id: "vip", name: { ko: "우선 상담", en: "Priority" }, durationMin: 60, capacity: 20, partyMax: 3, deposit: 10_000 },
      ],
      weekly: { mon: [["10:00", "18:00"]], tue: [["10:00", "18:00"]], wed: [["10:00", "18:00"]], thu: [["10:00", "18:00"]], fri: [["10:00", "18:00"]] },
      closedDates: [],
      slotStepMin: 30,
      leadMinutes: 120,
      horizonDays: 60,
      cancelBeforeMinutes: 120,
      reminderBeforeMinutes: 0,
      retainDays: 365,
    },
    owner: { email: OWNER_EMAIL },
    productName: "Salon",
    deposit,
    onError: () => {},
  })
  process.env.LF_CLIENT_IP_HEADER = "x-test-ip"
  stubs.config = { PRODUCT_NAME: "Example", DEFAULT_LOCALE: "en", appUrl: () => "https://shop.example.test" }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "mock" }), required: (n) => `x-${n}` }
  stubs.enabled = { hasPart: (p) => p === "booking" }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs["next/headers"] = { headers: async () => new Headers({ "x-test-ip": "203.0.113.90" }) }
  stubs["@/content/copy.admin-messages.en"] = { adminMessages: MESSAGES }
  stubs.booking = { booking: async () => svc, bookingOwnerEmail: () => OWNER_EMAIL }
  const security = await importRegistryFile("feature-security/files/lib/launch/security.ts")
  stubs.security = { guardAction: (...a) => security.guardAction(...a) }
  const consoleMod = await importRegistryFile("feature-admin-console/files/lib/launch/admin-console.ts")
  const section = (await importRegistryFile("feature-booking/files/lib/launch/admin-sections/bookings.ts")).default
  consoleMod.ADMIN_SECTIONS.push(section)
  actions = await importRegistryFile("feature-admin-console/files/app/actions/admin-console.ts")
})
after(async () => {
  await d?.$client.close()
})

const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data
}
/** 예약 하나를 접수한다(요청 모드라 대표 확정을 기다린다) */
async function book(service = "cut", extra = {}) {
  const n = ++ipSeq
  const r = await svc.submit({ service, startsAt: `${days[dayIdx++ % days.length]}T10:00:00+09:00`, contact: contactOf(n), name: `Guest ${n}`, note: "window seat please", ...extra }, { ip: `198.51.100.${(n % 250) + 1}` })
  assert.equal(r.ok, true, JSON.stringify(r))
  return { id: r.data.id, contact: contactOf(n), n }
}
const rowOf = async (reference) => (await d.select().from(bookings).where(eq(bookings.reference, reference)))[0]

test("접근 벽 — 로그아웃 · 일반 사용자 · 메일 미확인 소유자 · 2단계 없는 관리자 · 정지 · 대리 세션은 예약 구획을 열지 못하고 서비스에 닿지 않는다", async () => {
  const b = await book()
  const cases = [
    [null, "sign_in_required"],
    ["plain", "forbidden"],
    ["owner-unverified", "forbidden"],
    ["admin-no2fa", "two_factor_required"],
    ["banned-admin", "forbidden"],
  ]
  for (const [who, code] of cases) {
    setSession(who)
    for (const call of [() => actions.adminTable({ section: "bookings" }), () => actions.adminRecord({ section: "bookings", id: b.id }), () => actions.adminAct({ section: "bookings", id: b.id, action: "confirm" }), () => actions.adminAct({ section: "bookings", id: b.id, action: "cancel", confirmed: true })]) {
      const r = await call()
      assert.equal(r.ok, false, `${who}`)
      assert.equal(r.code, code, `${who}`)
    }
    if (who === "plain") assert.deepEqual(ok(await actions.adminSections()), [], "권한이 없으면 구획 목록도 비어 있다")
  }
  setSession("root", { impersonatedBy: "someone" })
  assert.equal((await actions.adminAct({ section: "bookings", id: b.id, action: "confirm" })).code, "impersonation_blocked")
  assert.equal((await rowOf(b.id)).status, "requested", "벽에 막힌 요청은 예약을 바꾸지 않는다")
})

test("입력의 role·isOwner·userId 는 읽지 않는다 — 일반 사용자가 실어도 막힌다", async () => {
  const b = await book()
  setSession("plain")
  const r = await actions.adminAct({ section: "bookings", id: b.id, action: "confirm", role: "admin", isOwner: true, userId: "root", via: "admin" })
  assert.deepEqual([r.ok, r.code], [false, "forbidden"])
  assert.equal((await rowOf(b.id)).status, "requested")
})

test("운영자(확인된 소유자 이메일)과 2단계를 켠 관리자는 들어온다 — 구획 목록에 보인다", async () => {
  for (const who of ["owner", "root"]) {
    setSession(who)
    assert.deepEqual(ok(await actions.adminSections()), [{ id: "bookings", label: "Bookings", href: "/admin/bookings" }], who)
    assert.equal((await actions.adminTable({ section: "bookings" })).ok, true, who)
  }
})

test("한 바퀴 — 표(연락처 가림 · 예약금 열 · 거르기 · 접수 번호 찾기) → 기록(전체 값) → 확정 → 두 번 눌러도 한 번 → 취소(확인 필요)", async () => {
  const a = await book("cut")
  const v = await book("vip") // 예약금 → 결제 대기
  setSession("owner")

  const table = ok(await actions.adminTable({ section: "bookings" }))
  assert.deepEqual(table.columns.map((c) => c.id), ["reference", "startsAt", "service", "status", "depositStatus", "depositAmount", "contact"])
  const rowA = table.rows.find((r) => r.id === a.id)
  assert.equal(rowA.href, `/admin/bookings/${a.id}`)
  assert.deepEqual([rowA.cells.service, rowA.cells.status, rowA.cells.depositStatus, rowA.cells.depositAmount], ["커트", "requested", null, null])
  assert.equal(rowA.cells.contact, `g***@example.com`, "연락처 열은 콘솔이 가린다")
  assert.doesNotMatch(JSON.stringify(table), new RegExp(a.contact.replace(".", "\\.")), "표에 연락처 전체는 없다")
  const rowV = table.rows.find((r) => r.id === v.id)
  assert.deepEqual([rowV.cells.depositStatus, rowV.cells.depositAmount], ["pending", 10_000])
  assert.ok(table.rows.length >= 2 && table.total >= 2)

  assert.ok(ok(await actions.adminTable({ section: "bookings", status: "confirmed" })).rows.every((r) => r.cells.status === "confirmed"))
  assert.equal((await actions.adminTable({ section: "bookings", status: "weird" })).code, "invalid_input")
  const found = ok(await actions.adminTable({ section: "bookings", search: a.id.slice(2).toLowerCase() }))
  assert.deepEqual(found.rows.map((r) => r.id), [a.id], "접수 번호로 찾는다(소문자도)")

  // 기록: 전체 값이 보이고, 지금 할 수 있는 행동만 단추가 된다
  const rec = ok(await actions.adminRecord({ section: "bookings", id: a.id }))
  assert.equal(rec.title, `Booking ${a.id}`)
  const summary = Object.fromEntries(rec.summary.map((s) => [s.label, s.value]))
  assert.deepEqual([summary.Email, summary.Name, summary["Note from the guest"], summary.Service], [a.contact, `Guest ${a.n}`, "window seat please", "커트"])
  assert.deepEqual(rec.fields, [], "직원 메모 칸은 도메인에 없어 편집 폼도 없다")
  assert.equal(rec.save, undefined)
  assert.deepEqual(rec.actions.map((x) => x.id), ["confirm"])
  assert.deepEqual(rec.danger, { id: "cancel", label: "Cancel booking" })
  const recV = ok(await actions.adminRecord({ section: "bookings", id: v.id }))
  assert.deepEqual(recV.actions, [], "결제를 기다리는 예약은 확정 단추가 없다")
  assert.equal(recV.summary.find((s) => s.label === "Deposit amount").value, "10,000 KRW")

  // 확정
  const done = await actions.adminAct({ section: "bookings", id: a.id, action: "confirm" })
  assert.equal(done.ok, true, JSON.stringify(done))
  assert.equal((await rowOf(a.id)).status, "confirmed")
  assert.equal((await actions.adminAct({ section: "bookings", id: a.id, action: "confirm" })).code, "invalid_state", "두 번 눌러도 한 번(상태 검사)")
  assert.equal((await actions.adminAct({ section: "bookings", id: v.id, action: "confirm" })).code, "invalid_state", "결제 대기 예약은 확정할 수 없다")
  assert.equal((await actions.adminAct({ section: "bookings", id: "B-ZZZZZZZZ", action: "confirm" })).code, "not_found")

  // 취소: 확인 입력 없이는 실행하지 않는다
  for (const confirmed of [undefined, false, "true", 1]) {
    const r = await actions.adminAct({ section: "bookings", id: a.id, action: "cancel", ...(confirmed === undefined ? {} : { confirmed }) })
    assert.equal(r.ok, false, String(confirmed))
    assert.ok(["confirmation_required", "invalid_input"].includes(r.code), String(confirmed))
  }
  assert.equal((await rowOf(a.id)).status, "confirmed")
  const cancelled = await actions.adminAct({ section: "bookings", id: a.id, action: "cancel", confirmed: true })
  assert.equal(cancelled.ok, true, JSON.stringify(cancelled))
  const after = await rowOf(a.id)
  assert.deepEqual([after.status, after.cancelledBy], ["cancelled", "owner"])
  assert.equal((await actions.adminAct({ section: "bookings", id: a.id, action: "cancel", confirmed: true })).code, "invalid_state", "취소된 예약은 다시 취소하지 않는다")
  assert.deepEqual(ok(await actions.adminRecord({ section: "bookings", id: a.id })).actions, [])

  // 결제 대기 예약은 닫기만 한다(환불할 돈이 없다)
  assert.equal((await actions.adminAct({ section: "bookings", id: v.id, action: "cancel", confirmed: true })).ok, true)
  assert.deepEqual([(await rowOf(v.id)).status, (await rowOf(v.id)).depositStatus], ["cancelled", "voided"])

  // 기록: 읽기는 접속 기록, 행동은 행동 기록(연락처·메모 없이)
  const access = await d.select().from(accessLogs)
  assert.ok(access.some((r) => r.actorId === "owner" && r.target === "admin/bookings/table"))
  assert.ok(access.some((r) => r.target === "admin/bookings/record" && r.subjects.join() === a.id))
  const logged = (await d.select().from(adminActions)).filter((r) => r.adminUserId === "owner")
  assert.ok(logged.some((r) => r.action === "bookings.confirm" && r.meta.ok === true && r.meta.recordId === a.id))
  assert.ok(logged.some((r) => r.action === "bookings.cancel" && r.meta.via === "owner"))
  assert.doesNotMatch(JSON.stringify(logged), /example\.com|window seat/, "행동 기록에 연락처·메모는 없다")
})

test("관리자(2단계)도 확정·취소한다 — via admin", async () => {
  const b = await book()
  setSession("root")
  assert.equal((await actions.adminAct({ section: "bookings", id: b.id, action: "confirm" })).ok, true)
  assert.equal((await actions.adminAct({ section: "bookings", id: b.id, action: "cancel", confirmed: true })).ok, true)
  assert.equal((await rowOf(b.id)).cancelledBy, "owner", "직원이 한 취소는 owner 로 남는다")
  const logged = (await d.select().from(adminActions)).filter((r) => r.adminUserId === "root")
  assert.ok(logged.some((r) => r.action === "bookings.cancel" && r.meta.via === "admin"))
})

test("결제된 예약금 — 환불이 실패하면 거절이고 예약은 취소되지 않는다, 다시 하면 환불하고 취소된다", async () => {
  const v = await book("vip")
  const row = await rowOf(v.id)
  deposit.markPaid(row.depositRef)
  assert.equal((await svc.confirmDeposit({ paymentId: row.depositRef }, { ip: "198.51.100.200" })).ok, true)
  setSession("owner")
  const rec = ok(await actions.adminRecord({ section: "bookings", id: v.id }))
  assert.equal(rec.summary.find((s) => s.label === "Deposit").value, "paid")

  failRefund = true
  const refused = await actions.adminAct({ section: "bookings", id: v.id, action: "cancel", confirmed: true })
  assert.deepEqual([refused.ok, refused.code], [false, "deposit_failed"])
  assert.ok(refused.formError, "서비스의 안내 문구가 나간다")
  const kept = await rowOf(v.id)
  assert.deepEqual([kept.status === "cancelled", kept.depositStatus], [false, "paid"], "취소하지 않았고 결제 끝 상태로 되돌렸다")
  const failedLog = (await d.select().from(adminActions)).filter((r) => r.action === "bookings.cancel" && r.meta.recordId === v.id)
  assert.deepEqual(failedLog.map((r) => [r.meta.ok, r.meta.code]), [[false, "deposit_failed"]])

  failRefund = false
  const done = await actions.adminAct({ section: "bookings", id: v.id, action: "cancel", confirmed: true })
  assert.equal(done.ok, true, JSON.stringify(done))
  const closed = await rowOf(v.id)
  assert.deepEqual([closed.status, closed.depositStatus, closed.depositRefundedAmount], ["cancelled", "refunded", 10_000])
})

test("개요 — 운영자 확인을 기다리는 예약만 센다(결제 대기·지난 요청은 제외)", async () => {
  await book("cut")
  await book("vip")
  setSession("owner")
  const overview = ok(await actions.adminOverview())
  const todo = overview.todo.find((t) => t.id === "confirm")
  assert.ok(todo && todo.count >= 1)
  assert.equal(todo.href, "/admin/bookings?status=requested")
  const waiting = (await d.select().from(bookings)).filter((b) => b.status === "requested" && b.depositStatus !== "pending" && b.startsAt > new Date()).length
  assert.equal(todo.count, waiting)
})
