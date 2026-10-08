// 시험 데이터 정리 도구(scripts/test-data) 시험: PGlite(진짜 마이그레이션) + 가짜 Paddle 샌드박스 fetch + 가짜 vercel CLI.
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { db as makeDb } from "../../packages/db/src/index.ts"
import { buildList, renderMarkdown } from "../test-data/list.mjs"
import { runClean } from "../test-data/clean.mjs"
import { assertSandboxUrl, isTestEmail, makePaddle, maskEmail, pgliteAdapter } from "../test-data/lib.mjs"

const NOW = "2026-10-03T00:00:00.000Z"
const ago = (h) => new Date(Date.parse(NOW) - h * 3600e3).getTime()

async function seed() {
  const d = await makeDb.local()
  const pg = d.$client
  const user = (id, email) => pg.query(`insert into "user"(id, name, email, email_verified, created_at, updated_at) values ($1,'n',$2,true,now(),now())`, [id, email])
  const acct = (id, uid, prov) => pg.query(`insert into account(id, account_id, provider_id, user_id, updated_at) values ($1,$1,$2,$3,now())`, [id, prov, uid])
  await user("u_test1", "lf-test1@example.com")
  await user("u_test2", "lf-test2@x.invalid")
  await user("u_keep", "kept-owner@example.net") // 대표: 시험 표지 아님
  await user("u_gex", "google-tester@example.com") // 표지는 시험이지만 구글 가입 → 보존
  for (const [i, u, p] of [["a1", "u_test1", "credential"], ["a2", "u_test2", "credential"], ["a3", "u_keep", "google"], ["a4", "u_gex", "google"]]) await acct(i, u, p)
  for (const u of ["u_test1", "u_keep"]) {
    await pg.query(`insert into consent_records(user_id, kind, granted, source, created_at) values ($1,'terms',true,'sign_up',now()),($1,'privacy',true,'sign_up',now())`, [u])
    await pg.query(`insert into session(id, expires_at, token, updated_at, user_id) values ($1, now() + interval '1 day', $2, now(), $3)`, [`s_${u}`, `tok_${u}`, u])
  }
  await pg.query(`insert into subscriptions(user_id, provider, provider_sub_id, status, plan_id, updated_from_event_at) values ('u_keep','paddle','sub_keep00001','trialing','pro',now())`)
  await pg.query(`insert into access_logs(actor_id, ip, subjects, action, occurred_at) values ('u_test1','127.0.0.1','{}','login',now())`) // 법정 보존 표: 지우지 않는다
  for (const e of ["evt_deploy2_ignored_1", "evt_01realone00000000000000001"]) await pg.query(`insert into webhook_events(provider, event_id, occurred_at, payload_hash) values ('paddle',$1,now(),'h')`, [e])
  return { d, pg, db: pgliteAdapter(pg) }
}

async function counts(pg) {
  const o = {}
  for (const t of ["user", "account", "session", "consent_records", "marketing_consents", "subscriptions", "webhook_events", "access_logs"]) o[t] = (await pg.query(`select count(*)::int n from ${t === "user" ? '"user"' : t}`)).rows[0].n
  return o
}

