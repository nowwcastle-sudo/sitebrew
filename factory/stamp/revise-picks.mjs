// 수정(09-revise)으로 고른 블록이 06 에서 조용히 되돌려지는지 대조한다(FIT-5) — 파일만 읽는 순수 모듈(gen-pages·revise 가 함께 쓴다, 서로를 부르지 않는다).
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

/** 구획 수정(section·add)으로 고른 블록 — 같은 구획을 여러 번 고쳤으면 가장 나중 번호의 것. 반환: { [구획 키]: { block, index } } */
export function pickedRevisionBlocks(candDir) {
  const dir = join(candDir, '09-revise')
  if (!existsSync(dir)) return {}
  const nums = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d+$/.test(e.name)).map((e) => Number(e.name)).sort((a, b) => a - b)
  const out = {}
  for (const index of nums) {
    const file = join(dir, String(index), 'board.json')
    if (!existsSync(file)) continue
    let board
    try { board = readJson(file) } catch { continue }
    const block = board?.picked?.block
    if (!block || (board.scope !== 'section' && board.scope !== 'add') || typeof board.target !== 'string') continue
    out[board.target] = { block, index }
  }
  return out
}

/** 제목이 길어 이 블록이 적용되지 않을 때 알려 줄 안내 — 한글은 1em 이라 상한(em)의 정수 부분이 한글 기준 글자 수다. */
export function titleOverAdvice({ units, max, text }) {
  const chars = Math.floor(max)
  return `지금 제목(「${text}」 ${units}em)이 길어 이 디자인은 적용되지 않아요 — 제목을 ${chars}자 이하(한글 기준)로 줄이면 됩니다`
}

/**
 * 수정으로 고른 블록이 06 폴백으로 바뀐 곳. 수정 기록(09-revise 의 고른 안)과 06 의 fallbacks 를 대조한다.
 * @param {string} candDir
 * @param {{ key: string, from: string, to: string, why: string, titleOver?: object }[]} fallbacks
 * @returns {{ key: string, block: string, to: string, why: string, index: number, line: string }[]}
 */
export function reviseFallbacks(candDir, fallbacks) {
  const picked = pickedRevisionBlocks(candDir)
  const out = []
  for (const f of fallbacks ?? []) {
    const p = picked[f.key]
    if (!p || p.block !== f.from) continue
    const line = `수정으로 고른 ${f.from} 이(가) 적용되지 않음: ${f.why}${f.titleOver ? ` — ${titleOverAdvice(f.titleOver)}` : ''} (실제로는 ${f.to} 로 그려진다 · 수정 ${p.index}번)`
    out.push({ key: f.key, block: f.from, to: f.to, why: f.why, index: p.index, line })
  }
  return out
}
