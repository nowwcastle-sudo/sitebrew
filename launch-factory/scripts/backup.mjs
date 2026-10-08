#!/usr/bin/env node
// 백업 도구(v0 Task 17, 대장 D100). .github/workflows/backup.yml 이 부른다. 로컬에서도 같은 명령으로 돈다.
//   node scripts/backup.mjs dump  --out <폴더>            DATABASE_URL → 행 수(앞) → docker pg_dump → 행 수(뒤) → <폴더>/dump.sql·manifest.json
//   node scripts/backup.mjs drill --dir <폴더>            빈 PGlite 에 dump.sql 을 넣고 manifest.json 과 행 수를 대조한다(운영 DB 에 닿지 않는다)
//   node scripts/backup.mjs last-backup [--repo o/r]      「마지막 백업 n시간 전」 한 줄(26시간 넘으면 종료 1). 토큰은 GITHUB_TOKEN 또는 GH_TOKEN
// 비밀값(DATABASE_URL·토큰)은 출력하지 않는다. 끝낼 때는 process.exitCode 만 정한다.
import { spawn } from "node:child_process"
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  PG_DUMP_FLAGS,
  PG_DUMP_IMAGE,
  dockerPgDumpArgs,
  lastBackupCheck,
  libpqEnv,
  restoreDrill,
  rowCounts,
} from "../packages/db/src/backup.ts"

const argv = process.argv.slice(2)
const opt = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

async function dump() {
  const out = opt("--out") ?? "backup"
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set (GitHub secret DATABASE_URL — owner action)")
  const pgEnv = libpqEnv(url)
  mkdirSync(out, { recursive: true })
  const { db } = await import("../packages/db/src/client.ts")
  const d = db(url)
  try {
    const before = await rowCounts(d)
    await new Promise((resolve, reject) => {
      const file = createWriteStream(join(out, "dump.sql"))
      const child = spawn("docker", dockerPgDumpArgs(), { env: { ...process.env, ...pgEnv }, stdio: ["ignore", "pipe", "inherit"] })
      child.stdout.pipe(file)
      child.on("error", reject)
      child.on("close", (code) => file.close(() => (code === 0 ? resolve() : reject(new Error(`pg_dump exited ${code}`)))))
    })
    const after = await rowCounts(d)
    const manifest = { createdAt: new Date().toISOString(), pgDumpImage: PG_DUMP_IMAGE, flags: PG_DUMP_FLAGS, before, after }
    writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
    const rows = Object.values(after).reduce((a, b) => a + b, 0)
    console.log(`dump ok: ${Object.keys(after).length} tables, ${rows} rows → ${join(out, "dump.sql")}`)
  } finally {
    await d.$client.end()
  }
}

async function drill() {
  const dir = opt("--dir") ?? "backup"
  const dumpSql = readFileSync(join(dir, "dump.sql"), "utf8")
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"))
  const r = await restoreDrill(dumpSql, manifest)
  console.log(`restore drill: ${r.ok ? "PASS" : "FAIL"} — ${r.tables} tables, ${r.rows} rows restored (manifest ${manifest.createdAt})`)
  for (const p of r.problems) console.log(`  - ${p}`)
  if (!r.ok) process.exitCode = 1
}

async function lastBackup() {
  const repo = opt("--repo") ?? process.env.GITHUB_REPOSITORY ?? "nowwcastle-sudo/sitebrew"
  const s = await lastBackupCheck({ repo, token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN })
  console.log(s.line)
  if (!s.ok) process.exitCode = 1
}

const commands = { dump, drill, "last-backup": lastBackup }
const cmd = commands[argv[0]]
if (!cmd) {
  console.error("usage: node scripts/backup.mjs dump --out <dir> | drill --dir <dir> | last-backup [--repo owner/repo]")
  process.exitCode = 2
} else {
  cmd().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
}
