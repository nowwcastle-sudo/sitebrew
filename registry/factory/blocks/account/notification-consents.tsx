"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { humanApprovalProps } from "@/registry/factory/contract/human-actions"
import { ApprovalHint } from "../_shared/human-approval"
import type { NotifyPort } from "@/registry/factory/contract/ports"
import { Bell, Mail, Phone } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Switch } from "@/registry/factory/ui/switch"

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
  if (ch === "email") return <Mail aria-hidden="true" className="cn-block-notify-icon" />
  if (ch === "sms" || ch === "kakao") return <Phone aria-hidden="true" className="cn-block-notify-icon" />
  return <Bell aria-hidden="true" className="cn-block-notify-icon" />
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
    <section ref={ref} id={id} data-block="account-notification-consents" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter aria-busy={read.state.status === "loading" || undefined} className="cn-block-notify">
        {read.state.status === "loading" ? <ReadLoading label={copy.loading} lines={4} /> : null}
        {read.state.status === "error" ? <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} /> : null}
        {values ? (
          <>
            <ApprovalHint id={`${id}-human-hint`}>{copy.humanHint}</ApprovalHint>
            <ul className="cn-block-notify-list">
              {offered.map((ch) => {
                const c = copy.channels[ch]
                if (!c) return null
                return (
                  <li key={ch} className="cn-block-notify-row">
                    <ChannelIcon ch={ch} />
                    <div className="cn-block-notify-text">
                      <label htmlFor={`${id}-${ch}`} className="cn-block-notify-label font-heading">
                        {c.label}
                        <span className="cn-block-pf-marker">{copy.marker}</span>
                      </label>
                      <p id={`${id}-${ch}-desc`} className="cn-block-notify-body">
                        {c.body}
                      </p>
                    </div>
                    <div className="cn-block-notify-control">
                      <span aria-hidden="true" className="cn-block-notify-state">
                        {values[ch] ? copy.on : copy.off}
                      </span>
                      <Switch id={`${id}-${ch}`} data-consent="optional" checked={values[ch]} {...humanApprovalProps("marketing-consent", `${id}-${ch}-desc ${id}-human-hint`)} aria-busy={saving === ch || undefined} onCheckedChange={(v) => toggle(ch, v)} />
                    </div>
                  </li>
                )
              })}
            </ul>
            <div role="status" className="cn-block-notify-status">
              {note ? (
                <p data-kind={note.kind} className="cn-block-notify-note">
                  {note.kind === "saved" && note.at
                    ? fill(copy.saved, { channel: copy.channels[note.ch]?.label ?? note.ch, state: note.on ? copy.on : copy.off, date: <DateText locale={locale} timeZone={timeZone} iso={note.at} as="since" /> })
                    : fill(copy.failed, { channel: copy.channels[note.ch]?.label ?? note.ch })}
                </p>
              ) : values.updatedAt ? (
                <p className="cn-block-notify-note">{fill(copy.lastUpdated, { date: <DateText locale={locale} timeZone={timeZone} iso={values.updatedAt} as="since" /> })}</p>
              ) : null}
            </div>
            <p className="cn-block-notify-required">{copy.required}</p>
          </>
        ) : null}
      </div>
    </section>
  )
}
