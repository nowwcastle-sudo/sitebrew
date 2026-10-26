// layoutMerge — 템플릿 app/layout.tsx 를 바탕으로 시안의 <html lang>, 테마 클래스(build.theme), 글꼴 로더를 옮긴다.
// 시안 layout.tsx 에서 못 찾거나 읽을 수 없는 조각이 있으면 파일 경로를 적어 던진다(시안 모양이 바뀌었다는 뜻이라 조용히 넘기지 않는다).
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const id = "layoutMerge"

const IMPORT_LINE = /^import\s[^\n]*?from\s+["']([^"']+)["'];?[ \t]*$/gm
const FONT_CONST = /^const\s+\w+\s*=[^\n]*;[^\n]*$/gm
const TOP_CONST = /^const\s[^\n]*$/gm
const ATTR = (name) => new RegExp(`<html\\b[^>]*?\\s${name}=(\\{[^{}]*\\})`)

/** `import D, { a, b as c } from "x"` 한 줄 → { def, named, spec }. 읽을 수 없는 모양(namespace·type·여러 줄)은 null */
function parseImport(line) {
  const m = /^import\s+([^{}]*?)?\s*(?:\{([^{}]*)\})?\s*from\s+["']([^"']+)["'];?$/.exec(line.trim())
  if (!m) return null
  const head = (m[1] ?? "").replace(/,\s*$/, "").trim()
  if (/^(?:type\b|\*)/.test(head) || head.includes(" ")) return null
  return { def: head || null, named: (m[2] ?? "").split(",").map((n) => n.trim()).filter(Boolean), spec: m[3] }
}

/** 같은 모듈을 둘 다 import 하면 이름을 합친 한 줄로 만든다(시안이 쓰는 이름을 잃지 않는다). 합칠 수 없으면 던진다 */
function mergeImport(templateLine, siteLine, file) {
  const t = parseImport(templateLine)
  const s = parseImport(siteLine)
  if (!t || !s) throw new Error(`${file}: import 줄을 합칠 수 없다 — ${templateLine.trim()} / ${siteLine.trim()}`)
  if (t.def && s.def && t.def !== s.def) throw new Error(`${file}: ${s.spec} 의 기본 import 이름이 다르다 (${t.def} / ${s.def})`)
  const named = [...new Set([...t.named, ...s.named])]
  if (named.length === t.named.length && (t.def || !s.def)) return templateLine
  const clause = [t.def ?? s.def, named.length ? `{ ${named.join(", ")} }` : null].filter(Boolean).join(", ")
  return `import ${clause} from "${t.spec}"`
}

export function mergeLayout(templateText, siteText, { imports }, file = "app/layout.tsx") {
  const fonts = [...siteText.matchAll(FONT_CONST)].map((m) => m[0].trim())
  const unreadable = [...siteText.matchAll(TOP_CONST)].map((m) => m[0].trim()).filter((l) => !fonts.includes(l))
  if (unreadable.length) throw new Error(`${file}: 글꼴 로더로 읽을 수 없는 최상위 const 가 있다(여러 줄이거나 ; 가 없다) — ${unreadable.join(" | ")}`)
  const lang = siteText.match(ATTR("lang"))?.[1]
  const className = siteText.match(ATTR("className"))?.[1]
  const siteImports = [...siteText.matchAll(IMPORT_LINE)].filter((m) => imports.includes(m[1]))
  const missing = [["lang", lang], ["className", className], ["import(s)", siteImports.length ? "ok" : null]].filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) throw new Error(`${file}: 시안 layout 에서 못 찾았다: ${missing.join(", ")}`)
  if (!templateText.includes('lang="en"')) throw new Error(`${file}: 템플릿 layout 에 lang="en" 이 없다`)

  let text = templateText
  const addImports = []
  for (const m of siteImports) {
    const same = [...text.matchAll(IMPORT_LINE)].find((t) => t[1] === m[1])
    if (same) text = text.replace(same[0], () => mergeImport(same[0], m[0], file))
    else addImports.push(m[0].trim())
  }
  const lastImport = [...text.matchAll(IMPORT_LINE)].at(-1)
  const at = lastImport.index + lastImport[0].length
  const block = [...addImports, ...(fonts.length ? ["", ...fonts] : [])].join("\n")
  return `${text.slice(0, at)}\n${block}${text.slice(at)}`.replace('lang="en"', () => `lang=${lang} className=${className}`)
}

export function run(state) {
  for (const { file, rule } of state.plan.filter((p) => p.rule.kind === "layoutMerge")) {
    const target = join(state.to, file)
    writeFileSync(target, mergeLayout(readFileSync(target, "utf8"), readFileSync(join(state.siteDir, file), "utf8"), rule, file))
  }
  return state
}
