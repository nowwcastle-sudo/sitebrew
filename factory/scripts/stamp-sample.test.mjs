// 예시 정보(v0.2.6 T6) — stamp 흐름에서 예시가 메모리로만 깔리고, 07 이 입력 대기 사유로 막는지 본다. 가짜 단계 사용.
// 실행: node --test --test-force-exit --test-timeout=180000 factory/scripts/stamp-sample.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXIT, legalState, parseArgs, runStamp, UsageError } from '../stamp/stamp.mjs'
import { inputHash } from '../stamp/run-dir.mjs'
import { loadBrief } from '../stamp/brief.mjs'
import { loadArchetypes } from './archetypes.mjs'
import { blockerClass } from '../stamp/blocker-class.mjs'
import { QA_PREFIX } from '../stamp/qa.mjs'
import { readSampleFacts } from '../stamp/sample-facts.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = join(root, '.tmp', 'stamp-sample-test')
mkdirSync(TMP, { recursive: true })
const fresh = () => mkdtempSync(join(TMP, 'r-'))
const j = (o) => JSON.stringify(o, null, 2) + '\n'
const archetypes = await loadArchetypes()
const BRIEF = { topic: '동네 식빵집', archetype: 'local', locale: 'ko', facts: { name: '달빛베이커리', phone: '02-1234-5678' } }
const writeBrief = (dir, brief = BRIEF) => { const f = join(dir, 'brief.json'); writeFileSync(f, j(brief)); return f }

function fakeDeps() {
  const seen = { sitemapFacts: null, qaCalls: [] }
  const cands = [
    { id: 'a', slot: 'safe', source: 'library', recipe: 'r1-measure' },
    { id: 'b', slot: 'new', source: 'generated', recipe: { id: 'gen-b' }, preset: 'p-b' },
    { id: 'c', slot: 'bold', source: 'generated', recipe: { id: 'gen-c' }, preset: 'p-c' },
  ]
  return {
    seen, say: () => {},
    doctor: async () => ({ ok: true, results: [] }),
    loadBrief,
    loadArchetype: async (id) => archetypes[id],
    weights: () => [],
    directions: async () => ({ candidates: cands.map((c) => ({ ...c })), rejected: [] }),
    screen: async () => {},
    sitemap: async ({ brief }) => { seen.sitemapFacts = brief.facts; return { archetype: brief.archetype, pages: [{ id: 'home', route: '/', sections: [] }], globals: [], blockers: [], facts: Object.keys(brief.facts) } },
    afterSitemap: () => {},
    variants: async () => ({ a: {}, b: {}, c: {} }),
    content: async ({ run, cand }) => {
      const out = join(run.dir, cand.id, '04-content.json')
      return existsSync(out) ? { status: 'ok', content: JSON.parse(readFileSync(out, 'utf8')) } : { status: 'needs-copy', requestFile: out }
    },
    media: async () => ({ plan: 0, assets: 0, placeholders: 0, requests: 0, credits: 0 }),
    pages: async ({ runDir, cand }) => {
      for (const p of ['privacy', 'terms']) {
        const f = join(runDir, cand.id, '07-qa', 'legal', `${p}.draft.json`)
        mkdirSync(dirname(f), { recursive: true })
        writeFileSync(f, j({ markdown: `# ${p}`, clauses: [] })) // 검토 파일(.review.json)은 일부러 없다
      }
      mkdirSync(join(runDir, cand.id, 'site'), { recursive: true })
      return { siteDir: join(runDir, cand.id, 'site'), routes: ['/'], blockers: 0, skipped: 0, build: { code: 0, seconds: 1 }, builtAt: 't' }
    },
    qa: async ({ cand, sample }) => {
      seen.qaCalls.push({ cand: cand.id, sample })
      const blockers = (sample ?? []).map((k) => QA_PREFIX.sample + k)
      return { candidate: cand.id, routes: ['/'], gates: [], aiTell: { threshold: null, scores: {} }, seconds: 1, finishedAt: 'x', publishable: blockers.length === 0, blockers, warnings: [] }
    },
    deploy: async (siteDir) => ({ url: 'https://wf-preview-fake.vercel.app', siteDir }),
  }
}
const copyOut = (run, ids = ['a', 'b', 'c']) => { for (const id of ids) { mkdirSync(join(run, id), { recursive: true }); writeFileSync(join(run, id, '04-content.json'), j({ locale: 'ko', ok: true })) } }

