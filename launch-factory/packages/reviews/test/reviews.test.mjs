// 후기·상품 문의 서비스 — 제출 → 목록·요약 → 판매자 답변 → 숨김(사유) → 익명화까지 한 바퀴 + 보호 순서·권한·누설.
// PGlite 메모리 DB 하나를 모든 시험이 나눠 쓴다. 시계는 주입한다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { adminActions, db, hitRateLimit, reviews, user as userTable } from "@launch-factory/db"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { anonymizeUserReviews, createReviewsService } from "../src/index.ts"
import { DUMMY_TOKEN, fakeSiteverify, TEST_SECRET_PASS } from "../../security/test/turnstile-fixtures.mjs"

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
let seq = 0
const freshIp = () => `198.51.100.${++seq}`
const uid = () => `rv-user-${++seq}`
const subject = () => ({ subjectType: "product", subjectId: `sku-${++seq}` })
const addUser = async (id, at = new Date("2026-10-01T00:00:00Z")) => d.insert(userTable).values({ id, name: "x", email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })

const ADMIN = { userId: "adm-1", role: "admin" }
const OWNER = { userId: "own-1", isOwner: true }
const STAFF = { userId: "stf-1", role: "member" }

function setup(extra = {}) {
  const c = clock("2026-10-22T03:00:00.000Z")
  const errors = []
  const svc = createReviewsService({ db: d, limiter: createRateLimiter({ store: store(), now: c.now }), turnstile: createTurnstile({ mode: "mock" }), now: c.now, onError: (e) => errors.push(e.message), ...extra })
  return { svc, c, errors }
}
const review = (s, extra = {}) => ({ kind: "review", ...s, rating: "5", body: "정말 만족스러워요. 또 살 거예요.", "cf-turnstile-response": DUMMY_TOKEN, ...extra })
const question = (s, extra = {}) => ({ kind: "question", ...s, body: "사이즈는 어떻게 되나요?", "cf-turnstile-response": DUMMY_TOKEN, ...extra })
const rowsOf = async (s) => d.select().from(reviews).where(eq(reviews.subjectId, s.subjectId))

