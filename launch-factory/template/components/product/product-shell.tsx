import { Suspense } from "react"
import Link from "next/link"
import { sendVerificationEmail, session } from "@/app/actions/product"
import { DisplayPrefsProvider } from "@/components/product/display-prefs"
import { ProductFooter } from "@/components/product/product-footer"
import { ProductHeader } from "@/components/product/product-header"
import { ReadErrorSignIn } from "@/components/product/read-error-sign-in"
import { UnverifiedBanner } from "@/components/product/unverified-banner"
import { WelcomeNotice } from "@/components/product/welcome-notice"
import { errorCopy } from "@/content/copy.ux.en"
import { currentSession } from "@/lib/session-server"

// 제품 화면 공통 틀(v0 Task 10): 위 띠 + 본문 + 바닥글. 블록은 이 안의 main 에 들어간다.
// 제품 쪽 묶음(app/(product))과 법정 쪽 묶음(app/(legal))이 같은 틀을 쓴다(LFRUNFIX F2) — 법정 쪽에서도 위 띠로 제품에 돌아갈 수 있다.
// 위 띠·바닥글은 web-factory v0.0.10 의 블록이다(LFADA): 위 띠 = nav/account-bar(서버가 읽은 세션으로 로그인 상태를 그린다 — product-header.tsx), 바닥글 = footer/product-legal(사업자 정보는
// 제품 설정에서, 빈 칸은 숨김 · 약관·개인정보·환불·문의 링크 · 「쿠키 설정」 — product-footer.tsx). 건너뛰기 링크가 가리키는 `main#main`(tabIndex -1)은 여기서 둔다(J01).
// 표시 로캘·시간대(I01~I03)는 DisplayPrefsProvider 가 블록에 넘긴다 — 시간대는 사용자가 가입 때 저장한 값(없으면 제품 기본).
// 읽기 블록의 오류 자리는 ReadErrorSignIn 이 정한 로그인 링크를 받는다(B04) — 로그아웃·만료 상태에서 「Reload」가 아니라 로그인으로 가게.
// 틀은 `min-h-dvh` 세로 칸이고 main 이 남는 높이를 채운다(flex-1) — 짧은 쪽에서도 바닥글이 화면 맨 아래에 놓인다. 이유(2026-10-04 실측): 쿠키 띠(consent/bottom-banner)가 떠 있는 동안
// web-factory 의 bottom-bar-space 는 문서 끝의 빈 자리만큼 뺀 여백만 더하는데, 쪽이 화면보다 짧으면 여백이 더해져도 문서가 스크롤되지 않아 바닥글 끝이 띠 밑에 남는다(375px /sign-in — 화면 관문 F3 의 남은 쪽).
// 바닥글이 문서 맨 아래에 있으면 빈 자리가 0 이라 여백이 띠 높이만큼 정확히 더해지고 문서가 스크롤된다.
// 바닥글은 로그인 뒤에도 모든 화면에서 사람에게 닿는 길(문의)을 한 번에 둔다(K05·K10).
export async function ProductShell({ children, backLink = false }: { children: React.ReactNode; backLink?: boolean }) {
  const s = await currentSession()
  return (
    <DisplayPrefsProvider initialTimeZone={s?.timeZone ?? null} session={session}>
      <div className="flex min-h-dvh flex-col">
        <ProductHeader />
        {/* A11: 이메일을 확인하지 않은 로그인 사용자에게 모든 쪽 위의 띠 — 다시 보내기·주소 고치기. 결제는 막지 않는다(운영자 결정 2026-10-07). 값이 없는 주소(카카오 대체 주소)는 대상이 아니다 */}
        {s?.emailVerified === false && s.email ? <UnverifiedBanner email={s.email} again={sendVerificationEmail} /> : null}
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 focus:outline-none">
          {/* 가입·로그인·로그아웃에 성공해 도착한 화면의 한 번짜리 안내(UXOK) — 주소의 ?welcome= 표지를 읽는다. signedIn: 확인 링크를 로그인 안 된 기기로 열었는지(A08) */}
          <Suspense fallback={null}>
            <WelcomeNotice signedIn={!!s} emailVerified={s?.emailVerified} again={sendVerificationEmail} />
          </Suspense>
          {backLink ? (
            <Link href="/" className="mb-4 inline-flex min-h-11 items-center underline underline-offset-4">
              {errorCopy.notFound.home}
            </Link>
          ) : null}
          <ReadErrorSignIn>{children}</ReadErrorSignIn>
        </main>
        <ProductFooter />
      </div>
    </DisplayPrefsProvider>
  )
}
