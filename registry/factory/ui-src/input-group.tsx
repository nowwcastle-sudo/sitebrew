"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Button } from "@/registry/factory/ui/button"
import { Input } from "@/registry/factory/ui/input"
import { Textarea } from "@/registry/factory/ui/textarea"

// DESIGN.md §7: 히트 영역 바닥(min-h-[44px])은 보이는 그룹 칸에 둔다. 그룹 자신(테두리·빈 곳)을 눌러도
// 입력칸에 초점이 가게 해 그룹 상자 전체가 타깃이 된다(InputGroupAddon 과 같은 동작).
function InputGroup({ className, onClick, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.target !== e.currentTarget) return
        e.currentTarget.querySelector<HTMLElement>("input, textarea")?.focus()
      }}
      className={cn(
        "cn-input-group group/input-group relative flex min-h-[44px] w-full min-w-0 items-center border-input transition-colors outline-hidden in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-disabled:bg-input/50 has-disabled:opacity-50 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]:focus-visible]:ring-ring dark:has-[[data-slot][aria-invalid=true]:focus-visible]:ring-ring has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto dark:has-disabled:bg-input/80 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "cn-input-group-addon flex h-auto cursor-text items-center justify-center text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50",
  {
    variants: {
      align: {
        "inline-start":
          "cn-input-group-addon-align-inline-start order-first has-[>button]:ms-[-0.3rem] has-[>kbd]:ms-[-0.15rem]",
        "inline-end":
          "cn-input-group-addon-align-inline-end order-last has-[>button]:me-[-0.3rem] has-[>kbd]:me-[-0.15rem]",
        "block-start":
          "cn-input-group-addon-align-block-start order-first w-full justify-start",
        "block-end":
          "cn-input-group-addon-align-block-end order-last w-full justify-start",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "cn-input-group-button flex items-center",
  {
    variants: {
      size: {
        xs: "cn-input-group-button-size-xs",
        sm: "cn-input-group-button-size-sm",
        "icon-xs":
          "cn-input-group-button-size-icon-xs",
        "icon-sm": "cn-input-group-button-size-icon-sm",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset"
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "cn-input-group-text flex items-center text-muted-foreground [&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "cn-input-group-control h-full min-h-0 flex-1 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:disabled:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "cn-input-group-textarea flex-1 resize-none focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:disabled:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
