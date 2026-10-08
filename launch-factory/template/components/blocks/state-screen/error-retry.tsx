"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import type { Cta } from "@/components/content/content-core"
import { AlertTriangle, ChevronDown, ExternalLink } from "@/components/icons"
import { cn } from "@/lib/utils"
import { rise } from "@/components/motion/gsap-techniques"
import { useGsapScene } from "@/components/motion/use-gsap-scene"
import { Button } from "@/components/ui/button"

// 상태 화면 — 오류 + 다시 시도 + 도움말. 왼쪽 정렬 한 판: 큰 오류 번호(숫자 글자) · 제목 · 무엇이 안 됐고 입력은 어떻게 됐는지 한 줄 ·
// [다시 시도](onRetry — 주면 그린다) + 처음으로 링크, 아래 도움말 링크 목록과 접힌 자세히(오류 번호·시각 — 문의할 때 알려 줄 값).
// 다시 시도를 누르면 「다시 시도하는 중」을 role=status 로 알린다(블록은 결과를 모른다 — 성공하면 소비자가 이 화면을 걷는다).
//
// 앱 전체 오류 화면으로 쓴다(P3-6 H01·H04·L04 — Next 의 error.tsx·global-error.tsx 에 그대로 끼운다). 늘 있는 것: 글자만으로 끝나는 구조(스타일 속성 없음 — 엄격 CSP 가
// 막을 인라인 style 이 없다). 더한 칸은 모두 선택이라 안 주면 예전 화면 그대로다:
//   · header — 머리·내비 자리(해당 쪽에서 레이아웃이 사라지는 global-error 가 NavAccountBar 같은 머리를 직접 끼운다). 블록 앞에 놓인다.
//   · errorCode — 기계가 읽는 오류 갈래. 섹션 뿌리에 data-error-code 로 남는다(L04 — 에이전트가 글을 해석하지 않는다). 화면에 보이는 오류 번호(copy.code)와는 따로다.
//   · requestId — 문의할 때 알려 줄 요청 번호(Next error.digest 등). copy.requestIdLabel 과 함께 본문 아래에 보인다(접힌 자세히 안에 숨기지 않는다).
//   · copy.support — 지원 경로 링크(문의 쪽·메일). 다시 해도 소용없는 오류에서 사람에게 닿는 길이다(H04).
//   · copy.signIn — 로그인이 필요한 오류(401)에서 [다시 시도] 대신 보이는 로그인 링크(href 에 로그인 뒤 돌아올 next 를 싣는다).
//   · headingLevel — 오류가 쪽 전체이고 쪽에 다른 h1 이 없으면 1(기본 2).
export type StateScreenErrorRetryCopy = {
  code?: string
  title: string
  body: string
  retryLabel: string
  retryingLabel: string
  home?: Cta
  support?: Cta
  signIn?: Cta
  requestIdLabel?: string
  helpTitle?: string
  help?: Cta[]
  details?: { summary: string; rows: { label: string; value: string }[] }
}
export type StateScreenErrorRetryProps = BlockBase<StateScreenErrorRetryCopy> & {
  onRetry?: () => void
  header?: React.ReactNode
  errorCode?: string
  /** 다시 시도해도 되는 오류인가(ActionResult.retryable 그대로, 선택 — P3-7 AXWF, R21). 섹션 뿌리에 data-retryable 로 남는다 */
  retryable?: boolean
  requestId?: string
  headingLevel?: 1 | 2
}

export function StateScreenErrorRetry({ copy, onRetry, header, errorCode, retryable, requestId, headingLevel = 2, id = "error", className }: StateScreenErrorRetryProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.06 })
  })
  const [retrying, setRetrying] = React.useState(false)
  React.useEffect(() => {
    if (!retrying) return
    const t = window.setTimeout(() => setRetrying(false), 4000)
    return () => window.clearTimeout(t)
  }, [retrying])
  const Heading = headingLevel === 1 ? "h1" : "h2"
  const needsSignIn = !!copy.signIn
  return (
    <>
      {header}
      <section ref={ref} id={id} data-block="state-screen-error-retry" data-error-code={errorCode || undefined} data-retryable={retryable === undefined ? undefined : retryable ? "true" : "false"} aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
        <div className="flex max-w-3xl flex-col gap-8">
          <div data-enter className="flex flex-col items-start gap-4">
            {copy.code ? (
              <p data-numeric className="text-[3.815rem] leading-none tabular-nums md:text-[5.96rem] font-heading">
                {copy.code}
              </p>
            ) : (
              <AlertTriangle aria-hidden="true" className="size-12" />
            )}
            <Heading id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading">
              {copy.title}
            </Heading>
            <p className="max-w-prose text-[1.125rem] leading-[1.7]">{copy.body}</p>
            {requestId && copy.requestIdLabel ? (
              <p data-request-id={requestId} className="flex flex-wrap items-baseline gap-x-2 text-base leading-[1.5]">
                {copy.requestIdLabel} <code data-numeric>{requestId}</code>
              </p>
            ) : null}
          </div>
          <div data-enter className="flex flex-wrap items-center gap-3">
            {needsSignIn && copy.signIn ? (
              <Button size="lg" nativeButton={false} render={<a href={copy.signIn.href} />}>
                {copy.signIn.label}
              </Button>
            ) : onRetry ? (
              <Button
                type="button"
                size="lg"
                data-retry
                onClick={() => {
                  setRetrying(true)
                  onRetry()
                }}
              >
                {copy.retryLabel}
              </Button>
            ) : null}
            {copy.home ? (
              <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.home.href} />}>
                {copy.home.label}
              </Button>
            ) : null}
            {copy.support ? (
              <a href={copy.support.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                {copy.support.label}
              </a>
            ) : null}
            <span role="status" className="text-base leading-[1.5]">
              {retrying ? copy.retryingLabel : ""}
            </span>
          </div>
          {copy.help?.length || copy.details ? (
            <div data-enter className="grid gap-8 border-t pt-8 md:grid-cols-2">
              {copy.help?.length ? (
                <nav aria-label={copy.helpTitle ?? copy.title} className="flex flex-col gap-3">
                  {copy.helpTitle ? <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.helpTitle}</h3> : null}
                  <ul className="flex flex-col">
                    {copy.help.map((h) => (
                      <li key={h.href}>
                        <a href={h.href} className="relative inline-flex min-h-11 items-center gap-2 text-base underline underline-offset-4">
                          {h.label}
                          <ExternalLink aria-hidden="true" className="size-4" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
              {copy.details ? (
                <details className="self-start border px-4 py-2">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-base leading-[1.5] font-medium outline-hidden focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    {copy.details.summary}
                    {/* 펼침 표시(Task 14c — 레인 C 걱정 7): flex 요약줄은 기본 삼각형을 그리지 않는다. 열리면 돈다(길이는 모션 토큰 — 동작 줄이기면 0). */}
                    <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform duration-(--duration-hover) ease-(--ease-standard) [details[open]>summary>&]:rotate-180" />
                  </summary>
                  <dl className="flex flex-col gap-2 pt-2 pb-2">
                    {copy.details.rows.map((r) => (
                      <div key={r.label} className="flex flex-wrap gap-x-3 text-base leading-[1.5]">
                        <dt>{r.label}</dt>
                        <dd data-numeric>{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
