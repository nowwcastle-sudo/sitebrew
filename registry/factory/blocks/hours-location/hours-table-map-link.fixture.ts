import type { Holidays, OpeningHours, SpecialHours } from "@/registry/factory/content/content-core"

import type { HoursLocationHoursTableMapLinkProps } from "./hours-table-map-link"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 빵집, 문구마다 「예시」. 세 변형이 영업시간·요일·상태 문구를 같이 쓴다.
export const DAYS_KO = { mo: "월", tu: "화", we: "수", th: "목", fr: "금", sa: "토", su: "일" }
export const STATUS = {
  open: "영업 중",
  break: "쉬는 시간",
  closed: "지금은 닫았어요",
  closedToday: "오늘 휴무",
  specialClosed: "오늘은 {label}이라 쉬어요",
  closesAt: "{time}에 닫아요",
  closesNextDay: "익일 {time}에 닫아요",
  resumesAt: "{time}에 다시 열어요",
  opensToday: "오늘 {time}에 열어요",
  opensTomorrow: "내일 {time}에 열어요",
  opensOn: "{day}요일 {time}에 열어요",
}
// 월 휴무 · 화~금 10~20(쉬는 시간 15~16) · 토 9~22 · 일 11~18.
export const HOURS: OpeningHours = [
  { day: "tu", opens: "10:00", closes: "20:00", breaks: [{ start: "15:00", end: "16:00" }] },
  { day: "we", opens: "10:00", closes: "20:00", breaks: [{ start: "15:00", end: "16:00" }] },
  { day: "th", opens: "10:00", closes: "20:00", breaks: [{ start: "15:00", end: "16:00" }] },
  { day: "fr", opens: "10:00", closes: "20:00", breaks: [{ start: "15:00", end: "16:00" }] },
  { day: "sa", opens: "09:00", closes: "22:00" },
  { day: "su", opens: "11:00", closes: "18:00" },
]
// 밤샘 영업이 있는 가게(최대 예시): 금·토 18:00~익일 03:00, 쉬는 시간 둘.
export const HOURS_LATE: OpeningHours = [
  { day: "mo", opens: "11:30", closes: "22:00", breaks: [{ start: "15:00", end: "17:00" }] },
  { day: "tu", opens: "11:30", closes: "22:00", breaks: [{ start: "15:00", end: "17:00" }] },
  { day: "we", opens: "11:30", closes: "22:00", breaks: [{ start: "15:00", end: "17:00" }] },
  { day: "th", opens: "11:30", closes: "24:00", breaks: [{ start: "15:00", end: "17:00" }] },
  { day: "fr", opens: "18:00", closes: "03:00", overnight: true, breaks: [{ start: "00:30", end: "01:00" }] },
  { day: "sa", opens: "18:00", closes: "03:00", overnight: true },
  { day: "su", opens: "12:00", closes: "21:00" },
]
// 기준 시각(서울): 화 12:30(영업 중) · 화 15:20(쉬는 시간).
export const NOW_OPEN = "2026-09-29T12:30:00+09:00"
export const NOW_BREAK = "2026-09-29T15:20:00+09:00"
export const ADDRESS = "서울특별시 마포구 예시로 12, 1층 (예시동)"
export const ADDRESS_MAX = "서울특별시 마포구 예시로길 123-45, 예시빌딩 1층 101호·102호 (예시동, 예시 상가 안쪽 골목 두 번째 집)"

const COPY = {
  title: "영업시간과 오시는 길",
  lead: "월요일은 쉬어요. 오후 3시부터 4시까지는 빵을 굽느라 잠시 문을 닫아요(예시).",
  tableCaption: "요일별 영업시간",
  dayHeader: "요일",
  hoursHeader: "영업시간",
  days: DAYS_KO,
  todayLabel: "오늘",
  closedLabel: "휴무",
  status: STATUS,
  address: ADDRESS,
  addressLabel: "주소",
  copyLabel: "주소 복사",
  copiedLabel: "주소를 복사했어요",
  copyManualLabel: "복사가 막혔어요. 주소를 눌러 직접 복사해 주세요",
  transit: { label: "대중교통", text: "지하철 6호선 예시역 2번 출구에서 걸어서 4분(예시)" },
  parking: { label: "주차", text: "건물 뒤 공영주차장을 이용해 주세요. 가게 주차장은 없어요(예시)." },
  special: { title: "쉬는 날·다른 시간", closed: "쉬어요" },
  mapsLabel: "지도 앱으로 길찾기",
  maps: [
    { label: "네이버 지도", href: "https://map.naver.com/p/search/%EC%98%88%EC%8B%9C%EB%B9%B5%EC%A7%91" },
    { label: "카카오맵", href: "https://map.kakao.com/?q=%EC%98%88%EC%8B%9C%EB%B9%B5%EC%A7%91" },
  ],
}

// 특수일·공휴일(대장 A105): 개천절은 짧게 열고, 10월 5일은 임시 휴무, 한글날은 공휴일 정책(closed)으로 쉰다
export const SPECIAL: SpecialHours = [
  { date: "2026-10-03", label: "개천절", opens: "11:00", closes: "16:00" },
  { date: "2026-10-05", label: "임시 휴무", closed: true },
]
export const HOLIDAYS: Holidays = [{ date: "2026-10-09", label: "한글날" }]

export const fixture: HoursLocationHoursTableMapLinkProps = { copy: COPY, hours: HOURS, special: SPECIAL, holidays: HOLIDAYS, holidayPolicy: "closed", now: NOW_OPEN }

// 최대: 긴 주소·긴 안내, 밤샘 영업·쉬는 시간 둘, 지도 링크 셋, 쉬는 시간 중.
export const fixtureMax: HoursLocationHoursTableMapLinkProps = {
  copy: {
    ...COPY,
    title: "영업시간과 오시는 길 — 주말 밤늦게까지 여는 날과 쉬는 시간을 확인해 주세요(예시)",
    lead: "평일 오후 3시부터 5시까지는 저녁 준비로 쉬고, 금·토요일은 새벽 3시까지 열어요. 공휴일 영업은 공지를 확인해 주세요(예시).",
    address: ADDRESS_MAX,
    transit: { label: "대중교통", text: "지하철 2호선·6호선 예시역 5번 출구에서 나와 큰길을 따라 걷다 두 번째 골목에서 오른쪽으로 들어오면 4분 거리예요(예시)." },
    parking: { label: "주차", text: "건물 뒤 공영주차장(유료, 30분 1,000원 · 부가세 포함)을 이용해 주세요. 가게 앞은 주정차 단속 구역이라 잠시 세우기도 어려워요(예시)." },
    maps: [...COPY.maps, { label: "구글 지도", href: "https://maps.google.com/?q=%EC%98%88%EC%8B%9C%EB%B9%B5%EC%A7%91" }],
  },
  hours: HOURS_LATE,
  special: SPECIAL,
  holidays: HOLIDAYS,
  holidayPolicy: "closed",
  now: NOW_BREAK,
}

// 최소: 머리말·교통·주차 없이, 지도 링크 하나, 여는 요일 하나, 기준 시각 없음(브라우저 시각).
export const fixtureMin: HoursLocationHoursTableMapLinkProps = {
  copy: { ...COPY, lead: undefined, transit: undefined, parking: undefined, maps: [COPY.maps[0]] },
  hours: [{ day: "sa", opens: "10:00", closes: "16:00" }],
}
