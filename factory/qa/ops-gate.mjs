// 운영 준비 관문 ops-gate(P3-4 Task 1, 스펙 3판 §0 기준 6) — 찍어낸 사이트가 「운영에 올려도 되는가」를 열린 주소 하나로 판정한다.
//   node factory/qa/ops-gate.mjs <origin> --out <dir> [--routes /,/pricing] [--site <siteDir>] [--archetype local] [--locale ko] [--recipe r1]
//                                        [--form-factor mobile|desktop] [--lh-routes auto|all|none|/a,/b] [--require-analytics]
//   opsGate(origin, { routes, locale, archetype, ... }) → { checks[{ id, status, level, route?, value?, threshold?, detail? }], exit, summary, ... }
//   opsGateForCandidate(runDir, cand, { origin }) → 07-qa 관문 묶음(qa.mjs)이 그대로 gates 에 넣는 기록 { id: 'ops', tool: 'ops', exit, verdict, toolFailure, resultFile, problems, … }
//
// 검사 하나 = OPS_CHECKS 한 행(id · 규칙 수준 · 문턱 · 근거). 판정 함수는 순수해서(judge*) 브라우저 없이도 시험한다.
//   status: pass · fail · warn(참고·부분 측정) · na(잴 것이 없다 — 통과가 아니다: 필수 규칙의 na 는 실패, naOk 행만 예외 — A123)
//   Lighthouse 는 쪽마다 한 번(모바일, 기본 스로틀 = simulate·mobileSlow4G)이고, 대표 쪽만 잰다(C126) — 요약에 「Lighthouse 잰 쪽 n/m」.
//
// 종료: 0 = 쟀고 필수 규칙 어김 없음 · 1 = 어김 있음(결과 파일 있음) 또는 도구 실패(`도구 실패:` 를 적고 결과 파일을 지운다) · 2 = 인자 오류.
//       (docs/agents/agent-guide.md 관문 표 규칙 — 0 인데 결과 파일이 없으면 07-qa 묶음이 도구 실패로 읽는다.)
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { NEEDS_CHECK_LITERALS } from '../stamp/needs-check.mjs'
import { LEGAL_ROUTES } from '../stamp/sitemap.mjs'
import { measureBfCache } from './bfcache.mjs'
import { closeChrome, connect, navigateAndWait, startChrome } from './cdp.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// ── 검사표(한 곳) ───────────────────────────────────────────────────────────
// level: must(어기면 종료 1) · should(경고만). naOk: 잴 것이 없을 때 통과가 아니라 na 로 남기되 실패는 아니다(그 이유가 표에 있다).
// src: 문턱의 1차 출처(보고서 「공식 문서 근거」 표가 URL·확인일을 가진다).
export const OPS_CHECKS = {
  'lh-perf': { level: 'must', threshold: 90, src: 'Lighthouse 성능 점수 — 90 이상이 「좋음」(모바일, simulate 스로틀)', what: '모바일 Lighthouse 성능 ≥ 90' },
  'lh-seo': { level: 'must', threshold: 95, src: 'Lighthouse SEO 점수', what: '모바일 Lighthouse SEO ≥ 95', naOk: 'noindex 쪽(확인·계정 화면)은 크롤 대상이 아니라 안 잰다(is-crawlable 이 의도대로 실패한다)' },
  lcp: { level: 'must', threshold: 2500, src: 'web.dev/articles/lcp — 좋음 ≤ 2.5 s', what: 'LCP ≤ 2.5 s(Lighthouse 모의 값) — 어느 요소가 LCP 인지 적는다' },
  cls: { level: 'must', threshold: 0.1, src: 'web.dev/articles/cls — 좋음 ≤ 0.1', what: 'CLS ≤ 0.1' },
  'bf-cache': { level: 'must', src: 'web.dev/articles/bfcache · Lighthouse bf-cache 감사(10.0+)', what: '뒤로 가기 캐시가 막히지 않는다(unload·no-store 등). 로그인 화면은 제외', naOk: '로그인·가입·계정 같은 화면은 대상이 아니다' },
  'lh-a11y': { level: 'should', threshold: 95, src: 'Lighthouse 접근성 점수(참고 — 규칙 검사는 Task 3 axe 행렬)', what: '모바일 Lighthouse 접근성 ≥ 95(참고)' },
  'js-budget': { level: 'should', threshold: 170, src: 'FV1 Task 5.10 · Alex Russell 「Can You Afford It?」(infrequently.org — 모바일 자바스크립트 예산 압축 후 약 170 KB) · Lighthouse resource-summary(script 전송량)', what: '첫 화면(load 까지) 자바스크립트 전송량 합 ≤ 170 KB(gzip·br 압축 후 전송 바이트). 넘으면 경고' },
  tbt: { level: 'should', threshold: 200, src: 'web.dev/articles/tbt — 평균 모바일 기기에서 200 ms 아래가 좋음(Lighthouse 모의 값). motion-performance-jank 를 이 행으로 갈음한다', what: 'Total Blocking Time ≤ 200 ms(Lighthouse 모의 값). 넘으면 경고' },
  'agentic-browsing': { level: 'should', src: 'Lighthouse 13 「Agentic Browsing」 범주(developer.chrome.com/docs/lighthouse/agentic-browsing — 아직 개발 중이라 바뀔 수 있다고 적혀 있다)', what: 'Lighthouse Agentic Browsing 범주 점수(참고) — 에이전트용 접근성 트리·WebMCP·llms.txt·ARD 스키마. 못 채운 감사는 경고에 이름을 적는다', naOk: '설치된 Lighthouse 판에 이 범주가 없다' },
  'routes-open': { level: 'must', src: '기본', what: '검사할 쪽이 모두 200' },
  'legal-routes': { level: 'must', src: '원형 legal.pages(전자상거래법·개인정보 보호법)', what: '원형이 요구하는 법정 쪽이 모두 200', naOk: '원형이 법정 쪽을 요구하지 않는다' },
  'og-image': { level: 'must', src: 'ogp.me · Next 16 opengraph-image 규약 — 1200×630', what: '색인 쪽마다 og:image 가 절대 주소이고 실제 1200×630 PNG/JPEG' },
  'favicon-set': { level: 'must', src: 'Next 16 app-icons 규약 · web.dev/articles/add-manifest · maskable', what: 'ico(16·32)·svg·apple 180·manifest(192·512·maskable 512)가 모두 실제로 열린다' },
  'error-pages': { level: 'must', src: 'Next 16 not-found·error·global-error 규약', what: '없는 주소는 404 로 사이트 셸 안에서 안내하고, 500 경계(error·global-error)가 있다' },
  'security-headers': { level: 'must', src: 'Next 16 「Content Security Policy」 가이드(nonce 는 proxy.ts — 동적 렌더 필수, 정적 사이트는 해시·headers()) · MDN CSP', what: 'CSP(정적 사이트 completion "site": script-src 는 self + 인라인 script 해시뿐 · 제품 completion "product": nonce·요청마다 다름)·frame-ancestors·base-uri·object-src·X-Content-Type-Options·Referrer-Policy·Permissions-Policy' },
  'sitemap-robots': { level: 'must', src: 'sitemaps.org · Next 16 sitemap·robots 규약', what: 'sitemap.xml 이 모든 색인 쪽(noindex 제외)을 절대 주소로 싣고, robots.txt 가 sitemap 을 가리킨다' },
  'analytics-consent': { level: 'must', src: '정보통신망법·GDPR 동의 전 계측 금지 · factory-rules.md §22-1', what: '동의 전 계측 요청 0, 배너에서 동의하면 page_view 1회', naOk: '계측 어댑터가 아직 없는 사이트(배너가 없거나 동의 뒤에도 계측이 없다 — 어댑터는 launch-factory 에서 붙는다, 대장 C170. 붙은 뒤는 --require-analytics 로 실패로 바꾼다)' },
  'facts-empty': { level: 'must', src: 'J12 · 사실 자리 표시(「확인 필요」) — 07-qa ops 최소판에서 옮겨 옴(대장 C127)', what: 'content/site.json 어디에도 「확인 필요」 자리 표시가 남지 않았다', naOk: 'site.json 을 주지 않은 실행(--site 없음)' },
  'page-structure': { level: 'must', src: '대장 C117 — 07-qa ops 최소판에서 옮겨 옴', what: '쪽마다 h1 하나 · <html lang> = 콘텐츠 로캘 · <title> · 색인 쪽은 JSON-LD 하나 이상' },
  'viewport-fit': { level: 'must', src: 'Chrome 108 뷰포트 변경 · Next 16 viewport 내보내기(대장 C61)', what: 'meta viewport 에 viewport-fit=cover, 입력칸이 있는 쪽은 interactive-widget=resizes-content' },
}

export const THRESHOLDS = Object.fromEntries(Object.entries(OPS_CHECKS).filter(([, v]) => v.threshold !== undefined).map(([k, v]) => [k, v.threshold]))

export class ToolFailure extends Error {}

