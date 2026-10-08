// 해지 대안 한도(마케팅 규칙 R2 — 할인 30% 이하·2~3개월). 원천은 web-factory registry/factory/lib/retention-offer.ts 의 retentionOfferIssues 다.
// 그 파일은 아직 계약 잠금(packages/contract/contract.lock.json, 9b4d4a6)에 없어 런타임으로 부를 수 없다(잠금은 D10 에서 태그로 바꾼다).
// 그래서 같은 규칙을 여기 두고, test/retention-parity.test.mjs 가 web-factory p3-3 원본과 같은 판정을 내는지 표로 대조한다.
// 계약 가져오기에 lib 가 들어오면 이 파일을 지우고 그것을 부른다(대장 D50).
import type { RetentionOffer } from "@launch-factory/contract"

export const RETENTION_DISCOUNT_MAX_PERCENT = 30
export const RETENTION_DISCOUNT_MONTHS = [2, 3] as const

const posInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1

/** 문제 목록. 빈 배열이면 통과. web-factory retentionOfferIssues 와 같은 판정(문구는 다를 수 있다) */
export function retentionOfferIssues(offer: RetentionOffer): string[] {
  const at = `retention offer ${offer.id || "(no id)"}`
  const v: string[] = []
  if (!offer.id) v.push(`${at}: id is empty`)
  if (offer.kind === "discount") {
    const d = offer.discount
    if (!d) v.push(`${at}: discount offer needs discount { percent, months }`)
    else {
      if (!posInt(d.percent) || d.percent > RETENTION_DISCOUNT_MAX_PERCENT) v.push(`${at}: discount must be an integer 1-${RETENTION_DISCOUNT_MAX_PERCENT}% (got ${d.percent})`)
      if (!(RETENTION_DISCOUNT_MONTHS as readonly number[]).includes(d.months)) v.push(`${at}: discount months must be ${RETENTION_DISCOUNT_MONTHS.join(" or ")} (got ${d.months})`)
    }
  } else if (offer.kind === "pause") {
    if (!posInt(offer.pauseMonths)) v.push(`${at}: pause offer needs an integer pauseMonths >= 1`)
  } else if (offer.kind === "downgrade") {
    if (!offer.planId) v.push(`${at}: downgrade offer needs planId`)
  } else v.push(`${at}: kind must be pause, downgrade or discount (got ${String((offer as { kind: unknown }).kind)})`)
  return v
}
