// 외부 의존 풀기(FV1 Task 7.2 · D24) — 소유자의 비공개 자료·키가 없는 컴퓨터에서도 공장이 돈다.
//   환경을 비운 자식 프로세스(WF_DESIGN_RULES_DIR·HIGGSFIELD_DIR·PEXELS_API_KEY·LAW_API_OC 없음, Windows 사용자 환경 읽기도 끔)에서:
//   ① doctor 가 0 으로 끝나고 빠진 키마다 무엇이 꺼지는지 한국어·영어 한 줄씩 알린다(WF_REQUIRE_KEYS=1 이면 예전처럼 실패 — 음성 대조)
//   ② 찍어내기 01~03 이 (골든 브리프, 네트워크 없이) 죽지 않고 끝난다
//   ③ 저장소 밖 자료를 읽던 길이 「선택 자료 없음」 한 줄을 내고 0 으로 끝난다(추적 파일을 건드리지 않는다)
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { designRulesRoot, designRulesPath, absentNote, skipAndExit, ENV_NAME } from '../lib/design-rules.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = join(tmpdir(), 'fv1-extdeps')
mkdirSync(TMP, { recursive: true })
const made = []
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })

const STRIP = ['WF_DESIGN_RULES_DIR', 'HIGGSFIELD_DIR', 'PEXELS_API_KEY', 'LAW_API_OC', 'WF_VISUAL_BASELINE', 'WF_PAGE_VISUAL_BASELINE', 'HARVEST_V2_DIR', 'WF_MOTION_LINKED_INDEX', 'WF_REQUIRE_KEYS', 'WF_MEDIA_PREVIEW']
/** 소유자의 환경을 비운 자식용 환경. WF_NO_USER_ENV=1 은 환경 변수 읽기를 끈다(secret-env). */
export const cleanEnv = (extra = {}) => {
  const e = { ...process.env }
  for (const k of STRIP) delete e[k]
  return { ...e, WF_NO_USER_ENV: '1', ...extra }
}
function run(args, { env = cleanEnv(), timeout = 120_000 } = {}) {
  return new Promise((done) => {
    const p = spawn(process.execPath, args, { cwd: ROOT, env, windowsHide: true })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (out += d))
    const t = setTimeout(() => p.kill(), timeout)
    p.on('close', (code) => { clearTimeout(t); done({ code, out }) })
  })
}
// 작업 트리 상태(추적 파일 차이 + 추적 안 된 새 파일). 시험 전후를 견줘 「스크립트가 바꾼 것 없음」을 본다 — 이미 고쳐 둔 파일이 있어도 된다.
const gitState = (...paths) => execFileSync('git', ['status', '--porcelain', '--', ...paths], { cwd: ROOT, encoding: 'utf8' }) + execFileSync('git', ['diff', '--', ...paths], { cwd: ROOT, encoding: 'utf8' })

// ── 순수 도우미 ─────────────────────────────────────────────────────────
test('design-rules: 환경 변수가 먼저, 없으면 저장소 사본, 둘 다 없으면 none', () => {
  const none = () => false
  assert.deepEqual(designRulesRoot({ env: {}, exists: none }), { dir: null, source: 'none' })
  assert.deepEqual(designRulesRoot({ env: { [ENV_NAME]: ' X:/dr ' }, exists: none }), { dir: 'X:/dr', source: 'env' })
  const repo = designRulesRoot({ env: {}, exists: () => true })
  assert.equal(repo.source, 'repo')
  assert.ok(repo.dir.replaceAll('\\', '/').endsWith('references/design-rules'))
  assert.equal(designRulesRoot({ env: { [ENV_NAME]: 'X:/dr' }, exists: () => true }).source, 'env', '환경 변수가 저장소 사본보다 앞선다')
})

test('design-rules: designRulesPath 는 뿌리가 없으면 null, 있으면 이어 붙인다', () => {
  assert.equal(designRulesPath('factory/palettes', { env: {}, exists: () => false }), null)
  assert.equal(designRulesPath('factory/palettes', { env: { [ENV_NAME]: 'X:/dr' } }).replaceAll('\\', '/'), 'X:/dr/factory/palettes')
})

test('design-rules: 안내는 한 줄에 한국어·영어·변수 이름이 있다', () => {
  const n = absentNote('팔레트 원천', 'palette source')
  assert.ok(!n.includes('\n'))
  assert.match(n, /선택 자료 없음/)
  assert.match(n, /optional/i)
  assert.match(n, new RegExp(ENV_NAME))
})

