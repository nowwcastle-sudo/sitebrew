"use client"

import * as React from "react"

import { Download } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

import { CopyButton, type CopyButtonCopy } from "../_shared/copy-button"
import type { TableCellValue, TableColumn, TableRowData } from "../_shared/data-table-kit"

// 표 내보내기 조각(block-shared-export-actions — FV1 Task 5.8, 데이터 표 세 변형의 선택 칸). [CSV 내려받기]와 [표 복사] 두 단추.
//   · 내보내는 것은 지금 거르고 정렬한 결과 전부다(쪽 하나가 아니다) — 조립하는 쪽이 rows 를 그렇게 준다.
//   · 칸 값은 화면 글자가 아니라 원래 값이다(숫자는 숫자, 날짜는 받은 그대로) — 스프레드시트가 다시 읽을 수 있다.
//   · CSV 는 RFC 4180 따옴표 규칙 + 한글 엑셀이 깨지지 않게 UTF-8 BOM. 칸이 = + - @ 탭 줄바꿈으로 시작하는 글이면 앞에 ' 를 붙인다(스프레드시트 수식 주입 방지 — OWASP CSV Injection).
//   · 복사는 탭으로 나눈 글(스프레드시트에 붙여넣으면 칸이 나뉜다). 클립보드가 막히면 조용히 실패하지 않고 「직접 복사해 주세요」를 알린다(CopyButton).
//   · 문구는 모두 copy 가 준다. 서버로 보내는 것은 없다 — 파일은 이 브라우저 안에서 만든다.
export type ExportCopy = {
  // CSV 파일 이름(확장자 없이)
  filename: string
  csv: string
  csvDone: string
  copy: CopyButtonCopy
}

const BOM = "﻿"
const FORMULA = /^[=+\-@\t\r\n]/
const guard = (v: TableCellValue | undefined): string => {
  if (v === null || v === undefined) return ""
  const s = String(v)
  return typeof v === "string" && FORMULA.test(s) ? `'${s}` : s
}
const csvCell = (v: TableCellValue | undefined): string => {
  const s = guard(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const tsvCell = (v: TableCellValue | undefined): string => guard(v).replace(/[\t\r\n]+/g, " ")

/** CSV 글(BOM 포함, 줄 끝 CRLF, 마지막 줄 끝 없음) */
export function toCsv(columns: TableColumn[], rows: TableRowData[]): string {
  const head = columns.map((c) => csvCell(c.label)).join(",")
  const body = rows.map((r) => columns.map((c) => csvCell(r.cells[c.id])).join(","))
  return BOM + [head, ...body].join("\r\n")
}

/** 탭으로 나눈 글(스프레드시트 붙여넣기용) */
export function toTsv(columns: TableColumn[], rows: TableRowData[]): string {
  const head = columns.map((c) => tsvCell(c.label)).join("\t")
  const body = rows.map((r) => columns.map((c) => tsvCell(r.cells[c.id])).join("\t"))
  return [head, ...body].join("\n")
}

export function ExportActions({
  columns,
  rows,
  copy,
  onExport,
  className,
}: {
  columns: TableColumn[]
  rows: TableRowData[]
  copy: ExportCopy
  // 계측용: 내려받기·복사가 끝나면 부른다
  onExport?: (how: "csv" | "copy") => void
  className?: string
}) {
  const [done, setDone] = React.useState(false)
  React.useEffect(() => {
    if (!done) return
    const t = window.setTimeout(() => setDone(false), 2500)
    return () => window.clearTimeout(t)
  }, [done])
  const tsv = React.useMemo(() => toTsv(columns, rows), [columns, rows])
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(columns, rows)], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${copy.filename}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setDone(true)
    onExport?.("csv")
  }
  return (
    <div data-export="" className={cn("cn-block-export", className)}>
      <Button type="button" variant="outline" data-export-csv="" onClick={download}>
        <Download aria-hidden="true" />
        {copy.csv}
      </Button>
      <CopyButton text={tsv} copy={copy.copy} onCopied={() => onExport?.("copy")} />
      <span role="status" data-export-status="" className="cn-block-export-status">
        {done ? copy.csvDone : ""}
      </span>
    </div>
  )
}
