"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, AuthMethod, AuthPort, ConsentInput } from "@/registry/factory/contract/ports"
import { Check, CheckCircle, ChevronLeft, ExternalLink, Mail } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Checkbox } from "@/registry/factory/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/registry/factory/ui/field"

import { InAppEscape, type InAppEscapeCopy } from "../_shared/inapp-escape"
import { BlockHeading } from "../_shared/block-heading"
import { FieldMessage, FormAlert, FormField, SubmitButton, fieldAria, goTo, usePortForm, type FieldErrors } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import { SocialButtons, type SocialMethod } from "../_shared/social-login"

// 가입 + 동의 — 단계 줄(① 계정 ② 동의 ③ 완료) 아래 한 단계씩. data-flow="signup" data-step 이 지금 단계, data-steps 가 전체 단계 수다
// (해지 흐름 retention/cancel-flow 의 단계 수가 이 수를 넘지 않는다 — 마케팅 규칙 L4).
//   ① 소셜 가입(카카오·네이버·구글, 이메일 폼 위 — O4) 또는 이메일·비밀번호 두 칸만(O1 — 이름·회사·전화는 가입 뒤에 묻는다). 떠날 때 검사(O2).
//   ② 필수 동의(이용약관 · 개인정보 수집·이용 · 만 14세 이상 확인)는 한 칸씩 따로, 선택 동의(혜택 소식 — 이메일·문자·카카오톡·앱 알림)는 따로 묶고 모두 해제로 시작한다
//      (data-consent="required|optional" — L2·L12, 전자상거래법 §21-2①2). 「전체 동의」는 두지 않는다(선택까지 한 번에 켜지 않게).
//   ③ 완료(메일 확인이 필요하면 그 안내). 소셜은 ②에서 [가입하기]를 누르면 공급자 화면으로 간다(동의를 먼저 받는다).
// 만 14세 이상 확인(copy.ageOver14 — 개인정보 보호법 제22조의2 제1항: 만 14세 미만은 법정대리인 동의가 필요한데 그 절차가 없는 제품은 가입 때 확인만 받는다, 대장 D60·A52):
// 필수 체크 1칸, 미리 켜 두지 않는다. 체크해야 가입 요청에 consents.ageOver14: true 가 실린다. copy.ageOver14 를 주지 않으면 이 칸이 없고 가입 요청에도 실리지 않는다
// (법정대리인 동의 절차를 따로 갖춘 제품). 어댑터가 이 칸을 요구하는데(launch-factory 기본) 문구를 빼면 모든 가입이 필드 오류로 끝난다.
// 계측(선택 track): ①을 마치면 signup_start{method}, 가입이 끝나면 signup_complete{method, marketingConsent}, 오류마다 form_error.
// ── P3-6 AUTHBLK(UX 감사 A02·A03·A04·A05·K09, factory-rules.md §23 U2·U5) ──
//   · A02 이미 있는 이메일: 포트가 code "email_exists"(또는 "user_already_exists")로 거절하면 ①로 돌아가 이메일 칸 오류 + copy.exists 알림(role=alert)에 [로그인]·[비밀번호 찾기] 링크 둘을 보인다
//     포커스는 오류 난 이메일 칸으로 간다(오류는 그 칸으로 — 제출 감사 규칙). 알림은 이메일 칸 바로 뒤에 있어 Tab 한 번이면 두 행동에 닿는다.
//     (막다른 오류가 아니다). copy.exists 가 없으면 지금처럼 칸 오류만. 어댑터는 중복 가입을 이 code 로 돌려줘야 한다(없으면 알림이 안 뜬다).
//   · A03·U5 약한 비밀번호: isWeakPassword(비밀번호) 가 true 면 ①에서 막고 copy.errors.passwordWeak 를 비밀번호 칸에 보이며 포커스가 칸으로 간다. 길이 규칙은 입력 전에 hint 로 보인다.
//   · A04 약관·개인정보 「보기」 링크는 새 탭(target=_blank rel=noopener)으로 연다 — 가입 화면이 그대로 남아 단계·입력이 사라지지 않는다. 입력을 저장해 되살리는 길은 쓰지 않는다:
//     비밀번호를 sessionStorage 에 두는 것이라 더 위험하고, 되돌아오는 길(뒤로 가기)은 브라우저·번들러마다 달라 보장하지 못한다. copy.newTab 이 있으면 링크 이름에 「(새 탭에서 열려요)」를 덧붙인다.
//   · A05 마케팅 채널: copy.marketing.channels 에 문구가 있는 채널만, prop channels 를 주면 그중에서만 그린다(제품이 쓰지 않는 채널은 묻지 않는다). 하나도 없으면 선택 동의 묶음이 없다.
//   · K09 필수/선택 분리: copy.required 가 있으면 필수 동의도 이름 있는 fieldset(data-consent-group="required")으로 묶어 선택 묶음(data-consent-group="optional")과 구조·모양이 갈린다. 미리 켜진 칸은 없다.
export type Channel = "email" | "sms" | "kakao" | "push"
/** 이미 가입된 이메일을 뜻하는 포트 실패 code(대소문자 무시) — 어댑터가 이 중 하나로 돌려준다 */
export const ACCOUNT_EXISTS_CODES: readonly string[] = ["email_exists", "user_already_exists"]
const CHANNELS: readonly Channel[] = ["email", "sms", "kakao", "push"]
export const SIGN_UP_STEPS = 3

