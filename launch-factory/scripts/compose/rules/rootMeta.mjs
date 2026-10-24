// rootMeta — 출력의 뿌리 메타에 남은 템플릿 자리 표시(제품 이름 PRODUCT_NAME, OG 언어)를 시안의 이름·언어로 바꾼다.
// 자리 목록·이름 경로 순서·언어 표는 rules.json steps.rootMeta. 파일마다 find 가 처음 맞는 한 곳만 바꾸고, 못 바꾼 파일은 던지지 않고 state.rootMetaSkipped 에 적는다
// (템플릿 글자가 바뀌었다는 신호 — 템플릿에 find 가 그대로 있는지는 시험이 지킨다).
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const id = "rootMeta"

const at = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj)
const resolveRef = (json, v) => (v && typeof v === "object" && typeof v.$ref === "string" ? at(json, v.$ref) : v)

/** 자리 표시 글자(「확인 필요」·"To be confirmed")인가 — web-factory legal/drafts PLACEHOLDER 와 같은 글자 */
export const isNeedsCheck = (v, placeholders) => typeof v === "string" && placeholders.includes(v.trim())

/** 시안 이름: nameFrom 경로 순서로 첫 번째 쓸 수 있는 글자(자리 표시·빈 글자는 건너뜀). 없으면 undefined */
export function siteNameOf(site, { nameFrom, placeholders }) {
  for (const p of nameFrom) {
    const v = resolveRef(site, at(site, p))
    if (typeof v === "string" && v.trim() && !isNeedsCheck(v, placeholders)) return v.trim()
  }
  return undefined
}

/** @returns {string[]} 못 바꾼 파일 경로(파일이 없거나 find 가 없거나 채울 값이 없음) */
export function applyRootMeta(dir, { name, locale }, spec) {
  const values = { name: name === undefined ? undefined : JSON.stringify(name), ogLocale: spec.ogLocale[locale] }
  const skipped = []
  for (const edit of spec.edits) {
    const file = join(dir, edit.file)
    const need = [...edit.replace.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
    if (!existsSync(file) || need.some((k) => values[k] === undefined)) { skipped.push(edit.file); continue }
    const text = readFileSync(file, "utf8")
    if (!text.includes(edit.find)) { skipped.push(edit.file); continue }
    const next = edit.replace.replace(/\{(\w+)\}/g, (_, k) => values[k])
    writeFileSync(file, text.replace(edit.find, () => next))
  }
  return skipped
}

export function run(state) {
  const spec = state.rules.steps.rootMeta
  const site = JSON.parse(readFileSync(join(state.siteDir, spec.from), "utf8"))
  const name = siteNameOf(site, spec) ?? (typeof state.name === "string" && state.name.trim() ? state.name.trim() : undefined)
  state.rootMetaSkipped = applyRootMeta(state.to, { name, locale: site.locale }, spec)
  return state
}
