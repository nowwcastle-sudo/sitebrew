// 세 검사를 한 번에 돌리고, 알려진 실패 목록(baseline)과 견준다(래칫).
import { checkActions } from "./actions.mjs"
import { checkEmailLinks } from "./email-links.mjs"
import { makeContext } from "./lib.mjs"
import { checkPromises } from "./promises.mjs"

export const keyOf = (f) => `${f.check}\u0000${f.target}`

export function analyze(root, config) {
  const ctx = makeContext(root, config.paths)
  const a = checkActions(ctx)
  const p = checkPromises(ctx, config)
  const e = checkEmailLinks(ctx, config)
  return {
    failures: [...a.failures, ...p.failures, ...e.failures],
    warnings: [...p.warnings, ...e.warnings],
    stats: { actionModules: a.scanned.modules, screens: a.scanned.screens, promisesPassed: p.passed.length, promisesTotal: (config.promises ?? []).length, emailLinks: e.checked.length },
  }
}

/** 실패 목록과 baseline 을 견준다. known = baseline 에 있고 지금도 실패 · added = 새 실패 · fixed = baseline 에 있는데 이제 통과 */
export function compare(failures, baseline) {
  const known = new Map(baseline.map((b) => [keyOf(b), b]))
  const now = new Set(failures.map(keyOf))
  return {
    known: failures.filter((f) => known.has(keyOf(f))).map((f) => ({ ...f, item: known.get(keyOf(f)).item })),
    added: failures.filter((f) => !known.has(keyOf(f))),
    fixed: baseline.filter((b) => !now.has(keyOf(b))),
  }
}

export function validateBaseline(list) {
  if (!Array.isArray(list)) throw new Error("baseline.json 은 배열이어야 한다")
  const seen = new Set()
  for (const b of list) {
    if (!b || typeof b.check !== "string" || typeof b.target !== "string" || typeof b.item !== "string" || !b.item) {
      throw new Error(`baseline 항목에는 check·target·item 이 모두 있어야 한다: ${JSON.stringify(b)}`)
    }
    if (seen.has(keyOf(b))) throw new Error(`baseline 에 같은 항목이 두 번 있다: ${b.check} ${b.target}`)
    seen.add(keyOf(b))
  }
}
