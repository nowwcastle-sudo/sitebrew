// 문의 폼의 보내기·전화·카카오 채널(P3-3 Task 9b, C111) — 서버 없이 되는 정적 어댑터(adapter-static)를 끼운다: 메일 앱 열기(mailto)·tel: 링크·카카오톡 채널 1:1 채팅.
// 값(메일·전화·채널 주소)은 content/site.json 에서 읽는다(J9). 값이 없거나 「확인 필요」면 그 갈래는 만들지 않는다(보내기는 안내 오류로 답한다).
// 실제 서버 접수(launch-factory)를 붙일 때 이 파일 하나를 바꾼다. 포트는 함수라 서버 컴포넌트에서 넘길 수 없다 — 클라이언트 잎에서 만든다.
import { kakaoChannelSubmit, mailtoSubmit, telLink } from "@/components/contract/adapter-static"
import { NEEDS_CHECK_LITERALS } from "@/components/content/content-core"
import { contentAt, locale } from "@/lib/site"

type Input = Record<string, string>

const usable = (v: unknown): v is string => typeof v === "string" && v.trim() !== "" && !(NEEDS_CHECK_LITERALS as readonly string[]).includes(v.trim())
const text = (input: Input) => Object.entries(input).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")
const unavailable = () =>
  Promise.resolve({ ok: false as const, formError: locale === "ko" ? "받는 메일 주소를 확인하는 중이에요. 전화나 다른 채널로 문의해 주세요." : "The contact email is not confirmed yet. Please use another channel." })

/** 문의 폼에 끼우는 포트: submit(메일 앱 열기) · call(전화 링크 — 전화가 있을 때) · kakao(채널 — 카카오 채널이 있을 때). */
export function makeContactPorts(subjectOverride?: { ko: string; en: string }) {
  // 메일 자리는 원형마다 다르다 — 사업체 정보(business.email: commerce·detail·local·saas)가 쓸 수 있는 값이면 그것, 아니면 연락처(contact.email: portfolio)다.
  // (C355 — business 만 읽어 portfolio 문의 폼이 어디로도 가지 않았다. 둘 다 없거나 「확인 필요」면 보내기는 안내 오류로 답한다.)
  const email = [contentAt("business.email"), contentAt("contact.email")].find(usable)
  const phone = contentAt("business.phone")
  const channels = [contentAt("booking.primary"), ...(((contentAt("booking.secondary") as unknown[]) ?? []))] as { kind?: string; value?: string }[]
  const kakaoUrl = channels.find((c) => c?.kind === "kakao")?.value
  const subject = subjectOverride ? subjectOverride[locale] : locale === "ko" ? "홈페이지 문의" : "Website inquiry"
  let submit: (input: Input) => Promise<unknown> = unavailable
  if (usable(email)) {
    try { submit = mailtoSubmit<Input>(email, () => subject, { body: text }) } catch { submit = unavailable }
  }
  let kakao
  if (usable(kakaoUrl)) {
    try { kakao = kakaoChannelSubmit<Input>(kakaoUrl, text) } catch { kakao = undefined }
  }
  return { submit: submit as ReturnType<typeof mailtoSubmit<Input>>, kakao, call: usable(phone) ? telLink(phone) : undefined }
}

/** 신청 폼(lead-capture)에 끼우는 포트: submit 하나 — 문의 폼과 같은 정적 어댑터(메일 앱 열기)로 입력(이메일·동의)을 글로 옮긴다. 서버 접수(launch-factory)를 붙일 때 이 함수를 바꾼다. */
export function makeLeadPorts() {
  const { submit } = makeContactPorts({ ko: "신청", en: "Sign-up request" })
  return { submit: (input: Record<string, unknown>) => submit(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v)]))) }
}
