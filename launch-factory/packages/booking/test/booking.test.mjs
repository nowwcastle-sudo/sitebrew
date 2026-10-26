// 예약 서비스 — PGlite 메모리 DB 하나를 모든 시험이 나눠 쓴다. 시계·메일·봇 확인은 가짜다.
// 시험마다 다른 날짜(평일 한 칸)를 쓰므로 서로의 자리를 차지하지 않는다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { bookings, db, hitRateLimit } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { t } from "@launch-factory/i18n"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { BOOKING_RATE_RULES, createBookingService } from "../src/index.ts"
import { sampleConfig } from "./fixtures.mjs"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

const store = () => ({ hit: (k, w, n) => hitRateLimit(d, k, w, n) })
const clock = (iso) => {
  const c = { at: new Date(iso) }
  c.now = () => c.at
  c.tick = (ms) => (c.at = new Date(c.at.getTime() + ms))
  return c
}
let ipSeq = 0
const freshIp = () => `203.0.113.${(++ipSeq % 250) + 1}`
let contactSeq = 0
const freshEmail = () => `guest${++contactSeq}@example.com`
const OWNER = { email: "owner@shop.test" }

// 평일 날짜를 하나씩 꺼낸다(시험끼리 같은 칸을 쓰지 않게). 2026-11-02 는 월요일.
const WEEKDAYS = []
for (let i = 0; WEEKDAYS.length < 90; i++) {
  const at = new Date(Date.UTC(2026, 10, 2 + i))
  if (at.getUTCDay() >= 1 && at.getUTCDay() <= 5 && at.toISOString().slice(0, 10) !== "2026-12-25") WEEKDAYS.push(at.toISOString().slice(0, 10))
}
let dayIdx = 0
/** 새 평일의 hh:mm(서울) 시작 시각 ISO */
const freshStart = (hhmm = "10:00") => `${WEEKDAYS[dayIdx++]}T${hhmm}:00+09:00`

function setup({ config = {}, now = clock("2026-11-01T00:00:00.000Z"), mailer, ...rest } = {}) {
  const lines = []
  const mock = createMailer({ mode: "mock", log: (l) => lines.push(l) })
  const requests = []
  const wrapped = mailer ?? { mode: mock.mode, send: (req) => (requests.push(req), mock.send(req)) }
  const errors = []
  const svc = createBookingService({
    db: d,
    mailer: wrapped,
    limiter: createRateLimiter({ store: store(), now: now.now, rules: BOOKING_RATE_RULES }),
    turnstile: createTurnstile({ mode: "mock" }),
    config: sampleConfig({ horizonDays: 200, ...config }),
    owner: OWNER,
    productName: "Salon",
    manageUrl: "https://salon.test/booking",
    now: now.now,
    onError: (e) => errors.push(e.message),
    ...rest,
  })
  const sent = (template) => requests.filter((r) => r.template === template)
  return { svc, now, requests, sent, errors }
}
const form = (extra = {}) => ({ service: "cut", startsAt: freshStart(), contact: freshEmail(), name: "Jamie", ...extra })
const rowOf = async (reference) => (await d.select().from(bookings).where(eq(bookings.reference, reference)))[0]
const ownerActor = { userId: "u-owner", isOwner: true }

// ── 접수 ────────────────────────────────────────────────────────────────────────

