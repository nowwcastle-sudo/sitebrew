// P3-4 perf — 찍어낸 사이트의 글꼴을 쪽에 맞춘 글자 묶음 파일로(대장 C173): 글자를 쪽 소속으로 묶기·로더 읽기·css2 요청·fonts.css·layout 고쳐 쓰기·실패 시 원래 로더 유지.
// 네트워크는 가짜 fetch 로 막는다 — 실제 구글 응답 위의 결과는 보고서 실측(생성 → next build → qa:ops)이 맡는다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/stamp-fonts.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Buffer as Buf } from 'node:buffer'
import { BASE_GLYPHS, MAX_GLYPHS, addFallbackFaces, closureGlyphs, css2Url, fallbackFaceCss, faceRule, glyphGroups, parseFontFaces, parseFontMetrics, parseGoogleLoaders, recipeWeightsFor, subsetSiteFonts } from '../stamp/site-fonts.mjs'

// 실제 찍어낸 사이트(local × r1-measure)의 layout.tsx 모양 그대로
const LAYOUT = `import "./globals.css"
import { MotionBoot } from "@/components/motion/motion-boot"
import { IBM_Plex_Mono, IBM_Plex_Sans_KR, Martian_Mono, Nanum_Gothic_Coding } from "next/font/google";

const nanumGothicCodingNanumGothicCodingWf = Nanum_Gothic_Coding({subsets:['latin'],weight:['400','700'],variable:'--font-nanum-gothic-coding-wf'});

const martianMonoMartianMonoWf = Martian_Mono({subsets:['latin'],variable:'--font-martian-mono-wf'});

const ibmPlexSansKrIbmPlexSansKrWf = IBM_Plex_Sans_KR({subsets:['latin'],weight:['400','700'],variable:'--font-ibm-plex-sans-kr-wf'});

const ibmPlexMonoIbmPlexMonoWf = IBM_Plex_Mono({subsets:['latin'],weight:['400','600'],variable:'--font-ibm-plex-mono-wf'});

export default function RootLayout() { return null }
`

const SITE = {
  business: { name: '달빛 베이커리', addr: '마포구 달빛로' },
  pages: { '/': { id: 'home', title: { $ref: 'business.name' } }, '/privacy': { id: 'privacy', title: '개인정보', legal: true } },
  sections: {
    'home/hero': { block: 'hero', props: { headline: { $ref: 'business.name' }, sub: '갓 구운 식빵' } },
    'privacy/x': { block: 'x', props: { body: '수집 항목' } },
    'global/footer': { block: 'footer', props: { addr: { $ref: 'business.addr' } } },
  },
  legal: { privacy: { title: '처리방침', clauses: [{ title: '제1조', text: '목적' }] } },
  shell: { brand: { $ref: 'business.name' }, nav: [{ label: '홈', href: '/' }] },
  orphan: { note: '뷁' }, // 어느 쪽에도 안 묶인 글자
}

const GLOBALS = '@import "tailwindcss";\n@import "tw-animate-css";\n\n@theme inline {\n  --x: 1;\n}\n'
function fixtureSite({ layout = LAYOUT, site = SITE, globals = GLOBALS } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'site-fonts-'))
  for (const d of ['app', 'content', join('components', 'site'), join('node_modules', 'x')]) mkdirSync(join(dir, d), { recursive: true })
  writeFileSync(join(dir, 'app', 'layout.tsx'), layout)
  if (globals) writeFileSync(join(dir, 'app', 'globals.css'), globals)
  writeFileSync(join(dir, 'content', 'site.json'), JSON.stringify(site))
  mkdirSync(join(dir, 'app', 'privacy'), { recursive: true })
  writeFileSync(join(dir, 'app', 'page.tsx'), 'import { A } from "@/components/site/a"\nexport default function P() { return <A /> }\n')
  writeFileSync(join(dir, 'app', 'privacy', 'page.tsx'), 'import { B } from "../../components/site/b"\nexport default function P() { return <B /> }\n')
  writeFileSync(join(dir, 'components', 'site', 'a.tsx'), '// 한글 주석은 화면에 안 나온다\nexport const A = () => <p>{"다시 시도 →"}</p>\n')
  writeFileSync(join(dir, 'components', 'site', 'b.tsx'), 'export const B = () => <p>개인정보 안내</p>\n')
  writeFileSync(join(dir, 'components', 'site', 'unused.tsx'), 'export const U = () => <p>안쓴다쀍</p>\n')
  writeFileSync(join(dir, 'node_modules', 'x', 'skip.js'), '쀍쀍쀍') // 의존성은 안 본다
  return dir
}

