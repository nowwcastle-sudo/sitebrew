// 마케팅 관문(marketing-gate.mjs)의 음성 대조 표: 통과 페이지 fixtures/marketing/good.html 에서 딱 한 곳만 고쳐 그 규칙 하나만 어기게 만든다.
// 시험(marketing-gate.test.mjs)이 이 표로 페이지를 만들어 관문에 돌리고, 「그 규칙만」 실패하는지 본다 — 규칙마다 실패해 보이는 나쁜 페이지가 있어야 규칙이 살아 있다는 증거다.
// 고칠 글이 좋은 페이지에 없으면 던진다(good.html 을 고쳤을 때 조용히 무뎌지는 것을 막는다).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const GOOD = join(here, 'fixtures', 'marketing', 'good.html')

const GOOD_LD = '{"@context":"https://schema.org","@type":"Product","name":"모아플랜","offers":{"@type":"Offer","price":"9900","priceCurrency":"KRW"},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"1284"}}'
const ld = (json) => [GOOD_LD, json]
const TABLE = /<table>[\s\S]*<\/table>/
// 모달이 눌림을 가로채면 해지 걷기가 못 눌러 다른 규칙까지 어긴다 — 모달 대조 페이지에서는 해지 흐름을 뺀다.
const NO_CANCEL = [[/<section id="cancel-section">[\s\S]*?<\/section>/, ''], [/<script>\s*\/\/ 해지 흐름[\s\S]*?<\/script>/, '']]

