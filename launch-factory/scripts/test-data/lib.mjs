// 시험 데이터 정리 도구의 공용 부분(list.mjs · clean.mjs). 세 곳 — 샌드박스 DB · Paddle 샌드박스 · Vercel 미리보기 — 의 정리 후보를 모으고,
// 지우기 직전에 같은 판정을 다시 한다. 읽기와 쓰기를 한 파일에서 나누어 둔 이유: 「목록이 낡았거나 손으로 고쳐졌어도 보존 대상은 코드가 한 번 더 막는다」.
//
// 공식 문서 근거(2026-10-03 확인):
//   Paddle 고객   PATCH /customers/{id} status:"archived" (customer.write) — 고객 삭제 API 는 없다  https://developer.paddle.com/api-reference/customers/update-customer.md
//   Paddle 구독   POST /subscriptions/{id}/cancel {effective_from:"immediately"} (subscription.write) — 되살릴 수 없다  https://developer.paddle.com/api-reference/subscriptions/cancel-subscription.md
//   Paddle 거래   삭제 API 없음. 상태는 billed·canceled 로만 바꿀 수 있고(draft·ready 는 수정 가능), billed·completed 는 세무·법적 기록이라 고칠 수 없다 → 이 도구는 거래를 건드리지 않는다  https://developer.paddle.com/api-reference/transactions/update-transaction.md
//   Vercel        vercel remove <배포> --safe(별칭 있는 배포는 건너뜀) --yes · vercel list/alias ls --format json (CLI 61.0.0 --help)
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { assertSandboxUrl, client as paddleClient, SANDBOX_HOST } from "../paddle-sandbox-setup.mjs"

export { SANDBOX_HOST }

/** 시험 표지 이메일. 이 모양이 아니면 어떤 경로로도 후보가 되지 않는다. */
export const TEST_EMAIL = /(@example\.com|\.invalid)$/i
export const isTestEmail = (e) => typeof e === "string" && TEST_EMAIL.test(e.trim())
/** 시험 웹훅 이벤트 id 접두사(DEPLOY2 서명 시험). 진짜 Paddle 이벤트는 evt_01… 로 시작하므로 걸리지 않는다. */
export const TEST_EVENT_PREFIXES = ["evt_deploy2_"]
/** 법정 보존·감사 표 — 사용자 행을 지워도 이 표의 행은 지우지 않는다(트리거도 막는다: access_logs 1년·retained_transactions retain_until). */
export const KEEP_TABLES = ["access_logs", "retained_transactions", "admin_actions"]
/** FK 가 없어도 사용자 id 를 담는 칸 이름 */
const USER_COLUMN_NAMES = ["user_id", "admin_user_id", "target_user_id", "actor_id"]
export const DEFAULT_KEEP_DEPLOYMENTS = 3

/** 앞 두 글자만. 시험 표지 도메인은 판정 근거라 남기고, 그 밖 이메일은 도메인도 가린다. */
export function maskEmail(e) {
  const s = String(e ?? "")
  const at = s.indexOf("@")
  const dom = at >= 0 ? s.slice(at) : ""
  return `${s.slice(0, 2)}***${isTestEmail(s) ? dom : ""}`
}

const q = (id) => `"${String(id).replaceAll('"', '""')}"`
const DELETE_RULE = { a: "no action", r: "restrict", c: "cascade", n: "set null", d: "set default" }

// ───────────────────────── DB ─────────────────────────
// db = { query(text, params) → rows, tx(fn(db)) }. postgres-js·PGlite 어댑터는 아래 두 함수.

export function postgresAdapter(sql) {
  const wrap = (s) => ({ query: async (text, params = []) => [...(await s.unsafe(text, params))] })
  return { ...wrap(sql), tx: (fn) => sql.begin((t) => fn(wrap(t))) }
}
export function pgliteAdapter(pg) {
  const wrap = (c) => ({ query: async (text, params = []) => (await c.query(text, params)).rows })
  return { ...wrap(pg), tx: (fn) => pg.transaction((t) => fn(wrap(t))) }
}

