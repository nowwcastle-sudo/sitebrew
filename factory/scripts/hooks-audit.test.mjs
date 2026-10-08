import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { shapeOutsideHooks, classTokens, compareTokens, duplicateHooks, ruleClasses, KEPT_MARKERS } from './hooks-audit.mjs'
import { loadStyleMap, compileSource } from './compile-styles.mjs'
import { shrinkStyleMap, shrinkToken } from '../qa/shrunk.mjs'

const cls = (src) => shapeOutsideHooks(src).map((h) => h.cls)

test('flags shape classes left inline next to a hook', () => {
  assert.deepEqual(cls('cn("cn-button rounded-lg h-11 focus-visible:ring-3")'), ['rounded-lg', 'h-11'])
})

test('rule classes (focus ring, hit area) are not shape', () => {
  assert.deepEqual(cls('cn("cn-button focus-visible:ring-3 after:-inset-2")'), [])
  assert.deepEqual(cls('cn("aria-invalid:ring-3 disabled:bg-input/50 motion-reduce:transition-none in-data-[slot=button-group]:after:inset-x-0")'), [])
})

test('catches shape classes inside cva variant strings and JSX className', () => {
  const src = `const v = cva("cn-x inline-flex", { variants: { size: { sm: "cn-x-size-sm px-3" } } })
const a = <div className="gap-2 flex" />`
  assert.deepEqual(cls(src), ['px-3', 'gap-2'])
  assert.deepEqual(shapeOutsideHooks(src).map((h) => h.where), ["1:px-3", "2:gap-2"])
})

test('shape under a state or selector variant is still shape; layout sizes are not', () => {
  assert.deepEqual(cls('cn("data-[size=sm]:h-8 [&_svg:not([class*=\'size-\'])]:size-4 dark:bg-input/30 h-full size-full min-h-0 border-input text-muted-foreground")'),
    ['data-[size=sm]:h-8', "[&_svg:not([class*='size-'])]:size-4", 'dark:bg-input/30'])
})

test('strings outside class contexts are ignored', () => {
  assert.deepEqual(cls('const label = "h-11 rounded-lg"; import x from "p-4"'), [])
})

test('scans every place a class string can hide (classNames, containerClassName, twMerge, x.cn, variables)', () => {
  assert.deepEqual(cls('<DayPicker classNames={{ months: cn("gap-4 flex") }} />'), ['gap-4'])
  assert.deepEqual(cls('<OTPInput containerClassName="flex gap-2" />'), ['gap-2'])
  assert.deepEqual(cls('<OTPInput containerClassName={cn("rounded-lg")} />'), ['rounded-lg'])
  assert.deepEqual(cls('twMerge("px-3 flex")'), ['px-3'])
  assert.deepEqual(cls('utils.cn("h-11 flex")'), ['h-11'])
  assert.deepEqual(cls('const base = "rounded-xl flex"\nconst X = () => <div className={cn(base, "grid")} />'), ['rounded-xl'])
  assert.deepEqual(cls('const label = "rounded-xl"'), [])                  // className 으로 안 쓰이면 클래스가 아니다
})

test('only focus ring, outline and border colour count as rules under focus variants', () => {
  assert.deepEqual(cls('cn("focus-visible:ring-3 focus-visible:ring-ring focus-visible:border-ring focus:outline-2 has-[:focus-visible]:ring-3")'), [])
  assert.deepEqual(cls('cn("focus-visible:rounded-xl group-focus:px-4 focus-within:border-2")'), ['focus-visible:rounded-xl', 'group-focus:px-4', 'focus-within:border-2'])
})

test('duplicateHooks: a hook in a cva/mergeProps slot must not appear again in the same file', () => {
  const dup = `const a = cva("cn-x flex", { variants: { size: { sm: "cn-x-size-sm" } } })
const b = cva("cn-x grid")
const C = () => <div className={cn("cn-y")} />`
  assert.deepEqual(duplicateHooks(dup).map((d) => d.name), ['cn-x'])
  const reuseInJsx = 'const a = cva("cn-x flex")\nconst C = () => <div className={cn("cn-x")} />'
  assert.deepEqual(duplicateHooks(reuseInJsx).map((d) => d.name), ['cn-x'])
  assert.deepEqual(duplicateHooks('const C = () => <><i className="cn-y" /><b className={cn("cn-y")} /></>'), []) // JSX 끼리는 매번 적용된다
})

