// 예측 파일 읽기(설계 7.2 출시 관문: 사전 힌트를 받은 Claude 가 시험 문장을 분류한 결과). 한 줄: { id, result, kind?, readings?, choices? }
//   confirmed·near = readings(읽기 목록, 첫 읽기가 대표 읽기) · two = choices [{ readings }, { readings }] · unknown = 나머지 없음.
//   시안 비교 말(「2번 시안처럼」)은 confirmed + copyFrom(시안 id 글자 하나)로 적고 readings 는 없다 — 분류됨이지만 대표 읽기가 없다(lead null).
//   줄마다 classify 가 내는 결과와 같은 모양({ result, kind, readings|options, lead })으로 바꿔 채점기가 그대로 쓴다.
//   틀린 곳(깨진 줄·없는 id·사전에 없는 축·방향·값·범위·갈래·세기·읽기 빠짐)은 모아서 돌려준다 — 한 번에 고칠 수 있게.
//   범위(scope)는 사전이 쓰는 id 만 받는다(scopesOf): 자유 글을 받으면 정답의 `section:hero` 와 `section:히어로` 가 서로 안 겹쳐 반대 방향이 채점을 빠져나간다.
import { readFileSync } from 'node:fs'
import { grammar } from '../grammar.mjs'
import { leadOf } from '../interpret.mjs'
import { KINDS, scopesOf } from '../lexicon.mjs'

const RESULTS = Object.freeze(['confirmed', 'two', 'near', 'unknown'])
const { strengthMax } = grammar.limits // 세기는 크기 0..strengthMax
export const UNKNOWN = Object.freeze({ result: 'unknown' }) // 예측이 없는 문장

/** 읽기 하나의 검사(사전 기준). 틀린 곳의 설명들. literalOk(축, 값)이 참이면 사전 표기가 아닌 직접 말한 값(색 코드·서체 이름)도 받는다. */
function readingProblems(x, lex, scopes, literalOk) {
  const axis = lex.axes[x?.axis]
  if (!axis) return [`없는 축 「${x?.axis}」`]
  const named = [x.direction !== undefined && 'direction', x.value !== undefined && 'value'].filter(Boolean)
  if (named.length !== 1) return [`${x.axis}: direction 과 value 중 하나만 있어야 한다`]
  const problems = []
  if (x.direction !== undefined && !axis.ends?.includes(x.direction)) problems.push(`${x.axis} 에 없는 방향 「${x.direction}」`)
  if (x.value !== undefined && !axis.valueLabels?.[x.value] && !literalOk?.(x.axis, x.value)) problems.push(`${x.axis} 에 없는 값 「${x.value}」`)
  if (x.strength !== undefined && !(Number.isInteger(x.strength) && x.strength >= 0 && x.strength <= strengthMax)) problems.push(`${x.axis}: strength ${JSON.stringify(x.strength)} 는 0..${strengthMax} 정수가 아니다`)
  if (x.scope !== undefined && !scopes.includes(x.scope)) problems.push(`${x.axis}: 사전에 없는 범위 「${x.scope}」`)
  if (x.cap !== undefined && x.cap !== true) problems.push(`${x.axis}: cap 은 true 만 쓴다`)
  return problems
}

/** 읽기 목록 하나: 비어 있지 않은 배열이고 모든 읽기가 사전 기준에 맞다. */
const listProblems = (list, lex, scopes, literalOk) => (Array.isArray(list) && list.length ? list.flatMap((x) => readingProblems(x, lex, scopes, literalOk)) : ['읽기 목록이 비었다'])

/**
 * 수정 명령에 직접 넣는 읽기 입력(ReadingsInput) 검사 — { readings } 또는 { options: [둘] }(예측 파일 모양 { choices } 도 받는다) 또는 { copyFrom: 시안 id | 'previous' } 하나.
 * 예측 파일과 달리 읽기마다 strength 와 scope 를 적어야 한다(계획 단계는 기본값을 채우지 않는다). 틀린 곳은 모아서 돌려주고, 맞으면 빈 목록.
 * @param {object} input 파싱한 JSON
 * @param {object} lex loadLexicon() 결과
 * @param {(axis: string, value: string) => boolean} [literalOk] 직접 말한 값(color-hue 의 색 코드 · type-family 의 서체 이름)을 받을지 — 수정 명령만 넘기고, 예측 파일은 사전 표기만 받는다
 * @returns {string[]}
 */
