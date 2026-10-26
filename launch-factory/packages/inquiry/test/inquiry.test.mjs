// 요청 제한(DB rate_limits)·멱등 키·문의 수신 — v0 Task 15 (대장 D44·D97·D104·D105).
// PGlite 메모리 DB 하나를 모든 시험이 나눠 쓴다(메모리 절약). 시계는 시험마다 가짜로 돌린다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { count, eq, sql } from "drizzle-orm"
import { adminActions, db, hitRateLimit, idempotencyKeys, inquiries, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { MESSAGES, t } from "@launch-factory/i18n"
import { COLLECTION_COLUMN_KEYS, privacyCollections } from "@launch-factory/consent"
import { createRateLimiter, RATE_LIMIT_DEFAULTS } from "@launch-factory/security/rate-limit"
import { blockedResponse, protect } from "@launch-factory/security/protect"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { createInquiryService, DISPUTE_DOWNGRADE_ADMIN_ONLY, isAdminActor, kindFromCategory } from "../src/index.ts"
import { DUMMY_TOKEN, fakeSiteverify, RECORDED, TEST_SECRET_PASS } from "../../security/test/turnstile-fixtures.mjs"

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
const freshIp = () => `198.51.100.${++ipSeq}`

// ── 요청 제한 ───────────────────────────────────────────────────────────────────

test("한도를 넘으면 막히고 남은 초를 준다 — HTTP 는 429 + Retry-After, 창이 지나면 다시 받는다(DB 에 쌓인다)", async () => {
  const c = clock("2026-10-01T00:00:00.000Z")
  const limiter = createRateLimiter({ store: store(), now: c.now })
  const who = { ip: freshIp() }
  const { max, windowSec } = RATE_LIMIT_DEFAULTS.inquiry
  for (let i = 0; i < max; i++) assert.equal((await limiter.check("inquiry", who)).ok, true, `${i + 1}번째`)
  c.tick(100_000)
  const blocked = await limiter.check("inquiry", who)
  assert.deepEqual(blocked, { ok: false, retryAfter: windowSec - 100 })

  const res = blockedResponse({ kind: "rate_limited", retryAfter: blocked.retryAfter })
  assert.equal(res.status, 429)
  assert.equal(res.headers.get("retry-after"), String(windowSec - 100))

  // 판단이 DB 를 읽는다: 행 하나에 count 가 쌓였다(막힌 요청도 센다 — 창 시작은 그대로라 Retry-After 가 늘지 않는다)
  const [row] = (await d.execute(sql`select count from rate_limits where key = ${limiter.key("inquiry", who)}`)).rows
  assert.equal(row.count, max + 1)
  c.tick(1_000)
  assert.equal((await limiter.check("inquiry", who)).retryAfter, windowSec - 101)
  // 창이 지나면 1부터
  c.tick(windowSec * 1000)
  assert.deepEqual(await limiter.check("inquiry", who), { ok: true, remaining: max - 1 })
})

test("다른 사용자끼리 한도를 나누지 않는다 — 같은 IP 뒤의 사용자 A·B·로그아웃은 각자, 다른 IP 도 각자, 경로도 각자", async () => {
  const c = clock("2026-10-01T01:00:00.000Z")
  const limiter = createRateLimiter({ store: store(), now: c.now, rules: { tiny: { max: 1, windowSec: 60 } } })
  const ip = freshIp()
  assert.equal((await limiter.check("tiny", { ip, userId: "user-a" })).ok, true)
  assert.equal((await limiter.check("tiny", { ip, userId: "user-a" })).ok, false)
  assert.equal((await limiter.check("tiny", { ip, userId: "user-b" })).ok, true, "B 는 A 의 한도를 나누지 않는다")
  assert.equal((await limiter.check("tiny", { ip })).ok, true, "로그아웃 요청도 따로")
  assert.equal((await limiter.check("tiny", { ip: freshIp(), userId: "user-a" })).ok, true, "다른 IP")
  assert.equal((await limiter.check("inquiry", { ip, userId: "user-a" })).ok, true, "다른 경로")
  assert.notEqual(limiter.key("tiny", { ip, userId: "user-a" }), limiter.key("tiny", { ip, userId: "user-b" }))
})

test("IP 는 Better Auth 와 같은 규칙으로 읽는다 — x-forwarded-for 한 개, 못 찾으면 공용 통 + onNoIp", async () => {
  const noIp = []
  const limiter = createRateLimiter({ store: store(), onNoIp: (r) => noIp.push(r) })
  assert.equal(limiter.ip({ headers: new Headers({ "x-forwarded-for": "203.0.113.9" }) }), "203.0.113.9")
  // 여러 개면(신뢰 프록시 설정 없이) Better Auth 처럼 믿지 않는다
  const multi = limiter.ip({ headers: new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }) })
  assert.notEqual(multi, "203.0.113.9")
  const trusted = createRateLimiter({ store: store(), ipAddress: { trustedProxies: ["10.0.0.0/8"] } })
  assert.equal(trusted.ip({ headers: new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }) }), "203.0.113.9")
  assert.equal(limiter.key("inquiry", { ip: null }), "inquiry|ip:unknown|user:-")
  assert.deepEqual(noIp, ["inquiry"])
  await assert.rejects(limiter.check("nope", { ip: "1.2.3.4" }), /no rate limit rule for route "nope"/)
})

