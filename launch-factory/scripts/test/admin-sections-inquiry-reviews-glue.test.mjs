// 관리 구획 둘(문의 inquiries · 후기 reviews, 계획 3d L2c) 한 바퀴 — 진짜 콘솔 서버 액션 → 진짜 조립(admin-console.ts · admin-identity.ts) → 진짜 구획 모듈 → 진짜 문의·후기 서비스(PGlite).
// 세션·설정·DB 핸들·메일 보내기만 대역이다. 예전 서버 액션(inquiry-admin.ts · reviews-admin.ts)의 행위자 규칙 시험을 이 구획 시험으로 옮겼다:
//   소유자(확인된 이메일 = INQUIRY_OWNER_EMAIL)·관리자(2단계 있음)만 들어오고, 입력의 role·isOwner·userId 는 읽지 않으며, 운영자 메일이 없으면 소유자는 아무도 아니다.
// 지키는 것: 접근 벽 · 확인 입력 벽(위험 행동) · adminOnly(불만 올리기) · 목록→상세→저장→행동 한 바퀴 · 상태 불가 시 invalid_state · 연락처 가림 · 행동 기록에 답변·연락처 없음.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { after, before, test } from "node:test"
import { fileURLToPath } from "node:url"
import YAML from "yaml"
import { adminActions, db, hitRateLimit, inquiries, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { createInquiryService } from "@launch-factory/inquiry"
import { createReviewsService } from "@launch-factory/reviews"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

installGlueStubs({
  auth: ["authPort"],
  config: ["PRODUCT_NAME", "DEFAULT_LOCALE", "appUrl"],
  db: ["database"],
  env: ["env", "required", "optional"],
  enabled: ["hasPart"],
  inquiry: ["inquiry", "inquiryOwnerEmail"],
  reviews: ["reviews"],
  security: ["guardAction"],
  "@/content/copy.admin-messages.en": ["adminMessages"],
})

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const at = new Date("2026-10-22T00:00:00.000Z")
const OWNER_EMAIL = "Owner@Example.com"
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
let ownerEmail = OWNER_EMAIL // undefined = 운영자 메일 없음(문의 창구 꺼짐)
let actions
let consoleMod
let inquirySvc
let reviewsSvc
const sent = []
let seq = 0

const setSession = (userId, extra = {}) => (session = userId ? { userId, impersonatedBy: null, ...extra } : null)
const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data
}
const submitInquiry = async (extra = {}) => {
  const n = ++seq
  const r = await inquirySvc.submit({ name: `Visitor ${n}`, contact: `visitor${n}@example.com`, message: `Question number ${n} about plans`, "cf-turnstile-response": "x", ...extra }, { ip: `203.0.113.${(n % 200) + 1}`, locale: "en" })
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data.id
}
const submitReview = async (extra = {}) => {
  const n = ++seq
  const id = `reviewer-${n}`
  await d.insert(userTable).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
  const r = await reviewsSvc.submit(
    { kind: "review", subjectType: "product", subjectId: `sku-${n}`, rating: "4", body: `Review text number ${n}, quite good.`, authorName: `Author ${n}`, "cf-turnstile-response": "x", ...extra },
    { userId: id, ip: `198.51.100.${(n % 200) + 1}`, locale: "en" },
  )
  assert.equal(r.ok, true, JSON.stringify(r))
  return r.data.id
}

