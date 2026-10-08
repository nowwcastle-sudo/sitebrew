import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { fontProblems, variableOverlaps, fontRegistry, loadSources, koreanListProblems, loadKoreanList, familyOf, canonicalItem, FONTS_DIR, FACES_DIR, faceFiles, faces } from './gen-fonts.mjs'
import { installPath } from './install-closure.mjs'
import { fontStacks, isKorean, parseRecipe } from './recipe.mjs'
import { fontVar, FONT_VAR_END } from './lib/registry-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const google = (over = {}, fontOver = {}, metaOver = {}) => ({
  name: 'font-sora', type: 'registry:font',
  font: { family: "'Sora Variable', sans-serif", provider: 'google', import: 'Sora', variable: '--font-sora-wf', subsets: ['latin'], weight: ['400', '600'], dependency: '@fontsource-variable/sora', ...fontOver },
  meta: { license: 'OFL-1.1', licenseUrl: 'https://github.com/google/fonts/blob/main/ofl/sora/OFL.txt', role: ['display'], korean: false, ...metaOver },
  ...over,
})
const rules = (ps) => ps.map((p) => p.split(':')[0])

test('a well-formed Google font item has no problems', () => {
  assert.deepEqual(fontProblems([google()]), [])
})

test('provider must be google (shadcn registry:font supports only google — spike fact 4)', () => {
  assert.ok(rules(fontProblems([google({}, { provider: 'fontshare' })])).includes('provider'))
})

test('weight: at most 4, each one the family actually has; a static family must list weights', () => {
  assert.ok(rules(fontProblems([google({}, { weight: ['300', '400', '500', '600', '700'] })])).includes('weight'))
  assert.ok(rules(fontProblems([google({}, { weight: ['950'] })])).includes('weight'))
  const staticNoWeight = google({ name: 'font-ibm-plex-mono' }, { family: "'IBM Plex Mono', monospace", import: 'IBM_Plex_Mono', variable: '--font-ibm-plex-mono-wf', weight: undefined, dependency: '@fontsource/ibm-plex-mono' })
  assert.ok(rules(fontProblems([staticNoWeight])).includes('weight'))
})

test('licence: meta.license and an https meta.licenseUrl are required (DESIGN §14-D)', () => {
  assert.ok(rules(fontProblems([google({}, {}, { licenseUrl: undefined })])).includes('license'))
  assert.ok(rules(fontProblems([google({}, {}, { licenseUrl: 'fonts.google.com' })])).includes('license'))
  assert.ok(rules(fontProblems([google({}, {}, { license: '' })])).includes('license'))
})

test('names: unique, font-<slug>, variable = --font-<slug>-wf (fontVar), import = next/font/google name of the family', () => {
  assert.ok(rules(fontProblems([google(), google()])).includes('name'))
  assert.ok(rules(fontProblems([google({ name: 'sora' })])).includes('name'))
  assert.ok(rules(fontProblems([google({}, { variable: '--font-sans' })])).includes('variable'))
  assert.ok(rules(fontProblems([google({}, { import: 'Sora_Sans' })])).includes('import'))
  assert.ok(rules(fontProblems([google({}, { subsets: ['korean'] })])).includes('subsets'))
  // 다른 층 항목 이름과 겹치면 안 된다(전역 유일).
  assert.ok(rules(fontProblems([google()], { knownItems: new Set(['font-sora']) })).includes('name'))
})

