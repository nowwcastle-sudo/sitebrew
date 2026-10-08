// 시험 데이터 정리 후보 목록(읽기 전용). 샌드박스 DB · Paddle 샌드박스 · Vercel 미리보기 세 곳을 훑어 표와 JSON 으로 낸다.
// 출시 관문마다 한 번: list → 운영자 승인 → clean --apply --list <이 JSON>.
// 사용: node scripts/test-data/list.mjs [--out .tmp/test-data/list.json] [--md 파일.md] [--keep 3] [--no-paddle] [--no-vercel] [--no-db]
// 이 스크립트는 아무것도 바꾸지 않는다(SELECT 와 GET 과 vercel list/alias ls 뿐). 키·URL 은 프로세스 안에서만 읽고 어디에도 쓰지 않는다.
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { pathToFileURL } from "node:url"
import postgres from "postgres"
import { maskSecrets, readSecrets } from "../../packages/env/src/index.ts"
import { DEFAULT_KEEP_DEPLOYMENTS, KEEP_TABLES, collectDb, collectPaddle, collectVercel, makePaddle, postgresAdapter, vercelCli } from "./lib.mjs"

/** 세 곳을 모아 목록 객체를 만든다. 곳마다 따로 실패할 수 있고, 실패는 그 곳의 error 로 남긴다(다른 곳은 계속). */
export async function buildList({ db, paddle, vercelRun, keep = DEFAULT_KEEP_DEPLOYMENTS, mask = (s) => s }) {
  const out = { tool: "test-data-list", version: 1, generatedAt: new Date().toISOString(), params: { keepDeployments: keep, keepTables: KEEP_TABLES } }
  const run = async (name, fn) => {
    try {
      out[name] = await fn()
    } catch (e) {
      out[name] = { error: mask(e instanceof Error ? e.message : e), candidates: [] }
    }
  }
  if (db) await run("db", () => collectDb(db))
  if (paddle) await run("paddle", () => collectPaddle(paddle, db))
  if (vercelRun) await run("vercel", () => collectVercel(vercelRun, { keep }))
  return out
}

const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ")

export function renderMarkdown(list) {
  const L = []
  const table = (title, items, note) => {
    L.push(`### ${title} — 후보 ${items.length}건`, "")
    if (note) L.push(note, "")
    if (!items.length) return L.push("(없음)", "")
    L.push("| # | 무엇 | 왜 시험 데이터로 판정했나 | 지우면 잃는 것 |", "|---|---|---|---|")
    items.forEach((c, i) => L.push(`| ${i + 1} | ${cell(c.what)} | ${cell(c.why)} | ${cell(c.loses)} |`))
    L.push("")
  }
  const err = (sec) => sec?.error && L.push(`> 이 곳은 읽지 못했다: ${sec.error}`, "")
  if (list.db) {
    err(list.db)
    if (!list.db.error) {
      table("샌드박스 DB", list.db.candidates, "남기는 것(보존): " + (list.db.preserved.map((p) => `${p.email} — ${p.reason}`).join(" · ") || "없음"))
      const kept = list.db.candidates.filter((c) => c.keptRows)
      if (kept.length) L.push(`법정 보존·감사 표(${KEEP_TABLES.join(", ")})의 연관 행은 지우지 않는다: ` + kept.map((c) => JSON.stringify(c.keptRows)).join(" "), "")
      L.push(`고아 행 점검(사용자 id 를 담았지만 사용자가 없는 행, 칸별): ${JSON.stringify(Object.fromEntries(Object.entries(list.db.orphans).filter(([, n]) => n)))} — 0 인 칸은 생략. 웹훅 이벤트 전체 ${list.db.webhookEvents.total}건 중 시험 접두사 ${list.db.webhookEvents.testPrefixed}건.`, "")
    }
  }
  if (list.paddle) {
    err(list.paddle)
    if (!list.paddle.error) {
      table("Paddle 샌드박스", list.paddle.candidates, `활성 고객 ${list.paddle.activeCustomers}명 중 시험 표지 없음 ${list.paddle.nonTestCustomers}명(손대지 않음) · 보존 구독 ${list.paddle.preservedSubscriptions}개 · 보존 고객 ${list.paddle.preserved.length}명. 거래(draft 등)는 삭제 API 가 없고 billed·completed 는 법적 기록이라 이 도구는 거래를 건드리지 않는다.`)
      const o = list.paddle.overview
      if (o) L.push(`현황(후보 아님): 거래 ${o.transactions.total}건 ${JSON.stringify(o.transactions.byStatus)} · 고객 없는 거래 ${o.transactions.withoutCustomer}건 · 구독 ${o.subscriptions.total}개 ${JSON.stringify(o.subscriptions.byStatus)}`, "")
    }
  }
  if (list.vercel) {
    err(list.vercel)
    if (!list.vercel.error) {
      table(`Vercel 미리보기(${list.vercel.project ?? "프로젝트 미확인"})`, list.vercel.candidates, `배포 ${list.vercel.total}개 중 남기는 것 ${list.vercel.kept.length}개: ` + list.vercel.kept.map((k) => `${k.url.replace(/-[a-z0-9]+-projects\.vercel\.app.*$/, "")} (${k.reason})`).join(" · "))
      for (const e of list.vercel.errors) L.push(`- 오류 상태 배포: ${e.url.replace(/-[a-z0-9]+-projects\.vercel\.app.*$/, "")} · target=${e.target} · ${e.createdAt.slice(0, 16)}Z · ${e.inCandidates ? "후보에 있음" : "후보 아님(남김)"}`)
      L.push("")
    }
  }
  return L.join("\n")
}

async function main() {
  const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined)
  const has = (n) => process.argv.includes(n)
  const secrets = readSecrets(["DATABASE_URL", "PADDLE_API_KEY"])
  const mask = (s) => maskSecrets(s, Object.values(secrets))
  const sql = has("--no-db") || !secrets.DATABASE_URL ? null : postgres(secrets.DATABASE_URL, { max: 1, prepare: false })
  try {
    const db = sql ? postgresAdapter(sql) : null
    const paddle = has("--no-paddle") || !db || !secrets.PADDLE_API_KEY ? null : makePaddle(secrets.PADDLE_API_KEY)
    const list = await buildList({
      db,
      paddle,
      vercelRun: has("--no-vercel") ? null : vercelCli(process.cwd()),
      keep: Number(arg("--keep") ?? DEFAULT_KEEP_DEPLOYMENTS),
      mask,
    })
    if (!sql && !has("--no-db")) list.db = { error: "DATABASE_URL 이 없다", candidates: [] }
    if (!paddle && !has("--no-paddle")) list.paddle = { error: "PADDLE_API_KEY 또는 DB 연결이 없다", candidates: [] }
    const file = arg("--out") ?? `.tmp/test-data/list-${list.generatedAt.slice(0, 10)}.json`
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(list, null, 2)}\n`)
    const md = renderMarkdown(list)
    if (arg("--md")) writeFileSync(arg("--md"), `${md}\n`)
    console.log(md)
    const n = (s) => list[s]?.candidates?.length ?? 0
    console.log(`\n목록 파일: ${file} · 후보 DB ${n("db")} · Paddle ${n("paddle")} · Vercel ${n("vercel")} (읽기 전용 — 아무것도 바꾸지 않았다)`)
    if (["db", "paddle", "vercel"].some((s) => list[s]?.error)) process.exitCode = 2
  } finally {
    await sql?.end()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(`list 실패: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  })
}
