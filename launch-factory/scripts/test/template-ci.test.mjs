// 제품 CI 상속 시험(LFCI) — template/ 의 CI 파일(.github · 보안 도구 설정 · scripts/ci)이 template.lock.json 에 잠겨 있고, 어긋나면 template:check 가 실패한다.
// 양성 대조: 임시 복사본에서 파일을 고치거나 잠금 행을 지워 각각 실패하는지 본다(저장소 실제 파일은 건드리지 않는다).
import assert from "node:assert/strict"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { check, CI_FROM, CI_OWN, CI_PATHS, CI_SHARED } from "../template-sync.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const lockOf = (template) => JSON.parse(readFileSync(join(template, "template.lock.json"), "utf8"))

test("저장소 상태: CI 상속 파일 전부가 잠겨 있고 template:check 가 통과한다", () => {
  const r = check()
  assert.deepEqual(r.problems, [])
  const lock = lockOf(join(ROOT, "template"))
  for (const p of CI_PATHS) assert.ok(lock.files.some((f) => f.path === p && f.from === CI_FROM), `${p} 가 잠금에 없다`)
  assert.ok(CI_PATHS.includes(".github/workflows/ci.yml") && CI_PATHS.includes(".github/dependabot.yml") && CI_PATHS.includes(".gitleaks.toml") && CI_PATHS.includes("osv-scanner.toml") && CI_PATHS.includes(".github/zizmor.yml"), "필수 다섯 파일")
})

test("제품 ci.yml 은 launch-factory 와 같은 규칙을 지킨다: 해시 고정·persist-credentials false·ci:verify 한 줄·최소 권한", () => {
  for (const file of ["../.github/workflows/launch-factory-ci.yml", "template/.github/workflows/ci.yml", "../.github/workflows/launch-product-ci.yml", "template/.github/workflows/ci-caller.yml.example"]) {
    const text = readFileSync(join(ROOT, file), "utf8")
    for (const m of text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
      const ref = m[1]
      if (ref.includes("<전체")) continue // 호출부 예시의 자리표시
      assert.match(ref, /@[0-9a-f]{40}$/, `${file}: ${ref} — 전체 커밋 해시로 고정해야 한다`)
    }
    assert.match(text, /^permissions:\n {2}contents: read$/m, `${file}: 최상위 permissions 가 contents: read 가 아니다`)
  }
  for (const file of ["../.github/workflows/launch-factory-ci.yml", "template/.github/workflows/ci.yml", "../.github/workflows/launch-product-ci.yml"]) {
    const text = readFileSync(join(ROOT, file), "utf8")
    assert.match(text, /persist-credentials: false/, `${file}: 체크아웃이 토큰을 남긴다`)
    assert.match(text, /run: npm run ci:verify/, `${file}: ci:verify 한 줄이어야 한다`)
  }
})

/**
 * 임시 복사본(template/ 통째 + scripts/ci 원천)을 만들어 mutate 한 뒤 check 문제 목록을 돌려준다.
 * 복사본은 <임시 뿌리>/launch-factory/ 에 둔다 — 조립 저장소(뿌리 아래 launch-factory/)와 같은 모양이라, 그 모양에서 잠금이 저장소 뿌리 파일을 비교할 때도 한 칸 위가 시스템 임시 폴더가 되지 않는다.
 */
function planted(mutate) {
  const outer = mkdtempSync(join(tmpdir(), "lf-tplci-"))
  const tmp = join(outer, "launch-factory")
  try {
    cpSync(join(ROOT, "template"), join(tmp, "template"), { recursive: true, filter: (s) => !/node_modules|\.next/.test(s) })
    cpSync(join(ROOT, "scripts", "ci"), join(tmp, "scripts", "ci"), { recursive: true })
    cpSync(join(ROOT, "registry", "dist"), join(tmp, "registry", "dist"), { recursive: true })
    for (const f of lockOf(join(ROOT, "template")).blocks?.rootFiles ?? []) cpSync(join(ROOT, "..", f.path), join(outer, f.path))
    const base = { template: join(tmp, "template"), root: tmp }
    assert.deepEqual(check({ ...base, lock: lockOf(base.template), root: ROOT }).problems, [], "심기 전에는 통과해야 한다(기준)")
    const lock = lockOf(base.template)
    const out = mutate({ tmp, template: base.template, lock })
    return check({ template: base.template, root: out?.root ?? tmp, lock: out?.lock ?? lock })
  } finally {
    rmSync(outer, { recursive: true, force: true })
  }
}

test("양성 대조: 결함을 하나씩 심으면 template:check 가 각각 잡는다", () => {
  const cases = [
    ["제품 .gitleaks.toml 을 손으로 고침", ({ template }) => writeFileSync(join(template, ".gitleaks.toml"), "# 허용 목록을 몰래 넓혔다\n"), /\.gitleaks\.toml: 해시가 잠금과 다르다/],
    ["제품 ci.yml 에서 보안 단계(ci:verify)를 뺌", ({ template }) => writeFileSync(join(template, ".github/workflows/ci.yml"), "name: CI\non: push\njobs: {}\n"), /ci\.yml: 해시가 잠금과 다르다/],
    ["dependabot.yml 삭제", ({ template }) => rmSync(join(template, ".github/dependabot.yml")), /dependabot\.yml: 없다/],
    ["잠금에서 zizmor.yml 행을 지움(검사 회피)", ({ lock }) => ({ lock: { ...lock, files: lock.files.filter((f) => f.path !== ".github/zizmor.yml") } }), /zizmor\.yml: 제품 CI 상속 파일이 잠금에 없다/],
    ["원천 tools.json 을 올렸는데 사본은 그대로", ({ tmp }) => writeFileSync(join(tmp, "scripts/ci/tools.json"), `${readFileSync(join(tmp, "scripts/ci/tools.json"), "utf8")}\n`), /tools\.json: 원천\(scripts\/ci\/tools\.json\)이 바뀌었는데/],
    ["사본 run-steps.mjs 를 제품에서 고침(보안 단계 지우기)", ({ template }) => writeFileSync(join(template, "scripts/ci/run-steps.mjs"), "export const SECURITY_STEPS = []\n"), /run-steps\.mjs: 해시가 잠금과 다르다/],
  ]
  for (const [name, mutate, re] of cases) {
    const found = planted(mutate).problems
    console.log(`  양성 대조 [${name}]:`, found)
    assert.ok(found.some((m) => re.test(m)), `${name}: 못 잡았다 ${JSON.stringify(found)}`)
  }
})

test("osv-scanner.toml 은 제품 것(owned) — 제품이 고쳐도 template:check 는 통과한다", () => {
  const problems = planted(({ template }) => writeFileSync(join(template, "osv-scanner.toml"), "# 제품이 자기 예외를 적었다\n")).problems
  assert.deepEqual(problems, [])
  const row = lockOf(join(ROOT, "template")).files.find((f) => f.path === "osv-scanner.toml")
  assert.equal(row.owned, true)
  assert.ok(CI_OWN.includes("osv-scanner.toml") && !CI_SHARED.includes("osv-scanner.toml"))
})
