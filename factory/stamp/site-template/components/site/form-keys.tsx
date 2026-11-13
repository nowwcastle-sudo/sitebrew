"use client"

import * as React from "react"

// 폼을 가진 블록을 감싸 폼마다 멱등 키(idempotencyKey)를 숨은 입력으로 더한다(P3-3 Task 9, 계약 판 2 Task 10d, WF-7).
// 키는 블록이 만들지 않는다 — 폼을 여는(조립하는) 쪽이 한 번 만든다. 블록(`_shared/port-form` 의 `run((key) => port({ …, ...key }))`)이 이 숨은 입력을 읽어 포트 입력의
// `idempotencyKey` 에 싣는다. 시간 초과 뒤 [다시 시도]가 같은 요청으로 묶여 중복 처리되지 않게 하려는 것이다(서버·공급자가 같은 키를 원자적으로 한 번만 실행한다).
// 폼이 열릴 때 한 번 만들고 같은 폼에는 다시 만들지 않는다(값은 폼이 사는 동안 그대로). 단계 폼처럼 나중에 그려지는 폼도 열릴 때 키를 받는다(MutationObserver).
// 예외 하나: 블록이 요청이 **성공**했다고 알리면(`wf:idempotency-spent` — 값은 `_shared/submit-guard IDEMPOTENCY_SPENT_EVENT` 와 같은 글자) 그 폼의 키를 새로 만든다 —
// 같은 폼이 다른 요청을 또 보낼 때(비밀번호 재설정 메일 다시 보내기 등) 앞 요청의 성공 결과를 되받지 않게 한다.
const FIELD = "idempotencyKey"
const SPENT = "wf:idempotency-spent"
const find = (form: Element) => form.querySelector<HTMLInputElement>(`input[name="${FIELD}"]`)

export function FormKeys({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const root = ref.current
    if (!root) return
    const add = () => {
      for (const form of root.querySelectorAll("form")) {
        if (find(form)) continue
        const input = document.createElement("input")
        input.type = "hidden"
        input.name = FIELD
        input.value = crypto.randomUUID()
        form.append(input)
      }
    }
    const onSpent = (e: Event) => {
      const form = e.target instanceof Element ? e.target.closest("form") : null
      const input = form ? find(form) : null
      if (input) input.value = crypto.randomUUID()
    }
    add()
    const watch = new MutationObserver(add)
    watch.observe(root, { childList: true, subtree: true })
    root.addEventListener(SPENT, onSpent)
    return () => {
      watch.disconnect()
      root.removeEventListener(SPENT, onSpent)
    }
  }, [])
  return (
    <div ref={ref} style={{ display: "contents" }}>
      {children}
    </div>
  )
}
