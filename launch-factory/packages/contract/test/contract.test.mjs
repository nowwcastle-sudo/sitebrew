// @launch-factory/contract — sync-contract.mjs 판 검사·잠금 검사 (v0 Task 1, 접합면 J2, Review Focus 4).
// 가짜 web-factory 저장소(임시 git)를 만들어 가져오기·음성 대조(판 3)·바뀐 파일 검출을 본다. 네트워크는 쓰지 않는다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync, execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, appendFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { syncContract, CONTRACT_FILES } from "../sync-contract.mjs"

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..")
const CLI = join(PKG, "sync-contract.mjs")
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex")

function run(...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

function tmp(t) {
  const dir = mkdtempSync(join(tmpdir(), "lf-contract-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

// 현재 패키지의 잠금과 가져온 파일을 임시 폴더로 복사한다(원본은 건드리지 않는다).
function copyPackage(t) {
  const out = tmp(t)
  cpSync(join(PKG, "contract.lock.json"), join(out, "contract.lock.json"))
  cpSync(join(PKG, "src", "web-factory"), join(out, "src", "web-factory"), { recursive: true })
  return out
}

const C = "registry/factory/contract"
// 가짜 web-factory: 실제와 같은 모양(별칭 import·타입 전용)이고 내용은 최소다.
function fakeUpstream(t, { version = 2, extra = {} } = {}) {
  const repo = tmp(t)
  const files = {
    [`${C}/block-contract.ts`]: "export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }\n",
    [`${C}/events.ts`]: `export const EVENTS = ["page_view"] as const\nexport type EventName = (typeof EVENTS)[number]\nexport const CONTRACT_VERSION = ${version}\nexport interface EventProps { page_view: { path: string } }\n`,
    [`${C}/ports.ts`]: `import type { ActionResult } from "@/${C}/block-contract"\nimport type { EventName, EventProps } from "@/${C}/events"\nexport interface Attribution { blockId?: string }\nexport interface AnalyticsPort { track<N extends EventName>(n: N, p: EventProps[N], m?: { attribution?: Attribution }): void; consent(): boolean; setConsent(v: boolean): ActionResult<null> }\n`,
    [`${C}/attribution.ts`]: `import type { AnalyticsPort, Attribution } from "@/${C}/ports"\nexport function withAttribution(p: AnalyticsPort, a: Attribution): AnalyticsPort { void a; return p }\n`,
    ...extra,
  }
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(repo, dirname(p)), { recursive: true })
    writeFileSync(join(repo, p), body)
  }
  const git = (...a) => execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "core.autocrlf=false", ...a], { encoding: "utf8" }).trim()
  git("init", "-q")
  git("add", "-A")
  git("commit", "-q", "-m", "fake")
  return { repo, commit: git("rev-parse", "HEAD") }
}

test("--check: 현재 잠금과 가져온 파일이 맞으면 0", () => {
  const r = run("--check")
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /계약 판 2/)
})

test("--check: 파일 하나를 바꾸면 1이고 바뀐 경로를 출력한다", (t) => {
  const out = copyPackage(t)
  appendFileSync(join(out, "src/web-factory/contract/ports.ts"), "\n// 몰래 바꿈\n")
  const r = run("--check", "--out", out)
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /src\/web-factory\/contract\/ports\.ts/)
  assert.doesNotMatch(r.out, /src\/web-factory\/contract\/events\.ts/)
})

test("--check: 잠금에 없는 파일이 끼어 있으면 1", (t) => {
  const out = copyPackage(t)
  writeFileSync(join(out, "src/web-factory/contract/stray.ts"), "export {}\n")
  const r = run("--check", "--out", out)
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /stray\.ts/)
})

test("--check 음성 대조: 가져온 events.ts 가 판 3이면(잠금 해시까지 맞춰도) 1", (t) => {
  const out = copyPackage(t)
  const file = join(out, "src/web-factory/contract/events.ts")
  const body = readFileSync(file, "utf8").replace(/export const CONTRACT_VERSION = \d+/, "export const CONTRACT_VERSION = 3")
  writeFileSync(file, body)
  const lockPath = join(out, "contract.lock.json")
  const lock = JSON.parse(readFileSync(lockPath, "utf8"))
  for (const f of lock.files) if (f.vendored === "src/web-factory/contract/events.ts") f.sha256 = sha256(Buffer.from(body))
  writeFileSync(lockPath, JSON.stringify(lock, null, 2))
  const r = run("--check", "--out", out)
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /web-factory 계약 판 3 — launch-factory는 2를 기대/)
})

