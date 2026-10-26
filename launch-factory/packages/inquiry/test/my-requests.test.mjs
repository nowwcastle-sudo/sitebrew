// 내 신청 내역(계획 3c Task 5) — 문의 확장: 상태 열, 자기 것만 보이는 목록(연락처·내용은 가린 앞부분만), 관리자·소유자의 상태 변경.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { adminActions, db, hitRateLimit, inquiries, INQUIRY_STATUSES, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { createInquiryService } from "../src/index.ts"
import { maskContact, maskedPreview, PREVIEW_CHARS } from "../src/my-requests.ts"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
  const at = new Date("2026-10-01T00:00:00.000Z")
  for (const id of ["mr-a", "mr-b"]) await d.insert(userTable).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
})
after(async () => {
  await d?.$client.close()
})

const clock = (iso) => {
  const c = { at: new Date(iso) }
  c.now = () => c.at
  c.tick = (ms) => (c.at = new Date(c.at.getTime() + ms))
  return c
}
let seq = 0
const setup = (now = clock("2026-10-10T00:00:00.000Z")) => ({
  now,
  svc: createInquiryService({
    db: d,
    mailer: createMailer({ mode: "mock", log: () => {} }),
    limiter: createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now: now.now }),
    turnstile: createTurnstile({ mode: "mock" }),
    owner: { email: "owner@sampleco.test" },
    productName: "SampleCo",
    now: now.now,
    onError: () => {},
  }),
})
const send = async (svc, userId, extra = {}) => {
  const r = await svc.submit({ contact: `mr${++seq}@example.com`, message: "무엇이 궁금해요", "cf-turnstile-response": "x", ...extra }, { ip: `203.0.113.${(seq % 200) + 1}`, userId })
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data.id
}
const ADMIN = { userId: "adm-1", role: "admin" }
const OWNER = { userId: "own-1", isOwner: true }
const STAFF = { userId: "stf-1", role: "member" }
const actionsFor = async (reference) => (await d.select().from(adminActions)).filter((a) => a.meta?.reference === reference)

// ── 순수 마스킹 ─────────────────────────────────────────────────────────────

test("연락처 마스킹: 이메일은 첫 글자와 도메인만, 전화는 끝 네 자리만 — 원본을 되살릴 수 없다", () => {
  assert.equal(maskContact("alice@example.com", "email"), "a***@example.com")
  assert.equal(maskContact("a@example.com", "email"), "*@example.com")
  assert.equal(maskContact("010-1234-5678", "phone"), "***5678")
  assert.equal(maskContact("+82 10 1234 5678", "phone"), "***5678")
  assert.equal(maskContact("12", "phone"), "***")
})

test("내용 미리보기: 앞 40자만, 넘으면 말줄임표, 안에 든 이메일·전화번호는 가린다, 이모지를 반으로 자르지 않는다", () => {
  assert.equal(maskedPreview("짧은 글"), "짧은 글")
  const long = "가".repeat(100)
  assert.equal(maskedPreview(long), `${"가".repeat(PREVIEW_CHARS)}…`)
  assert.equal(PREVIEW_CHARS, 40)
  assert.equal(maskedPreview("연락은 bob@corp.test 로"), "연락은 b***@corp.test 로")
  assert.equal(maskedPreview("전화 010-9999-8888 입니다"), "전화 ***8888 입니다")
  const emoji = "😀".repeat(50)
  assert.equal(maskedPreview(emoji), `${"😀".repeat(PREVIEW_CHARS)}…`)
})

// ── 상태 열 ─────────────────────────────────────────────────────────────────

test("새 문의의 상태는 received — 기본값이고, 허용 값은 셋뿐(검사 제약)", async () => {
  assert.deepEqual([...INQUIRY_STATUSES], ["received", "in_progress", "done"])
  const { svc } = setup()
  const ref = await send(svc, null)
  const [row] = await d.select().from(inquiries).where(eq(inquiries.reference, ref))
  assert.equal(row.status, "received")
  await assert.rejects(d.update(inquiries).set({ status: "bogus" }).where(eq(inquiries.reference, ref)), (e) => /inquiries_status_check/.test(String(e.cause?.message ?? e.message)))
})

// ── 목록 ────────────────────────────────────────────────────────────────────

test("listMine: 자기 문의만, 최신 순, 가린 연락처와 앞 40자 미리보기 — 원문·이름·다른 사람의 것은 없다", async () => {
  const c = clock("2026-10-10T00:00:00.000Z")
  const { svc } = setup(c)
  const secret = "비밀번호는 hunter2 입니다 ".repeat(10)
  const first = await send(svc, "mr-a", { message: secret, name: "Alice", contact: "alice.secret@example.com", category: "quote" })
  c.tick(60_000)
  const second = await send(svc, "mr-a", { message: "두 번째", contact: "010-1234-5678" })
  await send(svc, "mr-b")
  await send(svc, null)

  const page = await svc.listMine("mr-a")
  assert.deepEqual(page.items.map((i) => i.reference), [second, first])
  assert.deepEqual([page.total, page.page, page.pageCount], [2, 1, 1])
  const [s, f] = page.items
  assert.deepEqual(Object.keys(f).sort(), ["contact", "kind", "preview", "receivedAt", "reference", "status"])
  assert.equal(f.kind, "quote")
  assert.equal(f.status, "received")
  assert.equal(f.contact, "a***@example.com")
  assert.equal(s.contact, "***5678")
  assert.equal(f.receivedAt, "2026-10-10T00:00:00.000Z")
  assert.equal(f.preview, maskedPreview(secret))
  assert.equal(f.preview.includes(secret.slice(0, 80)), false, "앞 40자 뒤는 내려가지 않는다")
  const json = JSON.stringify(page)
  for (const leak of ["alice.secret", "Alice", "mr-b", "010-1234"]) assert.equal(json.includes(leak), false, leak)
  assert.ok(f.preview.length <= PREVIEW_CHARS + 1)

  assert.deepEqual(await svc.listMine("nobody"), { items: [], total: 0, page: 1, pageCount: 0 })
})

