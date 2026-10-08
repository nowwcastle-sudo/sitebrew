// 시험 데이터 정리 실행기. list.mjs 가 만든 목록(JSON)에 **있는 것만** 정리한다. --apply 가 없으면 아무것도 바꾸지 않는다(드라이런).
// 사용: node scripts/test-data/clean.mjs --list .tmp/test-data/list-YYYYMMDD.json [--apply] [--backup-dir .tmp/test-data/backup/<시각>]
// 목록을 믿지 않는다: 항목마다 지우기 직전에 살아 있는 상태를 다시 읽어 보존 규칙을 한 번 더 건다.
//   DB      시험 표지 이메일이 아니거나 구글 계정이면 거절 → 연관 행을 읽어 JSON 백업(디스크에 쓰고 확인) → 같은 트랜잭션에서 삭제 → 다시 센다
//           (법정 보존·감사 표 KEEP_TABLES 의 행은 지우지 않는다)
//   Paddle  샌드박스 호스트만. 시험 표지 고객이고 보존 구독의 고객이 아닐 때만: 구독 즉시 취소 → 고객 보관(archived). 거래는 건드리지 않는다
//   Vercel  지금 계산한 후보(별칭 없음·최근 N개 밖)에 다시 들어 있을 때만 `vercel remove --safe --yes` → 다시 목록을 읽어 사라졌는지 확인
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import postgres from "postgres"
import { maskSecrets, readSecrets } from "../../packages/env/src/index.ts"
import { DEFAULT_KEEP_DEPLOYMENTS, DEPLOY_URL, KEEP_TABLES, TEST_EVENT_PREFIXES, collectVercel, isTestEmail, makePaddle, maskEmail, paddlePreserve, postgresAdapter, preserveReason, userRefs, vercelCli } from "./lib.mjs"

const q = (id) => `"${String(id).replaceAll('"', '""')}"`
const res = (id, status, detail) => ({ id, status, detail }) // status: would | done | refused | failed

/** 백업을 디스크에 쓰고 되읽어 확인한다. 쓰지 못하면 던진다 — 호출한 쪽이 삭제 전에 부르므로 삭제가 일어나지 않는다. */
export function writeBackup(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 1))
  if (!existsSync(file) || statSync(file).size === 0) throw new Error(`백업이 쓰이지 않았다: ${file}`)
}

async function cleanUser(db, item, { apply, backupDir, write, now }) {
  const refs = await userRefs(db)
  const inTx = apply ? (fn) => db.tx(fn) : (fn) => fn(db)
  const out = await inTx(async (t) => {
    const [u] = await t.query(`select * from "user" where id = $1`, [item.id])
    if (!u) return res(item.id, "refused", "이미 없다")
    const providers = (await t.query(`select provider_id from account where user_id = $1`, [item.id])).map((r) => r.provider_id)
    const why = preserveReason(u.email, providers)
    if (why) return res(item.id, "refused", `보존 대상: ${why}`)
    const dump = { at: now(), email: maskEmail(u.email), user: u, rows: {} }
    const counts = {}
    for (const r of refs) {
      const rows = await t.query(`select * from ${q(r.table)} where ${q(r.column)} = $1`, [item.id])
      if (!rows.length) continue
      counts[`${r.table}.${r.column}`] = rows.length
      dump.rows[`${r.table}.${r.column}`] = { onDelete: r.onDelete, keep: KEEP_TABLES.includes(r.table), rows }
    }
    if (!apply) return res(item.id, "would", { user: maskEmail(u.email), rows: counts })
    const file = join(backupDir, `user-${item.id}.json`)
    write(file, dump) // 삭제보다 먼저. 실패하면 아래 삭제는 일어나지 않고 트랜잭션도 변경이 없다.
    for (const r of refs) {
      if (KEEP_TABLES.includes(r.table) || r.onDelete === "set null") continue
      await t.query(`delete from ${q(r.table)} where ${q(r.column)} = $1`, [item.id])
    }
    await t.query(`delete from "user" where id = $1`, [item.id])
    return res(item.id, "done", { user: maskEmail(u.email), backup: file, deleted: counts })
  })
  if (out.status !== "done") return out
  // 다시 세기
  const [{ n }] = await db.query(`select count(*)::int as n from "user" where id = $1`, [item.id])
  const left = {}
  for (const r of refs) {
    if (KEEP_TABLES.includes(r.table)) continue
    const [{ n: c }] = await db.query(`select count(*)::int as n from ${q(r.table)} where ${q(r.column)} = $1`, [item.id])
    if (c) left[`${r.table}.${r.column}`] = c
  }
  return res(item.id, n === 0 && !Object.keys(left).length ? "done" : "failed", { ...out.detail, userRowsLeft: n, refRowsLeft: left })
}

