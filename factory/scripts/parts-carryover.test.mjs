// P3-2 Task 2 — 부품 이월(D6 outline 테두리 · D9 표 글자·아코디언 · 부품 모션 토큰). 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/parts-carryover.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { listValues, styleMapOf, BASE_CSS } from './axes.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FACTORY = join(root, 'registry', 'factory')
const OUT = join(root, '.tmp', 'parts-carryover-test')
const tokens = (s) => String(s ?? '').split(/\s+/).filter(Boolean)

// 컴파일된 부품(npm import 만 있는 파일)을 .mjs 로 옮겨 싣는다.
async function loadPart(rel) {
  const { outputText } = ts.transpileModule(readFileSync(join(FACTORY, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  const out = join(OUT, rel.replace(/\.tsx?$/, '.mjs'))
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, outputText)
  return import(pathToFileURL(out).href)
}

test('D6: buttonVariants() alone (no cn wrapper) keeps the outline border — no border-transparent in the base, a border color per variant', async () => {
  for (const rel of ['ui/button.tsx', ...readdirSync(join(FACTORY, 'r')).filter((d) => !d.includes('.')).map((d) => `r/${d}/ui/button.tsx`)]) {
    const { buttonVariants } = await loadPart(rel)
    const outline = tokens(buttonVariants({ variant: 'outline' }))
    assert.ok(!outline.includes('border-transparent'), `${rel}: outline 에 border-transparent`)
    assert.ok(outline.includes('border-input'), `${rel}: outline 테두리 색이 없다`)
    for (const v of ['default', 'secondary', 'ghost', 'destructive', 'link']) {
      const t = tokens(buttonVariants({ variant: v }))
      assert.equal(t.filter((x) => /^border-(transparent|input)$/.test(x)).length, 1, `${rel} ${v}: 테두리 색이 하나가 아니다`)
    }
  }
})

// 한글 본문 16px(DESIGN §2) — 조밀 표(T1)만 15px 이상.
const fontPx = (s) => { let px = null; for (const t of tokens(s)) { if (t.includes(':')) continue; const m = t.match(/^text-(sm|base|lg|\[(\d+)px\])$/); if (m) px = m[1] === 'sm' ? 14 : m[1] === 'base' ? 16 : m[1] === 'lg' ? 18 : Number(m[2]) } return px }
test('D9: table body text is body size — base and every table value ≥ 16px, dense T1 ≥ 15px', () => {
  const rows = [['base', styleMapOf(BASE_CSS)], ...listValues().filter((v) => v.axis === 'table').map((v) => [v.id, styleMapOf(v.file)])]
  assert.equal(rows.length, 5)
  for (const [id, map] of rows) {
    const px = fontPx(map['cn-table'])
    assert.ok(px !== null && px >= (id === 'T1' ? 15 : 16), `${id} cn-table ${map['cn-table']} → ${px}px`)
  }
  assert.equal(fontPx('text-sm tabular-nums'), 14) // 음성 대조
})

test('D9: accordion opens with a grid-template-rows transition on motion tokens — no height keyframe, no fixed panel height; answers are body size', () => {
  const src = readFileSync(join(FACTORY, 'ui-src', 'accordion.tsx'), 'utf8')
  assert.doesNotMatch(src, /animate-accordion-(down|up)/)
  assert.doesNotMatch(src, /--accordion-panel-height/)
  assert.match(src, /transition-\[grid-template-rows\]/)
  assert.match(src, /data-starting-style:grid-rows-\[0fr\]/)
  assert.match(src, /data-ending-style:grid-rows-\[0fr\]/)
  assert.match(src, /duration-\(--duration-popover/)
  assert.match(src, /ease-\(--ease-standard\)/)
  const base = styleMapOf(BASE_CSS)
  assert.equal(fontPx(base['cn-accordion-content']), 16)
})

test('motion tokens: the parts that used fixed duration-100/200 now read --duration-hover·popover·sheet with an M2 fallback', () => {
  const FILES = ['alert-dialog', 'combobox', 'context-menu', 'dialog', 'drawer', 'dropdown-menu', 'hover-card', 'item', 'menubar', 'message-scroller', 'popover', 'select', 'sheet', 'sidebar']
  const M2 = { hover: '200ms', popover: '160ms', sheet: '320ms' }
  for (const f of FILES) {
    const src = readFileSync(join(FACTORY, 'ui-src', `${f}.tsx`), 'utf8')
    assert.doesNotMatch(src, /(?<![\w-])duration-(100|200)(?![\w-])/, f)
    const used = [...src.matchAll(/duration-\(--duration-(hover|popover|sheet),(\d+ms)\)/g)]
    assert.ok(used.length, `${f}: 모션 토큰이 없다`)
    for (const [, k, fb] of used) assert.equal(fb, M2[k], `${f}: --duration-${k} 대체값`)
  }
  // 토큰 이름은 gen-kits MOTION_TOKENS 에 있다
  const kits = readFileSync(join(root, 'factory', 'scripts', 'gen-kits.mjs'), 'utf8')
  for (const k of ['duration-hover', 'duration-popover', 'duration-sheet', 'ease-standard']) assert.match(kits, new RegExp(`'${k}'`))
})

test('Step 7: collapsed icon sidebar on touch — menu button width floor 44 and 2px group inline padding are touch-only part rules (not hooks)', async () => {
  const src = readFileSync(join(FACTORY, 'ui-src', 'sidebar.tsx'), 'utf8')
  assert.match(src, /"cn-sidebar-menu-button pointer-coarse:min-h-11 pointer-coarse:group-data-\[collapsible=icon\]:min-w-11 /)
  assert.match(src, /const ICON_TOUCH_GROUP = "pointer-coarse:group-data-\[collapsible=icon\]:px-0\.5"/)
  const { isShape } = await import('./hooks-audit.mjs')
  for (const t of ['pointer-coarse:group-data-[collapsible=icon]:min-w-11', 'pointer-coarse:group-data-[collapsible=icon]:px-0.5']) assert.equal(isShape(t), false, t)
  assert.equal(isShape('group-data-[collapsible=icon]:px-0.5'), true) // 음성 대조: 터치 변형이 없으면 모양이다(훅 자리)
})
