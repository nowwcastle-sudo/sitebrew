import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { cn } from "cn"
import { ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon } from "@/registry/factory/icons/lucide"

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("not-last:border-b", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "rounded-lg border py-2.5 text-base font-medium **:data-[slot=accordion-trigger-icon]:size-4 pointer-coarse:min-h-11 min-h-[24px] group/accordion-trigger relative flex flex-1 items-start justify-between border-transparent text-left transition-[color,background-color,border-color,transform] outline-hidden hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ms-auto **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon data-slot="accordion-trigger-icon" className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden" />
        <ChevronUpIcon data-slot="accordion-trigger-icon" className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="text-base leading-relaxed grid grid-rows-[1fr] overflow-hidden transition-[grid-template-rows] duration-(--duration-popover,160ms) ease-(--ease-standard) data-ending-style:grid-rows-[0fr] data-starting-style:grid-rows-[0fr]"
      {...props}
    >
      {/* 열고 닫기는 높이 키프레임이 아니라 grid-template-rows 1fr ↔ 0fr 전환(P3-2 D9 — AI 티 G119 height 전환). 한 칸짜리 격자의 칸(min-h-0)은
          여백이 없어야 0 까지 접힌다 — 여백 훅(cn-accordion-content-inner)은 그 안쪽에 둔다. */}
      <div className="min-h-0">
        <div
          className={cn(
            "pt-0 pb-2.5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
            className
          )}
        >
          {children}
        </div>
      </div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
