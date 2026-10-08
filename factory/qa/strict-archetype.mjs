// 원형별 엄격 기준(P3-4 Task 4, 이월 「원형별 run --strict」) — 07-qa 가 원형마다 「이 원형이면 첫 화면에 이것이 있어야 한다」를 더 잰다.
//   STRICT_BY_ARCHETYPE[원형] = 규칙[] — 규칙 = { id, what, scope, needs[{ kind, within }] }
//     scope  'entry' = 원형의 첫 쪽(archetype.pages[0]) 하나에서 · 'any' = 열린 일반 쪽(법정 쪽 제외) 중 한 쪽에서 모든 needs 를 채운다.
//     needs  kind = 재는 사실(FACT_KINDS) · within = 그 사실이 들어와야 하는 화면 수(첫 화면 = 1, 스크롤 한 번 = 2). 1440×900 과 375×812 둘 다에서 재고, 둘 다 채워야 통과다.
//   판정은 순수 함수 judgeStrict(archetype, pages) — 브라우저 없이 시험한다. 사실은 페이지 안에서 도는 strictFacts() 가 모은다(문자열로 보낸다).
//   「잴 것이 없음」: 규칙이 요구한 쪽을 못 찾으면 통과가 아니라 na 이고, na 는 실패로 읽힌다(A123) — `naOk` 규칙만 넘어간다.
//   종료 코드(어댑터): 0 어김 없음 · 1 어김 또는 도구 실패(쪽이 안 열림·Chrome·측정값 없음). docs/agents/agent-guide.md 「관문 도구의 종료 코드」 표의 a11y·ops 줄과 같은 읽기다.
// 문턱은 첫 골든 18 실측 뒤에 조정한다(대장) — 여기 값은 「첫 화면」 정의를 고정하는 출발값이다.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, navigateAndWait, startChrome, assertOpened } from './cdp.mjs'

export const PROFILES = Object.freeze([
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 375, height: 812 },
])

/** 재는 사실 — 이름 · 뜻. strictFacts() 가 같은 이름으로 돌려준다. */
export const FACT_KINDS = Object.freeze({
  tel: '전화 걸기 링크(tel:) 또는 화면에 보이는 전화번호',
  hours: '영업·운영·진료 시간(시각 범위 또는 시간 표지 글)',
  location: '지도(임베드·지도 앱 링크)나 도로명 주소',
  price: '가격(원·₩·$·€ 금액)',
  shipping: '배송·택배·shipping·delivery 안내 글',
  cta: '주 행동 버튼·링크(시작·가입·구매·예약·문의·신청·get started·sign up·buy·book·contact)',
  pricingLink: '요금·Pricing 으로 가는 링크',
  nav: '주 내비게이션(nav)',
  chart: '표·차트·그림 지표(table·canvas·svg[role=img]·figure·[data-chart])',
  numbers: '눈에 보이는 숫자 지표 3개 이상(숫자 글자 덩어리)',
  works: '작업 카드 3개 이상(이미지가 든 링크·figure)',
  contact: '연락 링크(mailto: 또는 tel: 또는 문의·contact 링크)',
  services: '주요 서비스·민원 링크 3개 이상(내비 밖 본문 링크)',
  manifest: '앱 매니페스트 링크(<link rel=manifest>)',
  h1: '보이는 H1 제목',
  trust: '신뢰 근거 하나(후기·평점·고객 로고 줄·숫자 지표 — 사회적 증거 블록, 인용, 평점·신뢰 글)',
  whatItDoes: '「무엇을 하는지」 한 문장(동사 + 대상, 40자 이하)이 든 H1 또는 그 바로 뒤 부제',
})

/**
 * 「무엇을 하는지」 한 문장 판정표(FV1 Task 5.12 · 골든 lp-demo-clarity). 40자 이하, 어절 2개(영어 3개) 이상, 문장 꼴이 동사로 끝나거나(ko 해요체 「…해요」) 동사로 시작한다(en 「Send quotes …」·「… lets you …」).
 * 글자만 보는 어림이라 구호(「내일을 바꾸다」·「Reimagine tomorrow」)와 일을 말하는 문장(「예약 장부를 자동으로 정리해요」)을 가를 뿐, 문장이 참인지는 모른다. 정규식은 문자열로 둔다 — strictFacts 가 쪽 안에서 같은 식을 쓴다.
 */
