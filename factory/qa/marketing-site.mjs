// 마케팅 관문 사이트 단위(P3-4 Task 2, 대장 C45·C62·A122):
//   node marketing-site.mjs <origin> --sitemap <02-sitemap.json> [--out <dir>] [--width 1440] [--height 900]
//   import { marketingSite, marketingSiteForCandidate } from './marketing-site.mjs'
// marketing-gate.mjs 는 쪽 하나를 잰다. 여기는 후보 사이트 전체를 잰다 — 쪽 단위 결과는 그대로 싣고(`pages`) 사이트 단위 셋을 더한다.
//   ① 여러 쪽 흐름(`flows`): 가입(signup)·해지(cancel)·온보딩(onboarding)을 쪽을 건너 걸으며 단계·클릭을 센다. 해지 클릭 ≤ 가입 클릭.
//      흐름 표지는 P3-2 약속 그대로다(`data-flow`+`data-steps`+`data-step`) — 여러 쪽에 걸친 흐름을 위해 세 가지를 더한다:
//        · `data-flow-entry="<흐름>"` 흐름 밖 쪽(홈의 가입 버튼·/account 의 해지 링크)에서 흐름 첫 쪽으로 가는 링크. 누르면 클릭 1로 센다.
//        · `data-flow-next` 다음 쪽·단계로 가는 진행 버튼(흐름 요소 안). 해지는 없으면 `data-choice=decline` 을 진행 버튼으로 본다.
//        · `data-flow-done` 완료 표지(해지는 `data-end-date` 도 완료). 마지막 단계(step === steps)에 진행 버튼이 없으면 그 자리가 끝이다.
//      가입·온보딩이 눌러서 걷기 어려운 입력 폼이면(진행 버튼이 안 넘어감) 선언한 data-steps 로 센다(`basis: declared`, 클릭 = steps − 1).
//   ② 전환 경로(C45): 사이트형 폼(로그인·가입 흐름·검색 제외)에 시험 값을 채워 눌러 보고 본다 — 수신 경로에 닿았는가(POST·mailto/tel 이동·폼 이동·새 창),
//      확인 글(`role=status`)이 떴는가, 폼 `action` 이 `mailto:` 가 아닌가. 화면 안에서만 성공을 그리는 폼(전선에 아무것도 안 나감)은 실패다.
//      경로 관찰은 문서 시작 때 심는 갈고리(fetch·XHR·sendBeacon·window.open·Navigation API)다 — 페이지 이동에도 sessionStorage 로 이어진다.
//   ③ 문체(C62): 쪽마다 합쇼체·해요체를 센다(인용 blockquote·q·[data-quote]·법정 문구 [data-legal]·법정 쪽 제외).
//      한 쪽 안 CTA(a·button 글자)끼리 섞이면 실패(must), 본문 문장이 섞이면 경고(should).
//   ④ 사람 확인 목록(A122): 기계로 못 잰 MUST 를 `MANUAL_CHECKS` 표(규칙 id·확인 방법·예시)로 두고 결과의 `manualChecks` 로 싣는다.
// 종료: 0 = 쟀고 MUST 어김 없음 · 1 = 어김 있음(결과 파일 있음) 또는 도구 실패(`도구 실패:` 를 적고 결과 파일을 남기지 않는다) · 2 = 인자 오류. (docs/agents/agent-guide.md 관문 표)
// `na`(잴 것이 없음)는 통과가 아니다 — 규칙마다 따로 세고, 쪽·사이트 규칙이 전부 `na` 면 도구 실패다(interpretSite).
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, navigateAndWait, connect } from './cdp.mjs'
import { gateOnPage } from './marketing-gate.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 규칙표(사이트 단위) ─────────────────────────────────────────────────────────────────────────────
export const SITE_RULES = [
  { id: 'flow-reach', level: 'must', src: 'factory-rules.md §22-1 L4·L5 · 대장 A122', what: '걷는 흐름(가입·해지·온보딩)이 진행 버튼만 눌러 끝(완료 표지 또는 마지막 단계)에 닿는다', how: '흐름 첫 쪽(data-flow-entry → 없으면 data-flow 가 있는 쪽)에서 data-flow-next(해지는 data-choice=decline)를 눌러 쪽을 건넌다' },
  { id: 'flow-cancel-le-signup', level: 'must', src: 'factory-rules.md §22-1 L4·L5', what: '해지 클릭·단계 ≤ 가입 클릭·단계(쪽을 건너 센다) — 가입 흐름이 없으면 비교하지 못한 것으로 실패', how: '두 흐름을 같은 걸음으로 걸어 클릭(첫 링크 포함)과 선언한 data-steps 를 견준다' },
  { id: 'conv-reaches-receiver', level: 'must', src: '대장 C45 ①', what: '사이트형 폼 제출이 수신 경로에 닿는다(POST·mailto/tel 이동·폼 이동·새 창) — 화면 안에서만 성공을 그리면 실패', how: '시험 값을 채워 제출을 눌러 갈고리에 찍힌 경로를 본다(4xx·5xx 응답도 실패)' },
  { id: 'conv-confirmation', level: 'must', src: '대장 C45 ①', what: '제출 뒤 보이는 확인 글(role=status)이 뜬다', how: '제출 전에 없던 role=status 글이 화면에 보이는지(이동한 쪽 포함)' },
  { id: 'conv-no-mailto-action', level: 'must', src: '대장 C45 ①', what: '폼 주 제출이 form action="mailto:" 가 아니다(브라우저·메일 앱에 맡겨 확인 화면이 없다)', how: 'form[action]·[formaction] 이 mailto: 로 시작하면 실패' },
  { id: 'tone-cta-mixed', level: 'must', src: 'DESIGN 120행 · 대장 C62', what: '한 쪽 안의 CTA(a·button 글자)가 합쇼체와 해요체를 섞지 않는다', how: 'CTA 글자의 문장 끝(니다·니까·십시오 / 해요·예요·세요·죠…)을 분류해 두 갈래가 함께 있으면 실패' },
  { id: 'tone-page-mixed', level: 'should', src: 'DESIGN 120행 · 대장 C62', what: '한 쪽 본문이 합쇼체와 해요체를 섞지 않는다(인용·후기·법정 문구 제외)', how: '본문 문장 끝을 분류해 두 갈래가 함께 있으면 경고' },
]

