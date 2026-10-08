// lint-ui ui-src bad fixture: shape classes left inline beat the hook. Not compiled.
const a = cn("cn-card rounded-xl flex")
const b = cva("cn-x inline-flex", { variants: { size: { sm: "cn-x-size-sm h-8 px-3" } } })
