// 찍어낸 사이트의 글꼴을 「이 쪽이 쓰는 글자만」 든 파일로 바꾼다(P3-4 perf, 대장 C173 — 첫 화면 글꼴 요청 200개·2 MB → 서체·굵기마다 쪽에 맞춘 몇 개).
//
// 왜: 레시피 서체 로더는 next/font/google 이고, 한글 서체(IBM Plex Sans KR·Nanum Gothic Coding …)는 구글이 유니코드 범위로 90~190조각으로 나눈다.
//     한글 한 쪽이 조각 절반쯤을 건드려 첫 화면에 글꼴 요청 200개·2 MB 가 나갔다(실측). Lighthouse 모의 LCP 는 관측 LCP 전에 끝난 요청 전부를
//     느린 4G 로 다시 흘려 보므로(Lantern getFirstPaintBasedGraph — LCP 는 treatNodeAsRenderBlocking 이 모든 노드) 이 조각들이 그대로 모의 LCP 를 12~18 s 로 만든다.
// 방법: 사이트 글자는 빌드 전에 정해져 있다(site.json + 소스의 문구). 글자를 쪽 소속으로 나눈다 — 모든 쪽이 쓰는 글자(공통) · 쪽마다 쓰는 글자의 조합(예: 홈+상품) · 어느 쪽에도 안 묶인 나머지.
//     각 묶음을 Google Fonts CSS API 의 `text=`(developers.google.com/fonts/docs/css2 「Optimizing your font requests」 — 요청한 글자만 든 woff2 를 준다)로
//     서체·굵기마다 받아 app/fonts/ 에 두고, 구글이 돌려준 unicode-range 를 그대로 단 @font-face 를 app/fonts/fonts.css 에 쓴다. 브라우저는 그 쪽 글자가 든 묶음만 받는다
//     (예전 구글 조각과 같은 원리인데 조각이 이 사이트 글자에 맞춰져 있다). layout 의 `Family({…})` 로더는 `{ variable: "" }` 로 바꾼다 — 레시피 CSS 는 `var(--font-x-wf, "서체", …)` 로 서체 이름을 직접 부르므로
//     변수가 없으면 설계된 스택(서체 → 시스템 한글)이 그대로 쓰인다. 묶음에 없는 글자(방문자가 입력한 글 등)는 시스템 한글로 내려간다.
//     무엇이든 실패하면(네트워크·400·모르는 모양·text 무시) 그 서체의 원래 로더를 그대로 둔다 — 조용히 글꼴을 잃지 않는다.
// 범위: next/font/google 로더만. css @import 로 싣는 Pretendard 계열(동적 서브셋 조각)은 이 단계 밖이다(대장 C230).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliDecompressSync } from 'node:zlib'
import ts from 'typescript'
import { resolveRefs } from './site-bind.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
export const GOOGLE_CSS = 'https://fonts.googleapis.com/css2'
/** 모든 쪽이 쓰는 기본 글자: 인쇄 가능한 ASCII + 자주 쓰는 기호·문장부호. */
export const BASE_GLYPHS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') + '·•—–…“”‘’「」『』〈〉→←↑↓✓✕×₩©®™°±≤≥'
/** 요청 하나의 글자 수 상한 — 실측: 구글 css2 는 text 가 780자쯤을 넘으면(URL 길이가 아니라 글자 수) 조용히 무시하고 조각난 전체 CSS 를 준다. */
export const MAX_GLYPHS = 700

/** 소스 코드에서 화면에 나올 수 있는 글자 = 문자열·템플릿 리터럴·JSX 글자 안의 ASCII 밖 글자(주석은 뺀다 — 블록 소스는 한글 주석이 많다). */
export function codeGlyphs(source, file = 'x.tsx') {
  const out = new Set()
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const take = (t) => { for (const ch of t) if (ch.codePointAt(0) >= 0x80) out.add(ch) }
  const visit = (n) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) take(n.text)
    else if (ts.isJsxText(n)) take(n.text)
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

const nonAscii = (s) => [...s].filter((ch) => ch.codePointAt(0) >= 0x80)
/** 값 안 모든 문자열의 ASCII 밖 글자를 set 에 모은다. */
function collect(v, set) {
  if (typeof v === 'string') for (const ch of nonAscii(v)) set.add(ch)
  else if (Array.isArray(v)) for (const x of v) collect(x, set)
  else if (v && typeof v === 'object') for (const x of Object.values(v)) collect(x, set)
  return set
}

const IMPORT_CANDIDATES = (p) => [p, `${p}.tsx`, `${p}.ts`, `${p}.mjs`, join(p, 'index.tsx'), join(p, 'index.ts')]
const isFile = (p) => { try { return statSync(p).isFile() } catch { return false } }