test("바로 확정(instant): 저장 · 확정 문구 · 대표 알림 한 통 + 손님 확인 메일 한 통 · 보유 기간 retainDays", async () => {
  const { svc, sent } = setup()
  const input = form({ partySize: "2", note: "창가 자리" })
  const r = await svc.submit(input, { ip: freshIp() })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.match(r.data.id, /^B-[0-9A-HJKMNP-TV-Z]{8}$/)
  assert.equal(r.data.status, "confirmed")
  assert.equal(r.data.message, t("ko", "booking.confirmed", { reference: r.data.id }))
  assert.equal(r.data.startsAt, new Date(input.startsAt).toISOString())

  const row = await rowOf(r.data.id)
  assert.equal(row.status, "confirmed")
  assert.equal(row.partySize, 2)
  assert.equal(row.contactKind, "email")
  assert.equal(row.expiresAt.toISOString(), new Date(new Date(input.startsAt).getTime() + 365 * 86_400_000).toISOString())
  assert.ok(row.ownerNotifiedAt && row.confirmationSentAt)

  assert.equal(sent("bookingNotice").length, 1)
  assert.equal(sent("bookingNotice")[0].to, OWNER.email)
  const [mail] = sent("bookingConfirmation")
  assert.equal(mail.to, input.contact)
  assert.equal(mail.input.status, "confirmed")
  assert.equal(mail.input.reference, r.data.id)
})

test("요청(request) 모드: requested 로 저장 · 접수 문구 · 확정은 운영자가 confirm 으로 — 한 번 더 불러도 같은 성공, 메일은 한 번", async () => {
  const { svc, sent } = setup({ config: { mode: "request" } })
  const r = await svc.submit(form(), { ip: freshIp() })
  assert.equal(r.data.status, "requested")
  assert.equal(r.data.message, t("ko", "booking.received", { reference: r.data.id }))
  assert.equal(sent("bookingConfirmation")[0].input.status, "requested")
  assert.equal((await rowOf(r.data.id)).confirmationSentAt !== null, true)

  assert.deepEqual((await svc.confirm(r.data.id, { userId: "nobody" })).code, "forbidden")
  assert.deepEqual((await svc.confirm(r.data.id, { system: true })).code, "forbidden", "서버 작업은 확정하지 못한다")
  const c = await svc.confirm(r.data.id, ownerActor)
  assert.equal(c.ok, true)
  assert.equal(c.data.status, "confirmed")
  assert.equal((await rowOf(r.data.id)).status, "confirmed")
  assert.equal(sent("bookingConfirmation").length, 2)
  assert.equal(sent("bookingConfirmation")[1].input.status, "confirmed")
  assert.equal((await svc.confirm(r.data.id, ownerActor)).ok, true)
  assert.equal(sent("bookingConfirmation").length, 2, "이미 확정된 예약은 메일을 다시 보내지 않는다")
  // 관리자 역할도 확정할 수 있다
  const r2 = await svc.submit(form(), { ip: freshIp() })
  assert.equal((await svc.confirm(r2.data.id, { userId: "u-2", role: "admin" })).ok, true)
})

test("전화 연락처: 손님 메일은 없고 대표 알림은 간다 · 알림 통로(notify)가 종류별로 불린다", async () => {
  const seen = []
  const { svc, sent } = setup({ notify: async (e) => void seen.push(e.kind) })
  const r = await svc.submit(form({ contact: "010-1234-5678" }), { ip: freshIp() })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal((await rowOf(r.data.id)).contactKind, "phone")
  assert.equal(sent("bookingConfirmation").length, 0)
  assert.equal(sent("bookingNotice").length, 1)
  assert.deepEqual(seen, ["confirmed"])
  const c = await svc.cancelAs(r.data.id, ownerActor)
  assert.equal(c.ok, true)
  assert.deepEqual(seen, ["confirmed", "cancelled"])
  assert.equal(sent("bookingCancellation").length, 0, "전화 연락처에는 메일이 없다")
})

