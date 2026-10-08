import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import { Search } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

// 상태 화면 — 없는 주소(404). 앱 전체 not-found 로 쓴다(P3-6 H02·H04·L04 — Next 의 not-found.tsx 에 그대로 끼운다): 큰 「404」 · 제목 · 무엇이 일어났는지 한 줄 ·
// [처음으로] + 갈 만한 곳 링크 몇 개 · 지원 경로. 서버 컴포넌트다(JS 없이도 모든 글·링크가 서버 HTML 에 있다). 스타일 속성 없음 — 엄격 CSP 에 걸리지 않는다.
//   · header — 머리·내비 자리(NavAccountBar·NavInlineLinks 를 끼운다). 404 에서 되돌아갈 길이 「처음으로」 하나뿐이면 안 된다(H02).
//   · errorCode — 섹션 뿌리의 data-error-code(기본 "not_found" — 기계가 404 를 글 해석 없이 안다, L04).
//   · requestId + copy.requestIdLabel — 문의할 때 알려 줄 요청 번호. copy.support — 지원 경로.
//   · headingLevel — 쪽에 다른 h1 이 없으면 1(기본 2). 쪽 제목(<title>)은 Next metadata 로 소비자가 정한다.
export type StateScreenNotFoundCopy = {
  code?: string
  title: string
  body: string
  home: Cta
  /** 갈 만한 곳 링크(주요 쪽 3~5개) */
  linksTitle?: string
  links?: Cta[]
  support?: Cta
  requestIdLabel?: string
}
export type StateScreenNotFoundProps = BlockBase<StateScreenNotFoundCopy> & {
  header?: React.ReactNode
  errorCode?: string
  requestId?: string
  headingLevel?: 1 | 2
}

export function StateScreenNotFound({ copy, header, errorCode = "not_found", requestId, headingLevel = 2, id = "not-found", className }: StateScreenNotFoundProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2"
  return (
    <>
      {header}
      <section id={id} data-block="state-screen-not-found" data-error-code={errorCode || undefined} aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
        <div className="cn-block-serror">
          <div className="cn-block-serror-head">
            {copy.code ? (
              <p data-numeric className="cn-block-serror-code font-heading">
                {copy.code}
              </p>
            ) : (
              <Search aria-hidden="true" className="cn-block-serror-icon" />
            )}
            <Heading id={`${id}-title`} className="cn-block-serror-title font-heading">
              {copy.title}
            </Heading>
            <p className="cn-block-serror-body">{copy.body}</p>
            {requestId && copy.requestIdLabel ? (
              <p data-request-id={requestId} className="cn-block-serror-reqid">
                {copy.requestIdLabel} <code data-numeric>{requestId}</code>
              </p>
            ) : null}
          </div>
          <div className="cn-block-serror-actions">
            <Button size="lg" nativeButton={false} render={<a href={copy.home.href} />}>
              {copy.home.label}
            </Button>
            {copy.support ? (
              <a href={copy.support.href} className="cn-block-serror-support">
                {copy.support.label}
              </a>
            ) : null}
          </div>
          {copy.links?.length ? (
            <nav aria-label={copy.linksTitle ?? copy.title} className="cn-block-serror-more cn-block-snf-links">
              {copy.linksTitle ? <h3 className="cn-block-serror-help-title font-heading">{copy.linksTitle}</h3> : null}
              <ul className="cn-block-serror-help-list">
                {copy.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="cn-block-serror-help-link">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </section>
    </>
  )
}
