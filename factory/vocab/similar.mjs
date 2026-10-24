// 비슷한 예문 찾기(설계 5.11). 사전 낱말이 하나도 안 맞은 문장을 예문 묶음과 글자 겹침으로 견준다.
//   겹침 = 정규화한 붙여쓴 글자(normalize.compact)의 두 글자 조각 집합끼리의 Jaccard.
//   기준값(minScore)과 후보 수(topK)는 similar.json 에 있다. 예문 묶음은 부르는 쪽이 넘긴다 — 순수 함수, 네트워크·파일 읽기 없음(설정 읽기만 loadSimilarConfig).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalize } from './normalize.mjs'

const SIMILAR_FILE = join(dirname(fileURLToPath(import.meta.url)), 'similar.json')

/** @returns {{ minScore: number, topK: number }} */
export function loadSimilarConfig(path = SIMILAR_FILE) {
  const { minScore, topK } = JSON.parse(readFileSync(path, 'utf8'))
  if (!(minScore > 0 && minScore <= 1) || !Number.isInteger(topK) || topK < 1) throw new Error(`similar.json 값이 잘못됐다: minScore ${minScore} · topK ${topK}`)
  return { minScore, topK }
}

function bigrams(text) {
  const c = normalize(text).compact
  const out = new Set()
  for (let i = 0; i + 1 < c.length; i++) out.add(c.slice(i, i + 2))
  return out
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let both = 0
  for (const x of a) if (b.has(x)) both++
  return both / (a.size + b.size - both)
}

/**
 * @param {string} text 사용자의 문장
 * @param {{ id: string, text: string, kind: string, lead: object }[]} examples 예문 묶음
 * @param {{ minScore: number, topK: number }} cfg
 * @returns {{ id: string, score: number, kind: string, lead: object }[]} 겹침이 큰 순서. minScore 미만은 뺀다.
 */
export function nearest(text, examples, cfg) {
  const q = bigrams(text)
  return examples
    .map((e, i) => ({ e, i, score: jaccard(q, bigrams(e.text)) }))
    .filter((x) => x.score >= cfg.minScore)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, cfg.topK)
    .map(({ e, score }) => ({ id: e.id, score, kind: e.kind, lead: e.lead }))
}
