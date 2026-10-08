// 대장 D237(운영자 결정 2026-10-03): content/breadcrumb 이 「글씨가 너무 작고 흐리다」.
// 고침은 훅만이다 — 목록 글자는 본문 크기(text-base, 예전 text-sm), 링크는 본문 전경색(text-foreground), 현재 쪽은 원래부터 text-foreground,
// 흐린 색(text-muted-foreground)은 구분 기호만 이어받는다(목록의 색을 구분 기호가 상속). 라이브러리 레시피 전부(recipeIds — 지금 15벌)의 컴파일본과 기본 ui 층에서 본다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/breadcrumb-legible.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './lib/stamp-site-fixtures.mjs'
import { recipeIds } from './recipe.mjs'

const FACTORY = join(root, 'registry', 'factory')
const recipes = readdirSync(join(FACTORY, 'r'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
const files = [['ui', join(FACTORY, 'ui', 'breadcrumb.tsx')], ...recipes.map((r) => [r, join(FACTORY, 'r', r, 'ui', 'breadcrumb.tsx')])]
const classOf = (src, slot) => {
  const i = src.indexOf(`data-slot="${slot}"`)
  assert.ok(i >= 0, `${slot} 를 못 찾았다`)
  const m = /className=\{cn\(\s*"([^"]*)"/.exec(src.slice(i, i + 700))
  assert.ok(m, `${slot} 의 className 을 못 읽었다`)
  return m[1].split(/\s+/)
}
// useRender 로 그리는 링크는 data-slot 대신 props 의 className 문자열에서 읽는다
const linkClasses = (src) => (/className: cn\("([^"]*)"/.exec(src)?.[1] ?? '').split(/\s+/)
const has = (list, t) => list.includes(t)

test('breadcrumb 훅: 기본 ui 층 + 레시피 전부 — 목록은 본문 크기, 링크는 본문 전경색, 현재 쪽은 본문 전경색(한 단계 굵게), 흐린 색은 목록에서 구분 기호가 이어받는다', () => {
  assert.deepEqual(recipes.slice().sort(), recipeIds().slice().sort(), `레시피 폴더 ${recipes.length} — 컴파일본이 recipeIds 와 같다`)
  assert.ok(recipes.length >= 10)
  for (const [label, f] of files) {
    assert.ok(existsSync(f), `${label}: ${f}`)
    const src = readFileSync(f, 'utf8')
    const list = classOf(src, 'breadcrumb-list')
    assert.ok(has(list, 'text-base'), `${label}: 목록 글자가 본문 크기(text-base)가 아니다 — ${list.join(' ')}`)
    assert.ok(!has(list, 'text-sm') && !has(list, 'text-xs'), `${label}: 작은 글씨 훅이 남았다`)
    assert.ok(has(list, 'text-muted-foreground'), `${label}: 구분 기호가 이어받을 흐린 색이 목록에 있어야 한다`)
    const link = linkClasses(src)
    assert.ok(has(link, 'text-foreground'), `${label}: 링크가 본문 전경색이 아니다 — ${link.join(' ')}`)
    assert.ok(!link.some((t) => /^text-muted/.test(t)), `${label}: 링크에 흐린 색`)
    const page = classOf(src, 'breadcrumb-page')
    assert.ok(has(page, 'text-foreground') && has(page, 'font-medium') && !has(page, 'font-normal'), `${label}: 현재 쪽은 본문 전경색 + 한 단계 굵게여야 한다 — ${page.join(' ')}`)
    const sep = classOf(src, 'breadcrumb-separator')
    assert.ok(!has(sep, 'text-foreground'), `${label}: 구분 기호는 흐린 색을 이어받는다(전경색 금지)`)
  }
})

test('breadcrumb 블록 원천: 인라인 모양 클래스를 쓰지 않는다 — 크기·색은 훅이 정한다(블록 띠 훅은 본문 크기)', () => {
  const src = readFileSync(join(FACTORY, 'blocks', 'content', 'breadcrumb.tsx'), 'utf8')
  assert.ok(!/text-(xs|sm|muted)|opacity-|text-\[/.test(src), '블록 코드에 크기·색 클래스가 있다')
  const css = readFileSync(join(FACTORY, 'styles', 'base.css'), 'utf8')
  assert.match(css, /\.cn-block-content-crumbs \{[^}]*text-base/, '띠 훅이 본문 크기')
})

test('음성 대조: 예전 훅(text-sm · 링크에 색 없음)은 이 검사가 잡는다', () => {
  const OLD_LIST = '"gap-1.5 text-sm flex flex-wrap items-center wrap-break-word text-muted-foreground"'
  const oldSrc = `<ol data-slot="breadcrumb-list" className={cn(${OLD_LIST}, className)} />`
  assert.ok(has(classOf(oldSrc, 'breadcrumb-list'), 'text-sm'))
  assert.ok(!has(classOf(oldSrc, 'breadcrumb-list'), 'text-base'))
  const oldLink = 'className: cn("min-h-6 relative inline-flex items-center transition-[color] hover:text-foreground", className)'
  assert.ok(!has(linkClasses(oldLink), 'text-foreground'), 'hover:text-foreground 는 평소 색이 아니다')
})
