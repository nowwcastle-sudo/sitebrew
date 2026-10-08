import * as React from "react"
import { cn } from "cn"

// 디스플레이 제목(스타일 축 D — 디스플레이 규모, P3-2 Task 16a). 히어로·섹션의 큰 제목 칸이다. 크기·행간·자간·움직임은 D 축 값(cn-display-title)이 정한다:
// D1 표준 · D2 초대형(10~20vw) · D3 키네틱(처음 그릴 때 자간이 모인다 — 동작 줄이기에서는 정지).
// 부품 규칙(값이 바뀌어도 그대로): 제목 서체(font-heading — 굵기는 레시피 토큰), 칸 폭을 넘지 않는다(max-w-full), 줄 길이를 고르게(text-balance), 한글 낱말 안에서 줄을 바꾸지 않되(break-keep)
// 칸보다 긴 낱말은 잘려 숨지 않고 어디서든 줄을 바꾼다(overflow-wrap:anywhere — 뜻 있는 낱말을 자르지 않는다). 제목 수준(h1·h2)은 페이지가 정한다(한 페이지 h1 하나).
function DisplayTitle({
  as: Comp = "h2",
  className,
  ...props
}: React.ComponentProps<"h2"> & { as?: "h1" | "h2" | "h3" | "p" }) {
  return (
    <Comp
      data-slot="display-title"
      className={cn(
        "text-[clamp(2.25rem,4.5vw,4.5rem)] leading-[1.1] tracking-tight font-heading max-w-full text-balance break-keep [overflow-wrap:anywhere]",
        className
      )}
      {...props}
    />
  )
}

export { DisplayTitle }
