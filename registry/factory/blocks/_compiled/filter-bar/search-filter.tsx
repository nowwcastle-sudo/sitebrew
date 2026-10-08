"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { Search, X } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Input } from "@/registry/factory/ui/input"
import { NativeSelect, NativeSelectOption } from "@/registry/factory/ui/native-select"

import { fillText } from "../_shared/billing-format"
import { useDomFilter, useQueryState } from "../_shared/filter-query"

// 검색·거르기 줄(dashboard admin-list/search-filter-bar — 표 위). 검색 칸(보이는 라벨, role=search 폼) + 상태 같은 거르기 select + 결과 수(role=status) + [필터 초기화](걸렸을 때만).
// 검색어(?q=…)와 거르기 값(?status=…)은 주소 쿼리에 있다(_shared/filter-query) — 새로고침·공유에서 그대로다. 검색은 입력할 때마다 바로 걸린다(Enter 를 기다리지 않는다 — 한글 조합 중에도 글자가 흐트러지지 않게
// 칸의 값은 이 블록 안 상태로 두고 주소에 같이 쓴다). 같은 문서의 target 셀렉터에 맞는 항목(표 행·카드)을 직접 거르거나(q 는 항목 글, 거르기 이름은 data-filter-<이름> 속성·없으면 항목 글),
// 쪽마다 서버가 거르는 표는 target 없이 onChange 로 다시 읽는다. 결과 수 문장은 {shown}·{total} 자리.
export type FilterFacet = { id: string; label: string; param: string; allLabel: string; options: { value: string; label: string }[] }
export type FilterBarSearchFilterCopy = {
  // 줄 이름(검색 구역의 접근 이름)
  label: string
  search: { label: string; placeholder?: string }
  count: string
  resetLabel: string
}
export type FilterBarSearchFilterProps = BlockBase<FilterBarSearchFilterCopy> & {
  facets?: FilterFacet[]
  resultCount?: { shown: number; total: number }
  target?: string
  initial?: Record<string, string>
  onChange?: (values: Record<string, string>) => void
}

export function FilterBarSearchFilter({ copy, facets = [], resultCount, target, initial, onChange, id = "search-filter", className }: FilterBarSearchFilterProps) {
  const q = useQueryState(initial, onChange)
  const urlText = q.get("q")
  // 칸의 글은 이 블록 안 상태(한글 조합 중 값이 흐트러지지 않게). 주소가 바깥에서 바뀌면(뒤로 가기·초기화) 따라간다.
  // (렌더 중 보정: 주소의 검색어가 바뀌면 임시 글을 버리고 주소를 따른다 — 효과 안에서 상태를 동기로 바꾸지 않는다)
  const [draft, setDraft] = React.useState<string | null>(null)
  const [seen, setSeen] = React.useState(urlText)
  if (seen !== urlText) {
    setSeen(urlText)
    setDraft(null)
  }
  const text = draft ?? urlText
  const values: Record<string, string> = { q: urlText, ...Object.fromEntries(facets.map((f) => [f.param, q.get(f.param)])) }
  const counted = useDomFilter(target, values, q.ready)
  const shown = counted ?? resultCount
  const active = Object.values(values).some((v) => v !== "")
  return (
    <div id={id} data-block="filter-bar-search-filter" data-filtered={active ? "" : undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col px-4 py-4 text-foreground md:px-8 gap-2", className)}>
      <form role="search" method="get" aria-label={copy.label} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-4">
        <div className="flex min-w-0 flex-col gap-1.5 md:w-80">
          <label htmlFor={`${id}-q`} className="text-base leading-[1.5] font-medium">
            {copy.search.label}
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              id={`${id}-q`}
              type="search"
              name="q"
              autoComplete="off"
              value={text}
              placeholder={copy.search.placeholder}
              onChange={(e) => {
                setDraft(e.target.value)
                q.set({ q: e.target.value })
              }}
              className="ps-9"
            />
          </div>
        </div>
        {facets.map((f) => (
          <div key={f.id} className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${id}-${f.id}`} className="text-base leading-[1.5] font-medium">
              {f.label}
            </label>
            <NativeSelect id={`${id}-${f.id}`} name={f.param} value={q.get(f.param)} onChange={(e) => q.set({ [f.param]: e.target.value })} className="w-full md:w-56">
              <NativeSelectOption value="">{f.allLabel}</NativeSelectOption>
              {f.options.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ))}
        {active ? (
          <button type="button" data-reset onClick={() => q.set({ q: null, ...Object.fromEntries(facets.map((f) => [f.param, null])) })} className="relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-base leading-[1.35] underline underline-offset-4 outline-hidden hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring">
            <X aria-hidden="true" className="size-4 shrink-0" />
            {copy.resetLabel}
          </button>
        ) : null}
      </form>
      <p role="status" data-result-count={shown?.shown} className="min-h-6 text-base leading-[1.5]">
        {shown ? fillText(copy.count, { shown: shown.shown, total: shown.total }) : null}
      </p>
    </div>
  )
}