function fakePaddle() {
  const calls = []
  const customers = new Map([
    ["ctm_test00000001", { id: "ctm_test00000001", email: "lf-test1@example.com", status: "active" }],
    ["ctm_keepsub00001", { id: "ctm_keepsub00001", email: "paddle-owner@example.invalid", status: "active" }], // 시험 표지 이메일이지만 보존 구독을 가짐
    ["ctm_real00000001", { id: "ctm_real00000001", email: "kept-owner@example.net", status: "active" }],
  ])
  const subs = new Map([
    ["sub_test00000001", { id: "sub_test00000001", customer_id: "ctm_test00000001", status: "trialing" }],
    ["sub_keep00001", { id: "sub_keep00001", customer_id: "ctm_keepsub00001", status: "trialing" }],
  ])
  const txns = [{ id: "txn_1", status: "draft", customer_id: null }, { id: "txn_2", status: "completed", customer_id: "ctm_test00000001" }]
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url)
    const method = init.method ?? "GET"
    calls.push({ method, path: u.pathname, host: u.hostname })
    const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data, meta: { pagination: { has_more: false } } }) })
    let m
    if (method === "GET" && u.pathname === "/customers") return ok([...customers.values()].filter((c) => c.status === (u.searchParams.get("status") ?? "active")))
    if ((m = u.pathname.match(/^\/customers\/(.+)$/))) {
      const c = customers.get(m[1])
      if (method === "PATCH") Object.assign(c, JSON.parse(init.body))
      return ok(c)
    }
    if (method === "GET" && u.pathname === "/subscriptions") return ok([...subs.values()].filter((s) => !u.searchParams.get("customer_id") || s.customer_id === u.searchParams.get("customer_id")))
    if (method === "POST" && (m = u.pathname.match(/^\/subscriptions\/(.+)\/cancel$/))) return ok(Object.assign(subs.get(m[1]), { status: "canceled" }))
    if ((m = u.pathname.match(/^\/subscriptions\/(.+)$/))) return subs.has(m[1]) ? ok(subs.get(m[1])) : { ok: false, status: 404, json: async () => ({ error: { code: "not_found" } }) }
    if (method === "GET" && u.pathname === "/transactions") return ok(txns.filter((t) => !u.searchParams.get("customer_id") || t.customer_id === u.searchParams.get("customer_id")))
    throw new Error(`unexpected ${method} ${u.pathname}`)
  }
  return { calls, customers, subs, call: makePaddle("pdl_sdbx_fake", fetchImpl) }
}

function fakeVercel() {
  const removed = []
  const calls = []
  // 최신순 6개: [0]=별칭이 가리키는 최신, 1·2=최근 3개 안, 3·4·5=옛 것(5=ERROR)
  const dep = (i, state = "READY") => ({ url: `lf-preview-${i}-x-projects.vercel.app`, state, target: null, createdAt: ago(i) })
  let deployments = [dep(1), dep(2), dep(3), dep(4), dep(5), dep(6, "ERROR")]
  // 별칭이 최신이 아닌 옛 배포(4)도 가리킨다 — 최근 3개 밖이어도 지우면 안 된다
  const aliases = [{ alias: "lf-preview.vercel.app", url: deployments[0].url }, { alias: "pinned.vercel.app", url: deployments[3].url }, { alias: "other.vercel.app", url: "other-project-abc.vercel.app" }]
  const run = (args) => {
    calls.push(args)
    if (args[0] === "list") return JSON.stringify({ deployments, pagination: { next: null } })
    if (args[0] === "alias") return JSON.stringify({ aliases, pagination: { next: null } })
    if (args[0] === "remove") {
      const url = args[1]
      if (args.includes("--safe") && aliases.some((a) => a.url === url)) return "skipped"
      deployments = deployments.filter((d) => d.url !== url)
      removed.push(url)
      return "removed"
    }
    throw new Error(`unexpected vercel ${args.join(" ")}`)
  }
  return { run, calls, removed, deployments: () => deployments, urls: deployments.map((d) => d.url) }
}

test("표지·마스킹: 시험 이메일만 후보, 이메일은 앞 두 글자", () => {
  assert.ok(isTestEmail("a@example.com") && isTestEmail("A@X.INVALID") && !isTestEmail("kept-owner@example.net") && !isTestEmail("a@example.com.kr"))
  assert.equal(maskEmail("lffix-0001@example.com"), "lf***@example.com")
  assert.equal(maskEmail("kept-owner@example.net"), "ke***")
})

test("Paddle 라이브 키·라이브 호스트는 요청 전에 멈춘다", async () => {
  assert.throws(() => makePaddle("pdl_live_abc", async () => assert.fail("부르면 안 된다")))
  assert.throws(() => assertSandboxUrl("https://api.paddle.com/customers"), /멈춘다/)
  assert.throws(() => assertSandboxUrl("http://sandbox-api.paddle.com/customers"), /멈춘다/)
})

