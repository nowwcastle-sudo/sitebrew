"use client"

import Script from "next/script"
import { useState } from "react"
import { openTestBillingAuth, type TestBillingSdk } from "@/lib/toss-test-sdk-client"

declare global { interface Window { TossPayments?: (clientKey: string) => TestBillingSdk } }

export function TossTestButton({ clientKey, fake, nonce }: { clientKey: string; fake: boolean; nonce?: string }) {
  const [ready, setReady] = useState(fake)
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  async function start() {
    if ((!fake && typeof window.TossPayments !== "function") || busy) return
    setBusy(true)
    setNotice("")
    try {
      const response = await fetch("/api/toss/registration/start", { method: "POST", credentials: "same-origin" })
      const result: unknown = await response.json()
      if (!response.ok || typeof result !== "object" || result === null || !("status" in result) || result.status !== "ready" || !("customerKey" in result) || typeof result.customerKey !== "string" || !("successUrl" in result) || typeof result.successUrl !== "string" || !("failUrl" in result) || typeof result.failUrl !== "string") { setNotice("모의 등록을 시작할 수 없습니다. 기존 등록 또는 설정을 확인해 주세요."); return }
      const fakeSdk = (): TestBillingSdk => ({ payment: ({ customerKey }) => ({ requestBillingAuth: async ({ successUrl }) => {
        const url = new URL(successUrl)
        url.searchParams.set("customerKey", customerKey)
        url.searchParams.set("authKey", `fake_${crypto.randomUUID()}`)
        window.location.assign(url.toString())
      } }) })
      await openTestBillingAuth({ clientKey, customerKey: result.customerKey, successUrl: result.successUrl, failUrl: result.failUrl, origin: window.location.origin, sdk: fake ? fakeSdk : window.TossPayments as (key: string) => TestBillingSdk })
    } catch { setNotice("모의 등록창을 열지 못했습니다.") }
    finally { setBusy(false) }
  }
  return <>
    {!fake && <Script src="https://js.tosspayments.com/v2/standard" nonce={nonce} strategy="afterInteractive" onReady={() => { const available = typeof window.TossPayments === "function"; setReady(available); if (!available) setNotice("등록창을 불러오지 못했습니다.") }} onError={() => { setReady(false); setNotice("등록창을 불러오지 못했습니다.") }} />}
    <p id="toss-test-human">직접 확인하고 눌러 주세요.</p>
    <button type="button" disabled={!ready || busy} onClick={start} data-requires-human="checkout" aria-describedby="toss-test-human">{fake ? "모의 카드 등록" : "토스 시험 카드 등록"}</button>
    {notice && <p role="status">{notice}</p>}
  </>
}
