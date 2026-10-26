// 한 바퀴 시험(LOOP) · mock 모드. 서버: LF_MODE=mock LF_MOCK_SUB=none LF_MOCK_OUTBOX=<이번 실행의 새 파일> 로 띄운 `next start`(scripts/ci/smoke.mjs 가 띄운다) — 장면(LF_MOCK_SCENES)은 없다.
// 가입 → 확인 메일 → 로그아웃 → 로그인 → 가짜 결제 → 영수증 메일 → 문의 메일 → 예약 접수·조회·취소 메일 → 예약금 있는 예약(결제 대기 → 모의 결제 → 확정 → 취소·환불) → 상점(담기 확인 → 배송지 → 모의 결제 → 주문 확인 메일 → 내 주문)을 방문자가 하는 그대로 화면으로 한 번 돈다.
// 돌릴 기능은 LOOP_FEATURES(쉼표, 기본 = loop-steps.json 의 전부). 단계 id·메일 기대 개수·화면 표지는 모두 e2e/loop-steps.json 에 있고, 이 파일은 단계 id 마다 동작(RUNNERS)만 갖는다.
// 메일은 서버가 쓰는 기록 파일(SMOKE_OUTBOX, JSONL)을 template 이름으로 세어 기대 표와 **같아야** 한다(많아도 적어도 실패) — 시작 때 0줄, 기능이 끝날 때마다 누적 개수, 끝에서 한 번 더.
// 재시도 없음(playwright.config.ts 의 loop 프로젝트 retries: 0) — 재시도는 메일 기록을 두 번 쓰게 해 줄 수를 속인다.
import { randomUUID } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"
import { assertKnownSteps, countByTemplate, ERROR_BOUNDARY, hasSignInPrompt, loadLoopSteps, mailThrough, planLoop, readOutbox } from "./lib.ts"

const spec = loadLoopSteps()
const outbox = process.env.SMOKE_OUTBOX
const plan = planLoop(process.env.LOOP_FEATURES, spec)

const sel = (group: string, name: string): string => {
  const s = spec.selectors[group]?.[name]
  if (!s) throw new Error(`loop-steps.json 에 selectors.${group}.${name} 이 없다`)
  return s
}

type Ctx = { page: Page; email: string; password: string; feature: string; inquiryContact: string; bookingContact: string }

/** 예약 단계 사이로 넘기는 값 — 접수에서 받은 예약 번호를 조회·취소가 쓴다(단계마다 ctx 를 새로 펼치므로 모듈 값으로 둔다) */
let bookedReference = ""
/** 예약금 단계 사이로 넘기는 예약 번호(위와 같은 까닭) */
let depositReference = ""

/** 예약금 단계가 고를 서비스 id — serviceOption 선택자(option[value="<id>"])에서 읽는다(scripts/test/smoke.test.mjs 가 예약 설정에 있는지 본다) */
const depositServiceId = /value="([\w-]+)"/.exec(spec.selectors.bookingDeposit?.serviceOption ?? "")?.[1] ?? ""
if (spec.steps["booking-deposit"] && !depositServiceId) throw new Error('loop-steps.json selectors.bookingDeposit.serviceOption 에 value="<서비스 id>" 가 없다')

/** 결제할 요금제 id — planLink 선택자(a[href="/upgrade?plan=<id>"])에서 읽는다(scripts/test/smoke.test.mjs 가 mock 요금제 표에 있는지 본다) */
const planId = /plan=([\w-]+)/.exec(spec.selectors.payments?.planLink ?? "")?.[1] ?? ""
if (!planId) throw new Error("loop-steps.json selectors.payments.planLink 에 plan=<id> 가 없다")

/** 상점 단계가 담을 상품 주소(?add=<id>) — scripts/test/smoke.test.mjs 가 그 id 가 상품표에 있는지 본다 */
const shopAddPath = spec.selectors.shop?.addPath ?? ""