// Task 3 컨트롤러 판정: 서체 정체성 별칭(meta.aliasOf, Pretendard GOV ↔ Pretendard 같은 메트릭 호환 변형)은 데이터로 적고,
// gen-fonts 가 대상이 키트에 있는지·자기 참조가 아닌지 본다. canonicalItem 은 그 별칭을 따라간다(recipe.mjs faceNames 는 안 쓴다 — T4 참고).
test('aliasOf: must point at a real, different kit item; canonicalItem follows it', () => {
  const a = google({ name: 'font-a' }, { variable: '--font-a-wf', dependency: '@fontsource-variable/a' })
  const b = google({ name: 'font-b' }, { variable: '--font-b-wf', dependency: '@fontsource-variable/b' }, { aliasOf: 'font-a' })
  assert.deepEqual(fontProblems([a, b]), [])
  assert.equal(canonicalItem('font-b', [a, b]), 'font-a')
  assert.equal(canonicalItem('font-a', [a, b]), 'font-a')
  assert.equal(canonicalItem('font-unknown', [a, b]), 'font-unknown')
  const selfRef = google({ name: 'font-c' }, { variable: '--font-c-wf', dependency: '@fontsource-variable/c' }, { aliasOf: 'font-c' })
  assert.ok(rules(fontProblems([selfRef])).includes('aliasOf'))
  const missing = google({ name: 'font-d' }, { variable: '--font-d-wf', dependency: '@fontsource-variable/d' }, { aliasOf: 'font-nope' })
  assert.ok(rules(fontProblems([missing])).includes('aliasOf'))
  // 실제 키트: font-pretendard-gov 가 font-pretendard 를 가리키고, 스스로는 캐시된 별칭 지도로 정규화된다.
  assert.equal(canonicalItem('font-pretendard-gov'), 'font-pretendard')
  assert.equal(canonicalItem('font-pretendard'), 'font-pretendard')
})

test('a non-Google item (Pretendard path) must still carry a licence and something to install', () => {
  const ok = { name: 'font-x', type: 'registry:item', css: { '@import "x/x.css"': {} }, dependencies: ['x'], cssVars: { theme: { 'font-x-wf': '"X"' } }, meta: { license: 'OFL-1.1', licenseUrl: 'https://example.org/LICENSE', family: 'X', role: ['body'], korean: true } }
  assert.deepEqual(fontProblems([ok]), [])
  assert.ok(rules(fontProblems([{ ...ok, css: undefined, files: undefined }])).includes('payload'))
  assert.ok(rules(fontProblems([{ ...ok, meta: { ...ok.meta, licenseUrl: undefined } }])).includes('license'))
  // 레시피가 var(--font-x-wf, …)로 읽으니 css 항목도 그 변수를 준다.
  assert.ok(rules(fontProblems([{ ...ok, cssVars: { theme: { 'font-x': '"X"' } } }])).includes('variable'))
  // npm 의존은 원천에 이름만, 고정은 생성기가 package.json 범위로(M7) — 손으로 적은 범위는 문제다.
  assert.ok(rules(fontProblems([{ ...ok, dependencies: ['x@^1'] }])).includes('dependencies'))
  assert.deepEqual(fontRegistry([ok], { x: '^1.2.3' })[0].dependencies, ['x@^1.2.3'])
  const pretendard = fontRegistry(loadSources()).find((i) => i.name === 'font-pretendard')
  const pkg = JSON.parse(readFileSync(join(FONTS_DIR, '..', '..', '..', 'package.json'), 'utf8'))
  assert.deepEqual(pretendard.dependencies, [`pretendard@${pkg.dependencies.pretendard}`])
})

