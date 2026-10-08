// check:ux-static 시험(LFSTATIC). 실제 템플릿을 양성 대조군으로 쓰고, 임시 폴더 고정물로 각 검사와 래칫의 경계를 본다.
// CLI 시험은 비동기 spawn 만 쓴다(spawnSync 로 부르면 같은 프로세스 안의 서버·이벤트 루프와 교착한다).
// 실행: node --test --test-force-exit --test-timeout=120000 scripts/test/ux-static.test.mjs
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { after, describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { analyze, compare } from "../ux-static/analyze.mjs"
import { stripComments } from "../ux-static/lib.mjs"

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const CLI = join(REPO, "scripts", "ux-static", "cli.mjs")
const realConfig = JSON.parse(readFileSync(join(REPO, "scripts", "ux-static", "promises.json"), "utf8"))
const realBaseline = JSON.parse(readFileSync(join(REPO, "scripts", "ux-static", "baseline.json"), "utf8"))

const dirs = []
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
})

/** { "상대/경로": "내용" } → 임시 뿌리 */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "uxs-"))
  dirs.push(root)
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), typeof text === "string" ? text : `${JSON.stringify(text, null, 2)}\n`)
  }
  return root
}

function runCli(args) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (b) => (stdout += b))
    child.stderr.on("data", (b) => (stderr += b))
    child.on("error", fail)
    child.on("close", (code) => done({ code, stdout, stderr }))
  })
}

const targets = (r, check) => r.failures.filter((f) => f.check === check).map((f) => f.target)

describe("양성 대조군 — 실제 템플릿", () => {
  const result = analyze(REPO, realConfig)

  // 양성 대조군은 아직 화면이 없는 실제 액션이다. 화면을 만들어 고치면(LFACCT 가 계정 화면으로 deleteAccount·exportMyData·changePassword·changeEmail·기기·동의 액션을 이었다)
  // 그 이름은 목록에서 빼고 다음 미해결 이름을 올린다 — 아래 둘은 baseline 에서 가져와 낡지 않는다
  test("화면이 안 부르는 액션: baseline 에 남은 actions-without-screen 이 모두 보고된다(검사가 실제 결함을 잡는다)", () => {
    const known = realBaseline.filter((b) => b.check === "actions-without-screen")
    assert.ok(known.length >= 3, "baseline 에 대조할 액션이 3개 이상 있어야 한다")
    const all = targets(result, "actions-without-screen")
    for (const b of known) assert.ok(all.includes(b.target), `${b.target} 가 보고에 없다 — 검사가 틀렸다`)
  })

  test("LFACCT 가 이은 계정 액션은 화면이 부른다고 인정된다(고친 것이 보고에서 빠진다)", () => {
    const all = targets(result, "actions-without-screen")
    for (const n of ["account.ts#deleteAccount", "account.ts#exportMyData", "auth.ts#changePassword", "auth.ts#changeEmail", "auth.ts#listSessions", "auth.ts#revokeSession", "auth.ts#revokeOtherSessions", "consents.ts#setMarketingConsents", "consents.ts#getMarketingConsents", "consents.ts#getMyConsentHistory", "auth.ts#updateProfile"]) {
      assert.ok(!all.some((t) => t.endsWith(n)), `${n} 는 계정 화면이 쓴다`)
    }
  })

  test("화면이 부르는 액션은 보고하지 않는다(product.ts 의 signIn·plans·cancel)", () => {
    const all = targets(result, "actions-without-screen")
    for (const n of ["product.ts#signIn", "product.ts#plans", "product.ts#cancel", "product.ts#session"]) assert.ok(!all.some((t) => t.endsWith(n)), `${n} 는 화면이 쓴다`)
  })

  // LFUX2(F04)가 두 쪽을 만들어 이 대조군은 「이제 통과한다」로 뒤집혔다. 검사가 죽은 링크를 잡는 능력은 아래 「검사 3(고정물)」이 계속 대조한다.
  test("가격 변경 동의·거절 경로는 이제 있다(F04) — 메일 링크 검사는 실제 템플릿에서 보고할 것이 없다", () => {
    const t = targets(result, "email-link-routes")
    assert.ok(!t.includes("/account/billing/price-change"))
    assert.ok(!t.includes("/account/billing/cancel"))
    assert.ok(!t.includes("/account/billing"), "/account/billing 은 있다")
    assert.ok(result.stats.emailLinks >= 3, "메일 링크를 실제로 읽었다(0건이 통과로 읽히지 않게)")
  })

  test("어긴 약속은 baseline 에 남은 것이 모두 실패로 잡힌다(검사가 실제 결함을 잡는다)", () => {
    const t = targets(result, "copy-promises")
    const known = realBaseline.filter((b) => b.check === "copy-promises")
    assert.ok(known.length >= 1, "baseline 에 대조할 약속이 1개 이상 있어야 한다(대부분 고쳐져 줄었다 — 검사가 잡는지는 고정물 시험이 따로 본다)")
    for (const b of known) assert.ok(t.includes(b.target), b.target)
  })

  test("LFUX1·LFACCT·LFUX2 가 지킨 약속은 이제 통과한다", () => {
    const t = targets(result, "copy-promises")
    for (const id of ["turn-off-in-settings", "marketing-manage-in-settings", "signup-name-later", "check-before-trial-ends", "taking-you-to-account", "contact-us-route", "contact-us-inquiry-wired", "security-notice-contact-us"]) assert.ok(!t.includes(id), id)
  })

  test("지켜지는 약속은 통과한다(양성의 반대편 — 모든 약속이 실패하는 검사가 아니다)", () => {
    const t = targets(result, "copy-promises")
    for (const id of ["change-plans-any-time", "cancel-any-time-account", "reset-link-email", "confirmation-email-sent", "price-change-consent-email"]) assert.ok(!t.includes(id), id)
    assert.ok(result.stats.promisesPassed >= 5)
  })

  test("baseline 에 적힌 약속은 글을 파일에서 찾는다(오타로 조용히 사라지지 않는다)", () => {
    assert.deepEqual(result.warnings, [])
  })

  test("지금 baseline 과 정확히 같다", () => {
    const c = compare(result.failures, realBaseline)
    assert.deepEqual(c.added.map((f) => f.target), [])
    assert.deepEqual(c.fixed.map((f) => f.target), [])
  })
})

