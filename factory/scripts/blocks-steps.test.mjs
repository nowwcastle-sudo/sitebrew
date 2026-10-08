// 여러 단계 폼 묶음(P3-2 Task 7a — 대장 A49·A63·A102): 저장 안 한 변경 경고(_shared/leave-guard) · 답 확인 조각과 예약 폼의 4번째 「확인」 단계(_shared/review-summary) ·
// 단계 뒤로 가기(_shared/step-history). 브라우저가 필요한 동작(진짜 뒤로 가기·beforeunload 창)은 .tmp/t7f/check.mjs 로 갤러리에서 잰다(보고서).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/blocks-steps.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-steps-test')
const BLOCKS = join(root, 'registry', 'factory', 'blocks')
const loaded = new Map()
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const load = (rel) => import(pathToFileURL(transpile(join(root, rel))).href)
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement
const src = (rel) => readFileSync(join(BLOCKS, rel), 'utf8')

// ① 저장 안 한 변경 경고 ──────────────────────────────────────────────────────
test('leave-guard(A49): 켜져 있는 동안 beforeunload 를 막고, 떼면 그친다 — 블록 안 링크를 누른 직후 1.5초는 통과한다', async () => {
  const { attachLeaveGuard } = await load('registry/factory/blocks/_shared/leave-guard.tsx')
  const win = new EventTarget()
  const scope = new EventTarget()
  let t = 1000
  const detach = attachLeaveGuard(win, scope, () => t)
  const unload = () => { const e = new Event('beforeunload', { cancelable: true }); win.dispatchEvent(e); return e.defaultPrevented }
  assert.equal(unload(), true, '입력이 남은 채 떠나려 하면 브라우저 확인 창을 띄운다')
  // 블록 안 링크(건너뛰기 등)를 누르면 의도한 나가기 — 통과
  const click = (target) => { const e = new Event('click'); Object.defineProperty(e, 'target', { value: target }); scope.dispatchEvent(e) }
  click({ closest: (s) => (s === 'a[href]' ? {} : null) })
  t += 500
  assert.equal(unload(), false, '링크를 누른 직후에는 경고하지 않는다')
  t += 2000
  assert.equal(unload(), true, '1.5초가 지나면 다시 막는다')
  // 링크가 아닌 곳(버튼·칸) 클릭은 통과시키지 않는다
  click({ closest: () => null })
  assert.equal(unload(), true)
  detach()
  assert.equal(unload(), false, '떼면 더는 막지 않는다')
})

test('원천 규칙(A49): 입력을 여러 단계로 받는 블록(stepped-booking·setup-wizard)이 useLeaveGuard 를 쓴다 — 보낸 뒤(done)에는 켜지 않는다', () => {
  const booking = src('contact-form/stepped-booking.tsx')
  assert.match(booking, /useLeaveGuard\(dirty && flow\.phase !== "done", ref\)/)
  assert.match(src('onboarding/setup-wizard.tsx'), /useLeaveGuard\(answer !== null, ref\)/)
})

// ② 단계 뒤로 가기 ────────────────────────────────────────────────────────────
test('step-history(A102): history.state 의 단계는 이 폼(id)의 것만 읽고, 처음 항목·다른 폼·엉뚱한 값은 initial 로 돌아간다', async () => {
  const { stepState, stepFromState } = await load('registry/factory/blocks/_shared/step-history.tsx')
  assert.deepEqual(stepState('booking', 2), { wfStep: 'booking', step: 2 })
  assert.equal(stepFromState(stepState('booking', 2), 'booking', 0), 2)
  assert.equal(stepFromState(null, 'booking', 0), 0, '처음 항목(state 없음)은 첫 단계')
  assert.equal(stepFromState(stepState('other', 3), 'booking', 0), 0, '다른 폼의 항목은 무시')
  assert.equal(stepFromState({ wfStep: 'booking', step: '2' }, 'booking', 1), 1, '숫자가 아니면 initial')
})