test("정원: 가득 찬 칸은 slot_taken(재시도 가능)이고 칸 수만큼만 저장된다 · 맞닿는 칸은 따로", async () => {
  const { svc } = setup()
  const start = freshStart("11:00")
  const a = await svc.submit(form({ service: "color", startsAt: start }), { ip: freshIp() })
  assert.equal(a.ok, true)
  const b = await svc.submit(form({ service: "color", startsAt: start }), { ip: freshIp() })
  assert.equal(b.ok, false)
  assert.equal(b.code, "slot_taken")
  assert.equal(b.retryable, true)
  assert.equal(b.formError, t("ko", "booking.slotTaken"))
  // 염색은 120분 — 12:00 시작은 11:00 예약과 겹친다, 13:00 은 맞닿아 따로다
  const day = start.slice(0, 10)
  assert.equal((await svc.submit(form({ service: "color", startsAt: `${day}T12:00:00+09:00` }), { ip: freshIp() })).code, "slot_taken")
  assert.equal((await svc.submit(form({ service: "color", startsAt: `${day}T13:00:00+09:00` }), { ip: freshIp() })).ok, true)
  // 정원 2 인 커트: 둘은 되고 셋째는 안 된다
  const cut = freshStart("15:00")
  assert.equal((await svc.submit(form({ startsAt: cut }), { ip: freshIp() })).ok, true)
  assert.equal((await svc.submit(form({ startsAt: cut }), { ip: freshIp() })).ok, true)
  assert.equal((await svc.submit(form({ startsAt: cut }), { ip: freshIp() })).code, "slot_taken")
})

test("동시에 들어온 요청도 정원을 넘기지 않는다", async () => {
  const { svc } = setup()
  const start = freshStart("16:00")
  const results = await Promise.all(Array.from({ length: 6 }, () => svc.submit(form({ service: "color", startsAt: start }), { ip: freshIp() })))
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.equal(results.filter((r) => r.code === "slot_taken").length, 5)
})

test("칸 오류: 지난 시각 · 영업시간 밖 · 휴무일 · horizon 밖 · lead 안 · 모르는 서비스 · 인원 초과 · 연락처 · 시간대 없는 시각", async () => {
  const { svc } = setup({ config: { horizonDays: 30 } })
  const bad = async (patch, field) => {
    const r = await svc.submit(form(patch), { ip: freshIp() })
    assert.equal(r.ok, false, JSON.stringify(patch))
    assert.ok(r.fieldErrors?.[field]?.length, `${field}: ${JSON.stringify(r)}`)
    assert.equal(r.code, undefined)
    return r
  }
  await bad({ startsAt: "2026-10-30T10:00:00+09:00" }, "startsAt") // 과거
  await bad({ startsAt: "2026-11-03T08:00:00+09:00" }, "startsAt") // 영업 전
  await bad({ startsAt: "2026-11-03T17:30:00+09:00" }, "startsAt") // 서비스가 영업 끝을 넘는다
  await bad({ startsAt: "2026-11-03T10:10:00+09:00" }, "startsAt") // 슬롯 간격에 안 맞음
  await bad({ startsAt: "2026-11-08T11:00:00+09:00" }, "startsAt") // 일요일(휴무)
  await bad({ startsAt: "2026-12-25T11:00:00+09:00" }, "startsAt") // 휴무일
  await bad({ startsAt: "2027-03-02T11:00:00+09:00" }, "startsAt") // horizon 밖
  await bad({ startsAt: "2026-11-01T10:00:00+09:00" }, "startsAt") // 일요일 + lead
  await bad({ startsAt: "2026-11-03T10:00:00" }, "startsAt") // 시간대 없음
  await bad({ startsAt: "아무 때나" }, "startsAt")
  await bad({ service: "perm" }, "service")
  await bad({ partySize: "4" }, "partySize")
  await bad({ partySize: "0" }, "partySize")
  await bad({ contact: "not a contact" }, "contact")
  await bad({ contact: "" }, "contact")
  await bad({ name: "x".repeat(101) }, "name")
  // lead: 지금(2026-11-01 09:00 KST) + 120분 안은 안 된다 — 같은 날 휴무가 아니도록 월요일 새벽 기준으로 따로
  const near = clock("2026-11-02T00:30:00.000Z") // 월요일 09:30 KST
  const n = setup({ now: near })
  const r = await n.svc.submit(form({ startsAt: "2026-11-02T11:00:00+09:00" }), { ip: freshIp() })
  assert.ok(r.fieldErrors?.startsAt, "lead 안")
  const ok = await n.svc.submit(form({ startsAt: freshStart("14:00") }), { ip: freshIp() })
  assert.equal(ok.ok, true, JSON.stringify(ok))
})

