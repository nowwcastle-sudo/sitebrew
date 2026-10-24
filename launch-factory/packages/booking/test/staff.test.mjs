// 직원용 예약 목록·조회(계획 3d L2b) — 직원 벽, 상태 거르기, 접수 번호 찾기, 페이지 넘기기, 예약금 칸. PGlite.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { db, hitRateLimit } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { BOOKING_RATE_RULES, createBookingService, fakeDeposit } from "../src/index.ts"
import { sampleConfig } from "./fixtures.mjs"

let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

const now = () => new Date("2026-11-01T00:00:00.000Z")
const deposit = fakeDeposit()
const svc = () =>
  createBookingService({
    db: d,
    mailer: createMailer({ mode: "mock", log: () => {} }),
    limiter: createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now, rules: BOOKING_RATE_RULES }),
    turnstile: createTurnstile({ mode: "mock" }),
    config: sampleConfig({ horizonDays: 200, services: [{ id: "cut", name: { ko: "커트", en: "Haircut" }, durationMin: 60, capacity: 5, partyMax: 3, deposit: 10_000 }, { id: "color", name: { ko: "염색", en: "Color" }, durationMin: 60, capacity: 5, partyMax: 3 }] }),
    owner: { email: "owner@shop.test" },
    productName: "Salon",
    now,
    deposit,
    onError: () => {},
  })
const STAFF = { userId: "u-staff", role: "admin" }
const OWNER = { userId: "u-owner", isOwner: true }
let ip = 0
const book = (s, service, day, contact) => s.submit({ service, startsAt: `2026-11-${day}T10:00:00+09:00`, contact, name: "Jamie", note: "window seat" }, { ip: `198.51.100.${++ip}` })

test("직원 벽 — 직원이 아니면 목록·조회 모두 forbidden, 시스템 작업도 사람이 아니라 막힌다", async () => {
  const s = svc()
  for (const who of [{ userId: "plain" }, { userId: "plain", role: "user" }, { system: true }]) {
    assert.equal((await s.listForStaff(who)).code, "forbidden")
    assert.equal((await s.getForStaff(who, "B-AAAAAAAA")).code, "forbidden")
  }
  assert.equal((await s.listForStaff(STAFF)).ok, true)
  assert.equal((await s.listForStaff(OWNER)).ok, true)
})

test("목록 — 시작 늦은 순·전체 건수·거르기·접수 번호 찾기·페이지 넘기기·예약금 칸", async () => {
  const s = svc()
  const a = await book(s, "color", "03", "a@example.com")
  const b = await book(s, "cut", "04", "b@example.com") // 예약금 → 결제 대기
  const c = await book(s, "color", "05", "c@example.com")
  assert.ok(a.ok && b.ok && c.ok)
  await s.cancelAs(c.data.id, STAFF)

  const all = await s.listForStaff(STAFF)
  assert.equal(all.ok, true)
  assert.deepEqual(all.data.rows.map((r) => r.reference), [c.data.id, b.data.id, a.data.id], "시작이 늦은 것부터")
  assert.equal(all.data.total, 3)
  const row = all.data.rows[1]
  assert.deepEqual([row.serviceName, row.status, row.depositStatus, row.depositAmount, row.contact, row.note], ["커트", "requested", "pending", 10_000, "b@example.com", "window seat"])
  assert.equal(all.data.rows[2].depositStatus, "none")

  assert.deepEqual((await s.listForStaff(STAFF, { status: "cancelled" })).data.rows.map((r) => r.reference), [c.data.id])
  assert.equal((await s.listForStaff(STAFF, { status: "confirmed" })).data.total, 1)

  // 접수 번호 일부(소문자·띄어쓰기 허용)로 찾는다
  const part = a.data.id.slice(2, 7).toLowerCase()
  const found = await s.listForStaff(STAFF, { reference: ` ${part} ` })
  assert.deepEqual(found.data.rows.map((r) => r.reference), [a.data.id])
  assert.equal((await s.listForStaff(STAFF, { reference: "%" })).data.total, 0, "% 는 글자 그대로 찾는다 — 전부 찾지 않는다")

  // 검색 칸(search)은 접수 번호 외에 연락처·이름 일부도 찾는다 — 표의 연락처는 가려서 나가므로 서버가 맞춰야 이메일로 찾을 수 있다
  assert.deepEqual((await s.listForStaff(STAFF, { search: " B@Example.com " })).data.rows.map((r) => r.reference), [b.data.id], "이메일 전체(대소문자·앞뒤 공백 무시)")
  assert.deepEqual((await s.listForStaff(STAFF, { search: "@example" })).data.rows.map((r) => r.reference), [c.data.id, b.data.id, a.data.id], "연락처 일부")
  assert.equal((await s.listForStaff(STAFF, { search: "jamie" })).data.total, 3, "이름 일부(대소문자 무시)")
  assert.deepEqual((await s.listForStaff(STAFF, { search: part })).data.rows.map((r) => r.reference), [a.data.id], "접수 번호 일부도 같은 칸으로")
  assert.deepEqual((await s.listForStaff(STAFF, { search: "example", status: "cancelled" })).data.rows.map((r) => r.reference), [c.data.id], "상태 거르기와 함께")
  assert.equal((await s.listForStaff(STAFF, { search: "%" })).data.total, 0, "검색 칸의 % 도 글자 그대로")

  const page1 = await s.listForStaff(STAFF, { limit: 2 })
  const page2 = await s.listForStaff(STAFF, { limit: 2, offset: 2 })
  assert.deepEqual([page1.data.rows.length, page1.data.total, page2.data.rows.length, page2.data.total], [2, 3, 1, 3])
  assert.equal(page2.data.rows[0].reference, a.data.id)
})

test("입력 검사 — 모르는 상태·범위 밖 limit·offset 은 invalid_input", async () => {
  const s = svc()
  for (const q of [{ status: "weird" }, { limit: 0 }, { limit: 201 }, { limit: 1.5 }, { offset: -1 }]) assert.equal((await s.listForStaff(STAFF, q)).code, "invalid_input", JSON.stringify(q))
})

test("조회 — 접수 번호만으로 한 건, 없는 번호·모양이 틀린 번호는 not_found", async () => {
  const s = svc()
  const r = await book(s, "color", "06", "d@example.com")
  const got = await s.getForStaff(STAFF, r.data.id.toLowerCase())
  assert.equal(got.ok, true)
  assert.deepEqual([got.data.reference, got.data.contact, got.data.name, got.data.partySize], [r.data.id, "d@example.com", "Jamie", 1])
  assert.equal((await s.getForStaff(STAFF, "B-ZZZZZZZZ")).code, "not_found")
  assert.equal((await s.getForStaff(STAFF, "nope")).code, "not_found")
})