test('equal ignores dead cn-* tokens of the original, but a hook left in the output still counts', () => {
  assert.deepEqual(compareTokens('cn("cn-dead flex")', 'cn("flex")'), { missing: [], extra: [] })
  assert.deepEqual(compareTokens('cn("flex")', 'cn("cn-leak flex")'), { missing: [], extra: ['cn-leak'] })
  // 컴파일러가 남기는 표지 훅은 빼지 않는다 — 생성물에서 사라지면 missing.
  assert.deepEqual(compareTokens('cn("cn-menu-target flex")', 'cn("flex")'), { missing: ['cn-menu-target'], extra: [] })
  assert.deepEqual(compareTokens('cn("cn-rtl-flip flex")', 'cn("cn-rtl-flip flex")'), { missing: [], extra: [] })
  // 리뷰 M2: 표지 목록은 설치된 shadcn(4.21.0) dist/utils 에서 읽는다 — cn-logical-sides 도 그 Set 에 있다(dist 최상위가 아니라 utils/).
  assert.deepEqual([...KEPT_MARKERS].sort(), ['cn-font-heading', 'cn-logical-sides', 'cn-menu-target', 'cn-menu-translucent', 'cn-rtl-flip'])
  const dist = readFileSync(fileURLToPath(new URL('../../node_modules/shadcn/dist/utils/index.js', import.meta.url)), 'utf8')
  for (const k of KEPT_MARKERS) assert.ok(dist.includes(`"${k}"`), k)
})

test('equal: class token multisets match regardless of order and the generated header', () => {
  const a = 'cn("rounded-lg h-11 flex")'
  const b = '// 생성물 — factory/scripts/compile-styles.mjs 로 다시 만든다. 손으로 고치지 않는다.\ncn("flex rounded-lg h-11")'
  assert.deepEqual(compareTokens(a, b), { missing: [], extra: [] })
  assert.deepEqual(compareTokens(a, 'cn("flex h-11")'), { missing: ['rounded-lg'], extra: [] })
  assert.deepEqual(classTokens('cn("a a b")').sort(), ['a', 'a', 'b'])
  assert.deepEqual(classTokens('import x from "pkg"; cn(v === "top" ? "pb-3" : "pt-3")'), ['pb-3', 'pt-3'])
})

// ── Task 4: 규칙은 모양과 무관하다 ─────────────────────────────────────────────
const F44 = ['after:absolute', 'after:inset-y-[min(0px,calc((100%-44px)/2))]', 'after:inset-x-[min(0px,calc((100%-44px)/2))]']
const UI_SRC = new URL('../../registry/factory/ui-src/', import.meta.url)
const UI = new URL('../../registry/factory/ui/', import.meta.url)
const BASE_CSS = new URL('../../registry/factory/styles/base.css', import.meta.url)
const read = (u) => readFileSync(u, 'utf8')
const files = readdirSync(UI_SRC).filter((f) => f.endsWith('.tsx')).sort()

test('ruleClasses: hooks and shape are out; focus, invalid, disabled, hit area, floor, state, colour, layout are in', () => {
  const r = ruleClasses(`cn("cn-x relative inline-flex rounded-lg h-6 px-2 ${F44.join(' ')} min-h-[44px] min-h-11 focus-visible:ring-3 aria-invalid:border-destructive disabled:opacity-50 data-checked:bg-primary bg-primary")`)
  assert.deepEqual([...r].sort(), ['relative', 'inline-flex', ...F44, 'min-h-[44px]', 'focus-visible:ring-3', 'aria-invalid:border-destructive', 'disabled:opacity-50', 'data-checked:bg-primary', 'bg-primary'].sort())
})

// 컴파일러는 훅 값을 문자열 앞에 넣으므로 인라인 규칙이 twMerge 에서 늘 이긴다. 남는 위험은 스타일이 규칙 자리 클래스를
// 끼워 넣는 것(after:inset-0 이 식 옆에 남아 CSS 에서 식과 다툰다) — 규칙 집합이 달라져 잡혀야 한다.
test('ruleClasses catches a style that injects a rule-position class (negative control)', async () => {
  const src = `const A = () => <div className={cn("flex ${F44.join(' ')} cn-bad")} />`
  const out = await compileSource(src, { 'cn-bad': 'after:inset-0 rounded-lg' })
  const a = ruleClasses(src), b = ruleClasses(out)
  assert.ok(b.has('after:inset-0') && !a.has('after:inset-0'), out)
  assert.notDeepEqual([...a].sort(), [...b].sort())
  // 모양만 바꾸는 스타일은 규칙 집합을 건드리지 않는다(양성 대조)
  assert.deepEqual([...ruleClasses(await compileSource(src, { 'cn-bad': 'rounded-lg h-6 px-2' }))].sort(), [...a].sort())
})

test('rule invariance: ruleClasses(ui-src) === ruleClasses(compiled) for all parts (61 + icon-button + site-shell + site-shell-nav), with the base style and with every size hook shrunk to 24px', async () => {
  assert.equal(files.length, 67)   // 66 + locale-labels(P3-5 D235 접근 이름 표) = 61 + icon-button(T9-c3) + site-shell(Task 11) + site-shell-nav(T11-N1 클라이언트 조각) + display·texture(Task 16a 새 축 D·X)
  const shrunk = shrinkStyleMap(await loadStyleMap([fileURLToPath(BASE_CSS)]))
  const bad = []
  for (const f of files) {
    const src = read(new URL(f, UI_SRC)), want = [...ruleClasses(src)].sort()
    for (const [name, compiled] of [['ui', read(new URL(f, UI))], ['shrunk', await compileSource(src, shrunk)]])
      if (JSON.stringify([...ruleClasses(compiled)].sort()) !== JSON.stringify(want)) bad.push(`${name}/${f}`)
  }
  assert.deepEqual(bad, [])
})

