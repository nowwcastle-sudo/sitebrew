import { NavAccountBar, type NavSession } from "@/components/blocks/nav/account-bar"
import { SiteShellSkipLink } from "@/components/ui/site-shell"
import { SessionSync } from "@/components/product/session-sync"
import { signOutFromHeader } from "@/app/actions/shell"
import { navCopy, skipLabel } from "@/content/copy.shell.en"
import { currentSession } from "@/lib/session-server"

// 제품 쪽의 첫 줄(LFADA · web-factory v0.0.10 P3-6 N10·J01): 건너뛰기 링크 → 세션 머리(블록 nav/account-bar).
// 서버 컴포넌트다 — 서버가 지금 세션을 읽어(currentSession: 한 요청에서 한 번) 첫 HTML 부터 맞는 머리를 낸다. 로그인한 사람의 머리에는 Sign in 이 없고 계정 메뉴(Account·Billing·Sign out)가 있다.
// 블록의 뿌리는 이미 `sticky top-0 z-30 bg-background`(+ data-sticky-nav)다 — 노치·상태줄 안쪽 여백(LFRUNFIX F1)만 className 으로 더한다.
// 로그아웃은 주 메뉴 밖의 POST 폼이다(링크가 아니다 — 미리 불러오기가 로그아웃시키지 않는다). 폼의 서버 액션은 app/actions/shell.ts. 로그인·가입·로그아웃 뒤에는 SessionSync 가 서버에게 다시 읽게 한다.
// ProductShell(제품·법정 쪽)과 404(app/not-found.tsx)가 같은 머리를 쓴다 — 건너뛰기 링크의 목적지는 쓰는 쪽이 `<main id="main" tabIndex={-1}>` 로 둔다.
export async function ProductHeader() {
  const s = await currentSession()
  const session: NavSession = s ? { status: "signed-in", name: s.name, email: s.email } : { status: "signed-out" }
  return (
    <>
      <SiteShellSkipLink locale="en" label={skipLabel} />
      <NavAccountBar copy={navCopy} session={session} signOutAction={signOutFromHeader} className="pt-[env(safe-area-inset-top)]" />
      <SessionSync />
    </>
  )
}
