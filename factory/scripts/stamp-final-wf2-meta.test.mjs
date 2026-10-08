// FINAL-WF2 AB4·AB8 — 메타 설명. portfolio 는 사이트 설명(site.description)도 부제 칸(subhead·lede·tagline)도 없어 메타·OG 설명이 「확인 필요」였다(감사 B P0),
// 쪽마다 설명이 사이트 하나를 나눠 썼다(P1). 고침: 쪽의 첫 본문 문단·히어로 제목에서 설명을 만들고(160자 안쪽), 그래도 자리표시가 남으면 「공개 불가 — 메타 설명이 자리표시」.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-final-wf2-meta.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cutDescription, pickDescriptionSlot } from '../stamp/page-meta.mjs'
import { BLOCKER, metaPlaceholderProblems } from '../stamp/gen-pages.mjs'
import { resolveRefs } from '../stamp/site-bind.mjs'
import { blockerClass } from '../stamp/blocker-class.mjs'
import { makeRun, gen, root } from './lib/stamp-site-fixtures.mjs'
import { goldenOf, portfolio1 } from './lib/stamp-structure-fixtures.mjs'

const TMP = join(root, '.tmp', 'final-wf2-meta-test')
const P = await makeRun(TMP, goldenOf('portfolio-1').brief, portfolio1) // 최상위 await 는 test() 등록보다 앞에 둔다(먼저 등록한 시험만 끝나면 러너가 거기서 끝낸다)

test('cutDescription: 160자 안이면 그대로, 길면 문장 끝에서, 문장 끝이 없으면 낱말 끝에서 자른다', () => {
  assert.equal(cutDescription('짧은 글이에요.'), '짧은 글이에요.')
  const long = `${'가나다라마바사 '.repeat(8)}첫 문장이 여기서 끝나요. ${'아자차카타파하 '.repeat(20)}`
  const cut = cutDescription(long)
  assert.ok([...cut].length <= 160, String([...cut].length))
  assert.match(cut, /끝나요\.$/)
  const noStop = cutDescription('가나다라마 '.repeat(60))
  assert.ok([...noStop].length <= 160 && !noStop.endsWith(' '))
})

test('pickDescriptionSlot: 부제·본문 순으로 고르고 행동 문구·화면 문구 칸·자리표시는 건너뛴다', () => {
  const e = (id, text, index) => ({ id, text, index })
  assert.deepEqual(pickDescriptionSlot([e('primaryCta', '문의하기 버튼을 눌러요 지금', 0), e('ui:copy.x', '화면 안내 문구가 여기에 있어요', 1), e('body', '새벽 시장을 사흘 걸어 다니며 동선을 익혔어요', 2), e('subhead', '확인 필요', 3)]), { index: 2, text: '새벽 시장을 사흘 걸어 다니며 동선을 익혔어요' })
  assert.equal(pickDescriptionSlot([e('cta', '메일 보내기', 0)]), null)
  assert.equal(pickDescriptionSlot([e('subhead', '짧다', 0)]), null, '12자 미만 부제만 있으면 설명감이 못 된다')
})

test('AB4·AB8 portfolio-1: 사이트 설명과 쪽마다 설명이 본문에서 만들어지고 자리표시가 없다 · 쪽끼리 설명이 겹치지 않는다', async () => {
  const r = await gen(P)
  const site = JSON.parse(readFileSync(join(r.siteDir, 'content', 'site.json'), 'utf8'))
  const resolved = (v) => resolveRefs(v, site)
  assert.ok(site.site.description, '사이트 설명이 비었다')
  const all = [resolved(site.site.description), ...Object.values(site.pages).map((p) => (p.description ? resolved(p.description) : null))]
  for (const d of all.filter(Boolean)) assert.ok(d.trim() && !d.includes('확인 필요') && [...d].length <= 160, d)
  const pageDescs = Object.entries(site.pages).filter(([route]) => route !== '/').map(([, p]) => p.description && resolved(p.description))
  assert.ok(pageDescs.every(Boolean), `쪽 설명이 비었다: ${JSON.stringify(Object.entries(site.pages).map(([k, p]) => [k, !!p.description]))}`)
  assert.equal(new Set(pageDescs).size, pageDescs.length, '쪽끼리 설명이 같다')
  assert.deepEqual(await metaPlaceholderProblems(site), [])
  assert.equal(r.blockers.some((b) => b.startsWith(BLOCKER.metaPlaceholder)), false)
})

test('AB4 음성 대조: 설명이 될 글이 하나도 없으면 「공개 불가 — 메타 설명이 자리표시」(품질) · 「확인 필요」 사이트 설명은 없는 것으로 본다', async () => {
  const bare = await makeRun(TMP, goldenOf('portfolio-1').brief, portfolio1, { patch: (c) => ({ ...c, site: { description: '확인 필요' }, slots: { ...c.slots, copy: c.slots.copy.map((s) => ({ ...s, text: '확인 필요' })) } }) })
  const r = await gen(bare)
  const site = JSON.parse(readFileSync(join(r.siteDir, 'content', 'site.json'), 'utf8'))
  assert.equal(site.site.description === '확인 필요', false, '자리표시 설명이 그대로 남았다')
  const line = r.blockers.find((b) => b.startsWith(BLOCKER.metaPlaceholder))
  assert.ok(line, r.blockers.join('\n'))
  assert.equal(blockerClass(line), 'quality')
})