async function cleanEvent(db, item, { apply, backupDir, write, now }) {
  if (!TEST_EVENT_PREFIXES.some((p) => String(item.eventId).startsWith(p))) return res(item.id, "refused", "시험 접두사가 아님")
  const inTx = apply ? (fn) => db.tx(fn) : (fn) => fn(db)
  return inTx(async (t) => {
    const rows = await t.query(`select * from webhook_events where provider = $1 and event_id = $2`, [item.provider, item.eventId])
    if (!rows.length) return res(item.id, "refused", "이미 없다")
    if (!apply) return res(item.id, "would", { rows: 1 })
    write(join(backupDir, `webhook-${item.provider}-${item.eventId}.json`), { at: now(), rows })
    await t.query(`delete from webhook_events where provider = $1 and event_id = $2`, [item.provider, item.eventId])
    return res(item.id, "done", { rows: 1 })
  })
}

async function cleanCustomer(call, item, keep, { apply, backupDir, write, now }) {
  if (!/^ctm_[a-z0-9]+$/.test(item.id)) return res(item.id, "refused", "고객 id 모양이 아니다")
  const { data: c } = await call("GET", `/customers/${item.id}`)
  if (!isTestEmail(c.email)) return res(item.id, "refused", "보존 대상: 시험 표지 이메일이 아님")
  if (keep.customerIds.has(c.id)) return res(item.id, "refused", "보존 대상: 보존 구독을 가진 고객")
  if (c.status !== "active") return res(item.id, "refused", `이미 ${c.status}`)
  const subs = []
  for (const sid of (item.subscriptions ?? []).map((s) => s.id)) {
    if (!/^sub_[a-z0-9]+$/.test(sid)) return res(item.id, "refused", "구독 id 모양이 아니다")
    if (keep.subIds.has(sid)) return res(item.id, "refused", "보존 대상: 보존 구독")
    const { data: s } = await call("GET", `/subscriptions/${sid}`)
    if (s.customer_id !== c.id) return res(item.id, "refused", "구독이 이 고객의 것이 아니다")
    subs.push(s)
  }
  const toCancel = subs.filter((s) => s.status !== "canceled")
  if (!apply) return res(item.id, "would", { email: maskEmail(c.email), cancel: toCancel.map((s) => s.id), archive: true })
  write(join(backupDir, `paddle-${c.id}.json`), { at: now(), customer: c, subscriptions: subs })
  for (const s of toCancel) await call("POST", `/subscriptions/${s.id}/cancel`, { effective_from: "immediately" })
  await call("PATCH", `/customers/${c.id}`, { status: "archived" })
  const after = (await call("GET", `/customers/${c.id}`)).data
  return res(item.id, after.status === "archived" ? "done" : "failed", { email: maskEmail(c.email), canceled: toCancel.map((s) => s.id), status: after.status })
}

