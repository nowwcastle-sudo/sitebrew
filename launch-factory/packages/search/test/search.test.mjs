// 사이트 검색(계획 3c Task 2) — 낱말 정리·이스케이프·AND·제목 가중·범위 배열·색인(교체 원자성)·요청 제한.
// PGlite 메모리 DB 하나를 파일 전체가 나눠 쓴다. 시계는 시험이 넣는다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { count, eq } from "drizzle-orm"
import { db, hitRateLimit, searchDocuments } from "@launch-factory/db"
import { createRateLimiter, RATE_LIMIT_DEFAULTS } from "@launch-factory/security/rate-limit"
import { buildQuery, createSearchService, makeSnippet, normalizeDocument, normalizeQuery, MAX_BODY_LENGTH } from "../src/index.ts"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

const clock = { at: new Date("2026-10-22T00:00:00.000Z") }
const now = () => clock.at
let ipSeq = 0
const freshIp = () => `198.51.100.${++ipSeq}`
const limiter = () => createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now })
const service = (o = {}) => createSearchService({ db: d, limiter: limiter(), now, ...o })
const doc = (o) => ({ kind: "product", ref: "p1", locale: "ko", title: "제목", body: "", url: "/p/1", ...o })
const must = (r) => (assert.equal(r.ok, true, JSON.stringify(r)), r.data)

// ── 순수 모듈 ────────────────────────────────────────────────────────────────

test("normalizeQuery: 공백·제어 문자·결합 문자 정리, 100자 상한, 낱말 5개, 같은 낱말 한 번", () => {
  assert.deepEqual(normalizeQuery("  무선   청소기\t\n"), ["무선", "청소기"])
  assert.deepEqual(normalizeQuery("​청‌소기"), ["청소기"], "보이지 않는 서식 문자는 지운다")
  assert.deepEqual(normalizeQuery("가"), ["가"], "자모로 갈라진 한글은 음절로 합친다(NFC)")
  assert.deepEqual(normalizeQuery("a b c d e f g"), ["a", "b", "c", "d", "e"])
  assert.deepEqual(normalizeQuery("Vac vac VAC cleaner"), ["Vac", "cleaner"])
  assert.equal(normalizeQuery("가".repeat(300))[0].length, 100)
  assert.equal(Array.from(normalizeQuery("😀".repeat(300))[0]).length, 100, "이모지도 코드 포인트로 센다")
  assert.deepEqual(normalizeQuery(""), [])
  assert.deepEqual(normalizeQuery("   "), [])
  assert.deepEqual(normalizeQuery(undefined), [])
  assert.deepEqual(normalizeQuery(42), [])
})

test("buildQuery: LIKE 특수 글자를 이스케이프하고, 쪽·종류·언어를 정리하며, 빈 질의는 null", () => {
  const q = buildQuery({ q: "100% a_b c\\d", page: "2", pageSize: "500", kinds: ["page", "BAD KIND", "page"], locale: "ko" })
  assert.deepEqual(q.patterns, ["%100\\%%", "%a\\_b%", "%c\\\\d%"])
  assert.deepEqual(q.terms, ["100%", "a_b", "c\\d"])
  assert.equal(q.pageSize, 50)
  assert.equal(q.page, 2)
  assert.equal(q.offset, 50)
  assert.deepEqual(q.kinds, ["page"])
  assert.equal(q.locale, "ko")
  const lax = buildQuery({ q: "x", page: -3, pageSize: "abc", locale: "xx" })
  assert.deepEqual([lax.page, lax.pageSize, lax.locale], [1, 10, undefined])
  assert.equal(buildQuery({ q: "  " }), null)
  assert.equal(buildQuery({ q: "x", kinds: ["BAD KIND"] }), null, "쓸 수 있는 종류가 하나도 없으면 찾을 것이 없다")
})

