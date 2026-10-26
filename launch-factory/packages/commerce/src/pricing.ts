// 금액 계산 — 소계·배송비·합계. 순수 함수이고 모두 최소 단위 정수(원)다.
// 배송비 설정은 제품 데이터(lib/launch/catalog.ts SHIPPING)다: fee 원, 소계가 freeOver 원 이상이면 무료(null 이면 무료 배송 없음).

export interface ShippingRule {
  fee: number
  freeOver: number | null
}

export interface PricedLine {
  unitAmount: number
  quantity: number
}

export interface Totals {
  subtotal: number
  shipping: number
  total: number
}

const wholeWon = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v)

export function defineShipping(rule: ShippingRule): ShippingRule {
  if (!wholeWon(rule?.fee) || rule.fee < 0) throw new Error(`배송비는 0 이상의 정수(원)여야 해요 (받은 값: ${String(rule?.fee)})`)
  if (rule.freeOver !== null && (!wholeWon(rule.freeOver) || rule.freeOver < 1)) throw new Error(`freeOver 는 1 이상의 정수(원) 또는 null 이어야 해요 (받은 값: ${String(rule.freeOver)})`)
  return Object.freeze({ fee: rule.fee, freeOver: rule.freeOver })
}

export function totalsOf(lines: readonly PricedLine[], rule: ShippingRule): Totals {
  let subtotal = 0
  for (const line of lines) {
    if (!wholeWon(line.unitAmount) || line.unitAmount < 0) throw new Error(`단가는 0 이상의 정수(원)여야 해요 (받은 값: ${String(line.unitAmount)})`)
    if (!wholeWon(line.quantity) || line.quantity < 1) throw new Error(`수량은 1 이상의 정수여야 해요 (받은 값: ${String(line.quantity)})`)
    subtotal += line.unitAmount * line.quantity
  }
  if (!Number.isSafeInteger(subtotal)) throw new Error("합계가 너무 커요")
  const shipping = lines.length === 0 || (rule.freeOver !== null && subtotal >= rule.freeOver) ? 0 : rule.fee
  return { subtotal, shipping, total: subtotal + shipping }
}
