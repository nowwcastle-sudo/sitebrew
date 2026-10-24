// @launch-factory/i18n — 메시지 목록 검사(v0 Task 18): 키 짝·자리표시·해요체·조사, 그리고 어댑터·서버 액션·메일 원천에 한글 리터럴 0개.
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { fill, MESSAGES, messages, placeholders, t } from "../src/index.ts"

function leaves(obj, prefix = "") {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === "string") out[path] = v
    else Object.assign(out, leaves(v, path))
  }
  return out
}
const ko = leaves(MESSAGES.ko)
const en = leaves(MESSAGES.en)

test("메시지 키가 ko·en 양쪽에 모두 있다(모든 이름공간)", () => {
  assert.deepEqual(Object.keys(MESSAGES.en), ["email", "auth", "consent", "checkout", "transfer", "inquiry", "protect", "collection", "commerce", "reviews", "storage", "newsletter", "booking"])
  assert.deepEqual(Object.keys(ko).filter((k) => !(k in en)), [], "ko 에만 있는 키")
  assert.deepEqual(Object.keys(en).filter((k) => !(k in ko)), [], "en 에만 있는 키")
  // 메일 37키는 그대로 옮겨 왔다(D35). Task 15 가 문의 알림 11키·접수 확인 6키를 더했고,
  // Task 19 가 계정 보안 메일 4묶음 26키(verifyEmail 7·emailChangeConfirm 7·emailChanged 6·passwordChanged 6)를, Task 9b 가 비밀번호 재설정 7키(D180)를, D201 이 마케팅 수신 처리 결과 통지 14키를, F11 이 결제 실패 안내 9키를, LFACCT 가 탈퇴 접수 메일 8키(accountDeletionRequested, D09)를 더했다 / LFMAIL 이 38키(링크 유효 시간·버튼 글자 링크 6, 확인 메일 가입 안 했어요 2, 변경 승인 기한 1, 문의 수신 사유 2, 새 기기 로그인 10, 2년 재확인 9, 광고 표시 8)를 더했다
  // 계획 3b Task 1 이 예약 메일 셋(bookingConfirmation 18·bookingCancellation 12·bookingNotice 17 = 47키)과 예약 서비스 문구 이름공간 booking(20키)을 더했다
  // LFUX2 가 문의 접수 확인의 첫 응답 약속 1키(inquiryReceipt.responseNote)와 「contact us」 알림 둘의 문의 버튼 2키(passwordChanged·emailChanged 의 contactCta)를 더했다
  assert.equal(Object.keys(en).filter((k) => k.startsWith("email.")).length, 37 + 11 + 6 + 26 + 7 + 14 + 9 + 8 + 3 + 38 + 19 + 47 + 7 + 9 + 15 + 7)
  // 계획 3d 관리 화면(문의 답변)이 답변 메일 inquiryReply 7키를 더했다
  // Task 4(뉴스레터)가 구독 확인 메일 7키(newsletterConfirm)와 구독 완료 안내 9키(newsletterWelcome)를 더했다
  // 양성 대조: 한쪽에만 키를 더하면 잡힌다
  const extra = leaves({ ...MESSAGES.ko, auth: { ...MESSAGES.ko.auth, extra: "x" } })
  assert.deepEqual(Object.keys(extra).filter((k) => !(k in en)), ["auth.extra"])
})

test("값은 비어 있지 않고, 같은 키의 자리표시 이름이 두 언어에서 같다", () => {
  for (const key of Object.keys(en)) {
    assert.ok(en[key].trim() && ko[key].trim(), `${key} 비어 있음`)
    assert.deepEqual(placeholders(ko[key]), placeholders(en[key]), `${key} 자리표시`)
  }
})

const FORMAL = /(습니다|합니다|입니다|십시오|됩니다|읍니다)/
const PLAIN_END = /다([.!?](\s|$)|$)/
test("ko 는 해요체다 — 합쇼체(습니다·합니다…)도 해라체 문장 끝(…다.)도 없다", () => {
  assert.deepEqual(Object.entries(ko).filter(([, v]) => FORMAL.test(v)), [])
  assert.deepEqual(Object.entries(ko).filter(([, v]) => PLAIN_END.test(v)), [])
  // 양성 대조: 같은 식이 잡는다
  assert.match("구독이 해지되었습니다.", FORMAL)
  assert.match("가입할 수 없다.", PLAIN_END)
  assert.doesNotMatch("가입할 수 없어요.", PLAIN_END)
  assert.doesNotMatch("채널마다 골라 주세요.", PLAIN_END) // 「마다」는 문장 끝이 아니다
})

