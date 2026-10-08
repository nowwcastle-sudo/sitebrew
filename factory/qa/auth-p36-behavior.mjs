// P3-6 AUTHBLK 동작 검사(브라우저) — 서버 렌더 시험이 못 보는 입력·포커스·제출 결과를 갤러리 블록에서 직접 눌러 본다.
// 실행: node factory/qa/auth-p36-behavior.mjs [origin=http://localhost:3000] [recipe=r1-measure]   (서버는 빌드 뒤 npm start)
// 종료: 0 = 전부 통과, 1 = 실패 있음 또는 도구 실패(`도구 실패:`).
import { openSession, setView, sleep } from '../board/block-board/page.mjs'
import { navigateAndWait } from './cdp.mjs'

const origin = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const recipe = process.argv[3] ?? 'r1-measure'
const url = (b, q = '') => `${origin}/qa/blocks?b=${b}&r=${recipe}&frame=1${q}`
const rows = []
const check = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail })

const session = await openSession().catch((e) => { console.error(`도구 실패: ${e.message}`); process.exit(1) })
const { ev, send } = session
const J = (x) => JSON.stringify(x)
const active = () => ev(`(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id, name: a.getAttribute('name'), role: a.getAttribute('role'), inAlert: !!a.closest('[role=alert]'), attr: [...a.attributes].map((x) => x.name).filter((n) => n.startsWith('data-')) } : null })()`)
const type = async (sel, text) => { await ev(`document.querySelector(${J(sel)}).focus()`); await send('Input.insertText', { text }); }
const click = (sel) => ev(`(() => { const e = document.querySelector(${J(sel)}); if (!e) return false; e.click(); return true })()`)
const clickText = (re) => ev(`(() => { const b = [...document.querySelectorAll('[data-qa-block] button, [data-qa-block] a')].find((x) => new RegExp(${J(re)}).test(x.textContent || '')); if (!b) return false; b.click(); return true })()`)
const text = () => ev(`(document.querySelector('[data-qa-block]')?.innerText || '').replace(/\\s+/g, ' ')`)
const clear = (sel) => ev(`(() => { const e = document.querySelector(${J(sel)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, ''); e.dispatchEvent(new Event('input', { bubbles: true })) })()`)
// 개발 서버(next dev)는 HMR 소켓 때문에 load 가 늦다 — NAV_MS(기본 30초, 개발 서버는 WF_NAV_TIMEOUT_MS=240000)로 기다리고 [data-qa-ready] 를 직접 본다
const NAV_MS = Number(process.env.WF_NAV_TIMEOUT_MS) || 30000
const open = async (b, q, fx) => {
  await setView(session, { width: 1440 })
  const u = url(b, `${fx ? `&fx=${fx}` : ''}${q ?? ''}`)
  await navigateAndWait(send, ev, u, { timeoutMs: NAV_MS })
  for (let i = 0; i < 1200; i++) { if (await ev(`!!document.querySelector('[data-qa-block][data-qa-ready]')`)) break; if (i === 1199) throw new Error(`블록이 안 그려졌다: ${b}`); await sleep(100) }
  await sleep(1200)
}