export const WHAT_IT_DOES = Object.freeze({
  max: 40,
  koMinWords: 2,
  ko: '요[.]?$',
  enMinWords: 3,
  en: '^(?:send|track|manage|build|create|turn|find|book|get|make|plan|schedule|organi[sz]e|automate|see|share|collect|write|design|monitor|connect|import|export|invoice|bill|pay|accept|approve|publish|launch|keep|save|cut|stop|start|learn|grow|sell|ship|hire|reach|compare|convert|capture|sync|back up|split|review|sign|set up)\\b|\\b(?:lets|helps|turns|sends|tracks|makes|gives|shows|keeps|saves|builds|finds|books|manages|automates|collects|organi[sz]es|schedules)\\b',
})
/** 글 한 줄이 「무엇을 하는지」 문장인가 — 순수 함수(strictFacts 의 쪽 안 판정과 같은 식). */
export function isWhatItDoes(text, cfg = WHAT_IT_DOES) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!t || [...t].length > cfg.max) return false
  const words = t.split(' ').length
  return /[가-힣]/.test(t) ? words >= cfg.koMinWords && new RegExp(cfg.ko).test(t) : words >= cfg.enMinWords && new RegExp(cfg.en, 'i').test(t)
}

const rule = (id, what, scope, needs) => ({ id, what, scope, needs })
const n = (kind, within = 1) => ({ kind, within })
export const STRICT_BY_ARCHETYPE = Object.freeze({
  local: [rule('local-first-screen', '영업시간·위치(지도나 주소)·전화가 첫 화면권에', 'entry', [n('tel', 1), n('hours', 2), n('location', 2)])],
  commerce: [rule('commerce-price-shipping', '가격과 배송 요약이 한 쪽의 첫 두 화면 안에', 'any', [n('price', 2), n('shipping', 2)])],
  detail: [rule('detail-price-shipping', '상품 쪽 첫 두 화면 안에 가격과 배송 요약', 'entry', [n('price', 2), n('shipping', 2)])],
  saas: [rule('saas-cta-pricing', '첫 화면에 주 행동, 첫 두 화면 안에 요금 링크', 'entry', [n('cta', 1), n('pricingLink', 2)]), rule('what-it-does', '첫 화면 H1 또는 부제에 「무엇을 하는지」 한 문장(동사 + 대상, 40자 이하)', 'entry', [n('whatItDoes', 1)])],
  brand: [rule('brand-cta-nav', '첫 화면에 내비와 주 행동(문의·시작)', 'entry', [n('nav', 1), n('cta', 1)])],
  dashboard: [rule('dashboard-overview', '첫 화면에 숫자 지표, 첫 두 화면 안에 표·차트', 'entry', [n('numbers', 1), n('chart', 2)])],
  portfolio: [rule('portfolio-works-contact', '첫 두 화면 안에 작업 카드 3개와 연락 링크', 'entry', [n('works', 2), n('contact', 2)])],
  public: [rule('public-contact-services', '첫 화면에 연락처, 첫 두 화면 안에 주요 서비스 링크 3개', 'entry', [n('contact', 1), n('services', 2)])],
  landing: [rule('landing-first-screen', '첫 화면(375·1440)에 H1·주 행동·신뢰 근거 하나', 'entry', [n('h1', 1), n('cta', 1), n('trust', 1)]), rule('what-it-does', '첫 화면 H1 또는 부제에 「무엇을 하는지」 한 문장(동사 + 대상, 40자 이하)', 'entry', [n('whatItDoes', 1)])],
  pwa: [rule('pwa-manifest-action', '매니페스트가 걸려 있고 첫 화면에 주 행동', 'entry', [n('manifest', 1), n('cta', 1)])],
})