describe("검사 1 — actions-without-screen (고정물)", () => {
  const action = (body) => `"use server"\n${body}\n`

  test("안 쓰는 액션은 보고하고 쓰는 액션은 보고하지 않는다", () => {
    const root = fixture({
      "template/app/actions/a.ts": action("export async function used() {}\nexport async function unused() {}\nexport const arrow = async () => {}"),
      "template/app/(product)/page.tsx": 'import { used } from "@/app/actions/a"\nexport default function P() { return <button onClick={() => used()} /> }',
    })
    const r = analyze(root, {})
    assert.deepEqual(targets(r, "actions-without-screen").sort(), ["template/app/actions/a.ts#arrow", "template/app/actions/a.ts#unused"])
  })

  test("별칭 가져오기·이름공간 가져오기·상대 경로·props 로 넘기는 사용을 쓴 것으로 센다", () => {
    const root = fixture({
      "template/app/actions/a.ts": action("export async function one() {}\nexport async function two() {}\nexport async function three() {}\nexport async function four() {}"),
      "template/app/(product)/x/page.tsx": 'import { one as first } from "../../actions/a"\nimport * as acts from "@/app/actions/a"\nexport default () => <B f={first} g={acts.two} />',
      "template/components/c.tsx": 'import { three } from "@/app/actions/a"\nexport const C = () => <D action={three} />',
    })
    assert.deepEqual(targets(analyze(root, {}), "actions-without-screen"), ["template/app/actions/a.ts#four"])
  })

  test("이름공간을 통째로 넘기면 전부 쓴 것으로 본다", () => {
    const root = fixture({
      "template/app/actions/a.ts": action("export async function one() {}\nexport async function two() {}"),
      "template/app/(product)/page.tsx": 'import * as acts from "@/app/actions/a"\nexport default () => <B actions={acts} />',
    })
    assert.deepEqual(targets(analyze(root, {}), "actions-without-screen"), [])
  })

  test("시험·다른 액션·api 경로·주석·타입 가져오기만으로는 쓴 것으로 세지 않는다", () => {
    const root = fixture({
      "template/app/actions/a.ts": action("export async function lonely() {}"),
      "template/app/actions/b.ts": action('import { lonely } from "./a"\nexport async function other() { return lonely() }'),
      "template/app/api/hook/route.ts": 'import { lonely } from "@/app/actions/a"\nexport const POST = () => lonely()',
      "template/app/(product)/page.tsx": '// import { lonely } from "@/app/actions/a"\nimport type { lonely as T } from "@/app/actions/a"\nexport default () => null',
      "template/test/a.test.mjs": 'import { lonely } from "../app/actions/a.ts"\nlonely()',
    })
    const t = targets(analyze(root, {}), "actions-without-screen")
    assert.ok(t.includes("template/app/actions/a.ts#lonely"))
  })

  test('"use server" 가 아닌 모듈은 보지 않는다', () => {
    const root = fixture({ "template/lib/helpers.ts": "export function notAnAction() {}" })
    assert.deepEqual(targets(analyze(root, {}), "actions-without-screen"), [])
  })

  test("app/actions 밖의 use server 모듈도 본다", () => {
    const root = fixture({ "template/lib/server.ts": action("export async function elsewhere() {}") })
    assert.deepEqual(targets(analyze(root, {}), "actions-without-screen"), ["template/lib/server.ts#elsewhere"])
  })
})

