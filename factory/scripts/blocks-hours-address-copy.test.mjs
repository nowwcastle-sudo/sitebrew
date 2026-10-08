// FIT-8: 영업시간·오시는 길 블록 — 주소가 「확인 필요」 자리 표시면 「주소 복사」 단추를 그리지 않는다(갈 곳 없는 행동 없음). 실제 주소면 있다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/blocks-hours-address-copy.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-hours-address-copy-test')
const loaded = new Map()
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const load = (rel) => import(pathToFileURL(transpile(join(root, rel))).href)
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement
const mod = await load('registry/factory/blocks/hours-location/hours-table-map-link.tsx')
const fx = await load('registry/factory/blocks/hours-location/hours-table-map-link.fixture.ts')
const render = (copyPatch) => renderToStaticMarkup(h(mod.HoursLocationHoursTableMapLink, { ...fx.fixture, copy: { ...fx.fixture.copy, ...copyPatch } }))
const COPY_LABEL = fx.fixture.copy.copyLabel

test('양성 대조: 실제 주소면 복사 단추가 있다', () => {
  assert.ok(fx.fixture.copy.address.length > 0 && !/확인 필요|To be confirmed/.test(fx.fixture.copy.address))
  assert.ok(render({}).includes(COPY_LABEL), '복사 단추 글자가 그려진다')
})

for (const [name, address] of [['확인 필요', '확인 필요'], ['To be confirmed', 'To be confirmed'], ['빈 문자열', '  ']]) {
  test(`주소가 ${name}면 복사 단추를 그리지 않는다`, () => {
    const html = render({ address })
    assert.equal(html.includes(COPY_LABEL), false, '복사 단추 없음')
    assert.equal(html.includes('data-copy-text'), false)
  })
}

test('지도 링크: 가는 곳이 자리 표시거나 비면 그리지 않는다', () => {
  const maps = [{ label: '지도A', href: '확인 필요' }, { label: '지도B', href: '' }, { label: '지도C', href: 'https://example.com/m' }]
  const html = render({ maps })
  assert.equal(html.includes('지도A') || html.includes('지도B'), false)
  assert.ok(html.includes('지도C'))
})