test("한 바퀴: 제출 → 목록에 요약 반영 → 판매자 답변 → 숨김(사유) → 목록에서 빠짐 + admin_actions 한 줄 → 탈퇴 익명화", async () => {
  const { svc, c } = setup({ timeZone: "Asia/Seoul" })
  const s = subject()
  const [u1, u2] = [uid(), uid()]
  await addUser(u1)
  await addUser(u2)

  const a = await svc.submit(review(s, { authorName: "김민수", rating: "5", title: "추천해요" }), { userId: u1, ip: freshIp(), locale: "ko" })
  assert.equal(a.ok, true)
  assert.equal(a.data.status, "published")
  assert.equal(a.message, "후기를 받았어요. 고마워요.")
  const b = await svc.submit(review(s, { authorName: "Dana Kim", rating: "2" }), { userId: u2, ip: freshIp(), locale: "en" })
  assert.equal(b.ok, true)

  // 저장된 이름은 가린 것뿐이다
  const stored = await rowsOf(s)
  assert.deepEqual(stored.map((r) => r.authorName).sort(), ["Dana K.", "김**"])
  assert.ok(stored.every((r) => !JSON.stringify(r).includes("민수") && !JSON.stringify(r).includes("Kim")))

  const q = { ...s, kind: "review", sort: "latest", page: 1, pageSize: 10 }
  let list = await svc.list(q)
  assert.equal(list.total, 2)
  assert.deepEqual(list.summary, { avg: 3.5, count: 2, asOf: "2026-10-22", distribution: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 } })
  assert.deepEqual(Object.keys(list.items[0]).sort(), ["author", "body", "date", "id", "kind", "rating", "title"].filter((k) => k in list.items[0]).sort())

  // 판매자 답변
  const target = list.items.find((i) => i.author === "김**")
  c.tick(60_000)
  assert.deepEqual(await svc.answer(OWNER, { id: target.id, body: "구매해 주셔서 감사해요." }), { ok: true, data: { id: target.id } })
  list = await svc.list(q)
  assert.deepEqual(list.items.find((i) => i.id === target.id).reply, { author: "판매자", body: "구매해 주셔서 감사해요.", date: "2026-10-22" })

  // 숨김: 사유 필수
  const lowId = list.items.find((i) => i.rating === 2).id
  assert.deepEqual(await svc.setStatus(ADMIN, { id: lowId, status: "hidden" }), { ok: false, error: "reason_required" })
  assert.deepEqual(await svc.setStatus(ADMIN, { id: lowId, status: "hidden", reason: "   " }), { ok: false, error: "reason_required" })
  const hid = await svc.setStatus(ADMIN, { id: lowId, status: "hidden", reason: "욕설 포함" })
  assert.deepEqual(hid, { ok: true, data: { id: lowId, changed: true, status: "hidden" } })
  list = await svc.list(q)
  assert.equal(list.total, 1)
  assert.deepEqual(list.summary, { avg: 5, count: 1, asOf: "2026-10-22", distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } }, "숨긴 후기는 평균에서도 빠진다")
  const logs = (await d.select().from(adminActions).where(eq(adminActions.action, "review_status_change"))).filter((l) => l.meta?.reviewId === lowId)
  assert.equal(logs.length, 1)
  assert.equal(logs[0].adminUserId, "adm-1")
  assert.equal(logs[0].reason, "욕설 포함")
  assert.equal(logs[0].targetUserId, u2)
  assert.deepEqual({ from: logs[0].meta.from, to: logs[0].meta.to }, { from: "published", to: "hidden" })
  assert.ok(!JSON.stringify(logs[0]).includes("정말 만족"), "기록에 글 내용이 없다")
  // 같은 상태로 다시 바꾸면 기록이 늘지 않는다
  assert.equal((await svc.setStatus(ADMIN, { id: lowId, status: "hidden", reason: "again" })).data.changed, false)
  assert.equal((await d.select().from(adminActions).where(eq(adminActions.action, "review_status_change"))).filter((l) => l.meta?.reviewId === lowId).length, 1)

  // 탈퇴 익명화
  c.tick(1000)
  assert.equal(await anonymizeUserReviews(d, u1, c.now()), 1)
  assert.equal(await anonymizeUserReviews(d, u1, c.now()), 0, "다시 불러도 같다")
  const after = (await rowsOf(s)).find((r) => r.id === target.id)
  assert.equal(after.authorName, "탈퇴한 사용자")
  assert.equal(after.userId, null)
  const en = (await rowsOf(s)).find((r) => r.id === lowId)
  assert.equal(en.userId, u2, "다른 사람 글은 그대로")
  await anonymizeUserReviews(d, u2, c.now())
  assert.equal((await rowsOf(s)).find((r) => r.id === lowId).authorName, "Deleted user", "글의 언어대로")
})

test("후기는 한 사람이 한 대상에 한 번 — 칸 오류. 다른 대상·다른 사람은 된다. 숨겨도 다시 못 쓴다", async () => {
  const { svc } = setup()
  const s = subject()
  const u = uid()
  await addUser(u)
  assert.equal((await svc.submit(review(s), { userId: u, ip: freshIp(), locale: "ko" })).ok, true)
  const dup = await svc.submit(review(s), { userId: u, ip: freshIp(), locale: "ko" })
  assert.equal(dup.ok, false)
  assert.equal(dup.code, "duplicate")
  assert.equal(dup.fieldErrors.subjectId.length, 1)
  assert.equal(dup.formError, "이미 이 상품에 후기를 남기셨어요. 후기는 한 번만 쓸 수 있어요.")
  assert.equal((await svc.submit(review(subject()), { userId: u, ip: freshIp() })).ok, true, "다른 대상")
  const other = uid()
  await addUser(other)
  assert.equal((await svc.submit(review(s), { userId: other, ip: freshIp() })).ok, true, "다른 사람")
  const id = (await rowsOf(s)).find((r) => r.userId === u).id
  await svc.setStatus(ADMIN, { id, status: "hidden", reason: "x" })
  assert.equal((await svc.submit(review(s), { userId: u, ip: freshIp() })).code, "duplicate", "숨긴 뒤에도")
  // 질문은 여러 번 해도 된다
  assert.equal((await svc.submit(question(s), { userId: u, ip: freshIp() })).ok, true)
  assert.equal((await svc.submit(question(s), { userId: u, ip: freshIp() })).ok, true)
})

test("동시에 같은 후기가 두 번 와도 한 건만 남는다(유일 색인) — 나머지는 중복 칸 오류", async () => {
  const { svc } = setup()
  const s = subject()
  const u = uid()
  await addUser(u)
  const results = await Promise.all([1, 2, 3].map(() => svc.submit(review(s), { userId: u, ip: freshIp() })))
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.ok(results.filter((r) => !r.ok).every((r) => r.code === "duplicate"))
  assert.equal((await rowsOf(s)).length, 1)
})