describe("검사 3 — email-link-routes (고정물)", () => {
  const files = {
    "template/lib/config.ts": 'export const ROUTES = { home: "/", pay: "/pay", acct: "/account/42?tab=1", gone: "/gone", docs: "/docs/a/b" }\nexport const AFTER = "/welcome/done"',
    "template/app/(product)/page.tsx": "export default () => null",
    "template/app/(product)/pay/page.tsx": "export default () => null",
    "template/app/(product)/account/[id]/page.tsx": "export default () => null",
    "template/app/docs/[...slug]/page.tsx": "export default () => null",
    "template/app/(legal)/(marketing)/welcome/done/page.tsx": "export default () => null",
  }
  const config = { emailLinks: [{ file: "template/lib/config.ts", object: "ROUTES" }, { file: "template/lib/config.ts", const: "AFTER" }] }

  test("경로 묶음 (group)·동적 [id]·[...slug]·쿼리를 풀고, 없는 경로만 보고한다", () => {
    const r = analyze(fixture(files), config)
    assert.deepEqual(targets(r, "email-link-routes"), ["/gone"])
  })

  test("선택 catch-all [[...x]] 는 뿌리도 받는다, extraRoutes 는 있는 것으로 친다", () => {
    const root = fixture({
      "template/lib/config.ts": 'export const ROUTES = { a: "/shop", b: "/redir" }',
      "template/app/shop/[[...rest]]/page.tsx": "export default () => null",
    })
    const cfg = { emailLinks: [{ file: "template/lib/config.ts", object: "ROUTES" }] }
    assert.deepEqual(targets(analyze(root, cfg), "email-link-routes"), ["/redir"])
    assert.deepEqual(targets(analyze(root, { ...cfg, extraRoutes: ["/redir"] }), "email-link-routes"), [])
  })

  test("링크 원천을 못 읽으면 실패가 아니라 경고다", () => {
    const r = analyze(fixture({ "template/lib/x.ts": "export const Y = 1" }), { emailLinks: [{ file: "template/lib/x.ts", object: "ROUTES" }] })
    assert.equal(r.warnings.length, 1)
  })
})