try {
  // ── new-password 한 칸 판 (fx=min) ──
  await open('block-auth-new-password', '', 'min')
  check('NP1 한 칸: 비밀번호 칸 1개·한 번 더 칸 없음', (await ev(`document.querySelectorAll('[data-qa-block] input[type=password], [data-qa-block] input#new-password-newPassword').length`)) === 1 && !(await ev(`!!document.querySelector('[name=confirm]')`)))
  check('NP2 한 칸: 비밀번호 보기 토글이 있다(aria-pressed)', await ev(`!!document.querySelector('[data-qa-block] button[aria-pressed]')`))
  await type('[name=newPassword]', 'short')
  await clickText('^비밀번호 바꾸기')
  await sleep(300)
  const a1 = await active()
  check('NP3 한 칸: 짧은 비밀번호 → 포커스가 칸으로(버튼 아님)', a1?.name === 'newPassword', J(a1))
  check('NP3b 한 칸: 짧은 비밀번호 오류 문구', /8자 이상으로 적어 주세요/.test(await text()))
  await clear('[name=newPassword]')
  await type('[name=newPassword]', 'password1')
  await clickText('^비밀번호 바꾸기')
  await sleep(500)
  const a2 = await active()
  check('NP4 한 칸: 흔한 비밀번호(isWeakPassword) → 막고 칸에 포커스', a2?.name === 'newPassword' && /너무 흔한 비밀번호/.test(await text()), J(a2))
  await clear('[name=newPassword]')
  await type('[name=newPassword]', '수요일-바다-가방-17')
  await click('[data-qa-block] button[aria-pressed]')
  check('NP5 보기 토글: 누르면 글자가 보인다(type=text)', (await ev(`document.querySelector('[name=newPassword]').type`)) === 'text')
  await clickText('^비밀번호 바꾸기')
  await sleep(600)
  check('NP6 한 칸: 좋은 비밀번호 → 완료 안내(token 은 갤러리 가상 토큰)', /비밀번호를 바꿨어요/.test(await text()), (await text()).slice(0, 120))

  // ── new-password 두 칸(기본) 그대로 ──
  await open('block-auth-new-password', '')
  check('NP7 두 칸(기본): 칸 둘', (await ev(`document.querySelectorAll('[name=newPassword],[name=confirm]').length`)) === 2)
  await type('[name=newPassword]', '수요일-바다-가방-17')
  await type('[name=confirm]', '다른-비밀번호-1234')
  await clickText('^비밀번호 바꾸기')
  await sleep(300)
  const a3 = await active()
  check('NP8 두 칸: 불일치 → 포커스가 한 번 더 칸으로', a3?.name === 'confirm' && /달라요/.test(await text()), J(a3))

  // ── sign-up ① 비밀번호 규칙·약한 비밀번호 ──
  await open('block-auth-sign-up-consents', '&auth=signed-out')
  check('SU1 규칙(8자 이상)은 입력 전에 보인다', /8자 이상으로 만들어 주세요/.test(await text()))
  await type('[name=email]', 'dup@example.com')
  await type('[name=password]', 'short')
  await clickText('^다음 — 약관 보기')
  await sleep(300)
  const b1 = await active()
  check('SU2 짧은 비밀번호 → 포커스가 비밀번호 칸으로(버튼 아님)', b1?.name === 'password', J(b1))
  await clear('[name=password]')
  await type('[name=password]', 'qwerty123')
  await clickText('^다음 — 약관 보기')
  await sleep(600)
  const b2 = await active()
  check('SU3 흔한 비밀번호 → ①에 머물고 칸에 포커스, 규칙 문구', b2?.name === 'password' && /너무 흔한 비밀번호/.test(await text()) && (await ev(`document.querySelector('[data-flow=signup]').dataset.step`)) === '1', J(b2))
  await clear('[name=password]')
  await type('[name=password]', '수요일-바다-가방-17')
  await clickText('^다음 — 약관 보기')
  await sleep(600)
  check('SU4 좋은 비밀번호 → ②로', (await ev(`document.querySelector('[data-flow=signup]').dataset.step`)) === '2')

  // ── ② 구조: 새 탭 링크·필수/선택 묶음·채널 ──
  check('SU5 약관·개인정보 링크 새 탭(target=_blank rel=noopener)', (await ev(`[...document.querySelectorAll('a[data-new-tab]')].filter((a) => a.target === '_blank' && /noopener/.test(a.rel)).length`)) === 2)
  check('SU6 필수/선택 묶음이 fieldset 둘, 선택 채널 3(문자 없음)', (await ev(`document.querySelectorAll('fieldset[data-consent-group]').length`)) === 2 && (await ev(`document.querySelectorAll('[data-consent=optional]').length`)) === 3 && !(await ev(`!!document.querySelector('[name=marketing-sms]')`)))
  check('SU7 미리 켜진 동의 칸 없음', (await ev(`[...document.querySelectorAll('[data-consent]')].every((e) => e.getAttribute('aria-checked') === 'false')`)))
  const before = await ev(`document.location.href`)
  await ev(`document.querySelector('a[data-new-tab]').addEventListener('click', (e) => e.preventDefault(), { once: true })`)
  await ev(`document.querySelector('a[data-new-tab]').click()`)
  check('SU8 링크를 눌러도 가입 화면(단계 ②·입력)이 그대로다', (await ev(`document.location.href`)) === before && (await ev(`document.querySelector('[data-flow=signup]').dataset.step`)) === '2')
} catch (e) {
  console.error(`도구 실패: ${e.message}`)
  await session.close()
  process.exit(1)
}

