"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { cn } from "cn"

import { Button } from "@/registry/factory/r/r8-dusk/ui/button"

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50 bg-black/10 duration-(--duration-sheet,320ms) data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// DESIGN.md §7-B: 확정·전송·삭제 대화상자는 [취소]에 포커스를 두고 연다(Enter 한 번으로 확정되지 않게).
// AlertDialogContent 가 ref 를 만들어 내려 주고, AlertDialogCancel 이 그 ref 에 붙는다.
const AlertDialogCancelRefContext =
  React.createContext<React.RefObject<HTMLButtonElement | null> | null>(null)

function AlertDialogContent({
  className,
  size = "default",
  initialFocus,
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  size?: "default" | "sm"
}) {
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogCancelRefContext.Provider value={cancelRef}>
        <AlertDialogPrimitive.Popup
          data-slot="alert-dialog-content"
          data-size={size}
          // [취소]가 있으면 그것에, 없으면 Base UI 기본(첫 포커스 가능 요소)으로.
          initialFocus={initialFocus ?? (() => cancelRef.current ?? true)}
          className={cn(
            "gap-4 rounded-[16px] p-4 ring-1 [--sh:color-mix(in_oklch,var(--background),black_72%)] shadow-[1px_2px_4px_color-mix(in_oklch,var(--sh)_9%,transparent),1px_4px_8px_color-mix(in_oklch,var(--sh)_7%,transparent),2px_8px_16px_color-mix(in_oklch,var(--sh)_5%,transparent),4px_16px_32px_color-mix(in_oklch,var(--sh)_4%,transparent),8px_32px_64px_color-mix(in_oklch,var(--sh)_3%,transparent),12px_48px_96px_color-mix(in_oklch,var(--sh)_2%,transparent)] group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overscroll-contain bg-popover text-popover-foreground ring-foreground/10 duration-(--duration-sheet,320ms) outline-hidden data-[size=default]:sm:max-w-md data-[size=sm]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </AlertDialogCancelRefContext.Provider>
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "gap-1.5 has-data-[slot=alert-dialog-media]:gap-x-4 grid grid-rows-[auto_1fr] place-items-center text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      // DESIGN.md §7-B: [취소][확인] — 보조 왼쪽, 주 행동 오른쪽. 모든 폭에서 DOM 순서 = 보이는 순서 = 탭 순서
      // (원본의 모바일 flex-col-reverse 는 순서를 뒤집어 사이트 전체 순서 규칙과 어긋나서 뺐다).
      className={cn(
        "gap-2 rounded-b-[16px] border-t p-4 -mx-4 -mb-4 flex flex-row flex-wrap justify-end bg-muted/50 max-sm:*:flex-1 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "size-10 rounded-[12px] *:[svg:not([class*='size-'])]:size-6 mb-2 inline-flex items-center justify-center bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "text-base font-medium font-heading sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "text-sm leading-relaxed text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="alert-dialog-action"
      className={cn(className)}
      {...props}
    />
  )
}


// ref 에 값을 넣는다(함수 ref 는 부르고, 객체 ref 는 current 에). @radix-ui/react-compose-refs 의 setRef 와 같은 모양 —
// 컴포넌트 밖 함수라 ref 콜백 안에서 인자 ref 를 채워도 React Compiler 의 immutability 규칙에 걸리지 않는다(리뷰 M1).
function assignRef<T>(target: React.Ref<T> | undefined, node: T | null) {
  if (typeof target === "function") target(node)
  else if (target) (target as React.RefObject<T | null>).current = node
}

// 소비자가 준 ref 와 내부 ref 를 함께 채운다 — {...props} 가 ref 를 덮어 [취소] 첫 포커스가 조용히 풀리지 않게.
function useMergedRef<T>(inner: React.RefObject<T | null>, outer: React.Ref<T> | undefined) {
  return React.useCallback(
    (node: T | null) => {
      assignRef(inner, node)
      assignRef(outer, node)
    },
    [inner, outer]
  )
}

const NO_REF: React.RefObject<HTMLButtonElement | null> = { current: null }

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ref,
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size"> & {
    ref?: React.Ref<HTMLButtonElement>
  }) {
  const cancelRef = useMergedRef(
    React.useContext(AlertDialogCancelRefContext) ?? NO_REF,
    ref
  )
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      /* icon-label: [취소] 글자가 children 으로 온다 */
      ref={cancelRef}
      className={cn(className)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
