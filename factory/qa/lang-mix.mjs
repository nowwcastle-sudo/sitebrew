// 화면 언어 혼입 관문(UXGATE1 · G9, 규칙 factory-rules.md §23 U3·U17): node factory/qa/lang-mix.mjs <url>… --locale en|ko --out <dir> [--allow <허용목록.json>] [--scope <css>] [--width 1440] [--session <장면>]
// 렌더된 쪽에서 눈에 보이는 글자·aria-label·title·alt·placeholder·(버튼형 input 의) value·문서 제목·<time> 을 모아 로캘과 어긋난 글을 찾는다.
//   · locale en → 한글(hangul) · 숫자만 적힌 모호한 날짜(ambiguous-date: 10/03 · 03/10/2026 — 월·일이 둘 다 12 이하이고 서로 다를 때)
//   · locale ko → 영어 월 이름 날짜(english-date: Nov 1, 2026 · 1 November · November 2026)
//   06 `foreignTextIssue` 가 문구 단계에서 하는 일을 렌더 결과로 한 번 더 한다 — 블록 기본 글자(닫기)·로캘 없는 DateText 처럼 문구 단계에 안 보이는 것을 잡는다.
// 허용: ① 허용목록 JSON({ "strings": ["브랜드"], "patterns": ["정규식"] } — 글에서 지운 뒤 검사. 기본 factory/qa/data/lang-mix-allow.json 과 --allow 를 합친다)
//       ② 로캘과 다른 `lang` 속성이 붙은 요소 안쪽(언어 전환 「한국어」) ③ `translate="no"` 요소 안쪽(고유명사) — 둘 다 표준 HTML 표지라 규칙으로 쓴다.
// 종료: 0 = 쟀고 혼입 없음 · 1 = 혼입 있음 · 잰 글 0개(na — 통과 아님)(둘 다 결과 파일 있음) **또는** 도구 실패(`도구 실패:` — 열리지 않는 쪽·scope 가 안 맞음, 결과 파일 없음) · 2 = 인자 오류
// 결과: <out>/lang-mix.json { locale, scene, pages:[{ url, htmlLang, strings, findings, skipped, warnings, status }], summary:{ pages, strings, pass, fail, na, ok } }
// 새 관문(관찰 단계) — 막는 관문이 아니다(docs/agents/agent-guide.md 관문 표).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, closeChrome, connect, navigateAndWait, assertOpened, startWatchdog, SESSION_SCENE, NAV_TIMEOUT_MS } from './cdp.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 순수 판정(Chrome 없이 시험한다) ─────────────────────────────────────────────────────────────────────────
export const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯ힰ-퟿]/
const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
// 영어 날짜 세 모양: 월 일 · 일 월 · 월 연도. 대문자로 시작하는 월 이름만(문장 속 소문자 may 는 날짜가 아니다).
export const ENGLISH_DATES = [
  new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`),
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b`),
  new RegExp(`\\b${MONTH}\\.?,?\\s+\\d{4}\\b`),
]
// 숫자만 적힌 날짜 후보: 구분 기호가 같은 두세 덩어리. 앞뒤가 숫자·구분 기호면 더 큰 숫자(2026-11-01 · 1.2.3.4)의 일부라 제외.
const NUMERIC_DATE = /(?<![\d./:-])(\d{1,2})([/.-])(\d{1,2})(?:\2(\d{4}|\d{2}))?(?![\d./:-]|\d)/g

