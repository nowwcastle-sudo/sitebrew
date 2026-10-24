// README 검사(scripts/ci/readme-check.mjs): 어긋난 README 를 잡는가, 다섯 언어가 서로 같은가, 지금 README 는 통과하는가.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { checkAll, checkParity, checkReadme, gather, LANGS, ROOT, SWITCHER } from "../ci/readme-check.mjs"

// 언어마다 다른 것은 낱말뿐이다. 코드 블록·인라인 코드·버전·링크·표·제목 층·목록 수는 모두 같다.
const word = { ko: "요약", en: "summary", "zh-CN": "摘要", es: "resumen", ja: "概要" }
const mk = (lang) =>
  [
    SWITCHER,
    "",
    "# demo",
    `${LANGS[lang].cur} \`v1.2.0\`. ${LANGS[lang].pin} \`v0.0.11\`.`,
    "| Node | >=24.13.0 | x |",
    "| npm | >=11.6.2 | x |",
    "```bash",
    "npm run setup",
    "```",
    `- ${word[lang]} \`npm run setup\``,
    `## ${LANGS[lang].release}`,
    "| tag | date | text |",
    "|---|---|---|",
    `| \`v1.2.0\` | 2026-10-07 | ${word[lang]} — [link](docs/a.md) |`,
    "| `v1.1.0` | 2026-10-01 | prev |",
    "",
  ].join("\n")
const README = mk("ko")
const readmes = () => Object.fromEntries(Object.keys(LANGS).map((l) => [l, mk(l)]))
const base = {
  readme: README,
  pkg: { version: "1.2.0", engines: { node: ">=24.13.0", npm: ">=11.6.2" }, scripts: { setup: "x" } },
  tags: ["v1.1.0", "v1.0.0"],
  locks: { "template.lock.json": "v0.0.11", "contract.lock.json": "v0.0.11" },
  exists: () => true,
  kind: "launch-factory",
}
const run = (over = {}) => checkReadme({ ...base, ...over })
const runAll = (rs, over = {}) => checkAll({ ...base, readmes: rs, ...over })
const has = (problems, re) => assert.ok(problems.some((p) => re.test(p)), problems.join("\n") || "(문제 없음)")

test("맞는 README 는 문제 0건", () => assert.deepEqual(run(), []))