const woff2 = (tag) => Buffer.concat([Buffer.from('wOF2'), Buffer.from(`${tag}`.padEnd(200, '.'))])
const cssFor = (weights, range = 'U+31-33, U+c544') => weights.map((w) => `@font-face {\n  font-family: 'X';\n  font-style: normal;\n  font-weight: ${w};\n  font-display: swap;\n  src: url(https://fonts.gstatic.com/l/font?kit=${w}k) format('woff2');\n  unicode-range: ${range};\n}`).join('\n')
/** 가짜 fetch: css2 는 요청한 굵기마다 면 하나(범위는 요청 글자 코드 목록), gstatic 은 woff2. failFamily 는 400. */
function fakeFetch({ failFamily = null, log = [] } = {}) {
  return async (url) => {
    log.push(String(url))
    const u = new URL(url)
    if (u.hostname === 'fonts.googleapis.com') {
      const fam = u.searchParams.get('family')
      if (failFamily && fam.startsWith(failFamily)) return new Response('no', { status: 400 })
      const weights = (fam.split(':wght@')[1] ?? '400').split(';')
      const range = [...u.searchParams.get('text')].map((c) => `U+${c.codePointAt(0).toString(16)}`).join(', ')
      return new Response(cssFor(weights, range), { status: 200 })
    }
    return new Response(woff2(u.searchParams.get('kit')), { status: 200 })
  }
}

test('closureGlyphs: 진입 파일에서 import(@/·상대)를 따라 닿는 소스의 화면 글자만 — 주석·안 닿는 파일·node_modules 는 안 본다', () => {
  const dir = fixtureSite()
  const home = closureGlyphs(dir, join(dir, 'app', 'page.tsx'))
  for (const ch of ['다', '시', '도', '→']) assert.ok(home.has(ch), ch)
  assert.ok(!home.has('주') && !home.has('석'), '주석 글자는 화면에 안 나온다')
  assert.ok(!home.has('쀍') && !home.has('안'), '안 닿는 파일·node_modules 는 안 본다')
  assert.ok(!home.has('개'), '다른 쪽의 부품 글자는 이 쪽 것이 아니다')
  const priv = closureGlyphs(dir, join(dir, 'app', 'privacy', 'page.tsx'))
  assert.ok(priv.has('개') && priv.has('인') && !priv.has('다'), '상대 경로 import 도 따라간다')
  assert.equal(closureGlyphs(dir, join(dir, 'app', 'nope.tsx')).size, 0, '없는 진입 파일은 빈 집합')
})

test('glyphGroups(merge:false): 모든 진입점이 쓰는 글자(all) · 진입점 조합 · 안 묶인 나머지(rest) — $ref 를 풀어 글자를 쪽에 붙인다', () => {
  const { groups, entries } = glyphGroups(fixtureSite(), { merge: false })
  assert.deepEqual(entries, ['/', '/privacy'])
  const by = Object.fromEntries(groups.map((g) => [g.key, g.chars]))
  assert.equal(groups[0].key, 'all', '공통이 맨 앞(g0)')
  for (const ch of BASE_GLYPHS) assert.ok(by.all.includes(ch), `기본 ${ch}`)
  for (const ch of ['홈', '마', '포', '달', '빛', '로']) assert.ok(by.all.includes(ch), `공통 ${ch} — 셸·global 푸터가 $ref 로 가리킨 글자`)
  for (const ch of ['다', '시', '도', '갓', '운', '식', '빵']) assert.ok(by['/'].includes(ch) && !by.all.includes(ch), `홈 전용 ${ch}`)
  for (const ch of ['수', '집', '항', '처', '침', '적', '개', '인']) assert.ok(by['/privacy'].includes(ch) && !by.all.includes(ch), `개인정보 쪽 전용 ${ch}`)
  assert.ok(by.rest.includes('뷁') && !by.rest.includes('달'), '아무 쪽에도 안 묶인 글자는 rest')
  assert.ok(!Object.values(by).some((c) => c.includes('쀍') || c.includes('안쓴')), '안 닿는 부품·주석 글자는 어디에도 없다')
  assert.ok(groups.every((g) => [...g.chars].length <= MAX_GLYPHS))
})

