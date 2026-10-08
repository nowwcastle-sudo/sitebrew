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
      <section id={id} data-block="state-screen-not-found" data-error-code={errorCode || undefined} aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
        <div className="flex max-w-3xl flex-col gap-8">
          <div className="flex flex-col items-start gap-4">
            {copy.code ? (
              <p data-numeric className="text-[3.815rem] leading-none tabular-nums md:text-[5.96rem] font-heading">
                {copy.code}
              </p>
            ) : (
              <Search aria-hidden="true" className="size-12" />
            )}
            <Heading id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading">
              {copy.title}
            </Heading>
            <p className="max-w-prose text-[1.125rem] leading-[1.7]">{copy.body}</p>
            {requestId && copy.requestIdLabel ? (
              <p data-request-id={requestId} className="flex flex-wrap items-baseline gap-x-2 text-base leading-[1.5]">
                {copy.requestIdLabel} <code data-numeric>{requestId}</code>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" nativeButton={false} render={<a href={copy.home.href} />}>
              {copy.home.label}
            </Button>
            {copy.support ? (
              <a href={copy.support.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
                {copy.support.label}
              </a>
            ) : null}
          </div>
          {copy.links?.length ? (
            <nav aria-label={copy.linksTitle ?? copy.title} className="border-t pt-8 flex flex-col gap-3 md:grid-cols-1">
              {copy.linksTitle ? <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.linksTitle}</h3> : null}
              <ul className="flex flex-col">
                {copy.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="relative inline-flex min-h-11 items-center gap-2 text-base underline underline-offset-4">
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
