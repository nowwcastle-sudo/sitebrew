// launch-factory: 상품표와 배송비 — 제품마다 고치는 값이다. 이 파일은 제품 것이다(레지스트리를 다시 받으면 덮어쓸지 묻는다).
// 가격의 정본은 여기다. 브라우저가 보낸 금액·가격은 어디서도 읽지 않는다(장바구니는 상품 id 와 수량만 받는다).
//   id      영문 소문자·숫자·하이픈 1~64자. 주문 기록에 남으므로 한 번 쓴 id 는 바꾸지 않는다
//   price   원화 정수(원). 부가세 포함가로 적는다
//   stock   재고. 적지 않으면 재고 제한이 없다(서비스·무제한 상품). 적으면 처음 쓸 때 이 수로 재고 표에 넣고, 이후는 DB 의 수가 정본이다 — 재고를 고치려면 관리 화면의 「재고」 구획
//   imageUrl  선택. https 또는 사이트 안 경로
// 아래는 예시다 — 가상의 상품이고 실제 상품이 아니다. 지우고 제품의 것을 적는다.
import type { CatalogEntry, ShippingRule } from "@launch-factory/commerce"

export const PRODUCTS: readonly CatalogEntry[] = [
  { id: "example-mug", name: "머그컵(예시)", price: 12000, stock: 20 },
  { id: "example-tote", name: "에코백(예시)", price: 8000 },
  { id: "example-notebook", name: "노트(예시)", price: 4500, stock: 50 },
]

/** 배송비: 기본 3,000원, 5만 원 이상이면 무료. freeOver 를 null 로 두면 늘 fee 를 받고, fee 를 0 으로 두면 늘 무료다 */
export const SHIPPING: ShippingRule = { fee: 3000, freeOver: 50000 }

/** 「내 주문」 화면 경로 — 주문 확인 메일의 버튼이 이 주소(앱 주소 + 경로)로 간다 */
export const ORDERS_PATH = "/orders"
