// createNotifyKr.send — PGlite(db.local()) + 가짜 fetch. 외부 호출은 한 번도 나가지 않는다.
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { eq } from "drizzle-orm"
import { db, notifications, user as userTable, writeMarketingConsents } from "@launch-factory/db"
import { consentGuard, createNotifyKr, DEFAULT_BOOKING_TEMPLATES } from "../src/index.ts"

const KEY = "NCSTESTKEY0123456789"
const SECRET = "test-secret-do-not-use-0123456789abcdef"
const SOLAPI = { apiKey: KEY, apiSecret: SECRET, pfId: "KA01PF-test", sender: "02-1234-5678" }
const OPT_OUT = { number: "080-123-4567" }
const DAY = new Date("2026-10-22T03:00:00.000Z") // 12:00 KST
const NIGHT = new Date("2026-10-22T14:00:00.000Z") // 23:00 KST
const PHONE = "010-1234-5678"
const VARS = { service: "상담 30분", when: "10월 25일 14:00", reference: "BK-7Q2M" }

const TEMPLATES = {
  ...DEFAULT_BOOKING_TEMPLATES,
  bookingConfirmed: { ...DEFAULT_BOOKING_TEMPLATES.bookingConfirmed, alimtalkId: "KA01TP-confirmed" },
  promo: { vars: ["event"], sms: { ko: "가을 행사 #{event}", en: "Autumn event #{event}" } },
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const GOOD = (id = "G-good") => json(200, { failedMessageList: [], groupInfo: { groupId: id } })
const REJECT = () => json(200, { failedMessageList: [{ statusCode: "3059", statusMessage: "카카오 계정 없음" }], groupInfo: { groupId: "G-x" } })

/** 호출을 기록하는 가짜 fetch. replies 는 호출 순서대로 쓰고, 모자라면 마지막 것을 되풀이한다 */
function fakeFetch(...replies) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    const r = replies[Math.min(calls.length - 1, replies.length - 1)]
    return r()
  }
  fn.calls = calls
  return fn
}
const explodingFetch = Object.assign(async () => { throw new Error("mock 에서는 fetch 를 부르면 안 된다") }, {})

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
let tmp
let seq = 0
before(async () => {
  d = await db.local()
  tmp = mkdtempSync(join(tmpdir(), "notify-kr-"))
  const at = new Date("2026-01-01T00:00:00Z")
  await d.insert(userTable).values({ id: "u-consent", name: "동의함", email: "yes@example.com", emailVerified: true, createdAt: at, updatedAt: at })
  await d.insert(userTable).values({ id: "u-none", name: "동의 없음", email: "no@example.com", emailVerified: true, createdAt: at, updatedAt: at })
  await writeMarketingConsents(d, { userId: "u-consent", changes: { sms: true }, source: "sign_up", at })
})
after(async () => {
  await d?.$client.close()
  rmSync(tmp, { recursive: true, force: true })
})

const key = () => `k-${++seq}`
const make = (over = {}) => createNotifyKr({ db: d, mode: "live", solapi: SOLAPI, templates: TEMPLATES, now: () => DAY, ...over })
const rowsOf = (idempotencyKey) => d.select().from(notifications).where(eq(notifications.idempotencyKey, idempotencyKey))
const allRows = () => d.select().from(notifications)

