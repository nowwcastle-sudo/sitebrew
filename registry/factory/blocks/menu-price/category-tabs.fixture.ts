import { CATEGORIES, CATEGORIES_MAX, ORIGIN } from "./board-columns.fixture"
import type { MenuPriceCategoryTabsProps } from "./category-tabs"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 카페 메뉴, 문구마다 「예시」.
const COPY = { title: "메뉴", lead: "분류를 눌러 골라 보세요. 가격은 모두 부가세 포함이에요(예시).", tabsLabel: "메뉴 분류", soldOutLabel: "품절", footnote: "가격은 모두 부가세 포함이에요(예시).", origin: ORIGIN }

export const fixture: MenuPriceCategoryTabsProps = { copy: COPY, categories: CATEGORIES }

// 최대: 분류 6개(긴 이름 — 탭 줄이 가로로 밀린다), 분류마다 8줄.
export const fixtureMax: MenuPriceCategoryTabsProps = {
  copy: { ...COPY, title: "메뉴 — 커피·차·계절 음료와 매일 굽는 구움과자를 분류별로 보기(예시)" },
  categories: CATEGORIES_MAX,
}

// 최소: 분류 하나(탭 없이 목록), 메뉴 하나, 머리말·원산지 없이.
export const fixtureMin: MenuPriceCategoryTabsProps = {
  copy: { title: COPY.title, tabsLabel: COPY.tabsLabel, soldOutLabel: COPY.soldOutLabel, footnote: COPY.footnote },
  categories: [{ name: "커피", items: [{ name: "아메리카노", price: 4500 }] }],
}