const want = (name: string): string[] => {
  const v = spec.expect[name]
  if (v === undefined) throw new Error(`loop-steps.json 에 expect.${name} 이 없다`)
  return Array.isArray(v) ? v : [v]
}
const anyOf = (texts: string[]) => new RegExp(texts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"))

/**
 * 쪽을 열고 수화가 가라앉을 때까지 기다린다(수화 전에 누르면 양식이 서버로 그냥 제출된다).
 * 수화가 끝났다는 표지가 화면에 없어 networkidle 로 가늠한다 — 시간 안에 안 가라앉아도 던지지 않는다(그 뒤 단계가 구체적인 표지를 기다리며 실패를 잡는다)
 */
async function open(page: Page, path: string) {
  const res = await page.goto(path)
  expect(res?.status(), `${path} 첫 응답`).toBe(200)
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})
}

/** 서버가 지금 이 방문자를 로그인으로 보는가 — 보호된 쪽 /account 에 로그인 안내가 없으면 로그인이다. 안내가 없는 까닭이 다른 쪽으로 보내졌기 때문이 아니도록 주소도 본다 */
async function signedIn(page: Page): Promise<boolean> {
  const res = await page.request.get("/account")
  expect(res.status(), "/account 응답").toBe(200)
  expect(new URL(res.url()).pathname, "/account 가 다른 쪽으로 보내지지 않았다").toBe("/account")
  return !hasSignInPrompt(await res.text())
}

/** 이 기능이 끝났을 때까지의 메일 개수가 기대 표와 같다 */
async function expectMail(feature: string) {
  const want = mailThrough(plan, spec, feature)
  await expect.poll(() => countByTemplate(readOutbox(outbox)), { message: `${feature} 까지의 메일 기록(template 별 개수)`, timeout: 10_000 }).toEqual(want)
}