// 모호함: 월·일로 둘 다 읽힐 수 있고(둘 다 12 이하) 두 수가 다르다. 두 덩어리(연도 없음)는 구분 기호가 `/` 이고 한쪽이 0 으로 시작할 때만 날짜로 본다
// (4.8 점수 · 1-2 범위 · 2/3 진행 표시를 날짜로 오인하지 않으려는 문턱 — 문서 §한계). 세 덩어리는 연도가 있으니 날짜다.
export function ambiguousDates(text) {
  const out = []
  for (const m of String(text).matchAll(NUMERIC_DATE)) {
    const [whole, a, sep, b, year] = m
    const [x, y] = [Number(a), Number(b)]
    if (!(x >= 1 && x <= 12 && y >= 1 && y <= 12 && x !== y)) continue
    if (!year && !(sep === '/' && (a.startsWith('0') || b.startsWith('0')))) continue
    out.push(whole)
  }
  return out
}
export const englishDates = (text) => ENGLISH_DATES.flatMap((re) => { const m = re.exec(String(text)); return m ? [m[0]] : [] })

export function compileAllow(list = {}) {
  const strings = (list.strings ?? []).filter((s) => typeof s === 'string' && s !== '').sort((p, q) => q.length - p.length)
  const patterns = (list.patterns ?? []).map((p) => new RegExp(p, 'g'))
  return { strings, patterns }
}
export const stripAllowed = (text, allow) => {
  let t = String(text)
  for (const s of allow.strings) t = t.split(s).join(' ')
  for (const re of allow.patterns) t = t.replace(re, ' ')
  return t
}

// items: [{ src, text }] — src 는 text · aria-label · title · alt · placeholder · value · document.title · time. 같은 (규칙·src·글)은 한 줄로 묶고 count 를 센다.
export function judgeItems(items, { locale, allow = compileAllow() }) {
  if (!['en', 'ko'].includes(locale)) throw new Error(`모르는 로캘: ${locale}`)
  const found = new Map()
  const add = (rule, it, match) => {
    const key = `${rule}|${it.src}|${it.text}`
    const f = found.get(key) ?? { rule, src: it.src, text: it.text.length > 80 ? `${it.text.slice(0, 80)}…` : it.text, match, count: 0 }
    f.count++
    found.set(key, f)
  }
  for (const it of items) {
    const clean = stripAllowed(it.text, allow)
    if (locale === 'en') {
      const h = clean.match(HANGUL)
      if (h) add('hangul', it, clean.match(/[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯ힰ-퟿]+/)[0])
      for (const d of ambiguousDates(clean)) add('ambiguous-date', it, d)
    } else {
      for (const d of englishDates(clean)) add('english-date', it, d)
    }
  }
  return [...found.values()]
}

export function loadAllow(files) {
  const merged = { strings: [], patterns: [] }
  for (const f of files) {
    const j = JSON.parse(readFileSync(f, 'utf8'))
    merged.strings.push(...(j.strings ?? []))
    merged.patterns.push(...(j.patterns ?? []))
  }
  return compileAllow(merged)
}

// ── 쪽 안에서 도는 수집 함수(자기완결 — JSON.stringify 한 인자만 받는다) ──────────────────────────────────────────
export function collectScript({ locale, scope }) {
  return `(() => {
  const locale = ${JSON.stringify(locale)}, scope = ${JSON.stringify(scope ?? null)}
  const ATTRS = ['aria-label', 'title', 'alt', 'placeholder', 'aria-placeholder', 'aria-roledescription', 'aria-description']
  const roots = scope ? [...document.querySelectorAll(scope)] : [document.body]
  const items = []; let skippedLang = 0, skippedNoTranslate = 0, hidden = 0
  const SKIP_TAG = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])
  // 로캘과 다른 lang 이거나 translate=no 인 요소 안쪽은 센 뒤 건너뛴다(언어 전환의 「한국어」 · 고유명사).
  const exempt = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      if (e.getAttribute('translate') === 'no') return 'translate'
      const l = e.getAttribute('lang')
      if (l && l.toLowerCase().split('-')[0] !== locale) return 'lang'
    }
    return null
  }
  // 그려지는 요소인가: display:none·visibility:hidden 은 제외, sr-only(화면 밖 글)는 낭독되므로 포함.
  const rendered = (el) => (el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true }) : true)
  const push = (src, text, el) => {
    const t = (text || '').replace(/\\s+/g, ' ').trim()
    if (!t) return
    const ex = exempt(el)
    if (ex) { ex === 'lang' ? skippedLang++ : skippedNoTranslate++; return }
    items.push({ src, text: t })
  }
  for (const root of roots) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement
      if (!el || SKIP_TAG.has(el.tagName)) continue
      if (!rendered(el)) { if ((n.textContent || '').trim()) hidden++; continue }
      push(el.closest('time') ? 'time' : 'text', n.textContent, el)
    }
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (SKIP_TAG.has(el.tagName)) continue
      for (const a of ATTRS) if (el.hasAttribute(a) && rendered(el)) push(a, el.getAttribute(a), el)
      if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && rendered(el)) push('value', el.value, el)
      if (el.tagName === 'TITLE' && el.parentElement && el.parentElement.tagName === 'svg' && rendered(el.parentElement)) push('svg-title', el.textContent, el)
    }
  }
  const t = (document.title || '').trim()
  return { htmlLang: document.documentElement.getAttribute('lang') || '', title: t, scopeMatched: roots.length, items, skipped: { lang: skippedLang, translateNo: skippedNoTranslate, hiddenText: hidden } }
})()`
}