test("list: 후보는 시험 표지만, 보존은 빠지고, 읽기만 한다", async () => {
  const { pg, db } = await seed()
  const p = fakePaddle()
  const v = fakeVercel()
  try {
    const before = await counts(pg)
    const list = await buildList({ db, paddle: p.call, vercelRun: v.run, keep: 3 })
    assert.deepEqual(await counts(pg), before)
    // DB
    const users = list.db.candidates.filter((c) => c.kind === "db.user").map((c) => c.id).sort()
    assert.deepEqual(users, ["u_test1", "u_test2"])
    assert.deepEqual(list.db.preserved.map((x) => x.id).sort(), ["u_gex", "u_keep"])
    assert.deepEqual(list.db.candidates.filter((c) => c.kind === "db.webhook_event").map((c) => c.eventId), ["evt_deploy2_ignored_1"])
    assert.deepEqual(Object.keys(list.db.candidates.find((c) => c.id === "u_test1").keptRows), ["access_logs.actor_id"])
    // 후보마다 「무엇·왜·잃는 것」
    for (const c of [...list.db.candidates, ...list.paddle.candidates, ...list.vercel.candidates]) assert.ok(c.what && c.why && c.loses, c.id)
    // Paddle: 시험 고객 하나. 보존 구독의 고객·실계정은 아님. 거래는 후보가 아님
    assert.deepEqual(list.paddle.candidates.map((c) => c.id), ["ctm_test00000001"])
    assert.deepEqual(list.paddle.preserved.map((c) => c.id), ["ctm_keepsub00001"])
    assert.equal(list.paddle.overview.transactions.withoutCustomer, 1)
    assert.ok(p.calls.every((c) => c.method === "GET" && c.host === "sandbox-api.paddle.com"))
    // Vercel: 별칭 둘(최신·옛 배포 4)과 최근 3개는 남고 나머지 3개... 최근3(1,2,3)+별칭(1,4) → 후보 5·6
    assert.deepEqual(list.vercel.candidates.map((c) => c.id).sort(), [v.urls[4], v.urls[5]].sort())
    assert.deepEqual(list.vercel.errors.map((e) => [e.url, e.inCandidates]), [[v.urls[5], true]])
    assert.ok(!v.calls.some((a) => a[0] === "remove"))
    assert.ok(!JSON.stringify(list).includes("kept-owner@example.net") && !JSON.stringify(list).includes("lf-test1@example.com"), "이메일 전체가 목록에 없다")
    assert.match(renderMarkdown(list), /샌드박스 DB — 후보 3건/)
  } finally {
    await pg.close()
  }
})

test("clean 드라이런: DB·Paddle·Vercel 어느 것도 바꾸지 않고 백업 폴더도 만들지 않는다", async () => {
  const { pg, db } = await seed()
  const p = fakePaddle()
  const v = fakeVercel()
  const dir = join(mkdtempSync(join(tmpdir(), "td-")), "backup")
  try {
    const list = await buildList({ db, paddle: p.call, vercelRun: v.run, keep: 3 })
    const before = await counts(pg)
    p.calls.length = 0
    const r = await runClean({ list, apply: false, db, paddle: p.call, vercelRun: v.run, backupDir: dir })
    assert.deepEqual(await counts(pg), before)
    assert.ok(p.calls.length > 0 && p.calls.every((c) => c.method === "GET"))
    assert.ok(!v.calls.some((a) => a[0] === "remove"))
    assert.ok(!existsSync(dir))
    const all = [...r.db, ...r.paddle, ...r.vercel]
    assert.ok(all.length === 3 + 1 + 2 && all.every((x) => x.status === "would"), JSON.stringify(all.filter((x) => x.status !== "would")))
  } finally {
    await pg.close()
  }
})

test("clean 보존 막기: 손으로 고친 목록에 보존 대상을 넣어도 --apply 가 거절한다", async () => {
  const { pg, db } = await seed()
  const p = fakePaddle()
  const v = fakeVercel()
  const dir = join(mkdtempSync(join(tmpdir(), "td-")), "backup")
  try {
    const forged = {
      tool: "test-data-list",
      params: { keepDeployments: 3 },
      db: {
        candidates: [
          { kind: "db.user", id: "u_keep" }, // 대표(표지 없음)
          { kind: "db.user", id: "u_gex" }, // 표지는 시험, 구글 가입
          { kind: "db.webhook_event", id: "paddle/evt_01real", provider: "paddle", eventId: "evt_01realone00000000000000001" }, // 시험 접두사 아님
        ],
      },
      paddle: { candidates: [{ kind: "paddle.customer", id: "ctm_keepsub00001", subscriptions: [{ id: "sub_keep00001" }] }, { kind: "paddle.customer", id: "ctm_real00000001", subscriptions: [] }] },
      vercel: { candidates: [{ kind: "vercel.deployment", id: v.urls[0] }, { kind: "vercel.deployment", id: v.urls[3] }, { kind: "vercel.deployment", id: v.urls[1] }, { kind: "vercel.deployment", id: "evil.example.com" }] },
    }
    const before = await counts(pg)
    const r = await runClean({ list: forged, apply: true, db, paddle: p.call, vercelRun: v.run, backupDir: dir })
    const all = [...r.db, ...r.paddle, ...r.vercel]
    assert.equal(all.length, 9)
    assert.ok(all.every((x) => x.status === "refused"), JSON.stringify(all.filter((x) => x.status !== "refused")))
    assert.deepEqual(await counts(pg), before)
    assert.ok(p.calls.every((c) => c.method === "GET"))
    assert.deepEqual(v.removed, [])
    assert.deepEqual(readdirSync(dir), [], "거절만 했으니 백업 파일도 없다")
  } finally {
    await pg.close()
  }
})

