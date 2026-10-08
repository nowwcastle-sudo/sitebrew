// 검사 1 — actions-without-screen (N03): 서버 액션 모듈이 내보낸 함수를 화면(페이지·컴포넌트)이 한 곳도 안 쓰면 보고한다.
// 시험·다른 액션·api 경로가 부르는 것은 치지 않는다. 가져온 이름(별칭 포함)이 가져오기 문 밖에서 쓰였는지로 판정한다.
import { posix } from "node:path"
import { mentions } from "./lib.mjs"

const IMPORT_RE = /import\s+(type\s+)?([^"';]*?)\s+from\s*["']([^"']+)["']/g
const NO_EXT = (f) => f.replace(/\.(?:tsx?|jsx?|mjs|cjs)$/, "")

/** "use server" 모듈이 내보낸 이름 */
export function exportedNames(code) {
  const names = new Set()
  for (const m of code.matchAll(/export\s+(?:async\s+)?function\s*\*?\s*([\w$]+)/g)) names.add(m[1])
  for (const m of code.matchAll(/export\s+const\s+([\w$]+)/g)) names.add(m[1])
  for (const m of code.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const item of m[1].split(",")) {
      const t = item.trim()
      if (!t || /^type\s/.test(t)) continue
      const as = /\bas\s+([\w$]+)$/.exec(t)
      names.add(as ? as[1] : t)
    }
  }
  return [...names]
}

function resolveSpec(spec, from, aliasRoot) {
  if (spec.startsWith("@/")) return NO_EXT(posix.join(aliasRoot, spec.slice(2)))
  if (spec.startsWith(".")) return NO_EXT(posix.join(posix.dirname(from), spec))
  return null
}

/** 모듈(확장자 뺀 경로) → 화면이 쓴 이름 집합. "*" 는 이름공간을 통째로 넘긴 경우 */
export function usedByScreens(ctx, moduleKeys) {
  const used = new Map([...moduleKeys].map((k) => [k, new Set()]))
  for (const s of ctx.screens()) {
    const code = ctx.code(s)
    const imports = [...code.matchAll(IMPORT_RE)]
    const body = code.replace(IMPORT_RE, "")
    for (const [, typeOnly, clause, spec] of imports) {
      if (typeOnly) continue
      const key = resolveSpec(spec, s, ctx.paths.aliasRoot)
      if (!key || !used.has(key)) continue
      const set = used.get(key)
      const ns = /\*\s+as\s+([\w$]+)/.exec(clause)
      if (ns) {
        const name = ns[1]
        for (const m of body.matchAll(new RegExp(`(?<![\\w$.])${name}\\.([\\w$]+)`, "g"))) set.add(m[1])
        if (new RegExp(`(?<![\\w$.])${name}(?![\\w$.])`).test(body)) set.add("*")
      }
      const braces = /\{([^}]*)\}/.exec(clause)
      if (braces) {
        for (const item of braces[1].split(",")) {
          const t = item.trim()
          if (!t || /^type\s/.test(t)) continue
          const [orig, local = orig] = t.split(/\s+as\s+/)
          if (mentions(body, local)) set.add(orig)
        }
      }
    }
  }
  return used
}

export function checkActions(ctx) {
  const prefix = `${ctx.paths.aliasRoot}/`
  const modules = ctx.files.filter((f) => f.startsWith(prefix) && ctx.isSource(f) && !ctx.isTest(f) && ctx.isUseServer(f))
  const used = usedByScreens(ctx, new Set(modules.map(NO_EXT)))
  const failures = []
  for (const mod of modules) {
    const set = used.get(NO_EXT(mod))
    for (const name of exportedNames(ctx.code(mod))) {
      if (set.has("*") || set.has(name)) continue
      failures.push({ check: "actions-without-screen", target: `${mod}#${name}`, detail: "서버 액션을 부르는 화면(페이지·컴포넌트)이 없다" })
    }
  }
  return { failures, scanned: { modules: modules.length, screens: ctx.screens().length } }
}
