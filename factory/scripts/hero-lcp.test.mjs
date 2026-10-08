// 히어로 LCP 규칙(대장 C173) 시험 — 순수 함수(소스 문자열)와 저장소의 모든 히어로 블록.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/hero-lcp.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixHeroLcp, heroLcpProblems, heroLcpViolations } from './hero-lcp.mjs'
import { readFileSync } from 'node:fs'
import { blockProblems, loadBlocks } from './blocks.mjs'

const wrap = (jsx) => `export function HeroX() {\n  return (\n    <section data-block="hero-x">\n${jsx}\n    </section>\n  )\n}\n`
const bad = (jsx) => heroLcpViolations(wrap(jsx)).map((v) => v.tag)

test('글을 품은 요소에 숨기는 data-enter 가 있으면 위반 — 제목·본문·조상 래퍼·그림 모두', () => {
  assert.deepEqual(bad('<h1 data-enter="" className="a">{copy.title}</h1>'), ['h1'])
  assert.deepEqual(bad('<p data-enter="">본문 글자</p>'), ['p'])
  assert.deepEqual(bad('<div data-enter=""><p>{copy.lede}</p></div>'), ['div'], '조상이 숨기면 자손 글이 함께 숨는다')
  assert.deepEqual(bad('<figure data-enter=""><ImageSlot src="/a.png" /></figure>'), ['figure'])
  assert.deepEqual(bad('<div data-enter=""><img src="/a.png" alt="" /></div>'), ['div'])
  assert.deepEqual(bad('<Display as="h1" data-enter="">{copy.title}</Display>'), ['Display'])
  assert.deepEqual(bad('<h1 data-enter={split ? "" : undefined}>{copy.title}</h1>'), ['h1'], '조건식의 숨기는 갈래도 잡는다')
  assert.deepEqual(bad('<p data-enter={dimEnter}>{copy.x}</p>'), ['p'], '정적으로 알 수 없는 식은 숨긴다고 본다')
  assert.deepEqual(bad('<span data-enter>글</span>'), ['span'], '값 없는 data-enter(true)도 숨긴다')
})

test('제목·문단 태그는 자식이 컴포넌트여도 글을 그린다 — SplitChars 같은 글 컴포넌트가 든 h1 의 숨기는 data-enter 도 위반(PERF2)', () => {
  assert.deepEqual(bad('<h1 data-enter={split ? "" : undefined} className="t"><SplitChars text={copy.title} on={split} /></h1>'), ['h1'])
  assert.deepEqual(bad('<p data-enter=""><Money amount={1} /></p>'), ['p'])
  assert.deepEqual(bad('<h2 data-enter="" />'), ['h2'])
  assert.deepEqual(bad('<h1 data-enter={split ? "keep" : undefined}><SplitChars text={copy.title} on={split} /></h1>'), [], 'keep 갈래는 통과')
  assert.deepEqual(bad('<div data-enter=""><span className="line" /></div>'), [], '제목·문단 태그가 아닌 장식은 그대로 통과')
})

test('Face·DarkZone 의 enter prop 도 data-enter 와 같은 규칙 — 참이면 숨긴다, "keep" 만 통과, 자동 수정은 불리언 식을 keep 으로', () => {
  assert.deepEqual(bad('<Face enter><p>글</p></Face>'), ['Face'])
  assert.deepEqual(bad('<Face enter={clip}><p>글</p></Face>'), ['Face'])
  assert.deepEqual(bad('<DarkZone enter>안내</DarkZone>'), ['DarkZone'])
  assert.deepEqual(bad('<Face enter="keep"><p>글</p></Face>'), [])
  assert.deepEqual(bad('<Face enter={clip ? "keep" : undefined}><p>글</p></Face>'), [])
  assert.deepEqual(bad('<Face enter={clip}><span className="line" /></Face>'), [], '글·그림 없는 장식 칸은 통과')
  assert.deepEqual(bad('<Other enter><p>글</p></Other>'), [], 'enter prop 이 data-enter 가 되는 것은 Face·DarkZone 뿐')
  assert.equal(fixHeroLcp(wrap('<Face enter={clip}><p>글</p></Face>')).includes('enter={clip ? "keep" : undefined}'), true)
  assert.equal(fixHeroLcp(wrap('<DarkZone enter>안내</DarkZone>')).includes('<DarkZone enter="keep">'), true)
})

