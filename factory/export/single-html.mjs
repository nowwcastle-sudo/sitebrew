// 단일 HTML 내보내기(P3-3 Task 13):
//   exportSingleHtml(siteDir, route) → { file, diffRatio, diff: { 1440, 375 }, bytes, external }
//   1) Next 정적 내보내기(WF_STATIC_EXPORT=1 → output "export", distDir ".next-export") — 사이트 템플릿 next.config.ts 가 이 환경 변수를 읽는다.
//   2) 쪽 하나의 HTML 을 CSS 인라인 단일 파일로: <link rel=stylesheet> → <style>, @font-face 는 쪽에 실제 쓰인 글자를 덮는 조각만 남겨 data URI 로,
//      Next 스크립트(하이드레이션·RSC 페이로드)는 지우고 JSON-LD 만 남긴다. 등장 모션 런타임이 없으므로 <html data-motion="off">(MotionBoot 가 가리지 않게).
//   3) 폼은 서버 없이 — action 을 지우고, 계약 어댑터 adapter-static(mailtoSubmit·kakaoChannelSubmit·telLink)의 실제 코드를 TS 에서 옮겨 인라인한다.
//   4) React 렌더와 1440·375 전체 화면 스크린샷을 sharp raw RGBA 로 비교한다(채널 차이 > 16 인 픽셀 비율, 예산 0.5%). 기준은 React 가 서버에서 그린 화면
//      (내보낸 폴더를 그대로 서빙, 스크립트 끔) — 스크립트 없는 파일이 그릴 수 있는 것은 그것뿐이다. 하이드레이션 뒤 화면은 마운트 뒤에만 정해지는 값
//      (지금 시각의 영업 중/종료 문구 등)을 더 그리므로 그 차이는 diffHydrated 로 따로 보고한다(예산 밖 정보).
// 무거운 실행(next build·headless Chrome)은 부르는 쪽이 실행 잠금(원장 gate 줄) 안에서 한다.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, posix, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { connect, navigateAndWait, startChrome } from '../qa/cdp.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const req = createRequire(join(ROOT, 'package.json'))
const ts = req('typescript')
const FACTORY = join(ROOT, 'registry', 'factory')
export const EXPORT_DIR = '.next-export'
export const WIDTHS = [1440, 375]
export const DIFF_BUDGET = 0.005 // 계획: React 렌더와 스크린샷 차이 0.5% 이하
export const CHANNEL_THRESHOLD = 16
const INLINE_ASSET_MAX = 300 * 1024 // 이보다 큰 이미지·배경은 인라인하지 않고 external 로 보고한다

// ── 픽셀 비교 ─────────────────────────────────────────────────────────────

/** RGBA 두 장({ data, width, height })의 다른 픽셀 비율. 채널 하나라도 차이가 threshold 보다 크면 다른 픽셀이다. 높이가 다르면 모자란 쪽은 투명(전부 다름)으로 채운다. */
export function rawDiff(a, b, threshold = CHANNEL_THRESHOLD) {
  if (a.width !== b.width) throw new Error(`너비가 다르다: ${a.width} ≠ ${b.width}`)
  const height = Math.max(a.height, b.height)
  const total = a.width * height
  let changed = 0
  const bytes = a.width * 4
  for (let y = 0; y < height; y++) {
    const inA = y < a.height
    const inB = y < b.height
    if (!inA || !inB) { changed += a.width; continue }
    const oa = y * bytes
    for (let x = 0; x < bytes; x += 4) {
      const o = oa + x
      if (Math.abs(a.data[o] - b.data[o]) > threshold || Math.abs(a.data[o + 1] - b.data[o + 1]) > threshold || Math.abs(a.data[o + 2] - b.data[o + 2]) > threshold || Math.abs(a.data[o + 3] - b.data[o + 3]) > threshold) changed++
    }
  }
  return { ratio: total ? changed / total : 0, changed, total, height }
}

