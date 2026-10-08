"use client"

import * as React from "react"

import type { ActionResult, AsyncState } from "@/registry/factory/contract/block-contract"
import { AlertCircle, LoaderCircle } from "@/registry/factory/icons"
import { Button } from "@/registry/factory/ui/button"
import { usePendingGate } from "@/registry/factory/ui/spinner"
import { Skeleton } from "@/registry/factory/ui/skeleton"

// 포트 읽기(P3-2 레인 D1 공유 조각 block-shared-port-read). 포트의 읽기 메서드(plans·subscription·session·methods·consents)를
// block-contract AsyncState 네 상태로 바꾼다. 포트는 거부(reject)하지 않고 ActionResult 로 끝난다(ports.ts).
//   · initial 을 주면(서버가 미리 읽어 둔 값 — 첫 HTML 에 가격·요금제 글자가 들어간다, 마케팅 규칙 X2) 처음부터 ready 이고 첫 읽기는 건너뛴다.
//   · 읽기 메서드가 바뀌면(다른 포트) 다시 읽는다 — 메서드는 렌더마다 새로 만들지 않는다(모듈 값·useCallback).
//   · reload(): 쓰기 뒤 다시 읽는다. 보이던 값은 새 값이 올 때까지 그대로 둔다(자리 이동 없음).
//   · error 의 retry 는 reload 다.
export function usePortRead<T>(read: () => Promise<ActionResult<T>>, initial?: T) {
  const [state, setState] = React.useState<AsyncState<T>>(initial !== undefined ? { status: "ready", data: initial } : { status: "loading" })
  const [tick, setTick] = React.useState(initial !== undefined ? 0 : 1)
  const [lastRead, setLastRead] = React.useState(() => read)
  // 읽기 메서드가 바뀌면 처음부터(렌더 중 상태 맞추기 — effect 안 setState 를 피한다)
  if (lastRead !== read) {
    setLastRead(() => read)
    setState({ status: "loading" })
    setTick((t) => t + 1)
  }
  const reload = React.useCallback(() => setTick((t) => t + 1), [])
  React.useEffect(() => {
    if (!tick) return
    let alive = true
    read().then(
      (r) => {
        if (!alive) return
        setState(r.ok ? { status: "ready", data: r.data } : { status: "error", message: r.formError ?? "", code: r.code, retryable: r.retryable, retry: () => { setState({ status: "loading" }); reload() } })
      },
      () => {
        if (alive) setState({ status: "error", message: "", retry: () => { setState({ status: "loading" }); reload() } })
      },
    )
    return () => {
      alive = false
    }
  }, [read, tick, reload])
  return { state, reload, set: (data: T) => setState({ status: "ready", data }) }
}

/** 읽는 중 자리(뼈대 줄). 읽기 도구에는 label 을 읽힌다(aria-busy 는 감싸는 쪽이 단다). */
export function ReadLoading({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" className="flex w-full flex-col gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

// 로그인 행동 슬롯(P3-6 B04) — 로그아웃·만료 상태로 보호된 읽기를 부르면 포트가 code "signInRequired" 로 끝난다. 그 오류를 「다시 불러오기」(소용없다)로 두지 않고
// 로그인 링크를 보인다. 링크는 로그인 뒤 이 쪽으로 돌아오는 주소(`?next=`)를 담는다 — signInHref 로 만든다. 한 쪽에 여러 읽기 블록이 있어도 쪽 위쪽에서
// ReadErrorProvider 로 한 번만 정하면 아래 모든 ReadError 가 받는다(블록마다 props 를 더하지 않는다). ReadError 에 signIn 을 직접 주면 그것이 앞선다.
export type ReadErrorSignIn = {
  /** 로그인 쪽 주소 — 돌아올 곳이 `next` 로 실린 값(signInHref) */
  href: string
  label: string
  /** 로그인 필요 오류의 제목·설명(없으면 ReadError 의 title·포트 메시지) */
  title?: string
  message?: string
}
/** 로그인 뒤 돌아올 곳을 `?next=` 로 단 주소. next 는 같은 사이트의 경로만 받는다(`/` 로 시작, `//`·`\` 시작 거절 — 열린 리다이렉트 방지). 틀리면 next 없이 base */
export function signInHref(base: string, next?: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return base
  return `${base}${base.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`
}
const SIGN_IN_CODES = ["signInRequired", "sign_in_required", "unauthenticated", "unauthorized"] // sign_in_required = signInRequired 의 snake_case 표기(P3-7 AXC — launch-factory LFAX)
const ReadErrorContext = React.createContext<{ signIn?: ReadErrorSignIn }>({})
export function ReadErrorProvider({ signIn, children }: { signIn?: ReadErrorSignIn; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ signIn }), [signIn])
  return <ReadErrorContext.Provider value={value}>{children}</ReadErrorContext.Provider>
}

/**
 * 읽기 오류 — 무엇이 안 됐는지 + [다시 시도]. 누르면 다시 읽는다(보이는 알림 자리는 그대로).
 * 실패 갈래 code 가 있으면 `data-error-code` 로, 포트가 retryable 을 줬으면 `data-retryable` 로 남긴다(L04·R21 — 에이전트·자동화가 글을 해석하지 않고 원인과 다시 시도해도 되는지를 안다).
 * code 가 로그인 필요(signInRequired)이고 로그인 행동(signIn prop 또는 ReadErrorProvider)이 있으면 [다시 시도] 대신 로그인 링크를 보인다.
 */
export function ReadError({ state, title, retryLabel, signIn: signInProp }: { state: Extract<AsyncState<unknown>, { status: "error" }>; title: string; retryLabel: string; signIn?: ReadErrorSignIn }) {
  const [busy, setBusy] = React.useState(false)
  const spin = usePendingGate(busy)
  const ctx = React.useContext(ReadErrorContext)
  const signIn = signInProp ?? ctx.signIn
  const needsSignIn = !!signIn && !!state.code && SIGN_IN_CODES.includes(state.code)
  const heading = needsSignIn ? (signIn.title ?? title) : title
  const message = needsSignIn ? (signIn.message ?? state.message) : state.message
  return (
    <div role="alert" data-error-code={state.code || undefined} data-retryable={state.retryable === undefined ? undefined : state.retryable ? "true" : "false"} data-sign-in-required={needsSignIn ? "" : undefined} className="flex flex-wrap items-start gap-3 border border-destructive px-4 py-3 text-base leading-[1.6]">
      <AlertCircle aria-hidden="true" className="mt-1 size-5 shrink-0 text-destructive" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-base leading-[1.5] font-heading">{heading}</p>
        {message ? <p>{message}</p> : null}
      </div>
      {needsSignIn ? (
        <Button nativeButton={false} render={<a href={signIn.href} />} className="shrink-0">
          {signIn.label}
        </Button>
      ) : state.retry ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setBusy(true)
            state.retry?.()
          }}
          className="shrink-0"
        >
          {spin ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
