// 뉴스레터 입력 검사(순수) — DB·메일 없이 돈다.
import { test } from "node:test"
import assert from "node:assert/strict"
import { MESSAGES, t } from "@launch-factory/i18n"
import { LIMITS, normalizeEmail, parseSubscribe, readFields } from "../src/validate.ts"

test("normalizeEmail: 앞뒤 공백을 떼고 소문자로 — 모양이 틀리거나 너무 길면 null", () => {
  assert.equal(normalizeEmail("  Jamie@Example.COM "), "jamie@example.com")
  assert.equal(normalizeEmail("jamie+news@example.com"), "jamie+news@example.com", "+태그는 건드리지 않는다")
  for (const bad of ["", "no-at", "a@b", "a b@example.com", "a@b@example.com", `${"x".repeat(LIMITS.email)}@example.com`, 5, null, undefined]) assert.equal(normalizeEmail(bad), null, String(bad))
})

test("parseSubscribe: 이메일·동의가 맞으면 정규화한 값을 돌려준다 — source 는 안전한 이름표만, 없으면 web", () => {
  const ok = parseSubscribe(new Map([["email", " Jamie@Example.com "], ["consent", "yes"]]), "en")
  assert.deepEqual(ok, { ok: true, email: "jamie@example.com", source: "web" })
  for (const yes of ["yes", "on", "true", "TRUE"]) assert.equal(parseSubscribe(new Map([["email", "a@b.co"], ["consent", yes]]), "en").ok, true, yes)
  assert.equal(parseSubscribe(new Map([["email", "a@b.co"], ["consent", "on"], ["source", "footer-form"]]), "en").source, "footer-form")
  assert.equal(parseSubscribe(new Map([["email", "a@b.co"], ["consent", "on"], ["source", "<script>"]]), "en").source, "web", "이상한 이름표는 web")
})

test("parseSubscribe: 동의가 없으면 칸 오류 — 기본 false 이고 빈 값·no·모르는 값은 모두 동의가 아니다(정보통신망법 제50조 명시적 사전 동의)", () => {
  for (const consent of [undefined, "", "no", "false", "0", "maybe"]) {
    const f = new Map([["email", "a@b.co"]])
    if (consent !== undefined) f.set("consent", consent)
    assert.deepEqual(parseSubscribe(f, "ko"), { ok: false, fieldErrors: { consent: [MESSAGES.ko.newsletter.consentRequired] } }, String(consent))
  }
})

test("parseSubscribe: 칸 오류는 칸 이름 그대로, 두 칸이 같이 틀리면 한 번에 모두 알린다", () => {
  assert.deepEqual(parseSubscribe(new Map(), "en"), { ok: false, fieldErrors: { email: [MESSAGES.en.newsletter.required], consent: [MESSAGES.en.newsletter.consentRequired] } })
  assert.deepEqual(parseSubscribe(new Map([["email", "nope"], ["consent", "yes"]]), "en"), { ok: false, fieldErrors: { email: [MESSAGES.en.newsletter.emailInvalid] } })
  const long = parseSubscribe(new Map([["email", `${"x".repeat(LIMITS.email)}@example.com`], ["consent", "yes"]]), "en")
  assert.deepEqual(long, { ok: false, fieldErrors: { email: [t("en", "newsletter.tooLong", { max: LIMITS.email })] } })
})

test("readFields: FormData·객체에서 문자열 칸만 읽는다(자기 속성만, 공백은 뗀다)", () => {
  const fd = new FormData()
  fd.set("email", " a@b.co ")
  fd.set("file", new Blob(["x"]), "x.txt")
  assert.deepEqual([...readFields(fd)], [["email", "a@b.co"]])
  assert.deepEqual([...readFields({ email: "a@b.co", n: 5 })], [["email", "a@b.co"]])
  assert.deepEqual([...readFields(Object.create({ email: "inherited@b.co" }))], [])
})
