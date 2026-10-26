// 기능 질문·features.json — launch-factory 결과 표(OutcomeTable)에서 예/아니요 질문을 만들고 고른 기능을 실행 폴더에 적는다.
//   문장은 표(question.ko/en)에서 온다. 여기에는 사용자 문장이 없다.
//   판정 순서: features.json 이 있고 table hash 가 맞으면 isProduct 가 원형 completion 보다 앞선다(아니면 null → 호출 쪽이 completion 을 쓴다).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { TABLE_FILE } from './resolve-lf.mjs'

export const FEATURES_FILE = 'features.json'
export const TABLE_VERSION = 1

// 표는 launch-factory 가 쓰고 compose-product 가 읽는 한 모양이다(plan 「공통 모양」) — 여기서 칸을 빠뜨리면 검사된 값을 넘겨 받는 얹기 엔진이 깨진다(closure 가 빠져 turnedOn 이 던졌다).
// 그래서 모든 칸을 적고, 모르는 새 칸도 지우지 않는다(looseObject).
const Outcome = z.looseObject({
  id: z.string(),
  order: z.number(),
  say: z.object({ ko: z.string(), en: z.string() }),
  question: z.object({ ko: z.string(), en: z.string() }),
  archetypes: z.array(z.string()),
  parts: z.array(z.string()),
  requires: z.array(z.string()),
  closure: z.array(z.string()),
  needs: z.array(z.string()),
  guides: z.array(z.string()),
  product: z.boolean(),
})
const PageOwner = z.looseObject({ file: z.string(), url: z.string(), owners: z.array(z.string()) })
const RouteOwner = z.looseObject({ file: z.string(), url: z.string(), owners: z.array(z.string()), cron: z.boolean() })
const OutcomeTable = z.looseObject({
  version: z.literal(TABLE_VERSION),
  hash: z.string(),
  outcomes: z.array(Outcome),
  pages: z.array(PageOwner),
  routes: z.array(RouteOwner),
})
const Features = z.object({ version: z.literal(TABLE_VERSION), table: z.string(), outcomes: z.array(z.string()) })

const unique = (xs) => [...new Set(xs)]
const byOrder = (a, b) => a.order - b.order

/** JSON 파일을 읽어 스키마로 검사한다. 읽기·파싱·모양 어느 오류에든 파일 경로를 붙인다. */
function readChecked(file, schema) {
  let raw
  try { raw = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { throw new Error(`${file}: ${e.message}`, { cause: e }) }
  const r = schema.safeParse(raw)
  if (!r.success) throw new Error(`${file}: ${z.prettifyError(r.error)}`)
  return r.data
}

/** 표의 version 칸이 이 코드가 아는 값(TABLE_VERSION)과 다르다 — 모양 오류와 구별해서 deliver 가 옛 경로 + 안내로 간다. */
export class TableVersionError extends Error {
  name = 'TableVersionError'
}

export function loadOutcomes(lfDir) {
  const file = join(lfDir, TABLE_FILE)
  try { return readChecked(file, OutcomeTable) } catch (e) {
    let version
    try { version = JSON.parse(readFileSync(file, 'utf8'))?.version } catch { /* 읽기·파싱 오류는 아래에서 그대로 던진다 */ }
    if (version !== undefined && version !== TABLE_VERSION) throw new TableVersionError(e.message, { cause: e })
    throw e
  }
}

/** 원형에 물을 수 있는 질문 — 표 순서대로 앞 limit 개. */
export function featureQuestionsFor(archetype, table, { limit }) {
  return table.outcomes
    .filter((o) => o.archetypes.includes(archetype))
    .sort(byOrder)
    .slice(0, limit)
    .map((o) => ({ id: o.id, ko: o.question.ko, en: o.question.en }))
}

/** 고른 id 에서 requires 를 끝까지 따라 닫은 집합 — 표 order 순. 표에 없는 id 는 던진다. */
function closeRequires(chosen, table) {
  const byId = new Map(table.outcomes.map((o) => [o.id, o]))
  const seen = new Set()
  const visit = (id) => {
    if (seen.has(id)) return
    const o = byId.get(id)
    if (!o) throw new Error(`unknown outcome id in requires: ${id}`)
    seen.add(id)
    o.requires.forEach(visit)
  }
  chosen.forEach(visit)
  return table.outcomes.filter((o) => seen.has(o.id)).sort(byOrder).map((o) => o.id)
}

export function toFeatures(answers, table) {
  const known = new Set(table.outcomes.map((o) => o.id))
  const stray = Object.keys(answers).filter((k) => !known.has(k))
  if (stray.length) throw new Error(`unknown answer key: ${stray.join(', ')}`)
  const chosen = Object.keys(answers).filter((k) => answers[k] === true)
  return { version: TABLE_VERSION, table: table.hash, outcomes: closeRequires(chosen, table) }
}

export function describeFeatures(features, table, { loopSteps }) {
  const picked = new Set(features.outcomes)
  const outcomes = table.outcomes.filter((o) => picked.has(o.id)).sort(byOrder)
  return {
    product: outcomes.some((o) => o.product),
    outcomes,
    needs: unique(outcomes.flatMap((o) => o.needs)).sort(),
    guides: unique(outcomes.flatMap((o) => o.guides)).sort(),
    loop: outcomes.map((o) => o.id).filter((id) => id in loopSteps),
  }
}

/** features.json 이 표와 맞으면 제품형 여부(true/false), 없거나 hash 가 다르면 null. features 는 readFeatures/toFeatures 가 낸 검사된 값이다. */
export function isProduct(features, table) {
  if (!features || features.table !== table.hash) return null
  return describeFeatures(features, table, { loopSteps: {} }).product
}

export function writeFeatures(runDir, features) {
  mkdirSync(runDir, { recursive: true })
  writeFileSync(join(runDir, FEATURES_FILE), `${JSON.stringify(features, null, 2)}\n`)
}

export function readFeatures(runDir) {
  const file = join(runDir, FEATURES_FILE)
  return existsSync(file) ? readChecked(file, Features) : null
}
