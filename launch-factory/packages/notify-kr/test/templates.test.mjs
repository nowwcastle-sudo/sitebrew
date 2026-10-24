import assert from "node:assert/strict"
import { test } from "node:test"
import { alimtalkVariables, checkTemplates, DEFAULT_BOOKING_TEMPLATES, missingVars, placeholdersOf, renderSms } from "../src/templates.ts"

const V = { name: "", service: "상담 30분", when: "10월 25일 14:00", reference: "BK-7Q2M", manageUrl: "https://example.com/book/manage" }

test("내장 예약 템플릿 4종은 정상이고 알림톡 id 를 하드코딩하지 않는다", () => {
  assert.deepEqual(Object.keys(DEFAULT_BOOKING_TEMPLATES).sort(), ["bookingCancelled", "bookingConfirmed", "bookingReminder", "bookingRequested"])
  assert.deepEqual(checkTemplates(DEFAULT_BOOKING_TEMPLATES), [])
  for (const t of Object.values(DEFAULT_BOOKING_TEMPLATES)) {
    assert.equal(t.alimtalkId, undefined)
    assert.deepEqual([...t.vars], ["name", "service", "when", "reference", "manageUrl"])
    assert.ok(!t.sms.ko.includes("(광고)") && !t.sms.en.includes("(광고)"), "안내 전용 — 광고 문구 없음")
  }
})

test("renderSms: 변수 치환 · ko/en · 비어 버린 끝 줄 정리", () => {
  const t = DEFAULT_BOOKING_TEMPLATES.bookingConfirmed
  assert.equal(renderSms(t, V, "ko"), "[예약 확정] 상담 30분 10월 25일 14:00\n접수번호 BK-7Q2M\nhttps://example.com/book/manage")
  assert.match(renderSms(t, V, "en"), /^\[Booking confirmed\] 상담 30분 on /)
  // 선택 변수가 비면 그 줄이 남지 않는다
  assert.equal(renderSms(t, { ...V, manageUrl: undefined }, "ko"), "[예약 확정] 상담 30분 10월 25일 14:00\n접수번호 BK-7Q2M")
})

test("renderSms: 값 안의 #{…} 는 다시 풀리지 않고, 템플릿 밖 변수는 빈 글", () => {
  const t = { vars: ["a"], sms: { ko: "x #{a} y #{b}", en: "x" } }
  assert.equal(renderSms(t, { a: "#{b}", b: "SECRET" }, "ko"), "x #{b} y")
})

test("missingVars: 필수만 센다 · 빈 글과 공백은 빠진 것", () => {
  const t = DEFAULT_BOOKING_TEMPLATES.bookingConfirmed
  assert.deepEqual(missingVars(t, V), [])
  assert.deepEqual(missingVars(t, { service: "a", when: " ", reference: "" }), ["when", "reference"])
  assert.deepEqual(missingVars(t, {}), ["service", "when", "reference"])
})

test("alimtalkVariables: 키를 #{} 로 감싸고 템플릿 변수 전부를 싣는다(빠진 선택 변수는 빈 글)", () => {
  assert.deepEqual(alimtalkVariables(DEFAULT_BOOKING_TEMPLATES.bookingCancelled, { service: "s", when: "w", reference: "r", extra: "무시" }), {
    "#{name}": "",
    "#{service}": "s",
    "#{when}": "w",
    "#{reference}": "r",
    "#{manageUrl}": "",
  })
})

test("placeholdersOf: 중복 없이 나온 순서", () => {
  assert.deepEqual(placeholdersOf("#{b} #{a} #{b} #{ x } #{1y}"), ["b", "a"])
})

test("checkTemplates: 설정 단계에서 오타를 잡는다", () => {
  const bad = {
    t1: { vars: ["a", "a"], sms: { ko: "#{a}", en: "#{a}" } },
    t2: { vars: ["a"], optional: ["z"], sms: { ko: "#{a} #{q}", en: "" } },
    t3: { vars: ["1bad"], alimtalkId: " ", sms: { ko: "k", en: "e" } },
    t4: { sms: { ko: "k", en: "e" } },
  }
  const problems = checkTemplates(bad).join("\n")
  assert.match(problems, /"t1": duplicate variable names/)
  assert.match(problems, /"t2": optional "z" is not in vars/)
  assert.match(problems, /"t2": sms\.ko uses #\{q\}/)
  assert.match(problems, /"t2": sms\.en is required/)
  assert.match(problems, /"t3": bad variable name "1bad"/)
  assert.match(problems, /"t3": alimtalkId/)
  assert.match(problems, /"t4": vars must be an array/)
})
