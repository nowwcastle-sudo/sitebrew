import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { STEPS } from "../ci/verify.mjs"

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))

test("ci:verify has a runbook step and it runs the generated-file check before the cross check", () => {
  assert.ok(STEPS.some((s) => s.id === "runbook"))
  const script = pkg.scripts["runbook:verify"]
  const [gen, cross] = script.split("&&").map((x) => x.trim())
  assert.match(gen, /runbook\.mjs gen --check$/)
  assert.match(cross, /runbook\.mjs check$/, "strict: no --partial once every outcome has its chapters")
})
