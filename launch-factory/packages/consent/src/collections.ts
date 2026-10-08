// 개인정보 수집·이용 고지 표의 데이터(v0 Task 15, 대장 D97 — Task 18 국외 이전 표(D29·D38)와 같은 방식). 화면은 템플릿이 그린다.
// 지금 행은 문의 폼 하나다(가입 동의 문구는 약관·처리방침 판으로 따로 관리한다).
//
// 근거(2026-09-30 국가법령정보센터 Open API 로 확인):
//   - 개인정보 보호법 제15조①(MST 283839, 시행 2026-09-11): 1호 동의, 4호 「계약을 체결하는 과정에서 정보주체의 요청에 따른 조치를 이행하기 위하여 필요한 경우」.
//     문의에 답하는 것은 4호로 본다(동의 체크가 없는 폼도 받을 수 있다). 폼이 동의 체크를 받으면 1호 — 그때는 ② 네 가지(목적·항목·기간·거부 권리와 불이익)를 알린다.
//   - 같은 법 제21조①: 보유기간이 지나거나 목적을 이루면 지체 없이 파기. 다른 법령이 보존을 요구하면 예외.
//   - 전자상거래법 시행령 제6조①4(MST 288143, 시행 2026-07-21): 「소비자의 불만 또는 분쟁처리에 관한 기록: 3년」 → retain: "dispute".
// 기본 보유 기간 30일은 운영자 판정(D97)이다. 법이 정한 숫자가 아니라 「목적을 이룬 뒤 지체 없이」를 운영 기간으로 정한 값이다.
import type { MessageKey } from "@launch-factory/i18n"

export type InquiryRetention = { kind: "days"; days: number } | { kind: "dispute" }
export const DEFAULT_INQUIRY_RETENTION: InquiryRetention = { kind: "days", days: 30 }

export interface CollectionRow {
  id: "inquiry"
  items: MessageKey
  purpose: MessageKey
  /** 처리 근거(제15조①4 요청 이행, 또는 동의 체크를 받는 폼이면 ①1) */
  basis: MessageKey
  retention: { key: MessageKey; vars?: Record<string, number> }
  /** 거부 권리와 불이익(제15조②4) */
  refuse: MessageKey
}

export const COLLECTION_COLUMNS = ["items", "purpose", "basis", "retention"] as const
export const COLLECTION_COLUMN_KEYS: Record<(typeof COLLECTION_COLUMNS)[number], MessageKey> = {
  items: "collection.column.items",
  purpose: "collection.column.purpose",
  basis: "collection.column.basis",
  retention: "collection.column.retention",
}

export interface CollectionOptions {
  /** 문의 폼 보유 기간(@launch-factory/inquiry 의 retain 과 같은 값을 준다). 기본 30일 */
  inquiryRetention?: InquiryRetention
  /** 문의 폼이 동의 체크를 받는지(@launch-factory/inquiry 의 requireConsent) */
  inquiryConsent?: boolean
}

export function privacyCollections({ inquiryRetention = DEFAULT_INQUIRY_RETENTION, inquiryConsent = false }: CollectionOptions = {}): CollectionRow[] {
  if (inquiryRetention.kind === "days" && !(Number.isInteger(inquiryRetention.days) && inquiryRetention.days >= 1)) throw new Error("inquiryRetention.days must be a positive integer")
  return [
    {
      id: "inquiry",
      items: "collection.items.inquiry",
      purpose: "collection.purpose.inquiry",
      basis: inquiryConsent ? "collection.basis.consent" : "collection.basis.request",
      retention: inquiryRetention.kind === "dispute" ? { key: "collection.retention.dispute" } : { key: "collection.retention.days", vars: { days: inquiryRetention.days } },
      refuse: "collection.refuse",
    },
  ]
}