test("normalizeDocument: 본문 4000자 상한, 공백 정리, 위험한 주소·잘못된 값은 던진다", () => {
  const ok = normalizeDocument(doc({ title: "  무선\n청소기 ", body: "가".repeat(5000) }))
  assert.equal(ok.title, "무선 청소기")
  assert.equal(ok.body.length, MAX_BODY_LENGTH)
  assert.equal(normalizeDocument(doc({ body: undefined })).body, "")
  for (const url of ["javascript:alert(1)", "//evil.example/x", "data:text/html,x", "", "/a b"]) assert.throws(() => normalizeDocument(doc({ url })), /url/, url)
  assert.equal(normalizeDocument(doc({ url: "https://example.com/a?b=1" })).url, "https://example.com/a?b=1")
  assert.throws(() => normalizeDocument(doc({ kind: "Bad Kind" })), /kind/)
  assert.throws(() => normalizeDocument(doc({ ref: " " })), /ref/)
  assert.throws(() => normalizeDocument(doc({ title: "  " })), /title/)
  assert.throws(() => normalizeDocument(doc({ locale: "fr" })), /locale/)
})

test("makeSnippet: 범위는 text 안의 위치와 정확히 맞고, HTML 로 풀리지 않는다", () => {
  const body = `${"앞".repeat(80)} 무선청소기는 가볍고 <script>alert(1)</script> 청소기 ${"뒤".repeat(200)}`
  const s = makeSnippet(body, ["청소기", "가볍고"])
  assert.ok(s.text.startsWith("…") && s.text.endsWith("…"))
  assert.ok(Array.from(s.text).length <= 120 + 2)
  assert.deepEqual(s.ranges.map(([a, b]) => s.text.slice(a, b)), ["청소기", "가볍고", "청소기"])
  assert.ok(s.text.includes("<script>"), "글자는 그대로 두고 마크업으로 바꾸지 않는다")
  // 일치가 본문에 없으면(제목에서만 맞음) 본문 앞부분, 범위 없음
  const t = makeSnippet("짧은 본문입니다", ["없는말"])
  assert.deepEqual(t, { text: "짧은 본문입니다", ranges: [] })
  // 붙은 일치는 하나로, 대소문자 무시
  const u = makeSnippet("Vacuum cleaner", ["vac", "uum"])
  assert.deepEqual(u.ranges, [[0, 6]])
  // 빈 본문
  assert.deepEqual(makeSnippet("", ["x"]), { text: "", ranges: [] })
  // 대리쌍(surrogate pair)을 가르지 않는다
  const e = makeSnippet(`${"😀".repeat(100)}청소기${"😀".repeat(100)}`, ["청소기"])
  assert.ok(!/[\uD800-\uDBFF]$|^[\uDC00-\uDFFF]/.test(e.text.replace(/^…|…$/g, "")), "쪼개진 이모지가 없다")
  assert.equal(e.text.slice(...e.ranges[0]), "청소기")
})

// ── 서비스(DB) ──────────────────────────────────────────────────────────────

test("한국어 부분 문자열: 「청소기」가 「무선청소기」 제목에 맞는다", async () => {
  const s = service()
  await s.indexDocuments([doc({ ref: "k1", title: "무선청소기 A1", body: "가벼운 청소 도구", url: "/p/k1" }), doc({ ref: "k2", title: "선풍기", body: "여름", url: "/p/k2" })])
  const r = must(await s.search({ q: "청소기", kinds: ["product"] }, { ip: freshIp() }))
  assert.deepEqual(r.items.map((i) => i.ref), ["k1"])
  assert.deepEqual(r.items[0], { kind: "product", ref: "k1", title: "무선청소기 A1", url: "/p/k1", snippet: { text: "가벼운 청소 도구", ranges: [] } })
  assert.equal(r.total, 1)
  assert.equal(r.page, 1)
  assert.equal(r.pageCount, 1)
})