test("listMine: 쪽 나누기 — pageSize·page 가 고정 범위로 보정되고 총 개수와 쪽 수가 맞다", async () => {
  const c = clock("2026-10-11T00:00:00.000Z")
  const { svc } = setup(c)
  const refs = []
  for (let i = 0; i < 5; i++) {
    refs.push(await send(svc, "mr-b", { message: `m${i}` }))
    c.tick(1000)
  }
  const p1 = await svc.listMine("mr-b", { pageSize: 2 })
  assert.deepEqual([p1.items.length, p1.total, p1.page, p1.pageCount], [2, 6, 1, 3], "앞 시험에서 보낸 1건 + 이번 5건")
  const p3 = await svc.listMine("mr-b", { page: 3, pageSize: 2 })
  assert.equal(p3.items.length, 2)
  assert.equal((await svc.listMine("mr-b", { page: 99, pageSize: 2 })).items.length, 0)
  for (const bad of [0, -3, 1.5, Number.NaN, "2"]) assert.equal((await svc.listMine("mr-b", { page: bad })).page, 1, String(bad))
  assert.equal((await svc.listMine("mr-b", { pageSize: 10_000 })).items.length, 6, "상한 안")
  assert.equal(p1.items[0].reference, refs[4], "최신이 먼저")
  assert.deepEqual(await svc.listMine("", {}), { items: [], total: 0, page: 1, pageCount: 0 }, "빈 사용자 id 는 아무것도 없다")
})

test("문의 창구가 꺼져도(owner 없음) 내 신청 내역은 읽힌다 — 이미 받은 것을 보여 주는 일은 창구와 별개", async () => {
  const c = clock("2026-10-12T00:00:00.000Z")
  const on = setup(c)
  await send(on.svc, "mr-a")
  const off = createInquiryService({ db: d, mailer: createMailer({ mode: "mock", log: () => {} }), limiter: createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) } }), turnstile: createTurnstile({ mode: "mock" }), productName: "SampleCo", now: c.now })
  assert.equal(off.enabled, false)
  assert.ok((await off.listMine("mr-a")).total >= 3)
})

// ── 상태 변경 ───────────────────────────────────────────────────────────────

test("setStatus: 관리자·소유자는 바꾸고 admin_actions 한 줄(이전·이후·사유, 연락처·내용 없음), 직원·무역할은 거절, 안 바뀌면 기록 없음", async () => {
  const { svc } = setup()
  const ref = await send(svc, "mr-a", { message: "개인적인 내용입니다", contact: "private.person@example.com" })
  const r = await svc.setStatus(ADMIN, { reference: ref, status: "in_progress", reason: "담당 배정" })
  assert.deepEqual(r, { ok: true, changed: true, status: "in_progress" })
  const [row] = await d.select().from(inquiries).where(eq(inquiries.reference, ref))
  assert.equal(row.status, "in_progress")
  const acts = await actionsFor(ref)
  assert.equal(acts.length, 1)
  assert.equal(acts[0].action, "inquiry_status_change")
  assert.equal(acts[0].adminUserId, "adm-1")
  assert.equal(acts[0].targetUserId, "mr-a")
  assert.equal(acts[0].reason, "담당 배정")
  assert.deepEqual([acts[0].meta.from, acts[0].meta.to], ["received", "in_progress"])
  assert.equal(JSON.stringify(acts[0]).includes("private.person"), false)
  assert.equal(JSON.stringify(acts[0]).includes("개인적인"), false)

  assert.deepEqual(await svc.setStatus(OWNER, { reference: ref, status: "done" }), { ok: true, changed: true, status: "done" })
  assert.deepEqual(await svc.setStatus(OWNER, { reference: ref, status: "done" }), { ok: true, changed: false, status: "done" })
  assert.equal((await actionsFor(ref)).length, 2)

  for (const who of [STAFF, { userId: "x", role: null }, { userId: "x" }]) assert.deepEqual(await svc.setStatus(who, { reference: ref, status: "received" }), { ok: false, error: "forbidden" }, JSON.stringify(who))
  assert.equal((await d.select().from(inquiries).where(eq(inquiries.reference, ref)))[0].status, "done")
  assert.equal((await actionsFor(ref)).length, 2)
})

test("setStatus: 알 수 없는 상태·없는 접수 번호는 거절 — 아무것도 바뀌지 않는다. 상태가 내 목록에 보인다", async () => {
  const { svc } = setup()
  const ref = await send(svc, "mr-a")
  assert.deepEqual(await svc.setStatus(ADMIN, { reference: ref, status: "archived" }), { ok: false, error: "invalid_status" })
  assert.deepEqual(await svc.setStatus(ADMIN, { reference: "Q-NOSUCH00", status: "done" }), { ok: false, error: "not_found" })
  assert.equal((await actionsFor(ref)).length, 0)
  await svc.setStatus(ADMIN, { reference: ref, status: "done" })
  const mine = await svc.listMine("mr-a", { pageSize: 50 })
  assert.equal(mine.items.find((i) => i.reference === ref).status, "done")
})
