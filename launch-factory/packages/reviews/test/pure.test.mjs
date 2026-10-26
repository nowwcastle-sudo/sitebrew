// 후기·문의의 순수 판단(이름 가리기·입력 검사·별점 요약) — DB 없이 돈다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { LIMITS, maskName, parseListQuery, parseSubmit, summarize, toPublic } from "../src/index.ts"

test("maskName: 한글 이름은 성만 남기고, 로마자 이름은 이름 + 성의 첫 글자, 한 낱말은 첫 글자만", () => {
  assert.equal(maskName("김민수"), "김**")
  assert.equal(maskName("김수"), "김*")
  assert.equal(maskName("남궁민수"), "남***")
  assert.equal(maskName("Dana Kim"), "Dana K.")
  assert.equal(maskName("  dana   kim  "), "dana K.")
  assert.equal(maskName("Dana"), "D***")
  assert.equal(maskName("Mary Jane Watson"), "Mary W.")
})

test("maskName: 이메일·숫자가 든 값은 첫 글자 말고는 새지 않고, 빈 값은 빈 글자, 아주 긴 값은 자른다", () => {
  assert.equal(maskName("kim@example.com"), "k***")
  assert.ok(!maskName("kim@example.com").includes("example"))
  assert.equal(maskName("010-1234-5678"), "0***")
  assert.equal(maskName("   "), "")
  assert.equal(maskName("😀민수"), "😀***")
  assert.ok(Array.from(maskName("가".repeat(500))).length <= 6)
  assert.ok(Array.from(maskName(`${"a".repeat(100)} ${"b".repeat(100)}`)).length <= LIMITS.name + 3)
})

const base = { kind: "review", subjectType: "product", subjectId: "sku-1", rating: "5", body: "정말 만족스러워요. 또 살 거예요." }

test("parseSubmit: 후기 — 값을 다듬어 돌려준다(별점은 문자열도 받는다)", () => {
  const r = parseSubmit({ ...base, title: "  좋아요 ", authorName: "김민수" }, { locale: "ko" })
  assert.deepEqual(r, { ok: true, value: { kind: "review", subjectType: "product", subjectId: "sku-1", rating: 5, title: "좋아요", body: base.body, authorName: "김민수" } })
})

test("parseSubmit: 필수·길이·별점 범위 오류는 칸 이름으로 돌려준다", () => {
  const e = (input) => parseSubmit(input, { locale: "ko" })
  assert.deepEqual(e({ ...base, rating: "" }).fieldErrors.rating.length, 1)
  assert.equal(e({ ...base, rating: "0" }).ok, false)
  assert.equal(e({ ...base, rating: "6" }).ok, false)
  assert.equal(e({ ...base, rating: "4.5" }).ok, false)
  assert.equal(e({ ...base, body: "" }).fieldErrors.body.length, 1)
  assert.equal(e({ ...base, body: "짧" }).ok, false, "너무 짧은 본문")
  assert.equal(e({ ...base, body: "가".repeat(LIMITS.body + 1) }).ok, false)
  assert.equal(e({ ...base, title: "가".repeat(LIMITS.title + 1) }).fieldErrors.title.length, 1)
  assert.equal(e({ ...base, authorName: "가".repeat(LIMITS.name + 1) }).fieldErrors.authorName.length, 1)
})

test("parseSubmit: 대상·종류가 틀리면 막는다 — 대상은 안전한 글자만(키·주소로 쓰인다)", () => {
  const e = (patch) => parseSubmit({ ...base, ...patch }, { locale: "ko" })
  assert.ok(e({ subjectType: "" }).fieldErrors.subjectType)
  assert.ok(e({ subjectType: "Product Page" }).fieldErrors.subjectType)
  assert.ok(e({ subjectId: "" }).fieldErrors.subjectId)
  assert.ok(e({ subjectId: "a b" }).fieldErrors.subjectId)
  assert.ok(e({ subjectId: "x".repeat(101) }).fieldErrors.subjectId)
  assert.ok(e({ kind: "rant" }).fieldErrors.kind)
  assert.ok(e({ kind: undefined }).fieldErrors.kind)
})

test("parseSubmit: 링크 개수 상한(스팸) — 기본 2개까지", () => {
  const ok = parseSubmit({ ...base, body: "자세한 건 https://a.example/x 와 www.b.example 에 있어요" }, { locale: "ko" })
  assert.equal(ok.ok, true)
  const spam = parseSubmit({ ...base, body: "https://a.example https://b.example http://c.example 사세요 사세요" }, { locale: "ko" })
  assert.equal(spam.ok, false)
  assert.ok(spam.fieldErrors.body)
  assert.equal(parseSubmit({ ...base, body: "https://a.example 좋아요 좋아요" }, { locale: "ko", maxLinks: 0 }).ok, false)
})

test("parseSubmit: 질문은 별점이 없고(보내도 버린다) 이름도 선택이다", () => {
  const r = parseSubmit({ kind: "question", subjectType: "product", subjectId: "sku-1", body: "사이즈는 어떻게 되나요?", rating: "5" }, { locale: "ko" })
  assert.deepEqual(r, { ok: true, value: { kind: "question", subjectType: "product", subjectId: "sku-1", body: "사이즈는 어떻게 되나요?" } })
})