test("설정 오류(템플릿·모드)는 만들 때 던진다", () => {
  assert.throws(() => createNotifyKr({ db: d, mode: "live", templates: { bad: { vars: ["a"], sms: { ko: "#{zzz}", en: "e" } } } }), /invalid templates[\s\S]*#\{zzz\}/)
  assert.throws(() => createNotifyKr({ db: d, mode: "prod", templates: {} }), /mode/)
})

// ── mock ──────────────────────────────────────────────────────────────────────
test("mock: 외부 호출 0(fetch 를 줘도 부르지 않는다) · 발송함에는 끝 4자리·템플릿·채널·시각만", async () => {
  const outbox = join(tmp, "nested", "outbox.jsonl")
  const notify = createNotifyKr({ db: d, mode: "mock", templates: TEMPLATES, fetch: explodingFetch, outbox, now: () => DAY })
  const k = key()
  const r = await notify.send({ to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: k })
  assert.equal(r.ok, true)
  assert.equal(r.channel, "sms", "solapi 설정이 없으니 알림톡 없이 문자")
  assert.match(r.providerRef, /^mock-/)
  const lines = readFileSync(outbox, "utf8").trim().split("\n").map((l) => JSON.parse(l))
  assert.deepEqual(lines, [{ at: DAY.toISOString(), template: "bookingConfirmed", channel: "sms", purpose: "transactional", toLast4: "5678" }])
  const text = readFileSync(outbox, "utf8")
  for (const forbidden of ["010", "1234", "상담", "BK-7Q2M", "예약 확정"]) assert.ok(!text.includes(forbidden), `발송함에 ${forbidden} 없음`)
  const [row] = await rowsOf(k)
  assert.equal(row.status, "sent")
  assert.equal(row.channel, "sms")
  assert.equal(row.toLast4, "5678")
  assert.equal(row.providerRef, r.providerRef)
  assert.equal(row.expiresAt.getTime() - DAY.getTime(), 365 * 86_400_000, "기록 보유 1년")
})

test("mock: 알림톡 id 와 채널(pfId)이 갖춰지면 알림톡 갈래로 기록한다 · 장문은 lms", async () => {
  const outbox = join(tmp, "o2.jsonl")
  const notify = createNotifyKr({ db: d, mode: "mock", solapi: SOLAPI, templates: TEMPLATES, fetch: explodingFetch, outbox, now: () => DAY })
  assert.equal((await notify.send({ to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: key() })).channel, "alimtalk")
  const long = await notify.send({ to: PHONE, template: "bookingRequested", vars: { ...VARS, service: "긴 이름의 서비스".repeat(5) }, purpose: "transactional", idempotencyKey: key() })
  assert.equal(long.channel, "lms")
})

test("mock: 발송함 파일을 쓸 수 없으면 failed(outbox_unwritable) — 던지지 않는다", async () => {
  const notify = createNotifyKr({ db: d, mode: "mock", templates: TEMPLATES, outbox: join(tmp, "o2.jsonl", "x", "y.jsonl"), now: () => DAY })
  const k = key()
  const r = await notify.send({ to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: k })
  assert.deepEqual(r, { ok: false, status: "failed", reason: "outbox_unwritable" })
  assert.equal((await rowsOf(k))[0].status, "failed")
})

// ── 멱등 ──────────────────────────────────────────────────────────────────────
test("멱등: 같은 키는 한 번만 보낸다 — 두 번째는 skipped/duplicate · 동시에 불러도 한 번", async () => {
  const f = fakeFetch(() => GOOD())
  const notify = make({ fetch: f })
  const k = key()
  const input = { to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: k }
  const [a, b, c] = await Promise.all([notify.send(input), notify.send(input), notify.send(input)])
  assert.equal([a, b, c].filter((r) => r.ok).length, 1)
  assert.deepEqual([a, b, c].filter((r) => !r.ok), [{ ok: false, status: "skipped", reason: "duplicate" }, { ok: false, status: "skipped", reason: "duplicate" }])
  assert.deepEqual(await notify.send(input), { ok: false, status: "skipped", reason: "duplicate" })
  assert.equal(f.calls.length, 1)
  assert.equal((await rowsOf(k)).length, 1)
})

// ── live: 정보성 ─────────────────────────────────────────────────────────────
test("live 정보성: 알림톡 ATA 요청 모양(변수 키 #{}) · 서명 머리 · 응답 groupId", async () => {
  const f = fakeFetch(() => GOOD("G-ata"))
  const notify = make({ fetch: f })
  const k = key()
  const r = await notify.send({ to: "+82 10-1234-5678", template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: k })
  assert.deepEqual(r, { ok: true, channel: "alimtalk", providerRef: "G-ata" })
  assert.equal(f.calls.length, 1)
  const { init, body } = f.calls[0]
  assert.match(init.headers.Authorization, /^HMAC-SHA256 apiKey=NCSTESTKEY0123456789, date=2026-10-22T03:00:00\.000Z, salt=[0-9a-f]{32}, signature=[0-9a-f]{64}$/)
  assert.equal(body.messages.length, 1)
  assert.deepEqual(body.messages[0], {
    to: "01012345678",
    from: "0212345678",
    type: "ATA",
    text: "[예약 확정] 상담 30분 10월 25일 14:00\n접수번호 BK-7Q2M",
    kakaoOptions: {
      pfId: "KA01PF-test",
      templateId: "KA01TP-confirmed",
      variables: { "#{name}": "", "#{service}": "상담 30분", "#{when}": "10월 25일 14:00", "#{reference}": "BK-7Q2M", "#{manageUrl}": "" },
      disableSms: true,
    },
  })
  const [row] = await rowsOf(k)
  assert.deepEqual([row.status, row.channel, row.providerRef, row.reason], ["sent", "alimtalk", "G-ata", null])
})

test("live 정보성: 알림톡이 접수 실패하면 문자로 대신한다 — 두 번째 요청은 SMS, 기록에 물러난 이유", async () => {
  const f = fakeFetch(REJECT, () => GOOD("G-sms"))
  const k = key()
  const r = await make({ fetch: f }).send({ to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: k })
  assert.deepEqual(r, { ok: true, channel: "sms", providerRef: "G-sms" })
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[0].body.messages[0].type, "ATA")
  assert.deepEqual(f.calls[1].body.messages[0], { to: "01012345678", from: "0212345678", type: "SMS", text: "[예약 확정] 상담 30분 10월 25일 14:00\n접수번호 BK-7Q2M" })
  const [row] = await rowsOf(k)
  assert.equal(row.channel, "sms")
  assert.match(row.reason, /^alimtalk_failed:rejected:3059/)
})