// Task 10c: Google 밖 서체를 1차 CDN 에서 싣는 css 항목 — @import url(스타일시트) 또는 fontFace(파일만 있을 때 — Task 15 부터 registry:file CSS).
// GitHub 파일은 jsDelivr gh/<owner>/<repo>@<커밋 sha> 로만(브랜치·태그·@latest 는 내용이 바뀐다), npm 은 정확한 버전으로.
const cdnItem = (over = {}, metaOver = {}) => ({
  name: 'font-x', type: 'registry:item',
  fontFace: { 'font-family': '"X Sans"', src: 'url("https://cdn.jsdelivr.net/gh/o/r@0123456789abcdef0123456789abcdef01234567/X.woff2") format("woff2")', 'font-weight': '400', 'font-display': 'swap' },
  cssVars: { theme: { 'font-x-wf': '"X Sans"' } },
  meta: { license: 'OFL-1.1', licenseUrl: 'https://example.org/LICENSE', source: 'https://github.com/o/r/tree/0123456789abcdef0123456789abcdef01234567', family: 'X Sans', weight: ['400'], role: ['display'], korean: true, ...metaOver },
  ...over,
})
test('a css kit item for a non-Google font validates: @font-face with a sha-pinned jsDelivr URL, or @import url() of a first-party stylesheet', () => {
  assert.deepEqual(fontProblems([cdnItem()]), [])
  const sheet = cdnItem({ fontFace: undefined, css: { '@import url("https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css")': {} } }, { source: 'https://hangeul.naver.com/font' })
  assert.deepEqual(fontProblems([sheet]), [])
  const npm = cdnItem({ fontFace: undefined, css: { '@import url("https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/galmuri.css")': {} } }, { source: 'https://github.com/quiple/galmuri' })
  assert.deepEqual(fontProblems([npm]), [])
  // 실제 키트의 css 항목 11종(Task 15m 이 파일만 있는 한글 4종을 더했다)이 모두 이 모양이다.
  const cdn = loadSources().filter((i) => i.type === 'registry:item' && !i.dependencies)
  assert.deepEqual(cdn.map((i) => i.name).sort(), ['font-bm-euljiro', 'font-cafe24-oneprettynight', 'font-cafe24-shiningstar', 'font-galmuri11', 'font-hakgyoansim-dunggeunmiso', 'font-maru-buri', 'font-nanum-square-round', 'font-natural-sans', 'font-pyeojin-gothic', 'font-seocho-batang', 'font-yangjin'])
  assert.deepEqual(fontProblems(cdn), [])
})

test('css kit item URLs: https only, jsDelivr gh pinned to a 40-hex commit recorded in meta.source, npm to an exact version, never @latest', () => {
  const at = (url, metaOver) => rules(fontProblems([cdnItem({ fontFace: undefined, css: { [`@import url("${url}")`]: {} } }, metaOver)]))
  for (const ref of ['main', '1.0', 'v1.0', 'latest', '0123456']) assert.ok(at(`https://cdn.jsdelivr.net/gh/o/r@${ref}/x.css`).includes('pin'), ref)
  assert.ok(at('https://cdn.jsdelivr.net/gh/o/r/x.css').includes('pin'), 'ref 없음 = 기본 브랜치')
  assert.ok(at('https://cdn.jsdelivr.net/npm/galmuri@2/dist/galmuri.css').includes('pin'))
  assert.ok(at('https://cdn.jsdelivr.net/npm/galmuri@latest/dist/galmuri.css').includes('pin'))
  assert.ok(at('https://cdn.jsdelivr.net/npm/galmuri/dist/galmuri.css').includes('pin'))
  assert.ok(at('http://example.org/x.css').includes('url'))
  // 커밋은 meta.source 에도 적는다(어느 커밋을 검토했는지 항목만 보고 알 수 있게).
  assert.ok(at('https://cdn.jsdelivr.net/gh/o/r@fedcba9876543210fedcba9876543210fedcba98/x.css').includes('pin'))
  assert.deepEqual(at('https://cdn.jsdelivr.net/gh/o/r@fedcba9876543210fedcba9876543210fedcba98/x.css', { source: 'https://github.com/o/r/tree/fedcba9876543210fedcba9876543210fedcba98' }), [])
})

test('css kit item: @font-face family = meta.family, and meta.weight (optional) lists real weights', () => {
  const face = cdnItem()
  assert.ok(rules(fontProblems([{ ...face, fontFace: { ...face.fontFace, 'font-family': '"Y Sans"' } }])).includes('family'))
  assert.ok(rules(fontProblems([cdnItem({}, { weight: [] })])).includes('weight'))
  assert.ok(rules(fontProblems([cdnItem({}, { weight: ['regular'] })])).includes('weight'))
  assert.ok(rules(fontProblems([cdnItem({}, { weight: '400' })])).includes('weight'))
  // 면이 하나(400)인데 meta.weight 가 둘이면 어긋남(fix 1 — 면 굵기 = meta.weight). 면이 둘이면 통과.
  assert.ok(rules(fontProblems([cdnItem({}, { weight: ['400', '700'] })])).includes('weight'))
  const f400 = cdnItem().fontFace
  assert.deepEqual(fontProblems([cdnItem({ fontFace: [f400, { ...f400, 'font-weight': '700' }] }, { weight: ['400', '700'] })]), [])
  // @import url 항목(면이 CSS 안에 있다)은 meta.weight 만 본다.
  assert.deepEqual(fontProblems([cdnItem({ fontFace: undefined, css: { '@import url("https://hangeul.pstatic.net/x.css")': {} } }, { weight: ['400', '700'], source: 'https://hangeul.naver.com/font' })]), [])
})

