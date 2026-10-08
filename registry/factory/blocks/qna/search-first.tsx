"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { Search } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Field, FieldLabel } from "@/registry/factory/ui/field"
import { Input } from "@/registry/factory/ui/input"

import { fillText } from "../_shared/billing-format"
import { type QnaContact, type QnaContactCopy, type QnaEntryCopy, type QnaItem, QnaContactLinks, QnaEntry, useReveal, qnaMatches } from "../_shared/qna-kit"

// 상품 문의 — 검색 먼저(대장 A62, 서버 없이). 위에 큰 검색 칸(글자를 치면 질문·답변에서 찾아 목록이 줄어든다 — 검색어는 어디에도 보내지 않는다), 결과 개수(role=status),
// 아래에 답변 목록(첫 5건, 「더 보기」). 결과가 0건이면 목록 자리에 「찾는 답이 없나요?」 판(문의 채널이 크게)을 대신 보이고, 있어도 마지막에 문의 채널 줄이 늘 있다.
// 답변은 접히지 않는다(X2). 검색은 목록을 줄일 뿐 없애지 않는다: 지우기 버튼으로 전체로 돌아온다.
export type QnaSearchFirstCopy = {
  title: string
  lead?: string
  searchLabel: string
  searchPlaceholder?: string
  clear: string
  // 「{count}개의 문의를 찾았어요」
  result: string
  more: string
  // 결과 0건 판: 제목과 안내
  notFoundTitle: string
  notFoundBody: string
  entry: QnaEntryCopy
  contact: QnaContactCopy
}
export type QnaSearchFirstProps = BlockBase<QnaSearchFirstCopy> & { items: QnaItem[]; contact: QnaContact; track?: AnalyticsPort["track"] }

const PAGE = 5

export function QnaSearchFirst({ copy, locale, timeZone, items, contact, track, id = "qna", className }: QnaSearchFirstProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [query, setQuery] = React.useState("")
  const searchRef = React.useRef<HTMLInputElement>(null)
  const { shown, listRef, reset, more } = useReveal(PAGE)
  const matches = qnaMatches(items, query)
  const visible = matches.slice(0, shown)
  const remaining = matches.length - visible.length
  const searching = query.trim().length > 0
  return (
    <section ref={ref} id={id} data-block="qna-search-first" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-qas-section", className)}>
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
      <div data-enter className="cn-block-qas-search">
        <Field>
          <FieldLabel htmlFor={`${id}-search`}>{copy.searchLabel}</FieldLabel>
          <div className="cn-block-qas-box">
            <Search aria-hidden="true" className="cn-block-qas-icon" />
            <Input
              id={`${id}-search`}
              ref={searchRef}
              type="search"
              name="q"
              autoComplete="off"
              value={query}
              placeholder={copy.searchPlaceholder}
              onChange={(e) => {
                setQuery(e.target.value)
                reset()
              }}
              className="cn-block-qas-input"
            />
            {searching ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setQuery("")
                  reset()
                  searchRef.current?.focus()
                }}
                className="cn-block-qas-clear"
              >
                {copy.clear}
              </Button>
            ) : null}
          </div>
        </Field>
        <p role="status" data-qna-result="" className="cn-block-qas-result">
          {searching ? fillText(copy.result, { count: matches.length }) : ""}
        </p>
      </div>
      {visible.length ? (
        <ol ref={listRef} data-enter data-qna-list="" className="cn-block-qas-list">
          {visible.map((it) => (
            <li key={it.id}>
              <QnaEntry item={it} copy={copy.entry} locale={locale} timeZone={timeZone} />
            </li>
          ))}
        </ol>
      ) : (
        <div data-qna-not-found="" className="cn-block-qas-notfound">
          <h3 className="cn-block-qas-notfound-title font-heading-ko">{copy.notFoundTitle}</h3>
          <p className="cn-block-qas-notfound-body">{copy.notFoundBody}</p>
        </div>
      )}
      {remaining > 0 ? (
        <div className="cn-block-qas-more">
          <Button type="button" variant="outline" size="lg" onClick={() => more(visible.length)}>
            {fillText(copy.more, { count: remaining })}
          </Button>
        </div>
      ) : null}
      <QnaContactLinks contact={contact} copy={copy.contact} track={track} section={id} />
    </section>
  )
}
