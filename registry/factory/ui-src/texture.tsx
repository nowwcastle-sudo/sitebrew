import * as React from "react"
import { cn } from "cn"

// 질감 층(스타일 축 X — 질감, P3-2 Task 16a). 섹션·히어로 면 구획을 감싸 뒤에 장식 무늬를 깐다: X0 없음(기본) · X1 그레인 한 겹 · X2 인쇄 망점 · X3 콜라주(종이 조각).
// 무늬는 ::before(무늬·조각)·::after(종이 한 장) 가상 요소라 읽기·포커스 순서에 없다. 부품 규칙(값이 바뀌어도 그대로): 새 쌓임 맥락(isolate) —
// 두 층은 음수 z 로 내용 뒤에만 깔리고 누르기를 받지 않는다. 층의 모양은 부품이 CSS 변수의 기본값(모두 그리지 않음)으로 쓰고 X 축 값의 훅이 변수만 정한다
// (site-shell 과 같은 방식 — 훅이 before:·after: 규칙 토큰을 더하지 않는다). 그레인 그림은 CSS 변수 --wf-texture-noise 로 싣는다(작은 SVG 한 장 — 큰 PNG 없음).
// 글자 대비는 무늬 위에서 잰다 — 레시피 lint texture-contrast(recipe.mjs)가 무늬가 가장 짙은 점 위의 본문·보조 글자 7:1 을 본다.
const NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

// 무늬 층(::before): 표시·위치·z·기울기·그림·크기·불투명도·합성·필터 + (P3-6 사진 질감) 모서리·그림자. 종이 층(::after): 표시·위치·z·바탕·테두리 + 모서리·그림자·뒤 흐림.
// 새 변수(b-radius·b-shadow·a-inset·a-z·a-radius·a-shadow·a-backdrop)의 기본값은 모두 예전 모양(0·없음·inset 0·z -1)이라 X0~X3 은 같은 그림이다.
const LAYERS =
  "before:pointer-events-none before:absolute before:[display:var(--wf-texture-b-display,none)] before:[inset:var(--wf-texture-b-inset,0)] before:[z-index:var(--wf-texture-b-z,-1)] before:[rotate:var(--wf-texture-b-rotate,0deg)] before:[background:var(--wf-texture-b-bg,none)] before:[background-size:var(--wf-texture-b-size,auto)] before:[opacity:var(--wf-texture-b-opacity,1)] before:[mix-blend-mode:var(--wf-texture-b-blend,normal)] before:[filter:var(--wf-texture-b-filter,none)] before:[border-radius:var(--wf-texture-b-radius,0)] before:[box-shadow:var(--wf-texture-b-shadow,none)] after:pointer-events-none after:absolute after:[inset:var(--wf-texture-a-inset,0)] after:[display:var(--wf-texture-a-display,none)] after:[z-index:var(--wf-texture-a-z,-1)] after:[background:var(--wf-texture-a-bg,none)] after:[border:var(--wf-texture-a-border,0)] after:[border-radius:var(--wf-texture-a-radius,0)] after:[box-shadow:var(--wf-texture-a-shadow,none)] after:[-webkit-backdrop-filter:var(--wf-texture-a-backdrop,none)] after:[backdrop-filter:var(--wf-texture-a-backdrop,none)]"

// overlay: 이 구획이 고정·스티키·오버레이 면일 때만 켠다(위치는 부르는 쪽이 정한다). 간유리 값(X7·X8)은 이때만 실제 뒤 흐림(backdrop-filter)을 걸고
// 자기 사진 층을 끈다(뒤 장면은 지나가는 화면) — 흐르는 구획은 흐림 없이 같은 모양만 낸다(README 허용 조건 2). 다른 값은 overlay 를 몰라도 그대로다.
function Texture({ className, style, overlay = false, ...props }: React.ComponentProps<"div"> & { overlay?: boolean }) {
  return (
    <div
      data-slot="texture"
      data-overlay={overlay ? "" : undefined}
      className={cn("cn-texture relative isolate", LAYERS, className)}
      style={{ "--wf-texture-noise": NOISE, ...style } as React.CSSProperties}
      {...props}
    />
  )
}

export { Texture }
