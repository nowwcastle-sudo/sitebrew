// 슬롯 계산 — 순수 시험(DB·시계 없음). 시간대 변환은 Intl 만 쓴다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { computeSlots } from "../src/slots.ts"
import { addDays, isCalendarDate, isTimeZone, localDateOf, weekdayOf, zonedToUtc } from "../src/zoned.ts"
import { parseBookingConfig } from "../src/config.ts"
import { sampleConfig } from "./fixtures.mjs"

const config = parseBookingConfig(sampleConfig())
const NOW = new Date("2026-11-01T00:00:00Z") // 일요일 09:00 서울
const MON = "2026-11-02"
const kst = (hhmm, date = MON) => new Date(`${date}T${hhmm}:00+09:00`)
const starts = (day) => day.slots.map((s) => s.startsAt.toISOString())
const only = (days) => {
  assert.equal(days.length, 1)
  return days[0]
}

test("월요일 커트(60분) — 10:00 부터 17:00 까지 30분 간격 15칸, 17:30 은 영업 끝(18:00)을 넘어 빠진다", () => {
  const day = only(computeSlots(config, "cut", MON, 1, [], NOW))
  assert.equal(day.date, MON)
  assert.equal(day.slots.length, 15)
  assert.equal(day.slots[0].startsAt.toISOString(), "2026-11-02T01:00:00.000Z")
  assert.equal(day.slots.at(-1).startsAt.toISOString(), "2026-11-02T08:00:00.000Z", "17:00 서울")
  assert.equal(day.slots.at(-1).endsAt.toISOString(), "2026-11-02T09:00:00.000Z", "끝 18:00 이 영업 끝과 맞닿는 것은 허용")
  assert.ok(day.slots.every((s) => s.endsAt.getTime() - s.startsAt.getTime() === 60 * 60_000))
  assert.ok(day.slots.every((s) => s.available === 2), "수용량 2")
})

test("서비스 길이가 길수록 마지막 시작이 앞당겨진다 — 염색(120분)은 16:00 이 마지막, 서비스 객체로 불러도 같다", () => {
  const day = only(computeSlots(config, "color", MON, 1, [], NOW))
  assert.equal(day.slots.length, 13)
  assert.equal(day.slots.at(-1).startsAt.toISOString(), kst("16:00").toISOString())
  assert.deepEqual(starts(only(computeSlots(config, config.services[1], MON, 1, [], NOW))), starts(day))
})

test("슬롯 간격이 바뀌면 칸 수가 따라간다(60분 간격·45분 간격)", () => {
  assert.equal(only(computeSlots({ ...config, slotStepMin: 60 }, "cut", MON, 1, [], NOW)).slots.length, 8)
  const s45 = only(computeSlots({ ...config, slotStepMin: 45 }, "cut", MON, 1, [], NOW)).slots.map((s) => s.startsAt.toISOString())
  assert.equal(s45[1], kst("10:45").toISOString())
  assert.equal(s45.at(-1), kst("16:45").toISOString(), "17:30 + 60분 > 18:00")
})

