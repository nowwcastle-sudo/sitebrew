"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, AuthPort, Session } from "@/registry/factory/contract/ports"
import { ChevronRight, LogOut, User } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { FormAlert, goTo, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"

// 계정 설정 — 줄 목록(항목 이름 | 지금 값 | 바꾸기 링크): 이름 · 이메일 · 비밀번호 · 2단계 인증. 아래 로그아웃(누르면 그 자리에 [취소][로그아웃하기]
// 대등한 확인 — L3)과 계정 지우기 링크(찾기 쉬운 곳에 — 앱 스토어 계정 삭제 규정). 값은 포트 session()(읽기 4상태 — 빈 값은 로그인 안내).
// 바꾸기는 각 설정 화면으로 가는 링크다(포트에 프로필 쓰기 메서드가 없다). 이름·이메일은 화면에만 보이고 계측에 싣지 않는다.
export type AccountProfileSettingsCopy = {
  title: string
  lead?: string
  rows: { name: string; email: string; password: string; twoFactor: string }
  values: { noName: string; passwordSet: string; twoFactorOn: string; twoFactorOff: string }
  actions: { name: { label: string; href: string }; email: { label: string; href: string }; password: { label: string; href: string }; twoFactor: { labelOn: string; labelOff: string; href: string } }
  signOut: { label: string; question: string; cancel: string; confirm: string; pending: string; errorTitle: string; done: { title: string; body: string; label: string; href: string } }
  notices: SubmitNotices
  remove: { label: string; href: string; note?: string }
  empty: { title: string; body: string; label: string; href: string }
  loading: string
  error: string
  retry: string
}
export type AccountProfileSettingsProps = BlockBase<AccountProfileSettingsCopy> & {
  session: AuthPort["session"]
  signOut: AuthPort["signOut"]
  track?: AnalyticsPort["track"]
  onRedirect?: (url: string) => void
  initial?: { session?: Session | null }
}

export function AccountProfileSettings({ copy, session, signOut, track, onRedirect, initial, id = "profile", className }: AccountProfileSettingsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const read = usePortRead(session, initial?.session)
  const [asking, setAsking] = React.useState(false)
  const [signedOut, setSignedOut] = React.useState(false)
  const questionRef = React.useRef<HTMLParagraphElement>(null)
  const signOutRef = React.useRef<HTMLButtonElement>(null)
  const doneRef = React.useRef<HTMLHeadingElement>(null)
  const form = usePortForm({ id, notices: copy.notices })
  const back = React.useRef(false)
  React.useEffect(() => {
    if (asking) questionRef.current?.focus()
    else if (back.current) signOutRef.current?.focus()
  }, [asking])
  React.useEffect(() => {
    if (signedOut) doneRef.current?.focus()
  }, [signedOut])
  const confirm = async () => {
    const r = await form.run(() => signOut())
    if (!r) return
    track?.("cta_click", { id: "sign-out", label: copy.signOut.confirm, section: id })
    if (r.redirectUrl) return goTo(r.redirectUrl, onRedirect)
    setSignedOut(true)
  }
  const s = read.state.status === "ready" ? read.state.data : null
  return (
    <section ref={ref} id={id} data-block="account-profile-settings" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={read.state.status === "loading" || undefined} className="flex max-w-3xl flex-col gap-8">
        {read.state.status === "loading" ? <ReadLoading label={copy.loading} lines={4} /> : null}
        {read.state.status === "error" ? <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} /> : null}
        {signedOut ? (
          <div role="status" className="flex flex-col items-start gap-3">
            <LogOut aria-hidden="true" className="size-8 shrink-0" />
            <h3 ref={doneRef} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
              {copy.signOut.done.title}
            </h3>
            <p className="text-base leading-[1.7]">{copy.signOut.done.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.signOut.done.href} />}>
              {copy.signOut.done.label}
            </Button>
          </div>
        ) : read.state.status === "empty" || (read.state.status === "ready" && !s) ? (
          <div className="flex flex-col items-start gap-3">
            <User aria-hidden="true" className="size-8 shrink-0" />
            <h3 className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">{copy.empty.title}</h3>
            <p className="text-base leading-[1.7]">{copy.empty.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.empty.href} />}>
              {copy.empty.label}
            </Button>
          </div>
        ) : s ? (
          <>
            <dl className="flex flex-col border-y">
              {(
                [
                  ["name", copy.rows.name, s.name || copy.values.noName, copy.actions.name.label, copy.actions.name.href],
                  ["email", copy.rows.email, s.email ?? "", copy.actions.email.label, copy.actions.email.href],
                  ["password", copy.rows.password, copy.values.passwordSet, copy.actions.password.label, copy.actions.password.href],
                  ["two-factor", copy.rows.twoFactor, s.twoFactor ? copy.values.twoFactorOn : copy.values.twoFactorOff, s.twoFactor ? copy.actions.twoFactor.labelOn : copy.actions.twoFactor.labelOff, copy.actions.twoFactor.href],
                ] as const
              ).map(([key, label, value, action, href]) => (
                <div key={key} data-row={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 border-b py-4 last:border-b-0 md:grid-cols-[10rem_minmax(0,1fr)_auto]">
                  <dt className="text-base leading-[1.5] font-medium">{label}</dt>
                  <dd className="col-start-1 row-start-2 min-w-0 text-base leading-[1.6] break-words md:col-start-2 md:row-start-1">{value}</dd>
                  <dd className="col-start-2 row-span-2 row-start-1 md:col-start-3 md:row-span-1">
                    <a href={href} className="relative inline-flex min-h-11 items-center gap-1 text-base underline underline-offset-4">
                      {action}
                      <span className="sr-only"> — {label}</span>
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col items-start gap-5">
              <FormAlert form={form} fieldTitle={copy.signOut.errorTitle} serverTitle={copy.signOut.errorTitle} />
              {asking ? (
                <div className="flex w-full max-w-lg flex-col gap-4 border px-5 py-5">
                  <p ref={questionRef} tabIndex={-1} id={`${id}-signout-q`} className="text-[1.125rem] leading-[1.4] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                    {copy.signOut.question}
                  </p>
                  <ChoiceRow label={copy.signOut.question}>
                    <ChoiceButton
                      choice="decline"
                      type="button"
                      onClick={() => {
                        back.current = true
                        setAsking(false)
                      }}
                    >
                      {copy.signOut.cancel}
                    </ChoiceButton>
                    <ChoiceButton choice="primary" type="button" disabled={form.pending || !!form.holdLabel} focusableWhenDisabled onClick={confirm}>
                      {form.pending ? copy.signOut.pending : (form.holdLabel ?? copy.signOut.confirm)}
                    </ChoiceButton>
                  </ChoiceRow>
                </div>
              ) : (
                <Button ref={signOutRef} type="button" variant="outline" size="lg" onClick={() => setAsking(true)} className="gap-2">
                  <LogOut aria-hidden="true" />
                  {copy.signOut.label}
                </Button>
              )}
              <p className="flex flex-col gap-1 self-stretch border-t pt-5 text-base leading-[1.6]">
                <a href={copy.remove.href} className="relative inline-flex min-h-11 items-center self-start text-base [color:color-mix(in_oklch,var(--destructive)_40%,var(--foreground))] underline underline-offset-4">
                  {copy.remove.label}
                </a>
                {copy.remove.note ? <span className="text-base leading-[1.6]">{copy.remove.note}</span> : null}
              </p>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
