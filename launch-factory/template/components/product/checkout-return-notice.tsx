import { Button } from "@/components/ui/button"
import { checkoutReturnCopy as copy } from "@/content/copy.shop.en"

// 결제창에서 돌아왔는데 확정할 결제가 없을 때의 안내(서버 컴포넌트 — JS 없이도 글과 링크가 서버 HTML 에 있다).
//   failed  — 결제창이 실패·취소로 돌려보냈다. 돈은 나가지 않았고 주문은 결제 대기로 남아 있다(주문 쪽에서 보거나 취소할 수 있다).
//   missing — 주소에 주문·결제 번호가 없거나 깨졌다.
export function CheckoutReturnNotice({ kind, orderId, code }: { kind: "failed" | "missing"; orderId?: string; code?: string }) {
  const c = kind === "failed" ? copy.failed : copy.missing
  return (
    <section data-checkout-return={kind} data-error-code={code} data-retryable="false" aria-labelledby="checkout-return-title" className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 md:px-8">
      <h1 id="checkout-return-title" className="font-heading text-[1.953rem] leading-[1.2]">
        {c.title}
      </h1>
      <p className="max-w-prose text-[1.125rem] leading-[1.7]">{c.body}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" nativeButton={false} render={<a href={kind === "failed" && orderId ? `/orders/${encodeURIComponent(orderId)}` : "/orders"} />}>
          {c.link}
        </Button>
        {kind === "failed" ? (
          <a href="/cart" className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
            {copy.failed.again}
          </a>
        ) : null}
      </div>
    </section>
  )
}
