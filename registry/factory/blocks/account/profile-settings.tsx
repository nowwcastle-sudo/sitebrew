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
    <section ref={ref} id={id} data-block="account-profile-settings" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={read.state.status === "loading" || undefined} className="cn-block-profile">
        {read.state.status === "loading" ? <ReadLoading label={copy.loading} lines={4} /> : null}
        {read.state.status === "error" ? <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} /> : null}
        {signedOut ? (
          <div role="status" className="cn-block-auth-result">
            <LogOut aria-hidden="true" className="cn-block-auth-result-icon" />
            <h3 ref={doneRef} tabIndex={-1} className="cn-block-auth-result-title font-heading">
              {copy.signOut.done.title}
            </h3>
            <p className="cn-block-auth-result-body">{copy.signOut.done.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.signOut.done.href} />}>
              {copy.signOut.done.label}
            </Button>
          </div>
        ) : read.state.status === "empty" || (read.state.status === "ready" && !s) ? (
          <div className="cn-block-auth-result">
            <User aria-hidden="true" className="cn-block-auth-result-icon" />
            <h3 className="cn-block-auth-result-title font-heading">{copy.empty.title}</h3>
            <p className="cn-block-auth-result-body">{copy.empty.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.empty.href} />}>
              {copy.empty.label}
            </Button>
          </div>
        ) : s ? (
          <>
            <dl className="cn-block-profile-list">
              {(
                [
                  ["name", copy.rows.name, s.name || copy.values.noName, copy.actions.name.label, copy.actions.name.href],
                  ["email", copy.rows.email, s.email ?? "", copy.actions.email.label, copy.actions.email.href],
                  ["password", copy.rows.password, copy.values.passwordSet, copy.actions.password.label, copy.actions.password.href],
                  ["two-factor", copy.rows.twoFactor, s.twoFactor ? copy.values.twoFactorOn : copy.values.twoFactorOff, s.twoFactor ? copy.actions.twoFactor.labelOn : copy.actions.twoFactor.labelOff, copy.actions.twoFactor.href],
                ] as const
              ).map(([key, label, value, action, href]) => (
                <div key={key} data-row={key} className="cn-block-profile-row">
                  <dt className="cn-block-profile-key">{label}</dt>
                  <dd className="cn-block-profile-value">{value}</dd>
                  <dd className="cn-block-profile-action">
                    <a href={href} className="cn-block-profile-link">
                      {action}
                      <span className="sr-only"> — {label}</span>
                      <ChevronRight aria-hidden="true" className="cn-block-profile-link-icon" />
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="cn-block-profile-foot">
              <FormAlert form={form} fieldTitle={copy.signOut.errorTitle} serverTitle={copy.signOut.errorTitle} />
              {asking ? (
                <div className="cn-block-profile-confirm">
                  <p ref={questionRef} tabIndex={-1} id={`${id}-signout-q`} className="cn-block-profile-question font-heading">
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
                <Button ref={signOutRef} type="button" variant="outline" size="lg" onClick={() => setAsking(true)} className="cn-block-profile-signout">
                  <LogOut aria-hidden="true" />
                  {copy.signOut.label}
                </Button>
              )}
              <p className="cn-block-profile-remove">
                <a href={copy.remove.href} className="cn-block-profile-remove-link">
                  {copy.remove.label}
                </a>
                {copy.remove.note ? <span className="cn-block-profile-remove-note">{copy.remove.note}</span> : null}
              </p>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
