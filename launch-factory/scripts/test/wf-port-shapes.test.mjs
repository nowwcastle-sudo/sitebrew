// 계획 3c 후속: launch-factory 서비스가 돌려주는 모양이 web-factory 포트(registry/factory/contract/ports.ts — 후기·검색·뉴스레터·내 신청 내역·올리기 티켓)와 맞는지 본다.
// 서비스 → 포트 사이에는 어댑터가 서는 자리가 있다 — 이 시험은 「어댑터 없이 그대로 맞는 것」과 「어댑터가 정확히 이것만 바꾸면 되는 것」을 같이 고정해,
// 한쪽이 필드를 더하거나 이름을 바꾸면 여기서 먼저 깨진다. 포트 쪽 모양은 아래 SHAPES 에 손으로 옮겼다(web-factory 3df1276, 타입 복사가 아니라 필드 이름·종류만).
// 진짜 서비스 + PGlite 메모리 DB. 네트워크 없음.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createAdminConsole, defineSection } from "@launch-factory/admin-console"
import { db, hitRateLimit, inquiries, INQUIRY_STATUSES, user as userTable } from "@launch-factory/db"
import { createMailer } from "@launch-factory/email"
import { createInquiryService } from "@launch-factory/inquiry"
import { createNewsletterService } from "@launch-factory/newsletter"
import { createReviewsService, SORTS as LF_REVIEW_SORTS } from "@launch-factory/reviews"
import { createSearchService } from "@launch-factory/search"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { createStorageService, STORAGE_KINDS } from "@launch-factory/storage"

/** 포트 쪽 모양. 값은 typeof 이름, "?" 로 끝나면 선택, 배열은 [모양], 객체는 중첩, 문자열 리터럴 목록은 그 중 하나 */
const SHAPES = {
  Review: { id: "string", rating: [1, 2, 3, 4, 5], "title?": "string", body: "string", author: "string", date: "date", "verified?": "boolean", "option?": "string", "reply?": { author: "string", body: "string", date: "date" } },
  Question: { id: "string", body: "string", author: "string", date: "date", "reply?": { author: "string", body: "string", date: "date" } },
  RatingSummary: { avg: "number", count: "number", asOf: "date", distribution: { 1: "number", 2: "number", 3: "number", 4: "number", 5: "number" } },
  SearchHit: { kind: "string", ref: "string", title: "string", url: "string", snippet: { text: "string", ranges: "ranges" } },
  UploadTicket: { id: "string", key: "string", method: ["PUT"], url: "string", headers: "headers", expiresAt: "string", maxBytes: "number" },
  MyRequest: { reference: "string", kind: "string", status: ["received", "in_progress", "done"], receivedAt: "string", preview: "string" },
}
// 관리 포트(contract/admin.ts) 모양 — 계획 3d. 콘솔이 돌려주는 값이 이 모양과 같아야 web-factory 의 관리 블록이 그대로 그린다.
const ADMIN_SHAPES = {
  Column: { id: "string", label: "string", "kind?": ["text", "numeric", "date", "status", "contact"], "sortable?": "boolean", "filter?": "boolean", "primary?": "boolean", "secondary?": "boolean" },
  Row: { id: "string", cells: "object", "href?": "string" },
  Todo: { id: "string", severity: ["critical", "warning"], title: "string", "detail?": "string", href: "string", count: "number" },
  Metric: { id: "string", label: "string", value: "number", previous: "number", unit: "string", comparePeriod: "string" },
  Field: { name: "string", label: "string", "type?": ["text", "email", "tel", "textarea", "number"], "required?": "boolean", value: "string" },
  SummaryItem: { label: "string", value: "string", "kind?": ["text", "numeric", "status", "contact"] },
  Action: { id: "string", label: "string" },
  SectionInfo: { id: "string", label: "string", href: "string" },
}
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** value 가 shape 와 같은 모양인지: 모르는 키·빠진 필수 키·틀린 종류를 모아 돌려준다 */
function problems(value, shape, path = "$") {
  const out = []
  if (Array.isArray(shape)) {
    if (!shape.includes(value)) out.push(`${path}: ${JSON.stringify(value)} 는 ${JSON.stringify(shape)} 중 하나가 아니다`)
    return out
  }
  if (typeof shape === "string") {
    const ok =
      shape === "date" ? typeof value === "string" && DATE.test(value)
      : shape === "ranges" ? Array.isArray(value) && value.every((r) => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger))
      : shape === "object" ? value !== null && typeof value === "object" && !Array.isArray(value)
      : shape === "array" ? Array.isArray(value)
      : shape === "headers" ? value !== null && typeof value === "object" && Object.values(value).every((v) => typeof v === "string")
      : typeof value === shape
    if (!ok) out.push(`${path}: ${shape} 이어야 한다 (${JSON.stringify(value)})`)
    return out
  }
  if (value === null || typeof value !== "object") return [`${path}: 객체여야 한다`]
  const known = new Set()
  for (const [k, sub] of Object.entries(shape)) {
    const optional = k.endsWith("?")
    const key = optional ? k.slice(0, -1) : k
    known.add(key)
    if (!(key in value) || value[key] === undefined) {
      if (!optional) out.push(`${path}.${key}: 빠졌다`)
      continue
    }
    out.push(...problems(value[key], sub, `${path}.${key}`))
  }
  for (const k of Object.keys(value)) if (!known.has(k)) out.push(`${path}.${k}: 포트에 없는 필드다`)
  return out
}
/** 어댑터가 떼어 낼 필드를 뺀 사본 */
const without = (obj, ...keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)))
const assertShape = (value, shape, drop = []) => assert.deepEqual(problems(drop.length ? without(value, ...drop) : value, shape), [])

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
  const at = new Date("2026-10-01T00:00:00.000Z")
  for (const id of ["shape-a"]) await d.insert(userTable).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
})
after(async () => {
  await d?.$client.close()
})