test("owner 가 없으면 접수·가능 시간은 provider_unavailable 로 거절 — 저장도 없고 조회·취소·파기는 그대로", async () => {
  const withOwner = setup()
  const made = await withOwner.svc.submit(form(), { ip: freshIp() })
  assert.equal(made.ok, true, JSON.stringify(made))
  const { svc, requests } = setup({ owner: undefined })
  assert.equal(svc.enabled, false)
  const r = await svc.submit(form(), { ip: freshIp() })
  assert.equal(r.code, "provider_unavailable")
  assert.equal(r.retryable, false)
  assert.equal((await svc.slots({ service: "cut", from: "2026-11-03" })).code, "provider_unavailable")
  assert.equal(requests.length, 0)
  assert.equal(typeof (await svc.purgeExpired()), "number")
  const row = await rowOf(made.data.id)
  assert.equal((await svc.lookup({ reference: made.data.id, contact: row.contact }, { ip: freshIp() })).ok, true)
})

test("설정·옵션이 틀리면 만들 때 던진다", () => {
  const base = { db: d, mailer: createMailer({ mode: "mock", log: () => {} }), limiter: createRateLimiter({ store: store(), rules: BOOKING_RATE_RULES }), turnstile: createTurnstile({ mode: "mock" }), productName: "P", config: sampleConfig() }
  assert.throws(() => createBookingService({ ...base, config: sampleConfig({ mode: "later" }) }), /invalid booking config/)
  assert.throws(() => createBookingService({ ...base, owner: { email: "nope" } }), /owner\.email/)
  assert.throws(() => createBookingService({ ...base, manageUrl: "ftp://x" }), /manageUrl/)
  assert.throws(() => createBookingService({ ...base, productName: "" }), /productName/)
  assert.equal(createBookingService(base).enabled, false)
})

test("요청 제한: 한도를 넘으면 rate_limited + 남은 초, HTTP 는 429", async () => {
  const { svc } = setup()
  const ip = freshIp()
  const res = []
  for (let i = 0; i < BOOKING_RATE_RULES.booking.max + 1; i++) res.push(await svc.submit({ service: "nope" }, { ip }))
  const last = res.at(-1)
  assert.equal(last.code, "rate_limited")
  assert.ok(last.retryAfter > 0)
  const http = await svc.handler(new Request("https://x.test/api/booking", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: "{}" }))
  assert.equal(http.status, 429)
  assert.ok(http.headers.get("retry-after"))
})

test("봇 확인: 실패한 토큰은 저장 없이 거절 · 이미 찬 자리는 토큰을 태우기 전에 알린다", async () => {
  const calls = []
  const turnstile = { verify: async (x) => (calls.push(x), { ok: false, kind: "failed" }) }
  const { svc } = setup({ turnstile })
  const start = freshStart("10:30")
  const r = await svc.submit(form({ startsAt: start }), { ip: freshIp() })
  assert.equal(r.ok, false)
  assert.equal(r.code, "bot_check_failed")
  assert.equal(calls.length, 1)
  assert.equal((await d.select().from(bookings).where(eq(bookings.startsAt, new Date(start)))).length, 0)
  // 자리가 가득 찬 칸은 봇 확인 호출 없이 slot_taken
  const open = setup()
  const full = freshStart("10:30")
  await open.svc.submit(form({ service: "color", startsAt: full }), { ip: freshIp() })
  const before2 = calls.length
  const again = await svc.submit(form({ service: "color", startsAt: full }), { ip: freshIp() })
  assert.equal(again.code, "slot_taken")
  assert.equal(calls.length, before2)
})

