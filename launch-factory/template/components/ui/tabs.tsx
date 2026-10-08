"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "gap-2 group/tabs flex data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "rounded-none p-[3px] group-data-horizontal/tabs:h-8 data-[variant=line]:rounded-none pointer-coarse:h-auto! group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "gap-1.5 rounded-none border px-1.5 py-0.5 text-sm font-medium has-data-[icon=inline-end]:pe-1 has-data-[icon=inline-start]:ps-1 group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg:not([class*='size-'])]:size-4 group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:data-active:bg-input/30 group-data-[variant=default]/tabs-list:data-active:shadow-none pointer-coarse:min-h-11 pointer-coarse:min-w-11 relative inline-flex before:absolute before:inset-x-0 before:inset-y-[min(0px,calc((100%-24px)/2))] h-[calc(100%-1px)] flex-1 items-center justify-center border-transparent whitespace-nowrap text-foreground/75 transition-[color,background-color,border-color,transform] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "dark:group-data-[variant=line]/tabs-list:data-active:border-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:text-foreground",
        // T7-I2: 선택된 칸은 면 색만으로 구별하지 않는다 — 링 색(3:1 이상) 2px 안쪽 테두리. 밑줄형(line)은 아래 after 밑줄이 맡는다.
        "group-data-[variant=default]/tabs-list:data-active:inset-ring-2 group-data-[variant=default]/tabs-list:data-active:inset-ring-ring",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-end-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      // Base UI makes an otherwise-childless panel tabbable (APG tabpanel
      // pattern) so keyboard users can reach it; that turns it into a real
      // 2.5.8 target, so it needs a floor even when its text is one short line.
      className={cn("min-h-6 text-sm flex-1 outline-hidden", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
