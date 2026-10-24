"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import type { AuthPort, Session } from "@/components/contract/ports"
import { CheckCircle, Lock, Mail } from "@/components/icons"
import { cn } from "@/lib/utils"
import { rise } from "@/components/motion/gsap-techniques"
import { useGsapScene } from "@/components/motion/use-gsap-scene"
import { Button } from "@/components/ui/button"

import { fillText } from "../_shared/billing-format"
import { FormAlert, usePortForm } from "../_shared/port-form"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import { useCooldown, type SubmitNotices } from "../_shared/submit-guard"

// 이메일 확인 안내(A47) — 가입 직후 「메일을 보냈어요」 한 판: 어느 주소로 보냈는지 · 다음에 할 일 두 걸음(메일함에서 열기 → 링크 누르기) · 메일이 안 올 때 스팸함 확인 ·
// [인증 메일 다시 보내기]. 다시 보내기는 보낸 뒤 대기 시간(기본 60초) 동안 잠기고 남은 초를 role="timer" 줄이 센다(role="timer" 는 암묵적 aria-live=off — 초마다 읽지 않는다).
// 서버가 요청 제한(code rate_limited·retryAfter)으로 거절하면 그 초로 같은 식으로 잠근다(submit-guard). 이미 확인한 계정(session.emailVerified)은 「확인했어요」와 다음 행동만 보인다.
// 주소가 틀렸으면 「이메일 바꾸기」 링크(account/credentials)로 간다. 이 페이지를 다시 열면 대기 시간은 처음부터다(서버 시각을 저장하지 않는다 — 어댑터가 요청 제한을 지킨다).
// 포트: session(읽기 4상태 — 어느 주소·확인 여부)·sendVerificationEmail?(없으면 다시 보내기 버튼이 없다).
// P3-6 AUTHBLK(A01·A08·A14, factory-rules.md §23 U4): 확인이 먼저다(제목이 「메일함을 열어 확인해 주세요」 — 문구는 copy). 보낸 주소는 굵게(data-address) 따로 보여 오타를 눈으로 잡게 하고, 틀렸으면 「이메일 바꾸기」로 간다.
// 로그인 안 한 채 열면(세션 없음) 다음 행동은 로그인이다(copy.empty — 확인 링크를 다른 기기에서 연 경우도 같다). 확인했으면 「확인했어요」 + 다음 행동.
export type ConfirmationVerifyEmailCopy = {
  title: string
  body: string
  steps: string[]
  spam: string
  resend: { label: string; pending: string; wait: string; sent: string; errorTitle: string }
  wrongAddress: { text: string; label: string; href: string }
  verified: { title: string; body: string; label: string; href: string }
  notices: SubmitNotices
  empty: { title: string; body: string; label: string; href: string }
  loading: string
  error: string
  retry: string
}
export type ConfirmationVerifyEmailProps = BlockBase<ConfirmationVerifyEmailCopy> & {
  session: AuthPort["session"]
  sendVerificationEmail?: AuthPort["sendVerificationEmail"]
  // 보낸 뒤 다시 보내기를 기다리는 초(기본 60 — 요청 제한 초가 오면 그 값이 이긴다)
  resendAfter?: number
  // 쪽을 연 순간 다시 보내기를 잠그는 초(REL12). 안 주면 resendAfter 와 같다(예전 그대로 — 가입 직후 화면). 가입 직후가 아닌 쪽(배너·만료 안내에서 연 화면)은 0 을 준다 —
  // 0 이면 처음부터 풀려 있고, 보낸 뒤 잠금만 resendAfter 다
  initialWait?: number
  initial?: { session?: Session | null }
}

// {email} 자리를 굵은 주소로(없으면 글 그대로)
function withAddress(text: string, email: string) {
  const parts = text.split("{email}")
  if (parts.length < 2) return text
  return parts.flatMap((p, i) => (i === 0 ? [p] : [<strong key={i} data-address="" className="break-all">{email}</strong>, p]))
}

