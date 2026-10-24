// 예약 시험 공용 견본. 값은 모두 가짜다. 2026-11-02 는 월요일(서울 기준).
const WEEKDAY_HOURS = [["10:00", "18:00"]]

/** 설정 견본을 복사해 돌려준다(시험마다 고쳐 쓴다) */
export function sampleConfig(patch = {}) {
  return structuredClone({
    timeZone: "Asia/Seoul",
    mode: "instant",
    services: [
      { id: "cut", name: { ko: "커트", en: "Haircut" }, durationMin: 60, capacity: 2, partyMax: 3 },
      { id: "color", name: { ko: "염색", en: "Color" }, durationMin: 120, capacity: 1, partyMax: 1 },
    ],
    weekly: { mon: WEEKDAY_HOURS, tue: WEEKDAY_HOURS, wed: WEEKDAY_HOURS, thu: WEEKDAY_HOURS, fri: WEEKDAY_HOURS, sat: [["10:00", "14:00"]] },
    closedDates: ["2026-12-25"],
    slotStepMin: 30,
    leadMinutes: 120,
    horizonDays: 60,
    cancelBeforeMinutes: 120,
    reminderBeforeMinutes: 1440,
    retainDays: 365,
    ...patch,
  })
}
