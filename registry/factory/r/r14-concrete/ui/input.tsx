import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 rounded-none border-2 bg-transparent px-3 py-1 text-base tabular-nums md:text-sm [&[inputmode=decimal]]:font-mono [&[inputmode=numeric]]:font-mono [&[type=number]]:font-mono [&[type=tel]]:font-mono file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold dark:bg-transparent min-h-[44px] w-full min-w-0 border-input transition-colors outline-hidden file:inline-flex file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:focus-visible:ring-ring dark:aria-invalid:focus-visible:ring-ring dark:disabled:bg-input/80 dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
