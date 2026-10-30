// 관리 화면 시험(ADMIN) · mock 모드. 방문자가 남긴 기록(문의·예약·예약금·후기·뉴스레터·주문·가입자)을 운영자가 /admin 에서 보고 다루는 길을 진짜 브라우저로 한 번 돈다.
// 서버: scripts/e2e-admin/run.mjs 가 템플릿 사본(관리자 스위치 켬)을 mock 으로 빌드해 `NODE_OPTIONS=--import=scripts/e2e-admin/admin-seed.preload.mjs`·새 메일 기록·소유자 메일(=시험 계정)로 띄운다. 한 서버 안에 기록이 쌓이므로 시험은 위에서 아래로 차례대로 돈다(serial, 재시도 없음).
// 들어가는 길: 시험 계정은 /api/auth 로 가입·로그인한 진짜 Better Auth 세션이다(화면의 가입 폼은 mock 포트라 관리 화면이 알아보지 못한다). 메일 확인·관리자 역할·2단계 인증은 preload 가 DB 에 직접 둔다.
// AUTH_FEATURES(템플릿 lib/launch/features.ts)가 꺼진 기본 빌드에서는 소유자 경로(문의·예약·후기)만 열린다 — 관리자 전용 구획(주문·재고·뉴스레터·사용자)은 열렸을 때만 돌고 아니면 건너뛴다(건너뛴 사유가 보고서에 남는다).
// 방문자의 데이터는 API 로 만든다(폼은 loop 시험이 이미 화면으로 돈다). 예약금 결제와 상점 주문은 모의 결제 확인 칸이 화면에만 있어 화면으로 간다.
import { writeFileSync } from "node:fs"
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test"
import { countByTemplate, loadLoopSteps, readOutbox } from "../../template/e2e/lib.ts"

const spec = loadLoopSteps()
const sel = (group: string, name: string): string => {
  const s = spec.selectors[group]?.[name]
  if (!s) throw new Error(`loop-steps.json 에 selectors.${group}.${name} 이 없다`)
  return s
}

const outbox = process.env.SMOKE_OUTBOX
const adminEmail = process.env.ADMIN_SEED_EMAIL ?? ""
const twoFactorFile = process.env.ADMIN_SEED_2FA_FILE ?? ""
const PASSWORD = "Admin-pass-for-test-only"
/** Better Auth 가 믿는 출처(mock 은 포트와 상관없이 이 주소를 기대한다) */
const ORIGIN = { origin: "http://localhost:3000" }
const CONSENTS = { terms: true, privacy: true, ageOver14: true, marketing: {}, locale: "en" }
/** 서버를 LF_CLIENT_IP_HEADER=x-test-ip 로 띄웠으므로 요청마다 다른 주소를 달면 요청 제한이 서로 섞이지 않는다 */
let ipCounter = 0
const ipHeader = () => ({ "x-test-ip": `198.51.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}` })
/** 한 쪽 줄 수가 50인 구획(후기·사용자)을 넘기려면 이만큼 쌓는다 */
const BULK_REVIEWS = 52

const PAGE = { reviews: 50 }

let admin: { context: BrowserContext; page: Page }
let ownerSections: string[] = []
let adminOnly = false
/** 데이터 만들기 단계가 받아 둔 번호들 */
const made = { inquiries: [] as string[], bookingEmails: [] as string[], depositReference: "", depositContact: "loop-depositor@example.com", newsletter: [] as string[], banEmail: "" }

const post = (request: APIRequestContext, path: string, data: Record<string, unknown>) => request.post(path, { data, headers: { ...ORIGIN, ...ipHeader() } })

async function open(page: Page, path: string) {
  const res = await page.goto(path)
  expect(res?.status(), `${path} 첫 응답`).toBe(200)
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})
}

/** 서버가 그린 단추는 하이드레이션 전에 눌러도 아무 일도 없다 — React 가 속성을 붙인 뒤(__reactProps$)에 누른다 */
async function clickHydrated(button: Locator) {
  await expect.poll(() => button.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))), { message: "단추가 하이드레이션된다" }).toBe(true)
  await button.click()
}

