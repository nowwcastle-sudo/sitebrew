// lint-ui ui-src duplicate-hook fixture: cn-x sits in two cva slots, so the compiler fills only the first. Not compiled.
const a = cva("cn-x inline-flex", { variants: { size: { sm: "cn-x-size-sm" } } })
const b = cva("cn-x grid")