const at = new Date("2026-10-22T03:00:00.000Z")
const limiter = () => createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now: () => at })
let seq = 0
const ip = () => `198.51.100.${(++seq % 250) + 1}`

test("shape 검사기 자신: 모르는 필드·빠진 필드·틀린 종류를 잡는다(음성 대조)", () => {
  assert.deepEqual(problems({ id: "x", body: "b", author: "a", date: "2026-10-22" }, SHAPES.Question), [])
  assert.match(problems({ id: "x", body: "b", author: "a", date: "2026-10-22", extra: 1 }, SHAPES.Question).join(), /extra: 포트에 없는/)
  assert.match(problems({ id: "x", author: "a", date: "2026-10-22" }, SHAPES.Question).join(), /body: 빠졌다/)
  assert.match(problems({ id: "x", body: "b", author: "a", date: "22 Oct" }, SHAPES.Question).join(), /date: date/)
})

test("후기: 공개 항목·요약이 포트와 같고(어댑터는 kind 만 떼고 더한다), 제출 영수증과 정렬 이름 대응이 맞다", async () => {
  const reviews = createReviewsService({ db: d, limiter: limiter(), turnstile: createTurnstile({ mode: "mock" }), now: () => at, onError: () => {} })
  const subject = { subjectType: "product", subjectId: "shape-1" }
  const fields = { ...subject, "cf-turnstile-response": "x", locale: "ko" }
  const r = await reviews.submit({ ...fields, kind: "review", rating: "4", title: "괜찮아요", body: "쓰기 편하고 가벼워서 좋아요." }, { ip: ip(), userId: "shape-a" })
  assert.equal(r.ok, true, JSON.stringify(r))
  assertShape(r.data, { id: "string", status: ["published", "pending"] })
  const q = await reviews.submit({ ...fields, kind: "question", body: "색은 몇 가지인가요?", authorName: "방문자" }, { ip: ip() })
  assert.equal(q.ok, true, JSON.stringify(q))

  const list = await reviews.list({ ...subject, kind: "review", sort: "latest", page: 1, pageSize: 10 })
  assertShape(list, { items: "array", total: "number", page: "number", pageCount: "number", summary: SHAPES.RatingSummary }, [])
  assert.equal(list.items.length, 1)
  assertShape(list.items[0], SHAPES.Review, ["kind"]) // 어댑터가 kind 를 떼어 낸다
  assert.equal(list.items[0].kind, "review")

  const questions = await reviews.list({ ...subject, kind: "question", sort: "latest", page: 1, pageSize: 10 })
  assert.equal(questions.items.length, 1)
  assert.equal("summary" in questions, false, "질문 목록에는 요약이 없다")
  assertShape(questions.items[0], SHAPES.Question, ["kind"])

  // 정렬 이름: 포트는 밑줄, 서비스는 하이픈 — 어댑터가 이 표로 바꾼다. 서비스가 받는 값이 바뀌면 여기서 깨진다
  const SORT_MAP = { latest: "latest", rating_desc: "rating-desc", rating_asc: "rating-asc" }
  assert.deepEqual([...LF_REVIEW_SORTS].sort(), Object.values(SORT_MAP).sort())
})

