// 서버 액션 인증 정적 검사(scripts/test/server-action-auth.test.mjs)가 「포트에 맡김」으로 허용 목록에 올린 액션의 증거.
// 템플릿의 auth.ts 액션은 session() 같은 가드를 앱 쪽에 두지 않고 포트(authAdapter)가 쿠키 세션을 읽는다. 그래서 여기서
// 쿠키 없는 브라우저로 로그인이 필요한 포트 메서드를 모두 불러 하나도 실행되지 않는지(ok:false · 로그인 요구)를 직접 본다.
// 새 로그인 필요 메서드가 포트에 생기면 아래 표에 넣지 않았을 때 마지막 시험이 실패한다(표 밖 메서드 검사).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { db } from "@launch-factory/db"
import { authActions, authAdapter, createAuth, AUTH_MESSAGES } from "../src/index.ts"

const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const quiet = { onError: () => {} }

/** 로그인이 필요한 메서드 → 그 메서드를 부르는 서버 액션 이름 + 입력 */
const NEEDS_SESSION = {
  changePassword: { input: { currentPassword: "Correct-Horse-Battery-9", newPassword: "New-Horse-Battery-77" } },
  changeEmail: { input: { confirmed: true, newEmail: "someone@example.com", currentPassword: "Correct-Horse-Battery-9" } },
  sendVerificationEmail: { input: {} },
  listSessions: { input: undefined },
  revokeSession: { input: { sessionId: "not-a-real-session" } },
  revokeOtherSessions: { input: undefined },
  updatePreferences: { input: { locale: "ko", timeZone: "Asia/Seoul" } },
  updateProfile: { input: { name: "Nobody" } },
}
/** 로그인 없이 부르는 것이 정상인 메서드(공개 입구·세션 읽기) — 이 표 밖의 새 메서드는 아래 시험이 잡는다 */
const PUBLIC_OR_OTHER = new Set(["methods", "signIn", "signUp", "requestPasswordReset", "resetPassword", "verifyTwoFactor", "signOut", "session", "deleteAccount", "exportMyData"])

let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

function guestPort() {
  const auth = createAuth({ db: d, secret: SECRET, baseURL: "http://localhost:3000", mailer: {}, onError: () => {} })
  const io = { headers: () => new Headers({ "x-forwarded-for": "198.18.9.9", "user-agent": "lf-test" }), setCookies() {} }
  return authAdapter(auth, io, quiet)
}

test("쿠키 없는 브라우저: 로그인이 필요한 포트 메서드는 모두 실행되지 않고 로그인을 요구한다", async () => {
  const port = guestPort()
  for (const [name, { input }] of Object.entries(NEEDS_SESSION)) {
    const r = await authActions(port)[name](input)
    assert.equal(r.ok, false, `${name}: 로그인 없이 ok:true — 가드가 없다`)
    assert.ok(r.code === "sign_in_required" || r.formError === AUTH_MESSAGES.signInRequired, `${name}: 로그인 요구가 아니다 ${JSON.stringify(r)}`)
  }
})

test("표 밖 메서드 검사: 포트가 가진 메서드는 로그인 필요 표나 공개 표 어느 쪽에 올라 있어야 한다", () => {
  const port = guestPort()
  const unknown = Object.keys(port).filter((k) => typeof port[k] === "function" && !(k in NEEDS_SESSION) && !PUBLIC_OR_OTHER.has(k))
  assert.deepEqual(unknown, [], `분류되지 않은 포트 메서드: ${unknown.join(", ")} — NEEDS_SESSION 에 넣고 로그인 없이 막히는지 시험한다`)
})
