#!/usr/bin/env node
// README 다섯 벌이 지금 상태와 맞는지, 그리고 서로 같은 내용인지 본다. 릴리스마다 README 를 같이 올리는 약속을 사람 기억이 아니라 종료 코드로 지킨다.
//   node scripts/ci/readme-check.mjs [--tag vX.Y.Z]     --tag 는 릴리스 직전: package.json 판이 그 태그와 같아야 한다
// 종료 코드: 0 = 맞음 · 1 = 어긋남(항목마다 한 줄로 알린다)
// 파일: README.md(영어, 기본) · README.ko.md · README.zh-CN.md · README.es.md · README.ja.md — 모두 첫 줄에 같은 언어 전환 줄이 있다
// 언어마다 검사: ① 「현재 버전 `vX.Y.Z`」 = package.json 판 · ② 릴리스 기록 표 첫 행 = package.json 판, 내림차순, 지난 행의 태그가 실제로 있고 링크한 문서가 있다
//       ③ package.json 판이 최신 태그보다 낮지 않다 · ④ 필요 환경 표의 Node·npm 판 = engines
//       ⑤ README 의 `npm run <이름>` 이 package.json scripts 에 있다 · ⑥ README 의 상대 링크 파일이 있다
//       ⑦ (web-factory) 설치 주소 `#vX.Y.Z` 가 모두 package.json 판 · (launch-factory) 「web-factory 고정 `vX.Y.Z`」 = template.lock.json·contract.lock.json 의 ref
// 언어끼리 검사(한국어 파일이 기준): 첫 줄 전환 줄 · 코드 블록 바이트 동일 · 인라인 코드 같은 묶음 · 버전 문자열 같은 묶음 · 링크 대상 같은 묶음 · 제목 층·표 줄 수·목록 항목 수 같은 순서
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const findRoot = (d) => (existsSync(join(d, "package.json")) ? d : findRoot(dirname(d)))
export const ROOT = findRoot(dirname(fileURLToPath(import.meta.url)))

/** 언어마다 파일 이름과, 검사가 찾는 세 낱말(현재 버전 문장 · web-factory 고정 문장 · 릴리스 기록 제목). 번역본은 이 낱말을 그대로 써야 한다. */
export const LANGS = {
  ko: { file: "README.ko.md", cur: "현재 버전", pin: "web-factory 고정", release: "릴리스 기록" },
  en: { file: "README.md", cur: "Current version", pin: "web-factory pin", release: "Release history" },
  "zh-CN": { file: "README.zh-CN.md", cur: "当前版本", pin: "web-factory 固定", release: "发布记录" },
  es: { file: "README.es.md", cur: "Versión actual", pin: "web-factory fijado", release: "Historial de versiones" },
  ja: { file: "README.ja.md", cur: "現在のバージョン", pin: "web-factory 固定", release: "リリース履歴" },
}
export const BASE_LANG = "ko"
/** 모든 파일의 첫 줄 */
export const SWITCHER = "[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)"

const V = "(\\d+\\.\\d+\\.\\d+)"
const cmp = (a, b) => {
  const x = a.split(".").map(Number)
  const y = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}
const minOf = (range) => (typeof range === "string" ? new RegExp(`^>=\\s*${V}$`).exec(range.trim())?.[1] : undefined)
const fence = /```[\s\S]*?```/g
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const lf = (s) => s.replace(/\r\n/g, "\n")

/**
 * 한 파일 검사. 입력: readme 글 · lang(LANGS 의 키, 기본 ko) · pkg(package.json) · tags(태그 이름 목록, 비어 있으면 태그 검사를 건너뜀) · locks({ template, contract } 의 ref, launch-factory 만) ·
 *   exists(README 기준 상대 경로 → 있는가) · expectTag(릴리스 직전 검사) · kind("web-factory" | "launch-factory")
 * 반환: 어긋난 곳의 문장 목록(비면 맞음)
 */
