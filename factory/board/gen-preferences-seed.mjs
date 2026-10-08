// 선택 학습 씨앗 생성(factory v1 Task 4.4 · D14 「운영자 선택이 기본 가중치의 씨앗」).
//   node factory/board/gen-preferences-seed.mjs [--check]
//   입력: factory/board/pairs.jsonl(결선 짝 — 이긴 쪽 승·진 쪽 패, 원형별) + factory/board/recipe-decisions.json(레시피 보드의 축 판정 — 고른 값 승·고르지 않은 값 패, 「*」 칸).
//   레시피 보드 2·3판의 좋다/별로(recipe-board2·3-decisions.json)는 쓰지 않는다 — 열 레시피가 전부 「좋다」라서 가르는 정보가 없다.
//   출력: factory/board/preferences.seed.json — 날짜를 넣지 않아 입력이 같으면 글이 같다. --check 는 파일이 지금 입력으로 만든 것과 같은지만 본다(0 같음 · 1 다름 · 2 입력 오류).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ANY_ARCHETYPE, SEED_FILE } from './preferences.mjs'

export { SEED_FILE }
const DIR = dirname(fileURLToPath(import.meta.url))
export const PAIRS_FILE = join(DIR, 'pairs.jsonl')
export const DECISIONS_FILE = join(DIR, 'recipe-decisions.json')

const other = (v) => (v === 'A' ? 'B' : v === 'B' ? 'A' : null)

/** 순수 함수 — 입력(짝 배열·레시피 보드 판정 객체)에서 씨앗 객체를 만든다. */
export function buildSeed({ pairs, decisions }) {
  const counts = {}
  const bump = (arch, variant, field) => {
    const c = ((counts[arch] ??= {})[variant] ??= { win: 0, loss: 0 })
    c[field]++
  }
  for (const [i, p] of pairs.entries()) {
    if (!p.archetype || !p.a || !p.b || (p.winner !== 'a' && p.winner !== 'b')) throw new Error(`pairs ${i + 1}번째 줄이 모양이 맞지 않는다: ${JSON.stringify(p).slice(0, 120)}`)
    const [win, lose] = p.winner === 'a' ? [p.a, p.b] : [p.b, p.a]
    bump(p.archetype, win, 'win')
    bump(p.archetype, lose, 'loss')
  }
  for (const d of decisions?.decisions ?? []) {
    for (const [axis, v] of Object.entries(d.axisPicks ?? {})) {
      const o = other(v)
      if (!o) continue
      bump(ANY_ARCHETYPE, `${axis}:${v}`, 'win')
      bump(ANY_ARCHETYPE, `${axis}:${o}`, 'loss')
    }
  }
  const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]))
  const sorted = Object.fromEntries(Object.keys(counts).sort().map((a) => [a, sortObj(counts[a])]))
  return { version: 1, counts: sorted }
}

export function readInputs({ pairsFile = PAIRS_FILE, decisionsFile = DECISIONS_FILE } = {}) {
  const pairs = readFileSync(pairsFile, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l, i) => {
    try { return JSON.parse(l) } catch (e) { throw new Error(`${pairsFile} ${i + 1}번째 줄이 JSON 이 아니다: ${e.message}`) }
  })
  const decisions = existsSync(decisionsFile) ? JSON.parse(readFileSync(decisionsFile, 'utf8')) : { decisions: [] }
  return { pairs, decisions }
}

export const seedText = (inputs = readInputs()) => JSON.stringify(buildSeed(inputs), null, 2) + '\n'

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const text = seedText()
    if (process.argv.includes('--check')) {
      const same = existsSync(SEED_FILE) && readFileSync(SEED_FILE, 'utf8') === text
      console.log(same ? '씨앗이 입력과 같다' : '씨앗이 낡았다 — node factory/board/gen-preferences-seed.mjs')
      process.exitCode = same ? 0 : 1
    } else {
      writeFileSync(`${SEED_FILE}.tmp`, text)
      renameSync(`${SEED_FILE}.tmp`, SEED_FILE)
      console.log(`쓴 파일 ${SEED_FILE}`)
    }
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    process.exitCode = 2
  }
}
