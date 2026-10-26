// stamp CLI(P3-3 Task 14) — 가짜 단계로 흐름을 본다: 이어하기·종료 3 대기·--until·--pick·잘못된 브리프 → 2.
// 진짜 단계 묶음은 「진짜 배선」 시험 하나만(01~03, 서버·Chrome·빌드 없음). 골든 실행은 docs/qa/p3-3-stamp-runs.md.
// 실행: node --test --test-force-exit --test-timeout=180000 factory/scripts/stamp-cli.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { EXIT, PICKS, defaultDeps, legalState, parseArgs, runRedrawWider, runStamp, boardData, UsageError } from '../stamp/stamp.mjs'
import { inputHash } from '../stamp/run-dir.mjs'
import { loadHandles } from '../stamp/handles.mjs'
import { loadLexicon } from '../vocab/lexicon.mjs'
import { loadBrief, briefToSeed } from '../stamp/brief.mjs'
import { loadArchetypes } from './archetypes.mjs'
import { AXIS_COUNT, DirectionsShortError, MIN_AXES } from '../stamp/directions.mjs'
import { MOCK_PREVIEW_BLOCKER, MOCK_PREVIEW_NOTICE, blockerClass } from '../stamp/blocker-class.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BRIEFS = join(root, 'factory', 'stamp', 'briefs')
const TMP = join(root, '.tmp', 'stamp-cli-test')
mkdirSync(TMP, { recursive: true })
const fresh = () => mkdtempSync(join(TMP, 'r-'))
const readJ = (f) => JSON.parse(readFileSync(f, 'utf8'))
const j = (o) => JSON.stringify(o, null, 2) + '\n'

const BRIEF = { topic: '동네 식빵집', archetype: 'local', locale: 'ko', facts: { name: '달빛베이커리', phone: '02-1234-5678' } }
function writeBrief(dir, brief = BRIEF) {
  const file = join(dir, 'brief.json')
  writeFileSync(file, j(brief))
  return file
}

// ─── 가짜 단계 묶음 ───
function fakeDeps(over = {}) {
  const calls = {}
  const hit = (k) => { calls[k] = (calls[k] ?? 0) + 1 }
  const cands = [
    { id: 'a', slot: 'safe', source: 'library', recipe: 'r1-measure' },
    { id: 'b', slot: 'new', source: 'generated', recipe: { id: 'gen-b' }, preset: 'p-b' },
    { id: 'c', slot: 'bold', source: 'generated', recipe: { id: 'gen-c' }, preset: 'p-c' },
  ]
  const deps = {
    calls, say: () => {},
    doctor: async () => { hit('doctor'); return { ok: true, results: [{ id: 'fake', ok: true, message: 'ok' }] } },
    loadBrief: (f) => { hit('loadBrief'); return loadBrief(f) },
    loadArchetype: async (id) => ({ id, legal: { pages: ['privacy', 'terms'] } }),
    weights: () => [],
    directions: async () => { hit('directions'); return { candidates: cands.map((c) => ({ ...c })), rejected: [] } },
    screen: async () => { hit('screen') },
    sitemap: async ({ brief }) => { hit('sitemap'); return { archetype: brief.archetype, pages: [{ id: 'home', route: '/', sections: [] }], globals: [], blockers: [], facts: Object.keys(brief.facts) } },
    afterSitemap: () => {},
    variants: async () => { hit('variants'); return { a: { 'home/hero': 'block-hero-x' }, b: { 'home/hero': 'block-hero-y' }, c: { 'home/hero': 'block-hero-z' } } },
    content: async ({ run, cand }) => {
      hit(`content:${cand.id}`)
      const requestFile = join(run.dir, cand.id, '04-content.request.json')
      mkdirSync(dirname(requestFile), { recursive: true })
      writeFileSync(requestFile, j({ candidate: cand.id }))
      const out = join(run.dir, cand.id, '04-content.json')
      if (!existsSync(out)) return { status: 'needs-copy', requestFile }
      return { status: 'ok', content: readJ(out), requestFile }
    },
    media: async ({ cand }) => { hit(`media:${cand.id}`); return { plan: 0, assets: 0, placeholders: 1, requests: 0, credits: 0 } },
    pages: async ({ runDir, cand }) => {
      hit(`pages:${cand.id}`)
      if (over.failPages === cand.id) throw new Error('도구 실패: next build 종료 1 — build.log')
      for (const p of ['privacy', 'terms']) {
        const f = join(runDir, cand.id, '07-qa', 'legal', `${p}.draft.json`)
        mkdirSync(dirname(f), { recursive: true })
        writeFileSync(f, j({ markdown: `# ${p}`, clauses: [] }))
      }
      mkdirSync(join(runDir, cand.id, 'site'), { recursive: true })
      return { siteDir: join(runDir, cand.id, 'site'), routes: ['/'], blockers: 0, skipped: 0, build: { code: 0, seconds: 1 }, builtAt: `t${calls[`pages:${cand.id}`]}` }
    },
    qa: async ({ cand }) => {
      hit(`qa:${cand.id}`)
      return {
        candidate: cand.id, routes: ['/'], gates: over.qaGates ?? [], aiTell: { threshold: null, scores: {} }, seconds: 1, finishedAt: 'x',
        publishable: over.publishable ?? true, blockers: over.publishable === false ? ['공개 불가 — 확인 필요 사실: business.phone', '공개 불가 — 법률 검토 미완: privacy·terms'] : [], warnings: [],
      }
    },
    deploy: async (siteDir) => { hit('deploy'); return { url: 'https://wf-preview-fake.vercel.app', siteDir } },
    ...over.deps,
  }
  return deps
}
const copyOut = (run, ids = PICKS) => { for (const id of ids) { mkdirSync(join(run, id), { recursive: true }); writeFileSync(join(run, id, '04-content.json'), j({ locale: 'ko', ok: true })) } }
const reviewOut = (run, id) => { for (const p of ['privacy', 'terms']) writeFileSync(join(run, id, '07-qa', 'legal', `${p}.review.json`), j([])) }

// ─── 1. 인자 ───

test('parseArgs: 정상 · 단계 이름 · 잘못된 인자는 UsageError', () => {
  const o = parseArgs(['--brief', 'b.json', '--run', 'out', '--until', '4', '--pick', 'c', '--deploy-preview'])
  assert.deepEqual(o, { brief: 'b.json', run: 'out', until: '04-content', pick: 'c', deployPreview: true, golden: null, allGolden: false })
  assert.equal(parseArgs(['--brief', 'b.json', '--until', '05-media']).until, '05-media')
  assert.equal(parseArgs(['--brief', 'b.json']).pick, null)
  for (const bad of [[], ['--brief'], ['--brief', 'b', '--pick', 'd'], ['--brief', 'b', '--until', '09'], ['--brief', 'b', '--deploy-preview'], ['--brief', 'b', '--nope'], ['--brief', 'b', '--pick', '--until', '2']]) {
    assert.throws(() => parseArgs(bad), UsageError, JSON.stringify(bad))
  }
})

