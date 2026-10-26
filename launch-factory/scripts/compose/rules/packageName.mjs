// packageName — 출력 package.json 의 name 을 템플릿 이름(@launch-factory/template) 대신 시안에서 딴 슬러그로 바꾼다.
// 출처는 rules.json steps.packageName 의 paths 순서: 값이 주소면 호스트의 첫 마디, 아니면 글자 그대로 슬러그로 만들고 비면(한글 이름 등) 다음 출처로 간다.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { readJson, writeJson } from "../lib.mjs"

export const id = "packageName"

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const at = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj)

/** { "$ref": "a.b.0.c" } 는 같은 파일 안의 경로로 푼다 */
const resolve = (json, v) => (v && typeof v === "object" && typeof v.$ref === "string" ? at(json, v.$ref) : v)

export function slugOf(value) {
  if (typeof value !== "string") return ""
  try {
    return slug(new URL(value).hostname.replace(/^www\./, "").split(".")[0])
  } catch {
    return slug(value)
  }
}

export function run(state) {
  const { from, paths, fallback } = state.rules.steps.packageName
  const site = JSON.parse(readFileSync(join(state.siteDir, from), "utf8"))
  const name = paths.map((p) => slugOf(resolve(site, at(site, p)))).find(Boolean) ?? fallback
  const file = join(state.to, "package.json")
  writeJson(file, { ...readJson(file), name })
  return state
}
