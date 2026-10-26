"use client"

import * as React from "react"

import type { AsyncState, BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import type { Product } from "@/registry/factory/content/schemas/commerce"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Skeleton } from "@/registry/factory/ui/skeleton"

import { BlockHeading } from "../_shared/block-heading"
import { ListEmpty, ListError } from "../_shared/list-status"
import { ProductPrice, type ProductPriceLabels } from "../_shared/product-price"
import { ProductThumb } from "../_shared/product-thumb"

// 상품 목록 — 순위 목록(베스트). 한 줄에 순위 큰 숫자 · 작은 사진 · 상품명 · 가격. 1~3위는 순위 숫자를 더 크게(위계).
// 넓은 화면에서는 두 단(1~5위 | 6~10위)으로 흐른다. 네 상태: loading = 같은 줄 높이의 뼈대 줄, empty = 안내 + 행동, error = 메시지 + [다시 시도], ready = 목록.
export type ProductListRankedListCopy = {
  title: string
  lead?: string
  // 순위 읽기 틀 — {n} 자리에 순위(예: 「{n}위」, 읽기 도구용).
  rankTemplate: string
  // 기준 한 줄(예: 「지난 7일 판매량 기준」).
  basis?: string
  // 상세 주소 틀 — 빈 문자열이면 이 사이트에 상세 쪽이 없는 것이라 이름은 링크가 아니다.
  hrefTemplate: string
  price: ProductPriceLabels
  loadingLabel: string
  empty: { title: string; body?: string; action?: Cta }
  error: { title: string; retryLabel: string }
}
export type ProductListRankedListProps = BlockBase<ProductListRankedListCopy> & { state: AsyncState<Product[]>; skeletonCount?: number }

export function ProductListRankedList({ copy, state, id = "best", className, locale, skeletonCount = 5 }: ProductListRankedListProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.05 })
  })
  return (
    <section ref={ref} id={id} data-block="product-list-ranked-list" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        {copy.basis ? <p className="shrink-0 text-base leading-[1.5]">{copy.basis}</p> : null}
      </div>
      {state.status === "loading" ? (
        <div className="md:columns-2 md:gap-10">
          <span role="status" className="sr-only">
            {copy.loadingLabel}
          </span>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <div key={i} aria-hidden="true" className="relative grid break-inside-avoid grid-cols-[2.5rem_4.5rem_minmax(0,1fr)] items-center gap-4 border-b py-4 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring">
              <Skeleton className="mx-auto size-8" />
              <Skeleton className="aspect-square w-full" />
              <span className="flex min-w-0 flex-col gap-1">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-5 w-2/5" />
              </span>
            </div>
          ))}
        </div>
      ) : state.status === "empty" ? (
        <ListEmpty title={copy.empty.title} body={state.reason ?? copy.empty.body} action={copy.empty.action} />
      ) : state.status === "error" ? (
        <ListError title={copy.error.title} message={state.message} retryLabel={copy.error.retryLabel} retry={state.retry} />
      ) : (
        <ol className="md:columns-2 md:gap-10">
          {state.data.map((p, i) => (
            <li key={p.slug} data-enter data-filter-item="" data-filter-category={p.category} data-sort-price={p.price} data-top={i < 3 ? "" : undefined} className="relative grid break-inside-avoid grid-cols-[2.5rem_4.5rem_minmax(0,1fr)] items-center gap-4 border-b py-4 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring">
              <span className="text-center text-[1.563rem] leading-none in-data-[top]:text-[2.441rem] font-heading">
                <span className="sr-only">{copy.rankTemplate.replace("{n}", String(i + 1))}</span>
                <span data-numeric aria-hidden="true">
                  {i + 1}
                </span>
              </span>
              <ProductThumb thumb={p.thumbs[0]} className="w-full" eager={i < 3} locale={locale} />
              <span className="flex min-w-0 flex-col gap-1">
                {copy.hrefTemplate ? (
                  <a href={copy.hrefTemplate.replace("{slug}", p.slug)} className="inline-flex min-h-11 items-center text-base leading-[1.45] underline-offset-4 outline-hidden after:absolute after:inset-0 hover:underline">
                    {p.name}
                  </a>
                ) : (
                  <span>{p.name}</span>
                )}
                <ProductPrice product={p} labels={copy.price} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
