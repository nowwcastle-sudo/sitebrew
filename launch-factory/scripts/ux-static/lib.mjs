// UX 정적 검사 공용 도구(LFSTATIC). 브라우저·빌드·네트워크 없이 파일만 읽는다.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, posix, sep } from "node:path"

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", ".tmp", "dist", "out"])
const SOURCE_EXT = /\.(?:tsx?|jsx?|mjs|cjs)$/
const TEST_FILE = /(?:\.test\.|\.spec\.|\/__tests__\/|\/test\/)/

export const DEFAULT_PATHS = {
  /** 뿌리 아래에서 훑을 폴더 */
  scan: ["template", "packages"],
  /** 파일 기반 경로가 있는 폴더(Next app router) */
  appDir: "template/app",
  /** 「화면」으로 치는 폴더 */
  screenRoots: ["template/app", "template/components"],
  /** `@/` 가 가리키는 폴더(tsconfig paths) */
  aliasRoot: "template",
  /** 메일 보냄을 찾는 폴더 */
  emailScan: ["packages", "template/app", "template/components", "template/lib"],
}

export const toPosix = (p) => p.split(sep).join("/")

/** 주석을 지운다(줄 수는 유지). 문자열 안의 `//` 는 건드리지 않는다. ' " 문자열은 줄 끝에서 멈춘다(JSX 글 안의 어포스트로피 대비) */
export function stripComments(src) {
  let out = ""
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") i++
      continue
    }
    if (c === "/" && d === "*") {
      i += 2
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") out += "\n"
        i++
      }
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === "`") {
      out += c
      i++
      while (i < n && src[i] !== c && !(c !== "`" && src[i] === "\n")) {
        if (src[i] === "\\" && i + 1 < n) out += src[i++]
        out += src[i++]
      }
      if (i < n && src[i] === c) out += src[i++]
      continue
    }
    out += c
    i++
  }
  return out
}

export const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** 식별자(점 이름 가능)가 코드에 나오는지. member 이면 `obj.name(` 처럼 점 뒤의 쓰임도 센다 */
export function mentions(code, name, { member = false } = {}) {
  const re = new RegExp(`(?<![\\w$${member ? "" : "."}])${escapeRe(name)}(?![\\w$])`)
  return re.test(code)
}

/** 뿌리 하나를 읽는 문맥 — 파일 목록·원문·주석 뺀 글을 한 번만 읽는다 */
export function makeContext(root, paths = {}) {
  const p = { ...DEFAULT_PATHS, ...paths }
  const rawCache = new Map()
  const codeCache = new Map()
  const files = []
  const walk = (rel) => {
    const abs = join(root, rel)
    if (!existsSync(abs)) return
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(posix.join(rel, e.name))
      } else if (e.isFile()) files.push(posix.join(rel, e.name))
    }
  }
  for (const dir of p.scan) walk(dir)

  const read = (rel) => {
    if (!rawCache.has(rel)) rawCache.set(rel, existsSync(join(root, rel)) ? readFileSync(join(root, rel), "utf8") : null)
    return rawCache.get(rel)
  }
  const code = (rel) => {
    if (!codeCache.has(rel)) {
      const raw = read(rel)
      codeCache.set(rel, raw === null ? "" : stripComments(raw))
    }
    return codeCache.get(rel)
  }
  const isSource = (f) => SOURCE_EXT.test(f) && !f.endsWith(".d.ts")
  const isTest = (f) => TEST_FILE.test(`/${f}`)
  const isUseServer = (f) => /^\s*(["'])use server\1/.test(code(f))
  const under = (f, prefixes) => prefixes.some((x) => f === x || f.startsWith(x.endsWith("/") ? x : `${x}/`))

  /** 화면 파일: 화면 폴더 안의 소스 중 시험·서버 액션 모듈·api 경로(route handler)가 아닌 것 */
  const screens = () => files.filter((f) => isSource(f) && !isTest(f) && under(f, p.screenRoots) && !isUseServer(f) && !f.startsWith(`${p.appDir}/api/`))

  return { root, paths: p, files, read, code, isSource, isTest, isUseServer, under, screens }
}

/** 메일 링크가 닿는 경로를 app router 파일 규칙으로 풀어 낸 표 */
export function routeTable(ctx) {
  const dir = ctx.paths.appDir
  const out = []
  for (const f of ctx.files) {
    if (!f.startsWith(`${dir}/`)) continue
    const rel = f.slice(dir.length + 1)
    const m = /^(?:(.*)\/)?(page|route)\.(?:tsx?|jsx?|mdx|mjs)$/.exec(rel)
    if (!m) continue
    const segs = (m[1] ?? "")
      .split("/")
      .filter(Boolean)
      .filter((s) => !(s.startsWith("(") && s.endsWith(")") && !s.startsWith("(.")) && !s.startsWith("@"))
    if (segs.some((s) => s.startsWith("(."))) continue // 가로채기 경로는 자기 주소가 없다
    out.push({ file: f, segs, kind: m[2] })
  }
  return out
}

function matchSegs(pattern, parts) {
  if (pattern.length === 0) return parts.length === 0
  const [s, ...rest] = pattern
  if (/^\[\[\.\.\.[^\]]+\]\]$/.test(s)) return rest.length === 0
  if (/^\[\.\.\.[^\]]+\]$/.test(s)) return parts.length >= 1 && rest.length === 0
  if (parts.length === 0) return false
  if (/^\[[^\].]+\]$/.test(s) || s === parts[0]) return matchSegs(rest, parts.slice(1))
  return false
}

/** 주소(쿼리·해시 뺀)가 어느 경로 파일에 닿는지. 없으면 null */
export function resolveRoute(table, url, extra = []) {
  const path = url.split(/[?#]/)[0]
  if (!path.startsWith("/")) return { file: "(external)", segs: [] }
  const parts = path.split("/").filter(Boolean)
  const hit = table.find((r) => matchSegs(r.segs, parts))
  if (hit) return hit
  const clean = `/${parts.join("/")}`
  return extra.includes(clean) ? { file: "(extraRoutes)", segs: [] } : null
}
