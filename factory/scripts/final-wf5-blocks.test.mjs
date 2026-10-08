// FINAL-WF5 — 블록 원천 검사. 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/final-wf5-blocks.test.mjs
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { blockProblems, loadBlocks, loadShared, blockComponent } from './blocks.mjs'

const made = []
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })
const meta = (o = {}) => ({ kind: 'faq', variant: 'v1', title: 't', layout: 'l1', density: 'comfortable', archetypes: ['saas'], archetypeKinds: ['faq'], states: [], media: [], motion: [], ...o })
function repoWith(body) {
  const r = mkdtempSync(join(tmpdir(), 'wf5-blocks-'))
  made.push(r)
  const d = join(r, 'registry', 'factory', 'blocks', 'faq'); mkdirSync(d, { recursive: true })
  writeFileSync(join(d, 'a.tsx'), `export function ${blockComponent('faq', 'a')}({ id = "faq" }: { id?: string }) { return <section data-block="faq-a" id={id}>${body}</section> }\n`)
  writeFileSync(join(d, 'a.block.json'), JSON.stringify(meta({ variant: 'a', layout: 'a' })))
  writeFileSync(join(d, 'a.fixture.ts'), 'export const fixture = {}; export const fixtureMax = {}; export const fixtureMin = {}\n')
  return r
}
const problems = (body) => blockProblems(loadBlocks(repoWith(body)), { minVariants: 0 }).join('\n')

test('blocks:check: 블록 안 DOM 요소의 id 는 id prop 에서 파생된다 — 글자 그대로 쓴 id="…" 는 위반(한 쪽에 같은 블록 둘이면 id 가 겹친다)', () => {
  assert.match(problems('<h2 id="title">x</h2>'), /faq\/a — DOM id 를 글자 그대로 썼다 \(id="title"\)/)
  assert.match(problems("<div id={'box'}>x</div>"), /faq\/a — DOM id 를 글자 그대로 썼다/)
  assert.match(problems('<label htmlFor="email">x</label><input id="email" />'), /faq\/a — DOM id 를 글자 그대로 썼다 \(id="email"\)/)
})

test('blocks:check: id={`${id}-title`}·id={form.formId}·컴포넌트 prop id="…" 는 통과(음성 대조)', () => {
  assert.doesNotMatch(problems('<h2 id={`${id}-title`}>x</h2><form id={form.formId} />'), /DOM id/)
  assert.doesNotMatch(problems('<PolicyTable id="shipping" />'), /DOM id/)
})

test('blocks:check: 저장소의 모든 블록·조각은 DOM id 를 글자 그대로 쓰지 않는다', () => {
  const p = blockProblems(loadBlocks(), { minVariants: 0, sharedSources: loadShared() }).filter((x) => /DOM id/.test(x))
  assert.deepEqual(p, [])
})
