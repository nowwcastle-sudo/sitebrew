// 7상태 감사(P3-2 Task 7a Step 3): node factory/board/block-board/states.mjs [origin=http://localhost:3000] [--only <블록|kind>,…] [--limit N] [--out <폴더>]
// npm run blocks:states -- <origin>. 데이터 블록(읽기 상태 넷)은 상태마다, 폼 블록(제출 결과)은 결과마다 한 행 — jobs.mjs stateJobs 가 목록을 만든다.
// 행마다(공통): 그려짐 · 콘솔 오류 0. 그리고 종류별로:
//   loading  — 로딩 표시(aria-busy · role=status · skeleton)가 있다
//   empty    — 빈 화면이 아니라 안내 글이 있고 오류 알림이 아니다
//   error    — 오류 알림 + [다시 시도] 버튼이 있고, 누르면 retry 가 불린다(window.__wfRetried — 갤러리 기본 retry · 예시가 자기 retry 를 주면 window.__retried)
//   ready    — 글이 있고 로딩·오류가 아니다
//   cls      — loading → ready(&delay=800) 전환의 레이아웃 이동 합 < 0.1
//   submit   — 채워서 보낸다(단계형이면 다음 단계로 이어서): ok → 결과 안내가 보인다 · field-error → 첫 오류 필드에 포커스 ·
//              server-error → 입력이 남고 오류 알림이 보인다 · pending → 보내는 중 표시(버튼 잠금·aria-busy)이고 두 번 눌러도 한 번만 나간다
// 잰 것이 0 인 검사는 na 이고 통과가 아니다(A123). 폼에 도달하지 못한 제출 행은 fail(「채울 칸·보내기 버튼을 못 찾았다」)이다.
// 종료: 0 = 실패 0, 1 = 판정 실패 또는 도구 실패(`도구 실패:`, summary.json 없음).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBlocks } from '../../scripts/blocks.mjs'
import { loadHeads } from '../recipe-board/jobs.mjs'
import { stateJobs, absUrl, ROOT, STATE_DELAY_MS } from './jobs.mjs'
import { openSession, openBlock, sleep } from './page.mjs'
import { res } from './checks.mjs'

export const STATES_OUT = join(ROOT, '.tmp', 'blocks-states')
export const CLS_MAX = 0.1
// 재는 뿌리: 기본은 블록. 창 안에 든 블록(upgrade-modal — 포털이라 블록 밖)은 도구가 window.__t7Dialog 를 켜면 열린 [role=dialog] 가 뿌리다(대장 A143).
const BLOCK = `(window.__t7Dialog ? (document.querySelector('[role=dialog]') ?? document.querySelector('[data-qa-block] [data-block]') ?? document.querySelector('[data-qa-block]')) : (document.querySelector('[data-qa-block] [data-block]') ?? document.querySelector('[data-qa-block]')))`
// 눌러 여는 앞 단계(A143): 트리거 글자(정규식 문자열)로 버튼을 눌러 창·펼침을 연다. unless 선택자가 이미 있으면 누르지 않는다.
export const clickText = (re, unless) => `(() => { if (${unless ? `document.querySelector(${JSON.stringify(unless)})` : 'false'}) return 0; const b = [...document.querySelectorAll('[data-qa-block] button')].filter((x) => x.checkVisibility({ checkVisibilityCSS: true }) && !x.disabled).find((x) => new RegExp(${JSON.stringify(re)}).test(x.textContent || '')); if (!b) return 0; b.click(); return 1 })()`
// 확인 입력(confirmed: true)을 싣는 승인 행동 포트 메서드 — contract/conformance/conformance-core CONFIRMED_METHODS 와 같은 표(P3-7 AXC)
export const CONFIRMED_APPROVAL_METHODS = ['changePlan', 'cancel', 'applyRetentionOffer', 'acceptPriceChange', 'changeEmail', 'deleteAccount', 'exportMyData', 'setConsents']
// 입력 확인(P3-7 AXC — delete-account copy.decision.typed): 지울 계정의 이메일 주소 칸에 목의 로그인 주소(MOCK_SESSION)를 그대로 적는다. 일반 채우기는 test@example.com 을 적어 주소가 안 맞는다
const TYPE_CONFIRM_EMAIL = `(() => { const el = document.querySelector('[data-qa-block] input[name=confirmEmail]'); if (!el || el.value) return 0; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'kim@example.com'); el.dispatchEvent(new Event('input', { bubbles: true })); return 1 })()`
const PICK_PLAN = `(() => { const root = document.querySelector('[data-qa-block]'); if (root.querySelector('[aria-pressed="true"]')) return 0; const b = [...root.querySelectorAll('button[aria-pressed="false"]')].find((x) => x.checkVisibility({ checkVisibilityCSS: true }) && !x.disabled); if (!b) return 0; b.click(); return 1 })()`

