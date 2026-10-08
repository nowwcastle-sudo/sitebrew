"use client"

import * as React from "react"

// 소셜 실패 안내를 읽은 뒤(B05): ① 안내 상자로 포커스를 옮긴다(role="alert" 은 읽어 주기만 하고 키보드 위치는 옮기지 않는다)
// ② 주소의 ?error=·?error_description= 을 지운다(history.replaceState — 새로고침하거나 주소를 공유해도 같은 오류가 되살아나지 않는다. 이동은 일어나지 않는다).
export function SocialErrorEffects({ targetId }: { targetId: string }) {
  React.useEffect(() => {
    document.getElementById(targetId)?.focus({ preventScroll: false })
    const url = new URL(window.location.href)
    if (url.searchParams.has("error") || url.searchParams.has("error_description")) {
      url.searchParams.delete("error")
      url.searchParams.delete("error_description")
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
    }
  }, [targetId])
  return null
}
