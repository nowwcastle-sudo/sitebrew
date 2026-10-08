import { CATEGORIES, CATEGORIES_MAX, ORIGIN } from "./board-columns.fixture"
import type { MenuPricePhotoRowsProps } from "./photo-rows"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 카페 메뉴, 문구마다 「예시」. 사진은 빈 자리(실사 필수 칸 — 자산 없음).
const COPY = { title: "대표 메뉴", lead: "처음 오셨다면 이것부터 드셔 보세요. 가격은 모두 부가세 포함이에요(예시).", soldOutLabel: "품절", footnote: "가격은 모두 부가세 포함이에요(예시).", origin: ORIGIN }

export const fixture: MenuPricePhotoRowsProps = { copy: COPY, items: CATEGORIES.flatMap((c) => c.items).slice(0, 6) }

// 최대: 16줄, 긴 이름·설명·표지.
export const fixtureMax: MenuPricePhotoRowsProps = {
  copy: { ...COPY, title: "대표 메뉴 — 처음 오셨다면 이것부터 드셔 보세요, 계절마다 바뀌어요(예시)" },
  items: CATEGORIES_MAX.flatMap((c) => c.items).slice(0, 16),
}

// 최소: 머리말·원산지 없이 사진 없는 메뉴 하나.
export const fixtureMin: MenuPricePhotoRowsProps = { copy: { title: COPY.title, soldOutLabel: COPY.soldOutLabel, footnote: COPY.footnote }, items: [{ name: "아메리카노", price: 4500 }] }
