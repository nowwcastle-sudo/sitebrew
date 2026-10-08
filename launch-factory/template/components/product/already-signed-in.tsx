import Link from "next/link"

import { alreadySignedInCopy as c } from "@/content/copy.en"

// 로그인한 채 /sign-in·/sign-up·/forgot-password 를 열었을 때(B02). 서버가 세션을 보고 폼 대신 이 안내를 그린다 — 같은 정보를 다시 묻지 않는다.
// `next` 는 호출하는 쪽이 lib/auth-next.ts 의 safeNext 로 이미 거른 값이다(없으면 계정 화면).
export function AlreadySignedIn({ email, next }: { email?: string | null; next?: string | null }) {
  return (
    <section data-already-signed-in role="status" aria-labelledby="already-signed-in-title" className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 py-10">
      <h1 id="already-signed-in-title" className="font-heading text-2xl">
        {c.title}
      </h1>
      <p className="text-base leading-[1.7]">{email ? c.body.replace("{email}", email) : c.bodyNoEmail}</p>
      <Link href={next || c.href} className="relative inline-flex min-h-11 items-center border px-4 text-base underline underline-offset-4">
        {c.label}
      </Link>
    </section>
  )
}
