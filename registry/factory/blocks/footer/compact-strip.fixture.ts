import type { FooterCompactStripProps } from "./compact-strip"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 빵집, 문구마다 「예시」. 사업자 정보는 법정 표시 항목을 모두 채운다.
const businessLabels = {
  name: "상호",
  representative: "대표자",
  bizRegNo: "사업자등록번호",
  mailOrderNo: "통신판매업 신고번호",
  address: "주소",
  phone: "전화",
  email: "메일",
  ftcLookup: "사업자정보 확인",
  terms: "이용약관",
  privacy: "개인정보 처리방침",
  policyNav: "약관과 정책",
}

export const fixture: FooterCompactStripProps = {
  copy: {
    brand: "밀과 소금(예시)",
    navLabel: "사이트 링크",
    links: [
      { label: "메뉴", href: "#menu" },
      { label: "오시는 길", href: "#map" },
      { label: "예약", href: "#booking" },
    ],
    business: {
      name: "밀과 소금(예시)",
      representative: "오밀",
      bizRegNo: "234-56-78901",
      mailOrderNo: "제2026-서울성동-0000호",
      address: "서울특별시 성동구 예시길 7, 1층(예시)",
      phone: "02-2345-6789",
      email: "bread@example.com",
      ftcLookupUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=2345678901",
      termsUrl: "/terms",
      privacyUrl: "/privacy",
    },
    businessLabels,
    copyright: "© 2026 밀과 소금(예시)",
  },
}

// 최대: 긴 워드마크, 링크 6개, 긴 주소·법인명.
export const fixtureMax: FooterCompactStripProps = {
  copy: {
    brand: "밀과 소금 — 성수동 천연 발효 빵집(예시)",
    navLabel: "사이트 링크",
    links: [
      { label: "오늘 굽는 빵", href: "#menu" },
      { label: "오시는 길", href: "#map" },
      { label: "단체 주문", href: "#bulk" },
      { label: "빵 수업", href: "#class" },
      { label: "자주 묻는 질문", href: "#faq" },
      { label: "예약", href: "#booking" },
    ],
    business: {
      name: "밀과 소금(예시)",
      legalName: "유한회사 밀과소금 천연발효연구소(예시)",
      representative: "오밀·이소금(공동대표)",
      bizRegNo: "234-56-78901",
      mailOrderNo: "제2026-서울성동-00000호",
      address: "서울특별시 성동구 예시길 1234번길 56-78, 예시상가 1층 가운데 가게와 오른쪽 가게 사이(예시)",
      phone: "1644-1234",
      email: "orders-and-questions@example.com",
      ftcLookupUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=2345678901",
      termsUrl: "/terms",
      privacyUrl: "/privacy",
    },
    businessLabels,
    copyright: "© 2026 밀과 소금 — 모든 사진과 글의 저작권은 가게에 있습니다(예시)",
  },
}

// 최소: 링크 없음, 사업자 정보는 필수 항목만.
export const fixtureMin: FooterCompactStripProps = {
  copy: {
    brand: "밀과 소금(예시)",
    navLabel: "사이트 링크",
    links: [],
    business: { name: "밀과 소금(예시)", address: "서울특별시 성동구 예시길 7(예시)", phone: "02-2345-6789" },
    businessLabels,
    copyright: "© 2026 밀과 소금(예시)",
  },
}
