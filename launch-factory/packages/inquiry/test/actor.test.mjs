// D170: 문의 종류 변경의 소유자·관리자 판정은 세션(서버가 읽은 사용자 행)에서 나온다 — 부르는 쪽이 넘긴 깃발을 믿지 않는다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { db, user as userTable } from "@launch-factory/db"
import { MESSAGES } from "@launch-factory/i18n"
import { actorFromUser } from "../src/index.ts"
import { importRegistryFile, installGlueStubs, stubs } from "../../../scripts/test/registry-glue.mjs"

const OWNER_EMAIL = "Owner@Example.com"

test("actorFromUser: 소유자 = 확인된 이메일이 INQUIRY_OWNER_EMAIL 과 같은 사람(대소문자 무시)", () => {
  assert.deepEqual(actorFromUser({ id: "u1", role: null, email: "owner@example.com", emailVerified: true }, OWNER_EMAIL), { userId: "u1", role: null, isOwner: true })
  assert.equal(actorFromUser({ id: "u1", email: " OWNER@example.com ", emailVerified: true }, OWNER_EMAIL)?.isOwner, true)
})

test("actorFromUser: 이메일을 확인하지 않았거나 다른 주소면 소유자가 아니다 — 주소만 같은 미확인 가입으로 소유자가 될 수 없다", () => {
  assert.equal(actorFromUser({ id: "u2", email: "owner@example.com", emailVerified: false }, OWNER_EMAIL)?.isOwner, false)
  assert.equal(actorFromUser({ id: "u3", email: "other@example.com", emailVerified: true }, OWNER_EMAIL)?.isOwner, false)
  assert.equal(actorFromUser({ id: "u4", emailVerified: true }, OWNER_EMAIL)?.isOwner, false)
  assert.equal(actorFromUser({ id: "u5", email: "owner@example.com", emailVerified: true }, "")?.isOwner, false)
})

test("actorFromUser: 역할은 그대로 싣고(쉼표 목록), 정지된 사람은 행위자가 아니다", () => {
  assert.equal(actorFromUser({ id: "a1", role: "admin,member", email: "a@example.com", emailVerified: true }, OWNER_EMAIL)?.role, "admin,member")
  assert.equal(actorFromUser({ id: "a2", role: "admin", email: "owner@example.com", emailVerified: true, banned: true }, OWNER_EMAIL), null)
})

// ── 조립: 진짜 서버 액션 파일을 불러 세션·서비스 대역으로 부른다 ─────────────────────────────
installGlueStubs({ auth: ["authPort"], config: ["DEFAULT_LOCALE"], db: ["database"], env: ["required"], inquiry: ["inquiry", "inquiryOwnerEmail"] })

const at = new Date("2026-09-30T00:00:00.000Z")
let d
let session = null
let calls = []
let ownerEmail = OWNER_EMAIL // LFENV: undefined = 운영자 메일 없음(문의 창구 꺼짐)
const svc = {
  reclassify: async (...a) => (calls.push(["reclassify", ...a]), { ok: true, changed: true }),
  markAsComplaint: async (...a) => (calls.push(["markAsComplaint", ...a]), { ok: true, changed: true }),
}
const BLOCKED = { ok: false, status: 403, code: "impersonation_blocked", formError: MESSAGES.ko.auth.impersonationBlocked }
const FILE = "feature-inquiry/files/app/actions/inquiry-admin.ts"

before(async () => {
  d = await db.local()
  const mk = (id, extra) => ({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at, ...extra })
  await d.insert(userTable).values([
    mk("owner", { email: "owner@example.com" }),
    mk("admin", { role: "admin" }),
    mk("staff", { role: "member" }),
    mk("fake-owner", { email: "Owner@example.com", emailVerified: false }),
    mk("banned-admin", { role: "admin", banned: true }),
  ])
  stubs.config = { DEFAULT_LOCALE: "ko" }
  stubs.db = { database: async () => d }
  stubs.env = { required: () => "x" }
  stubs.inquiry = { inquiry: async () => svc, inquiryOwnerEmail: () => ownerEmail }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }) }) }
})
after(async () => {
  await d?.$client.close()
})

