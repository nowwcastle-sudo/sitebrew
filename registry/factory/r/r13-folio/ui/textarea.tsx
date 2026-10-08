import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 rounded-[6px] border bg-muted px-3 py-2.5 text-base hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_4%)] focus-visible:bg-background md:text-sm dark:bg-input/40 pointer-coarse:min-h-11 flex field-sizing-content w-full border-input transition-colors outline-hidden placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:focus-visible:ring-ring dark:aria-invalid:focus-visible:ring-ring dark:disabled:bg-input/80 dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