test("멱등 키: 같은 키로 다시 보내면 같은 결과, 예약은 하나", async () => {
  const { svc, sent } = setup()
  const input = form({ idempotencyKey: "idem-key-0001" })
  const a = await svc.submit(input, { ip: freshIp() })
  const b = await svc.submit(input, { ip: freshIp() })
  assert.deepEqual(a, b)
  assert.equal((await d.select().from(bookings).where(eq(bookings.contact, input.contact))).length, 1)
  assert.equal(sent("bookingNotice").length, 1)
})

test("메일 공급자가 실패해도 예약은 저장되고 성공 · onError 로 알리고 메시지에 전화·메일 전체가 없다", async () => {
  const failing = { mode: "live", send: async () => ({ ok: false, mode: "live", error: { name: "rate_limit_exceeded", statusCode: 429, message: "slow down" } }) }
  const { svc, errors } = setup({ mailer: failing })
  const input = form()
  const r = await svc.submit(input, { ip: freshIp() })
  assert.equal(r.ok, true)
  const row = await rowOf(r.data.id)
  assert.equal(row.ownerNotifiedAt, null)
  assert.equal(row.confirmationSentAt, null)
  assert.ok(errors.some((e) => /owner notice failed \(rate_limit_exceeded\)/.test(e)))
  assert.ok(errors.some((e) => /confirmation mail failed/.test(e)))
  assert.ok(!errors.join("\n").includes(input.contact), "연락처 전체가 오류 메시지에 없다")
  // 던지는 메일러도 같다
  const throwing = { mode: "live", send: async () => { throw new Error(`boom for ${input.contact}`) } }
  const t2 = setup({ mailer: throwing })
  const input2 = form()
  const r2 = await t2.svc.submit(input2, { ip: freshIp() })
  assert.equal(r2.ok, true)
  assert.ok(!t2.errors.join("\n").includes(input2.contact))
})

test("알림 통로가 던져도 예약은 성공이다", async () => {
  const { svc, errors } = setup({ notify: async () => { throw new Error("kakao down") } })
  const r = await svc.submit(form(), { ip: freshIp() })
  assert.equal(r.ok, true)
  assert.ok(errors.some((e) => /notification threw/.test(e)))
})

test("처리기(handler): FormData 는 200 · 칸 오류 400 · 정원 409 · GET 405", async () => {
  const { svc } = setup()
  const start = freshStart("12:00")
  const fd = new FormData()
  for (const [k, v] of Object.entries(form({ service: "color", startsAt: start }))) fd.set(k, v)
  const post = (body) => svc.handler(new Request("https://x.test/api/booking", { method: "POST", headers: { "x-forwarded-for": freshIp() }, body }))
  const ok = await post(fd)
  assert.equal(ok.status, 200)
  assert.equal((await ok.json()).ok, true)
  const fd2 = new FormData()
  for (const [k, v] of Object.entries(form({ service: "color", startsAt: start }))) fd2.set(k, v)
  assert.equal((await post(fd2)).status, 409)
  const bad = new FormData()
  bad.set("service", "cut")
  assert.equal((await post(bad)).status, 400)
  assert.equal((await svc.handler(new Request("https://x.test/api/booking"))).status, 405)
})

test("action(ctx): 블록 submit 포트로 쓸 수 있다 · 영어 로캘 문구", async () => {
  const { svc } = setup()
  const r = await svc.action({ ip: freshIp(), locale: "en" })(form())
  assert.equal(r.ok, true)
  assert.equal(r.data.message, t("en", "booking.confirmed", { reference: r.data.id }))
  assert.equal((await rowOf(r.data.id)).locale, "en")
})

// ── 가능 시간 ───────────────────────────────────────────────────────────────────

