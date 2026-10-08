// 전자상거래법 거래기록 보존 기간.
// 출처: 전자상거래 등에서의 소비자보호에 관한 법률 시행령 제6조(사업자가 보존하는 거래기록의 대상 등) 제1항
//   법령일련번호(MST) 288143, 시행 2026-07-21, https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288143
//   위임 근거: 같은 법 제6조(거래기록의 보존 등) 제3항 — MST 282793, 시행 2026-07-21, https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=282793
//   국가법령정보센터 Open API(lawService.do, JO=000600)로 2026-09-30 확인.
// 제6조제2항: 거래기록과 관련 개인정보(성명·주소·전자우편 등)는 동의를 철회해도 보존할 「수 있다」. 우리는 더 좁게 가명 참조만 남긴다.

export const RETENTION_SOURCE = {
  law: "전자상거래 등에서의 소비자보호에 관한 법률 시행령",
  article: "제6조제1항",
  mst: "288143",
  effectiveDate: "2026-07-21",
  url: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288143",
  fetchedAt: "2026-09-30",
} as const

/** 시행령 제6조제1항 각 호. months는 법정 최소 보존 기간이다. */
export const ECOMMERCE_RETENTION = {
  /** 제1호 표시·광고에 관한 기록: 6개월 */
  advertising: { months: 6, basis: "시행령 제6조제1항제1호" },
  /** 제2호 계약 또는 청약철회 등에 관한 기록: 5년 */
  contract: { months: 60, basis: "시행령 제6조제1항제2호" },
  /** 제3호 대금결제 및 재화등의 공급에 관한 기록: 5년 */
  payment: { months: 60, basis: "시행령 제6조제1항제3호" },
  /** 제4호 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 */
  dispute: { months: 36, basis: "시행령 제6조제1항제4호" },
} as const

export type RetainedTransactionKind = keyof typeof ECOMMERCE_RETENTION
export const RETAINED_TRANSACTION_KINDS = Object.keys(ECOMMERCE_RETENTION) as RetainedTransactionKind[]

/** 보존 만료 시각(UTC 달 더하기). 말일 넘침(1/31 + 1개월 → 3/3)은 기간을 늘리는 쪽이라 법정 최소를 어기지 않는다. */
export function retainUntil(kind: RetainedTransactionKind, occurredAt: Date): Date {
  const d = new Date(occurredAt.getTime())
  d.setUTCMonth(d.getUTCMonth() + ECOMMERCE_RETENTION[kind].months)
  return d
}
