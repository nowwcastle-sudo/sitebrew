#!/usr/bin/env node
// 템플릿 조립 도구(v0 Task 10). template/ 안의 「가져온 파일」을 두 출처에서 채우고 잠금(template/template.lock.json)에 해시를 적는다.
//   blocks   web-factory 블록·레시피·계약 부품 — 로컬 저장소의 **커밋**에서 git archive → shadcn build → 로컬 레지스트리 → shadcn add (P3-3 Task 9 와 같은 방식)
//   features 이 저장소의 기능 번들(registry/dist/*.json)의 파일을 그대로 놓는다(shadcn add 가 하는 일과 같다 — 파일 내용·target 만 쓴다)
//   --check  네트워크 없이 잠금의 파일이 디스크와 같은지, 기능 번들 파일이 지금 registry/dist 와 같은지 본다(종료 1이면 어긋남)
// 사용:
//   node scripts/template-sync.mjs blocks --from <sitebrew checkout> --ref 1d3a61d [--work <폴더>]
//   node scripts/template-sync.mjs features
//   node scripts/template-sync.mjs ci          제품이 상속하는 CI 파일(.github · 보안 도구 설정 · scripts/ci)을 잠금에 올린다(LFCI)
//   node scripts/template-sync.mjs --check
// 「제품 것」(owned) 파일은 제품이 고치는 자리라 처음 놓을 때만 쓰고 잠금에는 이름만 적는다(해시 검사 제외).
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = fileURLToPath(new URL("..", import.meta.url))
export const TEMPLATE = join(ROOT, "template")
export const LOCK = join(TEMPLATE, "template.lock.json")
export const SHADCN = "4.21.0"
export const WEB_FACTORY = "nowwcastle-sudo/sitebrew"
/** 블록 설치 목록. 레시피 하나 + 계약 목 + 모션 + 대표 블록. 나머지 의존(공유 조각·부품·아이콘·서체)은 registryDependencies 로 따라온다 */
export const BLOCK_ITEMS = [
  "r1-measure",
  "adapter-mock",
  "attribution",
  "motion-gsap",
  "block-auth-sign-in",
  "block-auth-sign-up-consents",
  "block-auth-password-reset",
  "block-auth-new-password",
  "block-pricing-three-tier-cards",
  "block-paywall-upgrade-modal",
  "block-account-billing-manage",
  "block-account-profile-settings",
  "block-account-credentials",
  "block-account-security",
  "block-account-notification-consents",
  "block-account-delete-account",
  "block-retention-cancel-flow",
  "block-retention-renewal-consent",
  "block-retention-payment-failed-banner",
  "block-consent-bottom-banner",
  // 이메일 확인 안내(P1AB B2 — N06 의 한 종): 보낸 주소·다음 두 걸음·스팸함 안내·다시 보내기(대기 타이머)·주소 고치기 링크
  "block-confirmation-verify-email",
  // 제품 쉘·오류 화면(LFADA — P3-6 WFBLK-B): 사업자·약관 푸터, 세션 머리, 404·로딩·오류 화면
  "block-footer-product-legal",
  "block-nav-account-bar",
  "block-state-screen-error-retry",
  "block-state-screen-not-found",
  "block-state-screen-loading",
  // 상점(3a 레인 D): 장바구니·결제 폼, 주문 내역·상세 — 블록은 포트 메서드만 받고 템플릿의 서버 액션(app/actions/commerce.ts)에 이어진다
  "block-cart-lines-table",
  "block-cart-lines-cards",
  "block-cart-totals-summary",
  "block-cart-checkout-form",
  "block-account-order-history",
  "block-account-order-detail",
  // 상품 목록 입구(3d L4): 카드 격자 — 카드를 누르면 /cart?add=<상품 id> (담기 확인 줄이 뜬다)
  "block-product-list-grid-cards",
  // 관리 화면(3d 레인 L1): 구획 표·기록 상세·개요(KPI + 할 일)·사이드바·상단 줄 — 블록은 AdminPort 모양의 데이터만 안다
  "block-data-table-admin-list",
  "block-data-table-record-panel",
  "block-dashboard-panel-kpi-first",
  "block-dashboard-panel-action-list",
  "block-nav-app-sidebar",
  "block-nav-top-bar",
]
/** 기능 번들 목록(설치 순서). 선택 번들(gumroad·admin)은 제품이 고른다. 문의(inquiry)는 모든 제품이 문의 창구를 가져야 해서(K05) 기본이다 */
export const FEATURE_ITEMS = [
  "feature-email-resend",
  "feature-analytics-posthog",
  "feature-auth-betterauth",
  "feature-security",
  "feature-billing-paddle",
  "feature-consents",
  "feature-account-lifecycle",
  "feature-inquiry",
  "feature-payments-kr",
  "feature-commerce",
  "feature-reviews",
  "feature-search",
  "feature-storage",
  "feature-newsletter",
  "feature-booking",
  "feature-notify-kr",
  "feature-booking-deposit",
  "feature-push",
  "feature-admin-console",
]
/** 제품이 고치는 파일 — 처음에만 쓴다 */
export const OWNED = new Set(["lib/launch/config.ts", "lib/launch/enabled.json", "lib/launch/features.ts", "lib/launch/paddle-plans.ts", "lib/launch/support.ts", "lib/launch/catalog.ts", "lib/launch/commerce-session.ts", "lib/launch/admin-console.ts", "content/copy.admin-messages.en.ts", "lib/launch/purgers.ts", "lib/launch/booking-config.ts", "lib/launch/notify-kr-config.ts", "app/globals.css", "app/layout.tsx", "components.json", "osv-scanner.toml", "e2e/a11y-known.json"])
/** 제품이 CI 를 상속하는 파일(LFCI). from = "launch-factory-ci". 두 갈래:
 *  CI_SHARED — 저장소 뿌리의 같은 경로 파일을 그대로 복사한다(원천이 바뀌면 사본이 어긋나 template:check 가 잡는다). 도구 고정판 목록(tools.json)이 대표적이다.
 *  CI_OWN    — 제품용으로 template/ 안에서 직접 쓴 파일. 해시만 잠근다(손으로 고치면 template:check 가 잡는다). osv-scanner.toml · e2e/a11y-known.json 은 제품이 고치는 「제품 것」(OWNED). */
