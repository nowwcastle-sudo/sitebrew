"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { cn } from "cn"
import { uiLabels, type UiLocale } from "@/registry/factory/r/r6-civic/ui/locale-labels"

import { Button } from "@/registry/factory/r/r6-civic/ui/button"
import { X as XIcon, CheckCircle as CircleCheckIcon, Info as InfoIcon, AlertTriangle as TriangleAlertIcon, XOctagon as OctagonXIcon, LoaderCircle as Loader2Icon } from "@/registry/factory/icons/lucide"

// DESIGN.md §7-B: 행동 버튼([되돌리기] 등)이 있는 토스트는 10초 이상 머문다.
// timeout 을 주지 않은 행동 토스트는 10000ms 로 채운다. 호출 쪽이 준 값은 그대로 둔다.
const ACTION_TOAST_TIMEOUT = 10000

// createToastManager().add 와 useToastManager().add 가 함께 쓴다(M3 — 훅으로 직접 부른 행동 토스트도 10초).
function withActionTimeout<T extends { actionProps?: unknown; timeout?: number }>(options: T): T {
  return options.actionProps && options.timeout === undefined
    ? { ...options, timeout: ACTION_TOAST_TIMEOUT }
    : options
}

function createToastManager<Data extends object = object>() {
  const manager = ToastPrimitive.createToastManager<Data>()
  const add = manager.add
  manager.add = ((options) => add(withActionTimeout(options))) as typeof manager.add
  return manager
}

const toast = createToastManager()

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
  return <ToastPrimitive.Provider {...props} />
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

// DESIGN.md §7-B: 토스트는 포커스를 옮기지 않고 role="status"(polite)로 알린다.
// Base UI 기본은 role="region" 이라 status 로 덮는다. 치명적 오류는 토스트 대신 배너(role="alert").
function ToastViewport({ className, locale, ...props }: ToastPrimitive.Viewport.Props & { locale?: UiLocale }) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      role="status"
      aria-live="polite"
      aria-label={uiLabels(locale).toastRegion}
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm outline-hidden sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
        className
      )}
      {...props}
    />
  )
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "rounded-[16px] border shadow-none group/toast pointer-events-auto absolute end-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom bg-popover text-popover-foreground will-change-transform outline-hidden select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring",
        "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
        "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_var(--duration-sheet,320ms)_var(--ease-standard,cubic-bezier(0.23,1,0.32,1)),opacity_var(--duration-sheet,320ms),height_var(--duration-popover,160ms)]",
        "after:absolute after:top-full after:start-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
        "data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]",
        "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
        "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
        "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
        className
      )}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn(
        "gap-3 p-4 flex h-full items-center overflow-hidden transition-opacity duration-(--duration-popover,160ms) ease-(--ease-standard) data-behind:opacity-0 data-expanded:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

function ToastAction({
  className,
  render = <Button variant="outline" size="sm" />,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn("shrink-0", className)}
      {...props}
    />
  )
}

function ToastClose({
  className,
  children,
  render = <Button variant="ghost" size="icon-sm" />,
  locale,
  ...props
}: ToastPrimitive.Close.Props & { locale?: UiLocale }) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label={uiLabels(locale).toastClose}
      render={render}
      className={cn(
        "relative shrink-0 text-muted-foreground after:absolute after:inset-y-[min(0px,calc((100%-44px)/2))] after:inset-x-[min(0px,calc((100%-44px)/2))] hover:text-foreground",
        className
      )}
      {...props}
    >
      {children ?? (
        <XIcon aria-hidden="true" />
      )}
    </ToastPrimitive.Close>
  )
}

