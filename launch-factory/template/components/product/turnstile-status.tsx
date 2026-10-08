"use client"

import * as React from "react"

import type { BotCopy, BotStatus } from "@/components/product/turnstile"

// 가입 폼 아래의 봇 확인 자리(A07). 위젯(interaction-only — 사람 확인이 눈에 안 띄게 끝난다)이 그려지는 상자 + 지금 상태를 알리는 글.
// 확인 중(checking)·제출을 눌러 기다리는 중(waiting)·막힘(failed)일 때만 글이 보이고, 끝나면(ready) 사라진다.
// 글은 role="status"(읽어 주되 포커스를 훔치지 않는다). 제출은 확인이 끝나기 전에는 서버로 나가지 않는다(components/product/turnstile.ts).
export function TurnstileStatus({ box, status, copy }: { box: React.RefObject<HTMLDivElement | null>; status: BotStatus; copy: BotCopy }) {
  const text = status === "checking" ? copy.checking : status === "waiting" ? copy.waiting : status === "failed" ? copy.failed : null
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2 px-4">
      <div ref={box} className="flex w-full justify-center" />
      <p role="status" data-bot-status={status} className="min-h-6 text-center text-base leading-[1.6]">
        {text}
      </p>
    </div>
  )
}