/** 목록의 항목마다 처리해 보고서를 돌려준다. 한 항목이 실패해도 다음으로 간다(항목은 서로 독립). */
export async function runClean({ list, apply = false, db, paddle, vercelRun, backupDir, now = () => new Date().toISOString(), write = writeBackup }) {
  const ctx = { apply, backupDir, write, now }
  if (apply) mkdirSync(backupDir, { recursive: true })
  const report = { apply, backupDir: apply ? backupDir : null, db: [], paddle: [], vercel: [] }
  const guard = async (bucket, id, fn) => {
    try {
      report[bucket].push(await fn())
    } catch (e) {
      report[bucket].push(res(id, "failed", e instanceof Error ? e.message : String(e)))
    }
  }
  for (const item of list.db?.candidates ?? []) {
    if (!db) report.db.push(res(item.id, "failed", "DB 연결이 없다"))
    else if (item.kind === "db.user") await guard("db", item.id, () => cleanUser(db, item, ctx))
    else if (item.kind === "db.webhook_event") await guard("db", item.id, () => cleanEvent(db, item, ctx))
    else report.db.push(res(item.id, "refused", `알 수 없는 종류 ${item.kind}`))
  }
  const cust = (list.paddle?.candidates ?? []).filter((c) => c.kind === "paddle.customer")
  if (cust.length) {
    if (!paddle || !db) report.paddle.push(res("(전체)", "failed", "Paddle 키 또는 DB 연결이 없다"))
    else {
      const keep = await paddlePreserve(paddle, db)
      for (const item of cust) await guard("paddle", item.id, () => cleanCustomer(paddle, item, keep, ctx))
    }
  }
  const dep = list.vercel?.candidates ?? []
  if (dep.length) {
    if (!vercelRun) report.vercel.push(res("(전체)", "failed", "vercel CLI 가 없다"))
    else {
      const keepN = list.params?.keepDeployments ?? DEFAULT_KEEP_DEPLOYMENTS
      const live = new Set((await collectVercel(vercelRun, { keep: keepN })).candidates.map((c) => c.id))
      for (const item of dep) {
        await guard("vercel", item.id, async () => {
          if (item.kind !== "vercel.deployment" || !DEPLOY_URL.test(item.id)) return res(item.id, "refused", "배포 주소 모양이 아니다")
          if (!live.has(item.id)) return res(item.id, "refused", "지금은 후보가 아님(별칭이 붙었거나 최근 배포이거나 이미 없다)")
          if (!apply) return res(item.id, "would", "vercel remove --safe")
          vercelRun(["remove", item.id, "--safe", "--yes"])
          const after = await collectVercel(vercelRun, { keep: keepN })
          const still = after.candidates.some((c) => c.id === item.id) || after.kept.some((k) => k.url === item.id)
          return res(item.id, still ? "failed" : "done", still ? "지운 뒤에도 목록에 있다" : "목록에서 사라짐")
        })
      }
    }
  }
  return report
}

function summarize(r) {
  const L = [r.apply ? "적용 결과" : "드라이런 — 아무것도 바꾸지 않았다(실제로 지우려면 --apply)"]
  for (const k of ["db", "paddle", "vercel"]) {
    const c = {}
    for (const x of r[k]) c[x.status] = (c[x.status] ?? 0) + 1
    L.push(`${k}: ${JSON.stringify(c)}`)
    for (const x of r[k]) if (x.status === "refused" || x.status === "failed") L.push(`  ${x.status} ${x.id} — ${typeof x.detail === "string" ? x.detail : JSON.stringify(x.detail)}`)
  }
  if (r.backupDir) L.push(`백업: ${r.backupDir}`)
  return L.join("\n")
}

async function main() {
  const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined)
  const file = arg("--list")
  if (!file) throw new Error("--list <list.json> 이 필요하다")
  const list = JSON.parse(readFileSync(file, "utf8"))
  if (list.tool !== "test-data-list") throw new Error("list.mjs 가 만든 목록이 아니다")
  const apply = process.argv.includes("--apply")
  const secrets = readSecrets(["DATABASE_URL", "PADDLE_API_KEY"])
  const sql = secrets.DATABASE_URL ? postgres(secrets.DATABASE_URL, { max: 1, prepare: false }) : null
  try {
    const report = await runClean({
      list,
      apply,
      db: sql ? postgresAdapter(sql) : null,
      paddle: secrets.PADDLE_API_KEY ? makePaddle(secrets.PADDLE_API_KEY) : null,
      vercelRun: vercelCli(process.cwd()),
      backupDir: arg("--backup-dir") ?? join(".tmp", "test-data", "backup", new Date().toISOString().replace(/[:.]/g, "-")),
    })
    console.log(maskSecrets(summarize(report), Object.values(secrets)))
    if (["db", "paddle", "vercel"].some((k) => report[k].some((x) => x.status === "failed"))) process.exitCode = 1
  } finally {
    await sql?.end()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(`clean 실패: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  })
}
