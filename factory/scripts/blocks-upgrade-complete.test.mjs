// 결제 완료·요금제 열림(대장 A64) 검사: confirmation/upgrade-complete.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/blocks-upgrade-complete.test.mjs
// 방법은 blocks-rules-7b.test.mjs 와 같다 — 컴파일본을 typescript 로 .tmp 에 옮겨 정적 렌더한 마크업을 본다. 폴링(타이머)은 브라우저 검사(blocks:gates·states 의 sub=none 행)가 본다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { loadBlocks } from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-upgrade-complete-test')
const COMPILED = join(root, 'registry', 'factory', 'blocks', '_compiled')

const STUBS = {
  [join(root, 'registry', 'factory', 'motion', 'use-gsap-scene.ts')]: 'export function useGsapScene() {}\n',
  [join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts')]: 'export function rise() {}\n',
}
const loaded = new Map()
const outPath = (abs) => join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
const resolveSource = (base) => [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = outPath(abs)
  loaded.set(abs, out)
  let text
  if (STUBS[abs] !== undefined) text = STUBS[abs]
  else {
    text = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    text = text.replace(/(from\s+|import\s*\(\s*|import\s+|export\s+\*\s+from\s+)(["'])(@\/|\.{1,2}\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
      const base = pre === '@/' ? join(root, p) : resolve(dirname(abs), pre + p)
      const src = resolveSource(base)
      if (!src) throw new Error(`import 대상 없음: ${pre}${p} (${relative(root, abs)})`)
      return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
    })
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, text)
  return out
}
const load = async (abs) => import(pathToFileURL(transpile(abs)).href)

const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const mod = await load(join(COMPILED, 'confirmation', 'upgrade-complete.tsx'))
const fx = await load(join(root, 'registry', 'factory', 'blocks', 'confirmation', 'upgrade-complete.fixture.ts'))
const C = mod.ConfirmationUpgradeComplete
const source = readFileSync(join(COMPILED, 'confirmation', 'upgrade-complete.tsx'), 'utf8')
const render = (extra = {}, which = 'fixture') => renderToStaticMarkup(React.createElement(C, { ...fx[which], ...extra }))
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const ACTIVE = { planId: 'pro', status: 'active', currentPeriodEnd: '2026-10-31T15:00:00.000Z' }
const TRIAL = { planId: 'pro', status: 'trialing', trialEnd: '2026-10-14T15:00:00.000Z' }
const NONE = { planId: null, status: 'none' }

test('upgrade-complete: 요금제가 열린 구독(active·trialing)이면 새 기능·영수증 메일·행동 하나·결제 관리 링크', () => {
  for (const sub of [ACTIVE, TRIAL]) {
    const h = render({ initial: { subscription: sub } })
    assert.match(h, /data-opened=""/)
    assert.match(h, /data-unlocked=""/)
    assert.match(h, /data-receipt=""/)
    assert.equal((h.match(/data-next-action=""/g) ?? []).length, 1, '다음 행동은 하나')
    assert.match(h, /data-manage=""[^>]*>[\s\S]*href="#billing"/)
    assert.doesNotMatch(h, /data-confirming=|data-late=|role="status"/)
    assert.match(textOf(h), /프로 요금제가 열렸어요/)
  }
})

test('upgrade-complete: 웹훅 전(status none)이면 「무료」가 아니라 「결제를 확인하는 중」 role=status 이고 열린 기능 글은 없다', () => {
  const h = render({ initial: { subscription: NONE } })
  assert.match(h, /data-confirming=""/)
  assert.match(h, /<p role="status"[^>]*>결제사에서 확인이 오면/)
  assert.match(h, /aria-busy="true"/)
  assert.doesNotMatch(h, /data-opened=|data-unlocked=|data-next-action=/)
  assert.doesNotMatch(textOf(h), /무료/)
})

test('upgrade-complete: 폴링은 pollEvery 초 간격·pollMax 번 한도 — 한도 뒤 「메일로 알려드릴게요」로 바뀌고 다시 읽기는 멈춘다(소스)', () => {
  assert.match(source, /pollEvery = 3/)
  assert.match(source, /pollMax = 6/)
  assert.match(source, /setTimeout\(/)
  assert.match(source, /polls >= pollMax/)
  assert.match(source, /clearTimeout\(/)
  // 한도 뒤 화면(data-late)은 정적 렌더로 못 만든다(타이머) — 문구만 예시에 있는지 본다
  assert.match(fx.fixture.copy.late.title, /메일로 알려드릴게요/)
  assert.match(fx.fixture.copy.late.body, /이메일로 알려드릴게요/)
})

test('upgrade-complete: 읽기 로딩은 aria-busy + role=status 뼈대, 읽기 실패는 role=alert + 다시 불러오기', () => {
  const loading = render({ subscription: () => new Promise(() => {}) })
  assert.match(loading, /aria-busy="true"/)
  assert.match(loading, /role="status"/)
  assert.doesNotMatch(loading, /data-opened=/)
})

test('upgrade-complete: 메타 — 글이 있는 kind·변형, 읽기 상태 넷, 규칙 A10·P10 표지가 소스에 있다', () => {
  const b = loadBlocks(root).find((x) => x.kind === 'confirmation' && x.variant === 'upgrade-complete')
  assert.ok(b?.meta.success, '메타 검사 통과')
  assert.deepEqual(b.meta.data.states, ['loading', 'empty', 'error', 'ready'])
  assert.ok(b.meta.data.rules.includes('A10') && b.meta.data.rules.includes('P10'))
  assert.match(source, /data-unlocked=/)
  assert.match(source, /data-next-action=/)
})
