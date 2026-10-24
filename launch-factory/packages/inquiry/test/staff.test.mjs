// 직원용 읽기·답변(계획 3d 관리 화면) — 목록(상태·검색)·상세(글타래)·답변(저장 + 메일 + 기록), 관리자·소유자만.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { adminActions, db, hitRateLimit, inquiryReplies, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { createInquiryService, REPLY_MAX } from "../src/index.ts"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
  const at = new Date("2026-10-01T00:00:00.000Z")
  for (const id of ["adm-s", "own-s"]) await d.insert(userTable).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
})
after(async () => {
  await d?.$client.close()
})

const ADMIN = { userId: "adm-s", role: "admin" }
const OWNER = { userId: "own-s", isOwner: true }
const NOBODY = [{ userId: "x1", role: "member" }, { userId: "x2", role: null }, { userId: "x3" }]
let seq = 0
const setup = (extra = {}) => {
  const requests = []
  const errors = []
  const mock = createMailer({ mode: "mock", log: () => {} })
  const svc = createInquiryService({
    db: d,
    mailer: extra.mailer ?? { mode: mock.mode, send: (req) => (requests.push(req), mock.send(req)) },
    limiter: createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) } }),
    turnstile: createTurnstile({ mode: "mock" }),
    owner: { email: "owner@sampleco.test" },
    productName: "SampleCo",
    onError: (e) => errors.push(e.message),
  })
  return { svc, requests, errors }
}
const send = async (svc, extra = {}) => {
  const n = ++seq
  const r = await svc.submit({ name: `Visitor ${n}`, contact: `v${n}@example.com`, message: `Question number ${n}`, "cf-turnstile-response": "x", ...extra }, { ip: `203.0.113.${(n % 200) + 1}`, locale: "en" })
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data.id
}

test("직원 읽기·답변은 관리자 또는 소유자만 — 직원·무역할은 forbidden 이고 아무것도 읽거나 쓰지 않는다", async () => {
  const { svc, requests } = setup()
  const ref = await send(svc)
  for (const who of NOBODY) {
    assert.deepEqual(await svc.listForStaff(who), { ok: false, error: "forbidden" }, JSON.stringify(who))
    assert.deepEqual(await svc.getForStaff(who, ref), { ok: false, error: "forbidden" })
    assert.deepEqual(await svc.reply(who, { reference: ref, body: "hi" }), { ok: false, error: "forbidden" })
  }
  assert.equal((await d.select().from(inquiryReplies)).length, 0)
  assert.equal(requests.filter((r) => r.template === "inquiryReply").length, 0)
})

test("목록: 최신 순·상태 거르기·검색(접수 번호·이름·연락처, 와일드카드는 글자 그대로)·알 수 없는 상태는 invalid_input", async () => {
  const { svc } = setup()
  const a = await send(svc, { name: "Alpha Kim", contact: "alpha-kim@example.com" })
  const b = await send(svc, { name: "Beta 100%", contact: "beta@example.com" })
  assert.equal((await svc.setStatus(ADMIN, { reference: a, status: "done" })).ok, true)

  const all = await svc.listForStaff(OWNER, {})
  assert.equal(all.ok, true)
  const refs = all.data.items.map((i) => i.reference)
  assert.ok(refs.indexOf(b) < refs.indexOf(a), "최신 순")
  assert.ok(all.data.total >= 2)
  const row = all.data.items.find((i) => i.reference === a)
  assert.deepEqual([row.name, row.contact, row.contactKind, row.status, row.kind], ["Alpha Kim", "alpha-kim@example.com", "email", "done", "general"])
  assert.ok(row.preview.startsWith("Question number"))

  const done = await svc.listForStaff(ADMIN, { status: "done" })
  assert.ok(done.data.items.every((i) => i.status === "done") && done.data.items.some((i) => i.reference === a))
  assert.deepEqual((await svc.listForStaff(ADMIN, { search: "alpha-KIM" })).data.items.map((i) => i.reference), [a], "대소문자 무시")
  assert.deepEqual((await svc.listForStaff(ADMIN, { search: b })).data.items.map((i) => i.reference), [b], "접수 번호")
  assert.deepEqual((await svc.listForStaff(ADMIN, { search: "100%" })).data.items.map((i) => i.reference), [b], "% 는 글자 그대로")
  assert.equal((await svc.listForStaff(ADMIN, { search: "%" })).data.items.length, 1, "와일드카드로 전부 찾지 않는다")
  assert.deepEqual(await svc.listForStaff(ADMIN, { status: "archived" }), { ok: false, error: "invalid_input" })
  assert.equal((await svc.listForStaff(ADMIN, { limit: 1 })).data.items.length, 1)
})

