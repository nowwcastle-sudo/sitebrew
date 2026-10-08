import type { Branch, HoursLocationBranchListProps } from "./branch-list"
import { DAYS_KO, HOURS, HOURS_LATE, NOW_OPEN, STATUS } from "./hours-table-map-link.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 빵집 지점들, 문구마다 「예시」.
const map = (q: string) => ({
  naverMapUrl: `https://map.naver.com/p/search/${encodeURIComponent(q)}`,
  kakaoMapUrl: `https://map.kakao.com/?q=${encodeURIComponent(q)}`,
})
const BRANCHES: Branch[] = [
  { name: "예시빵집 망원점", url: "https://example.com/branches/mangwon", address: "서울특별시 마포구 예시로 12, 1층 (예시)", todayHours: "10:00~20:00", telephone: "02-123-4567", hours: HOURS, ...map("예시빵집 망원점") },
  { name: "예시빵집 연남점", url: "https://example.com/branches/yeonnam", address: "서울특별시 마포구 예시길 34 (예시)", todayHours: "11:30~22:00", telephone: "02-234-5678", hours: HOURS_LATE, ...map("예시빵집 연남점") },
  { name: "예시빵집 성수점", url: "https://example.com/branches/seongsu", address: "서울특별시 성동구 예시로 56, 2층 (예시)", todayHours: "휴무", telephone: "02-345-6789", hours: [{ day: "we", opens: "10:00", closes: "19:00" }], ...map("예시빵집 성수점") },
]
const COPY = {
  title: "가까운 지점을 찾아보세요",
  lead: "지점마다 여는 시간이 달라요. 방문 전에 오늘 시간을 확인해 주세요(예시).",
  countTemplate: "지점 {n}곳",
  days: DAYS_KO,
  status: STATUS,
  todayLabel: "오늘",
  naverLabel: "네이버 지도",
  kakaoLabel: "카카오맵",
  pageLabel: "지점 안내",
}

export const fixture: HoursLocationBranchListProps = { copy: COPY, branches: BRANCHES, now: NOW_OPEN }

// 최대: 지점 9곳, 긴 이름·긴 주소.
export const fixtureMax: HoursLocationBranchListProps = {
  copy: { ...COPY, title: "가까운 지점을 찾아보세요 — 서울·경기 지점 영업시간과 길찾기(예시)" },
  branches: Array.from({ length: 9 }, (_, i) => ({
    ...BRANCHES[i % 3],
    name: `예시빵집 서울특별시 마포구 망원동 한강공원 앞 ${i + 1}호점(예시)`,
    address: "경기도 예시시 예시구 아주긴이름로123번길 45-67, 예시타워 지하 1층 푸드코트 안쪽 B101호 (예시동)",
    url: `https://example.com/branches/${i + 1}`,
  })),
  now: NOW_OPEN,
}

// 최소: 머리말 없이 지점 하나, 요일별 시간 없음(상태 배지 없이 오늘 시간만).
export const fixtureMin: HoursLocationBranchListProps = {
  copy: { ...COPY, lead: undefined },
  branches: [{ ...BRANCHES[0], hours: undefined }],
}
