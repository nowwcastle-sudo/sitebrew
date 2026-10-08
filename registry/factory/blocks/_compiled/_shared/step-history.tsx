"use client"

import * as React from "react"

// 여러 단계 폼의 브라우저 뒤로 가기(P3-2 Task 7a, 대장 A102 — WCAG 3.3.7 중복 입력 · KWCAG 7.3.4): 「다음」으로 단계가 바뀔 때마다 history 항목을 하나 쌓고,
// 뒤로 가기(popstate)가 오면 폼을 떠나지 않고 이전 단계로 간다. 값은 폼 칸(uncontrolled)과 부모 상태에 그대로 있어 돌아가도 남는다.
// 주소(URL)는 바꾸지 않는다 — 새로 고침하면 값이 사라지는데 주소에 단계만 남는 어긋남과, 한 쪽에 단계 폼이 둘일 때 쿼리가 겹치는 것을 피한다.
// 「이전」 버튼도 한 항목을 쌓는다(항목 수는 늘지만 뒤로 가기가 늘 직전 화면으로 간다).
// 순수 함수(stepFromState·stepState)는 시험이 부른다 — 훅은 그 위에 얇게 얹었다.
export const STEP_STATE_KEY = "wfStep"

export function stepState(id: string, step: number) {
  return { [STEP_STATE_KEY]: id, step }
}

/** popstate 의 history.state 가 이 폼(id)의 단계 항목이면 그 단계, 아니면(처음 항목·다른 폼) initial */
export function stepFromState(state: unknown, id: string, initial: number): number {
  const s = state as { [k: string]: unknown } | null
  return s && s[STEP_STATE_KEY] === id && typeof s.step === "number" ? s.step : initial
}

export function useStepHistory<T extends number>(id: string, initial: T) {
  const [step, setStep] = React.useState<T>(initial)
  React.useEffect(() => {
    const onPop = (e: PopStateEvent) => setStep(stepFromState(e.state, id, initial) as T)
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [id, initial])
  /** 단계를 옮긴다. push=false 면 history 를 쌓지 않는다(서버 오류가 앞 단계로 되돌릴 때 같은 자동 이동) */
  const go = React.useCallback(
    (to: T, push = true) => {
      if (push && to !== step) window.history.pushState(stepState(id, to), "")
      setStep(to)
    },
    [id, step],
  )
  return [step, go] as const
}
