// scripts — 출력 package.json 에서 저장소 전용 스크립트를 뺀다. 목록은 rules.json 의 steps.scripts.remove
import { join } from "node:path"
import { readJson, writeJson } from "../lib.mjs"

export const id = "scripts"

export function run(state) {
  const file = join(state.to, "package.json")
  const pkg = readJson(file)
  const drop = new Set(state.rules.steps.scripts.remove)
  writeJson(file, { ...pkg, scripts: Object.fromEntries(Object.entries(pkg.scripts ?? {}).filter(([name]) => !drop.has(name))) })
  return state
}
