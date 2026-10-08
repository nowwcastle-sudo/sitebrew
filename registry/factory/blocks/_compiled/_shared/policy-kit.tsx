import * as React from "react"

import { NEEDS_CHECK } from "@/registry/factory/content/content-core"

import { fillText } from "../_shared/billing-format"
import { blockLabels } from "../_shared/block-labels"
import { formatPrice } from "../_shared/price-tag"

// 배송·반품 안내(P3-2 Task 7b-commerce, 대장 A62 — 공유 조각 block-shared-policy-kit). shipping-returns 세 변형이 같이 쓴다.
// 근거: 전자상거래법 제13조 제2항 제4~6호(공급방법·청약철회·교환·반품·환불 조건) · 제17조(청약철회 7일·불가 사유·하자 3개월/30일) · 제18조(환급 3영업일·
// 반품비용 — 단순 변심은 소비자, 하자·표시와 다름은 판매자) + 공정위 고시 Ⅲ.2 「거래조건에 관한 정보」(배송방법·배송기간·배송비용(도서산간 추가 포함)·
// 청약철회 기한과 반품비용·불가 사유와 근거·교환·반품·보증 조건·A/S 전화·환불 방법과 지연배상금).
//   · 법이 정한 숫자(7일·3개월·30일·3영업일)는 LEGAL 상수 — 판매자가 정하는 값(배송비·출고일·반품비·기한)은 props(facts)다.
//   · 값이 없으면 「확인 필요」(content-core NEEDS_CHECK, data-needs-check). 빈 칸을 지어내지 않는다.
//   · 금액은 원화 글자(formatPrice) + data-numeric·data-price="shipping-fee" — 화면에 「VAT 포함」 안내(copy.vatNote, data-vat)를 함께 둔다(L1).
export const LEGAL = {
  // 제17조 제1항: 계약내용에 관한 서면을 받은 날(또는 재화를 공급받은 날)부터 7일 — 판매자가 더 길게 정할 수는 있지만 짧게는 못 한다
  withdrawalMinDays: 7,
  // 제17조 제3항: 표시·광고와 다르거나 계약내용과 다르게 이행된 경우 — 공급받은 날부터 3개월, 그 사실을 안 날부터 30일
  defectFromReceiptMonths: 3,
  defectFromKnownDays: 30,
  // 제18조 제2항: 반환받은 날부터 3영업일 이내 환급(늦으면 지연배상금)
  refundBusinessDays: 3,
} as const

export type ShippingFacts = {
  // 택배사·배송 방법 이름
  method?: string
  // 주문 뒤 출고까지 영업일(0 이면 당일)
  leadDays?: number
  // 배송비(0 이면 무료)
  fee?: number
  // 이 금액 이상이면 무료 — 없으면 조건 없음
  freeThreshold?: number
  // 도서산간 추가 배송비: 숫자 = 금액, null = 추가 비용 없음, undefined = 확인 필요
  remoteExtra?: number | null
  currency?: string
  // 금액이 최소 단위 정수(USD·EUR 센트)인가 — 상세페이지 콘텐츠의 금액이 그렇다. 없으면 예전처럼 화면 단위로 읽는다
  minor?: boolean
  // 금액을 그리는 지역("en-US" …) — 없으면 한국 원화는 예전 글자 그대로(12,900원)
  locale?: string
}
export type ReturnFacts = {
  // 단순 변심 반품 배송비를 누가 내나
  feePayer?: "buyer" | "seller"
  // 구매자가 내는 반품 배송비 금액(feePayer buyer 일 때 보이는 참고 금액)
  returnFee?: number
  // 청약철회 기간(일) — 제17조 제1항, 7일 이상
  withdrawalDays?: number
  // 청약철회 불가 사유(제17조 제2항 각 호에 해당하는 것을 상품에 맞게 적는다). [] = 정한 사유 없음, undefined = 확인 필요
  exclusions?: string[]
  // 환불까지 영업일(제18조 제2항 — 3영업일 이내)
  refundDays?: number
}
export type PolicyFacts = { shipping: ShippingFacts; returns: ReturnFacts }