test("live 정보성: 네트워크 오류·비 2xx 로 알림톡이 실패해도 문자 대체 · 둘 다 실패면 failed", async () => {
  const down = Object.assign(async () => { throw new TypeError("fetch failed") }, {})
  const f1 = fakeFetch(() => json(503, { errorCode: "Unavailable" }), () => GOOD("G-2"))
  assert.equal((await make({ fetch: f1 }).send({ to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: key() })).channel, "sms")
  const k = key()
  const r = await make({ fetch: down }).send({ to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: k })
  assert.deepEqual(r, { ok: false, status: "failed", reason: "alimtalk_failed:network_error:TypeError; sms_failed:network_error:TypeError" })
  const [row] = await rowsOf(k)
  assert.deepEqual([row.status, row.channel], ["failed", null])
  assert.equal(row.reason, r.reason)
})

test("live 정보성: 알림톡 id 가 없거나 pfId 가 없으면 처음부터 문자", async () => {
  const f1 = fakeFetch(() => GOOD())
  const r1 = await make({ fetch: f1 }).send({ to: PHONE, template: "bookingCancelled", vars: VARS, purpose: "transactional", idempotencyKey: key() })
  assert.equal(r1.channel, "sms")
  assert.deepEqual(f1.calls.map((c) => c.body.messages[0].type), ["SMS"])
  const f2 = fakeFetch(() => GOOD())
  const r2 = await make({ fetch: f2, solapi: { ...SOLAPI, pfId: "" } }).send({ to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: key() })
  assert.equal(r2.channel, "sms")
  assert.deepEqual(f2.calls.map((c) => c.body.messages[0].type), ["SMS"])
})

test("live 정보성: 영어 본문 · 장문은 LMS", async () => {
  const f = fakeFetch(() => GOOD())
  const notify = make({ fetch: f })
  await notify.send({ to: PHONE, template: "bookingCancelled", vars: VARS, purpose: "transactional", idempotencyKey: key(), locale: "en" })
  assert.equal(f.calls[0].body.messages[0].text, "[Booking cancelled] 상담 30분 on 10월 25일 14:00 was cancelled.\nReference BK-7Q2M")
  assert.equal(f.calls[0].body.messages[0].type, "SMS", "90바이트 이하")
  await notify.send({ to: PHONE, template: "bookingCancelled", vars: { ...VARS, service: "긴 이름의 서비스".repeat(5) }, purpose: "transactional", idempotencyKey: key(), locale: "en" })
  assert.equal(f.calls[1].body.messages[0].type, "LMS", "넘으면 장문")
})

// ── 입력 거절 ─────────────────────────────────────────────────────────────────
test("입력 오류: 전화 · 템플릿 · 변수 누락 · 키 · 목적 → failed, 보내지도 않고 키도 차지하지 않는다(고쳐서 같은 키로 다시 보낼 수 있다)", async () => {
  const f = fakeFetch(() => GOOD())
  const notify = make({ fetch: f })
  const k = key()
  const base = { to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: k }
  const fail = (reason) => ({ ok: false, status: "failed", reason })
  assert.deepEqual(await notify.send({ ...base, to: "02-1234-5678" }), fail("invalid_phone"))
  assert.deepEqual(await notify.send({ ...base, template: "nope" }), fail("unknown_template"))
  assert.deepEqual(await notify.send({ ...base, template: "toString" }), fail("unknown_template"))
  assert.deepEqual(await notify.send({ ...base, vars: { service: "상담" } }), fail("missing_vars:when,reference"))
  assert.deepEqual(await notify.send({ ...base, vars: undefined }), fail("missing_vars:service,when,reference"))
  assert.deepEqual(await notify.send({ ...base, idempotencyKey: "  " }), fail("invalid_idempotency_key"))
  assert.deepEqual(await notify.send({ ...base, purpose: "ads" }), fail("invalid_purpose"))
  assert.equal(f.calls.length, 0)
  assert.equal((await rowsOf(k)).length, 0)
  assert.equal((await notify.send(base)).ok, true, "고친 뒤 같은 키로 보낼 수 있다")
})

