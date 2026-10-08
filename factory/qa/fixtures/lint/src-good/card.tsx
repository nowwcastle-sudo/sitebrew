// lint-ui ui-src good fixture: shape lives in cn-* hooks, rules stay inline. Not compiled.
const a = cn("cn-card flex flex-col bg-card focus-visible:ring-3 focus-visible:ring-ring after:absolute after:-inset-2.5")
const b = cva("cn-x inline-flex", { variants: { size: { sm: "cn-x-size-sm" } } })
