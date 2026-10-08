// launch-factory: 메일 전송기. live 는 Resend(RESEND_API_KEY + 인증한 발신 도메인 EMAIL_FROM), mock 은 콘솔 출력이다.
// 서버 전용이다. 공개 서버 액션으로 열지 않는다 — 누구나 부르면 우리 도메인으로 아무에게나 메일을 보낼 수 있다.
// 광고성 메일(G03)의 전송자 표시(상호·이메일·전화·주소)는 제품 설정 LF_BUSINESS_NAME·LF_BUSINESS_EMAIL·LF_BUSINESS_PHONE·LF_BUSINESS_ADDRESS 에서 온다 —
// 값이 비면 광고성 메일은 보내지 않고 던진다(정보통신망법 시행령 별표 6). 거래 메일에는 영향이 없다.
import { createMailer, type Mailer } from "@launch-factory/email"
import { businessInfo } from "@launch-factory/env"
import { env, required } from "@/lib/launch/env"

let cached: Mailer | undefined

export function mailer(): Mailer {
  const b = businessInfo()
  const marketing = { business: { name: b.name, email: b.email, phone: b.phone, address: b.address } }
  return (cached ??= env().LF_MODE === "live" ? createMailer({ mode: "live", apiKey: required("RESEND_API_KEY"), from: required("EMAIL_FROM"), marketing }) : createMailer({ mode: "mock", marketing }))
}
