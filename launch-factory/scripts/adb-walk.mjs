#!/usr/bin/env node
// LFADB 걸어 보기(docs/qa/ux-audit/apply-lfadb.md §4). adb-serve.mjs 가 띄운 mock 서버를 headless Chrome 으로 걸으며 바꾼 흐름을 눌러 보고 화면을 저장한다.
// 장면은 쿠키 `wf_session`(web-factory G1 계약 — template/lib/mock-scene.ts)이 정한다. 스크린샷은 docs/qa/ux-audit/assets/adb/ 에 쓴다(비밀 없음 — mock 값뿐).
// Chrome 은 한 번에 하나, 끝나면 트리째 닫는다(web-factory cdp.mjs closeChrome). 사용: node scripts/adb-walk.mjs <origin> [--only id,id] [--out <폴더>]
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const WF_HOME = resolve(process.env.WF_HOME || resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."))
const cdp = await import(pathToFileURL(join(WF_HOME, "factory", "qa", "cdp.mjs")).href)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const argv = process.argv.slice(2)
const origin = argv.find((a) => a.startsWith("http"))
if (!origin) throw new Error("사용: node scripts/adb-walk.mjs <origin> [--only id,id]")
// --origin2: 장면 쿠키를 읽지 않는 서버(adb-serve.mjs --no-scenes). 해지 예약처럼 여러 쪽을 거쳐 남는 상태를 걸을 때만 쓴다
const origin2 = argv.includes("--origin2") ? argv[argv.indexOf("--origin2") + 1] : null
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1].split(",") : null
const OUT = resolve(argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : join(ROOT, "docs", "qa", "ux-audit", "assets", "adb"))
mkdirSync(OUT, { recursive: true })

