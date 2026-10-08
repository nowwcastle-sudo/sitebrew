"use client"

import * as React from "react"
import Link from "next/link"

import { StateScreenErrorRetry } from "@/components/blocks/state-screen/error-retry"
import { errorScreenCopy } from "@/content/copy.shell.en"
import { errorCopy } from "@/content/copy.ux.en"
import { PRODUCT_NAME } from "@/content/copy.en"

// 오류 화면의 공통 몸(H01·H04). 화면 자체는 web-factory 블록 `state-screen/error-retry`(P3-6)다 — 이 파일은 Next 의 error.tsx·global-error.tsx 에 끼우는 얇은 껍데기다.
// 쪽이 무너져도 읽히도록 일부러 가볍다: 세션 조회·결제·인증 블록이 없다(오류를 낸 것이 그것들일 수 있다).
// 엄격 CSP 에 안전하다: 블록은 서버 HTML 에 style 속성을 쓰지 않고(web-factory 시험), 등장 연출은 CSSOM 으로만 스타일을 쓴다 — 마크업 속성이 아니라 막히지 않는다(대장 D14).
// 구조(factory-rules.md §23-5): 무엇이 잘못됐나 · 사용자 잘못이 아니라는 말 · 다음 행동 하나(다시 시도) · 다시 해도 소용없으면 지원 경로와 오류 번호.
// 오류 번호(digest)는 서버 로그와 맞는 값이다 — 없으면(브라우저에서 난 오류) 난 시각(UTC)을 적는다. `data-error-code` 는 기계가 읽는 갈래다(L04).

/** 쪽 틀이 없는 곳(오류·전역 오류)의 위 띠: 로그인 상태에 기대지 않는 길만 둔다 */
export function PlainHeader() {
  return (
    <header className="border-b">
      <nav aria-label="Main" className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
        <Link href="/" className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap font-heading">
          {PRODUCT_NAME}
        </Link>
        <Link href="/pricing" className="inline-flex min-h-11 shrink-0 items-center">
          Pricing
        </Link>
        <Link href="/contact" className="inline-flex min-h-11 shrink-0 items-center">
          {errorCopy.contact}
        </Link>
      </nav>
    </header>
  )
}

export function ErrorView({ kind, digest, onRetry }: { kind: "error" | "fatal"; digest?: string; onRetry: () => void }) {
  // 시각은 클라이언트에서만 만든다 — 서버 HTML 과 어긋나지 않게 붙은 뒤에 채운다
  const [at, setAt] = React.useState<string | null>(null)
  React.useEffect(() => setAt(new Date().toISOString()), [])
  const requestId = digest ?? at ?? undefined
  return (
    <main id="main" tabIndex={-1} className="min-h-svh focus:outline-none">
      <StateScreenErrorRetry copy={errorScreenCopy[kind]} onRetry={onRetry} errorCode={digest ? "server_error" : "client_error"} requestId={requestId} headingLevel={1} id="error" />
    </main>
  )
}