export function ConfirmationVerifyEmail({ copy, session, sendVerificationEmail, resendAfter = 60, initialWait, initial, id = "verify-email", className }: ConfirmationVerifyEmailProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const read = usePortRead(session, initial?.session)
  const form = usePortForm({ id, notices: copy.notices })
  const wait = useCooldown()
  const [sent, setSent] = React.useState(false)
  const sentRef = React.useRef<HTMLParagraphElement>(null)
  // 이 화면에 온 순간은 가입 메일이 막 나간 때다 — 대기 시간이 처음부터 흐른다
  const { start } = wait
  const firstWait = initialWait ?? resendAfter
  React.useEffect(() => {
    if (firstWait > 0) start(firstWait)
  }, [start, firstWait])
  React.useEffect(() => {
    if (sent) sentRef.current?.focus()
  }, [sent])
  const me = read.state.status === "ready" ? read.state.data : null
  const held = wait.seconds > 0 || form.cooldown > 0

  const resend = async () => {
    if (!sendVerificationEmail || held) return
    const r = await form.run(() => sendVerificationEmail())
    if (!r) return
    wait.start(resendAfter)
    setSent(true)
  }

  return (
    <section ref={ref} id={id} data-block="confirmation-verify-email" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 items-center", className)}>
      <div data-enter aria-busy={read.state.status === "loading" || undefined} className="flex w-full max-w-xl flex-col items-center gap-5 rounded-lg border px-5 py-8 text-center md:px-10 md:py-10">
        {read.state.status === "loading" ? (
          <>
            <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
              {copy.title}
            </h2>
            <ReadLoading label={copy.loading} lines={3} />
          </>
        ) : null}
        {read.state.status === "error" ? (
          <>
            <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
              {copy.title}
            </h2>
            <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} />
          </>
        ) : null}
        {read.state.status === "empty" || (read.state.status === "ready" && !me) ? (
          <>
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Lock className="size-7" />
            </span>
            <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
              {copy.empty.title}
            </h2>
            <p className="max-w-prose text-base leading-[1.7] break-words">{copy.empty.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.empty.href} />}>
              {copy.empty.label}
            </Button>
          </>
        ) : null}
        {me && me.emailVerified === true ? (
          <div data-verified="">
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <CheckCircle className="size-7" />
            </span>
            <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
              {copy.verified.title}
            </h2>
            <p className="max-w-prose text-base leading-[1.7] break-words">{copy.verified.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.verified.href} />}>
              {copy.verified.label}
            </Button>
          </div>
        ) : null}
        {me && me.emailVerified !== true ? (
          <>
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Mail className="size-7" />
            </span>
            <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
              {copy.title}
            </h2>
            <p className="max-w-prose text-base leading-[1.7] break-words">
              {withAddress(copy.body, me.email ?? "")}
            </p>
            <ol className="flex w-full max-w-prose list-decimal flex-col gap-2 ps-6 text-start text-base leading-[1.6]">
              {copy.steps.map((s) => (
                <li key={s} className="ps-1">
                  {s}
                </li>
              ))}
            </ol>
            <p className="max-w-prose text-base leading-[1.6]">{copy.spam}</p>
            <FormAlert form={form} fieldTitle={copy.resend.errorTitle} serverTitle={copy.resend.errorTitle} />
            {sendVerificationEmail ? (
              <div className="flex w-full flex-col items-center gap-3">
                <Button type="button" variant="outline" size="lg" disabled={form.pending || held} focusableWhenDisabled onClick={resend} data-resend="">
                  {form.pending ? copy.resend.pending : (form.holdLabel ?? copy.resend.label)}
                </Button>
                <p role="timer" data-cooldown={wait.seconds} className="min-h-6 text-base leading-[1.5] tabular-nums">
                  {wait.seconds > 0 ? fillText(copy.resend.wait, { seconds: wait.seconds }) : ""}
                </p>
                {sent ? (
                  <p ref={sentRef} tabIndex={-1} role="status" className="border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
                    {copy.resend.sent}
                  </p>
                ) : null}
              </div>
            ) : null}
            <p className="text-base leading-[1.6]">
              {copy.wrongAddress.text}{" "}
              <a href={copy.wrongAddress.href} className="relative inline-flex min-h-11 items-center underline underline-offset-4">
                {copy.wrongAddress.label}
              </a>
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}
