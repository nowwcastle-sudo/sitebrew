import * as React from "react"

import { UpdatedAt } from "@/registry/factory/ax/freshness"
import { JsonLd } from "@/registry/factory/ax/json-ld"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"

// 글 서명(E-E-A-T: 경험·전문성·권위·신뢰 — 마케팅 규칙 X11·X4·T2). 글(안내·기사·가이드) 맨 위나 아래에 붙는 한 구획: 작성자 · 검수자(선택) · 경력 한 줄 · 갱신일(<UpdatedAt> — 같은 날짜가 JSON-LD dateModified 와
// sitemap lastmod 로 나간다) · 참고한 자료 목록(링크). 모두 서버가 그린 글자다(X2 — 그림 속 글자 없음). 서버 컴포넌트(상태·모션 없음).
// WebPage JSON-LD(jsonLd 를 끄지 않으면): author·reviewedBy(Person)·dateModified·citation 이 화면의 같은 props 에서 나온다 — 화면에 없는 값은 싣지 않는다(X4).
// 사람의 이름·경력은 사실이라 지어내지 않는다 — 예시는 가상 인물이다. 이 블록은 별점(AggregateRating)을 만들지 않는다.
export type BylinePerson = {
  name: string
  // 직함·역할(선택): 「편집장」 「한의사」
  role?: string
  // 경력 한 줄(선택): 「임상 12년 · 지역 보건소 근무」
  bio?: string
  url?: string
}
export type TrustAuthorBylineCopy = {
  title: string
  authorLabel: string
  reviewerLabel: string
  sourcesTitle: string
}
export type TrustAuthorBylineProps = BlockBase<TrustAuthorBylineCopy> & {
  author: BylinePerson
  reviewer?: BylinePerson
  // 마지막으로 고친 날(YYYY-MM-DD, 실제 날짜가 아니면 던진다)
  updatedAt: string
  sources?: { label: string; href: string }[]
  // WebPage JSON-LD 를 싣는다(기본 켬 — 글 쪽마다 한 번)
  jsonLd?: boolean
}

/** 화면과 같은 props 로 만든 WebPage JSON-LD(author·reviewedBy·dateModified·citation) */
export function bylineJsonLd({ author, reviewer, updatedAt, sources }: Pick<TrustAuthorBylineProps, "author" | "reviewer" | "updatedAt" | "sources">): Record<string, unknown> {
  const person = (p: BylinePerson) => ({ "@type": "Person", name: p.name, ...(p.role ? { jobTitle: p.role } : {}), ...(p.bio ? { description: p.bio } : {}), ...(p.url ? { url: p.url } : {}) })
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    author: person(author),
    ...(reviewer ? { reviewedBy: person(reviewer) } : {}),
    dateModified: updatedAt,
    ...(sources?.length ? { citation: sources.map((s) => ({ "@type": "CreativeWork", name: s.label, url: s.href })) } : {}),
  }
}

function Person({ kind, label, p }: { kind: "author" | "reviewer"; label: string; p: BylinePerson }) {
  return (
    <div data-person={kind} className="cn-block-tab-person">
      <dt className="cn-block-tab-term">{label}</dt>
      <dd className="cn-block-tab-detail">
        <span className="cn-block-tab-name font-heading-ko">
          {p.url ? (
            <a href={p.url} rel="author" className="cn-block-tab-link">
              {p.name}
            </a>
          ) : (
            p.name
          )}
        </span>
        {p.role ? <span className="cn-block-tab-role">{p.role}</span> : null}
        {p.bio ? <span className="cn-block-tab-bio">{p.bio}</span> : null}
      </dd>
    </div>
  )
}

export function TrustAuthorByline({ copy, locale, author, reviewer, updatedAt, sources = [], jsonLd = true, id = "byline", className }: TrustAuthorBylineProps) {
  return (
    <section id={id} data-block="trust-author-byline" data-byline="" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-tab-section", className)}>
      <h2 id={`${id}-title`} className="cn-block-tab-title font-heading-ko">
        {copy.title}
      </h2>
      <dl className="cn-block-tab-people">
        <Person kind="author" label={copy.authorLabel} p={author} />
        {reviewer ? <Person kind="reviewer" label={copy.reviewerLabel} p={reviewer} /> : null}
      </dl>
      <UpdatedAt date={updatedAt} locale={locale ?? "ko"} className="cn-block-tab-updated" />
      {sources.length ? (
        <div data-sources="" className="cn-block-tab-sources">
          <h3 className="cn-block-tab-sources-title font-heading-ko">{copy.sourcesTitle}</h3>
          <ol className="cn-block-tab-source-list">
            {sources.map((s, i) => (
              <li key={i}>
                <a href={s.href} className="cn-block-tab-link">
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {jsonLd ? <JsonLd id={`${id}-jsonld`} data={bylineJsonLd({ author, reviewer, updatedAt, sources })} /> : null}
    </section>
  )
}
