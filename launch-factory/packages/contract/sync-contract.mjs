#!/usr/bin/env node
// web-factory 계약 가져오기와 판 검사 (launch-factory v0 Task 1, 접합면 J2).
//   node packages/contract/sync-contract.mjs --from <sitebrew checkout> --ref <커밋|태그>   로컬 저장소에서 git show 로 가져온다
//   node packages/contract/sync-contract.mjs --ref vX.Y.Z                                 gh api 로 원격에서 가져온다
//   node packages/contract/sync-contract.mjs --check                                      잠금과 파일 해시·판만 본다(네트워크 없음)
//   --out <폴더>: 잠금과 src/web-factory 가 있는 패키지 폴더(기본: 이 파일이 있는 폴더). 시험용.
// 가져온 파일의 `@/registry/factory/...` import 는 상대 경로 + .ts 로 바꿔 쓴다(Node 타입 제거로 바로 돈다).
// import 로 닿는 registry/factory 아래 파일은 목록에 없어도 따라가 가져온다. 잠금에는 원본 해시와 바꿔 쓴 파일 해시를 둘 다 적는다.
// 끝낼 때는 process.exitCode 만 정한다 — 네트워크 뒤 process.exit() 는 Windows libuv 충돌을 낸 적이 있다.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, posix, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { CONTRACT_VERSION_EXPECTED } from "./src/expected.ts"

export const SOURCE = "nowwcastle-sudo/sitebrew"
const ROOT = "registry/factory/"
const VENDOR = "src/web-factory"

/**
 * 가져올 목록. 「/」로 끝나면 그 아래 모든 파일이다. import 로 닿는 파일(block-contract.ts 등)은 자동으로 따라온다.
 * 적합성 묶음(web-factory P3-3 Task 15)이 태그에 실리면 한 줄을 더한다: `"registry/factory/contract/conformance/",`
 */
export const CONTRACT_FILES = [
  "registry/factory/contract/ports.ts",
  "registry/factory/contract/events.ts",
  "registry/factory/contract/attribution.ts",
]

const PKG_DIR = dirname(fileURLToPath(import.meta.url))
// 이 저장소의 뿌리(web-factory 부분): launch-factory/packages/contract -> 세 칸 위
const REPO_ROOT = resolve(PKG_DIR, "..", "..", "..")
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex")
const versionMessage = (n) => `web-factory 계약 판 ${n} — launch-factory는 ${CONTRACT_VERSION_EXPECTED}를 기대`

// 태그(vX.Y.Z) 또는 커밋 해시만 받는다 — 브랜치·main 에서 가져오지 않는다(계획 Global Constraints).
export function refAllowed(ref) {
  return /^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(ref) || /^[0-9a-f]{7,40}$/.test(ref)
}

function gitReader(from, ref) {
  const git = (...a) => execFileSync("git", ["-C", from, ...a], { maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] })
  return {
    commit: () => git("rev-parse", "--verify", `${ref}^{commit}`).toString().trim(),
    read: (p) => git("show", `${ref}:${p}`),
    list: (dir) => git("ls-tree", "-r", "--name-only", ref, "--", dir).toString().split("\n").filter(Boolean),
  }
}

function ghReader(ref) {
  const api = (path) => JSON.parse(execFileSync("gh", ["api", `repos/${SOURCE}/${path}`], { maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] }).toString())
  const contents = (p) => api(`contents/${p.replace(/\/$/, "")}?ref=${encodeURIComponent(ref)}`)
  const list = (dir) => contents(dir).flatMap((e) => (e.type === "dir" ? list(e.path) : [e.path]))
  return {
    commit: () => api(`commits/${encodeURIComponent(ref)}`).sha,
    read: (p) => Buffer.from(contents(p).content, "base64"),
    list,
  }
}

const vendoredPath = (repoPath) => `${VENDOR}/${repoPath.slice(ROOT.length)}`

