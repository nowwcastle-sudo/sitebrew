// cssTheme — 템플릿 globals.css 를 바탕으로 시안의 색·글꼴을 옮긴다. 블록 이름은 rules.json 이 정한다.
//   replace: 템플릿 블록을 시안의 같은 이름 블록 전부로 바꾼다(:root, .dark, @theme inline).
//   append:  템플릿 블록은 그대로 두고 시안의 같은 이름 블록 전부를 그 뒤에 더한다(@layer base — 템플릿의 포커스 링·한글 줄바꿈·동작 줄이기가 남고
//            시안의 data-face 색 면·아이콘 선택자가 더해진다).
// 시안에 같은 이름 블록이 없으면 템플릿 것이 그대로다. 글꼴 @import 는 시안 것으로 바뀐다(핵심 import 는 템플릿 것).
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const id = "cssTheme"

/** 최상위 문장 쪼개기: @import 같은 `;` 문장과 `{…}` 블록. 문자열·주석 안의 괄호는 세지 않는다 → [{ kind, prelude, text }] */
export function parseCss(css) {
  const out = []
  let i = 0
  while (i < css.length) {
    const start = i
    let depth = 0
    let quote = null
    let head = null
    for (; i < css.length; i++) {
      const c = css[i]
      if (quote) {
        if (c === "\\") i++
        else if (c === quote) quote = null
      } else if (css.startsWith("/*", i)) i = css.indexOf("*/", i + 2) + 1
      else if (c === '"' || c === "'") quote = c
      else if (c === "{") {
        head ??= css.slice(start, i)
        depth++
      } else if (c === "}" && --depth === 0) {
        i++
        break
      } else if (c === ";" && depth === 0) {
        i++
        break
      }
    }
    const text = css.slice(start, i).trim()
    if (!text) continue
    out.push(head === null ? { kind: "statement", prelude: text, text } : { kind: "block", prelude: head.replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/\s+/g, " "), text })
  }
  return out
}

export function mergeTheme(templateCss, siteCss, { replace, append, coreImports }) {
  const tpl = parseCss(templateCss)
  const site = parseCss(siteCss)
  const isImport = (s) => s.kind === "statement" && s.prelude.startsWith("@import")
  const isCore = (s) => coreImports.some((name) => s.prelude.includes(`"${name}"`))
  const siteBlocks = (prelude) => site.filter((s) => s.kind === "block" && s.prelude === prelude)
  const out = []
  let lastCore = -1
  const seen = new Set()
  for (const s of tpl) {
    if (isImport(s) && !isCore(s)) continue
    if (s.kind === "block" && replace.includes(s.prelude) && siteBlocks(s.prelude).length) {
      if (!seen.has(s.prelude)) out.push(...siteBlocks(s.prelude))
      seen.add(s.prelude)
      continue
    }
    out.push(s)
    if (isImport(s)) lastCore = out.length - 1
  }
  out.splice(lastCore + 1, 0, ...site.filter((s) => isImport(s) && !isCore(s)))
  for (const prelude of replace) if (!out.some((s) => s.kind === "block" && s.prelude === prelude)) out.push(...siteBlocks(prelude))
  for (const prelude of append) {
    const at = out.findLastIndex((s) => s.kind === "block" && s.prelude === prelude)
    out.splice(at === -1 ? out.length : at + 1, 0, ...siteBlocks(prelude))
  }
  const glue = (s, i) => (i === 0 ? "" : s.kind === "statement" && out[i - 1].kind === "statement" ? "\n" : "\n\n")
  return `${out.map((s, i) => `${glue(s, i)}${s.text}`).join("")}\n`
}

export function run(state) {
  for (const { file, rule } of state.plan.filter((p) => p.rule.kind === "cssTheme")) {
    const target = join(state.to, file)
    writeFileSync(target, mergeTheme(readFileSync(target, "utf8"), readFileSync(join(state.siteDir, file), "utf8"), rule))
  }
  return state
}
