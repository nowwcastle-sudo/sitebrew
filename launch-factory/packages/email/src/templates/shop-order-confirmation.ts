// 상점 주문 확인 메일(계획 3a B5) — 주문 줄·합계·배송지·「내 주문 보기」. 구독 결제용 orderConfirmation(Paddle 영수증 안내)과는 별개다:
// 상점 주문은 우리가 판매자라 영수증 안내 대신 배송지를 싣는다. 금액은 서버의 주문 행이 정본이라 이 템플릿은 합계를 다시 계산하지 않고 맞는지만 본다.
import type { IsoDate, Money } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, formatMoney, isValidDate } from "../format.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, row, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"
import { moneyWithTax } from "./order-confirmation.ts"

export interface ShopOrderLine {
  name: string
  quantity: number
  /** 한 개 값(최소 단위 정수) */
  unitAmount: Money
}

export interface ShopOrderAddress {
  recipient: string
  phone?: string
  postcode?: string
  address1: string
  address2?: string
  /** 배송 메모 */
  note?: string
}

export interface ShopOrderConfirmationInput extends BaseInput<EmailMessages["email"]["shopOrderConfirmation"]> {
  orderId: string
  orderedAt: IsoDate
  items: ShopOrderLine[]
  subtotal: Money
  shipping: Money
  /** 총 결제 금액 — 소계 + 배송비 */
  total: Money
  address: ShopOrderAddress
  /** 내 주문 목록 화면 주소 */
  ordersUrl: string
}

const blank = (v: unknown): boolean => typeof v !== "string" || v.trim() === ""
const isMinor = (m: Money | undefined): m is Money => !!m && Number.isInteger(m.amount) && typeof m.currency === "string"

/** 줄·합계 검사. 통화는 한 가지여야 하고 소계는 줄의 합, 합계는 소계 + 배송비여야 한다. */
function checkAmounts(input: ShopOrderConfirmationInput, problems: string[]): void {
  const items = Array.isArray(input.items) ? input.items : []
  if (items.length === 0) problems.push("items must have at least one line")
  let sum = 0
  let linesOk = items.length > 0
  items.forEach((line, i) => {
    if (blank(line?.name)) problems.push(`items[${i}].name is required`)
    if (!Number.isInteger(line?.quantity) || line.quantity < 1) problems.push(`items[${i}].quantity must be an integer >= 1`)
    if (!isMinor(line?.unitAmount) || line.unitAmount.amount < 0) {
      problems.push(`items[${i}].unitAmount must be an integer in minor units`)
      linesOk = false
    } else if (Number.isInteger(line.quantity)) sum += line.unitAmount.amount * line.quantity
  })
  const named = { subtotal: input.subtotal, shipping: input.shipping, total: input.total }
  let totalsOk = true
  for (const [field, money] of Object.entries(named)) {
    if (!isMinor(money) || money.amount < 0) {
      problems.push(`${field} must be an integer in minor units`)
      totalsOk = false
    }
  }
  if (!totalsOk) return
  const currencies = new Set([input.subtotal.currency, input.shipping.currency, input.total.currency, ...items.map((l) => l?.unitAmount?.currency)])
  if (currencies.size > 1) {
    problems.push("currency must be the same on every amount")
    return
  }
  if (input.total.amount !== input.subtotal.amount + input.shipping.amount) problems.push("total must equal subtotal + shipping")
  if (linesOk && input.subtotal.amount !== sum) problems.push("subtotal must equal the sum of the item lines")
}

function checkAddress(address: ShopOrderAddress | undefined, problems: string[]): void {
  if (!address || typeof address !== "object") {
    problems.push("address is required")
    return
  }
  if (blank(address.recipient)) problems.push("address.recipient is required")
  if (blank(address.address1)) problems.push("address.address1 is required")
}

/** 우편번호가 있으면 괄호로 앞에 붙이고, 없는 칸은 건너뛴다. */
function addressLine(a: ShopOrderAddress): string {
  const post = blank(a.postcode) ? "" : `(${a.postcode})`
  return [post, a.address1, a.address2].filter((s) => typeof s === "string" && s.trim() !== "").join(" ")
}

export function shopOrderConfirmation(input: ShopOrderConfirmationInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (blank(input.orderId)) problems.push("orderId is required")
  if (!isValidDate(input.orderedAt)) problems.push("orderedAt must be an ISO date")
  checkAmounts(input, problems)
  checkAddress(input.address, problems)
  requireLink(input.ordersUrl, "ordersUrl", problems)
  throwIfProblems("shopOrderConfirmation", problems)

  const t = copyOf(input, "shopOrderConfirmation")
  const v = { productName: input.productName, orderId: input.orderId }
  const a = input.address
  const where = "shopOrderConfirmation"
  const lines = input.items.map((line) =>
    row(
      fill(t.itemLabel, { name: line.name, quantity: String(line.quantity) }, `${where}.itemLabel`),
      fill(t.itemUnit, { amount: formatMoney(line.unitAmount, input.locale) }, `${where}.itemUnit`),
    ),
  )
  const address = [
    p(t.addressHeading, true),
    row(t.recipientLabel, a.recipient),
    ...(blank(a.phone) ? [] : [row(t.phoneLabel, a.phone as string)]),
    row(t.addressLabel, addressLine(a)),
    ...(blank(a.note) ? [] : [row(t.noteLabel, a.note as string)]),
  ]
  return {
    subject: fill(t.subject, v, `${where}.subject`),
    element: layout(input, {
      preview: fill(t.preview, v, `${where}.preview`),
      heading: fill(t.heading, v, `${where}.heading`),
      children: [
        p(fill(t.body, v, `${where}.body`)),
        row(t.orderIdLabel, input.orderId),
        row(t.orderedAtLabel, formatDate(input.orderedAt, input.locale, timeZoneOf(input))),
        p(t.itemsHeading, true),
        ...lines,
        row(t.subtotalLabel, formatMoney(input.subtotal, input.locale)),
        row(t.shippingLabel, input.shipping.amount === 0 ? t.shippingFree : formatMoney(input.shipping, input.locale)),
        row(t.totalLabel, moneyWithTax(input.total, input)),
        ...address,
        actions(input.locale, [{ href: input.ordersUrl, label: t.cta }]),
      ],
    }),
  }
}
