// 동의 통지 메일 다리(대장 D201). @launch-factory/consent 의 notifyAdapter `onChange` 에 넣어 수신동의·거부·철회 처리 결과를 메일로 알린다
// (정보통신망법 제50조제7항 · 시행령 제62조의2 — 의사를 표시한 날부터 14일 안에 전송자 명칭·의사 표시 사실과 날짜·처리 결과).
// consent 패키지를 불러오지 않는다 — 모양(채널·granted·시각)만 맞춘다. 보내기 실패는 던진다: 부르는 쪽(notifyAdapter)이 받아 onError 로만 알리고 설정 저장은 되돌리지 않는다.
import { base, must, type Recipient } from "./auth-emails.ts"
import type { Locale } from "./messages/index.ts"
import type { Mailer } from "./send.ts"
import type { MarketingNoticeChannel } from "./templates/marketing-consent-notice.ts"

/** 「계속 받기」 링크 유효 기간(일). consent 패키지의 RECONFIRM_KEEP_DAYS 와 같아야 한다(시험이 확인) */
export const RECONFIRM_LINK_VALID_DAYS = 60

export interface ConsentEmailsOptions {
  /** 전송자 명칭(기본으로 productName 을 쓴다) */
  productName: string
  senderName?: string
  /** 사용자 칸이 비었을 때 쓰는 언어 */
  defaultLocale: Locale
}

export function consentEmails(mailer: Mailer, o: ConsentEmailsOptions) {
  return {
    /** 2년 재확인 메일(A16). keepUrl·unsubscribeUrl 은 서명 링크다(consent 패키지가 만든다). idempotencyKey 로 같은 동의에는 한 통만 */
    marketingReconfirm: (to: string, input: { consentAt: Date; keepUrl: string; unsubscribeUrl: string; idempotencyKey?: string }, r?: Recipient) =>
      must(
        mailer.send({
          to,
          template: "marketingReconfirm",
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
          input: {
            ...base(r, o),
            ...(o.senderName ? { senderName: o.senderName } : {}),
            consentAt: input.consentAt.toISOString(),
            keepUrl: input.keepUrl,
            unsubscribeUrl: input.unsubscribeUrl,
            linkValidMinutes: RECONFIRM_LINK_VALID_DAYS * 24 * 60,
          },
        }),
        "marketingReconfirm",
      ),
    /** 채널별 처리 결과. changes 는 이번에 바뀐(또는 다시 표시한) 채널, at 은 의사를 표시한 때. idempotencyKey 는 발신함(D210)이 재시도마다 같은 값을 준다 — 공급자가 같은 통지를 한 통만 보낸다 */
    marketingResult: (to: string, input: { changes: { channel: MarketingNoticeChannel; granted: boolean }[]; at: Date; idempotencyKey?: string }, r?: Recipient) =>
      must(
        mailer.send({
          to,
          template: "marketingConsentNotice",
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
          input: { ...base(r, o), ...(o.senderName ? { senderName: o.senderName } : {}), changes: input.changes, changedAt: input.at.toISOString() },
        }),
        "marketingConsentNotice",
      ),
  }
}