// 새 문서마다 심는다: 레이아웃 이동 수집(입력 뒤 이동은 뺀다).
export const CLS_INIT = `(() => { window.__wfCls = []; window.__wfReadyAt = null; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__wfCls.push({ t: e.startTime, v: e.value }) }).observe({ type: 'layout-shift', buffered: true }) } catch (e) {} const mo = new MutationObserver(() => { if (window.__wfReadyAt == null && document.querySelector('[data-qa-ready]')) { window.__wfReadyAt = performance.now(); mo.disconnect() } }); mo.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-qa-ready'] })
  // 채운 폼은 이탈 경고(beforeunload — A49 저장 안 한 변경)를 건다. 다음 행이 주소를 옮길 때 사용자 동작이 없다며 Chrome 이 콘솔 오류를 남겨 엉뚱한 행이 실패하므로 이 문서에서는 그 등록을 받지 않는다(경고 동작 자체는 흐름 시험 몫).
  const add = window.addEventListener; window.addEventListener = function (t, ...a) { if (t === 'beforeunload') return; return add.call(this, t, ...a) } })()`

// ── 읽기 상태 ──────────────────────────────────────────────────────────────────────────────────
const FACTS = `(() => {
  const root = ${BLOCK}
  const text = (root.innerText || '').replace(/\\s+/g, ' ').trim()
  const vis = (e) => e.checkVisibility({ checkVisibilityCSS: true })
  const alerts = [...root.querySelectorAll('[role=alert]')].filter(vis)
  const retry = [...root.querySelectorAll('button')].filter((b) => vis(b) && /다시|재시도|retry/i.test(b.textContent || '') && !b.disabled)
  return {
    len: text.length, sample: text.slice(0, 60),
    busy: !!root.querySelector('[aria-busy="true"]') || root.matches('[aria-busy="true"]'),
    status: [...root.querySelectorAll('[role=status]')].some(vis),
    skeleton: !!root.querySelector('[data-slot=skeleton], .animate-pulse, [data-skeleton]'),
    alerts: alerts.length, alertText: alerts.map((a) => a.textContent.trim().slice(0, 40)),
    retry: retry.length,
  }
})()`
const CLICK_RETRY = `(() => { const root = ${BLOCK}; const b = [...root.querySelectorAll('button')].find((b) => b.checkVisibility({ checkVisibilityCSS: true }) && /다시|재시도|retry/i.test(b.textContent || '') && !b.disabled); if (!b) return false; b.click(); return true })()`