const RUNNERS: Record<string, (c: Ctx) => Promise<void>> = {
  async signUp({ page, email, password }) {
    await open(page, "/sign-up")
    const flow = page.locator(sel("signup", "flow"))
    await expect(flow).toHaveAttribute("data-step", "1")
    await page.locator(sel("signup", "email")).fill(email)
    await page.locator(sel("signup", "password")).fill(password)
    await page.locator(sel("signup", "next")).click()
    await expect(flow).toHaveAttribute("data-step", "2")
    // 필수 동의 셋(이용약관 · 개인정보 · 만 14세) — 미리 켜져 있지 않다. 개수가 달라지면 화면이 바뀐 것이다
    const boxes = page.locator(sel("signup", "requiredBoxes"))
    await expect(boxes).toHaveCount(3)
    for (const box of await boxes.all()) {
      await box.click()
      await expect(box).toBeChecked()
    }
    await page.locator(sel("signup", "submit")).click()
    // 끝 화면은 완료 단계(3)이거나, 가입이 세션을 바꾸자 서버가 쪽을 다시 그려 「이미 로그인했어요」 안내로 바뀐 모양이다 — 둘 중 어느 쪽이든 가입이 끝난 것이고, 진짜 판정은 서버가 이 방문자를 로그인으로 보는지다
    await expect(page.locator(sel("signup", "finished")).first()).toBeVisible()
    await expect.poll(() => signedIn(page), { message: "가입 직후 로그인 상태", timeout: 10_000 }).toBe(true)
  },
  async verifyMail({ feature }) {
    // 확인 메일의 받는 사람은 가입 양식에 적은 주소가 아니라 mock 세션의 주소다(lib/mock-ports.ts — mock 설계). 그래서 받는 사람이 아니라 template 별 개수로 센다
    await expectMail(feature)
  },
  async signOut({ page }) {
    // 계정 띠(nav-account-bar)는 제품 쉘의 쪽에 있다 — 시안을 얹은 제품의 / 는 시안 머리라서 띠가 없다. /account 는 어느 쪽에서든 제품 쉘이다
    await open(page, "/account")
    await page.locator(sel("shell", "accountMenu")).click()
    await page.locator(sel("shell", "signOut")).click()
    await expect.poll(() => signedIn(page), { message: "로그아웃 뒤 /account 에 로그인 안내", timeout: 10_000 }).toBe(false)
  },
  async signIn({ page, email, password }) {
    await open(page, "/sign-in")
    await page.locator(sel("signin", "email")).fill(email)
    await page.locator(sel("signin", "password")).fill(password)
    await page.locator(sel("signin", "submit")).click()
    // 가입과 같다: 로그인이 세션을 바꾸면 서버가 쪽을 다시 그려 완료 안내 대신 「이미 로그인했어요」가 나올 수 있다 — 진짜 판정은 아래 /account 확인이다
    await expect(page.locator(sel("signin", "done")).first()).toBeVisible()
    await expect.poll(() => signedIn(page), { message: "로그인 뒤 /account 에 로그인 안내 없음", timeout: 10_000 }).toBe(true)
  },
  async upgrade({ page }) {
    // 결제 전에는 구독이 없다(LF_MOCK_SUB=none): 결제 관리가 「유료 요금제 없음」 글을 그리고 요금제 칸이 없다(글이 보인 뒤에 센다 — 불러오는 중의 0 을 통과로 읽지 않는다)
    await open(page, "/account/billing")
    await expect(page.locator(sel("payments", "billingBlock")), "결제 전 구독 없음(none)").toContainText(want("billingNone")[0]!)
    await expect(page.locator(sel("payments", "billingPlan")), "결제 전 구독 없음(none)").toHaveCount(0)
    await open(page, "/pricing")
    await page.locator(sel("payments", "planLink")).first().click()
    await expect(page).toHaveURL(new RegExp(`/upgrade\\?plan=${planId}$`))
    await expect(page.locator(sel("payments", "pay")), "결제 대화상자가 열렸다").toBeVisible()
  },
  async checkout({ page }) {
    // 청약철회 제한 고지의 필수 체크를 켜야 결제가 간다(목도 live 처럼 거절한다)
    const box = page.locator(sel("payments", "withdrawalBox"))
    await box.click()
    await expect(box).toBeChecked()
    await page.locator(sel("payments", "pay")).click()
    await expect(page.locator(sel("payments", "paid"))).toBeVisible()
  },
  async billingReturn({ page }) {
    await open(page, "/billing/return?_ptxn=mock")
    await expect(page.locator(sel("payments", "receipt"))).toBeVisible()
    // 구독이 active 또는 trialing 으로 생겼다 — 결제 관리의 요금제 칸이 고른 요금제(pro)와 상태 글(Active | Free trial)을 보인다.
    // 상태 표지(data-*)는 web-factory 에서 받은 잠긴 블록(billing-manage.tsx)에 없어서 글(loop-steps.json expect.billingStatusAfter)로 본다
    await open(page, "/account/billing")
    const planCell = page.locator(sel("payments", "billingPlanText"))
    await expect(planCell).toContainText(new RegExp(planId, "i"))
    await expect(planCell, "결제 뒤 구독 상태(active 또는 trialing)").toContainText(anyOf(want("billingStatusAfter")))
    await expect(page.locator(sel("payments", "billingBlock"))).not.toContainText(want("billingNone")[0]!)
  },
  async receiptMail({ feature }) {
    // 주문 확인 메일도 mock 세션의 주소로 간다(mock 설계) — 개수로 센다
    await expectMail(feature)
  },
  async contact({ page, inquiryContact }) {
    await open(page, "/contact")
    await page.locator(sel("inquiry", "contact")).fill(inquiryContact)
    await page.locator(sel("inquiry", "message")).fill("One-loop check: please ignore this message.")
    await page.locator(sel("inquiry", "submit")).click()
    await expect(page.locator(sel("inquiry", "done"))).toBeVisible()
    await expect(page.locator(sel("inquiry", "reference"))).toHaveText(/\S/)
  },
  async inquiryMail({ feature, inquiryContact }) {
    await expectMail(feature)
    // 접수 확인은 방문자가 적은 이메일로 간다(연락처가 이메일일 때만 — packages/inquiry)
    const receipt = readOutbox(outbox).filter((l) => l.template === "inquiryReceipt")
    expect(receipt.map((l) => l.to)).toEqual([inquiryContact])
  },
  async bookPage({ page, bookingContact }) {
    await open(page, "/book")
    await expect(page.locator('[data-booking="enabled"]'), "예약 접수가 켜져 있다(mock 은 운영자 메일을 가짜 주소로 채운다)").toBeVisible()
    // 슬롯은 서버에서 읽어 온다 — 슬롯이 나올 때까지 기다린 뒤 **가장 먼 날의 마지막** 시간을 고른다.
    // 가장 이른 슬롯은 취소 마감(시작 2시간 전)과 접수 마감(지금부터 2시간 뒤)이 거의 겹쳐 곧바로 취소가 닫힐 수 있다
    const slots = page.locator(sel("booking", "slot"))
    await expect(slots.first(), "예약 가능한 시간이 하나 이상 보인다").toBeAttached({ timeout: 15_000 })
    await slots.last().check({ force: true })
    await page.locator(sel("booking", "name")).fill("Loop Booker")
    await page.locator(sel("booking", "contact")).fill(bookingContact)
    await page.locator(sel("booking", "submit")).click()
    await expect(page.locator(sel("booking", "done"))).toBeVisible()
    await expect(page.locator(sel("booking", "done")), "즉시 확정 모드").toHaveAttribute("data-status", "confirmed")
    const reference = (await page.locator(sel("booking", "reference")).innerText()).trim()
    expect(reference, "예약 번호").toMatch(/^B-/)
    bookedReference = reference
  },
  async manageCancel({ page, bookingContact }) {
    expect(bookedReference, "bookPage 가 예약 번호를 받아 왔다").not.toBe("")
    await open(page, "/book/manage")
    await page.locator(sel("booking", "manageReference")).fill(bookedReference)
    await page.locator(sel("booking", "manageContact")).fill(bookingContact)
    await page.locator(sel("booking", "manageFind")).click()
    const found = page.locator(sel("booking", "manageFound"))
    await expect(found).toBeVisible()
    await expect(found, "예약 번호 + 연락처가 맞으면 직접 취소할 수 있다").toHaveAttribute("data-can-cancel", "true")
    await page.locator(sel("booking", "manageCancel")).click()
    await page.locator(sel("booking", "manageConfirm")).click()
    await expect(page.locator(sel("booking", "manageResult"))).toHaveAttribute("data-status", "cancelled")
  },
  async bookingMail({ feature, bookingContact }) {
    // 대표 알림 1 + 예약 확인 1 + 취소 확인 1. 예약 확인·취소 확인은 방문자가 적은 이메일로 간다(연락처가 이메일일 때만)
    await expectMail(feature)
    const toBooker = readOutbox(outbox).filter((l) => l.template === "bookingConfirmation" || l.template === "bookingCancellation")
    expect(toBooker.map((l) => l.to)).toEqual([bookingContact, bookingContact])
  },
  async bookDepositPage({ page, bookingContact }) {
    await open(page, "/book")
    await expect(page.locator('[data-booking="enabled"]')).toBeVisible()
    // 예약금이 있는 서비스는 mock 에만 있는 예시 서비스다(lib/launch/booking-config.ts) — 서비스를 바꾸면 그 서비스의 가능한 시간을 새로 읽는다
    await expect(page.locator(sel("bookingDeposit", "serviceOption")), "예약금 서비스가 선택지에 있다").toBeAttached()
    await page.locator(sel("bookingDeposit", "serviceSelect")).selectOption(depositServiceId)
    await expect(page.locator(sel("bookingDeposit", "formNote")), "접수 전에 예약금 금액·환불 규칙 안내").toBeVisible()
    const status = page.locator(sel("bookingDeposit", "slotsStatus"))
    await expect(status).toHaveAttribute("data-state", "loading", { timeout: 2_000 }).catch(() => {})
    await expect(status).toHaveAttribute("data-state", "ready", { timeout: 15_000 })
    const slots = page.locator(sel("booking", "slot"))
    await expect(slots.first(), "예약금 서비스의 가능한 시간이 보인다").toBeAttached({ timeout: 15_000 })
    // 가장 먼 날의 마지막 시간 — 무료 취소 마감 안에서 취소해 전액 환불을 받는다
    await slots.last().check({ force: true })
    await page.locator(sel("booking", "name")).fill("Loop Depositor")
    await page.locator(sel("booking", "contact")).fill(bookingContact)
    await page.locator(sel("booking", "submit")).click()
    const done = page.locator(sel("booking", "done"))
    await expect(done).toBeVisible()
    // 결제 대기: 자리는 붙들렸지만 아직 확정이 아니다(금액은 서버 설정에서 온 값이 보인다)
    await expect(page.locator(sel("bookingDeposit", "pending")), "결제 대기").toBeVisible()
    await expect(done).toHaveAttribute("data-status", "requested")
    const reference = (await page.locator(sel("booking", "reference")).innerText()).trim()
    expect(reference, "예약 번호").toMatch(/^B-/)
    depositReference = reference
  },
  async payDeposit({ page }) {
    await page.locator(sel("bookingDeposit", "pay")).click()
    // 키 없는 미리보기의 모의 결제 확인 칸 → 누르면 서버가 공급자에 다시 물어 확정한다(반환 쪽·웹훅과 같은 함수)
    await page.locator(sel("bookingDeposit", "mockPay")).click()
    await expect(page.locator(sel("bookingDeposit", "paid")), "결제 뒤 예약이 확정").toBeVisible()
    await expect(page.locator(sel("booking", "done"))).toHaveAttribute("data-status", "confirmed")
  },
  async cancelDeposit({ page, bookingContact }) {
    expect(depositReference, "bookDepositPage 가 예약 번호를 받아 왔다").not.toBe("")
    await open(page, "/book/manage")
    await page.locator(sel("booking", "manageReference")).fill(depositReference)
    await page.locator(sel("booking", "manageContact")).fill(bookingContact)
    await page.locator(sel("booking", "manageFind")).click()
    const found = page.locator(sel("booking", "manageFound"))
    await expect(found).toBeVisible()
    await expect(found).toHaveAttribute("data-status", "confirmed")
    await expect(page.locator(sel("bookingDeposit", "manageDeposit")), "조회에 예약금 행").toBeVisible()
    await page.locator(sel("booking", "manageCancel")).click()
    await expect(page.locator(sel("bookingDeposit", "refundNote")), "취소 확인 전에 환불 안내").toBeVisible()
    await page.locator(sel("booking", "manageConfirm")).click()
    const result = page.locator(sel("booking", "manageResult"))
    await expect(result).toHaveAttribute("data-status", "cancelled")
    await expect(result, "무료 취소 마감 안이라 전액 환불").toContainText(/refund/i)
  },
  async bookingDepositMail({ feature, bookingContact }) {
    // 대표 알림 1(결제 뒤) + 예약 안내 1(결제 대기) + 확정 메일 1 + 취소 확인 1 — 앞의 booking 몫과 합쳐 센다
    await expectMail(feature)
    const toBooker = readOutbox(outbox).filter((l) => l.template === "bookingConfirmation" || l.template === "bookingCancellation")
    expect(toBooker.every((l) => l.to === bookingContact), "예약한 사람 메일은 모두 적은 이메일로").toBe(true)
    expect(toBooker, "booking 몫 2통 + 예약금 몫 3통").toHaveLength(5)
  },
  async addToCart({ page }) {
    // 주소의 ?add= 만으로는 담기지 않는다(GET 부작용 없음) — 담기 확인 줄의 [담기]를 눌러야 서버 액션이 담는다. 누르기 전의 장바구니 줄은 0
    await open(page, shopAddPath)
    await expect(page.locator(sel("shop", "cartLine")), "주소만으로는 담기지 않는다").toHaveCount(0)
    await page.locator(sel("shop", "addConfirm")).click()
    await expect(page.locator(sel("shop", "added"))).toBeVisible()
    await expect(page.locator(sel("shop", "cartLine")), "담은 상품 한 줄").toHaveCount(1)
  },
  async checkoutAddress({ page }) {
    // 새로 읽어도 장바구니가 서버에 남아 있다. 배송지를 적고 [결제하기]를 누르면 결제 대기 주문이 만들어지고 모의 결제 확인 칸이 열린다(키 없이 켠 결제 중개의 세션)
    await open(page, "/checkout")
    await page.locator(sel("shop", "recipient")).fill("Loop Buyer")
    await page.locator(sel("shop", "phone")).fill("010-1234-5678")
    await page.locator(sel("shop", "postcode")).fill("04524")
    await page.locator(sel("shop", "address1")).fill("1 Example Street")
    await page.locator(sel("shop", "pay")).click()
    await expect(page.locator(sel("shop", "mockPay")), "모의 결제 확인 칸이 열렸다").toBeVisible()
  },
  async payMock({ page }) {
    await page.locator(sel("shop", "mockPay")).click()
    await expect(page.locator(sel("shop", "done")), "결제 확정 뒤 주문 완료 칸").toBeVisible()
  },
  async orderMail({ feature }) {
    // 주문 확인 메일은 사용자 행의 주소(mock 세션의 주소)로 간다 — 개수로 센다
    await expectMail(feature)
  },
  async orderHistory({ page }) {
    await open(page, "/orders")
    const row = page.locator(sel("shop", "orderRow"))
    await expect(row, "주문 한 건").toHaveCount(1)
    await expect(row, "결제가 끝난 주문").toHaveAttribute("data-status", "paid")
  },
}

