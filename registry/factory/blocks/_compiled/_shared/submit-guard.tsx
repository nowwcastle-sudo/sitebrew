"use client"

import * as React from "react"

import type { ActionResult } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"

// 제출 보호(P3-2 Task 10d 공유 조각 block-shared-submit-guard — port-form·form-flow 가 같이 쓴다). 대장 A101·D104·D136·D160, 계약 판 2 의 선택 칸:
//   · 시간 초과: 15초 안에 답이 없으면 스피너를 멈추고 「응답이 늦어요」 + [다시 시도]. 입력은 그대로(비제어 폼). 늦게 온 답은 버린다 —
//     서버가 이미 처리했을 수 있어 다시 시도는 같은 폼·같은 멱등 키로 간다(멱등 키는 조립하는 쪽이 폼을 열 때 만든다 — 블록은 키를 모른다).
//   · 요청 제한: 실패 code "rate_limited" + retryAfter(초) → 보내기 버튼이 남은 초를 보이며 잠기고, 폼 옆 role="timer" 줄이 같은 초를 센다.
//     role="timer" 는 암묵적 aria-live="off" 라 초마다 읽지 않는다(role="status"·polite 는 시간 표시에 맞지 않는다 — MDN). 입력은 그대로.
//   · 지원 안 함: code "provider_unsupported"·"scenario_unsupported" + manageUrl(https) → 알림에 「직접 관리하는 곳」 링크. 죽은 버튼 대신 갈 길을 준다.
//   · 승인 대기(P3-7 AXWF, R21): code "confirmation_required"(AXC — 옛 이름 "approval_required" 도 같다) 는 실패가 아니다 — 오류 색이 아닌 알림(data-state="awaiting-approval", role="status")이 정해진 순서로 말한다:
//     무엇을 하려 했나(attempted) · 어디까지 했나(progress) · 왜 멈췄나(포트 formError, 없으면 reason) · 사람이 할 다음 행동 하나(next) · 사람에게 넘기는 길(route). 자동으로 다시 시도하지 않는다.
//   · 그 밖의 code(bot_check_*·in_progress)는 formError 그대로 그린다.
// 문구는 모두 블록 copy 의 notices 가 준다(블록 안 하드코딩 금지).

/** 제출이 이 시간 안에 끝나지 않으면 「응답이 늦어요」(밀리초) */
export const SUBMIT_TIMEOUT_MS = 15_000

export type SubmitNotices = {
  /** 보내기 버튼·타이머 줄 글자 — {seconds} 자리에 남은 초 */
  rateLimited: string
  timeout: { title: string; body: string; retry: string }
  unsupported: { title: string; link: string }
  /** 승인 대기 문구(선택 — 없으면 confirmation_required·approval_required 도 server 오류로 그린다). 순서: attempted → progress → 왜(포트 formError, 없으면 reason) → next → route */
  approval?: ApprovalNotice
}
export type ApprovalNotice = {
  /** 제목 — 「직접 확인해 주세요」류. 오류 제목이 아니다 */
  title: string
  /** 무엇을 하려 했나(「요금제 변경을 요청했어요」) */
  attempted?: string
  /** 어디까지 했나(「아직 아무것도 바뀌지 않았어요」) */
  progress?: string
  /** 포트가 왜 멈췄는지(formError)를 주지 않았을 때의 기본 이유 */
  reason?: string
  /** 사람이 할 다음 행동 하나(「화면의 [변경하기] 를 직접 눌러 주세요」) */
  next: string
  /** 사람에게 넘기는 길(링크) */
  route?: { label: string; href: string }
}

export const TIMED_OUT = "timed-out" as const
export type Settled<T> = ActionResult<T> | typeof TIMED_OUT

/**
 * 포트 쓰기 하나를 부르고 ms 안에 끝나지 않으면 TIMED_OUT. 포트는 거부하지 않지만(계약) 던지는 어댑터도 다시 시도할 수 있는 실패로 바꾼다.
 * 포트 메서드는 취소 신호(AbortSignal)를 받지 않는다 — 그래서 약속을 취소하지 않고 결과를 버린다(늦은 답은 화면을 바꾸지 않는다).
 */
export function settleWithin<T>(action: () => Promise<ActionResult<T>>, ms: number = SUBMIT_TIMEOUT_MS): Promise<Settled<T>> {
  return new Promise((resolve) => {
    let done = false
    const finish = (r: Settled<T>) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(r)
    }
    const timer = setTimeout(() => finish(TIMED_OUT), ms)
    try {
      action().then(finish, () => finish({ ok: false, retryable: true }))
    } catch {
      finish({ ok: false, retryable: true })
    }
  })
}

type Failure = Extract<ActionResult<unknown>, { ok: false }>

/** 알림 갈래: 요청 제한 · 지원 안 함 · 그 밖(server). 블록은 아는 code 에만 갈래를 둔다 */
export function failureKind(r: Failure): "rate_limited" | "unsupported" | "approval" | "other" {
  if (r.code === "rate_limited") return "rate_limited"
  if (r.code === "confirmation_required" || r.code === "approval_required") return "approval"
  if (r.code === "provider_unsupported" || r.code === "scenario_unsupported") return "unsupported"
  return "other"
}

/** 손님을 보낼 관리 주소는 https 만(공급자가 준 값이라도 스스로 검사한다) */
export const safeManageUrl = (u: unknown): string | undefined => (typeof u === "string" && /^https:\/\/[^\s]+$/i.test(u) ? u : undefined)

