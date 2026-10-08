"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { X } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { NativeSelect, NativeSelectOption } from "@/registry/factory/ui/native-select"

import { fillText } from "../_shared/billing-format"
import { useDomFilter, useDomSort, useQueryState } from "../_shared/filter-query"

// 도구 줄(commerce 상품 목록 위 정렬·결과 수 / dashboard 기간·비교·갱신 시각 줄). 왼쪽: 결과 수 문장(role=status). 오른쪽: 이름이 늘 보이는 select 여럿(정렬·기간…) + 비교 체크(선택) +
// 「기준 시각」 줄(선택 — 마지막 갱신 시각이라 <time>). 고른 값은 주소 쿼리(?sort=…&period=…)에 있어 새로고침·공유에서 그대로다(_shared/filter-query) — 값을 읽어 목록을 다시 그리는 일은
// 조립하는 쪽 몫(onChange). 기간·정렬은 거르기 대상이 아니라 target 을 주어도 항목을 숨기지 않는다(target 은 filterParams 로 지정한 이름만 건다).
// select 는 native 라 키보드·보조기술이 그대로 되고, 모든 칸에 눈에 보이는 라벨이 있다. 등장 모션 없음.
export type FilterSelectOption = { value: string; label: string }
export type FilterControl = { id: string; label: string; param: string; options: FilterSelectOption[]; defaultValue?: string }
export type FilterBarToolbarCopy = {
  // 도구 줄 이름(읽기 도구용)
  label: string
  // 결과 수 문장 — {shown}·{total} 자리(없으면 결과 수 줄을 그리지 않는다)
  count?: string
  compare?: { label: string; param?: string }
  asOf?: { label: string; value: string; iso?: string }
  resetLabel?: string
}
export type FilterBarToolbarProps = BlockBase<FilterBarToolbarCopy> & {
  controls: FilterControl[]
  // 서버가 센 결과 수
  resultCount?: { shown: number; total: number }
  // 거르기 항목 셀렉터와 그에 쓸 이름(정렬·기간 같은 건 빼고 거르는 이름만)
  target?: string
  // 정렬을 이 블록이 하는 목록 항목 셀렉터 — 항목의 data-sort-<키>(숫자)를 읽어 순서만 바꾼다(정렬 select 의 param 은 sort)
  sortTarget?: string
  filterParams?: string[]
  initial?: Record<string, string>
  onChange?: (values: Record<string, string>) => void
}

export function FilterBarToolbar({ copy, controls, resultCount, target, sortTarget, filterParams = [], initial, onChange, id = "filter-toolbar", className }: FilterBarToolbarProps) {
  const q = useQueryState(initial, onChange)
  const valueOf = (c: FilterControl) => q.get(c.param) || c.defaultValue || c.options[0]?.value || ""
  const compareParam = copy.compare?.param ?? "compare"
  const compareOn = q.get(compareParam) === "1"
  const filtering = Object.fromEntries(filterParams.map((n) => [n, q.get(n)]))
  const counted = useDomFilter(target, filtering, q.ready)
  useDomSort(sortTarget, q.get("sort"), q.ready)
  const shown = counted ?? resultCount
  const changed = controls.some((c) => q.get(c.param) !== "" && q.get(c.param) !== (c.defaultValue ?? c.options[0]?.value)) || compareOn
  return (
    <div id={id} role="group" aria-label={copy.label} data-block="filter-bar-toolbar" className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 py-4 text-foreground md:px-8 gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between", className)}>
      {copy.count ? (
        <p role="status" data-result-count={shown?.shown} className="min-h-6 text-base leading-[1.5] md:self-center">
          {shown ? fillText(copy.count, { shown: shown.shown, total: shown.total }) : null}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-4">
        {controls.map((c) => (
          <div key={c.id} className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${id}-${c.id}`} className="text-base leading-[1.5] font-medium">
              {c.label}
            </label>
            <NativeSelect id={`${id}-${c.id}`} name={c.param} value={valueOf(c)} onChange={(e) => q.set({ [c.param]: e.target.value === (c.defaultValue ?? c.options[0]?.value) ? null : e.target.value })} className="w-full md:w-56">
              {c.options.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))}
        {copy.compare ? (
          <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 text-base leading-[1.35]">
            <input type="checkbox" name={compareParam} checked={compareOn} onChange={(e) => q.set({ [compareParam]: e.target.checked ? "1" : null })} className="size-5 shrink-0 accent-primary" />
            <span>{copy.compare.label}</span>
          </label>
        ) : null}
        {changed && controls.length && copy.resetLabel ? (
          <button
            type="button"
            data-reset
            onClick={() => q.set(Object.fromEntries([...controls.map((c) => [c.param, null] as const), [compareParam, null] as const]))}
            className="relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-base leading-[1.35] underline underline-offset-4 outline-hidden hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="size-4 shrink-0" />
            {copy.resetLabel}
          </button>
        ) : null}
      </div>
      {copy.asOf ? (
        <p className="w-full text-base leading-[1.5]">
          {copy.asOf.label}{" "}
          {copy.asOf.iso ? (
            <time dateTime={copy.asOf.iso} data-numeric>
              {copy.asOf.value}
            </time>
          ) : (
            <span>{copy.asOf.value}</span>
          )}
        </p>
      ) : null}
    </div>
  )
}