// ── Task 10c fix 1 ─────────────────────────────────────────────────────
test('M7: raw GitHub and unpkg URLs are pinned too (commit sha · exact version); the unversioned first-party pstatic stylesheet stays allowed', () => {
  const SHA = 'fedcba9876543210fedcba9876543210fedcba98'
  const at = (url, metaOver) => rules(fontProblems([cdnItem({ fontFace: undefined, css: { [`@import url("${url}")`]: {} } }, metaOver)]))
  for (const u of ['https://raw.githubusercontent.com/o/r/main/x.css', 'https://raw.githubusercontent.com/o/r/v1.0/x.css', 'https://github.com/o/r/raw/main/x.css', 'https://github.com/o/r/raw/refs/heads/main/x.css',
    'https://unpkg.com/galmuri/dist/galmuri.css', 'https://unpkg.com/galmuri@2/dist/galmuri.css', 'https://unpkg.com/galmuri@latest/dist/galmuri.css'])
    assert.ok(at(u).includes('pin'), u)
  const src = { source: `https://github.com/o/r/tree/${SHA}` }
  assert.deepEqual(at(`https://raw.githubusercontent.com/o/r/${SHA}/x.css`, src), [])
  assert.deepEqual(at(`https://github.com/o/r/raw/${SHA}/x.css`, src), [])
  assert.ok(at(`https://raw.githubusercontent.com/o/r/${SHA}/x.css`).includes('pin'), 'sha 를 meta.source 에 안 적으면')
  assert.deepEqual(at('https://unpkg.com/galmuri@2.40.3/dist/galmuri.css'), [])
  assert.deepEqual(at('https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css'), []) // 1차 배포처 — 고정할 버전이 없다(허용)
})

test('M6: a css-kit font variable is face names only — a trailing generic family is a problem (it would skip the recipe body/ko fallback)', () => {
  for (const g of ['sans-serif', 'serif', 'monospace', ' Serif '])
    assert.ok(rules(fontProblems([cdnItem({ cssVars: { theme: { 'font-x-wf': `"X Sans", ${g}` } } })])).includes('variable-generic'), g)
  assert.deepEqual(fontProblems([cdnItem()]), [])
  // 실제 키트: css 항목의 변수 13개(Task 15m 이 파일만 있는 한글 4종을 더했다) 모두 일반형 없이.
  const css = loadSources().filter((i) => i.type === 'registry:item')
  assert.equal(css.length, 13)
  for (const i of css) for (const v of Object.values(i.cssVars.theme)) assert.doesNotMatch(v, /(^|,\s*)(sans-serif|serif|monospace)\s*$/, i.name)
})