// 읽기 상태가 닫힌 창 안에 있는 블록(대장 A143): 창을 연 채로 잰다 — 통과가 아니라 못 잴 때만 na(이유 표시).
export const READ_UNREACHABLE = {}
export const READ_PRE = { 'block-paywall-upgrade-modal': { pre: clickText('살펴보기', '[role=dialog]'), dialog: true } }
export async function readCheck(session, name, block) {
  const { ev } = session
  if (READ_UNREACHABLE[block]) return res(0, [], { unreachable: READ_UNREACHABLE[block] })
  if (READ_PRE[block]) {
    if (READ_PRE[block].dialog) await ev('window.__t7Dialog = true')
    await ev(READ_PRE[block].pre)
    await sleep(700)
  }
  const f = await ev(FACTS)
  const fails = []
  let extra = { len: f.len }
  if (name === 'loading') {
    if (!(f.busy || f.status || f.skeleton)) fails.push('로딩 표시(aria-busy·role=status·skeleton)가 없다')
  } else if (name === 'empty') {
    if (f.len < 8) fails.push(`빈 상태에 안내 글이 없다(글자 ${f.len})`)
    if (f.alerts) fails.push(`빈 상태에 오류 알림이 있다: ${f.alertText[0]}`)
  } else if (name === 'error') {
    if (!f.alerts) fails.push('오류 상태에 오류 알림(role=alert)이 없다')
    if (!f.retry) fails.push('오류 상태에 [다시 시도] 버튼이 없다')
    else {
      // retry 가 불렸다는 증거 셋: 갤러리 기본 retry 계수(__wfRetried)·예시가 준 retry 계수(__retried)·포트 블록은 읽기 메서드가 다시 불린 기록(__wfCalls)
      await ev('window.__wfRetried = 0; window.__retried = 0')
      const calls0 = (await ev('(window.__wfCalls || []).length')) ?? 0
      await ev(CLICK_RETRY)
      await sleep(400)
      const n = (await ev('(window.__wfRetried || 0) + (window.__retried || 0)')) ?? 0
      const calls = ((await ev('(window.__wfCalls || []).length')) ?? 0) - calls0
      extra = { ...extra, retried: n, portCalls: calls }
      if (n + calls < 1) fails.push('[다시 시도]를 눌러도 retry 가 불리지 않았다(갤러리 계수·포트 호출 모두 0)')
    }
  } else if (name === 'ready') {
    if (f.len < 20) fails.push(`ready 상태에 글이 거의 없다(글자 ${f.len})`)
    if (f.busy) fails.push('ready 상태인데 aria-busy 가 남아 있다')
    if (f.alerts) fails.push(`ready 상태에 오류 알림이 있다: ${f.alertText[0]}`)
  }
  return res(1, fails, extra)
}

export async function clsCheck(session) {
  const { ev } = session
  // 블록이 그려진 순간(data-qa-ready)부터 센다 — 갤러리는 그 순간 loading 으로 그리고 delay 뒤에 ready 로 옮긴다. 열기가 끝난 시각이 아니다(열기에 1초 넘게 걸려 전환이 벌써 지나갔을 수 있다).
  const readyAt = await ev('window.__wfReadyAt')
  if (readyAt == null) return res(0, ['블록이 그려진 시각(data-qa-ready)을 못 받았다'])
  const wait = readyAt + STATE_DELAY_MS + 900 - (await ev('performance.now()'))
  if (wait > 0) await sleep(wait)
  const sum = await ev(`window.__wfCls.filter((e) => e.t >= ${readyAt}).reduce((a, e) => a + e.v, 0)`)
  const fails = sum >= CLS_MAX ? [`loading → ready 레이아웃 이동 합 ${sum.toFixed(3)} ≥ ${CLS_MAX}`] : []
  const after = await ev(FACTS)
  if (after.busy) fails.push(`${STATE_DELAY_MS + 900}ms 뒤에도 aria-busy 가 남아 있다(ready 로 안 넘어갔다)`)
  return res(1, fails, { cls: +sum.toFixed(4) })
}

