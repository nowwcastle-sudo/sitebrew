// next build 뒤·csp-hashes 앞에 실행(package.json build) — 정적으로 만들어진 HTML 의 하이드레이션 스크립트(<script src async>)와 글꼴 선언을 첫 칠 뒤에 싣게 바꾼다(P3-4 PERF2 대장 C233 · PERF3).
//
// 왜: Next 는 초기 청크 8~12개를 머리에서 한꺼번에 받는다(async 라 칠은 막지 않지만 네트워크를 CSS·글꼴과 나눠 쓴다). Lighthouse(모바일 모의 = Lantern)의 LCP·FCP 는
//     「관측 시각 전에 끝난 모든 요청」을 느린 4G(1.6 Mbps)로 다시 내려받는 시뮬레이션이다(trace_engine FirstContentfulPaint.getFirstPaintBasedGraph: 요청이 cutoff 전에 시작·끝나면 그래프에 든다).
//     글만 있는 쪽도 JS 150~380 KB + CSS + 글꼴 160~340 KB 가 겹쳐 2.5~5 s 가 나왔다(실측: 같은 HTML 에서 스크립트·글꼴만 빼면 1.2~1.6 s).
// 하는 일 ① 하이드레이션: .next/server/app 의 모든 HTML 에서 `<script src="/_next/static/…" async>`(noModule 폴리필은 그대로)를 빼 문서 끝의 인라인 로더 하나로 옮기고, 같은 청크의 <link rel="preload" as="script"> 도 뺀다.
//   로더는 첫 칠(first-contentful-paint 항목) 뒤 한 틱에 싣는다. **load 를 기다리지 않는다** — 새 Chrome 은 load 가 첫 칠보다 100~300 ms 먼저 와서(실측: load 60~140 ms · 첫 칠 260~420 ms),
//   load 에서 싣는 옛 로더(PERF2)는 JS 를 칠 전에 달아 모의 LCP 에 JS 450 KB 가 들어갔다(local-1/a 4.7 s → 칠 신호만 기다리면 2.8 s). 칠 신호를 못 읽는 브라우저(PerformanceObserver 없음)와 숨은 탭만 load, 칠이 없는 문서는 4초에 싣는다.
// 하는 일 ② 글꼴: CSS 의 `url()` 이 있는 @font-face 를 같은 폴더의 <이름>.fonts.css 로 옮기고, 그 CSS 를 쓰는 모든 HTML 의 로더가 첫 칠 뒤 <link rel=stylesheet> 로 먼저 싣는다(JS 없는 방문자는 head 의 noscript).
//   브라우저는 글꼴을 첫 레이아웃 때 요청하는데, 로컬(관측 FCP 0.1~0.3 s)에서는 응답이 첫 칠보다 먼저 와서 글꼴 160~340 KB 가 모의 FCP·LCP 에 통째로 든다(글꼴 요청을 없애면 LCP 1.3~1.6 s).
//   첫 칠 뒤에 선언하면 글꼴 요청이 그래프 밖이다. 실제 망에서는 첫 방문자의 글꼴이 어차피 첫 칠 뒤에 온다(RTT) — 달라지는 것은 글꼴 도착이 CSS 한 번(RTT 1회)만큼 늦는 것뿐이다.
//   local() 대체 면(크기 보정 폴백)은 요청이 없어 CSS 에 남긴다 — 첫 칠의 글자 폭이 덜 흔들린다. 로더를 달 수 없는 HTML(</body> 없음)이 하나라도 그 CSS 를 쓰면 그 CSS 는 건드리지 않는다(글꼴이 영영 안 오는 것보다 낫다).
//   이미 바꾼 HTML·CSS 는 건드리지 않는다(여러 번 돌려도 같다). 로더가 인라인 script 라 csp-hashes.mjs 가 해시를 CSP script-src 에 싣는다(그래서 이 스크립트가 먼저 돈다). 같은 출처 동적 script·link 는 'self' 가 허용한다.
//   WF_STATIC_EXPORT=1(단일 HTML 내보내기)·WF_DEFER_HYDRATION=0 이면 전부 건너뛴다, WF_DEFER_FONTS=0 이면 글꼴만 건너뛴다. 종료 0 = 바꿈/건너뜀 · 1 = HTML 이 하나도 없음.
// 잃는 것: ① 하이드레이션이 첫 칠 직후 ~0.1~0.3 s 라 그 안의 클릭은 서버 HTML 그대로(링크는 이동, 폼은 기본 제출) — 이전에도 JS 가 올 때까지는 같았고 창이 조금 넓어졌다.
//   ② 글꼴이 늘 첫 칠 뒤에 와서 글자가 시스템 한글로 먼저 그려졌다가 바뀐다(font-display: swap 의 첫 방문 모습과 같다). 글꼴이 이미 캐시에 있는 재방문은 예전에는 칠 전에 올 수 있었으나 이제는 한 프레임쯤 대체 글꼴이 보일 수 있다.
//   ③ 느린 망에서는 CSS 가 올 때까지 JS 가 늦게 시작한다(CSS 우선 — 칠이 먼저).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, posix } from "node:path"
import { pathToFileURL } from "node:url"