test('I3: PyeojinGothic ships Light 300 · Regular 400 · Bold 700 from one pinned commit; face weights must equal meta.weight', () => {
  const p = loadSources().find((i) => i.name === 'font-pyeojin-gothic')
  const faces = p.fontFace
  assert.deepEqual(faces.map((f) => [f['font-weight'], f.src.match(/PyeojinGothic-(\w+)\.woff2/)[1]]), [['300', 'Light'], ['400', 'Regular'], ['700', 'Bold']])
  assert.equal(new Set(faces.map((f) => f.src.match(/@([0-9a-f]{40})\//)[1])).size, 1)
  assert.deepEqual(p.meta.weight, ['300', '400', '700'])
  assert.deepEqual(fontProblems([p]), [])
  // 음성 대조: meta.weight 와 면 굵기가 어긋나면 잡힌다(예전 모양 — Light 파일을 400 으로, meta.weight ["400"] 한 개 — 는 면 굵기로는 못 잡는다: 파일 이름은 데이터가 아니다).
  assert.ok(rules(fontProblems([{ ...p, meta: { ...p.meta, weight: ['400'] } }])).includes('weight'))
  assert.ok(rules(fontProblems([{ ...p, fontFace: [...faces, { ...faces[0], 'font-family': '"Other"' }] }])).includes('family'))
})

// ── Task 15 — M8: shadcn 4.21 css 필드는 @font-face 를 쓰지 못한다(add 실패 또는 속성 없는 면) ─────────
// 면은 원천 fontFace 에 두고, 생성기가 registry:file CSS(faces/<slug>.css → 소비자 styles/wf-fonts/<slug>.css)와 그 @import 로 싣는다.
// Task 15m(2026-09-29) 이 양진체·학교안심 둥근미소·카페24 고운밤·카페24 빛나는별을 더했다.
const FACE_ITEMS = ['font-bm-euljiro', 'font-cafe24-oneprettynight', 'font-cafe24-shiningstar', 'font-hakgyoansim-dunggeunmiso', 'font-natural-sans', 'font-pyeojin-gothic', 'font-seocho-batang', 'font-yangjin']
const postcss = createRequire(import.meta.url)('postcss')

test('M8: an item with @font-face in its css field is refused — whatever the shape (object, array, registry:font too)', () => {
  const face = cdnItem().fontFace
  for (const css of [{ '@font-face': face }, { '@font-face': [face, { ...face, 'font-weight': '700' }] }, { '@font-face ': face }]) {
    const bad = cdnItem({ fontFace: undefined, css })
    assert.ok(rules(fontProblems([bad])).includes('font-face-css'), JSON.stringify(Object.keys(css)))
  }
  assert.ok(rules(fontProblems([google({ css: { '@font-face': face } })])).includes('font-face-css'))
  // BASE(64fa2bb) 모양 그대로 — 원천 css 에 @font-face 를 둔 서초바탕 — 도 막힌다(되돌아오지 못하게).
  const seocho = loadSources().find((i) => i.name === 'font-seocho-batang')
  const { fontFace, ...rest } = seocho
  assert.ok(rules(fontProblems([{ ...rest, css: { '@font-face': fontFace } }])).includes('font-face-css'))
  // @import 만 있는 css 는 통과한다.
  assert.deepEqual(fontProblems([cdnItem()]), [])
})

test('M8: fontFace is validated — non-empty src/font-family/font-display, https woff/woff2 src, known properties, no hand-written files', () => {
  const f = cdnItem().fontFace
  const bad = (face) => rules(fontProblems([cdnItem({ fontFace: face })]))
  assert.ok(bad([]).includes('font-face'))
  assert.ok(bad({ ...f, src: '' }).includes('font-face'))
  assert.ok(bad({ ...f, 'font-display': undefined }).includes('font-face'))
  assert.ok(bad({ ...f, src: 'local("X")' }).includes('font-face'))
  assert.ok(bad({ ...f, color: 'red' }).includes('font-face'))
  assert.ok(rules(fontProblems([cdnItem({ files: [{ path: 'x.css', type: 'registry:file', target: 'x.css' }] })])).includes('font-face'))
})

test('M8: the 4 file-only faces ship as a registry:file CSS at a stable consumer path, loaded by a css @import; no @font-face left in css', () => {
  const src = loadSources()
  assert.deepEqual(src.filter((i) => i.fontFace !== undefined).map((i) => i.name).sort(), FACE_ITEMS)
  const reg = fontRegistry(src)
  for (const i of reg) assert.ok(!Object.keys(i.css ?? {}).some((k) => /@font-face/i.test(k)), `${i.name}: css 에 @font-face`)
  for (const name of FACE_ITEMS) {
    const i = reg.find((x) => x.name === name), slug = name.replace(/^font-/, '')
    assert.equal(i.fontFace, undefined, name)
    assert.deepEqual(i.files, [{ path: `faces/${slug}.css`, type: 'registry:file', target: `styles/wf-fonts/${slug}.css` }], name)
    assert.deepEqual(Object.keys(i.css), [`@import "../styles/wf-fonts/${slug}.css"`], name)
    // shadcn add 가 파일을 까는 자리(installPath — shadcn `ar` 사본)와 @import 가 가리키는 자리가 같다: 전역 CSS 가 app/·src/app/·styles/ 어디든.
    const target = installPath(i.files[0]), spec = Object.keys(i.css)[0].match(/"([^"]+)"/)[1]
    assert.equal(posix.join('app', spec), target, name)
    assert.equal(posix.join('styles', spec), target, name)
    assert.equal(posix.join('src/app', spec), `src/${target}`, name)
    // 변수는 그대로(--font-<slug>-wf).
    assert.ok(Object.keys(i.cssVars.theme).includes(`${name}-wf`), name)
    // 라이선스 표가 항목을 덮는다.
    assert.match(readFileSync(join(root, 'docs', 'qa', 'font-licenses.md'), 'utf8'), new RegExp('`' + name + '`'), name)
  }
})

test('M8: each shipped face CSS parses; every @font-face keeps the pinned src, family, weight and font-display of its source; committed files = generator output', () => {
  const src = loadSources(), want = faceFiles(src)
  assert.deepEqual(Object.keys(want).sort(), FACE_ITEMS.map((n) => `${n.replace(/^font-/, '')}.css`))
  assert.deepEqual(readdirSync(FACES_DIR).sort(), Object.keys(want).sort(), 'faces/ 에 생성물 밖 파일이 없다')
  for (const [f, css] of Object.entries(want)) {
    assert.equal(readFileSync(join(FACES_DIR, f), 'utf8'), css, `${f}: 커밋 = 생성기 출력`)
    const item = src.find((i) => i.name === `font-${f.replace(/\.css$/, '')}`)
    const rulesIn = []
    postcss.parse(css).walkAtRules('font-face', (r) => rulesIn.push(Object.fromEntries(r.nodes.filter((n) => n.type === 'decl').map((d) => [d.prop, d.value]))))
    assert.deepEqual(rulesIn, faces(item), f)
    for (const r of rulesIn) {
      assert.ok(r['font-family']?.trim() && r.src?.trim(), `${f}: 빈 font-family·src`)
      assert.match(r.src, /^url\("https:\/\/cdn\.jsdelivr\.net\/gh\/[^@]+@[0-9a-f]{40}\//, f)
    }
  }
  // 음성 대조: 예전 css 필드 모양을 shadcn 이 깨뜨린 결과(빈 면)는 이 검사에 걸린다.
  const broken = []
  postcss.parse('@font-face {\n}\n').walkAtRules('font-face', (r) => broken.push(r.nodes.length))
  assert.deepEqual(broken, [0])
})

// Song Myung: next/font 데이터에 subsets 가 0개다 — next/font 가 그때만 preload 를 스스로 끈다(validate-google-font-function-call.js).
// 그래서 항목은 subsets 를 비운다(shadcn 은 비면 옵션을 쓰지 않는다). 적으면 next/font 가 「Unknown subset」으로 멈춘다.
test('a Google family with no next/font subsets (Song Myung) leaves subsets out; listing any is a problem', () => {
  const sm = google({ name: 'font-song-myung' }, { family: "'Song Myung', serif", import: 'Song_Myung', variable: '--font-song-myung-wf', weight: ['400'], subsets: undefined, dependency: '@fontsource/song-myung' }, { korean: true })
  assert.deepEqual(fontProblems([sm]), [])
  assert.ok(rules(fontProblems([{ ...sm, font: { ...sm.font, subsets: ['latin'] } }])).includes('subsets'))
  // 다른 서체는 여전히 subsets 가 있어야 한다.
  assert.ok(rules(fontProblems([google({}, { subsets: undefined })])).includes('subsets'))
})

// 소비자 빌드 대리 검사(Task 10c): 갤러리는 레시피가 쓰는 서체만 next/font 로 컴파일한다 — 아직 아무 레시피도 안 쓰는 키트 서체는
// npm run build 가 부르지 않는다. 그래서 shadcn 이 소비자 layout 에 쓰는 호출 인자(subsets·weight 는 비면 빼고, variable — shadcn ih())를
// next/font 자신의 검사 함수에 그대로 넣어 본다. 여기서 던지면 소비자 next build 가 같은 문장으로 멈춘다.
test('every kit registry:font call, as shadcn writes it, passes next/font validation (consumer build proxy)', () => {
  const { validateGoogleFontFunctionCall } = createRequire(import.meta.url)('next/dist/compiled/@next/font/dist/google/validate-google-font-function-call.js')
  const google = loadSources().filter((i) => i.type === 'registry:font')
  assert.ok(google.length >= 49, `Google 항목 ${google.length}개`)
  for (const i of google) {
    const args = { ...(i.font.subsets?.length ? { subsets: i.font.subsets } : {}), ...(i.font.weight?.length ? { weight: i.font.weight } : {}), variable: i.font.variable }
    assert.doesNotThrow(() => validateGoogleFontFunctionCall(i.font.import, args), i.name)
  }
  // 음성 대조: subsets 가 있는 서체에서 subsets 를 빼면 next/font 가 멈춘다(preload 기본값).
  assert.throws(() => validateGoogleFontFunctionCall('Do_Hyeon', { weight: ['400'], variable: '--x' }), /no subsets/)
})

// T9-c2: shadcn 은 layout.tsx 의 next/font 선언을 변수 이름의 부분 문자열로 찾는다. 한 변수가 다른 변수에 들어 있으면
// 두 번째 add 에서 선언이 겹쳐(「defined multiple times」) 소비자 빌드가 깨진다.
test('no kit font variable is a substring of another one or of the shadcn defaults (T9-c2)', () => {
  const latin = google({ name: 'font-ibm-plex-sans' }, { family: "'IBM Plex Sans', sans-serif", import: 'IBM_Plex_Sans', variable: '--font-ibm-plex-sans', weight: ['400'], dependency: '@fontsource/ibm-plex-sans' })
  const kr = google({ name: 'font-ibm-plex-sans-kr' }, { family: "'IBM Plex Sans KR', sans-serif", import: 'IBM_Plex_Sans_KR', variable: '--font-ibm-plex-sans-kr', weight: ['400'], dependency: '@fontsource/ibm-plex-sans-kr' })
  assert.ok(variableOverlaps([latin, kr]).some((m) => m.startsWith('variable-overlap: font-ibm-plex-sans —')))
  // 종결자를 달면 겹치지 않는다.
  const end = (i) => ({ ...i, font: { ...i.font, variable: fontVar(i.name) } })
  assert.deepEqual(variableOverlaps([end(latin), end(kr)]), [])
  // shadcn init 이 넣는 기본 변수와도 겹치면 안 된다.
  const sans = google({}, { variable: '--font-sans-x-wf' })
  assert.ok(variableOverlaps([sans]).some((m) => m.includes('shadcn 기본 --font-sans')))
  // 실제 키트: 겹침 0.
  assert.deepEqual(variableOverlaps(loadSources()), [])
  assert.ok(loadSources().filter((i) => i.type === 'registry:font').every((i) => i.font.variable.endsWith(FONT_VAR_END)))
})

test('the committed kit sources pass, and the generated registry.json is exactly fontRegistry()', () => {
  const items = loadSources()
  assert.deepEqual(fontProblems(items), [])
  const committed = JSON.parse(readFileSync(join(FONTS_DIR, 'registry.json'), 'utf8'))
  assert.deepEqual(committed.items, fontRegistry(items))
  assert.deepEqual(committed.items.map((i) => i.name), [...committed.items.map((i) => i.name)].sort())
})

test('every font item r1-measure references is in the kit (zero missing)', () => {
  const r1 = parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', 'r1-measure', 'DESIGN.md'), 'utf8'))
  const names = new Set(loadSources().map((i) => i.name))
  const refs = ['display', 'body', 'mono'].map((k) => r1.fonts[k]?.item).filter(Boolean)
  assert.deepEqual(refs.filter((n) => !names.has(n)), [])
})

test('korean-fonts.json is aligned with the kit (T6r1-c3)', () => {
  const items = loadSources(), list = loadKoreanList()
  assert.deepEqual(koreanListProblems(items, list), [])
  // 키트의 한글 서체는 목록에 있다 — 음성 대조: 목록에서 하나 빼면 잡힌다.
  const drop = { ...list, families: list.families.filter((f) => f.item !== 'font-ibm-plex-sans-kr') }
  assert.ok(koreanListProblems(items, drop).some((p) => p.includes('font-ibm-plex-sans-kr')))
  // 키트가 못 주는 서체를 external 없이 적으면 잡힌다.
  const orphan = { ...list, families: [...list.families, { family: 'Imaginary KR' }] }
  assert.ok(koreanListProblems(items, orphan).some((p) => p.includes('Imaginary KR')))
  // external 에는 이유가 있어야 한다.
  const noReason = { ...list, families: [...list.families, { family: 'Imaginary KR', external: true }] }
  assert.ok(koreanListProblems(items, noReason).some((p) => p.includes('Imaginary KR')))
  for (const i of items.filter((x) => x.meta.korean)) assert.ok(isKorean(familyOf(i)), i.name)
})

// T5-c6 / T7-M8: 고정폭 스택은 한글 폴백 앞에 실제 고정폭 서체가 있고, 한글 폴백도 있다 — 서체 항목이 없는 Windows 소비자도 고정폭 숫자·한글을 받는다.
const MONO_FACES = ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'IBM Plex Mono']
const names = (s) => s.split(',').map((x) => x.trim().replace(/^var\(--font-[a-z0-9-]+,\s*/, '').replace(/[")]/g, '').trim())
function checkMono(stack, label) {
  // 고정폭 항목 var() 의 기본값 안(항목이 없을 때 실제로 쓰이는 목록)과 스택 전체, 둘 다. 한글 항목 var() 는 그 자체가 한글 폴백이다.
  const lists = [...[...stack.matchAll(/var\(--font-ibm-plex-mono-wf, ([^)]+)\)/g)].map((m) => m[1]), stack]
  for (const l of lists) {
    const ns = names(l)
    const ko = ns.findIndex(isKorean)
    const mono = ns.findIndex((n) => MONO_FACES.includes(n) && n !== 'IBM Plex Mono')
    if (ko === -1) continue // 한글 폴백은 스택 전체 기준으로 아래에서 본다
    assert.ok(mono !== -1 && mono < ko, `${label}: 한글(${ns[ko]}) 앞에 시스템 고정폭 서체가 없다 — ${l}`)
  }
  assert.ok(names(stack).some(isKorean), `${label}: 한글 폴백이 없다 — ${stack}`)
  assert.ok(names(stack).includes('Consolas'), `${label}: Windows 고정폭(Consolas)이 없다 — ${stack}`)
}

test('mono stacks: a real system mono face precedes the Korean fallback, with and without a mono item (T5-c6·T7-M8)', () => {
  const body = { family: 'IBM Plex Sans KR', item: 'font-ibm-plex-sans-kr' }
  const display = { family: 'IBM Plex Sans', item: 'font-ibm-plex-sans' }
  const mono = { family: 'IBM Plex Mono', item: 'font-ibm-plex-mono' }
  for (const [label, fonts] of [['with mono', { display, body, mono }], ['mono null', { display, body, mono: null }], ['no mono key', { display, body }]]) {
    checkMono(fontStacks(fonts)['font-mono'], label)
    checkMono(fontStacks(fonts, { plain: true })['font-mono'], `${label} plain`)
  }
  // r1 그대로.
  const r1 = parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', 'r1-measure', 'DESIGN.md'), 'utf8'))
  checkMono(fontStacks(r1.fonts)['font-mono'], 'r1')
  checkMono(fontStacks(r1.fonts, { plain: true })['font-mono'], 'r1 plain')
})
