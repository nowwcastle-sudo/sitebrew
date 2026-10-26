import { Button } from "@/components/ui/button"
import { bookReturnCopy as copy } from "@/content/copy.ux.en"

// 예약금 결제창에서 돌아왔는데 확정할 결제가 없을 때의 안내(서버 컴포넌트 — JS 없이도 글과 링크가 서버 HTML 에 있다).
//   failed  — 결제창이 실패·취소로 돌려보냈다. 돈은 나가지 않았고 예약은 대기 시간 동안 남는다.
//   missing — 주소에 예약·결제 번호가 없거나 깨졌다.
export function BookingReturnNotice({ kind }: { kind: "failed" | "missing" }) {
  const c = kind === "failed" ? copy.failed : copy.missing
  return (
    <section data-book-return={kind} data-retryable="false" aria-labelledby="book-return-title" className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-6">
      <h1 id="book-return-title" className="font-heading text-2xl">
        {c.title}
      </h1>
      <p className="max-w-prose text-base leading-[1.7]">{c.body}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" nativeButton={false} render={<a href="/book" />}>
          {c.link}
        </Button>
        <a href="/book/manage" className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
          {copy.confirmed.link}
        </a>
      </div>
    </section>
  )
}