test("검색: 결과가 포트와 같다 — 어댑터 없이 그대로(범위 배열·쪽 수)", async () => {
  const search = createSearchService({ db: d, limiter: limiter(), now: () => at })
  assert.equal(await search.replaceKind("page", [{ kind: "page", ref: "about", locale: "ko", title: "회사 소개", body: "무선청소기를 만드는 작은 회사예요.", url: "/about" }]), 1)
  const r = await search.search({ q: "무선청소기" }, { ip: ip() })
  assert.equal(r.ok, true, JSON.stringify(r))
  assertShape(r.data, { items: "array", total: "number", page: "number", pageCount: "number" })
  assert.equal(r.data.items.length, 1)
  assertShape(r.data.items[0], SHAPES.SearchHit)
  assert.ok(r.data.items[0].snippet.ranges.length >= 1)
  const empty = await search.search({ q: "   " }, { ip: ip() })
  assert.equal(empty.ok, true, "빈 질의는 오류가 아니라 빈 결과")
  assert.deepEqual(empty.data.items, [])
})

test("뉴스레터: 신청 응답은 이미 구독 중이어도 같다 — 어댑터는 ok 일 때 { confirmationSent: true } 로 바꾼다", async () => {
  const mailer = createMailer({ mode: "mock", log: () => {} })
  const news = createNewsletterService({ db: d, mailer, limiter: limiter(), turnstile: createTurnstile({ mode: "mock" }), secret: "lf-test-newsletter-secret-not-real-0123456789", baseUrl: "https://shop.example.test", productName: "Shape", now: () => at, onError: () => {} })
  const input = { email: "reader@example.com", consent: "on", "cf-turnstile-response": "x" }
  const first = await news.subscribe(input, { ip: ip(), locale: "ko" })
  const again = await news.subscribe(input, { ip: ip(), locale: "ko" })
  assert.equal(first.ok, true, JSON.stringify(first))
  assert.deepEqual(Object.keys(first.data), ["message"], "서비스 응답은 안내 글 하나")
  assert.deepEqual(again, first, "같은 주소를 두 번 보내도 구독자인지 알리지 않는다")
  const missingConsent = await news.subscribe({ email: "x@example.com", "cf-turnstile-response": "x" }, { ip: ip() })
  assert.equal(missingConsent.ok, false)
  assert.ok(missingConsent.fieldErrors?.consent, "동의가 없으면 consent 칸 오류 — 포트의 consent: true 와 같은 뜻")
})

test("내 신청 내역: 한 줄이 포트와 같다 — 어댑터는 contact 만 떼어 낸다, 상태 값은 같은 세 가지", async () => {
  const inquiry = createInquiryService({ db: d, mailer: createMailer({ mode: "mock", log: () => {} }), limiter: limiter(), turnstile: createTurnstile({ mode: "mock" }), owner: { email: "owner@shape.test" }, productName: "Shape", now: () => at, onError: () => {} })
  const sent = await inquiry.submit({ contact: "reader@example.com", message: "배송이 언제 오나요?", "cf-turnstile-response": "x" }, { ip: ip(), userId: "shape-a" })
  assert.equal(sent.ok, true, JSON.stringify(sent))
  const page = await inquiry.listMine("shape-a")
  assertShape(page, { items: "array", total: "number", page: "number", pageCount: "number" })
  assert.equal(page.items.length, 1)
  assertShape(page.items[0], SHAPES.MyRequest, ["contact"])
  assert.deepEqual([...INQUIRY_STATUSES], SHAPES.MyRequest.status)
  assert.ok(await d.select().from(inquiries).limit(1))
})

