#!/usr/bin/env node
// 배포 전 환경 이름 점검(LFENV). 값은 어디서도 읽지 않는다 — 이름만 맞춰 본다.
//   사고: live-env.ts 가 INQUIRY_OWNER_EMAIL 을 필수로 더했는데 미리보기 환경에 그 이름이 없어 배포한 사이트가 전 쪽 500 이었다.
//   로컬 점검은 모두 mock 이라 못 잡았다 → 새로 필수가 된 이름이 배포 환경에 없으면 **배포 전에** 알린다.
//
//   node scripts/env-check.mjs                       오프라인(npm test 가 돈다): live 이름 ⊂ .env.example, 코드가 required("…") 로 읽는 이름 ⊂ .env.example
//   node scripts/env-check.mjs --names-file <파일>    + vercel pull 이 쓴 dotenv 파일의 이름(값은 읽지 않는다) — 미리보기 워크플로가 쓴다
//   node scripts/env-check.mjs --vercel [환경]        + `vercel env ls <환경>` 의 이름(기본 preview). CLI 가 없거나 로그인이 없으면 건너뛴다(--strict 면 실패)
// 필수 이름(LF_MODE·공급자 비밀·TEMPLATE_LIVE_NAMES)이 배포 환경에 없으면 오류(종료 1), 선택 이름(TEMPLATE_OPTIONAL_NAMES)이 없으면 ::warning:: 만 낸다(그 기능이 꺼진다).
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const NAME = /^[A-Z][A-Z0-9_]*$/

/** live 가 요구하는 이름과 없어도 켜지는 이름(이 저장소 코드가 정본 — 이 파일에 목록을 따로 적지 않는다) */
export async function liveRequirements(root = ROOT) {
  const { PROVIDER_SECRET_NAMES } = await import("@launch-factory/env")
  const { TEMPLATE_LIVE_NAMES, TEMPLATE_OPTIONAL_NAMES } = await import(pathToFileURL(join(root, "template/lib/live-env.ts")).href)
  return { required: ["LF_MODE", ...PROVIDER_SECRET_NAMES, ...TEMPLATE_LIVE_NAMES], optional: [...TEMPLATE_OPTIONAL_NAMES] }
}

/** dotenv 모양 글에서 이름만 꺼낸다(주석·빈 줄 제외, `export ` 허용). 값은 버린다 */
export function parseEnvNames(text) {
  const names = new Set()
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)
    if (m) names.add(m[1])
  }
  return names
}