test("기본 규칙: 가입·로그인·재설정은 Better Auth 기본값과 같고, 문의·결제 시작도 덮는다 — 결제 시작 보호 예시", async () => {
  assert.deepEqual(Object.keys(RATE_LIMIT_DEFAULTS).sort(), ["admin:read", "adminAct", "checkoutStart", "inquiry", "newsletter", "passwordReset", "reviewsSubmit", "search", "shopAdmin", "shopCancel", "shopCart", "shopConfirm", "shopOrder", "signIn", "signUp", "storage"])
  assert.deepEqual(RATE_LIMIT_DEFAULTS.signIn, { max: 3, windowSec: 10 })
  assert.deepEqual(RATE_LIMIT_DEFAULTS.passwordReset, { max: 3, windowSec: 60 })
  const c = clock("2026-10-01T02:00:00.000Z")
  const limiter = createRateLimiter({ store: store(), now: c.now })
  const who = { ip: freshIp(), userId: "buyer" }
  for (let i = 0; i < RATE_LIMIT_DEFAULTS.checkoutStart.max; i++) assert.equal(await protect(limiter, { route: "checkoutStart", who }), null)
  assert.deepEqual(await protect(limiter, { route: "checkoutStart", who }), { kind: "rate_limited", retryAfter: 60 })
})

// ── 문의 ───────────────────────────────────────────────────────────────────────

function setup({ turnstile, now = clock("2026-10-01T03:00:00.000Z"), ...rest } = {}) {
  const lines = []
  const mock = createMailer({ mode: "mock", log: (l) => lines.push(l) })
  // 콘솔 줄은 받는 주소를 가린다 → 요청은 따로 남긴다
  const requests = []
  const mailer = { mode: mock.mode, send: (req) => (requests.push(req), mock.send(req)) }
  const cf = fakeSiteverify({ spent: RECORDED.duplicate })
  const ts = turnstile ?? createTurnstile({ mode: "live", secretKey: TEST_SECRET_PASS, fetch: cf.fetch })
  const errors = []
  const svc = createInquiryService({
    db: d,
    mailer,
    limiter: createRateLimiter({ store: store(), now: now.now }),
    turnstile: ts,
    owner: { email: "owner@sampleco.test" },
    productName: "SampleCo",
    now: now.now,
    onError: (e) => errors.push(e.message),
    ...rest,
  })
  const sent = (template) => lines.filter((l) => l.includes(`template=${template}`))
  return { svc, lines, sent, cf, errors, now, requests }
}
const rowsByContact = async (contact) => d.select().from(inquiries).where(eq(inquiries.contact, contact))
const ok = (extra = {}) => ({ name: "Jamie", contact: `c${++ipSeq}@example.com`, message: "Do you offer team plans?", "cf-turnstile-response": DUMMY_TOKEN, ...extra })

test("문의가 저장되고 운영자 알림은 정확히 한 통 — 접수 번호가 블록 ContactReceipt(id·message)로, 보유 기간 30일", async () => {
  const { svc, sent, requests } = setup()
  const input = ok()
  const r = await svc.action({ ip: freshIp(), locale: "ko" })(input)
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.match(r.data.id, /^Q-[0-9A-HJKMNP-TV-Z]{8}$/)
  assert.equal(r.data.message, t("ko", "inquiry.received", { reference: r.data.id }))

  const rows = await rowsByContact(input.contact)
  assert.equal(rows.length, 1)
  const [row] = rows
  assert.deepEqual([row.reference, row.name, row.contactKind, row.message, row.form, row.locale], [r.data.id, "Jamie", "email", input.message, "contact", "ko"])
  assert.equal(row.expiresAt.getTime() - row.createdAt.getTime(), 30 * 86_400_000)
  assert.ok(row.ownerNotifiedAt)
  assert.equal(row.receiptSentAt, null, "접수 확인은 기본으로 보내지 않는다")
  // 저장하지 않는 것: IP·브라우저 정보 칸이 표에 없다
  assert.deepEqual(Object.keys(row).filter((k) => /(^ip|Ip$|ipAddress|agent|token)/i.test(k)), [])

  const notices = sent("inquiryNotice")
  assert.equal(notices.length, 1)
  assert.match(notices[0], new RegExp(`idempotencyKey=inquiry-notice:${row.id}`))
  assert.deepEqual(requests.map((q) => [q.template, q.to]), [["inquiryNotice", "owner@sampleco.test"]])
  assert.deepEqual([requests[0].input.contact, requests[0].input.message, requests[0].input.reference], [input.contact, input.message, r.data.id])
  assert.equal(sent("inquiryReceipt").length, 0)
})

