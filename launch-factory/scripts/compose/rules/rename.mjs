// rename — 이름이 템플릿과 부딪히는 시안 파일을 다른 이름으로 가져가고, 가져온 시안 파일의 import 를 새 이름으로 고친다
// (시안 lib/ports.ts 의 makePorts → lib/site-ports.ts. 템플릿 lib/ports.ts 의 ports() 는 그대로)
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { copyFileTo, isTextFile } from "../lib.mjs"

export const id = "rename"

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")

export function run(state) {
  const renames = state.plan.filter((p) => p.rule.kind === "rename")
  for (const { file, rule } of renames) {
    if (existsSync(join(state.to, rule.to))) throw new Error(`rename 대상이 이미 있다: ${rule.to}`)
    copyFileTo(join(state.siteDir, file), join(state.to, rule.to))
    state.written.add(rule.to)
    state.copied.push(rule.to)
  }
  for (const { rule } of renames) {
    for (const { from, to } of rule.rewrite) {
      const spec = new RegExp(`(["'])${escape(from)}\\1`, "g")
      for (const rel of [...state.written].filter(isTextFile)) {
        const file = join(state.to, rel)
        const text = readFileSync(file, "utf8")
        const next = text.replace(spec, `$1${to}$1`)
        if (next !== text) writeFileSync(file, next)
      }
    }
  }
  return state
}
