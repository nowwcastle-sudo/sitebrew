"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import type { ActionResult } from "@/components/contract/block-contract"

// 「확인 메일 다시 보내기」 단추 하나(A10) — 가입 직후 안내(verify-email-note)·확인 안 된 사람의 위 배너(unverified-banner)·만료된 확인 링크 안내(welcome-notice)가 같이 쓴다.
// 서버 액션 sendVerificationEmail 을 그대로 받는다(로그인한 본인에게만 간다 — 서버가 세션으로 주소를 정한다). 결과는 같은 자리의 `role="status"` 글로 바뀐다(보냈어요 / 지금은 못 보냈어요).
// live=false: 이미 `role="status"` 안에 있을 때(가입 직후 안내) 이중으로 읽히지 않게 한다.
// 요청 제한(60초에 3번 — SENSITIVE_RATE_LIMITS)에 걸리면 서버가 실패로 돌려주고 같은 「못 보냈어요」 글이 뜬다.
type State = "idle" | "pending" | "sent" | "failed"
export type ResendCopy = { label: string; pending: string; sent: string; failed: string }

export function ResendVerification({ again: sendAgain, copy, look = "link", live = true }: { again: () => Promise<ActionResult<{ sent: true }>>; copy: ResendCopy; look?: "link" | "button"; live?: boolean }) {
  const [state, setState] = React.useState<State>("idle")
  const again = async () => {
    setState("pending")
    const r = await sendAgain().catch(() => null)
    setState(r?.ok ? "sent" : "failed")
  }
  const label = state === "pending" ? copy.pending : copy.label
  return (
    <div className="flex flex-col items-start gap-2">
      {look === "button" ? (
        <Button type="button" variant="outline" size="lg" onClick={again} disabled={state === "pending"} data-resend="">
          {label}
        </Button>
      ) : (
        <button type="button" onClick={again} disabled={state === "pending"} data-resend="" className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4 disabled:opacity-60">
          {label}
        </button>
      )}
      <p role={live ? "status" : undefined} className="text-base leading-[1.6] empty:hidden">
        {state === "sent" ? copy.sent : state === "failed" ? copy.failed : ""}
      </p>
    </div>
  )
}
