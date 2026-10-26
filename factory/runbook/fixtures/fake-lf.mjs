// 런북 시험 재료(시험 전용 — 제품 코드는 부르지 않는다): 임시 launch-factory 폴더 · 실행 폴더 · 사용자 폴더.
//   makeLf(root, { data?, table?, noData? })  → <root>/lf  : features/outcomes.generated.json(작은 OutcomeTable, hash = 고정물 outcomesHash)
//                                                          + docs/runbook/runbook.generated.json(고정물)
//   makeRun(root, delivered?, name?)           → <root>/<name> : 실행 폴더(+ .sitebrew/delivered.json — 주면)
//   delivered(over)                            → Delivered(설계 6절) 한 벌
//   fakeKey()                                  → 키 모양 글자 — 런타임에 이어 붙인다(저장소에 완성된 글자가 남지 않게).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const DATA = JSON.parse(readFileSync(join(import.meta.dirname, 'runbook.generated.json'), 'utf8'))
export const TODAY = '2026-10-22'

const outcome = (id, order, over) => ({
  id, order, say: DATA.outcomes[id].say, question: DATA.outcomes[id].question,
  archetypes: ['saas'], parts: [], requires: [], closure: [], needs: [], guides: DATA.outcomes[id].guides, product: true, ...over,
})

/** 작은 결과 표 — payments 는 signup 을 요구한다(requires 닫기 시험). */
export const table = (over = {}) => ({
  version: 1,
  hash: DATA.outcomesHash,
  outcomes: [
    outcome('signup', 1, { parts: ['auth'], closure: ['db'] }),
    outcome('payments', 2, { parts: ['billing'], requires: ['signup'], closure: ['email'] }),
    outcome('push', 3, { parts: ['push'], product: false }),
  ],
  pages: [],
  routes: [],
  ...over,
})

const writeJson = (file, v) => {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, typeof v === 'string' ? v : `${JSON.stringify(v, null, 2)}\n`)
}

export function makeLf(root, { data = DATA, table: t = table(), noData = false } = {}) {
  const lf = join(root, 'lf')
  writeJson(join(lf, 'features', 'outcomes.generated.json'), t)
  if (!noData) writeJson(join(lf, 'docs', 'runbook', 'runbook.generated.json'), data)
  return lf
}

export const delivered = (over = {}) => ({
  version: 1, applied: ['signup', 'payments'], unapplied: [], completion: 'composed', locale: 'ko',
  tableHash: DATA.outcomesHash, deliveredAt: '2026-10-20T00:00:00.000Z', ...over,
})

export function makeRun(root, d, name = 'run') {
  const run = join(root, name)
  mkdirSync(run, { recursive: true })
  if (d) {
    writeJson(join(run, '.sitebrew', 'delivered.json'), d)
    writeFileSync(join(run, '.sitebrew', '.gitignore'), '*\n')
  }
  return run
}

export const fakeKey = () => ['sk', 'live', 'Qx7'.repeat(8)].join('_')