export type PolicyCopy = {
  // 행 이름
  labels: { method: string; lead: string; fee: string; remote: string; withdrawal: string; returnFee: string; exclusions: string; defect: string; refund: string }
  // 「주문 후 {days}영업일 안에 보내요」
  lead: string
  // 당일 출고
  leadSame: string
  // 「{threshold} 이상 주문하면 무료예요」
  freeOver: string
  free: string
  // 도서산간 「{amount}이 더 들어요」 · 추가 비용 없음
  remote: string
  remoteNone: string
  // 「받은 날부터 {days}일 안에 신청할 수 있어요」
  withdrawal: string
  // 반품 배송비: 구매자 부담(금액 있음/없음) · 판매자 부담
  returnFeeBuyer: string
  returnFeeBuyerAmount: string
  returnFeeSeller: string
  // 청약철회 불가 사유 앞말(법 근거 한 줄) · 사유가 없을 때
  exclusionsNote: string
  exclusionsNone: string
  // 「받은 날부터 {months}개월, 알게 된 날부터 {days}일 안에 …」
  defect: string
  // 「반품 상품이 도착한 날부터 {days}영업일 안에 환불해요 …」
  refund: string
  // 「표시한 금액은 모두 VAT 포함이에요」
  vatNote: string
}

/** 정책 값의 빈틈: 법이 정한 하한·기한 위반 · 값이 없는 것(확인 필요). 빈 배열이면 온전하다. */
export function policyIssues(f: PolicyFacts, locale?: string): string[] {
  const L = blockLabels(locale)
  const p: string[] = []
  const s = f.shipping
  const r = f.returns
  if (s.fee === undefined) p.push(L.policyFee)
  if (s.leadDays === undefined) p.push(L.policyLead)
  if (!s.method?.trim()) p.push(L.policyMethod)
  if (s.freeThreshold !== undefined && s.fee === 0) p.push(L.policyFreeZero)
  if (r.withdrawalDays === undefined) p.push(L.policyWithdrawal)
  else if (r.withdrawalDays < LEGAL.withdrawalMinDays) p.push(L.policyWithdrawalShort(r.withdrawalDays, LEGAL.withdrawalMinDays))
  if (r.feePayer === undefined) p.push(L.policyPayer)
  if (r.refundDays === undefined) p.push(L.policyRefund)
  else if (r.refundDays > LEGAL.refundBusinessDays) p.push(L.policyRefundLong(r.refundDays, LEGAL.refundBusinessDays))
  if (r.exclusions === undefined) p.push(L.policyExclusions)
  return p
}

export type PolicyRow = { id: string; label: string; value: React.ReactNode; missing: boolean }

const Missing = () => (
  <span data-needs-check="" className="inline-flex items-center rounded-sm border border-dashed px-2 text-base leading-[1.6]">
    {NEEDS_CHECK}
  </span>
)
/** 금액을 그리는 서식: 통화 · 최소 단위 여부 · 지역 */
export type MoneyFmt = { currency?: string; minor?: boolean; locale?: string }
export const moneyFmt = (s: ShippingFacts): MoneyFmt => ({ currency: s.currency, minor: s.minor, locale: s.locale })
const Money = ({ amount, fmt }: { amount: number; fmt?: MoneyFmt }) => (
  <span data-numeric="" data-price="shipping-fee">
    {formatPrice(amount, fmt?.currency, fmt?.minor || fmt?.locale ? { minor: fmt.minor, locale: fmt.locale } : undefined)}
  </span>
)
const Num = ({ children, attr }: { children: React.ReactNode; attr?: string }) => (
  <span data-numeric="" {...(attr ? { [attr]: "" } : {})}>
    {children}
  </span>
)

/** 「{name}」 자리에 요소를 끼운다(fill 과 같지만 이 조각 안에서 쓰는 가벼운 판) */
function put(template: string, vars: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{[a-zA-Z]+\})/g).map((part, i) => {
    const m = part.match(/^\{([a-zA-Z]+)\}$/)
    return m && m[1] in vars ? <React.Fragment key={i}>{vars[m[1]]}</React.Fragment> : part
  })
}