test("clean: 백업을 쓰지 못하면 아무것도 지우지 않는다(백업이 먼저)", async () => {
  const { pg, db } = await seed()
  try {
    const list = await buildList({ db, keep: 3 })
    const before = await counts(pg)
    const r = await runClean({ list, apply: true, db, backupDir: mkdtempSync(join(tmpdir(), "td-")), write: () => { throw new Error("디스크 가득") } })
    assert.ok(r.db.every((x) => x.status === "failed" && /디스크 가득/.test(x.detail)))
    assert.deepEqual(await counts(pg), before)
  } finally {
    await pg.close()
  }
})

test("clean --apply: 백업 JSON 에 행이 담기고, 삭제 후 다시 세어 0, 보존 표·보존 사용자는 그대로", async () => {
  const { pg, db } = await seed()
  const p = fakePaddle()
  const v = fakeVercel()
  const dir = join(mkdtempSync(join(tmpdir(), "td-")), "backup")
  try {
    const list = await buildList({ db, paddle: p.call, vercelRun: v.run, keep: 3 })
    const r = await runClean({ list, apply: true, db, paddle: p.call, vercelRun: v.run, backupDir: dir })
    assert.ok([...r.db, ...r.paddle, ...r.vercel].every((x) => x.status === "done"), JSON.stringify([...r.db, ...r.paddle, ...r.vercel].filter((x) => x.status !== "done")))
    // DB
    const left = (await pg.query(`select id from "user" order by id`)).rows.map((x) => x.id)
    assert.deepEqual(left, ["u_gex", "u_keep"])
    const c = await counts(pg)
    assert.equal(c.consent_records, 2) // u_keep 의 2행만
    assert.equal(c.session, 1)
    assert.equal(c.subscriptions, 1)
    assert.equal(c.access_logs, 1) // 법정 보존 표는 지우지 않았다
    assert.equal(c.webhook_events, 1) // 시험 이벤트만 사라지고 진짜 이벤트는 남았다
    const file = readFileSync(join(dir, "user-u_test1.json"), "utf8")
    const dump = JSON.parse(file)
    assert.equal(dump.rows["consent_records.user_id"].rows.length, 2)
    assert.equal(dump.rows["access_logs.actor_id"].keep, true)
    assert.ok(!file.includes("lf-test1@example.com") || dump.user.email === "lf-test1@example.com", "백업은 원본 행(로컬 .tmp)이라 이메일이 들어간다")
    // Paddle: 구독 취소 → 고객 보관. 보존 쪽은 그대로
    assert.equal(p.subs.get("sub_test00000001").status, "canceled")
    assert.equal(p.customers.get("ctm_test00000001").status, "archived")
    assert.equal(p.subs.get("sub_keep00001").status, "trialing")
    assert.equal(p.customers.get("ctm_keepsub00001").status, "active")
    assert.ok(p.calls.every((x) => x.host === "sandbox-api.paddle.com"))
    assert.ok(p.calls.filter((x) => x.method !== "GET").length === 2) // cancel 1 + archive 1
    // Vercel: 별칭 배포·최근 3개는 남고 옛 2개만 지웠다
    assert.deepEqual(v.removed.sort(), [v.urls[4], v.urls[5]].sort())
    assert.ok(v.calls.filter((a) => a[0] === "remove").every((a) => a.includes("--safe") && a.includes("--yes")))
    assert.equal(v.deployments().length, 4)
  } finally {
    await pg.close()
  }
})
