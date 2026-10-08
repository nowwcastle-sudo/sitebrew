export const RETENTION_DISCOUNT_MAX_PERCENT = 30
export const RETENTION_DISCOUNT_MONTHS = [2, 3] as const

/** 검사하는 칸(ports RetentionOffer 와 같은 모양) */
export interface RetentionOfferShape {
  id: string
  kind: string
  discount?: { percent: number; months: number }
  pauseMonths?: number
  planId?: string
}

const posInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1

/**
 * 해지 대안 하나의 문제 목록(한국어). 빈 배열이면 통과다.
 * discount 는 정수 1~30% · 정수 2~3개월, pause 는 정수 1개월 이상, downgrade 는 요금제 id 가 있어야 한다.
 */
export function retentionOfferIssues(offer: RetentionOfferShape): string[] {
  const at = `해지 대안 ${offer.id || "(id 없음)"}`
  const v: string[] = []
  if (!offer.id) v.push(`${at}: id 가 비어 있어요.`)
  if (offer.kind === "discount") {
    const d = offer.discount
    if (!d) v.push(`${at}: 할인 대안에는 discount(퍼센트·개월)가 필요해요.`)
    else {
      if (!posInt(d.percent) || d.percent > RETENTION_DISCOUNT_MAX_PERCENT)
        v.push(`${at}: 할인은 1~${RETENTION_DISCOUNT_MAX_PERCENT}% 정수여야 해요(지금 ${d.percent}%). 30%를 넘는 할인은 해지 대안으로 쓰지 않아요.`)
      if (!(RETENTION_DISCOUNT_MONTHS as readonly number[]).includes(d.months))
        v.push(`${at}: 할인 기간은 ${RETENTION_DISCOUNT_MONTHS.join("~")}개월이어야 해요(지금 ${d.months}개월).`)
    }
  } else if (offer.kind === "pause") {
    if (!posInt(offer.pauseMonths)) v.push(`${at}: 일시정지 대안에는 1 이상의 정수 pauseMonths 가 필요해요.`)
  } else if (offer.kind === "downgrade") {
    if (!offer.planId) v.push(`${at}: 다운그레이드 대안에는 옮겨 갈 요금제 planId 가 필요해요.`)
  } else v.push(`${at}: 종류는 pause·downgrade·discount 중 하나예요(지금 ${offer.kind}).`)
  return v
}
