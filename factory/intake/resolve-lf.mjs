// launch-factory 위치 해석기 — 한 곳에서만 경로를 정한다.
//   순서: --lf 인자 → LF_DIR → <wfRoot>/launch-factory(공개 Sitebrew 저장소 배치) → <wfRoot>/../launch-factory(개발 PC 형제 배치).
//   후보는 features/outcomes.generated.json 이 있어야 채택한다. 못 찾으면 null.
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const TABLE_FILE = join('features', 'outcomes.generated.json')

export function resolveLf({ arg, env = process.env, wfRoot }) {
  return [arg, env.LF_DIR, join(wfRoot, 'launch-factory'), join(wfRoot, '..', 'launch-factory')]
    .filter(Boolean)
    .map((p) => resolve(p))
    .find((dir) => existsSync(join(dir, TABLE_FILE))) ?? null
}
