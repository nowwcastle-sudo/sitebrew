"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { ExternalLink, Mail, X } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"

import { ChatIcon, useFloatingDrawn, useFloatingSpace } from "../_shared/floating-kit"

// 메신저 문의 단추(떠 있는 채팅 대신 링크 판). 오른쪽 아래에 글자가 보이는 알약 단추 하나 — 누르면 위로 작은 판이 펼쳐지고 카카오 채널·메일 같은 문의 길이 링크로 나열된다.
// 채팅 위젯 스크립트·외부 상담 도구를 불러오지 않는다(첫 화면 속도·개인정보 — 링크를 눌러야 바깥으로 나간다). 판은 대화상자가 아니라 펼침 판이다: 초점을 가두지 않고, Esc 나 바깥 누름으로 닫히며 닫히면 초점이 단추로 돌아온다.
// 아래 고정 줄(call-bar·쿠키 띠)이 있으면 그 위로 올라앉고(--wf-float-bar·--bottom-bar-height), 가린 높이만큼 문서 뿌리의 scroll-padding-bottom 을 준다(useFloatingSpace — WCAG 2.4.11). 하단 탭이 있는 쪽에서는 그리지 않는다.
export type ChatChannel = { kind: "messenger" | "mail" | "link"; label: string; href: string; hint?: string }
export type FloatingActionChatLauncherCopy = {
  // 단추에 보이는 글(= 접근 이름): 「문의하기」
  open: string
  // 펼친 판의 이름: 「문의 채널」
  title: string
  // 답하는 시간 같은 한 줄(선택)
  note?: string
  close: string
  channels: ChatChannel[]
}
export type FloatingActionChatLauncherProps = BlockBase<FloatingActionChatLauncherCopy> & {
  track?: AnalyticsPort["track"]
}

const KIND_ICON = { mail: Mail, link: ExternalLink } as const

export function FloatingActionChatLauncher({ copy, track, id = "chat-launcher", className }: FloatingActionChatLauncherProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const button = React.useRef<HTMLButtonElement>(null)
  const [open, setOpen] = React.useState(false)
  const drawn = useFloatingDrawn()
  useFloatingSpace(root, { active: drawn })
  React.useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [open])
  if (!drawn) return null
  const panelId = `${id}-panel`
  const titleId = `${id}-title`
  const toggle = () => {
    if (!open) track?.("cta_click", { id: "chat-launcher-open", label: copy.open, section: id })
    setOpen((o) => !o)
  }
  const closeToButton = () => {
    setOpen(false)
    button.current?.focus()
  }
  return (
    <div
      ref={root}
      id={id}
      data-block="floating-action-chat-launcher"
      onKeyDown={(e) => {
        if (open && e.key === "Escape") closeToButton()
      }}
      className={cn("fixed end-3 bottom-[calc(var(--wf-float-bar,0px)_+_var(--bottom-bar-height,0px)_+_env(safe-area-inset-bottom)_+_0.75rem)] z-40 flex flex-col items-end gap-2 xl:end-4", className)}
    >
      <div id={panelId} role="group" aria-labelledby={titleId} hidden={!open} className="flex w-[min(20rem,calc(100vw_-_1.5rem))] flex-col gap-2 rounded-lg border bg-background p-4 text-foreground shadow-(--wf-shadow-surface)">
        <p id={titleId} className="text-[1.125rem] leading-[1.4] font-heading-ko">
          {copy.title}
        </p>
        {copy.note ? <p className="text-base leading-[1.5]">{copy.note}</p> : null}
        <ul className="flex flex-col gap-1">
          {copy.channels.map((c, i) => {
            const Icon = c.kind === "messenger" ? null : KIND_ICON[c.kind]
            return (
              <li key={i}>
                <a href={c.href} data-channel={c.kind} onClick={() => track?.("cta_click", { id: `chat-launcher-${c.kind}`, label: c.label, section: id })} className="relative flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted">
                  {Icon ? <Icon aria-hidden="true" className="size-5 shrink-0" /> : <ChatIcon className="size-5 shrink-0" />}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-base leading-[1.4] [overflow-wrap:anywhere]">{c.label}</span>
                    {c.hint ? <span className="text-sm leading-[1.4] [overflow-wrap:anywhere]">{c.hint}</span> : null}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
        <button type="button" data-fa-close="" onClick={closeToButton} className="relative inline-flex min-h-11 items-center justify-center gap-1.5 self-end rounded-lg px-3 text-base leading-[1.35] hover:bg-muted">
          <X aria-hidden="true" className="size-4" />
          {copy.close}
        </button>
      </div>
      <button ref={button} type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle} className="inline-flex min-h-12 items-center gap-2 rounded-full border bg-foreground px-5 py-2 text-base leading-[1.35] text-background shadow-(--wf-shadow-surface) hover:bg-foreground/90">
        <ChatIcon className="size-5 shrink-0" />
        {copy.open}
      </button>
    </div>
  )
}
