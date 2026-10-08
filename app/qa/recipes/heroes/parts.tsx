// 히어로 검수대 틀(P3-2 Task 3 — 본체는 blocks/hero 블록)이 같이 쓰는 조각: 머리·다음 칸 머리·면 구획. 모양은 레시피 컴파일 부품(r.ui.*)과
// 레시피 토큰(bg-field-*·data-face·font-heading·--duration-*·--ease-*)에서만 온다. 틀 머리의 CSS 는 heroes.css 의 [data-hero="<id>"] 아래.
// 면 구획(FACE_CLASS·Face)은 이 모듈 하나가 원천이다 — 대표 장면(scenes.tsx)·견본(specimen.tsx)도 여기서 가져간다.
import * as React from "react"

import type { HeroOption, HeroZone } from "./types"

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ")

// 검수대 틀 뿌리(P3-2 Task 3): 히어로 블록 + 출처 + 다음 칸 머리를 옛 HeroRoot 와 같은 쌓임 맥락(relative isolate) 안에 둔다 —
// 밖에 두면 다음 칸 글자의 안티앨리어싱이 달라져(합성 층 겹침) 보드 사진이 바뀐다(승격 전후 픽셀 대조에서 실측).
export function HeroFrame({ children }: { children: React.ReactNode }) {
  return <div className="relative isolate">{children}</div>
}
// 포커스 링(묶음 2): 컴파일 부품(Button)과 같은 불투명 링 — ring-3(3px) + --ring. 히어로가 직접 쓰는 <a>·<button> 에 단다
// (전역 기본 링은 반투명이라 3:1 을 못 지킨다). 면 구획 안에서는 --ring 이 면 글자 짝으로 바뀐다.
export const RING = "outline-none focus-visible:ring-3 focus-visible:ring-ring"

// 글자 크기 조정(공공 원형 §21-8 MUST — 묶음 2): 문서 뿌리 글자 크기를 배율(%)로 바꾼다. rem 으로 잰 글자·여백이 함께 커진다. 떠날 때 되돌린다.
export function useRootScale(pct: string) {
  React.useEffect(() => {
    const html = document.documentElement
    const before = html.style.fontSize
    html.style.fontSize = pct === "100" ? before : `${pct}%`
    return () => {
      html.style.fontSize = before
    }
  }, [pct])
}

export const FACE_CLASS: Record<string, string> = {
  "field-1": "bg-field-1 text-field-1-foreground",
  "field-2": "bg-field-2 text-field-2-foreground",
  "block-1": "bg-block-1 text-block-1-foreground",
  "block-2": "bg-block-2 text-block-2-foreground",
  "block-3": "bg-block-3 text-block-3-foreground",
  "block-4": "bg-block-4 text-block-4-foreground",
}
// 이 선택지의 i번째 면(면이 없는 골격 레시피는 undefined — 호출한 쪽이 선·바탕으로 대신한다).
export const faceAt = (o: HeroOption, i: number) => (o.faces.length ? o.faces[i % o.faces.length] : undefined)

type Tag = "section" | "div" | "header" | "aside" | "figure" | "li" | "span" | "nav"
// 등장 대상 표시(motion-boot — 서버 렌더 첫 화면에서 장면이 시작하기 전까지 숨긴다). true = 숨김 대상, "keep" = 움직이지만 숨기지 않는다.
export type Enter = boolean | "keep" | undefined
const enterAttr = (e: Enter) => (e ? { "data-enter": e === "keep" ? "keep" : "" } : {})
// 면 구획: 면이 있으면 bg + data-face(면 스코프 토큰 — ring·primary·보조 글자가 면의 짝으로), 없으면 fallback 클래스.
export function Face({ k, fallback = "", className = "", children, label, as: T = "div", style, enter }: { k?: string; fallback?: string; className?: string; children?: React.ReactNode; label?: string; as?: Tag; style?: React.CSSProperties; enter?: Enter }) {
  return (
    <T {...(k ? { "data-face": k } : {})} {...enterAttr(enter)} aria-label={label} className={cx(k ? FACE_CLASS[k] : fallback, className)} style={style}>
      {children}
    </T>
  )
}

// 어두운 구역: 칸 속성(zone)을 안쪽 요소에 다시 달고 .dark 를 붙인다 — recipes.css 의 `.dark[data-recipe="<id>"]`(B면 `[data-alt-color]` 까지)가
// 그 구역에만 레시피 다크 값을 얹는다. 라이트 페이지 안의 짙은 첫 화면(측정 사이트의 어두운 사진 자리)을 lint 가 잰 다크 짝으로 그린다.
export function DarkZone({ zone, className = "", children, label, as: T = "div", enter }: { zone: HeroZone; className?: string; children: React.ReactNode; label?: string; as?: Tag; enter?: Enter }) {
  return (
    <T {...zone} {...enterAttr(enter)} aria-label={label} className={cx("dark", className)}>
      {children}
    </T>
  )
}

// 내비 링크 한 줄 — 누르는 곳 44px(min-h-11), 포커스는 공장 링(RING). 현재 위치는 aria-current.
export function NavLinks({ items, className = "", linkClass = "" }: { items: string[]; className?: string; linkClass?: string }) {
  return (
    <ul className={cx("flex items-center", className)}>
      {items.map((t, i) => (
        <li key={t}>
          <a href="#top" aria-current={i === 0 ? "page" : undefined} className={cx("inline-flex min-h-11 items-center px-3", RING, linkClass)}>
            {t}
          </a>
        </li>
      ))}
    </ul>
  )
}

// 첫 화면 다음 칸의 머리 — 접힘선 바로 아래에서 시작해 첫 화면 아래 끝에 살짝 보인다. 본문은 바탕 위(7:1).
export function NextHint({ label, title, body, cols, className = "", children }: { label: string; title: string; body: string; cols?: { k: string; v: string }[]; className?: string; children?: React.ReactNode }) {
  return (
    <section aria-label={label} className={cx("relative px-6 py-16 md:px-12", className)}>
      <div className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <h2 className="font-heading text-[clamp(1.953rem,3.2vw,3.052rem)] leading-[1.1]">{title}</h2>
        <div className="flex flex-col gap-6">
          <p className="max-w-[60ch] leading-[1.75]">{body}</p>
          {cols && (
            <dl className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
              {cols.map((c) => (
                <div key={c.k}>
                  <dt className="text-sm text-muted-foreground">{c.k}</dt>
                  <dd className="mt-1 leading-[1.6]">{c.v}</dd>
                </div>
              ))}
            </dl>
          )}
          {children}
        </div>
      </div>
    </section>
  )
}