test("parseSubmit: 문자열이 아닌 값·FormData·여분의 칸은 안전하게 다룬다", () => {
  assert.equal(parseSubmit({ ...base, body: { toString: () => "x".repeat(20) } }, { locale: "ko" }).ok, false)
  const fd = new FormData()
  for (const [k, v] of Object.entries(base)) fd.set(k, v)
  assert.equal(parseSubmit(fd, { locale: "ko" }).ok, true)
  const extra = parseSubmit({ ...base, status: "published", verified: "true", userId: "x" }, { locale: "ko" })
  assert.deepEqual(Object.keys(extra.value).sort(), ["body", "kind", "rating", "subjectId", "subjectType"], "status·verified·userId 는 입력으로 받지 않는다")
})

test("parseSubmit: 영어 오류 문구", () => {
  const r = parseSubmit({ ...base, rating: "" }, { locale: "en" })
  assert.equal(r.fieldErrors.rating[0], "Pick a rating from 1 to 5.")
})

test("parseListQuery: 기본값·상한·잘못된 값", () => {
  const q = new URLSearchParams({ subjectType: "product", subjectId: "sku-1" })
  assert.deepEqual(parseListQuery(q, { locale: "ko" }), { ok: true, value: { subjectType: "product", subjectId: "sku-1", kind: "review", sort: "latest", page: 1, pageSize: 10 } })
  const full = parseListQuery(new URLSearchParams({ subjectType: "product", subjectId: "sku-1", kind: "question", sort: "rating-desc", rating: "3", page: "2", pageSize: "500" }), { locale: "ko" })
  assert.deepEqual(full.value, { subjectType: "product", subjectId: "sku-1", kind: "question", sort: "rating-desc", page: 2, pageSize: 50 }, "질문에는 별점 거르기가 없다")
  const stars = parseListQuery(new URLSearchParams({ subjectType: "product", subjectId: "sku-1", rating: "3" }), { locale: "ko" })
  assert.equal(stars.value.rating, 3)
  assert.equal(parseListQuery(new URLSearchParams({ subjectId: "x" }), { locale: "ko" }).ok, false)
  assert.equal(parseListQuery(new URLSearchParams({ subjectType: "p", subjectId: "x", sort: "random" }), { locale: "ko" }).ok, false)
  assert.equal(parseListQuery(new URLSearchParams({ subjectType: "p", subjectId: "x", rating: "9" }), { locale: "ko" }).ok, false)
  assert.equal(parseListQuery(new URLSearchParams({ subjectType: "p", subjectId: "x", page: "0" }), { locale: "ko" }).value.page, 1)
})

test("summarize: 평균은 소수 한 자리, 분포의 합은 count 와 같고, 후기가 없으면 0", () => {
  const s = summarize([{ rating: 5, count: 3 }, { rating: 4, count: 1 }, { rating: 1, count: 1 }], new Date("2026-10-22T15:30:00Z"), "Asia/Seoul")
  assert.deepEqual(s, { avg: 4, count: 5, asOf: "2026-10-23", distribution: { 1: 1, 2: 0, 3: 0, 4: 1, 5: 3 } })
  assert.equal(Object.values(s.distribution).reduce((a, b) => a + b, 0), s.count)
  assert.equal(summarize([{ rating: 4, count: 2 }, { rating: 5, count: 1 }], new Date("2026-10-22T00:00:00Z")).avg, 4.3)
  assert.deepEqual(summarize([], new Date("2026-10-22T00:00:00Z")), { avg: 0, count: 0, asOf: "2026-10-22", distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
  assert.equal(summarize([{ rating: 7, count: 2 }], new Date()).count, 0, "범위 밖 별점은 세지 않는다")
})

test("toPublic: 공개 모양만 — 사용자 id·상태·숨김 사유·답변자 id 는 나가지 않는다", () => {
  const row = {
    id: "00000000-0000-4000-8000-000000000001", kind: "review", subjectType: "product", subjectId: "sku-1", userId: "u1", authorName: "김**", rating: 5, title: "좋아요", body: "본문",
    locale: "ko", status: "published", verified: true, answerBody: "감사합니다", answeredAt: new Date("2026-10-22T15:30:00Z"), answeredBy: "admin1", hiddenReason: null,
    createdAt: new Date("2026-10-21T01:00:00Z"), updatedAt: new Date("2026-10-22T15:30:00Z"),
  }
  const pub = toPublic(row, { timeZone: "Asia/Seoul", sellerName: "판매자" })
  assert.deepEqual(pub, { id: row.id, kind: "review", rating: 5, title: "좋아요", body: "본문", author: "김**", date: "2026-10-21", verified: true, reply: { author: "판매자", body: "감사합니다", date: "2026-10-23" } })
  const q = toPublic({ ...row, kind: "question", rating: null, title: null, verified: false, answerBody: null, answeredAt: null }, { sellerName: "판매자" })
  assert.deepEqual(q, { id: row.id, kind: "question", body: "본문", author: "김**", date: "2026-10-21" })
})