/** PNG 버퍼 두 장의 비교 — sharp 로 풀어 rawDiff. */
export async function pngDiff(pngA, pngB, threshold = CHANNEL_THRESHOLD) {
  const sharp = req('sharp')
  const raw = async (p) => {
    const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    return { data, width: info.width, height: info.height }
  }
  return rawDiff(await raw(pngA), await raw(pngB), threshold)
}

// ── HTML 변환(순수 함수) ───────────────────────────────────────────────────

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find((v) => v !== undefined)
const MIME = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }
const dataUri = (path, buf) => `data:${MIME[extname(path).toLowerCase()] ?? 'application/octet-stream'};base64,${buf.toString('base64')}`
const isLocal = (u) => typeof u === 'string' && u !== '' && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u) // 상대·절대 경로(스킴·프로토콜 상대·해시 아님)

/** 쪽에 보이는 글자의 코드포인트 집합 — 태그·스크립트·스타일을 뺀 텍스트 + CSS content 글자. */
export function usedCodepoints(html, css = '') {
  const text = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')
  const set = new Set()
  for (const ch of text.replace(/&(?:#(\d+)|#x([0-9a-f]+));/gi, (_, d, h) => String.fromCodePoint(d ? Number(d) : parseInt(h, 16)))) set.add(ch.codePointAt(0))
  for (const m of css.matchAll(/content\s*:\s*(["'])((?:\\.|(?!\1).)*)\1/g)) for (const ch of m[2]) set.add(ch.codePointAt(0))
  return set
}

/** `unicode-range` 값 → [[lo, hi], …]. `U+0-FF, U+30??, U+AC00-D7A3` 모두 받는다. 없으면 null(모든 글자). */
export function parseUnicodeRange(v) {
  if (!v) return null
  return v.split(',').map((s) => s.trim()).filter(Boolean).map((r) => {
    const m = r.match(/^U\+([0-9A-Fa-f?]{1,6})(?:-([0-9A-Fa-f]{1,6}))?$/)
    if (!m) throw new Error(`unicode-range 를 못 읽는다: ${r}`)
    const lo = parseInt(m[1].replace(/\?/g, '0'), 16)
    const hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, 'F'), 16)
    return [lo, hi]
  })
}
const covers = (ranges, used) => ranges === null || ranges.some(([lo, hi]) => { for (const cp of used) if (cp >= lo && cp <= hi) return true; return false })

/**
 * CSS 하나를 단일 파일용으로 바꾼다.
 *  - @font-face: unicode-range 가 쪽 글자를 하나도 덮지 못하는 조각은 규칙째 지운다(next/font 는 한글 서체를 수백 조각으로 나눈다). 남긴 조각의 src url 은 data URI.
 *  - 그 밖 url(): 로컬 파일이면 300 KB 까지 data URI 로. 못 넣은 것은 external 에 적는다.
 * read(urlPath, baseUrl) → Buffer | null (urlPath 는 CSS 안의 글자 그대로, baseUrl 은 CSS 파일 주소).
 */
export function processCss(css, { used, read, baseUrl, external = [] }) {
  const inline = (block) => block.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/g, (whole, _q, u) => {
    if (!isLocal(u)) return whole
    const buf = read(u, baseUrl)
    if (!buf || buf.length > INLINE_ASSET_MAX * (/\.woff2?|\.ttf|\.otf/i.test(u) ? 4 : 1)) { external.push(u); return whole }
    return `url("${dataUri(u.split(/[?#]/)[0], buf)}")`
  })
  let dropped = 0
  let kept = 0
  const out = css
    .replace(/@font-face\s*\{[^}]*\}/g, (block) => {
      if (!covers(parseUnicodeRange(block.match(/unicode-range\s*:\s*([^;}]+)/i)?.[1]), used)) { dropped++; return '' }
      kept++
      return inline(block)
    })
    .replace(/(^|[^\w-])url\(\s*(["']?)([^)"']+)\2\s*\)/g, (whole, pre, _q, u) => {
      // 남은 @font-face 안의 url 은 위에서 이미 data URI 다(isLocal 이 아님). 여기는 그 밖 규칙의 url()
      if (!isLocal(u)) return whole
      const buf = read(u, baseUrl)
      if (!buf || buf.length > INLINE_ASSET_MAX) { external.push(u); return whole }
      return `${pre}url("${dataUri(u.split(/[?#]/)[0], buf)}")`
    })
  return { css: out, fontFacesKept: kept, fontFacesDropped: dropped }
}

/** 폼 제출을 서버 없이 받는 작은 스크립트. adapter 는 adapter-static(mailtoSubmit·kakaoChannelSubmit·telLink)을 window.__wfStatic 으로 노출한 코드다. */
export function formHandlerScript() {
  // 계약 어댑터가 하는 일(메일 앱 열기·안내 글)을 그대로 쓴다 — 여기서는 「폼 값 모으기 → 어댑터 호출 → 안내 그리기」만 한다.
  return `(function(d,w){var cfgEl=d.getElementById("wf-static-config");var cfg=cfgEl?JSON.parse(cfgEl.textContent||"{}"):{};` +
    `function status(form){var s=form.nextElementSibling;if(!s||!s.hasAttribute("data-wf-static-status")){s=d.createElement("p");s.setAttribute("data-wf-static-status","");s.setAttribute("role","status");form.parentNode.insertBefore(s,form.nextSibling)}return s}` +
    `function show(form,msg,href){var s=status(form);s.textContent=msg;if(href){s.appendChild(d.createTextNode(" "));var a=d.createElement("a");a.href=href;a.textContent=href.indexOf("mailto:")===0?"메일 앱으로 열기":"열기";s.appendChild(a)}}` +
    `d.addEventListener("submit",function(e){var f=e.target;if(!f||f.tagName!=="FORM"||f.getAttribute("action"))return;e.preventDefault();` +
    `var data={};new FormData(f).forEach(function(v,k){if(k==="idempotencyKey"||typeof v!=="string"||v==="")return;data[k]=v});` +
    `var A=w.__wfStatic,fmt=function(i){return Object.keys(i).map(function(k){return k+": "+i[k]}).join("\\n")},go;` +
    `try{if(cfg.email)go=A.mailtoSubmit(cfg.email,function(){return cfg.subject||"문의"});else if(cfg.kakao)go=A.kakaoChannelSubmit(cfg.kakao,fmt)}catch(err){go=null}` +
    `if(!go){var t=cfg.phone?A.telLink(cfg.phone):null;if(t&&t.ok)show(f,"이 파일에서는 직접 보낼 수 없어요. "+t.data.nextStep,t.data.href);else show(f,"보낼 곳이 아직 정해지지 않았어요. 연락처를 확인해야 해요 (확인 필요).");return}` +
    `go(data).then(function(r){if(r.ok)show(f,r.data.nextStep,r.data.href);else show(f,r.formError||"보내지 못했어요. 다시 시도해 주세요.")})})})(document,window)`
}

let adapterCache
/** adapter-static.ts + lib/phone.ts 를 TS 에서 옮겨 한 덩어리(window.__wfStatic)로. TS 원천이 정본이고 이 함수는 옮기기만 한다. */
export function adapterScript() {
  if (adapterCache) return adapterCache
  const js = (file) => ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
    .replace(/^import\s[^;]*?from\s*["'][^"']+["'];?\s*$/gm, '') // 다른 모듈 import(같은 덩어리 안에 있다)
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
    .replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/gm, '')
  const phone = js(join(FACTORY, 'lib', 'phone.ts'))
  const adapter = js(join(FACTORY, 'contract', 'adapter-static.ts'))
  adapterCache = `(function(w){${phone}\n${adapter}\nw.__wfStatic={mailtoSubmit:mailtoSubmit,kakaoChannelSubmit:kakaoChannelSubmit,telLink:telLink}})(window)`
  return adapterCache
}

const script = (body) => `<script>${body.replace(/<\/script/gi, '<\\/script')}</script>`

/**
 * 내보낸 HTML 한 쪽 → 단일 HTML.
 * ctx: { read(urlPath, baseUrl) → Buffer|null, readCss(href) → string|null, config: { email?, phone?, kakao?, subject? }, forms: 'adapter-static' }
 * 돌려주는 값: { html, external: [...], fontFacesKept, fontFacesDropped, stylesInlined, formsFound }
 */
export function toSingleHtml(html, ctx) {
  const external = []
  let stylesInlined = 0
  let fontKept = 0
  let fontDropped = 0
  const css = []
  // 글자 집합은 스타일 시트를 다 읽은 뒤 content 글자까지 더해 만들되, 시트를 먼저 읽어야 하므로 두 번 훑는다.
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((t) => /\srel\s*=\s*["']?stylesheet/i.test(t))
  const sheets = new Map(links.map((t) => [t, attr(t, 'href') ? ctx.readCss(attr(t, 'href')) : null]))
  const used = usedCodepoints(html, [...sheets.values()].filter(Boolean).join('\n'))
  let out = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = attr(tag, 'rel') ?? ''
    if (/^stylesheet$/i.test(rel)) {
      const href = attr(tag, 'href')
      const text = sheets.get(tag)
      if (text == null) { external.push(href); return tag }
      const r = processCss(text, { used, read: ctx.read, baseUrl: href, external })
      fontKept += r.fontFacesKept
      fontDropped += r.fontFacesDropped
      stylesInlined++
      css.push(href)
      return `<style data-wf-src="${href}">${r.css.replace(/<\/style/gi, '<\\/style')}</style>`
    }
    if (/^(?:preload|modulepreload|prefetch|dns-prefetch|preconnect)$/i.test(rel)) return ''
    if (/icon/i.test(rel)) {
      const href = attr(tag, 'href')
      const buf = isLocal(href) ? ctx.read(href, '/') : null
      if (buf && buf.length <= INLINE_ASSET_MAX) return tag.replace(href, dataUri(href.split(/[?#]/)[0], buf))
      if (isLocal(href)) external.push(href)
    }
    return tag
  })
  // 스크립트 — Next 하이드레이션·RSC 페이로드·MotionBoot 는 지우고 JSON-LD 만 남긴다.
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) => (/type\s*=\s*["']application\/ld\+json["']/i.test(tag) ? tag : ''))
  // 그림·영상·소스의 로컬 경로 — 작으면 인라인, 아니면 external 로 보고
  out = out.replace(/<(img|source|video|audio|iframe|embed)\b[^>]*>/gi, (tag) => tag.replace(/\s(src|poster)\s*=\s*(["'])([^"']*)\2/gi, (whole, name, q, u) => {
    if (!isLocal(u)) return whole
    const buf = ctx.read(u, '/')
    if (!buf || buf.length > INLINE_ASSET_MAX) { external.push(u); return whole }
    return ` ${name}=${q}${dataUri(u.split(/[?#]/)[0], buf)}${q}`
  }))
  // 폼 — 서버로 보내는 action 은 없다(React 19 는 함수 action 을 javascript: 주소로 그린다). 제출은 adapter-static 이 받는다.
  // method 는 늘 post 로 둔다(v0.0.12 리뷰 P1-2): 제출 처리 스크립트가 붙기 전(큰 인라인 파일·스크립트 꺼짐)에 제출해도 GET 으로 입력값이 주소·접근 기록에 실리지 않는다. 정적 호스트는 405 를 내지만 값은 새지 않는다.
  let formsFound = 0
  out = out.replace(/<form\b[^>]*>/gi, (tag) => {
    formsFound++
    return tag.replace(/\s(?:action|method|enctype|target)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '').replace(/^<form\b/i, '<form method="post"')
  })
  out = out.replace(/\sformaction\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
  // 등장 모션 런타임이 없다 — 가림을 꺼서 첫 칠부터 내용이 보이게
  out = out.replace(/<html\b([^>]*)>/i, (m, a) => `<html${a.replace(/\sdata-motion\s*=\s*(?:"[^"]*"|'[^']*')/i, '')} data-motion="off" data-wf-single="1">`)
  // 인라인 스크립트: 폼 설정 + 어댑터 + 제출 처리(폼이 있는 쪽만) — 나머지 쪽은 스크립트 0개(JSON-LD 제외)
  if (formsFound) {
    const cfg = JSON.stringify(ctx.config ?? {}).replace(/</g, '\\u003c')
    out = out.replace(/<\/body>/i, `<script type="application/json" id="wf-static-config">${cfg}</script>${script(adapterScript())}${script(formHandlerScript())}</body>`)
  }
  return { html: out, external: [...new Set(external)], fontFacesKept: fontKept, fontFacesDropped: fontDropped, stylesInlined, formsFound, css }
}

/** 사이트 콘텐츠(content/site.json)에서 폼이 쓸 연락 수단 — 확인 필요·빈 값·형식 틀린 값은 뺀다(어댑터가 던지므로 미리 거른다). */
export function staticConfigFrom(site) {
  const c = site?.business ?? site?.content?.business ?? {}
  const ok = (v) => typeof v === 'string' && v.trim() && !/확인 필요|To be confirmed/i.test(v)
  const cfg = {}
  if (ok(c.email) && /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:".]+(\.[^\s@<>()[\]\\,;:".]+)*\.[A-Za-z]{2,}$/.test(c.email.trim())) cfg.email = c.email.trim()
  if (ok(c.phone)) cfg.phone = c.phone.trim()
  const kakao = (site?.booking?.primary?.kind === 'kakao' ? site.booking.primary.value : null) ?? (site?.booking?.secondary ?? []).find?.((x) => x?.kind === 'kakao')?.value
  if (ok(kakao) && /^https:\/\/pf\.kakao\.com\/_[A-Za-z0-9]+\/?(?:chat\/?)?$/.test(kakao.trim())) cfg.kakao = kakao.trim()
  if (ok(c.name)) cfg.subject = `${c.name} 문의`
  return cfg
}

// ── 내보내기 실행 ───────────────────────────────────────────────────────────

/** 라우트 → 내보낸 폴더 안 HTML 파일(기본 /services → services.html, trailingSlash 면 services/index.html). */
export function routeHtmlFile(dir, route) {
  const clean = route.replace(/^\/+|\/+$/g, '')
  const candidates = clean ? [`${clean}.html`, `${clean}/index.html`] : ['index.html']
  const found = candidates.map((c) => join(dir, c)).find(existsSync)
  if (!found) throw new Error(`내보낸 폴더에 ${route} 쪽이 없다: ${candidates.join(' · ')} (${dir})`)
  return found
}
export const routeSlug = (route) => route.replace(/^\/+|\/+$/g, '').replace(/[^A-Za-z0-9]+/g, '-') || 'index'

/** Next 정적 내보내기 한 번. 평소 `.next` 는 잠시 치워 두었다가 되돌린다(내보내기 모드 빌드가 같은 폴더에 쓴다). → { code, seconds, log } */
export async function staticExportBuild(siteDir, log) {
  const cfg = join(siteDir, 'next.config.ts')
  if (!existsSync(cfg) || !readFileSync(cfg, 'utf8').includes('WF_STATIC_EXPORT')) throw new Error(`이 사이트의 next.config.ts 에 WF_STATIC_EXPORT 설정이 없다 — 06-pages 를 다시 돌려 사이트를 새로 만든다: ${siteDir}`)
  const next = join(siteDir, '.next')
  const saved = join(siteDir, '.next-normal-saved')
  let moved = false
  rmSync(join(siteDir, EXPORT_DIR), { recursive: true, force: true })
  if (existsSync(next)) {
    rmSync(saved, { recursive: true, force: true })
    try { renameSync(next, saved); moved = true } catch { /* 못 옮기면 그대로 둔다 — 내보내기 빌드가 .next 를 덮어쓴다 */ }
  }
  const inquiry = join(siteDir, 'app', 'api', 'inquiry')
  const inquirySaved = join(siteDir, '.wf-saved-inquiry')
  let inquiryMoved = false
  // 앞서 강제로 끝난 내보내기가 치워 둔 채 남긴 폴더가 있으면 먼저 제자리로 되돌린다(사용자 파일을 잃지 않는다)
  if (existsSync(inquirySaved) && !existsSync(inquiry)) renameSync(inquirySaved, inquiry)
  const t0 = Date.now()
  try {
    // 소개형 전달물의 가짜 문의 접수(app/api/inquiry)는 서버 경로라 정적 내보내기에 못 들어간다 — 옆으로 치웠다가 빌드 뒤에 되돌린다. 문의 폼은 NEXT_PUBLIC_WF_STATIC=1 을 보고 mailto 로 간다.
    if (existsSync(inquiry) && !existsSync(inquirySaved)) {
      renameSync(inquiry, inquirySaved)
      inquiryMoved = true
    }
    const code = await new Promise((res) => {
      const out = []
      const p = spawn('npm run build', { cwd: siteDir, shell: true, env: { ...process.env, WF_STATIC_EXPORT: '1', NEXT_PUBLIC_WF_STATIC: '1' } })
      p.stdout.on('data', (d) => out.push(d))
      p.stderr.on('data', (d) => out.push(d))
      p.on('close', (c) => { try { mkdirSync(dirname(log), { recursive: true }); writeFileSync(log, Buffer.concat(out)) } catch {} res(c) })
    })
    return { code, seconds: Math.round((Date.now() - t0) / 100) / 10, log }
  } finally {
    if (moved) {
      rmSync(next, { recursive: true, force: true })
      renameSync(saved, next)
    }
    if (inquiryMoved && !existsSync(inquiry)) renameSync(inquirySaved, inquiry)
  }
}

const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.txt': 'text/plain', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }
/** 정적 폴더 서버(127.0.0.1, 포트는 OS 가 고른다). 쪽 주소 /a/b → a/b.html 또는 a/b/index.html. */
export async function serveDir(dir) {
  const server = createServer((rq, rs) => {
    const path = decodeURIComponent(new URL(rq.url, 'http://x').pathname)
    const base = resolve(dir)
    const tries = [path, `${path}.html`, posix.join(path, 'index.html')].map((p) => resolve(join(dir, p)))
    const file = tries.find((f) => f.startsWith(base) && existsSync(f) && statSync(f).isFile())
    if (!file) { rs.writeHead(404); rs.end('not found'); return }
    rs.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' })
    rs.end(readFileSync(file))
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }
}

/** headless Chrome 으로 전체 화면 PNG 를 찍는다. 등장 모션은 끄고(prefers-reduced-motion) 서체가 다 읽힌 뒤 찍는다. → Buffer[] (width 순서) */
export async function shootFullPage(url, widths = WIDTHS, { height = 900, settleMs = 1200, scripts = true } = {}) {
  const chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-gpu'], { prefix: 'p3t13-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    const shots = []
    try {
      await send('Page.enable')
      if (!scripts) await send('Emulation.setScriptExecutionDisabled', { value: true }) // 서버가 그린 HTML 그대로(하이드레이션 없음)
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      for (const width of widths) {
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
        await navigateAndWait(send, ev, url)
        await ev('document.fonts.ready.then(() => true)')
        await new Promise((r) => setTimeout(r, settleMs))
        const h = await ev('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)')
        const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } })
        if (!r.result?.data) throw new Error(`스크린샷 실패(${width}px): ${JSON.stringify(r.error ?? r).slice(0, 200)}`)
        shots.push(Buffer.from(r.result.data, 'base64'))
      }
    } finally { ws.close() }
    return shots
  } finally { await chrome.close() }
}

/**
 * 쪽 하나를 단일 HTML 로 내보내고 React 렌더와 비교한다.
 * opts: { build = true (false 면 <siteDir>/.next-export 를 그대로 쓴다), shoot = true, outDir, log }
 */
export async function exportSingleHtml(siteDir, route, opts = {}) {
  const { build = true, shoot = true, log = () => {} } = opts
  const dir = join(siteDir, EXPORT_DIR)
  const outDir = opts.outDir ?? join(dirname(siteDir), 'export')
  if (build) {
    const b = await staticExportBuild(siteDir, join(dirname(siteDir), 'export-build.log'))
    log(`정적 내보내기 next build 종료 ${b.code} · ${b.seconds}초`)
    if (b.code !== 0) throw new Error(`도구 실패: 정적 내보내기 next build 종료 ${b.code} — ${b.log}`)
  }
  const source = routeHtmlFile(dir, route)
  const readPath = (u, base) => {
    const clean = decodeURIComponent(u.split(/[?#]/)[0])
    const abs = clean.startsWith('/') ? clean : posix.join(posix.dirname(base.split(/[?#]/)[0] || '/'), clean)
    const file = resolve(join(dir, abs)) // `/_next/...` 도 `../media/x` 도 내보낸 폴더 기준으로 푼다(base 가 /_next/static/chunks/x.css)
    if (!file.startsWith(resolve(dir)) || !existsSync(file) || !statSync(file).isFile()) {
      const pub = resolve(join(siteDir, 'public', abs)) // public/ 파일은 내보내기에서 폴더 뿌리로 복사되므로 위에서 잡힌다 — 안전망
      return pub.startsWith(resolve(siteDir, 'public')) && existsSync(pub) && statSync(pub).isFile() ? readFileSync(pub) : null
    }
    return readFileSync(file)
  }
  const site = JSON.parse(readFileSync(join(siteDir, 'content', 'site.json'), 'utf8'))
  const t = toSingleHtml(readFileSync(source, 'utf8'), {
    read: readPath,
    readCss: (href) => (isLocal(href) ? readPath(href, '/')?.toString('utf8') ?? null : null),
    config: staticConfigFrom(site),
  })
  mkdirSync(outDir, { recursive: true })
  const file = join(outDir, `${routeSlug(route)}.html`)
  writeFileSync(file, t.html)
  const result = { file, bytes: Buffer.byteLength(t.html), external: t.external, stylesInlined: t.stylesInlined, fontFacesKept: t.fontFacesKept, fontFacesDropped: t.fontFacesDropped, formsFound: t.formsFound, diffRatio: null, diff: {} }
  if (!shoot) return result
  const server = await serveDir(dir)
  try {
    // 기준: React 가 서버에서 그린 화면(스크립트 끔). 하이드레이션 뒤 화면은 마운트 뒤에만 정해지는 값(지금 시각의 영업 중/종료 문구 등)을 더 그리므로
    // 스크립트 없는 파일이 같을 수 없다 — 그 차이는 diffHydrated 로 따로 보고한다.
    const url = `${server.origin}${route}`
    const ssr = await shootFullPage(url, WIDTHS, { scripts: false })
    const hydrated = await shootFullPage(url)
    const single = await shootFullPage(pathToFileURL(file).href)
    result.diffHydrated = {}
    for (let i = 0; i < WIDTHS.length; i++) {
      const w = WIDTHS[i]
      const d = await pngDiff(ssr[i], single[i])
      const h = await pngDiff(hydrated[i], single[i])
      result.diff[w] = { ratio: d.ratio, changed: d.changed, total: d.total }
      result.diffHydrated[w] = { ratio: h.ratio, changed: h.changed, total: h.total }
      const slug = routeSlug(route)
      writeFileSync(join(outDir, `${slug}-${w}-react-ssr.png`), ssr[i])
      writeFileSync(join(outDir, `${slug}-${w}-react-hydrated.png`), hydrated[i])
      writeFileSync(join(outDir, `${slug}-${w}-single.png`), single[i])
      log(`${w}px 서버 렌더 대비 ${(d.ratio * 100).toFixed(3)}% (${d.changed}/${d.total}) · 하이드레이션 뒤 대비 ${(h.ratio * 100).toFixed(3)}%`)
    }
    result.diffRatio = Math.max(...WIDTHS.map((w) => result.diff[w].ratio))
  } finally { await server.close() }
  return result
}
