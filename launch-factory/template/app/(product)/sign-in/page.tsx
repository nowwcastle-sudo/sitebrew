import { methods, signIn } from "@/app/actions/product"
import { AlreadySignedIn } from "@/components/product/already-signed-in"
import { SignInBlock } from "@/components/product/product-blocks"
import { SocialErrorNotice } from "@/components/product/social-error"
import { safeNext } from "@/lib/auth-next"
import { currentSession } from "@/lib/session-server"

export const metadata = { title: "Sign in" }

// 소셜 로그인이 실패하면 Better Auth 가 ?error=<코드> 를 붙여 이 화면으로 돌려보낸다(lib/launch/auth.ts 의 SOCIAL_ERROR_PATH)
// ?next=<경로>: 로그인이 필요한 쪽이 보낸 「돌아올 곳」(B04). 같은 출처의 상대 경로만 받는다(lib/auth-next.ts).
// 이미 로그인한 사람에게는 폼 대신 안내를 보인다(B02).
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string | string[]; next?: string | string[] }> }) {
  const { error, next } = await searchParams
  const target = safeNext(next)
  const s = await currentSession()
  if (s) return <AlreadySignedIn email={s.email} next={target} />
  return (
    <>
      <SocialErrorNotice code={error} />
      <SignInBlock methods={methods} signIn={signIn} next={target ?? undefined} />
    </>
  )
}
