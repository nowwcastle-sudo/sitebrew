// FV1 FOLLOW — C393: r5-celadon 의 대표 히어로 banded-full-bleed 를 portfolio 에서도 쓴다.
// 블록 메타·원형 JSON 허용 목록 + binder 가 예시 문단(copy.paragraphs)을 이 사업의 글로 바꾸거나 비운다(예시 글을 싣지 않는다).
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/stamp-follow-c393.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bindSection } from '../stamp/gen-pages.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))
const BLOCK = 'block-hero-banded-full-bleed'
const routes = { home: '/' }
const bind = (content, copy = {}, locale = 'ko') =>
  bindSection({ key: 'home/statement', block: BLOCK, content, copyIndex: new Map(Object.entries(copy)), routes, locale, navLinks: () => [], primaryCta: () => ({ href: { $ref: 'contact.email', as: 'mailto' } }), secondaryHref: () => '/' })

const PORTFOLIO = { archetype: 'portfolio', locale: 'ko', site: { name: '달빛 스튜디오' }, contact: { email: 'hello@example.org' } }

test('C393: 블록 메타 archetypes 에 portfolio 가 있고 원형 JSON 의 첫 화면 섹션이 이 블록을 허용한다', () => {
  assert.ok(readJson('registry/factory/blocks/hero/banded-full-bleed.block.json').archetypes.includes('portfolio'))
  const home = readJson('registry/factory/archetypes/portfolio.json').pages.find((p) => p.id === 'home')
  const first = home.sections.find((s) => s.blockKinds?.includes('hero'))
  assert.ok(first.allowedVariants.includes(BLOCK))
})

test('C393: portfolio 첫 화면 한 문장 칸(h1)만 있으면 제목은 그 칸, 문단은 비운다 — 예시 문단이 남지 않는다', async () => {
  const r = await bind(PORTFOLIO, { 'home/statement/h1#0': 0 })
  assert.ok(r.props, r.why)
  assert.deepEqual(r.props.copy.title, { $ref: 'slots.copy.0.text' })
  assert.deepEqual(r.props.copy.paragraphs, [])
  assert.equal(r.issues.filter((i) => i.why === 'leak' || i.why === 'marker').length, 0, JSON.stringify(r.issues))
})

test('C393: 부제 문구 칸이 있으면 문단 하나로 묶는다', async () => {
  const r = await bind(PORTFOLIO, { 'home/statement/h1#0': 0, 'home/statement/subhead#0': 1 })
  assert.deepEqual(r.props.copy.paragraphs, [{ $ref: 'slots.copy.1.text' }])
})

// T21(음성 대조): 이 문단 처리는 portfolio 에서만 바뀐다 — 다른 원형은 블록 예시 문단이 그대로 남아(「예시」 표지) 예전 길(누설 이슈 → 03 이 뒤로 미룸·06 blocker)을 탄다.
test('T21: brand·commerce 는 같은 블록의 문단 처리가 예전 그대로다 — 예시 문단이 남고 marker·leak 이슈가 난다(portfolio 와 다름)', async () => {
  for (const content of [
    { archetype: 'brand', locale: 'ko', organization: { name: '솔결', email: 'hello@example.org' } },
    { archetype: 'commerce', locale: 'ko', business: { name: '달빛' } },
  ]) {
    const r = await bind(content, { 'home/statement/h1#0': 0, 'home/statement/subhead#0': 1 })
    assert.ok(r.props, r.why)
    const paragraphs = r.props.copy.paragraphs
    assert.ok(Array.isArray(paragraphs) && paragraphs.length >= 2, `${content.archetype}: 예시 문단이 그대로 남아야 한다`)
    assert.ok(paragraphs.every((p) => typeof p === 'string'), `${content.archetype}: 문구 칸 $ref 로 바뀌지 않는다`)
    const whys = r.issues.map((i) => i.why)
    assert.ok(whys.includes('marker') && whys.includes('leak'), `${content.archetype}: ${JSON.stringify(whys)}`)
  }
  const pf = await bind(PORTFOLIO, { 'home/statement/h1#0': 0, 'home/statement/subhead#0': 1 })
  assert.ok(pf.props.copy.paragraphs.every((p) => typeof p === 'object'), '양성 대조: portfolio 는 문구 칸 $ref')
})