const chrome = await cdp.startChrome(["--hide-scrollbars", "--force-color-profile=srgb", "--window-size=1280,1000"], { prefix: "adb-walk-" })
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
// 페이지 안에서 요소를 찾는 식(보이는 것 중 텍스트 포함 일치)
const FIND = `(sel, text) => [...document.querySelectorAll(sel)].find((e) => (!text || e.textContent.trim().includes(text)) && e.getClientRects().length)`
const has = (sel, txt = "") => ev(`!!(${FIND})(${JSON.stringify(sel)}, ${JSON.stringify(txt)})`)
const attr = (sel, a, txt = "") => ev(`(${FIND})(${JSON.stringify(sel)}, ${JSON.stringify(txt)})?.getAttribute(${JSON.stringify(a)}) ?? null`)
const bodyText = () => ev(`document.body.innerText`)
async function click(sel, txt = "") {
  const pt = await ev(`(() => { const e = (${FIND})(${JSON.stringify(sel)}, ${JSON.stringify(txt)}); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!pt) throw new Error(`누를 것이 없다: ${sel} ${txt}`)
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pt.x, y: pt.y })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 })
  await sleep(700)
}
/** 동의 체크(role=checkbox 단추) — 묶음 글에 txt 가 든 것을 누른다 */
async function check(txt) {
  const pt = await ev(`(() => { const e = [...document.querySelectorAll('[role="checkbox"]')].find((c) => (c.closest("label")?.textContent || c.parentElement?.textContent || "").includes(${JSON.stringify(txt)})); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!pt) throw new Error(`체크가 없다: ${txt}`)
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 })
  await sleep(300)
}
async function fill(sel, value) {
  const ok = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.focus(); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event("input", { bubbles: true })); return true })()`)
  if (!ok) throw new Error(`채울 칸이 없다: ${sel}`)
}
async function key(k) {
  const code = { Escape: 27, Enter: 13, Tab: 9 }[k]
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: code })
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: code })
  await sleep(600)
}
const active = () => ev(`(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id, type: a.getAttribute("type"), text: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 60) } : null })()`)
const rect = (sel, txt = "") => ev(`(() => { const e = (${FIND})(${JSON.stringify(sel)}, ${JSON.stringify(txt)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), vh: innerHeight } })()`)
async function waitFor(fn, ms = 10_000) {
  const end = Date.now() + ms
  for (;;) {
    if (await fn()) return true
    if (Date.now() > end) return false
    await sleep(250)
  }
}
const h1Count = () => ev(`document.querySelectorAll("h1").length`)

const SCENARIOS = {
  // ── A02 가입: 이미 있는 이메일 / ?plan= 이어짐 ─────────────────────────────────
  async signup() {
    await viewport(1280, 1000)
    await scene("signed-out")
    await open("/sign-up")
    await fill('input[type="email"]', "taken@example.com")
    await fill('input[type="password"]', "correct horse battery")
    await click("button", "Next")
    await shot("signup-1-agreements")
    record("A04 약관·정책 링크가 새 탭으로 열린다", (await ev(`[...document.querySelectorAll('a[target="_blank"]')].filter((a) => /terms|privacy/.test(a.getAttribute("href"))).length`)) >= 2, "target=_blank 링크 " + (await ev(`document.querySelectorAll('a[target="_blank"]').length`)))
    await check("Terms of Service")
    await check("Privacy Policy")
    await check("14 years")
    await click("button", "Sign up")
    await sleep(1000)
    await shot("signup-2-email-exists")
    const alertBox = await ev(`(() => { const e = document.querySelector("[data-account-exists]"); return e ? { role: e.getAttribute("role"), links: [...e.querySelectorAll("a")].map((a) => ({ t: a.textContent.trim(), h: a.getAttribute("href") })), text: e.innerText.slice(0, 160) } : null })()`)
    record("A02 중복 이메일: 알림(role=alert) + [Sign in]·[Reset your password] 링크", !!alertBox && alertBox.role === "alert" && alertBox.links.some((l) => l.h === "/sign-in") && alertBox.links.some((l) => l.h === "/forgot-password"), JSON.stringify(alertBox))
    const a = await active()
    record("A02 포커스는 오류가 난 이메일 칸", a?.type === "email" || /email/i.test(a?.id ?? ""), JSON.stringify(a))
    record("A02 단계 ①(이메일 칸)로 돌아왔다", await has('input[type="email"]'))
    // 대조군: 다른 이메일은 가입이 끝난다
    await open("/sign-up?plan=pro")
    await fill('input[type="email"]', "fresh.person@example.com")
    await fill('input[type="password"]', "correct horse battery")
    await click("button", "Next")
    await check("Terms of Service")
    await check("Privacy Policy")
    await check("14 years")
    await click("button", "Sign up")
    await waitFor(() => has("a", "Continue to checkout"), 15_000)
    await shot("signup-3-done-with-plan")
    const done = await ev(`[...document.querySelectorAll("a")].map((a) => ({ t: a.textContent.trim(), h: a.getAttribute("href") })).filter((l) => /upgrade|pricing/.test(l.h ?? ""))`)
    record("E01 ?plan=pro 로 온 가입: 완료 화면의 다음 행동이 /upgrade?plan=pro", done.some((l) => l.h === "/upgrade?plan=pro"), JSON.stringify(done))
  },

  // ── 재설정: 한 칸 판 ──────────────────────────────────────────────────────────────
  async reset() {
    await viewport(1280, 900)
    await scene("signed-out")
    await open("/reset-password?token=abc123")
    await shot("reset-1-form")
    const inputs = await ev(`[...document.querySelectorAll("form input")].filter((i) => i.getClientRects().length && i.type !== "hidden").map((i) => ({ type: i.type, name: i.name, auto: i.autocomplete }))`)
    record("재설정: 비밀번호 칸이 하나뿐이다(한 번 더 칸 없음)", inputs.length === 1 && /password|text/.test(inputs[0].type), JSON.stringify(inputs))
    record("재설정: form[data-confirm-field] 없음", !(await ev(`!!document.querySelector("form[data-confirm-field]")`)))
    record("재설정: 「Show password」 보기 토글이 있다(aria-pressed)", (await ev(`document.querySelector('form button[aria-label="Show password"][aria-pressed]')?.getAttribute("aria-pressed")`)) === "false")
    record("재설정: h1 은 하나", (await h1Count()) === 1, String(await h1Count()))
    await fill("form input", "short")
    // 포커스 이동은 진짜 마우스(CDP Input.dispatchMouseEvent)로 본다 — v0.0.11 이 마우스 제출이 첫 오류 칸으로 포커스를 옮기도록 고쳤다(칸 검사가 포인터를 뗀 뒤로 미뤄진다)
    await click('form button[type="submit"]')
    await sleep(1200)
    const a1 = await active()
    record("재설정: 짧은 비밀번호 → 칸 오류, 포커스는 그 칸", /too short|8 characters/i.test(await bodyText()) && a1?.tag === "INPUT" && a1?.type === "password", JSON.stringify(a1))
    await shot("reset-2-short-error")
    await fill("form input", "a-long-enough-password")
    await click("button", "Save new password")
    await sleep(800)
    record("재설정: 성공 → 「Your password is updated」 + [Go to sign in]", (await bodyText()).includes("Your password is updated") && (await attr("a", "href", "Go to sign in")) === "/sign-in")
    await shot("reset-3-done")
    await open("/reset-password?error=INVALID_TOKEN")
    record("재설정: ?error=INVALID_TOKEN → 폼 없이 「This link doesn't work」 + 새 링크 받기", (await bodyText()).includes("This link doesn't work") && !(await has("form input")) && (await attr("a", "href", "Send me a new link")) === "/forgot-password")
    await shot("reset-4-invalid-link")
    await open("/reset-password?token=invalid")
    await fill("form input", "a-long-enough-password")
    await click("button", "Save new password")
    await sleep(800)
    record("재설정: 만료된 토큰을 보내면 같은 안내로 바뀐다(code invalid_token)", (await bodyText()).includes("This link doesn't work"))
  },

  // ── E01 요금표 ─────────────────────────────────────────────────────────────────────
  async pricing() {
    await viewport(1280, 900)
    const cards = () => ev(`[...document.querySelectorAll('[data-block="pricing-three-tier-cards"] ul[data-count] > li')].map((li) => ({ name: li.querySelector("h3")?.textContent.trim(), current: !!li.querySelector("[data-current-plan]") || !!li.querySelector("[data-current-plan], [aria-current]"), link: (li.querySelector("a[href]")?.getAttribute("href")) ?? null, label: (li.querySelector("a[href], [data-current-plan]")?.textContent ?? "").trim() }))`)
    await scene("signed-out")
    await open("/pricing")
    const out = await cards()
    await shot("pricing-1-signed-out")
    record("E01 로그아웃: 단추가 /sign-up?plan=<id>", out.length >= 2 && out.every((c) => /^\/sign-up\?plan=/.test(c.link ?? "")), JSON.stringify(out.map((c) => c.link)))
    await scene("signed-in:sub=none")
    await open("/pricing")
    const inn = await cards()
    await shot("pricing-2-signed-in-free")
    record("E01 로그인(무료): 단추가 /upgrade?plan=<id>", inn.length >= 2 && inn.every((c) => /^\/upgrade\?plan=/.test(c.link ?? "")), JSON.stringify(inn.map((c) => c.link)))
    await scene("signed-in:sub=active")
    await open("/pricing")
    const cur = await cards()
    await shot("pricing-3-signed-in-current")
    const current = cur.filter((c) => c.current)
    record("E01 지금 쓰는 요금제 카드는 링크가 아닌 표지(「Your current plan」)", current.length === 1 && !current[0].link && /current plan/i.test(current[0].label), JSON.stringify(cur))
    record("E01 나머지 카드는 /upgrade?plan=<id>", cur.filter((c) => !c.current).every((c) => /^\/upgrade\?plan=/.test(c.link ?? "")))
    await click("a", cur.find((c) => !c.current && c.link)?.label ?? "Get")
    await sleep(1500)
    record("E02 로그인한 사람이 요금표 단추로 결제 화면(/upgrade)에 닿는다", new URL(await ev("location.href")).pathname === "/upgrade", await ev("location.href"))
  },

  // ── E04 업그레이드 ─────────────────────────────────────────────────────────────────
  async upgrade() {
    await viewport(1280, 800)
    await scene("signed-out")
    await open("/upgrade?plan=pro")
    const link = await attr('a[href*="next="]', "href")
    record("E01 로그아웃으로 /upgrade?plan=pro → 로그인 안내, 돌아올 주소에 plan 이 실린다", /next=%2Fupgrade%3Fplan%3Dpro/.test(link ?? ""), String(link))
    await scene("signed-in:sub=none")
    await open("/upgrade?plan=pro")
    await shot("upgrade-1-free-desktop")
    const body = await bodyText()
    record("E04 무료 사용자 표 머리가 「Free plan」(「Current (Starter)」 아님)", body.includes("Free plan") && !body.includes("Current (Starter)"))
    record("E04 체험 단추 글에 체험 뒤 금액이 든다", /free trial, then/i.test(body), (body.match(/Start your[^\n]*/) ?? [""])[0])
    record("E04 첫 결제 문장에 결제 수단이 든다", /payment method you add at checkout/.test(body))
    const trial = await rect("button", "free trial")
    const later = await rect("button", "Maybe later")
    record("E04 필수 체크·단추 줄이 스크롤 없이 첫 화면 안에 있다(1280×800)", !!trial && trial.bottom <= trial.vh, JSON.stringify(trial))
    record("L3 두 선택지는 같은 크기·같은 줄", !!trial && !!later && Math.abs(trial.h - later.h) <= 2 && Math.abs(trial.y - later.y) <= 4, JSON.stringify({ trial, later }))
    await viewport(390, 700)
    await open("/upgrade?plan=pro")
    const trialM = await rect("button", "free trial")
    await shot("upgrade-2-free-mobile", { full: false })
    record("E04 390×700 폭에서도 행동 줄이 첫 화면 안", !!trialM && trialM.bottom <= trialM.vh, JSON.stringify(trialM))
    const dlgRight = await ev(`Math.round(document.querySelector('[role="dialog"]').getBoundingClientRect().right)`)
    const deepest = await ev(`Math.max(...[...document.querySelectorAll('[role="dialog"] h2, [role="dialog"] button')].map((e) => Math.round(e.getBoundingClientRect().right)))`)
    record("E04 390 폭에서 대화상자 안 내용이 화면 밖으로 밀리지 않는다", deepest <= 390, `대화상자 오른쪽 ${dlgRight}, 가장 먼 제목·단추 오른쪽 ${deepest} (폭 390)`)
    await viewport(1280, 800)
    await open("/upgrade?plan=pro")
    await key("Escape")
    const af = await active()
    record("E04 Esc 로 닫으면 포커스가 body 가 아닌 연 단추로 돌아온다", af?.tag !== "BODY" && af?.tag !== "HTML" && !!af, JSON.stringify(af))
    await shot("upgrade-3-closed")
  },

  // ── F02 결제 실패 / E02·F03 결제 관리 ─────────────────────────────────────────────
  async billing() {
    await viewport(1280, 900)
    await scene("signed-in:sub=past_due")
    await open("/account/billing")
    await shot("billing-1-past-due")
    const banner = await ev(`(() => { const e = document.querySelector("[data-payment-issue]"); return e ? { role: e.getAttribute("role"), text: e.innerText.replace(/\\s+/g, " ").slice(0, 260), btn: [...e.querySelectorAll("button")].map((b) => b.textContent.trim()) } : null })()`)
    record("F02 결제 실패 띠: role=alert, 다시 결제하는 날 + 접근이 멈추는 날 + [Update payment method]", !!banner && banner.role === "alert" && /try again on/i.test(banner.text) && /until [A-Z][a-z]+ \d/.test(banner.text) && banner.btn.some((b) => /Update payment method/.test(b)), JSON.stringify(banner))
    const labels = await ev(`[...document.querySelectorAll("dt")].map((d) => d.textContent.trim())`)
    record("F02 결제 관리의 날짜 칸이 「Next payment」가 아니라 「Next attempt」", labels.includes("Next attempt") && !labels.includes("Next payment"), JSON.stringify(labels))
    record("F02 결제 관리 안내 글에 접근이 멈추는 날이 있다", /keep using everything until [A-Z][a-z]+ \d/.test(await bodyText()))
    await open("/upgrade")
    record("F02 결제 화면(/upgrade) 위에도 결제 실패 띠", await has("[data-payment-issue]"))
    await scene("signed-in:sub=active")
    await open("/account/billing")
    record("F02 대조군: 정상 구독에는 결제 실패 띠가 보이지 않는다", !(await has("[data-payment-issue]")))
    await scene("signed-in:sub=expired")
    await open("/account/billing")
    await shot("billing-2-expired-restart")
    const rs = await ev(`(() => { const e = document.querySelector("[data-restart]"); return e ? [...e.querySelectorAll("a")].map((a) => a.getAttribute("href")) : null })()`)
    record("F03 끝난 구독: 「Restart」 한 번 → /upgrade?plan=<id>", !!rs && rs.some((h) => /^\/upgrade\?plan=/.test(h)), JSON.stringify(rs))
    await scene("signed-in:sub=none")
    await open("/account/billing")
    record("E02 구독 없음: 결제 관리의 단추가 /upgrade 로 간다", (await attr("a", "href", "Choose a plan")) === "/upgrade")
  },

  // ── F04 갱신 동의(메일 링크) ──────────────────────────────────────────────────────
  async renewal() {
    await viewport(1280, 900)
    await scene("signed-in:sub=pending-price-change")
    await open("/account/billing/price-change")
    await shot("renewal-1-price-change")
    const body = await bodyText()
    record("F04 결제 방법·해지 방법 고지가 단추 위에 있다", /payment method already on your account/.test(body) && /cancel any time under Account > Billing/.test(body))
    const acc = await rect("button", "Accept the new price")
    const dec = await rect("button", "Decline and cancel")
    record("L3 동의·거절이 같은 크기·같은 줄", !!acc && !!dec && Math.abs(acc.h - dec.h) <= 2 && Math.abs(acc.w - dec.w) <= 8 && Math.abs(acc.y - dec.y) <= 4, JSON.stringify({ acc, dec }))
    record("F04 쪽을 열었다고 아무것도 실행되지 않는다(표가 그대로)", await has("table"))
    await open("/account/billing/cancel")
    record("F04 거절 링크 쪽도 같은 블록", (await has("button", "Accept the new price")) && (await has("button", "Decline and cancel")))
    await scene("signed-in:sub=active")
    await open("/account/billing/price-change")
    record("F04 대조군: 동의할 것이 없으면 안내", (await bodyText()).includes("no price change waiting"))
  },

  // ── F12·F13·F05 해지 ─────────────────────────────────────────────────────────────
  async cancel() {
    await viewport(1280, 900)
    await scene("signed-in:sub=active")
    await open("/account/cancel")
    await shot("cancel-1-start")
    const flow = await ev(`(() => { const e = document.querySelector("[data-flow='cancel']"); return e ? { steps: e.getAttribute("data-steps"), step: e.getAttribute("data-step") } : null })()`)
    record("F12 해지 흐름 표지: data-steps ≤ 3(가입 3단계 이하)", !!flow && Number(flow.steps) <= 3, JSON.stringify(flow))
    record("F12 lead 가 「세 단계」라고 못 박지 않는다", !/three/i.test(await bodyText()))
    await click("button", "Continue cancelling")
    await shot("cancel-2-alternatives")
    await click("button", "Cancel subscription")
    await sleep(1000)
    if (!(await has("[data-done]")) && (await has("button", "Cancel subscription"))) {
      await click("button", "Cancel subscription")
      await sleep(1000)
    }
    await shot("cancel-3-done")
    const body = await bodyText()
    record("F13 완료 화면: 「You won't be charged again」·종료일·다른 경로 안내", (await has("[data-no-charge]")) && (await has("[data-end-date]")) && (await has("[data-other-channels]")), (await ev(`document.querySelector("[data-done]")?.innerText.replace(/\\s+/g, " ").slice(0, 300)`)) ?? body.slice(0, 200))
    record("F13 「앱을 지우는 것은 해지가 아니다」 안내", /Deleting the app doesn't cancel/.test(body))
  },

  // ── F05 이미 해지가 예약된 구독 — 상태가 쪽을 건너 남아야 해서 장면 쿠키 없는 서버(--origin2)에서 로그인부터 한다 ──
  async scheduled() {
    if (!origin2) return record("F05 걷기: --origin2 가 없다(adb-serve.mjs --no-scenes 서버가 필요하다)", false)
    await viewport(1280, 900)
    await send("Network.clearBrowserCookies")
    await open("/sign-in", origin2)
    // 이 서버는 로그인이 프로세스에 남는다 — 이미 로그인돼 있으면(이전 걷기) 로그인 칸이 없다
    if (await has('input[type="email"]')) {
      await fill('input[type="email"]', "kim@example.com")
      await fill('input[type="password"]', "correct horse battery")
      await click("button", "Sign in")
      await sleep(1500)
    }
    await open("/account/cancel", origin2)
    await click("button", "Continue cancelling")
    await click("button", "Cancel subscription")
    await sleep(1000)
    record("F05 준비: 해지(기간 끝)를 실행했다", await has("[data-done]"))
    await open("/account/cancel", origin2)
    await shot("cancel-4-already-scheduled")
    const sched = await ev(`document.querySelector("[data-cancel-scheduled]")?.innerText.replace(/\\s+/g, " ").slice(0, 220) ?? null`)
    record("F05 이미 해지 예약: 흐름 대신 상태 + 「Keep my plan」 하나", !!sched && (await has("button", "Keep my plan")) && !(await has("button", "Continue cancelling")), String(sched))
    await click("button", "Keep my plan")
    await sleep(1200)
    await shot("cancel-5-kept")
    record("F05 「Keep my plan」을 누르면 해지가 취소된다", /Cancellation undone/.test(await bodyText()))
    await open("/account/cancel", origin2)
    record("F05 취소한 뒤에는 다시 해지 흐름이 열린다", await has("button", "Continue cancelling"))
  },

  // ── P1AB B1: A05 이메일 채널만 · K09 필수/선택 묶음 · A03 약한 비밀번호 · C07 재설정 완료 문구 ─────────────────────────────
  async p1ab_b1() {
    await viewport(1280, 1000)
    await scene("signed-out")
    await open("/sign-up")
    await fill('input[type="email"]', "fresh.person@example.com")
    await fill('input[type="password"]', "password")
    await click("button", "Next")
    await waitFor(async () => /too easy to guess/i.test(await bodyText()), 8000)
    const a1 = await active()
    record("A03 가입: 흔한 비밀번호(password)는 ①에서 막힌다 — 칸 오류 + 포커스가 그 칸", /too easy to guess/i.test(await bodyText()) && (await has('input[type="email"]')) && a1?.type === "password", JSON.stringify({ a1, alerts: await ev(`[...document.querySelectorAll("[role=alert],[aria-invalid=true]")].map((e) => e.id + ":" + e.innerText.slice(0, 80))`) }))
    await shot("b1-signup-1-weak")
    await fill('input[type="password"]', "blue-Harbor-4821")
    await click("button", "Next")
    await shot("b1-signup-2-agreements")
    const groups = await ev(`[...document.querySelectorAll("[data-consent-group]")].map((g) => ({ g: g.getAttribute("data-consent-group"), legend: g.querySelector("legend")?.innerText.replace(/\\s+/g, " ").trim(), boxes: [...g.querySelectorAll('[role="checkbox"]')].map((c) => (c.closest("label")?.textContent || c.parentElement?.textContent || "").replace(/\\s+/g, " ").trim()), checked: [...g.querySelectorAll('[role="checkbox"]')].filter((c) => c.getAttribute("aria-checked") === "true").length }))`)
    const req = groups.find((x) => x.g === "required")
    const opt = groups.find((x) => x.g === "optional")
    record("K09 필수 동의는 이름 있는 묶음(fieldset+legend), 미리 켜진 칸 없음", !!req?.legend && req.boxes.length === 3 && req.checked === 0, JSON.stringify(req))
    record("A05 선택 동의 묶음의 채널은 이메일 하나뿐(문자·카카오톡·앱 알림 없음), 미리 켜짐 없음", !!opt && opt.boxes.length === 1 && /Email/.test(opt.boxes[0]) && opt.checked === 0 && !/Text message|KakaoTalk|App notifications/.test(await bodyText()), JSON.stringify(opt))
    await open("/reset-password?token=mock-reset-token")
    await fill("form input", "12345678")
    await click('form button[type="submit"]')
    await waitFor(async () => /too easy to guess/i.test(await bodyText()), 8000)
    const a2 = await active()
    record("A03 새 비밀번호: 흔한 비밀번호(12345678)는 막힌다 — 칸 오류 + 포커스가 그 칸", /too easy to guess/i.test(await bodyText()) && a2?.tag === "INPUT", JSON.stringify(a2))
    await fill("form input", "a-long-enough-password")
    await click("button", "Save new password")
    await sleep(800)
    const body = await bodyText()
    record("C07 재설정 완료 화면이 모든 기기에서 로그아웃됐다고 말하고 [Go to sign in] 을 준다", /signed you out of every device/.test(body) && (await attr("a", "href", "Go to sign in")) === "/sign-in")
    await shot("b1-reset-3-done")
    // A05 계정 화면의 알림 설정도 이메일 스위치 하나뿐이다(v0.0.12 channels 속성 — LFPIN12)
    await scene("signed-in")
    await open("/account")
    const nsw = await ev(`(() => { const s = document.querySelector("#notification-settings"); return s ? { switches: s.querySelectorAll('[data-consent="optional"]').length, labels: [...s.querySelectorAll("label")].map((l) => l.innerText.replace(/\\s+/g, " ").trim()) } : null })()`)
    record("A05 계정 화면 알림 설정은 이메일 스위치 하나뿐(문자·카카오톡·앱 알림 없음)", !!nsw && nsw.switches === 1 && nsw.labels.length === 1 && /^Email/.test(nsw.labels[0]) && !/Text message|KakaoTalk|App notifications/.test(nsw.labels.join(" ")), JSON.stringify(nsw))
  },

  // ── P1AB B2: A11 배너·결제 직전 주소(막지 않음) · A10 재전송 자리·만료 링크 · A09 이미 확인됨 · A14 주소 고치기 · A18 국내 포털 · E03 연 토글 없음 ──
  // 메일이 실제로 닿는지는 보지 않는다(Resend 발신 도메인 O4 이후) — mock 은 재전송 서버 액션이 성공하는지만 본다
  async p1ab_b2() {
    await viewport(1280, 1000)
    const FIX = "/account#credentials-email-form"
    // A11·A10·A14 배너(확인 안 된 로그인 사용자)
    await scene("signed-in:unverified")
    await open("/")
    const banner = await ev(`(() => { const b = document.querySelector("[data-verify-banner]"); return b ? { text: b.innerText.replace(/\\s+/g, " "), fix: [...b.querySelectorAll("a")].map((a) => a.getAttribute("href")), resend: !!b.querySelector("[data-resend]"), korean: !!b.querySelector("[data-korean-portal]"), role: b.getAttribute("role") } : null })()`)
    await shot("b2-banner")
    record("A11 확인 안 된 로그인 사용자의 모든 쪽 위에 배너 — 보낸 주소·다시 보내기·주소 고치기", !!banner && /kim@example\.com/.test(banner.text) && banner.resend && banner.fix.includes(FIX) && banner.role === null, JSON.stringify(banner))
    await click("[data-verify-banner] [data-resend]")
    await waitFor(() => has("[data-verify-banner] [role=status]", "Sent"), 8000)
    record("A10 로그인 뒤 재전송: 배너의 [Send it again] → 「Sent」 글(role=status)", await has("[data-verify-banner] [role=status]", "Sent"))
    // A11 결제는 막지 않는다 + 결제 직전 주소 표시
    await open("/upgrade?plan=pro")
    const note = await ev(`(() => { const n = document.querySelector("[data-checkout-email]"); return n ? { text: n.innerText.replace(/\\s+/g, " "), addr: n.querySelector("[data-address]")?.textContent, unverified: !!n.querySelector("[data-unverified]"), links: [...n.querySelectorAll("a")].map((a) => a.getAttribute("href")) } : null })()`)
    await shot("b2-checkout-unverified")
    record("A11 결제 직전에 받는 주소를 보인다 — 확인 안 됐다는 말과 [Confirm it]·[Fix the address]", !!note && note.addr === "kim@example.com" && note.unverified && note.links.includes("/verify-email") && note.links.includes(FIX), JSON.stringify(note))
    // 결제 창(대화상자)이 기본으로 열려 쪽 위 안내를 덮는다 — 같은 주소가 창 안에도 있어야 「결제 직전」이다
    const dlg = await ev(`(() => { const d = document.querySelector('[role="dialog"]'); const first = d ? d.innerText.replace(/\\s+/g, " ") : null; return first ? { hasAddress: first.includes("kim@example.com"), unverified: /isn't confirmed/.test(first), close: /Close this window/.test(first) } : null })()`)
    record("A11 결제 창 안에도 받는 주소와 확인 안 됐다는 말이 있다(창을 닫고 고치라는 안내)", !!dlg && dlg.hasAddress && dlg.unverified && dlg.close, JSON.stringify(dlg))
    record("A11 결제를 막지 않는다 — 같은 화면에 결제 블록(체크·단추)이 있다", (await has('[data-block="paywall-upgrade-modal"]')) && !(await bodyText()).includes("Sign in to"), "paywall 블록 " + (await has('[data-block="paywall-upgrade-modal"]')))
    await scene("signed-in")
    await open("/upgrade?plan=pro")
    record("A11 대조: 확인된 사용자에게는 주소만 있고 경고가 없다, 배너도 없다", (await has("[data-checkout-email] [data-address]")) && !(await has("[data-checkout-email] [data-unverified]")) && !(await has("[data-verify-banner]")))
    // A10·A14·A18 확인 쪽
    await scene("signed-in:unverified")
    await open("/verify-email")
    const vp = await ev(`(() => { const s = document.querySelector('[data-block="confirmation-verify-email"]'); return s ? { addr: s.querySelector("[data-address]")?.textContent, steps: s.querySelectorAll("ol li").length, resend: !!s.querySelector("[data-resend]"), spam: /spam/i.test(s.innerText), wrong: [...s.querySelectorAll("a")].map((a) => a.getAttribute("href")), h1: document.querySelectorAll("h1").length } : null })()`)
    await shot("b2-verify-email-page")
    record("A10·A14 /verify-email: 보낸 주소·두 걸음·스팸함 안내·다시 보내기·주소 고치기, h1 하나", !!vp && vp.addr === "kim@example.com" && vp.steps === 2 && vp.resend && vp.spam && vp.wrong.includes(FIX) && vp.h1 === 1, JSON.stringify(vp))
    record("A11 /verify-email 에서는 배너를 숨긴다(안내가 겹치지 않게)", !(await has("[data-verify-banner]")))
    // v0.0.12(initialWait): 이 쪽은 가입 직후가 아니라(배너·만료 안내에서 연다) 처음엔 잠기지 않는다 — 대기 안내(role=timer)가 없고 단추가 바로 눌린다. 보낸 뒤에만 블록 기본 60초 동안 잠긴다
    record("A10 /verify-email 의 [Send the email again] 은 처음엔 잠기지 않는다(대기 안내 없음·단추가 켜져 있다)", (await ev(`document.querySelector("[role=timer]")?.dataset.cooldown`)) === "0" && !(await bodyText()).includes("seconds") && (await ev(`document.querySelector("[data-resend]")?.disabled === false`)))
    await click("[data-resend]")
    await waitFor(() => has("[role=status]", "Sent again"), 8000)
    record("A10 /verify-email 의 [Send the email again] → 「Sent again」", await has("[role=status]", "Sent again"))
    record("A10 보낸 뒤에는 다시 보내기가 잠기고 남은 초를 말한다(블록 기본 60초)", Number(await ev(`document.querySelector("[role=timer]")?.dataset.cooldown`)) >= 55 && /seconds/.test(await bodyText()), await ev(`document.querySelector("[role=timer]")?.innerText.trim() ?? ""`))
    await scene("signed-in")
    await open("/verify-email")
    record("A09 확인을 마친 사용자가 /verify-email 을 열면 「확인했어요」", (await has("[data-verified]")) && /already|confirmed/i.test(await bodyText()))
    await scene("signed-out")
    await open("/verify-email")
    record("A10 로그아웃이면 로그인 안내(로그인하면 이 쪽으로 돌아온다)", (await attr('[data-block="confirmation-verify-email"] a', "href", "Sign in")) === "/sign-in?next=%2Fverify-email")
    // A10·A09 확인 링크 결과 안내
    await scene("signed-in:unverified")
    await open("/?welcome=verified&error=TOKEN_EXPIRED")
    const ex = await ev(`(() => { const n = document.querySelector("[data-welcome]"); return n ? { kind: n.dataset.welcome, copy: n.dataset.welcomeCopy, role: n.getAttribute("role"), title: n.querySelector("h2")?.textContent, resend: !!n.querySelector("[data-resend]") } : null })()`)
    await shot("b2-welcome-expired")
    record("A10 만료된 링크: 「expired」 안내(role=alert) + [Send me a new confirmation email]", !!ex && ex.copy === "expired" && ex.role === "alert" && /expired/.test(ex.title) && ex.resend, JSON.stringify(ex))
    await click("[data-welcome] [data-resend]")
    await waitFor(() => has("[data-welcome] [role=status]", "Sent"), 8000)
    record("A10 그 단추를 누르면 「Sent」", await has("[data-welcome] [role=status]", "Sent"))
    await open("/?welcome=verified&error=INVALID_TOKEN")
    const bad = await ev(`document.querySelector("[data-welcome]")?.dataset.welcomeCopy`)
    record("A09 만료가 아닌 틀린 링크는 따로 말한다(failed) — 단추는 같다", bad === "failed" && (await has("[data-welcome] [data-resend]")), String(bad))
    await scene("signed-in")
    await open("/?welcome=verified&error=INVALID_TOKEN")
    const used = await ev(`(() => { const n = document.querySelector("[data-welcome]"); return n ? { copy: n.dataset.welcomeCopy, role: n.getAttribute("role"), title: n.querySelector("h2")?.textContent, resend: !!n.querySelector("[data-resend]") } : null })()`)
    await shot("b2-welcome-already")
    record("A09 이미 확인된 사람이 쓴 링크를 다시 열면 「already confirmed」(role=status, 재전송 단추 없음)", !!used && used.copy === "alreadyVerified" && used.role === "status" && /already confirmed/.test(used.title) && !used.resend, JSON.stringify(used))
    await scene("signed-out")
    await open("/?welcome=verified&error=TOKEN_EXPIRED")
    record("A10 로그아웃 상태의 만료 링크는 로그인 먼저(next=/verify-email)", (await attr("[data-welcome] a", "href")) === "/sign-in?next=%2Fverify-email" && !(await has("[data-welcome] [data-resend]")))
    // A18·A14 가입 직후 안내(국내 포털 메일이면 스팸함 안내)
    for (const [email, portal] of [["minsu@naver.com", true], ["jamie@example.com", false]]) {
      await scene("signed-out")
      await open("/sign-up")
      await fill('input[type="email"]', email)
      await fill('input[type="password"]', "blue-Harbor-4821")
      await click("button", "Next")
      await check("Terms of Service")
      await check("Privacy Policy")
      await check("14 years")
      await click("button", "Sign up")
      await waitFor(() => has('[data-testid="verify-email-note"]'), 12_000)
      const n = await ev(`(() => { const n = document.querySelector('[data-testid="verify-email-note"]'); return n ? { korean: !!n.querySelector("[data-korean-portal]"), fix: n.querySelector("a")?.getAttribute("href"), text: n.innerText.replace(/\\s+/g, " ").slice(0, 200) } : null })()`)
      if (portal) await shot("b2-signup-note-naver")
      record(`A18·A14 가입 직후 안내(${portal ? "네이버" : "그 밖의"} 주소): 스팸함·지연 안내 ${portal ? "있음" : "없음"}, 주소 고치기 링크 있음`, !!n && n.korean === portal && n.fix === FIX, JSON.stringify(n))
    }
    // E03 월 요금제만
    for (const path of ["/pricing", "/upgrade"]) {
      await scene("signed-in")
      await open(path)
      const t = await bodyText()
      record(`E03 ${path}: 연 요금제 토글·문구가 없다`, !/\b(annual|annually|yearly|per year|\/yr)\b/i.test(t))
    }
  },
}

async function declineConsent() {
  for (const base of [origin, origin2].filter(Boolean)) {
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
