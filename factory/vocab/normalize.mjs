// 사전 맞추기용 정규화(설계 5.8): 띄어쓰기 없는 사본·띄어쓰기 있는 사본·영어 낱말 집합.
// 조사·어미는 낱말 끝에서만 떼고, 떼고 남는 길이가 minRest 글자 미만이면 떼지 않는다(「재미」「밤」 보호).
// 어미(endings, 긴 것부터)·군말(fillers)·minRest 는 grammar.yaml 에서 온다.
import { grammar } from './grammar.mjs'

const { endings, fillers, minRest } = grammar.normalize
const FILLERS = new Set(fillers) // 낱말 하나로 떨어져 나오는 군말

function stripWord(w) {
  for (const e of endings) {
    if (w.length - e.length >= minRest && w.endsWith(e)) return w.slice(0, -e.length)
  }
  return w
}

/**
 * tokens = 낱말 하나하나가 compact 에서 차지하는 구간(raw = 어미를 떼기 전 원래 낱말), latin = 그 안의 영어 낱말(단어 경계)과 구간.
 * 해석기(interpret)는 compact 위에서 한글 낱말을 찾고, 영어는 latin 과 통째로 맞대어 「unclean」이 「clean」으로 읽히지 않게 한다.
 * @returns {{ compact: string, spaced: string, en: Set<string>, tokens: {start:number,end:number,raw:string}[], latin: {word:string,start:number,end:number}[] }}
 */
export function normalize(text) {
  const raw = String(text ?? '').normalize('NFC').toLowerCase().trim()
  const en = new Set(raw.match(/[a-z][a-z-]*/g) ?? [])
  const given = raw.split(/[\s,.!?~·]+/).filter((w) => w && !FILLERS.has(w))
  const words = given.map(stripWord)
  const tokens = []
  const latin = []
  let pos = 0
  for (const [i, w] of words.entries()) {
    tokens.push({ start: pos, end: pos + w.length, raw: given[i] })
    for (const m of w.matchAll(/[a-z][a-z'-]*/g)) latin.push({ word: m[0], start: pos + m.index, end: pos + m.index + m[0].length })
    pos += w.length
  }
  return { compact: words.join(''), spaced: words.join(' '), en, tokens, latin }
}
