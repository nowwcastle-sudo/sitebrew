// 실행 폴더의 브리프 읽기 — 방향 보드(build.mjs)와 결선 기록(record.mjs)이 같이 쓴다.
// 찍어내기 실행은 브리프를 실행 폴더에 복사하지 않고, 지난 실행 요약(stamp-summary.json)의 `brief` 에 원본 파일 경로를 적는다.
// 그래서 먼저 그 경로를 읽고, 파일이 없거나 깨졌으면 <run>/brief.json(손으로 놓은 사본·시험 재료)을 읽는다. 둘 다 없으면 빈 객체.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const readJson = (file) => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

/** @param {string} runDir @returns {object} 브리프 객체(topic·archetype …) — 못 찾으면 {} */
export function readRunBrief(runDir) {
  const summary = existsSync(join(runDir, 'stamp-summary.json')) ? readJson(join(runDir, 'stamp-summary.json')) : null
  const fromSummary = typeof summary?.brief === 'string' && existsSync(summary.brief) ? readJson(summary.brief) : null
  if (fromSummary && typeof fromSummary === 'object') return fromSummary
  const local = existsSync(join(runDir, 'brief.json')) ? readJson(join(runDir, 'brief.json')) : null
  return local && typeof local === 'object' ? local : {}
}
