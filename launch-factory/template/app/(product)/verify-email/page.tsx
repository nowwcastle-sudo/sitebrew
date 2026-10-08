import { session, sendVerificationEmail } from "@/app/actions/product"
import { VerifyEmailBlock } from "@/components/product/product-blocks"
import { verifyEmailCopy } from "@/content/copy.en"
import { verifyEmailPageCopy } from "@/content/copy.ux.en"
import { currentSession } from "@/lib/session-server"
import { isKoreanPortalMail } from "@/lib/verify-email"

export const metadata = { title: "Confirm your email", robots: { index: false, follow: false } }

// 이메일 확인 쪽(P1AB B2 — A10·A14·A18). 가입 직후 안내·위 배너·만료된 확인 링크 안내가 모두 여기로 이어진다: 보낸 주소를 보이고, 다시 보내고, 주소가 틀렸으면 고치는 길을 준다.
// 로그인 상태를 블록이 읽는다(확인 전 · 확인 후 · 로그아웃 세 모양). 서버가 세션을 한 번 읽어 국내 포털 메일이면 스팸함·지연 안내를 문구에 더한다(A18).
export default async function VerifyEmailPage() {
  const s = await currentSession()
  const copy = isKoreanPortalMail(s?.email) ? { ...verifyEmailPageCopy, spam: `${verifyEmailPageCopy.spam} ${verifyEmailCopy.koreanPortal}` } : verifyEmailPageCopy
  return <VerifyEmailBlock session={session} sendVerificationEmail={sendVerificationEmail} copy={copy} />
}
