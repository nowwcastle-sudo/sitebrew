// Task 9 모션·아이콘 키트. 실행: node --test --test-force-exit --test-timeout=60000 "factory/scripts/*.test.mjs"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { motionItems, iconItems, iconAdapter, iconVars, ICON_GRAIN, phosphorVariant, LIBRARIES, PHOSPHOR_WEIGHTS, MOTION_DIR, ICONS_DIR, MOTION_TOKENS, motionVars } from './gen-kits.mjs'
import { compileSource, iconImports } from './compile-styles.mjs'
import { parseImports, ICON_LIBRARIES } from './lib/registry-lib.mjs'
import { RecipeHead, parseRecipe, recipeItems, knownRegistryItems } from './recipe.mjs'
import { iconLabelProblems, lintSrcDir } from '../qa/lint-ui.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'kits-test')

// 브리프의 정본 이름 40개(순서 그대로). 부품이 더 쓰는 이름 7개는 EXTRA.
const BRIEF = ['Search', 'Menu', 'X', 'Check', 'ChevronDown', 'ChevronRight', 'ArrowRight', 'Calendar', 'Clock', 'MapPin', 'Phone', 'Mail', 'User',
  'Settings', 'Plus', 'Minus', 'Trash', 'Edit', 'Copy', 'ExternalLink', 'Info', 'AlertTriangle', 'AlertCircle', 'CheckCircle', 'Filter', 'SortAsc',
  'Download', 'Upload', 'Eye', 'EyeOff', 'Lock', 'Home', 'ShoppingCart', 'Heart', 'Star', 'Share', 'Image', 'File', 'Bell', 'LogOut']
const EXTRA = ['ChevronUp', 'ChevronLeft', 'MoreHorizontal', 'ArrowDown', 'PanelLeft', 'LoaderCircle', 'XOctagon']

// TSX/TS → .tmp/kits-test/<이름>.mjs (저장소 안이라 bare import 가 node_modules 로 풀린다). 상대 import 는 .mjs 로.
function transpile(file, name) {
  mkdirSync(OUT, { recursive: true })
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  })
  const out = join(OUT, `${name}.mjs`)
  writeFileSync(out, outputText.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"'))
  return import(pathToFileURL(out).href)
}
const adapterFiles = () => [...LIBRARIES.map((l) => `${l}.ts`), ...PHOSPHOR_WEIGHTS.map((w) => `phosphor-${w}.ts`)]
const loadAdapters = async () => Object.fromEntries(await Promise.all(adapterFiles().map(async (f) => [f, await transpile(join(ICONS_DIR, f), f.replace(/\.ts$/, ''))])))