test('CLI 종료 2: 인자 오류(프로세스로 — 비동기 spawn 아님, 도구 호출 없이 끝난다)', () => {
  const r = spawnSync(process.execPath, [join(root, 'factory', 'stamp', 'stamp.mjs'), '--pick', 'z'], { encoding: 'utf8', timeout: 60_000 })
  assert.equal(r.status, EXIT.args)
  assert.match(r.stderr, /사용법/)
})

// ─── 2. 잘못된 브리프 → 2 (doctor 도 부르지 않는다) ───

test('잘못된 브리프 → 종료 2, doctor·단계 아무것도 안 돈다', async () => {
  const dir = fresh()
  for (const [name, body] of [['missing', null], ['json', '{ not json'], ['locale', j({ ...BRIEF, locale: 'ja' })], ['extra', j({ ...BRIEF, nope: 1 })], ['archetype', j({ ...BRIEF, archetype: 'shop' })]]) {
    const file = join(dir, `${name}.json`)
    if (body !== null) writeFileSync(file, body)
    const deps = fakeDeps()
    const r = await runStamp({ brief: file, run: join(dir, `run-${name}`), until: null, pick: null, deployPreview: false }, deps)
    assert.equal(r.code, EXIT.args, name)
    assert.equal(r.summary.status, 'bad-brief')
    assert.equal(deps.calls.doctor, undefined, `${name}: doctor 를 부르면 안 된다`)
    assert.equal(deps.calls.directions, undefined)
  }
})

test('원형 로더가 모르는 원형 → 종료 2', async () => {
  const dir = fresh()
  const deps = fakeDeps({ deps: { loadArchetype: async () => undefined } })
  const r = await runStamp({ brief: writeBrief(dir), run: join(dir, 'run') }, deps)
  assert.equal(r.code, EXIT.args)
})

// ─── 3. doctor ───

test('doctor 실패 → 종료 1(tool-failed), 01 을 시작하지 않는다', async () => {
  const dir = fresh()
  const deps = fakeDeps({ deps: { doctor: async () => ({ ok: false, results: [{ id: 'LAW_API_OC', ok: false, message: '도구 실패: LAW_API_OC 없음' }] }) } })
  const lines = []
  deps.say = (s) => lines.push(s)
  const r = await runStamp({ brief: writeBrief(dir), run: join(dir, 'run') }, deps)
  assert.equal(r.code, EXIT.fail)
  assert.equal(r.summary.status, 'tool-failed')
  assert.equal(deps.calls.directions, undefined)
  assert.ok(lines.some((l) => /LAW_API_OC 없음/.test(l)))
  assert.equal(readJ(join(dir, 'run', 'stamp-summary.json')).status, 'tool-failed')
})

// ─── 4. 보드 실행: 종료 3 대기 → 이어하기 → 끝 → 건너뛰기 ───

test('보드 실행: 04 에서 종료 3 + 대기 파일 경로 → 문구가 오면 08 까지 → 다시 돌리면 아무것도 안 만든다', async () => {
  const dir = fresh()
  const brief = writeBrief(dir)
  const run = join(dir, 'run')
  const deps = fakeDeps()
  const lines = []
  deps.say = (s) => lines.push(s)

  const r1 = await runStamp({ brief, run }, deps)
  assert.equal(r1.code, EXIT.waiting, '문구 요청 파일만 있고 04-content.json 이 없다')
  assert.equal(r1.summary.status, 'waiting')
  assert.deepEqual(r1.summary.waiting.map((w) => w.cand), ['a', 'b', 'c'])
  for (const w of r1.summary.waiting) {
    assert.ok(w.file.endsWith('04-content.request.json') && existsSync(w.file), '대기 파일 경로가 실제 파일이다')
    assert.ok(lines.some((l) => l.includes(w.file)), '대기 파일 경로를 출력한다')
  }
  assert.equal(deps.calls['media:a'], undefined, '대기 중에는 05 이후를 돌리지 않는다')
  assert.equal(deps.calls.sitemap, 3)

  copyOut(run)
  const r2 = await runStamp({ brief, run }, deps)
  assert.equal(r2.code, EXIT.done, r2.lines.join('\n'))
  for (const id of PICKS) {
    for (const s of ['01-direction', '02-sitemap', '03-variants', '04-content', '05-media', '06-pages', '07-qa', '08-board']) {
      // 04-content.json 은 에이전트가 쓴 것 그대로 — 단계 파일 검사는 나머지만
      assert.ok(existsSync(join(run, id, `${s}.json`)), `${id}/${s}.json`)
    }
    assert.equal(deps.calls[`pages:${id}`], 1)
    assert.equal(deps.calls[`qa:${id}`], 1)
    const board = readJ(join(run, id, '08-board.json')).data
    assert.equal(board.candidate, id)
    assert.equal(board.publishable, true)
  }
  assert.equal(r2.summary.candidates.length, 3)
  assert.equal(deps.calls.deploy, undefined, '--deploy-preview 없이는 배포하지 않는다')

  const timings = readJ(join(run, 'stamp-timings.json'))
  assert.ok(timings.some((t) => t.step === '06-pages' && t.cand === 'b'), '만든 단계마다 시간을 적는다')
  const before = { ...deps.calls }
  const n = timings.length
  const r3 = await runStamp({ brief, run }, deps)
  assert.equal(r3.code, EXIT.done)
  for (const k of ['sitemap', 'variants', 'media:a', 'pages:a', 'pages:b', 'qa:c', 'directions']) assert.equal(deps.calls[k], before[k], `${k}: 이어하기가 끝난 단계를 다시 만들었다`)
  assert.equal(readJ(join(run, 'stamp-timings.json')).length, n, '건너뛴 단계는 시간을 적지 않는다')
})

test('06 에서 죽은 뒤 다시 돌리면 01~05 는 건너뛰고 죽은 후보의 06 부터(Review Focus 6)', async () => {
  const dir = fresh()
  const brief = writeBrief(dir)
  const run = join(dir, 'run')
  copyOut(run)
  const deps = fakeDeps({ failPages: 'b' })
  const r1 = await runStamp({ brief, run }, deps)
  assert.equal(r1.code, EXIT.fail)
  assert.equal(r1.summary.status, 'tool-failed')
  assert.deepEqual(r1.summary.failures.map((f) => [f.stage, f.cand]), [['06-pages', 'b']])
  assert.equal(deps.calls['pages:a'], 1, '다른 후보는 계속 만든다')
  assert.ok(!existsSync(join(run, 'b', '06-pages.json')), '실패한 단계는 단계 파일을 남기지 않는다')
  const before = { ...deps.calls }

  const deps2 = fakeDeps()
  const r2 = await runStamp({ brief, run }, deps2)
  assert.equal(r2.code, EXIT.done, r2.lines.join('\n'))
  assert.equal(deps2.calls.pages, undefined)
  assert.equal(deps2.calls['pages:b'], 1, '죽은 후보만 다시')
  assert.equal(deps2.calls['pages:a'], undefined, '끝난 후보는 건너뛴다')
  assert.equal(deps2.calls['media:b'], undefined, '05 는 건너뛴다')
  assert.equal(deps2.calls.sitemap, undefined, '02 는 건너뛴다')
  assert.equal(deps2.calls.variants, undefined)
  assert.equal(deps2.calls.directions, undefined)
  void before
})

