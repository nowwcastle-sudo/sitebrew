"use client"
// 「Report a problem」 단추(D95). lib/launch/feedback.ts 의 스위치가 꺼져 있으면(기본) 레이아웃이 이 컴포넌트를 그리지 않는다.
// Sentry 피드백이 이 단추에 붙는다 — 오류 수집이 꺼져 있으면(DSN 없음·mock) 피드백 연동이 없어 단추도 그리지 않는다.
// 브라우저 Sentry 는 페이지가 열린 뒤에 받아진다(lib/sentry-lazy.ts) — 받아질 때까지 단추는 숨겨 둔다.
import { sentryLoaded } from "@/lib/sentry-lazy"
import { useEffect, useRef, useState } from "react"

export function ReportProblem({ label = "Report a problem" }: { label?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    let detach: (() => void) | undefined
    void sentryLoaded().then((sentry) => {
      const feedback = sentry?.getFeedback()
      if (cancelled || !feedback || !ref.current) return
      detach = feedback.attachTo(ref.current)
      setReady(true)
    })
    return () => {
      cancelled = true
      detach?.()
      setReady(false)
    }
  }, [])
  return (
    <button ref={ref} type="button" hidden={!ready} className="inline-flex min-h-11 min-w-11 items-center text-base underline-offset-4 hover:underline">
      {label}
    </button>
  )
}
