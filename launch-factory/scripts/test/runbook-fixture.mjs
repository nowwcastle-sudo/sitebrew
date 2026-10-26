// 런북 시험 공용 재료(시험 파일이 아니다 — 글롭 `*.test.mjs` 에 걸리지 않는다).
// 고정 원천 폴더를 임시 폴더로 복사하고, 저장소의 rubric.json·secret-shapes.json(정본)을 함께 놓는다.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const FIX = join(import.meta.dirname, "fixtures", "runbook")
const DOCS = join(import.meta.dirname, "..", "..", "docs", "runbook")
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"))

/** 좋은 원천 폴더의 임시 사본 경로 */
export function tree() {
  const dir = mkdtempSync(join(tmpdir(), "runbook-"))
  cpSync(join(FIX, "tree"), dir, { recursive: true })
  for (const f of ["rubric.json", "secret-shapes.json"]) cpSync(join(DOCS, f), join(dir, f))
  return dir
}

export const outcomes = () => readJson(join(FIX, "outcomes.json"))
export const registry = () => readJson(join(FIX, "registry.json"))

/** dir 안 JSON 파일을 고친다(fn 이 값을 바꾸거나 새 값을 돌려준다) */
export function editJson(dir, rel, fn) {
  const value = readJson(join(dir, rel))
  writeFileSync(join(dir, rel), JSON.stringify(fn(value) ?? value, null, 2) + "\n")
}

export function editText(dir, rel, fn) {
  writeFileSync(join(dir, rel), fn(readFileSync(join(dir, rel), "utf8")))
}

/** 저장소에 완성된 키 글자가 남지 않게 시험 때 조각을 이어 만든다 */
export const fakeKey = () => ["sk", "live", "Q".repeat(6) + "9".repeat(6) + "Zz".repeat(4)].join("_")