test('C314: 06 입력 해시가 코드 열쇠를 본다 — 입력(02~05)은 같은데 코드 열쇠만 바뀌면 06 이 다시 돌고(07 도), 같으면 건너뛴다', async () => {
  const dir = fresh()
  const brief = writeBrief(dir)
  const run = join(dir, 'run')
  copyOut(run)
  let key = 'code-v1'
  const deps = fakeDeps({ deps: { pagesKey: () => key } })
  const r1 = await runStamp({ brief, run, until: '06-pages' }, deps)
  assert.equal(r1.code, EXIT.done, r1.lines.join('\n'))
  for (const id of PICKS) assert.equal(deps.calls[`pages:${id}`], 1)
  // 같은 열쇠로 다시 — 건너뛴다
  await runStamp({ brief, run, until: '06-pages' }, deps)
  for (const id of PICKS) assert.equal(deps.calls[`pages:${id}`], 1, `${id}: 코드가 그대로인데 06 이 다시 돌았다`)
  // 열쇠만 바뀜(02~05 입력은 그대로) — 06 이 다시 돈다
  key = 'code-v2'
  await runStamp({ brief, run, until: '06-pages' }, deps)
  for (const id of PICKS) assert.equal(deps.calls[`pages:${id}`], 2, `${id}: 코드 열쇠가 바뀌었는데 06 이 안 돌았다`)
  assert.equal(deps.calls.sitemap, 3, '앞 단계(02)는 다시 돌지 않는다')
  assert.equal(deps.calls['media:a'], 1, '앞 단계(05)는 다시 돌지 않는다')
  // 06 이 다시 돌면 07 도 다시 돈다(07 입력 = 06 결과)
  await runStamp({ brief, run }, deps)
  for (const id of PICKS) assert.equal(deps.calls[`qa:${id}`], 1)
  key = 'code-v3'
  await runStamp({ brief, run }, deps)
  for (const id of PICKS) { assert.equal(deps.calls[`pages:${id}`], 3); assert.equal(deps.calls[`qa:${id}`], 2, `${id}: 06 이 새로 만들어졌는데 07 이 옛 결과를 썼다`) }
})

test('C314: 진짜 코드 열쇠 — 블록·템플릿·06 코드(import 닫힘)를 보고, 같은 파일이면 같은 값이다', async () => {
  const { pagesCodeKey, importClosure } = await import('../stamp/pages-key.mjs')
  const k = pagesCodeKey()
  assert.match(k, /^[0-9a-f]{64}$/)
  assert.equal(pagesCodeKey(), k, '그대로면 같은 키')
  const files = importClosure().map((f) => f.replace(/\\/g, '/'))
  for (const want of ['stamp/gen-pages.mjs', 'stamp/site-bind.mjs', 'stamp/site-install.mjs', 'stamp/content-sections.mjs', 'stamp/site-media.mjs', 'stamp/ui-copy.mjs', 'legal/drafts.mjs']) assert.ok(files.some((f) => f.endsWith(want)), `${want} 가 열쇠에 안 든다`)
  const deps = await defaultDeps({ say: () => {} })
  assert.equal(typeof deps.pagesKey, 'function', '진짜 단계 묶음이 열쇠를 낸다')
  assert.equal(await deps.pagesKey(), k)
})

test('브리프 사실을 고치면 그 단계(02)부터 다시 돈다 — 앞 단계 입력이 바뀌었으므로', async () => {
  const dir = fresh()
  const run = join(dir, 'run')
  copyOut(run)
  const deps = fakeDeps()
  await runStamp({ brief: writeBrief(dir), run }, deps)
  assert.equal(deps.calls.sitemap, 3)
  const deps2 = fakeDeps()
  const r = await runStamp({ brief: writeBrief(dir, { ...BRIEF, facts: { ...BRIEF.facts, email: 'new@example.com' } }), run }, deps2)
  assert.equal(r.code, EXIT.done)
  assert.equal(deps2.calls.sitemap, 3, '사이트맵이 다시 만들어진다')
  assert.equal(deps2.calls['pages:a'], 1, '뒤 단계도 따라 다시 돈다')
})

// ─── 5. --until ───

test('--until: 그 단계까지만 돌고 종료 0, 다음 단계 함수는 부르지 않는다', async () => {
  const dir = fresh()
  const brief = writeBrief(dir)
  const cases = [['01-direction', 'sitemap'], ['02-sitemap', 'variants'], ['03-variants', 'content:a']]
  for (const [until, notCalled] of cases) {
    const run = join(dir, `run-${until}`)
    const deps = fakeDeps()
    const r = await runStamp({ brief, run, until }, deps)
    assert.equal(r.code, EXIT.done, until)
    assert.equal(deps.calls[notCalled], undefined, `${until} 뒤의 ${notCalled} 를 불렀다`)
    assert.ok(existsSync(join(run, 'a', `${until}.json`)))
  }
  // 04 까지인데 문구가 없으면 대기 = 종료 3
  const r4 = await runStamp({ brief, run: join(dir, 'run-04'), until: '04-content' }, fakeDeps())
  assert.equal(r4.code, EXIT.waiting)
  // 04 까지, 문구가 있으면 종료 0 이고 05 는 안 돈다
  const run5 = join(dir, 'run-04ok')
  copyOut(run5)
  const d5 = fakeDeps()
  const r5 = await runStamp({ brief, run: run5, until: '04' }, d5)
  assert.equal(r5.code, EXIT.done)
  assert.equal(d5.calls['media:a'], undefined)
})

// ─── 6. --pick: 고른 안만 완성, 법률 검토 대기, 배포 한 번 ───