test("가져오기 양성 대조: 판 2 가짜 저장소 → 0, 잠금·import 바꿔 쓰기, 이어서 --check 0", (t) => {
  const { repo, commit } = fakeUpstream(t)
  const out = tmp(t)
  const r = run("--from", repo, "--ref", commit, "--out", out)
  assert.equal(r.code, 0, r.out)
  const lock = JSON.parse(readFileSync(join(out, "contract.lock.json"), "utf8"))
  assert.equal(lock.source, "nowwcastle-sudo/sitebrew")
  assert.equal(lock.commit, commit)
  assert.equal(lock.contractVersion, 2)
  // 목록 셋 + import 로 따라온 block-contract.ts
  assert.deepEqual(lock.files.map((f) => f.path).sort(), [`${C}/attribution.ts`, `${C}/block-contract.ts`, `${C}/events.ts`, `${C}/ports.ts`])
  for (const f of lock.files) assert.match(f.upstreamSha256, /^[0-9a-f]{64}$/)
  const ports = readFileSync(join(out, "src/web-factory/contract/ports.ts"), "utf8")
  assert.match(ports, /from "\.\/block-contract\.ts"/)
  assert.match(ports, /from "\.\/events\.ts"/)
  assert.doesNotMatch(ports, /@\/registry/)
  assert.equal(run("--check", "--out", out).code, 0)
})

test("가져오기 음성 대조: CONTRACT_VERSION = 3 가짜 파일 → 1, 메시지, 아무것도 쓰지 않는다", (t) => {
  const { repo, commit } = fakeUpstream(t, { version: 3 })
  const out = tmp(t)
  const r = run("--from", repo, "--ref", commit, "--out", out)
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /web-factory 계약 판 3 — launch-factory는 2를 기대/)
  assert.equal(existsSync(join(out, "contract.lock.json")), false)
  assert.equal(existsSync(join(out, "src")), false)
})

test("판이 바뀐 가져오기는 기존 잠금과 달라진 파일을 알린다", (t) => {
  const v2 = fakeUpstream(t)
  const out = tmp(t)
  assert.equal(run("--from", v2.repo, "--ref", v2.commit, "--out", out).code, 0)
  const v3 = fakeUpstream(t, { version: 3 })
  const r = run("--from", v3.repo, "--ref", v3.commit, "--out", out)
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /registry\/factory\/contract\/events\.ts/)
  assert.doesNotMatch(r.out, /바뀜: registry\/factory\/contract\/ports\.ts/)
})

test("브랜치 이름은 받지 않는다(태그 vX.Y.Z 또는 커밋 해시만)", (t) => {
  const { repo } = fakeUpstream(t)
  const r = run("--from", repo, "--ref", "main", "--out", tmp(t))
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /태그|커밋/)
})

test("디렉터리 항목 한 줄이면 그 아래 파일과 import 로 닿는 계약 밖 파일까지 가져온다(적합성 묶음 대비)", (t) => {
  const { repo, commit } = fakeUpstream(t, {
    extra: {
      [`${C}/conformance/billing.ts`]: `import type { AnalyticsPort } from "@/${C}/ports"\nimport { ok } from "@/registry/factory/lib/helper"\nexport const billingConformance = (p: AnalyticsPort) => ok(p)\n`,
      "registry/factory/lib/helper.ts": "export const ok = (v: unknown) => v !== undefined\n",
    },
  })
  const out = tmp(t)
  const res = syncContract({ from: repo, ref: commit, out, files: [...CONTRACT_FILES, `${C}/conformance/`], log: () => {} })
  assert.equal(res.ok, true, res.errors?.join("\n"))
  const billing = readFileSync(join(out, "src/web-factory/contract/conformance/billing.ts"), "utf8")
  assert.match(billing, /from "\.\.\/ports\.ts"/)
  assert.match(billing, /from "\.\.\/\.\.\/lib\/helper\.ts"/)
  assert.ok(existsSync(join(out, "src/web-factory/lib/helper.ts")))
})

test("src/index.ts 는 Node 타입 제거로 바로 불러와지고 판 2·withAttribution 을 내보낸다", async () => {
  const m = await import(pathToFileURL(join(PKG, "src/index.ts")).href)
  assert.equal(m.CONTRACT_VERSION, 2)
  assert.equal(m.CONTRACT_VERSION_EXPECTED, 2)
  assert.equal(typeof m.withAttribution, "function")
  assert.ok(m.EVENTS.includes("checkout_start"))
})

test("음성 대조: 판 3 계약을 실은 index.ts 는 불러오는 순간 멈춘다", async (t) => {
  const dir = tmp(t)
  cpSync(join(PKG, "src"), join(dir, "src"), { recursive: true })
  const events = join(dir, "src/web-factory/contract/events.ts")
  writeFileSync(events, readFileSync(events, "utf8").replace(/export const CONTRACT_VERSION = \d+/, "export const CONTRACT_VERSION = 3"))
  await assert.rejects(import(pathToFileURL(join(dir, "src/index.ts")).href), /web-factory 계약 판 3 — launch-factory는 2를 기대/)
})

test("registry/factory 밖을 부르는 import 는 거부한다", (t) => {
  const { repo, commit } = fakeUpstream(t, {
    extra: { [`${C}/attribution.ts`]: `import { cn } from "@/lib/utils"\nexport const x = cn\n` },
  })
  const res = syncContract({ from: repo, ref: commit, out: tmp(t), log: () => {} })
  assert.equal(res.ok, false)
  assert.match(res.errors.join("\n"), /@\/lib\/utils/)
})
