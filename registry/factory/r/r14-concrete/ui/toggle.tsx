"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const toggleVariants = cva(
  "gap-1 rounded-none text-sm font-medium [&_svg:not([class*='size-'])]:size-4 group/toggle relative inline-flex items-center justify-center whitespace-nowrap transition-[color,background-color,border-color,transform] outline-hidden hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:focus-visible:ring-ring dark:aria-invalid:focus-visible:ring-ring aria-pressed:bg-muted data-[state=on]:bg-muted aria-pressed:inset-ring-2 aria-pressed:inset-ring-ring dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 after:absolute after:inset-y-[min(0px,calc((100%-44px)/2))] after:inset-x-[min(0px,calc((100%-44px)/2))] in-data-[slot=toggle-group]:after:inset-x-0 in-[[data-slot=toggle-group][data-orientation=vertical]]:after:inset-y-0 pointer-coarse:in-[[data-slot=toggle-group][data-orientation=vertical]]:min-h-11",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border bg-transparent border-input hover:bg-muted",
      },
      size: {
        default:
          "h-8 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 min-w-8",
        sm: "h-7 rounded-none px-2.5 text-sm has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5 min-w-7",
        lg: "h-9 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 min-w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
