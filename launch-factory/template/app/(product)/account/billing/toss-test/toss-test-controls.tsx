"use client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function TossTestControls({ pending, canCancel, canCancelPeriod }: { pending: boolean; canCancel: boolean; canCancelPeriod: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  async function act(action: "reconcile" | "cancel_now" | "cancel_period") {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch("/api/toss/test-subscription", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, confirmed: true }) })
      const result: unknown = await response.json()
      if (!response.ok || typeof result !== "object" || result === null || !("ok" in result) || result.ok !== true || !("data" in result) || typeof result.data !== "object" || result.data === null) {
        setNotice("상태를 확인하지 못했습니다. 다시 승인하지 않습니다.")
      } else if (action === "reconcile") {
        if (!("paymentPending" in result.data) || typeof result.data.paymentPending !== "boolean") setNotice("상태를 확인하지 못했습니다. 다시 승인하지 않습니다.")
        else if (result.data.paymentPending) setNotice("기존 주문은 아직 확인되지 않았습니다. 다시 승인하지 않습니다.")
        else setNotice("기존 주문의 확인 결과를 화면에 반영했습니다.")
      } else if (pending) setNotice("해지 요청을 접수했습니다. 기존 주문 결과를 확인 중입니다.")
      else setNotice("시험 구독 상태를 변경했습니다.")
      router.refresh()
    } catch { setNotice("상태를 확인하지 못했습니다. 다시 승인하지 않습니다.") }
    finally { setBusy(false) }
  }
  return <>
    {pending && <button type="button" disabled={busy} onClick={() => act("reconcile")}>기존 주문 확인</button>}
    {canCancel && <button type="button" disabled={busy} onClick={() => act("cancel_now")} data-requires-human="cancel">시험 구독 즉시 해지</button>}
    {canCancelPeriod && <button type="button" disabled={busy} onClick={() => act("cancel_period")} data-requires-human="cancel">이용 기간 끝에 해지</button>}
    {notice && <p role="status">{notice}</p>}
  </>
}
