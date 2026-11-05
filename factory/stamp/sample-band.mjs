// 예시 띠·법정 초안·JSON-LD 가 쓰는 「예시 값 찾기」(v0.2.6 T18 · 설계 D5~D6, P2 F6).
//   run 폴더의 sample-facts.json(T5 — sample-facts.mjs 가 만든다)에 든 값이 사이트 콘텐츠에 글자 그대로 남아 있는지 본다.
//   · sample-facts.mjs 를 import 하지 않는다: 그 모듈은 06 코드 열쇠 밖이고(brief·content 를 읽는다), 06 은 파일 모양(version 1 · facts 문자열 표)만 믿는다.
//   · 값이 같은 글자인 칸만 예시 유래로 본다. 실제 값을 답한 사실은 값이 달라 걸리지 않는다 — 그래서 05·04 를 다시 돌리지 않아도 「지금 남은 예시」가 바로 센다.
//   · 6자 미만 값(열거형 buyer 같은 것)은 우연히 같을 수 있어 뺀다 — deliver 값 스캔의 scan:false 와 같은 뜻.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SAMPLE_FILE_NAME = 'sample-facts.json'
const MIN_LEN = 6

/** 예시 파일의 { 키: 값 } 표. 파일이 없거나 모양이 틀리면 null. */
export function readSampleTable(runDir) {
  const file = join(runDir, SAMPLE_FILE_NAME)
  if (!existsSync(file)) return null
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    if (!data || data.version !== 1 || !data.facts || typeof data.facts !== 'object') return null
    const table = Object.fromEntries(Object.entries(data.facts).filter(([, v]) => typeof v === 'string' && v.trim().length >= MIN_LEN).map(([k, v]) => [k, v.trim()]))
    return { label: typeof data.label === 'string' ? data.label : '', table }
  } catch { return null }
}

const walk = (node, path, visit) => {
  if (typeof node === 'string') return visit(node, path)
  if (Array.isArray(node)) return node.forEach((x, i) => walk(x, [...path, i], visit))
  if (node && typeof node === 'object') for (const [k, x] of Object.entries(node)) walk(x, [...path, k], visit)
}

/** 콘텐츠 값 중 예시 값과 글자 그대로 같은 칸의 경로(점 표기). 같은 경로는 한 번. */
export function samplePaths(content, table) {
  const values = new Set(Object.values(table))
  const out = []
  walk(content, [], (text, path) => { if (values.has(text.trim())) out.push(path.join('.')) })
  return out
}

/** 지금 콘텐츠에 값이 남아 있는 예시 키 — 띠가 세는 개수. 04 문구에 옮겨 적은 글(`slots`)과 쪽·섹션 props 도 훑는다(값 스캔은 글자 그대로 찾기). */
export function remainingKeys(haystack, table) {
  const text = typeof haystack === 'string' ? haystack : JSON.stringify(haystack)
  return Object.entries(table).filter(([, value]) => text.includes(value)).map(([key]) => key)
}

/** 받은 값을 바꾸지 않고, 예시 값과 같은 글자인 칸을 replacement 로 바꾼 사본. */
export function blankSamples(node, table, replacement) {
  const values = new Set(Object.values(table))
  const go = (n) => {
    if (typeof n === 'string') return values.has(n.trim()) ? replacement : n
    if (Array.isArray(n)) return n.map(go)
    if (n && typeof n === 'object') return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, go(v)]))
    return n
  }
  return go(node)
}