// 단계 id 가 json 과 어긋나면 브라우저를 띄우기 전에 던진다
assertKnownSteps(spec, Object.keys(RUNNERS))

test.describe("한 바퀴", () => {
  test(`${plan.features.join(" → ")} · 메일 ${plan.mailTotal}통`, async ({ page }) => {
    test.setTimeout(240_000)
    const thrown: string[] = []
    page.on("pageerror", (e) => thrown.push(e.message))

    // 시작 때 기록 파일은 0줄이다(실행마다 새 파일 — 이전 실행·재시도가 줄 수를 속이지 않는다)
    expect(readOutbox(outbox), "시작 때 메일 기록 0줄").toHaveLength(0)

    const ctx = { page, email: "loop-visitor@example.com", password: randomUUID(), inquiryContact: "loop-inquirer@example.com", bookingContact: "loop-booker@example.com" }
    for (const { feature, id } of plan.steps) {
      await test.step(`${feature} · ${id}`, async () => {
        await RUNNERS[id]!({ ...ctx, feature })
        await expect(page.locator(ERROR_BOUNDARY), `${feature} · ${id} 에서 오류 경계 화면이 그려졌다`).toHaveCount(0)
      })
    }

    // 끝: 메일은 기대 표와 정확히 같다 — 늦게 오는 여분의 메일을 잡으려고 잠깐 더 기다린 뒤 다시 센다
    await page.waitForTimeout(1_000)
    const lines = readOutbox(outbox)
    expect(countByTemplate(lines), "한 바퀴 뒤 메일 기록(template 별 개수)").toEqual(plan.mail)
    expect(lines, "메일 기록 줄 수").toHaveLength(plan.mailTotal)
    expect(thrown, "브라우저에서 잡히지 않은 예외").toEqual([])
  })
})