test("평일·토요일(짧은 영업)·일요일(휴무)·휴무일(closedDates)", () => {
  const week = computeSlots(config, "cut", "2026-11-02", 7, [], NOW)
  assert.deepEqual(week.map((d) => d.date), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"])
  assert.deepEqual(week.map((d) => d.slots.length), [15, 15, 15, 15, 15, 7, 0], "토요일 10-14 는 10:00~13:00 7칸, 일요일은 영업 없음")
  assert.equal(only(computeSlots(config, "cut", "2026-12-25", 1, [], NOW)).slots.length, 0, "크리스마스 휴무")
  assert.equal(only(computeSlots(config, "cut", "2026-12-24", 1, [], NOW)).slots.length, 15, "하루 전은 정상")
})

test("한 요일에 구간이 둘이면 구간 사이는 비고, 구간마다 서비스 길이가 끝을 넘는지 본다", () => {
  const split = parseBookingConfig(sampleConfig({ weekly: { mon: [["09:00", "12:00"], ["14:00", "16:00"]] } }))
  const day = only(computeSlots(split, "cut", MON, 1, [], NOW))
  assert.deepEqual(day.slots.map((s) => s.startsAt.toISOString()), ["09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "14:30", "15:00"].map((h) => kst(h).toISOString()))
})

test("leadMinutes: 지금부터 120분 안은 못 잡고 딱 120분 뒤부터 잡는다", () => {
  const now = kst("09:00") // 월요일 09:00
  const day = only(computeSlots(config, "cut", MON, 1, [], now))
  assert.equal(day.slots[0].startsAt.toISOString(), kst("11:00").toISOString(), "09:00 + 120분 = 11:00 부터")
  assert.equal(only(computeSlots({ ...config, leadMinutes: 0 }, "cut", MON, 1, [], now)).slots[0].startsAt.toISOString(), kst("10:00").toISOString())
  assert.equal(only(computeSlots(config, "cut", MON, 1, [], kst("16:30"))).slots.length, 0, "영업 중 마지막 슬롯까지 lead 에 걸리면 빈 날")
  assert.equal(only(computeSlots(config, "cut", "2026-10-30", 1, [], now)).slots.length, 0, "지난 날은 슬롯이 없다")
})

test("horizonDays: 오늘(지역)부터 60일 뒤 날짜까지만 — 그 다음 날은 비어 있다", () => {
  const now = new Date("2026-11-02T00:00:00Z") // 서울 11-02 09:00
  assert.equal(addDays("2026-11-02", 60), "2027-01-01")
  assert.equal(only(computeSlots(config, "cut", "2027-01-01", 1, [], now)).slots.length, 15, "금요일 — 마지막 허용 날")
  assert.equal(only(computeSlots(config, "cut", "2027-01-04", 1, [], now)).slots.length, 0, "월요일 — 범위 밖")
  // 지역 날짜 기준: UTC 로는 아직 11-01 이어도 서울은 11-02
  assert.equal(only(computeSlots({ ...config, horizonDays: 1 }, "cut", "2026-11-03", 1, [], new Date("2026-11-01T16:00:00Z"))).slots.length, 15)
  assert.equal(only(computeSlots({ ...config, horizonDays: 1 }, "cut", "2026-11-04", 1, [], new Date("2026-11-01T16:00:00Z"))).slots.length, 0)
})

test("수용량: 겹치는 예약 수만큼 자리가 줄고, 맞닿기만 한 예약은 세지 않는다", () => {
  const taken = [
    { startsAt: kst("11:00"), endsAt: kst("12:00") },
    { startsAt: kst("11:30"), endsAt: kst("12:30") },
  ]
  const bySlot = Object.fromEntries(only(computeSlots(config, "cut", MON, 1, taken, NOW)).slots.map((s) => [s.startsAt.toISOString(), s.available]))
  const at = (h) => bySlot[kst(h).toISOString()]
  assert.equal(at("10:00"), 2, "10:00-11:00 은 11:00 예약과 맞닿기만 한다")
  assert.equal(at("10:30"), 1, "10:30-11:30 은 첫 예약과 겹친다")
  assert.equal(at("11:00"), 0, "두 예약과 모두 겹쳐 마감")
  assert.equal(at("11:30"), 0)
  assert.equal(at("12:00"), 1, "12:00-13:00 은 둘째 예약(-12:30)과만 겹친다")
  assert.equal(at("12:30"), 2, "12:30 은 둘째 예약 끝과 맞닿는다")
  // 마감 칸도 목록에는 남는다(화면이 「마감」으로 보인다)
  assert.equal(only(computeSlots(config, "cut", MON, 1, taken, NOW)).slots.length, 15)
})

test("수용량이 1 인 서비스 — 긴 서비스의 앞뒤로 걸친 예약이 칸을 막는다(서비스 시간이 겹치면 센다)", () => {
  const taken = [{ startsAt: kst("13:00"), endsAt: kst("14:00") }]
  const slots = only(computeSlots(config, "color", MON, 1, taken, NOW)).slots
  const closed = slots.filter((s) => s.available === 0).map((s) => s.startsAt.toISOString())
  // 120분 염색은 11:30(-13:30)~13:30(-15:30) 시작이 13:00-14:00 과 겹친다
  assert.deepEqual(closed, ["11:30", "12:00", "12:30", "13:00", "13:30"].map((h) => kst(h).toISOString()))
})

test("24:00 까지 여는 날 — 마지막 시작은 영업 끝에서 서비스 길이를 뺀 시각", () => {
  const late = parseBookingConfig(sampleConfig({ weekly: { mon: [["22:00", "24:00"]] } }))
  const day = only(computeSlots(late, "cut", MON, 1, [], NOW))
  assert.deepEqual(day.slots.map((s) => s.startsAt.toISOString()), ["22:00", "22:30", "23:00"].map((h) => kst(h).toISOString()))
  assert.equal(day.slots.at(-1).endsAt.toISOString(), "2026-11-02T15:00:00.000Z", "다음 날 00:00 서울")
})

test("잘못된 인자(모르는 서비스·없는 날짜·일수)는 던진다", () => {
  assert.throws(() => computeSlots(config, "nope", MON, 1, [], NOW), /unknown service/)
  assert.throws(() => computeSlots(config, "cut", "2026-02-30", 1, [], NOW), /real date/)
  assert.throws(() => computeSlots(config, "cut", MON, 0, [], NOW), /positive integer/)
  assert.throws(() => computeSlots(config, "cut", MON, 1.5, [], NOW), /positive integer/)
})

// ── 시간대 변환(DST 가 있는 시간대에서도 맞는가) ─────────────────────────────────────────
test("zonedToUtc: 서울(+9)·콜카타(+5:30)·UTC", () => {
  assert.equal(new Date(zonedToUtc("2026-11-02", 600, "Asia/Seoul")).toISOString(), "2026-11-02T01:00:00.000Z")
  assert.equal(new Date(zonedToUtc("2026-11-02", 600, "Asia/Kolkata")).toISOString(), "2026-11-02T04:30:00.000Z")
  assert.equal(new Date(zonedToUtc("2026-11-02", 600, "UTC")).toISOString(), "2026-11-02T10:00:00.000Z")
  assert.equal(new Date(zonedToUtc("2026-11-02", 1440, "Asia/Seoul")).toISOString(), "2026-11-02T15:00:00.000Z", "24:00 = 다음 날 자정")
})

test("DST: 뉴욕 봄(2026-03-08)에 없는 02:00~02:59 는 슬롯에서 빠지고, 앞뒤는 UTC 차이가 달라진다", () => {
  assert.equal(zonedToUtc("2026-03-08", 2 * 60, "America/New_York"), null)
  assert.equal(zonedToUtc("2026-03-08", 2 * 60 + 30, "America/New_York"), null)
  assert.equal(new Date(zonedToUtc("2026-03-08", 60, "America/New_York")).toISOString(), "2026-03-08T06:00:00.000Z", "01:00 EST = UTC-5")
  assert.equal(new Date(zonedToUtc("2026-03-08", 180, "America/New_York")).toISOString(), "2026-03-08T07:00:00.000Z", "03:00 EDT = UTC-4")
  const ny = parseBookingConfig(sampleConfig({ timeZone: "America/New_York", weekly: { sun: [["01:00", "05:00"]] }, services: [{ id: "x", name: { ko: "엑스", en: "X" }, durationMin: 30, capacity: 1, partyMax: 1 }] }))
  const day = only(computeSlots(ny, "x", "2026-03-08", 1, [], new Date("2026-03-01T00:00:00Z")))
  assert.deepEqual(day.slots.map((s) => s.startsAt.toISOString()), ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30"].map((h) => `2026-03-08T${h}:00.000Z`), "01:00 01:30 | 03:00 03:30 04:00 04:30")
})

test("DST: 가을(2026-11-01 뉴욕)에 두 번 있는 01:30 은 이른 쪽(EDT)을 쓴다", () => {
  assert.equal(new Date(zonedToUtc("2026-11-01", 90, "America/New_York")).toISOString(), "2026-11-01T05:30:00.000Z")
  assert.equal(new Date(zonedToUtc("2026-11-01", 180, "America/New_York")).toISOString(), "2026-11-01T08:00:00.000Z", "03:00 EST")
})

test("지역 날짜·요일·날짜 더하기·시간대 이름 검사", () => {
  assert.equal(localDateOf(Date.parse("2026-11-01T16:00:00Z"), "Asia/Seoul"), "2026-11-02")
  assert.equal(localDateOf(Date.parse("2026-11-01T16:00:00Z"), "UTC"), "2026-11-01")
  assert.equal(localDateOf(Date.parse("2026-11-02T03:30:00Z"), "America/Los_Angeles"), "2026-11-01")
  assert.equal(weekdayOf("2026-11-02"), "mon")
  assert.equal(weekdayOf("2026-11-08"), "sun")
  assert.equal(addDays("2026-12-31", 1), "2027-01-01")
  assert.equal(addDays("2026-03-01", -1), "2026-02-28")
  assert.ok(isCalendarDate("2028-02-29") && !isCalendarDate("2026-02-29") && !isCalendarDate("2026-13-01") && !isCalendarDate(20261102))
  assert.ok(isTimeZone("Asia/Seoul") && !isTimeZone("Asia/Nowhere") && !isTimeZone(undefined))
})