before(async () => {
  process.env.LF_CLIENT_IP_HEADER = "x-test-ip"
  d = await db.local()
  const mk = (id, extra = {}) => ({ id, name: id, email: `${id}@example.com`, emailVerified: true, role: null, twoFactorEnabled: false, banned: false, createdAt: at, updatedAt: at, ...extra })
  await d.insert(userTable).values([
    mk("plain"),
    mk("admin", { role: "admin", twoFactorEnabled: true }),
    mk("admin-no2fa", { role: "admin" }),
    mk("banned-admin", { role: "admin", twoFactorEnabled: true, banned: true }),
    mk("owner", { email: "owner@example.com" }),
    mk("fake-owner", { email: "OWNER@example.com", emailVerified: false }),
  ])
  const limiter = () => createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) } })
  const mock = createMailer({ mode: "mock", log: () => {} })
  inquirySvc = createInquiryService({
    db: d,
    mailer: { mode: mock.mode, send: (req) => (sent.push(req), mock.send(req)) },
    limiter: limiter(),
    turnstile: createTurnstile({ mode: "mock" }),
    owner: { email: "owner-inbox@example.test" },
    productName: "Example",
  })
  reviewsSvc = createReviewsService({ db: d, limiter: limiter(), turnstile: createTurnstile({ mode: "mock" }), moderation: "before" })

  stubs.config = { PRODUCT_NAME: "Example", DEFAULT_LOCALE: "en", appUrl: () => "https://shop.example.test" }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "mock" }), required: (n) => `x-${n}`, optional: (n) => (n === "INQUIRY_OWNER_EMAIL" ? ownerEmail : undefined) }
  stubs.enabled = { hasPart: () => true }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
  stubs.inquiry = { inquiry: async () => inquirySvc, inquiryOwnerEmail: () => ownerEmail }
  stubs.reviews = { reviews: async () => reviewsSvc }
  stubs["next/headers"] = { headers: async () => new Headers({ "x-test-ip": "203.0.113.90" }) }
  stubs["@/content/copy.admin-messages.en"] = { adminMessages: MESSAGES }
  const security = await importRegistryFile("feature-security/files/lib/launch/security.ts")
  stubs.security = { guardAction: (...a) => security.guardAction(...a) }
  consoleMod = await importRegistryFile("feature-admin-console/files/lib/launch/admin-console.ts")
  // 레지스트리의 등록부는 비어 있다(제품이 가진 template/lib/launch/admin-console.ts 가 구획을 import 해 건다) — 이 시험이 진짜 구획 모듈을 같은 순서로 건다
  const inquiries = await importRegistryFile("feature-inquiry/files/lib/launch/admin-sections/inquiries.ts")
  const reviews = await importRegistryFile("feature-reviews/files/lib/launch/admin-sections/reviews.ts")
  consoleMod.ADMIN_SECTIONS.splice(0, consoleMod.ADMIN_SECTIONS.length, inquiries.inquiriesSection, reviews.reviewsSection)
  actions = await importRegistryFile("feature-admin-console/files/app/actions/admin-console.ts")
})
after(async () => {
  await d?.$client.close()
})

test("제품 등록부(template/lib/launch/admin-console.ts)가 두 구획을 건다 — 부품 이름은 features/outcomes.yaml 의 부품이다", () => {
  const registry = readFileSync(`${ROOT}/template/lib/launch/admin-console.ts`, "utf8")
  assert.match(registry, /import inquiriesSection from "@\/lib\/launch\/admin-sections\/inquiries"/)
  assert.match(registry, /import reviewsSection from "@\/lib\/launch\/admin-sections\/reviews"/)
  assert.match(registry, /ADMIN_SECTIONS: readonly AdminSection\[\] = \[[^\]]*inquiriesSection[^\]]*reviewsSection/)
  const parts = Object.keys(YAML.parse(readFileSync(`${ROOT}/features/outcomes.yaml`, "utf8")).parts)
  const byId = Object.fromEntries(consoleMod.ADMIN_SECTIONS.map((s) => [s.id, s.part]))
  assert.equal(byId.inquiries, "inquiry")
  assert.equal(byId.reviews, "reviews")
  for (const part of [byId.inquiries, byId.reviews]) assert.ok(parts.includes(part), part)
})