test("같은 멱등 키로 두 번(연달아·동시에) 보내면 문의 행 하나·알림 한 통·같은 접수 번호 — 토큰도 다시 검증하지 않는다(D105)", async () => {
  const { svc, sent, cf } = setup()
  const ip = freshIp()
  const input = ok({ idempotencyKey: "form-open-7f3a9c21" })
  const first = await svc.submit(input, { ip })
  const again = await svc.submit(input, { ip })
  assert.deepEqual(again, first)
  const racing = ok({ idempotencyKey: "form-open-race-0001" })
  const [a, b] = await Promise.all([svc.submit(racing, { ip }), svc.submit(racing, { ip })])
  // 동시 요청: 한쪽이 처리하고 다른 쪽은 같은 결과이거나 「처리 중」(재시도하면 같은 결과)
  const done = [a, b].filter((x) => x.ok)
  assert.equal(done.length >= 1, true)
  for (const x of [a, b]) if (!x.ok) assert.equal(x.code, "in_progress")
  const replay = await svc.submit(racing, { ip })
  assert.equal(replay.data.id, done[0].data.id)

  assert.equal((await rowsByContact(input.contact)).length, 1)
  assert.equal((await rowsByContact(racing.contact)).length, 1)
  assert.equal(sent("inquiryNotice").length, 2, "제출 두 건 → 알림 두 통(중복은 0통)")
  assert.equal(cf.calls.length, 2, "Turnstile 검증도 제출당 한 번")
  // 다른 키면 새 문의다
  // (같은 IP 로 이미 다섯 번 보냈다 — 재생도 한도에 센다. 새 문의는 다른 IP 로)
  const other = await svc.submit({ ...input, idempotencyKey: "form-open-other-01", "cf-turnstile-response": DUMMY_TOKEN }, { ip: freshIp() })
  assert.notEqual(other.data.id, first.data.id)
  assert.equal((await rowsByContact(input.contact)).length, 2)
})

test("실패한 제출은 멱등 키에 남지 않는다 — 칸을 고쳐 같은 키로 다시 보내면 받는다. 처리 중 표시는 1분 뒤 다시 차지한다", async () => {
  const c = clock("2026-10-01T04:00:00.000Z")
  const { svc } = setup({ now: c })
  const ip = freshIp()
  const key = "form-open-fix-0001"
  const bad = await svc.submit(ok({ idempotencyKey: key, message: "" }), { ip })
  assert.equal(bad.ok, false)
  assert.equal((await d.select({ n: count() }).from(idempotencyKeys).where(eq(idempotencyKeys.key, key)))[0].n, 0)
  assert.equal((await svc.submit(ok({ idempotencyKey: key }), { ip })).ok, true)

  // 죽은 요청이 남긴 처리 중 표시
  await d.insert(idempotencyKeys).values({ scope: "inquiry:inquiry", key: "form-open-stuck-01", result: null, createdAt: c.at })
  const stuck = await svc.submit(ok({ idempotencyKey: "form-open-stuck-01" }), { ip })
  assert.deepEqual(stuck, { ok: false, code: "in_progress", retryable: true, formError: MESSAGES.en.protect.inProgress })
  c.tick(61_000)
  assert.equal((await svc.submit(ok({ idempotencyKey: "form-open-stuck-01" }), { ip })).ok, true)
})

test("칸 오류는 블록이 보낸 칸 이름 그대로 fieldErrors(문자열 배열) — 저장·메일·토큰 검증 없음", async () => {
  const { svc, sent, cf } = setup()
  const ip = freshIp()
  // channel-first: contact·message
  const cf1 = await svc.action({ ip, locale: "ko" })({ name: "", contact: "", message: "", "cf-turnstile-response": DUMMY_TOKEN })
  assert.deepEqual(cf1, { ok: false, fieldErrors: { contact: [MESSAGES.ko.inquiry.required], message: [MESSAGES.ko.inquiry.required] } })
  // inline-short: name·phone·message·consent (동의 체크를 받는 폼)
  const strict = setup({ requireConsent: true })
  const inline = await strict.svc.action({ ip: freshIp() })({ name: "x".repeat(101), phone: "call me", message: "hi", "cf-turnstile-response": DUMMY_TOKEN })
  assert.deepEqual(inline, {
    ok: false,
    fieldErrors: { name: [t("en", "inquiry.tooLong", { max: 100 })], phone: [MESSAGES.en.inquiry.contactInvalid], consent: [MESSAGES.en.inquiry.consentRequired] },
  })
  // stepped-booking 모양: phone·request
  const booking = await svc.submit({ name: "Kim", phone: "010-1234-5678", request: "", "cf-turnstile-response": DUMMY_TOKEN }, { ip })
  assert.deepEqual(booking, { ok: false, fieldErrors: { request: [MESSAGES.en.inquiry.required] } })
  // 전화번호·동의 "yes" 는 통과
  const phoneOk = await strict.svc.submit({ name: "Kim", phone: "+82 10-1234-5678", message: "hi", consent: "yes", "cf-turnstile-response": DUMMY_TOKEN }, { ip: freshIp() })
  assert.equal(phoneOk.ok, true)
  const [saved] = await d.select().from(inquiries).where(eq(inquiries.reference, phoneOk.data.id))
  assert.equal(saved.contactKind, "phone")

  assert.equal(cf.calls.length, 0, "칸 오류면 토큰을 태우지 않는다")
  assert.equal(sent("inquiryNotice").length, 0)
  // 프로토타입 칸은 읽지 않는다
  const proto = Object.create({ contact: "a@b.co", message: "inherited" })
  assert.equal((await svc.submit(proto, { ip })).ok, false)
})