test("후기는 로그인이 필요하고 질문은 없어도 된다 — 로그인 없는 질문은 이름 없이 「익명」", async () => {
  const { svc } = setup()
  const s = subject()
  const r = await svc.submit(review(s), { ip: freshIp(), locale: "ko" })
  assert.equal(r.ok, false)
  assert.equal(r.code, "sign_in_required")
  assert.equal(r.retryable, false)
  assert.equal((await rowsOf(s)).length, 0)
  const q = await svc.submit(question(s), { ip: freshIp(), locale: "ko" })
  assert.equal(q.ok, true)
  assert.equal(q.message, "문의를 받았어요. 답변이 달리면 이 자리에 보여요.")
  const [row] = await rowsOf(s)
  assert.deepEqual({ authorName: row.authorName, userId: row.userId, rating: row.rating, kind: row.kind }, { authorName: "익명", userId: null, rating: null, kind: "question" })
  // 세션 이름은 입력 이름이 없을 때만 쓰고, 그것도 가려서 저장한다
  const u = uid()
  await addUser(u)
  await svc.submit(question(subject(), { }), { userId: u, displayName: "박지성", ip: freshIp() })
  const mine = await d.select().from(reviews).where(eq(reviews.userId, u))
  assert.equal(mine[0].authorName, "박**")
})

test("질문에 답변이 달리면 공개 답변으로 보이고, 질문 목록에는 별점 요약이 없다", async () => {
  const { svc } = setup()
  const s = subject()
  await svc.submit(question(s), { ip: freshIp(), locale: "en" })
  const q = { ...s, kind: "question", sort: "latest", page: 1, pageSize: 10 }
  const l = await svc.list(q)
  assert.equal(l.summary, undefined)
  assert.equal(l.items[0].rating, undefined)
  await svc.answer(ADMIN, { id: l.items[0].id, body: "It runs true to size." })
  assert.equal((await svc.list(q)).items[0].reply.author, "Seller")
  // 판매자 이름을 정하면 그것으로
  const named = setup({ sellerName: "Acme Support" }).svc
  assert.equal((await named.list(q)).items[0].reply.author, "Acme Support")
})

test("moderation: before 면 pending 으로 저장돼 목록에 안 나오고, 승인하면 나온다 / after 는 바로 게시", async () => {
  const { svc } = setup({ moderation: "before" })
  const s = subject()
  const u = uid()
  await addUser(u)
  const r = await svc.submit(review(s), { userId: u, ip: freshIp(), locale: "ko" })
  assert.equal(r.data.status, "pending")
  assert.equal(r.message, "후기를 받았어요. 확인한 뒤에 게시돼요.")
  const q = { ...s, kind: "review", sort: "latest", page: 1, pageSize: 10 }
  assert.equal((await svc.list(q)).total, 0)
  assert.equal((await svc.list(q)).summary.count, 0)
  const pend = await svc.listForModeration(ADMIN, { status: "pending", subjectId: s.subjectId })
  assert.equal(pend.data.items.length, 1)
  assert.equal((await svc.setStatus(ADMIN, { id: r.data.id, status: "published" })).data.status, "published")
  assert.equal((await svc.list(q)).total, 1)
  assert.throws(() => setup({ moderation: "maybe" }), /moderation/)
})

test("목록: 정렬·별점 거르기·쪽 나누기 — 합계는 거른 뒤의 수, 요약은 거르지 않은 전체", async () => {
  const { svc, c } = setup()
  const s = subject()
  for (const rating of [5, 3, 4, 1, 3]) {
    const u = uid()
    await addUser(u)
    c.tick(1000)
    await svc.submit(review(s, { rating: String(rating) }), { userId: u, ip: freshIp() })
  }
  const base = { ...s, kind: "review", sort: "latest", page: 1, pageSize: 2 }
  const latest = await svc.list(base)
  assert.deepEqual([latest.total, latest.pageCount, latest.items.map((i) => i.rating)], [5, 3, [3, 1]], "최근 순")
  assert.deepEqual((await svc.list({ ...base, page: 3 })).items.map((i) => i.rating), [5])
  assert.deepEqual((await svc.list({ ...base, pageSize: 10, sort: "rating-desc" })).items.map((i) => i.rating), [5, 4, 3, 3, 1])
  assert.deepEqual((await svc.list({ ...base, pageSize: 10, sort: "rating-asc" })).items.map((i) => i.rating), [1, 3, 3, 4, 5])
  const threes = await svc.list({ ...base, pageSize: 10, rating: 3 })
  assert.deepEqual([threes.total, threes.items.length, threes.summary.count, threes.summary.avg], [2, 2, 5, 3.2])
})