/** 구획 목록 쪽을 열고 「N shown」 글자(서버가 거른 뒤 화면이 그린 줄 수)를 돌려준다 */
async function listRows(page: Page, section: string, query = ""): Promise<string[]> {
  await open(page, `/admin/${section}${query}`)
  return page.locator(`a[href^="/admin/${section}/"]`).evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""))
}

/** 기록 쪽의 [행동] 단추를 누르고 결과 안내 글이 바뀌길 기다린다 */
async function runAction(page: Page, action: string) {
  await page.locator(`[data-record-action="${action}"]`).click()
}

/** 위험 행동: 단추 → 확인 질문 → 확인. 끝나면 「바뀌었어요」 안내가 나온다 */
async function confirmDanger(page: Page) {
  await page.locator("[data-danger-trigger]").click()
  await page.locator('[data-danger-zone] [data-choice="primary"]').click()
  await expect(page.getByText("The change was made."), "위험 행동이 끝났다").toBeVisible()
}

const detail = (page: Page, label: string) => page.locator(`[data-record-summary] dt:text-is("${label}") + dd`)

/** 숨은 사람 방문자: 로그인 없는 새 맥락 */
async function visitor(browser: Browser) {
  return browser.newContext({ baseURL: process.env.SMOKE_BASE_URL })
}

/** mock 포트의 가입(화면) — 상점 주문에 필요하다. loop 시험의 signUp 과 같은 길 */
async function signUpOnScreen(page: Page, email: string) {
  await open(page, "/sign-up")
  const flow = page.locator(sel("signup", "flow"))
  await expect(flow).toHaveAttribute("data-step", "1")
  await page.locator(sel("signup", "email")).fill(email)
  await page.locator(sel("signup", "password")).fill(PASSWORD)
  await page.locator(sel("signup", "next")).click()
  await expect(flow).toHaveAttribute("data-step", "2")
  const boxes = page.locator(sel("signup", "requiredBoxes"))
  await expect(boxes).toHaveCount(3)
  for (const box of await boxes.all()) {
    await box.click()
    await expect(box).toBeChecked()
  }
  await page.locator(sel("signup", "submit")).click()
  await expect(page.locator(sel("signup", "finished")).first()).toBeVisible()
}

test.describe.configure({ mode: "serial" })

