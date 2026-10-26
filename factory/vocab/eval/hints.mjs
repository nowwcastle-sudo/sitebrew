// 눈가림 분류기에게 줄 힌트 파일(설계 7.2 출시 관문). 시험 문장마다 사전의 classify 결과를 힌트로 붙인다.
//   한 줄: { id, text, hint }  hint = { result, kind?, lead?, readings | choices | nearest }  — 줄의 정답(expect)·갈래·페르소나·probe 는 읽지도 쓰지도 않는다.
//   예문은 score.mjs 와 같은 헬퍼를 쓴다(dev 는 자기 줄을 뺀 leave-one-out, holdout 은 dev 전체). 분류기가 이 힌트를 어떻게 쓰는지는 CLASSIFIER.md.
//   사용: npm run vocab:hints -- --set <dev|holdout> [--out <파일>]   기본 출력은 out/vocab-hints-<set>.jsonl
//   CLASSIFIER.md 의 범위 목록은 사전(scopesOf)에서 만든다: npm run vocab:hints -- --write-sheet 로 다시 쓰고, 시험이 어긋남을 잡는다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLexicon, scopesOf } from '../lexicon.mjs'
import { loadSimilarConfig } from '../similar.mjs'
import { OUT_DIR, SETS, classifyCase, flagValue, loadCases, loadExamples, setFile } from './score.mjs'

const EVAL_DIR = dirname(fileURLToPath(import.meta.url))

export const SHEET_FILE = join(EVAL_DIR, 'CLASSIFIER.md')
const SCOPE_BLOCK = /(<!-- scopes:start -->)[\s\S]*?(<!-- scopes:end -->)/

/** 지시서 글의 범위 목록 자리(표시 사이)를 사전의 범위 id 로 채운다. */
export const renderSheet = (text, lex) => text.replace(SCOPE_BLOCK, (_, start, end) => [start, scopesOf(lex).map((s) => `\`${s}\``).join(' '), end].join('\n'))

export const defaultOut = (set) => join(OUT_DIR, `vocab-hints-${set}.jsonl`)

/** classify 결과 → 힌트. 근사 후보는 예문의 글을 붙여 분류기가 원문과 견주게 한다. */
function hintOf(r, textOf) {
  if (r.result === 'confirmed') return { result: r.result, kind: r.kind, lead: r.lead, readings: r.readings }
  if (r.result === 'two') return { result: r.result, kind: r.kind, lead: r.lead, choices: r.options.map(({ lead, readings }) => ({ lead, readings })) }
  if (r.result === 'near') return { result: r.result, kind: r.kind, lead: r.lead, nearest: r.nearest.map((n) => ({ text: textOf.get(n.id), kind: n.kind, lead: n.lead, score: n.score })) }
  return { result: r.result }
}

/** CLI 본체(종료 코드를 돌려준다). opts: { dir: eval 폴더, lex, log } */
export function run(args, { dir: dir0 = EVAL_DIR, lex = loadLexicon(), log = console.log } = {}) {
  if (args.includes('--write-sheet')) {
    writeFileSync(SHEET_FILE, renderSheet(readFileSync(SHEET_FILE, 'utf8'), lex))
    log(`지시서의 범위 목록을 다시 썼어요: ${SHEET_FILE}`)
    return 0
  }
  const dir = flagValue(args, '--dir') ?? dir0
  const set = flagValue(args, '--set')
  if (!SETS.includes(set)) { log(`--set 이 필요해요: ${SETS.join('|')}`); return 2 }
  const file = join(dir, setFile(set))
  if (!existsSync(file)) { log(`시험 파일이 없어요: ${file}`); return 2 }
  const out = flagValue(args, '--out') ?? defaultOut(set)
  const examples = loadExamples(dir)
  const cfg = loadSimilarConfig()
  const textOf = new Map(examples.map((e) => [e.id, e.text]))
  const lines = loadCases(file).map((c) => JSON.stringify({ id: c.id, text: c.text, hint: hintOf(classifyCase(c, lex, examples, cfg), textOf) }))
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, lines.join('\n') + '\n')
  log(`힌트 ${lines.length}줄 → ${out}`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = run(process.argv.slice(2))
