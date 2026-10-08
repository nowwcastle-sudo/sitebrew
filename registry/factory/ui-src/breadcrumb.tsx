import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "cn"
import { uiLabels, type UiLocale } from "@/registry/factory/ui/locale-labels"
import { ChevronRight as ChevronRightIcon, MoreHorizontal as MoreHorizontalIcon } from "@/registry/factory/icons"

function Breadcrumb({ className, locale, ...props }: React.ComponentProps<"nav"> & { locale?: UiLocale }) {
  return (
    <nav
      aria-label={uiLabels(locale).breadcrumb}
      data-slot="breadcrumb"
      className={cn(className)}
      {...props}
    />
  )
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "cn-breadcrumb-list flex flex-wrap items-center wrap-break-word text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("cn-breadcrumb-item inline-flex items-center", className)}
      {...props}
    />
  )
}

function BreadcrumbLink({
  className,
  render,
  ...props
}: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        // WCAG 2.5.8: inline text links still need a 24px-tall hit area, not just 24px line-height.
        className: cn("cn-breadcrumb-link relative inline-flex items-center after:absolute after:inset-y-[min(0px,calc((100%-44px)/2))] after:inset-x-[min(0px,calc((100%-44px)/2))] transition-[color] hover:text-foreground", className),
      },
      props
    ),
    render,
    state: {
      slot: "breadcrumb-link",
    },
  })
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("cn-breadcrumb-page inline-flex items-center text-foreground", className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("cn-breadcrumb-separator", className)}
      {...props}
    >
      {children ?? (
        <ChevronRightIcon />
      )}
    </li>
  )
}

function BreadcrumbEllipsis({
  className,
  locale,
  ...props
}: React.ComponentProps<"span"> & { locale?: UiLocale }) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "cn-breadcrumb-ellipsis flex items-center justify-center",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon
      />
      <span className="sr-only">{uiLabels(locale).breadcrumbMore}</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