describe("검사 2 — copy-promises (고정물)", () => {
  const base = {
    "template/content/copy.en.ts": 'export const c = { a: "Turn it off any time in settings.", b: "We will email you when it ends.", d: "Reach us anywhere" }\n// "commented out promise"',
    "template/app/(product)/settings/page.tsx": "export default () => null",
    "packages/email/src/mail.ts": 'export const send = (m) => m.send({ to: "x", template: "ending", input: {} })',
  }
  const p = (over) => ({ id: "t", item: "X1", copy: { file: "template/content/copy.en.ts", match: "turn it off any time in settings" }, ...over })

  test("route: 있으면 통과, 없으면 실패(대안 중 하나면 된다)", () => {
    const root = fixture(base)
    const ok = analyze(root, { promises: [p({ probe: { type: "route", routes: ["/nope", "/settings"] } })] })
    assert.deepEqual(ok.failures, [])
    const bad = analyze(root, { promises: [p({ probe: { type: "route", routes: ["/nope"] } })] })
    assert.deepEqual(targets(bad, "copy-promises"), ["t"])
    assert.equal(bad.failures[0].item, "X1")
  })

  test("symbol-called: 화면이 쓰면 통과, in 으로 범위를 좁힐 수 있다", () => {
    const root = fixture({ ...base, "template/components/s.tsx": "export const S = () => <B onChange={setConsents} />" })
    assert.deepEqual(analyze(root, { promises: [p({ probe: { type: "symbol-called", symbols: ["setConsents"] } })] }).failures, [])
    const narrowed = analyze(root, { promises: [p({ probe: { type: "symbol-called", symbols: ["setConsents"], in: ["template/app"] } })] })
    assert.deepEqual(targets(narrowed, "copy-promises"), ["t"])
  })

  test("symbol-called: 주석에만 나온 이름은 쓴 것이 아니다", () => {
    const root = fixture({ ...base, "template/components/s.tsx": "// setConsents 는 나중에\nexport const S = () => null" })
    assert.deepEqual(targets(analyze(root, { promises: [p({ probe: { type: "symbol-called", symbols: ["setConsents"] } })] }), "copy-promises"), ["t"])
  })

  test("email-sent: 템플릿 id 가 보내기 호출에 실리면 통과, 없으면 실패, via 는 정의한 파일 밖의 호출이 필요하다", () => {
    const root = fixture(base)
    assert.deepEqual(analyze(root, { promises: [p({ probe: { type: "email-sent", templates: ["ending"] } })] }).failures, [])
    assert.deepEqual(targets(analyze(root, { promises: [p({ probe: { type: "email-sent", templates: ["trialEnding"] } })] }), "copy-promises"), ["t"])
    const viaMissing = analyze(root, { promises: [p({ probe: { type: "email-sent", templates: ["ending"], via: "endingNotice" } })] })
    assert.deepEqual(targets(viaMissing, "copy-promises"), ["t"])
    const wired = fixture({ ...base, "template/lib/use.ts": "export const go = () => mail.endingNotice()" })
    assert.deepEqual(analyze(wired, { promises: [p({ probe: { type: "email-sent", templates: ["ending"], via: "endingNotice" } })] }).failures, [])
  })

  test("글이 파일에서 사라졌으면(주석에만 남았어도) 실패가 아니라 경고다", () => {
    const root = fixture(base)
    const r = analyze(root, { promises: [p({ copy: { file: "template/content/copy.en.ts", match: "commented out promise" }, probe: { type: "route", routes: ["/nope"] } })] })
    assert.deepEqual(r.failures, [])
    assert.equal(r.warnings.length, 1)
  })

  test("JSON 글은 key 로 찾는다", () => {
    const root = fixture({ ...base, "packages/i18n/en.json": { email: { note: "contact us" } } })
    const cfg = (key) => ({ promises: [p({ copy: { file: "packages/i18n/en.json", key }, probe: { type: "route", routes: ["/nope"] } })] })
    assert.deepEqual(targets(analyze(root, cfg("email.note")), "copy-promises"), ["t"])
    assert.equal(analyze(root, cfg("email.missing")).warnings.length, 1)
  })

  test("알 수 없는 probe.type 은 던진다", () => {
    assert.throws(() => analyze(fixture(base), { promises: [p({ probe: { type: "vibes" } })] }), /probe\.type/)
  })
})