test('the 44px formula lives in the rule set of every component whose hit area it provides', () => {
  const withFormula = ['button', 'toggle', 'checkbox', 'radio-group', 'switch', 'slider', 'toast', 'select', 'navigation-menu', 'breadcrumb', 'questionnaire', 'sidebar']
  for (const c of withFormula) {
    const r = ruleClasses(read(new URL(`${c}.tsx`, UI_SRC)))
    for (const t of F44) assert.ok(r.has(t), `${c}: ${t}`)
  }
  const all = files.map((f) => read(new URL(f, UI_SRC))).join('\n')
  assert.doesNotMatch(all, /after:-inset-\[\d+px\]|after:-inset-[xy]-\[\d+px\]|after:-inset-[xy]?-\d/) // 옛 숫자 확장은 남지 않는다
  for (const c of ['input', 'questionnaire']) assert.ok(ruleClasses(read(new URL(`${c}.tsx`, UI_SRC))).has('min-h-[44px]'), `${c}: floor`)
  assert.ok(ruleClasses(read(new URL('tabs.tsx', UI_SRC))).has('before:inset-y-[min(0px,calc((100%-24px)/2))]'), 'tabs: 24px floor')
  // 리뷰 1회차: 입력 그룹 바닥은 보이는 칸에, 안쪽 input 은 칸을 채운다 / 설문 입력 바닥을 지우는 sm:min-h-0 없음 /
  // badge 링크·bubble 버튼·링크는 식 + overflow-visible(잘리면 히트가 안 된다) / sidebar 24 는 dashboard 원형에서만
  const group = read(new URL('input-group.tsx', UI_SRC))
  assert.match(group, /"cn-input-group group\/input-group relative flex min-h-\[44px\]/)
  assert.match(group, /"cn-input-group-control h-full min-h-0 /)
  assert.doesNotMatch(read(new URL('questionnaire.tsx', UI_SRC)).match(/"cn-questionnaire-input [^"]*"/)[0], /sm:min-h-0/)
  for (const [c, v] of [['badge', '[a]'], ['bubble', '[button,a]']]) {
    const r = ruleClasses(read(new URL(`${c}.tsx`, UI_SRC)))
    for (const t of [`${v}:relative`, `${v}:overflow-visible`, ...F44.map((f) => `${v}:${f}`)]) assert.ok(r.has(t), `${c}: ${t}`)
  }
  const side = read(new URL('sidebar.tsx', UI_SRC))
  assert.equal((side.match(/ pointer-fine:/g) ?? []).length, 0)
  assert.equal((side.match(/in-data-\[archetype=dashboard\]:pointer-fine:after:inset-[xy]-\[min\(0px,calc\(\(100%-24px\)\/2\)\)\]/g) ?? []).length, 4)
})

test('shrinkToken: size tokens above 24px become 24px (also with !), vertical padding becomes 0; smaller and layout sizes stay', () => {
  assert.equal(shrinkToken('h-11'), 'h-6')
  assert.equal(shrinkToken('data-[size=sm]:min-h-8'), 'data-[size=sm]:min-h-6')
  assert.equal(shrinkToken('[&_svg]:size-4'), '[&_svg]:size-4')
  assert.equal(shrinkToken('h-[36px]'), 'h-6')
  assert.equal(shrinkToken('h-full'), 'h-full')
  assert.equal(shrinkToken('h-(--cell-size)'), 'h-(--cell-size)')
  // ! 붙은 토큰(리뷰 1회차), 세로 여백 → 0, p-N 은 가로를 남긴다
  assert.equal(shrinkToken('h-8!'), 'h-6!')
  assert.equal(shrinkToken('!size-8'), '!size-6')
  assert.equal(shrinkToken('size-3!'), 'size-3!')
  assert.equal(shrinkToken('py-[2px]'), 'py-0')
  assert.equal(shrinkToken('data-[size=sm]:py-1.5'), 'data-[size=sm]:py-0')
  assert.equal(shrinkToken('p-[3px]'), 'px-[3px] py-0')
  assert.equal(shrinkToken('px-3'), 'px-3')
})

// textarea 는 대체 요소라 ::after 가 없고, 인라인 min-h 바닥은 twMerge 로 훅의 min-h-16 을 지워 기본 모양을 바꾼다.
// 그래서 바닥은 훅 값에 있다 — 기본 스타일에서 44px 이상인지 여기서, 레시피마다 Task 6 lint 에서 본다.
test('textarea hit area floor lives in its hook: base min-h is at least 44px', async () => {
  const map = await loadStyleMap([fileURLToPath(BASE_CSS)])
  const m = map['cn-textarea'].match(/(?:^|\s)min-h-(\d+(?:\.\d+)?)(?:\s|$)/)
  assert.ok(m && Number(m[1]) >= 11, map['cn-textarea'])
})
