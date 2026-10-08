import type { FooterColumnsBusinessProps } from "./columns-business"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 공방, 문구마다 「예시」. 사업자 정보는 법정 표시 항목을 모두 채운다.
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

export const fixture: FooterColumnsBusinessProps = {
  copy: {
    brand: "고요 도예(예시)",
    tagline: "비색 청자를 한 달에 여섯 점 굽는 작은 공방이에요(예시).",
    navLabel: "사이트 링크",
    columns: [
      { title: "작업", links: [{ label: "청자", href: "#celadon" }, { label: "백자", href: "#white" }, { label: "주문 제작", href: "#order" }] },
      { title: "공방", links: [{ label: "소개", href: "#about" }, { label: "수업", href: "#class" }, { label: "오시는 길", href: "#map" }] },
      { title: "도움", links: [{ label: "배송", href: "#shipping" }, { label: "교환·반품", href: "#returns" }, { label: "자주 묻는 질문", href: "#faq" }] },
    ],
    business: {
      name: "고요 도예(예시)",
      legalName: "주식회사 고요공방(예시)",
      representative: "한고요",
      bizRegNo: "123-45-67890",
      mailOrderNo: "제2026-서울마포-0000호",
      address: "서울특별시 마포구 예시로 12, 2층(예시)",
      phone: "02-1234-5678",
      email: "hello@example.com",
      ftcLookupUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=1234567890",
      termsUrl: "/terms",
      privacyUrl: "/privacy",
    },
    businessLabels,
    copyright: "© 2026 고요 도예(예시)",
  },
}

// 최대: 긴 소개·긴 주소·긴 법인명, 열 4개 × 링크 6개.
export const fixtureMax: FooterColumnsBusinessProps = {
  copy: {
    brand: "고요 도예 작업실 — 비색 청자 공방(예시)",
    tagline: "굽 높이와 유약 두께를 바꿔 가며 서른 번 구운 비색 청자를 한 달에 여섯 점만 내놓아요. 수업과 주문 제작은 한 달 전에 예약해 주세요(예시).",
    navLabel: "사이트 링크",
    columns: Array.from({ length: 4 }, (_, c) => ({
      title: ["작업과 전시", "공방과 수업", "주문과 배송", "도움과 문의"][c],
      links: Array.from({ length: 6 }, (_, i) => ({ label: `긴 링크 이름 예시 ${c + 1}-${i + 1}`, href: `#l-${c}-${i}` })),
    })),
    business: {
      name: "고요 도예 작업실(예시)",
      legalName: "주식회사 고요공방 비색청자연구소(예시)",
      representative: "한고요·김비색(공동대표)",
      bizRegNo: "123-45-67890",
      mailOrderNo: "제2026-서울마포-00000호",
      address: "서울특별시 마포구 예시로 1234번길 56-78, 예시빌딩 지하 1층 101호와 102호 사이 작업실(예시)",
      phone: "1588-1234",
      email: "orders-and-questions@example.com",
      ftcLookupUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=1234567890",
      termsUrl: "/terms",
      privacyUrl: "/privacy",
    },
    businessLabels,
    copyright: "© 2026 고요 도예 작업실 — 모든 사진과 글의 저작권은 공방에 있어요(예시)",
  },
}

// 최소: 소개 없음, 열 하나에 링크 하나, 사업자 정보는 필수 항목(상호·주소·전화)만.
export const fixtureMin: FooterColumnsBusinessProps = {
  copy: {
    brand: "고요 도예(예시)",
    navLabel: "사이트 링크",
    columns: [{ title: "작업", links: [{ label: "청자", href: "#celadon" }] }],
    business: { name: "고요 도예(예시)", address: "서울특별시 마포구 예시로 12(예시)", phone: "02-1234-5678" },
    businessLabels,
    copyright: "© 2026 고요 도예(예시)",
  },
}
