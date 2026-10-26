// 문의 폼의 보내기·전화·카카오 채널 — 소개형 전달물용(deliver-intro.mjs 가 lib/contact.ts 자리에 넣는다). 전화(tel:)·카카오 채널은 서버 없이 되는 정적 어댑터 그대로이고,
// 보내기만 같은 사이트의 /api/inquiry(가짜 접수 — app/api/inquiry/route.ts)로 간다. 정적 내보내기 빌드(NEXT_PUBLIC_WF_STATIC=1 — next.config.ts·단일 HTML 내보내기가 켠다)에는
// 서버가 없으므로 메일 앱 열기(mailto)로 간다. 이 값은 빌드 때 정해진다. 값(메일·전화·채널 주소)은 content/site.json 에서 읽는다(J9).
// 실제 서버 접수(launch-factory)를 붙일 때 이 파일 하나를 바꾼다. 포트는 함수라 서버 컴포넌트에서 넘길 수 없다 — 클라이언트 잎에서 만든다.
import { kakaoChannelSubmit, mailtoSubmit, telLink } from "@/components/contract/adapter-static"
import { NEEDS_CHECK_LITERALS } from "@/components/content/content-core"
import copy from "@/lib/inquiry-copy.json" // 새 문장은 deliver-copy.json 의 inquiryRuntime 사본이다(전달 때 deliver-intro 가 쓴다)
import { contentAt, locale } from "@/lib/site"

type Input = Record<string, string>

const usable = (v: unknown): v is string => typeof v === "string" && v.trim() !== "" && !(NEEDS_CHECK_LITERALS as readonly string[]).includes(v.trim())
const text = (input: Input) => Object.entries(input).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n")
const unavailable = () =>
  Promise.resolve({ ok: false as const, formError: copy.noOwner[locale] })

/** 같은 사이트의 /api/inquiry 로 JSON 을 보낸다. 포트는 거부(reject)하지 않는다 — 블록은 ActionResult 만 기다린다. */
const postSubmit = (subject: string) => async (input: Input) => {
  try {
    const res = await fetch("/api/inquiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, ...input }) })
    const data = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; formError?: string; retryable?: boolean } | null
    if (res.ok && data?.ok) return { ok: true as const, data: { id: data.id, message: copy.received[locale] } }
    return { ok: false as const, formError: data?.formError ?? copy.failed[locale], retryable: data?.retryable ?? res.status >= 500 }
  } catch {
    return { ok: false as const, formError: copy.failed[locale], retryable: true }
  }
}

// 빌드 때 정해진다(process.env.NEXT_PUBLIC_* 는 번들에 박힌다) — 실행 때 바꿀 수 없다.
const staticBuild = process.env.NEXT_PUBLIC_WF_STATIC === "1"

/** 문의 폼에 끼우는 포트: submit(/api/inquiry · 정적 빌드는 메일 앱 열기) · call(전화 링크 — 전화가 있을 때) · kakao(채널 — 카카오 채널이 있을 때). */
export function makeContactPorts(subjectOverride?: { ko: string; en: string }) {
  // 메일 자리는 원형마다 다르다 — 사업체 정보(business.email: commerce·detail·local·saas)가 쓸 수 있는 값이면 그것, 아니면 연락처(contact.email: portfolio)다.
  // 둘 다 없거나 「확인 필요」면 보내기는 안내 오류로 답한다.
  const email = [contentAt("business.email"), contentAt("contact.email")].find(usable)
  const phone = contentAt("business.phone")
  const channels = [contentAt("booking.primary"), ...(((contentAt("booking.secondary") as unknown[]) ?? []))] as { kind?: string; value?: string }[]
  const kakaoUrl = channels.find((c) => c?.kind === "kakao")?.value
  const subject = subjectOverride ? subjectOverride[locale] : copy.formSubject[locale]
  let submit: (input: Input) => Promise<unknown> = unavailable
  if (usable(email)) {
    if (staticBuild) {
      try { submit = mailtoSubmit<Input>(email, () => subject, { body: text }) } catch { submit = unavailable }
    } else submit = postSubmit(subject)
  }
  let kakao
  if (usable(kakaoUrl)) {
    try { kakao = kakaoChannelSubmit<Input>(kakaoUrl, text) } catch { kakao = undefined }
  }
  return { submit: submit as ReturnType<typeof mailtoSubmit<Input>>, kakao, call: usable(phone) ? telLink(phone) : undefined }
}

/** 신청 폼(lead-capture)에 끼우는 포트: submit 하나 — 문의 폼과 같은 보내기로 입력(이메일·동의)을 글로 옮긴다. 서버 접수(launch-factory)를 붙일 때 이 함수를 바꾼다. */
export function makeLeadPorts() {
  const { submit } = makeContactPorts(copy.leadSubject)
  return { submit: (input: Record<string, unknown>) => submit(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v)]))) }
}
