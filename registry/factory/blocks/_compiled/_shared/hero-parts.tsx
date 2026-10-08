"use client"

import * as React from "react"

import { cn } from "@/registry/factory/lib/utils"
import { useGsapScene, type SceneBuild } from "@/registry/factory/motion/use-gsap-scene"

// 히어로 블록(P3-2 Task 3 — 공유 조각 block-shared-hero-parts)이 같이 쓰는 조각. P3-1 히어로 구성(app/qa/recipes/heroes/parts.tsx)을 블록 층으로 옮겼다.
// 모양은 부르는 쪽의 히어로 훅(base.css 의 blocks:hero 절)과 레시피 토큰(bg-field-*·data-face·font-heading·--duration-*)에서만 온다 — 여기에는 배치 규칙만 있다.

// 히어로 블록이 공통으로 받는 것(각 히어로 props 가 넓힌다):
//   faces       이 히어로가 칠할 면(K6·K7 field-*, K8 block-* — 레시피 색 논리가 가진 키). 비우면 골격(바탕·선으로 나눈다).
//   techniques  역동 기법 id(레시피 dynamics). 기본값은 그 히어로가 원래 쓰던 기법.
//               모션 강도는 받지 않는다 — 장면이 뿌리의 레시피 단계(--wf-motion)를 스스로 읽는다(Task 1c).
//   darkScope   어두운 구역(DarkZone)에 다시 달 속성 — 레시피를 요소 속성으로 가둔 페이지(검수대)에서 그 구역에 다크 값을 얹는다. 소비자는 비운다(.dark 로 충분).
//   header      히어로 뿌리 안 맨 앞에 그릴 머리(내비 블록 등) — 머리가 첫 화면과 한 장면(스크롤·등장)을 나눈다. 비우면 그리지 않는다.
//   texture     질감 부품(스타일 축 X — P3-2 Task 8). 레시피 머리가 X1~X8 이면 조립하는 쪽이 Texture(@/components/ui/texture)를 넘긴다 —
//               히어로가 뿌리 맨 앞에 내용 뒤 층으로 깐다(HeroTexture). 비우면 그리지 않는다.
export type HeroCommon = {
  faces?: string[]
  techniques?: string[]
  darkScope?: Record<string, string | undefined>
  header?: React.ReactNode
  texture?: TextureLike
}

// 새 축 D·X 부품(P3-2 Task 8, 대장 A20). 블록은 레시피를 모르고 두 부품은 머리가 그 축을 적은 레시피에만 깔리므로 블록이 import 하지 않는다 —
// 조립하는 쪽(찍어낸 페이지·갤러리)이 레시피 머리를 보고 넘긴다(factory/scripts/recipe.mjs heroAxisParts). 모양만 맞으면 된다.
export type TextureLike = React.ComponentType<React.ComponentProps<"div">>
export type DisplayTitleLike = React.ComponentType<React.ComponentProps<"h1"> & { as?: "h1" }>
// display: 머리가 D2·D3 이면 DisplayTitle(@/components/ui/display). 제목이 전폭인 히어로(블록 메타 titleWidth "full")만 이 props 를 가진다 —
// D2(10~20vw)는 좁은 칸에서 음절마다 줄이 바뀐다(blocks.mjs heroAxisProblems · recipe lint display-hero-width).
// 받으면 히어로 제목 크기·행간·자간은 D 값이 정하고 히어로 훅(-display)은 자리·색만 준다.
export type HeroDisplay = { display?: DisplayTitleLike }

// 질감 층: 히어로 뿌리의 맨 앞 자식. 히어로 공용 뿌리 훅이 이 층이 있을 때만 뿌리를 relative·isolate 로 만들고, 층은 내용 뒤(-z-10)에 깔린다.
// 읽기(aria-hidden)·누르기(pointer-events-none)에서 빠진다. 면(Face) 색이 칠해진 곳은 면이 덮는다 — 질감은 바탕이 보이는 곳에 나온다.
export function HeroTexture({ texture: T }: { texture?: TextureLike }) {
  return T ? <T aria-hidden="true" data-hero-texture="" className="pointer-events-none absolute inset-0 -z-10 overflow-clip" /> : null
}

// 히어로 안무: 모션 키트 장면 훅. 기법 목록이 바뀔 때만 장면을 다시 세운다(렌더마다 새 배열이어도 값으로 비교).
export function useHeroScene<T extends HTMLElement>(ref: React.RefObject<T | null>, techniques: readonly string[], build: SceneBuild) {
  useGsapScene(ref, build, { deps: [techniques.join(",")] })
}

// 포커스 링(묶음 2): 컴파일 부품(Button)과 같은 불투명 링 — ring-3 + --ring. 히어로가 직접 쓰는 <a>·<button> 에 단다.
export const RING = "outline-hidden focus-visible:ring-3 focus-visible:ring-ring"