/** `vercel env ls` 표 출력에서 이름 열만 꺼낸다(첫 칸이 대문자 이름인 줄). 값은 CLI 가 이미 암호화 표시로 가린다 */
export function parseVercelEnvLs(text) {
  const names = new Set()
  for (const line of text.split(/\r?\n/)) {
    const first = line.trim().split(/\s+/)[0] ?? ""
    if (NAME.test(first) && first.length > 1) names.add(first)
  }
  return names
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

/** 선택 이름이 없을 때 꺼지는 기능 — 경고 문구에 쓴다(없어도 사이트는 켜진다). 새 선택 이름을 더하면 여기에도 한 줄 */
export const OPTIONAL_EFFECT = {
  INQUIRY_OWNER_EMAIL: "문의 창구가 꺼진다",
  POSTHOG_HOST: "분석(PostHog)이 꺼진다 — POSTHOG_PROJECT_KEY 와 둘 다 있어야 켜진다. 동의 띠·쿠키 설정 링크도 사라진다",
  POSTHOG_PROJECT_KEY: "분석(PostHog)이 꺼진다 — POSTHOG_HOST 와 둘 다 있어야 켜진다. 동의 띠·쿠키 설정 링크도 사라진다",
  SENTRY_DSN: "오류 수집(Sentry)이 꺼진다",
}

/**
 * 켜질 때 검사(live-env.ts)에는 없지만 없으면 **실제로 깨지는** 이름 — 배포 환경에 없으면 경고한다(동작은 바꾸지 않는다. 권고는 docs/qa/lfenv.md §3).
 * POSTHOG_PERSONAL_API_KEY·POSTHOG_PROJECT_ID: 탈퇴 파기 Cron(lib/launch/account.ts)이 PostHog 사람·이벤트를 지울 때 쓴다. 분석이 켜져 있는데(POSTHOG_HOST 있음) 없으면
 * 그 지움 단계가 실패로 남고 계속 다시 시도한다(DB 파기는 그대로 돈다). 분석이 꺼져 있으면(POSTHOG_HOST·POSTHOG_PROJECT_KEY 중 하나라도 없음) 지울 것이 없어 필요 없다 — compare() 가 이 조건을 본다.
 */
export const UNCHECKED_AT_BOOT = {
  POSTHOG_PERSONAL_API_KEY: "분석이 켜져 있는데 없으면 탈퇴 파기 Cron 의 PostHog 지움 단계가 실패로 남는다",
  POSTHOG_PROJECT_ID: "분석이 켜져 있는데 없으면 탈퇴 파기 Cron 의 PostHog 지움 단계가 실패로 남는다",
}

/** 템플릿 코드가 `required("NAME")` 으로 읽는 이름과 읽는 곳 */
export function requiredInCode(root = ROOT) {
  const found = new Map()
  for (const sub of ["lib", "app", "components"]) {
    const dir = join(root, "template", sub)
    if (!existsSync(dir)) continue
    for (const f of walk(dir)) {
      for (const m of readFileSync(f, "utf8").matchAll(/\brequired\("([A-Z][A-Z0-9_]*)"\)/g)) {
        found.set(m[1], [...(found.get(m[1]) ?? []), relative(root, f).split("\\").join("/")])
      }
    }
  }
  return found
}

/** 오프라인 점검. 결과 { errors: string[], notes: string[] } */
export async function checkOffline(root = ROOT) {
  const errors = []
  const notes = []
  const example = parseEnvNames(readFileSync(join(root, ".env.example"), "utf8"))
  const { required, optional } = await liveRequirements(root)
  for (const n of [...required, ...optional]) {
    if (!example.has(n)) errors.push(`live 환경 이름 ${n} 이 .env.example 에 없다 — 이름과 뜻을 적는다(필수·선택 구분은 template/lib/live-env.ts)`)
  }
  const inCode = requiredInCode(root)
  const known = new Set([...required, ...optional])
  for (const [n, files] of inCode) {
    if (!example.has(n)) errors.push(`코드가 required("${n}") 로 읽는데(${files[0]}) .env.example 에 없다`)
    else if (!known.has(n)) notes.push(`${n}: 쓰는 순간(${files[0]})에야 없다고 던진다 — 켜질 때 검사(live-env.ts)에는 없다. 없으면 그 기능만 실패한다`)
  }
  return { errors, notes }
}

/** 배포 환경 이름 집합을 요구 이름과 비교한다 → { missingRequired, missingOptional } */
export function compare(deployed, { required, optional }) {
  const analyticsOn = deployed.has("POSTHOG_HOST") && deployed.has("POSTHOG_PROJECT_KEY") // 둘 다 있어야 분석이 켜진다(LFOBS2)
  const eraseKeys = Object.keys(UNCHECKED_AT_BOOT)
  return {
    missingRequired: required.filter((n) => !deployed.has(n)),
    missingOptional: optional.filter((n) => !deployed.has(n)),
    // 지움 키는 분석이 켜져 있을 때만 요구한다
    missingUnchecked: analyticsOn ? eraseKeys.filter((n) => !deployed.has(n)) : [],
    // 반대쪽: 지움 키는 있는데 분석이 꺼져 있다(호스트나 프로젝트 키 없음) — 분석을 껐다면 이미 쌓인 데이터를 못 지운다(호스트가 없으면 지역을 알 수 없다)
    eraseWithoutHost: !analyticsOn && eraseKeys.some((n) => deployed.has(n)),
  }
}

function vercelNames(environment) {
  const r = spawnSync("vercel", ["env", "ls", environment], { encoding: "utf8", shell: process.platform === "win32", timeout: 60_000 })
  if (r.error || r.status !== 0) return { skipped: `vercel env ls ${environment} 를 실행하지 못했다(${r.error?.code ?? `종료 ${r.status}`}) — CLI 설치·로그인·프로젝트 연결(vercel link)을 확인한다` }
  const names = parseVercelEnvLs(`${r.stdout}\n${r.stderr}`)
  return names.size ? { names } : { skipped: "vercel env ls 출력에서 이름을 한 개도 읽지 못했다 — 출력 모양이 바뀌었는지 본다" }
}

function arg(argv, flag) {
  const i = argv.indexOf(flag)
  return i < 0 ? undefined : (argv[i + 1]?.startsWith("--") ? "" : (argv[i + 1] ?? ""))
}

export async function main(argv = process.argv.slice(2), root = ROOT) {
  let failed = false
  const strict = argv.includes("--strict")
  const off = await checkOffline(root)
  for (const e of off.errors) {
    console.error(`::error::${e}`)
    failed = true
  }
  for (const n of off.notes) console.log(`::notice::${n}`)
  if (!off.errors.length) console.log(`env-check 오프라인 통과 — live 이름이 모두 .env.example 에 있고, required("…") 이름도 모두 있다`)

  const reqs = await liveRequirements(root)
  const sources = []
  const file = arg(argv, "--names-file")
  if (file !== undefined) {
    if (!file || !existsSync(file)) {
      console.error(`::error::--names-file 파일이 없다: ${file || "(빈 값)"}`)
      failed = true
    } else sources.push([`파일 ${file}`, parseEnvNames(readFileSync(file, "utf8"))])
  }
  if (argv.includes("--vercel")) {
    const environment = arg(argv, "--vercel") || "preview"
    const v = vercelNames(environment)
    if (v.skipped) {
      console.log(`::${strict ? "error" : "notice"}::${v.skipped}`)
      if (strict) failed = true
    } else sources.push([`vercel env ls ${environment}`, v.names])
  }
  for (const [label, names] of sources) {
    const { missingRequired, missingOptional, missingUnchecked, eraseWithoutHost } = compare(names, reqs)
    for (const n of missingUnchecked) console.log(`::warning title=Env name not checked at boot::${label} 에 ${n} 이 없다 — ${UNCHECKED_AT_BOOT[n]}. 켜질 때 검사에는 없는 이름이다`)
    if (eraseWithoutHost) console.log(`::warning title=PostHog erase keys without host::${label} 에 PostHog 지움 키는 있는데 POSTHOG_HOST·POSTHOG_PROJECT_KEY 중 하나가 없다 — 분석이 꺼져 있으면 이미 쌓인 데이터를 지울 수 없다(호스트가 없으면 지역을 모른다). 분석을 끈 것이 의도면 PostHog 쪽에 남은 데이터를 먼저 정리한다`)
    if (missingRequired.length) {
      console.error(`::error title=Missing required env names::${label} 에 필수 이름 ${missingRequired.length}개가 없다 — 이대로 배포하면 서버가 켜지지 않는다: ${missingRequired.join(", ")}`)
      failed = true
    }
    if (missingOptional.length) console.log(`::warning title=Optional env names missing::${label} 에 선택 이름이 없다 — 사이트는 켜지지만 그 기능이 꺼진다: ${missingOptional.map((n) => `${n}(${OPTIONAL_EFFECT[n] ?? "그 기능이 꺼진다"})`).join(", ")}`)
    if (!missingRequired.length) console.log(`${label}: 필수 이름 ${reqs.required.length}개 모두 있음, 선택 이름 ${reqs.optional.length - missingOptional.length}/${reqs.optional.length}개 있음`)
  }
  return failed ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main()
}
