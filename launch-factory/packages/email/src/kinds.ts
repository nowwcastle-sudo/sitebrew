// 템플릿 종류 표(G07 — 정보성 메시지와 광고성 메시지의 분리). 모든 템플릿은 이 표 한 곳에서 「거래·법정 안내(transactional)」인지 「광고성(marketing)」인지 정한다.
// - transactional: 사용자가 한 일(가입·결제·재설정)이나 법이 알리라는 일(동의 처리 결과·2년 재확인·가격 변경)에 대한 안내. 광고 문구를 싣지 않는다 —
//   renderEmail 이 `promo` 칸이 있는 입력과 광고 블록 표지(data-lf-promo)가 있는 출력을 거절한다(시험이 모든 템플릿으로 확인한다).
// - marketing: 광고성 정보. 정보통신망법 제50조·시행령 별표 6 의 표시(제목 「(광고)」·전송자 명칭·이메일·전화·주소·한글·영문 수신거부 안내·로그인 없는 수신거부 링크)가 없으면 렌더하지 않는다(advertising.ts),
//   메일러는 수신거부 헤더(List-Unsubscribe·List-Unsubscribe-Post)를 달고, 사업자 정보·수신거부 링크가 없으면 보내지 않는다(send.ts).
//   보내는 쪽은 동의·재확인·야간 점검을 거쳐야 한다(@launch-factory/consent 의 canSendMarketing).
// 새 템플릿을 더하면 TemplateName 타입이 이 표에 항목을 요구한다(Record<TemplateName, …> 이라 빠지면 typecheck 가 실패한다).
import type { TemplateName } from "./render.ts"

export type TemplateKind = "transactional" | "marketing"

export interface TemplateMeta {
  kind: TemplateKind
  /** 사용자가 해야 할 한 가지 행동이 있는가. "one" 이면 눈에 띄는 단추가 정확히 하나다(보조 단추는 따로 허용) — G02 시험이 확인 */
  action: "one" | "none"
  /** 링크가 만료되는가: "duration" = 몇 분·몇 시간 동안, "deadline" = 정해진 날짜까지(가격 변경 동의). 만료되면 본문에 그 시간을 적는다 */
  expires?: "duration" | "deadline"
}

export const TEMPLATE_META: Record<TemplateName, TemplateMeta> = {
  welcome: { kind: "transactional", action: "one" },
  orderConfirmation: { kind: "transactional", action: "one" },
  shopOrderConfirmation: { kind: "transactional", action: "one" },
  priceChange: { kind: "transactional", action: "one", expires: "deadline" },
  cancellation: { kind: "transactional", action: "none" },
  paymentFailed: { kind: "transactional", action: "one" },
  inquiryNotice: { kind: "transactional", action: "one" },
  inquiryReceipt: { kind: "transactional", action: "none" },
  inquiryReply: { kind: "transactional", action: "none" },
  bookingConfirmation: { kind: "transactional", action: "none" },
  bookingCancellation: { kind: "transactional", action: "none" },
  bookingNotice: { kind: "transactional", action: "one" },
  verifyEmail: { kind: "transactional", action: "one", expires: "duration" },
  emailChangeConfirm: { kind: "transactional", action: "one", expires: "duration" },
  emailChanged: { kind: "transactional", action: "none" },
  accountDeletionRequested: { kind: "transactional", action: "one" },
  passwordReset: { kind: "transactional", action: "one", expires: "duration" },
  passwordChanged: { kind: "transactional", action: "none" },
  newDeviceSignIn: { kind: "transactional", action: "none" },
  marketingConsentNotice: { kind: "transactional", action: "none" },
  marketingReconfirm: { kind: "transactional", action: "one", expires: "duration" },
  marketingAnnouncement: { kind: "marketing", action: "one" },
  newsletterConfirm: { kind: "transactional", action: "one", expires: "duration" },
  newsletterWelcome: { kind: "transactional", action: "none" },
}

export const kindOf = (name: TemplateName): TemplateKind => TEMPLATE_META[name].kind
