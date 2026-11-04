// Higgsfield 원본 폴더 해석(v0.2.6 T15·S8) — doctor · 05-media · media:build 가 같은 후보와 우선순위를 쓰게 한 곳에 둔다.
//   후보 순서: 환경 변수 HIGGSFIELD_DIR → $WF_DESIGN_RULES_DIR/factory/media/higgsfield. 폴더가 실제로 있어야 `dir` 이다.
//   직접 가리킨 경로(explicit)가 없으면 doctor 가 실패로 읽고, 기본 자리(rules)에 없는 것은 「없음」이다.
//   플러그인 doctor(plugins/sitebrew/scripts/doctor.mjs)에 같은 규칙의 사본이 있다 — 교차 시험이 둘을 맞춘다.
import { existsSync, statSync } from 'node:fs'
import { designRulesPath } from './design-rules.mjs'

const isDirDefault = (p) => { try { return statSync(p).isDirectory() } catch { return false } }

/**
 * @param {{ env?: Record<string,string|undefined>, isDir?: (p: string) => boolean, rulesPath?: (rel: string) => string|null }} [opts]
 * @returns {{ dir: string|null, candidate: string|null, source: 'env'|'rules'|'none', explicit: boolean }}
 *   dir = 실제로 있는 폴더(없으면 null) · candidate = 있든 없든 가리킨 경로 · explicit = 환경 변수로 직접 가리킴
 */
export function higgsfieldDir({ env = process.env, isDir = isDirDefault, rulesPath = (rel) => designRulesPath(rel, { env, exists: existsSync }) } = {}) {
  const fromEnv = env.HIGGSFIELD_DIR?.trim()
  const candidate = fromEnv || rulesPath('factory/media/higgsfield') || null
  const source = fromEnv ? 'env' : candidate ? 'rules' : 'none'
  return { dir: candidate && isDir(candidate) ? candidate : null, candidate, source, explicit: Boolean(fromEnv) }
}