export const CI_FROM = "launch-factory-ci"
export const CI_SHARED = ["scripts/ci/tools.json", "scripts/ci/tools.mjs", "scripts/ci/run-steps.mjs", "scripts/ci/selftest-tools.mjs"]
export const CI_OWN = [
  ".github/workflows/ci.yml",
  ".github/workflows/ci-caller.yml.example",
  ".github/dependabot.yml",
  ".github/zizmor.yml",
  ".gitleaks.toml",
  "osv-scanner.toml",
  "scripts/ci/verify.mjs",
  // 빌드 스모크(LFSMOKE) — 오케스트레이터·순수부·Playwright 설정·시험. e2e/a11y-known.json 은 제품이 자기 쪽의 알려진 axe 위반을 적는 「제품 것」(OWNED)
  "scripts/ci/smoke.mjs",
  "scripts/ci/smoke-lib.mjs",
  "playwright.config.ts",
  "e2e/lib.ts",
  "e2e/smoke.mock.spec.ts",
  "e2e/smoke.live.spec.ts",
  // 한 바퀴 시험(LOOP) — 시험과 그 데이터(단계 id · 메일 기대 개수 · 선택자)
  "e2e/loop.mock.spec.ts",
  "e2e/loop-steps.json",
  "e2e/a11y-known.json",
]
export const CI_PATHS = [...CI_SHARED, ...CI_OWN]

const sha = (buf) => createHash("sha256").update(buf).digest("hex")
// 경로 인자 따옴표는 셸을 거치는 Windows 에서만 필요하다 — 다른 곳에서는 따옴표가 폴더 이름에 그대로 들어간다
const q = (p) => (process.platform === "win32" ? `"${p}"` : p)
const NPX = process.platform === "win32" ? "npx.cmd" : "npx"

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 256 << 20, env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1" } })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} 종료 ${r.status}\n${(r.stdout ?? "") + (r.stderr ?? "")}`.slice(-3000))
  return r.stdout
}

