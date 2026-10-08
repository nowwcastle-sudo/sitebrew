"use client"

import "./globals.css"

import * as React from "react"

import { ErrorView } from "@/components/site/error-view"
import build from "@/lib/build.json"
import { cn } from "@/lib/utils"

// 루트 레이아웃 자체의 오류 경계(Next 16 global-error 규약) — 레이아웃을 대신하므로 자기 <html>·<body> 를 가진다. 사이트 CSS 는 다시 싣는다.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error)
  }, [error])
  const locale = (build as { locale?: string }).locale === "en" ? "en" : "ko"
  return (
    <html lang={locale} className={cn("antialiased", build.theme === "dark" && "dark")}>
      <body>
        <ErrorView digest={error.digest} reset={reset} />
      </body>
    </html>
  )
}