test("D170 서버 액션: 행위자는 세션에서 읽은 사용자 행으로 만든다 — 입력의 isOwner·actor·role 은 무시한다", async () => {
  const a = await importRegistryFile(FILE)
  const spoof = { reference: "Q-1", to: "quote", reason: "r", isOwner: true, actor: { userId: "admin", role: "admin" }, role: "admin", userId: "admin" }
  for (const [who, expected] of [
    ["owner", { userId: "owner", role: null, isOwner: true }],
    ["admin", { userId: "admin", role: "admin", isOwner: false }],
    ["staff", { userId: "staff", role: "member", isOwner: false }],
    ["fake-owner", { userId: "fake-owner", role: null, isOwner: false }],
  ]) {
    session = { userId: who }
    calls = []
    assert.deepEqual(await a.reclassifyInquiry(spoof), { ok: true, changed: true }, who)
    assert.deepEqual(calls, [["reclassify", "Q-1", "quote", expected, { reason: "r" }]], who)
  }
  session = { userId: "staff" }
  calls = []
  await a.markInquiryAsComplaint({ reference: "Q-2", isOwner: true, reason: "항의" })
  assert.deepEqual(calls, [["markAsComplaint", "Q-2", { userId: "staff", role: "member", isOwner: false }, { reason: "항의" }]])
})

test("D170 서버 액션: 로그아웃·대리 세션·정지된 사람·잘못된 입력은 서비스를 부르지 않는다", async () => {
  const a = await importRegistryFile(FILE)
  calls = []
  session = null
  assert.deepEqual(await a.reclassifyInquiry({ reference: "Q-1", to: "quote" }), { ok: false, formError: MESSAGES.ko.auth.signInRequired })
  session = { userId: "admin", impersonatedBy: "boss" }
  assert.deepEqual(await a.reclassifyInquiry({ reference: "Q-1", to: "quote" }), BLOCKED)
  assert.deepEqual(await a.markInquiryAsComplaint({ reference: "Q-1" }), BLOCKED)
  session = { userId: "banned-admin" }
  assert.deepEqual(await a.markInquiryAsComplaint({ reference: "Q-1" }), { ok: false, formError: MESSAGES.ko.auth.signInRequired })
  session = { userId: "admin" }
  for (const bad of [null, "x", {}, { reference: "" }, { reference: 5 }, { reference: "Q-1", to: 3 }, { reference: "Q-1", to: "quote", reason: "x".repeat(501) }, { reference: "Q".repeat(65), to: "quote" }]) {
    assert.deepEqual(await a.reclassifyInquiry(bad), { ok: false, error: "invalid_input" }, JSON.stringify(bad))
  }
  assert.deepEqual(calls, [], "서비스는 한 번도 불리지 않았다")
})

test("LFENV 서버 액션: 운영자 메일이 없으면(문의 창구 꺼짐) 소유자는 아무도 아니고 관리자는 그대로 바꾼다 — 던지지 않는다", async () => {
  const a = await importRegistryFile(FILE)
  ownerEmail = undefined
  try {
    for (const [who, expected] of [
      ["owner", { userId: "owner", role: null, isOwner: false }],
      ["admin", { userId: "admin", role: "admin", isOwner: false }],
    ]) {
      session = { userId: who }
      calls = []
      assert.deepEqual(await a.reclassifyInquiry({ reference: "Q-1", to: "quote" }), { ok: true, changed: true }, who)
      assert.deepEqual(calls, [["reclassify", "Q-1", "quote", expected, {}]], who)
    }
  } finally {
    ownerEmail = OWNER_EMAIL
  }
})
