// 예약 설정 검사 — 순수 시험(DB 없음). 틀린 설정은 켤 때(설정 단계) 던진다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { BookingConfigError, minutesOfDay, parseBookingConfig } from "../src/config.ts"
import { sampleConfig } from "./fixtures.mjs"

const problemsOf = (config) => {
  try {
    parseBookingConfig(config)
  } catch (e) {
    assert.ok(e instanceof BookingConfigError, String(e))
    return e.problems
  }
  return null
}
const mutate = (fn) => {
  const c = sampleConfig()
  fn(c)
  return c
}

test("올바른 설정은 그대로 통과하고, closedDates 는 생략하면 빈 목록이다", () => {
  assert.deepEqual(parseBookingConfig(sampleConfig()), sampleConfig())
  const { closedDates, ...rest } = sampleConfig()
  assert.deepEqual(parseBookingConfig(rest).closedDates, [])
  assert.ok(closedDates.length)
})

test("시각 모양: 25:00·9:00·10:60·빈 글은 틀리고, 닫는 시각만 24:00 을 쓸 수 있다", () => {
  assert.equal(minutesOfDay("00:00"), 0)
  assert.equal(minutesOfDay("23:59"), 1439)
  for (const bad of ["25:00", "9:00", "10:60", "", "10:00:00", "ab:cd", "24:00"]) assert.equal(minutesOfDay(bad), null, bad)
  assert.equal(minutesOfDay("24:00", true), 1440)
  assert.equal(minutesOfDay("24:01", true), null)

  assert.match(problemsOf(mutate((c) => (c.weekly.mon = [["25:00", "18:00"]]))).join("\n"), /weekly\.mon\.0\.0: "25:00" is not a time/)
  assert.match(problemsOf(mutate((c) => (c.weekly.mon = [["10:00", "9:7"]]))).join("\n"), /weekly\.mon\.0\.1/)
  assert.equal(problemsOf(mutate((c) => (c.weekly.mon = [["22:00", "24:00"]]))), null, "닫는 시각 24:00 은 허용")
  assert.ok(problemsOf(mutate((c) => (c.weekly.mon = [["24:00", "24:00"]]))), "여는 시각 24:00 은 거절")
})

test("구간: 시작 ≥ 끝, 겹치는 구간은 던진다(맞닿는 구간·순서가 뒤바뀐 목록은 허용)", () => {
  assert.match(problemsOf(mutate((c) => (c.weekly.tue = [["18:00", "10:00"]]))).join("\n"), /must end after it starts/)
  assert.match(problemsOf(mutate((c) => (c.weekly.tue = [["10:00", "10:00"]]))).join("\n"), /must end after it starts/)
  assert.match(problemsOf(mutate((c) => (c.weekly.wed = [["10:00", "13:00"], ["12:00", "18:00"]]))).join("\n"), /wed has overlapping opening intervals/)
  assert.match(problemsOf(mutate((c) => (c.weekly.wed = [["12:00", "18:00"], ["10:00", "13:00"]]))).join("\n"), /overlapping/, "순서가 뒤바뀌어도 겹침을 잡는다")
  assert.equal(problemsOf(mutate((c) => (c.weekly.wed = [["10:00", "12:00"], ["12:00", "18:00"]]))), null, "맞닿는 것은 겹침이 아니다")
  assert.equal(problemsOf(mutate((c) => (c.weekly.wed = [["14:00", "18:00"], ["10:00", "12:00"]]))), null)
})

test("서비스: id 중복·모양, 길이 0, 수용·인원 0, 이름 빠짐, 서비스 0개는 던진다", () => {
  assert.match(problemsOf(mutate((c) => (c.services[1].id = "cut"))).join("\n"), /services\.1\.id: duplicate service id "cut"/)
  assert.match(problemsOf(mutate((c) => (c.services[0].id = "Cut Hair"))).join("\n"), /services\.0\.id/)
  assert.match(problemsOf(mutate((c) => (c.services[0].durationMin = 0))).join("\n"), /durationMin must be at least 1/)
  assert.match(problemsOf(mutate((c) => (c.services[0].durationMin = 30.5))).join("\n"), /durationMin must be an integer/)
  assert.match(problemsOf(mutate((c) => (c.services[0].durationMin = 1441))).join("\n"), /durationMin must be at most 1440/)
  assert.match(problemsOf(mutate((c) => (c.services[0].capacity = 0))).join("\n"), /capacity must be at least 1/)
  assert.match(problemsOf(mutate((c) => (c.services[0].partyMax = 0))).join("\n"), /partyMax must be at least 1/)
  assert.match(problemsOf(mutate((c) => (c.services[0].name.en = " "))).join("\n"), /name\.en is required/)
  assert.match(problemsOf(mutate((c) => (c.services = []))).join("\n"), /at least one service/)
})

test("시간대·날짜·모드: 모르는 시간대, 없는 날짜, 중복 휴무일, 모르는 모드·요일은 던진다", () => {
  assert.match(problemsOf(mutate((c) => (c.timeZone = "Mars/Olympus"))).join("\n"), /timeZone must be an IANA time zone/)
  assert.match(problemsOf(mutate((c) => (c.timeZone = ""))).join("\n"), /timeZone/)
  assert.match(problemsOf(mutate((c) => (c.closedDates = ["2026-02-30"]))).join("\n"), /closedDates entries must be real dates/)
  assert.match(problemsOf(mutate((c) => (c.closedDates = ["12/25"]))).join("\n"), /closedDates/)
  assert.match(problemsOf(mutate((c) => (c.closedDates = ["2026-12-25", "2026-12-25"]))).join("\n"), /duplicate closed date/)
  assert.match(problemsOf(mutate((c) => (c.mode = "auto"))).join("\n"), /mode must be instant or request/)
  assert.ok(problemsOf(mutate((c) => (c.weekly.funday = [["10:00", "11:00"]]))), "모르는 요일 키")
  assert.ok(problemsOf(mutate((c) => (c.surprise = 1))), "모르는 설정 칸")
})

test("숫자 칸: 간격·여유·기간·보유 일수의 범위", () => {
  for (const [key, bad] of [["slotStepMin", 0], ["leadMinutes", -1], ["horizonDays", 0], ["horizonDays", 400], ["cancelBeforeMinutes", -5], ["reminderBeforeMinutes", 1.5], ["retainDays", 0], ["slotStepMin", "30"]]) {
    assert.ok(problemsOf(mutate((c) => (c[key] = bad))), `${key}=${bad}`)
  }
  for (const [key, ok] of [["leadMinutes", 0], ["cancelBeforeMinutes", 0], ["reminderBeforeMinutes", 0]]) assert.equal(problemsOf(mutate((c) => (c[key] = ok))), null, `${key}=${ok} 은 허용(0 = 끔·제한 없음)`)
})

test("문제는 한 번에 모두 모아 알리고, 오류 메시지에 설정 값은 싣지 않는다", () => {
  const p = problemsOf(mutate((c) => ((c.timeZone = "Nope/Zone"), (c.services[0].durationMin = 0), (c.weekly.mon = [["25:00", "26:00"]]))))
  assert.ok(p.length >= 4, p.join("\n"))
  assert.throws(() => parseBookingConfig(mutate((c) => (c.services[0].name.ko = ""))), (e) => e instanceof BookingConfigError && !e.message.includes("Haircut"))
  assert.throws(() => parseBookingConfig(null), BookingConfigError)
  assert.throws(() => parseBookingConfig("x"), BookingConfigError)
})
