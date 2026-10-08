import * as React from "react"

import { LoaderCircle } from "@/components/icons"
import { cn } from "@/lib/utils"
import { usePendingGate } from "@/components/ui/spinner"

// 소셜 로그인 버튼(P3-2 레인 D1 공유 조각 block-shared-social-login). DESIGN §17 공식 규격 그대로:
//   카카오 — 컨테이너 #FEE500 · 검정 말풍선 심볼 · 라벨 검정 85% · 반경 12px(말풍선 모양 고정) ·
//   네이버 — #03C75A + 흰 N · 구글 — 흰 바탕 + 테두리 #747775 + 다색 G(재색상 금지).
// 라벨 있는 전체 폭 버튼(1순위)이고, 이메일 폼 위에 둔다(마케팅 규칙 O4). 색·반경은 플랫폼 규격이라 레시피 토큰을 받지 않는다(훅 값에 고정).
// 누르면 onPick(method) — 블록이 포트(signIn·signUp)를 부르고 redirectUrl 로 간다. busy 인 버튼은 aria-disabled + 돌아가는 표시.
// lastMethod·lastLabel(선택, 대장 A40): 지난번에 쓴 방법의 버튼 글 옆에 「최근 사용」 표시(글자 — 색만으로 알리지 않는다). 버튼 이름에도 그 글이 들어간다.

export type SocialMethod = "kakao" | "naver" | "google"
export const SOCIAL_ORDER: readonly SocialMethod[] = ["kakao", "naver", "google"]
export const isSocial = (m: string): m is SocialMethod => (SOCIAL_ORDER as readonly string[]).includes(m)

function KakaoSymbol() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="absolute start-4 size-[18px]">
      <path fill="currentColor" d="M9 1.5C4.58 1.5 1 4.29 1 7.71c0 2.2 1.47 4.13 3.68 5.23l-.94 3.44c-.08.3.26.54.52.37l4.11-2.72c.21.02.42.03.63.03 4.42 0 8-2.79 8-6.23S13.42 1.5 9 1.5z" />
    </svg>
  )
}
function NaverSymbol() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="absolute start-4 size-[18px]">
      <path fill="currentColor" d="M10.85 8.56 5.01 0H0v16h5.15V7.44L10.99 16H16V0h-5.15z" />
    </svg>
  )
}
function GoogleSymbol() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="absolute start-4 size-[18px]">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/** 버튼 하나 — 공급자마다 훅이 다르다(삼항식 안 훅은 컴파일되지 않으니 갈래마다 글자 그대로 쓴다) */
function SocialButton({ method, label, busy, onPick, last }: { method: SocialMethod; label: string; busy: boolean; onPick: (m: SocialMethod) => void; last?: string }) {
  const spin = usePendingGate(busy)
  const inner = (
    <>
      {spin ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : method === "kakao" ? <KakaoSymbol /> : method === "naver" ? <NaverSymbol /> : <GoogleSymbol />}
      <span className="px-8">{label}</span>
      {last ? (
        <span data-last-used="" className="ms-1 inline-flex shrink-0 items-center rounded-sm border border-current px-2 py-0.5 text-base leading-[1.4]">
          {last}
        </span>
      ) : null}
    </>
  )
  const common = { type: "button" as const, "data-social": method, "aria-disabled": busy || undefined, onClick: () => (busy ? undefined : onPick(method)) }
  if (method === "kakao")
    return (
      <button {...common} className="relative flex h-12 w-full items-center justify-center gap-2 px-4 text-base leading-none outline-hidden transition-[filter] duration-(--duration-hover,150ms) hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 aria-disabled:cursor-progress rounded-[12px] bg-[#FEE500] text-black/85">
        {inner}
      </button>
    )
  if (method === "naver")
    return (
      <button {...common} className="relative flex h-12 w-full items-center justify-center gap-2 px-4 text-base leading-none outline-hidden transition-[filter] duration-(--duration-hover,150ms) hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 aria-disabled:cursor-progress rounded-[6px] bg-[#03C75A] text-white">
        {inner}
      </button>
    )
  return (
    <button {...common} className="relative flex h-12 w-full items-center justify-center gap-2 px-4 text-base leading-none outline-hidden transition-[filter] duration-(--duration-hover,150ms) hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 aria-disabled:cursor-progress rounded-[4px] border border-[#747775] bg-white text-[#1F1F1F]">
      {inner}
    </button>
  )
}

/** 소셜 로그인 버튼 줄(카카오 → 네이버 → 구글 순, methods 에 있는 것만). 하나도 없으면 그리지 않는다 */
export function SocialButtons({
  methods,
  labels,
  onPick,
  busy = null,
  lastMethod,
  lastLabel,
  className,
}: {
  methods: readonly string[]
  labels: Record<SocialMethod, string>
  onPick: (m: SocialMethod) => void
  busy?: SocialMethod | null
  // 지난번에 쓴 방법과 그 표시 글(둘 다 있을 때만 그린다)
  lastMethod?: string
  lastLabel?: string
  className?: string
}) {
  const list = SOCIAL_ORDER.filter((m) => methods.includes(m))
  if (!list.length) return null
  return (
    <ul data-social-first="" className={cn("flex w-full flex-col gap-3", className)}>
      {list.map((m) => (
        <li key={m}>
          <SocialButton method={m} label={labels[m]} busy={busy === m} onPick={onPick} last={lastLabel && lastMethod === m ? lastLabel : undefined} />
        </li>
      ))}
    </ul>
  )
}