// ── 제출 ─────────────────────────────────────────────────────────────────────────────────────
// 채우기: 보이는 칸마다 예시 값, 필수·동의(선택 동의 제외) 체크는 켠다. 보내기: 마지막 보이는 submit 버튼(없으면 마지막 [data-choice=primary]).
// all: 첫 시도가 아무것도 못 보냈을 때 다시 — 필수 표시가 없는 체크(이용 동의 등)도 켠다(선택 동의는 그대로 둔다).
const FILL = (all = false) => `(() => {
  const all = ${all}
  const root = ${BLOCK}
  const vis = (e) => e.checkVisibility({ checkVisibilityCSS: true }) && !e.disabled
  const set = (el, v) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const VAL = { email: 'test@example.com', tel: '010-1234-5678', password: 'Passw0rd!123', url: 'https://example.com', number: '1', search: '예시', text: '예시', date: '2027-01-15' }
  let filled = 0, checked = 0
  for (const el of root.querySelectorAll('input, textarea')) {
    if (!vis(el) || el.readOnly) continue
    const type = (el.type || 'text').toLowerCase()
    if (type === 'checkbox') { if (!el.closest('[data-consent=optional]') && !el.checked && (all || el.required || el.closest('[data-consent=required]') || el.getAttribute('aria-required') === 'true' || /필수/.test(el.closest('label')?.textContent || ''))) { el.click(); checked++ } continue }
    if (['hidden', 'radio', 'submit', 'button', 'file'].includes(type)) continue
    if (el.value) continue
    const otp = el.inputMode === 'numeric' || /one-time-code/.test(el.autocomplete || '') || /code|otp/i.test(el.name || '')
    set(el, el.tagName === 'TEXTAREA' ? '예시 문의 내용입니다.' : otp ? '123456' : (VAL[type] ?? '예시')); filled++
  }
  // 부품 체크박스(Base UI — role=checkbox 버튼): 필수 표시가 있고 선택 동의가 아니면 켠다
  for (const el of root.querySelectorAll('[role=checkbox]')) {
    if (!el.checkVisibility({ checkVisibilityCSS: true }) || el.getAttribute('aria-checked') === 'true' || el.disabled) continue
    const label = el.closest('label')?.textContent || document.querySelector('label[for="' + el.id + '"]')?.textContent || ''
    if (el.closest('[data-consent=optional]') || /선택/.test(label)) continue
    if (all || el.getAttribute('aria-required') === 'true' || el.closest('[data-consent=required]') || /필수/.test(label)) { el.click(); checked++ }
  }
  // 라디오: 아무것도 안 골랐으면 그룹마다 첫 번째를 고른다(결제 수단 등)
  const groups = new Map()
  for (const el of root.querySelectorAll('input[type=radio], [role=radio]')) { if (!el.checkVisibility({ checkVisibilityCSS: true }) || el.disabled) continue; const g = el.name || el.closest('[role=radiogroup]')?.id || 'g'; const on = el.checked || el.getAttribute('aria-checked') === 'true'; const cur = groups.get(g); if (!cur) groups.set(g, { on, first: el }); else if (on) cur.on = true }
  for (const { on, first } of groups.values()) if (!on) { first.click(); checked++ }
  return { filled, checked }
})()`
// 보내는 버튼: 기본은 마지막 보이는 submit 버튼(없으면 [data-choice=primary]). 흐름형 블록은 다른 버튼이 「보내기」다 — 예: 해지 흐름은 [data-choice=decline] 이 cancel() 을 부른다.
// 값: 선택자 문자열 또는 { selector, text(정규식 문자열) }. 목록에 없으면 기본(submit 버튼).
export const SUBMIT_TARGET = {
  'block-retention-cancel-flow': '[data-choice=decline]',
  // 예약 폼(대장 A133 — 날짜·시간·정보·확인 네 단계): 컴파일본에는 cn-block-* 훅 이름이 없어 글자로 찾는다 — 「다음」·확인 단계의 [예약 요청]을 차례로 누르며 걷는다. 라디오 칩(날짜·시간)은 FILL 이 그룹마다 첫 것을 고른다.
  'block-contact-form-stepped-booking': { selector: 'button', text: '다음|예약 요청' },
  // 2단계 인증 켜기: [2단계 인증 켜기](구역 열기) → 비밀번호 확인 [다음으로](enableTwoFactor 호출) — 그 호출이 「보냄」이다. 기기 [로그아웃] 버튼은 글자가 달라 안 걸린다.
  'block-account-security': { selector: 'button', text: '2단계 인증 켜기|다음으로' },
  'block-confirmation-verify-email': '[data-resend]', // 「인증 메일 다시 보내기」는 type=button — 예시 포트(&submit=)에서는 대기 시간 없이 시작한다(fixturePorts resendAfter 0)
  'block-account-billing-manage': { selector: '[data-choice=primary]', pre: PICK_PLAN }, // 요금제 고르기 → [○○로 바꾸기](changePlan)
  'block-account-delete-account': { selector: '[data-choice=primary]', pre: TYPE_CONFIRM_EMAIL }, // 주소 입력 → [계정 지우기](deleteAccount)
  'block-account-profile-settings': { selector: '[data-choice=primary]', pre: clickText('로그아웃하기', '[data-choice=primary]') }, // [로그아웃하기] → 물음 → [로그아웃](signOut)
  'block-paywall-limit-meter': { selector: '[data-choice=primary]', pre: clickText('살펴보기', '[data-choice=primary]') }, // [요금제 살펴보기] → 제안 → [결제하고 시작하기]
  'block-paywall-upgrade-modal': { selector: '[data-choice=primary]', pre: clickText('살펴보기', '[role=dialog]'), dialog: true }, // 창 열기 → 필수 체크 → [체험 시작하기]
  'block-retention-payment-failed-banner': { selector: 'button', text: '결제 수단 바꾸기' },
  'block-account-notification-consents': '[role=switch]', // 저장 버튼 없이 스위치를 켜면 바로 저장한다
}
// 이 도구가 아직 못 모는 블록(흐름이 여러 화면·선택을 거쳐야 하는 것) — 통과로 세지 않고 na(이유 표시)로 남긴다. 사람이 채워 보는 자리는 대장 A143.
// 대장 A143: 앞 단계(pre)로 구동한다 — 요금제 고르기(billing-manage)·로그아웃 물음 열기(profile-settings)·요금제 살펴보기(limit-meter)·창 열기(upgrade-modal, dialog).
// 남은 한 갈래: 이름·이메일·비밀번호 바꾸기는 다른 화면으로 가는 링크라 보낼 것이 없다 — 그 블록의 보내는 동작은 로그아웃 하나뿐이고 그것을 잰다.
export const SUBMIT_UNREACHABLE = {}
// 결과가 「다른 곳으로 보냄」인 블록(결제 수단 변경 → 결제 포털): 성공은 안내 글이 아니라 onRedirect 가 불린 것(window.__wfRedirects — 예시 fixturePorts 가 기록한다)
export const OK_IS_REDIRECT = new Set(['block-retention-payment-failed-banner'])
const DEFAULT_TARGET = 'button[type=submit], [data-choice=primary]'
const targetOf = (t) => (typeof t === 'string' ? { selector: t } : (t ?? { selector: DEFAULT_TARGET }))
const SUBMIT_SEL = (target) => `(() => {
  const { selector, text } = ${JSON.stringify(targetOf(target))}
  const root = ${BLOCK}
  const vis = (e) => e.checkVisibility({ checkVisibilityCSS: true })
  const btns = [...root.querySelectorAll(selector)].filter((b) => vis(b) && (selector === ${JSON.stringify(DEFAULT_TARGET)} ? b.tagName === 'BUTTON' : true) && (!text || new RegExp(text).test(b.textContent || '')))
  const b = btns.filter((x) => !x.disabled).at(-1) ?? btns.at(-1)
  if (!b) return null
  b.setAttribute('data-t7-submit', '1')
  return { text: (b.textContent || '').trim().slice(0, 20), disabled: b.disabled }
})()`
// 누른 버튼을 data-t7-last 로 남겨 두 번째 누르기가 같은 버튼을 누르게 한다(폼이 둘인 블록에서 첫 버튼을 누르면 다른 폼이 나간다 — account/credentials).
const CLICK_SUBMIT = `(() => { const b = document.querySelector('[data-t7-submit="1"]'); if (!b) return false; document.querySelectorAll('[data-t7-last]').forEach((x) => x.removeAttribute('data-t7-last')); b.removeAttribute('data-t7-submit'); b.setAttribute('data-t7-last', '1'); b.click(); return true })()`
const SUBMITTED = `((window.__wfSubmitted || 0) + (window.__wfCalls || []).filter((c) => !/^(list|get|read|load|subscription|methods|session)/i.test(c.name)).length)`
const SNAPSHOT = `(() => {
  const root = ${BLOCK}
  const vis = (e) => e.checkVisibility({ checkVisibilityCSS: true })
  const ae = document.activeElement
  const invalid = [...root.querySelectorAll('[aria-invalid="true"]')].filter(vis)
  const first = invalid[0] ?? null
  return {
    values: [...root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea')].filter(vis).map((e) => e.value),
    checks: [...root.querySelectorAll('input[type=checkbox], [role=checkbox]')].filter(vis).map((e) => (e.checked || e.getAttribute('aria-checked') === 'true' ? 1 : 0)),
    // 결제 실패 띠 자신(data-payment-issue)은 role=alert 로 읽히는 안내이지 제출 오류가 아니다(P3-6 F02 — 띠 안의 폼 오류 알림은 그대로 센다)
    alerts: [...root.querySelectorAll('[role=alert]')].filter((a) => vis(a) && !a.matches('[data-payment-issue]')).map((a) => a.textContent.trim().slice(0, 50)),
    statuses: [...root.querySelectorAll('[role=status]')].filter(vis).map((a) => a.textContent.trim().slice(0, 50)),
    invalid: invalid.length, firstInvalidFocused: !!first && (first === ae || first.contains(ae) || ae?.closest('[data-slot=field]')?.contains(first)),
    active: ae ? ae.tagName.toLowerCase() + (ae.name ? '[name=' + ae.name + ']' : '') : null,
    busy: !!root.querySelector('[aria-busy="true"]') || root.matches('[aria-busy="true"]'),
    lockedButtons: [...root.querySelectorAll('button')].filter((b) => vis(b) && (b.disabled || b.getAttribute('aria-disabled') === 'true')).length,
    // 단계: data-flow 의 data-step, 없으면 단계 줄(li[aria-current=step])의 순서(예약 폼)
    step: root.querySelector('[data-flow]')?.getAttribute('data-step') ?? (() => { const c = root.querySelector('li[aria-current="step"]'); return c ? String([...c.parentElement.children].indexOf(c)) : null })(),
    text: (root.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
    full: (root.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1500),
  }
})()`

