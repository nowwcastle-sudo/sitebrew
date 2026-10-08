// 검사 3 — email-link-routes (N05): 메일이 가리키는 경로가 앱에 실제로 있어야 한다.
// 경로는 promises.json 의 emailLinks 가 알려 준다: 객체 상수(ROUTES = { billing: "/account/billing", ... })·문자열 상수·정규식 한 칸.
import { resolveRoute, routeTable } from "./lib.mjs"

/** 소스에서 경로 문자열(/ 로 시작)들을 뽑는다 */
export function linksFrom(ctx, src) {
  const code = ctx.code(src.file)
  if (!code) return { error: `읽을 수 없다: ${src.file}`, links: [] }
  let chunk = null
  if (src.object) {
    const m = new RegExp(`\\b${src.object}\\b[^=]*=\\s*\\{([^}]*)\\}`).exec(code)
    if (m) chunk = [...m[1].matchAll(/["'`](\/[^"'`]*)["'`]/g)].map((x) => x[1])
  } else if (src.const) {
    const m = new RegExp(`\\b${src.const}\\b[^=\\n]*=\\s*["'\`](\\/[^"'\`]*)["'\`]`).exec(code)
    if (m) chunk = [m[1]]
  } else if (src.regex) {
    chunk = [...code.matchAll(new RegExp(src.regex, "g"))].map((m) => m[1] ?? m[0])
  }
  return chunk ? { links: chunk } : { error: `${src.file} 에서 ${src.object ?? src.const ?? src.regex} 를 못 찾았다`, links: [] }
}

export function checkEmailLinks(ctx, config) {
  const failures = []
  const warnings = []
  const table = routeTable(ctx)
  const extra = config.extraRoutes ?? []
  const seen = new Set()
  for (const src of config.emailLinks ?? []) {
    const { links, error } = linksFrom(ctx, src)
    if (error) warnings.push(error)
    for (const link of links) {
      const path = link.split(/[?#]/)[0] || "/"
      if (seen.has(path)) continue
      seen.add(path)
      if (!resolveRoute(table, path, extra)) failures.push({ check: "email-link-routes", target: path, detail: `메일이 가리키는 경로가 ${ctx.paths.appDir} 에 없다(${src.file})` })
    }
  }
  return { failures, warnings, checked: [...seen] }
}