// ① 모션 ────────────────────────────────────────────────────────────────
test('motion.css: the three preset keyframes exist and every one is switched off (animation: none) in the reduced-motion block', () => {
  const css = readFileSync(join(MOTION_DIR, 'motion.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])
  assert.deepEqual(keyframes.sort(), ['wf-breathe', 'wf-fade-rise', 'wf-sheet-in'])
  const block = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}\s*$/)
  assert.ok(block, 'reduced-motion 블록이 파일 끝에 있다')
  // 이 키프레임을 쓰는 모든 클래스(animation: <이름> …)가 블록 안에서 animation: none 이다.
  const users = [...css.matchAll(/(\.[\w-]+)\s*\{\s*animation:\s*([\w-]+)\s/g)].map((m) => [m[1], m[2]])
  assert.deepEqual(users.map(([, k]) => k).sort(), keyframes.sort(), '프리셋마다 클래스 하나')
  for (const [cls] of users) assert.match(block[1], new RegExp(`\\${cls}\\s*\\{\\s*animation:\\s*none;?\\s*\\}`), `${cls} 가 reduced-motion 에서 꺼지지 않는다`)
})

test('motion-core item: easing and duration tokens are the brief values in cssVars.theme; css carries keyframes + reduced-motion; three registry:hook items (use-recipe-motion — P3-2)', () => {
  const [core, ...rest] = motionItems({ ref: 'v9.9.9', versions: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies })
  const hooks = rest.filter((it) => it.type === 'registry:hook')
  assert.equal(core.name, 'motion-core')
  assert.equal(core.type, 'registry:item')
  const norm = (v) => v.replace(/\s+/g, '')
  assert.deepEqual(Object.fromEntries(Object.entries(core.cssVars.theme).map(([k, v]) => [k, norm(v)])), {
    'ease-standard': 'cubic-bezier(0.23,1,0.32,1)', 'ease-emphasized': 'cubic-bezier(0.2,0,0,1)', 'ease-in-screen': 'cubic-bezier(0.77,0,0.175,1)',
    'ease-exit': 'cubic-bezier(0.4,0,1,1)', 'ease-sheet': 'cubic-bezier(0.32,0.72,0,1)',
    'duration-press': '120ms', 'duration-hover': '200ms', 'duration-popover': '160ms', 'duration-enter': '500ms', 'duration-sheet': '320ms',
  })
  for (const k of ['wf-fade-rise', 'wf-sheet-in', 'wf-breathe']) {
    assert.ok(core.css[`@keyframes ${k}`], k)
    assert.equal(core.css['@media (prefers-reduced-motion: reduce)'][`.${k}`].animation, 'none')
  }
  assert.deepEqual(hooks.map((h) => [h.name, h.type]), [['use-pause-offscreen', 'registry:hook'], ['use-recipe-motion', 'registry:hook'], ['use-reduced-motion', 'registry:hook']])
  assert.deepEqual(core.registryDependencies, hooks.map((h) => `nowwcastle-sudo/sitebrew/${h.name}#v9.9.9`))
})

// 훅을 최소 가짜 React(useState·useEffect·useSyncExternalStore)와 가짜 DOM(IntersectionObserver·document·matchMedia) 위에서 돌린다 — 새 의존 없이.
const REACT_STUB = `
export const log = { states: [], cleanup: null, subscribed: 0 }
export function useState(init) { return [init, (v) => log.states.push(v)] }
export function useEffect(fn) { log.cleanup = fn() ?? null }
export function useSyncExternalStore(subscribe, get, server) {
  log.unsubscribe = subscribe(() => log.states.push(get()))
  log.server = server()
  return get()
}
`
async function loadHook(file) {
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'react-stub.mjs'), REACT_STUB)
  const { outputText } = ts.transpileModule(readFileSync(join(MOTION_DIR, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  const out = join(OUT, `${file.replace(/\.ts$/, '')}-${Date.now()}.mjs`)
  writeFileSync(out, outputText.replace(/from "react"/g, 'from "./react-stub.mjs"'))
  const stub = await import(pathToFileURL(join(OUT, 'react-stub.mjs')).href)
  stub.log.states = []; stub.log.cleanup = null
  return { mod: await import(pathToFileURL(out).href), log: stub.log }
}

test('use-pause-offscreen (behaviour, mock DOM): pauses offscreen, pauses when the tab hides, resumes, and removes its observer, listener and mark on unmount', async (t) => {
  const listeners = new Map()
  const observers = []
  const saved = { document: globalThis.document, IntersectionObserver: globalThis.IntersectionObserver }
  t.after(() => Object.assign(globalThis, saved))
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn)),
  }
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; this.targets = []; this.disconnected = false; observers.push(this) }
    observe(el) { this.targets.push(el) }
    disconnect() { this.disconnected = true }
  }
  const attrs = new Set()
  const el = { toggleAttribute: (n, on) => (on ? attrs.add(n) : attrs.delete(n)), removeAttribute: (n) => attrs.delete(n) }
  const { mod, log } = await loadHook('use-pause-offscreen.ts')
  assert.equal(mod.usePauseOffscreen({ current: el }), false, '첫 렌더는 멈추지 않음')
  const io = observers.at(-1)
  assert.deepEqual(io.targets, [el])
  const fire = (visible) => { document.visibilityState = visible; for (const f of listeners.get('visibilitychange') ?? []) f() }
  const paused = () => attrs.has('data-paused')
  assert.equal(paused(), false)
  io.cb([{ isIntersecting: false }]); assert.equal(paused(), true, '화면 밖 → 멈춤')
  io.cb([{ isIntersecting: true }]); assert.equal(paused(), false, '돌아옴 → 다시 움직임')
  fire('hidden'); assert.equal(paused(), true, '탭 숨김 → 멈춤')
  io.cb([{ isIntersecting: false }]); fire('visible'); assert.equal(paused(), true, '탭이 보여도 화면 밖이면 멈춘 채')
  io.cb([{ isIntersecting: true }]); assert.equal(paused(), false, '둘 다 풀리면 움직임')
  assert.deepEqual(log.states, [false, true, false, true, true, true, false])
  assert.equal(listeners.get('visibilitychange').length, 1)
  fire('hidden'); assert.equal(paused(), true)
  log.cleanup()
  assert.equal(io.disconnected, true, '관찰 해제')
  assert.equal(listeners.get('visibilitychange').length, 0, '리스너 제거')
  assert.equal(paused(), false, '표지 제거')
  assert.match(readFileSync(join(MOTION_DIR, 'motion.css'), 'utf8'), /\[data-paused\]\s*\*\s*\{\s*animation-play-state:\s*paused/)
})

