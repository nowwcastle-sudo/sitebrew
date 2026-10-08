// 선택 학습(factory v1 Task 4.4 · 합의안 D14) — 원형별 변형 순위 가중치 + 사용자별 로컬 학습.
//   · 가중치 weightOf(prefs, 원형, 변형) = 1 + 0.25 × (이긴 횟수 − 진 횟수), 범위 0.5~2. 기록이 없으면 1.
//     씨앗(운영자 선택, factory/board/preferences.seed.json)과 사용자 기록(preferences.json)을 더해서 센다. 원형 「*」 칸은 모든 원형에 적용된다(축 판정처럼 원형을 묻지 않은 판정).
//   · 사용자 파일은 process.env.CLAUDE_PLUGIN_DATA 아래(없으면 ~/.factory) preferences.json 이다. **이 모듈은 네트워크를 쓰지 않는다** — 기록은 이 컴퓨터의 파일에서 나가지 않는다(공개 사용자의 선택은 밖으로 보내지 않는다, D14).
//   · 읽기는 파일을 만들지 않고 값을 바꾸지 않는다. recordPick 은 새 값을 돌려주고, 저장은 savePreferences 가 사용자 몫만 쓴다(씨앗은 복사하지 않는다).
//   · 쓰는 곳: variants.mjs chooseVariants({ preferences }) — 앞 순서 기준(못 채우는 변형·누설·내린 블록·덜 쓰인 것·브리프 선호·올린 블록)이 같은 변형 사이에서 먼저 보는 꼬리표.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MIN_WEIGHT = 0.5
export const MAX_WEIGHT = 2
export const STEP = 0.25
export const KINDS = ['direction', 'section', 'axis']
export const ANY_ARCHETYPE = '*'
export const SEED_FILE = join(dirname(fileURLToPath(import.meta.url)), 'preferences.seed.json')
const VERSION = 1

/** 사용자 파일 자리. env 는 시험이 바꿔 끼운다. */
export function userPreferencesFile(env = process.env) {
  const base = env.CLAUDE_PLUGIN_DATA?.trim()
  return join(base || join(homedir(), '.factory'), 'preferences.json')
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const count = (n) => Number.isInteger(n) && n >= 0

/** 모양이 맞는 칸만 남긴 { 원형: { 변형: { win, loss } } } — 틀린 칸은 버린다. */
function cleanCounts(raw) {
  const out = {}
  if (!isObj(raw)) return out
  for (const [arch, variants] of Object.entries(raw)) {
    if (!isObj(variants)) continue
    for (const [variant, v] of Object.entries(variants)) {
      if (!isObj(v) || !count(v.win) || !count(v.loss)) continue
      ;(out[arch] ??= {})[variant] = { win: v.win, loss: v.loss }
    }
  }
  return out
}

export const emptyPreferences = () => ({ version: VERSION, seed: {}, user: {}, warnings: [] })

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/**
 * @param {{ seedFile?: string, userFile?: string }} [opts]
 * @returns {{ version: 1, seed: object, user: object, warnings: string[] }}
 */
export function loadPreferences({ seedFile = SEED_FILE, userFile = userPreferencesFile() } = {}) {
  const prefs = emptyPreferences()
  const read = (file, key, field) => {
    if (!existsSync(file)) return
    try {
      const j = readJson(file)
      prefs[field] = cleanCounts(key === 'counts' ? j?.counts : j?.user)
    } catch (e) {
      prefs.warnings.push(`${file} 을 읽지 못해 ${field === 'seed' ? '씨앗' : '사용자 기록'} 없이 계산한다: ${String(e?.message ?? e).split('\n')[0]}`)
    }
  }
  read(seedFile, 'counts', 'seed')
  read(userFile, 'user', 'user')
  return prefs
}

function net(prefs, archetype, variant) {
  let n = 0
  for (const src of [prefs.seed, prefs.user]) for (const arch of [archetype, ANY_ARCHETYPE]) {
    const c = src?.[arch]?.[variant]
    if (c) n += c.win - c.loss
  }
  return n
}

/** 기본 1, 범위 0.5~2. 모르는 변형·원형도 1. */
export function weightOf(prefs, archetype, variant) {
  const w = 1 + STEP * net(prefs ?? emptyPreferences(), archetype, variant)
  return Math.round(Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, w)) * 10000) / 10000
}

const need = (v, name) => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`recordPick: ${name} 는 비어 있지 않은 문자열이다: ${JSON.stringify(v)}`)
  return v
}

/**
 * 고르기 하나를 기록한다 — 받은 값은 바꾸지 않고 새 값을 돌려준다.
 * @param {{ archetype: string, winner: string, loser: string, kind: 'direction'|'section'|'axis' }} pick
 */
export function recordPick(prefs, { archetype, winner, loser, kind }) {
  need(archetype, 'archetype'); need(winner, 'winner'); need(loser, 'loser')
  if (!KINDS.includes(kind)) throw new Error(`recordPick: kind 는 ${KINDS.join('|')} 중 하나다: ${JSON.stringify(kind)}`)
  if (winner === loser) throw new Error('recordPick: 이긴 변형과 진 변형이 같다')
  const user = structuredClone(prefs?.user ?? {})
  const bump = (variant, field) => {
    const c = ((user[archetype] ??= {})[variant] ??= { win: 0, loss: 0 })
    c[field]++
  }
  bump(winner, 'win')
  bump(loser, 'loss')
  return { ...(prefs ?? emptyPreferences()), user, warnings: [...(prefs?.warnings ?? [])] }
}

/** 사용자 몫만 파일에 쓴다(원자적). 씨앗은 복사하지 않는다 — 씨앗이 바뀌면 새 씨앗이 이긴다. */
export function savePreferences(prefs, { userFile = userPreferencesFile() } = {}) {
  mkdirSync(dirname(userFile), { recursive: true })
  const tmp = `${userFile}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify({ version: VERSION, user: prefs.user }, null, 2) + '\n')
  renameSync(tmp, userFile)
  return userFile
}