test("접근 벽 — 로그아웃 · 일반 사용자 · 2단계 없는 관리자 · 정지 · 대리 세션은 두 구획 모두 열지 못한다", async () => {
  const cases = [
    [null, "sign_in_required"],
    ["plain", "forbidden"],
    ["fake-owner", "forbidden"], // 주소만 같은 미확인 가입은 소유자가 아니다
    ["admin-no2fa", "two_factor_required"],
    ["banned-admin", "forbidden"],
  ]
  for (const [who, code] of cases) {
    setSession(who)
    for (const section of ["inquiries", "reviews"]) {
      const r = await actions.adminTable({ section })
      assert.equal(r.ok, false, `${who}/${section}`)
      assert.equal(r.code, code, `${who}/${section}`)
      assert.equal((await actions.adminAct({ section, id: "x", action: "mark-done" })).ok, false, `${who}/${section}`)
    }
    const list = await actions.adminSections()
    if (list.ok) assert.deepEqual(list.data, [], `${who}: 볼 수 있는 구획이 없다`)
  }
  setSession("admin", { impersonatedBy: "someone" })
  assert.equal((await actions.adminTable({ section: "inquiries" })).code, "impersonation_blocked")
  assert.equal((await actions.adminTable({ section: "reviews" })).code, "impersonation_blocked")
})

test("입력의 role·isOwner·userId 는 읽지 않는다 — 일반 사용자가 실어도 막힌다", async () => {
  const ref = await submitInquiry()
  setSession("plain")
  const spoof = { role: "admin", isOwner: true, userId: "admin", via: "admin", actor: { userId: "admin", role: "admin" } }
  const r = await actions.adminAct({ section: "inquiries", id: ref, action: "mark-done", ...spoof })
  assert.deepEqual([r.ok, r.code], [false, "forbidden"])
  assert.equal((await d.select().from(inquiries)).find((q) => q.reference === ref).status, "received")
})

test("소유자(확인된 이메일) 와 2단계 있는 관리자는 들어온다 — 운영자 메일이 없으면 소유자는 아무도 아니고 관리자는 그대로다", async () => {
  for (const who of ["owner", "admin"]) {
    setSession(who)
    assert.deepEqual(ok(await actions.adminSections()).map((s) => s.id), ["inquiries", "reviews"], who)
    ok(await actions.adminTable({ section: "inquiries" }))
    ok(await actions.adminTable({ section: "reviews" }))
  }
  ownerEmail = undefined
  try {
    setSession("owner")
    assert.deepEqual(ok(await actions.adminSections()), [])
    assert.equal((await actions.adminTable({ section: "inquiries" })).code, "forbidden")
    setSession("admin")
    ok(await actions.adminTable({ section: "inquiries" }))
    ok(await actions.adminTable({ section: "reviews" }))
  } finally {
    ownerEmail = OWNER_EMAIL
  }
})