// 폼을 끝까지 채워 보낸다. 단계형은 단계가 바뀌는 동안 이어서(최대 5번). 돌려주는 값: { reached, clicks, before, after, submitted }
export async function driveSubmit(session, { double = false, target } = {}) {
  const { ev } = session
  let clicks = 0, last = null, all = false
  const t = targetOf(target)
  if (t.dialog) await ev('window.__t7Dialog = true')
  for (let i = 0; i < 6; i++) {
    if (t.pre) { await ev(t.pre); await sleep(250) }
    const fill = await ev(FILL(all))
    const btn = await ev(SUBMIT_SEL(target))
    if (!btn) break
    const before = await ev(SNAPSHOT)
    const s0 = await ev(SUBMITTED)
    await ev(CLICK_SUBMIT)
    clicks++
    // 두 번 누르기는 「보내는」 클릭에서만 — 단계가 넘어가는 「다음」 클릭은 두 번 누르지 않는다(단계가 그대로일 때만 한 번 더).
    if (double) {
      await sleep(120)
      const mid = await ev(SNAPSHOT)
      if (mid.step === before.step) await ev(`(() => { const root = ${BLOCK}; const { selector, text } = ${JSON.stringify(targetOf(target))}; const b = document.querySelector('[data-t7-last]') ?? [...root.querySelectorAll(selector)].find((x) => x.checkVisibility({ checkVisibilityCSS: true }) && (!text || new RegExp(text).test(x.textContent || ''))); b?.click(); return 1 })()`)
    }
    await sleep(double ? 500 : 700)
    const after = await ev(SNAPSHOT)
    const submitted = (await ev(SUBMITTED)) - s0
    last = { fill, btn, before, after, submitted }
    // 이어서 갈 때: 단계가 바뀌었고 아직 보낸 게 없으면 다음 단계로
    if (after.step !== before.step && submitted === 0) continue
    if (submitted === 0 && !all) { all = true; continue } // 아무것도 안 나갔다 — 동의 체크를 모두 켜고 한 번 더
    break
  }
  return { reached: !!last, clicks, ...last }
}