test("slots: 잡힌 자리를 빼고 마감은 available 0 · 휴무·일요일은 빈 날 · 잘못된 입력은 칸 오류", async () => {
  const { svc } = setup()
  const start = freshStart("10:00")
  const day = start.slice(0, 10)
  await svc.submit(form({ service: "color", startsAt: start }), { ip: freshIp() })
  const r = await svc.slots({ service: "color", from: day, days: 1 })
  assert.equal(r.ok, true)
  const at = (iso) => r.data.days[0].slots.find((s) => s.startsAt === new Date(iso).toISOString())
  assert.equal(at(start).available, 0)
  assert.equal(at(`${day}T11:00:00+09:00`).available, 0, "겹치는 칸도 마감")
  assert.equal(at(`${day}T12:00:00+09:00`).available, 1)
  assert.equal(r.data.days[0].date, day)
  assert.deepEqual((await svc.slots({ service: "cut", from: "2026-12-25", days: 1 })).data.days[0].slots, [])
  const bad = await svc.slots({ service: "nope", from: "2026-02-30", days: 99 })
  assert.equal(bad.ok, false)
  assert.ok(bad.fieldErrors.service && bad.fieldErrors.from && bad.fieldErrors.days)
})

// ── 조회·취소 ───────────────────────────────────────────────────────────────────

test("조회·취소: 번호와 연락처가 모두 맞아야 한다 — 어긋나면 모두 똑같은 not_found(존재를 알리지 않는다)", async () => {
  const { svc } = setup()
  const input = form()
  const made = await svc.submit(input, { ip: freshIp() })
  const ref = made.data.id
  const other = await svc.submit(form(), { ip: freshIp() })
  const otherRow = await rowOf(other.data.id)

  const miss = [
    await svc.lookup({ reference: ref, contact: otherRow.contact }, { ip: freshIp() }), // 번호만 맞음
    await svc.lookup({ reference: other.data.id, contact: input.contact }, { ip: freshIp() }), // 연락처만 맞음
    await svc.lookup({ reference: "B-ZZZZZZZZ", contact: input.contact }, { ip: freshIp() }), // 없는 번호
    await svc.lookup({ reference: "엉터리", contact: input.contact }, { ip: freshIp() }), // 모양이 틀린 번호
    await svc.lookup({ reference: ref, contact: "" }, { ip: freshIp() }),
    await svc.lookup({ reference: ref, contact: undefined }, { ip: freshIp() }),
    await svc.cancel({ reference: ref, contact: otherRow.contact }, { ip: freshIp() }),
    await svc.cancel({ reference: "B-ZZZZZZZZ", contact: input.contact }, { ip: freshIp() }),
  ]
  for (const m of miss) assert.deepEqual(m, miss[0])
  assert.equal(miss[0].code, "not_found")
  assert.equal(miss[0].formError, t("ko", "booking.notFound"))

  // 맞으면 보인다 — 번호는 소문자·공백·O/I 오타까지 받고 이메일은 대소문자를 가리지 않는다
  const view = await svc.lookup({ reference: ` ${ref.toLowerCase().replace(/0/g, "o")} `, contact: input.contact.toUpperCase() }, { ip: freshIp() })
  assert.equal(view.ok, true, JSON.stringify(view))
  assert.equal(view.data.id, ref)
  assert.equal(view.data.serviceName, "커트")
  assert.equal(view.data.canCancel, true)
  assert.equal("contact" in view.data, false, "연락처는 돌려주지 않는다")
  assert.equal((await svc.lookup({ reference: ref, contact: input.contact }, { ip: freshIp(), locale: "en" })).data.serviceName, "Haircut")
})

test("전화번호는 표기가 달라도 같은 번호로 본다", async () => {
  const { svc } = setup()
  const made = await svc.submit(form({ contact: "010-2222-3333" }), { ip: freshIp() })
  for (const c of ["01022223333", "010 2222 3333", "+82 10-2222-3333"]) {
    assert.equal((await svc.lookup({ reference: made.data.id, contact: c }, { ip: freshIp() })).ok, true, c)
  }
  assert.equal((await svc.lookup({ reference: made.data.id, contact: "010-2222-3334" }, { ip: freshIp() })).code, "not_found")
})

