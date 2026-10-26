// 예약·푸시 화면의 순수 도우미 시험(lib/booking-client.ts · lib/push-client.ts). 빌드·서버·브라우저 없이 돈다.
import assert from "node:assert/strict"
import test from "node:test"

const { urlBase64ToUint8Array, pushSupported, derivePushState } = await import("../lib/push-client.ts")
const { todayIn, formatDayLong, formatTime, formatSlotName, formatWhen, openDays } = await import("../lib/booking-client.ts")

test("urlBase64ToUint8Array: base64url(패딩 없음·-_ 문자)를 바이트로 바꾼다", () => {
  assert.deepEqual([...urlBase64ToUint8Array("AQID")], [1, 2, 3])
  assert.deepEqual([...urlBase64ToUint8Array("AQI")], [1, 2], "패딩이 없어도 된다")
  // 0xfb 0xff → 표준 base64 "+/8=" , base64url "-_8"
  assert.deepEqual([...urlBase64ToUint8Array("-_8")], [0xfb, 0xff])
  assert.equal(urlBase64ToUint8Array("").length, 0)
  // VAPID 공개키는 65바이트(비압축 P-256 점)
  assert.equal(urlBase64ToUint8Array("B" + "A".repeat(86)).length, 65)
})

test("pushSupported: 셋 중 하나라도 없으면 지원하지 않는다", () => {
  assert.equal(pushSupported({ serviceWorker: true, pushManager: true, notification: true }), true)
  for (const k of ["serviceWorker", "pushManager", "notification"]) assert.equal(pushSupported({ serviceWorker: true, pushManager: true, notification: true, [k]: false }), false, k)
})

test("derivePushState: 지원·권한·구독의 모든 조합", () => {
  const s = (supported, permission, subscribed) => derivePushState({ supported, permission, subscribed })
  assert.equal(s(false, "granted", true), "unsupported")
  assert.equal(s(true, "denied", false), "blocked")
  assert.equal(s(true, "denied", true), "blocked", "권한이 막히면 구독이 남아 있어도 알림은 안 온다")
  assert.equal(s(true, "granted", true), "on")
  assert.equal(s(true, "granted", false), "off")
  assert.equal(s(true, "default", false), "off")
  assert.equal(s(true, "default", true), "off", "허락 없는 구독은 켜진 것이 아니다")
  assert.equal(s(true, null, false), "off", "권한을 아직 못 읽었을 때")
})

test("todayIn: 같은 순간도 시간대에 따라 다른 날이 된다", () => {
  const t = new Date("2026-10-25T16:30:00Z")
  assert.equal(todayIn("Asia/Seoul", t), "2026-10-26")
  assert.equal(todayIn("UTC", t), "2026-10-25")
  assert.equal(todayIn("America/Los_Angeles", t), "2026-10-25")
})

test("날짜·시각 서식은 설정 시간대로 적고, 슬롯 이름에 날짜와 시각이 함께 든다", () => {
  const iso = "2026-10-26T01:00:00.000Z" // 서울 10:00
  assert.equal(formatDayLong(iso, "Asia/Seoul"), "Monday, October 26")
  assert.equal(formatTime(iso, "Asia/Seoul"), "10:00 AM")
  assert.equal(formatSlotName(iso, "Asia/Seoul"), "Monday, October 26, 10:00 AM")
  assert.match(formatWhen(iso, "Asia/Seoul"), /^Monday, October 26, 2026 at 10:00 AM$/)
  assert.notEqual(formatSlotName(iso, "UTC"), formatSlotName(iso, "Asia/Seoul"))
})

test("openDays: 자리가 없는 슬롯과 빈 날을 빼고 날짜순으로 정렬한다", () => {
  const days = [
    { date: "2026-10-27", slots: [{ startsAt: "a", available: 0 }] },
    { date: "2026-10-28", slots: [{ startsAt: "b", available: 2 }, { startsAt: "c", available: 0 }] },
    { date: "2026-10-26", slots: [{ startsAt: "d", available: 1 }] },
  ]
  assert.deepEqual(openDays(days).map((d) => [d.date, d.slots.map((s) => s.startsAt)]), [["2026-10-26", ["d"]], ["2026-10-28", ["b"]]])
})
