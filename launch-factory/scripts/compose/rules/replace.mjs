// replace — 시안 것이 이긴다. 같은 경로의 템플릿 파일을 덮고, 규칙의 replaces 에 적힌 템플릿 파일(같은 일을 하는 다른 이름)은 지운다
import { rmSync } from "node:fs"
import { join } from "node:path"
import { copyFileTo } from "../lib.mjs"

export const id = "replace"

export function run(state) {
  for (const { file, rule } of state.plan.filter((p) => p.rule.kind === "replace")) {
    for (const gone of rule.replaces ?? []) {
      rmSync(join(state.to, gone), { force: true })
      state.removed.push(gone)
    }
    copyFileTo(join(state.siteDir, file), join(state.to, file))
    state.written.add(file)
    state.copied.push(file)
  }
  return state
}
