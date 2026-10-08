import * as React from "react"

import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

// 답 확인(P3-2 Task 7a, 대장 A63 — 공유 조각 block-shared-review-summary): 보내기 전에 고른 것·적은 것을 한 번 더 보이고 항목마다 [고치기]를 준다.
// GOV.UK 「Check answers」·KRDS 신청 패턴 「확인·확정」(취소·수정이 안 되면 필수). 예약 폼과 주문서(A60)가 같은 조각을 쓴다.
// dl(항목 이름 · 값) + 항목마다 [고치기](보이는 글은 「고치기」, 접근 이름은 「<항목> 고치기」 — 보이는 글을 품는다, WCAG 2.5.3). 값이 비면 empty 글로 보인다.
// 「확정」과 「돌아가기」는 이 조각이 아니라 부모가 대등한 두 버튼으로 둔다.
export type ReviewRow = { key: string; label: string; value: React.ReactNode; onEdit?: () => void; numeric?: boolean }
export type ReviewSummaryCopy = { editLabel: string; empty: string }

export function ReviewSummary({ rows, copy, className }: { rows: ReviewRow[]; copy: ReviewSummaryCopy; className?: string }) {
  return (
    <dl data-review="" className={cn("flex flex-col divide-y border-y", className)}>
      {rows.map((r) => (
        <div key={r.key} data-review-row={r.key} className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3">
          <dt className="text-base leading-[1.5] text-muted-foreground">{r.label}</dt>
          <dd data-numeric={r.numeric ? "" : undefined} className="min-w-0 text-base leading-[1.5] break-words">{r.value === "" || r.value == null ? copy.empty : r.value}</dd>
          {r.onEdit ? (
            <dd className="justify-self-end">
              <Button type="button" variant="outline" size="sm" onClick={r.onEdit} aria-label={`${r.label} ${copy.editLabel}`}>
                {copy.editLabel}
              </Button>
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  )
}
