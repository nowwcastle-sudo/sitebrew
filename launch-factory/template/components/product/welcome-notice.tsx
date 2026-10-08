"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import type { ActionResult } from "@/components/contract/block-contract"
import { ResendVerification } from "@/components/product/resend-verification"
import { welcomeCopy } from "@/content/copy.en"
import { verifyBannerCopy } from "@/content/copy.ux.en"
import { welcomeKind, welcomeView, withoutWelcome, type WelcomeKind } from "@/lib/welcome"

// 가입·로그인에 성공해 도착한 화면의 한 번짜리 안내(UXOK). 사라지는 토스트가 아니라 화면에 남는 글(`role="status"`)이다 — 읽는 사람이 「됐다」를 놓치지 않게
// (마케팅 사이트 관문 conv-confirmation 과 같은 뜻: 완료는 글로 말하고 다음 행동 하나를 준다).
//   표지: 주소의 `?welcome=signup|signin|verified|signedout`(lib/welcome.ts). 서버가 처음 그릴 때부터 글이 있고(자바스크립트가 없어도 보인다), 붙은 뒤 주소에서 표지를 지운다 →
//   새로고침하면 다시 뜨지 않는다. 다른 쪽으로 옮기면(레이아웃은 그대로 남는다) 사라진다.
//   표지를 다는 곳: 소셜 가입·로그인은 product-blocks.tsx 가 redirectTo 로(WELCOME_HREF), 확인 메일 링크는 lib/launch/auth.ts 의 EMAIL_VERIFIED_PATH 가 callbackURL 로 단다.
//   이메일 가입·로그인은 제 화면 안에서 끝나는 완료 글이 있어(블록) 표지를 달지 않는다.
export function WelcomeNotice({ signedIn = true, emailVerified, again }: { signedIn?: boolean; emailVerified?: boolean; again?: () => Promise<ActionResult<{ sent: true }>> }) {
  const params = useSearchParams()
  const pathname = usePathname()
  const [shown, setShown] = React.useState<{ kind: WelcomeKind; path: string } | null>(() => {
    const kind = welcomeKind(params)
    return kind ? { kind, path: pathname } : null
  })
  const head = React.useRef<HTMLHeadingElement>(null)
  // 표지를 처음 본 순간: 글을 붙들고 주소에서 표지를 지운다(history.replaceState — Next 가 이 변경을 따라간다)
  React.useEffect(() => {
    const kind = welcomeKind(params)
    if (!kind) return
    setShown({ kind, path: pathname })
    window.history.replaceState(window.history.state, "", withoutWelcome(window.location.href, kind))
  }, [params, pathname])
  // 다른 쪽으로 옮기면 사라진다
  React.useEffect(() => {
    if (shown && shown.path !== pathname) setShown(null)
  }, [pathname, shown])
  const visible = shown?.kind
  React.useEffect(() => {
    if (visible) head.current?.focus()
  }, [visible])
  if (!shown) return null
  // A08: 확인 링크를 로그인 안 된 기기로 열었으면 다음 행동은 「요금 보기」가 아니라 「로그인」(로그인하면 계정으로 돌아온다)
  // 어느 문구인가는 welcomeView 가 정한다(A10·A09): 틀린·만료된 링크는 로그인한 사람에게 「새 확인 메일 받기」 단추(확인 안 됨) 또는 「이미 확인됐어요」(옛 링크를 다시 연 경우)를 준다. A08 의 로그아웃 처리도 같은 표다
  const view = welcomeView(shown.kind, { signedIn, emailVerified })
  const c = welcomeCopy[view.copy]
  const failed = shown.kind === "failed" || shown.kind === "expired"
  return (
    <section
      role={failed && view.copy !== "alreadyVerified" ? "alert" : "status"}
      data-welcome={shown.kind}
      data-welcome-copy={view.copy}
      aria-labelledby="welcome-notice-title"
      className="mx-auto mb-8 flex w-full max-w-2xl flex-col items-start gap-3 border px-4 py-5 md:px-6"
    >
      <h2 id="welcome-notice-title" ref={head} tabIndex={-1} className="font-heading text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
        {c.title}
      </h2>
      <p className="text-base leading-[1.7]">{c.body}</p>
      {view.resend && again ? <ResendVerification look="button" again={again} copy={verifyBannerCopy.resend} /> : null}
      <Link href={c.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
        {c.label}
      </Link>
    </section>
  )
}
