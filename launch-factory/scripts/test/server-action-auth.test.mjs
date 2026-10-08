// 서버 액션 인증 정적 시험 — "use server" 파일의 모든 export 가 강한 가드(세션·관리자·권한)에 닿거나 허용 목록(ci/baselines/server-action-auth.json)에
// 이유와 함께 올라 있어야 한다. 서버 액션은 직접 POST 로 부를 수 있어서 「화면이 가려 준다」는 보호가 아니다.
// 양성 대조: 가드 없는 export 를 심은 임시 폴더가 실패해야 시험이 산다(아래 「양성 대조」 시험).
import assert from "node:assert/strict"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { analyzeActionFile, collectUseServerFiles } from "../ci/server-action-guards.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const ALLOW = JSON.parse(readFileSync(join(ROOT, "ci", "baselines", "server-action-auth.json"), "utf8"))
const SCAN_DIRS = ["template", "registry"]
const keyOf = (file, name) => `${/(app\/actions\/[^/]+)$/.exec(file)?.[1] ?? file}#${name}`

/** root 를 훑어 { exports, violations, inline } 를 낸다. allow 는 허용 목록(기본: 저장소 것) */
export function evaluate(root, allow = ALLOW) {
  const { files, inline } = collectUseServerFiles(root, SCAN_DIRS)
  const exports = new Map() // key → { strong, file }
  for (const f of files) {
    for (const a of analyzeActionFile(f.code)) {
      const key = keyOf(f.file, a.name)
      const prev = exports.get(key)
      // 같은 키가 여러 사본(템플릿·번들)에 있으면 하나라도 가드가 없으면 가드 없음으로 본다
      exports.set(key, { strong: prev ? (prev.strong && a.strong) || null : a.strong, files: [...(prev?.files ?? []), f.file] })
    }
  }
  const allowed = new Map(allow.groups.flatMap((g) => g.targets.map((t) => [t, g])))
  const violations = [...exports].filter(([key, v]) => !v.strong && !allowed.has(key)).map(([key, v]) => `${key}  (${v.files.join(", ")})`)
  return { exports, allowed, violations, inline }
}

test("모든 서버 액션 export 는 강한 가드에 닿거나 허용 목록에 이유와 함께 올라 있다", () => {
  const r = evaluate(ROOT)
  assert.ok(r.exports.size > 40, `export 를 ${r.exports.size}개만 찾았다 — 수집이 깨졌다(기대 40개 이상)`)
  assert.deepEqual(r.violations, [], `가드 없는 서버 액션: 세션을 읽고 로그인 요구를 돌려주거나(권장), 공개 입구면 ci/baselines/server-action-auth.json 에 class·reason 과 함께 올린다`)
})

test("함수 안 \"use server\" 지시어는 없다(이 검사가 못 보는 입구)", () => {
  assert.deepEqual(evaluate(ROOT).inline, [])
})

test("허용 목록 위생: 이유·증거가 있고, 사라졌거나 이제 가드가 생긴 항목은 지운다(줄이기만 한다)", () => {
  const r = evaluate(ROOT)
  for (const g of ALLOW.groups) {
    assert.ok(["public", "port-delegated"].includes(g.class), `class: ${g.class}`)
    assert.ok(typeof g.reason === "string" && g.reason.length >= 20, `이유 없음: ${g.targets[0]}`)
    if (g.class === "port-delegated") {
      assert.ok(g.proof?.file && g.proof?.includes, `port-delegated 는 proof 가 있어야 한다: ${g.targets[0]}`)
      const p = join(ROOT, g.proof.file)
      assert.ok(existsSync(p), `proof 파일이 없다: ${g.proof.file}`)
      assert.ok(readFileSync(p, "utf8").includes(g.proof.includes), `proof 글이 ${g.proof.file} 에 없다: ${g.proof.includes}`)
    }
    for (const t of g.targets) {
      const e = r.exports.get(t)
      assert.ok(e, `허용 목록의 ${t} 는 이제 없는 export 다 — 목록에서 지운다`)
      assert.ok(!e.strong, `허용 목록의 ${t} 는 이제 강한 가드(${e.strong})가 있다 — 목록에서 지운다`)
    }
  }
  const all = ALLOW.groups.flatMap((g) => g.targets)
  assert.equal(new Set(all).size, all.length, "허용 목록에 같은 항목이 두 번 있다")
})

