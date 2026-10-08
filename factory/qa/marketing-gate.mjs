// 마케팅·운영 규칙 관문(P3-2 Task 12): node marketing-gate.mjs <url> [--out <dir>] [--width 1440] [--height 900] [--signup-url <url>] [--signup-steps N]
//                                   node marketing-gate.mjs --source [--root <저장소>] [--out <dir>]
// factory-rules.md §22(전환·유지·신뢰)의 MUST 중 기계로 잴 수 있는 것을 브라우저에서 잰다(블록 소스의 정적 검사는 blocks-rules*.test.mjs 가 이미 한다 —
// 여기는 실제로 그려진 화면과 URL 수준이다). 규칙 하나 = { id, 근거, 측정, 문턱 }(RULES). 판정은 순수 함수 judge(facts, opts)라서
// 브라우저 없이 시험한다. blocks:gates(Task 7)는 행마다 gateOnPage(session, url, opts)를 부르거나 CLI 를 띄운다.
//   범위: 문서 전체에서 검수대 띠(`[data-sticky-nav]`)를 뺀다. 갤러리 `/qa/blocks?b=…&r=…&frame=1` 와 일반 페이지를 같은 식으로 잰다.
//   판정 종류: fail(MUST 어김 — 종료 1) · warn(SHOULD 어김 — 결과에만) · pass · na(잴 것이 없다 — measured 0 이라 통과가 아니라 「측정 없음」으로 남는다).
//   --source: URL 없이 블록 소스만 본다(카운트다운이 endsAt prop 에 묶이는지, 가짜 카운터 Math.random 이 없는지).
// 종료: 0 = 쟀고 MUST 어김 없음 · 1 = 어김 있음(결과 파일 있음) 또는 도구 실패(`도구 실패:` 를 적고 결과 파일을 남기지 않는다) · 2 = 인자 오류. (docs/agents/agent-guide.md 관문 표 규칙)
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, navigateAndWait, connect } from './cdp.mjs'
import { ENTERED_WAIT } from './hit-area.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')

// ── 문턱(한 곳) ────────────────────────────────────────────────────────────────────────────────────
export const THRESHOLDS = {
  // 거절·주 버튼 짝: 가로·세로·글자 크기의 작은 쪽/큰 쪽 비율이 이 이상이어야 한다(공정위 「선택지 크기·색 차이로 특정 선택 유도」 기준을 수치로 옮긴 값 — 확인 안 됨: 법정 수치는 없다).
  sizeRatioMin: 0.85,
  // 짝의 바탕 채움 대비(버튼 바탕 ↔ 둘레 바탕) 차이 · 글자 대비 차이 상한. 한쪽만 색으로 채우고 한쪽은 글자뿐이면 채움 대비 차이가 3 이상 난다.
  fillDeltaMax: 1.5,
  labelDeltaMax: 3,
  // 첫 화면 가림: 눌린 자리에서 fixed 조상이 화면 넓이의 이 비율 이상이면 가림 모달로 본다.
  modalCoverMin: 0.35,
  // 보증 기간 바닥: 전자상거래법 제17조 청약철회 7일(보증이 그보다 짧으면 법정 기간과 충돌한다).
  guaranteeDaysMin: 7,
  // 가입·해지 클릭 수: 해지 ≤ 가입(factory-rules.md §22-1 L4·L5).
  onboardingStepsWarn: 4,
  // 카운트다운 시각이 되돌아가는 것을 재는 표본 간격.
  tickGapMs: 1300,
}