// 성공 안내 글: 기본 표현 + 블록별(성공이 「다음 단계 화면」인 흐름 — 2단계 인증은 켜기 요청이 받아들여지면 설정 키·백업 코드 화면이 뜬다)
const OK_RESULT = /접수|완료|감사|보냈|저장|성공|받았/
const OK_EXTRA = { 'block-account-security': /설정 키|백업 코드/ }
// 오류가 보이는가: role=alert, 또는 실패를 알리는 role=status 글(자동 저장 스위치처럼 알림을 status 로 내는 블록).
const FAIL_TEXT = /못했|실패|오류|안 됐|안됐|다시 (시도|해)/
const shown = (a) => a.alerts.length > 0 || a.statuses.some((t) => FAIL_TEXT.test(t))
export async function submitCheck(session, name, block) {
  if (SUBMIT_UNREACHABLE[block]) return res(0, [], { unreachable: SUBMIT_UNREACHABLE[block] })
  const d = await driveSubmit(session, { double: name === 'pending', target: SUBMIT_TARGET[block] })
  if (!d.reached) return res(0, ['채울 칸·보내기 버튼을 못 찾았다(폼에 도달하지 못했다)'])
  const fails = []
  const a = d.after
  const extra = { clicks: d.clicks, submitted: d.submitted, step: a.step }
  if (name === 'ok') {
    if (OK_IS_REDIRECT.has(block)) {
      const n = (await session.ev('(window.__wfRedirects || []).length')) ?? 0
      extra.redirected = n
      if (n < 1) fails.push('ok 인데 다른 곳으로 보내지 않았다(onRedirect 가 안 불렸다 — window.__wfRedirects 0)')
    } else if (!(a.statuses.length || OK_RESULT.test(a.text) || (OK_EXTRA[block] && OK_EXTRA[block].test(a.full)))) fails.push(`ok 결과 안내가 안 보인다(「${a.text.slice(0, 30)}」)`)
    if (a.alerts.length) fails.push(`ok 인데 오류 알림이 있다: ${a.alerts[0]}`)
    if (d.submitted < 1) fails.push('포트 제출 호출이 세어지지 않았다(window.__wfSubmitted·__wfCalls 0 — A31)')
    // 승인 행동 확인 입력(P3-7 AXC): 승인 대기 알림은 role=status 라 위 「안내가 보인다」를 거짓으로 통과시킨다 — 승인 행동 호출이 confirmed: true 를 실었는지 호출 기록으로 직접 본다
    const calls = (await session.ev(`(window.__wfCalls || []).filter((c) => ${JSON.stringify(CONFIRMED_APPROVAL_METHODS)}.includes(c.name)).map((c) => ({ name: c.name, confirmed: !!c.input && c.input.confirmed === true }))`)) ?? []
    const loose = calls.filter((c) => !c.confirmed).map((c) => c.name)
    if (loose.length) fails.push(`승인 행동 호출에 confirmed: true 가 없다(${[...new Set(loose)].join(', ')}) — 블록이 확인 단계 뒤에 싣는다(P3-7 AXC)`)
    if (await session.ev(`!!document.querySelector('[data-qa-block] [data-state="awaiting-approval"]')`)) fails.push('ok 인데 승인 대기(awaiting-approval) 알림이 보인다 — 확인 입력을 안 실었다(P3-7 AXC)')
    extra.approvalCalls = calls.length
  } else if (name === 'field-error') {
    // 채울 칸이 없는 흐름(해지 등)은 칸 오류가 갈 곳이 없다 — 오류 알림이라도 보여야 한다.
    if (!a.invalid) { if (!shown(a)) fails.push('field-error 인데 오류 표시가 없다(aria-invalid 칸도 오류 알림도 없다)') }
    else if (!a.firstInvalidFocused) fails.push(`첫 오류 칸에 포커스가 없다(지금 ${a.active})`)
  } else if (name === 'server-error') {
    // 남아야 하는 것: 글 칸 값과 체크 상태. 보내기 전에 남길 것이 하나도 없으면(칸 없는 흐름) 보존은 재지 않는다.
    const had = d.before.values.length + d.before.checks.length
    const kept = d.before.values.every((v, i) => a.values[i] === v) && d.before.checks.every((v, i) => a.checks[i] === v)
    if (!shown(a)) fails.push('server-error 인데 오류 알림(role=alert)도 실패를 알리는 상태 글(role=status)도 없다')
    if (had && !kept) fails.push(`입력이 남지 않았다(보내기 전 ${JSON.stringify([d.before.values, d.before.checks]).slice(0, 80)} → 뒤 ${JSON.stringify([a.values, a.checks]).slice(0, 80)})`)
    Object.assign(extra, { kept, had })
  } else if (name === 'pending') {
    if (!(a.busy || a.lockedButtons > 0)) fails.push('pending 인데 보내는 중 표시(aria-busy·버튼 잠금)가 없다')
    if (d.submitted > 1) fails.push(`보내는 중 두 번 눌렀더니 ${d.submitted}번 나갔다`)
    Object.assign(extra, { busy: a.busy, locked: a.lockedButtons })
  }
  return res(1, fails, extra)
}

