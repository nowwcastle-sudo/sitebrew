"use client"

import * as React from "react"

import { Check, Copy } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

// 복사 버튼(P3-2 Task 7a, 대장 A45 — 공유 조각 block-shared-copy-button): 2단계 백업 코드·초대 링크·API 키·주소처럼 글 하나를 클립보드로 보내는 버튼.
// 결과는 버튼 옆 알림 자리(role="status" — 늘 그려져 있어야 읽기 도구가 바뀐 글을 읽는다)에 「복사했어요」로 알리고, 클립보드가 막히면(권한·http·인앱 브라우저)
// 조용히 실패하지 않고 「직접 복사해 주세요」(manual)를 알린다. 알림은 resetMs 뒤 지워지고 아이콘도 돌아온다. onCopied: 복사가 끝나면(계측).
export type CopyButtonCopy = { copy: string; copied: string; manual: string }

/** 글을 클립보드로. 되면 true, 막히면 false */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 권한 거부·http — 아래 옛 방식으로
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export function CopyButton({
  text,
  copy,
  onCopied,
  onManual,
  variant = "outline",
  size = "default",
  resetMs = 2500,
  className,
}: {
  text: string
  copy: CopyButtonCopy
  onCopied?: () => void
  // 클립보드가 막혔을 때(칸을 골라 주는 등 — 직접 복사 안내 글은 이 컴포넌트가 낸다)
  onManual?: () => void
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg"
  resetMs?: number
  // 버튼과 알림을 감싼 줄의 훅(블록이 자리를 정한다)
  className?: string
}) {
  const [status, setStatus] = React.useState<"idle" | "copied" | "manual">("idle")
  React.useEffect(() => {
    if (status === "idle") return
    const t = window.setTimeout(() => setStatus("idle"), status === "manual" ? resetMs * 3 : resetMs)
    return () => window.clearTimeout(t)
  }, [status, resetMs])
  const run = async () => {
    if (await copyText(text)) {
      setStatus("copied")
      onCopied?.()
    } else {
      setStatus("manual")
      onManual?.()
    }
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Button type="button" variant={variant} size={size} /* icon-label: 글자(copy.copy)가 늘 보인다 — size 는 default·sm·lg 뿐 */ onClick={run} data-copy-button="">
        {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copy.copy}
      </Button>
      <span role="status" data-copy-status={status} className="text-base leading-[1.5]">
        {status === "copied" ? copy.copied : status === "manual" ? copy.manual : ""}
      </span>
    </div>
  )
}