test("라우트 처리기: Turnstile 토큰이 없거나 틀리면 400, 한도 초과는 429 + Retry-After, 성공 200 — 막힌 제출은 저장되지 않는다", async () => {
  const { svc, sent } = setup()
  const ip = freshIp()
  const post = (fields) => {
    const body = new FormData()
    for (const [k, v] of Object.entries(fields)) body.set(k, v)
    return svc.handler(new Request("https://sampleco.test/api/inquiry", { method: "POST", body, headers: { "x-forwarded-for": ip } }))
  }
  const missing = ok()
  delete missing["cf-turnstile-response"]
  const r1 = await post(missing)
  assert.equal(r1.status, 400)
  assert.equal((await r1.json()).code, "bot_check_failed")
  const r2 = await post(ok({ "cf-turnstile-response": "forged" }))
  assert.equal(r2.status, 400)
  const r3 = await post(ok({ "cf-turnstile-response": "spent" }))
  assert.equal(r3.status, 400)
  const good = ok()
  const r4 = await post(good)
  assert.equal(r4.status, 200)
  assert.equal((await r4.json()).ok, true)
  // 이 IP 로 네 번 보냈다 → 다섯 번째까지 받고 여섯 번째는 429
  assert.equal((await post(ok({ contact: "" }))).status, 400)
  const r6 = await post(ok())
  assert.equal(r6.status, 429)
  assert.equal(Number(r6.headers.get("retry-after")) > 0, true)
  assert.deepEqual(Object.keys(await r6.json()).sort(), ["code", "formError", "ok", "retryAfter", "retryable"])
  assert.equal((await svc.handler(new Request("https://sampleco.test/api/inquiry"))).status, 405)
  for (const f of [missing, good]) assert.equal((await rowsByContact(f.contact)).length, f === good ? 1 : 0)
  assert.equal(sent("inquiryNotice").length, 1)
})

test("mock 모드 Turnstile 은 토큰 없이 통과한다(키 없는 개발 흐름) — 서버 액션 한도 초과는 code·retryAfter(D104)", async () => {
  const { svc } = setup({ turnstile: createTurnstile({ mode: "mock" }) })
  const ip = freshIp()
  const noToken = ok()
  delete noToken["cf-turnstile-response"]
  assert.equal((await svc.submit(noToken, { ip })).ok, true)
  for (let i = 0; i < 4; i++) await svc.submit(ok({ message: "" }), { ip })
  const limited = await svc.submit(ok(), { ip, locale: "ko" })
  assert.equal(limited.ok, false)
  assert.equal(limited.code, "rate_limited")
  assert.equal(limited.retryAfter, 600)
  assert.equal(limited.formError, "요청이 너무 많아요. 600초 뒤에 다시 해 주세요.")
})

test("접수 확인은 켰을 때만, 이메일 연락처에만 — 방문자가 쓴 글은 싣지 않는다. 알림 실패는 저장을 되돌리지 않는다", async () => {
  const { svc, sent, lines } = setup({ receipt: true })
  const input = ok({ name: "Click https://evil.example", message: "Visit https://evil.example now" })
  const r = await svc.submit(input, { ip: freshIp(), locale: "ko" })
  assert.equal(r.ok, true)
  const receipt = sent("inquiryReceipt")
  assert.equal(receipt.length, 1)
  const receiptBlock = lines.find((l) => l.includes("template=inquiryReceipt"))
  assert.equal(receiptBlock.includes("evil.example"), false, "방문자 글이 접수 확인 메일에 없다")
  assert.ok(receiptBlock.includes(r.data.id))
  assert.ok((await rowsByContact(input.contact))[0].receiptSentAt)
  // 전화 연락처면 보내지 않는다
  await svc.submit({ name: "Kim", contact: "010-9876-5432", message: "hi", "cf-turnstile-response": DUMMY_TOKEN }, { ip: freshIp() })
  assert.equal(sent("inquiryReceipt").length, 1)

  // 메일 공급자 실패 → 문의는 저장되고 성공, ownerNotifiedAt 은 비고 onError 로 알린다
  const failing = { mode: "live", send: async () => ({ ok: false, mode: "live", error: { name: "rate_limit_exceeded", statusCode: 429, message: "slow down" } }) }
  const f = setup({ mailer: failing })
  const fr = await f.svc.submit(ok(), { ip: freshIp() })
  assert.equal(fr.ok, true)
  const [saved] = await d.select().from(inquiries).where(eq(inquiries.reference, fr.data.id))
  assert.equal(saved.ownerNotifiedAt, null)
  assert.match(f.errors[0], /owner notice failed \(rate_limit_exceeded\)/)
})