// edit: [[찾을 글 | 정규식, 바꿀 글], …]. expect: 그 규칙의 상태(must → fail, should → warn).
export const MUTATIONS = [
  { name: 'cta-fake-div', rule: 'cta-element', expect: 'fail', edit: [['<a class="b" href="#next"', '<div class="b" onclick="location.hash=\'x\'">지금 시작하기</div><a class="b" href="#next"']] },
  { name: 'cta-fake-role-button', rule: 'cta-element', expect: 'fail', edit: [['<a class="b" href="#next"', '<span class="b" role="button" tabindex="0">지금 시작하기</span><a class="b" href="#next"']] },
  { name: 'cta-fake-role-link', rule: 'cta-element', expect: 'fail', edit: [['<a class="b" href="#next"', '<span class="b" role="link" tabindex="0">이용 안내</span><a class="b" href="#next"']] },
  // 현재 쪽 표식 면제는 aria-current="page" 와 aria-disabled="true" 둘 다일 때만 — 하나라도 빠지면 가짜 버튼이다(C370 음성 대조)
  { name: 'cta-fake-role-link-current-not-disabled', rule: 'cta-element', expect: 'fail', edit: [['<a class="b" href="#next"', '<span class="b" role="link" aria-current="page" tabindex="0">이용 안내</span><a class="b" href="#next"']] },
  { name: 'cta-generic-name', rule: 'cta-name', expect: 'fail', edit: [['data-primary-action>무료로 시작하기', 'data-primary-action>확인']] },
  { name: 'cta-icon-only-no-name', rule: 'cta-name', expect: 'fail', edit: [['<a class="b" href="#next"', '<button type="button" class="b"><svg width="12" height="12"><circle cx="6" cy="6" r="5"/></svg></button><a class="b" href="#next"']] },
  { name: 'price-not-number', rule: 'price-text', expect: 'fail', edit: [['<span data-price="billed">9,900원</span>', '<span data-price="billed">이만큼</span>']] },
  { name: 'price-only-in-image-alt', rule: 'price-text', expect: 'fail', edit: [['<h2>요금</h2>', '<h2>요금</h2><img alt="월 19,900원" width="40" height="20" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">']] },
  { name: 'pricing-table-div-grid', rule: 'pricing-table', expect: 'fail', edit: [[TABLE, '<div role="table" aria-label="요금제 비교"><div role="row"><span role="columnheader">요금제</span><span role="columnheader">월 요금</span></div><div role="row"><span role="cell">베이직</span><span role="cell"><span data-price="billed">9,900원</span></span></div></div>']] },
  { name: 'pricing-table-th-no-scope', rule: 'pricing-table', expect: 'fail', edit: [['<th scope="col">요금제</th><th scope="col">월 요금</th>', '<th>요금제</th><th>월 요금</th>']] },
  { name: 'price-no-vat', rule: 'price-notation', expect: 'fail', edit: [['총 결제 금액 9,900원(VAT 포함) · 배송비·설치비 없음', '총 결제 금액 9,900원 · 배송비·설치비 없음']] },
  { name: 'total-not-on-first-price-screen', rule: 'total-first-screen', expect: 'fail', edit: [['<p data-total>총 결제 금액 9,900원(VAT 포함) · 배송비·설치비 없음</p>', '<p>월 9,900원부터</p>'], ['<span data-price="billed">9,900원</span>', '<span data-price="equivalent">9,900원</span>'], ['<h2>소식</h2>', '<h2>소식</h2><p>모든 가격은 VAT 포함이에요.</p>']] },
  { name: 'extra-cost-shown-late', rule: 'total-first-screen', expect: 'fail', edit: [['<h2>소식</h2>', '<h2>소식</h2><p>결제 단계에서 수수료 3%가 추가돼요.</p>']] },
  { name: 'equivalent-price-bigger-than-billed', rule: 'billed-largest', expect: 'fail', edit: [['<small data-price="equivalent" style="font-size:12px">', '<small data-price="equivalent" style="font-size:40px">']] },
  { name: 'optional-consent-prechecked', rule: 'optin-unchecked', expect: 'fail', edit: [['name="marketing-email"', 'name="marketing-email" checked']] },
  { name: 'addon-prechecked', rule: 'optin-unchecked', expect: 'fail', edit: [['<label><input type="checkbox" name="terms"', '<label><input type="checkbox" name="warranty" data-addon checked> 연장 보증 추가(9,900원)</label><label><input type="checkbox" name="terms"']] },
  { name: 'decline-small-ghost', rule: 'decline-parity', expect: 'fail', edit: [['<button type="button" class="b" data-choice="decline" id="dec">', '<button type="button" class="b" data-choice="decline" id="dec" style="min-width:70px;height:26px;font-size:12px;border:0;background:transparent;line-height:24px;color:#888">']] },
  { name: 'decline-only-primary-filled', rule: 'decline-parity', expect: 'fail', edit: [['<button type="button" class="b" data-choice="primary">', '<button type="button" class="b" data-choice="primary" style="background:#0a3d91;color:#fff;border-color:#0a3d91">']] },
  { name: 'cancel-longer-than-signup', rule: 'cancel-steps', expect: 'fail', edit: [['id="cancel" data-flow="cancel" data-step="1" data-steps="2"', 'id="cancel" data-flow="cancel" data-step="1" data-steps="5"']] },
  { name: 'cancel-step-without-decline', rule: 'cancel-steps', expect: 'fail', edit: [['id="cancel" data-flow="cancel" data-step="1" data-steps="2"', 'id="cancel" data-flow="cancel" data-step="1" data-steps="3" data-nodecline-at="2"']] },
  { name: 'countdown-not-iso', rule: 'countdown-real', expect: 'fail', edit: [['data-ends-at="2030-01-01T00:00:00.000Z"', 'data-ends-at="곧"']] },
  { name: 'countdown-rolling-timer', rule: 'countdown-real', expect: 'fail', edit: [['data-ends-at="2030-01-01T00:00:00.000Z"', 'id="roll" data-ends-at="2030-01-01T00:00:00.000Z"'], ['</body>', '<script>document.getElementById("roll").setAttribute("data-ends-at", new Date(Date.now() + 3600e3).toISOString())</script></body>']] },
  { name: 'countdown-loose-clock', rule: 'countdown-real', expect: 'fail', edit: [['<h2>소식</h2>', '<h2>소식</h2><p>특가 마감까지 02:59:59</p>']] },
  { name: 'countdown-loose-stock', rule: 'countdown-real', expect: 'fail', edit: [['<h2>소식</h2>', '<h2>소식</h2><p>재고 3개 남음</p>']] },
  { name: 'countdown-ticks-up', rule: 'countdown-real', expect: 'fail', edit: [['<span data-numeric>1200</span>일 남았어요</span>', '<span data-numeric>1200</span>일 남았어요</span><span data-countdown data-ends-at="2030-01-01T00:00:00.000Z" id="tick">02:00:00</span>'], ['</body>', '<script>{ let s = 7200; const el = document.getElementById("tick"); const f = (n) => [Math.floor(n / 3600), Math.floor(n % 3600 / 60), n % 60].map((x) => String(x).padStart(2, "0")).join(":"); setInterval(() => { s += 1; el.textContent = f(s) }, 1000) }</script></body>']] },
  { name: 'modal-showModal-on-load', rule: 'first-screen-modal', expect: 'fail', edit: [...NO_CANCEL, ['</body>', '<dialog id="m" aria-label="쿠폰"><p>지금 가입하면 쿠폰!</p><button type="button" class="b" onclick="this.closest(\'dialog\').close()">닫기</button></dialog><script>document.getElementById("m").showModal()</script></body>']] },
  { name: 'modal-fixed-cover', rule: 'first-screen-modal', expect: 'fail', edit: [...NO_CANCEL, ['</body>', '<div style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:50"></div></body>']] },
  { name: 'jsonld-price-mismatch', rule: 'jsonld-visible', expect: 'fail', edit: [ld('{"@context":"https://schema.org","@type":"Product","name":"모아플랜","offers":{"@type":"Offer","price":"8900","priceCurrency":"KRW"},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"1284"}}')] },
  // 본문 안 script(Next 페이지의 JSON-LD 자리)가 자기 값을 화면 글자로 착각하게 만들지 않는다 — 실제 갤러리에서 price-notation 이 조용히 통과했던 결함의 재발 방지
  { name: 'jsonld-in-body-not-self-matching', rule: 'jsonld-visible', expect: 'fail', edit: [['<main>', '<main><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"모아플랜","offers":{"@type":"Offer","price":"8900","priceCurrency":"KRW"}}</script>']] },
  { name: 'vat-only-inside-body-script', rule: 'price-notation', expect: 'fail', edit: [['총 결제 금액 9,900원(VAT 포함) · 배송비·설치비 없음', '총 결제 금액 9,900원 · 배송비·설치비 없음'], ['<main>', '<main><script type="application/json">{"note":"VAT 포함"}</script>']] },
  { name: 'jsonld-rating-mismatch', rule: 'jsonld-visible', expect: 'fail', edit: [ld('{"@context":"https://schema.org","@type":"Product","name":"모아플랜","offers":{"@type":"Offer","price":"9900","priceCurrency":"KRW"},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.9","reviewCount":"1284"}}')] },
  { name: 'rating-on-organization', rule: 'no-self-rating', expect: 'fail', edit: [ld('{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"모아플랜","offers":{"@type":"Offer","price":"9900","priceCurrency":"KRW"}},{"@type":"Organization","name":"모아","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"1284"}}]}')] },
  { name: 'rating-microdata-on-localbusiness', rule: 'no-self-rating', expect: 'fail', edit: [['<h2>후기 <span>4.8점 · 후기 1,284개</span></h2>', '<h2>후기 <span itemscope itemtype="https://schema.org/LocalBusiness"><span itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating"><span itemprop="ratingValue">4.8</span>점 · 후기 1,284개</span></span></h2>']] },
  { name: 'guarantee-shorter-than-withdrawal', rule: 'guarantee-days', expect: 'fail', edit: [['data-guarantee-days="14">14일 안에', 'data-guarantee-days="3">3일 안에']] },
  { name: 'guarantee-days-not-in-text', rule: 'guarantee-days', expect: 'fail', edit: [['data-guarantee-days="14">14일 안에', 'data-guarantee-days="14">기간 안에']] },
  { name: 'escrow-hidden', rule: 'escrow-notice', expect: 'fail', edit: [['<p data-escrow>', '<p data-escrow hidden>']] },
  { name: 'escrow-without-words', rule: 'escrow-notice', expect: 'fail', edit: [['<p data-escrow>결제대금예치(에스크로)로 결제할 수 있어요.</p>', '<p data-escrow>안전하게 결제해요.</p>']] },
  { name: 'seller-reply-same-look', rule: 'seller-reply-style', expect: 'fail', edit: [['[data-seller-reply] { margin-left: 16px; padding: 8px 12px; border-left: 4px solid #666; background: #f3f3f3; }', '[data-seller-reply] { margin: 0; padding: 0; }']] },
  { name: 'seller-reply-no-label', rule: 'seller-reply-style', expect: 'fail', edit: [['<strong>판매자 답변</strong> 이용해 주셔서 고마워요.', '이용해 주셔서 고마워요.']] },
  { name: 'rating-preselected-5', rule: 'rating-no-default', expect: 'fail', edit: [['<input type="radio" name="rating" value="5">', '<input type="radio" name="rating" value="5" checked>']] },
  { name: 'two-next-actions', rule: 'next-action-one', expect: 'fail', edit: [['<a class="b" href="#next" data-slot="button" data-next-action>대시보드 열기</a>', '<a class="b" href="#next" data-slot="button" data-next-action>대시보드 열기</a><a class="b" href="#more" data-slot="button" data-next-action>가이드 보기</a>']] },
  { name: 'flow-step-out-of-range', rule: 'flow-markers', expect: 'warn', edit: [['data-flow="onboarding" data-step="1" data-steps="3"', 'data-flow="onboarding" data-step="5" data-steps="3"']] },
  { name: 'onboarding-too-long', rule: 'flow-markers', expect: 'warn', edit: [['data-flow="onboarding" data-step="1" data-steps="3"', 'data-flow="onboarding" data-step="1" data-steps="6"']] },
  { name: 'guarantee-without-cta', rule: 'guarantee-near-cta', expect: 'warn', edit: [['<a class="b" href="#start" data-slot="button" data-primary-action>무료로 시작하기</a>\n    <p data-guarantee data-guarantee-days="14">14일 안에 마음에 들지 않으면 환불해 드려요.</p>', '</section><section id="g"><p data-guarantee data-guarantee-days="14">14일 안에 마음에 들지 않으면 환불해 드려요.</p>']] },
]

