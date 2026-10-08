import * as React from "react"
import { cn } from "cn"
import { uiLabels, type UiLocale } from "@/registry/factory/r/r14-concrete/ui/locale-labels"

import { Button } from "@/registry/factory/r/r14-concrete/ui/button"
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, MoreHorizontal as MoreHorizontalIcon } from "@/registry/factory/icons/lucide"

function Pagination({ className, locale, ...props }: React.ComponentProps<"nav"> & { locale?: UiLocale }) {
  return (
    <nav
      role="navigation"
      aria-label={uiLabels(locale).paginationNav}
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("gap-0.5 flex items-center", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <Button
      variant={isActive ? "outline" : "ghost"}
      size={size}
      /* icon-label: 쪽 번호 글자가 children 으로 온다 — 이전·다음은 PaginationPrevious·Next 가 aria-label 을 단다 */
      className={cn(className)}
      nativeButton={false}
      render={
        <a
          aria-current={isActive ? "page" : undefined}
          data-slot="pagination-link"
          data-active={isActive}
          {...props}
        />
      }
    />
  )
}

function PaginationPrevious({
  className,
  text,
  locale,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string; locale?: UiLocale }) {
  return (
    <PaginationLink
      aria-label={uiLabels(locale).paginationPrevAria}
      size="default"
      className={cn("ps-1.5!", className)}
      {...props}
    >
      <ChevronLeftIcon data-icon="inline-start" />
      <span className="hidden sm:block">{text ?? uiLabels(locale).paginationPrev}</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  text,
  locale,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string; locale?: UiLocale }) {
  return (
    <PaginationLink
      aria-label={uiLabels(locale).paginationNextAria}
      size="default"
      className={cn("pe-1.5!", className)}
      {...props}
    >
      <span className="hidden sm:block">{text ?? uiLabels(locale).paginationNext}</span>
      <ChevronRightIcon data-icon="inline-end" />
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  locale,
  ...props
}: React.ComponentProps<"span"> & { locale?: UiLocale }) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "size-8 [&_svg:not([class*='size-'])]:size-4 flex items-center justify-center",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon
      />
      <span className="sr-only">{uiLabels(locale).paginationMore}</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