test('--pick: 02·03 은 3안, 04 부터는 고른 안만 · 법률 검토 파일이 없으면 종료 3 · 검토 뒤 06 을 다시 만들고 07 → 08 → 미리보기 배포 한 번', async () => {
  const dir = fresh()
  const brief = writeBrief(dir)
  const run = join(dir, 'run')
  copyOut(run)
  const deps = fakeDeps()
  const r1 = await runStamp({ brief, run, pick: 'c', deployPreview: true }, deps)
  assert.equal(r1.code, EXIT.waiting, r1.lines.join('\n'))
  assert.equal(r1.summary.waiting[0].stage, 'legal')
  assert.equal(r1.summary.waiting[0].cand, 'c')
  assert.equal(r1.summary.waiting[0].files.length, 2)
  assert.ok(r1.summary.waiting[0].files.every((f) => existsSync(f)), '초안 파일이 실제로 있다')
  assert.equal(deps.calls.sitemap, 3)
  assert.equal(deps.calls['content:a'], undefined, '고르지 않은 안은 04 부터 안 돈다')
  assert.equal(deps.calls['pages:c'], 1)
  assert.equal(deps.calls['qa:c'], undefined)
  assert.equal(deps.calls.deploy, undefined)

  reviewOut(run, 'c')
  const r2 = await runStamp({ brief, run, pick: 'c', deployPreview: true }, deps)
  assert.equal(r2.code, EXIT.done, r2.lines.join('\n'))
  assert.equal(deps.calls['pages:c'], 2, '검토 결과가 들어가 06 을 다시 만든다(초안 안내가 사라져야 한다)')
  assert.equal(deps.calls['qa:c'], 1)
  assert.equal(deps.calls.deploy, 1)
  assert.equal(deps.calls['pages:a'], undefined)
  assert.equal(r2.summary.candidates.find((c) => c.id === 'c').previewUrl, 'https://wf-preview-fake.vercel.app')
  assert.equal(r2.summary.candidates.find((c) => c.id === 'a').active, false)

  const r3 = await runStamp({ brief, run, pick: 'c', deployPreview: true }, deps)
  assert.equal(r3.code, EXIT.done)
  assert.equal(deps.calls.deploy, 1, '배포 주소가 이미 있으면 다시 배포하지 않는다')
})

// FINAL-WF E6: product 완성(saas·pwa)을 미리보기로 배포하면 인증·결제가 mock 이라는 표지와 품질 사유가 08-board.json·CLI 출력에 실린다 — site 완성·배포 안 함은 그대로.
test('E6: product 원형 + --pick --deploy-preview 는 mock 표지·품질 사유(인증·결제 미연결)를 싣고, site 원형·배포 없는 실행은 싣지 않는다(음성 대조)', async () => {
  const run1 = async (completion, deployPreview) => {
    const dir = fresh()
    const brief = writeBrief(dir)
    const run = join(dir, 'run')
    copyOut(run)
    const deps = fakeDeps({ deps: { loadArchetype: async (id) => ({ id, completion, legal: { pages: ['privacy', 'terms'] } }) } })
    await runStamp({ brief, run, pick: 'a', deployPreview }, deps)
    reviewOut(run, 'a')
    const r = await runStamp({ brief, run, pick: 'a', deployPreview }, deps)
    const board = JSON.parse(readFileSync(join(run, 'a', '08-board.json'), 'utf8')).data
    return { r, board }
  }
  const { r, board } = await run1('product', true)
  assert.equal(board.mockNotice, MOCK_PREVIEW_NOTICE)
  assert.ok(board.blockers.includes(MOCK_PREVIEW_BLOCKER), board.blockers.join(' | '))
  assert.equal(blockerClass(MOCK_PREVIEW_BLOCKER), 'quality', '입력 대기가 아니라 품질 갈래')
  assert.equal(board.publishable, false)
  assert.ok(board.blockerKinds.quality >= 1)
  assert.ok(r.lines.some((l) => l.includes(MOCK_PREVIEW_NOTICE)), r.lines.join('\n'))
  assert.equal(r.code, EXIT.fail, 'mock 미리보기는 공개 가능이 아니다')
  for (const [completion, deploy] of [['site', true], ['product', false]]) {
    const o = await run1(completion, deploy)
    assert.equal(o.board.mockNotice, undefined, `${completion}/${deploy}`)
    assert.ok(!o.board.blockers.includes(MOCK_PREVIEW_BLOCKER), `${completion}/${deploy}`)
  }
})

test('--pick 한 안이 공개 불가면 종료 1(gate-failed)인데 미리보기 배포는 된다 · 보드 실행은 공개 불가여도 0(Review Focus 1)', async () => {
  const dir = fresh()
  const brief = writeBrief(dir)
  const run = join(dir, 'run')
  copyOut(run)
  const deps = fakeDeps({ publishable: false })
  const board = await runStamp({ brief, run }, deps)
  assert.equal(board.code, EXIT.done, '보드 실행: 공개 불가는 이유를 보여 주는 것이 일이다')
  const data = readJ(join(run, 'a', '08-board.json')).data
  assert.equal(data.publishable, false)
  assert.equal(data.publishLabel, '공개 불가: 입력 대기 2가지')
  assert.deepEqual(data.missingFacts, ['business.phone'])
  assert.equal(data.legalPending, true)

  const c = await runStamp({ brief, run, pick: 'a', deployPreview: true }, deps)
  assert.equal(c.code, EXIT.waiting)
  reviewOut(run, 'a')
  const done = await runStamp({ brief, run, pick: 'a', deployPreview: true }, deps)
  assert.equal(done.code, EXIT.fail, '공개 불가 → 1')
  assert.equal(done.summary.status, 'gate-failed')
  assert.equal(deps.calls.deploy, 1, '공개 불가여도 미리보기 배포는 한다')
  assert.ok(done.summary.candidates.find((x) => x.id === 'a').blockers.length >= 2)
})