test("보유 기간: 기본 30일 뒤 파기, 분쟁 기록은 3년(전자상거래법 시행령 제6조①4) — 고지 표 데이터와 같은 값", async () => {
  const c = clock("2026-10-02T00:00:00.000Z")
  const { svc } = setup({ now: c })
  const r = await svc.submit(ok(), { ip: freshIp() })
  const dispute = setup({ now: c, retain: { kind: "dispute" } })
  const rd = await dispute.svc.submit(ok(), { ip: freshIp() })
  const [kept] = await d.select().from(inquiries).where(eq(inquiries.reference, rd.data.id))
  assert.equal(kept.expiresAt.toISOString(), "2029-10-02T00:00:00.000Z")

  c.tick(30 * 86_400_000 + 1)
  const purged = await svc.purgeExpired()
  assert.ok(purged >= 1)
  assert.equal((await d.select().from(inquiries).where(eq(inquiries.reference, r.data.id))).length, 0)
  assert.equal((await d.select().from(inquiries).where(eq(inquiries.reference, rd.data.id))).length, 1)

  // 고지 표(개인정보 보호법 제15조②·D29 방식): 칸 키가 ko·en 에 있고, 기간 값이 서비스 설정과 같다
  const [row] = privacyCollections()
  assert.deepEqual(row.retention, { key: "collection.retention.days", vars: { days: 30 } })
  assert.equal(row.basis, "collection.basis.request")
  assert.equal(privacyCollections({ inquiryConsent: true })[0].basis, "collection.basis.consent")
  assert.deepEqual(privacyCollections({ inquiryRetention: { kind: "dispute" } })[0].retention, { key: "collection.retention.dispute" })
  for (const locale of ["ko", "en"]) {
    for (const key of [row.items, row.purpose, row.basis, row.refuse, ...Object.values(COLLECTION_COLUMN_KEYS)]) assert.ok(t(locale, key))
    assert.match(t(locale, row.retention.key, row.retention.vars), /30/)
  }
})

test("로그인한 채 보낸 문의는 사용자와 이어지고, 탈퇴하면 연결만 끊긴다", async () => {
  const at = new Date("2026-10-01T00:00:00.000Z")
  await d.insert(userTable).values({ id: "inq-user", name: "x", email: "inq-user@example.com", emailVerified: true, createdAt: at, updatedAt: at })
  const { svc } = setup()
  const r = await svc.submit(ok(), { ip: freshIp(), userId: "inq-user" })
  await d.delete(userTable).where(eq(userTable.id, "inq-user"))
  const [row] = await d.select().from(inquiries).where(eq(inquiries.reference, r.data.id))
  assert.equal(row.userId, null)
})

test("설정 오류는 켤 때 멈춘다 — 운영자 메일·서비스 이름·보유 기간", () => {
  const base = { db: d, mailer: createMailer({ mode: "mock", log: () => {} }), limiter: createRateLimiter({ store: store() }), turnstile: createTurnstile({ mode: "mock" }), productName: "P" }
  assert.throws(() => createInquiryService({ ...base, owner: { email: "" } }), /INQUIRY_OWNER_EMAIL/)
  assert.throws(() => createInquiryService({ ...base, owner: { email: "o@p.test" }, productName: "" }), /productName/)
  assert.throws(() => createInquiryService({ ...base, owner: { email: "o@p.test" }, retain: { kind: "days", days: 0 } }), /retain.days/)
})

// ── D134: 문의 종류(kind)와 보유 기간 — 일반 30일, 불만·분쟁 3년 (운영자 판정 2026-09-30 03:35) ─────────────────────────────

const DAY = 86_400_000
const ADMIN = { userId: "adm-1", role: "admin" }
const OWNER = { userId: "own-1", isOwner: true }
const STAFF = { userId: "stf-1", role: "member" }
const row = async (reference) => (await d.select().from(inquiries).where(eq(inquiries.reference, reference)))[0]
const actionsFor = async (reference) => (await d.select().from(adminActions)).filter((a) => a.meta?.reference === reference)
const submitKind = async (svc, category) => (await svc.submit(ok(category === undefined ? {} : { category }), { ip: freshIp() })).data.id