test("상세: 전체 내용과 답변 글타래(오래된 순), 사용자 id 는 없다. 없는 접수 번호는 not_found", async () => {
  const { svc } = setup()
  const ref = await send(svc, { message: "A long message about team plans" })
  assert.deepEqual((await svc.getForStaff(OWNER, ref)).data.replies, [])
  await svc.reply(ADMIN, { reference: ref, body: "First answer" })
  await svc.reply(OWNER, { reference: ref, body: "Second answer" })
  const got = await svc.getForStaff(ADMIN, ref)
  assert.equal(got.data.message, "A long message about team plans")
  assert.deepEqual(got.data.replies.map((r) => r.body), ["First answer", "Second answer"])
  assert.ok(!("userId" in got.data) && got.data.replies.every((r) => !("adminUserId" in r)))
  assert.deepEqual(await svc.getForStaff(ADMIN, "Q-NOSUCH00"), { ok: false, error: "not_found" })
  assert.deepEqual(await svc.getForStaff(ADMIN, ""), { ok: false, error: "not_found" })
})

test("답변: 저장하고, 이메일 연락처로 메일을 보내며(답변 글만 — 방문자 글 없음), admin_actions 한 줄에는 글·연락처가 없다", async () => {
  const { svc, requests } = setup()
  const ref = await send(svc, { name: "Jamie", contact: "jamie@example.com", message: "SECRET-VISITOR-TEXT" })
  const r = await svc.reply(ADMIN, { reference: ref, body: "  We can do that.\nSee you soon.  " })
  assert.equal(r.ok, true)
  assert.equal(r.data.mailed, true)
  const mail = requests.find((q) => q.template === "inquiryReply")
  assert.equal(mail.to, "jamie@example.com")
  assert.equal(mail.input.reference, ref)
  assert.equal(mail.input.reply, "We can do that.\nSee you soon.")
  assert.ok(!JSON.stringify(mail.input).includes("SECRET-VISITOR-TEXT") && !JSON.stringify(mail.input).includes("Jamie"))
  assert.equal(mail.idempotencyKey, `inquiry-reply:${r.data.id}`)

  const [row] = await d.select().from(inquiryReplies)
  assert.ok(row.mailedAt, "메일이 나갔다고 적힌다")
  const logged = (await d.select().from(adminActions)).filter((a) => a.action === "inquiry_reply" && a.meta?.reference === ref)
  assert.equal(logged.length, 1)
  assert.equal(logged[0].adminUserId, ADMIN.userId)
  assert.doesNotMatch(JSON.stringify(logged[0]), /We can do that|jamie@example/)
})

test("답변 중복 전송 방지 키: 같은 키로 다시 보내면 답변·메일·행동 기록을 또 만들지 않고 첫 결과를 돌려준다", async () => {
  const { svc, requests } = setup()
  const ref = await send(svc)
  const key = "reply-key-0001"
  const first = await svc.reply(ADMIN, { reference: ref, body: "One answer", idempotencyKey: key })
  assert.equal(first.ok, true)
  const again = await svc.reply(ADMIN, { reference: ref, body: "One answer", idempotencyKey: key })
  assert.deepEqual(again, first, "같은 결과(같은 답변 id)")
  assert.equal((await svc.getForStaff(ADMIN, ref)).data.replies.length, 1)
  assert.equal(requests.filter((q) => q.template === "inquiryReply").length, 1, "메일도 한 번")
  assert.equal((await d.select().from(adminActions)).filter((a) => a.action === "inquiry_reply" && a.meta?.reference === ref).length, 1)

  // 다른 키는 새 답변이다. 키가 없으면 예전처럼 매번 새 답변이다
  assert.equal((await svc.reply(ADMIN, { reference: ref, body: "Second", idempotencyKey: "reply-key-0002" })).ok, true)
  assert.equal((await svc.reply(ADMIN, { reference: ref, body: "Third" })).ok, true)
  assert.equal((await svc.getForStaff(ADMIN, ref)).data.replies.length, 3)
})

