"use client"

import * as React from "react"

// 폼을 가진 블록을 감싸 폼마다 멱등 키(idempotencyKey)를 숨은 입력으로 더한다(계약 판 2 Task 10d — 키는 블록이 아니라 조립하는 쪽이 만든다).
// 키는 폼이 열릴 때 한 번 만들고 같은 폼에는 다시 만들지 않는다 — 시간 초과 뒤 [다시 시도]가 같은 요청으로 묶여 중복 처리되지 않는다.
// 래퍼는 style 속성이 아니라 클래스(contents)로 감춘다 — 서버가 그린 style 속성은 엄격 CSP(style-src)가 막는다(대장 D14).
// 블록의 폼은 FormData 를 통째로 읽으므로 숨은 입력이 서버 액션까지 간다. 폼을 나중에 그리는 블록도 잡도록 MutationObserver 로 지켜본다.
export function FormKeys({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const root = ref.current
    if (!root) return
    const add = () => {
      for (const form of root.querySelectorAll("form")) {
        if (form.querySelector('input[name="idempotencyKey"]')) continue
        const input = document.createElement("input")
        input.type = "hidden"
        input.name = "idempotencyKey"
        input.value = crypto.randomUUID()
        form.append(input)
      }
    }
    add()
    const observer = new MutationObserver(add)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  )
}