test("live 인데 solapi 설정이 없거나 비면 skipped/provider_unavailable", async () => {
  for (const solapi of [undefined, { ...SOLAPI, apiSecret: "" }, { ...SOLAPI, sender: "" }]) {
    const f = fakeFetch(() => GOOD())
    const k = key()
    const r = await make({ fetch: f, solapi }).send({ to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: k })
    assert.deepEqual(r, { ok: false, status: "skipped", reason: "provider_unavailable" })
    assert.equal(f.calls.length, 0)
    assert.equal((await rowsOf(k)).length, 0, "진짜 키는 차지하지 않는다")
    const [skipRow] = await rowsOf(`skipped:provider_unavailable:${k}`)
    assert.deepEqual([skipRow.status, skipRow.reason, skipRow.toLast4], ["skipped", "provider_unavailable", "5678"])
  }
})

// ── 광고성 ────────────────────────────────────────────────────────────────────
const promo = (over = {}) => ({ to: PHONE, template: "promo", vars: { event: "10월 30일" }, purpose: "marketing", userId: "u-consent", idempotencyKey: key(), ...over })
const adNotify = (over = {}) => make({ optOut: OPT_OUT, canMarketing: consentGuard(d), ...over })

test("광고성 허용: 문자로만(알림톡 금지) · (광고) 머리 + 끝 수신거부 문구와 번호", async () => {
  const f = fakeFetch(() => GOOD("G-ad"))
  // 알림톡 id 가 있는 템플릿이어도 광고성이면 ATA 를 쓰지 않는다
  const templates = { ...TEMPLATES, promo: { ...TEMPLATES.promo, alimtalkId: "KA01TP-promo" } }
  const r = await adNotify({ fetch: f, templates }).send(promo())
  assert.deepEqual(r, { ok: true, channel: "sms", providerRef: "G-ad" })
  assert.equal(f.calls.length, 1)
  const m = f.calls[0].body.messages[0]
  assert.equal(m.type, "SMS")
  assert.equal(m.kakaoOptions, undefined)
  assert.equal(m.text, "(광고) 가을 행사 10월 30일\n무료수신거부 080-123-4567")
})

test("광고성 거절 ① 동의 없음: 동의 없는 사람 · 확인기 없음(기본 거절) · userId 없음 · 확인기 false/거절 사유/오류", async () => {
  const cases = [
    ["동의 없는 사용자", {}, { userId: "u-none" }, "no_consent"],
    ["확인기 없음", { canMarketing: undefined }, {}, "no_consent"],
    ["userId 없음", {}, { userId: undefined }, "no_consent"],
    ["확인기 false", { canMarketing: () => false }, {}, "no_consent"],
    ["확인기 거절 사유", { canMarketing: () => ({ ok: false, reason: "reconfirm_pending" }) }, {}, "reconfirm_pending"],
    ["확인기 오류", { canMarketing: () => { throw new Error("db") } }, {}, "consent_check_failed"],
  ]
  for (const [name, notifyOver, inputOver, reason] of cases) {
    const f = fakeFetch(() => GOOD())
    const input = promo(inputOver)
    assert.deepEqual(await adNotify({ fetch: f, ...notifyOver }).send(input), { ok: false, status: "skipped", reason }, name)
    assert.equal(f.calls.length, 0, name)
    const [row] = await rowsOf(`skipped:${reason}:${input.idempotencyKey}`)
    assert.deepEqual([row.status, row.purpose, row.reason], ["skipped", "marketing", reason], name)
  }
})

test("광고성 거절 ② 야간(한국 21:00~08:00): 보내지 않고 skipped/night — 같은 키로 아침에 다시 보낼 수 있다", async () => {
  const f = fakeFetch(() => GOOD())
  const input = promo()
  const night = await adNotify({ fetch: f, now: () => NIGHT }).send(input)
  assert.deepEqual(night, { ok: false, status: "skipped", reason: "night" })
  assert.equal(f.calls.length, 0)
  assert.equal((await rowsOf(input.idempotencyKey)).length, 0, "야간 건너뜀이 키를 차지하지 않는다")
  const morning = await adNotify({ fetch: f, now: () => new Date("2026-10-22T23:30:00Z") }).send(input) // 08:30 KST
  assert.equal(morning.ok, true)
  assert.equal(f.calls.length, 1)
  // 정보성은 야간에도 보낸다
  const info = await make({ fetch: f, now: () => NIGHT }).send({ to: PHONE, template: "bookingReminder", vars: VARS, purpose: "transactional", idempotencyKey: key() })
  assert.equal(info.ok, true)
})