// ── 한 행 ─────────────────────────────────────────────────────────────────────────────────────
export async function runStateRow(session, origin, job) {
  const url = absUrl(origin, job)
  const t0 = Date.now()
  session.takeErrors()
  const r = await session.send('Page.addScriptToEvaluateOnNewDocument', { source: CLS_INIT })
  let open
  try {
    open = await openBlock(session, url, { width: job.width, theme: job.theme })
  } finally {
    await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: r.result.identifier }).catch(() => {})
  }
  const checks = {}
  const errs = session.takeErrors()
  checks.render = res(1, [...(open.ready ? [] : [`블록이 그려지지 않았다: ${open.error}`]), ...errs.slice(0, 5).map((e) => `콘솔 오류: ${e}`)], { consoleErrors: errs.length })
  if (open.ready) {
    checks.state = job.type === 'read' ? await readCheck(session, job.name, job.block) : job.type === 'cls' ? await clsCheck(session) : await submitCheck(session, job.name, job.block)
    const errs2 = session.takeErrors()
    if (errs2.length) { checks.render.fails.push(...errs2.slice(0, 3).map((e) => `콘솔 오류(상호작용 뒤): ${e}`)); checks.render.status = 'fail' }
  } else checks.state = res(0, ['블록이 안 그려져 못 쟀다'])
  const failed = Object.keys(checks).filter((c) => checks[c].status === 'fail')
  const na = Object.keys(checks).filter((c) => checks[c].status === 'na')
  return { id: job.id, block: job.block, recipe: job.recipe, type: job.type, name: job.name, url: job.url, ms: Date.now() - t0, checks, pass: !failed.length, failed, na }
}