export const LOADER_MARK = "wf-defer-hydration"

// 로더(인라인). L = [[src, id?], …] 스크립트, F = [href, …] 글꼴 스타일시트. 첫 칠(first-contentful-paint 항목, buffered) 뒤 한 틱 → 글꼴 link 먼저, 스크립트 다음 / 4초 중 먼저 한 번.
// PerformanceObserver 를 못 만들면(catch) load 에서 싣는다. 숨은 탭은 칠이 안 나므로 load 에서 싣는다.
export const loaderScript = (list, fonts = []) =>
  `/*${LOADER_MARK}*/(function(L,F){var d=document,t=0;function go(){if(t)return;t=1;for(var i=0;i<F.length;i++){var k=d.createElement("link");k.rel="stylesheet";k.href=F[i];d.head.appendChild(k)}for(var i=0;i<L.length;i++){var s=d.createElement("script");s.src=L[i][0];if(L[i][1])s.id=L[i][1];s.async=!0;d.head.appendChild(s)}}` +
  `try{new PerformanceObserver(function(l,o){if(l.getEntriesByName("first-contentful-paint").length){o.disconnect();setTimeout(go)}}).observe({type:"paint",buffered:!0});if(d.visibilityState==="hidden")addEventListener("load",go)}catch(e){addEventListener("load",go)}` +
  `setTimeout(go,4e3)})(${JSON.stringify(list)},${JSON.stringify(fonts)})`

const SCRIPT_TAG = /<script src="(\/_next\/static\/[^"]+)"([^>]*)><\/script>/g
const PRELOAD_TAG = /<link rel="preload" as="script"[^>]*?href="([^"]+)"[^>]*\/?>/g
const FONT_PRELOAD_TAG = /<link rel="preload"[^>]*?as="font"[^>]*\/?>/g
const FONT_FACE = /@font-face\{[^}]*\}/g

/** CSS → { rest, faces } — url() 이 있는 @font-face 를 빼낸다(local() 만 있는 크기 보정 대체 면은 요청이 없어 남긴다). 뺄 것이 없으면 그대로. */
export function extractFontFaces(css) {
  let faces = ""
  const rest = css.replace(FONT_FACE, (m) => {
    if (!/url\(/.test(m)) return m
    faces += m
    return ""
  })
  return { rest, faces }
}

/** HTML 한 장 → { html, moved } — 초기 청크 script 를 문서 끝 로더로 옮기고, fonts(글꼴 스타일시트 주소들)가 있으면 로더가 그것도 첫 칠 뒤에 싣는다. 이미 옮긴 문서(로더 표지)는 그대로. */
export function deferHydration(html, { fonts = [] } = {}) {
  if (html.includes(LOADER_MARK) || !html.includes("</body>")) return { html, moved: 0 }
  const list = []
  let out = html.replace(SCRIPT_TAG, (m, src, rest) => {
    if (/\bnoModule\b/i.test(rest)) return m // 구형 브라우저용 폴리필 — 모듈을 아는 브라우저는 안 받는다
    const id = /\bid="([^"]*)"/.exec(rest)?.[1]
    list.push(id ? [src, id] : [src])
    return ""
  })
  if (!list.length && !fonts.length) return { html, moved: 0 }
  const srcs = new Set(list.map((x) => x[0]))
  out = out.replace(PRELOAD_TAG, (m, href) => (srcs.has(href) ? "" : m))
  if (fonts.length) {
    out = out.replace(FONT_PRELOAD_TAG, "") // 글꼴 preload 는 글꼴을 칠 전에 받는다 — 선언을 첫 칠 뒤로 옮겼으니 같이 뺀다
    const noscript = fonts.map((h) => `<link rel="stylesheet" href="${h}"/>`).join("")
    const headEnd = out.indexOf("</head>")
    if (headEnd >= 0) out = `${out.slice(0, headEnd)}<noscript>${noscript}</noscript>${out.slice(headEnd)}`
  }
  const at = out.lastIndexOf("</body>")
  out = `${out.slice(0, at)}<script>${loaderScript(list, fonts)}</script>${out.slice(at)}`
  return { html: out, moved: list.length }
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : []))
const STYLESHEET = /<link rel="stylesheet" href="(\/_next\/static\/chunks\/[^"?]+\.css)"/g