/** bf-cache 를 재지 않는 화면(로그인·가입·계정 …) — 이 쪽들은 Lighthouse 도 안 돌리는 것이 아니라 bf-cache 만 na 다. */
export const AUTH_ROUTE = /^\/(?:login|signin|sign-in|signup|sign-up|register|onboarding|account|billing|cancel|dashboard|app|auth)(?:\/|$)/i

// ── HTML 읽기 ───────────────────────────────────────────────────────────────
const attrsOf = (tag) => {
  const out = {}
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = m[2] ?? m[3]
  return out
}
export const tagsOf = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => attrsOf(m[0]))
const metaContent = (html, key, val) => tagsOf(html, 'meta').find((t) => (t[key] ?? '').toLowerCase() === val)?.content
const linksRel = (html, rel) => tagsOf(html, 'link').filter((t) => (t.rel ?? '').toLowerCase().split(/\s+/).includes(rel))

export const isNoindex = (html, headers) => /noindex/i.test(metaContent(html, 'name', 'robots') ?? '') || /noindex/i.test(headers?.get?.('x-robots-tag') ?? '')

/** 입력칸이 있는 쪽(숨김·버튼 제외). */
export const hasFormFields = (html) => /<textarea\b|<select\b/i.test(html) || tagsOf(html, 'input').some((t) => !/^(hidden|submit|button|reset|image)$/i.test(t.type ?? 'text'))

const normPath = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/'
const pathOfUrl = (u, base) => { try { const x = new URL(u, base); return normPath(x.pathname) } catch { return null } }

// ── 판정(순수 함수) ─────────────────────────────────────────────────────────
const row = (id, status, extra = {}) => ({ id, level: OPS_CHECKS[id].level, status, ...(OPS_CHECKS[id].threshold !== undefined ? { threshold: OPS_CHECKS[id].threshold } : {}), ...extra })

/** meta viewport → { fit, widget }. */
export function judgeViewport(pages) {
  const detail = []
  for (const { route, html } of pages) {
    const content = (metaContent(html, 'name', 'viewport') ?? '').toLowerCase().replace(/\s+/g, '')
    if (!content) { detail.push(`${route}: meta viewport 가 없다`); continue }
    if (!/(?:^|,)viewport-fit=cover(?:,|$)/.test(content)) detail.push(`${route}: viewport-fit=cover 가 없다(${content})`)
    if (hasFormFields(html) && !/(?:^|,)interactive-widget=resizes-content(?:,|$)/.test(content)) detail.push(`${route}: 입력칸이 있는데 interactive-widget=resizes-content 가 없다`)
  }
  return row('viewport-fit', detail.length ? 'fail' : 'pass', { value: `${pages.length - new Set(detail.map((d) => d.split(':')[0])).size}/${pages.length}쪽`, detail })
}