test("README 현재 버전이 package.json 보다 낮으면 잡는다", () => has(run({ readme: README.replace("현재 버전 `v1.2.0`", "현재 버전 `v1.1.0`") }), /현재 버전 v1\.1\.0 ≠ package\.json 1\.2\.0/))
test("현재 버전 문장이 없으면 잡는다", () => has(run({ readme: README.replace("현재 버전", "버전") }), /현재 버전.*문장이 없다/))
test("릴리스 기록 첫 행이 package.json 판이 아니면 잡는다", () => has(run({ pkg: { ...base.pkg, version: "1.3.0" }, readme: README.replace("현재 버전 `v1.2.0`", "현재 버전 `v1.3.0`") }), /릴리스 기록 첫 행 v1\.2\.0 ≠ package\.json 1\.3\.0/))
test("릴리스 기록이 내림차순이 아니면 잡는다", () => has(run({ readme: README.replace("| `v1.1.0`", "| `v1.2.5`") }), /내림차순/))
test("지난 행의 태그가 없으면 잡는다. 현재 행은 태그 전이어도 된다", () => {
  has(run({ tags: ["v1.0.0"] }), /v1\.1\.0 의 태그가 저장소에 없다/)
  assert.deepEqual(run(), [], "v1.2.0 태그는 없어도 통과")
})
test("릴리스 기록이 링크한 문서가 없으면 잡는다", () => has(run({ exists: (p) => p !== "docs/a.md" }), /링크 docs\/a\.md 파일이 없다/))
test("package.json 이 최신 태그보다 낮으면 잡는다", () => has(run({ tags: ["v1.1.0", "v1.4.0"] }), /최신 태그 v1\.4\.0 보다 낮다/))
test("--tag 가 package.json 판과 다르면 잡는다", () => {
  has(run({ expectTag: "v1.3.0" }), /--tag v1\.3\.0 ≠ package\.json v1\.2\.0/)
  assert.deepEqual(run({ expectTag: "v1.2.0" }), [])
})
test("필요 환경 표의 Node 판이 engines 와 다르면 잡는다", () => has(run({ readme: README.replace("| Node | >=24.13.0", "| Node | >=22.0.0") }), /node >=22\.0\.0 ≠ engines\.node >=24\.13\.0/))
test("README 가 없는 npm 스크립트를 가리키면 잡는다", () => has(run({ readme: README.replace("npm run setup", "npm run ghost") }), /npm run ghost.*scripts 에 없다/))
test("워크스페이스 명령(-w)은 루트 scripts 와 맞추지 않는다", () => assert.deepEqual(run({ readme: `${README}\n\`npm run dev -w template\`` }), []))
test("launch-factory: web-factory 고정이 잠금과 다르면 잡는다", () => has(run({ locks: { ...base.locks, "template.lock.json": "v0.0.10" } }), /web-factory 고정 v0\.0\.11 ≠ template\.lock\.json 잠금 v0\.0\.10/))
const SHA = "0bf633d24a8b112aa8a94c7bc1d95028cd49f898"
test("launch-factory: 출시 전 커밋 고정은 고정 줄에 해시 앞 8자가 있으면 맞다", () => {
  const readme = README.replace("`v0.0.11`.", "`v0.0.11` · `0bf633d2`.")
  assert.deepEqual(run({ readme, locks: { ...base.locks, "template.lock.json": SHA } }), [])
})
test("launch-factory: 커밋 고정인데 README 줄에 해시가 없거나 다르면 잡는다", () => {
  has(run({ locks: { ...base.locks, "template.lock.json": SHA } }), /고정 줄에 template\.lock\.json 잠금 커밋 `0bf633d2` 이 없다/)
  has(run({ readme: README.replace("`v0.0.11`.", "`v0.0.11` · `deadbeef`."), locks: { ...base.locks, "template.lock.json": SHA } }), /`0bf633d2` 이 없다/)
})
test("web-factory: 설치 주소 태그가 package.json 판과 다르면 잡는다", () => {
  const wf = { kind: "web-factory", readme: README.replace("```bash\nnpm run setup", "```bash\nnpm run setup\nnpx shadcn add x/web-factory/button#v1.1.0 -y -o") }
  has(run(wf), /설치 주소 #v1\.1\.0 ≠ package\.json 1\.2\.0/)
})

// ─── 다섯 언어 ───
test("언어마다 자기 낱말로 찾는다: 영어 문장이 없으면 영어 파일만 잡힌다", () => {
  const rs = readmes()
  rs.en = rs.en.replace("Current version", "Version")
  const p = runAll(rs)
  has(p, /^README\.md: README 에 「Current version/)
  assert.ok(p.every((x) => x.startsWith("README.md:")), p.join("\n"))
})
test("다섯 언어가 같으면 문제 0건", () => assert.deepEqual(runAll(readmes()), []))
test("파일이 하나 없으면 잡는다", () => has(runAll({ ...readmes(), ja: undefined }), /README\.ja\.md 가 없다/))

test("양성 대조: 한 언어만 버전을 바꾸면 그 파일이 실패한다", () => {
  const rs = readmes()
  rs.ja = rs.ja.replace("現在のバージョン `v1.2.0`", "現在のバージョン `v1.1.0`")
  has(runAll(rs), /^README\.ja\.md: README 현재 버전 v1\.1\.0 ≠ package\.json 1\.2\.0/)
})
test("양성 대조: 한 언어의 고정 태그만 바꾸면 언어끼리 검사도 잡는다", () => {
  const rs = readmes()
  rs.es = rs.es.replace("web-factory fijado `v0.0.11`", "web-factory fijado `v0.0.10`")
  const p = runAll(rs)
  has(p, /^README\.es\.md: README web-factory 고정 v0\.0\.10 ≠ template\.lock\.json/)
  has(p, /^README\.es\.md: 버전 문자열 묶음이 README\.ko\.md 와 다르다/)
})
test("코드 블록 한 글자가 다르면 잡는다", () => {
  const rs = readmes()
  rs["zh-CN"] = rs["zh-CN"].replace("```bash\nnpm run setup\n```", "```bash\nnpm  run setup\n```")
  has(checkParity(rs), /^README\.zh-CN\.md: 1번째 코드 블록이 README\.ko\.md 와 바이트가 다르다/)
})
test("코드 블록이 하나 모자라면 잡는다", () => {
  const rs = readmes()
  rs.en = rs.en.replace("```bash\nnpm run setup\n```\n", "")
  has(checkParity(rs), /^README\.md: 코드 블록 수 0 ≠ README\.ko\.md 1/)
})
test("인라인 코드·링크 대상이 다르면 잡는다", () => {
  const rs = readmes()
  rs.es = rs.es.replace("- resumen `npm run setup`", "- resumen `npm run doctor`").replace("[link](docs/a.md)", "[link](docs/b.md)")
  const p = checkParity(rs)
  has(p, /README\.es\.md: 인라인 코드 묶음.*npm run setup/)
  has(p, /README\.es\.md: 링크 대상 묶음.*docs\/a\.md/)
})
test("제목·표 줄·목록 항목이 다르면 잡는다", () => {
  const rs = readmes()
  rs.ja = rs.ja.replace("## リリース履歴", "### リリース履歴").replace("| `v1.1.0` | 2026-10-01 | prev |\n", "").replace(`- 概要 \`npm run setup\``, "")
  const p = checkParity(rs)
  has(p, /README\.ja\.md: 제목 층 순서/)
  has(p, /README\.ja\.md: 표 줄 수/)
  has(p, /README\.ja\.md: 목록 항목 수 0 ≠ README\.ko\.md 1/)
})
test("첫 줄 언어 전환 줄이 없거나 다르면 잡는다", () => {
  const rs = readmes()
  rs.en = rs.en.replace(SWITCHER, "[English](README.md)")
  rs.ko = rs.ko.replace(`${SWITCHER}\n\n`, "")
  const p = checkParity(rs)
  has(p, /README\.md: 첫 줄이 언어 전환 줄과 다르다/)
  has(p, /README\.ko\.md: 첫 줄이 언어 전환 줄과 다르다/)
})
test("줄 끝이 CRLF 여도 같은 글로 본다", () => {
  const rs = readmes()
  rs.en = rs.en.replace(/\n/g, "\r\n")
  assert.deepEqual(checkParity(rs), [])
})

// ─── 이 저장소의 실제 README 다섯 벌 ───
test("이 저장소의 실제 README 다섯 벌은 통과한다", () => assert.deepEqual(checkAll(gather()), []))

test("양성 대조: 실제 README 한 언어의 현재 버전을 낮추면 실패한다", () => {
  const input = gather()
  const rs = { ...input.readmes }
  const lowered = rs.ja.replace(new RegExp(`(${LANGS.ja.cur}[^\\n]*?\`v)\\d+\\.\\d+\\.\\d+`), "$10.0.1")
  assert.notEqual(lowered, rs.ja, "바꿀 문장을 찾았다")
  rs.ja = lowered
  const problems = checkAll({ ...input, readmes: rs })
  has(problems, /^README\.ja\.md: README 현재 버전 v0\.0\.1/)
  has(problems, /^README\.ja\.md: 버전 문자열 묶음이 README\.ko\.md 와 다르다/)
})
test("양성 대조: 실제 README 한 언어의 코드 블록 한 줄을 바꾸면 실패한다", () => {
  const input = gather()
  const rs = { ...input.readmes }
  const changed = rs.es.replace(/```(bash|powershell)\n/, "```$1\n# 바뀜\n")
  assert.notEqual(changed, rs.es, "바꿀 코드 블록을 찾았다")
  rs.es = changed
  has(checkAll({ ...input, readmes: rs }), /^README\.es\.md: \d+번째 코드 블록이 README\.ko\.md 와 바이트가 다르다/)
})

test("CLI: 통과하면 종료 코드 0, --tag 가 다르면 1", () => {
  const ok = spawnSync(process.execPath, ["scripts/ci/readme-check.mjs"], { cwd: ROOT, encoding: "utf8" })
  assert.equal(ok.status, 0, ok.stdout)
  assert.match(ok.stdout, /^readme-check: PASS/)
  const bad = spawnSync(process.execPath, ["scripts/ci/readme-check.mjs", "--tag", "v9.9.9"], { cwd: ROOT, encoding: "utf8" })
  assert.equal(bad.status, 1)
  assert.match(bad.stdout, /readme-check: FAIL/)
})
