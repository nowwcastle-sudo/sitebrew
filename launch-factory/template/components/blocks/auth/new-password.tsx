"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import type { AnalyticsPort, AuthPort } from "@/components/contract/ports"
import { AlertCircle, CheckCircle } from "@/components/icons"
import { cn } from "@/lib/utils"
import { rise } from "@/components/motion/gsap-techniques"
import { useGsapScene } from "@/components/motion/use-gsap-scene"
import { Button } from "@/components/ui/button"

import { BlockHeading } from "../_shared/block-heading"
import { FormAlert, FormField, SubmitButton, usePortForm } from "../_shared/port-form"
import type { SubmitNotices } from "../_shared/submit-guard"

// 새 비밀번호 정하기(재설정 마무리, 대장 D236) — password-reset 이 보낸 메일의 링크가 돌려보내는 쪽에서 쓴다. 조립하는 쪽이 주소의 ?token= 을 읽어 token 으로 넘긴다
// (토큰이 없거나 ?error=INVALID_TOKEN 으로 왔으면 token 을 비워 둔다 — 폼 없이 「링크가 더는 열리지 않아요」 + 재설정 다시 받기로 간다).
// 새 비밀번호(8자 이상) + 한 번 더(같은 값) → resetPassword({ token, newPassword }). 성공하면 「바꿨어요」 + 로그인으로. 포트가 code: "invalid_token"(틀림·만료·이미 씀)을 주면
// 폼을 걷고 같은 안내로 간다. 값은 화면에만 있고 계측에 싣지 않는다(오류 종류와 칸 이름만). 비밀번호 칸은 붙여넣기를 막지 않는다(WCAG 3.3.8).
// 한 칸 판(confirmField: false, 운영자 결정 2026-10-03): 「한 번 더」 칸을 없앤다. 대신 「비밀번호 보기」 토글이 반드시 있다(copy.newPassword.show 를 타입이 요구한다) — 눈으로 확인하는 것이
// 두 번 치기를 대신한다. 한 칸이면 mismatch·confirm 은 검사도 문구도 없다. 기본(confirmField 생략)은 지금처럼 두 칸이다(뒤로 호환).
// 약한 비밀번호(대장 A03·U5): isWeakPassword(새 비밀번호) 가 true 면 보내기 전에 막고 copy.errors.weak 를 그 칸에 보이며 포커스가 그 칸으로 간다(흔하거나 유출된 비밀번호 대조는 앱이 한다 — NIST SP 800-63B).
// 길이 규칙은 입력 전에 hint 로 이미 보인다. 약한 비밀번호 검사는 포트 호출과 같은 경로(form.run)를 타서 보내는 중 표시·시간 초과 보호·오류 포커스가 같다.
export type AuthNewPasswordCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  lead?: string
  newPassword: { label: string; marker: string; hint: string; show?: string; capsLock?: string }
  // 두 칸 판에서만 쓴다(confirmField: false 면 없어도 된다)
  confirm?: { label: string; marker: string }
  // mismatch 는 두 칸 판에서만. weak 는 isWeakPassword 를 줄 때 쓴다(앱의 규칙 문구 — 없으면 short 로 대신한다)
  errors: { required: string; short: string; mismatch?: string; weak?: string }
  submit: string
  pending: string
  alert: { field: string; server: string }
  notices: SubmitNotices
  done: { title: string; body: string; next: { label: string; href: string } }
  invalid: { title: string; body: string; retry: { label: string; href: string } }
}
/** 두 칸 판(기본)이 요구하는 copy — 한 번 더 칸 문구와 불일치 문구가 있다 */
export type AuthNewPasswordTwoFieldCopy = AuthNewPasswordCopy & { confirm: NonNullable<AuthNewPasswordCopy["confirm"]>; errors: { mismatch: string } }
type AuthNewPasswordBase = BlockBase<AuthNewPasswordCopy> & {
  resetPassword: NonNullable<AuthPort["resetPassword"]>
  /** 메일 링크가 돌려보낸 토큰. 비어 있으면 틀린 링크로 본다 */
  token?: string
  track?: AnalyticsPort["track"]
  /** 약한 비밀번호 거르개(A03·U5) — true 면 막는다. 흔한·유출 비밀번호 목록 대조는 앱 몫이다(비동기 가능) */
  isWeakPassword?: (password: string) => boolean | Promise<boolean>
}
export type AuthNewPasswordProps = AuthNewPasswordBase &
  (
    // 두 칸(기본): 한 번 더 칸 문구와 불일치 문구가 필요하다
    | { confirmField?: true; copy: AuthNewPasswordTwoFieldCopy }
    // 한 칸: 보기 토글 이름이 필요하다 — 한 번 더 칸이 없는 대신 눈으로 확인한다
    | { confirmField: false; copy: { newPassword: { show: string } } }
  )