/** 값 어디든 「확인 필요」 글자가 든 문자열 칸의 경로(07-qa ops 최소판의 needsCheckPaths 와 같은 규칙). */
export function needsCheckPaths(value, path = '') {
  if (typeof value === 'string') return NEEDS_CHECK_LITERALS.some((l) => value.includes(l)) ? [path || '(루트)'] : []
  if (Array.isArray(value)) return value.flatMap((v, i) => needsCheckPaths(v, `${path}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => needsCheckPaths(v, path ? `${path}.${k}` : k))
  return []
}

export function judgeFactsEmpty(siteJson) {
  if (!siteJson) return row('facts-empty', 'na', { detail: ['site.json 을 안 받아 빈 사실을 못 쟀다(--site)'] })
  const empty = needsCheckPaths(siteJson)
  return row('facts-empty', empty.length ? 'fail' : 'pass', { value: `${empty.length}곳`, detail: empty.length ? [`「확인 필요」 ${empty.length}곳: ${empty.slice(0, 8).join(', ')}${empty.length > 8 ? ' …' : ''}`] : [] })
}

/** 쪽 구조: h1 하나 · lang = 로캘 · title · 색인 쪽은 JSON-LD. pages = [{ route, html, noindex }]. */
export function judgePageStructure(pages, locale) {
  const detail = []
  for (const p of pages) {
    const h1 = (p.html.match(/<h1[\s>]/gi) ?? []).length
    if (h1 !== 1) detail.push(`${p.route}: h1 ${h1}개(하나여야 한다)`)
    const lang = p.html.match(/<html[^>]*\blang="([^"]*)"/i)?.[1]
    if (lang !== locale) detail.push(`${p.route}: <html lang="${lang ?? ''}"> 가 콘텐츠 로캘 ${locale} 과 다르다`)
    if (!/<title>[^<]+<\/title>/i.test(p.html)) detail.push(`${p.route}: <title> 이 없다`)
    if (!p.noindex && !/<script[^>]+type="application\/ld\+json"/i.test(p.html)) detail.push(`${p.route}: JSON-LD 가 없다`)
  }
  return row('page-structure', detail.length ? 'fail' : 'pass', { detail })
}

/** ICO 디렉터리 → [{ w, h }]. */
export function icoSizes(buf) {
  if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null
  const n = buf.readUInt16LE(4)
  const out = []
  for (let i = 0; i < n && 6 + 16 * (i + 1) <= buf.length; i++) out.push({ w: buf[6 + 16 * i] || 256, h: buf[7 + 16 * i] || 256 })
  return out
}

export function judgeCsp(header) {
  const detail = []
  const dirs = Object.fromEntries((header ?? '').split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k.toLowerCase(), v.join(' ')] }))
  if (!header) return { detail: ['Content-Security-Policy 헤더가 없다'], nonce: null }
  const script = dirs['script-src'] ?? dirs['default-src'] ?? ''
  const nonce = script.match(/'nonce-([^']+)'/)?.[1] ?? null
  if (!nonce) detail.push(`CSP script-src 에 'nonce-…' 가 없다(${script ? script.slice(0, 60) : 'script-src 없음'})`)
  if (!('frame-ancestors' in dirs)) detail.push('CSP 에 frame-ancestors 가 없다')
  return { detail, nonce }
}

// ── 정적 사이트(completion "site") CSP — nonce 없이 script-src 'self' + 인라인 script 해시(대장 C171, 컨트롤러 결정) ──────────────
const EXEC_SCRIPT_TYPE = /^(?:module|text\/javascript|application\/javascript)$/i
const sriToken = (text, alg) => `'${alg}-${createHash(alg).update(text, 'utf8').digest('base64')}'`

/** 실행되는 인라인 script(<script> 본문)를 [{ text }] 로 — src 없음 · 데이터 블록(JSON-LD 등)이 아님 · 글자 있음. */
function executableInlineScripts(html) {
  const out = []
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const a = attrsOf(`<script${m[1]}>`)
    if (a.src !== undefined || (a.type && !EXEC_SCRIPT_TYPE.test(a.type)) || m[2] === '') continue
    out.push({ text: m[2] })
  }
  return out
}

/** HTML 의 실행되는 인라인 script → sha256 토큰 목록. 해시는 브라우저가 하는 그대로 태그 사이 글자 통째다. */
export const inlineScriptHashes = (html) => executableInlineScripts(html).map((s) => sriToken(s.text, 'sha256'))

/** completion "site" 용 CSP 판정 → { detail }. script-src 는 self 와 해시만, 이 쪽의 인라인 script 가 전부 해시에 있어야 한다. */
export function judgeCspHash(header, html) {
  if (!header) return { detail: ['Content-Security-Policy 헤더가 없다'] }
  const detail = []
  const dirs = Object.fromEntries(header.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k.toLowerCase(), v] }))
  const script = dirs['script-src'] ?? dirs['default-src'] ?? null
  if (!script) detail.push('CSP 에 script-src(또는 default-src)가 없다')
  else {
    if (!script.includes("'self'")) detail.push("CSP script-src 에 'self' 가 없다")
    for (const bad of ["'unsafe-inline'", "'unsafe-eval'", '*', 'data:', 'http:', 'https:', 'blob:']) if (script.includes(bad)) detail.push(`CSP script-src 에 ${bad} 가 있다(정적 사이트는 인라인 script 를 해시로만 허용한다)`)
    const allowed = new Set(script.filter((t) => /^'sha(?:256|384|512)-/i.test(t)))
    const uncovered = executableInlineScripts(html).filter((s) => !['sha256', 'sha384', 'sha512'].some((alg) => allowed.has(sriToken(s.text, alg))))
    if (uncovered.length) detail.push(`인라인 script ${uncovered.length}개가 script-src 해시에 없다(브라우저가 막는다 — 예: ${uncovered[0].text.slice(0, 48).replace(/\s+/g, ' ')})`)
  }
  if (!dirs['frame-ancestors']?.length || dirs['frame-ancestors'].includes('*')) detail.push('CSP 에 frame-ancestors 가 없거나 * 다(클릭재킹)')
  if (!dirs['base-uri']?.length) detail.push('CSP 에 base-uri 가 없다')
  if (!dirs['object-src']?.includes("'none'")) detail.push("CSP 에 object-src 'none' 이 없다")
  return { detail }
}

/** completion "site" 보안 헤더 판정. responses = [{ route, headers, html }] — 첫 응답(홈)에서 나머지 세 헤더도 본다. */
export function judgeSecurityHeadersHash(responses) {
  const detail = []
  for (const r of responses) for (const d of judgeCspHash(r.headers.get('content-security-policy'), r.html).detail) detail.push(`${r.route}: ${d}`)
  const h = (k) => responses[0].headers.get(k)
  if (!/nosniff/i.test(h('x-content-type-options') ?? '')) detail.push('X-Content-Type-Options: nosniff 가 없다')
  const rp = h('referrer-policy')
  if (!rp) detail.push('Referrer-Policy 가 없다')
  else if (/unsafe-url|no-referrer-when-downgrade/i.test(rp)) detail.push(`Referrer-Policy 가 느슨하다(${rp})`)
  if (!h('permissions-policy')) detail.push('Permissions-Policy 가 없다')
  return row('security-headers', detail.length ? 'fail' : 'pass', { value: 'hash', detail })
}

/** 응답 둘(헤더·본문)로 보안 헤더 판정 — 둘이어야 nonce 가 요청마다 다른지 볼 수 있다. */
export function judgeSecurityHeaders(a, b) {
  const detail = []
  const h = (r, k) => r.headers.get(k)
  const c1 = judgeCsp(h(a, 'content-security-policy'))
  detail.push(...c1.detail)
  if (c1.nonce) {
    const c2 = judgeCsp(h(b, 'content-security-policy'))
    if (c2.nonce && c2.nonce === c1.nonce) detail.push('CSP nonce 가 요청마다 같다(요청마다 새로 만들어야 한다)')
    // 실행되는 script 만 본다 — JSON-LD 같은 데이터 블록(type 이 자바스크립트가 아님)에는 nonce 가 필요 없다
    const scripts = tagsOf(a.html, 'script').filter((s) => !s.type || /^(?:module|text\/javascript|application\/javascript)$/i.test(s.type))
    const withNonce = scripts.filter((s) => s.nonce !== undefined)
    if (!scripts.length) { /* script 가 없으면 nonce 가 붙을 자리도 없다(Next 사이트는 항상 있다) */ }
    else if (withNonce.some((s) => s.nonce !== c1.nonce)) detail.push('HTML script 의 nonce 가 헤더 nonce 와 다르다')
    else if (!withNonce.length) detail.push('HTML script 어디에도 nonce 가 없다')
    else if (scripts.some((s) => !s.src && s.nonce === undefined)) detail.push('nonce 없는 인라인 script 가 있다')
  }
  if (!/nosniff/i.test(h(a, 'x-content-type-options') ?? '')) detail.push('X-Content-Type-Options: nosniff 가 없다')
  const rp = h(a, 'referrer-policy')
  if (!rp) detail.push('Referrer-Policy 가 없다')
  else if (/unsafe-url|no-referrer-when-downgrade/i.test(rp)) detail.push(`Referrer-Policy 가 느슨하다(${rp})`)
  if (!h(a, 'permissions-policy')) detail.push('Permissions-Policy 가 없다')
  return row('security-headers', detail.length ? 'fail' : 'pass', { detail })
}

const CONSENT_ACCEPT = /(?:모두\s*)?(?:허용|동의|수락)|accept|allow\s*all|agree/i
const CONSENT_DECLINE = /거부|거절|반대|decline|reject|deny|refuse|not\s+now/i
const ANALYTICS_HOST = /google-analytics|googletagmanager|posthog|plausible|umami|mixpanel|amplitude|segment\.(?:io|com)|hotjar|clarity\.ms|sentry-cdn|doubleclick|facebook\.net|connect\.facebook/i

/** 네트워크 요청 하나가 계측인가. type 은 CDP resource type. */
export function isTrackingRequest({ url, method = 'GET', type = '' }, origin) {
  let same = false
  try { same = new URL(url).origin === new URL(origin).origin } catch { return false }
  if (ANALYTICS_HOST.test(url)) return true
  if (type === 'Ping') return true
  if (['XHR', 'Fetch'].includes(type)) return !same || method === 'POST' || method === 'PUT'
  if (type === 'Script') return !same
  return false
}

const isPageView = (r) => /page_?view|\$pageview/i.test(`${r.postData ?? ''} ${r.url}`)

/** 동의 탐사 결과 → 판정. probe = { banner, before[], after[] }, 요청 = { url, method, type, postData? }. */
export function judgeConsent(probe, origin, { requireAnalytics = false } = {}) {
  const isT = (r) => isTrackingRequest(r, origin)
  const before = probe.before.filter(isT)
  const after = probe.after.filter(isT)
  if (before.length) return row('analytics-consent', 'fail', { value: `동의 전 ${before.length}건`, detail: [`동의 전에 계측 요청이 나갔다: ${before.slice(0, 3).map((r) => `${r.method} ${r.url}`).join(' · ')}`] })
  if (!probe.banner) {
    if (after.length) return row('analytics-consent', 'fail', { detail: ['동의 배너가 없는데 계측 요청이 나간다'] })
    if (requireAnalytics) return row('analytics-consent', 'fail', { detail: ['동의 배너가 없다(계측 어댑터가 붙은 사이트는 동의 배너가 있어야 한다)'] })
    return row('analytics-consent', 'na', { detail: ['계측 요청도 동의 배너도 없다 — 잴 것이 없다(어댑터가 붙으면 --require-analytics 로 다시 잰다)'] })
  }
  const bodyKnown = after.some((r) => r.postData)
  const views = bodyKnown ? after.filter(isPageView).length : after.length
  if (views === 1) return row('analytics-consent', 'pass', { value: 'page_view 1회' })
  if (views === 0 && !requireAnalytics) return row('analytics-consent', 'na', { value: 'page_view 0회', detail: ['동의 전 계측은 0건이고 동의 뒤에도 계측이 없다 — 계측 어댑터가 아직 안 붙은 것으로 본다(--require-analytics 면 실패)'] })
  return row('analytics-consent', 'fail', { value: `page_view ${views}회`, detail: [views === 0 ? '배너에서 동의했는데 page_view 가 안 나갔다' : `배너에서 동의했더니 page_view 가 ${views}번 나갔다(1번이어야 한다)`] })
}

/** sitemap.xml·robots.txt 판정. pages = [{ route, noindex }]. */
export function judgeSitemapRobots({ pages, sitemapStatus, sitemapXml, robotsStatus, robotsTxt }) {
  const detail = []
  if (sitemapStatus !== 200) detail.push(`GET /sitemap.xml → ${sitemapStatus}`)
  else if (!/<urlset[\s>]/.test(sitemapXml)) detail.push('/sitemap.xml 이 sitemap 모양(<urlset>)이 아니다')
  else {
    const locs = [...sitemapXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])
    const rel = locs.filter((l) => !/^https?:\/\//i.test(l))
    if (rel.length) detail.push(`sitemap <loc> 이 절대 주소가 아니다: ${rel.slice(0, 3).join(', ')}`)
    const hosts = new Set(locs.map((l) => { try { return new URL(l).host } catch { return l } }))
    if (hosts.size > 1) detail.push(`sitemap 주소의 호스트가 섞였다: ${[...hosts].join(', ')}`)
    const paths = new Set(locs.map((l) => pathOfUrl(l, 'http://x')))
    for (const p of pages) {
      if (p.noindex && paths.has(normPath(p.route))) detail.push(`${p.route}: noindex 쪽이 sitemap 에 있다`)
      if (!p.noindex && !paths.has(normPath(p.route))) detail.push(`${p.route}: sitemap 에 없다`)
    }
  }
  if (robotsStatus !== 200) detail.push(`GET /robots.txt → ${robotsStatus}`)
  else {
    const sm = [...robotsTxt.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1])
    if (!sm.length) detail.push('robots.txt 에 Sitemap: 줄이 없다')
    else if (!sm.some((s) => pathOfUrl(s, 'http://x') === '/sitemap.xml')) detail.push(`robots.txt 의 Sitemap 이 /sitemap.xml 을 가리키지 않는다(${sm[0]})`)
    if (/user-agent:\s*\*\s*[\r\n]+(?:\s*(?:allow|crawl-delay)[^\r\n]*[\r\n]+)*\s*disallow:\s*\/\s*(?:[\r\n]|$)/i.test(robotsTxt)) detail.push('robots.txt 가 모든 봇의 전체 색인을 막는다(Disallow: /)')
  }
  return row('sitemap-robots', detail.length ? 'fail' : 'pass', { detail })
}

/** 404 응답 → 사이트 셸 안인지. */
export function judgeNotFound({ status, html }, locale) {
  const detail = []
  if (status !== 404) detail.push(`없는 주소가 ${status} 다(404 여야 한다 — 소프트 404 는 색인을 흐린다)`)
  if (/next-error-h1|This page could not be found/i.test(html)) detail.push('Next 기본 404 쪽이다(사이트 not-found 가 없다)')
  else {
    if (!/<(?:header|nav)\b/i.test(html)) detail.push('404 쪽에 사이트 머리(header·nav)가 없다')
    if (!/<main\b/i.test(html)) detail.push('404 쪽에 <main> 이 없다')
    if (!tagsOf(html, 'a').some((a) => /^\/(?:[a-z]{2}\/?)?$/.test(a.href ?? ''))) detail.push('404 쪽에 홈으로 가는 링크가 없다')
    const lang = html.match(/<html[^>]*\blang="([^"]*)"/i)?.[1]
    if (locale && lang && lang !== locale) detail.push(`404 쪽 <html lang="${lang}"> 가 사이트 로캘 ${locale} 과 다르다`)
  }
  return detail
}

/** 실패 행 → 사람이 읽는 한 줄(candidate.json blockers 와 요약이 쓴다). */
export function describeCheck(c, ctx = {}) {
  const at = [ctx.recipe, c.route].filter(Boolean).join(' ')
  const val = c.value !== undefined ? ` ${c.value}${c.threshold !== undefined ? ` (문턱 ${c.threshold})` : ''}` : ''
  const det = c.detail?.length ? ` — ${Array.isArray(c.detail) ? c.detail.slice(0, 3).join(' · ') : c.detail}` : ''
  return `${at ? `[${at}] ` : ''}${c.id}${val}${det}`
}

/** 검사 행들 → 종료 코드. 필수 규칙의 fail 또는 (naOk 아닌) na 가 있으면 1. */
export function judgeExit(checks) {
  return checks.some((c) => c.level === 'must' && (c.status === 'fail' || (c.status === 'na' && !OPS_CHECKS[c.id]?.naOk))) ? 1 : 0
}

export function summarize(checks) {
  const n = (s) => checks.filter((c) => c.status === s).length
  return { pass: n('pass'), fail: n('fail'), warn: n('warn'), na: n('na') }
}

// ── Lighthouse ──────────────────────────────────────────────────────────────

/** 대표 쪽만 고른다: 홈 · 요금 · 법정 하나 · 문의/예약(C126). 순서 = 우선순위, 최대 max 개. */
export function pickLighthouseRoutes(routes, { max = 4 } = {}) {
  const legal = new Set(Object.values(LEGAL_ROUTES))
  const rules = [(r) => r === '/', (r) => /pricing|price|plans?|services?|products?|menu|요금/i.test(r), (r) => legal.has(r), (r) => /contact|inquiry|booking|reserve|문의|예약/i.test(r)]
  const out = []
  for (const rule of rules) {
    const hit = routes.find((r) => rule(r) && !out.includes(r))
    if (hit) out.push(hit)
  }
  return out.slice(0, max)
}

function nodeLabel(node) {
  if (!node) return null
  const sel = node.selector || node.nodeLabel || ''
  const tag = (node.snippet ?? '').match(/^<([a-z0-9-]+)/i)?.[1]
  return [tag, sel].filter(Boolean).join(' ') || node.snippet?.slice(0, 80) || null
}

/** LHR 에서 LCP 요소 — 느려진 이유를 대려고 쓴다. 감사 id 가 버전마다 달라 상세 안의 node 를 찾는다. */
export function lcpElementOf(lhr) {
  const walk = (v, depth = 0) => {
    if (!v || typeof v !== 'object' || depth > 6) return null
    if (v.type === 'node' && (v.selector || v.snippet)) return v
    for (const x of Array.isArray(v) ? v : Object.values(v)) { const f = walk(x, depth + 1); if (f) return f }
    return null
  }
  for (const id of ['lcp-breakdown-insight', 'largest-contentful-paint-element', 'lcp-discovery-insight', 'prioritize-lcp-image']) {
    const a = lhr.audits?.[id]
    const label = a && nodeLabel(walk(a.details))
    if (label) return label
  }
  return null
}

/**
 * Lighthouse bf-cache 행이 「복원 도중 이동이 취소됨」 이유만 댔을 때의 확인(FV1 Task 5.10 · 골든 12.8).
 * 그 이유는 쪽이 막는 것이 아니다. Chrome 은 이유를 `Circumstantial`(상황 탓 — 시간 초과·이동 취소)과 `PageSupportNeeded`(쪽이 고쳐야 하는 것 — unload 처리기·no-store …)로 나눈다. 렌더러가 부하로 느리면
 * 쪽을 얼리지 못해 `TimeoutPuttingInCache`·`NavigationCancelledWhileRestoring` 이 나온다 — 한가한 기계에서 찍어낸 사이트는 Lighthouse 와 같은 순서로 10/10 복원됐고(factory/qa/bfcache.mjs),
 * 같은 시험이 부하가 낀 때 한 번 `TimeoutPuttingInCache` 로 실패했다(bfcache.test.mjs). 그래서 Lighthouse 를 다시 돌리지 않고(쪽당 수십 초) 직접 복원 시험(probe)으로 가린다:
 * 쪽이 고쳐야 하는 이유가 한 번도 안 나오고 복원이 2번 이상이면 통과, 그 밖은 이유를 붙인 실패. unload·no-store 같은 진짜 막는 이유는 시험하지 않고 Lighthouse 판정 그대로 실패다. 시험이 못 돌면 Lighthouse 판정을 지우지 않는다.
 * @param {object} bf lhrToChecks 가 낸 bf-cache 행
 * @param {{ route: string, url: string, probe: (url: string, o: { tries: number }) => Promise<{ ok: boolean, restored: number, tries: number, reasons: string[] }>, tries?: number }} ctx
 */
export async function confirmBfCacheRow(bf, { route, url, probe, tries = 4 }) {
  if (bf?.status !== 'fail' || !bf.detail?.length || !bf.detail.every((d) => /cancel/i.test(d))) return bf
  let res
  try { res = await probe(url, { tries }) } catch (e) { return { ...bf, detail: [...bf.detail, `직접 확인 못 함: ${e?.message ?? e}`] } }
  if (res.ok) return row('bf-cache', 'pass', { route, detail: [`Lighthouse 는 복원 도중 이동이 취소됐다고 했으나(되돌아가기 타이밍·부하) 직접 되살려 보니 ${res.tries}번 중 ${res.restored}번 복원됐고 쪽이 고쳐야 하는 이유는 없었다`] })
  return { ...bf, detail: [...bf.detail, `직접 확인: ${res.tries}번 중 ${res.restored}번 복원${res.reasons?.length ? ` — ${res.reasons.join(', ')}` : ''}`] }
}

/**
 * 기본 직접 복원 시험 — 주어진 Chrome(Lighthouse 가 쓰던 것)에서 되살려 본다. 복원 `need`(2)번을 채우면 거기서 멈춘다(최대 tries 번).
 * ok = 쪽이 고쳐야 하는 이유(Circumstantial 이 아닌 것)가 한 번도 안 나왔고 복원이 need 번 이상.
 */
export async function bfCacheProbeDefault(url, { tries = 4, need = 2, chrome } = {}) {
  const own = chrome ?? (await startChrome([], { prefix: 'ops-bf-' }))
  try {
    let restored = 0
    let done = 0
    const reasons = new Set()
    let actionable = false
    for (; done < tries && restored < need; ) {
      const r = await measureBfCache(url, { chrome: own })
      done++
      if (r.restored) restored++
      else for (const x of r.reasons) { reasons.add(x.reason); if (x.type !== 'Circumstantial') actionable = true }
    }
    return { ok: !actionable && restored >= need, restored, tries: done, reasons: [...reasons] }
  } finally { if (!chrome) await closeChrome(own) }
}

/** LHR 하나 → 검사 행들(route 표시). 점수가 안 나오면 ToolFailure. */
export function lhrToChecks(lhr, route, { authRoute = false, noindex = false } = {}) {
  const fatal = lhr.runtimeError?.message
  const score = (cat) => {
    const s = lhr.categories?.[cat]?.score
    if (typeof s !== 'number') throw new ToolFailure(`${route}: Lighthouse ${cat} 점수가 없다${fatal ? `(${lhr.runtimeError.code}: ${fatal})` : ''}`)
    return Math.round(s * 100)
  }
  const perf = score('performance')
  const seo = score('seo')
  const a11y = score('accessibility')
  const num = (id) => {
    const v = lhr.audits?.[id]?.numericValue
    if (typeof v !== 'number') throw new ToolFailure(`${route}: Lighthouse ${id} 값이 없다`)
    return v
  }
  const lcp = num('largest-contentful-paint')
  const cls = num('cumulative-layout-shift')
  const el = lcpElementOf(lhr)
  const failWhy = (id) => lhr.audits?.[id]?.details?.items?.slice?.(0, 3).map((i) => i.reason ?? i.failureType ?? JSON.stringify(i).slice(0, 80)) ?? []
  const out = [
    row('lh-perf', perf >= THRESHOLDS['lh-perf'] ? 'pass' : 'fail', { route, value: perf, detail: perf < 90 ? [`LCP ${Math.round(lcp)} ms${el ? ` · LCP 요소 ${el}` : ''}`, ...(Number.isFinite(lhr.audits?.['total-blocking-time']?.numericValue) ? [`TBT ${Math.round(lhr.audits['total-blocking-time'].numericValue)} ms`] : []), envLine(lhr)] : [] }),
    noindex ? row('lh-seo', 'na', { route, detail: ['noindex 쪽 — 크롤 대상이 아니라 SEO 점수를 안 잰다'] }) : row('lh-seo', seo >= THRESHOLDS['lh-seo'] ? 'pass' : 'fail', { route, value: seo, detail: seo < 95 ? failedAudits(lhr, 'seo') : [] }),
    row('lcp', lcp <= THRESHOLDS.lcp ? 'pass' : 'fail', { route, value: Math.round(lcp), detail: [el ? `LCP 요소: ${el}` : 'LCP 요소를 못 읽었다', ...(lcpParts(lhr) ? [`구간: ${lcpParts(lhr)}`] : []), ...(lcp > THRESHOLDS.lcp ? [envLine(lhr)] : [])] }),
    row('cls', cls <= THRESHOLDS.cls ? 'pass' : 'fail', { route, value: Math.round(cls * 1000) / 1000, detail: cls > 0.1 ? shiftCulprits(lhr) : [] }),
    row('lh-a11y', a11y >= THRESHOLDS['lh-a11y'] ? 'pass' : 'warn', { route, value: a11y, detail: a11y < 95 ? failedAudits(lhr, 'accessibility') : [] }),
  ]
  // 참고 행 셋(should — 경고만, 종료 코드를 안 바꾼다): JS 예산·TBT·Agentic Browsing 범주. 값이 없으면 통과가 아니라 na.
  const script = lhr.audits?.['resource-summary']?.details?.items?.find?.((i) => i.resourceType === 'script')
  if (typeof script?.transferSize !== 'number') out.push(row('js-budget', 'na', { route, detail: ['Lighthouse resource-summary 에 script 행이 없어 JS 전송량을 못 쟀다'] }))
  else {
    const kb = Math.round(script.transferSize / 1024)
    const over = script.transferSize > THRESHOLDS['js-budget'] * 1024
    out.push(row('js-budget', over ? 'warn' : 'pass', { route, value: kb, detail: over ? [`첫 화면 JS ${kb} KB${script.requestCount ? `(스크립트 ${script.requestCount}개)` : ''} — 전송량 기준(압축 후), 문턱 ${THRESHOLDS['js-budget']} KB`] : [] }))
  }
  const tbt = lhr.audits?.['total-blocking-time']?.numericValue
  if (typeof tbt !== 'number') out.push(row('tbt', 'na', { route, detail: ['Lighthouse total-blocking-time 값이 없다'] }))
  else out.push(row('tbt', tbt <= THRESHOLDS.tbt ? 'pass' : 'warn', { route, value: Math.round(tbt), detail: tbt > THRESHOLDS.tbt ? [`TBT ${Math.round(tbt)} ms — 긴 작업이 입력을 막는다(모의 값)`] : [] }))
  const agentic = lhr.categories?.['agentic-browsing']?.score
  if (typeof agentic !== 'number') out.push(row('agentic-browsing', 'na', { route, detail: ['이 Lighthouse 결과에 agentic-browsing 범주가 없다'] }))
  else out.push(row('agentic-browsing', agentic >= 1 ? 'pass' : 'warn', { route, value: Math.round(agentic * 100), detail: agentic >= 1 ? [] : failedAudits(lhr, 'agentic-browsing') }))
  if (authRoute) out.push(row('bf-cache', 'na', { route, detail: ['로그인·계정 화면은 뒤로 가기 캐시 대상이 아니다'] }))
  else {
    const bf = lhr.audits?.['bf-cache']
    if (!bf || bf.scoreDisplayMode === 'error') throw new ToolFailure(`${route}: Lighthouse bf-cache 감사가 결과를 못 냈다${bf?.errorMessage ? `(${bf.errorMessage})` : ''}`)
    if (bf.scoreDisplayMode === 'notApplicable' || bf.score === null) out.push(row('bf-cache', 'na', { route, detail: ['Lighthouse 가 이 쪽에서 bf-cache 를 잴 수 없다고 했다'] }))
    else out.push(row('bf-cache', bf.score === 1 ? 'pass' : 'fail', { route, detail: bf.score === 1 ? [] : failWhy('bf-cache') }))
  }
  return out
}

/**
 * 측정 환경 기록 — 같은 쪽이 PC 가 붐빌 때 느리게 나오는지 가리려고 결과 파일에 같이 남긴다(P3-4 PERF2, 대표 지적).
 * Lighthouse 기본 모바일은 simulate(Lantern)라 「관측한 작업 시간 × cpuSlowdownMultiplier」로 LCP 를 계산한다 — 측정 중 CPU 가 붐비면 값이 부푼다.
 * benchmarkIndex 는 이 PC 의 단일 스레드 속도 지표(Lighthouse 가 돌 때마다 잰다) — 값이 낮거나 같은 쪽에서 크게 흔들리면 측정 환경 불량이다.
 * 근거: Lighthouse docs/throttling.md · docs/variability.md (github.com/GoogleChrome/lighthouse/tree/main/docs).
 */
export function lhrEnvironment(lhr, route) {
  const cs = lhr.configSettings ?? {}
  const th = cs.throttling ?? {}
  const phases = {}
  for (const t of lhr.audits?.['lcp-breakdown-insight']?.details?.items ?? []) {
    if (t.type !== 'table') continue
    for (const i of t.items ?? []) if (i.subpart && typeof i.duration === 'number') phases[i.subpart] = Math.round(i.duration)
  }
  const metric = (id) => (typeof lhr.audits?.[id]?.numericValue === 'number' ? Math.round(lhr.audits[id].numericValue) : null)
  return {
    route,
    benchmarkIndex: typeof lhr.environment?.benchmarkIndex === 'number' ? Math.round(lhr.environment.benchmarkIndex) : null,
    networkUserAgent: lhr.environment?.networkUserAgent ?? null,
    throttlingMethod: cs.throttlingMethod ?? null,
    cpuSlowdownMultiplier: th.cpuSlowdownMultiplier ?? null,
    rttMs: th.rttMs ?? null,
    throughputKbps: th.throughputKbps ?? null,
    lcpMs: metric('largest-contentful-paint'),
    fcpMs: metric('first-contentful-paint'),
    lcpPhases: phases, // 관측한 구간(모의가 아니다) — 대개 TTFB·요소 렌더 지연(글자), 그림이면 로드 지연·로드 시간도
  }
}

/** 이 값 미만이면 느린 PC 다 — Lighthouse 모의 점수가 PC 속도에 흔들린다(FINAL-WF P2: benchmarkIndex 1922 → 69점, 3000 → 99점). */
export const SLOW_PC_BENCHMARK = 2000

/**
 * 느린 PC 보정(FINAL-WF P2): 첫 측정의 benchmarkIndex 가 2000 미만이고 lh-perf(실패)·tbt(경고)가 문턱 미달이면 그 두 행만 2번 더 재서 중앙값으로 판정한다.
 * 그래도 미달이면 그 행의 detail 에 이 PC 의 측정 속도를 적는다. 문턱 값은 바꾸지 않는다. 빠른 PC(≥ 2000)이거나 통과면 다시 재지 않는다.
 * first = { rows, lhr } (lhrToChecks 결과 + 그 LHR) · remeasure = async () => ({ rows, lhr }) — ToolFailure 면 그 번은 건너뛴다.
 * @returns {Promise<{ rows: object[], remeasured: number, benchmarkIndex: number|null }>}
 */
export async function settlePerfOnSlowPc(first, remeasure, { extraRuns = 2 } = {}) {
  const bench = typeof first.lhr?.environment?.benchmarkIndex === 'number' ? Math.round(first.lhr.environment.benchmarkIndex) : null
  const rowOf = (rows, id) => rows.find((c) => c.id === id)
  const low = (rows) => rowOf(rows, 'lh-perf')?.status === 'fail' || rowOf(rows, 'tbt')?.status === 'warn'
  if (bench === null || bench >= SLOW_PC_BENCHMARK || !low(first.rows)) return { rows: first.rows, remeasured: 0, benchmarkIndex: bench }
  const runs = [first]
  for (let i = 0; i < extraRuns; i++) {
    try { runs.push(await remeasure()) } catch (e) { if (!(e instanceof ToolFailure)) throw e }
  }
  const median = (id) => {
    const xs = runs.map((r) => ({ row: rowOf(r.rows, id), v: rowOf(r.rows, id)?.value })).filter((x) => typeof x.v === 'number').sort((a, b) => a.v - b.v)
    return xs.length ? xs[Math.floor((xs.length - 1) / 2)] : null // 짝수면 낮은 쪽 가운데(보수적)
  }
  const n = runs.length
  const note = (r, label) => ({ ...r, detail: [...(r.detail ?? []), `${n}회 측정 중앙값 ${label}`, `이 PC 의 측정 속도 benchmarkIndex ${bench} — 느린 PC 에서는 점수가 낮게 나온다`] })
  const rows = first.rows.map((c) => {
    if (c.id !== 'lh-perf' && c.id !== 'tbt') return c
    const pick = median(c.id)
    const chosen = pick?.row ?? c
    const failing = c.id === 'lh-perf' ? chosen.status === 'fail' : chosen.status === 'warn'
    return failing ? note(chosen, c.id === 'lh-perf' ? `${chosen.value}점` : `${chosen.value} ms`) : chosen
  })
  return { rows, remeasured: n - 1, benchmarkIndex: bench }
}

const envLine = (lhr) => {
  const e = lhrEnvironment(lhr, '')
  return `측정 환경: benchmarkIndex ${e.benchmarkIndex ?? '?'} · ${e.throttlingMethod ?? '?'} · CPU ${e.cpuSlowdownMultiplier ?? '?'}배 감속`
}

/** LCP 구간(TTFB·로드 지연·로드 시간·요소 렌더 지연) — 어디서 늦어지는지 적는다. */
function lcpParts(lhr) {
  const tables = lhr.audits?.['lcp-breakdown-insight']?.details?.items ?? []
  return tables.flatMap((t) => (t.type === 'table' ? t.items : [])).filter((i) => i.subpart && typeof i.duration === 'number').map((i) => `${i.subpart} ${Math.round(i.duration)} ms`).join(' · ')
}

function failedAudits(lhr, cat) {
  const refs = lhr.categories?.[cat]?.auditRefs ?? []
  return refs.filter((r) => r.weight > 0 && lhr.audits?.[r.id]?.score !== null && lhr.audits?.[r.id]?.score < 1).slice(0, 4).map((r) => r.id)
}
function shiftCulprits(lhr) {
  const items = lhr.audits?.['layout-shifts']?.details?.items ?? lhr.audits?.['cls-culprits-insight']?.details?.items ?? []
  const nodes = []
  const walk = (v, d = 0) => { if (!v || typeof v !== 'object' || d > 5 || nodes.length >= 3) return; if (v.type === 'node') nodes.push(nodeLabel(v)); else for (const x of Array.isArray(v) ? v : Object.values(v)) walk(x, d + 1) }
  walk(items)
  return nodes.length ? [`밀린 요소: ${nodes.filter(Boolean).join(' · ')}`] : []
}

/** 기본 Lighthouse 실행기 — 같은 Chrome 을 CDP 포트로 넘겨 재사용한다. */
export async function runLighthouseDefault(url, { port, formFactor = 'mobile' }) {
  const { default: lighthouse } = await import('lighthouse')
  // Agentic Browsing 범주는 Lighthouse 13 에 들어왔다 — 설치된 판의 기본 설정에 있을 때만 요청한다(없는 범주를 요청하면 Lighthouse 가 설정 오류로 던진다).
  const hasAgentic = !!(await import('lighthouse/core/config/default-config.js')).default?.categories?.['agentic-browsing']
  const flags = { port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'seo', 'accessibility', ...(hasAgentic ? ['agentic-browsing'] : [])] }
  let config
  if (formFactor === 'desktop') config = (await import('lighthouse/core/config/desktop-config.js')).default
  else flags.formFactor = 'mobile'
  const r = await lighthouse(url, flags, config)
  if (!r?.lhr) throw new ToolFailure(`${url}: Lighthouse 가 결과를 돌려주지 않았다`)
  return r.lhr
}

// ── 동의 탐사(CDP) ──────────────────────────────────────────────────────────

/** 홈을 새 Chrome 프로필로 열어 동의 전 요청을 세고, 배너의 「허용」을 눌러 그 뒤 요청을 센다. */
export async function consentProbeDefault(url, { settleMs = 1800 } = {}) {
  const chrome = await startChrome([], { prefix: 'ops-consent-' })
  let cdp
  try {
    const events = []
    cdp = await connect(chrome.wsUrl, { onEvent: (d) => { if (d.method === 'Network.requestWillBeSent') events.push({ url: d.params.request.url, method: d.params.request.method, type: d.params.type, postData: d.params.request.postData }) } })
    await cdp.send('Network.enable')
    await cdp.send('Page.enable')
    const nav = await navigateAndWait(cdp.send, cdp.ev, url, { timeoutMs: 20000 })
    if (nav?.result?.errorText) throw new ToolFailure(`동의 탐사: ${url} 를 열지 못했다(${nav.result.errorText})`)
    await new Promise((r) => setTimeout(r, settleMs))
    const before = events.slice()
    const mark = events.length // 클릭이 낸 요청 이벤트는 evaluate 응답보다 먼저 온다 — 클릭 전에 표시를 잡는다
    const clicked = await cdp.ev(`(() => {
      const acc = ${CONSENT_ACCEPT}, dec = ${CONSENT_DECLINE}
      const scope = [...document.querySelectorAll('[role=region],[role=dialog],[role=alertdialog],[id*=cookie i],[id*=consent i],[class*=cookie i],[class*=consent i],[data-consent-banner]')]
      const pool = [...(scope.length ? scope.flatMap((s) => [...s.querySelectorAll('button,a,[role=button]')]) : []), ...document.querySelectorAll('[data-consent="accept"],button')]
      const el = pool.find((e) => { const t = (e.getAttribute('aria-label') || e.textContent || '').trim(); return t && acc.test(t) && !dec.test(t) })
      if (!el) return false
      el.click()
      return true
    })()`)
    await new Promise((r) => setTimeout(r, settleMs))
    const after = events.slice(mark)
    return { banner: clicked === true, before, after }
  } finally {
    try { cdp?.ws.close() } catch {}
    await chrome.close()
  }
}

// ── 사이트 읽기 ─────────────────────────────────────────────────────────────

const archetypeOf = (archetype) => {
  const file = join(ROOT, 'registry', 'factory', 'archetypes', `${archetype}.json`)
  if (!existsSync(file)) throw new ToolFailure(`원형 파일이 없다: ${file}`)
  return JSON.parse(readFileSync(file, 'utf8'))
}
const legalPagesOf = (archetype) => archetypeOf(archetype).legal?.pages ?? []

/** 원형 id → 완성 종류(원형 JSON 의 completion: site · product). 보안 헤더 규칙이 이것으로 갈린다(site = 해시, product = nonce). */
export const completionOf = (archetype) => archetypeOf(archetype).completion

/** 원형 id → 그 원형이 요구하는 법정 쪽 경로들. */
export const legalRoutesOf = (archetype) => legalPagesOf(archetype).map((p) => LEGAL_ROUTES[p] ?? `/${p}`)

async function imageInfo(buf) {
  try { const m = await sharp(buf).metadata(); return { format: m.format, width: m.width, height: m.height } } catch { return null }
}

/**
 * 운영 준비 관문. 열리지 않는 주소(홈)나 Chrome·Lighthouse 실패는 ToolFailure 로 던진다 — 판정 실패가 아니다.
 * @param {string} origin
 * @param {{ routes?: string[], locale?: string, archetype?: string, legalRoutes?: string[], recipe?: string, siteDir?: string,
 *           lhRoutes?: string[]|'all'|'none', formFactor?: 'mobile'|'desktop', consentRoute?: string,
 *           fetch?: Function, runLighthouse?: Function, consentProbe?: Function, log?: Function }} [opts]
 */
export async function opsGate(origin, opts = {}) {
  const { routes = ['/'], locale = 'ko', archetype = null, recipe = null, siteDir = null, formFactor = 'mobile', consentRoute = '/', requireAnalytics = false, log = () => {} } = opts
  const fetchImpl = opts.fetch ?? globalThis.fetch
  const runLighthouse = opts.runLighthouse ?? runLighthouseDefault
  const consentProbe = opts.consentProbe ?? consentProbeDefault
  const bfProbe = opts.bfProbe ?? bfCacheProbeDefault
  const base = origin.replace(/\/+$/, '')

  const get = async (path, init) => {
    let r
    try { r = await fetchImpl(`${base}${path}`, { signal: AbortSignal.timeout(20_000), redirect: 'manual', ...init }) } catch (e) { throw new ToolFailure(`${path} 를 읽지 못했다: ${e?.cause?.code ?? e?.message ?? e}`) }
    return r
  }
  const text = async (path) => { const r = await get(path); return { status: r.status, headers: r.headers, html: await r.text() } }
  const bytes = async (path) => { const r = await get(path); return { status: r.status, type: r.headers.get('content-type') ?? '', buf: Buffer.from(await r.arrayBuffer()) } }

  const checks = []
  const add = (c) => { checks.push(c); return c }

  // 0. 쪽을 읽는다. 홈이 안 열리면 도구 실패다.
  const pages = []
  for (const route of routes) {
    const p = await text(route)
    pages.push({ route, ...p, noindex: isNoindex(p.html, p.headers) })
    if (route === routes[0] && p.status >= 500) throw new ToolFailure(`${route} 가 ${p.status} — 사이트가 열리지 않는다`)
  }
  const bad = pages.filter((p) => p.status !== 200)
  add(row('routes-open', bad.length ? 'fail' : 'pass', { value: `${pages.length - bad.length}/${pages.length}쪽`, detail: bad.map((p) => `${p.route} → ${p.status}`) }))
  const open = pages.filter((p) => p.status === 200)
  const home = open.find((p) => p.route === '/') ?? open[0]
  if (!home) throw new ToolFailure(`열리는 쪽이 하나도 없다(${routes.join(', ')})`)

  // 1. viewport
  add(judgeViewport(open))
  add(judgePageStructure(open, locale))
  add(judgeFactsEmpty(opts.siteJson ?? null))

  // 2. 법정 쪽
  let legalRoutes = opts.legalRoutes ?? (archetype ? legalRoutesOf(archetype) : null)
  if (legalRoutes === null) throw new ToolFailure('archetype 도 legalRoutes 도 없다 — 어떤 법정 쪽이 필요한지 알 수 없다')
  if (!legalRoutes.length) add(row('legal-routes', 'na', { detail: ['원형이 법정 쪽을 요구하지 않는다'] }))
  else {
    const detail = []
    for (const r of legalRoutes) { const x = await get(r); await x.arrayBuffer(); if (x.status !== 200) detail.push(`GET ${r} → ${x.status}`) }
    add(row('legal-routes', detail.length ? 'fail' : 'pass', { value: `${legalRoutes.length - detail.length}/${legalRoutes.length}쪽`, detail }))
  }

  // 3. og:image — 색인 쪽마다. 절대 주소는 운영 주소일 수 있어(미리보기에서는 아직 안 열린다) 경로만 떼어 origin 에 붙여 읽는다.
  {
    const detail = []
    const cache = new Map()
    for (const p of open.filter((x) => !x.noindex)) {
      const og = metaContent(p.html, 'property', 'og:image')
      if (!og) { detail.push(`${p.route}: og:image 메타가 없다`); continue }
      if (!/^https?:\/\//i.test(og)) { detail.push(`${p.route}: og:image 가 절대 주소가 아니다(${og})`); continue }
      const path = (() => { try { const u = new URL(og); return u.pathname + u.search } catch { return null } })()
      if (!path) { detail.push(`${p.route}: og:image 주소가 이상하다(${og})`); continue }
      if (!cache.has(path)) {
        const r = await bytes(path)
        const info = r.status === 200 ? await imageInfo(r.buf) : null
        const msg = []
        if (r.status !== 200) msg.push(`GET ${path} → ${r.status}`)
        else if (!info || !['png', 'jpeg'].includes(info.format)) msg.push(`${path} 가 PNG/JPEG 가 아니다(${info?.format ?? r.type ?? '알 수 없음'})`)
        else if (info.width !== 1200 || info.height !== 630) msg.push(`${path} 가 ${info.width}×${info.height} 다(1200×630 이어야 한다)`)
        cache.set(path, msg)
      }
      for (const m of cache.get(path)) detail.push(`${p.route}: ${m}`)
    }
    add(row('og-image', detail.length ? 'fail' : 'pass', { detail: [...new Set(detail)] }))
  }

  // 4. 파비콘 묶음
  {
    const detail = []
    const links = (rel) => linksRel(home.html, rel)
    const icons = links('icon').concat(links('shortcut'))
    const load = async (href) => { const path = pathOfUrl(href, `${base}/`); const r = await bytes(path); return { path, ...r } }
    const icoLink = icons.find((l) => /\.ico(?:$|\?)/i.test(l.href ?? '')) ?? { href: '/favicon.ico' }
    const ico = await load(icoLink.href)
    if (ico.status !== 200) detail.push(`ico ${ico.path} → ${ico.status}`)
    else {
      const sizes = icoSizes(ico.buf)
      if (!sizes) detail.push(`${ico.path} 가 ICO 모양이 아니다`)
      else for (const s of [16, 32]) if (!sizes.some((x) => x.w === s && x.h === s)) detail.push(`ico 에 ${s}×${s} 가 없다(${sizes.map((x) => `${x.w}×${x.h}`).join(', ') || '비었다'})`)
    }
    const svgLink = icons.find((l) => /svg/i.test(l.type ?? '') || /\.svg(?:$|\?)/i.test(l.href ?? ''))
    if (!svgLink) detail.push('<link rel="icon" type="image/svg+xml"> 이 없다')
    else { const s = await load(svgLink.href); if (s.status !== 200 || !/<svg/i.test(s.buf.toString('utf8', 0, 400))) detail.push(`svg 아이콘 ${s.path} → ${s.status}(SVG 가 아니다)`) }
    const apple = links('apple-touch-icon')[0]
    if (!apple) detail.push('<link rel="apple-touch-icon"> 이 없다')
    else {
      const a = await load(apple.href)
      const info = a.status === 200 ? await imageInfo(a.buf) : null
      if (a.status !== 200) detail.push(`apple 아이콘 ${a.path} → ${a.status}`)
      else if (!info || info.width !== 180 || info.height !== 180) detail.push(`apple 아이콘이 ${info ? `${info.width}×${info.height}` : '이미지가 아니다'}(180×180 이어야 한다)`)
    }
    const mf = links('manifest')[0]
    if (!mf) detail.push('<link rel="manifest"> 이 없다')
    else {
      const m = await text(pathOfUrl(mf.href, `${base}/`))
      let json = null
      try { json = JSON.parse(m.html) } catch {}
      if (m.status !== 200 || !json) detail.push(`manifest ${mf.href} → ${m.status}(JSON 이 아니다)`)
      else {
        const list = Array.isArray(json.icons) ? json.icons : []
        const want = [['192', 'any'], ['512', 'any'], ['512', 'maskable']]
        for (const [size, purpose] of want) {
          const hit = list.find((i) => (i.sizes ?? '').split(/\s+/).includes(`${size}x${size}`) && (purpose === 'maskable' ? /maskable/.test(i.purpose ?? '') : !/^maskable$/.test(i.purpose ?? '')))
          if (!hit) { detail.push(`manifest 에 ${size}×${size} ${purpose} 아이콘이 없다`); continue }
          const r = await bytes(pathOfUrl(hit.src, `${base}/`))
          const info = r.status === 200 ? await imageInfo(r.buf) : null
          if (r.status !== 200) detail.push(`manifest 아이콘 ${hit.src} → ${r.status}`)
          else if (!info || info.width !== Number(size) || info.height !== Number(size)) detail.push(`manifest 아이콘 ${hit.src} 는 ${info ? `${info.width}×${info.height}` : '이미지가 아님'}(선언 ${size}×${size})`)
        }
      }
    }
    add(row('favicon-set', detail.length ? 'fail' : 'pass', { detail }))
  }

  // 5. 오류 쪽 — 404 는 HTTP 로, 500 경계는 파일로(원천 폴더를 줄 때만).
  {
    const nf = await text(`/__ops-gate-404-${process.pid}`)
    const detail = judgeNotFound(nf, locale)
    if (siteDir) {
      for (const f of ['error', 'global-error']) if (!['tsx', 'jsx', 'ts', 'js'].some((e) => existsSync(join(siteDir, 'app', `${f}.${e}`)))) detail.push(`app/${f}.tsx 가 없다(500 경계)`)
      add(row('error-pages', detail.length ? 'fail' : 'pass', { detail }))
    } else add(row('error-pages', detail.length ? 'fail' : 'warn', { detail: detail.length ? detail : ['404 는 사이트 셸이다. 500 경계(error·global-error)는 --site 없이 못 재서 안 쟀다'] }))
  }

  // 6. 보안 헤더 — completion 으로 갈린다: site(정적) = script-src 'self' + 해시 · product = nonce(요청마다 다름). opts.security 로 못 박을 수 있다.
  //    (찍어낸 사이트는 원형이 product 여도 정적 앞면이라 07-qa 어댑터가 'hash' 를 준다 — nonce 는 launch-factory 템플릿의 몫)
  {
    const mode = opts.security && opts.security !== 'auto' ? opts.security : archetype && completionOf(archetype) === 'product' ? 'nonce' : 'hash'
    if (mode === 'nonce') {
      const a = await text('/')
      const b2 = await text('/')
      add(judgeSecurityHeaders(a, b2))
    } else {
      const nf404 = await text(`/__ops-gate-csp-404-${process.pid}`)
      add(judgeSecurityHeadersHash([...open.map((p) => ({ route: p.route, headers: p.headers, html: p.html })), { route: '(404)', headers: nf404.headers, html: nf404.html }]))
    }
  }

  // 7. sitemap · robots
  {
    const sm = await text('/sitemap.xml')
    const rb = await text('/robots.txt')
    add(judgeSitemapRobots({ pages: open.map((p) => ({ route: p.route, noindex: p.noindex })), sitemapStatus: sm.status, sitemapXml: sm.html, robotsStatus: rb.status, robotsTxt: rb.html }))
  }

  // 8. 계측 동의(Chrome)
  add(judgeConsent(await consentProbe(`${base}${consentRoute}`), base, { requireAnalytics }))

  // 9. Lighthouse — 대표 쪽만
  const openRoutes = open.map((p) => p.route)
  const noindexRoutes = new Set(open.filter((p) => p.noindex).map((p) => p.route))
  const lhRoutes = opts.lhRoutes === 'all' ? openRoutes : opts.lhRoutes === 'none' ? [] : Array.isArray(opts.lhRoutes) ? opts.lhRoutes : pickLighthouseRoutes(openRoutes.filter((r) => !noindexRoutes.has(r)))
  const lighthouse = { measured: 0, total: openRoutes.length, routes: [], formFactor, runs: [] }
  if (lhRoutes.length) {
    const chrome = await startChrome([], { prefix: 'ops-lh-' })
    try {
      for (const route of lhRoutes) {
        log(`lighthouse ${route}`)
        const measure = async () => {
          let lhr
          try { lhr = await runLighthouse(`${base}${route}`, { port: chrome.port, formFactor }) } catch (e) { if (e instanceof ToolFailure) throw e; throw new ToolFailure(`${route}: Lighthouse 실패 — ${e?.message ?? e}`) }
          lighthouse.runs.push(lhrEnvironment(lhr, route))
          return { lhr, rows: lhrToChecks(lhr, route, { authRoute: AUTH_ROUTE.test(route), noindex: noindexRoutes.has(route) }) }
        }
        // 느린 PC(benchmarkIndex < 2000)에서 lh-perf·tbt 가 문턱 미달이면 그 두 행만 2번 더 재서 중앙값으로 판정한다(P2).
        const settled = await settlePerfOnSlowPc(await measure(), measure)
        const rows = settled.rows
        if (settled.remeasured) log(`lighthouse ${route} 느린 PC(benchmarkIndex ${settled.benchmarkIndex}) — lh-perf·tbt ${settled.remeasured}번 더 재서 중앙값`)
        // bf-cache 의 「복원 도중 이동이 취소됨」은 쪽 탓이 아니라 Lighthouse 의 되돌아가기 타이밍이다 — Lighthouse 를 다시 돌리는 대신 직접 되살려 본다(confirmBfCacheRow).
        const bfAt = rows.findIndex((c) => c.id === 'bf-cache')
        if (bfAt >= 0 && rows[bfAt].status === 'fail') {
          const confirmed = await confirmBfCacheRow(rows[bfAt], { route, url: `${base}${route}`, probe: (u, o) => bfProbe(u, { ...o, chrome }) })
          if (confirmed !== rows[bfAt]) log(`lighthouse ${route} bf-cache 직접 확인: ${confirmed.status}`)
          rows[bfAt] = confirmed
        }
        checks.push(...rows)
        lighthouse.measured++
        lighthouse.routes.push(route)
      }
    } finally { await chrome.close() }
  }

  const exit = judgeExit(checks)
  return { origin: base, recipe, archetype, locale, formFactor, routes, lighthouse, checks, summary: { ...summarize(checks), lighthouse: `${lighthouse.measured}/${lighthouse.total}` }, exit }
}

// ── 후보 어댑터(07-qa) ──────────────────────────────────────────────────────

const readJsonMaybe = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }
const writeAtomic = (file, text) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(`${file}.tmp`, text); renameSync(`${file}.tmp`, file) }

/**
 * qa.mjs 의 게이트 기록과 같은 모양으로 ops-gate 결과를 돌려준다(컨트롤러가 07-qa 의 ops 최소판 자리에 끼운다).
 *   { id: 'ops', tool: 'ops', exit, verdict: 'pass'|'fail'|'tool', toolFailure, note, attempts, seconds, resultFile?, problems? }
 * 결과 파일: <runDir>/<cand.id>/07-qa/ops-gate.json. 도구 실패면 이전 파일도 지운다(파일 없음 = 도구 실패).
 * @param {{ origin: string, routes?: string[], lhRoutes?: any, runOps?: Function, fetch?: Function, runLighthouse?: Function, consentProbe?: Function, log?: Function }} opts
 */
export async function opsGateForCandidate(runDir, cand, { origin, runOps = opsGate, ...rest }) {
  const candDir = join(runDir, cand.id)
  const siteDir = join(candDir, 'site')
  const file = join(candDir, '07-qa', 'ops-gate.json')
  rmSync(file, { force: true })
  const t0 = Date.now()
  const secs = () => Math.round((Date.now() - t0) / 100) / 10
  const toolRec = (note) => ({ id: 'ops', tool: 'ops', exit: 1, verdict: 'tool', toolFailure: true, note: `도구 실패: ${note.replace(/^도구 실패:\s*/, '')}`, attempts: 1, seconds: secs() })
  try {
    const siteJson = readJsonMaybe(join(siteDir, 'content', 'site.json'))
    if (!siteJson) throw new ToolFailure(`${join(siteDir, 'content', 'site.json')} 없음 — 06-pages 를 먼저 돌린다`)
    const candJson = readJsonMaybe(join(candDir, 'candidate.json')) ?? {}
    const archetype = cand.archetype ?? candJson.archetype ?? siteJson.archetype ?? null
    if (!archetype) throw new ToolFailure('후보에 archetype 이 없다 — 법정 쪽 요구를 알 수 없다')
    const recipe = typeof (cand.recipe ?? candJson.recipe) === 'string' ? (cand.recipe ?? candJson.recipe) : (candJson.recipeId ?? cand.recipeId ?? cand.id)
    const routes = rest.routes ?? Object.keys(siteJson.pages ?? {})
    if (!routes.length) throw new ToolFailure('site.json 에 쪽이 하나도 없다')
    const result = await runOps(origin, { security: 'hash', ...rest, routes, locale: siteJson.locale === 'en' ? 'en' : 'ko', archetype, recipe, siteDir, siteJson })
    const out = { candidate: cand.id, generatedAt: new Date().toISOString(), ...result }
    writeAtomic(file, JSON.stringify(out, null, 2) + '\n')
    const problems = result.checks.filter((c) => c.level === 'must' && (c.status === 'fail' || (c.status === 'na' && !OPS_CHECKS[c.id]?.naOk))).map((c) => describeCheck(c, { recipe }))
    const fail = result.exit !== 0
    return {
      id: 'ops', tool: 'ops', exit: result.exit, verdict: fail ? 'fail' : 'pass', toolFailure: false, attempts: 1, seconds: secs(),
      note: fail ? `${problems.length}건` : `통과 — Lighthouse 잰 쪽 ${result.summary.lighthouse}`, resultFile: relative(candDir, file).replace(/\\/g, '/'), problems,
    }
  } catch (e) {
    if (!(e instanceof ToolFailure)) throw e
    return toolRec(e.message)
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const usage = () => { console.error('사용: ops-gate.mjs <origin> --out <dir> [--routes /,/pricing] [--site <siteDir>] [--archetype <id>] [--locale ko|en] [--recipe <id>] [--form-factor mobile|desktop] [--lh-routes auto|all|none|/a,/b] [--security auto|hash|nonce] [--require-analytics]'); process.exit(2) }

export async function main(argv = process.argv.slice(2)) {
  const args = { routes: null }
  const pos = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--require-analytics') args.requireAnalytics = true
    else if (a.startsWith('--')) {
      const v = argv[i + 1]
      if (v === undefined || v.startsWith('--')) usage()
      args[a.slice(2)] = v
      i++
    } else pos.push(a)
  }
  const origin = pos[0]
  if (!origin || !/^https?:\/\//i.test(origin) || !args.out || pos.length > 1) usage()
  if (args['form-factor'] && !['mobile', 'desktop'].includes(args['form-factor'])) usage()
  if (args.security && !['auto', 'hash', 'nonce'].includes(args.security)) usage()
  const file = join(args.out, 'ops-gate.json')
  rmSync(file, { force: true }) // 앞 실행의 결과를 도구 실패 뒤에 남기지 않는다
  let code = 0
  try {
    const siteJson = args.site ? readJsonMaybe(join(args.site, 'content', 'site.json')) : null
    const routes = args.routes ? args.routes.split(',').filter(Boolean) : siteJson?.pages ? Object.keys(siteJson.pages) : ['/']
    const archetype = args.archetype ?? siteJson?.archetype ?? null
    if (!archetype) throw new ToolFailure('--archetype 을 주거나 --site 의 site.json 에 archetype 이 있어야 한다(법정 쪽 요구를 알아야 잴 수 있다)')
    const lh = args['lh-routes']
    const result = await opsGate(origin, {
      routes, archetype, siteJson, locale: args.locale ?? siteJson?.locale ?? 'ko', recipe: args.recipe ?? null, siteDir: args.site ?? null, requireAnalytics: args.requireAnalytics === true, security: args.security ?? 'auto', formFactor: args['form-factor'] ?? 'mobile',
      lhRoutes: lh === undefined || lh === 'auto' ? undefined : lh === 'all' || lh === 'none' ? lh : lh.split(',').filter(Boolean), log: (m) => console.error(m),
    })
    writeAtomic(file, JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2) + '\n')
    for (const c of result.checks.filter((x) => x.status === 'fail' || x.status === 'warn' || (x.status === 'na' && !OPS_CHECKS[x.id].naOk))) console.error(`${c.status === 'fail' ? '실패' : c.status === 'warn' ? '경고' : 'na'}: ${describeCheck(c, { recipe: result.recipe })}`)
    console.log(`ops-gate: 통과 ${result.summary.pass} · 실패 ${result.summary.fail} · 경고 ${result.summary.warn} · na ${result.summary.na} · Lighthouse 잰 쪽 ${result.summary.lighthouse} → 종료 ${result.exit}`)
    code = result.exit
  } catch (e) {
    if (!(e instanceof ToolFailure)) console.error(e?.stack ?? e)
    console.error(`도구 실패: ${e?.message ?? e}`)
    code = 1
    rmSync(file, { force: true })
  }
  process.exit(code)
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
