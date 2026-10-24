// D170: 문의 종류 변경의 소유자·관리자 판정은 세션(서버가 읽은 사용자 행)에서 나온다 — 부르는 쪽이 넘긴 깃발을 믿지 않는다.
// 서버 액션 조립 시험은 구획 시험(scripts/test/admin-sections-inquiry-reviews-glue.test.mjs)으로 옮겼다.
import assert from "node:assert/strict"
import { test } from "node:test"
import { actorFromUser } from "../src/index.ts"

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
