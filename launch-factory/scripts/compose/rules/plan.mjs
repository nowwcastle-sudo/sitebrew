// 1단계 — 시안 파일마다 규칙을 정한다. 규칙에 없는 파일과 url-map 에 없는 URL 충돌은 하나도 쓰기 전에 목록으로 던진다
import { globToRegExp, listFiles, matchesAny, urlOf, walk, withSecrets } from "../lib.mjs"

export const id = "plan"

export function run(state) {
  const { siteDir, templateDir, rules, urlMap } = state
  // 시안 걷기에서는 siteExclude 가 비밀 패턴의 "!" 예외(.env.example 보존)보다 앞선다 — 시안의 .env.example 은 규칙 대상이 아니다
  const skip = withSecrets(rules, rules.siteExclude).filter((p) => !(p.startsWith("!") && rules.siteExclude.some((e) => globToRegExp(e).test(p.slice(1)))))
  const plan = walk(siteDir, skip).map((file) => ({ file, rule: rules.rules.find((r) => matchesAny(r.match, file)) }))
  const unknown = plan.filter((p) => !p.rule).map((p) => p.file)
  if (unknown.length) throw new Error(`규칙(rules.json)에 없는 시안 파일 ${unknown.length}개:\n  ${unknown.join("\n  ")}`)

  const templateUrls = new Set(listFiles(templateDir, withSecrets(rules, rules.templateExclude)).map(urlOf).filter(Boolean))
  const rows = new Map(urlMap.rows.map((r) => [r.site, r]))
  const dead = urlMap.rows.filter((r) => !templateUrls.has(r.template)).map((r) => `${r.site} → ${r.template}`)
  if (dead.length) throw new Error(`url-map.json 의 template URL 이 템플릿에 없다 ${dead.length}개:\n  ${dead.join("\n  ")}`)
  const conflicts = []
  for (const { file, rule } of plan) {
    const url = urlOf(file)
    if (!url) continue
    if (rule.kind === "urlMap") {
      if (!rows.has(url)) conflicts.push(`${file} (${url}) — 규칙은 urlMap 인데 url-map.json 에 줄이 없다`)
    } else if (templateUrls.has(url) && rule.kind !== "keep") {
      conflicts.push(`${file} (${url}) — 템플릿에 같은 URL 이 있는데 url-map.json 이 정하지 않았다`)
    }
  }
  if (conflicts.length) throw new Error(`url-map.json 에 없는 URL 충돌 ${conflicts.length}개:\n  ${conflicts.join("\n  ")}`)
  return Object.assign(state, { plan, rows })
}
