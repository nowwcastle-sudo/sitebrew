// 블록이 스스로 만드는 글의 ko·en 문구 표(공유 조각 block-shared-block-labels — FV1 Task 5.14, 부품 `ui-src/locale-labels.tsx` 와 같은 방식).
// 블록 코드에는 한국어 글을 직접 쓰지 않는다(`blocks-i18n.test.mjs` 가 잡는다) — 블록의 화면 글은 `copy` 로 받고, 코드가 스스로 만드는 글은 여기서 읽는다:
//   · 한국 원화 단위(「원」)와 24시 표기 — 한국어 표기 경로에서만 쓰인다(영어는 통화 기호 표기가 따로 있다)
//   · 제작자용 점검 메시지(`guaranteeIssues`·`noticeIssues`·`policyIssues`·`kakaoTemplateIssues`) — 사이트 방문자에게 보이지 않는다
// ko 값은 예전 코드의 글자 그대로라 한국어 출력은 같다(시험이 기준 커밋 출력과 글자 단위로 대조한다). 로캘을 주지 않으면 ko 다.
export type BlockLocale = "ko" | "en"

type Labels = {
  won: string
  // 사진이 아직 없는 칸의 표지(content/cards 의 「실제 사진 필요」와 같은 글 — 상품 썸네일·3D 히어로 포스터)
  photoNeeded: string
  hours24: string
  // 보증 문구 검사(trust/guarantee-strip)
  guaranteeConditions: (n: number) => string
  guaranteeDays: string
  guaranteeText: string
  // 고시 표 검사(product-info)
  noticeCategory: string
  noticeRows: string
  noticeTwice: (label: string) => string
  noticeMissing: (label: string) => string
  noticePhone: (label: string, phone: string) => string
  // 배송·반품 정책 검사(shipping-returns)
  policyFee: string
  policyLead: string
  policyMethod: string
  policyFreeZero: string
  policyWithdrawal: string
  policyWithdrawalShort: (days: number, min: number) => string
  policyPayer: string
  policyRefund: string
  policyRefundLong: (days: number, max: number) => string
  policyExclusions: string
  // 카카오톡 공유 템플릿 검사
  shareTitle: string
  shareDescription: string
  shareImageHttps: string
  shareLinkHttps: string
  shareImageWidth: string
  shareImageRatio: string
}

export const BLOCK_LABELS: Record<BlockLocale, Labels> = {
  ko: {
    won: "원",
    photoNeeded: "실제 사진 필요",
    hours24: "24시",
    guaranteeConditions: (n) => `보증 조건이 ${n}개예요 — 2개 이하로 줄여 주세요`,
    guaranteeDays: "보증 기간은 청약철회 기간(7일)보다 짧을 수 없어요",
    guaranteeText: "보증 문구에 기간({days})을 적어 주세요",
    noticeCategory: "고시 품목이 비었어요",
    noticeRows: "고시 항목이 하나도 없어요",
    noticeTwice: (label) => `「${label}」 항목이 두 번이에요`,
    noticeMissing: (label) => `「${label}」 값이 없어요(확인 필요)`,
    noticePhone: (label, phone) => `「${label}」 전화번호를 읽지 못했어요: ${phone}`,
    policyFee: "배송비가 없어요(확인 필요)",
    policyLead: "출고 영업일이 없어요(확인 필요)",
    policyMethod: "배송 방법이 없어요(확인 필요)",
    policyFreeZero: "배송비가 0원인데 무료배송 기준이 있어요",
    policyWithdrawal: "청약철회 기간이 없어요(확인 필요)",
    policyWithdrawalShort: (days, min) => `청약철회 기간 ${days}일은 법정 ${min}일보다 짧아요(전자상거래법 제17조 제1항)`,
    policyPayer: "반품 배송비 부담 주체가 없어요(확인 필요)",
    policyRefund: "환불 영업일이 없어요(확인 필요)",
    policyRefundLong: (days, max) => `환불 ${days}영업일은 법정 ${max}영업일보다 길어요(전자상거래법 제18조 제2항)`,
    policyExclusions: "청약철회 불가 사유가 없어요(확인 필요)",
    shareTitle: "제목이 비었어요",
    shareDescription: "설명이 비었어요",
    shareImageHttps: "이미지는 https 절대 경로여야 해요",
    shareLinkHttps: "링크는 https 절대 경로여야 해요",
    shareImageWidth: "이미지 폭은 800px 이상이어야 해요",
    shareImageRatio: "이미지 가로:세로는 2:1~1.91:1 이어야 해요",
  },
  en: {
    won: " KRW",
    photoNeeded: "Real photo needed",
    hours24: "24:00",
    guaranteeConditions: (n) => `The guarantee has ${n} conditions — reduce them to 2 or fewer`,
    guaranteeDays: "The guarantee period cannot be shorter than the 7-day withdrawal period",
    guaranteeText: "Put the period ({days}) in the guarantee text",
    noticeCategory: "The notice category is empty",
    noticeRows: "The notice has no items",
    noticeTwice: (label) => `The item "${label}" appears twice`,
    noticeMissing: (label) => `The item "${label}" has no value (to be confirmed)`,
    noticePhone: (label, phone) => `Could not read the phone number of "${label}": ${phone}`,
    policyFee: "The shipping fee is missing (to be confirmed)",
    policyLead: "The business days until dispatch are missing (to be confirmed)",
    policyMethod: "The shipping method is missing (to be confirmed)",
    policyFreeZero: "The shipping fee is 0 but a free-shipping threshold is set",
    policyWithdrawal: "The withdrawal period is missing (to be confirmed)",
    policyWithdrawalShort: (days, min) => `A withdrawal period of ${days} days is shorter than the legal ${min} days`,
    policyPayer: "Who pays the return shipping is missing (to be confirmed)",
    policyRefund: "The refund business days are missing (to be confirmed)",
    policyRefundLong: (days, max) => `${days} business days to refund is longer than the legal ${max} business days`,
    policyExclusions: "The reasons a withdrawal is not allowed are missing (to be confirmed)",
    shareTitle: "The title is empty",
    shareDescription: "The description is empty",
    shareImageHttps: "The image must be an absolute https path",
    shareLinkHttps: "The link must be an absolute https path",
    shareImageWidth: "The image must be at least 800px wide",
    shareImageRatio: "The image aspect ratio must be between 2:1 and 1.91:1",
  },
}

/** 로캘의 문구 표 — "en" 이 아니면 ko(예전 코드의 글자 그대로). */
export const blockLabels = (locale?: string): Labels => BLOCK_LABELS[locale === "en" ? "en" : "ko"]
