// 얹기 엔진 공용 함수 — 글롭·파일 걷기·URL 계산. 규칙 모듈이 함께 쓴다.
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const escape = (s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&")

/** 글롭 → 정규식. `**` 는 폴더를 넘고(슬래시 포함) `*` 는 한 폴더 안이다. `**` 뒤에 슬래시가 오면 폴더 0개 이상이라 이름 앞부분은 맞히지 않는다(app 아래 page.tsx 글롭은 app/homepage.tsx 를 맞히지 않는다). 경로는 늘 슬래시다 */
export function globToRegExp(glob) {
  let re = ""
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === "*" && glob[i + 1] === "*") {
      i++
      if (glob[i + 1] === "/") {
        re += "(?:.*/)?"
        i++
      } else re += ".*"
    } else if (c === "*") re += "[^/]*"
    else re += escape(c)
  }
  return new RegExp(`^${re}$`)
}
export const matchesAny = (patterns, rel) => patterns.some((p) => globToRegExp(p).test(rel))

/** 이름 하나가 건너뛸 대상인가. 목록은 글롭(이름 단위)이고 `!` 로 시작하는 줄은 예외다(예: ".env.*" 는 빼고 "!.env.example" 은 남긴다) */
export function isSkipped(name, patterns) {
  const hit = (p) => globToRegExp(p).test(name)
  return patterns.some((p) => !p.startsWith("!") && hit(p)) && !patterns.some((p) => p.startsWith("!") && hit(p.slice(1)))
}

/** 건너뛸 이름 목록에 비밀 파일 패턴(rules.secretExclude)을 더한다 — 템플릿·벤더 패키지 복사가 같은 데이터를 쓴다 */
export const withSecrets = (rules, list) => [...list, ...rules.secretExclude]

/** 폴더 안 모든 파일의 상대 경로(슬래시, 정렬). 이름이 skip 에 든 폴더·파일은 어느 깊이든 건너뛴다 */
export function walk(dir, skip = [], base = "") {
  const out = []
  for (const name of readdirSync(join(dir, base)).sort()) {
    if (isSkipped(name, skip)) continue
    const rel = base ? `${base}/${name}` : name
    if (statSync(join(dir, rel)).isDirectory()) out.push(...walk(dir, skip, rel))
    else out.push(rel)
  }
  return out
}

/**
 * 복사할 파일 목록. git 이 추적하는 파일만(추적 안 한 .env.production.local 같은 로컬 파일이 출력에 새지 않는다).
 * git 저장소가 아니거나 추적 파일이 없는 폴더(git 없이 내보낸 키트)는 walk 로 걷고, 어느 쪽이든 skip 이름은 뺀다
 */
export function listFiles(dir, skip = []) {
  let tracked
  try {
    tracked = execFileSync("git", ["ls-files", "-z"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean)
  } catch {
    tracked = []
  }
  if (!tracked.length) return walk(dir, skip)
  return tracked.filter((rel) => !rel.split("/").some((name) => isSkipped(name, skip))).sort()
}

export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"))
export const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)

export function copyFileTo(from, to) {
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to)
}

const PAGE_FILE = /(?:^|\/)(?:page|route)\.(?:tsx?|jsx?)$/
/** app/ 아래 page·route 파일의 URL. route group `(x)` 는 URL 에 들지 않는다. page·route 파일이 아니면 null */
export function urlOf(rel) {
  if (!rel.startsWith("app/") || !PAGE_FILE.test(rel)) return null
  const segs = rel.slice("app/".length).split("/").slice(0, -1).filter((s) => !/^\(.*\)$/.test(s))
  return `/${segs.join("/")}`
}

/** 복사한 시안 파일 가운데 글자 파일(링크·import 를 고칠 수 있는 것) */
export const isTextFile = (rel) => /\.(?:tsx?|jsx?|mjs|json|css|mdx?)$/.test(rel)
