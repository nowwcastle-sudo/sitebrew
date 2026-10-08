import { ADDRESS, ADDRESS_MAX, DAYS_KO, HOURS, HOURS_LATE, NOW_OPEN, STATUS } from "./hours-table-map-link.fixture"
import type { HoursLocationTodayHighlightProps } from "./today-highlight"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 빵집, 문구마다 「예시」.
const COPY = {
  title: "지금 가도 될까요?",
  lead: "오늘 영업 상태를 서울 시각으로 알려 드려요(예시).",
  days: DAYS_KO,
  status: STATUS,
  todayLabel: "오늘",
  closedLabel: "휴무",
  weekLabel: "이번 주 영업시간",
  address: ADDRESS,
  callLabel: "전화 걸기",
  directions: { label: "네이버 지도로 길찾기", href: "https://map.naver.com/p/search/%EC%98%88%EC%8B%9C%EB%B9%B5%EC%A7%91" },
}

export const fixture: HoursLocationTodayHighlightProps = { copy: COPY, hours: HOURS, telephone: "02-123-4567", now: NOW_OPEN }

// 최대: 긴 문구·긴 주소, 밤샘 영업 — 금요일 새벽 1시 30분(목 24시 마감 뒤 닫힌 때 → 오늘 18:00 에 연다).
export const fixtureMax: HoursLocationTodayHighlightProps = {
  copy: {
    ...COPY,
    title: "지금 가도 될까요? 주말에는 새벽 3시까지 문을 열어요(예시)",
    lead: "평일 오후 3시부터 5시까지는 저녁 준비로 쉬고, 금·토요일은 새벽 3시까지 열어요. 공휴일 영업은 공지를 확인해 주세요(예시).",
    address: ADDRESS_MAX,
    directions: { label: "네이버 지도로 길찾기(예시)", href: COPY.directions.href },
  },
  hours: HOURS_LATE,
  telephone: "0507-1234-5678",
  now: "2026-10-02T01:30:00+09:00",
}

// 최소: 머리말 없이, 여는 요일 하나, 기준 시각 없음(브라우저 시각).
export const fixtureMin: HoursLocationTodayHighlightProps = {
  copy: { ...COPY, lead: undefined },
  hours: [{ day: "sa", opens: "10:00", closes: "16:00" }],
  telephone: "02-123-4567",
}
