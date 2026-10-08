import * as React from "react"

import { Button } from "@/registry/factory/r/r1-measure/ui/button"

type ButtonProps = React.ComponentProps<typeof Button>
type IconButtonSize = Extract<NonNullable<ButtonProps["size"]>, `icon${string}`>

// 아이콘 어댑터(@/components/icons/<라이브러리>)가 내보내는 아이콘 — 어느 라이브러리든 받는다(부품은 라이브러리를 모른다).
type IconGlyph = React.ComponentType<{ "aria-hidden"?: boolean | "true" | "false" }>

// 아이콘만 있는 버튼. 보이는 글자가 없으므로 이름(label → aria-label)이 타입에서 필수다 — 빠뜨리면 tsc 가 멈춘다(WCAG 4.1.2).
// 레시피마다 컴파일되어 그 레시피의 button 모양을 따른다(판정 T9-c3). 아이콘 크기는 button 의 크기 변형이 정한다.
export type IconButtonProps = Omit<ButtonProps, "children" | "size" | "aria-label" | "aria-labelledby"> & {
  icon: IconGlyph
  label: string
  size?: IconButtonSize
}

function IconButton({ icon: Glyph, label, size = "icon", ...props }: IconButtonProps) {
  return (
    <Button size={size} {...props} aria-label={label}>
      <Glyph aria-hidden="true" />
    </Button>
  )
}

export { IconButton }