describe("주석 제거", () => {
  test("문자열 안의 // 는 남기고 주석은 지운다", () => {
    const out = stripComments('const u = "http://x.test" // tail\n/* block\nmore */ const v = 1')
    assert.ok(out.includes("http://x.test"))
    assert.ok(!out.includes("tail") && !out.includes("block"))
    assert.equal(out.split("\n").length, 3)
  })
})

describe("CLI 래칫", () => {
  const clean = {
    "template/app/actions/a.ts": '"use server"\nexport async function used() {}',
    "template/app/(product)/page.tsx": 'import { used } from "@/app/actions/a"\nexport default () => <B f={used} />',
    "template/lib/config.ts": 'export const ROUTES = { home: "/" }',
    "promises.json": { emailLinks: [{ file: "template/lib/config.ts", object: "ROUTES" }], promises: [] },
  }
  const args = (root, extra = []) => ["--root", root, "--config", join(root, "promises.json"), "--baseline", join(root, "baseline.json"), ...extra]

  test("실패가 없고 baseline 도 비면 종료 코드 0", async () => {
    const root = fixture({ ...clean, "baseline.json": [] })
    const r = await runCli(args(root))
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /OK/)
  })

  test("baseline 에 없는 새 실패는 종료 코드 1", async () => {
    const root = fixture({ ...clean, "template/lib/config.ts": 'export const ROUTES = { home: "/", gone: "/gone" }', "baseline.json": [] })
    const r = await runCli(args(root))
    assert.equal(r.code, 1)
    assert.match(r.stdout, /NEW\s+email-link-routes\s+\/gone|email-link-routes\s+\/gone\s+\?\s+NEW/)
  })

  test("baseline 에 있는 실패가 그대로면 종료 코드 0, --json 은 known 으로 싣는다", async () => {
    const root = fixture({
      ...clean,
      "template/lib/config.ts": 'export const ROUTES = { home: "/", gone: "/gone" }',
      "baseline.json": [{ check: "email-link-routes", target: "/gone", item: "F04" }],
    })
    const r = await runCli(args(root, ["--json"]))
    assert.equal(r.code, 0, r.stdout + r.stderr)
    const j = JSON.parse(r.stdout)
    assert.equal(j.ok, true)
    assert.deepEqual(j.failures.map((f) => [f.target, f.item, f.status]), [["/gone", "F04", "known"]])
    assert.deepEqual(j.counts, { failures: 1, baseline: 1, new: 0, fixed: 0 })
  })

  test("baseline 항목이 이제 통과하면 종료 코드 1 이고 「fixed — remove from baseline」 을 찍는다", async () => {
    const root = fixture({ ...clean, "baseline.json": [{ check: "email-link-routes", target: "/gone", item: "F04" }] })
    const r = await runCli(args(root))
    assert.equal(r.code, 1)
    assert.match(r.stdout, /fixed — remove from baseline/)
  })

  test("--json: 새 실패 + 고쳐진 항목을 함께 싣는다", async () => {
    const root = fixture({
      ...clean,
      "template/lib/config.ts": 'export const ROUTES = { home: "/", fresh: "/fresh" }',
      "baseline.json": [{ check: "email-link-routes", target: "/old", item: "F04" }],
    })
    const r = await runCli(args(root, ["--json"]))
    assert.equal(r.code, 1)
    const j = JSON.parse(r.stdout)
    assert.equal(j.ok, false)
    assert.deepEqual(j.failures.map((f) => [f.target, f.status]), [["/fresh", "NEW"]])
    assert.deepEqual(j.fixed.map((f) => f.target), ["/old"])
  })

  test("item 이 빠진 baseline 은 설정 오류(종료 코드 2)", async () => {
    const root = fixture({ ...clean, "baseline.json": [{ check: "email-link-routes", target: "/gone" }] })
    const r = await runCli(args(root))
    assert.equal(r.code, 2)
    assert.match(r.stderr, /item/)
  })

  test("알 수 없는 옵션은 종료 코드 2", async () => {
    const r = await runCli(["--nope"])
    assert.equal(r.code, 2)
  })

  test("실제 저장소: baseline 과 같으면 종료 코드 0", async () => {
    const r = await runCli([])
    assert.equal(r.code, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /new 0 · fixed 0/)
  })
})