test('use-reduced-motion (behaviour, mock matchMedia): reads the query, re-renders on change, unsubscribes, server snapshot false', async (t) => {
  const saved = globalThis.window
  t.after(() => { globalThis.window = saved })
  const mql = { matches: false, fns: [], addEventListener: (e, f) => mql.fns.push(f), removeEventListener: (e, f) => { mql.fns = mql.fns.filter((x) => x !== f) } }
  const queries = []
  globalThis.window = { matchMedia: (q) => { queries.push(q); return mql } }
  const { mod, log } = await loadHook('use-reduced-motion.ts')
  assert.equal(mod.useReducedMotion(), false)
  assert.equal(log.server, false)
  assert.ok(queries.every((q) => q === '(prefers-reduced-motion: reduce)'))
  assert.equal(mql.fns.length, 1)
  mql.matches = true; mql.fns[0]()
  assert.deepEqual(log.states, [true])
  log.unsubscribe()
  assert.equal(mql.fns.length, 0)
})

// ② ③ Icon ──────────────────────────────────────────────────────────────
test('Icon: no label → aria-hidden="true" and the requested size; with a label → role="img" + aria-label, not hidden; colour is currentColor', async () => {
  const { Icon } = await transpile(join(ICONS_DIR, 'icon.tsx'), 'icon')
  const adapters = await loadAdapters()
  const plain = renderToStaticMarkup(createElement(Icon, { icon: adapters['lucide.ts'].Search, size: 16 }))
  assert.match(plain, /aria-hidden="true"/)
  assert.match(plain, /width="16"/)
  assert.match(plain, /height="16"/)
  assert.match(plain, /stroke="currentColor"/)
  assert.doesNotMatch(plain, /role="img"/)
  const named = renderToStaticMarkup(createElement(Icon, { icon: adapters['lucide.ts'].Search, size: 24, label: '검색' }))
  assert.match(named, /role="img"/)
  assert.match(named, /aria-label="검색"/)
  assert.doesNotMatch(named, /aria-hidden/)
  assert.match(named, /width="24"/)
  // 세 라이브러리 모두 같은 인터페이스(크기·색·aria).
  for (const f of adapterFiles()) {
    const html = renderToStaticMarkup(createElement(Icon, { icon: adapters[f].Search, size: 20 }))
    assert.match(html, /width="20"/, f)
    assert.match(html, /aria-hidden="true"/, f)
    assert.match(html, /currentColor/, f)
  }
  // 기본값 20.
  assert.match(renderToStaticMarkup(createElement(Icon, { icon: adapters['tabler.ts'].Bell })), /width="20"/)
})

