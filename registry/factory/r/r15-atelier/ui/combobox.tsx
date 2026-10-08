"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"
import { uiLabels, type UiLocale } from "@/registry/factory/r/r15-atelier/ui/locale-labels"

import { Button } from "@/registry/factory/r/r15-atelier/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/registry/factory/r/r15-atelier/ui/input-group"
import { ChevronDown as ChevronDownIcon, X as XIcon, Check as CheckIcon } from "@/registry/factory/icons/lucide"

const Combobox = ComboboxPrimitive.Root

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />
}

function ComboboxTrigger({
  className,
  children,
  // Whether `children` render visible text. Plain string/number children are
  // detected; element children that render text (e.g. <ComboboxValue />,
  // <span>…</span>) can't be seen from here, so the caller passes
  // hasVisibleText for those.
  hasVisibleText = (typeof children === "string" && children.trim() !== "") ||
    typeof children === "number",
  "aria-label": ariaLabelProp,
  locale,
  ...props
}: ComboboxPrimitive.Trigger.Props & { hasVisibleText?: boolean; locale?: UiLocale }) {
  // WCAG 4.1.2 / 2.5.3: with no visible text (no children, or icon-only
  // children) the trigger still needs a name, so fall back to "목록 열기".
  // With visible text, don't override it by a label that doesn't contain it
  // (Label in Name) — let the text name the button.
  const ariaLabel = ariaLabelProp ?? (hasVisibleText ? undefined : uiLabels(locale).comboboxOpen)
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      aria-label={ariaLabel}
      className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-4 pointer-events-none text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  )
}

function ComboboxClear({ className, locale, ...props }: ComboboxPrimitive.Clear.Props & { locale?: UiLocale }) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      aria-label={uiLabels(locale).comboboxClear}
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(className)}
      {...props}
    >
      <XIcon className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  )
}

function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean
  showClear?: boolean
}) {
  return (
    <InputGroup className={cn("w-auto", className)}>
      <ComboboxPrimitive.Input
        render={<InputGroupInput disabled={disabled} />}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            /* icon-label: render 로 그리는 ComboboxTrigger 가 보이는 글자가 없으면 「목록 열기」를 단다 */
            variant="ghost"
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="data-pressed:bg-transparent group-has-data-[slot=combobox-clear]/input-group:hidden"
            disabled={disabled}
          />
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  )
}

function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={!!anchor}
          className={cn("rounded-[14px] ring-1 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none [--sh:color-mix(in_oklch,var(--background),black_72%)] shadow-[0px_1px_2px_color-mix(in_oklch,var(--sh)_12%,transparent),1px_2px_4px_color-mix(in_oklch,var(--sh)_10%,transparent),1px_4px_8px_color-mix(in_oklch,var(--sh)_8%,transparent),2px_8px_16px_color-mix(in_oklch,var(--sh)_6%,transparent),4px_16px_32px_color-mix(in_oklch,var(--sh)_4%,transparent)] group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden bg-popover text-popover-foreground ring-foreground/10 duration-(--duration-popover,160ms) data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-start-2 data-[side=inline-start]:slide-in-from-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:border-input/30 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "p-1 data-empty:p-0 no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain",
        className
      )}
      {...props}
    />
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "gap-2 rounded-[12px] py-1 pe-8 ps-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 pointer-coarse:min-h-11 min-h-[24px] relative flex w-full cursor-default items-center outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="size-4 pointer-events-none absolute end-2 flex items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn(className)}
      {...props}
    />
  )
}

function ComboboxLabel({
  className,
  ...props
}: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn("px-2 py-1.5 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return (
    <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "py-2 text-sm hidden w-full justify-center text-center text-muted-foreground group-data-empty/combobox-content:flex",
        className
      )}
      {...props}
    />
  )
}

function ComboboxSeparator({
  className,
  ...props
}: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("h-px -mx-1 my-1 bg-border", className)}
      {...props}
    />
  )
}

function ComboboxChips({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
  ComboboxPrimitive.Chips.Props) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "min-h-8 gap-1 rounded-[14px] border bg-transparent px-2.5 py-1 text-sm has-data-[slot=combobox-chip]:px-1 dark:bg-input/30 flex flex-wrap items-center border-input bg-clip-padding transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-aria-invalid:focus-within:ring-ring dark:has-aria-invalid:focus-within:ring-ring dark:has-aria-invalid:border-destructive dark:has-aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  locale,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean
  locale?: UiLocale
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "gap-1 rounded-[12px] px-1.5 text-sm font-medium has-data-[slot=combobox-chip-remove]:pe-0 flex h-[calc(--spacing(5.25))] w-fit items-center justify-center bg-muted whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          aria-label={uiLabels(locale).comboboxChipRemove}
          render={<Button variant="ghost" size="icon-xs" />}
          className="-ms-1 opacity-50 hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  )
}

function ComboboxChipsInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn("min-w-16 flex-1 outline-hidden pointer-coarse:min-h-11", className)}
      {...props}
    />
  )
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
}