test("분석기 단위: 가드 있는 것·도우미를 따라가는 것·약한 가드뿐인 것·가드 없는 것을 가른다", () => {
  const code = `"use server"
import { x } from "y"
async function who() { return (await authPort()).session() }
async function port() { const s = await who(); return s ? build(s) : null }
export async function direct() { const s = await session(); return s }
export async function viaHelper() { return (await port())?.go() }
export async function weakOnly(i: unknown) { return confirmedBillingActions(p).go(i) }
export const arrow = async (i: unknown) => gated().then((g) => g.run(i))
export async function nothing(i: unknown) { return db.dropAll(i) }
`
  const by = Object.fromEntries(analyzeActionFile(code).map((a) => [a.name, a]))
  assert.ok(by.direct.strong)
  assert.match(by.viaHelper.strong, /port→who→session/)
  assert.equal(by.weakOnly.strong, null)
  assert.match(by.weakOnly.weak, /confirmedBillingActions/)
  assert.equal(by.arrow.strong, null)
  assert.equal(by.nothing.strong, null)
  assert.equal(by.nothing.weak, null)
})

test("양성 대조: 가드 없는 export 를 심으면 실패한다(저장소 허용 목록 그대로, 임시 복사본)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "lf-sa-auth-"))
  try {
    cpSync(join(ROOT, "template", "app", "actions"), join(tmp, "template", "app", "actions"), { recursive: true })
    assert.deepEqual(evaluate(tmp).violations, [], "심기 전에는 통과해야 한다(기준)")
    // 심기 1: 가드 없는 새 파일
    mkdirSync(join(tmp, "template", "app", "actions"), { recursive: true })
    writeFileSync(join(tmp, "template", "app", "actions", "_probe.ts"), `"use server"\nimport { db } from "@/lib/launch/db"\nexport async function dropAll() {\n  return (await db()).delete("everything")\n}\n`)
    const planted = evaluate(tmp)
    console.log("  양성 대조 출력:", planted.violations)
    assert.equal(planted.violations.length, 1)
    assert.match(planted.violations[0], /app\/actions\/_probe\.ts#dropAll/)
    // 심기 2: 약한 가드(사람 확인)만 있는 export 는 통과하지 못한다
    writeFileSync(join(tmp, "template", "app", "actions", "_probe.ts"), `"use server"\nexport async function wipe(i: unknown) {\n  return confirmedBillingActions(p).wipe(i)\n}\n`)
    assert.match(evaluate(tmp).violations[0], /_probe\.ts#wipe/)
    // 심기 3: 가드를 지우면(기존 파일에서 session 호출 제거) 실패한다
    rmSync(join(tmp, "template", "app", "actions", "_probe.ts"))
    const billing = join(tmp, "template", "app", "actions", "billing.ts")
    writeFileSync(billing, readFileSync(billing, "utf8").replace(/\.session\(\)/g, ".noop()").replace(/\bsession\(/g, "noop("))
    const stripped = evaluate(tmp).violations
    assert.ok(stripped.some((v) => v.includes("app/actions/billing.ts#getSubscription")), `session 가드를 지웠는데 통과: ${stripped}`)
    // 심기 4: 함수 안 "use server"
    writeFileSync(join(tmp, "template", "app", "actions", "_inline.ts"), `export async function f() {\n  "use server"\n  return 1\n}\n`)
    assert.deepEqual(evaluate(tmp).inline, ["template/app/actions/_inline.ts"])
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
