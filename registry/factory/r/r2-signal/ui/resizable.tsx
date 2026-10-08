"use client"

import { cn } from "cn"
import { uiLabels, type UiLocale } from "@/registry/factory/r/r2-signal/ui/locale-labels"
import * as ResizablePrimitive from "react-resizable-panels"

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  "aria-label": ariaLabel,
  locale,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean
  locale?: UiLocale
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      aria-label={ariaLabel ?? uiLabels(locale).resize}
      className={cn(
        // The visible grip is only ~4px wide; before:-inset-x-3 (and its
        // horizontal-orientation counterpart) gives it a WCAG 2.5.8-sized
        // invisible hit area without widening the line itself.
        "aria-[orientation=horizontal]:h-px pointer-coarse:before:-inset-x-[22px] relative flex w-px items-center justify-center bg-border ring-offset-background before:absolute before:-inset-x-3 before:inset-y-0 before:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:before:inset-x-0 aria-[orientation=horizontal]:before:-inset-y-3 aria-[orientation=horizontal]:after:start-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="h-6 rounded-none z-10 flex w-1 shrink-0 bg-border" />
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