test("문의 한 바퀴 — 목록(상태·검색, 연락처 가림) → 상세(전체 내용) → 답변 저장(메일) → 상태 행동 → 상태 불가는 invalid_state", async () => {
  setSession("admin")
  const mailRef = await submitInquiry({ name: "Jamie Park", contact: "jamie@example.com", message: "Do you have a team plan?" })
  const phoneRef = await submitInquiry({ contact: "010-1234-5678", message: "Please call me" })

  const table = ok(await actions.adminTable({ section: "inquiries" }))
  const row = table.rows.find((r) => r.id === mailRef)
  assert.equal(row.cells.contact, "j***@example.com", "표의 연락처는 콘솔이 가린다")
  assert.equal(table.rows.find((r) => r.id === phoneRef).cells.contact, "***-5678")
  assert.equal(row.href, `/admin/inquiries/${mailRef}`)
  assert.deepEqual(ok(await actions.adminTable({ section: "inquiries", status: "done" })).rows, [])
  assert.deepEqual(ok(await actions.adminTable({ section: "inquiries", search: "jamie" })).rows.map((r) => r.id), [mailRef])
  assert.equal((await actions.adminTable({ section: "inquiries", status: "archived" })).code, "invalid_input")

  const rec = ok(await actions.adminRecord({ section: "inquiries", id: mailRef }))
  assert.equal(rec.title, `Inquiry ${mailRef}`)
  assert.equal(rec.summary.find((s) => s.label === "Message").value, "Do you have a team plan?")
  assert.equal(rec.summary.find((s) => s.label === "Email").value, "jamie@example.com", "상세에는 답하는 데 필요한 전체 연락처가 나간다(읽을 때마다 접속 기록이 남는다)")
  assert.equal(rec.save, "save")
  assert.deepEqual(rec.actions.map((a) => a.id).sort(), ["mark-done", "mark-in-progress"], "받은 문의는 처리 중·완료로 간다. 다시 열기는 없다")
  assert.deepEqual(rec.danger, { id: "mark-complaint", label: "Escalate to complaint" })

  // 답변: 저장 + 메일. 행동 기록에는 답변 글·연락처가 없다
  const saved = await actions.adminAct({ section: "inquiries", id: mailRef, action: "save", fields: { reply: "Yes, we do. Details by email." } })
  assert.equal(saved.ok, true, JSON.stringify(saved))
  assert.match(saved.data.message, /emailed/)
  const mail = sent.find((q) => q.template === "inquiryReply" && q.input.reference === mailRef)
  assert.equal(mail.to, "jamie@example.com")
  assert.equal(mail.input.reply, "Yes, we do. Details by email.")
  const after = ok(await actions.adminRecord({ section: "inquiries", id: mailRef }))
  assert.ok(after.summary.some((s) => s.label.startsWith("Reply 1") && s.value === "Yes, we do. Details by email."))

  // 중복 전송 방지 키: 같은 키로 한 번 더 보내면 답변·메일이 늘지 않고 같은 성공 글이 돌아온다. 틀린 키 모양은 서비스에 닿지 않는다
  const mailsBefore = sent.filter((q) => q.template === "inquiryReply" && q.input.reference === mailRef).length
  const keyed = await actions.adminAct({ section: "inquiries", id: mailRef, action: "save", fields: { reply: "Keyed answer" }, idempotencyKey: "panel-key-000001" })
  const keyedAgain = await actions.adminAct({ section: "inquiries", id: mailRef, action: "save", fields: { reply: "Keyed answer" }, idempotencyKey: "panel-key-000001" })
  assert.deepEqual([keyed.ok, keyedAgain.ok], [true, true])
  assert.equal(keyedAgain.data.message, keyed.data.message)
  assert.equal(sent.filter((q) => q.template === "inquiryReply" && q.input.reference === mailRef).length, mailsBefore + 1, "메일은 한 번 더만")
  assert.equal(ok(await actions.adminRecord({ section: "inquiries", id: mailRef })).summary.filter((s) => s.value === "Keyed answer").length, 1, "글타래에 한 줄")
  assert.equal((await actions.adminAct({ section: "inquiries", id: mailRef, action: "save", fields: { reply: "x" }, idempotencyKey: "bad key!" })).code, "invalid_input")

  const phoneSaved = await actions.adminAct({ section: "inquiries", id: phoneRef, action: "save", fields: { reply: "Called back" } })
  assert.match(phoneSaved.data.message, /Nothing was emailed/)
  assert.equal(sent.filter((q) => q.template === "inquiryReply" && q.input.reference === phoneRef).length, 0)
  const bad = await actions.adminAct({ section: "inquiries", id: mailRef, action: "save", fields: { reply: "   " } })
  assert.deepEqual([bad.ok, bad.code], [false, "invalid_input"])
  assert.ok(bad.fieldErrors.reply.length > 0)

  // 상태: 받음 → 처리 중 → 완료 → 다시 열기. 같은 행동을 두 번 누르면 한 번만
  ok(await actions.adminAct({ section: "inquiries", id: mailRef, action: "mark-in-progress" }))
  assert.equal((await actions.adminAct({ section: "inquiries", id: mailRef, action: "mark-in-progress" })).code, "invalid_state")
  assert.equal((await actions.adminAct({ section: "inquiries", id: mailRef, action: "reopen" })).code, "invalid_state")
  ok(await actions.adminAct({ section: "inquiries", id: mailRef, action: "mark-done" }))
  assert.equal((await actions.adminAct({ section: "inquiries", id: mailRef, action: "mark-done" })).code, "invalid_state")
  assert.deepEqual(ok(await actions.adminRecord({ section: "inquiries", id: mailRef })).actions.map((a) => a.id), ["reopen"])
  ok(await actions.adminAct({ section: "inquiries", id: mailRef, action: "reopen" }))
  assert.equal(ok(await actions.adminTable({ section: "inquiries", search: mailRef })).rows[0].cells.status, "in_progress")
  assert.equal((await actions.adminAct({ section: "inquiries", id: "Q-NOSUCH00", action: "mark-done" })).code, "not_found")

  const overview = ok(await actions.adminOverview())
  assert.ok(overview.todo.some((t) => t.id === "received" && t.count >= 1 && t.href === "/admin/inquiries?status=received"))

  const logged = (await d.select().from(adminActions)).filter((r) => r.action.startsWith("inquiries.") || r.action === "inquiry_reply")
  assert.ok(logged.some((r) => r.action === "inquiries.save" && r.adminUserId === "admin"))
  assert.ok(logged.some((r) => r.action === "inquiries.mark-done"))
  assert.doesNotMatch(JSON.stringify(logged), /Yes, we do|Called back|jamie@example|010-1234/, "행동 기록에 답변 글·연락처는 없다")
})

