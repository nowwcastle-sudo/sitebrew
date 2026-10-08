"use server"
// launch-factory: 동의 서버 액션. 로그인한 사용자 자신의 동의에만 작용한다(세션에서 읽는다 — 사용자 id 를 입력으로 받지 않는다).
// 입력 모양 검사는 포트가 한다: 채널 이름(email·sms·kakao·push)과 boolean 만 받고, 그 밖의 칸은 fieldErrors 로 돌려준다.
// 수신 동의 변경은 사람의 확인 입력(`confirmed: true`) 없이는 실행하지 않는다(LFAX M03) — 없으면 DB·알림 메일을 건드리지 않고 confirmation_required.
import { confirmedNotifyActions, type Confirmed } from "@launch-factory/consent"
import { signInRequiredResult } from "@launch-factory/security/action"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { myConsentHistory, notifyPort } from "@/lib/launch/consents"

export async function getMarketingConsents() {
  return (await notifyPort()).consents()
}

/** 예: setMarketingConsents({ email: true, confirmed: true }) — 준 채널만 바뀌고 바뀐 것마다 이력이 한 줄 남는다 */
export async function setMarketingConsents(input: Parameters<Awaited<ReturnType<typeof notifyPort>>["setConsents"]>[0]) {
  // 타입은 블록 props 모양(확인 칸 선택) — 확인 칸 검사는 런타임(confirmedNotifyActions)이 한다
  return confirmedNotifyActions(await notifyPort(), { locale: DEFAULT_LOCALE }).setConsents(input as Confirmed<typeof input>)
}

/** 본인 동의 이력(가입 동의 포함) */
export async function getMyConsentHistory() {
  const history = await myConsentHistory()
  return history ? { ok: true as const, data: history } : signInRequiredResult(DEFAULT_LOCALE)
}
