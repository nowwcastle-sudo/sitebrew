import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-none animate-pulse bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
