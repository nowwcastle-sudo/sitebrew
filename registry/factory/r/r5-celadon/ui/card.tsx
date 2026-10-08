import * as React from "react"
import { cn } from "cn"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "gap-(--card-spacing) rounded-[16px] py-(--card-spacing) text-sm ring-0 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-[16px] *:[img:last-child]:rounded-b-[16px] [--card-spacing:--spacing(7)] data-[size=sm]:[--card-spacing:--spacing(5)] [--sh:color-mix(in_oklch,var(--background),black_72%)] shadow-[0px_1px_1px_color-mix(in_oklch,var(--sh)_14%,transparent),1px_2px_2px_color-mix(in_oklch,var(--sh)_11%,transparent),1px_4px_4px_color-mix(in_oklch,var(--sh)_8%,transparent),2px_8px_8px_color-mix(in_oklch,var(--sh)_6%,transparent)] group/card flex flex-col overflow-hidden bg-card text-card-foreground ring-foreground/10",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "gap-1.5 rounded-t-[16px] px-(--card-spacing) [.border-b]:pb-(--card-spacing) group/card-header @container/card-header grid auto-rows-min items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-xl leading-snug font-semibold tracking-tight group-data-[size=sm]/card:text-base font-heading",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "rounded-b-[16px] [--card-footer-bg:color-mix(in_oklab,var(--muted)_60%,transparent)] px-(--card-spacing) py-5 flex items-center bg-[var(--card-footer-bg,color-mix(in_oklab,var(--muted)_50%,transparent))]",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