// 양성 대조: 좋은 페이지를 이렇게 바꿔도 실패 0·경고 0 이어야 한다(규칙이 지나치게 좁혀 지지 않았다는 증거 — 실제 갤러리에서 나온 오탐 모양).
export const PASSING_VARIANTS = [
  { name: 'reward-amount-before-price', edit: [['<h2>요금</h2>', '<h2>요금</h2><p>리뷰를 쓰면 적립금 1,000원을 드려요.</p>']] },
  { name: 'free-plan-zero-first-with-note-below', edit: [['<h2>요금</h2>', '<h2>요금</h2><p>무료 플랜 0원</p>']] },
  { name: 'metric-amount-in-dashboard-before-price', edit: [['<section id="pricing"', '<section data-block="dashboard-panel-kpi"><p>매출 96,000원 늘었어요. 염색약 재고 3개 남음</p></section><section id="pricing"']] },
  { name: 'metric-marker-amount-before-price', edit: [['<section id="pricing"', '<section><p data-money="metric">이번 달 매출 96,000원</p></section><section id="pricing"']] },
  { name: 'jsonld-integer-price-shown-with-two-decimals', edit: [['"price":"9900"', '"price":"12"'], ['<h2>요금</h2>', '<h2>요금</h2><p>US$12.00</p>']] },
  { name: 'timestamp-is-not-a-countdown', edit: [['<h2>소식</h2>', '<h2>소식</h2><p>기록 시각 2026-09-29 09:41:07</p>']] },
  { name: 'vat-and-shipping-inclusive-phrase', edit: [['<p data-total>총 결제 금액 9,900원(VAT 포함) · 배송비·설치비 없음</p>', '<p>9,900원(VAT·배송비 포함)</p>'], ['<span data-price="billed">9,900원</span>', '<span data-price="plain">9,900원</span>']] },
  // shadcn BreadcrumbPage — 눌리지 않는 현재 쪽 표식(span[role=link][aria-current=page][aria-disabled=true])은 가짜 버튼이 아니다(C370, content/breadcrumb 13행 오탐)
  { name: 'breadcrumb-current-page-marker', edit: [['<main>', '<main><nav aria-label="현재 위치"><span role="link" aria-disabled="true" aria-current="page">이용 안내</span></nav>']] },
  { name: 'negated-extra-cost-words', edit: [['<h2>소식</h2>', '<h2>소식</h2><p>수수료는 없어요. 추가 요금이 없어요.</p>']] },
]

// 바뀐 글 만들기(순수). edit 의 찾을 글이 없으면 던진다.
export function mutate(html, edit, name = '') {
  let out = html
  for (const [from, to] of edit) {
    const hit = from instanceof RegExp ? from.test(out) : out.includes(from)
    if (!hit) throw new Error(`음성 대조 ${name}: 좋은 페이지에 고칠 글이 없다 — ${String(from).slice(0, 60)}`)
    out = out.replace(from, () => to)
  }
  return out
}

// dir 에 good.html 과 나쁜 페이지 전부를 쓰고 { name → 파일 경로 } 를 돌려준다.
export function writeFixtures(dir) {
  mkdirSync(dir, { recursive: true })
  const good = readFileSync(GOOD, 'utf8')
  const files = { good: join(dir, 'good.html') }
  writeFileSync(files.good, good)
  for (const m of MUTATIONS) {
    files[m.name] = join(dir, `${m.name}.html`)
    writeFileSync(files[m.name], mutate(good, m.edit, m.name))
  }
  for (const v of PASSING_VARIANTS) {
    files[v.name] = join(dir, `${v.name}.html`)
    writeFileSync(files[v.name], mutate(good, v.edit, v.name))
  }
  return files
}