test('glyphGroups(기본 merge): 쪽별 묶음은 쪽 하나가 받는 글자의 대부분이 공통이라 이득이 작다 — 전부 합쳐 한 묶음, 700자를 넘으면 잘라 여러 묶음으로(구글 css2 text 한도)', () => {
  const one = glyphGroups(fixtureSite())
  assert.equal(one.groups.length, 1)
  assert.equal(one.groups[0].key, 'all')
  for (const ch of ['갓', '침', '뷁', '다', '홈', ...BASE_GLYPHS]) assert.ok(one.groups[0].chars.includes(ch), ch)
  const many = Array.from({ length: 1500 }, (_, i) => String.fromCodePoint(0xac00 + i)).join('')
  const site = { ...SITE, sections: { ...SITE.sections, 'home/big': { block: 'x', props: { t: many } } } }
  const { groups } = glyphGroups(fixtureSite({ site }))
  assert.ok(groups.length >= 3, `묶음 ${groups.length}개`)
  assert.ok(groups.every((g) => [...g.chars].length <= MAX_GLYPHS))
})

test('parseGoogleLoaders: 이름·서체·굵기·variable 을 읽고, 굵기 없는 가변 서체는 weights null', () => {
  const p = parseGoogleLoaders(LAYOUT)
  assert.deepEqual(p.idents, ['IBM_Plex_Mono', 'IBM_Plex_Sans_KR', 'Martian_Mono', 'Nanum_Gothic_Coding'])
  assert.deepEqual(p.loaders.map((l) => [l.family, l.weights, l.variable, l.convertible]), [
    ['Nanum Gothic Coding', ['400', '700'], '--font-nanum-gothic-coding-wf', true],
    ['Martian Mono', null, '--font-martian-mono-wf', true],
    ['IBM Plex Sans KR', ['400', '700'], '--font-ibm-plex-sans-kr-wf', true],
    ['IBM Plex Mono', ['400', '600'], '--font-ibm-plex-mono-wf', true],
  ])
  const odd = parseGoogleLoaders('import { Inter } from "next/font/google";\nconst i = Inter({subsets:[\'latin\'],variable:\'--f\',display:\'optional\'});')
  assert.equal(odd.loaders[0].convertible, false, '모르는 옵션이 있으면 건드리지 않는다')
  assert.deepEqual(parseGoogleLoaders('const a = 1').loaders, [])
})

test('css2Url·parseFontFaces·faceRule: 굵기를 정렬해 요청하고, woff2 면과 구글이 돌려준 unicode-range 를 읽어 @font-face 로', () => {
  const u = new URL(css2Url('IBM Plex Sans KR', ['700', '400'], '안녕 A'))
  assert.equal(u.origin + u.pathname, 'https://fonts.googleapis.com/css2')
  assert.equal(u.searchParams.get('family'), 'IBM Plex Sans KR:wght@400;700')
  assert.equal(u.searchParams.get('text'), '안녕 A')
  const faces = parseFontFaces(cssFor(['400', '700'], 'U+31-33, U+c544'))
  assert.deepEqual(faces.map((f) => [f.weight, f.range]), [['400', 'U+31-33, U+c544'], ['700', 'U+31-33, U+c544']])
  assert.deepEqual(parseFontFaces("@font-face { font-weight: 400; src: url(x) format('woff'); }"), [])
  assert.equal(faceRule('IBM Plex Sans KR', { file: 'a.woff2', weight: '400', range: 'U+31-33' }), '@font-face{font-family:"IBM Plex Sans KR";font-style:normal;font-weight:400;font-display:swap;src:url("./a.woff2") format("woff2");unicode-range:U+31-33;}')
})

