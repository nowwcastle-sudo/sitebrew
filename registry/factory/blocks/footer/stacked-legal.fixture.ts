import type { FooterStackedLegalProps } from "./stacked-legal"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 기관·가게, 문구마다 「예시」. 사업자 정보는 법정 표시 항목을 모두 채운다.
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

export const fixture: FooterStackedLegalProps = {
  copy: {
    title: "사업자 정보",
    lead: "전자상거래법에 따라 판매자 정보를 알려 드려요(예시).",
    business: {
      name: "한빛 생활용품(예시)",
      legalName: "주식회사 한빛리빙(예시)",
      representative: "박한빛",
      bizRegNo: "345-67-89012",
      mailOrderNo: "제2026-경기성남-0000호",
      address: "경기도 성남시 분당구 예시로 45, 3층(예시)",
      phone: "031-345-6789",
      email: "help@example.com",
      ftcLookupUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=3456789012",
      termsUrl: "/terms",
      privacyUrl: "/privacy",
    },
    businessLabels,
    brand: "한빛 생활용품(예시)",
    navLabel: "사이트 링크",
    links: [
      { label: "고객센터", href: "#help" },
      { label: "입점 문의", href: "#partner" },
    ],
    copyright: "© 2026 한빛 생활용품(예시)",
  },
}

// 최대: 긴 값 전부, 링크 5개.
export const fixtureMax: FooterStackedLegalProps = {
  copy: {
    title: "사업자 정보와 판매자 표시 사항 — 전자상거래법 제10조(예시)",
    lead: "전자상거래 등에서의 소비자보호에 관한 법률에 따라 판매자의 상호, 대표자, 주소, 연락처, 사업자등록번호, 통신판매업 신고번호를 알려 드려요. 궁금한 점은 고객센터로 물어봐 주세요(예시).",
    business: {
      name: "한빛 생활용품 온라인 상점(예시)",
      legalName: "주식회사 한빛리빙 생활연구소 유통사업부(예시)",
      representative: "박한빛·최리빙(공동대표)",
      bizRegNo: "345-67-89012",
      mailOrderNo: "제2026-경기성남분당-00000호",
      address: "경기도 성남시 분당구 예시로 1234번길 56-78, 예시타워 동관 3층 301호부터 305호까지(예시)",
      phone: "1600-1234",
      email: "customer-help-center@example.com",
      ftcLookupUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=3456789012",
      termsUrl: "/terms",
      privacyUrl: "/privacy",
    },
    businessLabels,
    brand: "한빛 생활용품 온라인 상점(예시)",
    navLabel: "사이트 링크",
    links: [
      { label: "고객센터", href: "#help" },
      { label: "입점 문의", href: "#partner" },
      { label: "대량 구매 상담", href: "#bulk" },
      { label: "채용 안내", href: "#jobs" },
      { label: "청소년 보호 정책", href: "#youth" },
    ],
    copyright: "© 2026 한빛 생활용품 — 이 사이트의 모든 사진과 글은 무단으로 쓸 수 없어요(예시)",
  },
}

// 최소: 머리말·사이트 링크 없음, 사업자 정보는 필수 항목만.
export const fixtureMin: FooterStackedLegalProps = {
  copy: {
    title: "사업자 정보",
    business: { name: "한빛 생활용품(예시)", address: "경기도 성남시 분당구 예시로 45(예시)", phone: "031-345-6789" },
    businessLabels,
    brand: "한빛 생활용품(예시)",
    navLabel: "사이트 링크",
    copyright: "© 2026 한빛 생활용품(예시)",
  },
}
