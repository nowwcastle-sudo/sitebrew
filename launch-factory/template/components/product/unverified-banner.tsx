"use client"

import { usePathname } from "next/navigation"

import type { ActionResult } from "@/components/contract/block-contract"
import { ResendVerification } from "@/components/product/resend-verification"
import { verifyEmailCopy } from "@/content/copy.en"
import { verifyBannerCopy as copy } from "@/content/copy.ux.en"
import { isKoreanPortalMail, showVerifyBanner } from "@/lib/verify-email"

// 이메일을 아직 확인하지 않은 로그인 사용자에게 모든 제품 쪽 위에 붙는 띠(A11 — 운영자 결정 2026-10-07: 결제를 막지 않고 배너 + 결제 직전 주소 표시).
// 한 곳에 ① 어느 주소로 보냈는지 ② 다시 보내기(A10 — 로그인한 뒤에도 재전송 자리) ③ 주소가 틀렸을 때 고치는 길(A14) ④ 국내 포털 메일이면 스팸함·지연 안내(A18)가 있다.
// 서버(product-shell.tsx)가 `emailVerified === false` 일 때만 그린다 — 확인을 마쳤거나 확인할 수 없는 주소(카카오 대체 주소)는 띠가 없다. 확인 쪽(/verify-email)에서는 숨긴다.
// 띠는 `role="status"` 가 아니다: 쪽을 옮길 때마다 읽히면 소음이다. 글만 있는 구획(region)이다.
export function UnverifiedBanner({ email, again }: { email: string; again: () => Promise<ActionResult<{ sent: true }>> }) {
  const pathname = usePathname()
  if (!showVerifyBanner(false, pathname)) return null
  return (
    <section data-verify-banner="" aria-label={copy.label} className="border-b bg-muted/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-6 py-3">
        <p className="text-base leading-[1.6]">
          <strong className="font-heading">{copy.title}.</strong> {copy.body.replace("{email}", email)}
        </p>
        {isKoreanPortalMail(email) ? (
          <p data-korean-portal="" className="text-base leading-[1.6]">
            {verifyEmailCopy.koreanPortal}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <ResendVerification again={again} copy={copy.resend} />
          <p className="text-base leading-[1.6]">
            {copy.wrongAddress.text}{" "}
            <a href={copy.wrongAddress.href} className="relative inline-flex min-h-11 items-center underline underline-offset-4">
              {copy.wrongAddress.label}
            </a>
          </p>
          <a href={copy.help.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
            {copy.help.label}
          </a>
        </div>
      </div>
    </section>
  )
}
