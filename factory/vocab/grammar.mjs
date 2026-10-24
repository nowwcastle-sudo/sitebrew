// 말본 데이터 로더: factory/vocab/grammar.yaml(조사·어미·군말·부정 낱말, 숫자, 사용자에게 보이는 글)을 읽어 모양(zod)을 검사한다.
//   normalize.mjs 와 interpret.mjs 가 이 한 곳에서 가져온다 — 낱말을 코드에 박지 않는다. 네트워크 없음.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { z } from 'zod'

export const GRAMMAR_FILE = join(dirname(fileURLToPath(import.meta.url)), 'grammar.yaml')

const words = z.array(z.string().min(1)).min(1)
const count = z.number().int().min(1)
const line = z.string().min(1)
const pair = z.strictObject({ ko: line, en: line })

const schema = z.strictObject({
  normalize: z.strictObject({ endings: words, fillers: words, minRest: count }),
  match: z.strictObject({
    designSuffixes: words, links: words, linkBlock: words, tails: words, gapOk: words, preNeg: words,
    doVerbStems: words, prohibitStems: words, prohibitNotBefore: words, prohibitWords: words, questionMarks: words, predicateEnds: words, negationWords: words, siteWords: words, lessWords: words, otherRoleWords: words,
    candidate: z.strictObject({ indexForms: words, bareForms: words, bareMarks: words, numberWords: z.record(z.string().min(1), count), previousWords: words, previousId: line }),
    fromTo: z.strictObject({ sourceMarks: words, targetMarks: words, togetherMarks: words, togetherWords: words, toWords: words }),
  }),
  limits: z.strictObject({ strengthMax: count, shortKeyMax: count, lostNegStrays: count, maxChoices: count }),
  text: z.strictObject({
    askNone: pair, askPick: pair, askUnknownReference: pair, undone: pair, undoneDetail: pair, staleNote: pair, nothingToUndo: pair, neitherAsk: pair, doubleNeg: pair, lostNeg: pair, clash: pair, copy: z.strictObject({ candidate: pair, previous: pair }), redrawn: pair, redrawNoRun: pair, redrawLimit: pair, candidateMissing: pair, candidateMixed: pair,
    scope: z.strictObject({ element: pair, section: pair, page: pair }),
    say: z.strictObject({ plain: pair, cap: pair }),
    step: z.strictObject({ atEnd: line, noPalette: line, noSafeChange: line, current: line, keep: line, counts: z.array(line).min(1), move: line, palette: line }),
    ask: z.strictObject({ siteWide: pair, otherRole: pair, oneKindAtATime: pair, oneAxisAtATime: pair, valueNegated: pair, boardStale: pair, redrawDrops: pair, intentUnclear: pair, valueCapped: pair }),
    compare: z.strictObject({ title: pair, now: pair, nowNote: pair, option: pair, changed: pair, change: pair, changeIn: pair, open: pair, swatchBefore: pair, swatchAfter: pair, axisFallback: pair, sectionFallback: pair, otherLayout: pair }),
    section: z.strictObject({ label: z.strictObject({ bolder: pair, calmer: pair, different: pair, spacious: pair, compact: pair }), few: pair, fewTotal: pair, none: pair, fewAllowed: pair }),
    value: z.strictObject({ mainColor: pair, mainColorShown: pair, pairDarker: pair, pairLighter: pair, fontBoth: pair, fontTitle: pair }),
    plan: z.strictObject({ onlyOne: line, noSection: line, nothing: line, colorTwo: line, sayReading: line, sayValue: line, amounts: z.array(line).min(1), copyTo: line, copyNothing: line, copyMissing: line, noPrevious: line, sayCopy: line, sayPrevious: line }),
  }),
}).refine((g) => g.text.step.counts.length >= g.limits.strengthMax, { path: ['text', 'step', 'counts'], message: 'limits.strengthMax 만큼의 칸 수 글이 있어야 한다' })
  .refine((g) => g.text.plan.amounts.length >= g.limits.strengthMax, { path: ['text', 'plan', 'amounts'], message: 'limits.strengthMax 만큼의 세기 말이 있어야 한다' })

/** @param {string} [path] 기본은 factory/vocab/grammar.yaml. 모양이 틀리면 던진다. */
export function loadGrammar(path = GRAMMAR_FILE) {
  const r = schema.safeParse(parse(readFileSync(path, 'utf8')))
  if (!r.success) throw new Error(`grammar.yaml 이 잘못됐다:\n- ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n- ')}`)
  return r.data
}

export const grammar = loadGrammar()

/** 요청 글의 언어 — 한글이 있거나 글이 없으면 ko, 아니면 en. */
export const langOf = (text) => (text && !/[가-힣]/.test(text) ? 'en' : 'ko')

/** 되묻는 글 한 쌍에서 요청 언어의 것. */
export const askIn = (pair, text) => pair[langOf(text)]
