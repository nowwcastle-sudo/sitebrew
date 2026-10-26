import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { z } from "zod"
import { createMailer, MailerConfigError, EmailRenderError } from "../src/index.ts"
import { inputs } from "./fixtures.mjs"

const TO = "jamie.customer@example.com"
// 녹화 응답 — Resend API 문서의 모양(https://resend.com/docs/api-reference/emails/send-email · /errors). 가짜 값이다.
const RECORDED_OK = { status: 200, body: { id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" } }
const RECORDED_422 = { status: 422, body: { statusCode: 422, name: "validation_error", message: "Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format." } }

/** globalThis.fetch 를 잠시 바꿔 끼운다. 호출은 calls 에 남는다. */
async function withFetch(impl, fn) {
  const real = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return impl(url, init)
  }
  try {
    return await fn(calls)
  } finally {
    globalThis.fetch = real
  }
}
const respond = ({ status, body }) => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const quietResendErrors = async (fn) => {
  const real = console.error
  console.error = () => {}
  try {
    return await fn()
  } finally {
    console.error = real
  }
}

test("mock: 키 없이 콘솔로 보낸다 — 네트워크 0건, 받는 주소는 가린다", async () => {
  const lines = []
  const mailer = createMailer({ mode: "mock", log: (l) => lines.push(l) })
  await withFetch(
    () => {
      throw new Error("mock 에서 fetch 를 부르면 안 된다")
    },
    async (calls) => {
      const r1 = await mailer.send({ to: TO, template: "welcome", input: inputs("ko").welcome, idempotencyKey: "welcome:user_1" })
      const r2 = await mailer.send({ to: TO, template: "priceChange", input: inputs("en").priceChange })
      assert.deepEqual(r1, { ok: true, mode: "mock", id: "mock_1" })
      assert.deepEqual(r2, { ok: true, mode: "mock", id: "mock_2" })
      assert.equal(calls.length, 0)
    },
  )
  assert.equal(lines.length, 2)
  assert.match(lines[0], /^\[email:mock\] mock_1 template=welcome to=\[email\] subject="SampleCo 가입을 환영해요" idempotencyKey=welcome:user_1/)
  assert.ok(lines[0].includes("지민님, 안녕하세요."))
  assert.ok(lines[1].includes("No response is not consent"))
  assert.ok(!lines.join("\n").includes(TO), "받는 주소 원문이 콘솔에 없다")
})

test("mock: 기본 출력은 console.info, 입력 오류는 mock 에서도 던진다", async () => {
  const real = console.info
  const seen = []
  console.info = (l) => seen.push(l)
  try {
    const mailer = createMailer({ mode: "mock" })
    await mailer.send({ to: TO, template: "cancellation", input: inputs("en").cancellation })
    const i = inputs("en").priceChange
    await assert.rejects(mailer.send({ to: TO, template: "priceChange", input: { ...i, change: { ...i.change, consentBy: undefined } } }), EmailRenderError)
  } finally {
    console.info = real
  }
  assert.equal(seen.length, 1, "오류 난 메일은 콘솔에도 안 나간다")
})

test("live: 키·발신 주소가 없으면 만들 때 둘 다 알린다(O4)", () => {
  assert.throws(() => createMailer({ mode: "live" }), (e) => e instanceof MailerConfigError && e.missing.join() === "RESEND_API_KEY,EMAIL_FROM" && /O4/.test(e.message))
  assert.throws(() => createMailer({ mode: "live", apiKey: "re_recorded_test" }), (e) => e.missing.join() === "EMAIL_FROM")
  assert.throws(() => createMailer({ mode: "staging" }), /mock or live/)
})

test("live(녹화 응답): Resend 에 html·text·태그·Idempotency-Key 로 POST 하고 id 를 돌려준다", async () => {
  const mailer = createMailer({ mode: "live", apiKey: "re_recorded_test", from: "SampleCo <hello@sampleco.test>", replyTo: "support@sampleco.test" })
  const r = await withFetch(respond(RECORDED_OK), async (calls) => {
    const res = await mailer.send({ to: TO, template: "priceChange", input: inputs("ko").priceChange, idempotencyKey: "price-change:sub_1:2026-11-01" })
    assert.equal(calls.length, 1)
    const { url, init } = calls[0]
    assert.equal(url, "https://api.resend.com/emails")
    assert.equal(init.method, "POST")
    const headers = new Headers(init.headers)
    assert.equal(headers.get("idempotency-key"), "price-change:sub_1:2026-11-01")
    assert.ok(headers.get("authorization")?.endsWith("re_recorded_test"), "키는 Authorization 헤더로만 간다")
    const body = JSON.parse(init.body)
    assert.equal(body.from, "SampleCo <hello@sampleco.test>")
    assert.equal(body.to, TO)
    assert.equal(body.reply_to ?? body.replyTo, "support@sampleco.test")
    assert.equal(body.subject, "SampleCo Pro 요금이 2026년 11월 15일부터 바뀌어요")
    assert.match(body.html, /^<!DOCTYPE html/)
    assert.ok(body.text.includes("2026년 11월 1일 오후 11:59 GMT+9까지 동의해 주세요"))
    assert.deepEqual(body.tags, [{ name: "template", value: "priceChange" }])
    assert.ok(!JSON.stringify(body).includes("re_recorded_test"), "본문에 키가 없다")
    return res
  })
  assert.deepEqual(r, { ok: true, mode: "live", id: RECORDED_OK.body.id })
})

test("live(녹화 응답): 공급자 오류·네트워크 오류는 던지지 않고 값으로 — 메시지 속 주소는 가린다", async () => {
  const mailer = createMailer({ mode: "live", apiKey: "re_recorded_test", from: "SampleCo <hello@sampleco.test>" })
  const r422 = await quietResendErrors(() => withFetch(respond(RECORDED_422), () => mailer.send({ to: "not-an-email", template: "welcome", input: inputs("en").welcome })))
  assert.equal(r422.ok, false)
  assert.equal(r422.error.name, "validation_error")
  assert.equal(r422.error.statusCode, 422)
  assert.ok(!r422.error.message.includes("email@example.com"))
  const down = await quietResendErrors(() =>
    withFetch(
      () => {
        throw new TypeError("fetch failed")
      },
      () => mailer.send({ to: TO, template: "welcome", input: inputs("en").welcome }),
    ),
  )
  assert.equal(down.ok, false)
  assert.equal(down.error.statusCode ?? null, null)
})

test("live: 주입한 클라이언트(ResendLike)도 받는다 — 입력 오류면 공급자를 부르지 않는다", async () => {
  const sent = []
  const client = { emails: { send: async (payload, options) => (sent.push({ payload, options }), { data: { id: "x1" }, error: null }) } }
  const mailer = createMailer({ mode: "live", client, from: "hello@sampleco.test" })
  assert.deepEqual(await mailer.send({ to: TO, template: "orderConfirmation", input: inputs("en").orderConfirmation }), { ok: true, mode: "live", id: "x1" })
  assert.equal(sent[0].options, undefined)
  const i = inputs("en").priceChange
  await assert.rejects(mailer.send({ to: TO, template: "priceChange", input: { ...i, declineUrl: "" } }), EmailRenderError)
  assert.equal(sent.length, 1)
})

// 가짜 메일 기록(LF_MOCK_OUTBOX) — 뒤 시험이 보낸 메일 수를 셀 수 있게 mock 메일을 JSONL 한 줄로 남긴다.
const OUTBOX_SCHEMA = z.fromJSONSchema(JSON.parse(readFileSync(new URL("../outbox.schema.json", import.meta.url), "utf8")))
const readLines = (file) => readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l))
const tmpOutbox = () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-outbox-"))
  return { dir, file: join(dir, "nested", "outbox.jsonl") }
}

