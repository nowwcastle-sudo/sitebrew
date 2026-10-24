// 디자인 말 해석에 쓰는 재료(사전·예문·유사도 설정) — 수정 명령이 따로 받지 않으면 이 기본값을 쓴다. 사전은 한 번만 읽는다.
//   예문은 dev 묶음이다(holdout 은 읽지 않는다). 시험은 parseRevision 의 세 번째 인자로 다른 재료를 넘길 수 있다.
import { loadExamples, EVAL_DIR } from '../vocab/eval/score.mjs'
import { loadLexicon } from '../vocab/lexicon.mjs'
import { loadSimilarConfig } from '../vocab/similar.mjs'

let lexicon
let rest

/** 기본 사전. */
export const designLexicon = () => (lexicon ??= loadLexicon())

/** @returns {{ lex: object, examples: object[], cfg: { minScore: number, topK: number } }} */
export function designContext() {
  rest ??= { examples: loadExamples(EVAL_DIR), cfg: loadSimilarConfig() }
  return { lex: designLexicon(), ...rest }
}