function ToastIcon({ type }: { type: string | undefined }) {
  let icon: React.ReactNode = null

  if (type === "success") {
    icon = (
      <CircleCheckIcon aria-hidden="true" />
    )
  }

  if (type === "info") {
    icon = (
      <InfoIcon aria-hidden="true" />
    )
  }

  if (type === "warning") {
    icon = (
      <TriangleAlertIcon aria-hidden="true" />
    )
  }

  if (type === "error") {
    icon = (
      <OctagonXIcon className="text-destructive" aria-hidden="true" />
    )
  }

  if (type === "loading") {
    icon = (
      <Loader2Icon className="animate-spin" aria-hidden="true" />
    )
  }

  if (!icon) {
    return null
  }

  return (
    <span
      data-slot="toast-icon"
      className="[&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:pointer-events-none"
    >
      {icon}
    </span>
  )
}

// DESIGN.md §7-B: 시간이 끝난 토스트는 DOM에서 빼거나 hidden 으로 없앤다.
// Base UI 1.8 동작(toast/store.js·root/ToastRoot.js 확인): 만료 → transitionStatus "ending"
// → 퇴장 애니메이션이 끝나면 store.removeToast 로 배열에서 빠져 이 목록에서 사라진다(DOM 제거).
// 남는 틈 두 곳을 막는다:
//  1) 퇴장 애니메이션 동안(최대 500ms) 버튼이 아직 눌린다 → inert 로 포커스·클릭 차단.
//  2) limit 을 넘어 뒤로 밀린 토스트는 opacity-0 로만 남아, 새 것이 먼저 닫히면 옛 것이
//     [되돌리기]와 함께 다시 나타난다 → 밀리는 즉시 close 해 새 것이 옛 것을 「대체」하게 한다
//     (close → ending → 퇴장 후 DOM 제거). effect 가 돌기 전 한 프레임은 hidden·inert 로 가린다.
function ToastList({ locale }: { locale?: UiLocale }) {
  const { toasts, close } = ToastPrimitive.useToastManager()

  React.useEffect(() => {
    for (const t of toasts) {
      if (t.limited && t.transitionStatus !== "ending") close(t.id)
    }
  }, [toasts, close])

  return toasts.map((toastItem) => (
    <Toast
      key={toastItem.id}
      toast={toastItem}
      inert={
        toastItem.transitionStatus === "ending" || toastItem.limited || undefined
      }
      hidden={toastItem.limited || undefined}
    >
      <ToastContent>
        <ToastIcon type={toastItem.type} />
        <div className="gap-1 flex min-w-0 flex-1 flex-col">
          <ToastTitle />
          <ToastDescription />
        </div>
        <ToastAction />
        <ToastClose locale={locale} />
      </ToastContent>
    </Toast>
  ))
}

// 기본값(DESIGN.md §7-B): 한 번에 하나(새 것이 옛 것을 닫고 대체), 5초 뒤 자동 닫힘(2~7초 범위).
// 행동 버튼이 있는 토스트는 timeout 을 주지 않으면 10000ms(위 withActionTimeout — 매니저·훅 둘 다).
// (/qa/base 검수대의 토스트만 예외: Task 6 behavior.mjs 자동 검사를 빠르게 돌리려고
// 4000ms 를 직접 준다. 실제 화면에서는 이 예외를 따르지 말 것.)
// 마우스가 올라가 있거나 포커스된 동안 타이머 정지는 Base UI 기본 동작이다.
function Toaster({
  children,
  toastManager = toast,
  limit = 1,
  timeout = 5000,
  locale,
  ...props
}: ToastPrimitive.Provider.Props & { locale?: UiLocale }) {
  return (
    <ToastProvider
      toastManager={toastManager}
      limit={limit}
      timeout={timeout}
      {...props}
    >
      {children}
      <ToastPortal>
        <ToastViewport locale={locale}>
          <ToastList locale={locale} />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}

function useToastManager() {
  const manager = ToastPrimitive.useToastManager()
  const { add } = manager
  const addWithDefault = React.useCallback(
    (options: Parameters<typeof add>[0]) => add(withActionTimeout(options)),
    [add]
  )
  return React.useMemo(() => ({ ...manager, add: addWithDefault as typeof add }), [manager, addWithDefault])
}

export {
  Toaster,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  createToastManager,
  toast,
  useToastManager,
  withActionTimeout,
}
