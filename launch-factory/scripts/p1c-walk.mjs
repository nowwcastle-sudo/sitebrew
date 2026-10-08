#!/usr/bin/env node
// P1C 걸어 보기(docs/qa/ux-audit/apply-p1c.md §4). adb-serve.mjs 가 띄운 mock 서버를 headless Chrome 으로 걸으며 E07·E09·H05 를 눌러 보고 화면을 저장한다.
// 서버 둘: 장면 서버(origin — 쿠키 wf_session 으로 상태 고정)와 장면 없는 서버(--origin2, `adb-serve.mjs --no-scenes --sub none` — 로그인·결제가 쪽을 건너 이어진다).
// Chrome 은 한 번에 하나, 끝나면 트리째 닫는다(web-factory cdp.mjs closeChrome). 사용: node scripts/p1c-walk.mjs <origin> --origin2 <origin2> [--only id,id] [--out <폴더>]
// 스크린샷은 docs/qa/ux-audit/assets/p1c/ 에 쓴다(비밀 없음 — mock 값뿐).
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const WF_HOME = resolve(process.env.WF_HOME || resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."))
const cdp = await import(pathToFileURL(join(WF_HOME, "factory", "qa", "cdp.mjs")).href)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const argv = process.argv.slice(2)
const origin = argv.find((a) => a.startsWith("http"))
const origin2 = argv.includes("--origin2") ? argv[argv.indexOf("--origin2") + 1] : null
if (!origin || !origin2) throw new Error("사용: node scripts/p1c-walk.mjs <origin> --origin2 <origin2> [--only id,id]")
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : null
const OUT = resolve(argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : join(ROOT, "docs", "qa", "ux-audit", "assets", "p1c"))
mkdirSync(OUT, { recursive: true })

const chrome = await cdp.startChrome(["--hide-scrollbars", "--force-color-profile=srgb", "--window-size=1280,1000"], { prefix: "p1c-walk-" })
const { ws, send, ev } = await cdp.connect(chrome.wsUrl)
await send("Page.enable")
await send("Network.enable")
const consoleErrors = []
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data)
  if (d.method === "Runtime.exceptionThrown") consoleErrors.push(d.params.exceptionDetails?.exception?.description ?? d.params.exceptionDetails?.text)
})
await send("Runtime.enable")

