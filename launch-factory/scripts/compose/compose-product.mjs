#!/usr/bin/env node
// 시안(web-factory 가 찍은 사이트)을 launch-factory 템플릿 위에 얹어 제품 폴더를 만든다.
//   node scripts/compose/compose-product.mjs --site <시안 폴더> --features <features.json> --to <출력 폴더> [--lf <launch-factory 폴더>]
// 단계는 rules/index.mjs 의 블록 순서이고, 규칙 표는 rules.json·url-map.json 이다(inventory.json 은 규칙이 덮어야 하는 실측 파일 목록).
// features.json 은 web-factory toFeatures 가 requires 까지 펼친 집합이다 — 여기서는 닫혀 있는지만 본다.
import { existsSync, realpathSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { mergeDependencies } from "../template-sync.mjs"
import { listFiles, readJson } from "./lib.mjs"
import { BLOCKS } from "./rules/index.mjs"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const DEPS = { mergeDependencies }
const LF_DIR = fileURLToPath(new URL("../..", import.meta.url))

/** features.outcomes 가 표의 id 이고 requires 로 닫혀 있는지, loopSteps 를 주면 한 바퀴 단계가 남는지 본다. 아니면 모자란 것을 모두 적어 던진다(펼치지는 않는다) */
export function checkFeatures(features, table, loopSteps) {
  const byId = new Map(table.outcomes.map((o) => [o.id, o]))
  const chosen = new Set(features.outcomes)
  const unknown = features.outcomes.filter((id) => !byId.has(id))
  if (unknown.length) throw new Error(`표에 없는 기능 id: ${unknown.join(", ")}`)
  const open = features.outcomes.flatMap((id) => byId.get(id).requires.filter((r) => !chosen.has(r)).map((r) => `${id} 는 ${r} 가 있어야 한다`))
  if (open.length) throw new Error(`features.outcomes 가 requires 로 닫혀 있지 않다 — web-factory toFeatures 로 펼친 집합을 넘긴다:\n  ${open.join("\n  ")}`)
  // 한 바퀴 시험(e2e/loop-steps.json)이 읽을 단계가 하나도 안 남는 집합은 아무것도 쓰기 전에 멈춘다(filterLoopSteps 의 던지기는 방어선)
  if (loopSteps && !Object.keys(loopSteps.steps ?? {}).some((id) => chosen.has(id))) throw new Error("e2e/loop-steps.json: 고른 기능 중 한 바퀴 단계가 있는 것이 없다")
}

/** name: site.json 에 쓸 수 있는 이름이 없을 때만 PRODUCT_NAME 으로 쓰는 대체 이름(호출한 쪽이 아는 폴더 이름 등) */
export function composeProduct({ siteDir, features, table, lfDir = LF_DIR, to, name, billingProvider }) {
  const outcomes = table ?? readJson(resolve(lfDir, "features", "outcomes.generated.json"))
  checkFeatures(features, outcomes, readJson(resolve(lfDir, "template", "e2e", "loop-steps.json")))
  if (billingProvider !== undefined && billingProvider !== "toss-test") throw new Error("지원하지 않는 결제 공급자입니다")
  if (billingProvider === "toss-test" && !features.outcomes.includes("payments")) throw new Error("toss-test 는 payments 선택이 필요합니다")
  if (billingProvider === "toss-test") {
    const db = resolve(lfDir, "packages/db")
    const template = resolve(lfDir, "template")
    const dbTags = readJson(resolve(db, "migrations/meta/_journal.json")).entries.map((e) => e.tag)
    const appTags = readJson(resolve(template, "db/migrations/meta/_journal.json")).entries.map((e) => e.tag)
    const dbFiles = new Set(listFiles(db))
    const appFiles = new Set(listFiles(template))
    if (JSON.stringify(dbTags) !== JSON.stringify(appTags) || dbTags.some((tag) => !dbFiles.has(`migrations/${tag}.sql`) || !appFiles.has(`db/migrations/${tag}.sql`) || !existsSync(resolve(db, `migrations/${tag}.sql`)) || !existsSync(resolve(template, `db/migrations/${tag}.sql`)))) throw new Error("토스 시험 마이그레이션의 DB·템플릿 파일과 journal이 일치하지 않습니다")
  }
  const state = {
    siteDir: resolve(siteDir),
    to: resolve(to),
    lfDir: resolve(lfDir),
    templateDir: resolve(lfDir, "template"),
    features,
    billingProvider,
    name,
    table: outcomes,
    rules: readJson(resolve(HERE, "rules.json")),
    urlMap: readJson(resolve(HERE, "url-map.json")),
    written: new Set(),
    copied: [],
    dropped: [],
    kept: [],
    removed: [],
    vendored: [],
    rootMetaSkipped: [],
  }
  const done = BLOCKS.reduce((acc, block) => block.run(acc, DEPS), state)
  return {
    dir: done.to,
    copied: done.copied,
    dropped: done.dropped,
    kept: done.kept,
    removed: done.removed,
    pruned: done.pruned,
    rewritten: done.rewritten,
    warnings: done.warnings,
    vendored: done.vendored,
    rootMetaSkipped: done.rootMetaSkipped,
    catalogFromSite: done.catalogFromSite,
    runCmd: [
      { cwd: done.to, command: "npm", args: ["install"] },
      { cwd: done.to, command: "npm", args: ["run", "dev"] },
    ],
  }
}

function parseArgs(argv) {
  const opts = {}
  const names = { "--site": "site", "--features": "features", "--to": "to", "--lf": "lf", "--billing-provider": "billingProvider" }
  for (let i = 0; i < argv.length; i += 2) {
    const key = names[argv[i]]
    if (!key || argv[i + 1] === undefined) throw new Error(`사용: compose-product.mjs --site <폴더> --features <json> --to <폴더> [--lf <폴더>] (모르는 인자: ${argv[i]})`)
    opts[key] = argv[i + 1]
  }
  const missing = ["site", "features", "to"].filter((k) => !opts[k])
  if (missing.length) throw new Error(`빠진 인자: ${missing.map((k) => `--${k}`).join(" ")}`)
  return opts
}

const isMain = process.argv[1] && realpathSync.native(fileURLToPath(import.meta.url)) === realpathSync.native(process.argv[1])
if (isMain) {
  try {
    const opts = parseArgs(process.argv.slice(2))
    const r = composeProduct({ siteDir: opts.site, features: readJson(resolve(opts.features)), lfDir: opts.lf ?? LF_DIR, to: opts.to, billingProvider: opts.billingProvider })
    for (const w of r.warnings) console.error(`경고: ${w}`)
    console.log(`제품 폴더: ${r.dir}\n시안에서 가져온 파일 ${r.copied.length}개 · 버린 시안 쪽 ${r.dropped.length}개 · 템플릿에서 지운 파일 ${r.removed.length}개 · 시안 링크 고침 ${r.rewritten.length}곳 · 벤더 패키지 ${r.vendored.length}개\n실행(${r.dir} 에서): ${r.runCmd.map((c) => [c.command, ...c.args].join(" ")).join(" → ")}`)
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 2
  }
}