test('인자: --sample-facts 는 보드·--pick 실행에 붙고, 수정 모드와는 못 섞는다', () => {
  assert.equal(parseArgs(['--brief', 'b.json', '--sample-facts']).sampleFacts, true)
  assert.equal(parseArgs(['--brief', 'b.json']).sampleFacts, false)
  assert.throws(() => parseArgs(['--run', 'r', '--pick', 'a', '--revise', '더 대담하게', '--sample-facts']), UsageError)
  assert.throws(() => parseArgs(['--run', 'r', '--redraw-wider', '--sample-facts']), UsageError)
})

test('--sample-facts: 파일을 만들고 02 가 합친 사실을 본다 — 실제 값(전화)이 이기고, 빈 필수(영업시간)는 예시다 · 깃발 없이 다시 돌려도 파일을 읽는다', async () => {
  const dir = fresh()
  const run = join(dir, 'run')
  const deps = fakeDeps()
  const r = await runStamp({ brief: writeBrief(dir), run, until: '02-sitemap', sampleFacts: true }, deps)
  assert.equal(r.code, EXIT.done, r.lines?.join('\n'))
  const sample = readSampleFacts(run)
  assert.ok(sample, 'sample-facts.json 이 생긴다')
  assert.equal(deps.seen.sitemapFacts.phone, '02-1234-5678', '실제 값이 이긴다')
  assert.equal(deps.seen.sitemapFacts.hours, sample.facts.hours)
  assert.ok(!r.summary.sample.remaining.includes('phone') && r.summary.sample.remaining.includes('hours'))

  const deps2 = fakeDeps()
  await runStamp({ brief: writeBrief(dir), run, until: '02-sitemap' }, deps2)
  assert.equal(deps2.seen.sitemapFacts?.hours ?? null, null, '단계가 이미 끝났으면 다시 돌지 않는다')
  const r3 = await runStamp({ brief: writeBrief(dir, { ...BRIEF, facts: { ...BRIEF.facts, hours: '매일 08:00~20:00' } }), run, until: '02-sitemap' }, deps2)
  assert.equal(deps2.seen.sitemapFacts.hours, '매일 08:00~20:00', '깃발 없이도 파일을 읽고, 대표가 준 실제 값이 예시를 이긴다')
  assert.ok(!r3.summary.sample.remaining.includes('hours'))
})

test('예시가 남은 --pick 실행: 법률 검토를 기다리지 않고 07 이 예시 정보 남음(입력 대기)으로 막아 종료 1 · 미리보기 표지', async () => {
  const dir = fresh()
  const run = join(dir, 'run')
  copyOut(run)
  const deps = fakeDeps()
  const r = await runStamp({ brief: writeBrief(dir), run, pick: 'c', deployPreview: true, sampleFacts: true }, deps)
  assert.equal(r.code, EXIT.fail, r.lines.join('\n'))
  assert.equal(r.summary.status, 'gate-failed')
  assert.ok(!r.summary.waiting?.length, '검토 대기(종료 3)로 서지 않는다')
  const call = deps.seen.qaCalls.find((c) => c.cand === 'c')
  assert.ok(call.sample.includes('hours'))
  const board = JSON.parse(readFileSync(join(run, 'c', '08-board.json'), 'utf8')).data
  assert.ok(board.blockers.includes(QA_PREFIX.sample + 'hours'))
  assert.equal(blockerClass(board.blockers[0]), 'input')
  assert.match(board.sampleNotice, /예시 정보/)
  assert.ok(r.lines.some((l) => /예시 정보가 남아 공개 불가/.test(l)))
})

test('예시가 없는 실행은 옛 모양 그대로: 07 입력 해시에 sample 칸이 없고 08 에 표지가 없다', async () => {
  const dir = fresh()
  const run = join(dir, 'run')
  copyOut(run)
  const deps = fakeDeps()
  await runStamp({ brief: writeBrief(dir), run, pick: 'c' }, deps) // 검토 파일이 없어 종료 3 — 07 전에 선다
  assert.equal(deps.seen.qaCalls.length, 0)
  for (const p of ['privacy', 'terms']) writeFileSync(join(run, 'c', '07-qa', 'legal', `${p}.review.json`), j([]))
  const r = await runStamp({ brief: writeBrief(dir), run, pick: 'c' }, deps)
  assert.equal(r.code, EXIT.done, r.lines.join('\n'))
  assert.equal(deps.seen.qaCalls[0].sample, undefined)
  const readJ = (f) => JSON.parse(readFileSync(join(run, 'c', f), 'utf8'))
  const old = inputHash({ pages: readJ('06-pages.json').data, legal: legalState(run, 'c', archetypes.local).hashes })
  assert.equal(readJ('07-qa.json').inputHash, old, '예시가 없으면 07 입력은 {pages, legal} 그대로다')
  assert.equal(JSON.parse(readFileSync(join(run, 'c', '08-board.json'), 'utf8')).data.sampleNotice, undefined)
})
