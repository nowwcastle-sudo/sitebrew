"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { ReadErrorProvider } from "@/components/blocks/_shared/port-read"
import { signInHref } from "@/lib/auth-next"

// 읽기 블록의 로그인 행동(B04 · web-factory v0.0.10 ReadErrorProvider). 로그아웃·만료 상태에서 블록이 읽기를 부르면 포트가 code `signInRequired` 로 끝나고,
// 아래 모든 읽기 블록의 오류 자리가 「Reload」(소용없다) 대신 로그인 링크를 보인다. 링크에는 지금 쪽을 `?next=` 로 싣는다(로그인 뒤 돌아온다 — lib/auth-next.ts 의 safeNext 가
// 같은 출처의 상대 경로만 받고 로그인·가입 쪽은 버린다). 서버가 세션을 보고 안내를 미리 그리는 쪽(components/product/sign-in-required.tsx)과 같은 글·같은 돌아올 곳이다.
// 쪽 위쪽에서 한 번만 정한다 — 블록마다 props 를 더하지 않는다(ProductShell 이 감싼다).
export function ReadErrorSignIn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const signIn = React.useMemo(
    () => ({ href: signInHref(pathname), label: "Sign in", title: "Sign in to continue", message: "Your session has ended or you are not signed in. Sign in to see this." }),
    [pathname],
  )
  return <ReadErrorProvider signIn={signIn}>{children}</ReadErrorProvider>
}