test("관리: 관리자·소유자만 — 일반 직원·로그아웃 행위자는 답변·숨김·관리 목록 모두 forbidden, 지우는 길은 없다", async () => {
  const { svc } = setup()
  const s = subject()
  await svc.submit(question(s), { ip: freshIp() })
  const id = (await rowsOf(s))[0].id
  for (const who of [STAFF, { userId: "x" }, { userId: "y", role: "adminish" }]) {
    assert.deepEqual(await svc.answer(who, { id, body: "x답변" }), { ok: false, error: "forbidden" })
    assert.deepEqual(await svc.setStatus(who, { id, status: "hidden", reason: "r" }), { ok: false, error: "forbidden" })
    assert.deepEqual(await svc.listForModeration(who), { ok: false, error: "forbidden" })
  }
  assert.equal((await rowsOf(s))[0].status, "published")
  assert.equal((await rowsOf(s))[0].answerBody, null)
  assert.deepEqual(Object.keys(svc).filter((k) => /delete|remove|destroy/i.test(k)), [])
  // adminRoles·adminUserIds 설정
  const custom = setup({ adminRoles: ["moderator"], adminUserIds: ["vip"] }).svc
  assert.equal((await custom.answer({ userId: "m", role: "moderator" }, { id, body: "ok답변" })).ok, true)
  assert.equal((await custom.answer({ userId: "vip" }, { id, body: "ok답변2" })).ok, true)
  assert.equal((await custom.answer(ADMIN, { id, body: "no" })).error, "forbidden", "기본 admin 역할은 설정이 바뀌면 빠진다")
})

test("관리: 잘못된 입력 — 없는 글·모양이 틀린 id·빈 답변·모르는 상태는 DB 오류 없이 거절한다", async () => {
  const { svc } = setup()
  const s = subject()
  await svc.submit(question(s), { ip: freshIp() })
  const id = (await rowsOf(s))[0].id
  assert.equal((await svc.answer(ADMIN, { id: "not-a-uuid", body: "답변입니다" })).error, "not_found")
  assert.equal((await svc.answer(ADMIN, { id: "00000000-0000-4000-8000-000000000000", body: "답변입니다" })).error, "not_found")
  assert.equal((await svc.answer(ADMIN, { id, body: "   " })).error, "invalid_input")
  assert.equal((await svc.answer(ADMIN, { id, body: "가".repeat(2001) })).error, "invalid_input")
  assert.equal((await svc.setStatus(ADMIN, { id, status: "deleted" })).error, "invalid_input")
  assert.equal((await svc.setStatus(ADMIN, { id: "zzz", status: "hidden", reason: "r" })).error, "not_found")
  assert.equal((await svc.listForModeration(ADMIN, { status: "nope" })).error, "invalid_input")
  // 다시 게시하면 숨김 사유가 비워진다
  await svc.setStatus(ADMIN, { id, status: "hidden", reason: "광고" })
  assert.equal((await rowsOf(s))[0].hiddenReason, "광고")
  await svc.setStatus(ADMIN, { id, status: "published" })
  assert.equal((await rowsOf(s))[0].hiddenReason, null)
})

test("관리 목록은 상태와 상관없이 보이되 사용자 id·답변자 id 는 싣지 않는다", async () => {
  const { svc } = setup()
  const s = subject()
  const u = uid()
  await addUser(u)
  const r = await svc.submit(review(s), { userId: u, ip: freshIp() })
  await svc.answer(OWNER, { id: r.data.id, body: "답변입니다" })
  await svc.setStatus(ADMIN, { id: r.data.id, status: "hidden", reason: "광고" })
  const l = await svc.listForModeration(OWNER, { subjectType: s.subjectType, subjectId: s.subjectId })
  assert.equal(l.data.total, 1)
  assert.equal(l.data.items[0].status, "hidden")
  assert.equal(l.data.items[0].hiddenReason, "광고")
  assert.ok(!JSON.stringify(l).includes(u) && !JSON.stringify(l).includes("own-1"))
})

