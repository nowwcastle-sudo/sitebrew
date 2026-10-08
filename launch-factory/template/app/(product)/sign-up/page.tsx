import { methods, sendVerificationEmail, signUp } from "@/app/actions/product"
import { AlreadySignedIn } from "@/components/product/already-signed-in"
import { SignUpBlock } from "@/components/product/product-blocks"
import { planParam } from "@/lib/plan-param"
import { currentSession } from "@/lib/session-server"
import { turnstileSiteKey } from "@/lib/site-keys"

export const metadata = { title: "Create an account" }

// 봇 확인 위젯의 공개 사이트 키는 서버가 읽어 넘긴다(live 에서만 있다 — mock 은 위젯 없이 서버가 통과시킨다)
// 이미 로그인한 사람에게는 폼 대신 안내를 보인다(B02)
// E01: 요금표에서 요금제를 골라 왔으면(`?plan=`) 가입을 마친 화면의 다음 행동이 그 요금제의 결제 화면이다
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const s = await currentSession()
  if (s) return <AlreadySignedIn email={s.email} />
  return <SignUpBlock methods={methods} signUp={signUp} turnstileSiteKey={turnstileSiteKey()} sendAgain={sendVerificationEmail} plan={planParam((await searchParams).plan)} />
}
