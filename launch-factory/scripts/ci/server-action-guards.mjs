// 서버 액션 인증 정적 검사의 순수 부분(scripts/test/server-action-auth.test.mjs 가 쓴다).
// 서버 액션은 누구나 POST 로 부를 수 있는 공개 입구라서(Next.js data-security 가이드: 「각 액션 안에서 인증·인가를 다시 확인」)
// "use server" 파일이 내보내는 함수마다 ① 강한 가드 호출에 닿거나 ② 허용 목록에 이유와 함께 올라 있어야 한다.
// 「닿는다」 = 그 함수 몸통, 또는 같은 파일 안 도우미(session()·port()·actor() …)를 따라가다 가드 이름을 부른다.
import { readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { exportedNames } from "../ux-static/actions.mjs"

/** 강한 가드(인증·인가): session/actor = 세션을 읽고 없으면 로그인 요구 · runAdmin = 관리자 벽 · requireEntitlement = 요금제 권한. 이게 있어야 「가드 있음」이다 */
export const STRONG_RE = /(?<![\w$.])(?:session|actor|requireEntitlement|runAdmin|requireAdmin\w*)\s*\(|\.session\s*\(/
/** 약한 가드(인증이 아님): guardAction = 요청 제한 · gated/confirmed*Actions/requireConfirmation = 사람 확인(LFAX M03) · blockWhileImpersonating = 대리 로그인 차단. 이것만 있으면 허용 목록이 필요하다 */
export const WEAK_RE = /(?<![\w$.])(?:guardAction|gated|requireConfirmation|confirmed\w*Actions|blockWhileImpersonating)\s*\(/

const DECL_START = /^(?:export\s+(?:default\s+)?)?(?:async\s+function\b|function\b|const\b|let\b|var\b|class\b|type\b|interface\b|import\b)/

/** 최상위 선언(열 0 에서 시작)별 이름 → 본문 */
export function topLevelDecls(code) {
  const decls = new Map()
  let cur = null
  for (const line of code.split("\n")) {
    if (DECL_START.test(line)) {
      const m = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|type|interface)\s+([\w$]+)/.exec(line)
      cur = m ? { name: m[1], text: "" } : null
      if (cur) decls.set(cur.name, cur)
    }
    if (cur) cur.text += `${line}\n`
  }
  return decls
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
const escapeRe = (s) => s.replace(/[$]/g, "\\$&")

/** name 이 re 에 맞는 호출에 닿는가. 닿으면 닿은 경로(`port→session`)를, 아니면 null */
export function reachesGuard(name, decls, re, seen = new Set()) {
  if (seen.has(name)) return null
  seen.add(name)
  const d = decls.get(name)
  if (!d) return null
  const body = stripComments(d.text)
  const hit = re.exec(body)
  if (hit) return hit[0].replace(/[\s(]+$/, "").replace(/^\./, "")
  for (const other of decls.keys()) {
    if (other === name) continue
    if (new RegExp(`(?<![\\w$.])${escapeRe(other)}\\s*\\(`).test(body)) {
      const g = reachesGuard(other, decls, re, seen)
      if (g) return `${other}→${g}`
    }
  }
  return null
}

/** 파일 하나의 분석: [{ name, strong, weak }] — strong 이 null 이면 강한 가드에 안 닿는다 */
export function analyzeActionFile(code) {
  const decls = topLevelDecls(code)
  return exportedNames(code).map((name) => ({ name, strong: reachesGuard(name, decls, STRONG_RE), weak: reachesGuard(name, decls, WEAK_RE) }))
}

const SKIP = new Set(["node_modules", ".next", ".git", ".tmp", "dist"])
export function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/** 파일 맨 위가 아닌 자리의 "use server"(함수 안 지시어) — 이 검사가 못 보는 입구라서 발견하면 실패시킨다 */
export const INLINE_DIRECTIVE_RE = /^[ \t]+["']use server["']/m
const FILE_DIRECTIVE_RE = /^\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*["']use server["']/

/** root 아래 dirs 에서 "use server" 파일을 모은다. 반환: { files: [{ file(root 기준 / 구분), code }], inline: [파일…] } */
export function collectUseServerFiles(root, dirs) {
  const files = []
  const inline = []
  for (const d of dirs) {
    let all
    try {
      all = walk(join(root, d))
    } catch {
      continue
    }
    for (const f of all) {
      if (!/\.(?:ts|tsx|js|jsx|mjs)$/.test(f) || /\.test\.|\.d\.ts$/.test(f)) continue
      const code = readFileSync(f, "utf8")
      const rel = relative(root, f).split(sep).join("/")
      if (FILE_DIRECTIVE_RE.test(code)) files.push({ file: rel, code })
      else if (INLINE_DIRECTIVE_RE.test(code)) inline.push(rel)
    }
  }
  return { files, inline }
}
