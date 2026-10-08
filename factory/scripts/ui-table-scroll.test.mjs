// 가로로 스크롤되는 표 칸의 키보드 접근(대장 A183, WCAG 2.1.1·KWCAG 6.1.1 — axe `scrollable-region-focusable`, 375px).
// ui `table` 부품의 컨테이너(`div[data-slot=table-container]`, `overflow-x-auto`)가 넘칠 때 키보드로 움직일 수 있어야 한다:
//   tabindex="0" + role="region" + 이름(label prop → 없으면 표 캡션 글). 이름 없는 region 은 랜드마크가 아니므로 이름이 없으면 role 은 달지 않는다.
// 넘치지 않을 때도 항상 준다(근거: 서버 렌더 결과가 같아야 하이드레이션 어긋남이 없고, 너비는 레시피·글자 크기·언어마다 달라 서버가 넘침을 알 수 없다 — 잃는 것: 안 넘치는 표에도 탭 멈춤 1개).
// 정적 시험(브라우저 없음): 부품 원천을 typescript 로 옮겨 react-dom/server 로 그린다. 컴파일본(레시피별 ui)도 같은 속성이 있는지 글자로 본다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/ui-table-scroll.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(import.meta.dirname, '..', '..')
const OUT = join(root, '.tmp', 'ui-table-scroll-test')
mkdirSync(OUT, { recursive: true })

/** 부품 소스(.tsx)를 옮겨 `cn` 가짜를 연결한다 — 어느 파일이든 같은 방식으로 불러 원천·컴파일본을 같은 시험에 건다. */
async function load(file, tag) {
  const cnFile = join(OUT, 'cn.mjs')
  writeFileSync(cnFile, 'export const cn = (...a) => a.flat().filter(Boolean).join(" ")\n')
  let { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  outputText = outputText.replace(/from\s+(["'])(?:cn|@\/lib\/utils)\1/g, `from "${pathToFileURL(cnFile).href}"`)
  const out = join(OUT, `${tag}.mjs`)
  writeFileSync(out, outputText)
  return import(pathToFileURL(out).href)
}
const { createElement: h } = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const container = (html) => html.match(/<div[^>]*data-slot="table-container"[^>]*>/)?.[0] ?? ''

const SRC = join(root, 'registry', 'factory', 'ui-src', 'table.tsx')
const mod = await load(SRC, 'src')
const tableWith = (props, ...children) => renderToStaticMarkup(h(mod.Table, props, ...children))

test('A183: 스크롤 칸에 tabindex=0 · role=region · 이름(캡션 글)이 있다', () => {
  const c = container(tableWith({}, h(mod.TableCaption, null, '요금제별 기능 비교'), h(mod.TableBody, null, h(mod.TableRow, null, h(mod.TableCell, null, 'a')))))
  assert.match(c, /tabindex="0"/)
  assert.match(c, /role="region"/)
  assert.match(c, /aria-label="요금제별 기능 비교"/)
  assert.match(c, /overflow-x-auto/, '스크롤 칸 그대로(이 속성들이 붙는 대상)')
})

test('A183: 일반 <caption>(sr-only) 글도 이름이 되고, label prop 이 캡션보다 앞선다', () => {
  const a = container(tableWith({}, h('caption', { className: 'sr-only' }, '추세 표'), h(mod.TableBody, null)))
  assert.match(a, /aria-label="추세 표"/)
  const b = container(tableWith({ label: '직접 준 이름' }, h(mod.TableCaption, null, '캡션'), h(mod.TableBody, null)))
  assert.match(b, /aria-label="직접 준 이름"/)
  assert.doesNotMatch(b, /aria-label="캡션"/)
})

test('A183: 이름을 알 수 없으면 role=region 은 달지 않는다(이름 없는 region 은 랜드마크가 아니다) — tabindex 는 그대로(키보드 접근이 목적)', () => {
  const c = container(tableWith({}, h(mod.TableBody, null)))
  assert.match(c, /tabindex="0"/)
  assert.doesNotMatch(c, /role="region"/)
  assert.doesNotMatch(c, /aria-label=/)
})

test('A183: label 은 표 요소로 새지 않는다(컨테이너 속성이다) — 표 요소 속성은 그대로 표로 간다', () => {
  const html = tableWith({ label: '이름', 'data-density': 'compact' }, h(mod.TableBody, null))
  assert.match(html, /<table[^>]*data-density="compact"/)
  assert.doesNotMatch(html.match(/<table[^>]*>/)[0], /label/)
})

test('A183: 포커스가 보인다 — 키보드 초점 링(불투명·2px 이상, scroll-area 와 같은 규칙)', () => {
  const c = container(tableWith({}, h(mod.TableCaption, null, '표'), h(mod.TableBody, null)))
  assert.match(c, /focus-visible:ring-\[3px\]/)
  assert.match(c, /focus-visible:ring-ring/)
})

test('A183: 컴파일본 — registry/factory/ui 와 레시피 r/*/ui 의 table.tsx 가 같은 속성을 가진다(원천만 고치고 gen:all 을 빠뜨리면 실패)', () => {
  const files = [join(root, 'registry', 'factory', 'ui', 'table.tsx')]
  const rdir = join(root, 'registry', 'factory', 'r')
  for (const r of readdirSync(rdir)) { const f = join(rdir, r, 'ui', 'table.tsx'); if (existsSync(f)) files.push(f) }
  assert.ok(files.length >= 11, `컴파일본 ${files.length}개`)
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    for (const want of ['tabIndex={0}', 'role=', 'aria-label=', 'focus-visible:ring-[3px]']) assert.ok(text.includes(want), `${f}: ${want}`)
  }
})
