"use client"

import type { ActionResult } from "@/components/contract/block-contract"
import { ResendVerification } from "@/components/product/resend-verification"
import { verifyEmailCopy as copy } from "@/content/copy.en"
import { isKoreanPortalMail } from "@/lib/verify-email"

// 이메일로 가입한 직후, 가입 화면의 완료 글 아래에 붙는 확인 메일 안내(UXOK). 방금 적은 주소를 그대로 보여 주고(가리지 않는다 — 본인이 방금 친 값이다),
// 메일이 안 왔을 때 다시 보내는 버튼을 둔다(ResendVerification — 결과는 같은 `role="status"` 글). 새로 가입한 사람은 이미 로그인돼 있어서(소프트 확인 — 로그인을 막지 않는다) 세션의 주소로 다시 보낸다.
// P1AB: A14 주소를 잘못 쳤으면 「Fix it」(계정 화면의 이메일 변경 폼) · A18 국내 포털 메일이면 스팸함·지연 안내를 더한다.
export function VerifyEmailNote({ email, again }: { email: string; again: () => Promise<ActionResult<{ sent: true }>> }) {
  return (
    <div role="status" data-testid="verify-email-note" className="mx-auto -mt-10 w-full max-w-6xl px-4 pb-16 md:-mt-16 md:px-8 md:pb-24">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-2 border px-4 py-4 md:px-6">
        <p className="font-heading text-[1.25rem] leading-[1.35]">{copy.title}</p>
        <p className="text-base leading-[1.7]">{copy.body.replace("{email}", email)}</p>
        {isKoreanPortalMail(email) ? (
          <p data-korean-portal="" className="text-base leading-[1.7]">
            {copy.koreanPortal}
          </p>
        ) : null}
        <ResendVerification live={false} again={again} copy={{ label: copy.resend, pending: copy.pending, sent: copy.sent, failed: copy.failed }} />
        <p className="text-base leading-[1.7]">
          {copy.wrongAddress.text}{" "}
          <a href={copy.wrongAddress.href} className="relative inline-flex min-h-11 items-center underline underline-offset-4">
            {copy.wrongAddress.label}
          </a>
        </p>
      </div>
    </div>
  )
}
