// authEmails·consentEmails 다리(LFMAIL): 환영(G05)·새 기기 알림(C06)·가입 안 했어요 링크(A13)·링크 유효 시간(A12)·2년 재확인(A16)이 실제 템플릿 입력으로 이어진다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { authEmails, consentEmails, createMailer, RECONFIRM_LINK_VALID_DAYS, renderEmail } from "../src/index.ts"
import { APP } from "./fixtures.mjs"

function capture() {
  const sent = []
  const mailer = { mode: "mock", send: async (req) => (sent.push(req), { ok: true, id: `m${sent.length}`, mode: "mock" }) }
  return { sent, mailer }
}
const o = { productName: "SampleCo", defaultLocale: "en" }

test("authEmails.verifyEmail: 유효 시간(분)과 가입 안 했어요 링크가 입력으로 간다 — notMeUrl 이 없거나 사용자 id 가 없으면 링크를 싣지 않는다", async () => {
  const { sent, mailer } = capture()
  const e = authEmails(mailer, { ...o, linkValidMinutes: 60, notMeUrl: (r) => (r.id ? `${APP}/api/account/not-me?t=for-${r.id}` : undefined) })
  await e.verifyEmail("a@example.test", `${APP}/v?token=1`, { id: "u1", name: "Jamie", locale: "en" })
  assert.equal(sent[0].input.linkValidMinutes, 60)
  assert.equal(sent[0].input.notMeUrl, `${APP}/api/account/not-me?t=for-u1`)
  await e.verifyEmail("a@example.test", `${APP}/v?token=2`, { name: "No Id" })
  assert.equal("notMeUrl" in sent[1].input, false)
  await authEmails(mailer, o).verifyEmail("a@example.test", `${APP}/v?token=3`, { id: "u1" })
  assert.equal("notMeUrl" in sent[2].input, false, "옵션이 없으면 줄이 없다")
  assert.equal(sent[2].input.linkValidMinutes, 60, "기본 60분")
  await e.passwordReset("a@example.test", `${APP}/r`, { id: "u1" })
  await e.changeEmailConfirm("a@example.test", { newEmail: "b@example.test", url: `${APP}/c` }, { id: "u1" })
  assert.equal(sent[3].input.linkValidMinutes, 60)
  assert.equal(sent[4].input.linkValidMinutes, 60)
})

test("authEmails.welcome·newDeviceSignIn: 템플릿 이름·입력(시각·기기·위치)이 맞고, 위치가 없으면 칸이 없으며, appUrl 이 없으면 환영 메일은 던진다", async () => {
  const { sent, mailer } = capture()
  const e = authEmails(mailer, { ...o, appUrl: `${APP}/app`, securityUrl: `${APP}/forgot-password` })
  await e.welcome("a@example.test", { name: "Jamie", locale: "en" })
  assert.equal(sent[0].template, "welcome")
  assert.equal(sent[0].input.appUrl, `${APP}/app`)
  const at = new Date("2026-10-01T01:30:00.000Z")
  await e.newDeviceSignIn("a@example.test", { device: "Chrome on Windows", at, location: "Seoul, KR" }, { locale: "ko", timeZone: "Asia/Seoul" })
  assert.equal(sent[1].template, "newDeviceSignIn")
  assert.deepEqual([sent[1].input.device, sent[1].input.signedInAt, sent[1].input.location, sent[1].input.securityUrl, sent[1].input.timeZone], ["Chrome on Windows", at.toISOString(), "Seoul, KR", `${APP}/forgot-password`, "Asia/Seoul"])
  await e.newDeviceSignIn("a@example.test", { device: "Safari on iOS", at })
  assert.equal("location" in sent[2].input, false)
  const mail = await renderEmail("newDeviceSignIn", sent[1].input)
  assert.match(mail.text, /시각: 2026년 10월 1일 오전 10:30 GMT\+9/, "받는 사람의 시간대로 본 시각")
  assert.throws(() => authEmails(mailer, o).welcome("a@example.test"), /appUrl/)
})

test("consentEmails.marketingReconfirm: 서명 링크 둘·동의일·유효 일수(= 토큰 기한)·멱등 키가 간다", async () => {
  const { sent, mailer } = capture()
  const c = consentEmails(mailer, { productName: "SampleCo", senderName: "SampleCo Inc.", defaultLocale: "en" })
  const consentAt = new Date("2024-09-30T03:00:00.000Z")
  await c.marketingReconfirm("a@example.test", { consentAt, keepUrl: `${APP}/api/marketing/keep?t=k`, unsubscribeUrl: `${APP}/api/marketing/unsubscribe?t=u`, idempotencyKey: "reconfirm:abc" }, { locale: "en" })
  assert.equal(sent[0].template, "marketingReconfirm")
  assert.equal(sent[0].idempotencyKey, "reconfirm:abc")
  assert.equal(sent[0].input.linkValidMinutes, RECONFIRM_LINK_VALID_DAYS * 24 * 60)
  assert.equal(sent[0].input.senderName, "SampleCo Inc.")
  const mail = await renderEmail("marketingReconfirm", sent[0].input)
  for (const s of ["SampleCo Inc.", "September 30, 2024", "This link works for 60 days.", `${APP}/api/marketing/keep?t=k`, `${APP}/api/marketing/unsubscribe?t=u`, "you keep getting these emails until you unsubscribe"]) {
    assert.ok(mail.text.includes(s), s)
  }
})

test("marketingReconfirm 은 광고가 아니다 — (광고) 표기도 광고 바닥글도 없고 mock 메일러(사업자 정보 없음)로도 렌더·전송된다", async () => {
  const lines = []
  const mailer = createMailer({ mode: "mock", log: (l) => lines.push(l) })
  const r = await consentEmails(mailer, { productName: "SampleCo", defaultLocale: "ko" }).marketingReconfirm("a@example.test", { consentAt: new Date("2024-09-30T03:00:00.000Z"), keepUrl: `${APP}/k`, unsubscribeUrl: `${APP}/u` })
  assert.equal(r, undefined)
  assert.ok(!lines.join("\n").includes("(광고)"))
  assert.match(lines.join("\n"), /광고성 메일을 계속 받을지/)
})
