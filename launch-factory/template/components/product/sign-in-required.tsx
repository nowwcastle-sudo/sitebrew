import { StateScreenErrorRetry } from "@/components/blocks/state-screen/error-retry"
import { signInRequiredCopy } from "@/content/copy.en"
import { signInHref } from "@/lib/auth-next"

// 로그인이 필요한 쪽에 로그아웃·만료 상태로 왔을 때의 안내(B04). 서버가 세션을 보고 이 글을 그린다 — 블록이 「구독을 못 불러왔어요 / Reload」로 막다른 길을 만들지 않게.
// 화면은 web-factory v0.0.10 블록 `state-screen/error-retry` 의 로그인 변형이다(LFADA): `copy.signIn` 이 있으면 [다시 시도] 대신 로그인 링크를 보이고, 뿌리에 data-error-code 가 남는다(L04).
// 링크는 로그인 화면으로 가며 `?next=<지금 경로>` 를 싣는다(로그인 뒤 돌아온다 — lib/auth-next.ts 가 같은 출처의 상대 경로만 받는다).
// kind: payment = /billing/return(결제 직후 세션이 끊긴 사람). 쪽마다 h1 하나(§23-6 — headingLevel 1). 제목 id 는 `sign-in-required-title` 이다(러너·시험이 읽는다).
// 기계 값: data-error-code="sign_in_required"(LFAX 의 이름 — 블록의 계약 이름 signInRequired 와는 따로다), data-retryable="false"(다시 해도 소용없다).
export function SignInRequired({ next, kind = "default" }: { next: string; kind?: keyof typeof signInRequiredCopy }) {
  const c = signInRequiredCopy[kind]
  return (
    <div data-sign-in-required={kind} data-retryable="false">
      <StateScreenErrorRetry
        id="sign-in-required"
        errorCode="sign_in_required"
        headingLevel={1}
        copy={{
          title: c.title,
          body: c.body,
          retryLabel: "Try again",
          retryingLabel: "Trying again",
          signIn: { label: c.label, href: signInHref(next) },
          support: { label: `${c.alt.text} ${c.alt.label}`, href: c.alt.href },
        }}
      />
    </div>
  )
}