/** 진입 파일에서 import 를 따라 닿는 소스 파일 전부(사이트 폴더 안 — `@/…`·상대 경로)의 화면 글자. lib/*.json(예: build.json 의 이름)도 읽는다. cache 는 파일 → 글자 집합. */
export function closureGlyphs(siteDir, entry, cache = new Map()) {
  const out = new Set()
  const seen = new Set()
  const stack = [entry]
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file) || !isFile(file)) continue
    seen.add(file)
    let hit = cache.get(file)
    if (!hit) {
      const text = readFileSync(file, 'utf8')
      if (file.endsWith('.json')) hit = { glyphs: file.includes(`${join(siteDir, 'content')}`) ? new Set() : new Set(nonAscii(text)), deps: [] }
      else {
        const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
        const deps = []
        const glyphs = new Set()
        const visit = (n) => {
          if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier)) deps.push(n.moduleSpecifier.text)
          else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) deps.push(n.arguments[0].text)
          else if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) for (const ch of n.text) if (ch.codePointAt(0) >= 0x80) glyphs.add(ch)
          ts.forEachChild(n, visit)
        }
        visit(sf)
        hit = { glyphs, deps }
      }
      cache.set(file, hit)
    }
    for (const ch of hit.glyphs) out.add(ch)
    for (const dep of hit.deps) {
      const base = dep.startsWith('@/') ? join(siteDir, dep.slice(2)) : dep.startsWith('.') ? join(file, '..', dep) : null
      if (!base) continue
      const found = IMPORT_CANDIDATES(base).find(isFile)
      if (found) stack.push(found)
    }
  }
  return out
}

/** 쪽이 아닌 진입점(없는 주소·오류 경계)의 이름 → 파일. */
const PSEUDO = { '(404)': 'app/not-found.tsx', '(error)': 'app/error.tsx', '(global-error)': 'app/global-error.tsx' }

/**
 * 글자를 「어느 쪽이 쓰나」로 묶는다. 쪽 하나의 글자 = 그 쪽 page.tsx 에서 import 를 따라 닿는 소스의 화면 글자(블록·부품의 기본 문구) + site.json 에서 그 쪽에 붙은 것
 * (제목·`<쪽 id>/…` 섹션·법정 조항 — `$ref` 를 풀어서, 그리고 셸·`global/…` 섹션은 모든 쪽에). 없는 주소·오류 경계는 따로 센다(그 쪽 글자 묶음을 받지 않게).
 * 묶음 키: `all`(모든 진입점이 쓰는 글자·기본 글자) · 진입점 이름을 `|` 로 잇은 것 · `rest`(site.json 에 있으나 어느 쪽에도 안 묶인 글자 — 안전망이라 그 글자가 나올 때만 받는다).
 * → { groups: [{ key, chars }], entries, stats }
 */
export function glyphGroups(siteDir, { merge = true } = {}) {
  const site = JSON.parse(readFileSync(join(siteDir, 'content', 'site.json'), 'utf8'))
  const res = (v) => { try { return resolveRefs(v, site) } catch { return v } }
  const cache = new Map()
  const routes = Object.keys(site.pages ?? {})
  const sections = Object.entries(site.sections ?? {})
  const layoutSet = closureGlyphs(siteDir, join(siteDir, 'app', 'layout.tsx'), cache)
  const shell = collect(res(site.shell), new Set())
  const global = new Set()
  for (const [k, v] of sections) if (k.startsWith('global/')) collect(res(v), global)
  const perEntry = new Map()
  for (const route of routes) {
    const meta = site.pages[route]
    const id = meta?.id
    const set = new Set([...BASE_GLYPHS, ...layoutSet, ...shell, ...global])
    for (const ch of closureGlyphs(siteDir, join(siteDir, 'app', ...route.split('/').filter(Boolean), 'page.tsx'), cache)) set.add(ch)
    collect(res(meta), set)
    for (const [k, v] of sections) if (id && k.startsWith(`${id}/`)) collect(res(v), set)
    if (id && site.legal?.[id]) collect(res(site.legal[id]), set)
    perEntry.set(route, set)
  }
  for (const [name, rel] of Object.entries(PSEUDO)) {
    const file = join(siteDir, ...rel.split('/'))
    if (!isFile(file)) continue
    const set = new Set([...BASE_GLYPHS, ...layoutSet, ...closureGlyphs(siteDir, file, cache)])
    if (name === '(404)') for (const ch of shell) set.add(ch) // 404 는 SiteShell(주 메뉴)을 그린다
    perEntry.set(name, set)
  }
  const entries = [...perEntry.keys()]
  const all = collect(site, new Set())
  const attributed = new Set([...perEntry.values()].flatMap((s) => [...s]))
  let buckets = new Map()
  const put = (key, ch) => { if (!buckets.has(key)) buckets.set(key, new Set()); buckets.get(key).add(ch) }
  for (const ch of attributed) {
    const es = entries.filter((e) => perEntry.get(e).has(ch))
    put(es.length === entries.length ? 'all' : es.join('|'), ch)
  }
  let rest = 0
  for (const ch of all) if (!attributed.has(ch)) { put('rest', ch); rest++ }
  const groups = []
  // 실측(옛 local×r1-measure 사이트): 공통 167자·모든 쪽 123자·모든 쪽+404 237자·쪽 전용은 쪽마다 5~17자 — 쪽 하나가 받는 글자는 전체 579자의 95% 라(셸·푸터·사업 정보·부품 문구가 모든 쪽에 있다)
  // 쪽별로 쪼개면 절약은 5% 뿐이고 글꼴 요청만 서체당 3~4배가 된다. 그래서 기본은 합쳐 한 묶음(서체·굵기마다 파일 하나, 700자를 넘으면 나눈다). merge:false 는 쪽 소속 묶음을 그대로 낸다.
  if (merge) buckets = new Map([['all', new Set([...buckets.values()].flatMap((s) => [...s]))]])
  // all 을 맨 앞에 두고(파일 이름 g0 = 공통), 나머지는 키 순
  const keys = ['all', ...[...buckets.keys()].filter((k) => k !== 'all').sort()].filter((k) => buckets.has(k))
  for (const key of keys) {
    const chars = [...buckets.get(key)].sort()
    for (let i = 0; i < chars.length; i += MAX_GLYPHS) groups.push({ key, chars: chars.slice(i, i + MAX_GLYPHS).join('') })
  }
  return { groups, entries, stats: { total: attributed.size + rest, common: buckets.get('all')?.size ?? 0, rest } }
}

