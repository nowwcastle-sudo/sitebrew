"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { Skeleton } from "@/registry/factory/ui/skeleton"

// 첫 화면 로딩 뼈대(대장 C70 — 원형 noBlock part skeleton: pwa 홈). factory-rules.md §21-9 「앱 셸은 캐시에서 먼저 그리고 데이터는 스켈레톤으로 채운다」 —
// 앱 고유 데이터(제품 층)가 붙기 전 자리다. 레시피 skeleton 부품(동작 줄이기면 깜빡임 없음)을 목록 줄 모양으로 놓고, 읽기 도구에는
// aria-busy 와 이름(copy.label)만 알린다. 줄 수는 화면 모양이지 사실이 아니다.
export type ContentSkeletonCopy = { label: string }
export type ContentSkeletonProps = BlockBase<ContentSkeletonCopy> & { lines?: number; first?: boolean }

export function ContentSkeleton({ copy, lines = 4, id = "skeleton", className }: ContentSkeletonProps) {
  const rows = Array.from({ length: Math.max(1, Math.min(lines, 8)) })
  return (
    <section id={id} data-block="content-skeleton" aria-busy="true" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-content-section", className)}>
      <h2 id={`${id}-title`} className="sr-only">
        {copy.label}
      </h2>
      <ul aria-hidden="true" className="cn-block-content-skeleton">
        {rows.map((_, i) => (
          <li key={i} className="cn-block-content-skeleton-row">
            <Skeleton className="cn-block-content-skeleton-mark" />
            <span className="cn-block-content-skeleton-lines">
              <Skeleton className="cn-block-content-skeleton-line" />
              <Skeleton data-short="" className="cn-block-content-skeleton-line" />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
