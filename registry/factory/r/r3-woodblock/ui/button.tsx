import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// D6(P3-2): 테두리 색은 변형마다 준다 — 기본 층에 border-transparent 를 두면 cn() 없이 buttonVariants() 만 쓴 요소에서
// outline 의 border-input 과 CSS 순서로 겨뤄 테두리가 사라진다(시험작 1호).
// DESIGN.md §7: 히트 영역 44px. 높이·폭과 무관한 식 — ::after 의 inset 이 min(0, (100%-44px)/2) 라서
// 버튼이 44px보다 작으면 모자란 만큼만 넓히고, 크면 0 이다. 레시피가 크기 훅을 바꿔도 44px가 남는다.
const buttonVariants = cva(
  "rounded-none border-2 text-sm font-semibold [&_svg:not([class*='size-'])]:size-4 group/button relative inline-flex shrink-0 items-center justify-center bg-clip-padding whitespace-nowrap transition-[color,background-color,border-color,transform] outline-hidden select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px in-data-[slot=button-group]:min-w-11 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:focus-visible:ring-ring dark:aria-invalid:focus-visible:ring-ring dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 after:absolute after:inset-y-[min(0px,calc((100%-44px)/2))] after:inset-x-[min(0px,calc((100%-44px)/2))] in-data-[slot=button-group]:after:inset-x-0 in-[[data-slot=button-group][data-orientation=vertical]]:after:inset-y-0 in-data-[slot=pagination-content]:after:inset-x-0 in-data-[slot=input-group]:after:inset-x-0 pointer-coarse:in-[[data-slot=button-group][data-orientation=vertical]]:min-h-11 pointer-coarse:in-data-[slot=pagination-content]:min-w-11 pointer-coarse:in-data-[slot=input-group]:min-w-11 pointer-coarse:in-data-[slot=drawer-footer]:min-h-11",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "dark:bg-transparent dark:hover:bg-muted border-input bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "border-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "border-transparent bg-destructive/10 text-(--wf-danger-text) hover:bg-destructive/20 focus-visible:border-destructive/40 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
      // §2: 글자 14px 미만 금지 → xs·sm 도 text-sm.
      size: {
        default:
          "h-11 gap-2 px-6 has-data-[icon=inline-end]:pe-5 has-data-[icon=inline-start]:ps-5",
        xs: "h-7 gap-1 rounded-none px-2.5 text-sm has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-none px-4 text-sm has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-8 text-base has-data-[icon=inline-end]:pe-6 has-data-[icon=inline-start]:ps-6",
        icon: "size-11",
        "icon-xs":
          "size-7 rounded-none [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-9 rounded-none",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  // 이동하는 링크(`render={<a href>}`)는 버튼이 아니다 — Base UI 는 button 이 아닌 요소에 role="button" 을 붙여 읽기 도구가 tel:·지도·쪽 이동 링크를 버튼으로 읽는다(FINAL-WF3).
  // 그래서 href 가 있는 <a> 는 Base UI 를 거치지 않고 같은 모양(data-slot·클래스)만 입힌 진짜 링크로 그린다. 눌리는 동작(onClick 등)·aria·target 은 그대로 건넨다.
  const { render, nativeButton: _nb, focusableWhenDisabled: _fd, disabled: _d, children, ...rest } = props
  void _nb
  void _fd
  void _d
  // 링크 요소가 제 data-slot 을 가지면(쪽 넘김 `pagination-link` 등) 그 값이 남는다 — Base UI 경로에서도 render 요소의 값이 이겼고, 소비자 선택자가 그 표지를 읽는다.
  if (React.isValidElement<{ href?: string; className?: string; "data-slot"?: string }>(render) && render.type === "a" && render.props.href) {
    return React.cloneElement(render, { ...(rest as object), "data-slot": render.props["data-slot"] ?? (rest as { "data-slot"?: string })["data-slot"] ?? "button", className: cn(buttonVariants({ variant, size, className }), render.props.className) } as never, ...(children === undefined ? [] : [children as React.ReactNode]))
  }
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
