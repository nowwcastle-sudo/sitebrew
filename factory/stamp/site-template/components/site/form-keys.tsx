"use client"

import * as React from "react"

// 폼을 가진 블록을 감싸 폼마다 멱등 키(idempotencyKey)를 숨은 입력으로 더한다(P3-3 Task 9, 계약 판 2 Task 10d).
// 키는 블록이 만들지 않는다 — 폼을 여는(조립하는) 쪽이 한 번 만든다. 시간 초과 뒤 [다시 시도]가 같은 요청으로 묶여 중복 처리되지 않게 하려는 것이다.
// 폼이 열릴 때 한 번 만들고 같은 폼에는 다시 만들지 않는다(값은 폼이 사는 동안 그대로).
export function FormKeys({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const root = ref.current
    if (!root) return
    for (const form of root.querySelectorAll("form")) {
      if (form.querySelector('input[name="idempotencyKey"]')) continue
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = "idempotencyKey"
      input.value = crypto.randomUUID()
      form.append(input)
    }
  }, [])
  return (
    <div ref={ref} style={{ display: "contents" }}>
      {children}
    </div>
  )
}