function walk(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, base, out)
    else out.push(relative(base, p).split(sep).join("/"))
  }
  return out
}

function readLock() {
  return existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, "utf8")) : { blocks: null, features: null, files: [] }
}
function writeLock(lock) {
  lock.files.sort((a, b) => a.path.localeCompare(b.path))
  writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`)
}
/** 한 출처의 파일 목록을 잠금에 넣는다(같은 출처의 옛 줄은 지운다) */
function putFiles(lock, from, rows) {
  lock.files = [...lock.files.filter((f) => f.from !== from), ...rows]
}
function fileRow(path, from, buf) {
  return OWNED.has(path) ? { path, from, owned: true } : { path, from, sha256: sha(buf) }
}

// ── blocks ──
export function localRegistry(srcDir, dest) {
  mkdirSync(dest, { recursive: true })
  let rewritten = 0
  for (const f of readdirSync(srcDir).filter((f) => f.endsWith(".json"))) {
    const text = readFileSync(join(srcDir, f), "utf8").replace(/nowwcastle-sudo\/sitebrew\/([a-z0-9-]+)(?:#v[0-9.]+)?/g, (_, name) => {
      rewritten++
      return `../localreg/${name}.json`
    })
    writeFileSync(join(dest, f), text)
  }
  return rewritten
}

/**
 * 설치용 사이트(shadcn add 가 의존을 ^ 범위로 다시 적은 package.json)에서 **없는 의존만** 템플릿 package.json 에 더한다(LFPIN12).
 * 이미 있는 의존은 판을 그대로 둔다 — 예전에는 설치된 최신 판을 모든 이름에 덮어써서 sync 때마다 lucide-react 등이 몰래 올라갔다.
 * 더하는 판은 설치된 정확한 판(`versionOf`)이다. @launch-factory/* 는 게시 전이라 더하지 않는다. 입력은 바꾸지 않고 새 객체를 돌려준다.
 */
export function mergeDependencies(tpl, installed, versionOf) {
  const out = { ...tpl }
  const present = new Set([...Object.keys(tpl.dependencies ?? {}), ...Object.keys(tpl.devDependencies ?? {})])
  for (const section of ["dependencies", "devDependencies"]) {
    const merged = { ...(tpl[section] ?? {}) }
    for (const name of Object.keys(installed[section] ?? {})) {
      if (name.startsWith("@launch-factory/") || present.has(name)) continue
      merged[name] = versionOf(name)
    }
    if (tpl[section] || Object.keys(merged).length) out[section] = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)))
  }
  return out
}

/**
 * 설치되는 항목(BLOCK_ITEMS 와 의존을 따라간 것)이 읽는 저장소 뿌리의 원본 파일과 그 해시. 잠금에 적어 두었다가 --check 가 뿌리의 지금 파일과 비교한다.
 * localregDir = shadcn build 결과를 주소만 바꿔 놓은 폴더, wfDir = 그 빌드가 읽은 web-factory 트리(경로는 저장소 뿌리 기준).
 */
export function blockSourceFiles(localregDir, wfDir, items = BLOCK_ITEMS) {
  const seen = new Set()
  const files = new Map()
  const queue = [...items]
  while (queue.length) {
    const name = queue.shift()
    if (seen.has(name)) continue
    seen.add(name)
    const file = join(localregDir, `${name}.json`)
    if (!existsSync(file)) continue
    const item = JSON.parse(readFileSync(file, "utf8"))
    for (const f of item.files ?? []) files.set(f.path, sha(readFileSync(join(wfDir, f.path))))
    for (const d of item.registryDependencies ?? []) {
      const m = /localreg\/([^/]+)\.json$/.exec(d)
      if (m) queue.push(m[1])
    }
  }
  return [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, sha256]) => ({ path, sha256 }))
}

export function syncBlocks({ from, ref, work }) {
  const commit = execFileSync("git", ["-C", from, "rev-parse", "--verify", `${ref}^{commit}`], { encoding: "utf8" }).trim()
  // 작업 폴더를 비우되 설치용 사이트의 node_modules 는 남긴다(다시 돌릴 때 npm install 이 2분 넘게 걸린다)
  for (const e of existsSync(work) ? readdirSync(work) : []) if (e !== "site") rmSync(join(work, e), { recursive: true, force: true })
  for (const e of existsSync(join(work, "site")) ? readdirSync(join(work, "site")) : []) if (e !== "node_modules") rmSync(join(work, "site", e), { recursive: true, force: true })
  const wf = join(work, "wf")
  mkdirSync(wf, { recursive: true })
  // git archive → tar. web-factory 작업 폴더는 건드리지 않는다(읽기만)
  const tar = spawnSync("git", ["-C", from, "archive", "--format=tar", commit], { maxBuffer: 512 << 20 })
  if (tar.status !== 0) throw new Error(`git archive 실패: ${tar.stderr}`)
  writeFileSync(join(work, "wf.tar"), tar.stdout)
  run("tar", ["-xf", "wf.tar", "-C", "wf"], work) // 상대 경로 — GNU tar 는 C: 를 원격 호스트로 읽는다
  run(NPX, ["-y", `shadcn@${SHADCN}`, "build", "-o", q(join(work, "r0"))], wf)
  const rewritten = localRegistry(join(work, "r0"), join(work, "localreg"))
  // 설치용 사이트: 템플릿 뼈대(설정 파일)만 복사한다
  const site = join(work, "site")
  mkdirSync(join(site, "app"), { recursive: true })
  for (const f of ["tsconfig.json", "postcss.config.mjs", "components.json"]) cpSync(join(TEMPLATE, f), join(site, f))
  // 설치용 사이트의 package.json: @launch-factory/* 는 게시 전이라 npm 이 못 받는다(404) → 뺀다. 나머지는 템플릿과 같다
  const tpl = JSON.parse(readFileSync(join(TEMPLATE, "package.json"), "utf8"))
  const keep = (deps) => Object.fromEntries(Object.entries(deps ?? {}).filter(([n]) => !n.startsWith("@launch-factory/")))
  writeFileSync(join(site, "package.json"), JSON.stringify({ ...tpl, dependencies: keep(tpl.dependencies), devDependencies: keep(tpl.devDependencies) }, null, 2))
  cpSync(join(ROOT, "scripts", "template-skeleton", "globals.css"), join(site, "app", "globals.css")) // shadcn init(next·base·nova) 결과 — 빈 파일이면 add 가 proxyOf 오류로 멈춘다
  writeFileSync(join(site, "app", "layout.tsx"), `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n`)
  const before = new Set(walk(site))
  run(NPX, ["-y", `shadcn@${SHADCN}`, "add", ...BLOCK_ITEMS.map((n) => `../localreg/${n}.json`), "-y", "-o"], site)
  // 정확한 판으로 고정한다(계획 Global Constraints): shadcn 이 더한 의존과 ^ 범위를 설치된 판으로 바꿔 템플릿 package.json 에 적는다
  const installed = JSON.parse(readFileSync(join(site, "package.json"), "utf8"))
  const exact = (name) => JSON.parse(readFileSync(join(site, "node_modules", ...name.split("/"), "package.json"), "utf8")).version
  writeFileSync(join(TEMPLATE, "package.json"), `${JSON.stringify(mergeDependencies(tpl, installed, exact), null, 2)}\n`)
  const rows = []
  for (const path of walk(site)) {
    if (before.has(path) && !["app/globals.css", "app/layout.tsx"].includes(path)) continue
    if (["package.json", "tsconfig.json", "postcss.config.mjs", "components.json", "package-lock.json"].includes(path)) continue
    const buf = readFileSync(join(site, path))
    const target = join(TEMPLATE, path)
    if (!(OWNED.has(path) && existsSync(target))) {
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, buf)
    }
    rows.push(fileRow(path, "web-factory", buf))
  }
  const lock = readLock()
  lock.blocks = { source: WEB_FACTORY, ref, commit, shadcn: SHADCN, items: BLOCK_ITEMS, rewrittenAddresses: rewritten, rootFiles: blockSourceFiles(join(work, "localreg"), wf) }
  putFiles(lock, "web-factory", rows)
  writeLock(lock)
  return { commit, files: rows.length }
}

// ── features ──
const distDir = () => join(ROOT, "registry", "dist")
export function syncFeatures() {
  const lock = readLock()
  const rows = new Map()
  for (const name of FEATURE_ITEMS) {
    const item = JSON.parse(readFileSync(join(distDir(), `${name}.json`), "utf8"))
    for (const f of item.files) {
      if (f.content === undefined) throw new Error(`${name}: ${f.path} 에 content 가 없다 — registry:build 를 먼저`)
      const target = join(TEMPLATE, f.target)
      if (!(OWNED.has(f.target) && existsSync(target))) {
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, f.content)
      }
      rows.set(f.target, fileRow(f.target, "launch-factory", Buffer.from(f.content)))
    }
  }
  lock.features = { items: FEATURE_ITEMS }
  putFiles(lock, "launch-factory", [...rows.values()])
  writeLock(lock)
  return { files: rows.size }
}

// ── ci (LFCI) ──
/** 제품이 상속하는 CI 파일을 잠금에 올린다. 공유 파일은 저장소 뿌리에서 template/ 으로 복사한다 */
export function syncCi() {
  const lock = readLock()
  const rows = []
  for (const path of CI_PATHS) {
    const target = join(TEMPLATE, path)
    if (CI_SHARED.includes(path)) {
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, readFileSync(join(ROOT, path)))
    }
    if (!existsSync(target)) throw new Error(`CI 파일이 없다: template/${path}`)
    const row = fileRow(path, CI_FROM, readFileSync(target))
    rows.push(CI_SHARED.includes(path) ? { ...row, source: path } : row)
  }
  putFiles(lock, CI_FROM, rows)
  writeLock(lock)
  return { files: rows.length }
}

// ── check ──
export function check({ template = TEMPLATE, root = ROOT, lock = readLock() } = {}) {
  const problems = []
  // CI 상속(LFCI): 필요한 파일이 모두 잠금에 있어야 한다(행을 지워 검사를 피하지 못하게). 공유 파일은 원천(저장소 뿌리)과 같아야 한다
  for (const path of CI_PATHS) {
    const row = lock.files.find((r) => r.path === path && r.from === CI_FROM)
    if (!row) {
      problems.push(`${path}: 제품 CI 상속 파일이 잠금에 없다 — \`template-sync.mjs ci\``)
      continue
    }
    if (row.source) {
      const src = join(root, row.source)
      if (!existsSync(src)) problems.push(`${path}: 원천 ${row.source} 가 없다`)
      else if (sha(readFileSync(src)) !== row.sha256) problems.push(`${path}: 원천(${row.source})이 바뀌었는데 템플릿 사본은 그대로다 — \`template-sync.mjs ci\` 로 다시 받는다`)
    }
  }
  if (!lock.blocks) problems.push("잠금에 blocks 가 없다 — `template-sync.mjs blocks` 를 먼저")
  if (!lock.features) problems.push("잠금에 features 가 없다 — `template-sync.mjs features` 를 먼저")
  for (const f of lock.files) {
    const p = join(template, f.path)
    if (!existsSync(p)) {
      problems.push(`${f.path}: 없다`)
      continue
    }
    if (f.owned) continue
    if (sha(readFileSync(p)) !== f.sha256) problems.push(`${f.path}: 해시가 잠금과 다르다(${f.from} 에서 온 파일을 손으로 고쳤다)`)
  }
  // 저장소 뿌리(web-factory 부분)의 지금 파일: 잠금을 만들 때 읽은 파일과 해시가 같은가. 잠금이 적은 커밋은 공개 이력에 없는 스냅샷이라 커밋으로는 확인할 수 없다 — 파일을 직접 비교한다.
  if (lock.blocks) {
    const wfRoot = join(root, "..")
    const rows = lock.blocks.rootFiles
    if (existsSync(join(wfRoot, "registry", "factory"))) {
      if (!rows) problems.push("잠금 blocks 에 rootFiles 가 없다 — `template-sync.mjs blocks` 를 다시 돌린다")
      else {
        for (const f of rows) {
          const p = join(wfRoot, f.path)
          if (!existsSync(p)) problems.push(`${f.path}: 저장소 뿌리에 없다(블록이 이 파일로 만들어졌다)`)
          else if (sha(readFileSync(p)) !== f.sha256) problems.push(`${f.path}: 저장소 뿌리의 파일이 잠금을 만든 뒤 바뀌었다 — \`template-sync.mjs blocks\` 를 다시 돌린다`)
        }
      }
    } else if (rows) problems.push(`저장소 뿌리(${wfRoot})를 찾지 못했다 — 잠금의 rootFiles 를 비교할 수 없다`)
  }
  // 기능 번들: 지금 registry/dist 의 내용과 잠금이 같은가(번들이 바뀌었는데 템플릿을 다시 안 만들었으면 어긋난다)
  if (lock.features) {
    // 같은 파일을 둘 이상의 항목이 내면 목록의 뒤 항목이 앞 항목을 대신한다(예: feature-notify-kr 의 booking-notify.ts 가 feature-booking 의 통로 없는 판을 대신한다) — 이긴 항목의 내용과만 견준다
    const winner = new Map()
    for (const name of lock.features.items) {
      const dist = join(root, "registry", "dist", `${name}.json`)
      if (existsSync(dist)) for (const f of JSON.parse(readFileSync(dist, "utf8")).files) winner.set(f.target, name)
    }
    for (const name of lock.features.items) {
      const dist = join(root, "registry", "dist", `${name}.json`)
      if (!existsSync(dist)) {
        problems.push(`registry/dist/${name}.json 이 없다`)
        continue
      }
      for (const f of JSON.parse(readFileSync(dist, "utf8")).files) {
        if (winner.get(f.target) !== name) continue
        const row = lock.files.find((r) => r.path === f.target && r.from === "launch-factory")
        if (!row) problems.push(`${f.target}: 잠금에 없다(${name})`)
        else if (!row.owned && row.sha256 !== sha(Buffer.from(f.content))) problems.push(`${f.target}: registry/dist/${name} 가 바뀌었다 — features 를 다시`)
      }
    }
  }
  return { problems, files: lock.files.length, blocks: lock.blocks?.commit, features: lock.features?.items.length }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2)
  const opt = (name, fallback) => {
    const i = rest.indexOf(name)
    return i === -1 ? fallback : rest[i + 1]
  }
  try {
    if (cmd === "blocks") {
      const from = opt("--from")
      const ref = opt("--ref")
      if (!from || !ref) throw new Error("사용: template-sync.mjs blocks --from <web-factory 저장소> --ref <커밋|태그> [--work <폴더>]")
      if (!/^[0-9a-f]{7,40}$|^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(ref)) throw new Error("ref 는 커밋 해시나 태그만 받는다(브랜치·main 에서 가져오지 않는다)")
      const r = syncBlocks({ from, ref, work: opt("--work", join(ROOT, ".tmp", "template-blocks")) })
      console.log(`블록 설치: web-factory@${r.commit.slice(0, 12)} 파일 ${r.files}개`)
    } else if (cmd === "features") {
      console.log(`기능 번들 설치: 파일 ${syncFeatures().files}개`)
    } else if (cmd === "ci") {
      console.log(`제품 CI 상속 파일 잠금: ${syncCi().files}개`)
    } else if (cmd === "--check") {
      const r = check()
      if (r.problems.length) {
        console.error(r.problems.join("\n"))
        console.error(`template:check 실패 — ${r.problems.length}건`)
        process.exitCode = 1
      } else console.log(`template:check 통과 — 잠금 파일 ${r.files}개 · web-factory@${String(r.blocks).slice(0, 12)} · 기능 번들 ${r.features}개`)
    } else throw new Error("사용: template-sync.mjs blocks|features|ci|--check")
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 2
  }
}
