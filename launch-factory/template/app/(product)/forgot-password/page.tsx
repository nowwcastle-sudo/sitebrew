import { requestPasswordReset } from "@/app/actions/product"
import { AlreadySignedIn } from "@/components/product/already-signed-in"
import { PasswordResetBlock } from "@/components/product/product-blocks"
import { currentSession } from "@/lib/session-server"

export const metadata = { title: "Reset your password" }

// 이미 로그인한 사람에게는 폼 대신 안내를 보인다(B02) — 비밀번호를 바꾸려면 계정 화면에서 바꾼다
export default async function ForgotPasswordPage() {
  const s = await currentSession()
  if (s) return <AlreadySignedIn email={s.email} />
  return <PasswordResetBlock requestPasswordReset={requestPasswordReset} />
}