test("폼 category 가 kind 로 — 모르는 값·빈 값·없음은 general. 일반 종류는 30일, 불만·분쟁은 3년 뒤 파기", async () => {
  const c = clock("2026-10-03T00:00:00.000Z")
  const { svc } = setup({ now: c })
  const cases = [
    [undefined, "general"], ["", "general"], ["nonsense", "general"], ["__proto__", "general"],
    ["general", "general"], ["consultation", "consultation"], [" Quote ", "quote"],
    ["complaint", "complaint"], ["DISPUTE", "dispute"],
  ]
  for (const [category, kind] of cases) {
    assert.equal(kindFromCategory(category), kind, `함수 ${JSON.stringify(category)}`)
    const r = await row(await submitKind(svc, category))
    assert.equal(r.kind, kind, `저장 ${JSON.stringify(category)}`)
    if (kind === "complaint" || kind === "dispute") assert.equal(r.expiresAt.toISOString(), "2029-10-03T00:00:00.000Z", kind)
    else assert.equal(r.expiresAt.getTime() - r.createdAt.getTime(), 30 * DAY, kind)
  }
  // 칸이 문자열이 아니면(배열 등) 무시 — general
  assert.equal(kindFromCategory(["complaint"]), "general")
})

test("승격은 기간을 늘린다 — 관리자가 general → complaint 로 올리면 접수일 기준 3년, admin_actions 한 줄(이전·이후 종류·만료 시각)", async () => {
  const c = clock("2026-10-04T00:00:00.000Z")
  const { svc } = setup({ now: c })
  const ref = await submitKind(svc)
  c.tick(10 * DAY)
  const r = await svc.markAsComplaint(ref, ADMIN, { reason: "환불 항의" })
  assert.deepEqual(r, { ok: true, changed: true, kind: "complaint", expiresAt: new Date("2029-10-04T00:00:00.000Z") })
  const saved = await row(ref)
  assert.equal(saved.kind, "complaint")
  assert.equal(saved.expiresAt.toISOString(), "2029-10-04T00:00:00.000Z", "접수일(created_at)에서 3년 — 승격한 날이 아니다")
  const acts = await actionsFor(ref)
  assert.equal(acts.length, 1)
  assert.equal(acts[0].adminUserId, "adm-1")
  assert.equal(acts[0].action, "inquiry_kind_change")
  assert.equal(acts[0].reason, "환불 항의")
  assert.deepEqual([acts[0].meta.from, acts[0].meta.to, acts[0].meta.expiresFrom, acts[0].meta.expiresTo], ["general", "complaint", "2026-11-03T00:00:00.000Z", "2029-10-04T00:00:00.000Z"])
  // 개인정보(연락처·내용)는 기록에 옮기지 않는다
  assert.equal(JSON.stringify(acts[0]).includes(saved.contact), false)
  assert.equal(JSON.stringify(acts[0]).includes(saved.message), false)
  // 같은 종류로 다시 하면 바뀐 것이 없다 — 기록도 없다
  assert.deepEqual(await svc.markAsComplaint(ref, ADMIN), { ok: true, changed: false, kind: "complaint", expiresAt: new Date("2029-10-04T00:00:00.000Z") })
  assert.equal((await actionsFor(ref)).length, 1)
  // 30일이 지나도 파기되지 않는다
  c.tick(40 * DAY)
  await svc.purgeExpired()
  assert.ok(await row(ref))
})

test("강등은 기간을 줄이고 관리자만 한다 — 소유자·직원은 거절, 거절은 행도 기록도 바꾸지 않는다. 강등 뒤 30일이 지났으면 다음 파기에서 지워진다", async () => {
  const c = clock("2026-10-05T00:00:00.000Z")
  const { svc } = setup({ now: c })
  const ref = await submitKind(svc, "complaint")
  const before = await row(ref)
  for (const actor of [OWNER, STAFF, { userId: "x", role: null }, { userId: "x" }]) {
    assert.deepEqual(await svc.reclassify(ref, "general", actor), { ok: false, error: "forbidden" }, JSON.stringify(actor))
  }
  assert.deepEqual(await row(ref), before)
  assert.equal((await actionsFor(ref)).length, 0)

  assert.equal(DISPUTE_DOWNGRADE_ADMIN_ONLY, true, "강등 관리자 전용 — 대표 확정 2026-09-30 04:06, 한 줄 상수")
  c.tick(40 * DAY)
  const r = await svc.reclassify(ref, "general", ADMIN, { reason: "오분류" })
  assert.equal(r.ok, true)
  assert.equal((await row(ref)).expiresAt.toISOString(), "2026-11-04T00:00:00.000Z", "접수일 + 30일 — 이미 지났다")
  assert.equal((await actionsFor(ref)).length, 1)
  assert.equal((await svc.purgeExpired()) >= 1, true)
  assert.equal(await row(ref), undefined)
})