const results = []
const record = (id, ok, detail = "") => {
  results.push({ id, ok: !!ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}${detail ? "  — " + detail : ""}`)
}

async function viewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 })
}
async function scene(name) {
  await send("Network.setCookie", { name: "wf_session", value: encodeURIComponent(name), url: origin, path: "/" })
}
async function open(path, base = origin) {
  const url = base + path
  const nav = await cdp.navigateAndWait(send, ev, url, { scene: null })
  await cdp.assertOpened(nav, ev, url)
  await sleep(1800) // 등장 연출·하이드레이션
}
async function shot(name, { full = true } = {}) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full })
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.result.data, "base64"))
}
const FIND = `(sel, text) => [...document.querySelectorAll(sel)].find((e) => (!text || e.textContent.trim().includes(text)) && e.getClientRects().length)`
const has = (sel, txt = "") => ev(`!!(${FIND})(${JSON.stringify(sel)}, ${JSON.stringify(txt)})`)
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g, " ").trim() ?? null`)
const bodyText = () => ev(`document.body.innerText.replace(/\\s+/g, " ")`)
async function click(sel, txt = "") {
  const pt = await ev(`(() => { const e = (${FIND})(${JSON.stringify(sel)}, ${JSON.stringify(txt)}); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!pt) throw new Error(`누를 것이 없다: ${sel} ${txt}`)
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pt.x, y: pt.y })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 })
  await sleep(700)
}
/** 동의 체크(role=checkbox 단추) */
async function check(txt) {
  const pt = await ev(`(() => { const e = [...document.querySelectorAll('[role="checkbox"]')].find((c) => (c.closest("div")?.parentElement?.textContent || "").includes(${JSON.stringify(txt)})); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!pt) throw new Error(`체크가 없다: ${txt}`)
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 })
  await sleep(300)
}
async function fill(sel, value) {
  const ok = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.focus(); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event("input", { bubbles: true })); return true })()`)
  if (!ok) throw new Error(`채울 칸이 없다: ${sel}`)
}
const active = () => ev(`(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id, text: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 60) } : null })()`)
const rect = (sel, txt = "") => ev(`(() => { const e = (${FIND})(${JSON.stringify(sel)}, ${JSON.stringify(txt)}); if (!e) return null; const r = e.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right), vh: innerHeight, vw: innerWidth } })()`)
async function waitFor(fn, ms = 10_000) {
  const end = Date.now() + ms
  for (;;) {
    if (await fn()) return true
    if (Date.now() > end) return false
    await sleep(250)
  }
}
const links = () => ev(`[...document.querySelectorAll("main a, [data-home-status] a, nav[aria-label='Product pages'] a")].map((a) => a.getAttribute("href"))`)

const ISSUER = /card issuer may convert/i
const SCENARIOS = {
  // ── E07 통화 문구: 요금표 꼬리말 · 업그레이드 안내 · 결제 동의 줄(첫 화면 안에 보이는지) ──────────────────────────
  async currency() {
    await viewport(1280, 800)
    await scene("signed-out")
    await open("/pricing")
    const foot = await bodyText()
    record("E07 요금표: USD 한 줄 + 카드사 환전 가능성", /Prices are in USD per month\./.test(foot) && ISSUER.test(foot), (foot.match(/Prices are in USD[^.]*\.[^.]*\./) ?? [""])[0])
    await shot("pricing-1-desktop")
    await scene("signed-in:sub=none")
    await open("/upgrade?plan=pro")
    const body = await bodyText()
    record("E07 업그레이드 대화상자 안내에 USD 와 카드사 환전 가능성", /Prices are in USD/.test(body) && ISSUER.test(body.slice(body.indexOf("Compare it"))))
    const term = await text('[data-pinned-terms] [data-terms="first-charge"], [data-terms="first-charge"]')
    record("E07 동의 곁 첫 결제 줄: 금액 + USD + 카드사 환전", !!term && /USD/.test(term) && ISSUER.test(term), String(term))
    const trial = await rect("button", "free trial")
    record("E04 유지: 필수 체크·단추 줄이 1280×800 첫 화면 안", !!trial && trial.bottom <= trial.vh, JSON.stringify(trial))
    await shot("upgrade-1-desktop", { full: false })
    await viewport(390, 700)
    await open("/upgrade?plan=pro")
    const trialM = await rect("button", "free trial")
    record("E04 유지: 390×700 에서도 행동 줄이 첫 화면 안", !!trialM && trialM.bottom <= trialM.vh, JSON.stringify(trialM))
    const deepest = await ev(`Math.max(...[...document.querySelectorAll('[role="dialog"] h2, [role="dialog"] button, [role="dialog"] li')].map((e) => Math.round(e.getBoundingClientRect().right)))`)
    record("E07 390 폭에서 긴 줄이 화면 밖으로 밀리지 않는다", deepest <= 390, `가장 먼 오른쪽 ${deepest}`)
    await shot("upgrade-2-mobile", { full: false })
  },

  // ── 흐름: 업그레이드(mock 결제) → 결제 창이 끝났을 때의 복귀(/billing/return) → 로그인 뒤 첫 화면 ─────────────────────
  // Paddle 결제 창은 Paddle.js(외부 스크립트)라 mock 에서 열리지 않는다 — 창이 끝나면 하는 일(eventCallback)이 「/billing/return?_ptxn= 으로 이동」이라 그 이동을 그대로 한다.
  async flow() {
    await viewport(1280, 900)
    await send("Network.clearBrowserCookies")
    await open("/sign-in", origin2)
    if (await has('input[type="email"]')) {
      await fill('input[type="email"]', "kim@example.com")
      await fill('input[type="password"]', "correct horse battery")
      await click("button", "Sign in")
      await sleep(1500)
    }
    await open("/", origin2)
    const h0 = await text("[data-home-status]")
    record("H05 시작(구독 없음): 「free plan」 한 줄 + 「Upgrade to a paid plan」 행동", /free plan/.test(h0 ?? "") && (await has("[data-home-status] a", "Upgrade to a paid plan")), String(h0))
    await shot("home-0-before-upgrade")
    await open("/upgrade?plan=pro", origin2)
    await check("withdrawal")
    await click("button", "free trial")
    const started = await waitFor(async () => /Your trial has started/.test(await bodyText()), 12_000)
    record("업그레이드(mock 결제): 체험이 시작된다", started, (await bodyText()).slice(0, 160))
    await open("/billing/return?_ptxn=txn_01abcdefghijklmnopqrstuvwx", origin2)
    const done = await waitFor(async () => /You're all set/.test(await bodyText()), 12_000)
    record("결제 복귀: 「You're all set」", done)
    const receipt = await text("[data-receipt]")
    record("E09 영수증이 가는 주소가 화면에 있다", /Your receipt is emailed to kim@example\.com\./.test(receipt ?? ""), String(receipt))
    record("E09 「View invoices and receipts」 단추가 있다", await has("button", "View invoices and receipts"))
    const a = await active()
    record("E09 유지(F3): 포커스는 제목", a?.tag === "H1", JSON.stringify(a))
    await shot("return-1-done")
    await click("button", "View invoices and receipts")
    await sleep(800)
    record("E09 단추를 눌러도 오류 알림이 없다(mock 포털 주소를 새 창으로)", !(await has('[role="alert"]')), String(await text('[role="alert"]')))
    await viewport(390, 800)
    await open("/billing/return?_ptxn=txn_01abcdefghijklmnopqrstuvwx", origin2)
    await waitFor(async () => /You're all set/.test(await bodyText()), 12_000)
    const vw = await ev(`document.documentElement.scrollWidth`)
    record("E09 390 폭에서 가로로 넘치지 않는다", vw <= 390, `scrollWidth ${vw}`)
    await shot("return-2-done-mobile")
    await viewport(1280, 900)
    await open("/billing/return", origin2)
    const miss = await bodyText()
    record("E09 대조군: 결제 id 없는 복귀 화면에는 영수증 줄·청구서 단추가 없다", !(await has("[data-receipt]")) && !(await has("button", "View invoices")) && /needs a payment to check/.test(miss))
    await open("/", origin2)
    const h1 = await text("[data-home-status]")
    const l1 = await links()
    record("H05 결제 뒤 첫 화면(체험 중): 체험 종료일 한 줄 + 「Manage billing」", /trial ends on/.test(h1 ?? "") && (await has("[data-home-status] a", "Manage billing")), String(h1))
    record("H05 유료 사용자에게 /upgrade 링크가 없다", !l1.includes("/upgrade"), JSON.stringify(l1))
    record("H05 첫 화면에 환영 + 계정 홈 링크", /Welcome back, Alex Example/.test(await bodyText()) && l1.includes("/account"), JSON.stringify(l1))
    await shot("home-1-after-upgrade")
  },

  // ── H05 구독 상태마다의 첫 화면 ────────────────────────────────────────────────────────────────
  async home() {
    await viewport(1280, 800)
    await scene("signed-out")
    await open("/")
    const out = await links()
    record("H05 대조군: 로그아웃 첫 화면은 그대로(Sign in·가입·요금)", out.includes("/sign-in") && out.includes("/sign-up") && !(await has("[data-home-status]")), JSON.stringify(out))
    const want = {
      none: { text: /free plan/, act: "/upgrade", upgrade: true },
      expired: { text: /has ended/, act: "/upgrade", upgrade: true },
      trialing: { text: /trial ends on/, act: "/account/billing", upgrade: false },
      active: { text: /renews on/, act: "/account/billing", upgrade: false },
      past_due: { text: /payment didn't go through/, act: "/account/billing", upgrade: false },
      paused: { text: /paused/, act: "/account/billing", upgrade: false },
      canceled: { text: /ends on/, act: "/account/billing", upgrade: false },
    }
    for (const [sub, w] of Object.entries(want)) {
      await scene(`signed-in:sub=${sub}`)
      await open("/")
      const t = await text("[data-home-status]")
      const l = await links()
      const act = await ev(`document.querySelector("[data-home-status] a")?.getAttribute("href") ?? null`)
      const clean = !/undefined|null|NaN|\{|\}/.test(t ?? "")
      record(`H05 sub=${sub}: 상태 줄·행동·Upgrade 링크`, w.text.test(t ?? "") && clean && act === w.act && l.includes("/upgrade") === w.upgrade, JSON.stringify({ t, act, upgrade: l.includes("/upgrade") }))
      if (["none", "past_due", "active", "canceled"].includes(sub)) await shot(`home-${sub}`, { full: false })
    }
    await viewport(390, 800)
    await scene("signed-in:sub=past_due")
    await open("/")
    record("H05 390 폭에서 가로로 넘치지 않는다", (await ev(`document.documentElement.scrollWidth`)) <= 390)
    const act = await rect("[data-home-status] a")
    record("H05 행동 링크가 누르기 쉬운 크기(높이 ≥ 44)", !!act && act.h >= 44, JSON.stringify(act))
    await shot("home-past_due-mobile", { full: false })
  },
}

async function declineConsent() {
  for (const base of [origin, origin2]) {
    await scene("signed-out")
    await open("/pricing", base)
    if (await waitFor(() => has("button", "Reject all"), 8000)) await click("button", "Reject all")
  }
}

const wanted = Object.keys(SCENARIOS).filter((k) => !only || only.includes(k))
let failed = false
try {
  await viewport(1280, 900)
  await declineConsent()
  for (const name of wanted) {
    console.log(`\n── ${name}`)
    try {
      await SCENARIOS[name]()
    } catch (e) {
      failed = true
      record(`${name}: 걷기 실패`, false, String(e?.message ?? e).slice(0, 300))
    }
  }
} finally {
  await cdp.closeChrome(chrome)
}
record("콘솔 예외 0", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "))
writeFileSync(join(OUT, "results.json"), JSON.stringify({ results }, null, 2))
const bad = results.filter((r) => !r.ok)
console.log(`\n${results.length - bad.length}/${results.length} 통과`)
process.exit(bad.length || failed ? 1 : 0)
