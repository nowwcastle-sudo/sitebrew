import * as React from "react"

import { cn } from "@/lib/utils"

// 사람 승인 행동의 눈에 보이는 안내 글(P3-7 AXWF, 감사 M01·M05·U20, 규칙 R18). 표(어떤 행동이 승인 행동인가)는 contract/human-actions.ts 가 정본이다.
//   · 승인 행동의 제출·확정 컨트롤마다 이 안내 글을 한 줄 달고, 컨트롤에는 `{...humanApprovalProps("<행동>", hintId)}` 를 펼친다 —
//     data-requires-human(기계 표지)과 aria-describedby(읽기 도구가 컨트롤을 읽을 때 안내 글도 같이 읽는다)가 함께 붙는다.
//   · 글은 블록 copy.humanHint 가 준다(하드코딩 없음 — 권장 기본값은 APPROVAL_HINT.ko·en). 한 줄 안쪽으로 짧게(HINT_MAX_CHARS).
//   · 확인을 더 늘리지 않는다: 이 조각은 안내일 뿐 새 확인 단계가 아니다. 조회·검색·채우기·초안(agent-ok)에는 달지 않는다(승인 피로 — M05).
//   · 같은 묶음의 컨트롤(해지 세 곳 등)은 한 안내 글을 같이 가리켜도 된다.

/** 승인 행동 컨트롤 곁에 두는 짧은 안내 글. id 는 컨트롤의 aria-describedby 가 가리키는 값 */
export function ApprovalHint({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <p id={id} data-human-hint="" className={cn("text-base leading-[1.6] text-foreground", className)}>
      {children}
    </p>
  )
}