test("조회·취소도 요청 제한을 받는다(번호 맞히기 방어)", async () => {
  const { svc } = setup()
  const ip = freshIp()
  let last
  for (let i = 0; i < BOOKING_RATE_RULES.bookingLookup.max + 1; i++) last = await svc.lookup({ reference: "B-ZZZZZZZZ", contact: "a@b.co" }, { ip })
  assert.equal(last.code, "rate_limited")
  assert.equal((await svc.cancel({ reference: "B-ZZZZZZZZ", contact: "a@b.co" }, { ip })).code, "rate_limited", "조회와 취소가 한도를 나눈다")
})

test("직접 취소: 자리가 풀리고 취소 메일 한 통 · 다시 취소해도 같은 성공 · 취소 마감이 지나면 cancel_closed", async () => {
  const { svc, sent, now } = setup()
  const input = form({ service: "color", startsAt: freshStart("10:00") })
  const made = await svc.submit(input, { ip: freshIp() })
  const c = await svc.cancel({ reference: made.data.id, contact: input.contact }, { ip: freshIp() })
  assert.equal(c.ok, true)
  assert.equal(c.data.status, "cancelled")
  const row = await rowOf(made.data.id)
  assert.equal(row.status, "cancelled")
  assert.equal(row.cancelledBy, "booker")
  assert.ok(row.cancelledAt)
  assert.equal(sent("bookingCancellation").length, 1)
  assert.equal((await svc.cancel({ reference: made.data.id, contact: input.contact }, { ip: freshIp() })).ok, true)
  assert.equal(sent("bookingCancellation").length, 1, "두 번째 취소는 메일을 다시 보내지 않는다")
  // 풀린 자리에 다시 예약할 수 있다
  assert.equal((await svc.submit(form({ service: "color", startsAt: input.startsAt }), { ip: freshIp() })).ok, true)
  // 조회는 취소 상태를 보이고 더는 취소할 수 없다고 알린다
  const v = await svc.lookup({ reference: made.data.id, contact: input.contact }, { ip: freshIp() })
  assert.equal(v.data.status, "cancelled")
  assert.equal(v.data.canCancel, false)

  // 취소 마감(시작 120분 전) 뒤
  const late = form({ startsAt: freshStart("10:00") })
  const m2 = await svc.submit(late, { ip: freshIp() })
  const startMs = new Date(late.startsAt).getTime()
  now.at = new Date(startMs - 119 * 60_000)
  const closed = await svc.cancel({ reference: m2.data.id, contact: late.contact }, { ip: freshIp() })
  assert.equal(closed.code, "cancel_closed")
  assert.equal((await rowOf(m2.data.id)).status, "confirmed")
  assert.equal((await svc.lookup({ reference: m2.data.id, contact: late.contact }, { ip: freshIp() })).data.canCancel, false)
  // 운영자는 마감과 상관없이 취소할 수 있다 · 권한 없는 사람은 못 한다
  assert.equal((await svc.cancelAs(m2.data.id, { userId: "nobody" })).code, "forbidden")
  const byOwner = await svc.cancelAs(m2.data.id, ownerActor)
  assert.equal(byOwner.ok, true)
  assert.equal((await rowOf(m2.data.id)).cancelledBy, "owner")
  assert.equal((await svc.cancelAs("B-ZZZZZZZZ", ownerActor)).code, "not_found")
  now.at = new Date("2026-11-01T00:00:00.000Z")
})

test("서버 작업(system)도 취소할 수 있고 cancelledBy 가 system 이다", async () => {
  const { svc, sent } = setup()
  const made = await svc.submit(form(), { ip: freshIp() })
  assert.equal((await svc.cancelAs(made.data.id, { system: true })).ok, true)
  assert.equal((await rowOf(made.data.id)).cancelledBy, "system")
  assert.equal(sent("bookingCancellation")[0].input.cancelledBy, "system")
})

// ── 예약금 ──────────────────────────────────────────────────────────────────────

// 예약금(결제 대기 · 확정 · 환불 · 만료)은 deposit.test.mjs 에서 본다.