// A122 — 기계로 못 잰 MUST. 보드 카드에 「사람 확인 n개」로 보이도록 결과·07-qa 요약에 그대로 싣는다.
export const MANUAL_CHECKS = [
  { id: 'P2', how: '무료 체험 시작 화면을 열어 체험 기간·첫 청구일·자동 갱신·해지 방법이 스크롤 없이 같은 화면에 함께 있는지 본다', example: '「7일 무료 · 8일째 9,900원 결제 · 자동 갱신 · 설정에서 언제든 해지」가 한 카드에 있다' },
  { id: 'L6', how: '가격 인상 안내 화면·메일 문구에서 새 가격 적용 30일 전에 동의를 받는지 본다', example: '「12월 1일부터 월 12,900원 — 동의하시면 유지, 아니면 11월 30일까지 해지」' },
  { id: 'L7', how: '팝업의 「7일간 보지 않기」를 눌러 닫고 새로고침해 7일 안에 다시 뜨지 않는지 본다', example: '닫은 뒤 새로고침해도 팝업이 없다' },
  { id: 'A1', how: '히어로를 5초만 보여 주고 무엇을 하는 곳인지·누구를 위한 것인지 한 문장으로 말할 수 있는지 시험한다', example: '「동네 빵집 예약을 문자로 받아 주는 도구」' },
  { id: 'A2', how: '뷰포트마다(데스크톱·모바일) 눈에 띄는 주 CTA(data-primary-action)가 하나뿐인지 본다', example: '히어로에 채운 버튼 하나, 나머지는 테두리 버튼' },
  { id: 'A3', how: '375×812 첫 화면에 주 CTA 가 스크롤 없이 들어오는지 본다', example: '히어로 제목 아래 바로 「무료로 시작하기」' },
  { id: 'verb-name', how: '누를 것의 접근 이름이 동사형인지 본다(관문은 금지어 「확인·제출」만 잡는다)', example: '「확인」 대신 「예약 내용 확인하기」' },
  { id: 'price-cycle', how: '모든 가격에 요금 주기(월·연·1회)가 붙어 있는지 본다', example: '「9,900원」 대신 「월 9,900원」' },
  { id: 'exit-intent', how: '이탈 의도 팝업이 방문당 한 번만 뜨는지 본다(마우스를 위로 두 번 빼 본다)', example: '두 번째 이탈에는 팝업이 없다' },
]