// ── 브라우저 쪽: 사실 모으기 ─────────────────────────────────────────────────
// 페이지 안에서 도는 함수(문자열로 보낸다 — 바깥 값은 못 쓴다). 판정은 안 하고 사실마다 「문서 위쪽에서부터 첫 일치의 화면 위치(top / 화면 높이)」만 돌려준다(없으면 null).
// 스크롤 0 에서 잰다. fixed·sticky 는 문서 위치가 아니라 화면 위치라 첫 화면에 들어온 것으로 센다.
export function strictFacts(cfg) {
  const vh = innerHeight
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim()
  const shown = (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && !el.closest('[hidden],[inert],template,script,style,noscript') && el.getAttribute('aria-hidden') !== 'true'
  }
  const screenOf = (el) => (el.getBoundingClientRect().top + scrollY) / vh
  const first = (els) => { const xs = els.filter(shown).map(screenOf); return xs.length ? Math.min(...xs) : null }
  const all = (sel) => [...document.querySelectorAll(sel)]
  const textHit = (re, sel = 'body *') => {
    const hits = []
    for (const el of all(sel)) {
      if (!shown(el)) continue
      const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ')
      if (re.test(norm(own))) hits.push(el)
    }
    return first(hits)
  }
  const min = (...xs) => { const v = xs.filter((x) => x !== null); return v.length ? Math.min(...v) : null }
  // 등록·기록·record 는 단어 경계로 센다(FINAL-WF B10) — 「사업자등록 확인」·「records」 같은 낱말 속 부분 일치는 주 행동이 아니다.
  const CTA = /(시작|가입|무료|체험|구매|예약|문의|신청|상담|담기|(?<![가-힣])등록|(?<![가-힣])기록|get started|sign up|start|try|buy|book|contact|join|subscribe|shop|register|\brecord\b)/i
  // 푸터·내비 안 링크는 주 행동 후보가 아니다 — 푸터의 「사업자등록 확인」·「사전 등록 안내」가 주 행동으로 읽히면 첫 화면에 행동이 없는 쪽이 통과한다.
  const NOT_CTA = 'nav,footer,[role=contentinfo],[data-slot=site-shell-nav]'
  const links = all('a[href],button').filter(shown)
  const main = document.querySelector('main') ?? document.body
  const mainLinks = [...main.querySelectorAll('a[href]')].filter((a) => shown(a) && !a.closest('nav,header,footer,[data-slot=site-shell-header]'))
  const nth = (els, k) => { const xs = els.map(screenOf).sort((a, b) => a - b); return xs.length >= k ? xs[k - 1] : null }
  // 작업 카드 = 그림 칸(img·picture·video·figure·role=img·content-figure)을 품은 링크, 또는 그림 칸과 링크를 한 카드(li·article·[data-slot=card])에 같이 둔 것 — 블록은 그림 옆 제목에 링크를 건다(ContentCards).
  // 장식 아이콘(svg)은 그림이 아니다(링크 끝 화살표가 카드로 잡히면 안 된다).
  const MEDIA = 'img,picture,video,figure,[role=img],[data-slot=content-figure]'
  const cardOf = (a) => a.closest('li,article,[data-slot=card]')
  const workCards = []
  for (const a of all('a[href]')) {
    if (!shown(a) || a.closest('nav,header,footer,[data-slot=site-shell-header]')) continue
    const holder = a.querySelector(MEDIA) ? a : cardOf(a)?.querySelector(MEDIA) ? cardOf(a) : null
    if (holder && !workCards.includes(holder)) workCards.push(holder)
  }
  // 링크가 없는 카드도 작업 카드다(QFIX3): 사례 쪽은 사례를 쓴 작업에만 있어 나머지 작업의 제목은 링크가 아니다. 그림 칸(사진을 기다리는 틀 포함 — 사진은 입력 대기 사유가 따로 막는다)과 제목이 한 카드에 있으면 센다.
  for (const h of all('h2,h3,h4')) {
    if (!shown(h) || h.closest('nav,header,footer,[data-slot=site-shell-header]')) continue
    const holder = h.closest('li,article,[data-slot=card]')
    if (holder && holder.querySelector(MEDIA) && !workCards.includes(holder)) workCards.push(holder)
  }
  // 두 홀더가 포함 관계면 안쪽 하나만 센다(FINAL-WF B4) — 「링크 안 그림 + 형제 제목」 카드는 링크(a)와 카드(li)가 둘 다 홀더로 잡혀 카드 하나가 둘로 셌다.
  const workHolders = workCards.filter((h) => !workCards.some((o) => o !== h && h.contains(o)))
  const uniq = (els) => [...new Set(els)]
  // 숫자 지표 = 글 전체가 숫자(+단위)인 가장 안쪽 칸. 값 뒤 단위를 안쪽 span 에 둔 모양(KpiTile 의 <span data-numeric>1,284<span>건</span></span>)도 읽는다 — 자식이 없는 칸만 보면 그런 지표가 통째로 빠진다(골든 dashboard-overview 6/6).
  // 보조 기술에서 숨긴 증감(aria-hidden)은 shown() 이 뺀다.
  const NUM = /^[\s$€₩]*[-+−]?\s*\d[\d,.]*\s?(%|건|개|명|원|시간|분|초|일|회|점|배|만|억|days?|h|ms|s|k|M|B)?\s*$/i
  const numberCand = all('body *').filter((el) => shown(el) && !el.closest('nav,header,footer,script,style') && NUM.test(norm(el.textContent)))
  const numberEls = numberCand.filter((el) => !numberCand.some((o) => o !== el && el.contains(o)))
  // 「무엇을 하는지」 문장 — 판정표는 WHAT_IT_DOES(위)와 같은 식이다. 후보 = H1 과 그 뒤에 오는 문단 둘.
  const isWhat = (t) => {
    t = norm(t)
    if (!t || [...t].length > cfg.max) return false
    const words = t.split(' ').length
    return /[가-힣]/.test(t) ? words >= cfg.koMinWords && new RegExp(cfg.ko).test(t) : words >= cfg.enMinWords && new RegExp(cfg.en, 'i').test(t)
  }
  // 글자 쪼개기 제목은 읽기 도구용 한 벌(sr-only)과 눈에 보이는 한 벌(aria-hidden)을 같이 둔다 — textContent 로 읽으면 글자가 두 배라 40자 문턱을 넘는다(QFIX3).
  // 「무엇을 하는지」는 접근 이름(aria-hidden 을 뺀 글)으로 읽는다.
  const a11yText = (el) => { let t = ''; const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) t += c.textContent; else if (c.nodeType === 1 && c.getAttribute('aria-hidden') !== 'true') walk(c) } }; walk(el); return t }
  const whatEls = []
  for (const h of all('h1').filter(shown)) {
    whatEls.push(h)
    whatEls.push(...all('p').filter((p) => shown(p) && h.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING).slice(0, 2))
  }
  return {
    vh, width: innerWidth,
    tel: min(first(all('a[href^="tel:"]')), textHit(/(\+?82[-\s]?)?0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}|\+\d{1,3}[-\s]\d[\d\s-]{6,}/)),
    hours: textHit(/\d{1,2}:\d{2}\s*[-~–—]\s*\d{1,2}:\d{2}|영업\s?시간|운영\s?시간|진료\s?시간|이용\s?시간|개관\s?시간|opening hours|open (daily|mon|tue|wed|thu|fri|sat|sun)|hours:/i),
    location: min(first(all('iframe[src*="map"],a[href*="map.naver.com"],a[href*="naver.me"],a[href*="map.kakao.com"],a[href*="kko.to"],a[href*="maps.google"],a[href*="goo.gl/maps"],a[href*="maps.app.goo.gl"],[data-map],img[alt*="지도"],[aria-label*="지도"]')), textHit(/[가-힣]+(로|길)\s?\d+|\d+\s+[A-Za-z]+\s+(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?)\b/i)),
    price: textHit(/(?:[₩$€]\s?\d[\d,]*(?:\.\d+)?)|(?:\d[\d,]*(?:\.\d+)?\s?(?:(?:만(?:\s?\d[\d,]*\s?천)?|천|억)\s?)?(?:원|₩|KRW|USD|달러|€))/),
    shipping: textHit(/(배송|택배|shipping|delivery|ships? (within|in|from))/i),
    cta: first(links.filter((el) => CTA.test(norm(el.textContent) || el.getAttribute('aria-label') || '') && !el.closest(NOT_CTA))),
    pricingLink: first(all('a[href]').filter((a) => /pricing|price|plans|요금|가격/i.test(a.getAttribute('href') ?? '') || /요금|가격표|pricing|plans/i.test(norm(a.textContent)))),
    nav: first(all('nav,[role=navigation]')),
    chart: first(all('table,canvas,svg[role=img],figure,[data-chart],[role=img]')),
    numbers: nth(uniq(numberEls), 3),
    works: nth(uniq(workHolders), 3),
    contact: first(all('a[href^="mailto:"],a[href^="tel:"]').concat(all('a[href]').filter((a) => /contact|문의|연락/i.test(`${a.getAttribute('href')} ${norm(a.textContent)}`)))),
    services: nth(uniq(mainLinks), 3),
    manifest: document.querySelector('link[rel=manifest]') ? 0 : null,
    h1: first(all('h1')),
    whatItDoes: first(whatEls.filter((el) => isWhat(a11yText(el)))),
    trust: min(first(all('[data-block^="social-proof"],[data-hero="centered-proof-panel"],blockquote,[itemprop=aggregateRating],[data-trust]')), textHit(/(★|평점|후기|리뷰|명이 |곳이 |trusted by|rated|reviews?|customers|teams)/i)),
  }
}

