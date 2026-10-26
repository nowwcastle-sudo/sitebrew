// copy — 시안 파일을 더한다. 템플릿에 같은 경로가 없거나 내용이 똑같을 때만 쓴다. 내용이 다르면 규칙이 틀린 것이라 목록으로 던진다
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { copyFileTo } from "../lib.mjs"

export const id = "copy"

export function run(state) {
  const clashes = []
  for (const { file } of state.plan.filter((p) => p.rule.kind === "copy")) {
    const target = join(state.to, file)
    const source = join(state.siteDir, file)
    if (existsSync(target)) {
      if (!readFileSync(target).equals(readFileSync(source))) clashes.push(file)
      continue
    }
    copyFileTo(source, target)
    state.written.add(file)
    state.copied.push(file)
  }
  if (clashes.length) throw new Error(`copy 규칙인데 템플릿에 다른 내용의 같은 경로가 있다 ${clashes.length}개 (keep 이나 replace 로 정한다):\n  ${clashes.join("\n  ")}`)
  return state
}
