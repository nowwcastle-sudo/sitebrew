// mergeDeps — 템플릿 package.json 에 시안·레시피가 넣은 의존 가운데 템플릿에 없는 것만 더한다(template-sync.mjs 의 mergeDependencies 재사용).
// 더하는 판은 시안 package-lock.json 에 적힌 설치된 정확한 판이다(템플릿이 정확한 판으로 고정하는 규칙과 같다)
import { join } from "node:path"
import { readJson, writeJson } from "../lib.mjs"

export const id = "mergeDeps"

/** 출력에는 잠금 파일이 없다. 한 패키지가 다른 패키지의 하위로 같은 이름을 따로 받으면 판이 갈라지므로(@axe-core/playwright 가 새 playwright-core 를 끌어와 e2e 타입 검사가 깨진다) rules.json 의 align 대로 판을 맞춘다 */
function align(pkg, pairs) {
  const out = { ...pkg }
  for (const [name, like] of Object.entries(pairs)) {
    const section = ["dependencies", "devDependencies"].find((s) => out[s]?.[like])
    if (!section) throw new Error(`align: ${like} 가 package.json 에 없다`)
    out[section] = Object.fromEntries(Object.entries({ ...out[section], [name]: out[section][like] }).sort(([a], [b]) => a.localeCompare(b)))
  }
  return out
}

export function run(state, { mergeDependencies }) {
  for (const { rule } of state.plan.filter((p) => p.rule.kind === "mergeDeps" && p.file === p.rule.manifest)) {
    const target = join(state.to, rule.manifest)
    const lock = readJson(join(state.siteDir, rule.lock)).packages
    const exact = (name) => {
      const version = lock[`node_modules/${name}`]?.version
      if (!version) throw new Error(`${rule.lock} 에 ${name} 의 설치된 판이 없다`)
      return version
    }
    const merged = mergeDependencies(readJson(target), readJson(join(state.siteDir, rule.manifest)), exact)
    writeJson(target, align(merged, rule.align))
  }
  return state
}