// ── 판정(순수) ───────────────────────────────────────────────────────────────

const f2 = (x) => (x === null || x === undefined ? null : Math.round(x * 100) / 100)

/**
 * @param {string} archetype
 * @param {{ route: string, id?: string, entry?: boolean, legal?: boolean, profiles: Record<string, object|null> }[]} pages
 *   profiles[프로필 id] = strictFacts() 결과(못 잰 쪽은 null)
 * @returns {{ archetype: string, rules: { id: string, status: 'pass'|'fail'|'na', route?: string, problems: string[] }[], fail: string[], na: string[] }}
 */
export function judgeStrict(archetype, pages) {
  const rules = STRICT_BY_ARCHETYPE[archetype]
  if (!rules) throw new Error(`엄격 기준이 없는 원형: ${archetype}`)
  const out = []
  for (const r of rules) {
    const pool = r.scope === 'entry' ? pages.filter((p) => p.entry) : pages.filter((p) => !p.legal)
    if (!pool.length) { out.push({ id: r.id, status: 'na', problems: [`${r.scope === 'entry' ? '첫 쪽' : '일반 쪽'}을 못 찾아 재지 못했다 — ${r.what}`] }); continue }
    // 쪽마다 모든 needs 를 모든 프로필에서 채우는지 본다. any 는 채운 쪽이 하나라도 있으면 통과, 없으면 가장 적게 어긴 쪽의 문제를 보인다.
    const tries = pool.map((p) => {
      const problems = []
      for (const prof of PROFILES) {
        const facts = p.profiles?.[prof.id]
        if (!facts) { problems.push(`${p.route} ${prof.id}: 측정값 없음`); continue }
        for (const need of r.needs) {
          const at = facts[need.kind]
          if (at === null || at === undefined) problems.push(`${p.route} ${prof.id}(${prof.width}): ${need.kind} 없음 — ${FACT_KINDS[need.kind]}`)
          else if (at >= need.within) problems.push(`${p.route} ${prof.id}(${prof.width}): ${need.kind} 가 ${f2(at)}화면째에 있다(${need.within}화면 안이어야 한다)`)
        }
      }
      return { p, problems }
    })
    const ok = tries.find((t) => !t.problems.length)
    if (ok) out.push({ id: r.id, status: 'pass', route: ok.p.route, problems: [] })
    else {
      const best = tries.reduce((a, b) => (b.problems.length < a.problems.length ? b : a))
      const unmeasured = best.problems.every((x) => /측정값 없음/.test(x))
      out.push({ id: r.id, status: unmeasured ? 'na' : 'fail', route: best.p.route, problems: best.problems.map((x) => `[${r.id}] ${x}`) })
    }
  }
  return { archetype, rules: out, fail: out.filter((x) => x.status === 'fail').map((x) => x.id), na: out.filter((x) => x.status === 'na').map((x) => x.id) }
}

