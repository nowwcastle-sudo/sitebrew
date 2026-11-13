// 마감 리뷰 입출력(v0.2.6 T12) — 리뷰어가 쓴 두 문서를 읽는 파서와 리뷰 입력 수집. 파일만 읽는 순수 모듈이라 브라우저·빌드 없이 돈다.
//   node --test --test-force-exit --test-timeout=300000 factory/scripts/finish-review.test.mjs
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ReviewFormatError, collectReviewInputs, parseReview, parseVerdict } from '../stamp/finish-review.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const made = []
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'finish-review-')); made.push(d); return d }
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })

const REVIEW = `# Review 1
disposition: fix

## F1
where: hero / 375px
problem: 제목이 로고와 겹친다.
prescription: revise "히어로를 더 차분하게"

## F2
where: header
problem: 로고가 너무 작다.
prescription: human 로고 파일을 더 큰 해상도로 다시 주세요
`

describe('parseReview', () => {
  it('reads findings with revise and human prescriptions', () => {
    const r = parseReview(REVIEW)
    assert.equal(r.round, 1)
    assert.equal(r.disposition, 'fix')
    assert.deepEqual(r.findings.map((f) => [f.id, f.prescription.kind]), [['F1', 'revise'], ['F2', 'human']])
    assert.equal(r.findings[0].prescription.command, '히어로를 더 차분하게')
    assert.equal(r.findings[1].prescription.note, '로고 파일을 더 큰 해상도로 다시 주세요')
  })

  it('accepts a trailing comment on disposition, CRLF line ends and a bare human', () => {
    const md = REVIEW.replace('disposition: fix', 'disposition: fix   # ship | fix').replace('human 로고 파일을 더 큰 해상도로 다시 주세요', 'human').replace(/\n/g, '\r\n')
    const r = parseReview(md)
    assert.equal(r.disposition, 'fix')
    assert.deepEqual(r.findings[1].prescription, { kind: 'human' })
  })

  // 한 줄씩 다른 위반 — 모두 ReviewFormatError 여야 하고, 서로 다른 까닭으로 떨어진다.
  const BAD = {
    'disposition outside the four words': REVIEW.replace('disposition: fix', 'disposition: approve'),
    'no disposition line': REVIEW.replace('disposition: fix\n', ''),
    'ship with a finding': REVIEW.replace('disposition: fix', 'disposition: ship'),
    'fix without a finding': '# Review 1\ndisposition: fix\n',
    'finding without prescription': REVIEW.replace('prescription: revise "히어로를 더 차분하게"\n', ''),
    'revise without a quoted command': REVIEW.replace('revise "히어로를 더 차분하게"', 'revise 히어로를 더 차분하게'),
    'prescription neither revise nor human': REVIEW.replace('revise "히어로를 더 차분하게"', 'redo "히어로"'),
    'same finding id twice': REVIEW.replace('## F2', '## F1'),
    'unknown field in a finding': REVIEW.replace('where: header', 'when: header'),
    'no header': REVIEW.replace('# Review 1\n', ''),
  }
  for (const [name, md] of Object.entries(BAD)) {
    it(`rejects: ${name}`, () => assert.throws(() => parseReview(md), ReviewFormatError))
  }
})

describe('parseVerdict', () => {
  it('reads three statuses and regressions', () => {
    const v = parseVerdict('# Verdict 2\nF1: resolved\nF2: partial\nF3: unresolved\nregression: 모바일 푸터가 잘린다\n')
    assert.equal(v.round, 2)
    assert.deepEqual(v.results, [{ id: 'F1', status: 'resolved' }, { id: 'F2', status: 'partial' }, { id: 'F3', status: 'unresolved' }])
    assert.deepEqual(v.regressions, ['모바일 푸터가 잘린다'])
    assert.deepEqual(parseVerdict('# Verdict 1\nF1: resolved\n').regressions, [])
  })
  it('rejects a status outside the three and a repeated finding', () => {
    assert.throws(() => parseVerdict('# Verdict 1\nF1: fixed\n'), ReviewFormatError)
    assert.throws(() => parseVerdict('# Verdict 1\nF1: resolved\nF1: partial\n'), ReviewFormatError)
  })
})