test('design-rules: 인자를 안 주면 process.env 를 읽고, 영어 말이 없으면 한국어 말을 그대로 쓴다', () => {
  const prev = process.env[ENV_NAME]
  try {
    process.env[ENV_NAME] = 'Q:/dr'
    assert.deepEqual(designRulesRoot(), { dir: 'Q:/dr', source: 'env' })
    assert.equal(designRulesPath('a/b').replaceAll('\\', '/'), 'Q:/dr/a/b')
  } finally {
    if (prev === undefined) delete process.env[ENV_NAME]
    else process.env[ENV_NAME] = prev
  }
  assert.match(absentNote('X 자료'), /optional data absent: X 자료/)
})

test('design-rules: skipAndExit 는 한 줄을 쓰고 종료 0 으로 끝낸다(process.exit 를 가로챈다)', () => {
  const realExit = process.exit
  let code = null
  process.exit = (c) => { code = c; throw new Error('exit') }
  try {
    assert.throws(() => skipAndExit('선택 자료 없음: 시험 줄 / optional data absent: test line'), /exit/)
  } finally {
    process.exit = realExit
  }
  assert.equal(code, 0)
})

test('secret-env: WF_NO_USER_ENV=1 이면 환경 변수에 없는 이름은 Windows 사용자 환경을 읽지 않고 null, 있으면 그 값', async () => {
  const { readSecret } = await import('../lib/secret-env.mjs')
  assert.equal(readSecret('FV1_EXTDEPS_PROBE', { FV1_EXTDEPS_PROBE: ' v ' }), 'v')
  assert.equal(readSecret('FV1_EXTDEPS_PROBE_ABSENT', { WF_NO_USER_ENV: '1' }), null)
})