test("보호 순서: 요청 제한이 먼저(DB 에 닿기 전) → 멱등 키가 Turnstile 앞 → 검사 오류는 토큰을 태우지 않는다", async () => {
  const cf = fakeSiteverify()
  const c = clock("2026-10-22T03:00:00.000Z")
  const svc = createReviewsService({
    db: d,
    limiter: createRateLimiter({ store: store(), now: c.now, rules: { reviewsSubmit: { max: 3, windowSec: 600 } } }),
    turnstile: createTurnstile({ mode: "live", secretKey: TEST_SECRET_PASS, fetch: cf.fetch }),
    now: c.now,
  })
  const ip = freshIp()
  const s = subject()
  // 검사 오류 — Turnstile 호출 0
  const bad = await svc.submit(question(s, { body: "" }), { ip, locale: "ko" })
  assert.equal(bad.ok, false)
  assert.ok(bad.fieldErrors.body)
  assert.equal(cf.calls.length, 0)
  // 같은 멱등 키로 두 번 — Turnstile 은 한 번, 결과는 같다
  const input = question(s, { idempotencyKey: "key-aaaa-1111" })
  const first = await svc.submit(input, { ip })
  const again = await svc.submit(input, { ip })
  assert.equal(first.ok, true)
  assert.deepEqual(again.data, first.data)
  assert.equal(cf.calls.length, 1)
  assert.equal((await rowsOf(s)).length, 1)
  // 네 번째 요청은 한도(3) 초과
  const limited = await svc.submit(question(s), { ip, locale: "ko" })
  assert.equal(limited.code, "rate_limited")
  assert.ok(limited.retryAfter >= 1)
  assert.equal(cf.calls.length, 1)
  assert.equal((await rowsOf(s)).length, 1)
})

test("봇 확인 실패면 저장하지 않는다", async () => {
  const svc = setup({ turnstile: createTurnstile({ mode: "live", secretKey: TEST_SECRET_PASS, fetch: fakeSiteverify().fetch }) }).svc
  const s = subject()
  const r = await svc.submit(question(s, { "cf-turnstile-response": "not-the-dummy-token" }), { ip: freshIp() })
  assert.equal(r.ok, false)
  assert.equal(r.code, "bot_check_failed")
  assert.equal((await rowsOf(s)).length, 0)
})