// ── 인자 ─────────────────────────────────────────────────────────────────────────────────────────────────
export const USAGE = '사용: node factory/qa/lang-mix.mjs <url>… --locale en|ko --out <dir> [--allow <허용목록.json>] [--scope <css>] [--width 1440] [--session <장면>]\n' +
  '종료: 0 = 쟀고 혼입 없음 · 1 = 혼입 있음 또는 도구 실패(결과 파일 없음) · 2 = 인자 오류'
export function parseArgs(argv) {
  const a = { urls: [], allow: [], width: 1440 }
  const rest = [...argv]
  while (rest.length) {
    const t = rest.shift()
    if (t === '--locale') a.locale = rest.shift()
    else if (t === '--out') a.out = rest.shift()
    else if (t === '--allow') a.allow.push(rest.shift())
    else if (t === '--scope') a.scope = rest.shift()
    else if (t === '--width') a.width = Number(rest.shift())
    else if (t.startsWith('--')) throw new Error(`모르는 인자: ${t}`)
    else a.urls.push(t)
  }
  if (!a.urls.length) throw new Error('쪽 주소가 없다')
  if (!['en', 'ko'].includes(a.locale)) throw new Error('--locale en|ko 가 필요하다')
  if (!a.out) throw new Error('--out <dir> 이 필요하다')
  if (!Number.isFinite(a.width) || a.width < 200) throw new Error('--width 가 숫자가 아니다')
  for (const f of a.allow) if (!f || !existsSync(f)) throw new Error(`허용목록 파일이 없다: ${f}`)
  return a
}

export function summarize(pages) {
  const fail = pages.filter((p) => p.status === 'fail').length
  const strings = pages.reduce((n, p) => n + p.strings, 0)
  return { pages: pages.length, strings, pass: pages.length - fail, fail, na: pages.filter((p) => p.strings === 0).length, ok: fail === 0 && pages.every((p) => p.strings > 0) }
}