test("불만으로 올리기 — 위험 행동: 소유자는 못 하고(adminOnly), 관리자도 confirmed: true 가 정확히 true 일 때만, 한 번만", async () => {
  const ref = await submitInquiry()
  setSession("owner")
  assert.equal(ok(await actions.adminRecord({ section: "inquiries", id: ref })).danger, undefined, "소유자에게 관리자 전용 단추는 안 보인다")
  const denied = await actions.adminAct({ section: "inquiries", id: ref, action: "mark-complaint", confirmed: true })
  assert.deepEqual([denied.ok, denied.code], [false, "forbidden"])

  setSession("admin")
  for (const confirmed of [undefined, false, "true", 1]) {
    const r = await actions.adminAct({ section: "inquiries", id: ref, action: "mark-complaint", ...(confirmed === undefined ? {} : { confirmed }) })
    assert.equal(r.ok, false, String(confirmed))
    assert.ok(["confirmation_required", "invalid_input"].includes(r.code), String(confirmed))
  }
  const kindOf = async () => (await d.select().from(inquiries)).find((q) => q.reference === ref)
  assert.equal((await kindOf()).kind, "general")
  const before = (await kindOf()).expiresAt
  ok(await actions.adminAct({ section: "inquiries", id: ref, action: "mark-complaint", confirmed: true }))
  const row = await kindOf()
  assert.equal(row.kind, "complaint")
  assert.ok(row.expiresAt.getTime() > before.getTime(), "불만은 더 오래(3년) 보관한다")
  assert.equal((await actions.adminAct({ section: "inquiries", id: ref, action: "mark-complaint", confirmed: true })).code, "invalid_state")
  assert.equal(ok(await actions.adminRecord({ section: "inquiries", id: ref })).danger, undefined)
})

