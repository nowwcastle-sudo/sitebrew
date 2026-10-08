import * as React from "react"
import { cn } from "cn"
import { ChevronDown as ChevronDownIcon } from "@/registry/factory/icons/tabler"

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default"
}

function NativeSelect({
  className,
  size = "default",
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className="h-11 rounded-[6px] border bg-muted py-1 pe-9 ps-3 text-base hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_4%)] focus-visible:bg-background md:text-sm data-[size=sm]:h-9 data-[size=sm]:rounded-[5px] data-[size=sm]:py-0.5 dark:bg-input/40 pointer-coarse:min-h-11 w-full min-w-0 appearance-none border-input transition-colors outline-hidden select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:focus-visible:ring-ring dark:aria-invalid:focus-visible:ring-ring dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/40"
        {...props}
      />
      <ChevronDownIcon className="size-4 pointer-events-none absolute top-1/2 end-2.5 -translate-y-1/2 text-muted-foreground select-none" aria-hidden="true" data-slot="native-select-icon" />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("text-[CanvasText] bg-[Canvas]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("text-[CanvasText] bg-[Canvas]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
