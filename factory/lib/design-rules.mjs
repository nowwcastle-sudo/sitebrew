// 선택 자료 폴더(D24) — 저장소 밖 비공개 자료 폴더를 환경 변수 하나로 가리킨다.
//   WF_DESIGN_RULES_DIR 가 있으면 그 폴더, 없으면 저장소 안 사본(references/design-rules — 있을 때만), 둘 다 없으면 null.
//   자료가 없어도 공장은 돈다: 쓰는 쪽은 null 을 받으면 absentNote 한 줄을 찍고 그 입력만 건너뛴다(던지지 않는다).
import { existsSync, writeSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ENV_NAME = 'WF_DESIGN_RULES_DIR'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const REPO_COPY = join(ROOT, 'references', 'design-rules')

/** @returns {{ dir: string|null, source: 'env'|'repo'|'none' }} */
export function designRulesRoot({ env = process.env, exists = existsSync, repoCopy = REPO_COPY } = {}) {
  const fromEnv = env[ENV_NAME]?.trim()
  if (fromEnv) return { dir: fromEnv, source: 'env' }
  if (exists(repoCopy)) return { dir: repoCopy, source: 'repo' }
  return { dir: null, source: 'none' }
}

/** 뿌리 아래 상대 경로. 뿌리가 없으면 null. */
export function designRulesPath(rel, opts) {
  const { dir } = designRulesRoot(opts)
  return dir ? join(dir, rel) : null
}

/** 선택 자료가 없을 때 알리는 말: 한국어 한 줄 + 영어 한 줄. */
export function absentNoteParts(what, whatEn = what) {
  return {
    ko: `선택 자료 없음: ${what} — ${ENV_NAME} 를 설정하면 쓴다.`,
    en: `optional data absent: ${whatEn} - set ${ENV_NAME} to use it.`,
  }
}

/** 한 줄 알리고 종료 0 — 건너뛴 입력 뒤의 코드가 돌지 않게 바로 끝낸다. writeSync 라 Windows 파이프에서도 줄이 잘리지 않는다. */
export function skipAndExit(line) {
  try { writeSync(1, `${line}\n`) } catch { /* stdout 이 닫혔으면 알릴 곳이 없다 */ }
  process.exit(0)
}

/** 같은 말을 한 줄로 잇는다(생성기·CLI 가 stdout 에 찍는 용). */
export function absentNote(what, whatEn = what) {
  const { ko, en } = absentNoteParts(what, whatEn)
  return `${ko} / ${en}`
}
