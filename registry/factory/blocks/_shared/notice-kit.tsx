import * as React from "react"

import { NEEDS_CHECK } from "@/registry/factory/content/content-core"
import { normalizePhone } from "@/registry/factory/lib/phone"
import { cn } from "@/registry/factory/lib/utils"

import { fillText } from "../_shared/billing-format"
import { blockLabels } from "../_shared/block-labels"

// 상품정보제공고시 표(P3-2 Task 7b-commerce, 대장 A62 — 공유 조각 block-shared-notice-kit). product-info 세 변형이 같이 쓴다.
// 근거: 전자상거래법 제13조 제2항·제4항 + 공정위 고시 「전자상거래 등에서의 상품 등의 정보제공에 관한 고시」(Ⅱ·Ⅲ·Ⅳ). 고시 품목마다 항목 이름이 정해져 있어
// (예: 침구류·커튼 = 제품 소재·색상·치수·제품구성·제조자(수입자)·제조국·세탁방법 및 취급시 주의사항·품질보증기준·A/S 책임자와 전화번호) 항목 이름은 블록이 아니라
// 콘텐츠(`notice.rows[].label` — 고시 항목 이름 그대로)가 준다. 블록은 표로 그리기만 한다.
//   · 실제 <table>: <caption> + <th scope="col"> 머리 + 행마다 <th scope="row"> (마케팅 게이트 pricing-table·factory-rules.md §21-6 MUST — 고시는 이미지가 아니라 HTML 표)
//   · 값이 없으면 「확인 필요」(content-core NEEDS_CHECK — ops-gate 가 이 글자를 찾아 공개를 막는다, JSON-LD 에는 싣지 않는다). 빈 칸을 지어내지 않는다.
//   · 고시 Ⅱ.3: 정보를 제공할 수 없는 항목은 그 구체적 사유를 적는다 → row.unavailable(사유)가 있으면 「제공할 수 없어요 — 사유」로 그린다.
//   · 고시 Ⅳ.2: 인증·허가 정보는 글자로 — 표는 늘 글자만 그린다. 전화(A/S)는 tel: 링크(마우스 24px·터치 44px 히트 영역).
export type NoticeRow = {
  // 행 식별자(고시 항목 종류 — origin·as·warranty 등). 강조 칸이 이 id 로 행을 고른다.
  id: string
  label: string
  value?: string
  // 전화번호 항목이면 tel: 링크로 그린다(값 글자는 value — 없으면 phone 자체)
  phone?: string
  // 제공할 수 없는 사유(고시 Ⅱ.3) — value 가 없을 때만 쓴다
  unavailable?: string
}
export type NoticeData = { category: string; rows: NoticeRow[] }
export type NoticeCopy = {
  // 「{category}」 자리를 채운다: 예 「상품정보제공고시 — {category}」
  caption: string
  columns: { label: string; value: string }
  // 「제공할 수 없어요 — {reason}」
  unavailable: string
}

export type RowState = "value" | "unavailable" | "missing"
export const rowState = (r: NoticeRow): RowState => (r.value?.trim() || r.phone?.trim() ? "value" : r.unavailable?.trim() ? "unavailable" : "missing")

/** 고시 표의 빈틈: 값도 사유도 없는 항목(공개 관문에서 「확인 필요」로 막힌다) · 같은 항목 이름을 두 번 적은 것 · 전화 항목인데 번호가 안 읽히는 것. 빈 배열이면 온전하다. */
export function noticeIssues(n: NoticeData, locale?: string): string[] {
  const L = blockLabels(locale)
  const p: string[] = []
  if (!n.category.trim()) p.push(L.noticeCategory)
  if (!n.rows.length) p.push(L.noticeRows)
  const seen = new Set<string>()
  for (const r of n.rows) {
    if (seen.has(r.label)) p.push(L.noticeTwice(r.label))
    seen.add(r.label)
    if (rowState(r) === "missing") p.push(L.noticeMissing(r.label))
    if (r.phone && !normalizePhone(r.phone)) p.push(L.noticePhone(r.label, r.phone))
  }
  return p
}

/** 한 항목의 값 칸 — 값 글자 · 전화 링크 · 사유 · 「확인 필요」 */
export function NoticeValue({ row, copy }: { row: NoticeRow; copy: Pick<NoticeCopy, "unavailable"> }) {
  const st = rowState(row)
  if (st === "unavailable") return <span data-unavailable="">{fillText(copy.unavailable, { reason: row.unavailable ?? "" })}</span>
  if (st === "missing")
    return (
      <span data-needs-check="" className="cn-block-notice-missing">
        {NEEDS_CHECK}
      </span>
    )
  const tel = row.phone ? normalizePhone(row.phone) : null
  if (tel)
    return (
      <>
        {row.value && row.value !== row.phone ? <span className="cn-block-notice-text">{row.value} </span> : null}
        <a href={`tel:${tel}`} data-numeric="" className="cn-block-notice-tel">
          {row.phone}
        </a>
      </>
    )
  return <>{row.value}</>
}

/** 고시 표 — 실제 table(caption · th scope). 행마다 data-notice-row=<id>. */
export function NoticeTable({ notice, copy, id, className }: { notice: NoticeData; copy: NoticeCopy; id: string; className?: string }) {
  return (
    <table data-notice-table="" role="table" className={cn("cn-block-notice-table cn-block-stack-table cn-block-stack-kv", className)} id={`${id}-table`}>
      <caption className="cn-block-notice-caption">{fillText(copy.caption, { category: notice.category })}</caption>
      <thead role="rowgroup" className="cn-block-notice-head">
        <tr role="row">
          <th scope="col" role="columnheader" className="cn-block-notice-th">
            {copy.columns.label}
          </th>
          <th scope="col" role="columnheader" className="cn-block-notice-th">
            {copy.columns.value}
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {notice.rows.map((r) => (
          <tr key={r.id} data-notice-row={r.id} role="row" className="cn-block-notice-row">
            <th scope="row" role="rowheader" className="cn-block-notice-rowhead">
              {r.label}
            </th>
            <td role="cell" className="cn-block-notice-cell">
              <NoticeValue row={r} copy={copy} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