const MIN_LENGTH = 8

export function AuthNewPassword({ copy, resetPassword, token, track, isWeakPassword, confirmField, id = "new-password", className }: AuthNewPasswordProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.08 })
  })
  const confirmCopy = confirmField === false ? undefined : copy.confirm
  const [done, setDone] = React.useState(false)
  const [rejected, setRejected] = React.useState(false)
  const resultRef = React.useRef<HTMLHeadingElement>(null)
  const linkBad = !token || rejected
  React.useEffect(() => {
    if (done || rejected) resultRef.current?.focus()
  }, [done, rejected])
  const form = usePortForm({
    id,
    notices: copy.notices,
    validators: {
      newPassword: (v) => (!v ? copy.errors.required : v.length >= MIN_LENGTH ? null : copy.errors.short),
      ...(confirmCopy ? { confirm: (v: string) => (v ? null : copy.errors.required) } : {}),
    },
    onError: (e) => track?.("form_error", { form: "new-password", fields: e.fields, kind: e.kind }),
  })
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token) return
    const v = form.validate(confirmCopy ? ["newPassword", "confirm"] : ["newPassword"])
    if (!v) return
    if (confirmCopy && v.confirm !== v.newPassword) {
      form.showErrors({ confirm: [copy.errors.mismatch ?? ""] })
      track?.("form_error", { form: "new-password", fields: ["confirm"], kind: "field" })
      return
    }
    let tokenBad = false
    const r = await form.run(async () => {
      // 약한 비밀번호는 포트를 부르기 전에 그 칸 오류로 끝낸다 — 같은 오류 경로라 포커스가 그 칸으로 간다
      if (isWeakPassword && (await isWeakPassword(v.newPassword))) return { ok: false as const, fieldErrors: { newPassword: [copy.errors.weak ?? copy.errors.short] } }
      const res = await resetPassword({ token, newPassword: v.newPassword })
      if (!res.ok && res.code === "invalid_token") tokenBad = true
      return res
    })
    if (r) setDone(true)
    else if (tokenBad) setRejected(true)
  }
  return (
    <section ref={ref} id={id} data-block="auth-new-password" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="max-w-3xl">
        {done ? (
          <div role="status" className="flex items-start gap-4 border px-5 py-6 md:px-8">
            <CheckCircle aria-hidden="true" className="size-8 shrink-0" />
            <div className="flex min-w-0 flex-col gap-3">
              <h3 ref={resultRef} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                {copy.done.title}
              </h3>
              <p className="text-base leading-[1.7]">{copy.done.body}</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button size="lg" nativeButton={false} role="link" render={<a href={copy.done.next.href} />}>
                  {copy.done.next.label}
                </Button>
              </div>
            </div>
          </div>
        ) : linkBad ? (
          <div role="alert" data-link-invalid="" className="flex items-start gap-4 border px-5 py-6 md:px-8">
            <AlertCircle aria-hidden="true" className="size-8 shrink-0" />
            <div className="flex min-w-0 flex-col gap-3">
              <h3 ref={resultRef} tabIndex={-1} className="text-[1.563rem] leading-[1.25] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                {copy.invalid.title}
              </h3>
              <p className="text-base leading-[1.7]">{copy.invalid.body}</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button size="lg" nativeButton={false} role="link" render={<a href={copy.invalid.retry.href} />}>
                  {copy.invalid.retry.label}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form method="post" id={form.formId} noValidate aria-labelledby={`${id}-title`} aria-busy={form.pending || undefined} data-confirm-field={confirmCopy ? "" : undefined} onSubmit={onSubmit} className="flex flex-col gap-4">
            <FormAlert form={form} fieldTitle={copy.alert.field} serverTitle={copy.alert.server} />
            <FormField form={form} name="newPassword" label={copy.newPassword.label} marker={copy.newPassword.marker} type="password" autoComplete="new-password" hint={copy.newPassword.hint} showLabel={copy.newPassword.show} capsLockNote={copy.newPassword.capsLock} />
            {confirmCopy ? <FormField form={form} name="confirm" label={confirmCopy.label} marker={confirmCopy.marker} type="password" autoComplete="new-password" /> : null}
            <SubmitButton form={form} label={copy.submit} pendingLabel={copy.pending} className="shrink-0" approval={{ action: "change-password", hint: copy.humanHint }} />
          </form>
        )}
      </div>
    </section>
  )
}
