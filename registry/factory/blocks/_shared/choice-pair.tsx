import * as React from "react"

import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

// 대등한 두 선택지(P3-2 레인 D1 공유 조각 block-shared-choice-pair). 마케팅 규칙 L3(factory-rules.md §22-1): 구매·가입·동의·해지의 두 선택지는
// 크기·대비·위치가 대등하다 — 두 버튼은 같은 변형(outline)·같은 크기(lg)·같은 폭(한 줄을 반씩)이다. 주 선택을 색으로 키우지 않는다.
// 순서는 [거절·보조][주] — 보조 왼쪽, 주 오른쪽(DESIGN §7-B, 한 사이트 안에서 바꾸지 않는다). 좁으면 위아래로 쌓고 같은 폭이다.
// data-choice="decline|primary" 는 관문(marketing-gate ⑥ 크기 비·대비)과 정적 검사가 읽는 표지다. 거절 문구는 담백하게(「해지하기」).

/** 두 선택지를 담는 줄(role=group). label 은 묶음 이름(읽기 도구) */
export function ChoiceRow({ label, className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} data-choice-group="" className={cn("cn-block-choice-row", className)}>
      {children}
    </div>
  )
}

type ButtonProps = React.ComponentProps<typeof Button>
/** 선택지 버튼 하나 — choice 로 역할만 적는다(모양은 둘이 같다) */
export function ChoiceButton({ choice, className, ...props }: Omit<ButtonProps, "variant" | "size"> & { choice: "decline" | "primary" }) {
  return <Button {...props} variant="outline" size="lg" /* icon-label: 선택지는 늘 글자가 있다 */ data-choice={choice} className={cn("cn-block-choice", className)} />
}
