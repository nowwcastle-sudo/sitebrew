// web-factory 인증 적합성 묶음(authConformance)을 Better Auth 어댑터에 돌리는 실행기. auth.test.mjs 와 scripts/conformance-all.mjs 가 같이 쓴다.
// DB 는 PGlite 메모리 둘(정상 하나, 「백엔드가 응답하지 않는」 장면용으로 닫아 둔 하나). 네트워크는 쓰지 않는다.
import assert from "node:assert/strict"
import { exportMyData, requestAccountDeletion } from "@launch-factory/account-lifecycle"
import { db } from "@launch-factory/db"
import { authActions, authAdapter, createAuth } from "../src/index.ts"

// 고정 시험값 — 실제 비밀이 아니다.
const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE_URL = "http://localhost:3000"
const PASSWORD = "Correct-Horse-Battery-9"
const CONSENT_VERSIONS = { terms: "terms-2026-09-30", privacy: "privacy-2026-09-30" }
const consents = { terms: true, privacy: true, ageOver14: true }

/** 묶음이 돌려야 하는 검사 수(web-factory v0.0.12 기준 — v0.0.8 의 7개에서 9개로: authConformance 에 resetPassword 시나리오 둘(reset-password-unknown-token·reset-password-empty-token)이 늘었고, 이 어댑터가 resetPassword 를 갖고 있어 둘 다 실제로 돈다. D236) */
export const AUTH_PINS = { total: 12, expectedFailures: {} }

/** 브라우저 한 개 흉내: 쿠키 병 + 고정 IP. headers() 는 setCookies 를 곧바로 반영한다 */
function memoryIO(ip) {
  const jar = new Map()
  return {
    ip,
    headers() {
      const h = new Headers({ "x-forwarded-for": this.ip, "user-agent": "lf-test" })
      if (jar.size) h.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "))
      return h
    },
    setCookies(list) {
      for (const line of list) {
        const [pair, ...attrs] = line.split(";")
        const i = pair.indexOf("=")
        const name = pair.slice(0, i).trim()
        const value = pair.slice(i + 1).trim()
        const expired = attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === ""
        if (expired) jar.delete(name)
        else jar.set(name, value)
      }
    },
  }
}

/** @param {{ mod: { authConformance: Function } }} loaded */
export async function runAuthConformance(loaded) {
  const d = await db.local()
  const broken = await db.local()
  await broken.$client.close() // 「백엔드가 응답하지 않는」 장면용
  try {
    const quiet = { onError: () => {} }
    const options = (extra = {}) => ({ db: d, secret: SECRET, baseURL: BASE_URL, onError: () => {}, consentVersions: CONSENT_VERSIONS, ...extra })
    const auth = createAuth(options())
    const errorAuth = createAuth(options({ db: broken }))
    // LFCI: 이 제품의 탈퇴·내려받기는 authAdapter 단독이 아니라 account-lifecycle 과 합친 조립 포트가 한다(template/lib/launch/account.ts accountPort()).
    // 구독 해지는 살아 있는 구독이 있을 때만 필요하다 — 묶음의 탈퇴 장면은 구독 없음이라 가짜 결제 포트는 「구독 없음」만 답한다.
    const noSubscription = () => ({ subscription: async () => ({ ok: true, data: { planId: "free", status: "none" } }), cancel: async () => ({ ok: true, data: { planId: "free", status: "canceled" } }) })
    const account = { requestDeletion: (userId) => requestAccountDeletion({ db: d, billingFor: noSubscription }, userId), exportData: (userId) => exportMyData(d, userId) }
    // 서버 입구를 거친 포트를 묶음에 준다(authActions = requireConfirmation 등 LF 의 실제 입구) — 승인 행동 셋(이메일 바꾸기·탈퇴·내려받기)의 확인 검사까지 LF 입구가 받는다
    const gated = (port) => ({ ...port, ...authActions(port) })
    let ipSeq = 0
    let emailSeq = 0
    const make = async ({ auth: scene }) => {
      const io = memoryIO(`203.0.113.${++ipSeq}`)
      const opts = { ...quiet, account }
      if (scene === "signed-out") return gated(authAdapter(auth, io, opts))
      const signedIn = await authAdapter(auth, io, quiet).signUp({ method: "password", email: `user${++emailSeq}@example.com`, password: PASSWORD, consents })
      assert.ok(signedIn.ok, JSON.stringify(signedIn))
      // error: 같은 비밀로 서명된 세션 쿠키를 들고, DB가 응답하지 않는 인스턴스로 간다
      return gated(scene === "signed-in" ? authAdapter(auth, io, opts) : authAdapter(errorAuth, io, opts))
    }
    const results = await loaded.mod.authConformance(make, { requireConfirmation: true })
    return { adapter: "auth", suite: "authConformance", results, pins: AUTH_PINS }
  } finally {
    await d.$client.close()
  }
}