// 한 파일의 import 를 찾아 바꿔 쓴다. 돌려주는 deps 는 저장소 경로다.
function rewriteImports(repoPath, text, errors) {
  const deps = []
  const out = text.replace(/((?:from|import)\s*["'])([^"']+)(["'])/g, (whole, pre, spec, post) => {
    if (spec.startsWith("node:")) return whole
    let target
    if (spec.startsWith("@/")) target = spec.slice(2)
    else if (spec.startsWith(".")) target = posix.normalize(posix.join(posix.dirname(repoPath), spec))
    else {
      errors.push(`${repoPath}: 패키지 import "${spec}" — 계약 파일은 외부 패키지를 부르지 않아야 한다`)
      return whole
    }
    if (!target.startsWith(ROOT)) {
      errors.push(`${repoPath}: 계약 밖 import "${spec}" — registry/factory 아래만 가져올 수 있다`)
      return whole
    }
    if (!/\.(ts|tsx|mjs|js|json)$/.test(target)) target += ".ts"
    deps.push(target)
    let rel = posix.relative(posix.dirname(vendoredPath(repoPath)), vendoredPath(target))
    if (!rel.startsWith(".")) rel = `./${rel}`
    return `${pre}${rel}${post}`
  })
  return { text: out, deps }
}

function readContractVersion(text) {
  const m = /export const CONTRACT_VERSION\s*=\s*(\d+)/.exec(text)
  return m ? Number(m[1]) : null
}

function readLock(out) {
  const p = join(out, "contract.lock.json")
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null
}

function listVendored(out) {
  const base = join(out, VENDOR)
  if (!existsSync(base)) return []
  return readdirSync(base, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => `${VENDOR}/${relative(base, join(d.parentPath, d.name)).split(sep).join("/")}`)
}

/** 가져오기. 판이 다르거나 오류가 있으면 아무것도 쓰지 않는다. */
export function syncContract({ from, ref, out = PKG_DIR, files = CONTRACT_FILES, log = console.log }) {
  const errors = []
  if (!ref || !refAllowed(ref)) return { ok: false, errors: [`--ref "${ref ?? ""}" — 태그(vX.Y.Z) 또는 커밋 해시만 받는다(브랜치 금지)`] }
  const reader = from ? gitReader(resolve(from), ref) : ghReader(ref)
  let commit
  let current = "커밋 확인"
  const fetched = new Map() // 저장소 경로 → { raw, text }
  try {
    commit = reader.commit()
    const queue = files.flatMap((f) => ((current = f), f.endsWith("/") ? reader.list(f) : [f]))
    while (queue.length) {
      const p = (current = queue.shift())
      if (fetched.has(p)) continue
      if (!p.startsWith(ROOT)) { errors.push(`${p}: registry/factory 밖`); continue }
      const raw = reader.read(p)
      const { text, deps } = rewriteImports(p, raw.toString("utf8"), errors)
      fetched.set(p, { raw, text })
      queue.push(...deps)
    }
  } catch (e) {
    errors.push(`가져오기 실패(${from ? `git ${from}` : "gh api"} @ ${ref}, ${current}): ${String(e.stderr || e.message).trim()}`)
  }
  if (errors.length) return { ok: false, errors }

  const events = fetched.get("registry/factory/contract/events.ts")
  const version = events ? readContractVersion(events.text) : null
  const prev = readLock(out)
  const newFiles = [...fetched.keys()].sort().map((p) => ({
    path: p,
    upstreamSha256: sha256(fetched.get(p).raw),
    vendored: vendoredPath(p),
    sha256: sha256(Buffer.from(fetched.get(p).text)),
  }))
  if (prev) {
    const old = new Map(prev.files.map((f) => [f.path, f.upstreamSha256]))
    for (const f of newFiles) if (old.get(f.path) !== f.upstreamSha256) log(`${old.has(f.path) ? "바뀜" : "새 파일"}: ${f.path}`)
    for (const p of old.keys()) if (!fetched.has(p)) log(`빠짐: ${p}`)
  }
  if (version === null) return { ok: false, errors: ["events.ts 에서 CONTRACT_VERSION 을 찾지 못했다"] }
  if (version !== CONTRACT_VERSION_EXPECTED) return { ok: false, errors: [versionMessage(version)] }

  rmSync(join(out, VENDOR), { recursive: true, force: true })
  for (const [p, { text }] of fetched) {
    const dest = join(out, vendoredPath(p))
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, text)
  }
  const lock = { source: SOURCE, ref, commit, contractVersion: version, files: newFiles }
  writeFileSync(join(out, "contract.lock.json"), `${JSON.stringify(lock, null, 2)}\n`)
  log(`가져옴: ${SOURCE}@${ref} (${commit.slice(0, 12)}) 파일 ${newFiles.length}개, 계약 판 ${version}`)
  return { ok: true, lock }
}