test('원천 규칙(A102): 단계 폼은 단계를 useStepHistory 로 관리한다(useState 로 따로 두지 않는다) — stepped-booking·setup-wizard', () => {
  for (const f of ['contact-form/stepped-booking.tsx', 'onboarding/setup-wizard.tsx']) {
    const s = src(f)
    assert.match(s, /useStepHistory</, f)
    assert.doesNotMatch(s, /const \[step, setStep\]/, `${f}: 단계를 useState 로 따로 두면 뒤로 가기가 폼을 떠난다`)
  }
})

// ③ 답 확인 조각 ─────────────────────────────────────────────────────────────
test('ReviewSummary(A63): dl 로 항목 · 값을 보이고, 항목마다 「고치기」(접근 이름은 「<항목> 고치기」), 빈 값은 empty 글, onEdit 이 없으면 버튼도 없다', async () => {
  const { ReviewSummary } = await load('registry/factory/blocks/_shared/review-summary.tsx')
  const rows = [
    { key: 'date', label: '날짜', value: '10월 1일 (목)', numeric: true, onEdit: () => {} },
    { key: 'request', label: '요청', value: '', onEdit: () => {} },
    { key: 'fixed', label: '고정', value: '값' },
  ]
  const html = renderToStaticMarkup(h(ReviewSummary, { rows, copy: { editLabel: '고치기', empty: '적지 않았어요' } }))
  assert.match(html, /<dl data-review=""/)
  assert.equal((html.match(/<dt\b/g) ?? []).length, 3)
  assert.match(html, /<button\b[^>]*aria-label="날짜 고치기"[^>]*>고치기<\/button>/)
  assert.match(html, /aria-label="요청 고치기"/)
  assert.doesNotMatch(html, /aria-label="고정 고치기"/)
  assert.match(html, /<dd data-numeric="" class="[^"]*">10월 1일 \(목\)<\/dd>/)
  assert.match(html, />적지 않았어요<\/dd>/)
  assert.equal((html.match(/<button\b/g) ?? []).length, 2)
})