test("특수 글자는 글자 그대로 찾는다: 「100%」는 「100%」 문서만, 「_」는 모든 문서에 맞지 않는다", async () => {
  const s = service()
  await s.indexDocuments([doc({ kind: "esc", ref: "e1", title: "할인 100% 보장" }), doc({ kind: "esc", ref: "e2", title: "할인 1000원" }), doc({ kind: "esc", ref: "e3", title: "a_b" }), doc({ kind: "esc", ref: "e4", title: "axb" }), doc({ kind: "esc", ref: "e5", title: "c\\d" })])
  const who = { ip: freshIp() }
  const q = async (text) => must(await s.search({ q: text, kinds: ["esc"] }, who)).items.map((i) => i.ref).sort()
  assert.deepEqual(await q("100%"), ["e1"])
  assert.deepEqual(await q("%"), ["e1"])
  assert.deepEqual(await q("a_b"), ["e3"])
  assert.deepEqual(await q("_"), ["e3"])
  assert.deepEqual(await q("c\\d"), ["e5"])
  assert.deepEqual(await q("\\"), ["e5"])
})

test("모든 낱말이 제목 또는 본문에 있어야 한다(AND) — 낱말이 서로 다른 칸에 있어도 된다", async () => {
  const s = service()
  await s.indexDocuments([
    doc({ kind: "and", ref: "a1", title: "무선 청소기", body: "" }),
    doc({ kind: "and", ref: "a2", title: "무선 선풍기", body: "청소기 아님이 아니라 청소기 후속" }),
    doc({ kind: "and", ref: "a3", title: "유선 청소기", body: "배터리 없음" }),
  ])
  const who = { ip: freshIp() }
  const refs = async (text) => must(await s.search({ q: text, kinds: ["and"] }, who)).items.map((i) => i.ref).sort()
  assert.deepEqual(await refs("무선 청소기"), ["a1", "a2"])
  assert.deepEqual(await refs("무선 청소기 배터리"), [])
  assert.deepEqual(await refs("청소기 배터리"), ["a3"])
})

test("점수: 제목 일치 3 + 본문 일치 1(낱말마다), 동점은 최신", async () => {
  const s = service()
  const at = (day) => new Date(`2026-10-${day}T00:00:00.000Z`)
  clock.at = at("01")
  await s.indexDocuments([doc({ kind: "sc", ref: "old-body", title: "x", body: "가방" })])
  clock.at = at("02")
  await s.indexDocuments([doc({ kind: "sc", ref: "title", title: "가방", body: "" })])
  clock.at = at("03")
  await s.indexDocuments([doc({ kind: "sc", ref: "both", title: "가방", body: "가방 이야기" })])
  clock.at = at("04")
  await s.indexDocuments([doc({ kind: "sc", ref: "new-body", title: "y", body: "가방" })])
  const r = must(await s.search({ q: "가방", kinds: ["sc"] }, { ip: freshIp() }))
  assert.deepEqual(r.items.map((i) => i.ref), ["both", "title", "new-body", "old-body"], "both 4점 · title 3점 · 본문만 1점 둘은 최신 먼저")
  clock.at = new Date("2026-10-22T00:00:00.000Z")
})

test("낱말별 가중: 두 낱말이 모두 제목에 있으면 한 낱말만 제목에 있는 것보다 앞선다", async () => {
  const s = service()
  await s.indexDocuments([doc({ kind: "w", ref: "one", title: "여행 가방", body: "캐리어" }), doc({ kind: "w", ref: "two", title: "여행 캐리어", body: "" })])
  const r = must(await s.search({ q: "여행 캐리어", kinds: ["w"] }, { ip: freshIp() }))
  assert.deepEqual(r.items.map((i) => i.ref), ["two", "one"], "two = 3+3, one = 3+1")
})

