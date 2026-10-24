// 상품 목록 쪽(/products)이 쓰는 순수 변환 — 판매 상품표(CatalogItem, 계약)를 상품 목록 블록이 받는 Product 로 바꾼다. node 시험이 읽는다.
// 상품표에는 사진 비율·정가·분류가 없다: 사진은 imageUrl 이 있으면 그것, 없으면 빈 칸(블록이 「실제 사진 필요」 자리를 그린다 — 깨진 그림을 내지 않는다).
// 가격은 계약의 Money(최소 단위 정수)이고 KRW 뿐이라 원 단위 정수 그대로다.
import type { Product } from "@/components/content/schemas/commerce"
import type { CatalogItem } from "@/components/contract/commerce"

/** 상품 카드가 가는 곳 — 장바구니 쪽의 담기 확인 줄(주소만으로는 담기지 않는다) */
export const ADD_HREF = "/cart?add={slug}"

export function toProductCards(items: readonly CatalogItem[]): Product[] {
  return items.map((i) => ({
    // slug 는 콘텐츠 스키마에서는 소문자·숫자·하이픈이지만 상품표 id 가 정본이다(대문자·_ · . 가 있을 수 있다) — 블록은 주소 조각으로만 쓴다
    slug: encodeURIComponent(i.id),
    name: i.name,
    price: i.price.amount,
    options: [],
    thumbs: [{ id: `product-${i.id}`, aspect: "1:1", source: "real-required", alt: i.name, ...(i.imageUrl ? { src: i.imageUrl } : {}) }],
  }))
}
