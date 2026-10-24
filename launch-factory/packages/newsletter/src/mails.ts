// 뉴스레터가 보내는 메일 세 통의 요청을 만든다(순수 — 보내지도, 저장하지도 않는다). 템플릿은 @launch-factory/email 이 갖고, 여기는 어떤 입력을 어떤 멱등 키로 싣는지만 정한다.
//   • 구독 확인 — 신청한 사람에게. 링크를 누르기 전에는 구독이 아니다(이중 동의).
//   • 구독 완료 안내 — 확인 직후. 정보통신망법 제50조제7항의 처리 결과 통지(전송자 명칭·동의한 날·결과)를 겸하고 수신거부 링크를 단다.
//   • 수신거부 처리 결과 통지 — 철회한 직후. 광고성 정보 수신 의사 처리 통지 템플릿(marketingConsentNotice)을 문구만 바꿔 쓴다.
// 멱등 키에는 보낸 시각(밀리초)을 넣는다: 같은 사람이 다시 신청해 새 확인 메일이 가야 할 때 공급자의 중복 제거에 먹히지 않게.
import type { SendRequest } from "@launch-factory/email"
import { t, type Locale } from "@launch-factory/i18n"
import { CONFIRM_VALID_DAYS } from "./tokens.ts"

/** 메일에 싣는 제품 쪽 설정(서비스가 한 번 정해 모든 메일에 같은 값을 쓴다) */
export interface MailIdentity {
  productName: string
  /** 전송자 명칭(안내 메일에만). 없으면 템플릿이 productName 을 쓴다 */
  senderName?: string
  timeZone?: string
}

const common = (id: MailIdentity, locale: Locale) => ({ locale, productName: id.productName, ...(id.timeZone ? { timeZone: id.timeZone } : {}) })

export function confirmMail(id: MailIdentity, o: { to: string; locale: Locale; subscriberId: string; at: Date; confirmUrl: string }): SendRequest<"newsletterConfirm"> {
  return {
    to: o.to,
    template: "newsletterConfirm",
    idempotencyKey: `newsletter-confirm:${o.subscriberId}:${o.at.getTime()}`,
    input: { ...common(id, o.locale), confirmUrl: o.confirmUrl, linkValidMinutes: CONFIRM_VALID_DAYS * 24 * 60 },
  }
}

export function welcomeMail(id: MailIdentity, o: { to: string; locale: Locale; subscriberId: string; consentAt: Date; unsubscribeUrl: string }): SendRequest<"newsletterWelcome"> {
  return {
    to: o.to,
    template: "newsletterWelcome",
    idempotencyKey: `newsletter-welcome:${o.subscriberId}:${o.consentAt.getTime()}`,
    input: { ...common(id, o.locale), consentAt: o.consentAt.toISOString(), ...(id.senderName ? { senderName: id.senderName } : {}), unsubscribeUrl: o.unsubscribeUrl },
  }
}

export function unsubscribeNoticeMail(id: MailIdentity, o: { to: string; locale: Locale; subscriberId: string; at: Date }): SendRequest<"marketingConsentNotice"> {
  return {
    to: o.to,
    template: "marketingConsentNotice",
    idempotencyKey: `newsletter-unsubscribe:${o.subscriberId}:${o.at.getTime()}`,
    input: {
      ...common(id, o.locale),
      changes: [{ channel: "email", granted: false }],
      changedAt: o.at.toISOString(),
      ...(id.senderName ? { senderName: id.senderName } : {}),
      // 구독자에게는 계정 설정이 없다 — 다시 받는 방법을 사이트의 신청으로 안내한다
      copy: { manageNote: t(o.locale, "newsletter.unsubscribedNote") },
    },
  }
}