test("HTTP: POST 처리기 상태 코드 — 200 / 400 칸 오류 / 401 로그인 / 409 중복 / 429 + Retry-After, GET 은 405", async () => {
  const { svc } = setup({ limiter: createRateLimiter({ store: store(), rules: { reviewsSubmit: { max: 4, windowSec: 600 } } }) })
  const s = subject()
  const u = uid()
  await addUser(u)
  const ip = freshIp()
  const post = (body, ctx = {}) => svc.handler(new Request("http://x/api/reviews", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }), { locale: "ko", ...ctx })
  assert.equal((await post(question(s))).status, 200)
  assert.equal((await post(question(s, { body: "" }))).status, 400)
  assert.equal((await post(review(s))).status, 401)
  assert.equal((await post(question(s))).status, 200)
  const limited = await post(question(s))
  assert.equal(limited.status, 429)
  assert.ok(Number(limited.headers.get("retry-after")) >= 1)
  // 로그인한 사람은 따로 센다(요청 제한 키에 사용자 id 가 든다)
  assert.equal((await post(review(s), { userId: u })).status, 200)
  assert.equal((await post(review(s), { userId: u })).status, 409)
  assert.equal((await svc.handler(new Request("http://x/api/reviews"))).status, 405)
  // 깨진 본문
  assert.equal((await svc.handler(new Request("http://x/api/reviews", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": freshIp() }, body: "{oops" }))).status, 400)
})

test("HTTP: GET 목록은 캐시할 수 있고(공개 읽기) 사용자 id·상태·숨김 사유가 응답에 없다", async () => {
  const { svc } = setup()
  const s = subject()
  const u = uid()
  await addUser(u)
  const r = await svc.submit(review(s, { authorName: "김민수" }), { userId: u, ip: freshIp() })
  const get = (qs) => svc.listHandler(new Request(`http://x/api/reviews?${qs}`), { locale: "ko" })
  const res = await get(`subjectType=${s.subjectType}&subjectId=${s.subjectId}`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get("cache-control"), /s-maxage=60/)
  const text = await res.text()
  assert.ok(!text.includes(u) && !text.includes("userId") && !text.includes("hidden") && !text.includes("status") && !text.includes("민수"))
  const body = JSON.parse(text)
  assert.equal(body.data.items[0].id, r.data.id)
  assert.equal(body.data.summary.count, 1)
  assert.equal((await get("subjectId=only")).status, 400)
  assert.equal((await svc.listHandler(new Request("http://x/api/reviews", { method: "POST" }))).status, 405)
  assert.equal((await get(`subjectType=${s.subjectType}&subjectId=${s.subjectId}&sort=random`)).status, 400)
})

test("모양: 공개 항목·요약의 필드 목록이 web-factory Review·RatingSummary 와 같다(타입 복사 없이 필드 이름만 비교)", async () => {
  // web-factory blocks/_shared/review-kit.tsx — Review: id rating title? body author date verified? option? photos? reply?{author body date}, RatingSummary: avg count asOf distribution
  const WF_REVIEW = ["id", "rating", "title", "body", "author", "date", "verified", "option", "photos", "reply"]
  const WF_SUMMARY = ["avg", "count", "asOf", "distribution"]
  const { svc } = setup()
  const s = subject()
  const u = uid()
  await addUser(u)
  const r = await svc.submit(review(s, { title: "t" }), { userId: u, ip: freshIp() })
  await svc.answer(ADMIN, { id: r.data.id, body: "답변입니다" })
  await d.update(reviews).set({ verified: true }).where(eq(reviews.id, r.data.id))
  const l = await svc.list({ ...s, kind: "review", sort: "latest", page: 1, pageSize: 10 })
  const keys = Object.keys(l.items[0]).filter((k) => k !== "kind")
  assert.deepEqual(keys.filter((k) => !WF_REVIEW.includes(k)), [])
  assert.deepEqual(["id", "rating", "title", "body", "author", "date", "verified", "reply"].filter((k) => !keys.includes(k)), [])
  assert.deepEqual(Object.keys(l.items[0].reply).sort(), ["author", "body", "date"])
  assert.deepEqual(Object.keys(l.summary).sort(), [...WF_SUMMARY].sort())
  assert.match(l.items[0].date, /^\d{4}-\d{2}-\d{2}$/)
})

test("moderationItem: 관리자·소유자만 글 하나(상태와 상관없이)를 읽고, 사용자 id 는 싣지 않으며, 없는 id·모양 틀린 id 는 not_found", async () => {
  const { svc } = setup()
  const s = subject()
  const u = uid()
  await addUser(u)
  const r = await svc.submit(review(s, { authorName: "김민수", title: "추천" }), { userId: u, ip: freshIp(), locale: "ko" })
  await svc.setStatus(ADMIN, { id: r.data.id, status: "hidden", reason: "스팸" })
  for (const who of [ADMIN, OWNER]) {
    const got = await svc.moderationItem(who, r.data.id)
    assert.equal(got.ok, true)
    assert.deepEqual([got.data.id, got.data.status, got.data.hiddenReason, got.data.title], [r.data.id, "hidden", "스팸", "추천"])
    assert.ok(!JSON.stringify(got.data).includes(u), "사용자 id 가 없다")
  }
  assert.deepEqual(await svc.moderationItem(STAFF, r.data.id), { ok: false, error: "forbidden" })
  assert.deepEqual(await svc.moderationItem({ userId: "x" }, r.data.id), { ok: false, error: "forbidden" })
  assert.deepEqual(await svc.moderationItem(ADMIN, "00000000-0000-4000-8000-000000000000"), { ok: false, error: "not_found" })
  assert.deepEqual(await svc.moderationItem(ADMIN, "not-a-uuid"), { ok: false, error: "not_found" })
})

test("listForModeration search: 제목·본문·작성자 이름에서 대소문자 없이 찾고, % 는 글자 그대로다", async () => {
  const { svc } = setup()
  const s = subject()
  const [u1, u2] = [uid(), uid()]
  await addUser(u1)
  await addUser(u2)
  await svc.submit(review(s, { authorName: "Dana Kim", body: "Zebra stripes are great, truly", title: "Stripes" }), { userId: u1, ip: freshIp(), locale: "en" })
  await svc.submit(review(s, { authorName: "Lee", body: "Sale 50% off worked for me today", title: "Discount" }), { userId: u2, ip: freshIp(), locale: "en" })
  const find = async (search) => (await svc.listForModeration(ADMIN, { subjectId: s.subjectId, search })).data.items.map((i) => i.title)
  assert.deepEqual(await find("zebra"), ["Stripes"])
  assert.deepEqual(await find("DISCOUNT"), ["Discount"])
  assert.deepEqual(await find("dana"), ["Stripes"])
  assert.deepEqual(await find("50%"), ["Discount"])
  assert.deepEqual(await find("%"), ["Discount"], "와일드카드로 전부 찾지 않는다")
  assert.deepEqual(await find("nothing-like-this"), [])
})