export function checkReadingsInput(input, lex, literalOk) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return ['읽기 입력은 { readings } 나 { options } 객체여야 한다']
  if (input.copyFrom !== undefined) return typeof input.copyFrom === 'string' && input.copyFrom && Object.keys(input).length === 1 ? [] : ['copyFrom 은 시안 id 글자 하나여야 하고 다른 입력과 함께 쓰지 않는다']
  const options = input.options ?? input.choices
  if ((input.readings === undefined) === (options === undefined)) return ['readings 와 options(choices) 와 copyFrom 중 하나만 있어야 한다']
  if (options !== undefined && !(Array.isArray(options) && options.length === 2)) return ['options 는 정확히 2개여야 한다']
  const scopes = scopesOf(lex)
  const lists = options === undefined ? [input.readings] : options.map((o) => o?.readings)
  return lists.flatMap((list) => {
    const problems = listProblems(list, lex, scopes, literalOk)
    return problems.length ? problems : list.flatMap((x) => ['strength', 'scope'].filter((k) => x[k] === undefined).map((k) => `${x.axis}: ${k} 가 없다`))
  })
}

/** 한 줄 → [채점기가 쓰는 결과, 문제 설명들] */
function convert(p, lex, scopes) {
  if (!RESULTS.includes(p.result)) return [UNKNOWN, [`result 「${p.result}」는 ${RESULTS.join('|')} 가 아니다`]]
  if (p.result === 'unknown') return [UNKNOWN, []]
  const kindProblems = p.kind === undefined || KINDS.includes(p.kind) ? [] : [`kind 「${p.kind}」는 ${KINDS.join('|')} 가 아니다`]
  if (p.copyFrom !== undefined) {
    const problems = [
      ...kindProblems,
      ...(p.result === 'confirmed' ? [] : [`copyFrom 은 confirmed 에만 쓴다(지금 ${p.result})`]),
      ...(typeof p.copyFrom === 'string' && p.copyFrom ? [] : ['copyFrom 은 시안 id 글자 하나여야 한다']),
      ...(p.readings === undefined ? [] : ['copyFrom 과 readings 는 함께 쓰지 않는다']),
    ]
    return problems.length ? [UNKNOWN, problems] : [{ result: 'confirmed', kind: p.kind, readings: [], lead: null, copyFrom: p.copyFrom }, []]
  }
  if (p.result === 'two') {
    const options = p.choices
    if (!Array.isArray(options) || options.length !== 2) return [UNKNOWN, ['two 는 choices 가 정확히 2개여야 한다']]
    const problems = [...kindProblems, ...options.flatMap((c) => listProblems(c?.readings, lex, scopes))]
    if (problems.length) return [UNKNOWN, problems]
    const shaped = options.map((c) => ({ readings: c.readings, lead: leadOf(c.readings[0]) }))
    return [{ result: 'two', kind: p.kind, options: shaped, lead: shaped[0].lead }, []]
  }
  const problems = [...kindProblems, ...listProblems(p.readings, lex, scopes)]
  if (problems.length) return [UNKNOWN, problems]
  return [{ result: p.result, kind: p.kind, readings: p.readings, lead: leadOf(p.readings[0]) }, []]
}

/**
 * @param {string} file 예측 jsonl
 * @param {Set<string>} ids 시험 묶음의 id 들
 * @param {object} lex loadLexicon() 결과
 * @returns {{ predictions: Map<string, object>, problems: string[] }}
 */
export function loadPredictions(file, ids, lex) {
  const predictions = new Map()
  const problems = []
  const scopes = scopesOf(lex)
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    if (!line.trim()) return
    let p
    try { p = JSON.parse(line) } catch { problems.push(`${i + 1}줄: JSON 이 깨졌다`); return }
    if (!ids.has(p?.id)) { problems.push(`${i + 1}줄: 시험 묶음에 없는 id 「${p?.id}」`); return }
    if (predictions.has(p.id)) { problems.push(`${i + 1}줄: id 「${p.id}」가 둘이다(중복)`); return }
    const [result, why] = convert(p, lex, scopes)
    for (const w of why) problems.push(`${p.id}: ${w}`)
    predictions.set(p.id, result)
  })
  return { predictions, problems }
}
