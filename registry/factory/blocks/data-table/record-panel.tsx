"use client"

import * as React from "react"

import type { ActionResult, AsyncState, BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import { CheckCircle } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Badge } from "@/registry/factory/ui/badge"
import { Button } from "@/registry/factory/ui/button"
import { Field, FieldLabel } from "@/registry/factory/ui/field"
import { Input } from "@/registry/factory/ui/input"
import { Textarea } from "@/registry/factory/ui/textarea"

import { BlockHeading } from "../_shared/block-heading"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { FieldMessage, FormAlert as FlowAlert, SubmitButton, fieldAria, useFormFlow, type ContactSubmit, type FormFlowCopy } from "../_shared/form-flow"
import { ListEmpty, ListError } from "../_shared/list-status"
import { FormAlert, usePortForm } from "../_shared/port-form"
import { Skeleton } from "@/registry/factory/ui/skeleton"

// 데이터 표 짝 — 레코드 상세·편집 패널(A83, NN/g 「한 행 보기·편집」 비모달 패널). 목록(admin-list)에서 한 줄을 열면 옆에 붙는다.
// 왼쪽: 요약 dl(값은 글자 — 상태는 글자 배지, 숫자는 data-numeric) + 이 기록에 하는 작업 버튼(정지·대리 로그인 같은 일 — 결과는 role=status). 오른쪽: 편집 폼(form-flow —
// 비제어라 오류 뒤에도 입력이 남고, 칸마다 (필수)/(선택), 필드 오류는 그 칸에·서버 오류는 위 알림에) + 아래 「위험한 작업」: [지우기…]를 누르면 그 자리에
// [취소][지우기] 대등한 확인(L3). 저장하지 않은 변경이 있으면 창을 닫을 때 브라우저가 묻는다(beforeunload — A49, 앱 안 이동 가로채기는 v0.2).
/** autoComplete: 관리자가 남의 기록을 고치는 칸이라 기본은 "off"(브라우저가 관리자 본인 정보를 채우지 않게) */
export type RecordField = { name: string; label: string; type?: "text" | "email" | "tel" | "textarea" | "number"; required?: boolean; value: string; autoComplete?: string }
export type RecordAction = { id: string; label: string }
export type RecordData = { title: string; summary: { label: string; value: string; kind?: "text" | "numeric" | "status" | "contact" }[]; fields: RecordField[] }

export type DataTableRecordPanelCopy = {
  title: string
  lead?: string
  summaryTitle: string
  actionsTitle: string
  editTitle: string
  required: string
  optional: string
  form: FormFlowCopy
  saved: string
  actionDone: string
  // 위험한 작업 문구(선택) — remove 와 함께 줄 때만 구역을 그린다
  danger?: { title: string; body: string; trigger: string; question: string; cancel: string; confirm: string; pending: string; errorTitle: string; done: { title: string; body: string; link: Cta } }
  empty: { title: string; body?: string; action?: Cta }
  loading: string
  error: { title: string; retryLabel: string }
}
export type DataTableRecordPanelProps = BlockBase<DataTableRecordPanelCopy> & {
  state: AsyncState<RecordData>
  // 저장(폼 제출) — 갤러리는 &submit= 으로 결과를 준다
  submit: ContactSubmit
  actions?: RecordAction[]
  act?: (input: { action: string }) => Promise<ActionResult<{ message?: string }>>
  // 위험한 작업(지우기 같은 되돌리기 어려운 일) — 없으면 「위험한 작업」 구역을 그리지 않는다(주면 예전 그대로). 결과의 data 는 읽지 않는다
  remove?: () => Promise<ActionResult<{ message?: string }>>
}

const same = (a: Record<string, string>, fields: RecordField[]) => fields.every((f) => (a[f.name] ?? "") === f.value)