// ── 문체(C62) — 순수 함수 ────────────────────────────────────────────────────────────────────────────
const TAIL = /[\s.!?…~。"'”’)\]〉》」』♥♡✨]+$/u
const stripTail = (s) => s.replace(TAIL, '').replace(/\p{Extended_Pictographic}+$/u, '').replace(TAIL, '')
/** 문장 끝이 합쇼체(-ㅂ니다·-습니까·-십시오)면 'hapsyo', 해요체(-어요·-예요·-세요·-죠)면 'haeyo', 그 밖(명사 끝·해체·이름표)은 'other'. */
export function classifyEnding(sentence) {
  const s = stripTail(String(sentence ?? '').trim())
  if (!s) return 'other'
  if (/(니다|니까|십시오)$/.test(s)) return 'hapsyo'
  if (/(?:[해이예세어아에네군나지래대돼되줘워와봐려까가든게데서]요|죠)$/.test(s)) return 'haeyo'
  return 'other'
}
/** 글 하나를 문장으로 쪼갠다(마침표류 뒤 공백·줄바꿈). 빈 조각은 버린다. */
export const splitSentences = (text) => String(text ?? '').split(/(?<=[.!?…。])\s+|\n+/).map((x) => x.trim()).filter(Boolean)

const emptyCount = () => ({ hapsyo: 0, haeyo: 0, other: 0 })
/**
 * 쪽마다 문체 사실(body·ctas 글 목록)을 판정한다. 법정 쪽(legal)은 통째로 뺀다.
 * @param {{ route: string, legal?: boolean, body: string[], ctas: string[] }[]} pages
 * @returns {{ route, legal, excluded, counts, ctaCounts, ctaTexts, dominant, mixed, ctaMixed, samples }[]}
 */
export function judgeTone(pages) {
  return pages.map((p) => {
    const base = { route: p.route, legal: p.legal === true }
    if (p.legal) return { ...base, excluded: true, counts: emptyCount(), ctaCounts: emptyCount(), ctaTexts: { hapsyo: [], haeyo: [] }, dominant: null, mixed: false, ctaMixed: false, samples: { hapsyo: [], haeyo: [] } }
    const counts = emptyCount(), ctaCounts = emptyCount()
    const samples = { hapsyo: [], haeyo: [] }
    const ctaTexts = { hapsyo: [], haeyo: [] }
    for (const t of p.body ?? []) for (const s of splitSentences(t)) {
      const k = classifyEnding(s)
      counts[k]++
      if (k !== 'other' && samples[k].length < 3) samples[k].push(s.slice(0, 60))
    }
    for (const t of p.ctas ?? []) {
      const k = classifyEnding(t)
      ctaCounts[k]++
      if (k !== 'other' && !ctaTexts[k].includes(t)) ctaTexts[k].push(t.slice(0, 40))
    }
    const dominant = counts.hapsyo === counts.haeyo ? (counts.hapsyo === 0 ? null : 'tie') : counts.hapsyo > counts.haeyo ? 'hapsyo' : 'haeyo'
    return { ...base, excluded: false, counts, ctaCounts, ctaTexts, dominant, mixed: counts.hapsyo > 0 && counts.haeyo > 0, ctaMixed: ctaCounts.hapsyo > 0 && ctaCounts.haeyo > 0, samples }
  })
}

// ── 흐름(가입·해지·온보딩) — 순수 판정 ────────────────────────────────────────────────────────────────
export const FLOW_IDS = ['signup', 'cancel', 'onboarding']
/**
 * 흐름 하나를 판정한다. walk = { id, entryRoute?, pages[], clicks, entryClicks, steps, stepsSeen[], reachedEnd, basis, stuck?, noControl? }.
 * 가입·온보딩이 눌러 걸을 수 없는 입력 폼이면 선언한 steps 로 센다(basis 'declared') — 이때 clicks = steps − 1 + entryClicks. 해지는 바꾸지 않는다(끝에 못 닿으면 실패).
 */
export function finishWalk(walk) {
  const w = { ...walk }
  if (w.id !== 'cancel' && !w.reachedEnd && Number.isInteger(w.steps) && w.steps >= 1) {
    w.basis = 'declared'
    w.clicks = w.steps - 1 + (w.entryClicks ?? 0)
    w.reachedEnd = true
    w.note = '진행 버튼으로 걸을 수 없어(입력 폼) 선언한 data-steps 로 센다'
  }
  return w
}
export function judgeFlows(walks) {
  const by = Object.fromEntries(walks.map((w) => [w.id, w]))
  const reach = { probs: [], measured: 0 }
  for (const w of walks) {
    reach.measured++
    if (!w.reachedEnd) reach.probs.push(`${w.id}: 끝에 닿지 못했다(누른 ${w.clicks}번, 본 쪽 ${w.pages.join('→') || '없음'}${w.stuck ? `, ${w.stuck}에서 눌러도 안 넘어감` : ''}${w.noControl ? `, ${w.noControl}에 진행 버튼이 없다` : ''})`)
  }
  const cmp = { probs: [], measured: 0 }
  if (by.cancel) {
    cmp.measured = 1
    const s = by.signup
    if (!s) cmp.probs.push('가입 흐름이 없어 해지와 견주지 못했다(data-flow=signup 이 있는 쪽이 사이트맵에 필요하다)')
    else {
      if (by.cancel.clicks > s.clicks) cmp.probs.push(`해지 클릭 ${by.cancel.clicks} > 가입 클릭 ${s.clicks}${s.basis === 'declared' ? '(선언한 단계 기준)' : ''}`)
      const cs = by.cancel.steps ?? by.cancel.stepsSeen.length
      const ss = s.steps ?? s.stepsSeen.length
      if (cs > ss) cmp.probs.push(`해지 ${cs}단계 > 가입 ${ss}단계`)
    }
  }
  return { reach, cmp }
}

// ── 전환 경로(C45) — 순수 판정 ────────────────────────────────────────────────────────────────────────
const NOISE = /analytics|track|collect|beacon|gtag|vitals|_vercel|_next|telemetry|\/log(?:$|[/?])/i
const ok2 = (st) => Number.isInteger(st) && st >= 200 && st < 400
/**
 * 갈고리 기록(hits) → 수신 경로. hits: [{ kind: fetch|xhr|beacon|nav|open|submit|navdoc, method?, url?, status?, form?, protocol? }]
 * 반환 { via: 'network'|'mailto'|'tel'|'open'|'form-nav'|null, errors[], notes[] }.
 */
export function classifyHits(hits) {
  const errors = [], notes = []
  let via = null
  const set = (v) => { via ??= v }
  for (const h of hits) {
    const url = String(h.url ?? '')
    if (h.kind === 'fetch' || h.kind === 'xhr' || h.kind === 'beacon') {
      if (NOISE.test(url)) continue
      const method = String(h.method ?? 'GET').toUpperCase()
      if (method === 'GET' && h.kind !== 'beacon') continue
      if (h.kind === 'beacon') { set('network'); continue }
      if (ok2(h.status)) set('network')
      else errors.push(`${method} ${url} → ${h.status || '응답 없음'}`)
    } else if (h.kind === 'nav') {
      if (/^mailto:/i.test(url)) set('mailto')
      else if (/^tel:/i.test(url)) set('tel')
    } else if (h.kind === 'open') {
      if (/^(mailto|tel):/i.test(url)) set(/^tel:/i.test(url) ? 'tel' : 'mailto')
      else if (/^https?:/i.test(url)) set('open')
    } else if (h.kind === 'navdoc') {
      // 폼 이동 뒤 새 문서의 응답 상태
      if (ok2(h.status)) set('form-nav')
      else errors.push(`폼 이동 ${url} → ${h.status || '응답 없음'}`)
    }
  }
  return { via, errors, notes }
}

/** 전환 사실 → 규칙 셋의 재료. conv = [{ route, form, filled, blocked?, via, errors, status(text|null), mailtoAction }] */
export function judgeConversion(convs) {
  const reach = { probs: [], measured: 0 }, conf = { probs: [], measured: 0 }, mailto = { probs: [], measured: 0 }
  for (const c of convs) {
    if (c.skipped) continue
    mailto.measured++
    if (c.mailtoAction) mailto.probs.push(`${c.route}: 폼 action 이 mailto: 다(${c.mailtoAction})`)
    if (c.measured === false) continue
    reach.measured++
    if (!c.via) reach.probs.push(`${c.route}: 제출이 수신 경로에 닿지 않았다${c.blocked ? `(입력 검증에 막혔다: ${c.blocked})` : c.errors?.length ? `(${c.errors.join(' · ')})` : c.status ? '(화면 안에서만 「완료」를 그렸다 — 전선에 나간 요청·이동이 없다)' : ''}${c.alerts?.length ? ` — 화면 알림: ${c.alerts.join(' / ').slice(0, 120)}` : ''}`)
    else if (c.errors?.length) reach.probs.push(`${c.route}: 수신 경로가 오류로 답했다(${c.errors.join(' · ')})`)
    conf.measured++
    if (!c.status) conf.probs.push(`${c.route}: 제출 뒤 role=status 확인 글이 뜨지 않았다`)
  }
  return { reach, conf, mailto }
}

// ── 사이트 판정 ──────────────────────────────────────────────────────────────────────────────────────
const byId = Object.fromEntries(SITE_RULES.map((r) => [r.id, r]))
function ruleOf(id, probs, measured) {
  const level = byId[id].level
  const status = measured === 0 ? 'na' : probs.length ? (level === 'must' ? 'fail' : 'warn') : 'pass'
  return { id, level, status, measured, detail: probs }
}
/** { walks, conversions, tone } → 사이트 규칙 상태. */
export function judgeSite({ walks = [], conversions = [], tone = [] }) {
  const f = judgeFlows(walks)
  const c = judgeConversion(conversions)
  const ctaMixedPages = tone.filter((t) => t.ctaMixed)
  const pageMixed = tone.filter((t) => t.mixed)
  const toneMeasured = tone.filter((t) => !t.excluded)
  const ctaMeasured = toneMeasured.filter((t) => t.ctaCounts.hapsyo + t.ctaCounts.haeyo > 0).length
  const bodyMeasured = toneMeasured.filter((t) => t.counts.hapsyo + t.counts.haeyo > 0).length
  return [
    ruleOf('flow-reach', f.reach.probs, f.reach.measured),
    ruleOf('flow-cancel-le-signup', f.cmp.probs, f.cmp.measured),
    ruleOf('conv-reaches-receiver', c.reach.probs, c.reach.measured),
    ruleOf('conv-confirmation', c.conf.probs, c.conf.measured),
    ruleOf('conv-no-mailto-action', c.mailto.probs, c.mailto.measured),
    ruleOf('tone-cta-mixed', ctaMixedPages.map((t) => `${t.route}: CTA 가 합쇼체(${t.ctaTexts.hapsyo.join('·')})와 해요체(${t.ctaTexts.haeyo.join('·')})를 섞었다`), ctaMeasured),
    ruleOf('tone-page-mixed', pageMixed.map((t) => `${t.route}: 본문이 합쇼체 ${t.counts.hapsyo}문장·해요체 ${t.counts.haeyo}문장을 섞었다(예: 「${t.samples.hapsyo[0]}」 ↔ 「${t.samples.haeyo[0]}」)`), bodyMeasured),
  ]
}

/** 종료 코드·판정. pages 의 쪽 규칙 어김도 실패에 든다. 쪽·사이트 규칙이 전부 na 이면 도구 실패(통과가 아니다). */
export function interpretSite(result) {
  const pageFails = result.pages.flatMap((p) => (p.result.fail ?? []).map((id) => `page:${p.route}:${id}`))
  const siteFails = result.rules.filter((r) => r.status === 'fail').map((r) => r.id)
  const fail = [...siteFails, ...pageFails]
  const warn = [...result.rules.filter((r) => r.status === 'warn').map((r) => r.id), ...result.pages.flatMap((p) => (p.result.warn ?? []).map((id) => `page:${p.route}:${id}`))]
  const measured = result.rules.some((r) => r.status !== 'na') || result.pages.some((p) => p.result.rules.some((r) => r.status !== 'na'))
  if (!measured) return { exit: 1, verdict: 'tool', toolFailure: true, note: '도구 실패: 쪽·사이트 규칙이 전부 na — 아무것도 재지 못했다(통과가 아니다)', fail, warn }
  return { exit: fail.length ? 1 : 0, verdict: fail.length ? 'fail' : 'pass', toolFailure: false, note: fail.length ? `MUST 어김: ${fail.join(' · ')}` : `어김 0 · 경고 ${warn.length} · na ${result.rules.filter((r) => r.status === 'na').length}`, fail, warn }
}

// ── 브라우저 쪽 함수(문자열로 보낸다 — 바깥 값은 못 쓴다) ──────────────────────────────────────────────
// 갈고리: 문서 시작 때 심는다. 기록은 sessionStorage 에 쌓아 폼 이동에도 이어진다.
const HOOK = `(() => {
  if (window.__wfHook) return
  window.__wfHook = 1
  const K = '__wfHits'
  const read = () => { try { return JSON.parse(sessionStorage.getItem(K) || '[]') } catch { return [] } }
  const add = (h) => { try { const a = read(); a.push(h); sessionStorage.setItem(K, JSON.stringify(a)) } catch {} }
  const abs = (u) => { try { return new URL(String(u && u.url ? u.url : u), location.href).href } catch { return String(u) } }
  try {
    const nav = performance.getEntriesByType('navigation')[0]
    if (nav && sessionStorage.getItem('__wfPending')) {
      add({ kind: 'navdoc', url: location.href, status: nav.responseStatus || 0 })
      sessionStorage.removeItem('__wfPending')
    }
  } catch {}
  const of = window.fetch
  window.fetch = function (i, o) {
    const method = String((o && o.method) || (i && i.method) || 'GET').toUpperCase()
    const url = abs(i)
    const p = of.apply(this, arguments)
    p.then((r) => add({ kind: 'fetch', method, url, status: r.status }), () => add({ kind: 'fetch', method, url, status: 0 }))
    return p
  }
  const xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u) { this.__wf = { method: String(m).toUpperCase(), url: abs(u) }; return xo.apply(this, arguments) }
  XMLHttpRequest.prototype.send = function () {
    const x = this
    x.addEventListener('loadend', () => x.__wf && add({ kind: 'xhr', method: x.__wf.method, url: x.__wf.url, status: x.status }))
    return xs.apply(this, arguments)
  }
  const sb = navigator.sendBeacon && navigator.sendBeacon.bind(navigator)
  if (sb) navigator.sendBeacon = (u, d) => { add({ kind: 'beacon', method: 'POST', url: abs(u), status: 200 }); return sb(u, d) }
  const wo = window.open
  window.open = function (u) { add({ kind: 'open', url: abs(u) }); return wo.apply(this, arguments) }
  try {
    navigation.addEventListener('navigate', (e) => {
      add({ kind: 'nav', url: e.destination.url })
    })
  } catch {}
  // 자바스크립트가 가로채지 않은 폼 제출은 문서를 옮긴다 — 다음 문서의 갈고리가 응답 상태를 적도록 표시한다(GET 폼은 navigate 이벤트에 formData 가 없다).
  window.addEventListener('submit', (e) => {
    if (e.defaultPrevented) return
    add({ kind: 'submit', method: String(e.target.method || 'get').toUpperCase(), url: abs(e.target.action) })
    try { sessionStorage.setItem('__wfPending', '1') } catch {}
  })
})()`

// 쪽 탐침: 흐름·흐름 진입 링크·폼·문체 글을 한 번에 모은다. 판정은 하지 않는다.
function pageProbe() {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const flows = [...document.querySelectorAll('[data-flow]')].filter(vis).map((e) => ({ flow: e.getAttribute('data-flow'), step: Number(e.getAttribute('data-step')) || null, steps: Number(e.getAttribute('data-steps')) || null }))
  const entries = [...document.querySelectorAll('[data-flow-entry]')].filter(vis).map((e) => ({ flow: e.getAttribute('data-flow-entry'), text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) }))
  const forms = [...document.forms].map((f, index) => {
    const search = f.matches('[role=search]') || !!f.querySelector('input[type=search]')
    const password = !!f.querySelector('input[type=password]')
    const inFlow = !!f.closest('[data-flow]')
    const texty = !!f.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=search]):not([type=password]), textarea')
    const act = f.getAttribute('action') || ''
    const fa = [...f.querySelectorAll('[formaction]')].map((b) => b.getAttribute('formaction'))
    const mailtoAction = /^mailto:/i.test(act) ? act.slice(0, 60) : (fa.find((x) => /^mailto:/i.test(x)) || '').slice(0, 60) || null
    return { index, action: act.slice(0, 80), conv: vis(f) && !search && !password && !inFlow && texty, mailtoAction, why: search ? 'search' : password ? 'password' : inFlow ? 'in-flow' : !texty ? 'no-text-field' : '' }
  })
  const skip = 'blockquote, q, cite, [data-quote], [data-legal], [data-sticky-nav], script, style, noscript, template, svg'
  const inSkip = (e) => !!e.closest(skip)
  const ctaSel = 'a[href], button, [role=button], input[type=submit]'
  const ctas = [...document.querySelectorAll(ctaSel)].filter((e) => vis(e) && !inSkip(e) && !e.closest('nav, [role=navigation]')).map((e) => (e.tagName === 'INPUT' ? e.value : e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 2 && t.length <= 40)
  const blockSel = 'p, li, dd, dt, td, th, h1, h2, h3, h4, h5, h6, figcaption, label, small, summary, legend, div, section, article, header, footer, span'
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const groups = new Map()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!el || inSkip(el) || el.closest(ctaSel) || el.closest('nav, [role=navigation]') || !vis(el)) continue
    const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim()
    if (!t) continue
    const block = el.closest(blockSel) || el
    groups.set(block, (groups.get(block) || '') + ' ' + t)
  }
  const body = [...groups.values()].map((t) => t.trim()).filter(Boolean)
  return { url: location.pathname + location.search, flows, entries, forms, ctas, body }
}

