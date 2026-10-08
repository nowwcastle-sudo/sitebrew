#!/usr/bin/env node
// launch-factory scripts/ci/tools.mjs 사본 — 고칠 때는 그쪽 원천을 고치고 다시 복사한다(이 줄과 사용법 경로만 다르다). tools.json 도 같은 사본이다.
// CI 도구 받기·찾기. 받는 곳은 이 저장소의 .tmp(또는 RUNNER_TEMP) 폴더뿐이다 — 이 PC 에 설치(winget·PATH 수정)하지 않는다.
//   node ci/tools.mjs fetch [이름…]   tools.json 의 대상(linux-x64·win32-x64) 파일을 받아 sha256 을 맞춘 뒤 풀고, 폴더를 GITHUB_PATH 에 더한다
//   node ci/tools.mjs where <이름>    실행 파일 경로(없으면 종료 1)
// resolveTool(): ① 받아 둔 폴더(대상별) ② PATH 순서로 찾는다. PATH 의 설치본은 버전을 못 박지 않는다(로컬 gitleaks 는 운영자 설치본).
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { delimiter, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// 이 파일은 web-factory 의 ci/tools.mjs 에도 그대로 복사된다 — 저장소 뿌리는 가까운 package.json 으로 찾고, tools.json 은 이 파일 옆에서 읽는다
const HERE = dirname(fileURLToPath(import.meta.url))
const findRoot = (d) => (existsSync(join(d, "package.json")) ? d : findRoot(dirname(d)))
export const ROOT = findRoot(HERE)
export const TOOLS = JSON.parse(readFileSync(join(HERE, "tools.json"), "utf8"))
delete TOOLS._comment

export const toolDir = () => process.env.LF_CI_TOOLS_DIR || join(process.env.RUNNER_TEMP || join(ROOT, ".tmp"), "lf-ci-tools")
const exe = (name, platform = process.platform) => (platform === "win32" ? `${name}.exe` : name)
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex")

/** 이 PC 의 대상 이름. 도구를 고정해 둔 두 조합 밖은 이유와 함께 던진다 */
export function currentTarget({ platform = process.platform, arch = process.arch } = {}) {
  const target = `${platform}-${arch}`
  if (target === "linux-x64" || target === "win32-x64") return target
  throw new Error(`${target}: 고정 도구가 없는 조합이다(linux-x64·win32-x64 만). PATH 의 설치본을 쓴다`)
}

const targetDir = (name, target) => join(toolDir(), `${name}-${TOOLS[name].version}-${target}`)

export function resolveTool(name) {
  const t = TOOLS[name]
  if (!t) throw new Error(`알 수 없는 도구: ${name}`)
  let target = null
  try {
    target = currentTarget()
  } catch {
    // 고정 도구가 없는 조합(맥 등): 받아 둔 폴더는 없고 PATH 만 본다
  }
  if (target) {
    const pinned = join(targetDir(name, target), exe(t.bin))
    if (existsSync(pinned)) return { path: pinned, source: "pinned" }
  }
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const p = join(dir, exe(t.bin))
    if (dir && existsSync(p)) return { path: p, source: "path" }
  }
  return null
}

function findFile(dir, name) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isFile() && e.name === name) return p
    if (e.isDirectory()) {
      const f = findFile(p, name)
      if (f) return f
    }
  }
  return null
}

function unpack(archive, file, into, name) {
  if (archive === "tar.gz") {
    const r = spawnSync("tar", ["-xzf", file], { cwd: into, encoding: "utf8" })
    if (r.status !== 0) throw new Error(`${name}: tar 실패 ${r.stderr}`)
  } else if (archive === "zip") {
    // Git Bash 의 GNU tar 는 zip 을 못 푼다 — Windows 에 늘 있는 PowerShell 로 푼다
    const q = (s) => `'${s.replaceAll("'", "''")}'`
    const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -LiteralPath ${q(file)} -DestinationPath ${q(into)} -Force`], { encoding: "utf8" })
    if (r.status !== 0) throw new Error(`${name}: Expand-Archive 실패 ${r.stderr || r.error}`)
  } else throw new Error(`${name}: 모르는 압축 형식 ${archive}`)
  rmSync(file)
}

export async function fetchTool(name, target = currentTarget()) {
  const t = TOOLS[name]
  if (!t) throw new Error(`알 수 없는 도구: ${name}`)
  const x = t.targets?.[target]
  if (!x) throw new Error(`${name}: ${target} 대상이 tools.json 에 없다`)
  const platform = target.split("-")[0]
  const binName = exe(t.bin, platform)
  const dir = targetDir(name, target)
  const bin = join(dir, binName)
  if (existsSync(bin)) return bin
  const res = await fetch(x.url, { redirect: "follow" })
  if (!res.ok) throw new Error(`${name}: ${x.url} → HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const got = sha256(buf)
  if (got !== x.sha256) throw new Error(`${name}: sha256 불일치 — 기대 ${x.sha256}, 받은 것 ${got}. 실행하지 않는다`)
  const tmp = `${dir}.part`
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  if (x.archive === "raw") writeFileSync(join(tmp, binName), buf)
  else {
    const file = join(tmp, `archive.${x.archive === "zip" ? "zip" : "tgz"}`)
    writeFileSync(file, buf)
    unpack(x.archive, file, tmp, name)
    // 압축 안의 위치는 도구마다 다르다(최상위 또는 하위 폴더) — 이름으로 찾아 최상위로 올린다
    const found = findFile(tmp, binName)
    if (!found) throw new Error(`${name}: 압축 안에 ${binName} 이 없다`)
    if (found !== join(tmp, binName)) renameSync(found, join(tmp, binName))
  }
  chmodSync(join(tmp, binName), 0o755)
  rmSync(dir, { recursive: true, force: true })
  renameSync(tmp, dir)
  return bin
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const [cmd, ...names] = process.argv.slice(2)
  try {
    if (cmd === "fetch") {
      const target = currentTarget()
      for (const name of names.length ? names : Object.keys(TOOLS)) {
        const bin = await fetchTool(name, target)
        console.log(`${name} ${TOOLS[name].version} ${target} sha256 ${TOOLS[name].targets[target].sha256.slice(0, 12)}… 확인 → ${bin}`)
        if (process.env.GITHUB_PATH) appendFileSync(process.env.GITHUB_PATH, `${dirname(bin)}\n`)
      }
    } else if (cmd === "where") {
      const r = resolveTool(names[0])
      if (!r) process.exitCode = 1
      else console.log(r.path)
    } else throw new Error("사용: tools.mjs fetch [이름…] | where <이름>")
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 2
  }
}
