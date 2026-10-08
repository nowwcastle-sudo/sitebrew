import { resetPassword } from "@/app/actions/product"
import { NewPasswordBlock } from "@/components/product/product-blocks"

export const metadata = { title: "Choose a new password" }

// 재설정 메일의 링크가 닿는 쪽: ?token=<토큰>(정상) 또는 ?error=INVALID_TOKEN(틀리거나 만료). 토큰은 블록이 서버 액션에 그대로 넘긴다.
// 틀린 링크(error 가 있거나 token 이 없음)면 token 을 비워 블록이 「링크가 열리지 않아요」 + 새 링크 받기를 보인다. 폼은 web-factory 새 비밀번호 블록의 한 칸 판이다
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[]; error?: string | string[] }> }) {
  const { token, error } = await searchParams
  return <NewPasswordBlock token={typeof token === "string" && typeof error !== "string" ? token : undefined} resetPassword={resetPassword} />
}