// ── 알림·파기 ───────────────────────────────────────────────────────────────────

test("remindDue: 알림 시간 안에 든 확정 예약에만, 한 예약에 한 번만 보낸다", async () => {
  const { svc, sent, now } = setup()
  const soon = form({ startsAt: freshStart("10:00") })
  const far = form({ startsAt: freshStart("10:00") })
  const requested = setup({ config: { mode: "request" } })
  const waiting = form({ startsAt: freshStart("10:00") })
  const a = await svc.submit(soon, { ip: freshIp() })
  const b = await svc.submit(far, { ip: freshIp() })
  const c = await requested.svc.submit(waiting, { ip: freshIp() })
  const before = sent("bookingConfirmation").length

  // soon 시작 24시간 안으로 시계를 옮긴다(far·waiting 은 아직 밖이거나 확정이 아니다)
  now.at = new Date(new Date(soon.startsAt).getTime() - 23 * 3_600_000)
  requested.now.at = now.at
  const reminded = await svc.remindDue()
  assert.ok(reminded >= 1)
  const mails = sent("bookingConfirmation").slice(before)
  const mine = mails.filter((m) => m.input.reference === a.data.id)
  assert.equal(mine.length, 1)
  assert.equal(mine[0].input.reminder, true)
  assert.equal(mails.filter((m) => m.input.reference === b.data.id).length, 0, "시간 밖")
  assert.ok((await rowOf(a.data.id)).reminderSentAt)
  assert.equal((await rowOf(c.data.id)).reminderSentAt, null, "확정되지 않은 요청에는 보내지 않는다")
  // 두 번째 Cron 은 같은 예약에 다시 보내지 않는다
  await svc.remindDue()
  assert.equal(sent("bookingConfirmation").filter((m) => m.input.reference === a.data.id && m.input.reminder).length, 1)
  now.at = new Date("2026-11-01T00:00:00.000Z")

  // 알림을 끄면(0) 아무것도 하지 않는다
  const off = setup({ config: { reminderBeforeMinutes: 0 } })
  assert.equal(await off.svc.remindDue(), 0)
})

test("remindDue: 겹쳐 돌아도 한 번만 차지한다(claimReminder)", async () => {
  const { svc, now, sent } = setup()
  const input = form()
  const made = await svc.submit(input, { ip: freshIp() })
  now.at = new Date(new Date(input.startsAt).getTime() - 3_600_000)
  const counts = await Promise.all([svc.remindDue(), svc.remindDue(), svc.remindDue()])
  assert.ok(counts.reduce((a, b) => a + b, 0) >= 1)
  assert.equal(sent("bookingConfirmation").filter((m) => m.input.reference === made.data.id && m.input.reminder).length, 1)
  now.at = new Date("2026-11-01T00:00:00.000Z")
})

test("purgeExpired: 보유 기간이 지난 예약만 지운다", async () => {
  const { svc, now } = setup()
  const input = form()
  const made = await svc.submit(input, { ip: freshIp() })
  assert.equal(await svc.purgeExpired(), 0)
  now.at = new Date(new Date(input.startsAt).getTime() + 366 * 86_400_000)
  assert.ok((await svc.purgeExpired()) >= 1)
  assert.equal(await rowOf(made.data.id), undefined)
  now.at = new Date("2026-11-01T00:00:00.000Z")
})

test("메일 로그 줄에는 연락처 전체가 찍히지 않는다", async () => {
  const lines = []
  const mock = createMailer({ mode: "mock", log: (l) => lines.push(l) })
  const { svc } = setup({ mailer: { mode: mock.mode, send: (r) => mock.send(r) } })
  const input = form({ contact: "010-4444-5555" })
  const r = await svc.submit(input, { ip: freshIp() })
  assert.equal(r.ok, true)
  assert.ok(lines.length > 0)
  assert.ok(!lines.join("\n").includes("010-4444-5555"))
})
