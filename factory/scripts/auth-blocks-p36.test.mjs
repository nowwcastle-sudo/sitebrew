// P3-6 AUTHBLK — 인증 블록 개선(UX 감사 A01·A02·A03·A04·A05·A08·K09, factory-rules.md §23 U2·U4·U5)의 구조 시험.
// 서버 렌더(브라우저 없음)로 볼 수 있는 것만 본다 — 입력·포커스·제출 동작은 docs/qa/p3-6-auth.md 의 브라우저 검사가 본다.
// 실행: node --test --test-force-exit --test-timeout=240000 factory/scripts/auth-blocks-p36.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { h, html, load, root } from './lib/base-compare.mjs'

const textOf = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const count = (s, re) => (s.match(re) ?? []).length
const METHODS = ['password', 'kakao', 'naver', 'google']

// ── auth/new-password: 한 칸 판(운영자 결정 2026-10-03) ─────────────────────────────────────────────
test('new-password: 기본은 지금처럼 두 칸이고, confirmField:false 는 한 칸 + 비밀번호 보기 토글(한 번 더 칸·불일치 검사 없음)', async () => {
  const { AuthNewPassword } = await load('registry/factory/blocks/auth/new-password.tsx')
  const fx = await load('registry/factory/blocks/auth/new-password.fixture.ts')
  const two = html(h(AuthNewPassword, fx.fixture))
  assert.equal(count(two, /type="password"/g), 2, '기본(confirmField 생략) 두 칸')
  assert.match(two, /name="confirm"/)
  assert.match(two, /data-confirm-field=""/)
  // 한 칸: fixtureMin
  const one = html(h(AuthNewPassword, fx.fixtureMin))
  assert.equal(fx.fixtureMin.confirmField, false)
  assert.equal(count(one, /type="password"/g), 1, '한 칸')
  assert.doesNotMatch(one, /name="confirm"/)
  assert.doesNotMatch(one, /data-confirm-field/)
  assert.match(one, /<button\b[^>]*aria-label="비밀번호 보기"[^>]*aria-pressed="false"|<button\b[^>]*aria-pressed="false"[^>]*aria-label="비밀번호 보기"/, '한 칸이면 보기 토글이 반드시 있다')
  assert.match(one, /autoComplete="new-password"|autocomplete="new-password"/i)
  assert.match(one, /8자 이상/, '규칙(hint)은 입력 전에 보인다')
  // 두 칸 판에서도 confirm 문구를 안 주면 칸은 그리지 않는다(문구 없는 칸을 만들지 않는다) — 타입은 막지만 JS 소비자 보호
  const noCopy = html(h(AuthNewPassword, { ...fx.fixture, copy: { ...fx.fixture.copy, confirm: undefined } }))
  assert.equal(count(noCopy, /type="password"/g), 1)
  // 소스: 한 칸이면 confirm 검사기·mismatch 를 부르지 않는다
  const src = readFileSync(join(root, 'registry/factory/blocks/auth/new-password.tsx'), 'utf8')
  assert.match(src, /confirmField === false \? undefined : copy\.confirm/)
  assert.match(src, /\.\.\.\(confirmCopy \? \{ confirm:/)
  assert.match(src, /confirmCopy \? \["newPassword", "confirm"\] : \["newPassword"\]/)
  assert.match(src, /if \(confirmCopy && v\.confirm !== v\.newPassword\)/)
})

test('new-password: 틀린 링크·완료 화면은 한 칸 판에서도 같다', async () => {
  const { AuthNewPassword } = await load('registry/factory/blocks/auth/new-password.tsx')
  const fx = await load('registry/factory/blocks/auth/new-password.fixture.ts')
  const bad = html(h(AuthNewPassword, { ...fx.fixtureMin, token: '' }))
  assert.match(bad, /data-link-invalid/)
  assert.equal(count(bad, /type="password"/g), 0)
})

test('new-password: 약한 비밀번호 거르개 isWeakPassword — 갤러리 포트가 주고, 문구는 copy.errors.weak', async () => {
  const fx = await load('registry/factory/blocks/auth/new-password.fixture.ts')
  assert.equal(typeof fx.isCommonPassword, 'function')
  for (const bad of ['password', 'PASSWORD1', '12345678']) assert.equal(fx.isCommonPassword(bad), true, bad)
  assert.equal(fx.isCommonPassword('수요일-바다-가방-17'), false)
  assert.ok(fx.fixture.copy.errors.weak, 'weak 문구')
  // 거르개는 포트가 아니라 앱 규칙이라 fixture 에 있다(fixturePorts 에 두면 갤러리가 포트 호출로 세어 제출 감사가 틀어진다)
  assert.equal(fx.fixture.isWeakPassword, fx.isCommonPassword)
  assert.equal(fx.fixtureMin.isWeakPassword, fx.isCommonPassword)
  assert.equal(fx.fixturePorts(new URLSearchParams(''), { fx: 'default', onTrack() {} }).isWeakPassword, undefined)
})

// ── auth/sign-up-consents ─────────────────────────────────────────────────────────────────────
const signUp = async (props = {}) => {
  const { AuthSignUpConsents } = await load('registry/factory/blocks/auth/sign-up-consents.tsx')
  const fx = await load('registry/factory/blocks/auth/sign-up-consents.fixture.ts')
  return { fx, out: (extra = {}) => html(h(AuthSignUpConsents, { ...fx.fixture, initial: { methods: METHODS, step: 2 }, ...props, ...extra })), AuthSignUpConsents }
}

test('A04: 약관·개인정보 「보기」 링크는 새 탭(target=_blank rel=noopener)이고 링크 이름에 「새 탭」이 붙는다 — 가입 화면이 그대로 남는다', async () => {
  const { out } = await signUp()
  const h2 = out()
  const links = [...h2.matchAll(/<a\b[^>]*data-new-tab[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0])
  assert.equal(links.length, 2, '약관·개인정보 둘')
  for (const a of links) {
    assert.match(a, /target="_blank"/)
    assert.match(a, /rel="noopener"/)
    assert.match(textOf(a), /\(새 탭에서 열려요\)/, '읽는 도구에 새 탭을 알린다')
  }
  assert.match(links[0], /href="#terms"/)
  assert.match(links[1], /href="#privacy"/)
  // copy.newTab 이 없으면 덧붙는 말이 없다(옛 copy 호환)
  const { fx, out: out2 } = await signUp()
  assert.doesNotMatch(textOf(out2({ copy: { ...fx.fixture.copy, newTab: undefined } })), /새 탭에서/)
})

test('A05: 마케팅 채널은 copy.marketing.channels 에 문구가 있는 것만(+prop channels) — 이 제품이 쓰지 않는 채널은 묻지 않는다', async () => {
  const { fx, out } = await signUp()
  const base = out()
  assert.equal(count(base, /data-consent="optional"/g), 3, '예시 제품이 쓰는 셋')
  assert.doesNotMatch(base, /name="marketing-sms"/)
  for (const ch of ['email', 'kakao', 'push']) assert.match(base, new RegExp(`name="marketing-${ch}"`))
  // prop channels 가 더 좁히면 그만큼만
  const narrow = out({ channels: ['email'] })
  assert.equal(count(narrow, /data-consent="optional"/g), 1)
  // prop channels 에 있어도 copy 에 문구가 없으면 그리지 않는다(문구 없는 칸을 만들지 않는다)
  assert.doesNotMatch(out({ channels: ['sms'] }), /data-consent-group="optional"/)
  // 문구를 더하면 그 채널이 생긴다(fixtureMax 는 넷)
  assert.equal(count(html(h((await load('registry/factory/blocks/auth/sign-up-consents.tsx')).AuthSignUpConsents, { ...fx.fixtureMax, initial: { methods: METHODS, step: 2 } })), /data-consent="optional"/g), 4)
  // 하나도 없으면 선택 동의 묶음 자체가 없다
  const none = out({ copy: { ...fx.fixture.copy, marketing: { ...fx.fixture.copy.marketing, channels: {} } } })
  assert.doesNotMatch(none, /data-consent="optional"|data-consent-group="optional"/)
  assert.match(none, /data-consent="required"/, '필수는 그대로')
})

test('K09: 필수·선택 동의는 이름 있는 묶음 둘로 갈린다(필수 fieldset+legend · 선택 fieldset 점선) — 미리 켜진 칸 없음', async () => {
  const { fx, out } = await signUp()
  const h2 = out()
  const req = h2.indexOf('data-consent-group="required"')
  const opt = h2.indexOf('data-consent-group="optional"')
  assert.ok(req >= 0 && opt > req, '필수 묶음이 선택 묶음 앞에 따로')
  const reqBlock = h2.slice(req, opt)
  assert.match(reqBlock, /<legend\b[^>]*>꼭 필요한 동의<\/legend>/)
  assert.equal(count(reqBlock, /data-consent="required"/g), 3, '필수 셋은 필수 묶음 안에만')
  assert.doesNotMatch(reqBlock, /data-consent="optional"/)
  assert.match(textOf(h2.slice(opt)), /\(선택\)/)
  assert.doesNotMatch(textOf(h2), /전체 동의/)
  for (const t of h2.match(/<[a-z]+\b[^>]*data-consent="(?:required|optional)"[^>]*>/g)) assert.match(t, /aria-checked="false"/, `미리 켜지 않는다 ${t}`)
  // copy.required 가 없으면 지금 모양(필수 묶음 fieldset 없음) — 뒤로 호환
  const legacy = out({ copy: { ...fx.fixture.copy, required: undefined } })
  assert.doesNotMatch(legacy, /data-consent-group="required"/)
  assert.equal(count(legacy, /data-consent="required"/g), 3)
  // 모양: 필수는 실선·선택은 점선
  const css = readFileSync(join(root, 'registry/factory/styles/base.css'), 'utf8')
  assert.match(css, /\.cn-block-signup-optional \{\s*@apply [^;]*border-dashed/)
  assert.match(css, /\.cn-block-signup-group \{\s*@apply [^;]*\bborder\b/)
})

test('A03·U5: 비밀번호 규칙은 입력 전에 hint 로 보이고 칸에 이어져 있다(aria-describedby) — ① 단계', async () => {
  const { AuthSignUpConsents } = await load('registry/factory/blocks/auth/sign-up-consents.tsx')
  const fx = await load('registry/factory/blocks/auth/sign-up-consents.fixture.ts')
  const step1 = html(h(AuthSignUpConsents, { ...fx.fixture, initial: { methods: ['password'] } }))
  const pw = step1.match(/<input\b[^>]*name="password"[^>]*>/)[0]
  const hintId = pw.match(/aria-describedby="([^"]+)"/)?.[1]
  assert.ok(hintId, '비밀번호 칸이 규칙 설명에 이어져 있다')
  assert.match(step1, new RegExp(`id="${hintId}"[^>]*>8자 이상`))
  // 거르개와 문구
  assert.ok(fx.fixture.copy.errors.passwordWeak)
  assert.equal(typeof fx.fixture.isWeakPassword, 'function')
  assert.equal(fx.fixturePorts(new URLSearchParams(''), { fx: 'default', onTrack() {} }).isWeakPassword, undefined, '포트가 아니다')
})

test('A02: 이미 있는 이메일 — 포트가 code email_exists 를 주면 copy.exists 알림(로그인·비밀번호 찾기 링크)이 뜬다(소스 계약 + 갤러리 포트 code)', async () => {
  const mod = await load('registry/factory/blocks/auth/sign-up-consents.tsx')
  assert.deepEqual([...mod.ACCOUNT_EXISTS_CODES], ['email_exists', 'user_already_exists'])
  const fx = await load('registry/factory/blocks/auth/sign-up-consents.fixture.ts')
  const e = fx.fixture.copy.exists
  assert.ok(e.signIn.href && e.reset.href && e.title && e.body)
  // 갤러리 submit=field-error 는 중복 가입이다 — code 가 실린다
  const ports = fx.fixturePorts(new URLSearchParams('submit=field-error'), { fx: 'default', onTrack() {} })
  const r = await ports.signUp({ method: 'password', email: 'dup@example.com', password: 'Passw0rd!123', consents: { terms: true, privacy: true, ageOver14: true } })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'email_exists')
  assert.ok(r.fieldErrors?.email?.length)
  const src = readFileSync(join(root, 'registry/factory/blocks/auth/sign-up-consents.tsx'), 'utf8')
  assert.match(src, /data-account-exists=""/)
  assert.match(src, /ACCOUNT_EXISTS_CODES\.includes\(res\.code\.toLowerCase\(\)\)/)
  // 알림은 행동 둘(링크)이고 role=alert 이며 포커스를 받는다
  assert.match(src, /role="alert" data-account-exists/)
  // 알림은 이메일 칸 바로 뒤에 있다(포커스는 오류 난 칸 — Tab 한 번이면 행동에 닿는다)
  assert.ok(src.indexOf('name="email"') < src.indexOf('data-account-exists') && src.indexOf('data-account-exists') < src.indexOf('name="password" label'))
})

// ── confirmation/signup-complete (A01·A08) ────────────────────────────────────────────────────
const complete = async () => {
  const { ConfirmationSignupComplete } = await load('registry/factory/blocks/confirmation/signup-complete.tsx')
  const fx = await load('registry/factory/blocks/confirmation/signup-complete.fixture.ts')
  return { fx, out: (which = 'fixture', extra = {}) => html(h(ConfirmationSignupComplete, { ...fx[which], ...extra })) }
}
const h2Of = (s) => textOf(s.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/)[0])

test('A01: 확인 전이면 맨 위가 이메일 확인(보낸 주소 굵게·다시 보내기+타이머·이메일 바꾸기), 가입 완료·열린 기능은 「기다리는 동안」 아래', async () => {
  const { out } = await complete()
  const s = out()
  assert.equal(h2Of(s), '메일함을 열어 이메일을 확인해 주세요')
  assert.match(s, /data-confirming=""/)
  assert.match(s, /<strong data-address=""[^>]*>kim@example\.com<\/strong>/)
  assert.match(s, /data-resend=""/)
  assert.match(s, /<p role="timer" data-cooldown="0"/)
  assert.match(s, /href="#settings-credentials"[^>]*>이메일 바꾸기/)
  assert.match(textOf(s), /스팸함/)
  const at = (t) => s.indexOf(t)
  assert.ok(at('data-confirm=""') < at('data-meanwhile=""') && at('data-meanwhile=""') < at('data-unlocked=""') && at('data-unlocked=""') < at('data-next-action=""'), '확인 → 기다리는 동안 → 열린 기능 → 행동')
  assert.match(textOf(s.slice(at('data-meanwhile=""'))), /기다리는 동안.*가입을 마쳤어요/)
  assert.equal(count(s, /data-next-action=""/g), 1, '다음 행동 하나')
  assert.doesNotMatch(h2Of(s), /마쳤어요/, '확인 전 헤드라인에 「다 됐어요」를 쓰지 않는다')
})

test('A01: copy.confirm 이 없거나(fixtureMin) 이미 확인했으면(emailVerified) 가입 완료가 먼저 — 옛 모양 그대로', async () => {
  const { out } = await complete()
  const legacy = out('fixtureMin')
  assert.equal(h2Of(legacy), '가입을 마쳤어요')
  assert.doesNotMatch(legacy, /data-confirm=|data-meanwhile=|data-resend=/)
  const verified = out('fixture', { emailVerified: true })
  assert.equal(h2Of(verified), '가입을 마쳤어요')
  assert.doesNotMatch(verified, /data-confirm=|data-resend=/)
  assert.equal(count(verified, /data-next-action=""/g), 1)
})

test('A08: 로그인 안 한 채면 다음 행동이 「로그인」(다시 보내기 없음), 이미 확인했으면 제목·본문도 로그인 안내이고 열린 기능 목록이 없다', async () => {
  const { out } = await complete()
  const unconfirmed = out('fixture', { signedIn: false })
  assert.match(unconfirmed, /data-next-action=""[^>]*>|<a\b[^>]*data-next-action=""/)
  const primary = unconfirmed.match(/<a\b[^>]*data-next-action=""[^>]*>[\s\S]*?<\/a>/)[0]
  assert.match(primary, /href="#sign-in"/)
  assert.match(textOf(primary), /로그인하기/)
  assert.doesNotMatch(unconfirmed, /data-resend=/, '세션이 없으면 다시 보낼 수 없다')
  assert.match(unconfirmed, /data-confirm=""/, '확인 전이면 안내는 그대로')
  const verifiedOut = out('fixture', { signedIn: false, emailVerified: true })
  assert.equal(h2Of(verifiedOut), '이메일 확인이 끝났어요 — 로그인해 주세요')
  assert.doesNotMatch(verifiedOut, /data-unlocked=|data-next-steps=|data-confirm=|data-resend=/)
  assert.match(verifiedOut.match(/<a\b[^>]*data-next-action=""[^>]*>/)[0], /href="#sign-in"/)
  assert.equal(count(verifiedOut, /data-next-action=""/g), 1)
  // copy.signIn 이 없으면 로그인 안 한 채여도 옛 행동 그대로(뒤로 호환)
  const { fx } = await complete()
  const noSignIn = out('fixture', { signedIn: false, copy: { ...fx.fixture.copy, signIn: undefined } })
  assert.match(noSignIn.match(/<a\b[^>]*data-next-action=""[^>]*>/)[0], /href="#create-page"/)
})

test('A01·A08: 갤러리 포트 — &auth=signed-out · &verified=1 이 위 상태를 만든다', async () => {
  const fx = await load('registry/factory/blocks/confirmation/signup-complete.fixture.ts')
  const p = (q, fxName = 'default') => fx.fixturePorts(new URLSearchParams(q), { fx: fxName, onTrack() {} })
  assert.equal(p('').signedIn, true)
  assert.equal(p('auth=signed-out').signedIn, false)
  assert.equal(p('verified=1').emailVerified, true)
  assert.equal(typeof p('').resendVerification, 'function')
  assert.deepEqual(Object.keys(p('', 'min')), ['track'], 'fx=min 은 옛 모양이라 확인 포트를 주지 않는다')
})

// ── confirmation/verify-email (A01·A08·A14) ──────────────────────────────────────────────────
test('verify-email: 확인이 먼저(제목)·보낸 주소 굵게·세션 없으면 로그인이 다음 행동', async () => {
  const { ConfirmationVerifyEmail } = await load('registry/factory/blocks/confirmation/verify-email.tsx')
  const fx = await load('registry/factory/blocks/confirmation/verify-email.fixture.ts')
  const ready = html(h(ConfirmationVerifyEmail, { ...fx.fixture, initial: { session: { userId: 'u', name: '김예시', email: 'kim@example.com', twoFactor: false, emailVerified: false } } }))
  assert.equal(h2Of(ready), '메일함을 열어 이메일을 확인해 주세요')
  assert.match(ready, /<strong data-address=""[^>]*>kim@example\.com<\/strong>/)
  assert.match(textOf(ready), /kim@example\.com 주소로 확인 메일을 보냈어요/)
  const out = html(h(ConfirmationVerifyEmail, { ...fx.fixture, initial: { session: null } }))
  assert.match(out, /href="#sign-in"[^>]*>|<a\b[^>]*href="#sign-in"/)
  assert.doesNotMatch(out, /data-resend=/)
})

// ── 타입 울타리: 한 칸 판은 보기 토글 이름이 필수, 두 칸 판은 한 번 더 문구가 필수(음성 대조) ──────────
test('tsc: auth-p36.typetest.ts 는 통과하고, @ts-expect-error 줄을 지운 사본은 바로 그 줄들에서만 실패한다(음성 대조)', () => {
  const src = readFileSync(join(root, 'app', 'qa', 'blocks', 'auth-p36.typetest.ts'), 'utf8')
  const expected = new Set()
  const kept = []
  src.split('\n').forEach((l) => {
    if (/^\s*\/\/ @ts-expect-error/.test(l)) expected.add(kept.length + 1)
    else kept.push(l)
  })
  assert.equal(expected.size, 3, '고정물의 @ts-expect-error 는 셋이다(한 칸 판 보기 이름 없음 · 두 칸 판 한 번 더 문구 없음 · 두 칸 판 불일치 문구 없음)')
  const neg = join(root, '.tmp', 'auth-p36-tsc-neg')
  rmSync(neg, { recursive: true, force: true })
  mkdirSync(neg, { recursive: true })
  writeFileSync(join(neg, 'auth-neg.ts'), kept.join('\n'))
  writeFileSync(join(neg, 'tsconfig.json'), JSON.stringify({ extends: '../../tsconfig.json', compilerOptions: { incremental: false, noEmit: true, plugins: [] }, include: ['./*.ts'], exclude: [] }))
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  const r = spawnSync(process.execPath, [tsc, '-p', join(neg, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8' })
  const errors = r.stdout.split('\n').filter((l) => /error TS\d+/.test(l))
  assert.notEqual(r.status, 0, '음성 대조가 통과하면 울타리가 없다')
  const at = new Set(errors.map((e) => Number(e.match(/auth-neg\.ts\((\d+),\d+\)/)?.[1])))
  assert.deepEqual([...at].sort((a, b) => a - b), [...expected].sort((a, b) => a - b), errors.join('\n'))
})
