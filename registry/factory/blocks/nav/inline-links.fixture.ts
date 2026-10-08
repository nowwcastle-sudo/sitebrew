import type { NavInlineLinksProps } from "./inline-links"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 공방, 문구마다 「예시」.
export const fixture: NavInlineLinksProps = {
  copy: {
    brand: "고요 도예(예시)",
    navLabel: "주 메뉴",
    links: [
      { label: "작업", href: "#work" },
      { label: "전시", href: "#exhibition" },
      { label: "공방", href: "#studio" },
      { label: "주문", href: "#order" },
    ],
    action: { label: "전시 예약", href: "#booking" },
  },
  currentHref: "#work",
}

// 최대: 긴 워드마크, 링크 7개(긴 이름), 긴 행동 이름.
export const fixtureMax: NavInlineLinksProps = {
  copy: {
    brand: "고요 도예 작업실 — 비색 청자 공방(예시)",
    navLabel: "주 메뉴",
    links: [
      { label: "지난 작업 모아 보기", href: "#work" },
      { label: "가을 가마 전시", href: "#exhibition" },
      { label: "공방 둘러보기", href: "#studio" },
      { label: "주문 제작 안내", href: "#order" },
      { label: "수업·체험 신청", href: "#class" },
      { label: "자주 묻는 질문", href: "#faq" },
      { label: "오시는 길", href: "#map" },
    ],
    action: { label: "가을 전시 관람 예약하기", href: "#booking" },
  },
  currentHref: "#exhibition",
}

// 최소: 링크 하나, 행동 버튼 없음, 현재 위치 없음.
export const fixtureMin: NavInlineLinksProps = {
  copy: {
    brand: "고요 도예(예시)",
    navLabel: "주 메뉴",
    links: [{ label: "작업", href: "#work" }],
  },
}
