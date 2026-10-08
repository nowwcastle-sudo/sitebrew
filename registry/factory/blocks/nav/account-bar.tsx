import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ChevronDown } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"
import { SiteShellNavList } from "@/registry/factory/ui/site-shell-nav"

// 제품 상단 내비 — 세션 prop 이 모양을 정한다(P3-6 N10·U1·J05): 왼쪽 워드마크(홈 링크) · 주 메뉴 링크 한 줄 · 오른쪽 세션 칸.
//   · 로그아웃 상태(session.status "signed-out"): [로그인] 링크 + [가입] 버튼 — 「Sign in」 이 로그인한 사람 머리에 남지 않는다.
//   · 로그인 상태("signed-in"): 계정 메뉴 하나(「계정」 — 계정·결제 같은 링크와 로그인한 사람 표시) + 안에 [로그아웃]. 로그아웃은 주 메뉴 링크와 떨어진
//     계정 메뉴 안의 POST 폼이다(링크로 두지 않는다 — 미리 불러오기·크롤러가 로그아웃시키지 않게). 계정 메뉴는 <details> 라 자바스크립트 없이도 열리고 닫힌다.
// **서버 컴포넌트다** — 세션을 서버가 읽어 session 으로 넘기면 첫 HTML 부터 맞는 머리가 나간다(로그인·가입·로그아웃 뒤 새로고침 없이 바뀌려면 쪽이 서버에서 다시 그려지면 된다 —
// 서버 액션 뒤 revalidate·redirect). 뿌리에 data-session 이 남아 관문·에이전트가 머리가 세션을 따르는지 글 해석 없이 잰다.
// 모든 폭에서 위에 붙고(data-sticky-nav), 누름 대상은 44px 이상이다. 등장 모션 없음 — 머리는 처음부터 누를 수 있어야 한다.
export type NavSession = { status: "signed-out" } | { status: "signed-in"; name?: string; email?: string }
export type NavAccountBarCopy = {
  brand: string
  // 주 메뉴 이름(aria-label)
  navLabel: string
  links: Cta[]
  signedOut: { signIn: Cta; signUp: Cta }
  signedIn: {
    // 계정 메뉴 단추 글(예: 「계정」)
    menuLabel: string
    // 계정 메뉴 안 링크(계정·결제 …)
    links: Cta[]
    // 「{who} 로 로그인했어요」 — {who} 자리에 이름(없으면 메일)을 넣는다. 로그인한 사람 정보가 없으면 그리지 않는다.
    signedInAs?: string
    signOutLabel: string
  }
}
export type NavAccountBarProps = BlockBase<NavAccountBarCopy> & {
  session: NavSession
  homeHref?: string
  currentHref?: string
  // 로그아웃 폼의 action(주소 또는 서버 액션). 없으면 로그아웃 단추를 그리지 않는다.
  signOutAction?: React.ComponentProps<"form">["action"]
}

export function NavAccountBar({ copy, session, id = "site-nav", className, homeHref = "/", currentHref, signOutAction }: NavAccountBarProps) {
  const signedIn = session.status === "signed-in"
  const who = signedIn ? (session.name || session.email || "") : ""
  return (
    <header id={id} data-block="nav-account-bar" data-sticky-nav="" data-session={session.status} className={cn("cn-block-nav-bar", className)}>
      <div className="cn-block-nav-inline-row">
        <a href={homeHref} className="cn-block-nav-brand font-heading [grid-area:brand]">
          {copy.brand}
        </a>
        <nav aria-label={copy.navLabel} className="cn-block-nav-inline-nav">
          <SiteShellNavList className="cn-block-nav-list cn-block-nav-wrap">
            {copy.links.map((l) => (
              <li key={l.href} className="shrink-0">
                <a href={l.href} aria-current={currentHref === l.href ? "page" : undefined} className="cn-block-nav-link">
                  {l.label}
                </a>
              </li>
            ))}
          </SiteShellNavList>
        </nav>
        <div data-slot="session" className="cn-block-nav-session">
          {signedIn ? (
            <details className="cn-block-nav-account">
              <summary className="cn-block-nav-account-button">
                {copy.signedIn.menuLabel}
                <ChevronDown aria-hidden="true" className="cn-block-nav-account-chevron" />
              </summary>
              <div className="cn-block-nav-account-panel">
                {who && copy.signedIn.signedInAs ? <p className="cn-block-nav-account-who">{copy.signedIn.signedInAs.replace("{who}", who)}</p> : null}
                {copy.signedIn.links.length ? (
                  <ul className="cn-block-nav-account-list">
                    {copy.signedIn.links.map((l) => (
                      <li key={l.href}>
                        <a href={l.href} aria-current={currentHref === l.href ? "page" : undefined} className="cn-block-nav-account-link">
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {signOutAction ? (
                  <form method="post" action={signOutAction} data-sign-out="" className="cn-block-nav-account-signout">
                    <button type="submit" className="cn-block-nav-account-link">
                      {copy.signedIn.signOutLabel}
                    </button>
                  </form>
                ) : null}
              </div>
            </details>
          ) : (
            <>
              <a href={copy.signedOut.signIn.href} className="cn-block-nav-link">
                {copy.signedOut.signIn.label}
              </a>
              <Button nativeButton={false} render={<a href={copy.signedOut.signUp.href} />}>
                {copy.signedOut.signUp.label}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
