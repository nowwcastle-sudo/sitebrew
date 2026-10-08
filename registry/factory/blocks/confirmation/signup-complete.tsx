"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, AuthPort } from "@/registry/factory/contract/ports"
import { ArrowRight, Check, Mail } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"
import { FormAlert, usePortForm } from "../_shared/port-form"
import { PrintButton } from "../_shared/print-button"
import { useCooldown, type SubmitNotices } from "../_shared/submit-guard"

// 가입 완료(마케팅 규칙 A10·P10·V4 — factory-rules.md §22-2·§22-4·§22-6). 가운데 한 판: 무엇이 끝났는지 · 지금 바로 쓸 수 있는 것(P10 — 가입·결제 직후 열린 기능을 안내한다) ·
// 다음에 일어날 일과 그때(확인 메일 등) · 도움 받을 곳 · 다음 행동 하나(A10). 가입 직후는 온보딩의 시작이라 평점·리뷰를 묻지 않는다(V4).
// 계측(선택): 다음 행동을 누르면 cta_click.
// ── P3-6 AUTHBLK(UX 감사 A01·A08, factory-rules.md §23 U2·U4) ──
//   · A01 이메일 확인이 먼저: copy.confirm 이 있고 아직 확인 전(emailVerified 가 true 가 아님)이면 맨 위가 「메일함을 열어 확인해 주세요」다 — 보낸 주소(email)를 굵게 보이고, 스팸함 안내,
//     [다시 보내기](보낸 뒤 resendAfter 초 잠기고 role=timer 줄이 남은 초를 센다 — resendVerification 을 줄 때만), 「주소가 잘못됐나요? 이메일 바꾸기」 링크. 「가입을 마쳤어요」(copy.title·body)와 열린
//     기능·다음 일은 그 아래 「기다리는 동안」 구획으로 내려간다(확인 전에 「다 됐어요」가 헤드라인이면 확인 메일을 놓친다). copy.confirm 이 없으면 지금 모양 그대로다(뒤로 호환).
//   · A08 로그인 안 한 채 도착: signedIn 이 false 이고 copy.signIn 이 있으면 다음 행동 하나가 「로그인」(copy.signIn.primary)이다. 이미 확인했는데(emailVerified) 로그인 안 한 채면(다른 기기에서
//     확인 링크를 연 경우) 제목·본문도 copy.signIn 의 것(「이메일 확인이 끝났어요 — 로그인해 주세요」)이고 열린 기능·다음 일 목록은 그리지 않는다. 로그인 안 한 채면 다시 보내기는 없다(세션이 필요하다).
//   · 결과는 화면에 남는 글(role=status)이고 다음 행동은 늘 하나다(data-next-action).
export type ConfirmationSignupCompleteCopy = {
  title: string
  body: string
  unlockedTitle: string
  unlocked: string[]
  nextTitle: string
  next: { title: string; when: string }[]
  // 시작 안내 쪽이 없는 사이트는 이 줄을 그리지 않는다.
  help?: { text: string; link: { label: string; href: string } }
  primary: { label: string; href: string }
  // 「인쇄·PDF로 저장」 버튼 글(대장 A104) — 있을 때만 그린다. 버튼은 인쇄물에 나오지 않는다
  print?: string
  // 확인 먼저(A01) — 있고 확인 전이면 맨 위가 이 구획이다. body 의 {email} 자리에 보낸 주소가 들어간다(굵게)
  confirm?: {
    title: string
    body: string
    spam?: string
    // 「기다리는 동안」 구획 제목(가입을 마쳤어요·열린 기능·다음 일을 담는다)
    meanwhile: string
    resend?: { label: string; pending: string; wait: string; sent: string; errorTitle: string }
    wrongAddress?: { text: string; label: string; href: string }
  }
  // 다시 보내기 제출 보호 문구(시간 초과·요청 제한 — submit-guard). 다시 보내기를 쓰는 제품은 준다
  notices?: SubmitNotices
  // 로그인 안 한 채(signedIn false)일 때: 다음 행동이 로그인이다(A08). title·body 는 이미 확인했을 때 제목·본문을 대신한다
  signIn?: { title: string; body: string; primary: { label: string; href: string } }
}
export type ConfirmationSignupCompleteProps = BlockBase<ConfirmationSignupCompleteCopy> & {
  track?: AnalyticsPort["track"]
  /** 가입한 이메일 주소(확인 메일을 보낸 곳) — copy.confirm.body 의 {email} */
  email?: string
  /** 이메일 확인이 끝났나(기본 false). true 면 확인 구획 없이 가입 완료가 먼저다 */
  emailVerified?: boolean
  /** 지금 로그인 상태인가(기본 true). false 면 다음 행동이 로그인이다(copy.signIn, A08) */
  signedIn?: boolean
  /** 확인 메일 다시 보내기(선택 — 없으면 버튼이 없다). 로그인 상태에서만 쓴다 */
  resendVerification?: AuthPort["sendVerificationEmail"]
  /** 보낸 뒤 다시 보내기를 기다리는 초(기본 60 — 요청 제한 초가 오면 그 값이 이긴다) */
  resendAfter?: number
}

// {email} 자리를 굵은 주소로(없으면 글 그대로)
function withAddress(text: string, email: string | undefined) {
  const parts = text.split("{email}")
  if (parts.length < 2) return text
  return parts.flatMap((p, i) => (i === 0 ? [p] : [<strong key={i} data-address="" className="cn-block-csc-address">{email ?? ""}</strong>, p]))
}

