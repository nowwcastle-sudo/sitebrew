"use client"

import * as React from "react"

import type { ActionResult, AgentToolMeta, BlockBase } from "@/registry/factory/contract/block-contract"
import { agentFormAttrs } from "@/registry/factory/ax/agent-form-attrs"
import { ExternalLink, Mail, Phone } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"
import { FormAlert, FormDone, SubmitButton, TextField, useFormFlow, type ContactFormInput, type ContactReceipt, type ContactSubmit, type FormFlowCopy } from "../_shared/form-flow"

// 문의 — 채널 먼저. 위에 큰 채널 칸 둘(카카오톡 채널 상담 · 전화), 아래 「또는 남기기」 보조 폼(이름·연락처·내용).
// 채널은 모두 props 로 받는다 — 블록은 어댑터를 부르지 않는다(adapter-static 의 telLink·kakaoChannelSubmit·mailtoSubmit 을 소비자가 끼운다):
//   · call: 전화 링크 결과(telLink(번호)) — ok 면 tel: 링크로 그린다
//   · kakao: 채널 포트(kakaoChannelSubmit(채널 URL, 글 만들기)) — 누르면 아래 폼에 적은 내용을 넘긴다(채팅방을 열고 글은 클립보드로)
//   · submit: 보조 폼 포트(mailtoSubmit 등) — 제출 흐름은 _shared/form-flow
export type ContactFormChannelFirstCopy = {
  title: string
  lead?: string
  channelsLabel: string
  kakao?: { label: string; note: string }
  call?: { label: string; note: string; number: string }
  // 채널 결과를 알리는 한 줄 앞말 + 창이 안 열렸을 때 링크 이름
  channelLinkLabel: string
  formTitle: string
  formLead?: string
  labels: { name: string; contact: string; message: string }
  form: FormFlowCopy
}
export type ContactFormChannelFirstProps = BlockBase<ContactFormChannelFirstCopy> & {
  submit: ContactSubmit
  tool?: AgentToolMeta
  kakao?: (input: ContactFormInput) => Promise<ActionResult<ContactReceipt>>
  call?: ActionResult<ContactReceipt>
}

export function ContactFormChannelFirst({ copy, submit, tool, kakao, call, id = "channels", className }: ContactFormChannelFirstProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const flow = useFormFlow(submit, { id, required: ["contact", "message"], requiredMessage: copy.form.required, notices: copy.form.notices })
  const agent = tool ? agentFormAttrs(tool) : {}
  const [channel, setChannel] = React.useState<{ busy: boolean; result?: ActionResult<ContactReceipt> }>({ busy: false })
  const openKakao = async () => {
    if (!kakao || channel.busy) return
    const input: ContactFormInput = flow.read()
    setChannel({ busy: true })
    setChannel({ busy: false, result: await kakao(input) })
  }
  const res = channel.result
  const callHref = call?.ok ? call.data.href : undefined
  return (
    <section ref={ref} id={id} data-block="contact-form-channel-first" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="cn-block-channel">
        <ul aria-label={copy.channelsLabel} className="cn-block-channel-list">
          {kakao && copy.kakao ? (
            <li className="cn-block-channel-item">
              <Button type="button" size="lg" onClick={openKakao} disabled={channel.busy} focusableWhenDisabled className="cn-block-channel-button cn-block-btn-wrap">
                <ExternalLink aria-hidden="true" />
                {copy.kakao.label}
              </Button>
              <p className="cn-block-channel-note">{copy.kakao.note}</p>
            </li>
          ) : null}
          {callHref && copy.call ? (
            <li className="cn-block-channel-item">
              <Button variant="outline" size="lg" nativeButton={false} render={<a href={callHref} />} className="cn-block-channel-button cn-block-btn-wrap">
                <Phone aria-hidden="true" />
                {copy.call.label}
                <span data-numeric className="cn-block-channel-number">
                  {copy.call.number}
                </span>
              </Button>
              <p className="cn-block-channel-note">{copy.call.note}</p>
            </li>
          ) : null}
        </ul>
        <div role="status" className="cn-block-channel-status">
          {res ? (
            res.ok ? (
              <p>
                {res.data.nextStep ?? res.data.message}{" "}
                {res.data.href ? (
                  <a href={res.data.href} className="cn-block-channel-link">
                    {copy.channelLinkLabel}
                  </a>
                ) : null}
              </p>
            ) : (
              <p>{res.formError}</p>
            )
          ) : null}
        </div>
      </div>
      <div data-enter className="cn-block-channel-form-wrap">
        <div className="cn-block-channel-form-head">
          <Mail aria-hidden="true" className="cn-block-channel-form-icon" />
          <div>
            <h3 id={`${id}-form-title`} className="cn-block-channel-form-title font-heading">
              {copy.formTitle}
            </h3>
            {copy.formLead ? <p className="cn-block-channel-form-lead">{copy.formLead}</p> : null}
          </div>
        </div>
        {flow.phase === "done" ? (
          <FormDone flow={flow} copy={copy.form} />
        ) : (
          <form method="post" id={flow.formId} noValidate aria-labelledby={`${id}-form-title`} aria-busy={flow.pending || undefined} onSubmit={flow.onSubmit} className="cn-block-channel-form" {...agent}>
            <FormAlert flow={flow} copy={copy.form} />
            <div className="cn-block-channel-row">
              <TextField flow={flow} id={id} name="name" label={copy.labels.name} autoComplete="name" />
              <TextField flow={flow} id={id} name="contact" label={copy.labels.contact} autoComplete="email" required />
            </div>
            <TextField flow={flow} id={id} name="message" label={copy.labels.message} multiline required />
            <div className="cn-block-channel-actions">
              <SubmitButton flow={flow} copy={copy.form} size="default" />
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
