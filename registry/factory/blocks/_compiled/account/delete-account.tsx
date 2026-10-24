"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { humanApprovalProps } from "@/registry/factory/contract/human-actions"
import type { AuthPort, BillingPort, Session, Subscription } from "@/registry/factory/contract/ports"
import { CheckCircle, Download, Lock } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"
import { DateText, fill, fillText, formatUntil } from "../_shared/billing-format"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { ApprovalHint } from "../_shared/human-approval"
import { FormAlert, FormField, usePortForm } from "../_shared/port-form"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import type { SubmitNotices } from "../_shared/submit-guard"

// 탈퇴·내 데이터(A80, 개인정보 보호법 제21조 파기·제35조 열람·탈퇴가 가입보다 어렵지 않게). 한 화면에 순서대로:
//   ① 내 데이터 받기(JSON, exportMyData) — 지우기 전에 받을 수 있다 ② 지워지는 것과 법에 따라 남는 것(보존 기간 4종 — 표시·광고 6개월, 계약·청약철회 5년, 대금결제·공급 5년,
//   소비자 불만·분쟁 3년: 전자상거래법 시행령 제6조①) ③ 구독이 있으면 어떻게 되는지(어댑터가 지우기 요청 때 기간 끝 해지를 먼저 예약한다 — 막는 문이 아니다)
//   ④ 유예 기간과 「유예 중 다시 로그인하면 취소돼요」 ⑤ [취소][계정 지우기] 대등한 선택지(L3 — 계정 지우기를 색으로 키우지도 숨기지도 않는다).
// 지우기를 누르면 deleteAccount → 유예 끝 날짜(graceUntil)를 결과로 알린다. 미리 켜 둔 체크가 없다. 데이터는 파일로만 저장되고 화면·계측에 싣지 않는다.
// 포트: session(읽기 4상태)·subscription?(있으면 구독 안내)·exportMyData?(없으면 ①이 나오지 않는다)·deleteAccount.
export type AccountDeleteAccountCopy = {
  title: string
  /** 사람 승인 안내 글(R18) — 내 데이터 받기·계정 지우기 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  lead?: string
  export: { title: string; body: string; label: string; pending: string; done: string; file: string; errorTitle: string }
  deleted: { title: string; items: string[] }
  retained: { title: string; body: string; items: { what: string; period: string }[]; basis: string }
  subscription: { title: string; live: string; scheduled: string; link?: { label: string; href: string } }
  grace: { title: string; body: string }
  decision: {
    question: string
    cancel: string
    confirm: string
    pending: string
    errorTitle: string
    /**
     * 입력 확인(선택, DESIGN §7-B — 되돌릴 수 없는 파괴 행동은 대상 이름을 입력해야 실행된다, P3-7 AXC). 주면 로그인한 주소가 있는 계정은 그 이메일 주소를 그대로 입력해야 [계정 지우기] 가 나간다(앞뒤 공백·대소문자 무시) —
     * 입력한 값은 `deleteAccount({ confirmed: true, confirmEmail })` 로 포트에도 간다. 이메일이 없는 계정(소셜 가입)은 칸이 없고 `confirmed` 만 간다. 안 주면 칸이 없고 `confirmed: true` 만 간다(예전 모양).
     * hint 의 {email} 자리에 지금 주소가 들어간다
     */
    typed?: { label: string; marker?: string; hint?: string; mismatch: string }
  }
  cancelled: { title: string; body: string; label: string; href: string }
  done: { title: string; body: string; note: string }
  notices: SubmitNotices
  empty: { title: string; body: string; label: string; href: string }
  loading: string
  error: string
  retry: string
}
export type AccountDeleteAccountProps = BlockBase<AccountDeleteAccountCopy> & {
  session: AuthPort["session"]
  subscription?: BillingPort["subscription"]
  exportMyData?: AuthPort["exportMyData"]
  deleteAccount: NonNullable<AuthPort["deleteAccount"]>
  // 유예 일수(어댑터의 graceDays 와 같은 값 — 문구의 {days})
  graceDays: number
  initial?: { session?: Session | null; subscription?: Subscription }
}

const LIVE = new Set(["trialing", "active", "past_due", "paused"])
const noSubscription: NonNullable<AccountDeleteAccountProps["subscription"]> = async () => ({ ok: true, data: { planId: null, status: "none" } })

