import Link from "next/link"

import { emailChoiceCopy as copy } from "@/content/copy.en"

// 메일 속 서명 링크가 닿는 화면(수신거부 · 수신 계속 · 가입 안 했어요). 로그인이 필요 없다.
// ?r=<결과>  → 처리 결과를 보인다(라우트 /api/marketing/*·/api/account/not-me 가 처리한 뒤 여기로 보낸다).
// ?a=keep|not-me&t=<토큰> → 확인 단추(POST). 메일 보안 프로그램이 링크를 미리 열어도 실행되지 않게, 사람이 누를 때만 처리한다.
// 토큰이 주소에 있으므로 Referer 로 새지 않게 no-referrer 로 연다. 검색에 노출하지 않는다.
export const metadata = { title: "Your email choice", robots: { index: false, follow: false }, referrer: "no-referrer" as const }

const ACTION_ROUTES = { keep: "/api/marketing/keep", "not-me": "/api/account/not-me" } as const
type Action = keyof typeof ACTION_ROUTES
type Result = keyof typeof copy.result

const one = (v: string | string[] | undefined): string | undefined => (typeof v === "string" ? v : undefined)
const isAction = (v: string | undefined): v is Action => v === "keep" || v === "not-me"
const isResult = (v: string | undefined): v is Result => !!v && Object.hasOwn(copy.result, v)

export default async function EmailChoicePage({ searchParams }: { searchParams: Promise<{ r?: string | string[]; a?: string | string[]; t?: string | string[] }> }) {
  const sp = await searchParams
  const a = one(sp.a)
  const t = one(sp.t)
  const r = one(sp.r)

  if (isAction(a) && t && t.length <= 1024) {
    const c = copy.confirm[a]
    return (
      <section data-email-choice={`confirm-${a}`} aria-labelledby="email-choice-title" className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 py-10">
        <h1 id="email-choice-title" className="font-heading text-2xl">
          {c.title}
        </h1>
        <p className="text-base leading-[1.7]">{c.body}</p>
        <form method="post" action={ACTION_ROUTES[a]}>
          <input type="hidden" name="t" value={t} />
          <button type="submit" className="relative inline-flex min-h-11 items-center border px-4 text-base underline underline-offset-4">
            {c.button}
          </button>
        </form>
      </section>
    )
  }

  const key: Result = isResult(r) ? r : "invalid"
  const c = copy.result[key]
  return (
    <section data-email-choice={key} role="status" aria-labelledby="email-choice-title" className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 py-10">
      <h1 id="email-choice-title" className="font-heading text-2xl">
        {c.title}
      </h1>
      <p className="text-base leading-[1.7]">{c.body}</p>
      <Link href="/" className="relative inline-flex min-h-11 items-center underline underline-offset-4">
        {copy.home}
      </Link>
    </section>
  )
}