// ── 규칙표 ─────────────────────────────────────────────────────────────────────────────────────────
// level: must(어기면 종료 1) · should(경고만). src: DESIGN.md 절·ID(그 밑 1차 출처는 보고서 「공식 문서 근거」).
export const RULES = [
  { id: 'cta-element', level: 'must', src: 'factory-rules.md §22-7 X1', what: 'CTA 는 <a href>·<button> — div/span[onclick]·역할만 붙인 가짜 버튼 0', how: '[onclick] 가 a[href]·button·input 이 아닌 곳, [role=button|link] 가 button·a[href] 가 아닌 곳을 센다(눌리지 않는 현재 쪽 표식 [role=link][aria-current=page][aria-disabled=true] 는 뺀다)' },
  { id: 'cta-name', level: 'must', src: 'factory-rules.md §22-6 A1·§22-7 X1', what: '누를 수 있는 것마다 접근 이름이 있고 「확인·제출·더보기」 같은 빈 문구가 아니다', how: 'aria-labelledby → aria-label → 글자·img alt·title 순으로 이름을 얻어 비었거나 금지어면 실패' },
  { id: 'price-text', level: 'must', src: 'factory-rules.md §22-2 P3·§22-7 X2', what: '가격은 텍스트 — 가격 칸에 숫자 글자가 있고, 이미지 alt 에만 있는 가격이 없다', how: '[data-price] 글자에 숫자(또는 무료·문의)가 있는지, img alt 의 가격이 화면 글자에도 있는지' },
  { id: 'pricing-table', level: 'must', src: 'factory-rules.md §22-2 P3', what: '가격이 든 표는 <table> 이고 모든 <th> 에 scope 가 있다', how: '가격이 든 [role=table|grid] 가 <table> 이 아니거나 th 에 scope 가 없으면 실패' },
  { id: 'price-notation', level: 'must', src: 'factory-rules.md §22-1 L1·§22-2 P3', what: '원화 가격이 있으면 「VAT 포함/별도」 표기가 화면에 있다', how: '가격 글자(원·₩ — 운영자 대시보드·상태 화면·data-money=metric 은 제외)가 있는데 VAT·부가세 글자가 없으면 실패' },
  { id: 'total-first-screen', level: 'must', src: 'factory-rules.md §22-1 L1 · 전자상거래법 시행령 다크패턴(§21-2①1)', what: '첫 가격 화면에 필수 총액(VAT·배송비·수수료)을 보인다 — 추가 비용 문구가 그 화면 밖에서 처음 나오면 실패', how: '첫 가격(적립금·포인트 같은 보상 금액과 운영자 대시보드·상태 화면·data-money=metric 은 제외)이 든 구역(section·form·dialog, 두 화면보다 크면 ±한 화면)에 총액·VAT 문구가 있는지, 추가 비용 문구가 그 구역 밖에만 있는지' },
  { id: 'billed-largest', level: 'must', src: 'factory-rules.md §22-2 P1 · Apple 앱 심사 지침 3.1.2', what: '실제 청구액이 가장 크다 — 월 환산가·절감률은 보조 크기', how: '[data-price=billed] 의 글자 크기가 [data-price=equivalent] 의 어느 것보다 작지 않다(billed·equivalent 가 함께 있을 때만 잰다)' },
  { id: 'optin-unchecked', level: 'must', src: 'factory-rules.md §22-1 L2·L12', what: '선택 동의·추가 상품 체크박스는 처음에 해제', how: '[data-consent=optional]·[data-addon]·마케팅/선택 라벨 체크박스·스위치의 checked 를 로드 직후 읽는다' },
  { id: 'decline-parity', level: 'must', src: 'factory-rules.md §22-1 L3', what: '거절·해지 버튼과 주 버튼의 크기·채움 대비 차이가 문턱 이하', how: '[data-choice=decline|primary] 짝(없으면 대화상자 안 거절 문구 버튼과 가장 큰 버튼)의 가로·세로·글자 비 ≥ 0.85, 채움 대비 차 ≤ 1.5, 글자 대비 차 ≤ 3' },
  { id: 'cancel-steps', level: 'must', src: 'factory-rules.md §22-1 L4·L5', what: '해지 단계·클릭 수 ≤ 가입 단계·클릭 수, 모든 단계에 해지 버튼', how: 'data-flow=cancel 의 data-steps ≤ 가입 data-steps(같은 쪽·--signup-steps·--signup-url), 실제로 거절 버튼만 눌러 끝까지 가며 클릭 수를 센다' },
  { id: 'countdown-real', level: 'must', src: 'factory-rules.md §22-1 L8', what: '카운트다운은 실제 endsAt 에 묶인다 — 되돌아가는 타이머·표지 없는 남은 시간·재고 문구 금지', how: '[data-countdown] 의 data-ends-at 이 ISO 이고 다시 불러도 같은지, 표지 없는 「HH:MM:SS·N일 남음·N개 남음·N명이 보는 중」 글자, 표시가 시간이 갈수록 늘지 않는지' },
  { id: 'first-screen-modal', level: 'must', src: 'factory-rules.md §22-6 A5·A6', what: '첫 화면을 가리는 모달 0', how: '로드 직후 dialog:modal·aria-modal=true·화면 35% 이상을 덮는 fixed 조상(눌린 자리 5점)' },
  { id: 'jsonld-visible', level: 'must', src: 'factory-rules.md §22-7 X4', what: 'JSON-LD 가격·평점·개수 값이 화면 글자에 있다', how: 'price·lowPrice·highPrice·ratingValue·reviewCount·ratingCount 값을 화면 innerText 에서 찾는다(1,284 / 1284 모두 인정)' },
  { id: 'no-self-rating', level: 'must', src: 'factory-rules.md §22-7 X4', what: '별점 마크업은 Product 계열에만 — 조직·지역업체(자체 후기)에는 0', how: 'JSON-LD aggregateRating·review 의 주인 @type 과 microdata itemtype 을 본다' },
  { id: 'guarantee-days', level: 'must', src: 'factory-rules.md §22-5 T3 · 전자상거래법 제17조', what: '보증 표지의 기간은 청약철회 법정 7일 이상이고 화면에 그 숫자가 있다', how: '[data-guarantee-days] 가 정수 ≥ 7 이고 화면 글자에 같은 숫자' },
  { id: 'escrow-notice', level: 'must', src: 'factory-rules.md §22-1 L10 · 전자상거래법 제24조', what: '에스크로 표지가 보이고 「에스크로·결제대금예치」 글자가 있다', how: '[data-escrow] 가 보이고 글자에 에스크로|결제대금예치' },
  { id: 'seller-reply-style', level: 'must', src: 'factory-rules.md §22-5 T5', what: '판매자 답변은 모양이 후기 본문과 다르다', how: '[data-seller-reply] 의 바탕색·왼쪽 굵은 선·들여쓰기·기울임 중 하나가 부모와 다르고, 「판매자·사장님·운영자」 글자가 있다' },
  { id: 'rating-no-default', level: 'must', src: 'factory-rules.md §22-5 T9', what: '별점 입력은 기본값이 없다(미리 채운 5점 금지)', how: '[data-rating-ask] 안 라디오·role=radio·select 의 선택 상태를 로드 직후 읽는다' },
  { id: 'next-action-one', level: 'must', src: 'factory-rules.md §22-6 A10', what: '완료 화면의 다음 행동은 하나', how: '[data-next-action] 가 화면에 정확히 하나(있다면)' },
  { id: 'flow-markers', level: 'should', src: 'factory-rules.md §22-3 O6·O8', what: '흐름 표지가 앞뒤가 맞다(step ≤ steps) · 온보딩 투어는 4단계 이하', how: '[data-flow] 의 data-steps 정수·data-step 1..steps · onboarding steps ≤ 4 는 경고' },
  { id: 'guarantee-near-cta', level: 'should', src: 'factory-rules.md §22-5 T3', what: '보증 한 줄은 구매 CTA 와 같은 구역에', how: '[data-guarantee] 와 같은 구역(section)에 a[href]·button CTA 가 있다' },
]
const RULE = Object.fromEntries(RULES.map((r) => [r.id, r]))

