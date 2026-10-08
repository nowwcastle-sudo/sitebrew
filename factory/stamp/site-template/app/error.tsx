"use client"

import * as React from "react"

import { ErrorView } from "@/components/site/error-view"

// 쪽 안에서 던져진 오류의 경계(Next 16 error 규약 — 클라이언트 컴포넌트). 루트 레이아웃 안에서 그려진다. 운영에서는 오류 메시지가 가려지고 digest 만 온다.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error)
  }, [error])
  return <ErrorView digest={error.digest} reset={reset} />
}