/** layout.tsx 의 next/font/google 로더 → { idents, loaders[{ name, ident, family, weights|null, variable, span, convertible }] }. 모르는 모양은 건드리지 않는다. */
export function parseGoogleLoaders(layout) {
  const imp = layout.match(/import\s*\{([^}]*)\}\s*from\s*["']next\/font\/google["'];?/)
  if (!imp) return { importSpan: null, idents: [], loaders: [] }
  const idents = imp[1].split(',').map((s) => s.trim()).filter(Boolean)
  const loaders = []
  for (const m of layout.matchAll(/const\s+(\w+)\s*=\s*([A-Z][A-Za-z0-9_]*)\(\{([^{}]*)\}\);?/g)) {
    if (!idents.includes(m[2])) continue
    const opts = m[3]
    const weights = opts.match(/weight:\s*\[([^\]]*)\]/)?.[1].split(',').map((s) => s.replace(/["'\s]/g, '')).filter(Boolean) ?? null
    const variable = opts.match(/variable:\s*["']([^"']+)["']/)?.[1] ?? null
    const style = opts.match(/style:\s*(\[[^\]]*\]|["'][^"']*["'])/)?.[1] ?? null
    loaders.push({ name: m[1], ident: m[2], family: m[2].replaceAll('_', ' '), weights, variable, style, raw: m[0], span: [m.index, m.index + m[0].length], convertible: !!variable && !style && !/\baxes\b|\bpreload\b|\bfallback\b|\bdisplay\b|\badjustFontFallback\b/.test(opts) })
  }
  return { importSpan: [imp.index, imp.index + imp[0].length], idents, loaders }
}

/** 굵기 집합 → css2 URL. */
export function css2Url(family, weights, text) {
  const fam = encodeURIComponent(family).replaceAll('%20', '+')
  const axis = weights.length ? `:wght@${[...weights].sort((a, b) => a - b).join(';')}` : ''
  return `${GOOGLE_CSS}?family=${fam}${axis}&display=swap&text=${encodeURIComponent(text)}`
}

/** css2 응답 → [{ weight, url, range }] (woff2 만 — range 는 구글이 돌려준 unicode-range: 파일에 실제 든 글자). */
export function parseFontFaces(css) {
  const out = []
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const weight = m[1].match(/font-weight:\s*(\d+)/)?.[1]
    const url = m[1].match(/src:\s*url\(([^)]+)\)\s*format\(['"]woff2['"]\)/)?.[1]
    const range = m[1].match(/unicode-range:\s*([^;]+);/)?.[1].trim() ?? null
    if (weight && url) out.push({ weight, url, range })
  }
  return out
}

/** 레시피 머리(fonts.display·displayKo·body·mono)에서 이 서체의 굵기 — 굵기를 안 적은 가변 서체 로더가 쓴다. 400 은 늘 넣는다. */
export function recipeWeightsFor(head, family) {
  const norm = (x) => String(x ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const ws = Object.values(head?.fonts ?? {}).filter((e) => e && typeof e === 'object' && norm(e.family) === norm(family)).map((e) => Number(e.weight)).filter((w) => Number.isFinite(w) && w > 0)
  return [...new Set([400, ...ws])].sort((a, b) => a - b)
}

const slugOf = (variable) => variable.replace(/^--font-/, '').replace(/-wf$/, '')

/** @font-face 한 줄. */
export const faceRule = (family, f) => `@font-face{font-family:"${family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url("./${f.file}") format("woff2");${f.range ? `unicode-range:${f.range};` : ''}}`

/**
 * siteDir 의 app/layout.tsx 안 next/font/google 로더를 쪽에 맞춘 글자 묶음 woff2 + app/fonts/fonts.css 로 바꾼다.
 * @param {string} siteDir
 * @param {{ fetch?: typeof fetch, weightsFor?: (family: string) => number[], log?: Function }} [opts]
 * @returns {Promise<{ converted: {family, files: string[], bytes: number}[], kept: {family, reason}[], groups: number, glyphs: number }>}
 */
export async function subsetSiteFonts(siteDir, { fetch: fetchImpl = globalThis.fetch, weightsFor = () => [], log = () => {} } = {}) {
  const layoutFile = join(siteDir, 'app', 'layout.tsx')
  const layout = readFileSync(layoutFile, 'utf8')
  const parsed = parseGoogleLoaders(layout)
  const result = { converted: [], kept: [], groups: 0, glyphs: 0 }
  if (!parsed.loaders.length) return result
  const { groups, stats } = glyphGroups(siteDir)
  result.groups = groups.length
  result.glyphs = stats.total
  const fontsDir = join(siteDir, 'app', 'fonts')
  const done = []
  for (const l of parsed.loaders) {
    if (!l.convertible) { result.kept.push({ family: l.family, reason: '옵션이 단순하지 않다(variable 외 옵션)' }); continue }
    try {
      const weights = l.weights ?? (() => { const w = weightsFor(l.family); return (w.length ? w : [400, 700]).map(String) })()
      const files = []
      let bytes = 0
      for (let gi = 0; gi < groups.length; gi++) {
        const res = await fetchImpl(css2Url(l.family, weights, groups[gi].chars), { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) })
        if (!res.ok) throw new Error(`css2 ${res.status}`)
        const faces = parseFontFaces(await res.text())
        if (!faces.length) throw new Error('woff2 면이 없다')
        if (faces.length > weights.length) throw new Error(`text 가 무시됐다(면 ${faces.length}개 > 굵기 ${weights.length}개)`)
        for (const f of faces) {
          const r = await fetchImpl(f.url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60_000) })
          // 그 서체에 이 묶음의 글자가 하나도 없으면(라틴 전용 서체 × 한글 묶음) 구글이 빈 파일 주소를 주고 받기는 400 이다 — 공통 묶음(g0)이 아니면 건너뛴다.
          if (!r.ok && gi > 0 && (r.status === 400 || r.status === 404)) continue
          if (!r.ok) throw new Error(`woff2 ${r.status}`)
          const buf = Buffer.from(await r.arrayBuffer())
          if (buf.length < 100 || buf.subarray(0, 4).toString('latin1') !== 'wOF2') throw new Error('woff2 가 아니다')
          files.push({ file: `${slugOf(l.variable)}-${f.weight}-g${gi}.woff2`, weight: f.weight, range: groups.length > 1 ? f.range : null, buf })
          bytes += buf.length
        }
      }
      done.push({ loader: l, files })
      result.converted.push({ family: l.family, files: files.map((f) => f.file), bytes })
      log(`글꼴 ${l.family}: 파일 ${files.length}개 · ${Math.round(bytes / 1024)} KB (글자 묶음 ${groups.length}개)`)
    } catch (e) {
      result.kept.push({ family: l.family, reason: String(e?.message ?? e) })
      log(`글꼴 ${l.family}: 원래 로더를 둔다 — ${e?.message ?? e}`)
    }
  }
  if (!done.length) return result
  mkdirSync(fontsDir, { recursive: true })
  const rules = []
  for (const d of done) for (const f of d.files) { writeFileSync(join(fontsDir, f.file), f.buf); rules.push(faceRule(d.loader.family, f)) }
  writeFileSync(join(fontsDir, 'fonts.css'), `/* 생성 — site-fonts.mjs(P3-4 perf): 쪽마다 쓰는 글자만 든 글꼴 묶음. 구글 css2 text= 로 받은 woff2 와 구글이 돌려준 unicode-range. 손으로 고치지 않는다. */\n${rules.join('\n')}\n`)
  // 원천 고쳐 쓰기: 뒤에서부터(자리가 어긋나지 않게) 로더를 변수 없는 자리표로, google import 에서 바뀐 이름을 뺀다, fonts.css 를 globals.css 뒤에 싣는다.
  let out = layout
  for (const d of [...done].sort((a, b) => b.loader.span[0] - a.loader.span[0])) out = out.slice(0, d.loader.span[0]) + `const ${d.loader.name} = { variable: "" }; // 글꼴은 app/fonts/fonts.css(쪽에 맞춘 글자 묶음)` + out.slice(d.loader.span[1])
  const stillGoogle = parsed.idents.filter((i) => { const ls = parsed.loaders.filter((l) => l.ident === i); return !ls.length || ls.some((l) => !done.some((d) => d.loader === l)) })
  out = out.replace(/import\s*\{[^}]*\}\s*from\s*["']next\/font\/google["'];?/, stillGoogle.length ? `import { ${stillGoogle.join(', ')} } from "next/font/google";` : '')
  // fonts.css 는 globals.css 안 @import 로 싣는다(Tailwind 가 한 파일로 합친다) — layout 에서 따로 import 하면 렌더 차단 CSS 요청이 하나 더 생겨 왕복이 늘고 글꼴 요청이 한 단계 늦어진다(실측 렌더 차단 낭비 +303 ms).
  const globalsFile = join(siteDir, 'app', 'globals.css')
  const globals = existsSync(globalsFile) ? readFileSync(globalsFile, 'utf8') : null
  const topImports = globals?.match(/^(?:\s*@import[^;]+;[ \t]*\r?\n)+/)
  if (globals && topImports) writeFileSync(globalsFile, `${topImports[0]}@import "./fonts/fonts.css";\n${globals.slice(topImports[0].length)}`)
  else out = /import\s+["']\.\/globals\.css["'];?/.test(out) ? out.replace(/(import\s+["']\.\/globals\.css["'];?)/, '$1\nimport "./fonts/fonts.css"') : `import "./fonts/fonts.css"\n${out}`
  writeFileSync(layoutFile, out)
  return result
}

/** 이미 글꼴 파일을 굽고 layout 을 바꿨는가. */
export const hasSiteFonts = (siteDir) => existsSync(join(siteDir, 'app', 'fonts', 'fonts.css'))

// ── 대체 글꼴 메트릭(C384, 흐름 ⑤ Task 5.10) ────────────────────────────────────────────────────────────────────────────────────────────
// 웹폰트가 도착해 시스템 글꼴과 바뀌는 순간 글줄 폭·높이가 달라 아래 요소가 밀린다(CLS). next/font 는 자기 로더에 한해 「<서체> Fallback」 면
// (Arial·Times New Roman 을 local() 로 쓰되 size-adjust·ascent-override·descent-override·line-gap-override 로 서체 모양에 맞춤)을 만들어 준다.
// 위의 subsetSiteFonts 가 로더를 변수 없는 자리표로 바꾸면 이 면이 사라지고, Pretendard(css @import)는 애초에 없다 — 같은 식을 서체 파일 메트릭에서 직접 계산해 단다.
// 식(Next 16 get-fallback-font-override-metrics, 근거 nextjs.org/docs/app/api-reference/components/font 「adjustFontFallback」):
//   sizeAdjust = (서체 a–z 평균 폭 / unitsPerEm) / (기준 글꼴 a–z 평균 폭 / unitsPerEm)  ·  ascent = ascender / (unitsPerEm × sizeAdjust)  ·  descent·lineGap 도 같다.
// 기준 글꼴(Next 와 같은 상수): Arial az 평균 934.5116279069767 / 2048 · Times New Roman 854.3953488372093 / 2048.
const FALLBACK_BASES = {
  sans: { local: 'Arial', azAvgWidth: 934.5116279069767, unitsPerEm: 2048 },
  serif: { local: 'Times New Roman', azAvgWidth: 854.3953488372093, unitsPerEm: 2048 },
}
const pct = (v) => `${(Math.abs(v) * 100).toFixed(2)}%`
// 한글: 서체의 한글이 아직 안 왔을 때 브라우저는 시스템 한글 글꼴로 그린다. 한글 음절 폭은 어느 시스템 글꼴이나 1em(정사각 칸)인데 Pretendard 는 0.864em 이라(실측: 표본 음절 평균 폭
// 1770/2048) 한글 글이 바뀔 때 줄이 14% 짧아져 줄 수가 달라진다 — saas-1 홈 CLS 0.13 의 실제 원인이었다(Lighthouse 원인 표지 「Web font loaded」, Pretendard 한글 조각). 그래서 한글 구간에는
// 시스템 한글 글꼴을 서체의 한글 폭으로 줄이고(size-adjust) 줄 높이를 서체 값으로 덮은(ascent·descent-override — 시스템 글꼴 자신의 값을 쓰지 않으므로 플랫폼과 무관) 면을 한 벌 더 둔다.
const HANGUL_RANGE = 'U+1100-11FF,U+3130-318F,U+A960-A97F,U+AC00-D7AF,U+D7B0-D7FF'
const HANGUL_LOCALS = ['Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR']

/**
 * 대체 면 @font-face. metrics = { unitsPerEm, ascender, descender, lineGap?, xAvgCharWidth, hangulAvgWidth? }(xAvgCharWidth = 글꼴 단위의 a–z 평균 폭, hangulAvgWidth = 한글 음절 평균 폭 — parseFontMetrics 가 채운다).
 * 라틴 면 하나(`src: local("Arial")` — 명조 계열은 Times New Roman)와, 한글 폭을 아는 서체면 한글 구간 면 하나(`unicode-range` 한글, `src: local("Malgun Gothic"), …`)를 줄바꿈으로 이어 돌려준다.
 * @returns {string} `@font-face{font-family:"<서체> Fallback";src:local("Arial");size-adjust:…%;ascent-override:…%;descent-override:…%;line-gap-override:…%}` (+ 한글 면)
 */
export function fallbackFaceCss({ family, metrics, serif = false }) {
  const base = FALLBACK_BASES[serif ? 'serif' : 'sans']
  const { unitsPerEm, ascender, descender, lineGap = 0, xAvgCharWidth, hangulAvgWidth = null } = metrics
  const face = (src, sizeAdjust, range = '') => {
    const over = (v) => pct(v / (unitsPerEm * sizeAdjust))
    return `@font-face{font-family:"${family} Fallback";src:${src};${range ? `unicode-range:${range};` : ''}size-adjust:${pct(sizeAdjust)};ascent-override:${over(ascender)};descent-override:${over(descender)};line-gap-override:${over(lineGap)}}`
  }
  const latin = face(`local("${base.local}")`, xAvgCharWidth / unitsPerEm / (base.azAvgWidth / base.unitsPerEm))
  if (!hangulAvgWidth) return latin
  return `${latin}\n${face(HANGUL_LOCALS.map((n) => `local("${n}")`).join(','), hangulAvgWidth / unitsPerEm, HANGUL_RANGE)}`
}

const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill']

/** woff2 → { tag: Buffer } (W3C WOFF2 §5: 표 목록 → 브로틀리 한 덩어리 → 표 순서대로 자른다). 변환된 hmtx 는 못 읽어 던진다. */
function woff2Tables(buf) {
  const numTables = buf.readUInt16BE(12)
  const compressedLen = buf.readUInt32BE(20)
  let off = 48
  const base128 = () => {
    let v = 0
    for (let i = 0; i < 5; i++) { const b = buf[off++]; v = v * 128 + (b & 0x7f); if (!(b & 0x80)) return v }
    throw new Error('woff2 UIntBase128 이 5바이트를 넘는다')
  }
  const entries = []
  for (let i = 0; i < numTables; i++) {
    const flags = buf[off++]
    const idx = flags & 0x3f
    const tag = idx === 63 ? (() => { const t = buf.toString('latin1', off, off + 4); off += 4; return t })() : WOFF2_TAGS[idx]
    const version = flags >> 6
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0
    const origLength = base128()
    const length = transformed ? base128() : origLength
    entries.push({ tag, length, transformed })
  }
  const raw = brotliDecompressSync(buf.subarray(off, off + compressedLen))
  const out = {}
  let at = 0
  for (const e of entries) {
    if (e.transformed && !['glyf', 'loca'].includes(e.tag)) throw new Error(`woff2 ${e.tag} 표가 변환돼 있어 읽을 수 없다`)
    out[e.tag] = raw.subarray(at, at + e.length)
    at += e.length
  }
  return out
}

/** sfnt(TTF·OTF) → { tag: Buffer }. */
function sfntTables(buf) {
  const n = buf.readUInt16BE(4)
  const out = {}
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16
    out[buf.toString('latin1', r, r + 4)] = buf.subarray(buf.readUInt32BE(r + 8), buf.readUInt32BE(r + 8) + buf.readUInt32BE(r + 12))
  }
  return out
}

/** cmap → 글자 코드의 글리프 번호 함수(포맷 4·12). 못 읽으면 던진다. */
function cmapLookup(cmap) {
  const n = cmap.readUInt16BE(2)
  let best = null
  for (let i = 0; i < n; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8)
    const enc = cmap.readUInt16BE(6 + i * 8)
    const off = cmap.readUInt32BE(8 + i * 8)
    const format = cmap.readUInt16BE(off)
    const rank = format === 12 && ((platform === 3 && enc === 10) || platform === 0) ? 3 : format === 4 && ((platform === 3 && enc === 1) || platform === 0) ? 2 : 0
    if (rank > (best?.rank ?? 0)) best = { rank, off, format }
  }
  if (!best) throw new Error('cmap 에 읽을 수 있는 포맷(4·12)이 없다')
  const t = cmap.subarray(best.off)
  if (best.format === 12) {
    const groups = t.readUInt32BE(12)
    return (cp) => {
      for (let g = 0; g < groups; g++) {
        const s = t.readUInt32BE(16 + g * 12)
        const e = t.readUInt32BE(20 + g * 12)
        if (cp >= s && cp <= e) return t.readUInt32BE(24 + g * 12) + (cp - s)
      }
      return 0
    }
  }
  const segX2 = t.readUInt16BE(6)
  const seg = segX2 / 2
  const endAt = 14
  const startAt = 16 + segX2
  const deltaAt = startAt + segX2
  const rangeAt = deltaAt + segX2
  return (cp) => {
    for (let s = 0; s < seg; s++) {
      if (cp > t.readUInt16BE(endAt + s * 2) || cp < t.readUInt16BE(startAt + s * 2)) continue
      const ro = t.readUInt16BE(rangeAt + s * 2)
      const delta = t.readUInt16BE(deltaAt + s * 2)
      if (ro === 0) return (cp + delta) & 0xffff
      const gid = t.readUInt16BE(rangeAt + s * 2 + ro + (cp - t.readUInt16BE(startAt + s * 2)) * 2)
      return gid === 0 ? 0 : (gid + delta) & 0xffff
    }
    return 0
  }
}

const HANGUL_SAMPLE = '이다에는의가을를로서한하고지기나리도해요니사자수아대인그일들어할있으시면보제것정스트전상오만시게중부라마공동소원주미유구'

/**
 * 글꼴 파일(woff2·TTF·OTF) → { unitsPerEm, ascender, descender, lineGap, xAvgCharWidth, hangulAvgWidth }. 줄 메트릭은 hhea(OS/2 가 「타이포 메트릭 사용」을 켜면 OS/2 typo),
 * xAvgCharWidth 는 cmap+hmtx 로 읽은 a–z 26자의 평균 폭 — Next 의 azAvgWidth 와 같은 뜻이다. 읽지 못하면 던진다(틀린 보정을 넣지 않는다).
 */
export function parseFontMetrics(buf) {
  let tables
  try {
    const sig = buf.toString('latin1', 0, 4)
    if (sig === 'wOF2') tables = woff2Tables(buf)
    else if (sig === '\x00\x01\x00\x00' || sig === 'OTTO' || sig === 'true') tables = sfntTables(buf)
    else throw new Error('글꼴 파일이 아니다(woff2·ttf·otf 서명이 없다)')
  } catch (e) {
    throw new Error(/글꼴|woff2/.test(e.message) ? e.message : `글꼴 파일을 못 읽었다 — ${e.message}`)
  }
  for (const t of ['head', 'hhea', 'hmtx', 'cmap']) if (!tables[t]) throw new Error(`${t} 표가 없다 — 글꼴 메트릭을 못 읽는다`)
  const unitsPerEm = tables.head.readUInt16BE(18)
  let ascender = tables.hhea.readInt16BE(4)
  let descender = tables.hhea.readInt16BE(6)
  let lineGap = tables.hhea.readInt16BE(8)
  const os2 = tables['OS/2']
  if (os2 && os2.length >= 74 && (os2.readUInt16BE(62) & 0x80)) { ascender = os2.readInt16BE(68); descender = os2.readInt16BE(70); lineGap = os2.readInt16BE(72) }
  const lookup = cmapLookup(tables.cmap)
  const hmtx = tables.hmtx
  const nH = tables.hhea.readUInt16BE(34)
  const advanceOf = (gid) => hmtx.readUInt16BE(Math.min(gid, nH - 1) * 4)
  let sum = 0
  for (let c = 0x61; c <= 0x7a; c++) {
    const gid = lookup(c)
    if (!gid) throw new Error('cmap 에 a–z 글자가 없다 — 평균 폭을 못 잰다')
    sum += advanceOf(gid)
  }
  // 한글 음절 평균 폭(자주 쓰는 음절 표본) — 한글이 브라우저의 시스템 한글 글꼴로 먼저 그려지는 동안의 줄바꿈 차이를 가늠하는 재료. 표본의 80% 가 안 들어 있으면 null.
  let hs = 0
  let hn = 0
  for (const ch of HANGUL_SAMPLE) { const gid = lookup(ch.codePointAt(0)); if (gid) { hs += advanceOf(gid); hn++ } }
  return { unitsPerEm, ascender, descender, lineGap, xAvgCharWidth: sum / 26, hangulAvgWidth: hn >= HANGUL_SAMPLE.length * 0.8 ? hs / hn : null }
}

const SERIF_HINT = /\b(?:serif|myeongjo|batang|gowun batang|song|ming|mincho|nanum myeongjo|noto serif|young serif|playfair|cormorant|lora|merriweather)\b/i
const isSerifFamily = (family) => SERIF_HINT.test(family) && !/\bsans\b/i.test(family)

/** fonts.css → [{ family, file, weight }] — 서체마다 가장 보통 굵기(400 에 가장 가까운)의 첫 글자 묶음 파일. */
function fontsCssFaces(css) {
  const best = new Map()
  for (const m of css.matchAll(/@font-face\{font-family:"([^"]+)";[^}]*?font-weight:(\d+);[^}]*?src:url\("\.\/([^"]+)"\)/g)) {
    const [, family, weight, file] = m
    const dist = Math.abs(Number(weight) - 400)
    const cur = best.get(family)
    if (!cur || dist < cur.dist || (dist === cur.dist && file < cur.file)) best.set(family, { family, file, weight: Number(weight), dist })
  }
  return [...best.values()]
}

/** 서체 변수가 든 줄(`--font-…`)에서 따옴표 서체 이름 뒤에 `"<이름> Fallback"` 을 끼운다. 이미 있는 줄은 그대로. */
function insertFallbackName(css, family) {
  const esc = family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`"${esc}"(?!\\s*,\\s*"${esc} Fallback")`, 'g')
  return css.split('\n').map((line) => (line.includes('--font-') && !line.includes(`"${family} Fallback"`) ? line.replace(re, `"${family}", "${family} Fallback"`) : line)).join('\n')
}