test("광고성 거절 ③ (광고) 머리: 본문이 머리 없이 나가는 길은 없다 — 보낸 모든 광고 본문이 머리로 시작하고, 마지막 점검은 머리 없는 본문을 거절한다", async () => {
  const f = fakeFetch(() => GOOD())
  // 템플릿이 이미 머리를 달고 있어도 겹치지 않는다
  const templates = { ...TEMPLATES, withHead: { vars: [], sms: { ko: "(광고) 이미 머리", en: "(광고) head" } } }
  await adNotify({ fetch: f, templates }).send(promo({ template: "withHead", vars: {} }))
  await adNotify({ fetch: f }).send(promo())
  for (const c of f.calls) {
    const text = c.body.messages[0].text
    assert.ok(text.startsWith("(광고) "), text)
    assert.ok(!text.slice(4).includes("(광고)"), "머리가 겹치지 않는다")
  }
  assert.equal(f.calls[0].body.messages[0].text, "(광고) 이미 머리\n무료수신거부 080-123-4567")
  // 머리·문구 점검 자체는 marketing.test.mjs(checkMarketingText) 가 음성으로 대조한다
})

test("광고성 거절 ④ 수신거부 번호: optOut 이 없거나 번호 모양이 아니면 skipped/opt_out_missing", async () => {
  for (const optOut of [undefined, { number: "" }, { number: "문의 바람" }, { number: "080" }]) {
    const f = fakeFetch(() => GOOD())
    const input = promo()
    const r = await adNotify({ fetch: f, optOut }).send(input)
    assert.deepEqual(r, { ok: false, status: "skipped", reason: "opt_out_missing" }, JSON.stringify(optOut))
    assert.equal(f.calls.length, 0)
  }
})

test("광고성도 mock 에서는 외부 호출 0 · 발송함에 purpose 만 남고 본문은 없다", async () => {
  const outbox = join(tmp, "ad-outbox.jsonl")
  const notify = createNotifyKr({ db: d, mode: "mock", templates: TEMPLATES, optOut: OPT_OUT, canMarketing: consentGuard(d), fetch: explodingFetch, outbox, now: () => DAY })
  const r = await notify.send(promo())
  assert.equal(r.ok, true)
  const line = JSON.parse(readFileSync(outbox, "utf8").trim())
  assert.deepEqual([line.purpose, line.channel, line.toLast4], ["marketing", "sms", "5678"])
  assert.ok(!existsSync(outbox) || !readFileSync(outbox, "utf8").includes("광고"))
  // mock 이라도 규칙은 같다
  assert.equal((await createNotifyKr({ db: d, mode: "mock", templates: TEMPLATES, now: () => DAY }).send(promo())).reason, "no_consent")
})

// ── 비밀값 ────────────────────────────────────────────────────────────────────
test("비밀값: 공급자가 키·비밀키·전화를 되돌려줘도 반환 이유·기록·로그 어디에도 없다", async () => {
  const echo = () => json(401, { errorCode: "InvalidApiKey", errorMessage: `key ${KEY} secret ${SECRET} to 01012345678 ${PHONE} a@example.com` })
  const f = fakeFetch(echo)
  const logs = []
  const k = key()
  const r = await make({ fetch: f, log: (l) => logs.push(l), solapi: { ...SOLAPI, pfId: "" } }).send({ to: PHONE, template: "bookingConfirmed", vars: VARS, purpose: "transactional", idempotencyKey: k, userId: undefined })
  assert.equal(r.ok, false)
  const everything = JSON.stringify([r, await allRows(), logs])
  for (const bad of [KEY, SECRET, "01012345678", "1234-5678", "010-1234", "a@example.com"]) assert.ok(!everything.includes(bad), `기록에 ${bad} 없음`)
  assert.ok(logs.length > 0)
  assert.ok(logs.every((l) => l.includes("***5678")), "로그는 끝 4자리만")
})

test("모든 기록에는 전화 전체와 본문이 없다 — toLast4 는 네 자리", async () => {
  for (const row of await allRows()) {
    assert.match(row.toLast4, /^\d{4}$/)
    assert.ok(!JSON.stringify(row).includes("상담"))
  }
})
