"use client"

import { useEffect } from "react"
import { ErrorView, PlainHeader } from "@/components/product/error-screen"
import { reportClientError } from "@/lib/sentry-lazy"

// 쪽 안에서 난 오류(H01). 루트 레이아웃은 살아 있으므로 그 안에 그려진다. digest 는 서버 로그와 맞는 번호라 문의 때 알려 주게 한다.
// 엄격 CSP 에 안전하다(error-screen.tsx 머리말) — Next 기본 오류 화면 대신 우리 것을 쓴다.
// 오류 수집(LFOBS): 화면을 그린 뒤 Sentry 로 보낸다. 브라우저 Sentry 는 페이지가 열린 뒤에 받아지므로(lib/sentry-lazy.ts) 아직이면 쌓아 두었다가 보낸다. Sentry 가 꺼져 있으면(DSN 없음) 아무 일도 하지 않는다.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error)
  }, [error])
  return (
    <>
      <PlainHeader />
      <ErrorView kind="error" digest={error.digest} onRetry={reset} />
    </>
  )
}