export function DataTableRecordPanel({ copy, state, submit, actions = [], act, remove, id = "record", className }: DataTableRecordPanelProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const data = state.status === "ready" ? state.data : null
  const hasFields = (data?.fields.length ?? 0) > 0
  const danger = remove ? copy.danger : undefined
  const required = (data?.fields ?? []).filter((f) => f.required).map((f) => f.name)
  const flow = useFormFlow(submit, { id, required, requiredMessage: copy.form.required, notices: copy.form.notices })
  const op = usePortForm({ id: `${id}-op`, notices: copy.form.notices })
  const [edited, setEdited] = React.useState(false)
  const [asking, setAsking] = React.useState(false)
  const [removed, setRemoved] = React.useState(false)
  const [note, setNote] = React.useState<string | null>(null)
  const questionRef = React.useRef<HTMLParagraphElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const noteRef = React.useRef<HTMLParagraphElement>(null)
  const doneRef = React.useRef<HTMLHeadingElement>(null)
  const back = React.useRef(false)
  const saved = flow.phase === "done"
  const dirty = edited && !saved && !removed
  React.useEffect(() => {
    if (asking) questionRef.current?.focus()
    else if (back.current) triggerRef.current?.focus()
  }, [asking])
  React.useEffect(() => {
    if (note) noteRef.current?.focus()
  }, [note])
  React.useEffect(() => {
    if (removed) doneRef.current?.focus()
  }, [removed])
  // 저장하지 않은 변경이 있으면 창을 닫거나 다시 불러올 때 묻는다
  React.useEffect(() => {
    if (!dirty) return
    const ask = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", ask)
    return () => window.removeEventListener("beforeunload", ask)
  }, [dirty])

  const onInput = () => {
    if (!data) return
    setEdited(!same(flow.read(), data.fields))
    if (flow.phase === "done") flow.reset()
  }
  const runAction = async (action: string) => {
    if (!act) return
    const r = await op.run(() => act({ action }))
    if (r) setNote(r.message ?? copy.actionDone)
  }
  const confirmRemove = async () => {
    if (!remove) return
    const r = await op.run(() => remove())
    if (!r) return
    setRemoved(true)
  }

  return (
    <section ref={ref} id={id} data-block="data-table-record-panel" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="cn-block-rp">
        {state.status === "loading" ? (
          <div role="status" className="cn-block-dt-loading">
            <span className="sr-only">{copy.loading}</span>
            <Skeleton aria-hidden="true" className="cn-block-dt-skel-head" />
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} aria-hidden="true" className="cn-block-dt-skel-row" />
            ))}
          </div>
        ) : null}
        {state.status === "error" ? <ListError title={copy.error.title} message={state.message} retryLabel={copy.error.retryLabel} retry={state.retry} /> : null}
        {state.status === "empty" ? <ListEmpty title={copy.empty.title} body={copy.empty.body} action={copy.empty.action} /> : null}
        {removed && danger ? (
          <div role="status" data-record-removed="" className="cn-block-rp-removed">
            <CheckCircle aria-hidden="true" className="cn-block-rp-removed-icon" />
            <h3 ref={doneRef} tabIndex={-1} className="cn-block-rp-removed-title font-heading">
              {danger.done.title}
            </h3>
            <p className="cn-block-rp-removed-body">{danger.done.body}</p>
            <Button variant="outline" nativeButton={false} render={<a href={danger.done.link.href} />}>
              {danger.done.link.label}
            </Button>
          </div>
        ) : null}
        {data && !removed ? (
          <div className="cn-block-rp-grid">
            <div className="cn-block-rp-side">
              <h3 className="cn-block-rp-sub font-heading">{copy.summaryTitle}</h3>
              <dl data-record-summary="" className="cn-block-rp-summary">
                {data.summary.map((s) => (
                  <div key={s.label} className="cn-block-rp-row">
                    <dt className="cn-block-rp-key">{s.label}</dt>
                    <dd className="cn-block-rp-value">{s.kind === "status" ? <Badge variant="outline">{s.value}</Badge> : s.kind === "numeric" ? <span data-numeric>{s.value}</span> : s.value}</dd>
                  </div>
                ))}
              </dl>
              {actions.length && act ? (
                <div className="cn-block-rp-actions">
                  <h3 className="cn-block-rp-sub font-heading">{copy.actionsTitle}</h3>
                  <div className="cn-block-rp-action-list">
                    {actions.map((a) => (
                      <Button key={a.id} type="button" variant="outline" disabled={op.pending} focusableWhenDisabled data-record-action={a.id} onClick={() => runAction(a.id)}>
                        {a.label}
                      </Button>
                    ))}
                  </div>
                  {note ? (
                    <p ref={noteRef} tabIndex={-1} role="status" className="cn-block-rp-note">
                      {note}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {hasFields || danger ? (
              <div className="cn-block-rp-main">
                {hasFields ? (
                  <>
                    <h3 className="cn-block-rp-sub font-heading">{copy.editTitle}</h3>
                    <FlowAlert flow={flow} copy={copy.form} />
                    {saved ? (
                      <p role="status" data-record-saved="" className="cn-block-rp-saved">
                        <CheckCircle aria-hidden="true" className="cn-block-rp-saved-icon" />
                        {flow.receipt?.message ?? copy.saved}
                      </p>
                    ) : null}
                    <form method="post" id={flow.formId} noValidate aria-busy={flow.pending || undefined} onSubmit={flow.onSubmit} onInput={onInput} className="cn-block-rp-form">
                      {data.fields.map((f) => {
                        const inputId = `${id}-${f.name}`
                        const aria = fieldAria(flow, id, f.name)
                        return (
                          <Field key={f.name} className="cn-block-form-field" data-invalid={aria["aria-invalid"]}>
                            <FieldLabel htmlFor={inputId}>
                              {f.label} <span className="cn-block-pf-marker">{f.required ? copy.required : copy.optional}</span>
                            </FieldLabel>
                            {f.type === "textarea" ? (
                              <Textarea id={inputId} name={f.name} defaultValue={f.value} aria-required={f.required || undefined} className="cn-block-form-textarea" {...aria} />
                            ) : (
                              <Input
                                id={inputId}
                                name={f.name}
                                type={f.type ?? "text"}
                                defaultValue={f.value}
                                autoComplete={f.autoComplete ?? "off"}
                                autoCapitalize={f.type === "email" ? "off" : undefined}
                                spellCheck={f.type === "email" ? false : undefined}
                                aria-required={f.required || undefined}
                                {...aria}
                              />
                            )}
                            <FieldMessage flow={flow} id={id} name={f.name} />
                          </Field>
                        )
                      })}
                      <div className="cn-block-rp-save">
                        <SubmitButton flow={flow} copy={copy.form} />
                      </div>
                    </form>
                  </>
                ) : null}
                {danger ? (
                  <div data-danger-zone="" className="cn-block-rp-danger">
                    <h3 className="cn-block-rp-sub font-heading">{danger.title}</h3>
                    <p className="cn-block-rp-danger-body">{danger.body}</p>
                    <FormAlert form={op} fieldTitle={danger.errorTitle} serverTitle={danger.errorTitle} />
                    {asking ? (
                      <div className="cn-block-rp-confirm">
                        <p ref={questionRef} tabIndex={-1} className="cn-block-rp-question font-heading">
                          {danger.question}
                        </p>
                        <ChoiceRow label={danger.question}>
                          <ChoiceButton
                            choice="decline"
                            type="button"
                            onClick={() => {
                              back.current = true
                              setAsking(false)
                            }}
                          >
                            {danger.cancel}
                          </ChoiceButton>
                          <ChoiceButton choice="primary" type="button" disabled={op.pending} focusableWhenDisabled onClick={confirmRemove}>
                            {op.pending ? danger.pending : danger.confirm}
                          </ChoiceButton>
                        </ChoiceRow>
                      </div>
                    ) : (
                      <Button ref={triggerRef} type="button" variant="outline" size="lg" onClick={() => setAsking(true)} data-danger-trigger="" className="cn-block-rp-trigger">
                        {danger.trigger}
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