/**
 * 사이트의 글꼴마다 「<서체> Fallback」 대체 면을 만들어 app/fonts/fonts.css 에 더하고, globals.css 의 서체 스택에서 서체 이름 바로 뒤에 그 이름을 끼운다(C384).
 *   · 서체 출처 둘: ① app/fonts/fonts.css 의 구글 서체(subsetSiteFonts 가 받은 woff2 에서 읽는다) ② globals.css 가 @import 하는 Pretendard(패키지의 woff2 에서 읽는다).
 *   · 글꼴 파일을 못 읽는 서체는 건너뛴다(skipped 에 이유) — 틀린 보정을 넣느니 안 넣는다. 다시 돌려도 면은 한 번만.
 * @param {string} siteDir
 * @param {{ packageRoots?: string[] }} [opts] pretendard 패키지를 찾을 폴더들(기본: 사이트 폴더, 저장소 루트)
 * @returns {Promise<{ added: string[], skipped: { family: string, reason: string }[] }>}
 */
export async function addFallbackFaces(siteDir, { packageRoots = [siteDir, ROOT] } = {}) {
  const result = { added: [], skipped: [] }
  const globalsFile = join(siteDir, 'app', 'globals.css')
  if (!existsSync(globalsFile)) return result
  const fontsFile = join(siteDir, 'app', 'fonts', 'fonts.css')
  let fontsCss = existsSync(fontsFile) ? readFileSync(fontsFile, 'utf8') : null
  let globals = readFileSync(globalsFile, 'utf8')
  const sources = []
  if (fontsCss) for (const f of fontsCssFaces(fontsCss)) sources.push({ family: f.family, read: () => readFileSync(join(siteDir, 'app', 'fonts', f.file)) })
  if (/pretendard/i.test(globals) && !sources.some((s) => s.family === 'Pretendard Variable')) {
    sources.push({
      family: 'Pretendard Variable',
      read: () => {
        const rel = join('node_modules', 'pretendard', 'dist', 'web', 'variable', 'woff2', 'PretendardVariable.woff2')
        const hit = packageRoots.map((r) => join(r, rel)).find((p) => existsSync(p))
        if (!hit) throw new Error(`pretendard 패키지의 PretendardVariable.woff2 가 없다(${packageRoots.join(', ')})`)
        return readFileSync(hit)
      },
    })
  }
  const faces = []
  for (const s of sources) {
    if (fontsCss?.includes(`font-family:"${s.family} Fallback"`)) continue // 이미 더했다
    try {
      const metrics = parseFontMetrics(s.read())
      faces.push(fallbackFaceCss({ family: s.family, metrics, serif: isSerifFamily(s.family) }))
      globals = insertFallbackName(globals, s.family)
      result.added.push(s.family)
    } catch (e) {
      result.skipped.push({ family: s.family, reason: String(e?.message ?? e) })
    }
  }
  if (!faces.length) return result
  mkdirSync(join(siteDir, 'app', 'fonts'), { recursive: true })
  const header = '/* 대체 글꼴 면 — site-fonts.mjs addFallbackFaces(C384): 웹폰트가 바뀔 때 글줄이 밀리지 않게 시스템 글꼴을 서체 크기·줄 메트릭에 맞춘다. 손으로 고치지 않는다. */\n'
  writeFileSync(fontsFile, `${fontsCss ?? ''}${fontsCss?.endsWith('\n') || !fontsCss ? '' : '\n'}${fontsCss?.includes('대체 글꼴 면') ? '' : header}${faces.join('\n')}\n`)
  // 새로 만든 fonts.css 는 globals.css 맨 위 @import 뒤에 싣는다(subsetSiteFonts 가 이미 실은 경우는 그대로).
  if (!fontsCss && !/@import\s+["']\.\/fonts\/fonts\.css["']/.test(globals)) {
    const top = globals.match(/^(?:\s*@import[^;]+;[ \t]*\r?\n)+/)
    globals = top ? `${top[0]}@import "./fonts/fonts.css";\n${globals.slice(top[0].length)}` : `@import "./fonts/fonts.css";\n${globals}`
  }
  writeFileSync(globalsFile, globals)
  return result
}

// ── 영어 사이트의 한글 전용 키트 import(FINAL-WF4 EN7) ─────────────────────────────────────────────────────────
// 레시피 머리의 한글 제목체(displayKo — 마루부리·서초바탕 …)는 한글 글자를 그리는 서체라 영어 사이트에는 쓸 곳이 없다. 그런데 키트 항목이 css 필드로 싣는
// `@import`(네이버 한글한글 CDN·wf-fonts 파일)가 영어 사이트 globals.css 에도 남아 빌드 경고와 렌더 차단 요청을 하나 더 냈다(saas-2 실측: maru-buri.css).
// 영어 사이트는 그 키트의 import 줄만 뺀다 — 서체 변수(`--font-maru-buri-wf`)는 `var(--font-…, 대체 스택)` 이라 면이 없으면 다음 서체로 내려가므로 스택은 건드리지 않는다.
// 뺄 조건: displayKo 의 키트 항목이 제목(display)·본문(body)·고정폭(mono)·긴 글(prose)의 키트 항목과 다를 때만(같으면 그 서체는 영어 글자도 그린다).
// 한국어 사이트는 아무것도 하지 않는다(출력 불변). 항목이 css import 를 안 싣거나 줄이 없으면 아무것도 안 바꾼다.
/**
 * @param {string} siteDir
 * @param {{ fonts?: Record<string, { item?: string }|null|undefined> }} head  레시피 머리(fonts 만 읽는다)
 * @param {'ko'|'en'} locale
 * @param {{ fontsDir?: string }} [opts]  키트 항목 json 폴더(시험용으로 바꾼다)
 * @returns {{ removed: string[] }}  뺀 import 줄
 */
export function dropKoreanKitImports(siteDir, head, locale, { fontsDir = join(ROOT, 'registry', 'factory', 'fonts') } = {}) {
  const result = { removed: [] }
  if (locale !== 'en') return result
  const f = head?.fonts ?? {}
  const koItem = f.displayKo?.item
  if (!koItem) return result
  const others = new Set(['display', 'body', 'mono', 'prose'].map((k) => f[k]?.item).filter(Boolean))
  if (others.has(koItem)) return result
  const itemFile = join(fontsDir, `${koItem}.json`)
  if (!existsSync(itemFile)) return result
  const imports = Object.keys(JSON.parse(readFileSync(itemFile, 'utf8')).css ?? {}).filter((k) => k.startsWith('@import'))
  if (!imports.length) return result
  const globalsFile = join(siteDir, 'app', 'globals.css')
  if (!existsSync(globalsFile)) return result
  const lines = readFileSync(globalsFile, 'utf8').split('\n')
  const keep = lines.filter((line) => {
    if (!imports.some((imp) => line.includes(imp))) return true
    result.removed.push(line.trim())
    return false
  })
  if (result.removed.length) writeFileSync(globalsFile, keep.join('\n'))
  return result
}