test("하이라이트는 범위 배열이다 — 본문 일치의 자리가 text 와 맞다", async () => {
  const s = service()
  await s.indexDocuments([doc({ kind: "hl", ref: "h1", title: "안내", body: `${"가".repeat(100)} 무선청소기 사용법 <b>굵게</b> 무선청소기` })])
  const [item] = must(await s.search({ q: "무선청소기", kinds: ["hl"] }, { ip: freshIp() })).items
  assert.deepEqual(item.snippet.ranges.map(([a, b]) => item.snippet.text.slice(a, b)), ["무선청소기", "무선청소기"])
  assert.ok(item.snippet.text.includes("<b>"), "마크업을 만들지 않는다")
})

test("종류·언어 걸러내기와 쪽 나누기: total·pageCount", async () => {
  const s = service()
  const many = Array.from({ length: 23 }, (_, i) => doc({ kind: "pg", ref: `r${String(i).padStart(2, "0")}`, locale: i % 2 ? "en" : "ko", title: `상품 ${i}`, body: "" }))
  await s.indexDocuments([...many, doc({ kind: "other", ref: "o1", title: "상품 기타" })])
  const who = { ip: freshIp() }
  const all = must(await s.search({ q: "상품", kinds: ["pg"], pageSize: 10 }, who))
  assert.deepEqual([all.total, all.page, all.pageCount, all.items.length], [23, 1, 3, 10])
  const last = must(await s.search({ q: "상품", kinds: ["pg"], pageSize: 10, page: 3 }, who))
  assert.equal(last.items.length, 3)
  const beyond = must(await s.search({ q: "상품", kinds: ["pg"], pageSize: 10, page: 9 }, who))
  assert.deepEqual([beyond.items.length, beyond.total, beyond.pageCount], [0, 23, 3])
  const en = must(await s.search({ q: "상품", kinds: ["pg"], locale: "en", pageSize: 50 }, who))
  assert.equal(en.total, 11)
  assert.ok(en.items.every((i) => i.kind === "pg"))
  const both = must(await s.search({ q: "상품", kinds: ["pg", "other"], pageSize: 50 }, who))
  assert.equal(both.total, 24)
})

test("빈 질의는 빈 결과다(오류 아님)", async () => {
  const s = service()
  for (const q of ["", "   ", undefined, 7]) assert.deepEqual(await s.search({ q }, { ip: freshIp() }), { ok: true, data: { items: [], total: 0, page: 1, pageCount: 0 } })
})

test("색인: 같은 (kind, ref) 는 덮어쓰고 본문은 4000자로 자르며, removeDocument 로 지운다", async () => {
  const s = service()
  await s.indexDocuments([doc({ kind: "ix", ref: "i1", title: "처음", body: "가".repeat(5000) })])
  await s.indexDocuments([doc({ kind: "ix", ref: "i1", title: "나중", body: "나".repeat(5000) })])
  const rows = await d.select().from(searchDocuments).where(eq(searchDocuments.kind, "ix"))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, "나중")
  assert.equal(rows[0].body.length, 4000)
  assert.equal((await s.removeDocument("ix", "i1")), true)
  assert.equal((await s.removeDocument("ix", "i1")), false)
  assert.equal(await s.indexDocuments([]), 0)
})