test("답변 중복 전송 방지 키: 보낸 사람·문의마다 따로 묶고, 실패한 요청은 기억하지 않으며, 틀린 키 모양은 거절한다", async () => {
  const { svc } = setup()
  const a = await send(svc)
  const b = await send(svc)
  const key = "shared-key-0001"
  const r1 = await svc.reply(ADMIN, { reference: a, body: "For A", idempotencyKey: key })
  const r2 = await svc.reply(ADMIN, { reference: b, body: "For B", idempotencyKey: key })
  const r3 = await svc.reply(OWNER, { reference: a, body: "By owner", idempotencyKey: key })
  assert.deepEqual([r1.ok, r2.ok, r3.ok], [true, true, true])
  assert.equal(new Set([r1.data.id, r2.data.id, r3.data.id]).size, 3, "다른 문의·다른 사람의 같은 키는 서로의 결과를 되살리지 않는다")

  // 없는 접수 번호(실패)는 기억하지 않는다 — 같은 키로 고쳐 다시 보낼 수 있다
  assert.deepEqual(await svc.reply(ADMIN, { reference: "Q-NOSUCH00", body: "x", idempotencyKey: "retry-key-0001" }), { ok: false, error: "not_found" })
  assert.deepEqual(await svc.reply(ADMIN, { reference: "Q-NOSUCH00", body: "x", idempotencyKey: "retry-key-0001" }), { ok: false, error: "not_found" })

  for (const bad of ["short", "has space in it", "x".repeat(101), "한글한글한글한글한글", 12345678, null]) assert.deepEqual(await svc.reply(ADMIN, { reference: a, body: "x", idempotencyKey: bad }), { ok: false, error: "invalid_input" }, String(bad))
  assert.equal((await svc.getForStaff(ADMIN, a)).data.replies.length, 2, "거절된 키로는 아무것도 저장되지 않는다")
  // 권한 벽이 키보다 먼저다
  assert.deepEqual(await svc.reply(NOBODY[0], { reference: a, body: "x", idempotencyKey: "denied-key-0001" }), { ok: false, error: "forbidden" })
})

test("답변: 전화 연락처는 저장만(mailed false), 메일이 실패해도 답변은 남는다, 빈 글·너무 긴 글·없는 번호는 거절", async () => {
  const { svc, requests } = setup()
  const phone = await send(svc, { contact: "010-1234-5678" })
  assert.deepEqual((await svc.reply(ADMIN, { reference: phone, body: "Called you back" })).data.mailed, false)
  assert.equal(requests.filter((q) => q.template === "inquiryReply").length, 0)

  const failing = setup({ mailer: { mode: "mock", send: async () => ({ ok: false, error: { name: "MailerDown" } }) } })
  const ref = await send(failing.svc)
  const r = await failing.svc.reply(OWNER, { reference: ref, body: "Answer" })
  assert.deepEqual([r.ok, r.data.mailed], [true, false])
  assert.equal((await failing.svc.getForStaff(OWNER, ref)).data.replies.length, 1)
  const replyErrors = failing.errors.filter((m) => m.includes("reply mail failed"))
  assert.equal(replyErrors.length, 1)
  assert.match(replyErrors[0], /\(MailerDown\)/)
  assert.doesNotMatch(replyErrors[0], /@example\.com/, "오류 글에 연락처가 없다")

  for (const body of ["", "   ", "x".repeat(REPLY_MAX + 1), 5, undefined]) assert.deepEqual(await svc.reply(ADMIN, { reference: ref, body }), { ok: false, error: "invalid_input" }, String(body))
  assert.deepEqual(await svc.reply(ADMIN, { reference: "Q-NOSUCH00", body: "x" }), { ok: false, error: "not_found" })
})

test("문의가 파기되면 답변도 함께 지워진다(보유 기간은 문의 것을 따른다)", async () => {
  const { svc } = setup()
  const ref = await send(svc)
  await svc.reply(ADMIN, { reference: ref, body: "Gone with the inquiry" })
  const before = (await d.select().from(inquiryReplies)).length
  const purged = await createInquiryService({ db: d, mailer: createMailer({ mode: "mock", log: () => {} }), limiter: createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) } }), turnstile: createTurnstile({ mode: "mock" }), productName: "P", now: () => new Date("2099-01-01T00:00:00.000Z") }).purgeExpired()
  assert.ok(purged >= 1)
  assert.ok(before >= 1)
  assert.equal((await d.select().from(inquiryReplies)).length, 0)
})
