import * as React from "react"

// 아이콘 공통 인터페이스(DESIGN §6-A): 크기는 16(본문 인라인)·20(조밀 UI)·24(단독·내비) 셋 중 하나, 색은 currentColor 상속.
// 선 굵기는 레시피 결(G1~G5)이 CSS 변수 --icon-stroke 로 준다(icons-<library> 항목 css). Phosphor 는 어댑터의 weight 로.
export type IconSize = 16 | 20 | 24

// 어댑터(lucide·phosphor·tabler)가 내보내는 아이콘 컴포넌트 — 세 라이브러리 모두 size 를 받는다.
export type IconGlyph = React.ComponentType<{
  size?: number | string
  className?: string
  role?: string
  focusable?: "true" | "false"
  "aria-hidden"?: boolean | "true" | "false"
  "aria-label"?: string
}>

export type IconProps = {
  icon: IconGlyph
  size?: IconSize
  // 있으면 뜻을 가진 그림(role="img" + aria-label), 없으면 장식(aria-hidden) — 옆 글자가 뜻을 전한다.
  label?: string
  className?: string
}

function Icon({ icon: Glyph, size = 20, label, className }: IconProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const }
  return <Glyph size={size} className={className} focusable="false" {...a11y} />
}

export { Icon }
