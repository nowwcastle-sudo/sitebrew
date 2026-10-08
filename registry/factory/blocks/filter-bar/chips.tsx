"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { X } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"

import { fillText } from "../_shared/billing-format"
import { listOf, toList, useDomFilter, useQueryState } from "../_shared/filter-query"

// 분류 칩 줄(상품 목록 위 — commerce category-list/filter-chips). 칩은 진짜 버튼이고 눌림 상태는 aria-pressed 로 알린다. 첫 칩 「전체」는 거르기를 푼다.
// single: 하나만 고른다(고른 칩을 다시 누르면 풀린다) · multi: 여럿을 고른다(고른 값은 쉼표로 이어 한 쿼리 칸에 둔다).
// 거른 상태는 주소 쿼리(?category=…)에 있어 새로고침·공유에서 그대로다(_shared/filter-query). 같은 문서의 target 항목에 data-filter-<param> 속성이 있으면 그 항목을 직접 거른다
// (속성이 없으면 항목 글에서 칩 이름을 찾는다). 서버가 거르는 목록은 target 없이 onChange 로 다시 읽는다. 결과 수는 role=status 라 거른 결과를 스크린리더가 듣는다.
export type FilterOption = { value: string; label: string; count?: number }
export type FilterBarChipsCopy = {
  // 칩 묶음 이름(보이는 라벨 — 묶음의 접근 이름)
  label: string
  allLabel: string
  // 결과 수 문장 — {shown}·{total} 자리. 없으면 결과 수 줄을 그리지 않는다
  count?: string
  resetLabel?: string
}
export type FilterBarChipsProps = BlockBase<FilterBarChipsCopy> & {
  options: FilterOption[]
  param?: string
  mode?: "single" | "multi"
  // 칸 거르기를 이 블록이 하는 목록 항목 셀렉터(없으면 거르지 않는다 — 조립하는 쪽이 읽는다)
  target?: string
  // 서버가 센 결과 수(target 이 없을 때)
  resultCount?: { shown: number; total: number }
  // 서버 렌더·검사에서 주소 대신 쓰는 시작 값
  initial?: Record<string, string>
  onChange?: (values: Record<string, string>) => void
}

export function FilterBarChips({ copy, options, param = "category", mode = "single", target, resultCount, initial, onChange, id = "filter-chips", className }: FilterBarChipsProps) {
  const q = useQueryState(initial, onChange)
  const picked = listOf(q.get(param))
  const values = { [param]: toList(picked) }
  const counted = useDomFilter(target, values, q.ready)
  const shown = counted ?? resultCount
  const toggle = (value: string) => {
    if (mode === "single") q.set({ [param]: picked.includes(value) ? null : value })
    else q.set({ [param]: toList(picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value]) })
  }
  const labelId = `${id}-label`
  return (
    <div id={id} data-block="filter-bar-chips" data-mode={mode} data-filtered={picked.length ? "" : undefined} className={cn("cn-block-fb", className)}>
      <p id={labelId} className="cn-block-fb-label">
        {copy.label}
      </p>
      <div role="group" aria-labelledby={labelId} className="cn-block-fb-chiprow">
        <ul className="cn-block-fb-chips">
          <li>
            <button type="button" aria-pressed={picked.length === 0} data-chip="all" onClick={() => q.set({ [param]: null })} className="cn-block-fb-chip">
              {copy.allLabel}
            </button>
          </li>
          {options.map((o) => (
            <li key={o.value}>
              <button type="button" aria-pressed={picked.includes(o.value)} data-chip={o.value} onClick={() => toggle(o.value)} className="cn-block-fb-chip">
                {o.label}
                {o.count !== undefined ? (
                  <span data-numeric className="cn-block-fb-chip-count">
                    {o.count}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        {picked.length && copy.resetLabel ? (
          <button type="button" data-reset onClick={() => q.set({ [param]: null })} className="cn-block-fb-reset">
            <X aria-hidden="true" className="cn-block-fb-reset-icon" />
            {copy.resetLabel}
          </button>
        ) : null}
      </div>
      {copy.count ? (
        <p role="status" data-result-count={shown?.shown} className="cn-block-fb-count">
          {shown ? fillText(copy.count, { shown: shown.shown, total: shown.total }) : null}
        </p>
      ) : null}
    </div>
  )
}
