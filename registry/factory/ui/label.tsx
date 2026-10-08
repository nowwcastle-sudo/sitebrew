"use client"

import * as React from "react"
import { cn } from "cn"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "gap-2 text-sm leading-none font-medium flex items-center select-none pointer-coarse:has-data-[slot=checkbox]:min-h-11 pointer-coarse:has-data-[slot=radio-group-item]:min-h-11 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
