"use client"

import * as React from "react"

import type { AsyncState, BlockBase } from "@/registry/factory/contract/block-contract"
import type { Cta } from "@/registry/factory/content/content-core"
import type { Product } from "@/registry/factory/content/schemas/commerce"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Skeleton } from "@/registry/factory/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/registry/factory/ui/toggle-group"

import { blockLabels } from "../_shared/block-labels"
import { ListEmpty, ListError } from "../_shared/list-status"
import { formatPrice, type MoneyFormat } from "../_shared/price-tag"
import { ProductPrice, type ProductPriceLabels } from "../_shared/product-price"
import { ProductThumb } from "../_shared/product-thumb"

// 상품 목록 — 상세페이지 요약(목록의 첫 상품 하나). 왼쪽: 큰 사진 + 작은 사진 줄. 오른쪽: 상품명·가격·옵션(보이는 버튼 — select 금지,
// 품절 값은 누를 수 없고 「품절」 글자를 붙인다)·배송 한 줄·구매 행동 둘. 아래: 사양 표(원산지·단위 가격 + copy 의 사양 줄).
// 네 상태: loading = 같은 두 단 모양의 뼈대, empty = 안내 + 행동, error = 메시지 + [다시 시도], ready = 요약.
export type ProductListSpecSummaryCopy = {
  title: string
  price: ProductPriceLabels
  // 콘텐츠 통화(선택, detail — 금액은 최소 단위 정수). 없으면 원화.
  money?: MoneyFormat
  soldOutLabel: string
  // 배송 조건 한 줄(모달 아님, 구매 영역에 반복 — commerce text 칸).
  shippingNote?: string
  buyCta: Cta
  cartCta?: Cta
  specTitle: string
  originLabel: string
  unitPriceLabel: string
  specs?: { label: string; value: string }[]
  loadingLabel: string
  empty: { title: string; body?: string; action?: Cta }
  error: { title: string; retryLabel: string }
}
export type ProductListSpecSummaryProps = BlockBase<ProductListSpecSummaryCopy> & { state: AsyncState<Product[]> }

function Options({ product, soldOutLabel }: { product: Product; soldOutLabel: string }) {
  return (
    <div className="flex flex-col gap-5">
      {product.options.map((o, i) => {
        const first = o.values.find((v) => !v.soldOut)?.label
        return (
          <div key={i} className="flex flex-col gap-2">
            <span id={`${product.slug}-opt-${i}`} className="text-base font-medium">
              {o.name}
            </span>
            <ToggleGroup variant="outline" defaultValue={first ? [first] : []} aria-labelledby={`${product.slug}-opt-${i}`} className="w-full flex-wrap justify-start">
              {o.values.map((v) => (
                <ToggleGroupItem key={v.label} value={v.label} disabled={v.soldOut} className="min-h-11 px-4 text-base">
                  {v.label}
                  {v.soldOut ? <span className="ms-1.5 text-base">{soldOutLabel}</span> : null}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )
      })}
    </div>
  )
}

export function ProductListSpecSummary({ copy, state, id = "product", className, locale }: ProductListSpecSummaryProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.06 })
  })
  const p = state.status === "ready" ? state.data[0] : undefined
  const rows = p ? [...(p.origin ? [{ label: copy.originLabel, value: p.origin }] : []), ...(p.unitPrice ? [{ label: copy.unitPriceLabel, value: `${p.unitPrice.per} · ${copy.money ? formatPrice(p.unitPrice.amount, copy.money.currency, { minor: true, locale: copy.money.locale }) : `${p.unitPrice.amount.toLocaleString("ko-KR")}${blockLabels().won}`}` }] : []), ...(copy.specs ?? [])] : []
  return (
    <section ref={ref} id={id} data-block="product-list-spec-summary" data-state={state.status} aria-labelledby={`${id}-title`} aria-busy={state.status === "loading" || undefined} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <h2 id={`${id}-title`} data-enter className="max-w-4xl text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading">
        {p ? p.name : copy.title}
      </h2>
      {state.status === "loading" ? (
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12">
          <span role="status" className="sr-only">
            {copy.loadingLabel}
          </span>
          <div aria-hidden="true" className="flex min-w-0 flex-col gap-3">
            <Skeleton className="aspect-square w-full" />
          </div>
          <div aria-hidden="true" className="flex min-w-0 flex-col gap-6 md:sticky md:top-24 md:self-start">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ) : state.status === "empty" ? (
        <ListEmpty title={copy.empty.title} body={state.reason ?? copy.empty.body} action={copy.empty.action} />
      ) : state.status === "error" ? (
        <ListError title={copy.error.title} message={state.message} retryLabel={copy.error.retryLabel} retry={state.retry} />
      ) : p ? (
        <>
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12">
            <div data-enter className="flex min-w-0 flex-col gap-3">
              <ProductThumb thumb={p.thumbs[0]} eager className="w-full" locale={locale} />
              {p.thumbs.length > 1 ? (
                <ul className="grid grid-cols-4 gap-3">
                  {p.thumbs.slice(1, 5).map((t, i) => (
                    <li key={i}>
                      <ProductThumb thumb={t} locale={locale} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div data-enter className="flex min-w-0 flex-col gap-6 md:sticky md:top-24 md:self-start">
              <ProductPrice product={p} labels={copy.price} money={copy.money} className="gap-1 [&>span:first-child>span[data-numeric]]:text-[1.953rem]" />
              {p.options.length ? <Options product={p} soldOutLabel={copy.soldOutLabel} /> : null}
              {copy.shippingNote ? <p className="text-base leading-[1.6]">{copy.shippingNote}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button size="lg" nativeButton={false} render={<a href={copy.buyCta.href} />} className="w-full">
                  {copy.buyCta.label}
                </Button>
                {copy.cartCta ? (
                  <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.cartCta.href} />} className="w-full">
                    {copy.cartCta.label}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {rows.length ? (
            <div data-enter className="flex flex-col gap-4 border-t pt-8">
              <h3 className="text-[1.25rem] leading-[1.35] font-heading">{copy.specTitle}</h3>
              <dl className="grid md:grid-cols-2 md:gap-x-10">
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 border-b py-3">
                    <dt className="text-base font-medium">{r.label}</dt>
                    <dd className="text-base leading-[1.6]">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