describe('review-format.md is the grammar the parser reads', () => {
  // 문서의 예시가 파서와 어긋나면 리뷰어가 문서를 따라 쓴 파일이 거절된다.
  // plugins/ 에는 .gitattributes 가 없다(플러그인 디렉터리가 거절한다) — Windows 의 core.autocrlf=true 작업 사본은 CRLF 라 줄바꿈을 맞춰 읽는다.
  const doc = readFileSync(join(root, 'plugins/sitebrew/skills/new/references/review-format.md'), 'utf8').replace(/\r\n/g, '\n')
  const blocks = [...doc.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1])
  it('its review example and its verdict example parse', () => {
    const review = blocks.find((b) => b.startsWith('# Review'))
    const verdict = blocks.find((b) => b.startsWith('# Verdict'))
    assert.ok(review && verdict, 'the document no longer shows both examples')
    assert.equal(parseReview(review).findings.length, 2)
    assert.equal(parseVerdict(verdict).regressions.length, 1)
  })
})

describe('collectReviewInputs', () => {
  const write = (file, text = 'x') => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text) }
  const gate = (run, slug, names) => { for (const n of names) write(join(run, 'b', '07-qa', 'ux', slug, 'gate', n)) }
  const HEROES = ['hero-1440-light.png', 'hero-1440-dark.png', 'hero-375-light.png', 'hero-375-dark.png', 'hero-768-light.png']
  const TILES = [0, 1, 2, 3].flatMap((i) => [`tile_1440_0${i}.png`, `tile_375_0${i}.png`])
  const headOf = (cand) => ({ id: cand.recipe, colorLogic: 'K1', defaultTheme: 'light' })

  it('puts the home page first, caps tiles per width and reads head, brief and blockers', () => {
    const run = tmp()
    gate(run, 'about', HEROES) // 이름 순으로는 home 보다 앞선다 — 그래도 홈이 먼저여야 한다
    gate(run, 'home', [...HEROES, ...TILES])
    write(join(run, 'b', '01-direction.json'), JSON.stringify({ inputHash: 'h', data: { id: 'b', source: 'library', recipe: 'r1-measure', thesis: '조용한 세계' } }))
    write(join(run, 'b', 'candidate.json'), JSON.stringify({ blockers: ['공개 불가 — 예시'] }))
    write(join(run, 'brief.json'), JSON.stringify({ topic: '찻집', archetype: 'local', locale: 'ko', facts: { name: '가상 찻집' }, secret: 'no' }))
    write(join(run, 'stamp-summary.json'), JSON.stringify({ brief: join(run, 'brief.json') }))
    const r = collectReviewInputs(run, 'b', { headOf })
    assert.ok(r.shots[0].path.includes(`${join('ux', 'home', 'gate')}`), 'the home page comes first')
    assert.deepEqual(r.shots.slice(0, 5).map((s) => [s.width, s.kind]), [[1440, 'hero-light'], [1440, 'hero-dark'], [375, 'hero-light'], [375, 'hero-dark'], [768, 'hero-768']])
    assert.equal(r.shots.filter((s) => s.kind === 'tile' && s.path.includes('home')).length, 4, 'two tiles per width')
    assert.deepEqual(r.head, { id: 'r1-measure', source: 'library', colorLogic: 'K1', defaultTheme: 'light', thesis: '조용한 세계' })
    assert.deepEqual(r.brief, { topic: '찻집', archetype: 'local', locale: 'ko', facts: { name: '가상 찻집' } })
    assert.deepEqual(r.blockers, ['공개 불가 — 예시'])
  })

  it('returns no shots without throwing when the captures are missing, and leaves out pages beyond the budget', () => {
    const none = collectReviewInputs(tmp(), 'b', { headOf })
    assert.deepEqual(none.shots, [])
    assert.equal(none.brief, null)

    const run = tmp()
    gate(run, 'home', HEROES)
    gate(run, 'about', HEROES)
    const r = collectReviewInputs(run, 'b', { headOf, maxShots: 7 })
    assert.equal(r.shots.length, 5, 'only the home page fits')
    assert.ok(r.blockers.some((b) => b.includes('일부 쪽 생략') && b.includes('about')))
  })

  it('says so when tiles were cut', () => {
    const run = tmp()
    gate(run, 'home', HEROES)
    write(join(run, 'b', '07-qa', 'ux', 'home', 'gate', 'ux_gate.json'), JSON.stringify({ gate: { '1440-light': { tiles: { truncated: true } } } }))
    assert.ok(collectReviewInputs(run, 'b', { headOf }).blockers.some((b) => b.includes('일부만 봄')))
  })
})