// ④ IconButton label 타입 ──────────────────────────────────────────────
test('tsc: <IconButton icon={X} /> without label is a type error — the @ts-expect-error fixture compiles, and the same line without it fails with TS2741 (label)', () => {
  const fixture = join(root, 'factory', 'scripts', 'fixtures', 'icon-button')
  const neg = join(OUT, 'tsc-neg')
  rmSync(neg, { recursive: true, force: true })
  mkdirSync(neg, { recursive: true })
  const src = readFileSync(join(fixture, 'label-required.tsx'), 'utf8')
  writeFileSync(join(neg, 'label-required.tsx'), src)
  writeFileSync(join(neg, 'no-expect-error.tsx'), src.replace(/^\/\/ @ts-expect-error.*\r?\n/m, ''))
  assert.doesNotMatch(readFileSync(join(neg, 'no-expect-error.tsx'), 'utf8'), /^\/\/ @ts-expect-error/m, '음성 대조 파일에서 주석이 빠져야 한다(CRLF 에서도)')
  writeFileSync(join(neg, 'tsconfig.json'), JSON.stringify({ extends: '../../../tsconfig.json', compilerOptions: { incremental: false, noEmit: true, plugins: [] }, include: ['./*.tsx'], exclude: [] }))
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  const r = spawnSync(process.execPath, [tsc, '-p', join(neg, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8' })
  const errors = r.stdout.split('\n').filter((l) => /error TS\d+/.test(l))
  assert.notEqual(r.status, 0, '음성 대조가 통과하면 label 이 필수가 아니다')
  assert.equal(errors.length, 1, errors.join('\n'))
  assert.match(errors[0], /no-expect-error\.tsx.*TS2741.*'label'/)
  // 저장소 고정물 자체(@ts-expect-error 있음)는 오류 0.
  const ok = spawnSync(process.execPath, [tsc, '-p', join(fixture, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8' })
  assert.equal(ok.status, 0, ok.stdout + ok.stderr)
})

// ⑤ 어댑터 ───────────────────────────────────────────────────────────────
test('adapters: lucide, phosphor (+ weight copies) and tabler export the same key set = the 40 brief names + 7 names the parts use; every icon renders an svg', async () => {
  const adapters = await loadAdapters()
  const want = [...BRIEF, ...EXTRA].sort()
  for (const [f, mod] of Object.entries(adapters)) {
    assert.deepEqual(Object.keys(mod).sort(), want, f)
    for (const k of want) {
      // 부품이 이름 없이 그리는 아이콘은 장식 — 세 라이브러리 모두 aria-hidden(lucide-react 기본 동작과 같게), 이름을 주면 숨기지 않는다.
      assert.match(renderToStaticMarkup(createElement(mod[k], { size: 24 })), /^<svg[^>]*aria-hidden="true"[\s\S]*<\/svg>$/, `${f} ${k}`)
      assert.doesNotMatch(renderToStaticMarkup(createElement(mod[k], { 'aria-label': '이름' })), /aria-hidden/, `${f} ${k}`)
    }
  }
  // 기본 모양: lucide 어댑터는 lucide-react 의 그 컴포넌트를 그대로 다시 내보낸다(같은 SVG).
  const lucide = await import('lucide-react')
  assert.equal(adapters['lucide.ts'].X, lucide.XIcon)
  assert.equal(adapters['lucide.ts'].LoaderCircle, lucide.Loader2Icon)
  assert.equal(adapters['lucide.ts'].CheckCircle, lucide.CircleCheckIcon)
  assert.equal(adapters['lucide.ts'].AlertTriangle, lucide.TriangleAlertIcon)
  assert.equal(adapters['lucide.ts'].XOctagon, lucide.OctagonXIcon)
  assert.equal(adapters['lucide.ts'].MoreHorizontal, lucide.MoreHorizontalIcon)
  // 토스트 오류(XOctagon)는 세 라이브러리 모두 팔각형(정지 표지) 윤곽을 지킨다(T9-M6).
  assert.match(renderToStaticMarkup(createElement(adapters['tabler.ts'].XOctagon)), /tabler-icon-alert-octagon/)
  const ph = await import('@phosphor-icons/react/ssr')
  assert.equal(renderToStaticMarkup(createElement(adapters['phosphor.ts'].XOctagon)), renderToStaticMarkup(createElement(ph.WarningOctagonIcon, { size: 24, 'aria-hidden': true })))
})

test('phosphor weight copies: generated from phosphor.ts by changing WEIGHT only, and they draw different glyphs (light ≠ regular ≠ bold)', async () => {
  const src = readFileSync(join(ICONS_DIR, 'phosphor.ts'), 'utf8')
  for (const w of PHOSPHOR_WEIGHTS) assert.equal(readFileSync(join(ICONS_DIR, `phosphor-${w}.ts`), 'utf8'), phosphorVariant(src, w), `phosphor-${w}.ts 가 생성기 결과와 다르다 — npm run gen:all`)
  const a = await loadAdapters()
  const draw = (f) => renderToStaticMarkup(createElement(a[f].Search, {}))
  assert.equal(new Set(['phosphor.ts', 'phosphor-light.ts', 'phosphor-bold.ts'].map(draw)).size, 3)
  assert.match(draw('phosphor.ts'), /width="24"/, 'Phosphor 기본 크기 1em 대신 24')
  assert.throws(() => phosphorVariant('const WEIGHT = "x"', 'bold'), /WEIGHT/)
  // CRLF 원천(core.autocrlf=true checkout)도 같은 규칙: WEIGHT 를 찾고, 줄바꿈을 섞지 않는다(T9-I1).
  const crlf = phosphorVariant(src.replace(/\r?\n/g, '\r\n'), 'light')
  assert.match(crlf, /const WEIGHT: IconWeight = "light"\r\n/)
  assert.doesNotMatch(crlf, /[^\r]\n/)
})

test('icon grain G1–G5: lucide/tabler via --icon-stroke (+ cap/join), phosphor via weight; covers exactly the recipe schema values', () => {
  assert.deepEqual(Object.keys(ICON_GRAIN), RecipeHead.shape.icons.shape.weight.options)
  assert.deepEqual(iconVars('G2'), { 'icon-stroke': '1.5', 'icon-linecap': 'round', 'icon-linejoin': 'round' })
  assert.deepEqual(iconVars('G3'), { 'icon-stroke': '2', 'icon-linecap': 'square', 'icon-linejoin': 'miter' })
  assert.equal(iconVars('G5')['icon-stroke'], '2.5')
  assert.equal(iconAdapter({ library: 'lucide', weight: 'G5' }), 'lucide')
  assert.equal(iconAdapter({ library: 'tabler', weight: 'G2' }), 'tabler')
  assert.deepEqual(['G1', 'G2', 'G3', 'G4', 'G5'].map((weight) => iconAdapter({ library: 'phosphor', weight })), ['phosphor', 'phosphor-light', 'phosphor', 'phosphor', 'phosphor-bold'])
  const items = iconItems({ versions: { 'lucide-react': '^1', '@phosphor-icons/react': '^2', '@tabler/icons-react': '^3' } })
  assert.deepEqual(items.map((i) => i.name), ['icons-lucide', 'icons-phosphor', 'icons-tabler'])
  for (const i of items) {
    assert.ok(i.files.every((f) => f.target === `@components/icons/${f.path}`), i.name)
    assert.deepEqual(i.registryDependencies, [], `${i.name} 는 button 을 끌어오지 않는다(레시피 button 을 덮지 않게)`)
  }
  assert.equal(items[0].css['@layer base']['svg.lucide']['stroke-width'], 'var(--icon-stroke, 2)')
  assert.equal(items[1].css, undefined)
  assert.deepEqual(items[1].files.map((f) => f.path).slice(0, 3), ['phosphor.ts', 'phosphor-bold.ts', 'phosphor-light.ts'])
})

// 부품 원천·컴파일 ─────────────────────────────────────────────────────
test('ui-src imports icons only from the canonical module; base ui/ resolves it to the lucide adapter; no part imports lucide-react directly', () => {
  const dirs = { src: join(root, 'registry', 'factory', 'ui-src'), ui: join(root, 'registry', 'factory', 'ui'), r1: join(root, 'registry', 'factory', 'r', 'r1-measure', 'ui') }
  let canonical = 0
  for (const [k, d] of Object.entries(dirs)) for (const f of readdirSync(d).filter((x) => x.endsWith('.tsx'))) {
    const s = readFileSync(join(d, f), 'utf8')
    assert.doesNotMatch(s, /from "(lucide-react|@phosphor-icons\/react[^"]*|@tabler\/icons-react)"/, `${k}/${f}`)
    const icons = [...s.matchAll(/from "(@\/registry\/factory\/icons[^"]*)"/g)].map((m) => m[1])
    if (k === 'src') { assert.ok(icons.every((x) => x === '@/registry/factory/icons'), f); canonical += icons.length }
    else assert.ok(icons.every((x) => x === '@/registry/factory/icons/lucide'), `${k}/${f}: ${icons}`)
  }
  assert.equal(canonical, 22, '아이콘을 쓰는 부품 22개')
})

test('compile: the canonical import is rewritten to the chosen adapter (both quote styles); other imports are untouched', async () => {
  const src = 'import { X as XIcon } from "@/registry/factory/icons"\nimport { Y } from \'@/registry/factory/icons\'\nimport { Z } from "@/registry/factory/icons-extra"\n'
  assert.equal(iconImports(src, 'phosphor-light'),
    'import { X as XIcon } from "@/registry/factory/icons/phosphor-light"\nimport { Y } from \'@/registry/factory/icons/phosphor-light\'\nimport { Z } from "@/registry/factory/icons-extra"\n')
  const out = await compileSource('import { X as XIcon } from "@/registry/factory/icons"\nexport const A = () => <XIcon className="cn-a" />\n', { 'cn-a': 'size-4' }, { iconAdapter: 'tabler' })
  assert.match(out, /from "@\/registry\/factory\/icons\/tabler"/)
  assert.match(out, /size-4/)
})

test('registry deps: an adapter import becomes the kit item icons-<library>; a phosphor recipe points its parts and its base item at icons-phosphor and motion-core', async () => {
  assert.deepEqual(parseImports('import { X } from "@/registry/factory/icons/phosphor-bold"\nimport { B } from "@/registry/factory/ui/button"').internal.sort(), ['button', 'icons-phosphor'])
  assert.deepEqual(parseImports('import { X } from "@/registry/factory/icons/lucide"').internal, ['icons-lucide'])
  const r = parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', 'r1-measure', 'DESIGN.md'), 'utf8'))
  const ph = { ...r, icons: { library: 'phosphor', weight: 'G2' } }
  const source = iconImports('import { X as XIcon } from "@/registry/factory/icons"\n', iconAdapter(ph.icons))
  const { items, missing } = recipeItems(ph, [{ name: 'dialog', source }], { ref: 'v0.0.3', knownItems: knownRegistryItems() })
  assert.deepEqual(missing, [])
  const [base, , dialog] = items
  assert.ok(dialog.registryDependencies.includes('nowwcastle-sudo/sitebrew/icons-phosphor#v0.0.3'))
  for (const n of ['icons-phosphor', 'motion-core']) assert.ok(base.registryDependencies.includes(`nowwcastle-sudo/sitebrew/${n}#v0.0.3`), n)
  assert.equal(base.cssVars.light['icon-stroke'], '1.5')
})

// lint-ui icon-label ─────────────────────────────────────────────────────
test('lint-ui icon-label: size="icon*" needs aria-label, sr-only text, a labelled render host or an icon-label note; ui-src passes', () => {
  const bad = [
    '<Button size="icon"><XIcon /></Button>',
    '<Prim.Clear render={<Button size="icon-xs" />}><XIcon /></Prim.Clear>',
    'function F({ render = <Button size="icon-sm" /> }) { return <Prim.Close render={render} /> }',
  ]
  const good = [
    '<Button size="icon" aria-label="닫기"><XIcon /></Button>',
    '<Button size="icon-sm"><XIcon /><span className="sr-only">닫기</span></Button>',
    '<Prim.Clear aria-label="지우기" render={<Button size="icon-xs" />}><XIcon /></Prim.Clear>',
    'function F({ render = <Button size="icon-sm" /> }) { return <Prim.Close aria-label="알림 닫기" render={render} /> }',
    '<Button size="icon" /* icon-label: props 로 온다 */ {...props} />',
    '<Button size="sm"><XIcon /></Button>',
  ]
  for (const s of bad) assert.equal(iconLabelProblems(s).length, 1, s)
  for (const s of good) assert.equal(iconLabelProblems(s).length, 0, s)
  assert.deepEqual(lintSrcDir(join(root, 'registry', 'factory', 'ui-src')).fails.filter((f) => f.rule === 'icon-label'), [])
})

test('icon libraries have one source (final review M5): gen-kits items, the recipe YAML enum and parseImports all follow ICON_LIBRARIES', () => {
  assert.equal(LIBRARIES, ICON_LIBRARIES)
  assert.deepEqual(iconItems({ versions: null }).map((i) => i.name), ICON_LIBRARIES.map((l) => `icons-${l}`))
  assert.deepEqual(RecipeHead.shape.icons.shape.library.options, ICON_LIBRARIES)
  for (const l of ICON_LIBRARIES) assert.deepEqual(parseImports(`import { Icon } from "@/registry/factory/icons/${l}"`).internal, [`icons-${l}`])
})

// ── 모션 토큰이 레시피 motion(M0~M3)을 따른다(시험작 D7, DESIGN §8-2) ─────────────────
test('MOTION_TOKENS: M0~M3 each give their own token set with the same keys as motion-core; motion.css defaults equal M2', () => {
  const [core] = motionItems({ ref: 'v9.9.9', versions: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies })
  const norm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.replace(/\s+/g, '')]))
  assert.deepEqual(Object.keys(MOTION_TOKENS), RecipeHead.shape.motion.options)
  for (const m of Object.keys(MOTION_TOKENS)) assert.deepEqual(Object.keys(MOTION_TOKENS[m]).sort(), Object.keys(core.cssVars.theme).sort(), m)
  assert.deepEqual(norm(MOTION_TOKENS.M2), norm(core.cssVars.theme), 'motion.css @theme 기본값 = M2')
  const sets = Object.values(MOTION_TOKENS).map((t) => JSON.stringify(norm(t)))
  assert.equal(new Set(sets).size, 4, 'M0~M3 토큰 묶음이 서로 다르다')
  const ms = (v) => Number(v.replace('ms', ''))
  const enter = ['M0', 'M1', 'M2', 'M3'].map((m) => ms(MOTION_TOKENS[m]['duration-enter']))
  assert.deepEqual(enter, [...enter].sort((a, b) => a - b), '등장 길이가 M0 → M3 로 늘어난다')
  assert.equal(enter[0], 0, 'M0 은 등장 연출이 없다')
  for (const [k, v] of Object.entries(MOTION_TOKENS.M0)) if (k.startsWith('duration-')) assert.ok(ms(v) <= 200, `M0 ${k} ${v} — 전환 0~200ms`)
  for (const m of ['M1', 'M2', 'M3']) for (const k of ['duration-hover', 'duration-sheet']) assert.ok(ms(MOTION_TOKENS[m][k]) <= 350, `${m} ${k} — §8-2 UI 상한`)
  // §8-2 MUST 「hover 표면 변화 120~200ms」·표 「툴팁·팝오버 125~200」 — 모든 M 값에서(Task 6b 리뷰 M1)
  for (const m of Object.keys(MOTION_TOKENS)) {
    const hover = ms(MOTION_TOKENS[m]['duration-hover']), pop = ms(MOTION_TOKENS[m]['duration-popover'])
    assert.ok(hover >= 120 && hover <= 200, `${m} hover ${hover}`)
    assert.ok(pop >= 125 && pop <= 200, `${m} popover ${pop}`)
  }
  assert.equal(MOTION_TOKENS.M1['duration-enter'], '300ms', 'M1 등장 300ms 유지(컨트롤러 판정)')
  assert.deepEqual(motionVars('M3'), MOTION_TOKENS.M3)
  assert.deepEqual(motionVars('M9'), MOTION_TOKENS.M2, '모르는 값은 기본(M2)')
})