test("outbox: 파일을 주면 mock 메일마다 한 줄을 덧붙이고 스키마를 지킨다", async () => {
  const { dir, file } = tmpOutbox()
  try {
    const mailer = createMailer({ mode: "mock", log: () => {}, outbox: file })
    await mailer.send({ to: TO, template: "welcome", input: inputs("ko").welcome })
    await mailer.send({ to: TO, template: "orderConfirmation", input: inputs("en").orderConfirmation })
    const lines = readLines(file)
    assert.deepEqual(lines.map((l) => [l.template, l.to]), [["welcome", TO], ["orderConfirmation", TO]])
    assert.notEqual(lines[0].id, lines[1].id)
    assert.equal(lines[0].subject, "SampleCo 가입을 환영해요")
    for (const l of lines) {
      assert.ok(OUTBOX_SCHEMA.safeParse(l).success, JSON.stringify(l))
      assert.ok(Number.isFinite(Date.parse(l.at)), "at 은 날짜다(fromJSONSchema 는 date-time 을 검사하지 않는다)")
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("outbox: 둘째 메일러(다른 인스턴스)가 같은 파일에 덧붙여도 id 가 겹치지 않는다", async () => {
  const { dir, file } = tmpOutbox()
  try {
    for (let i = 0; i < 2; i++) await createMailer({ mode: "mock", log: () => {}, outbox: file }).send({ to: TO, template: "welcome", input: inputs("ko").welcome })
    const ids = readLines(file).map((l) => l.id)
    assert.equal(new Set(ids).size, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("outbox: 쓸 수 없는 경로면 경로를 담은 오류로 던진다", async () => {
  const { dir } = tmpOutbox()
  try {
    const blocker = join(dir, "blocker")
    writeFileSync(blocker, "x")
    const bad = join(blocker, "outbox.jsonl") // 부모가 파일이라 폴더를 만들 수 없다
    await assert.rejects(
      createMailer({ mode: "mock", log: () => {}, outbox: bad }).send({ to: TO, template: "welcome", input: inputs("ko").welcome }),
      (e) => e.message === `LF_MOCK_OUTBOX: cannot write ${bad}` && e.cause instanceof Error,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("outbox: 파일을 안 주면 파일도 폴더도 만들지 않는다", async () => {
  const { dir, file } = tmpOutbox()
  try {
    await createMailer({ mode: "mock", log: () => {} }).send({ to: TO, template: "welcome", input: inputs("ko").welcome })
    assert.equal(existsSync(join(dir, "nested")), false)
    assert.equal(existsSync(file), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("outbox: 기록은 id·template·to·subject·at 다섯 칸뿐 — 본문·링크 토큰이 없다", async () => {
  const { dir, file } = tmpOutbox()
  try {
    const input = { ...inputs("en").passwordReset, resetUrl: "https://sampleco.test/reset?token=secret-token-123" }
    await createMailer({ mode: "mock", log: () => {}, outbox: file }).send({ to: TO, template: "passwordReset", input })
    assert.deepEqual(Object.keys(readLines(file)[0]).sort(), ["at", "id", "subject", "template", "to"])
    assert.ok(!readFileSync(file, "utf8").includes("secret-token-123"))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("outbox: fixture 는 스키마를 통과하고, 칸이 빠지거나 남으면 거절한다", () => {
  const fixture = JSON.parse(readFileSync(new URL("./outbox.line.json", import.meta.url), "utf8"))
  assert.ok(OUTBOX_SCHEMA.safeParse(fixture).success)
  const noAt = Object.fromEntries(Object.entries(fixture).filter(([k]) => k !== "at"))
  assert.equal(OUTBOX_SCHEMA.safeParse(noAt).success, false)
  assert.equal(OUTBOX_SCHEMA.safeParse({ ...fixture, body: "x" }).success, false)
})