test("올리기 티켓: 서비스 티켓이 포트와 같고(어댑터 없음), 종류 목록도 같다", async () => {
  const driver = {
    presign: (req) => ({ url: `https://mem.test/${req.key}`, headers: req.contentType ? { "content-type": req.contentType } : {}, expiresAt: new Date(req.now.getTime() + req.expiresIn * 1000) }),
    head: async () => null,
    delete: async () => {},
    publicUrl: (key) => `https://cdn.test/${key}`,
  }
  const storage = createStorageService({ db: d, driver, limiter: limiter(), now: () => at, onError: () => {} })
  const r = await storage.createUpload({ kind: "image", contentType: "image/png", size: 1000, fileName: "a.png" }, { ip: ip(), locale: "ko" })
  assert.equal(r.ok, true, JSON.stringify(r))
  assertShape(r.data, SHAPES.UploadTicket)
  assert.deepEqual([...STORAGE_KINDS].sort(), ["attachment", "avatar", "image"], "포트 StorageKind 와 같다")
  const bad = await storage.createUpload({ kind: "avatar", contentType: "image/png", size: 1000 }, { ip: ip(), locale: "ko" })
  assert.equal(bad.ok, false)
  assert.equal(bad.status, 401, "로그인 없는 avatar — 포트의 sign_in_required 로 어댑터가 옮긴다")
})

test("관리: 콘솔이 돌려주는 구획 목록·표·기록·개요가 포트(AdminPort) 모양과 같다", async () => {
  const section = defineSection({
    id: "shapes",
    part: "shapes",
    label: "Shapes",
    audience: "admin",
    statuses: ["open", "done"],
    columns: [{ id: "name", label: "Name", primary: true }, { id: "status", label: "Status", kind: "status", filter: true }, { id: "phone", label: "Phone", kind: "contact" }],
    list: async () => ({ items: [{ id: "a", name: "A", status: "open", phone: "010-1234-5678", note: "" }], total: 1 }),
    key: (r) => r.id,
    cells: (r) => ({ name: r.name, status: r.status, phone: r.phone }),
    load: async () => ({ id: "a", name: "A", status: "open", phone: "010-1234-5678", note: "" }),
    view: (r) => ({ title: `Item ${r.name}`, summary: [{ label: "Phone", value: r.phone, kind: "contact" }] }),
    form: { fields: (r) => [{ name: "note", label: "Note", type: "textarea", value: r.note }], save: async () => ({ message: "saved" }) },
    actions: { finish: { label: "Finish", run: async () => undefined }, cancel: { label: "Cancel", danger: true, run: async () => undefined } },
    overview: async () => ({ todo: [{ id: "t1", severity: "warning", title: "Do it", href: "/admin/shapes", count: 2 }], metrics: [{ id: "m1", label: "Items", value: 3, previous: 2, unit: "count", comparePeriod: "Last 7 days" }] }),
  })
  const codes = ["sign_in_required", "forbidden", "two_factor_required", "impersonation_blocked", "provider_unavailable", "not_found", "invalid_input", "confirmation_required", "invalid_state", "action_failed"]
  const admin = { kind: "user", userId: "u-admin", role: "admin", banned: false, twoFactor: true, verifiedEmail: "boss@example.com" }
  const port = createAdminConsole({ sections: [section], identify: async () => admin, messages: Object.fromEntries(codes.map((c) => [c, c])) })

  const sections = await port.sections()
  assert.equal(sections.ok, true)
  for (const s of sections.data) assertShape(s, ADMIN_SHAPES.SectionInfo)

  const table = await port.table({ section: "shapes" })
  assert.equal(table.ok, true, JSON.stringify(table))
  assertShape(table.data, { columns: "array", rows: "array", total: "number" })
  for (const c of table.data.columns) assertShape(c, ADMIN_SHAPES.Column)
  for (const r of table.data.rows) assertShape(r, ADMIN_SHAPES.Row)

  const record = await port.record({ section: "shapes", id: "a" })
  assert.equal(record.ok, true, JSON.stringify(record))
  assertShape(record.data, { id: "string", title: "string", summary: "array", fields: "array", "save?": "string", actions: "array", "danger?": ADMIN_SHAPES.Action })
  for (const f of record.data.fields) assertShape(f, ADMIN_SHAPES.Field)
  for (const i of record.data.summary) assertShape(i, ADMIN_SHAPES.SummaryItem)
  for (const a of record.data.actions) assertShape(a, ADMIN_SHAPES.Action)

  const overview = await port.overview()
  assert.equal(overview.ok, true, JSON.stringify(overview))
  assertShape(overview.data, { todo: "array", metrics: "array", asOf: "string", "failed?": "array" })
  for (const t of overview.data.todo) assertShape(t, ADMIN_SHAPES.Todo)
  for (const m of overview.data.metrics) assertShape(m, ADMIN_SHAPES.Metric)
})
