"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "cn"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
  type Locale,
} from "react-day-picker"

import { Button, buttonVariants } from "@/registry/factory/r/r14-concrete/ui/button"
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, ChevronDown as ChevronDownIcon } from "@/registry/factory/icons/lucide"

// DayPicker 의 classNames 칸마다의 모양 — 훅이 닿도록 cva 로 둔다(스타일 변환은 cva·className 안의 문자열만 바꾼다).
const calendarMonths = cva("gap-4 relative flex flex-col md:flex-row")
const calendarMonth = cva("gap-4 flex w-full flex-col")
const calendarNav = cva("gap-1 absolute inset-x-0 top-0 flex w-full items-center justify-between")
const calendarMonthCaption = cva("px-(--cell-size) flex h-(--cell-size) w-full items-center justify-center")
const calendarDropdowns = cva("gap-1.5 text-sm font-medium flex h-(--cell-size) w-full items-center justify-center")
const calendarDropdownRoot = cva("rounded-(--cell-radius) relative")
const calendarWeekday = cva("rounded-(--cell-radius) text-sm font-normal flex-1 text-muted-foreground select-none")
const calendarWeekNumber = cva("text-sm text-muted-foreground select-none")
const calendarRangeStart = cva("rounded-l-(--cell-radius) relative isolate z-0 bg-muted after:absolute after:inset-y-0 after:end-0 after:w-4 after:bg-muted")
const calendarRangeMiddle = cva("rounded-none")
const calendarRangeEnd = cva("rounded-r-(--cell-radius) relative isolate z-0 bg-muted after:absolute after:inset-y-0 after:start-0 after:w-4 after:bg-muted")
const calendarToday = cva("rounded-(--cell-radius) data-[selected=true]:rounded-none bg-muted text-foreground")
const calendarButtonPrevious = cva("p-0 size-(--cell-size) select-none aria-disabled:opacity-50")
const calendarButtonNext = cva("p-0 size-(--cell-size) select-none aria-disabled:opacity-50")
const calendarCaptionLabel = cva("font-medium select-none", {
  variants: {
    layout: {
      label: "text-sm",
      dropdown:
        "gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 flex items-center [&>svg]:text-muted-foreground",
    },
  },
})
const calendarDay = cva(
  "rounded-(--cell-radius) p-0 [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius) group/day relative aspect-square h-full w-full text-center select-none",
  {
    variants: {
      weekNumber: {
        true: "[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)",
        false: "[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
      },
    },
  }
)

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()
  const captionLabelLayout = captionLayout === "label" ? "label" : "dropdown"

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "p-2 in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent [--cell-radius:0px] [--cell-size:--spacing(7)] pointer-coarse:[--cell-size:--spacing(11)] group/calendar bg-background",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(calendarMonths(), defaultClassNames.months),
        month: cn(calendarMonth(), defaultClassNames.month),
        nav: cn(calendarNav(), defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          calendarButtonPrevious(),
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          calendarButtonNext(),
          defaultClassNames.button_next
        ),
        month_caption: cn(calendarMonthCaption(), defaultClassNames.month_caption),
        dropdowns: cn(calendarDropdowns(), defaultClassNames.dropdowns),
        dropdown_root: cn(calendarDropdownRoot(), defaultClassNames.dropdown_root),
        dropdown: cn(
          "absolute inset-0 bg-popover opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          calendarCaptionLabel({ layout: captionLabelLayout }),
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(calendarWeekday(), defaultClassNames.weekday),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(calendarWeekNumber(), defaultClassNames.week_number),
        day: cn(
          calendarDay({ weekNumber: !!props.showWeekNumber }),
          defaultClassNames.day
        ),
        range_start: cn(calendarRangeStart(), defaultClassNames.range_start),
        range_middle: cn(calendarRangeMiddle(), defaultClassNames.range_middle),
        range_end: cn(calendarRangeEnd(), defaultClassNames.range_end),
        today: cn(calendarToday(), defaultClassNames.today),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon className={cn("size-4", className)} {...props} />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: ({ ...props }) => (
          <CalendarDayButton locale={locale} {...props} />
        ),
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      variant="ghost"
      size="icon"
      /* icon-label: 날짜 숫자가 보이는 글자이고, DayPicker 가 aria-label(날짜 전체)을 props 로 넘긴다 */
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "gap-1 border-0 leading-none font-normal data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) [&>span]:text-sm relative isolate after:inset-0 z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
