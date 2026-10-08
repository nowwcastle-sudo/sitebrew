import type { MenuCategory } from "../_shared/menu-line"
import type { MenuPriceBoardColumnsProps } from "./board-columns"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 동네 카페 메뉴, 문구마다 「예시」. 세 변형이 같은 메뉴를 쓴다.
const photo = (alt: string) => ({ id: "menu-photo", aspect: "1:1", source: "real-required" as const, alt })
export const CATEGORIES: MenuCategory[] = [
  {
    name: "커피",
    note: "원두는 매주 바꿔요(예시).",
    items: [
      { name: "아메리카노", price: 4500, options: [{ label: "R", price: 4500 }, { label: "L", price: 5000 }], description: "산미 적은 기본 원두(예시)", photo: photo("아메리카노 한 잔") },
      { name: "카페라테", price: 5000, options: [{ label: "R", price: 5000 }, { label: "L", price: 5500 }], tags: ["대표"], photo: photo("우유 거품을 올린 카페라테") },
      { name: "흑당 라테", price: 5800, tags: ["신메뉴"], description: "흑당 시럽과 우유(예시)", photo: photo("흑당 시럽이 흐르는 라테") },
      { name: "오늘의 핸드드립", price: 6000, soldOut: true, photo: photo("핸드드립 주전자와 잔") },
    ],
  },
  {
    name: "차",
    items: [
      { name: "유자차", price: 5500, description: "직접 담근 유자청(예시)", photo: photo("유자차 한 잔") },
      { name: "보리차(따뜻하게)", price: 3000, photo: photo("보리차 한 잔") },
    ],
  },
  {
    name: "구움과자",
    items: [
      { name: "소금빵", price: 3200, tags: ["대표"], description: "오전 11시에 나와요(예시)", photo: photo("소금빵 두 개") },
      { name: "휘낭시에", price: 2800, photo: photo("휘낭시에 세 개") },
      { name: "당근 케이크 조각", price: 6500, photo: photo("당근 케이크 한 조각") },
    ],
  },
]
export const ORIGIN = "원산지: 쌀(국내산), 우유(국내산), 당근(국내산), 유자(국내산 고흥)(예시)"
// 최대: 분류 6개, 분류마다 8줄, 긴 이름·긴 설명.
export const CATEGORIES_MAX: MenuCategory[] = Array.from({ length: 6 }, (_, c) => ({
  name: `계절 한정 음료와 디저트 모음 ${c + 1}(예시)`,
  note: "재료가 떨어지면 일찍 마감해요. 알레르기가 있으면 주문할 때 알려 주세요(예시).",
  items: Array.from({ length: 8 }, (_, i) => ({
    name: `제주 유기농 말차와 국산 흑임자를 겹겹이 올린 크림 라테 ${i + 1}`,
    price: 12900 + i * 100,
    options: i % 3 === 0 ? [{ label: "레귤러", price: 12900 }, { label: "라지", price: 13900 }, { label: "병(500ml)", price: 21000 }] : undefined,
    description: "말차 크림과 흑임자 페이스트를 따로 올려 섞어 드시는 음료예요. 얼음을 빼면 양이 줄어들어요(예시).",
    tags: i % 2 ? ["신메뉴", "디카페인 가능"] : undefined,
    soldOut: i === 5,
    photo: photo("말차 크림 라테"),
  })),
}))

const COPY = { title: "오늘의 메뉴", lead: "가격은 모두 부가세 포함이에요(예시).", soldOutLabel: "품절", origin: ORIGIN }

export const fixture: MenuPriceBoardColumnsProps = { copy: COPY, categories: CATEGORIES }

export const fixtureMax: MenuPriceBoardColumnsProps = {
  copy: { ...COPY, title: "오늘의 메뉴 — 커피·차·계절 음료와 매일 굽는 구움과자(예시)", lead: "가격은 모두 부가세 포함이에요. 텀블러를 가져오시면 300원을 빼 드리고, 매장에서 드시면 유리잔에 담아 드려요(예시)." },
  categories: CATEGORIES_MAX,
}

// 최소: 머리말·원산지 없이 분류 하나·메뉴 하나.
export const fixtureMin: MenuPriceBoardColumnsProps = {
  copy: { title: COPY.title, lead: COPY.lead, soldOutLabel: COPY.soldOutLabel },
  categories: [{ name: "커피", items: [{ name: "아메리카노", price: 4500 }] }],
}