/** 글꼴 선언을 CSS 에서 <이름>.fonts.css 로 옮긴다(파일을 쓴다). 문서 경로 → 그 문서가 싣는 .fonts.css 주소들, 옮긴 선언·CSS 수, 못 옮긴 CSS 수를 돌려준다. HTML 은 쓰지 않는다. */
function moveFontFaces(siteDir, docs) {
  const users = new Map() // css 주소 → [문서 경로]
  for (const [file, html] of docs) for (const m of html.matchAll(STYLESHEET)) users.set(m[1], [...(users.get(m[1]) ?? []), file])
  const fontsOf = new Map()
  let faces = 0
  let files = 0
  let skipped = 0
  for (const [href, pages] of users) {
    const cssPath = join(siteDir, ".next", "static", "chunks", posix.basename(href))
    if (!existsSync(cssPath)) continue
    const { rest, faces: moved } = extractFontFaces(readFileSync(cssPath, "utf8"))
    if (!moved) continue
    // 이 CSS 를 쓰는 모든 문서에 로더를 달 수 있어야 한다(</body> 가 있고 아직 로더가 없다).
    if (!pages.every((p) => { const h = docs.get(p); return h.includes("</body>") && !h.includes(LOADER_MARK) })) { skipped++; continue }
    const fontsHref = href.replace(/\.css$/, ".fonts.css")
    writeFileSync(join(dirname(cssPath), posix.basename(fontsHref)), moved)
    writeFileSync(cssPath, rest)
    faces += (moved.match(/@font-face/g) ?? []).length
    files++
    for (const p of pages) fontsOf.set(p, [...(fontsOf.get(p) ?? []), fontsHref])
  }
  return { fontsOf, faces, files, skipped }
}

function main() {
  if (process.env.WF_STATIC_EXPORT === "1") { console.log("defer-hydration: 정적 내보내기 빌드 — 건너뜀"); return 0 }
  if (process.env.WF_DEFER_HYDRATION === "0") { console.log("defer-hydration: WF_DEFER_HYDRATION=0 — 건너뜀"); return 0 }
  const siteDir = process.cwd()
  const appDir = join(siteDir, ".next", "server", "app")
  try {
    if (!existsSync(appDir)) throw new Error(`${appDir} 가 없다 — next build 가 먼저 끝나야 한다`)
    const files = walk(appDir)
    if (!files.length) throw new Error("정적으로 만들어진 HTML 이 하나도 없다")
    const docs = new Map(files.map((f) => [f, readFileSync(f, "utf8")]))
    const fonts = process.env.WF_DEFER_FONTS === "0" ? { fontsOf: new Map(), faces: 0, files: 0, skipped: 0 } : moveFontFaces(siteDir, docs)
    let pages = 0
    let chunks = 0
    for (const [f, before] of docs) {
      const { html, moved } = deferHydration(before, { fonts: fonts.fontsOf.get(f) ?? [] })
      if (html === before) continue
      writeFileSync(f, html)
      pages++
      chunks += moved
    }
    console.log(`defer-hydration: 쪽 ${files.length}개 중 ${pages}개에서 스크립트 ${chunks}개를 첫 칠 뒤 로더로 옮겼다`)
    if (fonts.files) console.log(`defer-hydration: 글꼴 선언 ${fonts.faces}개를 CSS ${fonts.files}개에서 .fonts.css 로 옮겼다 — 로더가 첫 칠 뒤에 싣는다`)
    if (fonts.skipped) console.log(`defer-hydration: 로더를 달 수 없는 문서가 쓰는 CSS ${fonts.skipped}개는 글꼴 선언을 옮기지 않았다`)
    return 0
  } catch (e) {
    console.error(`defer-hydration 실패: ${e?.message ?? e}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
