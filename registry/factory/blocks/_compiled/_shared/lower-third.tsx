import * as React from "react"

import { cn } from "@/registry/factory/lib/utils"

// 로어 서드(이름표 띠 — P3-5 MOTKIT, 공유 조각 block-shared-lower-third): 영상·사진 위 아래쪽에 막대 + 이름 + 역할 한 줄.
// 표지 약속은 모션 키트 lowerThird·kenBurns(gsap-techniques)와 같다 — 뿌리 [data-lt] > [data-lt-item] > .lt-bar · .lt-mask > .lt-text.
// 첫 항목만 보이고 나머지는 훅 CSS 가 숨긴다(장면이 차례로 바꾼다 — 유휴 반복이라 정지 단추는 부르는 쪽 몫). 읽기 도구는 sr-only 목록으로 모두 한 번 읽고,
// 보이는 띠는 aria-hidden 사본이다(바뀌는 글을 그때마다 읽히지 않는다). 글이 영상 위라 띠 판(면)이 글 뒤를 받친다(대비는 판 색이 정한다).
// keep: 히어로 첫 화면에 둘 때 등장 대상이지만 숨기지 않는다(data-enter="keep" — 서버 렌더 첫 칠부터 보이고 장면이 끝 상태로 둔다).
export type LowerThirdItem = { name: string; role?: string }

export function LowerThird({ items, label, keep = false, className }: { items: LowerThirdItem[]; label?: string; keep?: boolean; className?: string }) {
  if (!items.length) return null
  return (
    <div data-lt="" {...(keep ? { "data-enter": "keep" } : {})} className={cn("relative", className)}>
      <ul aria-label={label} className="sr-only">
        {items.map((it, i) => (
          <li key={i}>
            {it.name}
            {it.role ? ` — ${it.role}` : ""}
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className="grid">
        {items.map((it, i) => (
          <p key={i} data-lt-item="" className="col-start-1 row-start-1 grid max-w-[min(28rem,88vw)] grid-cols-[0.375rem_minmax(0,1fr)] gap-x-3 self-start justify-self-start bg-background py-2.5 ps-3 pe-4 text-foreground shadow-(--wf-shadow-surface) [&:not(:first-child)]:invisible">
            <span className="row-span-2 w-1.5 self-stretch bg-primary lt-bar" />
            <span className="col-start-2 block overflow-clip lt-mask">
              <span className="block text-base leading-[1.35] lt-text">{it.name}</span>
            </span>
            {it.role ? (
              <span className="col-start-2 block overflow-clip lt-mask">
                <span className="block text-sm leading-[1.4] lt-text">{it.role}</span>
              </span>
            ) : null}
          </p>
        ))}
      </div>
    </div>
  )
}