export type AuthSignUpConsentsCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  lead?: string
  steps: [string, string, string]
  // 앱 안 브라우저(카카오톡·네이버·인스타그램 등)로 열렸을 때만 보이는 「기본 브라우저로 열어 주세요」 안내(대장 A61). 없으면 그리지 않는다
  inApp?: InAppEscapeCopy
  social: Record<SocialMethod, string>
  divider: string
  email: { label: string; marker: string; placeholder?: string }
  // 비밀번호 보기 토글의 이름(aria-pressed — 이름은 바뀌지 않는다)과 Caps Lock 안내(대장 A41). show 가 있을 때만 토글을 그린다
  password: { label: string; marker: string; hint: string; show?: string; capsLock?: string }
  // passwordWeak: isWeakPassword 가 막았을 때 비밀번호 칸 아래에 보이는 앱의 규칙 문구(없으면 passwordShort 로 대신한다)
  errors: { emailRequired: string; emailFormat: string; passwordRequired: string; passwordShort: string; passwordWeak?: string; termsRequired: string; privacyRequired: string }
  // 약관·개인정보 「보기」 링크가 새 탭에서 열린다는 말(링크 이름 뒤에 덧붙는다, A04)
  newTab?: string
  // 이미 가입된 이메일(code email_exists)일 때 이메일 칸 오류 곁에 뜨는 알림과 두 행동(A02)
  exists?: { title: string; body: string; signIn: { label: string; href: string }; reset: { label: string; href: string } }
  // 필수 동의 묶음의 이름(K09) — 있으면 필수 동의도 fieldset+legend 로 묶는다
  required?: { legend: string }
  next: string
  back: string
  consentsTitle: string
  // {provider} 자리에 고른 소셜 이름(소셜로 가입할 때 ② 머리말)
  viaSocial: string
  providers: Record<SocialMethod, string>
  terms: { label: string; marker: string; href: string; view: string }
  privacy: { label: string; marker: string; href: string; view: string }
  // 만 14세 이상 확인(필수 체크 — 링크 없음). help 는 체크 아래 한 줄 설명, required 는 체크 없이 눌렀을 때 오류
  ageOver14?: { label: string; marker: string; help?: string; required: string }
  // channels: 이 제품이 실제로 쓰는 채널의 문구만 둔다(A05) — 문구가 없는 채널은 그리지 않는다
  marketing: { legend: string; marker: string; hint: string; channels: Partial<Record<Channel, string>> }
  submit: string
  pending: string
  alert: { field: string; server: string }
  notices: SubmitNotices
  methods: { loading: string; error: string; retry: string }
  done: { title: string; body: string; label?: string; href?: string }
  emailSent: { title: string; body: string }
  signIn?: { text: string; label: string; href: string }
}
export type AuthSignUpConsentsProps = BlockBase<AuthSignUpConsentsCopy> & {
  methods: AuthPort["methods"]
  signUp: AuthPort["signUp"]
  track?: AnalyticsPort["track"]
  onRedirect?: (url: string) => void
  // 서버가 미리 읽은 방법 · 동의 단계에서 시작(소셜 공급자에서 돌아와 동의만 남았을 때 — method 는 그 공급자)
  initial?: { methods?: AuthMethod[]; step?: 1 | 2; method?: AuthMethod }
  /** 이 제품이 쓰는 마케팅 수신 채널(A05). 주면 copy.marketing.channels 중 여기 든 것만 그린다. 안 주면 문구가 있는 채널이 전부다 */
  channels?: readonly Channel[]
  /** 약한 비밀번호 거르개(A03·U5) — true 면 막는다. 흔한·유출 비밀번호 목록 대조는 앱 몫이다(비동기 가능) */
  isWeakPassword?: (password: string) => boolean | Promise<boolean>
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

export function AuthSignUpConsents({ copy, methods, signUp, track, onRedirect, initial, channels, isWeakPassword, id = "sign-up", className }: AuthSignUpConsentsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const list = usePortRead(methods, initial?.methods)
  const [step, setStep] = React.useState<number>(initial?.step ?? 1)
  const [method, setMethod] = React.useState<AuthMethod>(initial?.method ?? "password")
  const [account, setAccount] = React.useState<{ email: string; password: string } | null>(null)
  const [required, setRequired] = React.useState({ terms: false, privacy: false, ageOver14: false })
  const [marketing, setMarketing] = React.useState<Record<Channel, boolean>>({ email: false, sms: false, kakao: false, push: false })
  const [emailSent, setEmailSent] = React.useState(false)
  const [exists, setExists] = React.useState(false)
  const offered = CHANNELS.filter((ch) => !!copy.marketing.channels[ch] && (!channels || channels.includes(ch)))
  const stepTitle = React.useRef<HTMLHeadingElement>(null)
  const moved = React.useRef(false)
  React.useEffect(() => {
    // 단계를 옮긴 뒤에만(첫 그림에서는 포커스를 가져가지 않는다)
    if (moved.current) stepTitle.current?.focus()
  }, [step])
  const go = (n: number) => {
    moved.current = true
    setStep(n)
  }
  const form = usePortForm({
    id,
    notices: copy.notices,
    validators: {
      email: (v) => (!v ? copy.errors.emailRequired : EMAIL.test(v) ? null : copy.errors.emailFormat),
      password: (v) => (!v ? copy.errors.passwordRequired : v.length < MIN_PASSWORD ? copy.errors.passwordShort : null),
      terms: (v) => (v ? null : copy.errors.termsRequired),
      privacy: (v) => (v ? null : copy.errors.privacyRequired),
      ageOver14: (v) => (v ? null : (copy.ageOver14?.required ?? "")),
    },
    onError: (e) => track?.("form_error", { form: "sign-up", fields: e.fields, kind: e.kind }),
  })
  const ready = list.state.status === "ready" ? list.state.data : null
  const showEmail = !ready || ready.length === 0 || ready.includes("password")

  const pickSocial = (m: SocialMethod) => {
    setMethod(m)
    track?.("signup_start", { method: m })
    go(2)
  }
  const toConsents = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setExists(false)
    const v = form.validate(["email", "password"])
    if (!v) return
    // 약한 비밀번호는 ②로 가기 전에 그 칸 오류로 끝낸다(같은 오류 경로 — 포커스가 비밀번호 칸으로 간다)
    if (isWeakPassword) {
      const ok = await form.run(async () => ((await isWeakPassword(v.password)) ? { ok: false as const, fieldErrors: { password: [copy.errors.passwordWeak ?? copy.errors.passwordShort] } } : { ok: true as const, data: true as const }))
      if (!ok) return
    }
    setMethod("password")
    setAccount({ email: v.email, password: v.password })
    track?.("signup_start", { method: "password" })
    go(2)
  }
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const names = copy.ageOver14 ? ["terms", "privacy", "ageOver14"] : ["terms", "privacy"]
    if (!form.validate(names, { terms: required.terms ? "yes" : "", privacy: required.privacy ? "yes" : "", ageOver14: required.ageOver14 ? "yes" : "" })) return
    const consents: ConsentInput = { terms: true, privacy: true, ...(copy.ageOver14 ? { ageOver14: true as const } : {}), ...(offered.length ? { marketing: Object.fromEntries(offered.map((ch) => [ch, marketing[ch]])) } : {}) }
    // 포트가 ① 칸(이메일·비밀번호) 오류를 주면 ①로 돌아가 그 칸에 오류를 보이고 포커스한다(적은 값은 그대로)
    const failed: { back?: FieldErrors; exists?: boolean } = {}
    const r = await form.run(async () => {
      const res = await signUp(method === "password" && account ? { method, email: account.email, password: account.password, consents } : { method, consents })
      if (!res.ok && (res.fieldErrors?.email?.length || res.fieldErrors?.password?.length)) failed.back = res.fieldErrors
      if (!res.ok && res.code && ACCOUNT_EXISTS_CODES.includes(res.code.toLowerCase())) failed.exists = true
      return res
    })
    if (!r) {
      if (failed.exists && copy.exists && method === "password") {
        // 이미 있는 이메일: ①로 돌아가 이메일 칸 오류(포트 문구가 없으면 알림 제목)와 행동 알림을 보인다
        form.showErrors(failed.back?.email?.length ? { email: failed.back.email } : { email: [copy.exists.title] })
        setExists(true)
        go(1)
      } else if (failed.back && method === "password") {
        form.showErrors(failed.back)
        go(1)
      }
      return
    }
    if (r.redirectUrl) return goTo(r.redirectUrl, onRedirect)
    track?.("signup_complete", { method, marketingConsent: offered.some((c) => marketing[c]) })
    setEmailSent(!!r.emailSent)
    go(3)
  }
  const check = (name: "terms" | "privacy" | "ageOver14") => (checked: boolean) => {
    setRequired((s) => ({ ...s, [name]: checked }))
    form.clear(name)
  }
  const done: { title: string; body: string; label?: string; href?: string } = emailSent ? copy.emailSent : copy.done
  // K09: 필수 동의를 이름 있는 묶음으로(선택 묶음과 구조가 갈린다). copy.required 가 없으면 지금처럼 목록만
  const wrapRequired = (list: React.ReactNode) =>
    copy.required ? (
      <fieldset data-consent-group="required" className="flex min-w-0 flex-col gap-1 border px-4 py-3 md:px-6">
        <legend className="px-1 text-base leading-[1.5] font-heading">{copy.required.legend}</legend>
        {list}
      </fieldset>
    ) : (
      list
    )

  return (
    <section ref={ref} id={id} data-block="auth-sign-up-consents" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div data-enter className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        <ol aria-label={copy.title} className="grid grid-cols-3 border-b">
          {copy.steps.map((label, i) => (
            <li key={label} aria-current={step === i + 1 ? "step" : undefined} data-done={step > i + 1 ? "" : undefined} className="flex min-w-0 flex-col items-start gap-2 border-b-2 border-transparent pb-4 sm:flex-row sm:items-center sm:gap-3 aria-[current=step]:border-foreground">
              <span data-numeric className="flex size-9 shrink-0 items-center justify-center border text-base in-aria-[current=step]:bg-primary in-aria-[current=step]:text-primary-foreground in-data-[done]:bg-muted">
                {step > i + 1 ? <Check aria-hidden="true" className="size-4" /> : i + 1}
              </span>
              <span className="text-base leading-[1.4] in-aria-[current=step]:font-medium">{label}</span>
            </li>
          ))}
        </ol>
        <div data-flow="signup" data-step={step} data-steps={SIGN_UP_STEPS} className="flex flex-col gap-6">
          {step === 1 ? (
            <>
              <h3 ref={stepTitle} tabIndex={-1} className="text-[1.25rem] leading-[1.35] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                {copy.steps[0]}
              </h3>
              <div aria-busy={list.state.status === "loading" || undefined} className="flex w-full flex-col gap-3 empty:hidden">
                {list.state.status === "loading" ? <ReadLoading label={copy.methods.loading} lines={2} /> : null}
                {list.state.status === "error" ? <ReadError state={list.state} title={copy.methods.error} retryLabel={copy.methods.retry} /> : null}
                {ready?.includes("google") && copy.inApp ? <InAppEscape copy={copy.inApp} /> : null}
                {ready ? <SocialButtons methods={ready} labels={copy.social} onPick={pickSocial} /> : null}
              </div>
              {showEmail ? (
                <>
                  {ready && ready.some((m) => m !== "password") ? (
                    <p className="flex items-center gap-3 text-base before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                      <span className="shrink-0">{copy.divider}</span>
                    </p>
                  ) : null}
                  <form method="post" id={form.formId} noValidate aria-label={copy.steps[0]} onSubmit={toConsents} className="flex flex-col gap-5">
                    <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
                    <FormField form={form} name="email" label={copy.email.label} marker={copy.email.marker} type="email" autoComplete="email" inputMode="email" placeholder={copy.email.placeholder} defaultValue={account?.email} />
                    {exists && copy.exists ? (
                      <div role="alert" data-account-exists="" className="flex flex-col gap-3 border-s-4 bg-muted/40 px-4 py-4 outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
                        <p className="text-[1.125rem] leading-[1.4] font-heading">{copy.exists.title}</p>
                        <p className="text-base leading-[1.6]">{copy.exists.body}</p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button size="lg" nativeButton={false} role="link" render={<a href={copy.exists.signIn.href} />}>
                            {copy.exists.signIn.label}
                          </Button>
                          <Button variant="outline" size="lg" nativeButton={false} role="link" render={<a href={copy.exists.reset.href} />}>
                            {copy.exists.reset.label}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <FormField form={form} name="password" label={copy.password.label} marker={copy.password.marker} type="password" autoComplete="new-password" showLabel={copy.password.show} capsLockNote={copy.password.capsLock} hint={copy.password.hint} defaultValue={account?.password} />
                    <Button type="submit" size="lg" disabled={form.pending} focusableWhenDisabled className="w-full">
                      {copy.next}
                    </Button>
                  </form>
                </>
              ) : null}
              {copy.signIn ? (
                <p className="border-t pt-6 text-base leading-[1.6]">
                  {copy.signIn.text}{" "}
                  <a href={copy.signIn.href} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
                    {copy.signIn.label}
                  </a>
                </p>
              ) : null}
            </>
          ) : step === 2 ? (
            <form method="post" id={form.formId} noValidate aria-labelledby={`${id}-consents-title`} aria-busy={form.pending || undefined} onSubmit={onSubmit} className="flex flex-col gap-6">
              <h3 id={`${id}-consents-title`} ref={stepTitle} tabIndex={-1} className="text-[1.25rem] leading-[1.35] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                {method === "password" ? copy.consentsTitle : copy.viaSocial.replace("{provider}", copy.providers[method as SocialMethod] ?? "")}
              </h3>
              <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
              {wrapRequired(
              <ul className="flex flex-col border-y">
                {(["terms", "privacy"] as const).map((name) => {
                  const c = copy[name]
                  const aria = fieldAria(form, name)
                  return (
                    <li key={name} className="border-b py-3 last:border-b-0">
                      <Field orientation="horizontal" className="items-start gap-3">
                        <Checkbox id={`${id}-${name}`} name={name} data-consent="required" checked={required[name]} onCheckedChange={check(name)} {...aria} aria-required="true" />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <FieldLabel htmlFor={`${id}-${name}`}>
                            {c.label}
                            <span className="ms-1 text-base">{c.marker}</span>
                          </FieldLabel>
                          <FieldMessage form={form} name={name} />
                        </div>
                        <a href={c.href} target="_blank" rel="noopener" data-new-tab="" className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4 shrink-0 self-center">
                          {c.view}
                          <ExternalLink aria-hidden="true" className="ms-1 size-4 shrink-0" />
                          <span className="sr-only">
                            {" "}
                            — {c.label}
                            {copy.newTab ? ` (${copy.newTab})` : ""}
                          </span>
                        </a>
                      </Field>
                    </li>
                  )
                })}
                {copy.ageOver14 ? (
                  <li className="border-b py-3 last:border-b-0">
                    <Field orientation="horizontal" className="items-start gap-3">
                      <Checkbox id={`${id}-ageOver14`} name="ageOver14" data-consent="required" checked={required.ageOver14} onCheckedChange={check("ageOver14")} {...fieldAria(form, "ageOver14", copy.ageOver14.help ? `${id}-ageOver14-help` : undefined)} aria-required="true" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <FieldLabel htmlFor={`${id}-ageOver14`}>
                          {copy.ageOver14.label}
                          <span className="ms-1 text-base">{copy.ageOver14.marker}</span>
                        </FieldLabel>
                        {copy.ageOver14.help ? (
                          <FieldDescription id={`${id}-ageOver14-help`} className="text-base leading-[1.6] text-foreground">
                            {copy.ageOver14.help}
                          </FieldDescription>
                        ) : null}
                        <FieldMessage form={form} name="ageOver14" />
                      </div>
                    </Field>
                  </li>
                ) : null}
              </ul>
              )}
              {offered.length ? (
              <fieldset aria-describedby={`${id}-marketing-hint`} data-consent-group="optional" className="flex min-w-0 flex-col gap-3 border border-dashed px-4 py-4 md:px-6">
                <legend className="px-1 text-base leading-[1.5] font-heading">
                  {copy.marketing.legend}
                  <span className="ms-1 text-base">{copy.marketing.marker}</span>
                </legend>
                <FieldDescription id={`${id}-marketing-hint`} className="text-base leading-[1.6] text-foreground">
                  {copy.marketing.hint}
                </FieldDescription>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  {offered.map((ch) => (
                    <Field key={ch} orientation="horizontal" className="items-center gap-3">
                      <Checkbox id={`${id}-mk-${ch}`} name={`marketing-${ch}`} data-consent="optional" checked={marketing[ch]} onCheckedChange={(v) => setMarketing((s) => ({ ...s, [ch]: v }))} />
                      <FieldLabel htmlFor={`${id}-mk-${ch}`}>{copy.marketing.channels[ch]}</FieldLabel>
                    </Field>
                  ))}
                </div>
              </fieldset>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="lg" onClick={() => go(1)} className="-ms-3">
                  <ChevronLeft aria-hidden="true" />
                  {copy.back}
                </Button>
                <SubmitButton form={form} label={copy.submit} pendingLabel={copy.pending} approval={{ action: "sign-up", hint: copy.humanHint }} />
              </div>
            </form>
          ) : (
            <div role="status" className="flex flex-col items-start gap-3">
              {emailSent ? <Mail aria-hidden="true" className="size-8 shrink-0" /> : <CheckCircle aria-hidden="true" className="size-8 shrink-0" />}
              <h3 ref={stepTitle} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                {done.title}
              </h3>
              <p className="text-base leading-[1.7]">{done.body}</p>
              {done.href && done.label ? (
                <Button size="lg" nativeButton={false} role="link" render={<a href={done.href} />} className="mt-2">
                  {done.label}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
