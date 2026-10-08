import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseImports, buildItems, parseRef, pinDependency, themeFromCss, BASE_ITEM } from './gen-registry.mjs'
import { pinProblems, LAYERS, tagArg } from './pincheck.mjs'
import { steps, regenCheckCommands } from './gen-all.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const fx = join(here, 'fixtures', 'ui')
const REPO = 'nowwcastle-sudo/sitebrew'
const run = (args) => new Promise((res) => { const p = spawn(process.execPath, args, { stdio: 'ignore' }); p.on('exit', (c) => res(c)) })

test('parseImports splits npm packages from internal registry imports', () => {
  const r = parseImports(readFileSync(join(fx, 'dialog.tsx'), 'utf8'))
  assert.deepEqual(r.npm, ['@base-ui-components/react'])
  assert.deepEqual(r.internal.sort(), ['button', 'utils'])
})

test('react is never listed as a dependency', () => {
  const r = parseImports(readFileSync(join(fx, 'button.tsx'), 'utf8'))
  assert.ok(!r.npm.includes('react'))
  assert.deepEqual(r.npm.sort(), ['@base-ui-components/react', 'class-variance-authority'])
})

test('parseImports throws on a sub-path registry import instead of dropping it', () => {
  assert.throws(() => parseImports(`import { x } from "@/registry/factory/ui/button/parts"`), /하위 경로/)
})

test('resolves internal imports to registryDependencies, plus factory-base for every ui item', () => {
  const items = buildItems(fx, 'ui', REPO)
  const dialog = items.find((i) => i.name === 'dialog')
  assert.deepEqual(dialog.registryDependencies, [`${REPO}/button`, `${REPO}/${BASE_ITEM}`, `${REPO}/utils`])
  for (const it of items) assert.ok(it.registryDependencies.includes(`${REPO}/${BASE_ITEM}`), it.name)
  // lib/hooks items don't get it
  assert.ok(!buildItems(join(root, 'registry', 'factory', 'lib'), 'lib', REPO)[0].registryDependencies.length)
})

test('pins registryDependencies to a ref when one is given', () => {
  const pinned = buildItems(fx, 'ui', REPO, fx, 'v9.9.9').find((i) => i.name === 'dialog')
  assert.deepEqual(pinned.registryDependencies, [`${REPO}/button#v9.9.9`, `${REPO}/${BASE_ITEM}#v9.9.9`, `${REPO}/utils#v9.9.9`])
})

test('leaves registryDependencies unpinned when no ref is given', () => {
  const bare = buildItems(fx, 'ui', REPO).find((i) => i.name === 'dialog')
  assert.ok(bare.registryDependencies.every((d) => !d.includes('#')), bare.registryDependencies.join(' '))
})

test('parseRef accepts --ref vX and --ref=vX, and rejects a missing value', () => {
  assert.equal(parseRef(['--ref', 'v0.0.3']), 'v0.0.3')
  assert.equal(parseRef(['--ref=v0.0.3']), 'v0.0.3')
  assert.equal(parseRef([]), undefined)
  assert.throws(() => parseRef(['--ref']), /태그가 필요/)
  assert.throws(() => parseRef(['--ref=']), /태그가 필요/)
  assert.throws(() => parseRef(['--ref', '--other']), /태그가 필요/)
})

test('npm dependencies take the package.json range; an explicit version is kept', () => {
  const versions = { '@base-ui-components/react': '^1.2.3', 'class-variance-authority': '^0.7.1' }
  assert.equal(pinDependency('class-variance-authority', versions), 'class-variance-authority@^0.7.1')
  assert.equal(pinDependency('@base-ui-components/react', versions), '@base-ui-components/react@^1.2.3')
  assert.equal(pinDependency('react-day-picker@10', versions), 'react-day-picker@10')
  assert.equal(pinDependency('@scope/pkg@^2', versions), '@scope/pkg@^2')
  assert.throws(() => pinDependency('left-pad', versions), /package.json/)
  const button = buildItems(fx, 'ui', REPO, fx, undefined, versions).find((i) => i.name === 'button')
  assert.deepEqual(button.dependencies, ['@base-ui-components/react@^1.2.3', 'class-variance-authority@^0.7.1'])
})

test('the real ui registry has every npm dependency versioned', () => {
  const ui = JSON.parse(readFileSync(join(root, 'registry', 'factory', 'ui', 'registry.json'), 'utf8'))
  for (const it of ui.items) for (const d of it.dependencies) assert.ok(d.lastIndexOf('@') > 0, `${it.name}: ${d}`)
})

