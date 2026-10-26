"use client"

import * as React from "react"

import type { BlockBase } from "@/components/contract/block-contract"
import { humanApprovalProps } from "@/components/contract/human-actions"
import { ApprovalHint } from "../_shared/human-approval"
import type { NotifyPort } from "@/components/contract/ports"
import { Bell, Mail, Phone } from "@/components/icons"
import { cn } from "@/lib/utils"
import { rise } from "@/components/motion/gsap-techniques"
import { useGsapScene } from "@/components/motion/use-gsap-scene"
import { Switch } from "@/components/ui/switch"

import { BlockHeading } from "../_shared/block-heading"
import { DateText, fill } from "../_shared/billing-format"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"

// 알림 수신 동의(마케팅 — 선택) — 채널마다 한 줄(아이콘 · 채널 이름·무엇을 보내나 · 켬/끔 스위치). 모두 선택이고 처음 값은 포트 consents()
// (새 사용자는 모두 꺼짐 — 사전 선택 금지, L12). 스위치를 바꾸면 그 채널만 setConsents 로 바로 저장하고, 결과(언제 무엇을 바꿨는지)를
// 목록 아래 알림 줄(role=status)에 적는다 — 정보통신망법 §50 수신 동의 변경 결과 알림. 저장이 실패하면 스위치를 되돌리고 알린다.
// 필수 알림(결제·보안)은 이 목록 밖이라고 아래에 한 줄로 밝힌다.
type Channel = "email" | "sms" | "kakao" | "push"
const CHANNELS: readonly Channel[] = ["email", "sms", "kakao", "push"]
type Values = Record<Channel, boolean> & { updatedAt?: string }

export type AccountNotificationConsentsCopy = {
  /** 사람 승인 안내 글(R18) — 승인 컨트롤 곁에 한 줄. 권장: APPROVAL_HINT */
  humanHint: string
  title: string
  lead?: string
  marker: string
  // 문구가 있는 채널만 그린다(REL12 — 제품이 쓰지 않는 채널은 문구를 빼면 스위치도 없다). prop channels 로도 좁힌다
  channels: Partial<Record<Channel, { label: string; body: string }>>
  // {channel} · {state}(받기·안 받기) · {date}
  saved: string
  on: string
  off: string
  lastUpdated: string // {date}
  failed: string
  required: string
  loading: string
  error: string
  retry: string
}
export type AccountNotificationConsentsProps = BlockBase<AccountNotificationConsentsCopy> & {
  consents: NotifyPort["consents"]
  setConsents: NotifyPort["setConsents"]
  initial?: { consents?: Values }
  /** 이 제품이 쓰는 수신 채널(예: ["email"]). 주면 copy.channels 중 여기 든 것만 그린다. 안 주면 문구가 있는 채널이 전부다 */
  channels?: readonly Channel[]
}

function ChannelIcon({ ch }: { ch: Channel }) {
  if (ch === "email") return <Mail aria-hidden="true" className="mt-0.5 size-6" />
  if (ch === "sms" || ch === "kakao") return <Phone aria-hidden="true" className="mt-0.5 size-6" />
  return <Bell aria-hidden="true" className="mt-0.5 size-6" />
}

export function AccountNotificationConsents({ copy, locale, timeZone, consents, setConsents, initial, channels, id = "notifications", className }: AccountNotificationConsentsProps) {
  const offered = CHANNELS.filter((ch) => !!copy.channels[ch] && (!channels || channels.includes(ch)))
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const read = usePortRead(consents, initial?.consents)
  const [saving, setSaving] = React.useState<Channel | null>(null)
  const [note, setNote] = React.useState<{ kind: "saved" | "failed"; ch: Channel; on: boolean; at?: string } | null>(null)
  const values = read.state.status === "ready" ? read.state.data : null

  const toggle = async (ch: Channel, on: boolean) => {
    if (!values || saving) return
    const before = values
    read.set({ ...values, [ch]: on })
    setSaving(ch)
    const r = await setConsents({ [ch]: on, confirmed: true })
    setSaving(null)
    if (r.ok) {
      read.set({ ...before, [ch]: on, updatedAt: r.data.updatedAt })
      setNote({ kind: "saved", ch, on, at: r.data.updatedAt })
    } else {
      read.set(before)
      setNote({ kind: "failed", ch, on })
    }
  }
  return (
    <section ref={ref} id={id} data-block="account-notification-consents" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={read.state.status === "loading" || undefined} className="flex max-w-3xl flex-col gap-5">
        {read.state.status === "loading" ? <ReadLoading label={copy.loading} lines={4} /> : null}
        {read.state.status === "error" ? <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} /> : null}
        {values ? (
          <>
            <ApprovalHint id={`${id}-human-hint`}>{copy.humanHint}</ApprovalHint>
            <ul className="flex flex-col border-y">
              {offered.map((ch) => {
                const c = copy.channels[ch]
                if (!c) return null
                return (
                  <li key={ch} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-4 border-b py-5 last:border-b-0">
                    <ChannelIcon ch={ch} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <label htmlFor={`${id}-${ch}`} className="text-[1.125rem] leading-[1.4] font-heading">
                        {c.label}
                        <span className="ms-1 text-base">{copy.marker}</span>
                      </label>
                      <p id={`${id}-${ch}-desc`} className="text-base leading-[1.6]">
                        {c.body}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <span aria-hidden="true" className="hidden text-base sm:inline">
                        {values[ch] ? copy.on : copy.off}
                      </span>
                      <Switch id={`${id}-${ch}`} data-consent="optional" checked={values[ch]} {...humanApprovalProps("marketing-consent", `${id}-${ch}-desc ${id}-human-hint`)} aria-busy={saving === ch || undefined} onCheckedChange={(v) => toggle(ch, v)} />
                    </div>
                  </li>
                )
              })}
            </ul>
            <div role="status" className="min-h-6">
              {note ? (
                <p data-kind={note.kind} className="text-base leading-[1.6] data-[kind=failed]:[color:color-mix(in_oklch,var(--destructive)_40%,var(--foreground))]">
                  {note.kind === "saved" && note.at
                    ? fill(copy.saved, { channel: copy.channels[note.ch]?.label ?? note.ch, state: note.on ? copy.on : copy.off, date: <DateText locale={locale} timeZone={timeZone} iso={note.at} as="since" /> })
                    : fill(copy.failed, { channel: copy.channels[note.ch]?.label ?? note.ch })}
                </p>
              ) : values.updatedAt ? (
                <p className="text-base leading-[1.6] data-[kind=failed]:[color:color-mix(in_oklch,var(--destructive)_40%,var(--foreground))]">{fill(copy.lastUpdated, { date: <DateText locale={locale} timeZone={timeZone} iso={values.updatedAt} as="since" /> })}</p>
              ) : null}
            </div>
            <p className="border-t pt-4 text-base leading-[1.6]">{copy.required}</p>
          </>
        ) : null}
      </div>
    </section>
  )
}