/** 배송 행: 방법 · 출고 · 배송비(+무료 기준) · 도서산간 */
export function shippingRows(f: ShippingFacts, c: PolicyCopy): PolicyRow[] {
  const fmt = moneyFmt(f)
  const rows: PolicyRow[] = []
  rows.push({ id: "method", label: c.labels.method, missing: !f.method?.trim(), value: f.method?.trim() ? f.method : <Missing /> })
  rows.push({
    id: "lead",
    label: c.labels.lead,
    missing: f.leadDays === undefined,
    value: f.leadDays === undefined ? <Missing /> : f.leadDays === 0 ? c.leadSame : put(c.lead, { days: <Num attr="data-lead-days">{f.leadDays}</Num> }),
  })
  rows.push({
    id: "fee",
    label: c.labels.fee,
    missing: f.fee === undefined,
    value:
      f.fee === undefined ? (
        <Missing />
      ) : f.fee === 0 ? (
        <span data-shipping-fee="">{c.free}</span>
      ) : (
        <>
          <span data-shipping-fee="">
            <Money amount={f.fee} fmt={fmt} />
          </span>
          {f.freeThreshold !== undefined ? (
            <>
              {" "}
              <span data-free-threshold="" className="block text-base leading-[1.5] text-muted-foreground">{put(c.freeOver, { threshold: <Money amount={f.freeThreshold} fmt={fmt} /> })}</span>
            </>
          ) : null}
        </>
      ),
  })
  rows.push({
    id: "remote",
    label: c.labels.remote,
    missing: f.remoteExtra === undefined,
    value: f.remoteExtra === undefined ? <Missing /> : f.remoteExtra === null ? c.remoteNone : put(c.remote, { amount: <Money amount={f.remoteExtra} fmt={fmt} /> }),
  })
  return rows
}

/** 반품·교환·환불 행: 청약철회 기한 · 반품 배송비 · 불가 사유 · 하자 · 환불 */
export function returnRows(f: ReturnFacts, c: PolicyCopy, money?: string | MoneyFmt): PolicyRow[] {
  const fmt: MoneyFmt | undefined = typeof money === "string" ? { currency: money } : money
  const rows: PolicyRow[] = []
  rows.push({
    id: "withdrawal",
    label: c.labels.withdrawal,
    missing: f.withdrawalDays === undefined,
    value: f.withdrawalDays === undefined ? <Missing /> : put(c.withdrawal, { days: <Num attr="data-withdrawal-days">{f.withdrawalDays}</Num> }),
  })
  rows.push({
    id: "returnFee",
    label: c.labels.returnFee,
    missing: f.feePayer === undefined,
    value:
      f.feePayer === undefined ? (
        <Missing />
      ) : (
        <span data-fee-payer={f.feePayer}>
          {f.feePayer === "seller" ? c.returnFeeSeller : f.returnFee !== undefined ? put(c.returnFeeBuyerAmount, { fee: <Money amount={f.returnFee} fmt={fmt} /> }) : c.returnFeeBuyer}
        </span>
      ),
  })
  rows.push({
    id: "exclusions",
    label: c.labels.exclusions,
    missing: f.exclusions === undefined,
    value:
      f.exclusions === undefined ? (
        <Missing />
      ) : f.exclusions.length === 0 ? (
        c.exclusionsNone
      ) : (
        <>
          <span className="block pb-2 text-base leading-[1.6]">{c.exclusionsNote}</span>
          <ul data-exclusions="" className="flex list-disc flex-col gap-1 ps-5 text-base leading-[1.6]">
            {f.exclusions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      ),
  })
  rows.push({
    id: "defect",
    label: c.labels.defect,
    missing: false,
    value: <span data-defect="">{fillText(c.defect, { months: LEGAL.defectFromReceiptMonths, days: LEGAL.defectFromKnownDays })}</span>,
  })
  rows.push({
    id: "refund",
    label: c.labels.refund,
    missing: f.refundDays === undefined,
    value: f.refundDays === undefined ? <Missing /> : put(c.refund, { days: <Num attr="data-refund-days">{f.refundDays}</Num> }),
  })
  return rows
}

export const allRows = (f: PolicyFacts, c: PolicyCopy): PolicyRow[] => [...shippingRows(f.shipping, c), ...returnRows(f.returns, c, moneyFmt(f.shipping))]

/** 이 안내의 「한눈에」 값 셋(배송비 · 출고 · 청약철회 기간) — 큰 글씨 칸이 쓴다 */
export function glance(f: PolicyFacts, c: PolicyCopy): { id: string; label: string; value: React.ReactNode; missing: boolean }[] {
  const ship = shippingRows(f.shipping, c)
  const ret = returnRows(f.returns, c, moneyFmt(f.shipping))
  const by = (rows: PolicyRow[], id: string) => rows.find((r) => r.id === id)!
  return [by(ship, "fee"), by(ship, "lead"), by(ret, "withdrawal")]
}
