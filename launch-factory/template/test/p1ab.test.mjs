// P1AB — UX 감사 P1·P2 열린 항목 B1(가입·동의 화면 정리: A05 K09 A03 C07)과 B2(이메일 확인 마무리: A10 A11 A14 A09 A18)의 시험.
// 빌드·서버 없이 돈다(문구·순수 함수는 실행, 이음은 소스 정규식). 브라우저 판정은 npm run template:screens 가 한다(docs/qa/ux-audit/apply-p1ab.md).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

// ── B1 ──

test("A05 가입 화면 마케팅 동의는 이메일 하나만 묻는다 — 보내는 기능이 없는 문자·카카오·앱 알림은 묻지 않는다(운영자 결정 2026-10-07)", async () => {
  const { signUpCopy } = await import("../content/copy.en.ts")
  assert.deepEqual(Object.keys(signUpCopy.marketing.channels), ["email"])
  assert.equal(signUpCopy.marketing.channels.email, "Email")
  // 선택 동의 묶음은 그대로 있다(이메일 한 칸) — 통지·재시도(D210)는 서버 몫이라 이 화면 변경과 무관하다
  assert.match(signUpCopy.marketing.marker, /optional/i)
})

test("A05 계정 알림 설정도 이메일 하나만 그린다 — web-factory v0.0.12(REL12 5c)의 channels 속성으로 좁힌다(문구는 4채널 그대로, 그리는 것만 prop 한 곳)", () => {
  const section = read("components/product/account-blocks.tsx").match(/export function NotificationsSection[\s\S]*?\n}\n/)?.[0] ?? ""
  assert.match(section, /<AccountNotificationConsents [^>]*channels=\{\["email"\]\}/, "계정 화면 알림 블록에 channels={[\"email\"]}")
  const block = read("components/blocks/account/notification-consents.tsx")
  assert.match(block, /channels\?: readonly Channel\[\]/, "설치된 블록이 channels 속성을 받는다(v0.0.12)")
  assert.match(block, /channels\.includes\(ch\)/, "속성에 든 채널만 그린다")
})

test("K09 필수 동의 묶음에 이름(legend)이 있어 선택 동의 묶음과 구조가 갈린다", async () => {
  const { signUpCopy } = await import("../content/copy.en.ts")
  assert.ok(signUpCopy.required?.legend && signUpCopy.required.legend.length > 3)
  assert.notEqual(signUpCopy.required.legend, signUpCopy.marketing.legend)
})

test("A03 흔한 비밀번호를 거른다 — 길이 8을 넘겨도 흔한 것·한 글자 반복·연속 글자는 약하고, 긴 문장·섞인 값은 통과한다", async () => {
  const { isWeakPassword } = await import("../lib/weak-password.ts")
  for (const w of ["password", "12345678", "qwer1234", "aaaaaaaa", "abcdefgh", "87654321", "PASSWORD", "Password1", "1q2w3e4r", "iloveyou", "00000000", "a123456789"]) {
    assert.equal(isWeakPassword(w), true, `${w} 는 약하다`)
  }
  for (const ok of ["correct horse battery staple", "tr0ub4dor&3x", "blue-Harbor-4821", "kimchi stew on sundays"]) {
    assert.equal(isWeakPassword(ok), false, `${ok} 는 통과한다`)
  }
  assert.equal(isWeakPassword(""), false, "빈 값은 길이·필수 검사가 맡는다")
})

test("A03 가입·새 비밀번호 두 블록에 거르개와 문구가 이어져 있다", async () => {
  const { signUpCopy, resetPasswordCopy } = await import("../content/copy.en.ts")
  assert.ok(signUpCopy.errors.passwordWeak, "가입 문구에 약한 비밀번호 오류")
  assert.ok(resetPasswordCopy.errors.weak, "새 비밀번호 문구에 약한 비밀번호 오류")
  const pb = read("components/product/product-blocks.tsx")
  assert.match(pb, /import \{ isWeakPassword \} from "@\/lib\/weak-password"/)
  assert.match(pb, /<AuthSignUpConsents [^>]*isWeakPassword=\{isWeakPassword\}/)
  assert.match(pb, /<AuthNewPassword [^>]*isWeakPassword=\{isWeakPassword\}/)
})

test("A03 거르개는 지연 없이 바로 답한다 — web-factory v0.0.12(REL12 5b)의 port-form 이 제출 번호로 낡은 칸 검사를 버려서 「한 틱 늦게 답하는」 우회를 걷었다", async () => {
  const mod = await import("../lib/weak-password.ts")
  assert.equal(mod.checkWeakPassword, undefined, "지연 래퍼는 없다")
  assert.equal(mod.isWeakPassword("password"), true, "Promise 가 아니라 값으로 바로 답한다")
  assert.equal(mod.isWeakPassword("blue-Harbor-4821"), false)
  assert.doesNotMatch(read("lib/weak-password.ts"), /setTimeout|await new Promise/, "타이머로 답을 미루지 않는다")
  // 그 우회가 필요 없는 까닭: 블록이 제출 번호(submitStamp)로 누르는 중에 예약된 칸 검사를 버린다(고쳐진 블록이 설치돼 있어야 이 시험이 뜻을 가진다)
  const form = read("components/blocks/_shared/port-form.tsx")
  assert.match(form, /submitStamp/)
  assert.match(form, /if \(submitStamp\.current !== stamp\) return/)
})

test("C07 재설정 완료 화면이 다른 기기 로그아웃 여부를 말한다 — 서버가 재설정 때 세션을 끊는다(revokeSessionsOnPasswordReset)", async () => {
  const { resetPasswordCopy } = await import("../content/copy.en.ts")
  assert.match(resetPasswordCopy.done.body, /signed (you )?out/i)
  assert.match(resetPasswordCopy.done.body, /every device|all (of )?your devices|all devices/i)
  assert.match(resetPasswordCopy.done.body, /sign in/i, "다음 행동(새 비밀번호로 로그인)은 그대로")
  // 그 말이 사실이어야 한다 — 서버 설정이 세션을 끊는다
  assert.match(readFileSync(join(T, "../packages/auth/src/config.ts"), "utf8"), /revokeSessionsOnPasswordReset:\s*true/)
})
