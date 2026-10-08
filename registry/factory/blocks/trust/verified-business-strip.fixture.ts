import type { Business } from "@/registry/factory/content/content-core"

import type { TrustVerifiedBusinessStripCopy, TrustVerifiedBusinessStripProps } from "./verified-business-strip"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 침구 가게 「솜결(예시)」 — 번호는 모두 형식만 맞춘 가짜 값이다.
export const BUSINESS: Business = {
  name: "솜결(예시)",
  legalName: "주식회사 솜결(예시)",
  representative: "한예진(예시)",
  bizRegNo: "123-45-67890",
  mailOrderNo: "제2026-서울마포-0000호(예시)",
  address: "서울특별시 마포구 예시로 12, 3층(예시)",
  phone: "02-000-0000",
  email: "help@example.com",
  ftcLookupUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=1234567890",
}
const COPY: TrustVerifiedBusinessStripCopy = {
  title: "사업자 정보",
  verify: { text: "이 정보는 공정거래위원회 사업자정보 공개 페이지에서 누구나 확인할 수 있어요.", label: "사업자정보 확인하기" },
  labels: {
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
  },
}

export const fixture: TrustVerifiedBusinessStripProps = { copy: COPY, business: BUSINESS }

export const fixtureMax: TrustVerifiedBusinessStripProps = {
  copy: { ...COPY, title: "사업자 정보 — 공정거래위원회 공개 페이지에서 같은 내용을 확인할 수 있어요", verify: { ...COPY.verify, text: "상호·대표자·사업자등록번호·통신판매업 신고번호는 공정거래위원회 사업자정보 공개 페이지에서 누구나 확인할 수 있어요. 다르면 고객센터로 알려 주세요(예시)." } },
  business: { ...BUSINESS, address: "서울특별시 마포구 예시로 12, 솜결빌딩 3층 301호(예시동, 예시 우편번호 00000)", email: "customer-help-desk@example.com" },
}

export const fixtureMin: TrustVerifiedBusinessStripProps = {
  copy: COPY,
  business: { name: BUSINESS.name, representative: BUSINESS.representative, bizRegNo: BUSINESS.bizRegNo, address: BUSINESS.address, phone: BUSINESS.phone, ftcLookupUrl: BUSINESS.ftcLookupUrl },
}
