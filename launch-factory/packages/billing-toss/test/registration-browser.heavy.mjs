import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { chromium } from "playwright"
import ts from "typescript"
import { createTestRegistration, createTestTossClient, handleTestRegistrationCallback } from "../src/index.ts"

test("브라우저 버튼과 fake SDK 인증 리다이렉트가 서버 콜백과 원장까지 이어진다", { timeout: 60_000 }, async () => {
  const pg = new PGlite()
  let browser
  try {
    await pg.exec('CREATE TABLE "user" (id text PRIMARY KEY); CREATE TABLE account_deletions (user_id text, status text)')
    await pg.exec(await readFile(new URL("../../db/migrations/0020_toss_registration.sql", import.meta.url), "utf8"))
    await pg.exec(await readFile(new URL("../../db/migrations/0021_toss_registration_identity.sql", import.meta.url), "utf8"))
    await pg.exec(await readFile(new URL("../../db/migrations/0022_toss_schedule.sql", import.meta.url), "utf8"))
    await pg.exec(await readFile(new URL("../../db/migrations/0023_toss_cancel_at.sql", import.meta.url), "utf8"))
    await pg.query('INSERT INTO "user" VALUES ($1)', ["browser_user"])
    const db = { query: (sql, params) => pg.query(sql, params), transaction: (run) => pg.transaction((tx) => run({ query: (sql, params) => tx.query(sql, params) })) }
    let issues = 0
    const client = createTestTossClient({ secretKey: "test_sk_fake", merchantId: "test-mid", fetch: async (_url, init) => { issues++; const body = JSON.parse(init.body); return new Response(JSON.stringify({ mId: "test-mid", customerKey: body.customerKey, billingKey: "fake_billing_key", card: {} }), { status: 200 }) } })
    const registration = createTestRegistration({ db, client, encryptionKey: Buffer.alloc(32, 5), origin: "https://site.example.test", plans: [{ id: "monthly", productId: "product", orderName: "월 구독", amount: 4900 }] })
    const start = await registration.start({ userId: "browser_user", planId: "monthly" })
    assert.equal(start.status, "ready")
    const source = await readFile(new URL("../src/sdk.ts", import.meta.url), "utf8")
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("export async function", "async function")
    const markup = `<button id="start">카드 등록</button><script>${compiled}\nconst start=${JSON.stringify(start)}; document.querySelector('#start').onclick=()=>openTestBillingAuth({...start,clientKey:'test_ck_fake',origin:location.origin,sdk:()=>({payment:({customerKey})=>({requestBillingAuth:async (request)=>{const url=new URL(request.successUrl);url.searchParams.set('customerKey',customerKey);url.searchParams.set('authKey','browser_fake_auth');location.href=url.href}})})});</script>`
    browser = await chromium.launch({ channel: "chrome", headless: true })
    const page = await browser.newPage()
    await page.route("https://site.example.test/**", async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html", body: markup })
      if (url.pathname === "/api/toss/registration/complete") {
        const res = await handleTestRegistrationCallback(new Request(url), "browser_user", registration)
        assert.equal(res.status, 303)
        const target = res.headers.get("location")
        assert.equal(target, "https://site.example.test/account/billing?registration=registered")
        // Playwright는 가로챈 요청의 HTTP redirect 후속 요청을 다시 라우팅하지 않는다.
        return route.fulfill({ status: 200, contentType: "text/html", body: `<script>location.replace(${JSON.stringify(target)})</script>` })
      }
      return route.fulfill({ status: 200, contentType: "text/html", body: "등록 결과" })
    })
    await page.goto("https://site.example.test/")
    await Promise.all([page.waitForURL("**/account/billing?registration=registered"), page.locator("#start").click()])
    assert.equal(issues, 1)
    const result = await pg.query("SELECT user_id,amount,status FROM toss_ledger_subscriptions WHERE user_id=$1", ["browser_user"])
    assert.deepEqual(result.rows, [{ user_id: "browser_user", amount: 4900, status: "enabled" }])
    assert.equal((await pg.query("SELECT count(*)::int AS n FROM toss_ledger_charges")).rows[0].n, 0)
  } finally {
    if (browser) await browser.close()
    await pg.close()
  }
})
