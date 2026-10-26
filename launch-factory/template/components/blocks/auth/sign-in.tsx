"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import type { AnalyticsPort, AuthMethod, AuthPort } from "@/components/contract/ports"
import { CheckCircle, Lock, Mail } from "@/components/icons"
import { cn } from "@/lib/utils"
import { rise } from "@/components/motion/gsap-techniques"
import { useGsapScene } from "@/components/motion/use-gsap-scene"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"

import { InAppEscape, type InAppEscapeCopy } from "../_shared/inapp-escape"
import { BlockHeading } from "../_shared/block-heading"
import { FormAlert, FormField, SubmitButton, goTo, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import { SocialButtons, type SocialMethod } from "../_shared/social-login"

// 로그인 — 가운데 좁은 카드 한 장. 위에서부터 제목 · 소셜 로그인(카카오·네이버·구글 — 포트 methods() 에 있는 것만, 라벨 있는 전체 폭,
// 이메일 폼 위, O4) · 「또는」 줄 · 이메일·비밀번호(라벨 늘 보임, 필수 표시, 떠날 때 검사 — O2) · 비밀번호 찾기 · [로그인하기] · 가입 링크.
// 결과: 소셜은 redirectUrl 로 간다 · 2단계가 필요하면 안내(two-factor 블록으로) · 링크 메일이면 「메일을 보냈어요」 · 그 밖은 완료 안내.
// 「로그인 유지」(copy.rememberMe, 대장 A40·A52): 비밀번호 로그인 폼의 체크 1칸, 해제로 시작한다(공용 기기에서 저절로 유지되지 않게 — 선택은 사람이 한다).
// 이 칸이 있으면 signIn 에 rememberMe: 체크 값(true·false)을 항상 싣는다 — false 면 어댑터가 브라우저를 닫을 때 끝나는 세션으로 만든다.
// prop rememberMe 는 처음 체크 상태(서버가 사용자의 지난 선택을 알 때). 칸이 없으면 rememberMe 를 싣지 않아 어댑터 기본을 따른다.
// 「지난번에 쓴 방법」(copy.lastUsed + prop lastMethod, 대장 A40): 소셜 버튼 곁에 「최근 사용」 표시, 비밀번호면 폼 위에 한 줄. 조립하는 쪽이 지난 방법(쿠키 등)을 읽어 넘긴다.
// 계측(선택 track): 로그인이 끝나면 login{method}, 오류마다 form_error(칸 이름만).
export type AuthSignInCopy = {
  title: string
  lead?: string
  // 앱 안 브라우저(카카오톡·네이버·인스타그램 등)로 열렸을 때만 보이는 「기본 브라우저로 열어 주세요」 안내(대장 A61). 없으면 그리지 않는다
  inApp?: InAppEscapeCopy
  social: Record<SocialMethod, string>
  divider: string
  email: { label: string; marker: string; placeholder?: string }
  // 비밀번호 보기 토글의 이름(aria-pressed — 이름은 바뀌지 않는다)과 Caps Lock 안내(대장 A41). show 가 있을 때만 토글을 그린다
  password: { label: string; marker: string; show?: string; capsLock?: string }
  errors: { emailRequired: string; emailFormat: string; passwordRequired: string }
  // 비밀번호 재설정 쪽이 없는 사이트는 링크를 그리지 않는다(없는 쪽으로 가는 링크 금지).
  forgot?: { label: string; href: string }
  submit: string
  pending: string
  alert: { field: string; server: string }
  notices: SubmitNotices
  methods: { loading: string; error: string; retry: string }
  signUp?: { text: string; label: string; href: string }
  done: { title: string; body: string; label?: string; href?: string }
  twoFactor: { title: string; body: string; label: string; href: string }
  emailSent: { title: string; body: string }
  // 「로그인 유지」 체크 글(없으면 칸이 없다)
  rememberMe?: { label: string }
  // 지난번에 쓴 방법 표시: badge 는 버튼 곁 글자, password 는 비밀번호로 로그인했던 사람에게 폼 위에 보이는 한 줄
  lastUsed?: { badge: string; password: string }
}
export type AuthSignInProps = BlockBase<AuthSignInCopy> & {
  methods: AuthPort["methods"]
  signIn: AuthPort["signIn"]
  track?: AnalyticsPort["track"]
  // 공급자 화면으로 갈 때(기본 location.assign)
  onRedirect?: (url: string) => void
  // 서버가 미리 읽은 로그인 방법(주면 첫 HTML 에 버튼이 있다)
  initial?: { methods?: AuthMethod[] }
  // 「로그인 유지」의 처음 체크 상태(기본 해제)
  rememberMe?: boolean
  // 지난번에 로그인한 방법(copy.lastUsed 와 함께 있을 때 표시)
  lastMethod?: AuthMethod
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthSignIn({ copy, methods, signIn, track, onRedirect, initial, rememberMe = false, lastMethod, id = "sign-in", className }: AuthSignInProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const list = usePortRead(methods, initial?.methods)
  const [busy, setBusy] = React.useState<SocialMethod | null>(null)
  const [remember, setRemember] = React.useState(rememberMe)
  const [outcome, setOutcome] = React.useState<"done" | "two-factor" | "sent" | null>(null)
  const doneRef = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (outcome) doneRef.current?.focus()
  }, [outcome])
  const form = usePortForm({
    id,
    notices: copy.notices,
    validators: {
      email: (v) => (!v ? copy.errors.emailRequired : EMAIL.test(v) ? null : copy.errors.emailFormat),
      password: (v) => (v ? null : copy.errors.passwordRequired),
    },
    onError: (e) => track?.("form_error", { form: "sign-in", fields: e.fields, kind: e.kind }),
  })
  const ready = list.state.status === "ready" ? list.state.data : null
  // 방법 목록이 비면(빈 응답) 이메일 로그인을 기본으로 둔다 — 로그인 수단이 하나도 없는 화면을 만들지 않는다
  const showEmail = !ready || ready.length === 0 || ready.includes("password")

  const pickSocial = async (m: SocialMethod) => {
    setBusy(m)
    const r = await form.run(() => signIn({ method: m }), { retry: () => void pickSocial(m) })
    setBusy(null)
    if (r?.redirectUrl) goTo(r.redirectUrl, onRedirect)
  }
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const v = form.validate(["email", "password"])
    if (!v) return
    const r = await form.run(() => signIn({ method: "password", email: v.email, password: v.password, ...(copy.rememberMe ? { rememberMe: remember } : {}) }))
    if (!r) return
    if (r.needsTwoFactor) return setOutcome("two-factor")
    if (r.redirectUrl) return goTo(r.redirectUrl, onRedirect)
    track?.("login", { method: "password" })
    setOutcome(r.emailSent ? "sent" : "done")
  }

  const result: { title: string; body: string; label?: string; href?: string } | null = outcome === "two-factor" ? copy.twoFactor : outcome === "sent" ? copy.emailSent : outcome === "done" ? copy.done : null
  return (
    <section ref={ref} id={id} data-block="auth-sign-in" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div data-enter className="mx-auto flex w-full max-w-md flex-col gap-8 border px-5 py-8 md:px-10 md:py-10">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} className="gap-2" />
        {result ? (
          <div role="status" className="flex flex-col items-start gap-3">
            {outcome === "two-factor" ? <Lock aria-hidden="true" className="size-8 shrink-0" /> : outcome === "sent" ? <Mail aria-hidden="true" className="size-8 shrink-0" /> : <CheckCircle aria-hidden="true" className="size-8 shrink-0" />}
            <h3 ref={doneRef} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
              {result.title}
            </h3>
            <p className="text-base leading-[1.7]">{result.body}</p>
            {result.href && result.label ? (
              <Button size="lg" nativeButton={false} role="link" render={<a href={result.href} />} className="mt-2">
                {result.label}
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div aria-busy={list.state.status === "loading" || undefined} className="flex w-full flex-col gap-3 empty:hidden">
              {list.state.status === "loading" ? <ReadLoading label={copy.methods.loading} lines={2} /> : null}
              {list.state.status === "error" ? <ReadError state={list.state} title={copy.methods.error} retryLabel={copy.methods.retry} /> : null}
              {ready?.includes("google") && copy.inApp ? <InAppEscape copy={copy.inApp} /> : null}
                {ready ? <SocialButtons methods={ready} labels={copy.social} onPick={pickSocial} busy={busy} lastMethod={lastMethod} lastLabel={copy.lastUsed?.badge} /> : null}
            </div>
            {showEmail ? (
              <>
                {ready && ready.some((m) => m !== "password") ? (
                  <p className="flex items-center gap-3 text-base before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                    <span className="shrink-0">{copy.divider}</span>
                  </p>
                ) : null}
                <form method="post" id={form.formId} noValidate aria-labelledby={`${id}-title`} aria-busy={form.pending || undefined} onSubmit={onSubmit} className="flex flex-col gap-5">
                  <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
                  {copy.lastUsed && lastMethod === "password" ? (
                    <p data-last-used="password" className="flex flex-wrap items-center gap-2 text-base leading-[1.6]">
                      <span className="inline-flex items-center rounded-sm border border-current px-2 py-0.5 text-base leading-[1.4]">{copy.lastUsed.badge}</span>
                      {copy.lastUsed.password}
                    </p>
                  ) : null}
                  <FormField form={form} name="email" label={copy.email.label} marker={copy.email.marker} type="email" autoComplete="username" inputMode="email" placeholder={copy.email.placeholder} />
                  <FormField form={form} name="password" label={copy.password.label} marker={copy.password.marker} type="password" autoComplete="current-password" showLabel={copy.password.show} capsLockNote={copy.password.capsLock} />
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    {copy.rememberMe ? (
                      <Field orientation="horizontal" className="w-auto items-center gap-3">
                        <Checkbox id={`${id}-rememberMe`} name="rememberMe" data-remember="" aria-labelledby={`${id}-rememberMe-label`} checked={remember} onCheckedChange={setRemember} />
                        <FieldLabel id={`${id}-rememberMe-label`} htmlFor={`${id}-rememberMe`}>{copy.rememberMe.label}</FieldLabel>
                      </Field>
                    ) : null}
                    {copy.forgot ? (
                      <a href={copy.forgot.href} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
                        {copy.forgot.label}
                      </a>
                    ) : null}
                  </div>
                  <SubmitButton form={form} label={copy.submit} pendingLabel={copy.pending} className="w-full" />
                </form>
              </>
            ) : (
              <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
            )}
            {copy.signUp ? (
              <p className="border-t pt-6 text-base leading-[1.6]">
                {copy.signUp.text}{" "}
                <a href={copy.signUp.href} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
                  {copy.signUp.label}
                </a>
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
