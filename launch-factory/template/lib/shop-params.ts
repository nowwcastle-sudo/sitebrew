// 상점 쪽이 주소에서 읽는 값 두 가지(순수 함수 — node 시험이 읽는다). 주소의 값은 믿지 않는다: 모양이 맞는 것만 받고 나머지는 없는 것으로 본다.
//   parseAddParam        — /cart?add=<상품 id> (상품 목록 쪽 /products 의 카드가 여기로 온다). 주소만으로는 아무것도 담지 않는다(담기 확인 줄이 뜰 뿐이고 누르면 서버 액션이 담는다).
//   parseCheckoutReturn  — 결제창을 마치고 돌아오는 /checkout/return. PortOne 이 paymentId(성공·실패 모두)와 code·message(실패)를 붙이고, orderId 는 우리가 돌아올 주소에 실었다.
type Param = string | string[] | undefined

/** 상품 id·주문 id·결제 id 에 쓰는 글자(상품표 id 는 영문 소문자·숫자·하이픈, 주문·결제 id 는 uuid 꼴) */
const ID = /^[A-Za-z0-9_-]{1,100}$/

const first = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value)

/** 상품표 id 에 쓰는 글자(packages/commerce catalog.ts 의 ID 와 같다 — 영문·숫자로 시작하고 `_ . -` 를 쓸 수 있다) */
const PRODUCT_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/

/** 담기 확인 줄에 쓸 상품 id. 모양이 틀리면 null */
export function parseAddParam(value: Param): string | null {
  const v = first(value)
  return v && PRODUCT_ID.test(v) ? v : null
}

/** 주문 상세 쪽 주소의 주문 id. 모양이 틀리면 null(쪽이 404 를 낸다) */
export const parseOrderId = (value: string | undefined): string | null => (value && ID.test(value) ? value : null)

export type CheckoutReturn =
  /** 확정할 결제가 없다(주소를 손으로 열었거나 값이 깨졌다) */
  | { kind: "missing" }
  /** 결제창이 실패·취소로 돌려보냈다 — 주문은 결제 대기로 남아 있다 */
  | { kind: "failed"; orderId: string; code: string }
  /** 결제창이 끝났다고 돌려보냈다 — 서버가 결제 공급자에 다시 물어 확정한다 */
  | { kind: "confirm"; orderId: string; paymentId: string }

export function parseCheckoutReturn(params: Record<string, Param>): CheckoutReturn {
  const orderId = first(params.orderId)
  if (!orderId || !ID.test(orderId)) return { kind: "missing" }
  const code = first(params.code)
  if (code) return { kind: "failed", orderId, code: code.slice(0, 80) }
  const paymentId = first(params.paymentId)
  if (!paymentId || !ID.test(paymentId)) return { kind: "missing" }
  return { kind: "confirm", orderId, paymentId }
}
