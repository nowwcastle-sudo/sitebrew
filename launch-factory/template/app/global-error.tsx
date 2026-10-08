"use client"

import "./globals.css"
import { useEffect } from "react"
import { ErrorView, PlainHeader } from "@/components/product/error-screen"
import { reportClientError } from "@/lib/sentry-lazy"

// 루트 레이아웃 자체가 무너졌을 때(H01). 레이아웃이 없으니 <html>·<body> 를 직접 그린다. 레이아웃이 읽는 환경 검사(env)가 실패한 경우도 여기로 온다.
// nonce 를 읽을 수 없으므로(headers() 는 레이아웃 몫) 인라인 스크립트·스타일 없이 클래스와 링크만 쓴다 — Next 가 자기 스크립트에 nonce 를 붙인다.
// 오류 수집(LFOBS): Sentry 공식 안내의 global-error.tsx 와 같이 오류를 보낸다 — 늦게 받는 SDK 에 맞춰 reportClientError 로 부른다(lib/sentry-lazy.ts. Sentry 가 꺼져 있으면 아무 일도 하지 않는다).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error)
  }, [error])
  return (
    <html lang="en">
      <body>
        <PlainHeader />
        <ErrorView kind="fatal" digest={error.digest} onRetry={reset} />
      </body>
    </html>
  )
}