test('subsetSiteFonts: 서체·굵기마다 woff2 하나를 받아 app/fonts 에 두고(묶음 하나면 unicode-range 없이), fonts.css @font-face, layout 은 변수 없는 자리표 + fonts.css import', async () => {
  const dir = fixtureSite()
  const seen = []
  const r = await subsetSiteFonts(dir, { fetch: fakeFetch({ log: seen }), weightsFor: (fam) => (fam === 'Martian Mono' ? [400, 600] : []) })
  assert.deepEqual(r.converted.map((c) => c.family), ['Nanum Gothic Coding', 'Martian Mono', 'IBM Plex Sans KR', 'IBM Plex Mono'])
  assert.deepEqual(r.kept, [])
  assert.equal(r.groups, 1, '쪽별로 쪼개지 않고 한 묶음')
  const css = readFileSync(join(dir, 'app', 'fonts', 'fonts.css'), 'utf8')
  assert.equal(css.match(/@font-face/g).length, 4 * 2, '서체 4 × 굵기 2')
  for (const f of ['nanum-gothic-coding-400-g0', 'nanum-gothic-coding-700-g0', 'martian-mono-600-g0', 'ibm-plex-sans-kr-400-g0', 'ibm-plex-mono-600-g0']) assert.ok(existsSync(join(dir, 'app', 'fonts', `${f}.woff2`)), f)
  assert.match(css, /@font-face\{font-family:"IBM Plex Sans KR";font-style:normal;font-weight:400;font-display:swap;src:url\("\.\/ibm-plex-sans-kr-400-g0\.woff2"\) format\("woff2"\);\}/)
  assert.doesNotMatch(css, /unicode-range:/, '파일 하나면 범위가 필요 없다 — 없는 글자는 브라우저가 다음 서체로 내린다')
  const layout = readFileSync(join(dir, 'app', 'layout.tsx'), 'utf8')
  assert.doesNotMatch(layout, /next\/font\/google/, '바뀌지 않은 로더가 없으면 google import 는 사라진다')
  assert.doesNotMatch(layout, /import\s+["']\.\/fonts/, 'layout 은 fonts.css 를 따로 import 하지 않는다(렌더 차단 CSS 요청이 하나 더 생긴다)')
  assert.equal(readFileSync(join(dir, 'app', 'globals.css'), 'utf8'), '@import "tailwindcss";\n@import "tw-animate-css";\n@import "./fonts/fonts.css";\n\n@theme inline {\n  --x: 1;\n}\n', 'globals.css 맨 위 @import 들 바로 뒤에 fonts.css')
  assert.match(layout, /const ibmPlexSansKrIbmPlexSansKrWf = \{ variable: "" \};/, '.variable 을 읽는 코드가 그대로 돈다')
  assert.doesNotMatch(layout, /Nanum_Gothic_Coding\(/)
  const cssReq = seen.filter((u) => u.includes('fonts.googleapis.com'))
  assert.equal(cssReq.length, 4)
  assert.ok(cssReq.some((u) => new URL(u).searchParams.get('family') === 'Martian Mono:wght@400;600'), '가변 서체는 weightsFor 의 굵기')
  assert.ok(cssReq.some((u) => new URL(u).searchParams.get('family') === 'IBM Plex Mono:wght@400;600'), '로더가 굵기를 명시하면 그것')
  assert.ok(cssReq.every((u) => { const t = new URL(u).searchParams.get('text'); return ['갓', '침', '뷁', '다', '홈'].every((c) => t.includes(c)) }), '쪽 전용·rest 글자까지 한 요청에 든다')
})

test('subsetSiteFonts: 글자가 많아 묶음이 여럿이면 파일마다 구글이 돌려준 unicode-range 를 단다(같은 서체·굵기의 면이 서로 글자를 나눠 맡는다)', async () => {
  const many = Array.from({ length: 1500 }, (_, i) => String.fromCodePoint(0xac00 + i)).join('')
  const dir = fixtureSite({ site: { ...SITE, sections: { ...SITE.sections, 'home/big': { block: 'x', props: { t: many } } } } })
  const r = await subsetSiteFonts(dir, { fetch: fakeFetch() })
  assert.ok(r.groups >= 3)
  const css = readFileSync(join(dir, 'app', 'fonts', 'fonts.css'), 'utf8')
  assert.equal(css.match(/@font-face/g).length, 4 * 2 * r.groups)
  assert.equal(css.match(/unicode-range:U\+/g).length, 4 * 2 * r.groups, '면마다 범위')
  assert.ok(existsSync(join(dir, 'app', 'fonts', `ibm-plex-sans-kr-700-g${r.groups - 1}.woff2`)))
})

test('subsetSiteFonts: 한 서체가 실패하면 그 서체의 원래 로더·import 를 두고 나머지만 바꾼다(조용히 글꼴을 잃지 않는다)', async () => {
  const dir = fixtureSite()
  const r = await subsetSiteFonts(dir, { fetch: fakeFetch({ failFamily: 'IBM Plex Sans KR' }) })
  assert.deepEqual(r.kept.map((k) => k.family), ['IBM Plex Sans KR'])
  assert.match(r.kept[0].reason, /400/)
  assert.equal(r.converted.length, 3)
  const layout = readFileSync(join(dir, 'app', 'layout.tsx'), 'utf8')
  assert.match(layout, /import \{ IBM_Plex_Sans_KR \} from "next\/font\/google";/, '실패한 것만 google import 에 남는다')
  assert.match(layout, /const ibmPlexSansKrIbmPlexSansKrWf = IBM_Plex_Sans_KR\(\{subsets:\['latin'\],weight:\['400','700'\],variable:'--font-ibm-plex-sans-kr-wf'\}\);/)
  assert.match(layout, /nanumGothicCodingNanumGothicCodingWf = \{ variable: "" \}/)
  const css = readFileSync(join(dir, 'app', 'fonts', 'fonts.css'), 'utf8')
  assert.doesNotMatch(css, /IBM Plex Sans KR/, '실패한 서체의 면은 fonts.css 에 없다')
  assert.equal(existsSync(join(dir, 'app', 'fonts', 'ibm-plex-sans-kr-400-g0.woff2')), false)
  // woff2 가 아닌 응답도 실패로 본다 — 전부 실패하면 layout 은 손대지 않는다
  const dir2 = fixtureSite()
  const bad = async (url) => (new URL(url).hostname === 'fonts.googleapis.com' ? new Response(cssFor(['400']), { status: 200 }) : new Response('<html>', { status: 200 }))
  const r2 = await subsetSiteFonts(dir2, { fetch: bad })
  assert.equal(r2.converted.length, 0)
  assert.equal(readFileSync(join(dir2, 'app', 'layout.tsx'), 'utf8'), LAYOUT)
  assert.equal(existsSync(join(dir2, 'app', 'fonts', 'fonts.css')), false)
})

test('subsetSiteFonts: 구글이 text 를 무시하고 조각난 전체 CSS 를 주면(면이 굵기보다 많다) 실패로 보고 원래 로더를 둔다', async () => {
  const dir = fixtureSite()
  const manyFaces = async (url) => (new URL(url).hostname === 'fonts.googleapis.com' ? new Response(cssFor(Array.from({ length: 94 }, () => '400')), { status: 200 }) : new Response(woff2('x'), { status: 200 }))
  const r = await subsetSiteFonts(dir, { fetch: manyFaces })
  assert.equal(r.converted.length, 0)
  assert.equal(r.kept.length, 4)
  assert.match(r.kept[0].reason, /text 가 무시됐다/)
  assert.equal(readFileSync(join(dir, 'app', 'layout.tsx'), 'utf8'), LAYOUT)
})

test('subsetSiteFonts: 다시 돌려도 안전하다 — google 로더가 없으면 아무것도 하지 않는다', async () => {
  const dir = fixtureSite()
  await subsetSiteFonts(dir, { fetch: fakeFetch() })
  const once = readFileSync(join(dir, 'app', 'layout.tsx'), 'utf8')
  const seen = []
  const r = await subsetSiteFonts(dir, { fetch: fakeFetch({ log: seen }) })
  assert.deepEqual(r, { converted: [], kept: [], groups: 0, glyphs: 0 })
  assert.equal(seen.length, 0)
  assert.equal(readFileSync(join(dir, 'app', 'layout.tsx'), 'utf8'), once)
})

test('subsetSiteFonts: globals.css 가 없으면 layout 에서 fonts.css 를 import 한다(글꼴이 조용히 안 실리지 않게)', async () => {
  const dir = fixtureSite({ globals: null })
  await subsetSiteFonts(dir, { fetch: fakeFetch() })
  assert.match(readFileSync(join(dir, 'app', 'layout.tsx'), 'utf8'), /^import "\.\/globals\.css"\nimport "\.\/fonts\/fonts\.css"/)
})

test('recipeWeightsFor: 레시피 머리 fonts 에서 이 서체의 굵기를 모으고 400 은 늘 넣는다', () => {
  const head = { fonts: { display: { family: 'Martian Mono', item: 'font-martian-mono', weight: 600 }, displayKo: { family: 'Nanum Gothic Coding' }, body: { family: 'IBM Plex Sans KR' } } }
  assert.deepEqual(recipeWeightsFor(head, 'Martian Mono'), [400, 600])
  assert.deepEqual(recipeWeightsFor(head, 'martian-mono'), [400, 600], '이름 표기 차이(공백·하이픈·대소문자)는 무시')
  assert.deepEqual(recipeWeightsFor(head, 'IBM Plex Sans KR'), [400])
  assert.deepEqual(recipeWeightsFor({}, 'Anything'), [400])
})

// ── C384(흐름 ⑤ Task 5.10): 글꼴이 바뀔 때 글이 밀리지 않게 대체 글꼴 면에 크기·줄 메트릭을 단다 ─────────────────────────────────
// next/font 는 로더를 자기 손으로 쓸 때 「<서체> Fallback」 면(size-adjust·ascent-override·descent-override)을 만들어 준다. site-fonts 가 로더를 변수 없는 자리표로
// 바꾸면서 이 면을 잃었고, Pretendard(css @import)는 처음부터 없었다 → 웹폰트가 도착하는 순간 글줄이 밀려 saas-1 홈 CLS 0.15 (대장 C384).

/** 시험용 최소 TrueType: head·hhea·hmtx·maxp·cmap(포맷 4, a–z)·OS/2. a–z 의 advance 는 모두 `adv`. */
function tinySfnt({ unitsPerEm = 1000, ascender = 900, descender = -200, lineGap = 100, adv = 500, withCmap = true } = {}) {
  const u16 = (n) => { const b = Buf.alloc(2); b.writeUInt16BE(n); return b }
  const i16 = (n) => { const b = Buf.alloc(2); b.writeInt16BE(n); return b }
  const u32 = (n) => { const b = Buf.alloc(4); b.writeUInt32BE(n); return b }
  const head = Buf.concat([u32(0x00010000), u32(0), u32(0), u32(0x5f0f3cf5), u16(0), u16(unitsPerEm), Buf.alloc(16), Buf.alloc(8), u16(0), u16(8), i16(2), i16(0), i16(0)])
  const nGlyphs = 28 // .notdef + a–z + space
  const hhea = Buf.concat([u32(0x00010000), i16(ascender), i16(descender), i16(lineGap), u16(1000), Buf.alloc(22), u16(nGlyphs)])
  const hm = []
  for (let g = 0; g < nGlyphs; g++) hm.push(u16(g === 0 ? 600 : adv), i16(0))
  const hmtx = Buf.concat(hm)
  const maxp = Buf.concat([u32(0x00010000), u16(nGlyphs), Buf.alloc(26)])
  // cmap 포맷 4: a(0x61)–z(0x7a) → gid 1–26, 끝 구간 0xffff
  const segs = [{ s: 0x61, e: 0x7a, d: (1 - 0x61) & 0xffff }, { s: 0xffff, e: 0xffff, d: 1 }]
  const f4 = Buf.concat([u16(4), u16(16 + segs.length * 8), u16(0), u16(segs.length * 2), u16(0), u16(0), u16(0), ...segs.map((x) => u16(x.e)), u16(0), ...segs.map((x) => u16(x.s)), ...segs.map((x) => u16(x.d)), ...segs.map(() => u16(0))])
  const cmap = Buf.concat([u16(0), u16(1), u16(3), u16(1), u32(12), f4])
  const os2 = Buf.concat([u16(3), i16(500), Buf.alloc(60), u16(0), u16(0), i16(ascender), i16(descender), i16(lineGap), Buf.alloc(20)])
  const tables = [['OS/2', os2], ['cmap', cmap], ['head', head], ['hhea', hhea], ['hmtx', hmtx], ['maxp', maxp]].filter(([t]) => withCmap || t !== 'cmap')
  let off = 12 + tables.length * 16
  const dir = []
  const body = []
  for (const [tag, data] of tables) { dir.push(Buf.from(tag, 'latin1'), u32(0), u32(off), u32(data.length)); const pad = (4 - (data.length % 4)) % 4; body.push(data, Buf.alloc(pad)); off += data.length + pad }
  return Buf.concat([u32(0x00010000), u16(tables.length), u16(0), u16(0), u16(0), ...dir, ...body])
}
const PRETENDARD = () => join(process.cwd(), 'node_modules', 'pretendard', 'dist', 'web', 'variable', 'woff2', 'PretendardVariable.woff2')

test('fallbackFaceCss: 대체 면에 size-adjust·ascent-override·descent-override 를 단다 — next/font 와 같은 식(Arial az 평균 폭 934.51/2048)', () => {
  const css = fallbackFaceCss({ family: 'Pretendard', metrics: { unitsPerEm: 1000, ascender: 950, descender: -250, xAvgCharWidth: 520 } })
  assert.match(css, /size-adjust:\s*\d+(\.\d+)?%/)
  assert.match(css, /ascent-override/)
  assert.match(css, /descent-override/)
  assert.match(css, /font-family:"Pretendard Fallback"/)
  assert.match(css, /src:local\("Arial"\)/)
  // 식: sizeAdjust = (520/1000) / (934.5116279069767/2048) = 1.1396… → 113.96%; ascent = 950/(1000*sizeAdjust) = 83.36%
  assert.match(css, /size-adjust:113\.96%/)
  assert.match(css, /ascent-override:83\.36%/)
  assert.match(css, /descent-override:21\.94%/)
  assert.match(css, /line-gap-override:0\.00%/)
})

test('fallbackFaceCss: 한글 폭을 아는 서체는 한글 구간 면을 하나 더 둔다 — 시스템 한글 글꼴(1em 칸)을 서체의 한글 폭으로 줄이고 줄 높이는 서체 값으로 덮는다', () => {
  const css = fallbackFaceCss({ family: 'Pretendard Variable', metrics: { unitsPerEm: 2048, ascender: 1950, descender: -494, lineGap: 0, xAvgCharWidth: 1036.85, hangulAvgWidth: 1770 } })
  const faces = css.split('\n')
  assert.equal(faces.length, 2)
  assert.match(faces[0], /src:local\("Arial"\)/)
  assert.doesNotMatch(faces[0], /unicode-range/, '라틴 면은 범위 제한이 없다')
  // 한글 면: 폭 = 1770/2048 = 86.43% · ascent = (1950/2048)/0.8643 = 110.17% · descent = (494/2048)/0.8643 = 27.91%
  assert.match(faces[1], /unicode-range:U\+1100-11FF,U\+3130-318F,U\+A960-A97F,U\+AC00-D7AF,U\+D7B0-D7FF/)
  assert.match(faces[1], /src:local\("Malgun Gothic"\),local\("Apple SD Gothic Neo"\),local\("Noto Sans CJK KR"\),local\("Noto Sans KR"\)/)
  assert.match(faces[1], /size-adjust:86\.43%/)
  assert.match(faces[1], /ascent-override:110\.17%/)
  assert.match(faces[1], /descent-override:27\.91%/)
  assert.equal(fallbackFaceCss({ family: 'X', metrics: { unitsPerEm: 1000, ascender: 900, descender: -200, xAvgCharWidth: 500, hangulAvgWidth: null } }).split('\n').length, 1, '한글 폭이 없으면 라틴 면만')
})

test('fallbackFaceCss: 명조 계열은 Times New Roman 에 맞춘다', () => {
  const css = fallbackFaceCss({ family: 'Gowun Batang', serif: true, metrics: { unitsPerEm: 1000, ascender: 900, descender: -200, lineGap: 0, xAvgCharWidth: 500 } })
  assert.match(css, /src:local\("Times New Roman"\)/)
})

test('parseFontMetrics: sfnt 에서 unitsPerEm·hhea 줄 메트릭·a–z 평균 폭(cmap+hmtx)을 읽는다', () => {
  const m = parseFontMetrics(tinySfnt({ unitsPerEm: 1000, ascender: 900, descender: -200, lineGap: 100, adv: 450 }))
  assert.deepEqual(m, { unitsPerEm: 1000, ascender: 900, descender: -200, lineGap: 100, xAvgCharWidth: 450, hangulAvgWidth: null })
})

test('parseFontMetrics: a–z 가 없는 글꼴(cmap 없음)·글꼴이 아닌 바이트는 던진다 — 틀린 값으로 보정하지 않는다', () => {
  assert.throws(() => parseFontMetrics(tinySfnt({ withCmap: false })), /cmap/)
  assert.throws(() => parseFontMetrics(Buf.from('not a font at all')), /글꼴/)
})

test('parseFontMetrics: 실제 woff2(Pretendard 가변)를 읽는다 — 브로틀리 해제·표 순서·cmap 포맷', () => {
  const m = parseFontMetrics(readFileSync(PRETENDARD()))
  assert.equal(m.unitsPerEm, 2048)
  assert.ok(m.ascender > 1500 && m.ascender < 2400, `ascender ${m.ascender}`)
  assert.ok(m.descender < 0 && m.descender > -1000, `descender ${m.descender}`)
  assert.ok(m.xAvgCharWidth > 0.35 * 2048 && m.xAvgCharWidth < 0.75 * 2048, `az 평균 ${m.xAvgCharWidth}`)
  // 한글 음절 평균 폭: Pretendard 는 1em 칸보다 좁다(실측 0.864em) — 시스템 한글 글꼴(1em)과 줄 수가 달라지는 까닭
  assert.ok(m.hangulAvgWidth > 0.8 * 2048 && m.hangulAvgWidth < 0.95 * 2048, `한글 평균 ${m.hangulAvgWidth}`)
})

test('addFallbackFaces: fonts.css 의 서체마다 「<서체> Fallback」 면을 더하고 globals.css 스택의 서체 이름 뒤에 끼운다 · 다시 돌려도 한 번만', async () => {
  const real = readFileSync(PRETENDARD())
  const stacks = '@import "tailwindcss";\n@theme inline {\n  --font-sans: var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif);\n  --font-mono: var(--font-ibm-plex-mono-wf, "IBM Plex Mono", "Consolas", monospace);\n}\n'
  const dir = fixtureSite({ globals: stacks })
  const realFetch = async (url) => (new URL(url).hostname === 'fonts.googleapis.com' ? fakeFetch()(url) : new Response(real, { status: 200 }))
  await subsetSiteFonts(dir, { fetch: realFetch })
  const r = await addFallbackFaces(dir)
  assert.ok(r.added.includes('IBM Plex Sans KR') && r.added.includes('IBM Plex Mono'), JSON.stringify(r))
  const fonts = readFileSync(join(dir, 'app', 'fonts', 'fonts.css'), 'utf8')
  assert.match(fonts, /@font-face\{font-family:"IBM Plex Sans KR Fallback";src:local\("Arial"\);size-adjust:[\d.]+%;ascent-override:[\d.]+%;descent-override:[\d.]+%;line-gap-override:[\d.]+%\}/)
  const g = readFileSync(join(dir, 'app', 'globals.css'), 'utf8')
  assert.match(g, /"IBM Plex Sans KR", "IBM Plex Sans KR Fallback", "Apple SD Gothic Neo"/)
  assert.match(g, /"IBM Plex Mono", "IBM Plex Mono Fallback", "Consolas"/)
  await addFallbackFaces(dir)
  assert.equal(readFileSync(join(dir, 'app', 'fonts', 'fonts.css'), 'utf8').match(/IBM Plex Sans KR Fallback"/g).length, 2, '면은 라틴 하나 + 한글 하나뿐 — 다시 돌려도 늘지 않는다')
  assert.equal(readFileSync(join(dir, 'app', 'globals.css'), 'utf8').match(/IBM Plex Sans KR Fallback/g).length, 1)
})

test('addFallbackFaces: 글꼴을 못 읽으면(가짜 woff2) 그 서체만 건너뛰고 CSS 는 그대로 — 조용히 틀린 보정을 넣지 않는다', async () => {
  const dir = fixtureSite({ globals: '@theme inline {\n  --font-sans: var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", sans-serif);\n}\n' })
  await subsetSiteFonts(dir, { fetch: fakeFetch() })
  const before = readFileSync(join(dir, 'app', 'globals.css'), 'utf8')
  const r = await addFallbackFaces(dir)
  assert.deepEqual(r.added, [])
  assert.ok(r.skipped.length >= 1)
  assert.equal(readFileSync(join(dir, 'app', 'globals.css'), 'utf8'), before)
})

test('addFallbackFaces: css @import 로 싣는 Pretendard 도 패키지 파일에서 읽어 면을 더한다', async () => {
  const dir = fixtureSite({ globals: '@import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";\n@theme inline {\n  --font-pretendard-wf: "Pretendard Variable", Pretendard;\n  --font-sans: var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", sans-serif);\n}\n' })
  const r = await addFallbackFaces(dir, { packageRoots: [process.cwd()] })
  assert.ok(r.added.includes('Pretendard Variable'), JSON.stringify(r))
  const g = readFileSync(join(dir, 'app', 'globals.css'), 'utf8')
  assert.match(g, /"Pretendard Variable", "Pretendard Variable Fallback"/)
  assert.equal(g.match(/Pretendard Variable Fallback/g).length, 2, '스택 두 줄(변수 정의 + 기본값 목록)에 한 번씩')
  assert.match(readFileSync(join(dir, 'app', 'fonts', 'fonts.css'), 'utf8'), /Pretendard Variable Fallback/)
})
