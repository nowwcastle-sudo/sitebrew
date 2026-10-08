import type { BottomTabStickyActionBarProps } from "./sticky-action-bar"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 생활용품 상세페이지, 문구마다 「예시」.
export const fixture: BottomTabStickyActionBarProps = {
  copy: {
    regionLabel: "구매",
    name: "리넨 앞치마(예시)",
    priceLabel: "판매가",
    price: 32900,
    originalPriceLabel: "정가",
    originalPrice: 39000,
    unit: "원",
    primary: { label: "구매하기", href: "#checkout" },
    secondary: { label: "장바구니", href: "#cart" },
  },
}

// 최대: 긴 상품 이름, 큰 금액, 버튼 이름은 6자(버튼 이름 권장 상한 — 375 에서 두 버튼이 한 줄).
export const fixtureMax: BottomTabStickyActionBarProps = {
  copy: {
    regionLabel: "구매",
    name: "손으로 짠 두꺼운 리넨 작업 앞치마 — 주머니 셋·끈 길이 조절(예시)",
    priceLabel: "판매가",
    price: 1289000,
    originalPriceLabel: "정가",
    originalPrice: 1590000,
    unit: "원",
    primary: { label: "바로 구매하기", href: "#checkout" },
    secondary: { label: "장바구니 담기", href: "#cart" },
  },
}

// 최소: 이름·정가·보조 행동 없음.
export const fixtureMin: BottomTabStickyActionBarProps = {
  copy: {
    regionLabel: "구매",
    priceLabel: "판매가",
    price: 9900,
    unit: "원",
    primary: { label: "구매하기", href: "#checkout" },
  },
}
