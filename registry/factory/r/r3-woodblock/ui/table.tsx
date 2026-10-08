"use client"

import * as React from "react"
import { cn } from "cn"

/** 표 캡션 글(TableCaption 또는 일반 caption 의 글자 자식) — 스크롤 칸의 이름으로 쓴다. 글이 아니면 undefined. */
function captionText(children: React.ReactNode): string | undefined {
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement(child) || (child.type !== TableCaption && child.type !== "caption")) continue
    const text = React.Children.toArray((child.props as { children?: React.ReactNode }).children)
      .filter((c) => typeof c === "string" || typeof c === "number")
      .join("")
      .trim()
    return text || undefined
  }
  return undefined
}

/**
 * 가로로 넘치는 표는 키보드로 움직일 수 있어야 한다(WCAG 2.1.1) — 스크롤 칸(table-container)이 tabIndex={0} + role="region" + 이름을 가진다.
 * 이름 = label prop → 없으면 표 캡션 글. 이름을 알 수 없으면 role 은 달지 않는다(이름 없는 region 은 랜드마크가 아니다).
 * 넘치지 않을 때도 항상 준다(서버가 넘침을 알 수 없고, 서버·클라이언트 렌더가 같아야 한다). 초점 링은 scroll-area 와 같은 규칙이고 안쪽(inset)이라 부모가 잘라도 보인다.
 */
function Table({ className, label, children, ...props }: React.ComponentProps<"table"> & { label?: string }) {
  const name = label ?? captionText(children)
  return (
    <div
      data-slot="table-container"
      tabIndex={0}
      role={name ? "region" : undefined}
      aria-label={name}
      className="relative w-full overflow-x-auto outline-hidden focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-1"
    >
      <table
        data-slot="table"
        className={cn("text-[15px] tabular-nums w-full caption-bottom", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t font-semibold [&>tr]:last:border-b-0 bg-muted/50",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-3 text-sm font-semibold [&:has([role=checkbox])]:pe-0 text-left align-middle whitespace-nowrap text-foreground",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-9 px-3 py-0 [&:has([role=checkbox])]:pe-0 align-middle whitespace-nowrap",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-sm mt-[var(--table-caption-gap,1rem)] text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
