"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"
import { uiLabels, type UiLocale } from "@/registry/factory/r/r5-celadon/ui/locale-labels"

import { Button } from "@/registry/factory/r/r5-celadon/ui/button"
import { X as XIcon } from "@/registry/factory/icons/phosphor-light"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50 bg-black/10 duration-(--duration-sheet,320ms) data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// DESIGN.md §7-B: 푸터 첫 버튼이 DialogClose([취소])면 그 버튼에 포커스를 두고 연다.
// 그 밖의 구성은 Base UI 기본(첫 포커스 가능 요소)을 따른다.
const FOOTER_FIRST_CLOSE =
  '[data-slot="dialog-footer"] > [data-slot="dialog-close"]:first-child'


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

// 대화상자를 연 요소(J02 — 닫으면 포커스가 거기로 돌아온다). 내용은 열릴 때 처음 그려지므로 그 첫 렌더에서 활성 요소를 붙잡는다 —
// 이때는 Base UI 가 포커스를 팝업으로 옮기기 전이다. DialogTrigger 로 열었으면 Base UI 기본(트리거)과 같은 요소이고, 상태로만 연 대화상자
// (트리거 없음 — 버튼 onClick 이 open 을 켜는 모양)는 기본값이 body 로 떨어지던 자리를 이 요소가 메운다. 연 요소가 사라졌으면 기본값(true)에 맡긴다.
function useOpener() {
  const [opener] = React.useState<HTMLElement | null>(() => {
    if (typeof document === "undefined") return null
    const a = document.activeElement
    return a instanceof HTMLElement && a !== document.body ? a : null
  })
  return opener
}

function DialogPanel({
  className,
  children,
  showCloseButton = true,
  locale,
  initialFocus,
  finalFocus,
  ref,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  locale?: UiLocale
  ref?: React.Ref<HTMLDivElement>
}) {
  const popupRef = React.useRef<HTMLDivElement>(null)
  const mergedRef = useMergedRef(popupRef, ref)
  const opener = useOpener()
  return (
    <>
      <DialogOverlay />
      <DialogPrimitive.Popup
        ref={mergedRef}
        data-slot="dialog-content"
        initialFocus={
          initialFocus ??
          (() => {
            const popup = popupRef.current
            const close = popup?.querySelector<HTMLElement>(FOOTER_FIRST_CLOSE)
            // 개발 모드 경고: 푸터가 있는데 첫 자식이 [취소](DialogClose)가 아니면 순서·첫 포커스 규칙이 깨진다.
            if (
              !close &&
              process.env.NODE_ENV !== "production" &&
              popup?.querySelector('[data-slot="dialog-footer"]')
            )
              console.warn(
                "[web-factory] DialogFooter 의 첫 자식이 DialogClose([취소])가 아닙니다. DESIGN §7-B: [취소][확인] 순서로 두면 [취소]에 포커스를 두고 엽니다."
              )
            return close ?? true
          })
        }
        finalFocus={finalFocus ?? (() => (opener?.isConnected ? opener : true))}
        className={cn(
          "gap-4 rounded-[16px] p-4 text-base ring-1 [--sh:color-mix(in_oklch,var(--background),black_72%)] shadow-[1px_2px_4px_color-mix(in_oklch,var(--sh)_9%,transparent),1px_4px_8px_color-mix(in_oklch,var(--sh)_7%,transparent),2px_8px_16px_color-mix(in_oklch,var(--sh)_5%,transparent),4px_16px_32px_color-mix(in_oklch,var(--sh)_4%,transparent),8px_32px_64px_color-mix(in_oklch,var(--sh)_3%,transparent),12px_48px_96px_color-mix(in_oklch,var(--sh)_2%,transparent)] fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overscroll-contain bg-popover text-popover-foreground ring-foreground/10 duration-(--duration-sheet,320ms) outline-hidden sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 end-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">{uiLabels(locale).close}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </>
  )
}

// 팝업 쪽은 포털 안쪽 부품(DialogPanel)이 그린다 — 포털은 열렸을 때만 자식을 올리므로, 연 요소를 붙잡는 일이 정확히 열리는 순간에 일어난다.
function DialogContent(props: React.ComponentProps<typeof DialogPanel>) {
  return (
    <DialogPortal>
      <DialogPanel {...props} />
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("gap-2 flex flex-col", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  locale,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
  locale?: UiLocale
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // [취소][확인] — DOM 순서 = 보이는 순서 = 탭 순서(모바일 flex-col-reverse 제거).
        "gap-2 rounded-b-[16px] border-t p-4 -mx-4 -mb-4 flex flex-row flex-wrap justify-end bg-muted/50 max-sm:*:flex-1",
        className
      )}
      {...props}
    >
      {showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          render={<Button variant="outline" />}
        >
          {uiLabels(locale).close}
        </DialogPrimitive.Close>
      )}
      {children}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base leading-snug font-medium font-heading",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm leading-relaxed text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
