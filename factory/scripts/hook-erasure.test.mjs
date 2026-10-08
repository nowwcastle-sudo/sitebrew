// T11-c2: 「값 훅 토큰이 부품 자체 토큰에 지워지지 않는다」를 ui-src 전체(61개)에서 본다.
// 실제 순서를 그대로 따른다. 컴파일(shadcn transformStyle)은 한 문자열의 훅 토큰을 그 문자열 앞에 두고 twMerge(훅, 문자열) 한다.
// cn(...) 은 모든 문자열 인자의 훅을 첫 인자에 합치고, 실행 때 cn 이 인자 순서대로 다시 합친다. cva 는 base 뒤에 고른 variant 문자열을 잇는다.
// 그래서 훅 토큰 뒤에 오는 부품 토큰이 같은 속성이면 훅 토큰이 조용히 사라져 축이 무력해진다(site-shell 에서 실제로 났다).
// 고치는 법: site-shell 처럼 부품은 CSS 변수 기본값(`md:[position:var(--x,sticky)]`)을 쓰고 축 값이 변수를 정하거나, 부품 기본값을 뺀다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { twMerge } from 'cn'
import { listValues, styleMapOf, BASE_CSS } from './axes.mjs'
import { KEPT_MARKERS as MARKERS } from './hooks-audit.mjs'

const UI_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'registry', 'factory', 'ui-src')
const HOOK = /\bcn-[\w-]+\b/g
const hooksOf = (s) => [...s.matchAll(HOOK)].map((m) => m[0]).filter((h) => !MARKERS.has(h))
const partOf = (s) => s.replace(HOOK, ' ').split(/\s+/).filter(Boolean)
const isStr = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)

// 원천 → 합쳐지는 묶음 목록. 묶음 = 실행 때 합쳐지는 순서의 조각 [{ hooks, part }].
export function classGroups(source, file = 'x.tsx') {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const groups = []
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const name = n.expression.text
      if (name === 'cn') {
        const lits = n.arguments.filter(isStr).map((a) => a.text)
        const hooks = lits.flatMap(hooksOf)
        if (hooks.length) {
          const firstLit = n.arguments[0] && isStr(n.arguments[0])
          const segs = [{ hooks, part: firstLit ? partOf(n.arguments[0].text) : [] }]
          for (const a of n.arguments.slice(firstLit ? 1 : 0)) {
            if (isStr(a)) { segs.push({ hooks: [], part: partOf(a.text) }); continue }
            // 조건부 인자(dense && "px-1", x ? "a" : "b")의 문자열도 실행 때 훅 뒤에 붙을 수 있다 — 최악의 경우로 모두 뒤 조각에 넣는다(리뷰 M5)
            const lits = []
            const walk = (x) => { if (isStr(x)) lits.push(x.text); else if (!ts.isObjectLiteralExpression(x)) ts.forEachChild(x, walk) }
            walk(a)
            for (const s of lits) segs.push({ hooks: [], part: partOf(s) })
          }
          groups.push({ at: `${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`, segs })
        }
      } else if (name === 'cva') {
        const [base, opts] = n.arguments
        const seg0 = base && isStr(base) ? { hooks: hooksOf(base.text), part: partOf(base.text) } : { hooks: [], part: [] }
        const variants = []
        const vp = opts && ts.isObjectLiteralExpression(opts) && opts.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'variants')
        if (vp && ts.isObjectLiteralExpression(vp.initializer)) for (const g of vp.initializer.properties)
          if (ts.isPropertyAssignment(g) && ts.isObjectLiteralExpression(g.initializer)) for (const v of g.initializer.properties)
            if (ts.isPropertyAssignment(v) && isStr(v.initializer)) variants.push({ hooks: hooksOf(v.initializer.text), part: partOf(v.initializer.text), name: `${g.name.getText()}.${v.name.getText()}` })
        const at = `${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`
        if (seg0.hooks.length) groups.push({ at, segs: [seg0] })
        // 실행 때 cva 는 base 뒤에 variant 를 잇는다 — base 훅이 variant 부품 토큰에 지워지는지, variant 훅이 제 문자열에 지워지는지.
        for (const v of variants) if (seg0.hooks.length || v.hooks.length) groups.push({ at: `${at} ${v.name}`, segs: [seg0, v] })
      }
    }
    if (ts.isJsxAttribute(n) && n.name.getText() === 'className' && n.initializer && isStr(n.initializer)) {
      const hooks = hooksOf(n.initializer.text)
      if (hooks.length) groups.push({ at: `${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`, segs: [{ hooks, part: partOf(n.initializer.text) }] })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return groups
}