test("권한: 불만·분쟁 경계를 넘는 변경은 관리자만, 같은 등급끼리는 소유자 또는 관리자 — 그 밖은 거절. 역할은 쉼표 목록이고 부분 문자열은 관리자가 아니다", async () => {
  const c = clock("2026-10-06T00:00:00.000Z")
  const { svc } = setup({ now: c })
  const ref = await submitKind(svc)
  // 승격: 소유자·직원 거절
  for (const actor of [OWNER, STAFF]) assert.deepEqual(await svc.reclassify(ref, "complaint", actor), { ok: false, error: "forbidden" })
  assert.equal((await row(ref)).kind, "general")
  // 일반끼리: 소유자 OK, 관리자 OK, 직원 거절
  assert.equal((await svc.reclassify(ref, "quote", OWNER)).ok, true)
  assert.equal((await svc.reclassify(ref, "consultation", ADMIN)).ok, true)
  assert.deepEqual(await svc.reclassify(ref, "general", STAFF), { ok: false, error: "forbidden" })
  assert.equal((await row(ref)).kind, "consultation")
  assert.equal((await actionsFor(ref)).length, 2, "바뀐 것마다 한 줄")
  // 불만 ↔ 분쟁(같은 3년 등급)은 경계를 넘지 않는다 — 소유자 OK
  await svc.reclassify(ref, "complaint", ADMIN)
  assert.equal((await svc.reclassify(ref, "dispute", OWNER)).ok, true)
  assert.equal((await row(ref)).expiresAt.toISOString(), "2029-10-06T00:00:00.000Z")
  // 역할 읽기(Better Auth admin: 쉼표 목록, adminRoles 기본 ["admin"])
  assert.equal(isAdminActor({ userId: "u", role: "member,admin" }), true)
  assert.equal(isAdminActor({ userId: "u", role: " admin " }), true)
  assert.equal(isAdminActor({ userId: "u", role: "administrator" }), false)
  assert.equal(isAdminActor({ userId: "u", role: "superadmin,member" }), false)
  assert.equal(isAdminActor({ userId: "u", role: "ops" }, { adminRoles: ["ops"] }), true)
  assert.equal(isAdminActor({ userId: "u", role: "admin" }, { adminRoles: ["ops"] }), false)
  assert.equal(isAdminActor({ userId: "boss" }, { adminUserIds: ["boss"] }), true)
  // 알 수 없는 종류·없는 접수 번호
  assert.deepEqual(await svc.reclassify(ref, "vip", ADMIN), { ok: false, error: "invalid_kind" })
  assert.deepEqual(await svc.reclassify("Q-NOSUCH00", "general", ADMIN), { ok: false, error: "not_found" })
  // 서비스 옵션의 adminRoles 를 따른다
  const ops = setup({ now: c, adminRoles: ["ops"] })
  const ref2 = await submitKind(ops.svc)
  assert.deepEqual(await ops.svc.markAsComplaint(ref2, ADMIN), { ok: false, error: "forbidden" })
  assert.equal((await ops.svc.markAsComplaint(ref2, { userId: "o", role: "ops" })).ok, true)
})

test("변경과 admin_actions 는 한 트랜잭션 — 기록을 못 쓰면 문의 행도 그대로", async () => {
  const c = clock("2026-10-07T00:00:00.000Z")
  const { svc } = setup({ now: c })
  const ref = await submitKind(svc)
  const before = await row(ref)
  await d.execute(sql`create function public.t_no_log() returns trigger language plpgsql as $$ begin raise exception 'audit blocked'; end $$`)
  await d.execute(sql`create trigger t_no_log before insert on admin_actions for each row execute function public.t_no_log()`)
  try {
    await assert.rejects(() => svc.markAsComplaint(ref, ADMIN), /audit blocked|Failed query/)
  } finally {
    await d.execute(sql`drop trigger t_no_log on admin_actions`)
    await d.execute(sql`drop function public.t_no_log()`)
  }
  assert.deepEqual(await row(ref), before, "기록이 실패하면 종류·만료 시각이 바뀌지 않는다")
  assert.equal((await actionsFor(ref)).length, 0)
  assert.equal((await svc.markAsComplaint(ref, ADMIN)).ok, true, "트리거를 지우면 다시 된다")
})

test("고지 표 기간 문구에 「불만·분쟁 3년」 — ko·en 모두, 숫자 일수는 그대로", () => {
  for (const locale of ["ko", "en"]) {
    const text = t(locale, "collection.retention.days", { days: 30 })
    assert.match(text, /30/)
    assert.match(text, locale === "ko" ? /불만·분쟁.*3년/ : /complaint.*dispute.*3 years/i)
  }
})

