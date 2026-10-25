// 이 저장소가 쓰는 shadcn CLI 판의 단일 창구 — template/package.json 의 devDependencies 가 주인이다.
// 다른 모듈은 판 숫자를 쓰지 않고 여기서 받는다. 판을 올릴 때 고치는 곳은 template/package.json 한 줄이고,
// 나머지(template.lock.json blocks.shadcn · package-lock.json)는 scripts/test/shadcn-pin.test.mjs 가 어긋남을 잡는다.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const TEMPLATE_PACKAGE = fileURLToPath(new URL("../template/package.json", import.meta.url))
const EXACT = /^\d+\.\d+\.\d+$/

/** 정확한 x.y.z 가 아니면(^·~ 범위 포함) 던진다 — 범위의 하한을 읽다가 설치된 도구와 어긋나는 사고를 막는다 */
export function exactPin(pkg, name) {
  const v = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]
  if (typeof v !== "string" || !EXACT.test(v)) {
    throw new Error(`template/package.json 의 ${name} 은 정확한 x.y.z 여야 한다(받은 값: ${JSON.stringify(v)}) — ^·~ 범위를 쓰지 않는다.`)
  }
  return v
}

export const SHADCN = exactPin(JSON.parse(readFileSync(TEMPLATE_PACKAGE, "utf8")), "shadcn")
export const shadcnSpec = () => `shadcn@${SHADCN}`
