"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"
import { type QnaContact, type QnaContactCopy, type QnaEntryCopy, type QnaItem, QnaContactLinks, QnaEntry, useReveal, qnaCategories, qnaMatches } from "../_shared/qna-kit"

// 상품 문의 — 종류별로 거르는 답변 목록(대장 A62, 서버 없이). 판매자가 미리 써 둔 자주 받는 문의를 종류(배송·사이즈·세탁 …) 칩으로 거르며 읽는다:
// 「전체」 + 목록에서 나온 종류가 라디오 묶음(선택 하나, 화살표로 이동), 아래에 결과 개수(role=status)와 문의 목록(첫 5건, 「더 보기」로 5건씩).
// 답변은 접히지 않는다(접힘 뒤 글자는 읽기 도구가 놓친다 — X2). 찾는 답이 없을 때를 위해 마지막에 문의 채널(카카오톡 채널·전화·메일 링크). 구매자가 올리는 비밀글 게시판은 v0.2.
export type QnaAnsweredListCopy = {
  title: string
  lead?: string
  // 종류 묶음 이름(스크린 리더용 legend)과 「전체」
  categoryLegend: string
  all: string
  // 「{count}개의 문의」
  result: string
  empty: string
  // 「{count}개 더 보기」
  more: string
  entry: QnaEntryCopy
  contact: QnaContactCopy
}
export type QnaAnsweredListProps = BlockBase<QnaAnsweredListCopy> & { items: QnaItem[]; contact: QnaContact; track?: AnalyticsPort["track"] }

const PAGE = 5

export function QnaAnsweredList({ copy, locale, timeZone, items, contact, track, id = "qna", className }: QnaAnsweredListProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const cats = React.useMemo(() => qnaCategories(items), [items])
  const [category, setCategory] = React.useState("")
  const { shown, listRef, reset, more } = useReveal(PAGE)
  const matches = qnaMatches(items, "", category || undefined)
  const visible = matches.slice(0, shown)
  const remaining = matches.length - visible.length
  return (
    <section ref={ref} id={id} data-block="qna-answered-list" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-qal-section", className)}>
      <div className="cn-block-pin-head">
        <h2 id={`${id}-title`} data-enter className="cn-block-title font-heading-ko">
          {copy.title}
        </h2>
        {copy.lead ? (
          <p data-enter className="cn-block-lead">
            {copy.lead}
          </p>
        ) : null}
      </div>
      {cats.length ? (
        <fieldset data-enter data-qna-categories="" className="cn-block-qal-chips">
          <legend className="sr-only">{copy.categoryLegend}</legend>
          {["", ...cats].map((c) => (
            <label key={c || "all"} className="cn-block-qal-chip">
              <input
                type="radio"
                name={`${id}-category`}
                value={c}
                checked={category === c}
                onChange={() => {
                  setCategory(c)
                  reset()
                }}
                className="cn-block-qal-radio"
              />
              <span>{c || copy.all}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <p role="status" data-qna-result="" className="cn-block-qal-result">
        {matches.length ? fillText(copy.result, { count: matches.length }) : copy.empty}
      </p>
      {visible.length ? (
        <ol ref={listRef} data-enter data-qna-list="" className="cn-block-qal-list">
          {visible.map((it) => (
            <li key={it.id}>
              <QnaEntry item={it} copy={copy.entry} locale={locale} timeZone={timeZone} />
            </li>
          ))}
        </ol>
      ) : null}
      {remaining > 0 ? (
        <div className="cn-block-qal-more">
          <Button type="button" variant="outline" size="lg" onClick={() => more(visible.length)}>
            {fillText(copy.more, { count: remaining })}
          </Button>
        </div>
      ) : null}
      <QnaContactLinks contact={contact} copy={copy.contact} track={track} section={id} />
    </section>
  )
}
