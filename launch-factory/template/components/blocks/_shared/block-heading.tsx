import * as React from "react"

import { cn } from "@/lib/utils"

import { usePageHeadingLevel } from "../_shared/heading-level"

// 블록 머리(P3-2 공유 조각 block-shared-block-heading): 섹션 제목 h2 + 선택 머리말. h1 은 hero kind 만 가진다 — 단 쪽 제목을 이 블록이 맡는 쪽(PageHeading level=1 로 감싼 잎, FINAL-WF3)에서는 h1.
// id 는 섹션 루트의 aria-labelledby 가 가리킨다. 등장 대상([data-enter])이라 장면이 올리고, 첫 칠 가림은 MotionBoot 가 맡는다.
export function BlockHeading({ id, title, lead, className }: { id: string; title: React.ReactNode; lead?: React.ReactNode; className?: string }) {
  const Title = usePageHeadingLevel() === 1 ? "h1" : "h2"
  return (
    <div className={cn("flex max-w-3xl flex-col gap-3", className)}>
      <Title id={id} data-enter className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading">
        {title}
      </Title>
      {lead ? (
        <p data-enter className="text-base leading-[1.7]">
          {lead}
        </p>
      ) : null}
    </div>
  )
}