export function checkReadme({ readme, lang = BASE_LANG, pkg, tags = [], locks, exists, expectTag, kind }) {
  const L = LANGS[lang]
  const problems = []
  const version = pkg.version
  const prose = readme.replace(fence, "") // 코드 블록 안의 예시는 문장 검사에서 뺀다. 명령 검사(⑤⑦)는 전체 글을 본다.

  const cur = new RegExp(`${esc(L.cur)}[^\\n]*?\`v${V}\``).exec(prose)?.[1]
  if (!cur) problems.push(`README 에 「${L.cur} \`vX.Y.Z\`」 문장이 없다`)
  else if (cur !== version) problems.push(`README 현재 버전 v${cur} ≠ package.json ${version}`)

  const section = new RegExp(`^## ${esc(L.release)}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(readme)?.[1]
  const rows = [...(section ?? "").matchAll(new RegExp(`^\\|\\s*\`?v${V}\`?\\s*\\|(.*)$`, "gm"))].map((m) => ({ v: m[1], rest: m[2] }))
  if (!rows.length) problems.push(`README 에 「## ${L.release}」 표(행 시작 \`| vX.Y.Z |\`)가 없다`)
  else {
    if (rows[0].v !== version) problems.push(`릴리스 기록 첫 행 v${rows[0].v} ≠ package.json ${version} (최신이 맨 위)`)
    for (let i = 1; i < rows.length; i++) if (cmp(rows[i - 1].v, rows[i].v) <= 0) problems.push(`릴리스 기록이 내림차순이 아니다: v${rows[i - 1].v} 다음 v${rows[i].v}`)
    for (const [i, r] of rows.entries()) {
      if (i > 0 && tags.length && !tags.includes(`v${r.v}`)) problems.push(`릴리스 기록 v${r.v} 의 태그가 저장소에 없다`)
      for (const m of r.rest.matchAll(/\]\(([^)#\s]+)/g)) if (!/^[a-z]+:/.test(m[1]) && !exists(m[1])) problems.push(`릴리스 기록 v${r.v} 의 링크 ${m[1]} 파일이 없다`)
    }
  }

  const latest = [...tags].map((t) => new RegExp(`^v${V}$`).exec(t)?.[1]).filter(Boolean).sort(cmp).at(-1)
  if (latest && cmp(version, latest) < 0) problems.push(`package.json ${version} 이 최신 태그 v${latest} 보다 낮다 — 릴리스마다 package.json·README 를 올린다`)
  if (expectTag && expectTag !== `v${version}`) problems.push(`--tag ${expectTag} ≠ package.json v${version}`)

  for (const key of ["node", "npm"]) {
    const want = minOf(pkg.engines?.[key])
    if (!want) continue
    const got = new RegExp(`^\\|\\s*${key}\\b[^\\n]*?>=${V}`, "im").exec(prose)?.[1]
    if (!got) problems.push(`필요 환경 표에 ${key} 행(>=판)이 없다 — engines.${key} 는 >=${want}`)
    else if (got !== want) problems.push(`필요 환경 표 ${key} >=${got} ≠ engines.${key} >=${want}`)
  }

  // 워크스페이스 명령(`npm run dev -w template`)은 그 패키지의 scripts 라서 루트 scripts 와 맞추지 않는다.
  for (const line of readme.split(/\r?\n/).filter((l) => !/\s(-w|--workspace)[\s=]/.test(l)))
    for (const m of line.matchAll(/npm run ([a-z0-9:_-]+)/gi)) if (!(m[1] in (pkg.scripts ?? {}))) problems.push(`README 의 \`npm run ${m[1]}\` 가 package.json scripts 에 없다`)
  for (const m of prose.matchAll(/\]\(([^)#\s]+)/g)) if (!/^[a-z]+:/.test(m[1]) && !exists(m[1])) problems.push(`README 링크 ${m[1]} 파일이 없다`)

  if (kind === "web-factory") {
    const refs = [...readme.matchAll(new RegExp(`#v${V}`, "g"))].map((m) => m[1])
    if (!refs.length) problems.push("README 에 설치 주소 `#vX.Y.Z` 가 하나도 없다")
    for (const r of new Set(refs)) if (r !== version) problems.push(`설치 주소 #v${r} ≠ package.json ${version}`)
  } else {
    const pin = new RegExp(`${esc(L.pin)}[^\\n]*?\`v${V}\``).exec(prose)?.[1]
    if (!pin) problems.push(`README 에 「${L.pin} \`vX.Y.Z\`」 문장이 없다`)
    else
      for (const [name, ref] of Object.entries(locks ?? {})) if (ref !== `v${pin}`) problems.push(`README web-factory 고정 v${pin} ≠ ${name} 잠금 ${ref}`)
  }
  return problems
}

// ─── 언어끼리 검사 ───
const proseOf = (t) => lf(t).replace(fence, "")
const blocksOf = (t) => lf(t).match(fence) ?? []
const inlineOf = (t) => [...proseOf(t).matchAll(/`([^`\n]+)`/g)].map((m) => m[1]).sort()
const versionsOf = (t) => [...(lf(t).match(/\d+\.\d+\.\d+/g) ?? [])].sort()
const linksOf = (t) => [...proseOf(t).matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1]).sort()
const headingsOf = (t) => proseOf(t).split("\n").filter((l) => /^#{1,6}\s/.test(l)).map((l) => /^#+/.exec(l)[0].length)
const tableRowsOf = (t) => {
  const out = []
  let n = 0
  for (const l of [...proseOf(t).split("\n"), ""]) {
    if (l.startsWith("|")) n++
    else if (n) {
      out.push(n)
      n = 0
    }
  }
  return out
}
const listItemsOf = (t) => proseOf(t).split("\n").filter((l) => /^\s*(-|\d+\.)\s/.test(l)).length
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
const diffList = (a, b) => {
  const left = [...a]
  const extra = []
  for (const x of b) {
    const i = left.indexOf(x)
    if (i === -1) extra.push(x)
    else left.splice(i, 1)
  }
  return { missing: left, extra }
}
const show = (xs) => xs.slice(0, 4).map((x) => JSON.stringify(x.length > 60 ? `${x.slice(0, 57)}…` : x)).join(", ")

/** 기준(ko)과 나머지 언어가 같은 구조·같은 명령·같은 버전인지. readmes: { ko: 글, en: 글, … } → 문장 목록 */
export function checkParity(readmes) {
  const problems = []
  const base = readmes[BASE_LANG]
  if (base === undefined) return [`기준 언어 ${BASE_LANG} 의 README 가 없다`]
  for (const [lang, text] of Object.entries(readmes)) {
    const f = LANGS[lang].file
    const first = lf(text).split("\n", 1)[0]
    if (first !== SWITCHER) problems.push(`${f}: 첫 줄이 언어 전환 줄과 다르다`)
    if (lang === BASE_LANG) continue

    const bb = blocksOf(base)
    const tb = blocksOf(text)
    if (bb.length !== tb.length) problems.push(`${f}: 코드 블록 수 ${tb.length} ≠ ${LANGS[BASE_LANG].file} ${bb.length}`)
    for (let i = 0; i < Math.min(bb.length, tb.length); i++) if (bb[i] !== tb[i]) problems.push(`${f}: ${i + 1}번째 코드 블록이 ${LANGS[BASE_LANG].file} 와 바이트가 다르다`)

    for (const [what, fn] of [
      ["인라인 코드", inlineOf],
      ["버전 문자열", versionsOf],
      ["링크 대상", linksOf],
    ]) {
      const a = fn(base)
      const b = fn(text)
      if (sameList(a, b)) continue
      const { missing, extra } = diffList(a, b)
      problems.push(`${f}: ${what} 묶음이 ${LANGS[BASE_LANG].file} 와 다르다 — 빠짐 [${show(missing)}] · 더함 [${show(extra)}]`)
    }
    if (!sameList(headingsOf(base), headingsOf(text))) problems.push(`${f}: 제목 층 순서가 ${LANGS[BASE_LANG].file} 와 다르다`)
    if (!sameList(tableRowsOf(base), tableRowsOf(text))) problems.push(`${f}: 표 줄 수가 ${LANGS[BASE_LANG].file} 와 다르다 (${tableRowsOf(text).join(",")} ≠ ${tableRowsOf(base).join(",")})`)
    if (listItemsOf(base) !== listItemsOf(text)) problems.push(`${f}: 목록 항목 수 ${listItemsOf(text)} ≠ ${LANGS[BASE_LANG].file} ${listItemsOf(base)}`)
  }
  return problems
}

/** 다섯 파일 전부: 언어마다 checkReadme(문장에 파일 이름을 붙인다) + checkParity */
export function checkAll({ readmes, ...rest }) {
  const problems = []
  for (const [lang, L] of Object.entries(LANGS)) {
    if (readmes[lang] === undefined) problems.push(`${L.file} 가 없다`)
    else for (const p of checkReadme({ ...rest, readme: readmes[lang], lang })) problems.push(`${L.file}: ${p}`)
  }
  const present = Object.fromEntries(Object.entries(readmes).filter(([k, v]) => v !== undefined && k in LANGS))
  return [...problems, ...(present[BASE_LANG] === undefined ? [] : checkParity(present))]
}

/** 실제 저장소에서 입력을 모은다 */
export function gather(root = ROOT) {
  const read = (p) => readFileSync(join(root, p), "utf8")
  const kind = existsSync(join(root, "template/template.lock.json")) ? "launch-factory" : "web-factory"
  const tags = (() => {
    const r = spawnSync("git", ["tag", "--list", "v*"], { cwd: root, encoding: "utf8" })
    return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : []
  })()
  const locks = kind === "launch-factory" ? { "template.lock.json": JSON.parse(read("template/template.lock.json")).blocks.ref, "contract.lock.json": JSON.parse(read("packages/contract/contract.lock.json")).ref } : undefined
  const readmes = Object.fromEntries(Object.entries(LANGS).map(([lang, L]) => [lang, existsSync(join(root, L.file)) ? read(L.file) : undefined]))
  return { readmes, pkg: JSON.parse(read("package.json")), tags, locks, exists: (p) => existsSync(join(root, p)), kind }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const i = process.argv.indexOf("--tag")
  const input = gather()
  const problems = checkAll({ ...input, expectTag: i === -1 ? undefined : process.argv[i + 1] })
  if (problems.length) console.log(`readme-check: FAIL ${problems.length}건\n${problems.map((p) => `  ✘ ${p}`).join("\n")}`)
  else console.log(`readme-check: PASS — README ${Object.keys(LANGS).length}개 언어 = package.json v${input.pkg.version}${input.tags.length ? ` · 태그 ${input.tags.length}개 확인` : ""}`)
  process.exitCode = problems.length ? 1 : 0
}
