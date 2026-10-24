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

// 상품 목록 — 카드 격자(2 → 3 → 4열). 카드마다 정사각 사진·상품명 h3·가격(할인율·판매가·정가·단위 가격), 카드 전체가 상세 링크.
// 읽기 데이터 네 상태를 모두 그린다: loading = 같은 격자 모양의 뼈대(높이 고정 — 준비되어도 제목·격자 위치가 그대로),
// empty = 안내 + 행동 하나, error = 메시지 + [다시 시도](retry), ready = 목록 + 결과 수.
export type ProductListGridCardsCopy = {
  title: string
  lead?: string
  // 결과 수 틀 — {n} 자리에 상품 수(예: 「{n}개 상품」). 빈 문자열이면 결과 수 줄을 그리지 않는다(같은 쪽의 목록 도구 줄이 이미 상태 알림으로 알리는 때 — 알림이 겹치지 않게).
  countTemplate: string
  // 상세 주소 틀 — {slug} 자리에 상품 slug. 빈 문자열이면 이 사이트에 상세 쪽이 없는 것이라 카드는 링크가 아니다(없는 쪽으로 가는 404 링크를 그리지 않는다).
  hrefTemplate: string
  price: ProductPriceLabels
  // 뼈대 동안 읽기 도구가 읽는 문구.
  loadingLabel: string
  empty: { title: string; body?: string; action?: Cta }
  error: { title: string; retryLabel: string }
}
export type ProductListGridCardsProps = BlockBase<ProductListGridCardsCopy> & { state: AsyncState<Product[]>; skeletonCount?: number }

export function ProductListGridCards({ copy, state, id = "products", className, locale, skeletonCount = 8 }: ProductListGridCardsProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.04 })
  })
  const pid = (i: number) => `${id}-item-${i + 1}`
  return (
    <section ref={ref} id={id} data-block="product-list-grid-cards" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        {/* 개수 줄은 불러오는 동안에도 같은 높이로 자리를 잡는다(대장 A8 — 준비되면 줄이 끼어들어 격자가 밀리는 레이아웃 이동 방지) */}
        {state.status === "ready" && copy.countTemplate ? (
          <p role="status" className="shrink-0 text-base leading-[1.5]">
            {copy.countTemplate.replace("{n}", state.data.length.toLocaleString("ko-KR"))}
          </p>
        ) : (
          <p aria-hidden="true" className="shrink-0 text-base leading-[1.5]">
            &nbsp;
          </p>
        )}
      </div>
      {state.status === "loading" ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          <span role="status" className="sr-only">
            {copy.loadingLabel}
          </span>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <div key={i} aria-hidden="true" className="relative flex min-w-0 flex-col gap-2 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-2/5" />
            </div>
          ))}
        </div>
      ) : state.status === "empty" ? (
        <ListEmpty title={copy.empty.title} body={state.reason ?? copy.empty.body} action={copy.empty.action} />
      ) : state.status === "error" ? (
        <ListError title={copy.error.title} message={state.message} retryLabel={copy.error.retryLabel} retry={state.retry} />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {state.data.map((p, i) => (
            <li key={p.slug} data-enter data-filter-item="" data-filter-category={p.category} data-sort-price={p.price} className="relative flex min-w-0 flex-col gap-2 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring">
              <ProductThumb thumb={p.thumbs[0]} eager={i < 4} locale={locale} />
              <h3 id={pid(i)} className="text-base leading-[1.45]">
                {copy.hrefTemplate ? (
                  <a href={copy.hrefTemplate.replace("{slug}", p.slug)} className="inline-flex min-h-11 items-center underline-offset-4 outline-hidden after:absolute after:inset-0 hover:underline">
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
              </h3>
              <ProductPrice product={p} labels={copy.price} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
