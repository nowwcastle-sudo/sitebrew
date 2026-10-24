// envLocal — 출력의 .env.local 은 가짜 모드 한 줄뿐이다. 진짜 키는 한 개도 넣지 않는다(내용은 rules.json 의 steps.envLocal)
import { writeFileSync } from "node:fs"
import { join } from "node:path"

export const id = "envLocal"

export function run(state) {
  const { file, lines } = state.rules.steps.envLocal
  writeFileSync(join(state.to, file), `${lines.join("\n")}\n`)
  return state
}
