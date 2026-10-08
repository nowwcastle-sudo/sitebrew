"use client"

import * as React from "react"

// 쿠키 설정 다시 열기(P3-6 K04·J07 — 공유 조각 block-shared-consent-open).
// 푸터 같은 곳의 「쿠키 설정」 링크는 서버 부품이라 상태를 못 쥔다 — 링크에 `data-consent-open` 만 달면(_shared/consent-open-attrs 의 consentOpenAttrs — "use client" 밖이라 서버 부품이 쓴다) 이 조각이 문서 클릭을 한 번 듣고,
// 그 쪽에 떠 있는 쿠키 블록(consent/bottom-banner·preference-dialog)이 등록해 둔 열기 함수 중 우선순위가 가장 높은 것을 부른다. 등록된 것이 없으면
// 가로채지 않는다 — 링크의 href(예: #cookie-settings·/privacy#cookies)가 그대로 동작하는 자바스크립트 없는 길이다.
// 열기 함수는 눌린 요소를 받는다(대화상자를 닫을 때 포커스를 그 링크로 돌려주려고 — Safari 는 링크 클릭에 포커스를 주지 않는다).
type Opener = { open: (from: Element) => void; priority: number }
const openers = new Set<Opener>()
let listening = false

function onClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const from = e.target instanceof Element ? e.target.closest("[data-consent-open]") : null
  if (!from || !openers.size) return
  const best = [...openers].reduce((a, b) => (b.priority > a.priority ? b : a))
  e.preventDefault()
  best.open(from)
}

/** 열기 함수 등록(priority 가 높은 것이 이긴다 — 대화상자가 있는 블록 3 · 대화상자를 품은 띠 2 · 띠만 1) */
export function useConsentOpener(open: (from: Element) => void, priority: number) {
  const ref = React.useRef(open)
  React.useEffect(() => {
    ref.current = open
  })
  React.useEffect(() => {
    const entry: Opener = { open: (from) => ref.current(from), priority }
    openers.add(entry)
    if (!listening) {
      document.addEventListener("click", onClick)
      listening = true
    }
    return () => {
      openers.delete(entry)
      if (!openers.size && listening) {
        document.removeEventListener("click", onClick)
        listening = false
      }
    }
  }, [priority])
}
