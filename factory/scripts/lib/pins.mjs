// 이 저장소가 쓰는 외부 도구 버전의 단일 창구 — 루트 package.json 의 dependencies 가 주인이다.
// 다른 모듈은 숫자를 쓰지 않고 여기서 받는다. 버전을 올릴 때는 package.json 한 줄과 `npm run gen:all`.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const EXACT = /^\d+\.\d+\.\d+$/

// 정확한 x.y.z 가 아니면(^·~ 범위 포함) 던진다 — 범위의 하한을 읽다가 설치된 도구와 어긋나는 사고를 막는다.
export function exactPin(pkg, name) {
  const v = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]
  if (typeof v !== 'string' || !EXACT.test(v)) {
    throw new Error(`package.json dependencies.${name} 은 정확한 x.y.z 여야 한다(받은 값: ${JSON.stringify(v)}) — ^·~ 범위를 쓰지 않는다.`)
  }
  return v
}

export const SHADCN_VERSION = exactPin(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')), 'shadcn')

export const shadcnSpec = () => `shadcn@${SHADCN_VERSION}`
export const shadcnAddCommand = (item, ref, repo = 'nowwcastle-sudo/sitebrew') => `npx ${shadcnSpec()} add ${repo}/${item}#${ref} -y -o`
export const shadcnBuildCommand = (out) => `npx -y ${shadcnSpec()} build -o ${out}`
// 설치 명령 줄을 검사하는 정규식(ai/schemas.mjs) — 버전 점은 이스케이프한다.
export const shadcnAddPattern = () => new RegExp(`^npx ${shadcnSpec().replace(/\./g, '\\.')} add nowwcastle-sudo\\/sitebrew\\/[a-z0-9-]+#v\\d+\\.\\d+\\.\\d+ -y -o$`)
