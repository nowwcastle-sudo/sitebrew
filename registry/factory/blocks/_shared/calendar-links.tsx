// 캘린더에 넣기(P3-2 Task 7a, 대장 A65 — 공유 조각 block-shared-calendar-links): 확정된 예약 시각을 .ics 파일(RFC 5545)과 Google 캘린더 링크로 만든다.
// 예약 시각을 잊어 노쇼가 나는 것을 줄인다(리마인더가 참석률을 올린다 — Cochrane CD007458). 시각은 UTC 순간(Z)으로 싣는다 — 어느 시간대의 캘린더든 같은 순간이고,
// 화면에는 서울 시각으로 보인다(Google 링크의 ctz=Asia/Seoul 이 캘린더 쪽 표시도 서울로 맞춘다). 순수 함수라 서버·시험에서도 돈다.
export type CalendarEvent = {
  // 이 예약을 가리키는 값(요청 번호 등) — ics UID 가 된다
  uid: string
  title: string
  // ISO 시각(순간)
  start: string
  // 끝 시각. 없으면 start + minutes(기본 60분)
  end?: string
  minutes?: number
  location?: string
  description?: string
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0")
/** ISO 순간 → 「20261003T050000Z」 */
export function utcStamp(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}
const endOf = (e: CalendarEvent) => e.end ?? new Date(new Date(e.start).getTime() + (e.minutes ?? 60) * 60_000).toISOString()

// RFC 5545 §3.3.11 TEXT 이스케이프: 역슬래시·쉼표·세미콜론·줄바꿈
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
// RFC 5545 §3.1: 한 줄은 75바이트(옥텟)를 넘지 않는다 — 넘으면 CRLF + 공백으로 접는다(한글 한 글자를 가르지 않는다)
export function fold(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ""
  let bytes = 0
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ""
      bytes = 0
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.join("\r\n ")
}

/** .ics 파일 내용(줄 끝 CRLF). now: DTSTAMP 시각(시험이 고정한다) */
export function icsFile(e: CalendarEvent, now: () => Date = () => new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//web-factory//booking//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${esc(e.uid)}@web-factory`,
    `DTSTAMP:${utcStamp(now().toISOString())}`,
    `DTSTART:${utcStamp(e.start)}`,
    `DTEND:${utcStamp(endOf(e))}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lines.map(fold).join("\r\n") + "\r\n"
}

/** 내려받기 링크(data URL) — 서버 없이 정적 페이지에서도 된다 */
export const icsHref = (e: CalendarEvent, now?: () => Date) => `data:text/calendar;charset=utf-8,${encodeURIComponent(icsFile(e, now))}`

/** Google 캘린더 「일정 만들기」 링크(action=TEMPLATE) */
export function googleCalendarHref(e: CalendarEvent): string {
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${utcStamp(e.start)}/${utcStamp(endOf(e))}`, ctz: "Asia/Seoul", stz: "Asia/Seoul", etz: "Asia/Seoul" })
  if (e.location) q.set("location", e.location)
  if (e.description) q.set("details", e.description)
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}