export function summarizeStates(rows) {
  const per = {}
  for (const r of rows) for (const [c, x] of Object.entries(r.checks)) { per[c] ??= { pass: 0, fail: 0, na: 0 }; per[c][x.status]++ }
  const byType = {}
  for (const r of rows) { byType[r.type] ??= { rows: 0, fail: 0 }; byType[r.type].rows++; if (!r.pass) byType[r.type].fail++ }
  return { rows: rows.length, failed: rows.filter((r) => !r.pass).length, na: rows.filter((r) => r.na.length).length, per, byType, ok: rows.every((r) => r.pass) }
}

const line = (r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.block} ${r.type}:${r.name} ${(r.ms / 1000).toFixed(1)}s${r.na.length ? ` na:${r.na.join(',')}` : ''}${r.pass ? '' : `\n  ${r.failed.map((c) => `${c}: ${r.checks[c].fails.slice(0, 3).join(' | ')}`).join('\n  ')}`}`

export async function main(argv) {
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const only = flag('--only')?.split(',').filter(Boolean)
  const limit = Number(flag('--limit') ?? 0) || null
  const out = flag('--out') ?? STATES_OUT
  const origin = (argv.filter((a) => !a.startsWith('--'))[0] ?? 'http://localhost:3000').replace(/\/$/, '')
  const file = join(out, 'summary.json')
  mkdirSync(out, { recursive: true })
  rmSync(file, { force: true })
  let session
  try {
    const blocks = loadBlocks(ROOT).filter((b) => b.meta.success && (!only || only.includes(`block-${b.kind}-${b.variant}`) || only.includes(b.kind)))
    if (!blocks.length) throw new Error('고른 블록이 0개다')
    let jobs = stateJobs({ blocks, recipes: loadHeads() })
    if (limit) jobs = jobs.slice(0, limit)
    if (!jobs.length) throw new Error('고른 블록에 읽기·제출 상태가 하나도 없다(행 0개)')
    session = await openSession()
    const rows = []
    let n = 0
    for (const job of jobs) {
      let row
      try { row = await runStateRow(session, origin, job) } catch (e1) {
        console.error(`재시도(도구 예외): ${job.id} — ${e1.message}`)
        await session.close().catch(() => {})
        session = await openSession()
        row = await runStateRow(session, origin, job)
      }
      rows.push(row)
      console.log(`[${++n}/${jobs.length}] ${line(row)}`)
      if (n % 80 === 0) { await session.close(); session = await openSession() }
    }
    const s = summarizeStates(rows)
    writeFileSync(file, JSON.stringify({ origin, ...s, rowsDetail: rows }, null, 2) + '\n')
    console.log(`7상태 감사: 행 ${s.rows}개 중 실패 ${s.failed} · na 있는 행 ${s.na} · 종류별 ${Object.entries(s.byType).map(([t, x]) => `${t} ${x.rows}/${x.fail}`).join(' · ')}`)
    const unreachable = [...new Map(rows.filter((r) => r.checks.state.unreachable).map((r) => [r.block, r.checks.state.unreachable])).entries()]
    for (const [b, why] of unreachable) console.log(`NA(못 모는 블록 — 통과 아님) ${b}: ${why}`)
    return s.ok ? 0 : 1
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    rmSync(file, { force: true })
    return 1
  } finally {
    await session?.close().catch(() => {})
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await main(process.argv.slice(2)))