/** 잠금 대조. 바뀐·빠진·끼어든 파일과 판을 모두 모아 알린다. */
export function checkContract({ out = PKG_DIR, root = out === PKG_DIR ? REPO_ROOT : null, log = console.log } = {}) {
  const errors = []
  const lock = readLock(out)
  if (!lock) return { ok: false, errors: ["contract.lock.json 없음 — sync-contract 로 먼저 가져온다"] }
  const inLock = new Set()
  for (const f of lock.files) {
    inLock.add(f.vendored)
    const p = join(out, f.vendored)
    if (!existsSync(p)) errors.push(`빠짐: ${f.vendored}`)
    else if (sha256(readFileSync(p)) !== f.sha256) errors.push(`바뀜: ${f.vendored} (잠금 ${lock.ref})`)
  }
  for (const v of listVendored(out)) if (!inLock.has(v)) errors.push(`잠금에 없음: ${v}`)
  // 저장소 뿌리의 지금 파일: 잠금이 적은 원본 해시(upstreamSha256)와 같은가. 잠금의 커밋은 공개 이력에 없는 스냅샷이라 커밋 대신 파일을 직접 비교한다.
  if (root) {
    if (!existsSync(join(root, "registry", "factory", "contract"))) errors.push(`저장소 뿌리(${root})에 registry/factory/contract 가 없다 — 이 검사는 Sitebrew 저장소 안에서 돈다`)
    else {
      for (const f of lock.files) {
        const src = join(root, f.path)
        if (!existsSync(src)) errors.push(`뿌리에 없음: ${f.path}`)
        else if (sha256(readFileSync(src)) !== f.upstreamSha256) errors.push(`뿌리가 바뀜: ${f.path} — sync-contract 를 다시 돌린다`)
      }
    }
  }
  const eventsPath = join(out, VENDOR, "contract/events.ts")
  const version = existsSync(eventsPath) ? readContractVersion(readFileSync(eventsPath, "utf8")) : null
  if (version === null) errors.push("events.ts 에서 CONTRACT_VERSION 을 찾지 못했다")
  else if (version !== CONTRACT_VERSION_EXPECTED) errors.push(versionMessage(version))
  if (!errors.length) log(`계약 잠금 일치: ${lock.source}@${lock.ref} 파일 ${lock.files.length}개, 계약 판 ${version}`)
  return { ok: !errors.length, errors }
}

function parseArgs(argv) {
  const args = { check: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--check") args.check = true
    else if (a === "--from" || a === "--ref" || a === "--out") args[a.slice(2)] = argv[++i]
    else throw new Error(`모르는 인자: ${a}`)
  }
  return args
}

function main() {
  let res
  try {
    const args = parseArgs(process.argv.slice(2))
    const out = args.out ? resolve(args.out) : PKG_DIR
    res = args.check ? checkContract({ out }) : syncContract({ from: args.from, ref: args.ref, out })
  } catch (e) {
    res = { ok: false, errors: [e.message] }
  }
  for (const e of res.errors ?? []) console.error(e)
  process.exitCode = res.ok ? 0 : 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
