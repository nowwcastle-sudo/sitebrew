"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Checkbox } from "@/registry/factory/ui/checkbox"
import { Field, FieldLabel } from "@/registry/factory/ui/field"

import { FieldMessage, FormAlert, FormDone, SubmitButton, TextField, fieldAria, useFormFlow, type ContactSubmit, type FormFlowCopy } from "../_shared/form-flow"
import { type QnaContact, type QnaContactCopy, type QnaEntryCopy, type QnaItem, QnaContactLinks, QnaEntry } from "../_shared/qna-kit"

// 상품 문의 — 답변 목록 곁에 문의 폼(대장 A62, D97 수신 경로). 왼쪽에 판매자가 미리 써 둔 자주 받는 문의 몇 건(접히지 않는다), 오른쪽에 「궁금한 점 남기기」 폼:
// 칸 둘(답변 받을 연락처 · 궁금한 점)과 개인정보 수집·이용 동의(필수). 답은 남긴 연락처로만 가고 다른 사람에게 공개되는 글이 아니다(구매자 공개 게시판·비밀글은 v0.2 — 안내 문구로 밝힌다).
// 제출 흐름은 _shared/form-flow: 빈 필수 칸·서버가 돌려준 칸 오류는 칸 아래에 「무엇이·어떻게 고치나」로 알리고 첫 오류 칸으로 포커스를 옮기며(O2), 서버 오류는 폼 위 알림 + 입력 그대로,
// 보내는 중은 aria-busy + 버튼 aria-disabled(포커스 유지). 성공은 폼 자리에 접수 번호. 에이전트 속성(WebMCP toolname)은 달지 않는다 — 필수 개인정보 동의 칸이 든 폼이라 에이전트가 사람 대신 동의를 누를 수 있다(P3-7 AXWF, 운영자 결정 2026-10-04, G11a). 폼 밑에는 전화·메일 링크(선택).
export type QnaAskFormCopy = {
  title: string
  lead?: string
  listTitle: string
  formTitle: string
  // 폼 위 한 줄: 답은 남긴 연락처로만 가고 공개되지 않는다
  privacyNote: string
  labels: { contact: string; question: string }
  placeholders?: { contact?: string; question?: string }
  consent: { label: string; detail?: string }
  entry: QnaEntryCopy
  contact: QnaContactCopy
  form: FormFlowCopy
}
export type QnaAskFormProps = BlockBase<QnaAskFormCopy> & {
  items: QnaItem[]
  submit: ContactSubmit
  contact?: QnaContact
  track?: AnalyticsPort["track"]
}

const PREVIEW = 3

export function QnaAskForm({ copy, locale, timeZone, items, submit, contact, track, id = "qna", className }: QnaAskFormProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const flow = useFormFlow(submit, { id, required: ["contact", "question", "consent"], requiredMessage: copy.form.required, notices: copy.form.notices })
  const consent = fieldAria(flow, id, "consent", copy.consent.detail ? `${id}-consent-detail` : undefined)
  const shown = items.slice(0, PREVIEW)
  return (
    <section ref={ref} id={id} data-block="qna-ask-form" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-qaf-section", className)}>
      <div className="cn-block-pin-head">
        <h2 id={`${id}-title`} data-enter className="cn-block-title font-heading-ko">
          {copy.title}
        </h2>
        {copy.lead ? (
          <p data-enter className="cn-block-lead">
            {copy.lead}
          </p>
        ) : null}
      </div>
      <div className="cn-block-qaf-grid">
        <div data-enter className="cn-block-qaf-list-wrap">
          <h3 className="cn-block-qaf-sub font-heading-ko">{copy.listTitle}</h3>
          {shown.length ? (
            <ol data-qna-list="" className="cn-block-qaf-list">
              {shown.map((it) => (
                <li key={it.id}>
                  <QnaEntry item={it} copy={copy.entry} locale={locale} timeZone={timeZone} />
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <div data-enter className="cn-block-qaf-panel">
          <h3 id={`${id}-form-title`} className="cn-block-qaf-sub font-heading-ko">
            {copy.formTitle}
          </h3>
          <p className="cn-block-qaf-privacy">{copy.privacyNote}</p>
          {flow.phase === "done" ? (
            <FormDone flow={flow} copy={copy.form} />
          ) : (
            <form method="post" id={flow.formId} noValidate aria-labelledby={`${id}-form-title`} aria-busy={flow.pending || undefined} onSubmit={flow.onSubmit} className="cn-block-qaf-form">
              <FormAlert flow={flow} copy={copy.form} />
              <TextField flow={flow} id={id} name="contact" label={copy.labels.contact} placeholder={copy.placeholders?.contact} autoComplete="email" required />
              <TextField flow={flow} id={id} name="question" label={copy.labels.question} placeholder={copy.placeholders?.question} multiline required />
              <Field orientation="horizontal" className="cn-block-qaf-consent">
                <Checkbox id={`${id}-consent`} name="consent" value="yes" data-consent="required" aria-required="true" aria-labelledby={`${id}-consent-label`} aria-invalid={consent["aria-invalid"]} aria-describedby={consent["aria-describedby"]} onCheckedChange={() => flow.clear("consent")} />
                <div className="cn-block-qaf-consent-text">
                  <FieldLabel id={`${id}-consent-label`} htmlFor={`${id}-consent`}>{copy.consent.label}</FieldLabel>
                  {copy.consent.detail ? (
                    <p id={`${id}-consent-detail`} className="cn-block-qaf-consent-detail">
                      {copy.consent.detail}
                    </p>
                  ) : null}
                  <FieldMessage flow={flow} id={id} name="consent" />
                </div>
              </Field>
              <div className="cn-block-qaf-actions">
                <SubmitButton flow={flow} copy={copy.form} />
              </div>
            </form>
          )}
          {contact ? <QnaContactLinks contact={contact} copy={copy.contact} track={track} section={id} /> : null}
        </div>
      </div>
    </section>
  )
}