// ── Chrome 측정 ───────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 쪽 여러 개를 프로필마다 열어 strictFacts 를 모은다. 열리지 않으면 던진다(`도구 실패:` 로 읽힌다). → pages[].profiles */
export async function measureStrict(origin, routes, { chromeArgs = [] } = {}) {
  const chrome = await startChrome(['--hide-scrollbars', ...chromeArgs], { prefix: 'strict-' })
  try {
    const s = await connect(chrome.wsUrl)
    await s.send('Page.enable'); await s.send('Runtime.enable')
    const out = []
    for (const route of routes) {
      const profiles = {}
      for (const prof of PROFILES) {
        await s.send('Emulation.setDeviceMetricsOverride', { width: prof.width, height: prof.height, deviceScaleFactor: 1, mobile: false })
        const target = `${origin}${route}`
        await assertOpened(await navigateAndWait(s.send, s.ev, target, { timeoutMs: 60000 }), s.ev, target)
        await s.ev('document.fonts.ready.then(() => 1)'); await sleep(800)
        const facts = await s.ev(`(${strictFacts.toString()})(${JSON.stringify(WHAT_IT_DOES)})`)
        if (!facts) throw new Error(`페이지 측정 실패(strictFacts 가 값을 안 줬다): ${target}`)
        profiles[prof.id] = facts
      }
      out.push({ route, profiles })
    }
    s.ws.close()
    return out
  } finally {
    await chrome.close()
  }
}

