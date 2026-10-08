import type { StateScreenOfflineCachedProps } from "./offline-cached"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 앱(PWA)의 오프라인 화면, 문구마다 「예시」.
// online 을 false 로 고정해 오프라인 모양을 그린다(최소 예시는 비워서 브라우저 연결 상태를 따른다).
const COPY = {
  title: "연결 없이 볼 수 있는 내용",
  offline: "오프라인이에요",
  online: "다시 연결됐어요",
  lastSavedLabel: "마지막 저장",
  lastSaved: "2026-09-29 09:38",
  recheckLabel: "연결 다시 확인",
  reloadLabel: "새로 고침",
  cachedBadge: "저장된 내용",
  emptyCached: "이 기기에 저장해 둔 내용이 없어요. 연결되면 다시 불러와요(예시).",
}
const ITEMS = [
  { title: "오늘 예약 12건", body: "10:00 예시 고객 1 · 커트, 10:30 예시 고객 2 · 염색 …(예시)", savedAt: "09:38 저장", href: "/app/today" },
  { title: "이번 주 근무표", body: "월 휴무, 화~토 10:00~20:00(예시)", savedAt: "어제 21:10 저장", href: "/app/schedule" },
  { title: "자주 쓰는 안내 문자", savedAt: "9월 27일 저장", href: "/app/templates" },
]

export const fixture: StateScreenOfflineCachedProps = { copy: COPY, items: ITEMS, online: false, onRecheck: () => {}, onReload: () => {} }

// 최대: 문구 끝까지, 저장된 항목 9개.
export const fixtureMax: StateScreenOfflineCachedProps = {
  ...fixture,
  copy: { ...COPY, title: "연결 없이 볼 수 있는 내용 — 이 기기에 저장해 둔 예약·근무표·안내 문자(예시)", offline: "오프라인이에요 — 지하·엘리베이터 등 신호가 약한 곳인지 확인해 주세요(예시)", lastSaved: "2026-09-29 09:38:12 (자동 저장)" },
  items: Array.from({ length: 9 }, (_, i) => ({ ...ITEMS[i % 3], title: `${ITEMS[i % 3].title} — 강남점·홍대점·성수점 합친 목록(예시 ${i + 1})`, body: "10:00 예시 고객 1 · 커트, 10:30 예시 고객 2 · 염색, 11:00 예시 고객 3 · 펌, 11:30 예시 고객 4 · 두피 관리 …(예시)" })),
}

// 최소: 저장된 항목 없음, 행동 없음, 연결 상태는 브라우저를 따른다.
export const fixtureMin: StateScreenOfflineCachedProps = { copy: COPY, items: [] }
