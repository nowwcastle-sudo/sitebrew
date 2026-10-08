import { AccountArea } from "@/components/product/account-area"
import { SignInRequired } from "@/components/product/sign-in-required"
import { currentSession } from "@/lib/session-server"

export const metadata = { title: "Account" }

// 계정 화면(LFACCT · factory-rules.md §23 U7). 구획 틀은 components/product/account-area.tsx, 블록 이음은 components/product/account-blocks.tsx.
// 로그아웃·만료 상태면 구획 대신 로그인 안내(돌아올 곳 포함, B04 — 다른 보호된 쪽과 같다. LFRUNFIX F7)
export default async function AccountPage() {
  if (!(await currentSession())) return <SignInRequired next="/account" />
  return <AccountArea />
}
