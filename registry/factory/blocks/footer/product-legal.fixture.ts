import type { FooterProductLegalProps } from "./product-legal"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 제품 「예시 제품」. 사업자 정보 값은 누가 봐도 가짜인 자리 값이다(Example Co.·+82 10-0000-0000 …) — 실제 값은 제품 설정에서 온다.
const copy = {
  brand: "Example Product",
  navLabel: "Legal and support",
  links: {
    terms: { label: "Terms of Service", href: "/terms" },
    privacy: { label: "Privacy Policy", href: "/privacy" },
    refund: { label: "Refund Policy", href: "/refund" },
    contact: { label: "Contact", href: "/contact" },
  },
  cookieSettings: { label: "Cookie settings", href: "#cookie-settings" },
  businessTitle: "Business information",
  businessLabels: {
    name: "Company",
    owner: "Representative",
    address: "Address",
    phone: "Phone",
    email: "Email",
    registrationNo: "Business registration no.",
    mailOrderNo: "Mail-order business no.",
    hostingProvider: "Hosting provider",
  },
  copyright: "© 2026 Example Co.",
}

export const fixture: FooterProductLegalProps = {
  locale: "en",
  copy,
  business: {
    name: "Example Co.",
    owner: "Example Owner",
    address: "1 Example-ro, Example-gu, Example City (example)",
    phone: "+82 10-0000-0000",
    email: "hello@example.com",
    registrationNo: "000-00-00000",
    mailOrderNo: "EXAMPLE-0000",
    hostingProvider: "Example Hosting Inc.",
  },
}

// 최대: 법정 링크 넷·긴 값.
export const fixtureMax: FooterProductLegalProps = {
  ...fixture,
  copy: { ...copy, brand: "Example Product — long product name for the footer strip (example)", copyright: "© 2026 Example Co. All rights reserved. Prices shown in USD. (example)" },
  business: {
    ...fixture.business,
    name: "Example Company Limited, Example Branch Office for Example Region (example)",
    address: "Building 1, Floor 2, Example-daero 123-45 beon-gil, Example-dong, Example-gu, Example Metropolitan City, 00000 (example)",
    email: "customer-support-for-example-product@example.com",
  },
}

// 최소: 사업자 정보 없음(제품 설정이 비어 있다) — 법정 링크 둘과 쿠키 설정만. 칸 자체를 그리지 않는다.
export const fixtureMin: FooterProductLegalProps = {
  locale: "en",
  copy: { ...copy, brand: undefined, copyright: undefined, links: { terms: copy.links.terms, privacy: copy.links.privacy }, cookieSettings: undefined },
}