test("후기 한 바퀴 — 검토 대기 목록 → 상세 → 판매자 답변 → 승인 → 숨김(확인 필수) → 다시 보이기, 숨김 사유는 상세에만", async () => {
  setSession("owner")
  const id = await submitReview({ title: "Good value", body: "Arrived quickly and works well." })
  const other = await submitReview()

  const pending = ok(await actions.adminTable({ section: "reviews", status: "pending" }))
  assert.ok(pending.rows.some((r) => r.id === id) && pending.rows.every((r) => r.cells.status === "pending"))
  assert.equal(pending.rows.find((r) => r.id === id).cells.excerpt, "Good value")
  assert.deepEqual(ok(await actions.adminTable({ section: "reviews", status: "hidden" })).rows, [])
  assert.deepEqual(ok(await actions.adminTable({ section: "reviews", search: "arrived quickly" })).rows.map((r) => r.id), [id])
  assert.equal((await actions.adminTable({ section: "reviews", status: "weird" })).code, "invalid_input")

  const rec = ok(await actions.adminRecord({ section: "reviews", id }))
  assert.equal(rec.summary.find((s) => s.label === "Text").value, "Arrived quickly and works well.")
  assert.deepEqual(rec.actions.map((a) => a.id), ["approve"], "검토 대기는 승인만. 숨김은 위험 행동 하나로 나간다")
  assert.deepEqual(rec.danger, { id: "hide", label: "Hide" })
  assert.ok(ok(await actions.adminOverview()).todo.some((t) => t.id === "pending" && t.count >= 2))

  const answered = await actions.adminAct({ section: "reviews", id, action: "save", fields: { answer: "Thank you for the kind words." } })
  assert.equal(answered.ok, true, JSON.stringify(answered))
  assert.equal(ok(await actions.adminRecord({ section: "reviews", id })).fields[0].value, "Thank you for the kind words.")
  const empty = await actions.adminAct({ section: "reviews", id, action: "save", fields: { answer: "" } })
  assert.deepEqual([empty.ok, empty.code], [false, "invalid_input"])

  ok(await actions.adminAct({ section: "reviews", id, action: "approve" }))
  assert.equal((await actions.adminAct({ section: "reviews", id, action: "approve" })).code, "invalid_state")
  assert.equal((await actions.adminAct({ section: "reviews", id, action: "unhide" })).code, "invalid_state")
  assert.equal(ok(await actions.adminRecord({ section: "reviews", id })).summary.find((s) => s.label === "Status").value, "published")

  for (const confirmed of [undefined, false, "true"]) {
    const r = await actions.adminAct({ section: "reviews", id, action: "hide", ...(confirmed === undefined ? {} : { confirmed }) })
    assert.equal(r.ok, false)
    assert.ok(["confirmation_required", "invalid_input"].includes(r.code))
  }
  assert.equal(ok(await actions.adminTable({ section: "reviews", status: "published" })).rows.some((r) => r.id === id), true, "확인 없이는 숨겨지지 않는다")
  ok(await actions.adminAct({ section: "reviews", id, action: "hide", confirmed: true }))
  assert.equal((await actions.adminAct({ section: "reviews", id, action: "hide", confirmed: true })).code, "invalid_state")
  const hidden = ok(await actions.adminRecord({ section: "reviews", id }))
  assert.equal(hidden.summary.find((s) => s.label === "Hidden because").value, "Hidden in the admin console")
  assert.deepEqual(hidden.actions.map((a) => a.id), ["unhide"])
  ok(await actions.adminAct({ section: "reviews", id, action: "unhide" }))
  assert.equal(ok(await actions.adminRecord({ section: "reviews", id })).summary.find((s) => s.label === "Status").value, "published")

  assert.equal((await actions.adminAct({ section: "reviews", id: "00000000-0000-4000-8000-000000000000", action: "approve" })).code, "not_found")
  assert.equal(ok(await actions.adminRecord({ section: "reviews", id: other })).summary.find((s) => s.label === "Status").value, "pending", "다른 후기는 건드리지 않았다")

  const logged = (await d.select().from(adminActions)).filter((r) => r.action.startsWith("reviews."))
  assert.deepEqual([...new Set(logged.map((r) => r.action))].sort(), ["reviews.approve", "reviews.hide", "reviews.save", "reviews.unhide"])
  assert.ok(logged.every((r) => r.adminUserId === "owner" && r.meta.via === "owner"))
  assert.doesNotMatch(JSON.stringify(logged), /Thank you for the kind words|Arrived quickly/, "행동 기록에 답변·후기 글은 없다")
})