// 흐름 상태: 지금 쪽에서 이 흐름이 어디까지 왔고 다음에 무엇을 누르나(좌표).
function flowState(F) {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const f = [...document.querySelectorAll('[data-flow="' + F + '"]')].find(vis) ?? null
  const done = [...document.querySelectorAll(F === 'cancel' ? '[data-flow-done],[data-end-date]' : '[data-flow-done]')].some(vis)
  const scope = f ?? document
  const pick = (sel) => [...scope.querySelectorAll(sel)].find((e) => vis(e) && !e.disabled && e.getAttribute('aria-disabled') !== 'true')
  const explicit = pick('[data-flow-next]')
  const el = explicit ?? (F === 'cancel' ? pick('[data-choice=decline]') : null)
  let next = null
  if (el) { el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); next = { x: r.left + r.width / 2, y: r.top + r.height / 2 } }
  return { path: location.pathname, hasFlow: !!f, step: f ? Number(f.getAttribute('data-step')) || null : null, steps: f ? Number(f.getAttribute('data-steps')) || null : null, done, explicit: !!explicit, next }
}

// 시험 값 채우기(React 제어 입력도 받도록 원형 setter 를 쓴다). 반환: { filled: 이름[], unfilled: 이름[] }
function fillForm(index) {
  const f = document.forms[index]
  if (!f) return null
  const setVal = (el, v) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const filled = [], unfilled = []
  const seenRadio = new Set()
  const clickedInputs = new Set() // 이미 누른 체크 입력 — 짝인 role=checkbox 를 또 누르면 두 번 토글돼 체크가 풀린다(FINAL-WF B9)
  for (const el of f.elements) {
    if (el.disabled || el.type === 'hidden' || el.type === 'submit' || el.type === 'button' || el.type === 'reset' || el.type === 'file') continue
    const name = el.name || el.id || el.type
    if (el.type === 'checkbox') {
      // 필수 동의만 체크한다(required·aria-required·data-consent=required, 또는 이름·라벨이 동의·약관인데 선택·마케팅이 아닌 것). 선택 동의는 그대로 둔다.
      const label = (el.labels && el.labels[0] ? el.labels[0].textContent : '') + ' ' + (el.getAttribute('aria-label') || '')
      const tag = el.name + ' ' + label
      const optional = el.getAttribute('data-consent') === 'optional' || /marketing|newsletter|promo|optional|선택|광고|이벤트|마케팅/i.test(tag)
      const required = el.required || el.getAttribute('aria-required') === 'true' || el.getAttribute('data-consent') === 'required' || (/consent|agree|terms|privacy|동의|약관/i.test(tag) && !optional)
      if (required && !el.checked) { el.click(); clickedInputs.add(el); filled.push(name) }
      continue
    }
    if (el.type === 'radio') { if (!seenRadio.has(el.name)) { seenRadio.add(el.name); if (!f.querySelector('input[type=radio][name="' + el.name + '"]:checked')) el.click(); filled.push(name) } continue }
    if (el instanceof HTMLSelectElement) { const o = [...el.options].find((x) => x.value && !x.disabled); if (o) { setVal(el, o.value); filled.push(name) } else unfilled.push(name); continue }
    const t = el.type
    const v = t === 'email' ? 'test@example.com' : t === 'tel' ? '010-1234-5678' : t === 'url' ? 'https://example.com' : t === 'number' ? '1' : t === 'date' ? '2030-01-01' : t === 'password' ? 'Test-1234-abcd' : el instanceof HTMLTextAreaElement ? '시험 문의예요. 답을 주시면 고마워요.' : '테스트'
    setVal(el, v)
    filled.push(name)
  }
  // 입력 칸이 아니라 role=checkbox 로 그린 동의 칸(Base UI 체크박스 — 실제 입력은 숨은 칸)도 같은 규칙으로 필수 동의만 체크한다(QFIX3: 못 체크하면 사람이면 누를 동의를 안 눌러 접수가 막혔다).
  for (const el of f.querySelectorAll('[role=checkbox]')) {
    if (el.tagName === 'INPUT' || el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-disabled') === 'true') continue
    // 짝인 숨은 체크 입력(같은 부모 안)을 위 반복에서 이미 눌렀으면 건너뛴다.
    if ([...(el.parentElement?.querySelectorAll('input[type=checkbox]') ?? [])].some((i) => clickedInputs.has(i))) continue
    const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ')
    const label = by.trim() || (el.closest('label')?.textContent ?? '') || el.getAttribute('aria-label') || ''
    const tag = (el.getAttribute('name') || '') + ' ' + label
    // 블록이 동의 칸을 data-consent 로 감싸 표시하면(조상) 그것이 이름·라벨 추측보다 앞선다 — 이름에 newsletter 가 들어도 필수 동의일 수 있다.
    const scope = el.closest('[data-consent]')?.getAttribute('data-consent')
    const optional = scope === 'optional' || (scope !== 'required' && /marketing|newsletter|promo|optional|선택|광고|이벤트|마케팅/i.test(tag))
    const required = scope === 'required' || el.getAttribute('aria-required') === 'true' || (/consent|agree|terms|privacy|동의|약관/i.test(tag) && !optional)
    if (required) { el.click(); filled.push(el.id || 'checkbox') }
  }
  const left = [...f.elements].filter((el) => !el.disabled && el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button' && (el.required || el.getAttribute('aria-required') === 'true') && (el.type === 'checkbox' || el.type === 'radio' ? !el.checked : !String(el.value).trim())).map((el) => (el.name || el.id || el.type) + ':' + el.tagName.toLowerCase() + '/' + (el.type || ''))
  const custom = [...f.querySelectorAll('[role=combobox],[role=radiogroup],[role=switch],[contenteditable=true]')].map((el) => (el.getAttribute('role') || 'editable') + ':' + (el.id || el.getAttribute('aria-label') || ''))
  return { filled, unfilled, left, custom }
}
// 폼이 하이드레이션을 마쳤는가 — Next 페이지는 폼(또는 그 입력)에 React 표지가 붙어야 입력 값이 React 상태로 이어진다(그 전에 채우면 하이드레이션이 값을 지운다). Next 가 아닌 문서는 바로 true.
function formReady(index) {
  const f = document.forms[index]
  if (!f) return false
  if (!document.querySelector('script[src*="/_next/"]')) return true
  const marked = (e) => Object.keys(e).some((k) => k.startsWith('__reactProps'))
  return marked(f) || [...f.elements].some(marked)
}
function submitTarget(index) {
  const f = document.forms[index]
  if (!f) return null
  const b = f.querySelector('[type=submit]') ?? [...f.querySelectorAll('button')].filter((x) => x.type !== 'button' && x.type !== 'reset').at(-1) ?? f.querySelector('button')
  if (!b) return null
  b.scrollIntoView({ block: 'center' })
  const r = b.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!b.disabled, text: (b.textContent || b.value || '').replace(/\s+/g, ' ').trim().slice(0, 30) }
}
const STATUS_TEXTS = `(() => { const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }; return [...document.querySelectorAll('[role=status]')].filter(vis).map((e) => (e.textContent || '').replace(/\\s+/g, ' ').trim()).filter(Boolean) })()`
const ALERT_TEXTS = STATUS_TEXTS.replace('[role=status]', '[role=alert]')
const INVALID = (index) => `(() => { const f = document.forms[${index}]; return f ? [...f.elements].filter((e) => e.willValidate && !e.checkValidity()).map((e) => e.name || e.id || e.type) : [] })()`

// ── 브라우저 실행 ────────────────────────────────────────────────────────────────────────────────────
async function clickAt({ send }, x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}
async function open(session, url) {
  const nav = await navigateAndWait(session.send, session.ev, url)
  if (nav?.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${url}`)
  await sleep(350)
}
const call = (fn, ...args) => `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`

/** 누르고 쪽·단계가 바뀔 때까지(최대 4초) 기다린다. 바뀌면 true. */
async function clickAndWait(session, F, pt) {
  const sig = `location.href.split('#')[0] + '|' + (document.querySelector('[data-flow="${F}"]')?.getAttribute('data-step') ?? '')`
  const before = await session.ev(sig)
  await clickAt(session, pt.x, pt.y)
  for (let k = 0; k < 40; k++) {
    await sleep(100)
    let now
    try { now = await session.ev(`document.readyState === 'complete' ? (${sig}) : undefined`) } catch { now = undefined }
    if (now !== undefined && now !== before) { await sleep(250); return true }
  }
  return false
}

async function walkFlow(session, origin, F, start) {
  const walk = { id: F, entryRoute: start.entry ? start.route : null, pages: [], clicks: 0, entryClicks: 0, steps: null, stepsSeen: [], reachedEnd: false, basis: 'walked' }
  await open(session, origin + start.route)
  const note = (s) => {
    if (!walk.pages.includes(s.path)) walk.pages.push(s.path)
    if (s.step != null && !walk.stepsSeen.includes(s.step)) walk.stepsSeen.push(s.step)
    if (s.steps != null) walk.steps = Math.max(walk.steps ?? 0, s.steps)
  }
  if (start.entry) {
    const pt = await session.ev(`(() => { const e = [...document.querySelectorAll('[data-flow-entry="${F}"]')].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 }); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
    if (!pt) { walk.noControl = `${start.route} 의 data-flow-entry=${F}`; return finishWalk(walk) }
    walk.pages.push(start.route)
    walk.clicks++; walk.entryClicks = 1
    if (!(await clickAndWait(session, F, pt))) { walk.stuck = `${start.route} 의 진입 링크`; return finishWalk(walk) }
  }
  for (let i = 0; i < 12; i++) {
    const s = await session.ev(call(flowState, F))
    if (!s) { walk.stuck = '쪽 상태를 읽지 못함'; break }
    note(s)
    if (!s.hasFlow && !s.done) { walk.noControl = `${s.path} 에 data-flow=${F} 가 없다`; break }
    if (s.done) { walk.reachedEnd = true; break }
    if (s.step != null && s.steps != null && s.step === s.steps && !s.explicit) { walk.reachedEnd = true; break }
    if (!s.next) { walk.noControl = `${s.path}(${s.step ?? '?'}단계)`; break }
    walk.clicks++
    if (!(await clickAndWait(session, F, s.next))) { walk.stuck = `${s.path}(${s.step ?? '?'}단계)`; break }
  }
  return finishWalk(walk)
}

/** 첫 시작 쪽: data-flow-entry 가 있는 첫 쪽 → 없으면 data-flow 가 있는 쪽 중 단계가 가장 낮은 첫 쪽. */
export function pickStart(F, probes) {
  const usable = probes.filter((p) => !p.legal)
  const e = usable.find((p) => p.probe.entries.some((x) => x.flow === F))
  if (e) return { route: e.route, entry: true }
  const c = usable.filter((p) => p.probe.flows.some((x) => x.flow === F))
    .sort((a, b) => Math.min(...a.probe.flows.filter((x) => x.flow === F).map((x) => x.step ?? 1)) - Math.min(...b.probe.flows.filter((x) => x.flow === F).map((x) => x.step ?? 1)))[0]
  return c ? { route: c.route, entry: false } : null
}

async function convert(session, origin, p) {
  const form = p.probe.forms.find((f) => f.conv)
  const mailtoAny = p.probe.forms.find((f) => f.mailtoAction)?.mailtoAction ?? null
  if (!form) return { route: p.route, skipped: true, mailtoAction: mailtoAny, why: p.probe.forms.length ? p.probe.forms.map((f) => f.why || 'form').join(',') : 'no-form' }
  await session.ev(`sessionStorage.removeItem('__wfHits'); sessionStorage.removeItem('__wfPending')`)
  await open(session, origin + p.route)
  await session.ev(`sessionStorage.removeItem('__wfHits'); sessionStorage.removeItem('__wfPending')`)
  for (let k = 0; k < 50 && !(await session.ev(call(formReady, form.index))); k++) await sleep(200) // 하이드레이션을 기다린다(최대 10초)
  const before = (await session.ev(STATUS_TEXTS)) ?? []
  const fill = await session.ev(call(fillForm, form.index))
  const tgt = await session.ev(call(submitTarget, form.index))
  const rec = { route: p.route, form: form.index, action: form.action, mailtoAction: form.mailtoAction ?? mailtoAny, filled: fill?.filled ?? [], unfilled: fill?.unfilled ?? [], left: fill?.left ?? [], custom: fill?.custom ?? [] }
  if (!tgt) return { ...rec, via: null, errors: [], status: null, blocked: '제출 버튼을 찾지 못했다' }
  if (tgt.disabled) return { ...rec, via: null, errors: [], status: null, blocked: '제출 버튼이 잠겨 있다' }
  await sleep(200)
  await clickAt(session, tgt.x, tgt.y)
  let statusNow = []
  for (let k = 0; k < 40; k++) { // 확인 글이나 수신 기록이 나올 때까지(최대 8초)
    await sleep(200)
    try {
      statusNow = (await session.ev(STATUS_TEXTS)) ?? []
      const n = JSON.parse((await session.ev(`sessionStorage.getItem('__wfHits') || '[]'`)) ?? '[]').length
      if (statusNow.some((t) => !before.includes(t)) && n > 0) break
    } catch { /* 이동 중 */ }
  }
  await sleep(700)
  let hits = []
  try { hits = JSON.parse((await session.ev(`sessionStorage.getItem('__wfHits') || '[]'`)) ?? '[]') } catch { /* 이동 중 */ }
  try { statusNow = (await session.ev(STATUS_TEXTS)) ?? [] } catch { /* */ }
  const invalid = (await session.ev(INVALID(form.index))) ?? []
  const alerts = ((await session.ev(ALERT_TEXTS)) ?? []).slice(0, 3)
  const cls = classifyHits(hits)
  const fresh = statusNow.filter((t) => !before.includes(t))
  return { ...rec, submit: tgt.text, hits: hits.map((h) => ({ kind: h.kind, method: h.method, url: h.url, status: h.status })), via: cls.via, errors: cls.errors, status: fresh[0] ?? null, ...(alerts.length ? { alerts } : {}), ...(invalid.length && !cls.via ? { blocked: invalid.join(',') } : {}) }
}

/** 사이트맵의 쪽 경로(중복 없이, 순서 유지). */
export const routesOf = (sitemap) => [...new Set((sitemap?.pages ?? []).map((p) => p.route).filter((r) => typeof r === 'string' && r.startsWith('/')))]

/**
 * 사이트 하나를 잰다. sitemap = 02-sitemap 모양({ pages: [{ id, route, legal? }] }). opts: width·height·session(이미 열린 CDP 세션)·pageGate(false 면 쪽 단위 marketing-gate 를 건너뛴다 — 시험용).
 * @returns {{ origin, width, pages: {route, legal, result}[], flows[], conversion[], tone[], rules[], fail[], warn[], manualChecks[], exit }}
 */
export async function marketingSite(origin, sitemap, opts = {}) {
  const width = opts.width ?? 1440, height = opts.height ?? 900
  origin = String(origin).replace(/\/+$/, '')
  const pagesMeta = (sitemap?.pages ?? []).filter((p) => typeof p.route === 'string' && p.route.startsWith('/'))
  const routes = routesOf(sitemap)
  if (!routes.length) throw new Error('사이트맵에 쪽이 하나도 없다')
  const legalOf = (r) => pagesMeta.some((p) => p.route === r && p.legal === true) && !pagesMeta.some((p) => p.route === r && p.legal !== true)
  let chrome, ws, session = opts.session
  try {
    if (!session) {
      chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb'], { prefix: 'mkt-site-' })
      const c = await connect(chrome.wsUrl)
      ws = c.ws
      session = { send: c.send, ev: c.ev }
    }
    await session.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await session.send('Page.enable')
    await session.send('Runtime.enable')

    // 1. 탐침: 모든 쪽을 한 번씩 열어 흐름·폼·문체 글을 모은다(갈고리는 아직 없다).
    const probes = []
    for (const route of routes) {
      await open(session, origin + route)
      const probe = await session.ev(call(pageProbe))
      if (!probe) throw new Error(`쪽 탐침 실패(pageProbe 가 값을 안 줬다): ${route}`)
      probes.push({ route, legal: legalOf(route), probe })
    }

    // 2. 흐름: 가입 → 해지 → 온보딩 순으로 걷는다(가입이 해지의 기준).
    const flows = []
    for (const F of FLOW_IDS) {
      const start = pickStart(F, probes)
      if (start) flows.push(await walkFlow(session, origin, F, start))
    }
    const signupSteps = flows.find((w) => w.id === 'signup')?.steps ?? undefined

    // 3. 쪽 단위 marketing-gate(그대로 싣는다). 가입 단계 수는 사이트 단위 흐름에서 얻은 값을 준다.
    const pages = []
    for (const route of opts.pageGate === false ? [] : routes) {
      const result = await gateOnPage(session, origin + route, { width, height, ...(signupSteps ? { signupSteps } : {}) })
      pages.push({ route, legal: legalOf(route), result })
    }

    // 4. 전환: 갈고리를 심고 폼을 채워 누른다.
    const hook = await session.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK })
    const conversion = []
    try {
      for (const p of probes) if (!p.legal) conversion.push(await convert(session, origin, p))
    } finally {
      const id = hook?.result?.identifier
      if (id) await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: id })
    }

    // 5. 문체
    const tone = judgeTone(probes.map((p) => ({ route: p.route, legal: p.legal, body: p.probe.body, ctas: p.probe.ctas })))

    const rules = judgeSite({ walks: flows, conversions: conversion, tone })
    const result = { origin, width, pages, flows, conversion, tone, rules, manualChecks: MANUAL_CHECKS }
    const v = interpretSite(result)
    return { ...result, fail: v.fail, warn: v.warn, verdict: v.verdict, note: v.note, exit: v.exit }
  } finally {
    try { ws?.close() } catch { /* */ }
    await chrome?.close()
  }
}