export async function main(argv) {
  let a
  try { a = parseArgs(argv) } catch (e) { console.error(`lang-mix: ${e.message}\n${USAGE}`); return 2 }
  mkdirSync(a.out, { recursive: true })
  const jsonPath = join(a.out, 'lang-mix.json')
  rmSync(jsonPath, { force: true }) // 재지 못하고 끝나면(도구 실패) 이전 실행의 결과가 남아 읽히지 않게
  const defaultAllow = join(HERE, 'data', 'lang-mix-allow.json')
  let allow
  try { allow = loadAllow([...(existsSync(defaultAllow) ? [defaultAllow] : []), ...a.allow]) } catch (e) { console.error(`lang-mix: 허용목록을 읽지 못했다 — ${e.message}`); return 2 }

  const pages = []
  let chrome
  const state = { chrome: null, stage: 'Chrome 시작' }
  const stopDog = startWatchdog('lang-mix', 90000 + 30000 * a.urls.length, state)
  try {
    chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb'], { prefix: 'lang-mix-' })
    state.chrome = chrome
    state.stage = 'DevTools 연결'
    const { ws, send, ev } = await connect(chrome.wsUrl, { throwOnException: true })
    await send('Emulation.setDeviceMetricsOverride', { width: a.width, height: 900, deviceScaleFactor: 1, mobile: false })
    for (const url of a.urls) {
      state.stage = `쪽 열기 ${url}`
      await assertOpened(await navigateAndWait(send, ev, url), ev, url)
      // 클라이언트가 늦게 그리는 쪽(갤러리의 동적 import)을 위해: scope 가 잡히거나 글자 수가 두 번 연달아 같을 때까지 기다린다(기한은 문서 읽기 기한).
      const deadline = Date.now() + NAV_TIMEOUT_MS
      let last = -1, stable = 0
      while (Date.now() < deadline && stable < 2) {
        const n = await ev(`${a.scope ? `document.querySelectorAll(${JSON.stringify(a.scope)}).length > 0 ? ` : ''}(document.body?.innerText.length ?? 0)${a.scope ? ' : -2' : ''}`)
        stable = n === last && n >= 0 ? stable + 1 : 0
        last = n
        await sleep(300)
      }
      const got = await ev(collectScript({ locale: a.locale, scope: a.scope }))
      if (a.scope && got.scopeMatched === 0) throw new Error(`--scope ${a.scope} 에 맞는 요소가 없다: ${url}`)
      const items = [...got.items]
      if (got.title && !a.scope) items.push({ src: 'document.title', text: got.title })
      const findings = judgeItems(items, { locale: a.locale, allow })
      const warnings = []
      if (got.htmlLang && got.htmlLang.toLowerCase().split('-')[0] !== a.locale) warnings.push(`html lang="${got.htmlLang}" 가 로캘 ${a.locale} 과 다르다`)
      pages.push({ url, htmlLang: got.htmlLang, strings: items.length, findings, skipped: got.skipped, warnings, status: findings.length ? 'fail' : items.length ? 'pass' : 'na' })
    }
    ws.close()
  } catch (e) {
    console.error(`도구 실패: lang-mix 측정 없음 — ${e.message}`)
    return 1
  } finally { stopDog(); if (chrome) await closeChrome(chrome) }

  const summary = summarize(pages)
  writeFileSync(jsonPath, JSON.stringify({ locale: a.locale, scene: SESSION_SCENE, pages, summary }, null, 2) + '\n')
  console.log(`lang-mix[${a.locale}${SESSION_SCENE ? ` · ${SESSION_SCENE}` : ''}]: 쪽 ${summary.pages} · 잰 글 ${summary.strings} — 통과 ${summary.pass} · 실패 ${summary.fail} · na ${summary.na}`)
  for (const p of pages) {
    console.log(`  ${p.status.toUpperCase()} ${p.url} (글 ${p.strings})`)
    for (const f of p.findings) console.log(`    ${f.rule} [${f.src}] ${JSON.stringify(f.match)} — ${JSON.stringify(f.text)}${f.count > 1 ? ` ×${f.count}` : ''}`)
    for (const w of p.warnings) console.log(`    경고: ${w}`)
  }
  return summary.ok ? 0 : 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  // 끝나면 곧바로 나간다 — 닫힌 Chrome 에 붙었던 소켓 같은 남은 핸들이 프로세스를 붙잡아 부모(시험·셸)가 끝없이 기다린 적이 있다(UXGATE1 실측).
  const code = await main(process.argv.slice(2))
  process.exitCode = code
  setTimeout(() => process.exit(code), 1500).unref()
}