// 글자 분할 등장(split-text, 마스크형): 글자(또는 낱말)마다 칸(.hero-mask) 안에서 .hero-ch 가 움직인다. 읽기 도구는 sr-only 원문을 한 번 읽는다.
// 칸 모양(overflow clip·여유)은 히어로 뿌리 훅의 [&_.hero-mask] 규칙이 준다. on 이 아니면 원문 그대로.
export function SplitChars({ text, on, by = "char", className = "" }: { text: string; on: boolean; by?: "char" | "word"; className?: string }) {
  if (!on) return <>{text}</>
  let i = 0
  const piece = (s: string) => (
    <span key={i++} className="hero-mask">
      <span className="hero-ch">{s}</span>
    </span>
  )
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className={className}>
        {text.split(" ").map((w, wi) => (
          <React.Fragment key={wi}>
            {wi > 0 && " "}
            <span className="inline-block whitespace-nowrap">{by === "word" ? piece(w) : [...w].map(piece)}</span>
          </React.Fragment>
        ))}
      </span>
    </>
  )
}

export const FACE_CLASS: Record<string, string> = {
  "field-1": "bg-field-1 text-field-1-foreground",
  "field-2": "bg-field-2 text-field-2-foreground",
  "block-1": "bg-block-1 text-block-1-foreground",
  "block-2": "bg-block-2 text-block-2-foreground",
  "block-3": "bg-block-3 text-block-3-foreground",
  "block-4": "bg-block-4 text-block-4-foreground",
}
// 면 위에 놓이는 글 묶음이 면의 짝 글자색을 받게 하는 클래스(면 자체를 칠하지 않는 형제 칸 — 예: 교정지 면 위 제목). data-face 와 함께 단다.
export const FACE_TEXT: Record<string, string> = {
  "field-1": "text-field-1-foreground",
  "field-2": "text-field-2-foreground",
  "block-1": "text-block-1-foreground",
  "block-2": "text-block-2-foreground",
  "block-3": "text-block-3-foreground",
  "block-4": "text-block-4-foreground",
}
// i번째 면(면이 없으면 undefined — 호출한 쪽이 선·바탕으로 대신한다).
export const faceAt = (faces: readonly string[], i: number) => (faces.length ? faces[i % faces.length] : undefined)

// 그레인(기법 grain — feTurbulence 한 장을 곱하기로, 불투명도 0.12, 180px 타일): 면 구획에 data-grain 을 달면 히어로 공용 그레인 훅이
// ::after 로 깐다. 무늬 그림은 CSS 변수(--hero-grain)로 싣는다(클래스 이름에 그림 주소를 넣지 않는다). hover 로 씨앗을 한 번 바꾸는 「다시 찍힘」은
// reseed()가 data-reseed 를 160ms 달았다 뗀다.
const noise = (seed: number) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`
export const GRAIN_STYLE = { "--hero-grain": noise(0), "--hero-grain-hover": noise(7) } as React.CSSProperties
export function reseed(el: HTMLElement) {
  el.setAttribute("data-reseed", "")
  const t = window.setTimeout(() => el.removeAttribute("data-reseed"), 160)
  return () => {
    window.clearTimeout(t)
    el.removeAttribute("data-reseed")
  }
}

type Tag = "section" | "div" | "header" | "aside" | "figure" | "li" | "span" | "nav"
// 등장 대상 표시(motion-boot — 서버 렌더 첫 화면에서 장면이 시작하기 전까지 숨긴다). true = 숨김 대상, "keep" = 움직이지만 숨기지 않는다.
export type Enter = boolean | "keep" | undefined
const enterAttr = (e: Enter) => (e ? { "data-enter": e === "keep" ? "keep" : "" } : {})
// 면 구획: 면이 있으면 면 색 + data-face(면 스코프 토큰 — ring·primary·보조 글자가 면의 짝으로), 없으면 fallback 색 클래스.
// 면이 없을 때만 필요한 선 모양은 부르는 쪽 훅의 not-data-[face]: 로 준다.
// grain: 그레인을 깐다(data-grain + 무늬 변수 — 모양은 className 에 히어로 공용 그레인 훅을 함께 준다).
export function Face({ k, fallback = "", className = "", children, label, as: T = "div", style, enter, grain = false }: { k?: string; fallback?: string; className?: string; children?: React.ReactNode; label?: string; as?: Tag; style?: React.CSSProperties; enter?: Enter; grain?: boolean }) {
  return (
    <T {...(k ? { "data-face": k } : {})} {...(grain ? { "data-grain": "" } : {})} {...enterAttr(enter)} aria-label={label} className={cn(k ? FACE_CLASS[k] : fallback, className)} style={grain ? { ...GRAIN_STYLE, ...style } : style}>
      {children}
    </T>
  )
}

// 어두운 구역: .dark 를 붙여 그 구역에만 레시피 다크 값을 얹는다. scope(히어로 props darkScope)는 레시피를 요소 속성으로 가둔 페이지에서 다시 다는 속성.
export function DarkZone({ scope, className = "", children, label, as: T = "div", enter }: { scope?: Record<string, string | undefined>; className?: string; children: React.ReactNode; label?: string; as?: Tag; enter?: Enter }) {
  return (
    <T {...scope} {...enterAttr(enter)} aria-label={label} className={cn("dark text-foreground", className)}>
      {children}
    </T>
  )
}