test('ContactFormSteppedBooking(A63): 단계 줄이 네 개(날짜·시간·정보·확인)이고, 확인 단계는 다섯 항목 각각 고치기를 준다 — 요청 버튼은 확인 단계에서만', async () => {
  const { ContactFormSteppedBooking } = await load('registry/factory/blocks/contact-form/stepped-booking.tsx')
  const { fixture } = await load('registry/factory/blocks/contact-form/stepped-booking.fixture.ts')
  const html = renderToStaticMarkup(h(ContactFormSteppedBooking, fixture))
  assert.equal((html.match(/class="[^"]*cn-block-booking-step\b[^"]*"/g) ?? []).length + (html.match(/<li\b[^>]*aria-current/g) ?? []).length > 0, true)
  assert.deepEqual([...html.matchAll(/<span class="[^"]*">(날짜|시간|정보|확인)<\/span>/g)].map((m) => m[1]).slice(0, 4), ['날짜', '시간', '정보', '확인'])
  assert.match(html, /<li aria-current="step"[^>]*>[\s\S]*?날짜/, '첫 단계가 현재 단계')
  const review = html.match(/<div hidden=""[^>]*cn-block-booking-review[\s\S]*?<\/dl>/)?.[0] ?? ''
  assert.ok(review, '확인 패널이 있고 처음에는 숨어 있다')
  for (const label of ['날짜', '시간', '이름', '연락처', '요청 사항\\(선택\\)']) assert.match(review, new RegExp(`aria-label="${label} 고치기"`), label)
  assert.match(review, /이대로 요청할까요\?/)
  // 요청 버튼(submit)은 마지막(확인) 단계에서만 그려진다 — 첫 단계 화면에는 「다음」 뿐
  assert.doesNotMatch(html, /<button[^>]*type="submit"/)
  assert.match(html, /<button[^>]*>다음/)
})

test('원천 규칙(A63·A42): 정보 단계 Enter 는 「다음」이고 한글 조합 중 Enter 는 넘긴다(isComposingEnter) — 확인 화면의 고치기는 돌아올 때 확인 화면으로', () => {
  const s = src('contact-form/stepped-booking.tsx')
  assert.match(s, /e\.key === "Enter" && !isComposingEnter\(e\)/)
  assert.match(s, /go\(backToReview \? 3 : step \+ 1\)/)
  assert.match(s, /setBackToReview\(true\)/)
})

// ④ 인앱 브라우저 탈출(대장 A61) ────────────────────────────────────────────────
test('inapp-escape(A61): UA 로 카카오톡·네이버·인스타그램·페이스북·라인 앱 안 브라우저만 가려내고, 카카오톡 열기 주소는 iOS 스킴·안드로이드 intent 로 만든다', async () => {
  const { detectInApp, kakaoOpenHref } = await load('registry/factory/blocks/_shared/inapp-escape.tsx')
  const UA = {
    kakao: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 10.4.0',
    naver: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 NAVER(inapp; search; 1000; 12.0)',
    instagram: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0',
    facebook: 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]',
    line: 'Mozilla/5.0 (iPhone) Mobile/15E148 Safari Line/13.0.0',
  }
  for (const [k, ua] of Object.entries(UA)) assert.equal(detectInApp(ua), k, k)
  // 양성 대조가 아닌 것: 일반 사파리·크롬·삼성 인터넷
  for (const ua of ['Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36', 'Mozilla/5.0 (Linux; Android 14) SamsungBrowser/23.0 Chrome/115 Mobile Safari/537.36']) assert.equal(detectInApp(ua), null, ua)
  const url = 'https://example.com/login?next=/a b'
  assert.equal(kakaoOpenHref(url, UA.kakao), `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`)
  const android = kakaoOpenHref('https://example.com/login', 'Mozilla/5.0 (Linux; Android 14) KAKAOTALK 10.4.0')
  assert.match(android, /^intent:\/\/example\.com\/login#Intent;scheme=https;S\.browser_fallback_url=https%3A%2F%2Fexample\.com%2Flogin;end$/)
})

test('InAppEscape(A61): 서버 렌더에는 아무것도 그리지 않는다(일반 브라우저에는 어디에도 안 보인다) — 로그인·가입·업그레이드·결제 블록이 안내 글을 copy 로 받는다', async () => {
  const { InAppEscape } = await load('registry/factory/blocks/_shared/inapp-escape.tsx')
  const copy = { title: 't', guide: 'g', open: 'o', copy: { copy: 'c', copied: 'd', manual: 'm' } }
  assert.equal(renderToStaticMarkup(h(InAppEscape, { copy })), '')
  for (const f of ['auth/sign-in', 'auth/sign-up-consents', 'paywall/upgrade-modal', 'trust/payment-trust-panel']) {
    assert.match(src(`${f}.tsx`), /<InAppEscape copy=\{copy\.inApp\}/, f)
    assert.match(src(`${f}.fixture.ts`), /inApp: \{/, f)
  }
  // 로그인·가입은 구글 로그인이 있을 때만(구글이 앱 안 브라우저에서 막힌다)
  for (const f of ['auth/sign-in', 'auth/sign-up-consents']) assert.match(src(`${f}.tsx`), /ready\?\.includes\("google"\) && copy\.inApp/, f)
})

// ⑤ 캘린더에 넣기(대장 A65) ────────────────────────────────────────────────────
test('calendar-links(A65): .ics 는 RFC 5545 줄(CRLF·75옥텟 접기·TEXT 이스케이프)로, Google 링크는 UTC 순간 + ctz 로 만든다', async () => {
  const { icsFile, googleCalendarHref, icsHref, utcStamp, fold } = await load('registry/factory/blocks/_shared/calendar-links.tsx')
  const ev = { uid: 'Q-1003-0042', title: '예약, 밀가루공방; 본점', start: '2026-10-03T05:00:00.000Z', minutes: 90, location: '서울 예시구 1길 2', description: '줄1\n줄2' }
  assert.equal(utcStamp('2026-10-03T14:00:00+09:00'), '20261003T050000Z', '서울 시각도 같은 UTC 순간')
  const ics = icsFile(ev, () => new Date('2026-09-30T00:00:00Z'))
  assert.ok(ics.endsWith('\r\n'))
  const lines = ics.replace(/\r\n /g, '').split('\r\n')
  assert.deepEqual(lines.slice(0, 3), ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//web-factory//booking//KO'])
  assert.ok(lines.includes('DTSTART:20261003T050000Z'))
  assert.ok(lines.includes('DTEND:20261003T063000Z'), '90분 뒤')
  assert.ok(lines.includes('DTSTAMP:20260930T000000Z'))
  assert.ok(lines.includes('SUMMARY:예약\\, 밀가루공방\\; 본점'), '쉼표·세미콜론 이스케이프')
  assert.ok(lines.includes('DESCRIPTION:줄1\\n줄2'), '줄바꿈은 \\n')
  assert.ok(lines.includes('UID:Q-1003-0042@web-factory'))
  assert.equal(lines.at(-2), 'END:VCALENDAR')
  // 접기: 어느 줄도 75옥텟을 넘지 않고, 한글 글자를 가르지 않으며, 펴면 원문 그대로
  const long = 'DESCRIPTION:' + '한글설명'.repeat(30)
  const folded = fold(long)
  for (const l of folded.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, l)
  assert.equal(folded.replace(/\r\n /g, ''), long)
  const url = new URL(googleCalendarHref(ev))
  assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render')
  assert.equal(url.searchParams.get('action'), 'TEMPLATE')
  assert.equal(url.searchParams.get('dates'), '20261003T050000Z/20261003T063000Z')
  assert.equal(url.searchParams.get('ctz'), 'Asia/Seoul')
  assert.equal(url.searchParams.get('stz'), 'Asia/Seoul', 'Google 공식 문서의 시작·끝 시간대 칸')
  assert.equal(url.searchParams.get('text'), ev.title)
  assert.match(icsHref(ev), /^data:text\/calendar;charset=utf-8,BEGIN%3AVCALENDAR/)
})

test('ConfirmationBookingComplete(A65): 확정된 예약(booking.confirmed)에만 .ics·Google 캘린더 버튼이 나온다 — 요청만 한 예약에는 없다', async () => {
  const { ConfirmationBookingComplete } = await load('registry/factory/blocks/confirmation/booking-complete.tsx')
  const { fixture, fixtureMax } = await load('registry/factory/blocks/confirmation/booking-complete.fixture.ts')
  const req = renderToStaticMarkup(h(ConfirmationBookingComplete, fixture))
  assert.doesNotMatch(req, /data-calendar/, '요청형 예약(확정 전)은 시각이 확정이 아니라 캘린더 버튼을 숨긴다')
  const ok = renderToStaticMarkup(h(ConfirmationBookingComplete, fixtureMax))
  assert.match(ok, /data-calendar=""/)
  assert.match(ok, /<a [^>]*href="data:text\/calendar[^"]*"[^>]*download="booking\.ics"/)
  assert.match(ok, /<a [^>]*href="https:\/\/calendar\.google\.com\/calendar\/render\?[^"]*"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/)
  // copy 가 없으면 confirmed 여도 없다
  assert.doesNotMatch(renderToStaticMarkup(h(ConfirmationBookingComplete, { ...fixtureMax, copy: { ...fixtureMax.copy, calendar: undefined } })), /data-calendar/)
})

// ⑥ 현지 통화·세금 가격(대장 A66) ─────────────────────────────────────────────────
test('요금 세 변형(A66): prices 를 주면 첫 HTML 에 현지 통화 금액과 세금 표기가 실리고(서버 렌더), 안 주면 콘텐츠 값 그대로다', async () => {
  const kinds = [
    ['PricingThreeTierCards', 'three-tier-cards'],
    ['PricingFeatureMatrix', 'feature-matrix'],
    ['PricingToggleAnnual', 'toggle-annual'],
  ]
  const { planPrice, planVatText } = await load('registry/factory/blocks/_shared/price-tag.tsx')
  // 순수 함수: 소수 통화는 최소 단위(센트)를 화면 단위로, KRW 는 그대로, 없는 요금제는 콘텐츠 값
  assert.deepEqual(planPrice({ name: 'A', monthlyPrice: 12900, currency: 'KRW' }, { A: { amount: 1900, currency: 'USD', vatIncluded: false } }), { amount: 19, currency: 'USD', vatIncluded: false })
  assert.deepEqual(planPrice({ name: 'A', monthlyPrice: 12900, currency: 'KRW' }, { B: { amount: 1, currency: 'USD', vatIncluded: true } }), { amount: 12900, currency: 'KRW' })
  assert.deepEqual(planPrice({ name: 'A', monthlyPrice: 12900, currency: 'KRW' }, { A: { amount: 9900, currency: 'KRW', vatIncluded: true } }), { amount: 9900, currency: 'KRW', vatIncluded: true })
  assert.equal(planVatText({ vatIncluded: true }, { included: 'VAT incl.', excluded: 'VAT excl.' }), 'VAT incl.')
  assert.equal(planVatText({}, { included: 'a', excluded: 'b' }), null, '현지 가격이 없으면 세금 문구도 없다')
  for (const [C, dir] of kinds) {
    const Comp = (await load(`registry/factory/blocks/pricing/${dir}.tsx`))[C]
    const { fixture } = await load(`registry/factory/blocks/pricing/${dir}.fixture.ts`)
    const first = fixture.copy.plans.find((p) => p.monthlyPrice !== null)
    const plain = renderToStaticMarkup(h(Comp, fixture))
    assert.doesNotMatch(plain, /data-vat=""/, `${C}: prices 가 없으면 세금 문구를 새로 만들지 않는다`)
    const shown = first.monthlyPrice.toLocaleString('ko-KR')
    assert.ok(plain.includes(shown), `${C}: 콘텐츠 값 ${shown} 그대로`)
    const html = renderToStaticMarkup(h(Comp, { ...fixture, prices: { [first.name]: { amount: 1900, currency: 'USD', vatIncluded: false } } }))
    assert.match(html, /US\$19\.00|\$19\.00/, `${C}: 현지 통화 금액이 첫 HTML 에 있다`)
    assert.match(html, /data-vat="" class="[^"]*">부가세 별도<\/span>/, `${C}: 세금 표기`)
  }
})

// ⑦ 인쇄(대장 A104) ───────────────────────────────────────────────────────────
// factory-base 의 @media print 블록 글을 꺼낸다(중괄호 짝) — 시험이 규칙을 읽는다
const printCss = (css) => {
  const at = css.indexOf('@media print')
  if (at < 0) return ''
  let depth = 0
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1)
  }
  return ''
}
const printProblems = (css) => {
  const p = printCss(css)
  const out = []
  if (!p) return ['@media print 절이 없다']
  for (const sel of ['site-shell-header', 'site-shell-footer', 'site-shell-banner', 'bottom-tab-', 'announcement-', 'consent-bottom-banner', 'data-print="hide"']) if (!p.includes(sel)) out.push(`인쇄에서 숨길 ${sel} 이 없다`)
  if (!/display:\s*none\s*!important/.test(p)) out.push('숨김이 display:none 이 아니다')
  if (!/color:\s*#000/.test(p)) out.push('글자를 검정으로 만들지 않는다')
  if (!/site-shell-policy"\] a\[href\]::after[^}]*attr\(href\)/.test(p)) out.push('법정 페이지 링크 주소를 글자로 적지 않는다')
  return out
}
test('인쇄 스타일(A104): factory-base 의 @media print 가 셸·배너·고정 바·쿠키 띠·플로팅 버튼을 숨기고 글자를 검정으로 하며 정책 링크 주소를 적는다 — 확인 블록 셋이 인쇄 버튼을 갖는다', () => {
  const css = readFileSync(join(root, 'registry', 'factory', 'base', 'factory-base.css'), 'utf8')
  assert.deepEqual(printProblems(css), [])
  // 음성 대조: 절을 지우면, 숨길 것 하나를 빼면 잡힌다
  assert.deepEqual(printProblems(css.replace('@media print', '@media screen')), ['@media print 절이 없다'])
  assert.ok(printProblems(css.replace('[data-block^="bottom-tab-"], ', '')).length >= 1)
  assert.ok(printProblems(css.replace('color: #000 !important', 'color: inherit')).length >= 1)
  for (const f of ['confirmation/order-complete', 'confirmation/booking-complete', 'confirmation/signup-complete']) {
    assert.match(src(`${f}.tsx`), /<PrintButton label=\{copy\.print\}/, f)
    assert.match(src(`${f}.fixture.ts`), /print: "인쇄·PDF로 저장"/, f)
  }
})

test('PrintButton(A104): 버튼은 인쇄물에 나오지 않는다(data-print="hide")', async () => {
  const { PrintButton } = await load('registry/factory/blocks/_shared/print-button.tsx')
  const html = renderToStaticMarkup(h(PrintButton, { label: '인쇄·PDF로 저장' }))
  assert.match(html, /<button\b[^>]*data-print="hide"[^>]*>인쇄·PDF로 저장<\/button>/)
})

// ⑧ 체험 켬/끔(대장 A6, 마케팅 규칙 P13) ───────────────────────────────────────────
// 대화상자 안쪽은 서버 렌더에 없다(포털) — 소스 규칙으로 잠그고, 켜고 끄는 동작은 갤러리(브라우저)에서 잰다(보고서).
test('PaywallUpgradeModal(A6): 체험 전환은 체험 기간이 있는 요금제에만·켠 채로 시작하고, 끄면 checkout({ trial: false })·제안 판에서 체험 줄이 빠진다', async () => {
  const s = src('paywall/upgrade-modal.tsx')
  assert.match(s, /const \[trialOn, setTrialOn\] = React\.useState\(true\)/, '체험이 기본')
  assert.match(s, /plan\.trialDays && copy\.trialChoice \? \(\s*<div data-trial-choice=""/, '체험 기간이 있고 문구가 있을 때만')
  assert.match(s, /<Switch id=\{`\$\{id\}-trial`\} checked=\{trialOn\} onCheckedChange=\{setTrialOn\}/)
  assert.match(s, /const skipTrial = !!plan\.trialDays && !trialOn/)
  assert.match(s, /\.\.\.\(skipTrial \? \{ trial: false \} : \{\}\)/)
  assert.match(s, /plan && plan\.trialDays && !trialOn \? \{ \.\.\.plan, trialDays: undefined \} : plan/, '끄면 제안 판은 체험 없는 요금제로')
  assert.match(s, /!skipTrial\) track\?\.\("trial_start"/, '체험을 건너뛰면 trial_start 를 세지 않는다')
  const { fixture } = await load('registry/factory/blocks/paywall/upgrade-modal.fixture.ts')
  assert.match(fixture.copy.trialChoice.hint, /체험 없이/)
})

// ⑨ 하단 고정 요소(대장 A107, WCAG 2.4.11): 화면 아래에 붙는 블록은 모두 scroll-padding-bottom 을 준다
test('하단 고정 블록(bottom-tab 셋·쿠키 아래 띠)은 useBottomBarSpace 로 scroll-padding-bottom 을 준다 — 새 고정 블록이 빠뜨리면 잡힌다', () => {
  const fixedBlocks = ['bottom-tab/icon-tabs', 'bottom-tab/split-booking-bar', 'bottom-tab/sticky-action-bar', 'consent/bottom-banner']
  for (const f of fixedBlocks) assert.match(src(`${f}.tsx`), /useBottomBarSpace\(/, f)
  // 떠 있는 행동·창·토스트(FV1 Task 5.8)는 _shared/floating-kit 의 useFloatingSpace 로 같은 일을 한다(--bottom-bar-height 를 덮지 않게 따로 둔 조각)
  const floatingBlocks = ['floating-action/quick-menu-rail', 'floating-action/chat-launcher', 'floating-action/call-bar', 'announcement/popup-today', 'announcement/update-toast']
  for (const f of floatingBlocks) assert.match(src(`${f}.tsx`), /useFloatingSpace\(/, f)
  // 화면 아래에 고정하는 훅(fixed + bottom-…)을 쓰는 블록 원천은 위 목록 안에 있어야 한다
  const css = readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8')
  const fixedHooks = [...css.matchAll(/\.(cn-block-[a-z0-9-]+)\s*\{[^}]*\bfixed\b[^}]*\bbottom-[^}]*\}/g)].map((m) => m[1])
  assert.ok(fixedHooks.length >= 1, '아래 고정 훅을 못 찾았다')
  const all = ['bottom-tab', 'consent', 'announcement', 'nav', 'final-cta', 'footer', 'floating-action'].flatMap((k) => readdirSync(join(BLOCKS, k)).filter((n) => n.endsWith('.tsx')).map((n) => `${k}/${n.replace(/\.tsx$/, '')}`))
  for (const f of all) {
    const s = src(`${f}.tsx`)
    if (fixedHooks.some((h) => new RegExp(String.raw`(?<![\w-])${h}(?![\w-])`).test(s))) assert.ok(fixedBlocks.includes(f) || floatingBlocks.includes(f), `${f}: 화면 아래에 고정하는 훅을 쓰는데 useBottomBarSpace·useFloatingSpace 목록에 없다`)
  }
})

// ⑩ 요금 금액 정적 렌더(대장 A8 — 레인 B 우려 3: 「12,900원」 검사를 스크래치에서 커밋 시험으로)
test('요금 세 변형: 「12,900원」이 data-numeric 칸의 글자로 첫 HTML 에 있고, 연 결제 20% 는 10,320원/월 · 연 123,840원이다', async () => {
  for (const [C, dir] of [['PricingThreeTierCards', 'three-tier-cards'], ['PricingFeatureMatrix', 'feature-matrix'], ['PricingToggleAnnual', 'toggle-annual']]) {
    const Comp = (await load(`registry/factory/blocks/pricing/${dir}.tsx`))[C]
    const { fixture } = await load(`registry/factory/blocks/pricing/${dir}.fixture.ts`)
    const html = renderToStaticMarkup(h(Comp, fixture))
    assert.match(html, /<span data-numeric="(?:true)?" class="[^"]*">12,900원<\/span>/, `${C}: 12,900원`)
  }
  const { PricingToggleAnnual } = await load('registry/factory/blocks/pricing/toggle-annual.tsx')
  const { fixture } = await load('registry/factory/blocks/pricing/toggle-annual.fixture.ts')
  const yearly = renderToStaticMarkup(h(PricingToggleAnnual, { ...fixture, defaultPeriod: 'annual' }))
  assert.match(yearly, /10,320원/, '연 결제 20% 할인의 월 환산')
  assert.match(yearly, /123,840원/, '연 결제 총액')
})