test.describe("관리 화면", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000)
    expect(adminEmail, "ADMIN_SEED_EMAIL — 서버를 띄운 쪽(e2e-admin/run.mjs)이 시험 계정 주소를 준다").not.toBe("")
    // 대표의 요청은 자기 주소 하나로 센다 — 방문자 요청이 한 통(주소 없음 = 공용)에 쌓여 대표를 막지 않게
    const context = await browser.newContext({ baseURL: process.env.SMOKE_BASE_URL, locale: "en-US", extraHTTPHeaders: { "x-test-ip": "203.0.113.200" } })
    const up = await post(context.request, "/api/auth/sign-up/email", { email: adminEmail, password: PASSWORD, name: "Admin Tester", lfConsents: CONSENTS })
    expect(up.status(), "시험 계정 가입").toBe(200)
    // preload 가 메일을 확인됨으로 바꾼 뒤에 로그인해도 같은 세션이다. 2단계 인증 칸은 로그인한 다음에 켠다(먼저 켜면 로그인이 세션을 주지 않는다)
    const signIn = await post(context.request, "/api/auth/sign-in/email", { email: adminEmail, password: PASSWORD })
    expect(signIn.status(), "시험 계정 로그인").toBe(200)
    writeFileSync(twoFactorFile, "1")
    const page = await context.newPage()
    admin = { context, page }
    await expect
      .poll(async () => (await context.request.get("/admin")).text().then((t) => t.includes("data-admin-shell")), { message: "preload 가 역할·2단계 인증을 둔 뒤 /admin 이 열린다", timeout: 15_000 })
      .toBe(true)
    const html = await (await context.request.get("/admin")).text()
    ownerSections = ["inquiries", "bookings", "reviews"]
    adminOnly = html.includes('href="/admin/orders"') || html.includes('href="/admin/newsletter"')
  })

  test.afterAll(async () => {
    await admin?.context.close()
  })

  test("들어가는 길 — 로그아웃한 사람은 막히고, 시험 계정은 구획 메뉴를 본다", async ({ browser }) => {
    const out = await visitor(browser)
    const outPage = await out.newPage()
    await open(outPage, "/admin")
    await expect(outPage.locator("[data-admin-shell]"), "로그인 없이 관리 틀이 그려지지 않는다").toHaveCount(0)
    const body = await outPage.locator("body").innerText()
    expect(body, "구획 이름이 새지 않는다").not.toMatch(/Inquiries|Bookings|Newsletter/)
    await out.close()

    await open(admin.page, "/admin")
    for (const id of ownerSections) await expect(admin.page.locator(`a[href="/admin/${id}"]`), `${id} 구획 메뉴`).toBeVisible()
    if (!adminOnly) test.info().annotations.push({ type: "note", description: "AUTH_FEATURES 가 꺼진 빌드 — 관리자 전용 구획(주문·재고·뉴스레터·사용자)은 건너뛴다" })
  })

  test("방문자 데이터 만들기 — 문의·예약·뉴스레터·후기, 예약금 결제, 상점 주문, 가입자", async ({ browser }) => {
    test.setTimeout(240_000)
    const guest = await visitor(browser)
    const request = guest.request

    for (let i = 0; i < 3; i++) {
      const r = await post(request, "/api/inquiry", { name: `Visitor ${i}`, contact: `visitor${i}@example.test`, message: `Question number ${i} about opening hours`, kind: "general", form: "contact", idempotencyKey: `inq-${i}-aaaaaaaa` })
      expect(r.status()).toBe(200)
      made.inquiries.push(((await r.json()) as { data: { id: string } }).data.id)
    }

    // 예약 시간은 지금보다 미리 잡아야 열리므로 날짜를 고정하지 않는다 — 한 주 뒤에 오는 첫 월요일부터 3일(월~수)
    const from = new Date(Date.now() + 7 * 86_400_000)
    from.setUTCDate(from.getUTCDate() + ((8 - from.getUTCDay()) % 7))
    const slotRes = await request.get(`/api/booking/slots?service=consultation&from=${from.toISOString().slice(0, 10)}&days=3`)
    const starts = ((await slotRes.json()) as { data: { days: { slots: { startsAt: string }[] }[] } }).data.days.flatMap((d) => d.slots.map((s) => s.startsAt))
    expect(starts.length, "예약 가능한 시간이 있다").toBeGreaterThan(4)
    for (let i = 0; i < 2; i++) {
      const contact = `booker${i}@example.test`
      const r = await post(request, "/api/booking", { service: "consultation", startsAt: starts[starts.length - 1 - i * 2], name: `Booker ${i}`, contact, idempotencyKey: `bk-${i}-aaaaaaaaa` })
      expect(r.status(), (await r.text()).slice(0, 120)).toBe(200)
      made.bookingEmails.push(contact)
    }

    // 예약금이 있는 예약: 화면에서 접수 → 모의 결제로 확정(손님은 취소하지 않는다 — 운영자가 취소해 환불을 본다)
    const guestPage = await guest.newPage()
    await open(guestPage, "/book")
    await guestPage.locator(sel("bookingDeposit", "serviceSelect")).selectOption("deposit-consultation")
    await expect(guestPage.locator(sel("bookingDeposit", "slotsStatus"))).toHaveAttribute("data-state", "ready", { timeout: 15_000 })
    await guestPage.locator(sel("booking", "slot")).last().check({ force: true })
    await guestPage.locator(sel("booking", "name")).fill("Depositor")
    await guestPage.locator(sel("booking", "contact")).fill(made.depositContact)
    await guestPage.locator(sel("booking", "submit")).click()
    await expect(guestPage.locator(sel("bookingDeposit", "pending"))).toBeVisible()
    made.depositReference = (await guestPage.locator(sel("booking", "reference")).innerText()).trim()
    await guestPage.locator(sel("bookingDeposit", "pay")).click()
    await guestPage.locator(sel("bookingDeposit", "mockPay")).click()
    await expect(guestPage.locator(sel("bookingDeposit", "paid")), "모의 결제 뒤 예약 확정").toBeVisible()

    for (let i = 0; i < 2; i++) {
      const r = await post(request, "/api/newsletter", { email: `reader${i}@example.test`, consent: "yes", source: "footer", idempotencyKey: `news-${i}-aaaaaaaa` })
      expect(r.status()).toBe(200)
      made.newsletter.push(`reader${i}@example.test`)
    }

    // 후기: 로그인한 시험 계정이 쓴다(후기는 로그인한 사람만). 쪽 나누기를 보려고 한 쪽 줄 수(50)를 넘겨 쌓는다 — 제목·본문에 번호가 든다
    for (let i = 0; i < BULK_REVIEWS; i++) {
      const r = await post(admin.context.request, "/api/reviews", { kind: "review", subjectType: "product", subjectId: `item-${i}`, rating: "4", title: `Review ${i}`, body: `Body text number ${i} mentions teapot${i}`, idempotencyKey: `rv-${i}-aaaaaaaaaaa` })
      const text = await r.text()
      expect(r.status(), `후기 ${i}: ${text.slice(0, 160)}`).toBe(200)
      expect(JSON.parse(text).ok, `후기 ${i}: ${text.slice(0, 160)}`).toBe(true)
    }
    const q = await post(request, "/api/reviews", { kind: "question", subjectType: "product", subjectId: "item-0", body: "Is it dishwasher safe?", authorName: "Curious", idempotencyKey: "rv-q-aaaaaaaaaaa" })
    expect(q.status()).toBe(200)

    // 가입자 둘(차단 대상은 둘째)
    made.banEmail = "ban-me@example.test"
    for (const email of ["keep-me@example.test", made.banEmail]) {
      const r = await post(request, "/api/auth/sign-up/email", { email, password: PASSWORD, name: "Plain User", lfConsents: CONSENTS })
      expect(r.status(), (await r.text()).slice(0, 120)).toBe(200)
    }

    // 상점 주문 하나: 화면 가입(mock 포트) → 담기 → 배송지 → 모의 결제
    const shopper = await guest.newPage()
    await signUpOnScreen(shopper, "shopper@example.test")
    await open(shopper, spec.selectors.shop?.addPath ?? "/cart?add=example-mug")
    await clickHydrated(shopper.locator(sel("shop", "addConfirm")))
    await expect(shopper.locator(sel("shop", "added"))).toBeVisible()
    await expect(shopper, "담은 뒤 주소의 ?add= 가 지워진다").toHaveURL(/\/cart$/)
    await expect(shopper.locator(sel("shop", "added")), "주소가 바뀐 뒤에도 안내가 남는다").toBeVisible()
    await open(shopper, "/checkout")
    await shopper.locator(sel("shop", "recipient")).fill("Shop Buyer")
    await shopper.locator(sel("shop", "phone")).fill("010-1234-5678")
    await shopper.locator(sel("shop", "postcode")).fill("04524")
    await shopper.locator(sel("shop", "address1")).fill("1 Example Street")
    await shopper.locator(sel("shop", "pay")).click()
    await shopper.locator(sel("shop", "mockPay")).click()
    await expect(shopper.locator(sel("shop", "done"))).toBeVisible()
    await guest.close()
  })

  test("문의 — 이메일·접수 번호로 찾기, 답변은 두 번 눌러도 한 번, 상태 바꾸기", async () => {
    const { page } = admin
    expect(await listRows(page, "inquiries"), "문의 세 건").toHaveLength(3)
    const [target] = made.inquiries as [string]
    expect(await listRows(page, "inquiries", "?q=visitor1%40example.test"), "연락처(가려서 보이는 칸)를 서버가 찾는다").toHaveLength(1)
    expect(await listRows(page, "inquiries", `?q=${target.slice(0, 6)}`), "접수 번호 일부").toEqual([`/admin/inquiries/${target}`])

    await open(page, `/admin/inquiries/${target}`)
    const mailsBefore = countByTemplate(readOutbox(outbox)).inquiryReply ?? 0
    await page.locator("#inquiries-record-reply").fill("Thanks, we open at nine.")
    await page.locator("#inquiries-record-form button[type=submit]").dblclick()
    await expect.poll(() => countByTemplate(readOutbox(outbox)).inquiryReply ?? 0, { message: "답변 메일", timeout: 10_000 }).toBe(mailsBefore + 1)
    await page.waitForTimeout(800)
    expect(countByTemplate(readOutbox(outbox)).inquiryReply ?? 0, "두 번 눌러도 답변 메일은 한 통").toBe(mailsBefore + 1)
    await open(page, `/admin/inquiries/${target}`)
    await expect(page.locator("[data-record-summary] dt", { hasText: /^Reply \d/ }), "글타래에 답변 한 건").toHaveCount(1)

    await runAction(page, "mark-in-progress")
    await expect(detail(page, "Status")).toHaveText("in_progress")
    await runAction(page, "mark-done")
    await expect(detail(page, "Status")).toHaveText("done")
    await expect(page.locator('[data-record-action="reopen"]')).toBeVisible()
  })

  test("예약 — 이메일·이름으로 찾기, 예약금 예약을 운영자가 취소하면 전액 환불", async () => {
    const { page } = admin
    expect(await listRows(page, "bookings"), "예약 세 건(일반 둘 + 예약금 하나)").toHaveLength(3)
    expect(await listRows(page, "bookings", "?q=booker1%40example.test"), "이메일로 찾는다 — 표의 연락처는 가려서 보인다").toHaveLength(1)
    expect(await listRows(page, "bookings", `?q=${made.depositContact}`), "예약금 예약의 이메일").toEqual([`/admin/bookings/${made.depositReference}`])
    expect(await listRows(page, "bookings", "?q=Booker"), "이름 일부").toHaveLength(2)

    await open(page, `/admin/bookings/${made.depositReference}`)
    await expect(detail(page, "Status")).toHaveText("confirmed")
    await expect(detail(page, "Deposit amount")).toHaveText("10,000 KRW")
    await confirmDanger(page)
    await open(page, `/admin/bookings/${made.depositReference}`)
    await expect(detail(page, "Status")).toHaveText("cancelled")
    await expect(detail(page, "Refunded"), "대표 취소는 예약금 전액 환불").toHaveText("10,000 KRW")
    await expect.poll(() => readOutbox(outbox).filter((l) => l.template === "bookingCancellation" && l.to === made.depositContact).length, { message: "예약한 사람에게 취소 메일", timeout: 10_000 }).toBe(1)

    // 취소한 건은 취소 단추가 없다
    await expect(page.locator("[data-danger-trigger]")).toHaveCount(0)
  })

  test("후기 — 본문 글자로 찾기, 쪽 나누기, 판매자 답변, 숨기기와 되살리기", async () => {
    const { page } = admin
    expect(await listRows(page, "reviews", "?q=teapot7"), "표에 안 보이는 본문 글자도 서버가 찾는다").toHaveLength(1)
    expect(await listRows(page, "reviews", "?q=nobody%40example.test"), "후기에는 이메일이 없다 — 이메일로는 찾을 수 없다").toHaveLength(0)

    // 표 블록은 받은 줄을 10줄씩 보이고, 서버 쪽 이동 줄(?page=)이 한 쪽(50줄) 단위로 가른다
    const total = BULK_REVIEWS + 1
    const pager = page.locator("[data-server-pager]")
    await listRows(page, "reviews")
    await expect(pager).toContainText(`Records 1–${PAGE.reviews} of ${total}`)
    await expect(pager).toContainText(`Page 1 of 2`)
    await pager.getByRole("link", { name: "Next records" }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(pager).toContainText(`Records ${PAGE.reviews + 1}–${total} of ${total}`)
    await expect(pager.getByRole("link", { name: "Next records" }), "마지막 쪽에는 다음이 없다").toHaveCount(0)

    const [target] = await listRows(page, "reviews", "?q=teapot7")
    await open(page, target!)
    await page.locator("#reviews-record-answer").fill("Thank you for the kind words.")
    await page.locator("#reviews-record-form button[type=submit]").click()
    await expect(page.locator('[role="status"]', { hasText: "Reply saved." })).toBeVisible()
    await confirmDanger(page) // 숨기기
    await open(page, target!)
    await expect(detail(page, "Status")).toHaveText("hidden")
    await runAction(page, "unhide")
    await expect(detail(page, "Status")).toHaveText("published")
  })

  test("뉴스레터 — 이메일로 찾기와 수신 거부 처리 (관리자 전용)", async () => {
    test.skip(!adminOnly, "AUTH_FEATURES 가 꺼진 빌드 — 관리자 전용 구획은 건너뛴다")
    const { page } = admin
    expect(await listRows(page, "newsletter"), "구독 신청 둘").toHaveLength(2)
    const [row] = await listRows(page, "newsletter", `?q=${encodeURIComponent(made.newsletter[1]!)}`)
    expect(row, "이메일로 한 건").toBeTruthy()
    await open(page, row!)
    await expect(detail(page, "Status")).toHaveText("pending")
    await confirmDanger(page)
    await open(page, row!)
    await expect(detail(page, "Status")).toHaveText("unsubscribed")
    await expect(page.locator("[data-danger-trigger]"), "이미 거부 처리됨").toHaveCount(0)
  })

  test("재고 — 잘못된 수는 막고 올바른 수는 저장 (관리자 전용)", async () => {
    test.skip(!adminOnly, "AUTH_FEATURES 가 꺼진 빌드 — 관리자 전용 구획은 건너뛴다")
    const { page } = admin
    const [mug] = await listRows(page, "stock", "?q=example-mug")
    await open(page, mug!)
    const qty = page.locator("#stock-record-form input[name=quantity]")
    await qty.fill("-3")
    await page.locator("#stock-record-form button[type=submit]").click()
    await expect(page.getByText("Enter a whole number from 0 to 1,000,000.").first()).toBeVisible()
    await qty.fill("7")
    await page.locator("#stock-record-form button[type=submit]").click()
    await expect(page.locator('[role="status"]', { hasText: "Stock updated." })).toBeVisible()
    await open(page, mug!)
    await expect(detail(page, "In stock")).toHaveText("7")
  })

  test("주문 — 결제된 주문을 운영자가 취소하면 환불 (관리자 전용)", async () => {
    test.skip(!adminOnly, "AUTH_FEATURES 가 꺼진 빌드 — 관리자 전용 구획은 건너뛴다")
    const { page } = admin
    const rows = await listRows(page, "orders")
    expect(rows, "주문 한 건").toHaveLength(1)
    await open(page, rows[0]!)
    await expect(detail(page, "Status")).toHaveText("paid")
    await confirmDanger(page)
    await open(page, rows[0]!)
    await expect(detail(page, "Status")).toHaveText("refunded")
  })

  test("사용자 — 이메일로 찾기, 차단은 확인 뒤에만, 차단된 사람은 로그인 못 함 (관리자 전용)", async ({ browser }) => {
    test.skip(!adminOnly, "AUTH_FEATURES 가 꺼진 빌드 — 관리자 전용 구획은 건너뛴다")
    const { page } = admin
    const [row] = await listRows(page, "users", `?q=${encodeURIComponent(made.banEmail)}`)
    expect(row, "이메일로 한 건").toBeTruthy()
    await open(page, row!)
    await expect(detail(page, "Status")).toHaveText("active")
    await page.locator("[data-danger-trigger]").click()
    await page.locator('[data-danger-zone] [data-choice="decline"]').click()
    await open(page, row!)
    await expect(detail(page, "Status"), "확인 질문에서 「그대로 둔다」를 고르면 바뀌지 않는다").toHaveText("active")
    await confirmDanger(page)
    await open(page, row!)
    await expect(detail(page, "Status")).toHaveText("banned")
    const out = await visitor(browser)
    const r = await post(out.request, "/api/auth/sign-in/email", { email: made.banEmail, password: PASSWORD })
    expect(r.status(), "차단된 사람은 세션을 못 받는다").toBeGreaterThanOrEqual(400)
    await out.close()
    await runAction(page, "unban")
    await expect(detail(page, "Status")).toHaveText("active")
  })
})
