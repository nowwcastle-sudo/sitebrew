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
export type RecordField = { name: string; label: string; type?: "text" | "email" | "tel" | "textarea"; required?: boolean; value: string; autoComplete?: string }
export type RecordAction = { id: string; label: string }
export type RecordData = { title: string; summary: { label: string; value: string; kind?: "text" | "numeric" | "status" }[]; fields: RecordField[] }

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
  danger: { title: string; body: string; trigger: string; question: string; cancel: string; confirm: string; pending: string; errorTitle: string; done: { title: string; body: string; link: Cta } }
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
  remove: () => Promise<ActionResult<Record<string, never>>>
}

const same = (a: Record<string, string>, fields: RecordField[]) => fields.every((f) => (a[f.name] ?? "") === f.value)

export function DataTableRecordPanel({ copy, state, submit, actions = [], act, remove, id = "record", className }: DataTableRecordPanelProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const data = state.status === "ready" ? state.data : null
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
    const r = await op.run(() => remove())
    if (!r) return
    setRemoved(true)
  }

  return (
    <section ref={ref} id={id} data-block="data-table-record-panel" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="flex flex-col gap-6">
        {state.status === "loading" ? (
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">{copy.loading}</span>
            <Skeleton aria-hidden="true" className="h-11 w-full" />
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} aria-hidden="true" className="h-14 w-full" />
            ))}
          </div>
        ) : null}
        {state.status === "error" ? <ListError title={copy.error.title} message={state.message} retryLabel={copy.error.retryLabel} retry={state.retry} /> : null}
        {state.status === "empty" ? <ListEmpty title={copy.empty.title} body={copy.empty.body} action={copy.empty.action} /> : null}
        {removed ? (
          <div role="status" data-record-removed="" className="flex max-w-xl flex-col items-start gap-3 border px-6 py-8">
            <CheckCircle aria-hidden="true" className="size-8" />
            <h3 ref={doneRef} tabIndex={-1} className="text-[1.25rem] leading-[1.35] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
              {copy.danger.done.title}
            </h3>
            <p className="text-base leading-[1.6]">{copy.danger.done.body}</p>
            <Button variant="outline" nativeButton={false} render={<a href={copy.danger.done.link.href} />}>
              {copy.danger.done.link.label}
            </Button>
          </div>
        ) : null}
        {data && !removed ? (
          <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <h3 className="text-[1.125rem] leading-[1.4] font-heading">{copy.summaryTitle}</h3>
              <dl data-record-summary="" className="flex flex-col border-y">
                {data.summary.map((s) => (
                  <div key={s.label} className="flex flex-col gap-1 border-b py-3 last:border-b-0">
                    <dt className="text-base leading-[1.5]">{s.label}</dt>
                    <dd className="text-base leading-[1.5] font-medium break-words">{s.kind === "status" ? <Badge variant="outline">{s.value}</Badge> : s.kind === "numeric" ? <span data-numeric>{s.value}</span> : s.value}</dd>
                  </div>
                ))}
              </dl>
              {actions.length && act ? (
                <div className="flex flex-col gap-3">
                  <h3 className="text-[1.125rem] leading-[1.4] font-heading">{copy.actionsTitle}</h3>
                  <div className="flex flex-wrap gap-2">
                    {actions.map((a) => (
                      <Button key={a.id} type="button" variant="outline" disabled={op.pending} focusableWhenDisabled data-record-action={a.id} onClick={() => runAction(a.id)}>
                        {a.label}
                      </Button>
                    ))}
                  </div>
                  {note ? (
                    <p ref={noteRef} tabIndex={-1} role="status" className="border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
                      {note}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <h3 className="text-[1.125rem] leading-[1.4] font-heading">{copy.editTitle}</h3>
              <FlowAlert flow={flow} copy={copy.form} />
              {saved ? (
                <p role="status" data-record-saved="" className="flex items-start gap-3 border-s-4 bg-muted/40 px-4 py-3 text-base leading-[1.6]">
                  <CheckCircle aria-hidden="true" className="mt-1 size-5 shrink-0" />
                  {flow.receipt?.message ?? copy.saved}
                </p>
              ) : null}
              <form method="post" id={flow.formId} noValidate aria-busy={flow.pending || undefined} onSubmit={flow.onSubmit} onInput={onInput} className="flex flex-col gap-5">
                {data.fields.map((f) => {
                  const inputId = `${id}-${f.name}`
                  const aria = fieldAria(flow, id, f.name)
                  return (
                    <Field key={f.name} className="min-w-0" data-invalid={aria["aria-invalid"]}>
                      <FieldLabel htmlFor={inputId}>
                        {f.label} <span className="ms-1 text-base">{f.required ? copy.required : copy.optional}</span>
                      </FieldLabel>
                      {f.type === "textarea" ? (
                        <Textarea id={inputId} name={f.name} defaultValue={f.value} aria-required={f.required || undefined} className="min-h-32" {...aria} />
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
                <div className="flex">
                  <SubmitButton flow={flow} copy={copy.form} />
                </div>
              </form>
              <div data-danger-zone="" className="flex flex-col items-start gap-3 border-t pt-6">
                <h3 className="text-[1.125rem] leading-[1.4] font-heading">{copy.danger.title}</h3>
                <p className="text-base leading-[1.6]">{copy.danger.body}</p>
                <FormAlert form={op} fieldTitle={copy.danger.errorTitle} serverTitle={copy.danger.errorTitle} />
                {asking ? (
                  <div className="flex w-full max-w-lg flex-col gap-4 border px-5 py-5">
                    <p ref={questionRef} tabIndex={-1} className="text-[1.125rem] leading-[1.4] outline-hidden focus-visible:ring-3 focus-visible:ring-ring font-heading">
                      {copy.danger.question}
                    </p>
                    <ChoiceRow label={copy.danger.question}>
                      <ChoiceButton
                        choice="decline"
                        type="button"
                        onClick={() => {
                          back.current = true
                          setAsking(false)
                        }}
                      >
                        {copy.danger.cancel}
                      </ChoiceButton>
                      <ChoiceButton choice="primary" type="button" disabled={op.pending} focusableWhenDisabled onClick={confirmRemove}>
                        {op.pending ? copy.danger.pending : copy.danger.confirm}
                      </ChoiceButton>
                    </ChoiceRow>
                  </div>
                ) : (
                  <Button ref={triggerRef} type="button" variant="outline" size="lg" onClick={() => setAsking(true)} data-danger-trigger="" className="[color:color-mix(in_oklch,var(--destructive)_40%,var(--foreground))]">
                    {copy.danger.trigger}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