export function ConfirmationSignupComplete({ copy, track, email, emailVerified = false, signedIn = true, resendVerification, resendAfter = 60, id = "signup-complete", className }: ConfirmationSignupCompleteProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const form = usePortForm({ id, notices: copy.notices })
  const wait = useCooldown()
  const [sent, setSent] = React.useState(false)
  const sentRef = React.useRef<HTMLParagraphElement>(null)
  // 이 화면에 온 순간은 가입 메일이 막 나간 때다 — 대기 시간이 처음부터 흐른다
  const { start } = wait
  React.useEffect(() => {
    start(resendAfter)
  }, [start, resendAfter])
  React.useEffect(() => {
    if (sent) sentRef.current?.focus()
  }, [sent])
  const confirming = !!copy.confirm && !emailVerified
  const verifiedSignedOut = emailVerified && !signedIn && !!copy.signIn
  const held = wait.seconds > 0 || form.cooldown > 0
  const resend = async () => {
    if (!resendVerification || held) return
    const r = await form.run(() => resendVerification())
    if (!r) return
    wait.start(resendAfter)
    setSent(true)
  }
  const primary = !signedIn && copy.signIn ? copy.signIn.primary : copy.primary
  const title = verifiedSignedOut ? copy.signIn!.title : confirming ? copy.confirm!.title : copy.title
  const body = verifiedSignedOut ? copy.signIn!.body : confirming ? withAddress(copy.confirm!.body, email) : copy.body
  const confirmCopy = copy.confirm
  const lists = !verifiedSignedOut
  const Icon = confirming ? Mail : Check
  return (
    <section ref={ref} id={id} data-block="confirmation-signup-complete" data-confirming={confirming ? "" : undefined} aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-csc-section", className)}>
      <div data-enter className="cn-block-csc-card">
        <span aria-hidden="true" className="cn-block-csc-badge">
          <Icon className="cn-block-csc-badge-icon" />
        </span>
        <h2 id={`${id}-title`} className="cn-block-csc-title font-heading-ko">
          {title}
        </h2>
        <p role="status" className="cn-block-csc-body">
          {body}
        </p>
        {confirming && confirmCopy ? (
          <div data-confirm="" className="cn-block-csc-confirm">
            {confirmCopy.spam ? <p className="cn-block-csc-spam">{confirmCopy.spam}</p> : null}
            {resendVerification && signedIn && confirmCopy.resend ? (
              <>
                <FormAlert form={form} fieldTitle={confirmCopy.resend.errorTitle} serverTitle={confirmCopy.resend.errorTitle} />
                <div className="cn-block-csc-resend">
                  <Button type="button" variant="outline" size="lg" disabled={form.pending || held} focusableWhenDisabled onClick={resend} data-resend="">
                    {form.pending ? confirmCopy.resend.pending : (form.holdLabel ?? confirmCopy.resend.label)}
                  </Button>
                  <p role="timer" data-cooldown={wait.seconds} className="cn-block-csc-timer">
                    {wait.seconds > 0 ? fillText(confirmCopy.resend.wait, { seconds: wait.seconds }) : ""}
                  </p>
                  {sent ? (
                    <p ref={sentRef} tabIndex={-1} role="status" className="cn-block-csc-sent">
                      {confirmCopy.resend.sent}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
            {confirmCopy.wrongAddress ? (
              <p className="cn-block-csc-wrong">
                {confirmCopy.wrongAddress.text}{" "}
                <a href={confirmCopy.wrongAddress.href} className="cn-block-csc-link">
                  {confirmCopy.wrongAddress.label}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
        {confirming && lists && confirmCopy ? (
          <div data-meanwhile="" className="cn-block-csc-meanwhile">
            <h3 className="cn-block-csc-sub font-heading-ko">{confirmCopy.meanwhile}</h3>
            <p className="cn-block-csc-done-lead">{copy.title}</p>
            <p className="cn-block-csc-done-body">{copy.body}</p>
          </div>
        ) : null}
        {lists && copy.unlocked.length ? (
          <div data-unlocked="" className="cn-block-csc-unlocked">
            <h3 className="cn-block-csc-sub font-heading-ko">{copy.unlockedTitle}</h3>
            <ul className="cn-block-csc-unlocked-list">
              {copy.unlocked.map((u, i) => (
                <li key={i} className="cn-block-csc-unlocked-item">
                  <Check aria-hidden="true" className="cn-block-csc-unlocked-icon" />
                  {u}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {lists ? (
          <div data-next-steps="" className="cn-block-csc-next">
            <h3 className="cn-block-csc-sub font-heading-ko">{copy.nextTitle}</h3>
            <ul className="cn-block-csc-next-list">
              {copy.next.map((s, i) => (
                <li key={i} className="cn-block-csc-next-item">
                  <Mail aria-hidden="true" className="cn-block-csc-next-icon" />
                  <span>
                    <span className="cn-block-csc-next-title">{s.title}</span> · <span data-when="">{s.when}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Button size="lg" nativeButton={false} role="link" render={<a href={primary.href} />} data-next-action="" onClick={() => track?.("cta_click", { id: signedIn ? "signup-next" : "signup-signin", label: primary.label, section: id })} className="cn-block-csc-primary">
          {primary.label}
          <ArrowRight aria-hidden="true" />
        </Button>
        {copy.print ? <PrintButton label={copy.print} /> : null}
        {copy.help ? (
          <p data-help="" className="cn-block-csc-help">
            {copy.help.text}{" "}
            <a href={copy.help.link.href} className="cn-block-csc-link">
              {copy.help.link.label}
            </a>
          </p>
        ) : null}
      </div>
    </section>
  )
}