/** 사용자 id 를 가리키는 모든 칸: FK(pg_constraint)와 이름이 같은 FK 없는 칸. onDelete 는 FK 규칙, FK 가 없으면 "none". */
export async function userRefs(db) {
  const fks = await db.query(
    `select (select relname from pg_class where oid = c.conrelid) as "table", a.attname as "column", c.confdeltype as del
       from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.contype = 'f' and c.confrelid = '"user"'::regclass`,
  )
  const refs = fks.map((r) => ({ table: r.table, column: r.column, onDelete: DELETE_RULE[r.del] ?? r.del }))
  const named = await db.query(
    `select table_name as "table", column_name as "column" from information_schema.columns
      where table_schema = 'public' and column_name = any($1) and table_name <> 'user'`,
    [USER_COLUMN_NAMES],
  )
  for (const r of named) if (!refs.some((x) => x.table === r.table && x.column === r.column)) refs.push({ table: r.table, column: r.column, onDelete: "none" })
  return refs.sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`))
}

const userProviders = (db, id) => db.query(`select provider_id from account where user_id = $1`, [id]).then((r) => r.map((x) => x.provider_id))

/** 보존 판정 — 시험 표지 이메일이 아니거나 구글로 가입한 사용자(운영자 계정)는 후보가 될 수 없다. */
export function preserveReason(email, providers) {
  if (!isTestEmail(email)) return "시험 표지 이메일이 아님(실사용 계정)"
  if (providers.includes("google")) return "구글 가입 계정(운영자 계정)"
  return null
}

export async function collectDb(db) {
  const refs = await userRefs(db)
  const users = await db.query(`select id, email, email_verified, created_at from "user" order by created_at`)
  const candidates = []
  const preserved = []
  for (const u of users) {
    const providers = await userProviders(db, u.id)
    const why = preserveReason(u.email, providers)
    if (why) {
      preserved.push({ id: u.id, email: maskEmail(u.email), reason: why })
      continue
    }
    const rows = {}
    const kept = {}
    for (const r of refs) {
      const [{ n }] = await db.query(`select count(*)::int as n from ${q(r.table)} where ${q(r.column)} = $1`, [u.id])
      if (!n) continue
      ;(KEEP_TABLES.includes(r.table) ? kept : rows)[`${r.table}.${r.column}`] = { rows: n, onDelete: r.onDelete }
    }
    const total = Object.values(rows).reduce((a, x) => a + x.rows, 0)
    candidates.push({
      kind: "db.user",
      id: u.id,
      what: `시험 사용자 ${maskEmail(u.email)} (가입 ${new Date(u.created_at).toISOString().slice(0, 10)}, 이메일 확인 ${u.email_verified ? "됨" : "안 됨"}) + 연관 행 ${total}개`,
      why: "이메일이 시험 표지(@example.com 또는 .invalid)이고 구글 계정이 아님",
      loses: `가입 계정과 연관 행(${Object.entries(rows).map(([k, v]) => `${k} ${v.rows}`).join(", ") || "없음"}). 되돌리려면 백업 JSON 으로 다시 넣어야 한다`,
      rows,
      ...(Object.keys(kept).length ? { keptRows: kept } : {}),
    })
  }
  const events = await db.query(
    `select provider, event_id, occurred_at from webhook_events where ${TEST_EVENT_PREFIXES.map((_, i) => `event_id like $${i + 1}`).join(" or ")} order by occurred_at`,
    TEST_EVENT_PREFIXES.map((p) => `${p}%`),
  )
  for (const e of events) {
    candidates.push({
      kind: "db.webhook_event",
      id: `${e.provider}/${e.event_id}`,
      provider: e.provider,
      eventId: e.event_id,
      what: `시험 웹훅 이벤트 ${e.event_id}`,
      why: `이벤트 id 가 시험 접두사(${TEST_EVENT_PREFIXES.join(", ")})로 시작`,
      loses: "수신 멱등 기록 한 줄. 구독 상태는 바뀌지 않는다(같은 id 가 다시 오면 새 이벤트로 처리되는 것뿐)",
    })
  }
  // 고아: 사용자 없는 구독 등 — 후보로 만들지 않고 세어 보여 준다(법정 증빙일 수 있어 사람이 본다).
  const orphans = {}
  for (const r of refs) {
    const [{ n }] = await db.query(`select count(*)::int as n from ${q(r.table)} t where t.${q(r.column)} is not null and not exists (select 1 from "user" u where u.id = t.${q(r.column)})`)
    orphans[`${r.table}.${r.column}`] = n
  }
  const [{ n: realEvents }] = await db.query(`select count(*)::int as n from webhook_events`)
  return { candidates, preserved, orphans, webhookEvents: { total: realEvents, testPrefixed: events.length } }
}

// ───────────────────────── Paddle ─────────────────────────

/** 샌드박스 전용 클라이언트. 라이브 키·라이브 호스트는 paddle-sandbox-setup 의 검사가 던진다. */
export const makePaddle = (key, fetchImpl = fetch) => paddleClient(key, fetchImpl)

async function pages(call, path) {
  const out = []
  let next = path
  for (let i = 0; i < 200 && next; i++) {
    const r = await call("GET", next)
    out.push(...(r.data ?? []))
    // meta.pagination.next 는 전체 URL — 호스트는 믿지 않고 쿼리만 우리 호스트에 붙인다.
    const n = r.meta?.pagination?.has_more ? r.meta.pagination.next : null
    next = n ? `${path.split("?")[0]}${new URL(n).search}` : null
  }
  return out
}

/** 보존할 Paddle 구독 = DB 에서 시험 사용자가 아닌 사용자의 구독. 그 구독의 고객은 보존 고객. */
export async function paddlePreserve(call, db) {
  const subs = await db.query(
    `select s.provider_sub_id as id, u.email, (select count(*)::int from account a where a.user_id = u.id and a.provider_id = 'google') as g
       from subscriptions s join "user" u on u.id = s.user_id where s.provider = 'paddle'`,
  )
  const subIds = new Set(subs.filter((s) => !isTestEmail(s.email) || s.g > 0).map((s) => s.id))
  const customerIds = new Set()
  for (const id of subIds) {
    const r = await call("GET", `/subscriptions/${encodeURIComponent(id)}`).catch(() => null)
    if (r?.data?.customer_id) customerIds.add(r.data.customer_id)
  }
  return { subIds, customerIds }
}

export async function collectPaddle(call, db) {
  const keep = await paddlePreserve(call, db)
  const customers = await pages(call, "/customers?status=active&per_page=200")
  const candidates = []
  const preserved = []
  for (const c of customers) {
    if (!isTestEmail(c.email)) continue // 시험 표지가 없는 고객(대표 포함)은 후보도 보존 목록도 아니다 — 아래에서 개수만 센다
    if (keep.customerIds.has(c.id)) {
      preserved.push({ id: c.id, email: maskEmail(c.email), reason: "보존 구독을 가진 고객" })
      continue
    }
    const subs = (await pages(call, `/subscriptions?customer_id=${c.id}&per_page=200`)).filter((s) => s.status !== "canceled")
    const txns = await pages(call, `/transactions?customer_id=${c.id}&per_page=30`)
    const byStatus = {}
    for (const t of txns) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
    candidates.push({
      kind: "paddle.customer",
      id: c.id,
      email: maskEmail(c.email),
      what: `시험 고객 ${maskEmail(c.email)} — 구독 ${subs.length}개(취소 안 된 것), 거래 ${txns.length}개 ${JSON.stringify(byStatus)}`,
      why: "고객 이메일이 시험 표지(@example.com 또는 .invalid). 샌드박스 고객",
      loses: "구독은 즉시 취소(되살릴 수 없음)하고 고객은 보관(archived — 사용할 수 없게 됨, 삭제 API 없음). 거래·청구 기록은 Paddle 이 남긴다",
      action: "취소 후 보관(archive)",
      subscriptions: subs.map((s) => ({ id: s.id, status: s.status })),
      transactions: byStatus,
    })
  }
  const notTest = customers.filter((c) => !isTestEmail(c.email)).length
  // 후보는 아니지만 현황을 보여 준다: 거래는 customer 가 없는 draft 도 있어 고객 기준으로 못 찾는다.
  const count = (rows, f) => rows.reduce((a, r) => ((a[f(r)] = (a[f(r)] ?? 0) + 1), a), {})
  const allTxns = await pages(call, "/transactions?per_page=30")
  const allSubs = await pages(call, "/subscriptions?per_page=200")
  return {
    candidates,
    preserved,
    preservedSubscriptions: keep.subIds.size,
    activeCustomers: customers.length,
    nonTestCustomers: notTest,
    overview: {
      transactions: { total: allTxns.length, byStatus: count(allTxns, (t) => t.status), withoutCustomer: allTxns.filter((t) => !t.customer_id).length },
      subscriptions: { total: allSubs.length, byStatus: count(allSubs, (s) => s.status) },
    },
  }
}

// ───────────────────────── Vercel ─────────────────────────

const DEPLOY_URL = /^[a-z0-9][a-z0-9-]*\.vercel\.app$/

/** vercel CLI 를 부른다(Windows 의 vercel.cmd 는 cmd.exe /c 로). 인자는 이 파일이 고정한 것과 검사를 통과한 배포 주소뿐이다. */
export function vercelCli(cwd) {
  const [bin, pre] = process.platform === "win32" ? ["cmd.exe", ["/d", "/s", "/c", "vercel"]] : ["vercel", []]
  return (args) => execFileSync(bin, [...pre, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 })
}

async function vercelPages(run, base) {
  const out = []
  let next
  for (let i = 0; i < 50; i++) {
    const j = JSON.parse(run([...base, "--format", "json", "--limit", "100", ...(next ? ["--next", String(next)] : [])]))
    out.push(...(j.deployments ?? j.aliases ?? []))
    next = j.pagination?.next
    if (!next) break
  }
  return out
}

/** 지금 이 순간의 Vercel 후보 계산(list 와 clean 이 같이 쓴다). 별칭이 가리키는 배포와 최근 N개는 남긴다. */
export async function collectVercel(run, { keep = DEFAULT_KEEP_DEPLOYMENTS } = {}) {
  const deployments = (await vercelPages(run, ["list"])).slice().sort((a, b) => b.createdAt - a.createdAt)
  const urls = new Set(deployments.map((d) => d.url))
  const aliased = new Map()
  for (const a of await vercelPages(run, ["alias", "ls"])) if (urls.has(a.url)) aliased.set(a.url, [...(aliased.get(a.url) ?? []), a.alias])
  const kept = []
  const candidates = []
  deployments.forEach((d, i) => {
    const row = { url: d.url, state: d.state, target: d.target ?? "preview", createdAt: new Date(d.createdAt).toISOString() }
    if (aliased.has(d.url)) return kept.push({ ...row, reason: `별칭 ${aliased.get(d.url).join(", ")} 이(가) 가리킴` })
    if (i < keep) return kept.push({ ...row, reason: `최근 ${keep}개 안` })
    candidates.push({
      kind: "vercel.deployment",
      id: d.url,
      what: `옛 미리보기 배포 ${d.url} (${row.state}, ${row.createdAt.slice(0, 16)}Z)`,
      why: `별칭이 가리키지 않고 최근 ${keep}개 밖`,
      loses: "그 배포의 고유 주소와 빌드 산출물(되살릴 수 없음). 별칭 주소·최신 배포는 영향 없음",
      state: d.state,
      target: row.target,
    })
  })
  const errors = deployments.filter((d) => d.state === "ERROR").map((d) => ({ url: d.url, target: d.target ?? "preview", createdAt: new Date(d.createdAt).toISOString(), inCandidates: candidates.some((c) => c.id === d.url) }))
  return { project: projectName(), candidates, kept, errors, total: deployments.length }
}

function projectName() {
  try {
    return JSON.parse(readFileSync(new URL("../../.vercel/project.json", import.meta.url), "utf8")).projectName ?? null
  } catch {
    return null
  }
}

export { DEPLOY_URL, assertSandboxUrl }
