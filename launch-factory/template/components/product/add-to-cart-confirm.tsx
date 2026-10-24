"use client"

import * as React from "react"

import { fillText, formatMoney } from "@/components/blocks/_shared/billing-format"
import type { CommercePort } from "@/components/contract/commerce"
import type { Money } from "@/components/contract/ports"
import { Button } from "@/components/ui/button"
import { addToCartCopy as copy } from "@/content/copy.shop.en"

// 「장바구니에 담기」 확인 줄(/cart?add=<상품>). 주소를 여는 것만으로는 아무것도 담기지 않는다 — 이 줄이 뜰 뿐이고 [담기]를 눌러야 서버 액션(setCartLine)이 담는다(GET 부작용 없음).
// setCartLine 은 수량을 정하는 입력이라 지금 수량을 읽어(cart) 하나를 더한다. 서버가 상품표·재고를 다시 본다 — 재고 부족 같은 실패는 서버 문구를 그대로 보인다.
export type AddItem = { productId: string; name: string; price: Money }

type State = { step: "idle" } | { step: "adding" } | { step: "added" } | { step: "error"; message: string }

export function AddToCartConfirm({ item, cart, setCartLine, onAdded, onDismiss }: { item: AddItem; cart: CommercePort["cart"]; setCartLine: CommercePort["setCartLine"]; onAdded: () => void; onDismiss: () => void }) {
  const [state, setState] = React.useState<State>({ step: "idle" })

  const add = async () => {
    setState({ step: "adding" })
    const failure = (r: { formError?: string }) => setState({ step: "error", message: r.formError ?? copy.error })
    try {
      const current = await cart()
      if (!current.ok) return failure(current)
      const have = current.data.lines.find((l) => l.productId === item.productId)?.quantity ?? 0
      const next = await setCartLine({ productId: item.productId, quantity: have + 1 })
      if (!next.ok) return failure(next)
      setState({ step: "added" })
      onAdded()
    } catch {
      setState({ step: "error", message: copy.error })
    }
  }

  if (state.step === "added") {
    return (
      <p role="status" data-testid="shop-added" className="mx-auto w-full max-w-6xl px-4 text-base leading-[1.6] md:px-8">
        {fillText(copy.added, { name: item.name })}
      </p>
    )
  }
  const busy = state.step === "adding"
  return (
    <section data-testid="shop-add-confirm" aria-labelledby="shop-add-title" className="mx-auto w-full max-w-6xl px-4 md:px-8">
      <div className="flex flex-col gap-3 border px-4 py-5 md:px-6">
        <h2 id="shop-add-title" className="font-heading text-[1.25rem] leading-[1.35]">
          {copy.title}
        </h2>
        <p data-numeric className="text-base leading-[1.6]">
          {fillText(copy.body, { name: item.name, price: formatMoney(item.price, "en") })}
        </p>
        {state.step === "error" ? (
          <p role="alert" className="text-base leading-[1.6]">
            {state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" data-action="confirm" disabled={busy} aria-busy={busy || undefined} onClick={() => void add()}>
            {busy ? copy.adding : copy.confirm}
          </Button>
          <Button type="button" variant="outline" data-action="dismiss" disabled={busy} onClick={onDismiss}>
            {copy.dismiss}
          </Button>
        </div>
      </div>
    </section>
  )
}
