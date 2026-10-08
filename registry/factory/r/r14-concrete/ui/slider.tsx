import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "cn"
import { uiLabels, type UiLocale } from "@/registry/factory/r/r14-concrete/ui/locale-labels"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  getAriaLabel,
  locale,
  ...props
}: SliderPrimitive.Root.Props & { getAriaLabel?: (index: number) => string; locale?: UiLocale }) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max]

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      // Kept on the Root too (its own accessible-name path, e.g. a
      // group-level announcement) even though it doesn't reach the Thumb's
      // hidden input — see the Thumb note below.
      aria-label={ariaLabel}
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="data-vertical:min-h-40 relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="rounded-none data-horizontal:h-1 relative grow overflow-hidden bg-muted select-none data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            // Base UI puts the accessible name on each Thumb's own hidden native
            // input, not the Root — a Root-level aria-label never reaches it.
            // One thumb reuses the Root's label directly; two or more need a
            // name each (getAriaLabel(index)), so they don't all announce the
            // same thing.
            aria-label={_values.length === 1 ? ariaLabel : undefined}
            getAriaLabel={
              _values.length > 1
                ? (getAriaLabel ?? ((i: number) => `${ariaLabel ?? uiLabels(locale).sliderValue} ${i + 1}`))
                : undefined
            }
            className="size-3 rounded-none border hover:ring-3 active:ring-3 relative block shrink-0 border-ring bg-background ring-ring transition-[color] select-none after:absolute after:inset-y-[min(0px,calc((100%-44px)/2))] after:inset-x-[min(0px,calc((100%-44px)/2))] focus-visible:ring-3 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