test('관문 도구 실패(측정 못 함)는 보드 실행에서도 종료 1(tool-failed)', async () => {
  const dir = fresh()
  const run = join(dir, 'run')
  copyOut(run)
  const deps = fakeDeps({ qaGates: [{ id: 'ux:/', tool: 'ux', verdict: 'tool', toolFailure: true, exit: 1 }], publishable: false })
  const r = await runStamp({ brief: writeBrief(dir), run }, deps)
  assert.equal(r.code, EXIT.fail)
  assert.equal(r.summary.status, 'tool-failed')
  assert.ok(r.summary.failures.some((f) => /ux:\//.test(f.message)))
})

test('FIT-6: 07 에 도구 실패(측정 못 함)가 남았으면 같은 명령을 다시 돌릴 때 07 을 다시 잰다 · 한 줄로 알린다 — 판정 실패(입력이 같음)는 다시 재지 않는다', async () => {
  const dir = fresh()
  const run = join(dir, 'run')
  copyOut(run)
  const brief = writeBrief(dir)
  const gateFor = (mode) => (mode === 'tool' ? { id: 'ux:/', tool: 'ux', verdict: 'tool', toolFailure: true, exit: 1, note: '도구 실패: 탐색 실패(net::ERR_ABORTED)' }
    : mode === 'fail' ? { id: 'ux:/', tool: 'ux', verdict: 'fail', toolFailure: false, exit: 3 }
      : { id: 'ux:/', tool: 'ux', verdict: 'pass', toolFailure: false, exit: 0 })
  // qa 가짜: 부를 때마다 횟수를 세고, 지금 mode 대로 관문 하나를 낸다
  const qaFake = (deps, getMode, extraGates = []) => async ({ cand }) => {
    deps.calls[`qa:${cand.id}`] = (deps.calls[`qa:${cand.id}`] ?? 0) + 1
    const mode = getMode()
    return { candidate: cand.id, routes: ['/'], gates: [gateFor(mode), ...extraGates], aiTell: { threshold: null, scores: {} }, seconds: 1, finishedAt: 'x', publishable: mode === 'ok', blockers: [], warnings: [] }
  }
  let mode = 'tool' // tool: 측정 못 함 · ok: 잰다 · fail: 판정 실패
  const deps = fakeDeps()
  deps.qa = qaFake(deps, () => mode)
  const lines = []
  deps.say = (s) => lines.push(s)
  const r1 = await runStamp({ brief, run }, deps)
  assert.equal(r1.code, EXIT.fail, '첫 실행: 측정 못 함이라 종료 1')
  for (const id of PICKS) assert.equal(deps.calls[`qa:${id}`], 1)
  // 같은 명령을 다시(타임아웃 환경 변수를 올린 뒤라고 보자) — 측정 못 함이 남은 07 은 다시 잰다
  mode = 'ok'
  lines.length = 0
  const r2 = await runStamp({ brief, run }, deps)
  for (const id of PICKS) assert.equal(deps.calls[`qa:${id}`], 2, `${id}: 도구 실패가 남은 07 을 캐시로 건너뛰었다`)
  assert.equal(r2.code, EXIT.done, r2.lines.join('\n'))
  assert.ok(lines.some((l) => /07-qa/.test(l) && /측정 못 함/.test(l) && /다시 잰다/.test(l)), `다시 잰다는 안내 한 줄이 없다:\n${lines.join('\n')}`)
  for (const id of PICKS) assert.equal(deps.calls[`pages:${id}`], 1, `${id}: 앞 단계(06)는 다시 돌지 않는다`)
  // 이제 도구 실패가 없다 — 또 돌려도 건너뛴다
  await runStamp({ brief, run }, deps)
  for (const id of PICKS) assert.equal(deps.calls[`qa:${id}`], 2, `${id}: 잰 07 을 또 쟀다`)

  // 판정 실패(측정은 했다)는 입력이 같으면 캐시 그대로
  const dir2 = fresh()
  const run2 = join(dir2, 'run')
  copyOut(run2)
  mode = 'fail'
  const deps2 = fakeDeps()
  deps2.qa = qaFake(deps2, () => mode)
  await runStamp({ brief: writeBrief(dir2), run: run2 }, deps2)
  await runStamp({ brief: writeBrief(dir2), run: run2 }, deps2)
  for (const id of PICKS) assert.equal(deps2.calls[`qa:${id}`], 1, `${id}: 판정 실패를 다시 쟀다`)

  // 보드가 세지 않는 도구 실패(doctor 정보 · 문턱 없는 ai-tell)는 다시 재는 사유가 아니다
  const dir3 = fresh()
  const run3 = join(dir3, 'run')
  copyOut(run3)
  mode = 'ok'
  const deps3 = fakeDeps()
  deps3.qa = qaFake(deps3, () => mode, [{ id: 'doctor-legal', tool: 'doctor', verdict: 'tool', toolFailure: true, exit: 1 }, { id: 'ai-tell:/', tool: 'ai-tell', verdict: 'tool', toolFailure: true, exit: 1 }])
  await runStamp({ brief: writeBrief(dir3), run: run3 }, deps3)
  await runStamp({ brief: writeBrief(dir3), run: run3 }, deps3)
  for (const id of PICKS) assert.equal(deps3.calls[`qa:${id}`], 1, `${id}: 보드가 세지 않는 도구 실패로 07 을 다시 쟀다`)
})

// ─── 7. 방향 3안: 컴파일 관문 탈락 → 다음 순위 · 모자라면 종료 1 ───

test('생성 후보가 컴파일 관문에서 떨어지면 exclude 로 같은 칸의 다음 순위를 다시 고른다(Review Focus 2)', async () => {
  const dir = fresh()
  const seen = []
  const deps = fakeDeps({
    deps: {
      directions: async ({ exclude }) => {
        seen.push(exclude.map((e) => e.id))
        const b = exclude.some((e) => e.id === 'gen-b') ? { id: 'b', slot: 'new', source: 'generated', recipe: { id: 'gen-b2' } } : { id: 'b', slot: 'new', source: 'generated', recipe: { id: 'gen-b' } }
        return { candidates: [{ id: 'a', slot: 'safe', source: 'library', recipe: 'r1-measure' }, b, { id: 'c', slot: 'bold', source: 'generated', recipe: { id: 'gen-c' } }], rejected: [] }
      },
      screen: async ({ cand }) => { if (cand.recipe?.id === 'gen-b') throw Object.assign(new Error('탈락'), { reasons: ['lint:k9-mono'] }) },
    },
  })
  const r = await runStamp({ brief: writeBrief(dir), run: join(dir, 'run'), until: '01' }, deps)
  assert.equal(r.code, EXIT.done)
  assert.deepEqual(seen, [[], ['gen-b']])
  assert.equal(readJ(join(dir, 'run', 'b', '01-direction.json')).data.recipe.id, 'gen-b2')
  const info = readJ(join(dir, 'run', 'directions.json'))
  assert.deepEqual(info.rejected.find((x) => x.id === 'screen:b').reasons, ['lint:k9-mono'])
})

test('끝까지 3안이 안 채워지면 종료 1(gate-failed)이고 떨어진 후보마다 규칙 id 를 남긴다 — 2안만 조용히 내지 않는다', async () => {
  const dir = fresh()
  const short = fakeDeps({ deps: { directions: async () => { throw new DirectionsShortError([{ id: 'slot:new', reasons: ['no-passing-generated-candidate'] }, { id: 'x|y|z', reasons: ['lint:k9-mono'] }]) } } })
  const r = await runStamp({ brief: writeBrief(dir), run: join(dir, 'run') }, short)
  assert.equal(r.code, EXIT.fail)
  assert.equal(r.summary.status, 'gate-failed')
  assert.deepEqual(r.summary.failures[0].rejected.map((x) => x.reasons[0]), ['no-passing-generated-candidate', 'lint:k9-mono'])
  assert.equal(short.calls.sitemap, undefined)

  const always = fakeDeps({
    deps: {
      directions: async ({ exclude }) => ({ candidates: [{ id: 'a', slot: 'safe', source: 'library', recipe: 'r1-measure' }, { id: 'b', slot: 'new', source: 'generated', recipe: { id: `g${exclude.length}` } }, { id: 'c', slot: 'bold', source: 'generated', recipe: { id: 'gc' } }], rejected: [] }),
      screen: async ({ cand }) => { if (cand.slot === 'new') throw Object.assign(new Error('탈락'), { reasons: ['lint:c6-fill'] }) },
    },
  })
  const r2 = await runStamp({ brief: writeBrief(dir), run: join(dir, 'run2') }, always)
  assert.equal(r2.code, EXIT.fail)
  assert.equal(r2.summary.status, 'gate-failed')
  assert.ok(r2.summary.failures[0].rejected.filter((x) => x.id === 'screen:b').length >= 2, '떨어진 후보마다 이유가 남는다')
})

test('브랜드 후보가 컴파일 관문에서 떨어지면 대신할 후보가 없어 종료 1', async () => {
  const dir = fresh()
  const deps = fakeDeps({
    deps: {
      directions: async () => ({ candidates: [{ id: 'a', slot: 'safe', source: 'library', recipe: 'r1' }, { id: 'b', slot: 'new', source: 'generated', recipe: { id: 'gb' } }, { id: 'c', slot: 'bold', source: 'brand', recipe: { id: 'brand-c' } }], rejected: [] }),
      screen: async ({ cand }) => { if (cand.source === 'brand') throw Object.assign(new Error('탈락'), { reasons: ['lint:contrast'] }) },
    },
  })
  const r = await runStamp({ brief: writeBrief(dir), run: join(dir, 'run') }, deps)
  assert.equal(r.code, EXIT.fail)
  assert.match(r.summary.failures[0].message, /brand/)
  assert.equal(deps.calls.sitemap, undefined)
})

// ─── 8. 법률 상태 · 보드 자료 ───

test('legalState: 검토 파일이 있는 쪽만 해시, 없으면 missing', () => {
  const dir = fresh()
  const archetype = { legal: { pages: ['privacy', 'terms'] } }
  mkdirSync(join(dir, 'a', '07-qa', 'legal'), { recursive: true })
  assert.equal(legalState(dir, 'a', archetype).missing.length, 2)
  writeFileSync(join(dir, 'a', '07-qa', 'legal', 'privacy.review.json'), '[]')
  const s = legalState(dir, 'a', archetype)
  assert.deepEqual(s.missing.map((p) => p.page), ['terms'])
  assert.match(s.hashes.privacy, /^[0-9a-f]{64}$/)
  assert.equal(s.hashes.terms, null)
})

test('legalState: 07-qa 가 남긴 「검토 전」 자리 파일(모든 조항 unverified)은 검토가 아니다 — 대기로 센다(--pick 이 진짜 검토를 기다린다), 진짜 검토·doctor 실패 사유 파일은 검토로 센다', () => {
  const dir = fresh()
  const archetype = { legal: { pages: ['privacy', 'terms', 'refund'] } }
  const legal = join(dir, 'a', '07-qa', 'legal')
  mkdirSync(legal, { recursive: true })
  const stub = JSON.stringify([{ clause: 'privacy.controller', verdict: 'unverified', basis: [], note: '법률 에이전트 검토 전 — 검토 파일(review.json)이 없다' }])
  const real = JSON.stringify([{ clause: 'terms.provider', verdict: 'fix', basis: [], note: '사업자등록번호 확인 필요' }])
  const doctorFail = JSON.stringify([{ clause: 'refund.a', verdict: 'unverified', basis: [], note: 'LAW_API_OC 없음 — doctor --stage legal 이 실패해 검토를 못 했다' }])
  writeFileSync(join(legal, 'privacy.review.json'), stub)
  writeFileSync(join(legal, 'terms.review.json'), real)
  writeFileSync(join(legal, 'refund.review.json'), doctorFail)
  const s = legalState(dir, 'a', archetype)
  assert.deepEqual(s.missing.map((p) => p.page), ['privacy'])
  assert.equal(s.hashes.privacy, null)
  assert.match(s.hashes.terms, /^[0-9a-f]{64}$/)
  assert.match(s.hashes.refund, /^[0-9a-f]{64}$/)
})

test('boardData: 공개 불가 이유 한 줄 — 품질·입력 두 갈래(사실 3칸 + 법률 검토 미완 = 입력 4가지)', () => {
  const qa = { publishable: false, blockers: ['공개 불가 — 확인 필요 사실: business.phone', '공개 불가 — 확인 필요 사실: business.bizRegNo', '공개 불가 — 확인 필요 사실: business.address', '공개 불가 — 법률 검토 미완: privacy·terms'], warnings: [], gates: [], routes: ['/'] }
  const d = boardData({ cand: { id: 'c', slot: 'bold', source: 'brand', recipe: { id: 'x' } }, qa, pages: null, media: null, legal: null })
  assert.equal(d.publishLabel, '공개 불가: 입력 대기 4가지')
  assert.equal(d.source, 'brand')
  assert.deepEqual(d.missingFacts, ['business.phone', 'business.bizRegNo', 'business.address'])
  const ok = boardData({ cand: { id: 'a', recipe: 'r1' }, qa: { publishable: true, blockers: [], gates: [] }, pages: null, media: null, legal: null })
  assert.equal(ok.publishLabel, '공개 가능')
})

test('publishLabel 은 품질·입력 두 갈래로 센다(FV1 5.2) — 0 인 갈래는 뺀다 · blockerKinds 칸', () => {
  const qa = { publishable: false, blockers: ['공개 불가 — 확인 필요 사실: business.phone', '공개 불가 — 실제 사진 필요: hero', '공개 불가 — 자료 연결 안 됨: home/faq'], gates: [] }
  const d = boardData({ cand: { id: 'a' }, qa })
  assert.equal(d.publishLabel, '공개 불가: 품질 사유 1가지 · 입력 대기 2가지')
  assert.deepEqual(d.blockerKinds, { input: 2, quality: 1 })
  assert.deepEqual(d.missingFacts, ['business.phone'], 'missingFacts 칸은 그대로')
  const onlyInput = boardData({ cand: { id: 'a' }, qa: { publishable: false, blockers: ['공개 불가 — 확인 필요 사실: business.phone'], gates: [] } })
  assert.equal(onlyInput.publishLabel, '공개 불가: 입력 대기 1가지')
  const onlyQuality = boardData({ cand: { id: 'a' }, qa: { publishable: false, blockers: ['공개 불가 — 운영 점검 실패: cls 0.2 > 0.1'], gates: [] } })
  assert.equal(onlyQuality.publishLabel, '공개 불가: 품질 사유 1가지')
  const facts = boardData({ cand: { id: 'a' }, qa: { publishable: false, blockers: ['공개 불가 — 운영 점검 실패: facts-empty 3곳'], gates: [] } })
  assert.equal(facts.publishLabel, '공개 불가: 입력 대기 1가지', 'facts-empty 는 입력 갈래')
  const noReason = boardData({ cand: { id: 'a' }, qa: { publishable: false, blockers: [], gates: [] } })
  assert.equal(noReason.publishLabel, '공개 불가')
})

// ─── 9. 골든 브리프 6개 ───

test('골든 브리프 6개: 스키마 통과 · 파일 이름과 원형·언어가 맞고 · missing-facts 는 전화·사업자번호·주소가 빠졌다', async () => {
  const expected = {
    'saas-en-sampleco-like': ['saas', 'en'], 'saas-ko': ['saas', 'ko'], 'local-ko-ltc': ['local', 'ko'],
    'local-ko-missing-facts': ['local', 'ko'], 'detail-ko': ['detail', 'ko'], 'detail-en-brand': ['detail', 'en'],
  }
  assert.deepEqual(readdirSync(BRIEFS).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort(), Object.keys(expected).sort())
  const archetypes = await loadArchetypes()
  const missing = {}
  for (const [name, [arch, locale]] of Object.entries(expected)) {
    const b = loadBrief(join(BRIEFS, `${name}.json`))
    assert.equal(b.archetype, arch, name)
    assert.equal(b.locale, locale, name)
    assert.ok(Object.keys(b.facts).length >= 4 && Object.keys(b.facts).length <= 14, `${name}: 사실 개수`)
    assert.ok(!/\(주\)|㈜|예시|sample|example co/i.test(b.facts.name), `${name}: 실존 회사 이름이 아니라 가상 이름`)
    missing[name] = briefToSeed(b, archetypes[arch]).missing
  }
  assert.deepEqual(missing['local-ko-missing-facts'].sort(), ['address', 'bizNo', 'phone'])
  for (const name of Object.keys(expected).filter((n) => n !== 'local-ko-missing-facts')) assert.deepEqual(missing[name], [], `${name}: 필수 사실이 다 있다`)
  assert.ok(loadBrief(join(BRIEFS, 'detail-en-brand.json')).brand?.colors?.length >= 2, '브랜드 골든에는 브랜드 입력이 있다')
})

// ─── 10. 진짜 배선(01~03) ───

test('진짜 단계 묶음으로 01~03: 방향 3안(무난·새 조합·과감)·사이트맵·변형이 후보 폴더에 쓰이고, 다시 돌리면 그대로다', { timeout: 170_000 }, async () => {
  const dir = fresh()
  const run = join(dir, 'run')
  const real = await defaultDeps({ say: () => {} })
  const deps = { ...real, doctor: async () => ({ ok: true, results: [] }) }
  const opts = { brief: join(BRIEFS, 'saas-ko.json'), run, until: '03-variants' }
  const r = await runStamp(opts, deps)
  assert.equal(r.code, EXIT.done, r.lines.join('\n'))
  const cands = PICKS.map((id) => readJ(join(run, id, '01-direction.json')).data)
  assert.deepEqual(cands.map((c) => c.slot), ['safe', 'new', 'bold'])
  assert.equal(cands[0].source, 'library')
  assert.equal(cands[1].source, 'generated')
  for (const id of PICKS) {
    for (const s of ['02-sitemap', '03-variants']) assert.ok(existsSync(join(run, id, `${s}.json`)), `${id}/${s}`)
    assert.ok(Object.keys(readJ(join(run, id, '03-variants.json')).data).length > 3, '섹션마다 블록이 정해졌다')
  }
  const blocksA = JSON.stringify(readJ(join(run, 'a', '03-variants.json')).data)
  const blocksB = JSON.stringify(readJ(join(run, 'b', '03-variants.json')).data)
  assert.notEqual(blocksA, blocksB, '후보끼리 블록이 다르게 골라졌다')
  const at = readJ(join(run, 'a', '02-sitemap.json')).producedAt
  const r2 = await runStamp(opts, deps)
  assert.equal(r2.code, EXIT.done)
  assert.equal(readJ(join(run, 'a', '02-sitemap.json')).producedAt, at, '다시 돌려도 파일을 다시 만들지 않는다')
  assert.equal(readJ(join(run, 'stamp-timings.json')).filter((t) => t.step === '02-sitemap').length, 3, '건너뛴 단계는 시간을 다시 적지 않는다')
  rmSync(dir, { recursive: true, force: true })
})

test('EXLEAK: 03 입력 해시가 누설 예측 열쇠를 본다 — 열쇠만 바뀌면 03 이 다시 돌고, 같으면 건너뛴다. 열쇠가 없는 묶음은 예전 입력 모양 그대로', async () => {
  const dir = fresh()
  const brief = writeBrief(dir)
  const run = join(dir, 'run')
  copyOut(run)
  let key = ['k1']
  const deps = fakeDeps({ deps: { variantsKey: async () => key } })
  await runStamp({ brief, run, until: '03-variants' }, deps)
  assert.equal(deps.calls.variants, 1)
  await runStamp({ brief, run, until: '03-variants' }, deps)
  assert.equal(deps.calls.variants, 1, '열쇠가 그대로인데 03 이 다시 돌았다')
  key = ['k2']
  await runStamp({ brief, run, until: '03-variants' }, deps)
  assert.equal(deps.calls.variants, 2, '열쇠가 바뀌었는데 03 이 안 돌았다')
  const saved = JSON.parse(readFileSync(join(run, 'a', '03-variants.json'), 'utf8'))
  assert.ok(typeof saved.inputHash === 'string')
  // 진짜 단계 묶음은 열쇠를 낸다
  const real = await defaultDeps({ say: () => {} })
  assert.equal(typeof real.variantsKey, 'function')
})

// ─── 5. 05 미디어 입력(MOTKIT-M) ───

test('05 미디어는 후보 자기 변형표를 받고, 변형이나 미리보기 모드(WF_MEDIA_PREVIEW)가 바뀌면 05 가 다시 돈다', async () => {
  const prev = process.env.WF_MEDIA_PREVIEW
  try {
    delete process.env.WF_MEDIA_PREVIEW
    const dir = fresh()
    const brief = writeBrief(dir)
    const run = join(dir, 'run')
    copyOut(run)
    const seen = []
    const mk = () => {
      const deps = fakeDeps()
      const base = deps.media
      deps.media = async (a) => { seen.push({ cand: a.cand.id, variants: a.variants, preview: a.preview }); return base(a) }
      return deps
    }
    const d1 = mk()
    const r1 = await runStamp({ brief, run, until: '05-media' }, d1)
    assert.equal(r1.code, EXIT.done, r1.lines.join('\n'))
    assert.deepEqual(seen.map((s) => [s.cand, s.variants['home/hero'], s.preview]), [['a', 'block-hero-x', false], ['b', 'block-hero-y', false], ['c', 'block-hero-z', false]], '각 후보가 자기 03 변형을 받는다')
    const input = (c) => readJ(join(run, c, '05-media.json')).inputHash
    const first = input('a')

    seen.length = 0
    const d2 = mk()
    await runStamp({ brief, run, until: '05-media' }, d2)
    assert.equal(seen.length, 0, '입력이 같으면 05 를 건너뛴다')

    process.env.WF_MEDIA_PREVIEW = '1'
    const d3 = mk()
    await runStamp({ brief, run, until: '05-media' }, d3)
    assert.deepEqual(seen.map((s) => s.preview), [true, true, true], '미리보기 모드가 켜지면 05 를 다시 돌고 모드가 전달된다')
    assert.notEqual(input('a'), first, '모드가 입력 해시에 든다')
  } finally {
    if (prev === undefined) delete process.env.WF_MEDIA_PREVIEW
    else process.env.WF_MEDIA_PREVIEW = prev
  }
})

// ─── 다시 그리기(--redraw-wider) ───

test('parseArgs --redraw-wider: --run 과만 쓴다 — 다른 모드와 섞거나 --run 이 없으면 UsageError', () => {
  assert.equal(parseArgs(['--run', 'out', '--redraw-wider']).redrawWider, true)
  for (const bad of [['--redraw-wider'], ['--run', 'o', '--redraw-wider', '--brief', 'b.json'], ['--run', 'o', '--redraw-wider', '--pick', 'a'], ['--run', 'o', '--redraw-wider', '--until', '2'], ['--run', 'o', '--redraw-wider', '--revise-undo']]) {
    assert.throws(() => parseArgs(bad), UsageError, JSON.stringify(bad))
  }
})

test('--redraw-wider: 01 만 minAxes 를 올려 다시 고르고(입력 해시가 바뀐다) 03~07 은 낡게 한다(구획 수정이 남긴 03 도) — 02 는 그대로 · 평소 실행의 01 해시는 예전 그대로 · 실행 기록이 없으면 종료 2', async () => {
  const dir = fresh()
  const file = writeBrief(dir)
  const run = join(dir, 'run')
  const seen = []
  const picks = (tag) => PICKS.map((id, i) => ({ id, slot: ['safe', 'new', 'bold'][i], source: 'generated', recipe: { id: `gen-${tag}-${id}` }, preset: 'p' }))
  const deps = fakeDeps({ deps: { directions: async ({ minAxes }) => { seen.push(minAxes); return { candidates: picks(minAxes ? `m${minAxes}` : 'base'), rejected: [] } } } })
  assert.equal((await runStamp({ brief: file, run, until: '03-variants', pick: null, deployPreview: false }, deps)).code, EXIT.done)
  assert.deepEqual(seen, [undefined], '평소 실행은 minAxes 를 넘기지 않는다')
  const brief = loadBrief(file)
  assert.equal(readJ(join(run, 'a', '01-direction.json')).inputHash, inputHash({ brief, archetype: brief.archetype, seed: brief.seed ?? 0, weights: [] }), '평소 01 해시는 예전 모양 그대로')
  for (const c of PICKS) for (const stage of ['04-content', '05-media', '06-pages', '07-qa']) writeFileSync(join(run, c, `${stage}.json`), j({ inputHash: 'h', producedAt: 'x', data: { built: true } }))
  for (const c of PICKS) { // 구획 수정이 남긴 열쇠: 사이트맵이 그대로면 03 을 다시 고르지 않고 쓰게 하는 것
    const saved = readJ(join(run, c, '03-variants.json'))
    writeFileSync(join(run, c, '03-variants.json'), j({ ...saved, revisedFor: inputHash(readJ(join(run, c, '02-sitemap.json')).data) }))
  }
  const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
  const map0 = sha(join(run, 'a', '02-sitemap.json'))

  const out = await runRedrawWider({ run }, deps)
  assert.equal(out.code, EXIT.done)
  const wide = MIN_AXES + loadHandles(loadLexicon()).redraw.minAxesDelta
  assert.deepEqual(seen, [undefined, wide], '다시 고르기는 MIN_AXES + handles.redraw.minAxesDelta')
  for (const c of PICKS) {
    assert.equal(readJ(join(run, c, '01-direction.json')).data.recipe.id, `gen-m${wide}-${c}`, `${c}: 01 이 새로 뽑혔다`)
    for (const stage of ['03-variants', '04-content', '05-media', '06-pages', '07-qa']) assert.match(readJ(join(run, c, `${stage}.json`)).inputHash, /^stale:/, `${c} ${stage}`)
    assert.equal('revisedFor' in readJ(join(run, c, '03-variants.json')), false, `${c}: 구획 수정이 남긴 열쇠도 지운다`)
  }
  assert.equal(sha(join(run, 'a', '02-sitemap.json')), map0, '02 는 01 에 기대지 않아 그대로')

  assert.match(out.lines.at(-1), /다시 골랐어요/)
  assert.equal(readJ(join(run, 'stamp-summary.json')).brief, resolve(file), '요약이 같은 브리프를 가리킨다')

  const before = deps.calls.variants
  await runStamp({ brief: file, run, until: '03-variants', pick: null, deployPreview: false }, deps)
  assert.equal(deps.calls.variants, before + 1, '03 이 새 01 위에서 다시 돈다')
  assert.deepEqual(seen, [undefined, wide], '평소 명령을 다시 돌려도 넓힌 01 을 되돌리지 않는다(넓이가 directions.json 에 남는다)')
  assert.equal(readJ(join(run, 'a', '01-direction.json')).data.recipe.id, `gen-m${wide}-a`)

  const second = await runRedrawWider({ run }, deps)
  assert.equal(second.code, EXIT.done)
  const wider = wide + loadHandles(loadLexicon()).redraw.minAxesDelta
  assert.deepEqual(seen, [undefined, wide, wider], '두 번째 다시 그리기는 지난번 넓이에서 또 넓힌다')
  assert.equal(readJ(join(run, 'a', '01-direction.json')).data.recipe.id, `gen-m${wider}-a`)
  assert.equal(readJ(join(run, 'directions.json')).minAxes, wider)

  // 끝(셀 수 있는 칸 수)에 닿으면 아무것도 바꾸지 않고 더 못 넓힌다고 알린다(종료 3)
  writeFileSync(join(run, 'directions.json'), j({ ...readJ(join(run, 'directions.json')), minAxes: AXIS_COUNT }))
  const snapshot = ['a', 'b', 'c'].map((c) => sha(join(run, c, '01-direction.json')) + sha(join(run, c, '06-pages.json')))
  const capped = await runRedrawWider({ run }, deps)
  assert.equal(capped.code, EXIT.waiting)
  assert.match(capped.lines.at(-1), /더 넓힐 수 없/)
  assert.deepEqual(seen, [undefined, wide, wider], '방향을 다시 뽑지 않았다')
  assert.deepEqual(['a', 'b', 'c'].map((c) => sha(join(run, c, '01-direction.json')) + sha(join(run, c, '06-pages.json'))), snapshot, '아무것도 바꾸지 않았다')

  const none = fakeDeps()
  const missing = await runRedrawWider({ run: join(dir, 'no-such-run') }, none)
  assert.equal(missing.code, EXIT.args)
  assert.equal(none.calls.directions, undefined, '실행 기록이 없으면 아무것도 돌리지 않는다')
})