test('item order is sorted by item name', () => {
  const names = buildItems(join(root, 'registry', 'factory', 'ui'), 'ui', REPO).map((i) => i.name)
  assert.deepEqual(names, [...names].sort())
})

test('emits forward-slash paths', () => {
  for (const it of buildItems(fx, 'ui', REPO)) for (const f of it.files) assert.ok(!f.path.includes('\\'), f.path)
})

test('item type follows layer', () => {
  assert.equal(buildItems(fx, 'ui', REPO)[0].type, 'registry:ui')
})

test('theme item carries cssVars parsed from the CSS file and no files', () => {
  const dir = join(root, 'registry', 'factory', 'themes')
  const css = readFileSync(join(dir, 'factory-default.css'), 'utf8')
  const [theme] = buildItems(dir, 'themes', REPO)
  assert.equal(theme.type, 'registry:theme')
  assert.equal(theme.files, undefined)
  const varCount = (css.replace(/\/\*[\s\S]*?\*\//g, '').match(/--[a-z0-9-]+\s*:/g) ?? []).length
  // 모든 변수가 light·dark·theme(@theme inline — 상태 토큰 연결, 리뷰 M7) 가운데 한 곳에 실린다
  assert.equal(Object.keys(theme.cssVars.light).length + Object.keys(theme.cssVars.dark).length + Object.keys(theme.cssVars.theme ?? {}).length, varCount)
  assert.equal(theme.cssVars.light.ring, 'oklch(0.52 0.09 195)')
  assert.equal(theme.cssVars.dark.ring, 'oklch(0.7 0.08 195)')
  assert.equal(theme.cssVars.light.radius, '0.625rem')
  assert.deepEqual(theme.css, { ':root': { 'color-scheme': 'light' }, '.dark': { 'color-scheme': 'dark' } })
})

test('themeFromCss rejects rules it would silently drop', () => {
  assert.throws(() => themeFromCss(':root { --a: 1 } .other { --b: 2 }'), /예상 밖/)
})

test('factory-base item carries the floor rules as css under @layer base', () => {
  const [base] = buildItems(join(root, 'registry', 'factory', 'base'), 'base', REPO)
  assert.equal(base.name, BASE_ITEM)
  const layer = base.css['@layer base']
  assert.equal(layer['html:lang(ko), :lang(ko)']['word-break'], 'keep-all')
  assert.deepEqual(layer.body, { 'font-size': '1rem', 'line-height': '1.7', 'font-variant-numeric': 'tabular-nums' })
  assert.equal(layer[':focus-visible'].outline, '2px solid var(--ring)')
  assert.equal(layer['html:has([data-sticky-nav])']['scroll-padding-top'], '5rem')
  assert.equal(layer['@media (prefers-reduced-motion: reduce)']['*, *::before, *::after']['animation-duration'], '0.01ms !important')
})

test('reduced motion collapses the motion tokens themselves and all delays (Task 7 fix 1 — review I7): source item and the generated registry json', () => {
  const [base] = buildItems(join(root, 'registry', 'factory', 'base'), 'base', REPO)
  const generated = JSON.parse(readFileSync(join(root, 'registry', 'factory', 'base', 'registry.json'), 'utf8')).items.find((i) => i.name === BASE_ITEM)
  // 모션 토큰 목록은 motion.css(@theme)의 --duration-* 전부 — 새 토큰이 생기면 여기서 빠진 것이 드러난다.
  const tokens = [...readFileSync(join(root, 'registry', 'factory', 'motion', 'motion.css'), 'utf8').matchAll(/(--duration-[a-z]+):/g)].map((m) => m[1])
  assert.ok(tokens.includes('--duration-enter') && tokens.includes('--duration-sheet'), tokens.join(' '))
  for (const item of [base, generated]) {
    const rm = item.css['@layer base']['@media (prefers-reduced-motion: reduce)']['*, *::before, *::after']
    for (const t of new Set(tokens)) assert.equal(rm[t], '0ms !important', t)
    assert.equal(rm['animation-delay'], '0ms !important')
    assert.equal(rm['transition-delay'], '0ms !important')
  }
})

test('pincheck passes only when every dependency carries the tag and the version matches', () => {
  const reg = (deps) => ({ items: [{ name: 'x', registryDependencies: deps }] })
  assert.deepEqual(pinProblems('v1.2.3', [reg([`${REPO}/a#v1.2.3`])], '1.2.3'), [])
  assert.equal(pinProblems('v1.2.3', [reg([`${REPO}/a#v1.2.3`, `${REPO}/b`])], '1.2.3').length, 1)
  assert.equal(pinProblems('v1.2.3', [reg([`${REPO}/a#v1.2.2`])], '1.2.3').length, 1)
  assert.equal(pinProblems('v1.2.3', [reg([`${REPO}/a#v1.2.3`])], '1.2.2').length, 1)
  assert.equal(pinProblems('1.2.3', [reg([`${REPO}/a#1.2.3`])], '1.2.3').length, 1)
  assert.equal(pinProblems('v1.2.3', [reg([])], '1.2.3').length, 1)
})

test('pincheck CLI exits 2 without a tag (argument error), 1 on a mismatched one, the same for --ref', async () => {
  const script = join(here, 'pincheck.mjs')
  assert.equal(await run([script]), 2)
  assert.equal(await run([script, '--ref']), 2)
  assert.equal(await run([script, 'v999.0.0']), 1)
  assert.equal(await run([script, '--ref', 'v999.0.0']), 1)
})

test('pincheck covers the recipe layer r and the font layer', () => {
  assert.ok(LAYERS.includes('r'))
  assert.ok(LAYERS.includes('fonts'))
  const reg = JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8'))
  for (const l of LAYERS) assert.ok(reg.include.includes(`registry/factory/${l}/registry.json`), l)
})

test('gen:all order: radius, styles, fonts, kits, recipes, content slots, blocks, registry, then ai only when gen-ai.mjs exists; --ref reaches recipes and registry', () => {
  assert.deepEqual(steps('v1.2.3', { hasAi: false }).map((s) => s[0]), ['gen:radius', 'gen:styles', 'gen-fonts', 'gen-kits', 'recipes', 'build-presets', 'gen-content-slots', 'gen-blocks', 'gen-registry'])
  const all = steps('v1.2.3', { hasAi: true })
  assert.deepEqual(all.map((s) => s[0]), ['gen:radius', 'gen:styles', 'gen-fonts', 'gen-kits', 'recipes', 'build-presets', 'gen-content-slots', 'gen-blocks', 'gen-registry', 'gen-ai'])
  // 태그를 받는 단계(키트·레시피·블록·레지스트리·ai). 원형 칸 생성(gen-content-slots)은 태그와 무관하다.
  for (const s of all.filter((x) => ['gen-kits', 'recipes', 'gen-blocks', 'gen-registry', 'gen-ai'].includes(x[0]))) assert.deepEqual(s[2].slice(-2), ['--ref', 'v1.2.3'], s[0])
  // gen:styles 는 npm 스크립트 문자열을 쪼개지 않고 인자를 명시한다(M9).
  assert.match(all[1][2][0], /compile-styles\.mjs$/)
  assert.deepEqual(all[1][2].slice(1), ['--src', 'registry/factory/ui-src', '--out', 'registry/factory/ui', '--css', 'registry/factory/styles/base.css'])
})

test('check:regen: gen:all --check pins to the package version and compares with git', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts['check:regen'], 'node factory/scripts/gen-all.mjs --check')
  assert.deepEqual(regenCheckCommands().map((c) => c.slice(0, 2)), [['diff', '--exit-code'], ['ls-files', '--others']])
})

// pincheck CLI(Task 13a 항목 11): 위치 인자와 --ref 둘 다 태그로 받는다. --ref 자체를 태그로 읽던 결함.
test('pincheck tag argument: positional, --ref v and --ref=v all give the tag; missing or conflicting tags throw', () => {
  for (const argv of [['v0.0.3'], ['--ref', 'v0.0.3'], ['--ref=v0.0.3'], ['v0.0.3', '--ref', 'v0.0.3']]) assert.equal(tagArg(argv), 'v0.0.3', argv.join(' '))
  assert.throws(() => tagArg([]), /태그가 필요/)
  assert.throws(() => tagArg(['--ref']), /--ref 뒤에 태그/)
  assert.throws(() => tagArg(['v0.0.3', '--ref', 'v0.0.4']), /태그가 둘/)
  assert.throws(() => tagArg(['v0.0.3', 'v0.0.4']), /하나만/)
})
