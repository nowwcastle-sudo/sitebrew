// launch-factory: 한국 알림(Solapi) 설정 — 제품이 고치는 데이터. 처음에만 쓰고 그 뒤에는 덮지 않는다(OWNED).
// 알림톡 템플릿 id(alimtalkId)는 Solapi 콘솔에서 카카오 심사를 통과한 뒤에 여기 적는다. 안 적으면 문자(SMS/LMS)로만 나간다.
// 알림톡은 안내(정보성) 전용이다 — 예약 확정·취소·알림 문구에 광고 문구를 섞지 않는다.
import { DEFAULT_BOOKING_TEMPLATES, type NotifyTemplates } from "@launch-factory/notify-kr"

export const NOTIFY_TEMPLATES: NotifyTemplates = {
  ...DEFAULT_BOOKING_TEMPLATES,
  // 심사를 통과한 뒤: bookingConfirmed: { ...DEFAULT_BOOKING_TEMPLATES.bookingConfirmed, alimtalkId: "KA01TP…" },
}

/**
 * 광고성 문자 끝에 붙는 무료수신거부 번호(예: "080-123-4567"). 없으면 광고성 문자는 모두 보내지 않는다.
 * 이 항목은 안내성 알림만 보낸다 — 광고성 문자를 보내려면 제품이 번호와 동의 흐름(feature-consents)을 갖춘 뒤 notifyKr().send({ purpose: "marketing" }) 를 부른다.
 */
export const MARKETING_OPT_OUT_NUMBER: string | undefined = undefined