// ── sign-up 중복 이메일(submit=field-error → code email_exists) ──
try {
  await open('block-auth-sign-up-consents', '&auth=signed-out&submit=field-error')
  await type('[name=email]', 'dup@example.com')
  await type('[name=password]', '수요일-바다-가방-17')
  await clickText('^다음 — 약관 보기')
  await sleep(600)
  for (const sel of ['[data-consent=required]']) await ev(`document.querySelectorAll(${J(sel)}).forEach((e) => e.click())`)
  await sleep(200)
  await clickText('^가입하기')
  await sleep(900)
  const step = await ev(`document.querySelector('[data-flow=signup]').dataset.step`)
  const box = await ev(`(() => { const n = document.querySelector('[data-account-exists]'); return n ? { links: [...n.querySelectorAll('a')].map((a) => a.getAttribute('href')), alert: n.getAttribute('role') } : null })()`)
  const a = await active()
  check('SU9 중복 이메일 → ①로 돌아가 알림에 행동 둘(로그인·비밀번호 찾기)', step === '1' && box && box.links.length === 2 && box.links.includes('#sign-in') && box.links.includes('#password-reset'), J({ step, box }))
  check('SU10 중복 이메일 → 이메일 칸 오류 문구가 남고 포커스는 그 칸, 알림은 칸 바로 뒤(Tab 한 번이면 행동)', /이미 가입된 이메일/.test(await text()) && a?.name === 'email' && (await ev(`document.querySelector('[name=email]').closest('[data-slot=field]').nextElementSibling?.matches('[data-account-exists]')`)), J(a))
} catch (e) {
  console.error(`도구 실패: ${e.message}`)
  await session.close()
  process.exit(1)
}

// ── signup-complete 다시 보내기·로그인 상태 ──
try {
  await open('block-confirmation-signup-complete', '')
  check('SC1 맨 위 제목이 이메일 확인이다', /^메일함을 열어 이메일을 확인해 주세요/.test(await ev(`document.querySelector('[data-qa-block] h2').innerText`)))
  check('SC2 보낸 주소를 굵게 보인다', (await ev(`document.querySelector('[data-address]')?.textContent`)) === 'kim@example.com')
  check('SC3 다시 보내기는 대기 중 잠겨 있고 role=timer 줄이 초를 센다', (await ev(`document.querySelector('[data-resend]').disabled || document.querySelector('[data-resend]').getAttribute('aria-disabled') === 'true' || document.querySelector('[data-resend]').hasAttribute('data-disabled')`)) && /초 뒤에 다시 보낼 수 있어요/.test(await ev(`document.querySelector('[role=timer]').textContent`)))
  await open('block-confirmation-signup-complete', '&auth=signed-out')
  check('SC4 로그인 안 한 채 → 다음 행동 「로그인하기」, 다시 보내기 없음', (await ev(`document.querySelector('[data-next-action]').getAttribute('href')`)) === '#sign-in' && !(await ev(`!!document.querySelector('[data-resend]')`)))
} catch (e) {
  console.error(`도구 실패: ${e.message}`)
  await session.close()
  process.exit(1)
}

const errors = session.takeErrors()
check('콘솔 오류 0', errors.length === 0, errors.join(' | '))
await session.close()
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  — ${r.detail}`}`)
const fail = rows.filter((r) => !r.ok).length
console.log(`\n${rows.length - fail}/${rows.length} 통과, 실패 ${fail}`)
process.exit(fail ? 1 : 0)