// 받침에 따라 바뀌는 조사(을/를·이/가·은/는·과/와·으로/로)를 자리표시 바로 뒤에 붙이지 않는다(값의 받침을 모른다)
const PARTICLE_AFTER_SLOT = /\}(을|를|이|가|은|는|과|와|으로|로)(?![가-힣])/
test("ko 는 자리표시 바로 뒤에 받침 따라 바뀌는 조사를 붙이지 않는다", () => {
  assert.deepEqual(Object.entries(ko).filter(([, v]) => PARTICLE_AFTER_SLOT.test(v)), [])
  assert.match("{contact}로 알려 주세요", PARTICLE_AFTER_SLOT)
  assert.doesNotMatch("{effectiveDate}부터", PARTICLE_AFTER_SLOT)
})

test("t·fill: 자리표시를 채우고, 모르는 키·빈 값은 던진다", () => {
  assert.equal(t("ko", "auth.required"), "꼭 입력해 주세요.")
  assert.equal(t("en", "consent.marketing.updatedAt", { date: "Oct 1" }), "Last changed on Oct 1")
  assert.throws(() => t("en", "auth.nope"), /unknown message key/)
  assert.throws(() => fill("{a} {b}", { a: "x", b: "" }), /missing placeholder value: b/)
  assert.throws(() => messages("fr"), /unknown locale/)
})

// ── 한글 리터럴 검사 ─────────────────────────────────────────────────────────────
// 어댑터·서버 액션·메일 템플릿에 사용자에게 보이는 한글 문구를 두지 않는다(설계 §7-A 6). 주석은 괜찮다.
// TypeScript 파서로 문자열·템플릿·JSX 글자만 본다(주석·정규식은 보지 않는다).
const ROOT = fileURLToPath(new URL("../../", import.meta.url))
const HANGUL = /[ㄱ-ㆎ가-힣]/
/** 대상: 어댑터 패키지 src 전부. billing-* 는 결제 레인(Task 5·6)이 들어오면 자동으로 포함된다 */
const SCANNED = ["auth", "email", "analytics-posthog", "consent", "account-lifecycle", "inquiry", "booking", "reviews", ...readdirSync(ROOT).filter((p) => p.startsWith("billing-"))]
/** 어댑터 패키지가 아닌 곳의 Task 15 파일(요청 제한·봇 방어·문의 저장). 이 패키지들의 다른 파일은 개발자용 한글 오류가 남아 있어 범위 밖이다(Task 18 보고 7) */
const SCANNED_FILES = ["security/src/rate-limit.ts", "security/src/turnstile.ts", "security/src/protect.ts", "db/src/rate-limit.ts", "db/src/idempotency.ts", "db/src/inquiries.ts", "db/src/schema/inquiries.ts", "commerce/src/port.ts", "commerce/src/checkout.ts", "commerce/src/mail.ts"]

function hangulLiterals(fileName, source) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const hits = []
  const visit = (n) => {
    const texts = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n) ? [n.text] : ts.isTemplateExpression(n) ? [n.head.text, ...n.templateSpans.map((s) => s.literal.text)] : []
    if (texts.some((x) => HANGUL.test(x))) hits.push(`${fileName}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} ${n.getText().slice(0, 60)}`)
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return hits
}
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : /\.(m?[jt]sx?)$/.test(f) ? [join(dir, f)] : []))

test("어댑터·서버 액션·메일 템플릿 원천에 한글 문자열 리터럴이 0개다(메시지 목록 밖 금지)", () => {
  const files = SCANNED.flatMap((p) => (existsSync(join(ROOT, p, "src")) ? walk(join(ROOT, p, "src")) : [])).concat(SCANNED_FILES.map((f) => join(ROOT, f)))
  assert.ok(files.length >= 25, `검사 파일 ${files.length}개`)
  for (const must of ["auth/src/adapter.ts", "auth/src/server-actions.ts", "email/src/templates/price-change.ts", "consent/src/checkout.ts", "inquiry/src/index.ts", "email/src/templates/inquiry-receipt.ts", "security/src/protect.ts"]) {
    assert.ok(files.some((f) => f.replaceAll("\\", "/").endsWith(must)), `${must} 가 검사 대상에 없다`)
  }
  assert.deepEqual(files.flatMap((f) => hangulLiterals(f, readFileSync(f, "utf8"))), [])
})

test("한글 리터럴 검사 양성 대조 — 문자열·템플릿·JSX 는 잡고, 주석은 넘긴다", () => {
  assert.equal(hangulLiterals("a.ts", 'const a = "안녕"').length, 1)
  assert.equal(hangulLiterals("b.ts", "const b = `x ${1} 요`").length, 1)
  assert.equal(hangulLiterals("c.tsx", "const c = <p>안녕</p>").length, 1)
  assert.equal(hangulLiterals("d.ts", '// 안녕\n/* 안녕 */\nconst d = "hi"').length, 0)
  // 옛 메일 ko 문구 파일(Task 7)이었다면 잡혔다
  assert.ok(hangulLiterals("ko.ts", `export const ko = ${JSON.stringify(MESSAGES.ko.email)}`).length >= 30)
})