test("LFUX2 K06: responseTime 을 주면 접수 확인 메일 입력에 첫 응답 약속이 실리고, 안 주면 없다(접수 번호는 늘 실린다)", async () => {
  const withPromise = setup({ receipt: true, responseTime: "1 business day" })
  const r = await withPromise.svc.submit(ok(), { ip: freshIp(), locale: "en" })
  assert.equal(r.ok, true, JSON.stringify(r))
  const [mail] = withPromise.requests.filter((q) => q.template === "inquiryReceipt")
  assert.equal(mail.input.responseTime, "1 business day")
  assert.equal(mail.input.reference, r.data.id)
  assert.deepEqual(withPromise.errors, [], "메일 렌더·전송 오류가 없다")

  const without = setup({ receipt: true })
  await without.svc.submit(ok(), { ip: freshIp(), locale: "en" })
  const [plain] = without.requests.filter((q) => q.template === "inquiryReceipt")
  assert.equal("responseTime" in plain.input, false)
})

// ── LFENV: 운영자 메일이 없으면 문의 창구만 꺼진다(운영자 결정 2026-10-05). 켜진 척 저장하고 알림을 버리지 않는다 ─────────────────────

test("LFENV 켜짐(대조군): owner 가 있으면 enabled 이고 접수된다 — 같은 입력이 꺼진 쪽에서는 거절된다", async () => {
  const on = setup()
  assert.equal(on.svc.enabled, true)
  const r = await on.svc.submit(ok(), { ip: freshIp(), locale: "en" })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(on.sent("inquiryNotice").length, 1)
})

test("LFENV 꺼짐: owner 가 없으면 provider_unavailable(retryable false)로 거절하고 — 저장·알림·요청 제한·봇 확인 어디에도 닿지 않는다", async () => {
  const off = setup({ owner: undefined })
  assert.equal(off.svc.enabled, false)
  const input = ok()
  const inquiriesBefore = (await d.select({ n: count() }).from(inquiries))[0].n
  const rateBefore = (await d.execute(sql`select count(*)::int as n from rate_limits`)).rows[0].n

  for (const locale of ["en", "ko"]) {
    const r = await off.svc.action({ ip: freshIp(), locale })(input)
    assert.deepEqual(r, { ok: false, code: "provider_unavailable", retryable: false, formError: t(locale, "inquiry.unavailable") })
  }
  assert.equal(t("en", "inquiry.unavailable"), "We're not accepting messages right now.")
  assert.equal((await rowsByContact(input.contact)).length, 0, "받은 척 저장하지 않는다")
  assert.equal(off.requests.length, 0, "메일이 한 통도 안 나간다")
  assert.equal(off.cf.calls.length, 0, "봇 확인에도 닿지 않는다")
  assert.equal((await d.select({ n: count() }).from(inquiries))[0].n, inquiriesBefore)
  assert.equal((await d.execute(sql`select count(*)::int as n from rate_limits`)).rows[0].n, rateBefore, "요청 제한 표도 쓰지 않는다")
})

test("LFENV 꺼짐: 라우트 처리기는 503 + 같은 JSON(code provider_unavailable) — Retry-After 없음, GET 은 그대로 405", async () => {
  const off = setup({ owner: undefined })
  const res = await off.svc.handler(new Request("https://x.test/api/inquiry", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": freshIp() }, body: JSON.stringify(ok()) }))
  assert.equal(res.status, 503)
  assert.equal(res.headers.get("retry-after"), null)
  const body = await res.json()
  assert.deepEqual([body.ok, body.code, body.retryable], [false, "provider_unavailable", false])
  assert.equal((await off.svc.handler(new Request("https://x.test/api/inquiry"))).status, 405)
})

test("LFENV 꺼짐: 이미 받은 문의의 파기·종류 변경은 그대로 된다 — 불만 3년 보관·30일 파기는 창구와 별개의 의무다", async () => {
  const c = clock("2026-10-05T00:00:00.000Z")
  const on = setup({ now: c })
  const ref = await submitKind(on.svc)
  const off = setup({ owner: undefined, now: c })
  const up = await off.svc.markAsComplaint(ref, ADMIN, { reason: "창구 꺼진 동안 승격" })
  assert.equal(up.ok, true, JSON.stringify(up))
  assert.equal((await row(ref)).kind, "complaint")
  assert.deepEqual(await off.svc.reclassify(ref, "general", OWNER), { ok: false, error: "forbidden" }, "소유자 판정은 그대로(경계를 넘는 변경은 관리자만)")
  const stale = await submitKind(on.svc)
  c.tick(31 * DAY)
  assert.equal((await off.svc.purgeExpired()) >= 1, true)
  assert.equal(await row(stale), undefined)
})

test("LFENV 설정 오류: owner 를 준 채 이메일이 아니면 여전히 켤 때 멈춘다(켜진 척하며 메일이 안 가는 것이 가장 나쁘다) — 빼는 것만 꺼짐이다", () => {
  const base = { db: d, mailer: createMailer({ mode: "mock", log: () => {} }), limiter: createRateLimiter({ store: store() }), turnstile: createTurnstile({ mode: "mock" }), productName: "P" }
  for (const email of ["", "not-an-email", "a@b"]) assert.throws(() => createInquiryService({ ...base, owner: { email } }), /valid owner\.email/, JSON.stringify(email))
  assert.equal(createInquiryService({ ...base }).enabled, false)
})