// 한 묶음에서 부품 토큰에 지워지는 훅 토큰. 훅끼리 덮는 것(variant 훅이 base 훅을 이기는 것)은 의도라 세지 않는다.
export function erasedTokens(group, map, own = () => true) {
  const expand = (hooks) => hooks.filter(own).flatMap((h) => (map[h] ?? '').split(/\s+/).filter(Boolean))
  const allHooks = group.segs.flatMap((s) => s.hooks.flatMap((h) => (map[h] ?? '').split(/\s+/).filter(Boolean)))
  const survive = new Set(twMerge(allHooks.join(' ')).split(' '))
  const merged = new Set(twMerge(group.segs.flatMap((s) => [...s.hooks.flatMap((h) => (map[h] ?? '').split(/\s+/).filter(Boolean)), ...s.part]).join(' ')).split(' '))
  const mine = new Set(group.segs.flatMap((s) => expand(s.hooks)))
  return [...mine].filter((t) => survive.has(t) && !merged.has(t))
}

test('classGroups follows the compiler order: JSX literal, cn() literal args, cva base + each variant', () => {
  const src = [
    'const v = cva("cn-b inline-flex", { variants: { size: { sm: "cn-b-sm h-8", lg: "h-12" } } })',
    'export function X({ className }) { return <div><p className="cn-p text-sm" /><span className={cn("cn-s gap-2", "px-3", className)} /></div> }',
  ].join('\n')
  const g = classGroups(src)
  assert.deepEqual(g.map((x) => x.at), ['x.tsx:1', 'x.tsx:1 size.sm', 'x.tsx:1 size.lg', 'x.tsx:2', 'x.tsx:2'])
  assert.deepEqual(g.find((x) => x.segs[0].hooks[0] === 'cn-s').segs, [{ hooks: ['cn-s'], part: ['gap-2'] }, { hooks: [], part: ['px-3'] }])
})

test('classGroups counts string literals inside conditional cn() arguments as later parts, so a conditional override is caught (review M5)', () => {
  const [g] = classGroups('export const X = ({ dense }) => <p className={cn("cn-s gap-2", dense && "px-1", dense ? "h-6" : "h-8")} />')
  assert.deepEqual(g.segs.map((s) => s.part), [['gap-2'], ['px-1'], ['h-6'], ['h-8']])
  assert.deepEqual(erasedTokens(g, { 'cn-s': 'px-2 h-10' }).sort(), ['h-10', 'px-2'])
})

test('erasedTokens catches a hook token overridden by a later part token, not hook-over-hook (positive control)', () => {
  const map = { 'cn-s': 'px-2 md:sticky', 'cn-b': 'h-10', 'cn-b-sm': 'h-7' }
  // cn("cn-s gap-2", "px-3"): px-3 뒤에 와서 px-2 를 지운다.
  assert.deepEqual(erasedTokens({ segs: [{ hooks: ['cn-s'], part: ['gap-2'] }, { hooks: [], part: ['px-3'] }] }, map), ['px-2'])
  // 같은 문자열의 부품 md:fixed 가 훅의 md:sticky 를 지운다(site-shell 에서 난 모양).
  assert.deepEqual(erasedTokens({ segs: [{ hooks: ['cn-s'], part: ['md:fixed'] }] }, map), ['md:sticky'])
  // variant 훅 h-7 이 base 훅 h-10 을 이기는 것은 의도 — 세지 않는다. variant 부품 h-12 가 base 훅 h-10 을 지우는 것은 센다.
  assert.deepEqual(erasedTokens({ segs: [{ hooks: ['cn-b'], part: [] }, { hooks: ['cn-b-sm'], part: [] }] }, map), [])
  assert.deepEqual(erasedTokens({ segs: [{ hooks: ['cn-b'], part: [] }, { hooks: [], part: ['h-12'] }] }, map), ['h-10'])
})

test('no value-hook token in any ui-src part is erased by the part\'s own tokens (base + every axis value, T11-c2)', () => {
  const base = styleMapOf(BASE_CSS)
  const entries = [['base', base, base], ...listValues().map((v) => { const own = styleMapOf(v.file); return [v.id, { ...base, ...own }, own] })]
  const files = readdirSync(UI_SRC).filter((f) => f.endsWith('.tsx')).sort()
  assert.ok(files.length >= 61, `ui-src 부품 ${files.length}개`)
  const groups = files.flatMap((f) => classGroups(readFileSync(join(UI_SRC, f), 'utf8'), f))
  assert.ok(groups.length > 200, `묶음 ${groups.length}개 — 원천을 제대로 읽었는가`)
  const bad = []
  for (const [id, map, own] of entries) for (const g of groups) {
    const erased = erasedTokens(g, map, (h) => h in own)
    if (erased.length) bad.push(`${id} ${g.at}: ${erased.join(' ')}`)
  }
  assert.deepEqual(bad, [], `부품 토큰에 지워지는 훅 토큰 ${bad.length}건`)
})
