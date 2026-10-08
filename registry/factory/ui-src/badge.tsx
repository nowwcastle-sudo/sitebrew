import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "cn-badge group/badge inline-flex [a]:relative [a]:overflow-visible [a]:after:absolute [a]:after:inset-y-[min(0px,calc((100%-44px)/2))] [a]:after:inset-x-[min(0px,calc((100%-44px)/2))] w-fit shrink-0 items-center justify-center overflow-hidden border-transparent whitespace-nowrap transition-[color,background-color,border-color,transform] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:focus-visible:ring-ring dark:aria-invalid:focus-visible:ring-ring dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "cn-badge-variant-default bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "cn-badge-variant-secondary bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "cn-badge-variant-destructive bg-destructive/10 text-(--wf-danger-text) dark:bg-destructive/20 [a]:hover:bg-destructive/20",
        outline:
          "cn-badge-variant-outline border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "cn-badge-variant-ghost hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "cn-badge-variant-link text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