// ── 후보 어댑터(07-qa 가 부른다) ──────────────────────────────────────────────

const readJsonMaybe = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }

/**
 * 후보의 사이트 설명(site.json pages)에서 쪽을 고르고 잰 뒤 판정한다. 기록 모양은 ops·a11y 어댑터와 같다: { id, tool, exit, verdict, toolFailure, note, problems, … }.
 * @param {{ origin: string, routes?: string[], archetype?: string, measure?: Function, entryId?: string }} opts  measure(origin, routes) → pages[].profiles (시험이 가짜로 바꾼다)
 */
export async function strictGateForCandidate(runDir, cand, { origin, routes, archetype, entryId, measure = measureStrict } = {}) {
  if (!origin) throw new Error('strictGateForCandidate: origin 이 필요하다')
  const candDir = join(runDir, cand.id)
  const siteJson = readJsonMaybe(join(candDir, 'site', 'content', 'site.json'))
  if (!siteJson) throw new Error(`도구 실패: ${join(candDir, 'site', 'content', 'site.json')} 없음 — 06-pages 를 먼저 돌린다`)
  const arch = archetype ?? siteJson.archetype
  const dir = join(candDir, '07-qa', 'strict')
  const file = join(dir, 'strict.json')
  rmSync(file, { force: true })
  mkdirSync(dir, { recursive: true })
  const t0 = Date.now()
  const base = { id: 'strict', tool: 'strict', attempts: 1 }
  const tool = (note) => ({ ...base, exit: 1, verdict: 'tool', toolFailure: true, note, seconds: Math.round((Date.now() - t0) / 100) / 10 })
  if (!STRICT_BY_ARCHETYPE[arch]) return tool(`엄격 기준이 없는 원형: ${arch}`)
  const pageMeta = Object.entries(siteJson.pages ?? {}).map(([route, p]) => ({ route, id: p.id, legal: p.legal === true || p.kind === 'legal' }))
  const open = routes ? pageMeta.filter((p) => routes.includes(p.route)) : pageMeta
  const entryPageId = entryId ?? (siteJson.entry ?? null)
  const entry = (entryPageId && open.find((p) => p.id === entryPageId)) ?? open.find((p) => p.route === '/') ?? open.find((p) => !p.legal)
  const needAny = STRICT_BY_ARCHETYPE[arch].some((r) => r.scope === 'any')
  const toMeasure = open.filter((p) => !p.legal && (needAny || p === entry))
  if (!toMeasure.length) return tool('잴 쪽이 없다 — 열린 일반 쪽이 하나도 없다')
  let measured
  try { measured = await measure(origin, toMeasure.map((p) => p.route)) } catch (e) { return tool(`도구 실패: ${e.message}`) }
  const pages = toMeasure.map((p) => ({ ...p, entry: p === entry, profiles: measured.find((m) => m.route === p.route)?.profiles ?? {} }))
  const j = judgeStrict(arch, pages)
  const bad = j.rules.filter((r) => r.status !== 'pass') // na 도 실패로 읽는다(A123)
  const problems = bad.flatMap((r) => r.problems)
  const verdict = bad.length ? 'fail' : 'pass'
  const record = {
    ...base, exit: bad.length ? 1 : 0, verdict, toolFailure: false,
    note: bad.length ? `원형 엄격 기준 ${bad.length}건: ${bad.map((r) => r.id + (r.status === 'na' ? '(na)' : '')).join('·')}` : '', problems,
    archetype: arch, rules: j.rules.map((r) => ({ id: r.id, status: r.status, route: r.route })), seconds: Math.round((Date.now() - t0) / 100) / 10,
  }
  writeFileSync(file, JSON.stringify({ candidate: cand.id, archetype: arch, origin, pages: pages.map((p) => ({ route: p.route, entry: p.entry, profiles: p.profiles })), judge: j }, null, 2) + '\n')
  record.resultFile = file.slice(candDir.length + 1).replace(/\\/g, '/')
  return record
}