export function AccountDeleteAccount({ copy, locale, timeZone, session, subscription, exportMyData, deleteAccount, graceDays, initial, id = "delete-account", className }: AccountDeleteAccountProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const read = usePortRead(session, initial?.session)
  const subRead = usePortRead(subscription ?? noSubscription, initial?.subscription)
  const exportForm = usePortForm({ id: `${id}-export`, notices: copy.notices })
  const form = usePortForm({ id, notices: copy.notices })
  const [exported, setExported] = React.useState<string | null>(null)
  const [cancelled, setCancelled] = React.useState(false)
  const [graceUntil, setGraceUntil] = React.useState<string | null>(null)
  const exportedRef = React.useRef<HTMLParagraphElement>(null)
  const cancelledRef = React.useRef<HTMLHeadingElement>(null)
  const doneRef = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (exported) exportedRef.current?.focus()
  }, [exported])
  React.useEffect(() => {
    if (cancelled) cancelledRef.current?.focus()
  }, [cancelled])
  React.useEffect(() => {
    if (graceUntil) doneRef.current?.focus()
  }, [graceUntil])
  const me = read.state.status === "ready" ? read.state.data : null
  const sub: Subscription | null = subRead.state.status === "ready" ? subRead.state.data : null

  const download = async () => {
    if (!exportMyData) return
    // confirmed: [내 데이터 받기] 를 누른 것이 확인이다(개인 데이터가 파일로 나간다) — 눌렀다는 선언을 싣는다(P3-7 AXC, R20)
    const data = await exportForm.run(() => exportMyData({ confirmed: true }))
    if (!data) return
    const name = copy.export.file
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
    const a = document.createElement("a")
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setExported(name)
  }
  const typed = copy.decision.typed && me?.email ? copy.decision.typed : null
  const confirm = async () => {
    // 입력 확인(copy.decision.typed): 틀리면 포트를 부르지 않고 칸 오류. 맞으면 입력값도 confirmEmail 로 실어 서버가 다시 맞춰 보게 한다
    const entered = typed ? (form.read().confirmEmail ?? "") : undefined
    if (typed && me?.email && entered !== undefined && entered.toLowerCase() !== me.email.toLowerCase()) {
      form.showErrors({ confirmEmail: [typed.mismatch] })
      return
    }
    // confirmed: [계정 지우기] 가 확인 단계다 — 눌렀다는 선언을 싣는다(P3-7 AXC, R20)
    const r = await form.run(() => deleteAccount({ confirmed: true, ...(entered !== undefined ? { confirmEmail: entered } : {}) }))
    if (r) setGraceUntil(r.graceUntil)
  }

  return (
    <section ref={ref} id={id} data-block="account-delete-account" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={read.state.status === "loading" || undefined} className="flex max-w-3xl flex-col gap-8">
        {read.state.status === "loading" ? <ReadLoading label={copy.loading} lines={5} /> : null}
        {read.state.status === "error" ? <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} /> : null}
        {read.state.status === "empty" || (read.state.status === "ready" && !me) ? (
          <div className="flex flex-col items-start gap-3">
            <Lock aria-hidden="true" className="size-8 shrink-0" />
            <h3 className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">{copy.empty.title}</h3>
            <p className="text-base leading-[1.7]">{copy.empty.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.empty.href} />}>
              {copy.empty.label}
            </Button>
          </div>
        ) : null}
        {graceUntil ? (
          <div role="status" data-deletion-requested="" className="flex flex-col items-start gap-3">
            <CheckCircle aria-hidden="true" className="size-8 shrink-0" />
            <h3 ref={doneRef} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
              {copy.done.title}
            </h3>
            <p className="text-base leading-[1.7]">{fill(copy.done.body, { date: <DateText locale={locale} timeZone={timeZone} iso={graceUntil} as="since" /> })}</p>
            <p className="text-base leading-[1.7]">{copy.done.note}</p>
          </div>
        ) : cancelled ? (
          <div role="status" data-deletion-cancelled="" className="flex flex-col items-start gap-3">
            <h3 ref={cancelledRef} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
              {copy.cancelled.title}
            </h3>
            <p className="text-base leading-[1.7]">{copy.cancelled.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.cancelled.href} />}>
              {copy.cancelled.label}
            </Button>
          </div>
        ) : me ? (
          <>
            {exportMyData ? (
              <div data-part="export" className="flex flex-col items-start gap-3 border-t pt-8 first:border-t-0 first:pt-0">
                <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.export.title}</h3>
                <p className="text-base leading-[1.7]">{copy.export.body}</p>
                <FormAlert form={exportForm} fieldTitle={copy.export.errorTitle} serverTitle={copy.export.errorTitle} />
                <ApprovalHint id={`${id}-export-hint`}>{copy.humanHint}</ApprovalHint>
                <div className="flex">
                  <Button type="button" variant="outline" size="lg" disabled={exportForm.pending} focusableWhenDisabled onClick={download} data-export="" {...humanApprovalProps("export-personal-data", `${id}-export-hint`)}>
                    <Download aria-hidden="true" />
                    {exportForm.pending ? copy.export.pending : copy.export.label}
                  </Button>
                </div>
                {exported ? (
                  <p ref={exportedRef} tabIndex={-1} role="status" className="border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
                    {fillText(copy.export.done, { file: exported })}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div data-part="what-happens" className="flex flex-col items-start gap-3 border-t pt-8 first:border-t-0 first:pt-0">
              <div className="grid w-full gap-8 md:grid-cols-2">
                <div data-deleted="" className="flex min-w-0 flex-col items-start gap-3">
                  <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.deleted.title}</h3>
                  <ul className="ms-5 flex list-disc flex-col gap-2 text-base leading-[1.6]">
                    {copy.deleted.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>
                <div data-retained="" className="flex min-w-0 flex-col items-start gap-3">
                  <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.retained.title}</h3>
                  <p className="text-base leading-[1.7]">{copy.retained.body}</p>
                  <dl className="flex w-full flex-col border-y">
                    {copy.retained.items.map((it) => (
                      <div key={it.what} data-retention={it.period} className="flex items-baseline justify-between gap-4 border-b py-3 text-base leading-[1.5] last:border-b-0">
                        <dt>{it.what}</dt>
                        <dd data-numeric>{it.period}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-base leading-[1.6]">{copy.retained.basis}</p>
                </div>
              </div>
            </div>
            {sub && sub.status !== "none" && (LIVE.has(sub.status) || sub.cancelAt) && (sub.currentPeriodEnd || sub.trialEnd || sub.cancelAt) ? (
              <div data-part="subscription" className="flex flex-col items-start gap-3 border-t pt-8 first:border-t-0 first:pt-0">
                <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.subscription.title}</h3>
                <p className="border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
                  {fillText(sub.cancelAt ? copy.subscription.scheduled : copy.subscription.live, { date: formatUntil((sub.cancelAt ?? sub.currentPeriodEnd ?? sub.trialEnd) as string, locale, timeZone) })}
                </p>
                {copy.subscription.link ? (
                  <a href={copy.subscription.link.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                    {copy.subscription.link.label}
                  </a>
                ) : null}
              </div>
            ) : null}
            <div data-part="grace" className="flex flex-col items-start gap-3 border-t pt-8 first:border-t-0 first:pt-0">
              <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.grace.title}</h3>
              <p className="text-base leading-[1.7]">{fillText(copy.grace.body, { days: graceDays })}</p>
            </div>
            <div data-part="decision" className="flex flex-col items-start gap-4 border-t pt-8">
              <FormAlert form={form} fieldTitle={copy.decision.errorTitle} serverTitle={copy.decision.errorTitle} />
              <p id={`${id}-question`} className="text-[1.25rem] leading-[1.35] font-heading">
                {copy.decision.question}
              </p>
              {typed ? (
                <form method="post" id={form.formId} noValidate onSubmit={(e) => e.preventDefault()} className="flex w-full max-w-md flex-col">
                  <FormField form={form} name="confirmEmail" label={typed.label} marker={typed.marker} type="email" autoComplete="off" inputMode="email" hint={typed.hint ? fillText(typed.hint, { email: me?.email ?? "" }) : undefined} />
                </form>
              ) : null}
              <ApprovalHint id={`${id}-confirm-hint`}>{copy.humanHint}</ApprovalHint>
              <ChoiceRow label={copy.decision.question}>
                <ChoiceButton choice="decline" type="button" onClick={() => setCancelled(true)}>
                  {copy.decision.cancel}
                </ChoiceButton>
                <ChoiceButton choice="primary" type="button" disabled={form.pending} focusableWhenDisabled onClick={confirm} {...humanApprovalProps("delete-account", `${id}-confirm-hint`)}>
                  {form.pending ? copy.decision.pending : copy.decision.confirm}
                </ChoiceButton>
              </ChoiceRow>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
