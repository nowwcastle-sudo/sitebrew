"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function TossTestCharge({ amount, fake }: { amount: number; fake: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const mode = fake ? "모의" : "토스 시험"
  const unresolved = `${mode} 청구 결과를 확인할 수 없습니다. 자동으로 다시 승인하지 않습니다.`
  async function charge() {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch("/api/toss/test-charge", { method: "POST", credentials: "same-origin" })
      const result: unknown = await response.json()
      if (response.ok && typeof result === "object" && result !== null && "status" in result && result.status === "paid") setNotice(`${mode} 청구를 확인했습니다. 유료 권한은 활성화되지 않습니다.`)
      else if (response.ok && typeof result === "object" && result !== null && "status" in result && result.status === "declined") setNotice(`${mode} 청구가 거절되었습니다. 다시 시도할 수 있는 시각을 확인해 주세요.`)
      else setNotice(unresolved)
      router.refresh()
    } catch { setNotice(unresolved) }
    finally { setBusy(false) }
  }
  return <><button type="button" disabled={busy} onClick={charge} data-requires-human="checkout">{mode} 첫 청구 확인 ({new Intl.NumberFormat("ko-KR").format(amount)}원, 실제 결제 없음)</button>{notice && <p role="status">{notice}</p>}</>
}
