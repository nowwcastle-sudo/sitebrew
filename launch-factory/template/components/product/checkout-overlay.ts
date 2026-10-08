"use client"

import * as React from "react"

// Paddle 결제 오버레이(LFFIX F2·F3). 서버가 만든 결제 주소(`https://<결제 링크 도메인>/?_ptxn=txn_…`)의 `_ptxn` 을 읽어
// 그 자리에서 오버레이를 연다(Paddle.Checkout.open({ transactionId }) — Paddle 문서 「Paddle.Checkout.open()」: 기존 거래를 결제 창에 넘긴다,
// 설정은 Paddle.Initialize 에서 한다). 결제가 끝나면(checkout.completed) /billing/return 으로 가서 구독을 바로 맞춘다(F3).
// Paddle 문서(2026-10-03): Paddle.js 는 https://cdn.paddle.com/paddle/v2/paddle.js 에서 직접 불러온다. 샌드박스 토큰(`test_`)이면 Paddle.Environment.set("sandbox").
// 토큰이 없거나 주소에 `_ptxn` 이 없으면(결제수단 변경 같은 다른 주소) 예전처럼 그 주소로 이동한다.
const SRC = "https://cdn.paddle.com/paddle/v2/paddle.js"
export const RETURN_PATH = "/billing/return"

interface PaddleApi {
  Environment: { set(env: "sandbox" | "production"): void }
  Initialize(options: { token: string; checkout?: { settings?: { locale?: string } }; eventCallback?: (e: { name?: string; data?: { transaction_id?: string } }) => void }): void
  Checkout: { open(options: { transactionId: string }): void }
}
declare global {
  interface Window {
    Paddle?: PaddleApi
  }
}

let loading: Promise<PaddleApi> | undefined
function loadPaddle(token: string, locale: string): Promise<PaddleApi> {
  return (loading ??= new Promise<PaddleApi>((resolve, reject) => {
    const init = () => {
      const paddle = window.Paddle
      if (!paddle) return reject(new Error("paddle missing"))
      if (token.startsWith("test_")) paddle.Environment.set("sandbox")
      paddle.Initialize({
        token,
        // 화면 언어로 고정한다 — 안 주면 Paddle 이 브라우저 언어로 정한다(한국어 브라우저면 영어 제품 위에 한국어 결제 창)
        checkout: { settings: { locale } },
        eventCallback: (e) => {
          if (e.name === "checkout.completed" && e.data?.transaction_id) window.location.assign(`${RETURN_PATH}?_ptxn=${encodeURIComponent(e.data.transaction_id)}`)
        },
      })
      resolve(paddle)
    }
    if (window.Paddle) return init()
    const s = document.createElement("script")
    s.src = SRC
    s.async = true
    s.nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? ""
    s.onload = init
    s.onerror = () => {
      loading = undefined
      reject(new Error("paddle script blocked"))
    }
    document.head.append(s)
  }))
}

/** 결제 주소의 `_ptxn`(거래 id). 없거나 주소가 아니면 null — 그때는 이동으로 처리한다 */
export function transactionIdOf(url: string): string | null {
  try {
    return new URL(url).searchParams.get("_ptxn")
  } catch {
    return null
  }
}

/** 블록의 onRedirect 로 넘긴다. 열 수 없으면(스크립트 막힘 등) 예전 방식으로 이동한다 */
export function useCheckoutOverlay(token: string | undefined, locale: string): (url: string) => void {
  return React.useCallback(
    (url: string) => {
      const txn = transactionIdOf(url)
      if (!token || !txn) return window.location.assign(url)
      loadPaddle(token, locale).then(
        (paddle) => paddle.Checkout.open({ transactionId: txn }),
        () => window.location.assign(url),
      )
    },
    [token, locale],
  )
}