test('시각 기준 기본 경로(jobs.mjs): 환경 변수 → 비공개 자료 폴더 → 저장소 .tmp 순', async () => {
  const keep = { b: process.env.WF_VISUAL_BASELINE, d: process.env[ENV_NAME] }
  const load = async (tag) => (await import(`../board/block-board/jobs.mjs?${tag}`)).BASELINE_DIR.replaceAll('\\', '/')
  try {
    process.env.WF_VISUAL_BASELINE = 'Y:/vb'
    assert.equal(await load('env'), 'Y:/vb')
    delete process.env.WF_VISUAL_BASELINE
    process.env[ENV_NAME] = 'Y:/dr'
    assert.equal(await load('rules'), 'Y:/dr/factory/visual-baseline/blocks')
    delete process.env[ENV_NAME]
    assert.match(await load('repo'), /\.tmp\/visual-baseline\/blocks$/)
  } finally {
    for (const [k, v] of [['WF_VISUAL_BASELINE', keep.b], [ENV_NAME, keep.d]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
})

// ── doctor ──────────────────────────────────────────────────────────────
test('doctor(키·폴더·WF_DESIGN_RULES_DIR 없음): 단계마다 종료 0 + 빠진 항목마다 한국어·영어 한 줄', async () => {
  for (const stage of ['stamp', 'legal', 'media']) {
    const r = await run(['factory/doctor.mjs', '--stage', stage])
    assert.equal(r.code, 0, `${stage}: ${r.out}`)
    assert.ok(!/FAIL/.test(r.out), `${stage} 에 FAIL 이 있다:\n${r.out}`)
  }
  const r = await run(['factory/doctor.mjs', '--stage', 'stamp'])
  const lines = r.out.split('\n')
  for (const [id, ko, en] of [
    ['LAW_API_OC', /법/, /legal/i],
    ['PEXELS_API_KEY', /스톡|사진/, /stock/i],
    ['HIGGSFIELD_DIR', /생성/, /generated/i],
    ['3D_OBJECT_HERO', /2\.5D\/포스터/, /2\.5D\/poster/i],
    ['WF_DESIGN_RULES_DIR', /선택 자료/, /optional/i],
  ]) {
    const mine = lines.filter((l) => l.includes(id))
    assert.ok(mine.some((l) => /^note/.test(l) && ko.test(l)), `${id}: 한국어 note 줄 없음\n${r.out}`)
    assert.ok(mine.some((l) => en.test(l) && /[A-Za-z]{4} [a-z]/.test(l) && !ko.test(l)), `${id}: 영어 줄 없음\n${r.out}`)
  }
  assert.match(r.out, /doctor --stage stamp: 4\/4 ok/)
})

test('doctor 음성 대조: WF_REQUIRE_KEYS=1 이면 키가 없을 때 예전처럼 실패(종료 1)', async () => {
  const r = await run(['factory/doctor.mjs', '--stage', 'legal'], { env: cleanEnv({ WF_REQUIRE_KEYS: '1' }) })
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /FAIL LAW_API_OC/)
})

test('doctor: 키가 있는데 값이 틀리면(호출 실패) 느슨한 모드에서도 실패한다 — 키 없음만 note', async () => {
  const { runDoctor } = await import('../doctor.mjs')
  const r = await runDoctor('legal', { strict: false, readSecret: () => 'k', fetch: async () => { throw new Error('no network') } })
  assert.equal(r.ok, false)
  const absent = await runDoctor('legal', { strict: false, readSecret: () => null })
  assert.equal(absent.ok, true)
  assert.equal(absent.results[0].note, true)
  assert.ok(absent.results[0].messageEn)
})

// ── 찍어내기 01~03 ──────────────────────────────────────────────────────
test('stamp --golden brand-1 --until 03: 키·폴더 없이 종료 0, 01~03 단계 파일이 생긴다', async () => {
  const dir = mkdtempSync(join(TMP, 'stamp-'))
  made.push(dir)
  const r = await run(['factory/stamp/stamp.mjs', '--golden', 'brand-1', '--run', dir, '--until', '03'], { timeout: 170_000 })
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /note LAW_API_OC|doctor note\s+LAW_API_OC/)
  const summary = JSON.parse(readFileSync(join(dir, 'stamp-summary.json'), 'utf8'))
  assert.equal(summary.status, 'done')
  for (const c of ['a', 'b', 'c']) for (const s of ['01-direction', '02-sitemap', '03-variants']) assert.ok(existsSync(join(dir, c, `${s}.json`)), `${c}/${s}.json`)
}, { timeout: 180_000 })

// ── 저장소 밖 자료를 읽던 길 ────────────────────────────────────────────
test('원천이 저장소 밖인 생성기들: 자료가 없으면 「선택 자료 없음」 한 줄 + 종료 0, 추적 파일은 그대로', async () => {
  const cases = [
    [['factory/scripts/build-palettes.mjs'], 'references/palettes'],
    [['factory/scripts/build-styles.mjs'], 'references/styles'],
    [['factory/scripts/import-cards.mjs'], 'references/patterns'],
    [['factory/scripts/harvest-v2-doc.mjs'], 'docs/qa/factory-v1'],
  ]
  for (const [args, tracked] of cases) {
    const before = gitState(tracked)
    const r = await run(args)
    assert.equal(r.code, 0, `${args[0]}:\n${r.out}`)
    assert.match(r.out, /선택 자료 없음/, `${args[0]}: 한국어 안내 줄 없음\n${r.out}`)
    assert.match(r.out, /optional data absent/, `${args[0]}: 영어 안내 줄 없음\n${r.out}`)
    assert.equal(r.out.trim().split('\n').length, 1, `${args[0]}: 안내는 한 줄이다\n${r.out}`)
    assert.equal(gitState(tracked), before, `${args[0]} 가 추적 파일을 바꿨다`)
  }
})

test('기본 경로: 시각 기준·Higgsfield 기본값이 design-rules 를 가리키지 않는다', async () => {
  const probe = `
    const a = await import('./factory/board/block-board/jobs.mjs')
    const b = await import('./factory/qa/page-visual.mjs')
    const c = await import('./factory/media/build-media.mjs')
    console.log(JSON.stringify({ blocks: a.BASELINE_DIR, pages: b.PAGE_BASELINE_ROOT, hf: c.HIGGSFIELD_DIR ?? null }))`
  const r = await run(['--input-type=module', '-e', probe])
  assert.equal(r.code, 0, r.out)
  const v = JSON.parse(r.out.trim().split('\n').at(-1))
  assert.ok(!/design-rules/i.test(`${v.blocks}${v.pages}`), r.out)
  assert.equal(v.hf, null, 'HIGGSFIELD_DIR 이 없으면 폴더도 없다')
})

test('기본 경로: WF_DESIGN_RULES_DIR 를 주면 세 길이 그 아래를 읽는다', async () => {
  const probe = `
    const a = await import('./factory/board/block-board/jobs.mjs')
    const b = await import('./factory/qa/page-visual.mjs')
    const c = await import('./factory/media/build-media.mjs')
    console.log(JSON.stringify({ blocks: a.BASELINE_DIR, pages: b.PAGE_BASELINE_ROOT, hf: c.HIGGSFIELD_DIR }))`
  const r = await run(['--input-type=module', '-e', probe], { env: cleanEnv({ WF_DESIGN_RULES_DIR: 'Z:/dr' }) })
  const v = JSON.parse(r.out.trim().split('\n').at(-1))
  for (const x of Object.values(v)) assert.ok(x.replaceAll('\\', '/').startsWith('Z:/dr/factory/'), x)
})
