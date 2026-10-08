// F10: EU 판매가 닫힌 동안(LF_EU_SALES) 접속 지역이나 결제 국가가 EU 인 방문자에게 결제 창 대신 보이는 안내.
// 아무것도 청구되지 않았다고 말하고 요금표로 돌아가는 길만 둔다. 나라를 바꿔 고르는 폼은 두지 않는다 — 고른 나라로 차단을 풀 수 있으면
// 이 화면이 우회 길이 된다(v0.1.1 리뷰 P1-1, 판정은 lib/launch/eu-sales.ts regionVerdict).
import { euSalesCopy } from "@/content/copy.ux.en"

export function EuUnavailable({ country }: { country: string }) {
  const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "code" })
  return (
    <section aria-labelledby="eu-unavailable-title" data-region="unavailable" className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-12">
      <h1 id="eu-unavailable-title" className="text-2xl font-semibold text-balance">
        {euSalesCopy.unavailable.title}
      </h1>
      <p className="text-muted-foreground">{euSalesCopy.unavailable.body.replace("{country}", names.of(country) ?? country)}</p>
      <a href="/pricing" className="min-h-11 self-start py-2 underline underline-offset-4">
        {euSalesCopy.unavailable.back}
      </a>
    </section>
  )
}