test('SplitSource(제목의 보이는 사본)는 첫 칠부터 보인다 — data-enter=keep, 모든 히어로가 이것으로 제목을 그린다', () => {
  const src = readFileSync(new URL('../../registry/factory/motion/split-source.tsx', import.meta.url), 'utf8')
  assert.match(src, /data-wf-split="" data-enter="keep"/)
  const heroes = loadBlocks().filter((b) => b.kind === 'hero' && /<SplitSource\b/.test(b.source))
  assert.ok(heroes.length >= 9, `SplitSource 를 쓰는 히어로 ${heroes.length}개`)
})

test('숨기지 않는 것은 통과 — keep · 없음 · 장식(글·그림 없음) · svg 안 · {cond ? "keep" : undefined}', () => {
  assert.deepEqual(bad('<h1 data-enter="keep">{copy.title}</h1>'), [])
  assert.deepEqual(bad('<h1>{copy.title}</h1>'), [])
  assert.deepEqual(bad('<div aria-hidden="true" data-enter="" className="art" />'), [], '글도 그림도 없는 장식')
  assert.deepEqual(bad('<div data-enter=""><span className="line" /></div>'), [])
  assert.deepEqual(bad('<svg data-enter="" viewBox="0 0 1 1"><text>안내</text></svg>'), [], 'svg 는 LCP 후보가 아니다')
  assert.deepEqual(bad('<svg viewBox="0 0 1 1"><g data-enter=""><text>안내</text></g></svg>'), [])
  assert.deepEqual(bad('<h1 data-enter={split ? "keep" : undefined}>{copy.title}</h1>'), [])
  assert.deepEqual(bad('<div data-enter="keep"><p>{copy.lede}</p></div>'), [])
})

test('heroLcpProblems: 요소 이름·줄·이유를 대고, fixHeroLcp 는 위반만 keep 으로 바꾼다(다시 돌리면 그대로)', () => {
  const src = wrap('<h1 data-enter={split ? "" : undefined} className="t">{copy.title}</h1>\n<div aria-hidden="true" data-enter="" className="art" />\n<p data-enter="">본문</p>')
  const problems = heroLcpProblems('hero/x', src)
  assert.equal(problems.length, 2)
  assert.match(problems[0], /hero\/x — 히어로의 글·그림 요소 <h1 className="t"> \(줄 \d+\)이 data-enter 로 숨는다/)
  const fixed = fixHeroLcp(src)
  assert.match(fixed, /<h1 data-enter=\{split \? "keep" : undefined\}/)
  assert.match(fixed, /<p data-enter="keep">/)
  assert.match(fixed, /<div aria-hidden="true" data-enter="" className="art" \/>/, '장식은 그대로')
  assert.deepEqual(heroLcpProblems('hero/x', fixed), [])
  assert.equal(fixHeroLcp(fixed), fixed)
  assert.throws(() => fixHeroLcp(wrap('<p data-enter={dimEnter}>{copy.x}</p>')), /자동 수정할 수 없는/)
})

test('저장소의 히어로 블록 전부가 규칙을 지킨다 — blocks:check(blockProblems)가 같은 규칙을 hero kind 에만 건다', () => {
  const blocks = loadBlocks()
  const heroes = blocks.filter((b) => b.kind === 'hero')
  assert.ok(heroes.length >= 19, `히어로 ${heroes.length}개`)
  for (const b of heroes) assert.deepEqual(heroLcpProblems(`${b.kind}/${b.variant}`, b.source), [], `${b.kind}/${b.variant}`)
  // 배선 확인: 히어로 하나를 일부러 어기면 blockProblems 가 그 문장을 낸다(다른 kind 는 받지 않는다)
  const first = heroes[0]
  const broken = blocks.map((b) => (b === first ? { ...b, source: b.source.replace(/<h1\b/, '<h1 data-enter="" ') } : b))
  assert.ok(blockProblems(broken).some((p) => /히어로의 글·그림 요소 <h1/.test(p) && p.startsWith(`${first.kind}/${first.variant}`)), '규칙이 blockProblems 에 걸려 있다')
  const nonHero = blocks.find((b) => b.kind !== 'hero' && b.source && heroLcpViolations(b.source).length > 0)
  assert.ok(nonHero, '히어로가 아닌 블록 가운데 글을 등장 연출로 숨기는 것이 있다(규칙 밖 — 첫 화면이 아닌 곳의 연출은 그대로 둔다)')
  assert.equal(blockProblems(blocks).some((p) => p.startsWith(`${nonHero.kind}/`) && /히어로의 글·그림/.test(p)), false)
})
