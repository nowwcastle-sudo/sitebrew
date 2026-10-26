"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { Check, Minus } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/registry/factory/ui/table"

import { BlockHeading } from "../_shared/block-heading"

// 기능 — 우리 대 다른 방식 비교표. 행은 비교 기준, 첫 값 열이 우리(강조), 나머지가 다른 방식. 칸 값은 글자(수치면 data-numeric)
// 또는 있음·없음(아이콘 + 읽기 도구용 글자). 표는 좁은 화면에서 표 안에서만 가로로 밀린다(쪽 전체는 넘치지 않는다).
type CellValue = string | boolean
export type FeaturesCompareTableCopy = {
  title: string
  lead?: string
  // 표 설명(caption) — 무엇을 무엇과 비교하는지 한 문장.
  caption: string
  // 첫 머리 칸(기준 열 이름).
  criteriaLabel: string
  us: string
  them: string[]
  rows: { label: string; us: CellValue; them: CellValue[] }[]
  yesLabel: string
  noLabel: string
  // 표 바로 아래 각주(대장 A120) — 표에 원화 값이 있으면 「비용은 부가세 포함 월 금액이에요」처럼 총액·VAT 문구
  footnote?: string
}
export type FeaturesCompareTableProps = BlockBase<FeaturesCompareTableCopy>

// 숫자로 시작하는 짧은 값(「5분」·「12,900원」·「99.9%」)은 숫자 열 모양으로.
const numeric = (v: string) => /^[\d.,:+~-]+\s?\S{0,3}$/.test(v.trim())

export function FeaturesCompareTable({ copy, id = "features", className }: FeaturesCompareTableProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const cell = (v: CellValue, us: boolean, key: string) => (
    <TableCell key={key} data-us={us ? "" : undefined} data-numeric={typeof v === "string" && numeric(v) ? "" : undefined} className="py-3 data-[us]:bg-muted data-[us]:font-medium">
      {typeof v === "boolean" ? (
        <span className="inline-flex items-center text-muted-foreground data-[on]:text-foreground" data-on={v ? "" : undefined}>
          {v ? <Check aria-hidden="true" className="size-5" /> : <Minus aria-hidden="true" className="size-5" />}
          <span className="sr-only">{v ? copy.yesLabel : copy.noLabel}</span>
        </span>
      ) : (
        v
      )}
    </TableCell>
  )
  return (
    <section ref={ref} id={id} data-block="features-compare-table" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <div data-enter className="min-w-0">
        <Table>
          <TableCaption className="mt-4 text-start text-base leading-[1.6]">{copy.caption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="min-w-24 py-3 text-start sm:min-w-40">
                {copy.criteriaLabel}
              </TableHead>
              <TableHead scope="col" data-us="" className="min-w-20 py-3 text-start whitespace-normal data-[us]:bg-muted sm:min-w-28">
                {copy.us}
              </TableHead>
              {copy.them.map((t, i) => (
                <TableHead key={i} scope="col" className="min-w-20 py-3 text-start whitespace-normal data-[us]:bg-muted sm:min-w-28">
                  {t}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {copy.rows.map((r, i) => (
              <TableRow key={i}>
                <TableHead scope="row" className="h-auto py-3 text-start whitespace-normal">
                  {r.label}
                </TableHead>
                {cell(r.us, true, "us")}
                {r.them.map((v, j) => cell(v, false, `t${j}`))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {copy.footnote ? <p className="mt-3 text-base leading-[1.6] text-muted-foreground">{copy.footnote}</p> : null}
      </div>
    </section>
  )
}