/** retryAfter 는 양의 정수 초로(빠졌거나 이상하면 1, 하루 넘게는 안 센다) */
export const cooldownSeconds = (retryAfter: unknown): number => (typeof retryAfter === "number" && Number.isFinite(retryAfter) ? Math.min(86_400, Math.max(1, Math.ceil(retryAfter))) : 1)

/** 남은 초 세기. start(초) 로 시작, 0 이 되면 저절로 멈춘다. 렌더에서 시계를 읽지 않는다(간격 콜백이 now 를 갱신) */
export function useCooldown() {
  const [state, setState] = React.useState<{ until: number; now: number } | null>(null)
  const until = state?.until
  React.useEffect(() => {
    if (until === undefined) return
    const id = setInterval(() => {
      const now = Date.now()
      setState(now >= until ? null : { until, now })
    }, 250)
    return () => clearInterval(id)
  }, [until])
  const start = React.useCallback((seconds: number) => {
    const now = Date.now()
    setState({ until: now + seconds * 1000, now })
  }, [])
  const clear = React.useCallback(() => setState(null), [])
  return { seconds: state ? Math.max(1, Math.ceil((state.until - state.now) / 1000)) : 0, start, clear }
}

/** 알림 상태의 갈래 — 폼 훅이 정하고 알림이 그린다 */
export type NoticeKind = "field" | "server" | "timeout" | "rate_limited" | "unsupported" | "approval"
// code: 포트가 준 실패 갈래(ActionResult.code, 선택 — P3-6 L04) — 알림 상자에 data-error-code 로 남아 자동화가 글을 해석하지 않고 원인을 안다
// retryable: 포트가 준 ActionResult.retryable(없으면 갈래로 정한다 — 시간 초과 true, 승인 대기·지원 안 함 false) — data-retryable 로 남는다(P3-7 AXWF, R21)
export type Notice = { kind: NoticeKind; text: string; manageUrl?: string; canRetry?: boolean; code?: string; retryable?: boolean }

/** 알림 상자 공통 기계 표지 — 실패 갈래·다시 시도 가능 여부·승인 대기 상태. 두 폼 알림(port-form·form-flow)이 같이 쓴다(한 곳) */
export function noticeAttrs(n: Notice): { "data-kind": NoticeKind; "data-error-code"?: string; "data-retryable"?: "true" | "false"; "data-state"?: "awaiting-approval" } {
  const retryable = n.retryable ?? (n.kind === "timeout" ? true : n.kind === "approval" || n.kind === "unsupported" ? false : undefined)
  return {
    "data-kind": n.kind,
    "data-error-code": n.code || undefined,
    "data-retryable": retryable === undefined ? undefined : retryable ? "true" : "false",
    "data-state": n.kind === "approval" ? "awaiting-approval" : undefined,
  }
}

/** 알림 제목 하나를 고른다: 시간 초과·지원 안 함은 자기 제목, 나머지는 서버·필드 제목 */
export function noticeTitle(n: Notice, notices: SubmitNotices | undefined, titles: { field: string; server: string }): string {
  if (n.kind === "timeout" && notices) return notices.timeout.title
  if (n.kind === "unsupported" && notices) return notices.unsupported.title
  if (n.kind === "approval" && notices?.approval) return notices.approval.title
  return n.kind === "field" ? titles.field : titles.server
}

/** 알림 아래 덧붙이는 것: 시간 초과의 [다시 시도] · 지원 안 함의 관리 링크 · 요청 제한의 남은 초 줄(role="timer") */
export function SubmitExtras({ notice, notices, cooldown, onRetry, className }: { notice: Notice | null; notices: SubmitNotices | undefined; cooldown: number; onRetry: () => void; className?: string }) {
  if (!notices) return null
  return (
    <>
      {cooldown > 0 ? (
        <p role="timer" data-cooldown={cooldown} className={cn("text-base leading-[1.6] tabular-nums", className)}>
          {fillText(notices.rateLimited, { seconds: cooldown })}
        </p>
      ) : null}
      {notice?.kind === "timeout" && notice.canRetry ? (
        <Button type="button" variant="outline" onClick={onRetry} className="mt-1 min-h-11 self-start">
          {notices.timeout.retry}
        </Button>
      ) : null}
      {notice?.kind === "unsupported" && notice.manageUrl ? (
        <a href={notice.manageUrl} target="_blank" rel="noopener noreferrer" className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
          {notices.unsupported.link}
        </a>
      ) : null}
    </>
  )
}

/** 승인 대기 알림 본문 — R21 순서(attempted → progress → 왜 → next → route). 오류 문장이 아니라 「사람이 이어서 할 일」을 말한다. 승인 알림이 아니면 아무것도 그리지 않는다 */
export function ApprovalLines({ notice, notices }: { notice: Notice; notices: SubmitNotices | undefined }) {
  const a = notices?.approval
  if (notice.kind !== "approval" || !a) return null
  const why = notice.text || a.reason
  return (
    <>
      {a.attempted ? <p data-part="attempted">{a.attempted}</p> : null}
      {a.progress ? <p data-part="progress">{a.progress}</p> : null}
      {why ? <p data-part="why">{why}</p> : null}
      <p data-part="next" className="text-base leading-[1.6]">
        {a.next}
      </p>
      {a.route ? (
        <a href={a.route.href} data-part="human-route" className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
          {a.route.label}
        </a>
      ) : null}
    </>
  )
}