test("replaceKind: 그 종류만 통째로 바꾸고, 잘못된 문서가 하나라도 있으면 아무것도 바꾸지 않는다(원자성)", async () => {
  const s = service()
  await s.indexDocuments([doc({ kind: "rk", ref: "a", title: "옛것 A" }), doc({ kind: "rk", ref: "b", title: "옛것 B" }), doc({ kind: "keep", ref: "k", title: "다른 종류" })])
  assert.equal(await s.replaceKind("rk", [doc({ kind: "rk", ref: "b", title: "새것 B" }), doc({ kind: "rk", ref: "c", title: "새것 C" })]), 2)
  const titles = async (kind) => (await d.select().from(searchDocuments).where(eq(searchDocuments.kind, kind))).map((r) => `${r.ref}:${r.title}`).sort()
  assert.deepEqual(await titles("rk"), ["b:새것 B", "c:새것 C"])
  assert.deepEqual(await titles("keep"), ["k:다른 종류"])
  // 검사 단계에서 실패 — DB 는 그대로
  await assert.rejects(s.replaceKind("rk", [doc({ kind: "rk", ref: "z", title: "새것 Z" }), doc({ kind: "rk", ref: "y", title: "" })]), /title/)
  assert.deepEqual(await titles("rk"), ["b:새것 B", "c:새것 C"])
  // 다른 종류 문서가 섞여 있으면 거절
  await assert.rejects(s.replaceKind("rk", [doc({ kind: "keep", ref: "x", title: "섞임" })]), /kind/)
  assert.deepEqual(await titles("rk"), ["b:새것 B", "c:새것 C"])
  // DB 단계에서 실패(삭제 뒤 넣다가 오류) — 롤백되어 옛 문서가 남는다
  const { replaceSearchKind } = await import("@launch-factory/db")
  await assert.rejects(replaceSearchKind(d, "rk", [{ kind: "rk", ref: "bad", locale: "ko", title: "x", body: "", url: "/x", updatedAt: new Date("invalid") }]))
  assert.deepEqual(await titles("rk"), ["b:새것 B", "c:새것 C"], "삭제까지 되돌려진다")
  assert.equal(await s.replaceKind("rk", []), 0)
  assert.deepEqual(await titles("rk"), [])
})

test("요청 제한: 경로 search 한도를 넘으면 code rate_limited + retryAfter, HTTP 는 429 + Retry-After", async () => {
  const s = service()
  const who = { ip: freshIp() }
  const { max, windowSec } = RATE_LIMIT_DEFAULTS.search
  for (let i = 0; i < max; i++) assert.equal((await s.search({ q: "x" }, who)).ok, true, `${i + 1}번째`)
  const blocked = await s.search({ q: "x" }, who)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.code, "rate_limited")
  assert.equal(blocked.retryable, true)
  assert.equal(blocked.retryAfter, windowSec)
  const res = await s.handler(new Request("https://example.test/api/search?q=x", { headers: { "x-forwarded-for": who.ip } }), who)
  assert.equal(res.status, 429)
  assert.equal(res.headers.get("retry-after"), String(windowSec))
})

test("HTTP 처리기: GET ?q=&kinds=&locale=&page=&pageSize= → JSON, 다른 방식은 405", async () => {
  const s = service()
  await s.indexDocuments([doc({ kind: "http", ref: "h1", title: "무선청소기", body: "" })])
  const get = (qs, ip = freshIp()) => s.handler(new Request(`https://example.test/api/search?${qs}`), { ip })
  const res = await get("q=%EC%B2%AD%EC%86%8C%EA%B8%B0&kinds=http,nope&pageSize=5")
  assert.equal(res.status, 200)
  assert.match(res.headers.get("content-type"), /application\/json/)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.deepEqual(body.data.items.map((i) => i.ref), ["h1"])
  assert.equal((await get("")).status, 200, "질의 없음 = 빈 결과")
  assert.equal((await s.handler(new Request("https://example.test/api/search?q=x", { method: "POST" }), { ip: freshIp() })).status, 405)
})

test("DB 오류는 비밀 없이 retryable 실패가 된다 — 던지지 않는다", async () => {
  const errors = []
  const broken = createSearchService({ db: { select: () => { throw new Error("boom postgres://user:secret@host/db") } }, limiter: limiter(), now, onError: (e) => errors.push(e) })
  const r = await broken.search({ q: "x" }, { ip: freshIp() })
  assert.equal(r.ok, false)
  assert.equal(r.retryable, true)
  assert.ok(!JSON.stringify(r).includes("secret"))
  assert.equal(errors.length, 1)
  assert.equal((await broken.handler(new Request("https://example.test/api/search?q=x"), { ip: freshIp() })).status, 500)
})

test("count: 색인된 문서 수", async () => {
  const s = service()
  const n = (await d.select({ n: count() }).from(searchDocuments))[0].n
  assert.equal(await s.count(), n)
})
