"use client"

import * as React from "react"

import build from "@/lib/build.json"
import { ERROR_COPY, type SystemLocale } from "@/lib/system-copy"

// 500 경계(app/error.tsx·app/global-error.tsx)가 그리는 안내(P3-4 perf, C172) — 사이트 셸(SiteShell)은 서버 컴포넌트이고 내용이 site.json 이라
// 클라이언트 번들에 끌어오면 모든 쪽의 JS 가 커진다. 그래서 이름·로캘·테마는 lib/build.json(작다)에서 읽고, 색·글꼴은 레이아웃 토큰(bg-background 등)에서 받는다.
export function ErrorView({ digest, reset }: { digest?: string; reset: () => void }) {
  const t = ERROR_COPY[(build as { locale?: SystemLocale }).locale === "en" ? "en" : "ko"]
  const brand = (build as { brand?: string }).brand
  return (
    <main id="main" className="bg-background text-foreground mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center gap-4 px-4 py-16 md:px-8">
      {brand ? <p className="text-muted-foreground text-sm">{brand}</p> : null}
      <h1 className="font-heading text-3xl">{t.title}</h1>
      <p>{t.body}</p>
      {digest ? (
        <p className="text-muted-foreground text-sm">
          {t.code}: <code>{digest}</code>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={reset} className="border-border inline-flex min-h-11 items-center border px-4">
          {t.retry}
        </button>
        <a href="/" className="inline-flex min-h-11 items-center underline underline-offset-4">
          {t.home}
        </a>
      </div>
    </main>
  )
}