// ── 브라우저 쪽: 사실 모으기 ─────────────────────────────────────────────────────────────────────────
// 페이지 안에서 도는 함수(문자열로 보낸다 — 바깥 값은 못 쓴다). 판정은 하지 않고 사실만 돌려준다.
export function pageFacts(cfg) {
  const T = cfg
  const NAV = '[data-sticky-nav]'
  const inScope = (el) => !el.closest(NAV)
  const visible = (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],[inert]') && el.getAttribute('aria-hidden') !== 'true'
  }
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim()
  const q = (sel) => [...document.querySelectorAll(sel)].filter(inScope)
  const PRICE_RE = /(?:[₩$€]\s?\d[\d,]*(?:\.\d+)?)|(?:\d[\d,]*(?:\.\d+)?\s?(?:원|₩|KRW|USD|달러|€))/
  const KRW_RE = /\d[\d,]*\s?원|₩\s?\d/
  const REWARD_RE = /적립|포인트|쿠폰|리워드|보상|캐시백/ // 보상 금액은 파는 값이 아니다(review-list 의 「적립금 1,000원」)
  // 파는 값이 아닌 금액(운영자 대시보드의 지표·상태 화면·`data-money=metric` 표지)은 가격 규칙(총액·VAT)과 소비자용 재고·남은 시간 규칙에서 뺀다.
  // 뺀 곳은 결과 요약에 남기지 않지만 규칙표의 「측정」 칸에 적혀 있다.
  const nonOffer = (el) => !!el.closest('[data-money=metric],[data-block^="dashboard-panel-"],[data-block^="state-screen-"]')
  // 추가 비용 문구(없다·무료·0원 부정은 뺀다)
  const extraRe = /(배송비|설치비|가입비|수수료|추가\s?(?:요금|비용|금액|과금)|별도\s?(?:부과|청구|과금|결제)|(?:부가세|VAT)\s?별도)(?!\s?(?:는|은|이|가)?\s?(?:없|무료|0\s?원))/gi
  const bodyText = () => {
    const parts = []
    // script·style 은 뺀다 — 본문 안의 script(Next RSC 페이로드·JSON-LD)는 innerText 가 글자를 돌려줘서 자기 자신을 화면 글자로 착각하게 한다(실제 갤러리에서 드러남).
    for (const c of document.body.children) if (!c.matches(`${NAV},script,style,noscript,template`)) parts.push(c.innerText ?? '')
    return parts.join('\n')
  }
  const text = bodyText()

  // 접근 이름
  const nameOf = (el) => {
    const lb = el.getAttribute('aria-labelledby')
    if (lb) { const t = lb.split(/\s+/).map((i) => norm(document.getElementById(i)?.textContent)).join(' ').trim(); if (t) return t }
    const al = norm(el.getAttribute('aria-label'))
    if (al) return al
    let t = ''
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) t += c.textContent
        else if (c.nodeType === 1) {
          if (c.getAttribute('aria-hidden') === 'true') continue
          if (c.tagName === 'IMG') t += ` ${c.getAttribute('alt') ?? ''} `
          else if (c.tagName === 'svg' || c.tagName === 'SVG') { const ti = c.querySelector('title'); if (ti) t += ` ${ti.textContent} ` }
          else walk(c)
        }
      }
    }
    walk(el)
    t = norm(t)
    return t || norm(el.getAttribute('title'))
  }

  // ── CTA ──
  const NATIVE = (el) => el.tagName === 'BUTTON' || (el.tagName === 'A' && el.hasAttribute('href')) || (el.tagName === 'INPUT' && /^(submit|button|reset|image)$/i.test(el.type))
  const fakeButtons = q('[onclick],[role=button],[role=link]').filter((el) => {
    if (el.matches('[onclick]') && !NATIVE(el)) return true
    if (el.matches('[role=button]') && !(el.tagName === 'BUTTON' || (el.tagName === 'A' && el.hasAttribute('href')) || el.tagName === 'INPUT')) return true
    // 눌리지 않는 현재 쪽 표식(shadcn BreadcrumbPage — span[role=link][aria-current=page][aria-disabled=true])은 CTA 가 아니다(C370). 둘 다 있어야 면제 — onclick 이 붙으면 위 첫 줄이 먼저 잡는다.
    if (el.matches('[role=link][aria-current=page][aria-disabled=true]')) return false
    if (el.matches('[role=link]') && !(el.tagName === 'A' && el.hasAttribute('href'))) return true
    return false
  }).map((el) => `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''}${el.matches('[onclick]') ? '[onclick]' : ''} ${norm(el.textContent).slice(0, 24)}`)
  const pressables = q('button,a[href],input[type=submit],input[type=button]').filter((el) => visible(el) && !el.matches(':disabled'))
  const names = pressables.map((el) => ({ tag: el.tagName.toLowerCase(), name: el.tagName === 'INPUT' ? norm(el.value) || nameOf(el) : nameOf(el), cta: el.matches('[data-slot=button],[data-primary-action],button[type=submit],input[type=submit],[data-next-action],[data-choice]') }))

  // ── 가격 ──
  const priceEls = q('[data-price]').filter(visible).map((el) => ({ kind: el.getAttribute('data-price'), text: norm(el.textContent) }))
  const imgPrices = q('img[alt]').filter((el) => PRICE_RE.test(el.getAttribute('alt') ?? '')).map((el) => ({ alt: norm(el.getAttribute('alt')), inText: text.includes(norm(el.getAttribute('alt')).match(PRICE_RE)?.[0] ?? '\u0000') }))
  const tableLike = q('table,[role=table],[role=grid]').filter(visible).filter((el) => PRICE_RE.test(el.textContent ?? ''))
  const priceTables = tableLike.map((el) => {
    const native = el.tagName === 'TABLE'
    const ths = native ? [...el.querySelectorAll('th')] : []
    return { native, th: ths.length, thNoScope: ths.filter((t) => !t.hasAttribute('scope')).length, label: norm(el.getAttribute('aria-label') || el.querySelector('caption')?.textContent || el.textContent).slice(0, 30) }
  })
  const sizeOf = (el) => parseFloat(getComputedStyle(el).fontSize)
  const priceSizes = { billed: q('[data-price=billed]').filter(visible).map(sizeOf), equivalent: q('[data-price=equivalent]').filter(visible).map(sizeOf) }
  let krw = false
  {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n && !krw; n = w.nextNode()) {
      const p = n.parentElement
      if (p && inScope(p) && !p.closest('script,style,noscript,template') && visible(p) && !nonOffer(p) && !REWARD_RE.test(n.textContent) && KRW_RE.test(n.textContent)) krw = true
    }
  }
  const vat = /VAT|부가세|부가가치세/i.test(text)

  // ── 첫 가격 구역 ──
  let firstPrice = null
  {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement
      if (!p || !inScope(p) || p.closest('script,style,noscript,template') || !visible(p) || nonOffer(p)) continue
      // 적립금·포인트·쿠폰 같은 보상 금액은 사는 값이 아니라서 「첫 가격」이 아니다(review-list 의 「적립금 1,000원」 오탐 — 실제 갤러리에서 드러남).
      if (PRICE_RE.test(n.textContent) && !REWARD_RE.test(n.textContent)) { firstPrice = p; break }
    }
  }
  let total = null
  if (firstPrice) {
    const reg = firstPrice.closest('section,[data-block],article,form,dialog,[role=dialog]') ?? firstPrice.closest('[data-qa-block],main') ?? document.body
    const vh = innerHeight
    const rr = reg.getBoundingClientRect()
    let regionText
    if (rr.height > vh * 2) {
      const top = firstPrice.getBoundingClientRect().top, parts = []
      const w = document.createTreeWalker(reg, NodeFilter.SHOW_TEXT)
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const p = n.parentElement
        if (!p || p.closest('script,style,noscript,template') || !visible(p)) continue
        const t = p.getBoundingClientRect().top
        if (t >= top - vh && t <= top + vh) parts.push(n.textContent)
      }
      regionText = parts.join(' ')
    } else regionText = reg.innerText ?? ''
    const totalRe = /(총\s?(?:액|결제\s?금액|금액|합계)|합계|결제\s?금액|(?:VAT|부가세|부가가치세)[^.。\n]{0,10}(?:포함|별도)|세금\s?포함|(?:VAT|tax)\s+(?:is\s+)?(?:included|incl\.?|excluded|extra)|(?:incl\w*|excl\w*)\.?\s+(?:VAT|tax)|\btotal\b)/i
    total = {
      regionExtra: [...new Set([...regionText.matchAll(extraRe)].map((m) => m[1]))],
      first: norm(firstPrice.textContent).slice(0, 40),
      hasMarker: !!reg.querySelector('[data-total],[data-price=billed]'),
      hasStatement: totalRe.test(regionText),
    }
  }
  const extra = []
  for (const m of text.matchAll(extraRe)) extra.push({ phrase: m[1], at: m.index })

  // ── 선택 동의·추가 상품 ──
  const OPT_LABEL = /\(선택\)|\[선택\]|선택\s?동의|마케팅|광고성|이벤트\s?(?:안내|수신)|혜택\s?(?:안내|수신)|추가\s?(?:상품|구매)|함께\s?구매/
  const OPT_NAME = /marketing|optional|addon|add-on|upsell|newsletter|promo/i
  const checks = q('input[type=checkbox],[role=checkbox],[role=switch]').filter((el) => !el.matches('input[aria-hidden=true]'))
  const optIn = []
  for (const el of checks) {
    if (!visible(el) && !(el.closest('label') && visible(el.closest('label')))) continue
    if (el.getAttribute('data-consent') === 'required') continue
    const lab = el.closest('label')?.textContent ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : '') ?? ''
    const desc = el.getAttribute('aria-describedby') ? norm(document.getElementById(el.getAttribute('aria-describedby').split(' ')[0])?.textContent) : ''
    const optional = el.getAttribute('data-consent') === 'optional' || el.hasAttribute('data-addon') || !!el.closest('[data-consent=optional],[data-addon]') || OPT_NAME.test(`${el.getAttribute('name') ?? ''} ${el.id ?? ''}`) || OPT_LABEL.test(`${lab} ${el.getAttribute('aria-label') ?? ''}`) || false
    if (!optional) continue
    const on = el.tagName === 'INPUT' ? el.checked : el.getAttribute('aria-checked') === 'true' || el.hasAttribute('data-checked')
    optIn.push({ label: norm(lab || el.getAttribute('aria-label') || desc).slice(0, 30), checked: !!on })
  }

  // ── 거절·주 버튼 짝 ──
  const cvs = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const rgba = (c) => { cvs.clearRect(0, 0, 1, 1); cvs.fillStyle = '#000'; cvs.fillStyle = c; cvs.fillRect(0, 0, 1, 1); const d = cvs.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
  const over = (top, bottom) => { const a = top[3] + bottom[3] * (1 - top[3]); return a === 0 ? [255, 255, 255, 0] : [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a) }
  const effBg = (el, skipSelf) => {
    const layers = []
    for (let n = skipSelf ? el.parentElement : el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor)
      if (c[3] > 0) layers.push(c)
      if (c[3] >= 0.99) break
    }
    let acc = [255, 255, 255, 1]
    for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc)
    return acc
  }
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
  const measureBtn = (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    const own = effBg(el, false), around = effBg(el, true), label = rgba(cs.color)
    return { name: nameOf(el).slice(0, 24), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, font: parseFloat(cs.fontSize), fill: Math.round(ratio(own, around) * 100) / 100, labelContrast: Math.round(ratio(over(label, own), own) * 100) / 100 }
  }
  const pairs = []
  for (const g of q('[data-choice-group]')) {
    const dec = [...g.querySelectorAll('[data-choice=decline]')].filter(visible)
    const pri = [...g.querySelectorAll('[data-choice=primary]')].filter(visible)
    if (dec.length && pri.length) pairs.push({ via: 'marker', decline: measureBtn(dec[0]), primary: measureBtn(pri[0]) })
  }
  const DECLINE_RE = /^(?:해지|취소|거절|거부|아니요|아니오|안\s?할래요|동의하지|no thanks)/i
  if (!pairs.length) {
    for (const box of q('dialog,[role=dialog],[data-flow]')) {
      const bs = [...box.querySelectorAll('button,a[href]')].filter((el) => visible(el) && !el.matches(':disabled'))
      const dec = bs.find((el) => DECLINE_RE.test(nameOf(el)))
      const others = bs.filter((el) => el !== dec && !DECLINE_RE.test(nameOf(el)))
      if (dec && others.length) {
        const pri = others.reduce((a, b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height > a.getBoundingClientRect().width * a.getBoundingClientRect().height ? b : a))
        pairs.push({ via: 'text', decline: measureBtn(dec), primary: measureBtn(pri) })
      }
    }
  }

  // ── 흐름 ──
  const flows = q('[data-flow]').map((el) => ({ flow: el.getAttribute('data-flow'), steps: el.getAttribute('data-steps'), step: el.getAttribute('data-step') }))

  // ── 카운트다운 ──
  const countdowns = q('[data-countdown]').filter(visible).map((el) => ({ endsAt: el.getAttribute('data-ends-at'), text: norm(el.textContent) }))
  // 시계 꼴(HH:MM:SS)은 「마감·까지·남음·종료·후」 같은 말이 곁에 있을 때만 카운트다운으로 본다 — 기록 시각(2026-09-29 09:41:07)은 아니다.
  const COUNT_TEXT = [/(?:남은|남음|마감|종료|까지|후|뒤|left|remaining|ends?)[^\n]{0,14}\b\d{1,2}:\d{2}:\d{2}\b|\b\d{1,2}:\d{2}:\d{2}\b[^\n]{0,10}(?:남음|남았|후|뒤|left|remaining)/i,/\d+\s?(?:일|시간|분)\s?(?:\d+\s?(?:시간|분|초)\s?)?(?:남았|남음|후\s?종료|뒤\s?종료)/, /(?:남은\s?(?:시간|재고)|마감\s?임박)/, /\d+\s?개\s?남(?:음|았)/, /\d+\s?명이\s?(?:보고|보는|구경|지켜)/]
  const looseCounters = []
  {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement
      if (!p || !inScope(p) || p.closest('script,style,noscript,template') || !visible(p) || nonOffer(p)) continue
      const t = n.textContent
      if (!COUNT_TEXT.some((re) => re.test(t))) continue
      const host = p.closest('[data-countdown],[data-ends-at],[data-stock],[data-bound]')
      if (!host) looseCounters.push(norm(t).slice(0, 40))
    }
  }
  const clockTexts = () => q('[data-countdown]').filter(visible).map((el) => norm(el.textContent))

  // ── 모달 ──
  const modals = []
  for (const el of q('dialog,[role=dialog],[role=alertdialog],[aria-modal=true]')) {
    if (!visible(el)) continue
    const modal = (el.tagName === 'DIALOG' && el.matches(':modal')) || el.getAttribute('aria-modal') === 'true'
    if (modal) modals.push({ via: el.tagName === 'DIALOG' ? 'dialog:modal' : 'aria-modal', name: nameOf(el).slice(0, 24) })
  }
  const vw = innerWidth, vh2 = innerHeight
  const covers = new Map()
  for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.25, 0.7], [0.75, 0.7]]) {
    const hit = document.elementFromPoint(vw * fx, vh2 * fy)
    for (let n = hit; n && n !== document.documentElement; n = n.parentElement) {
      if (n.matches(NAV)) break
      const cs = getComputedStyle(n)
      if (cs.position !== 'fixed') continue
      const r = n.getBoundingClientRect()
      const share = (Math.min(r.right, vw) - Math.max(r.left, 0)) * (Math.min(r.bottom, vh2) - Math.max(r.top, 0)) / (vw * vh2)
      if (share >= T.modalCoverMin) covers.set(n, { via: 'fixed-cover', share: Math.round(share * 100) / 100, tag: n.tagName.toLowerCase() })
      break
    }
  }
  for (const c of covers.values()) modals.push(c)

  // ── JSON-LD ──
  const ld = { parseErrors: 0, values: [], hosts: [] }
  {
    const nodes = []
    const flat = (v, host) => {
      if (Array.isArray(v)) return v.forEach((x) => flat(x, host))
      if (!v || typeof v !== 'object') return
      const types = [].concat(v['@type'] ?? [])
      nodes.push({ v, types, host })
      for (const [k, x] of Object.entries(v)) if (x && typeof x === 'object' && k !== '@context') flat(x, { types, key: k })
    }
    for (const s of q('script[type="application/ld+json"]')) {
      try { flat(JSON.parse(s.textContent), null) } catch { ld.parseErrors++ }
    }
    for (const { v, types, host } of nodes) {
      for (const k of ['price', 'lowPrice', 'highPrice', 'ratingValue', 'reviewCount', 'ratingCount']) {
        if (v[k] === undefined || typeof v[k] === 'object') continue
        const raw = String(v[k]).trim()
        ld.values.push({ key: k, value: raw, type: types.join('|') })
      }
      // 별점 마크업의 주인: aggregateRating·review 를 품은 노드의 @type. 맨 위에 혼자 있는 AggregateRating·Review 는 itemReviewed 의 @type.
      for (const k of ['aggregateRating', 'review']) if (v[k] !== undefined) ld.hosts.push({ prop: k, hostType: types.join('|') })
      if (!host && types.some((t) => /^(AggregateRating|Review)$/.test(t))) ld.hosts.push({ prop: types.join('|'), hostType: [].concat(v.itemReviewed?.['@type'] ?? []).join('|') })
    }
    for (const v of ld.values) {
      const n = Number(v.value.replace(/,/g, ''))
      const variants = new Set([v.value])
      if (Number.isFinite(n)) { variants.add(String(n)); variants.add(n.toLocaleString('en-US')); variants.add(n.toFixed(2)); variants.add(n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); if (!Number.isInteger(n)) variants.add(n.toFixed(1)) } // 화면은 정수 가격도 소수 둘째 자리로 그린다(US$12.00·US$0.00 — 외화 요금표)
      v.found = [...variants].some((s) => new RegExp(`(?<![\\d.,])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d]|\\.\\d)`).test(text))
    }
    // microdata
    ld.micro = q('[itemprop=aggregateRating],[itemprop=ratingValue],[itemprop=reviewRating]').map((el) => ({ hostType: (el.parentElement?.closest('[itemtype]')?.getAttribute('itemtype') ?? '').replace(/^.*\//, '') }))
  }

  // ── 보증·에스크로·판매자 답변·별점 입력·다음 행동 ──
  const guarantees = q('[data-guarantee]').filter(visible).map((el) => ({ days: el.getAttribute('data-guarantee-days'), text: norm(el.textContent), nearCta: !!el.closest('section,[data-block],article,form')?.querySelector('a[href],button') }))
  const escrow = q('[data-escrow]').map((el) => ({ shown: visible(el), text: norm(el.textContent).slice(0, 60) }))
  const replies = q('[data-seller-reply]').filter(visible).map((el) => {
    const p = el.parentElement, cs = getComputedStyle(el), ps = getComputedStyle(p)
    const bgA = rgba(cs.backgroundColor), bgP = effBg(p, false)
    const bgDiff = bgA[3] > 0.05 && ratio(over(bgA, bgP), bgP) > 1.02
    const leftBar = parseFloat(cs.borderLeftWidth) >= 2 || parseFloat(cs.borderTopWidth) >= 2
    const inset = el.getBoundingClientRect().left - p.getBoundingClientRect().left >= 8
    const italic = cs.fontStyle === 'italic' && ps.fontStyle !== 'italic'
    return { text: norm(el.textContent).slice(0, 40), distinct: bgDiff || leftBar || inset || italic, hasLabel: /판매자|사장님|운영자|스토어|답변/.test(el.textContent ?? ''), via: { bgDiff, leftBar, inset, italic } }
  })
  const ratingAsk = q('[data-rating-ask]').map((el) => {
    const on = [...el.querySelectorAll('input[type=radio]')].filter((r) => r.checked).length + [...el.querySelectorAll('[role=radio][aria-checked=true],[role=radio][data-checked]')].length + [...el.querySelectorAll('select')].filter((s) => s.value !== '' && !s.options[s.selectedIndex]?.disabled).length + [...el.querySelectorAll('input[type=range],input[type=number]')].filter((s) => s.value !== '').length
    return { preselected: on }
  })
  const nextActions = q('[data-next-action]').filter(visible).map((el) => nameOf(el).slice(0, 24))

  return {
    text: text.length, fakeButtons, names, priceSizes, priceEls, imgPrices, priceTables, krw, vat, total, extra, optIn, pairs, flows, countdowns, looseCounters, clockTexts: clockTexts(), modals, ld, guarantees, escrow, replies, ratingAsk, nextActions,
  }
}

// ── 판정(순수) ─────────────────────────────────────────────────────────────────────────────────────
const GENERIC_NAMES = /^(?:확인|제출|더\s?보기|클릭|여기|여기를\s?클릭|바로가기|ok|submit|more|click here|here|read more)$/i
const PRODUCT_LIKE = /^(?:Product|ProductGroup|SoftwareApplication|MobileApplication|WebApplication|Book|Course|Recipe|Movie|Event)$/

// facts: pageFacts 결과 + { cancelWalk, signupSteps, endsAtReload, clockSamples }. 반환: [{ id, level, status, measured, detail[] }]
export function judge(f, opts = {}) {
  const T = { ...THRESHOLDS, ...(opts.thresholds ?? {}) }
  const out = []
  const put = (id, measured, problems, extra = {}) => {
    const r = RULE[id]
    const status = measured === 0 ? 'na' : problems.length === 0 ? 'pass' : r.level === 'should' ? 'warn' : 'fail'
    out.push({ id, level: r.level, status, measured, detail: problems, ...extra })
  }

  // cta-element
  put('cta-element', f.names.length + f.fakeButtons.length, f.fakeButtons.map((x) => `가짜 버튼 ${x}`))
  // cta-name
  {
    const probs = []
    for (const n of f.names) {
      if (!n.name) probs.push(`이름 없음 ${n.tag}`)
      else if (n.cta && GENERIC_NAMES.test(n.name)) probs.push(`빈 문구 「${n.name}」`)
    }
    put('cta-name', f.names.length, probs)
  }
  // price-text
  {
    const probs = []
    for (const p of f.priceEls) if (!/\d/.test(p.text) && !/무료|문의|free/i.test(p.text)) probs.push(`가격 칸에 숫자 없음 「${p.text.slice(0, 20)}」`)
    for (const i of f.imgPrices) if (!i.inText) probs.push(`이미지 alt 에만 있는 가격 「${i.alt.slice(0, 24)}」`)
    put('price-text', f.priceEls.length + f.imgPrices.length, probs)
  }
  // pricing-table
  {
    const probs = []
    for (const t of f.priceTables) {
      if (!t.native) probs.push(`가격 표가 <table> 이 아니다 「${t.label}」`)
      else if (t.th === 0) probs.push(`가격 표에 <th> 없음 「${t.label}」`)
      else if (t.thNoScope) probs.push(`<th scope> 빠짐 ${t.thNoScope}/${t.th} 「${t.label}」`)
    }
    put('pricing-table', f.priceTables.length, probs)
  }
  // price-notation
  put('price-notation', f.krw ? 1 : 0, f.krw && !f.vat ? ['원화 가격이 있는데 VAT·부가세 표기가 화면에 없다'] : [])
  // total-first-screen
  {
    const probs = []
    if (f.total) {
      if (!f.total.hasMarker && !f.total.hasStatement) probs.push(`첫 가격(${f.total.first}) 구역에 총액·VAT 문구 없음`)
      const late = [...new Set(f.extra.map((e) => e.phrase))].filter((p) => !f.total.regionExtra.includes(p))
      for (const p of late) probs.push(`추가 비용 문구 「${p}」가 첫 가격 화면 밖에서 처음 나온다`)
    }
    put('total-first-screen', f.total ? 1 : 0, probs)
  }
  // billed-largest
  {
    const { billed, equivalent } = f.priceSizes ?? { billed: [], equivalent: [] }
    const both = billed.length > 0 && equivalent.length > 0
    put('billed-largest', both ? 1 : 0, both && Math.max(...equivalent) > Math.min(...billed) ? [`환산가 ${Math.max(...equivalent)}px > 실제 청구액 ${Math.min(...billed)}px`] : [])
  }
  // optin-unchecked
  put('optin-unchecked', f.optIn.length, f.optIn.filter((o) => o.checked).map((o) => `미리 체크됨 「${o.label}」`))
  // decline-parity
  {
    const probs = []
    for (const p of f.pairs) {
      const r = (a, b) => Math.min(a, b) / Math.max(a, b)
      const d = p.decline, m = p.primary
      const tag = `「${d.name}」↔「${m.name}」`
      if (r(d.w, m.w) < T.sizeRatioMin) probs.push(`${tag} 가로 비 ${r(d.w, m.w).toFixed(2)} < ${T.sizeRatioMin} (${d.w}×${m.w})`)
      if (r(d.h, m.h) < T.sizeRatioMin) probs.push(`${tag} 세로 비 ${r(d.h, m.h).toFixed(2)} < ${T.sizeRatioMin} (${d.h}×${m.h})`)
      if (r(d.font, m.font) < T.sizeRatioMin) probs.push(`${tag} 글자 크기 비 ${r(d.font, m.font).toFixed(2)}`)
      if (Math.abs(d.fill - m.fill) > T.fillDeltaMax) probs.push(`${tag} 채움 대비 차 ${Math.abs(d.fill - m.fill).toFixed(2)} > ${T.fillDeltaMax} (${d.fill} ↔ ${m.fill})`)
      if (Math.abs(d.labelContrast - m.labelContrast) > T.labelDeltaMax) probs.push(`${tag} 글자 대비 차 ${Math.abs(d.labelContrast - m.labelContrast).toFixed(2)} > ${T.labelDeltaMax}`)
    }
    put('decline-parity', f.pairs.length, probs)
  }
  // cancel-steps
  {
    const cancel = f.flows.find((x) => x.flow === 'cancel')
    const probs = []
    let measured = 0
    if (cancel) {
      measured = 1
      const steps = Number(cancel.steps)
      const signup = f.signupSteps ?? Number(f.flows.find((x) => x.flow === 'signup')?.steps)
      if (!Number.isInteger(steps) || steps < 1) probs.push(`해지 data-steps 가 정수가 아니다 「${cancel.steps}」`)
      const w = f.cancelWalk
      if (w) {
        if (!w.reachedEnd) probs.push(`거절 버튼만 눌러서는 해지 완료에 닿지 못했다(누른 ${w.clicks}번, 본 단계 ${w.stepsSeen.join('→')}${w.stuckAt ? `, ${w.stuckAt}단계에서 눌러도 안 넘어감` : ''})`)
        for (const s of w.missingDecline) probs.push(`${s}단계에 해지 쪽 버튼이 없다`)
      } else probs.push('해지 흐름을 눌러 걷지 못했다')
      if (Number.isFinite(signup) && signup >= 1) {
        if (steps > signup) probs.push(`해지 ${steps}단계 > 가입 ${signup}단계`)
        if (w?.reachedEnd && w.clicks > signup - 1) probs.push(`해지 클릭 ${w.clicks} > 가입 클릭 ${signup - 1}`)
      } else probs.push('가입 단계 수 기준이 없다(같은 쪽 data-flow=signup·--signup-steps·--signup-url 중 하나가 필요) — 비교하지 못했다')
    }
    put('cancel-steps', measured, probs, cancel ? { cancelSteps: Number(cancel.steps), signupSteps: f.signupSteps ?? null, clicks: f.cancelWalk?.clicks ?? null } : {})
  }
  // countdown-real
  {
    const probs = []
    for (const c of f.countdowns) {
      if (!c.endsAt || Number.isNaN(Date.parse(c.endsAt)) || !/^\d{4}-\d{2}-\d{2}T/.test(c.endsAt)) probs.push(`data-ends-at 가 ISO 시각이 아니다 「${c.endsAt ?? '없음'}」`)
    }
    if (f.endsAtReload) {
      const a = f.countdowns.map((c) => c.endsAt), b = f.endsAtReload
      if (JSON.stringify(a) !== JSON.stringify(b)) probs.push(`다시 불러오면 endsAt 이 바뀐다 ${JSON.stringify(a)} → ${JSON.stringify(b)} (되돌아가는 타이머)`)
    }
    for (const t of f.looseCounters) probs.push(`endsAt·재고 표지가 없는 남은 시간·재고 글자 「${t}」`)
    const s = f.clockSamples
    if (s && s.length >= 2) {
      const secs = (t) => { const m = t.match(/(\d{1,2}):(\d{2}):(\d{2})/); return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null }
      const n = Math.min(...s.map((x) => x.length))
      for (let i = 0; i < n; i++) for (let k = 1; k < s.length; k++) {
        const a = secs(s[k - 1][i] ?? ''), b = secs(s[k][i] ?? '')
        if (a !== null && b !== null && b > a) probs.push(`남은 시간이 늘었다 ${s[k - 1][i]} → ${s[k][i]}`)
      }
    }
    put('countdown-real', f.countdowns.length + f.looseCounters.length, probs)
  }
  // first-screen-modal
  put('first-screen-modal', 1, f.modals.map((m) => `첫 화면 가림 ${m.via}${m.name ? ` 「${m.name}」` : ''}${m.share ? ` ${Math.round(m.share * 100)}%` : ''}`))
  // jsonld-visible
  {
    const probs = []
    for (let i = 0; i < f.ld.parseErrors; i++) probs.push('JSON-LD 를 읽을 수 없다(JSON 오류)')
    for (const v of f.ld.values) if (!v.found) probs.push(`JSON-LD ${v.type} ${v.key}=${v.value} 가 화면 글자에 없다`)
    put('jsonld-visible', f.ld.values.length + f.ld.parseErrors, probs)
  }
  // no-self-rating
  {
    const probs = []
    for (const h of f.ld.hosts) {
      const types = h.hostType ? h.hostType.split('|') : []
      if (!types.some((t) => PRODUCT_LIKE.test(t))) probs.push(`별점 마크업(${h.prop})이 ${h.hostType || '주인 불명'} 에 달렸다`)
    }
    for (const m of f.ld.micro) if (!PRODUCT_LIKE.test(m.hostType)) probs.push(`microdata 별점이 ${m.hostType || '주인 불명'} 에 달렸다`)
    put('no-self-rating', f.ld.hosts.length + f.ld.micro.length, probs)
  }
  // guarantee-days
  put('guarantee-days', f.guarantees.length, f.guarantees.flatMap((g) => {
    const n = Number(g.days), p = []
    if (!Number.isInteger(n) || n < T.guaranteeDaysMin) p.push(`보증 ${g.days ?? '기간 표지 없음'}일 < 청약철회 ${T.guaranteeDaysMin}일`)
    else if (!g.text.includes(String(n))) p.push(`보증 ${n}일이 화면 글자에 없다 「${g.text.slice(0, 24)}」`)
    return p
  }))
  // escrow-notice
  put('escrow-notice', f.escrow.length, f.escrow.flatMap((e) => (!e.shown ? ['에스크로 표지가 안 보인다'] : !/에스크로|결제대금예치/.test(e.text) ? [`에스크로 글자 없음 「${e.text.slice(0, 24)}」`] : [])))
  // seller-reply-style
  put('seller-reply-style', f.replies.length, f.replies.flatMap((r) => [...(!r.distinct ? [`판매자 답변이 후기 본문과 모양이 같다 「${r.text}」`] : []), ...(!r.hasLabel ? [`판매자 답변에 주체 글자가 없다 「${r.text}」`] : [])]))
  // rating-no-default
  put('rating-no-default', f.ratingAsk.length, f.ratingAsk.filter((r) => r.preselected > 0).map((r) => `별점이 미리 채워져 있다(${r.preselected})`))
  // next-action-one
  put('next-action-one', f.nextActions.length, f.nextActions.length > 1 ? [`다음 행동이 ${f.nextActions.length}개 ${JSON.stringify(f.nextActions)}`] : [])
  // flow-markers
  {
    const probs = []
    for (const x of f.flows) {
      const steps = Number(x.steps), step = Number(x.step)
      if (!Number.isInteger(steps) || steps < 1) probs.push(`${x.flow} data-steps 가 정수가 아니다 「${x.steps}」`)
      else if (!Number.isInteger(step) || step < 1 || step > steps) probs.push(`${x.flow} data-step ${x.step} 가 1..${steps} 밖`)
      if (x.flow === 'onboarding' && steps > T.onboardingStepsWarn) probs.push(`온보딩 ${steps}단계 > ${T.onboardingStepsWarn}`)
    }
    put('flow-markers', f.flows.length, probs)
  }
  // guarantee-near-cta
  put('guarantee-near-cta', f.guarantees.length, f.guarantees.filter((g) => !g.nearCta).map((g) => `보증 한 줄 곁에 CTA 가 없다 「${g.text.slice(0, 24)}」`))
  return out
}

export const failingIds = (rules) => rules.filter((r) => r.status === 'fail').map((r) => r.id)

// ── 브라우저 실행 ────────────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const click = async (send, x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}

// 거절 버튼만 눌러 해지 흐름을 끝까지 걷는다(가입보다 길지 않은지, 모든 단계에 해지 쪽 버튼이 있는지).
async function walkCancel({ send, ev }) {
  const state = `(() => { const f = document.querySelector('[data-flow=cancel]'); if (!f) return null; const d = [...f.querySelectorAll('[data-choice=decline]')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled }); return { step: f.getAttribute('data-step'), steps: f.getAttribute('data-steps'), end: [...document.querySelectorAll('[data-end-date]')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }), decline: d ? (d.scrollIntoView({ block: 'center' }), (() => { const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()) : null } })()`
  const walk = { clicks: 0, stepsSeen: [], missingDecline: [], reachedEnd: false }
  for (let i = 0; i < 8; i++) {
    const s = await ev(state)
    if (!s) break
    if (!walk.stepsSeen.includes(Number(s.step))) walk.stepsSeen.push(Number(s.step))
    if (s.end || Number(s.step) === Number(s.steps)) { walk.reachedEnd = true; break }
    if (!s.decline) { walk.missingDecline.push(Number(s.step)); break }
    await click(send, s.decline.x, s.decline.y)
    walk.clicks++
    let changed = false
    for (let k = 0; k < 40; k++) { // 단계가 바뀔 때까지(최대 4초)
      await sleep(100)
      const n = await ev(`document.querySelector('[data-flow=cancel]')?.getAttribute('data-step') ?? null`)
      if (n !== String(s.step)) { changed = true; break }
    }
    if (!changed) { walk.stuckAt = Number(s.step); break } // 눌러도 안 넘어가면 더 누르지 않는다(가로채는 덮개·죽은 버튼)
  }
  return walk
}

async function stepsAt({ send, ev }, url, entered) {
  const nav = await navigateAndWait(send, ev, url)
  if (nav?.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${url}`)
  await entered()
  return ev(`(() => { const f = document.querySelector('[data-flow=signup]'); return f ? Number(f.getAttribute('data-steps')) : null })()`)
}

// 한 CDP 세션에서 URL 하나를 잰다(blocks:gates 행렬이 Chrome 을 공유하려고 쓴다). 반환: { url, viewport, rules, fail, warn }.
export async function gateOnPage(session, url, opts = {}) {
  const { send, ev } = session
  const width = opts.width ?? 1440, height = opts.height ?? 900
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await send('Page.enable')
  await send('Runtime.enable')
  const entered = async () => {
    // 갤러리 블록은 그려질 때까지, 모션 키트 장면은 등장 끝 신호까지(한도 10초) 기다린다. 없으면 바로 잰다.
    for (let i = 0; i < 100; i++) {
      const s = await ev(`document.querySelector('[data-qa-block]') ? (document.querySelector('[data-qa-ready]') ? 'ready' : 'wait') : 'plain'`)
      if (s !== 'wait') break
      await sleep(100)
    }
    // 모션 장면이 있을 때만 등장 끝 신호를 기다린다(없는 페이지에서 ENTERED_WAIT 는 3초를 그냥 쓴다).
    await sleep(200)
    if (await ev(`!!document.querySelector('[data-wf-scene]')`)) await ev(ENTERED_WAIT)
    await sleep(300)
  }
  const nav = await navigateAndWait(send, ev, url)
  if (nav?.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${url}`)
  await entered()
  const cfg = { modalCoverMin: THRESHOLDS.modalCoverMin, ...(opts.thresholds ?? {}) }
  const facts = await ev(`(${pageFacts.toString()})(${JSON.stringify(cfg)})`)
  if (!facts) throw new Error(`페이지 측정 실패(pageFacts 가 값을 안 줬다): ${url}`)

  // 카운트다운 시각 표본(늘지 않는지)
  if (facts.countdowns.length || facts.clockTexts.length) {
    const samples = [facts.clockTexts]
    for (let i = 0; i < 2; i++) {
      await sleep(THRESHOLDS.tickGapMs)
      samples.push(await ev(`[...document.querySelectorAll('[data-countdown]')].filter((e) => !e.closest('[data-sticky-nav]')).map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`))
    }
    facts.clockSamples = samples
  }
  // 해지 흐름 걷기(눌러서 상태가 바뀌므로 다른 사실을 모은 뒤 마지막에)
  const hasCancel = facts.flows.some((x) => x.flow === 'cancel')
  if (hasCancel) facts.cancelWalk = await walkCancel(session)
  // 가입 단계 수 기준
  if (opts.signupSteps) facts.signupSteps = Number(opts.signupSteps)
  else if (hasCancel && !facts.flows.some((x) => x.flow === 'signup')) {
    const su = opts.signupUrl ?? galleryRef(url, 'auth/sign-up-consents')
    if (su) facts.signupSteps = await stepsAt(session, su, entered)
  }
  // 카운트다운이 있으면 다시 불러서 endsAt 이 그대로인지(되돌아가는 타이머는 불러올 때마다 새로 정해진다)
  if (facts.countdowns.length) {
    await navigateAndWait(send, ev, url)
    await entered()
    facts.endsAtReload = await ev(`[...document.querySelectorAll('[data-countdown]')].filter((e) => !e.closest('[data-sticky-nav]')).map((e) => e.getAttribute('data-ends-at'))`)
  }
  const rules = judge(facts, opts)
  return { url, viewport: `${width}x${height}`, rules, fail: failingIds(rules), warn: rules.filter((r) => r.status === 'warn').map((r) => r.id), measured: Object.fromEntries(rules.map((r) => [r.id, r.measured])) }
}

// 갤러리 주소면 같은 레시피로 다른 블록의 주소를 만든다(가입 단계 수 기준 자동 찾기). 갤러리가 아니면 null.
export function galleryRef(url, block) {
  try {
    const u = new URL(url)
    if (!/\/qa\/blocks\/?$/.test(u.pathname) || !u.searchParams.get('b')) return null
    const v = new URL(u.origin + u.pathname)
    v.searchParams.set('b', block.startsWith('block-') ? block : `block-${block.replace('/', '-')}`)
    v.searchParams.set('r', u.searchParams.get('r') ?? 'r1')
    v.searchParams.set('frame', '1')
    return v.href
  } catch { return null }
}

export async function runMarketingGate(url, opts = {}) {
  let chrome
  try {
    chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb'], { prefix: 'mkt-' })
    const { ws, ...session } = await connect(chrome.wsUrl)
    try { return await gateOnPage(session, url, opts) } finally { ws.close() }
  } finally { await chrome?.close() }
}

// ── 소스 검사(--source): 카운트다운·가짜 카운터가 데이터에 묶이는지 ───────────────────────────────────────
function* walkTsx(dir) {
  for (const n of readdirSync(dir)) {
    if (n === '_compiled') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) yield* walkTsx(p)
    else if (/\.tsx$/.test(n)) yield p
  }
}
// 반환: { checked, problems[] }. 규칙 countdown-real 의 정적 쪽(factory-rules.md §22-1 L8): 카운트다운 표지가 있는 컴포넌트는 endsAt 를 받고,
// endsAt 을 지금 시각에 더해 만들지 않으며, 어떤 블록도 Math.random 으로 「N명이 보는 중」 같은 수를 만들지 않는다.
export function sourceCheck(root = ROOT) {
  const dir = join(root, 'registry', 'factory', 'blocks')
  const problems = []
  let checked = 0
  for (const file of walkTsx(dir)) {
    const src = readFileSync(file, 'utf8')
    const rel = relative(root, file).replace(/\\/g, '/')
    checked++
    const usesCountdown = /data-countdown|<DaysLeft\b/.test(src)
    if (usesCountdown && !/\bendsAt\b/.test(src)) problems.push(`${rel}: 카운트다운이 있는데 endsAt 를 받지 않는다`)
    if (/\bendsAt\b[^\n]*=[^\n]*(?:Date\.now\(\)|new Date\(\)\.getTime\(\))\s*\+|(?:Date\.now\(\)|new Date\(\)\.getTime\(\))\s*\+[^\n]*endsAt/.test(src)) problems.push(`${rel}: endsAt 를 지금 시각에 더해 만든다(되돌아가는 타이머)`)
    if (/\bendsAt\s*[:=]\s*["'`]\d{4}-\d{2}-\d{2}/.test(src)) problems.push(`${rel}: endsAt 를 소스에 박아 넣었다`)
    if (/Math\.random\s*\(/.test(src)) problems.push(`${rel}: Math.random — 가짜 카운터·「N명이 보는 중」 금지(factory-rules.md §22-1 L8)`)
  }
  return { checked, problems }
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────
const usage = () => { console.error('사용: marketing-gate.mjs <url> [--out <dir>] [--width N] [--height N] [--signup-url URL] [--signup-steps N]\n      marketing-gate.mjs --source [--root <dir>] [--out <dir>]'); process.exit(2) }
const main = async () => {
  const argv = process.argv.slice(2)
  const flag = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) usage(); argv.splice(i, 2); return v }
  const source = argv.includes('--source')
  if (source) argv.splice(argv.indexOf('--source'), 1)
  const out = flag('--out', join(ROOT, '.tmp', 'marketing-gate'))
  const width = Number(flag('--width', 1440)), height = Number(flag('--height', 900))
  const signupUrl = flag('--signup-url', undefined), signupSteps = flag('--signup-steps', undefined)
  const root = flag('--root', ROOT)
  const [url, ...rest] = argv
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200) usage()
  if (rest.length || (!source && !url) || (source && url)) usage()
  if (signupSteps !== undefined && !(Number.isInteger(Number(signupSteps)) && Number(signupSteps) >= 1)) usage()
  const file = join(out, source ? 'marketing-source.json' : 'marketing-gate.json')
  mkdirSync(out, { recursive: true })
  rmSync(file, { force: true }) // 앞 실행의 결과를 도구 실패 뒤에 남기지 않는다
  let code = 0
  try {
    if (source) {
      const r = sourceCheck(root)
      if (r.checked === 0) throw new Error(`블록 소스가 하나도 없다: ${root}`)
      writeFileSync(file, JSON.stringify(r, null, 2))
      console.log(JSON.stringify({ mode: 'source', checked: r.checked, problems: r.problems.length }))
      for (const p of r.problems) console.error(`FAIL ${p}`)
      code = r.problems.length ? 1 : 0
    } else {
      const r = await runMarketingGate(url, { width, height, signupUrl, signupSteps })
      writeFileSync(file, JSON.stringify(r, null, 2))
      console.log(JSON.stringify({ url, viewport: r.viewport, fail: r.fail, warn: r.warn, measured: r.measured }))
      for (const rule of r.rules) if (rule.status === 'fail' || rule.status === 'warn') for (const d of rule.detail) console.error(`${rule.status === 'fail' ? 'FAIL' : 'WARN'} ${rule.id}: ${d}`)
      code = r.fail.length ? 1 : 0
    }
  } catch (e) { console.error(`도구 실패: ${e.message}`); code = 1; rmSync(file, { force: true }) }
  process.exit(code)
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
