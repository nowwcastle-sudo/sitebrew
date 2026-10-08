import { submitInquiry } from "@/app/actions/inquiry"
import { session } from "@/app/actions/product"
import { ContactForm } from "@/components/product/contact-form"
import { contactCopy as copy } from "@/content/copy.ux.en"
import { inquiryEnabled } from "@/lib/launch/inquiry"
import { SUPPORT } from "@/lib/launch/support"
import { turnstileSiteKey } from "@/lib/site-keys"

export const metadata = { title: "Contact us" }

// 문의 쪽(K05·G01·K06·K10). 사람에게 닿는 길이다: 폼 → 접수 번호(화면·메일) → 첫 응답 약속(제품 설정 lib/launch/support.ts). 로그인했으면 계정 이메일을 미리 채운다.
// 로그인이 없어도 쓴다(공개 쪽) — 로그인 못 하는 사람이 가장 문의가 필요하다(C08). 봇 확인 위젯의 공개 사이트 키는 서버가 읽어 넘긴다(live 에서만 있다).
// 운영자 메일(INQUIRY_OWNER_EMAIL)이 없으면 문의 창구만 꺼진다(운영자 결정 2026-10-05): 폼·접수 약속 대신 안내 한 줄을 그리고, 서버 액션도 접수하지 않는다.
// data-inquiry 표지는 배포 확인(scripts/deploy-preview/ci.mjs verify)이 읽는다 — disabled 면 경고를 낸다(200 검사는 그대로).
export default async function ContactPage() {
  const enabled = inquiryEnabled()
  const s = enabled ? await session().catch(() => null) : null
  const email = s?.ok && s.data ? s.data.email : undefined
  return (
    <div data-inquiry={enabled ? "enabled" : "disabled"} className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <h1 id="contact-title" className="font-heading text-2xl">
        {copy.title}
      </h1>
      {enabled ? (
        <ContactIntro email={email} />
      ) : (
        <p data-testid="contact-unavailable" className="text-base leading-[1.7]">
          {copy.unavailable}
        </p>
      )}
      {enabled ? <ContactForm submit={submitInquiry} turnstileSiteKey={turnstileSiteKey()} defaultContact={email} receiptEmail={SUPPORT.receipt} /> : null}
      {SUPPORT.email ? (
        <p data-testid="contact-direct" className="text-base leading-[1.7]">
          {copy.direct.label}{" "}
          <a href={`mailto:${SUPPORT.email}`} className="underline underline-offset-4">
            {SUPPORT.email}
          </a>
          . {copy.direct.note}
        </p>
      ) : null}
    </div>
  )
}

function ContactIntro({ email }: { email: string | undefined }) {
  return (
    <div className="flex flex-col gap-2 text-base leading-[1.7]">
      <p>{copy.lead}</p>
      {SUPPORT.responseTime ? (
        <p data-testid="contact-response" className="font-heading">
          {copy.response.replace("{responseTime}", SUPPORT.responseTime)}
        </p>
      ) : null}
      <p>{copy.numberNote}</p>
      {email ? <p>{copy.signedIn}</p> : null}
    </div>
  )
}