// ── 후보 하나 ────────────────────────────────────────────────────────────────────────────────────────
const readJsonMaybe = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }
const unwrap = (saved) => (saved && typeof saved === 'object' && 'inputHash' in saved && 'data' in saved ? saved.data : saved)
function writeAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, text)
  renameSync(`${file}.tmp`, file)
}
export const RESULT_NAME = 'marketing-site.json'

/**
 * 07-qa 가 후보마다 부르는 진입점(컨트롤러가 merge 때 qa.mjs 에 붙인다). 후보 폴더의 02-sitemap.json 을 읽어 origin 을 잰다.
 * 결과: <runDir>/<후보>/07-qa/marketing-site/marketing-site.json. 반환의 manualChecks 는 07-qa/summary.json 의 「사람 확인 n개」 재료다.
 * @returns {{ id: 'marketing-site', exit: number, verdict: 'pass'|'fail'|'tool', toolFailure: boolean, note: string, resultFile?: string, fail: string[], warn: string[], manualChecks: object[] }}
 */
export async function marketingSiteForCandidate(runDir, cand, { origin, width, measure = marketingSite } = {}) {
  const candDir = join(runDir, cand.id)
  const outDir = join(candDir, '07-qa', 'marketing-site')
  const file = join(outDir, RESULT_NAME)
  rmSync(file, { force: true }) // 앞 실행의 결과를 도구 실패 뒤에 남기지 않는다
  const rec = { id: 'marketing-site', tool: 'marketing-site', manualChecks: MANUAL_CHECKS }
  try {
    if (!origin) throw new Error('origin 이 없다')
    const sm = unwrap(readJsonMaybe(join(candDir, '02-sitemap.json')))
    if (!sm || !Array.isArray(sm.pages)) throw new Error(`02-sitemap.json 이 없거나 모양이 틀리다: ${join(candDir, '02-sitemap.json')}`)
    const r = await measure(origin, sm, { width })
    writeAtomic(file, JSON.stringify({ candidate: cand.id, finishedAt: new Date().toISOString(), ...r }, null, 2) + '\n')
    const v = interpretSite(r)
    return { ...rec, exit: v.exit, verdict: v.verdict, toolFailure: v.toolFailure, note: v.note, resultFile: relative(candDir, file).replace(/\\/g, '/'), fail: v.fail, warn: v.warn }
  } catch (e) {
    rmSync(file, { force: true })
    const msg = String(e?.message ?? e)
    return { ...rec, exit: 1, verdict: 'tool', toolFailure: true, note: msg.startsWith('도구 실패') ? msg : `도구 실패: ${msg}`, fail: [], warn: [] }
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────
const usage = () => { console.error('사용: marketing-site.mjs <origin> --sitemap <02-sitemap.json> [--out <dir>] [--width N] [--height N]'); process.exit(2) }
const main = async () => {
  const argv = process.argv.slice(2)
  const flag = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) usage(); argv.splice(i, 2); return v }
  const sitemapFile = flag('--sitemap', undefined)
  const out = flag('--out', join(ROOT, '.tmp', 'marketing-site'))
  const width = Number(flag('--width', 1440)), height = Number(flag('--height', 900))
  const [origin, ...rest] = argv
  if (rest.length || !origin || !sitemapFile || !/^https?:\/\//.test(origin)) usage()
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200) usage()
  const file = join(out, RESULT_NAME)
  mkdirSync(out, { recursive: true })
  rmSync(file, { force: true })
  let code = 0
  try {
    if (!existsSync(sitemapFile)) throw new Error(`사이트맵 파일이 없다: ${sitemapFile}`)
    const sm = unwrap(JSON.parse(readFileSync(sitemapFile, 'utf8')))
    const r = await marketingSite(origin, sm, { width, height })
    if (r.verdict === 'tool') throw new Error(r.note.replace(/^도구 실패:\s*/, ''))
    writeFileSync(file, JSON.stringify(r, null, 2) + '\n')
    console.log(JSON.stringify({ origin, pages: r.pages.length, flows: r.flows.map((w) => ({ id: w.id, clicks: w.clicks, steps: w.steps, pages: w.pages, basis: w.basis })), fail: r.fail, warn: r.warn, measured: Object.fromEntries(r.rules.map((x) => [x.id, `${x.status}(${x.measured})`])), manualChecks: r.manualChecks.length }))
    for (const rule of r.rules) if (rule.status === 'fail' || rule.status === 'warn') for (const d of rule.detail) console.error(`${rule.status === 'fail' ? 'FAIL' : 'WARN'} ${rule.id}: ${d}`)
    for (const p of r.pages) for (const rule of p.result.rules) if (rule.status === 'fail') for (const d of rule.detail) console.error(`FAIL page:${p.route}:${rule.id}: ${d}`)
    code = r.exit
  } catch (e) { console.error(`도구 실패: ${e.message}`); code = 1; rmSync(file, { force: true }) }
  process.exit(code)
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()

