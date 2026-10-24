// 완성 확인(sitebrew v0.2.0 계획 3 Task 10) 가벼운 시험 — 진짜 서버·브라우저·설치는 없다. spawn·메모리·소개형 블록은 바꿔 끼운 가짜다.
// 진짜 smoke --mode loop 와 소개형 빌드→서버→문의 한 번은 deliver-product.test.mjs(heavy).
import assert from 'node:assert/strict'
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { after, before, test } from 'node:test'
import { writeFeatures } from '../intake/features.mjs'
import { DETAIL_LINES, SKIP_BY_NOTICE, FETCH_TIMEOUT_MS, LOOP_OUTBOX_DIR, MIN_FREE_GB, SMOKE_FILE, checkIntroInquiry, checkLoopSection, defaultHasPlaywright, lastLines, loopMail, runCheckLoop, scrubAbsolute, scrubFor, scrubPaths } from '../stamp/check-loop.mjs'
import { DELIVER_COPY as copy, checkFailureText, checkStatusText, deliver, parseDeliverArgs } from '../stamp/deliver.mjs'
import { INQUIRY_SAMPLE, INQUIRY_TARGETS } from '../stamp/deliver-intro.mjs'
import { gen, localBrief, localContent, makeRun, root } from './lib/stamp-site-fixtures.mjs'

const BASE = join(root, '.tmp', 'check-loop-test')
mkdirSync(BASE, { recursive: true })
const tmp = mkdtempSync(join(BASE, 't-'))
const TABLE_FILE = join(root, 'factory', 'intake', 'fixtures', 'outcomes.sample.json')
const table = JSON.parse(readFileSync(TABLE_FILE, 'utf8'))
const hangul = /[가-힣]/

// 가짜 launch-factory: 표 + 한 바퀴 단계 표만 있다(smoke 는 stub 가 대신한다)
const makeLf = (name, steps) => {
  const lf = join(tmp, name)
  mkdirSync(join(lf, 'features'), { recursive: true })
  mkdirSync(join(lf, 'template', 'e2e'), { recursive: true })
  cpSync(TABLE_FILE, join(lf, 'features', 'outcomes.generated.json'))
  writeFileSync(join(lf, 'template', 'e2e', 'loop-steps.json'), JSON.stringify({ steps }))
  return lf
}
const LF = makeLf('lf', { signup: ['signUp'], payments: ['checkout'], inquiry: ['contact'] })
const LF_NO_STEPS = makeLf('lf-no-steps', {})
const feats = (...outcomes) => ({ version: 1, table: table.hash, outcomes })

let n = 0
/** 제품 폴더 흉내: package.json 과 node_modules/next 표지가 있으면 설치를 건너뛴다. */
const productDir = ({ installed = true } = {}) => {
  const dir = join(tmp, `out-${n++}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), '{}')
  if (installed) mkdirSync(join(dir, 'node_modules', 'next'), { recursive: true })
  for (const c of ['ax', 'blocks']) mkdirSync(join(dir, 'components', c), { recursive: true })
  return dir
}
/** 소개형 폴더 흉내: 접수 코드가 읽는 문장 사본(lib/inquiry-copy.json)과 받는 메일 칸(content/site.json)이 있다. */
const introDir = ({ email } = {}) => {
  const dir = productDir()
  mkdirSync(join(dir, 'lib'), { recursive: true })
  writeFileSync(join(dir, INQUIRY_TARGETS.copy), JSON.stringify(copy.inquiryRuntime))
  if (email !== undefined) {
    mkdirSync(join(dir, 'content'), { recursive: true })
    writeFileSync(join(dir, 'content', 'site.json'), JSON.stringify({ business: { email } }))
  }
  return dir
}
/** spawn 가짜: 부른 것을 calls 에 적고 answers 순서(또는 함수)로 답한다. */
const stub = (answer) => {
  const calls = []
  const spawn = async (cmd, args, o) => { calls.push({ cmd, args, ...o }); return typeof answer === 'function' ? answer(cmd, args, o) : answer }
  return { spawn, calls }
}
const smokeCall = (calls) => calls.find((c) => c.args.some((a) => String(a).endsWith('smoke.mjs')))
const base = (over = {}) => ({ lfDir: LF, features: feats('signup', 'payments'), copy, freeGb: () => 8, hasPlaywright: () => true, env: { PATH: 'x' }, ...over })

test('제품형: 전달한 폴더 안에서 smoke --mode loop (--root·템플릿 경로 없음), 고른 기능만 LOOP_FEATURES 로 넘기고 CI 값은 뺀다', async () => {
  const dir = productDir()
  const s = stub({ code: 0, tail: '' })
  const r = await runCheckLoop(dir, base({ spawn: s.spawn, env: { PATH: 'x', CI: 'true', GITHUB_ACTIONS: 'true', SECRET_KEEP: '1' } }))
  assert.equal(r.status, 'ok')
  assert.equal(s.calls.length, 1, '설치가 끝난 폴더는 npm 을 부르지 않는다')
  const c = smokeCall(s.calls)
  assert.deepEqual(c.args, [SMOKE_FILE, '--mode', 'loop'])
  assert.equal(SMOKE_FILE, join('scripts', 'ci', 'smoke.mjs'), '폴더 안의 상대 경로다')
  assert.equal(c.cwd, dir, 'cwd = 전달한 폴더(launch-factory 가 아니다)')
  assert.ok(!c.args.includes('--root') && !c.args.some((a) => String(a).includes(LF)), 'launch-factory 도 --root 도 쓰지 않는다')
  assert.equal(c.cmd, process.execPath)
  assert.equal(c.env.LOOP_FEATURES, 'signup,payments')
  assert.equal(c.env.CI, undefined, 'CI=true 면 smoke 가 브라우저를 찾지 않는다')
  assert.equal(c.env.GITHUB_ACTIONS, undefined)
  assert.equal(c.env.PATH, 'x')
})

test('LOOP_FEATURES 는 describeFeatures 의 loop 다: 단계 표에 있는 기능만, 표 순서대로', async () => {
  const lf = makeLf('lf-partial', { signup: ['signUp'] }) // payments 는 단계 표에 없다
  const s = stub({ code: 0, tail: '' })
  await runCheckLoop(productDir(), base({ lfDir: lf, features: feats('signup', 'payments', 'analytics'), spawn: s.spawn }))
  assert.equal(smokeCall(s.calls).env.LOOP_FEATURES, 'signup')
  const s2 = stub({ code: 0, tail: '' })
  await runCheckLoop(productDir(), base({ features: feats('signup', 'payments', 'inquiry', 'marketing'), spawn: s2.spawn }))
  assert.equal(smokeCall(s2.calls).env.LOOP_FEATURES, 'signup,payments,inquiry')
})

test('제품형인데 돌릴 단계가 하나도 없으면 건너뛴다 — LOOP_FEATURES 가 비면 smoke 가 「전부」를 돌리기 때문', async () => {
  const s = stub({ code: 0, tail: '' })
  const r = await runCheckLoop(productDir(), base({ lfDir: LF_NO_STEPS, spawn: s.spawn }))
  assert.equal(r.status, 'skipped')
  assert.equal(r.reason, copy.checkLoopNoSteps.ko)
  assert.equal(s.calls.length, 0)
})

test('smoke 종료 코드: 0 → ok · 3 → skipped(브라우저 없음) · 그 밖 → failed + 출력 끝줄', async () => {
  const ok = await runCheckLoop(productDir(), base({ spawn: stub({ code: 0, tail: 'done' }).spawn }))
  assert.equal(ok.status, 'ok')
  assert.equal(ok.reason, copy.checkLoopOk.ko)
  assert.equal(ok.reasonEn, copy.checkLoopOk.en)
  const none = await runCheckLoop(productDir(), base({ spawn: stub({ code: 3, tail: '브라우저가 없다' }).spawn }))
  assert.equal(none.status, 'skipped')
  assert.equal(none.reason, copy.checkLoopNoBrowser.ko)
  assert.equal(none.reasonEn, copy.checkLoopNoBrowser.en)
  for (const code of [1, 2, null, 137]) {
    const bad = await runCheckLoop(productDir(), base({ spawn: stub({ code, tail: 'x\n\n마지막 줄 오류\n' }).spawn }))
    assert.equal(bad.status, 'failed', `exit ${code}`)
    assert.equal(bad.reason, copy.checkLoopFailed.ko, '이유 문장은 고정 문장이다 — 원인(영어 줄)을 섞지 않는다')
    assert.equal(bad.reasonEn, copy.checkLoopFailed.en)
    assert.ok(bad.detail.startsWith(`exit ${code}`) && bad.detail.includes('마지막 줄 오류'), bad.detail)
  }
})

test('메모리 여유가 3.0 GB 아래면 기다리지 않고 건너뛴다 — 잰 값이 이유에 있고 아무것도 띄우지 않는다', async () => {
  assert.equal(MIN_FREE_GB, 3)
  const s = stub({ code: 0, tail: '' })
  const r = await runCheckLoop(productDir({ installed: false }), base({ spawn: s.spawn, freeGb: () => 2.46 }))
  assert.equal(r.status, 'skipped')
  assert.ok(r.reason.includes('2.5') && r.reason.includes('GB'), r.reason)
  assert.ok(r.reasonEn.includes('2.5'), r.reasonEn)
  assert.equal(s.calls.length, 0, 'npm install 도 smoke 도 부르지 않는다')
  let introRan = false
  const intro = await runCheckLoop(productDir(), base({ features: feats('inquiry'), freeGb: () => 1.1, checkIntro: async () => { introRan = true; return { ok: true, mail: {} } } }))
  assert.equal(intro.status, 'skipped')
  assert.equal(introRan, false)
  // 문턱 3.0 은 돌린다
  const edge = stub({ code: 0, tail: '' })
  assert.equal((await runCheckLoop(productDir(), base({ spawn: edge.spawn, freeGb: () => 3.0 }))).status, 'ok')
})

test('설치가 안 된 제품 폴더는 npm install 을 먼저 한다: 실패하면 smoke 를 부르지 않고 failed', async () => {
  const s = stub((cmd, args) => (args[0] === 'install' ? { code: 1, tail: 'ERESOLVE boom' } : { code: 0, tail: '' }))
  const r = await runCheckLoop(productDir({ installed: false }), base({ spawn: s.spawn }))
  assert.equal(r.status, 'failed')
  assert.equal(s.calls.length, 1)
  assert.ok(r.detail.includes('npm install exit 1') && r.detail.includes('ERESOLVE boom'), r.detail)
  assert.equal(r.reason, copy.checkLoopFailed.ko)
  const s2 = stub({ code: 0, tail: '' })
  const ok = await runCheckLoop(productDir({ installed: false }), base({ spawn: s2.spawn }))
  assert.equal(ok.status, 'ok')
  assert.deepEqual(s2.calls.map((c) => (c.args[0] === 'install' ? 'install' : 'smoke')), ['install', 'smoke'])
})

test('minor-2 package.json 이 없는 폴더는 npm·smoke 를 부르지 않는다(위 폴더에 설치되는 사고 방지): install 을 하지 않았다는 문장(checkLoopNoPackage) — 시험 도구 찾기를 바꿔 끼우지 않고, 남은 것 안내도 없다', async () => {
  const dir = join(tmp, `bare-${n++}`)
  mkdirSync(dir, { recursive: true })
  const s = stub({ code: 1, tail: '' })
  const r = await runCheckLoop(dir, base({ spawn: s.spawn, hasPlaywright: undefined }))
  assert.equal(r.status, 'skipped')
  assert.equal(r.key, 'checkLoopNoPackage')
  assert.equal(s.calls.length, 0)
  assert.doesNotMatch(r.reason, /했는데도/)
  assert.doesNotMatch(r.reasonEn, /after `npm install`/)
  assert.ok(!checkLoopSection(r, copy, 'ko').includes(copy.checkLoopLeftover.ko), '아무것도 설치하지 않았다')
})

test('minor-1 설치·빌드를 한 뒤 건너뛴 결과(시험 도구 없음 · 받는 메일 없음)는 「남은 것」 안내를 낸다', async () => {
  const p = await runCheckLoop(productDir({ installed: false }), base({ spawn: stub({ code: 0, tail: '' }).spawn, hasPlaywright: () => false }))
  assert.equal(p.key, 'checkLoopNoPlaywright')
  const introDir = productDir()
  mkdirSync(dirname(join(introDir, INQUIRY_TARGETS.route)), { recursive: true })
  writeFileSync(join(introDir, INQUIRY_TARGETS.route), '')
  const o = await runCheckLoop(introDir, base({ features: feats('inquiry'), checkIntro: async () => ({ ok: false, skip: 'checkLoopNoOwner', mail: {} }) }))
  assert.equal(o.key, 'checkLoopNoOwner')
  for (const r of [p, o]) for (const lang of ['ko', 'en']) assert.ok(checkLoopSection(r, copy, lang).includes(copy.checkLoopLeftover[lang]), `${r.key} ${lang}`)
  // 돌리기 전에 건너뛴 것은 그대로 안내가 없다
  const m = await runCheckLoop(productDir(), base({ freeGb: () => 1 }))
  assert.ok(!checkLoopSection(m, copy, 'ko').includes(copy.checkLoopLeftover.ko))
})

test('minor-6 실패인데 보일 원인 기록이 없으면 「아래 코드 블록」을 가리키지 않는다 — CLI 한 줄도 같다', async () => {
  const r = await runCheckLoop(productDir(), base({ spawn: stub({ code: 1, tail: '' }).spawn }))
  const empty = { ...r, detail: '' }
  for (const lang of ['ko', 'en']) {
    const text = checkLoopSection(empty, copy, lang).join('\n')
    assert.ok(text.includes(copy.checkLoopFailedPlain[lang]), lang)
    assert.doesNotMatch(text, /코드 블록|code block/)
  }
  const withLog = checkLoopSection({ ...r, detail: 'exit 1\nboom' }, copy, 'ko').join('\n')
  assert.ok(withLog.includes(copy.checkLoopFailed.ko))
  assert.equal(checkStatusText(r), `완성 확인: failed — ${copy.checkLoopFailedPlain.ko}`)
  assert.equal(checkStatusText({ status: 'skipped', reason: 'x' }), '완성 확인: skipped — x')
  assert.equal(checkStatusText({ status: 'ok', reason: 'y' }), '완성 확인: ok — y')
})

test('minor-7 기능 기록이 깨져 옛 경로로 간 경우의 이유는 「기록이 없다」가 아니라 「깨졌다」', async () => {
  assert.equal(SKIP_BY_NOTICE.noticeBadFeatures, 'checkLoopBadFeatures')
  const r = await runCheckLoop(productDir(), base({ features: null, notice: 'noticeBadFeatures' }))
  assert.equal(r.key, 'checkLoopBadFeatures')
  assert.equal(r.reason, copy.checkLoopBadFeatures.ko)
})

test('메일 기록: smoke 가 남긴 가장 새 outbox 파일을 template 별로 센다', async () => {
  const dir = productDir()
  const out = join(dir, LOOP_OUTBOX_DIR)
  mkdirSync(out, { recursive: true })
  const line = (template) => JSON.stringify({ id: 'i', template, to: 'a@b.c', subject: 's', at: '2026-10-18T00:00:00.000Z' })
  writeFileSync(join(out, 'outbox-100.jsonl'), `${line('old')}\n`)
  writeFileSync(join(out, 'outbox-200.jsonl'), `${line('verifyEmail')}\n${line('orderConfirmation')}\n${line('verifyEmail')}\n`)
  utimesSync(join(out, 'outbox-100.jsonl'), new Date(2020, 0, 1), new Date(2020, 0, 1))
  assert.deepEqual(loopMail(dir), { verifyEmail: 2, orderConfirmation: 1 })
  const r = await runCheckLoop(dir, base({ spawn: stub({ code: 0, tail: '' }).spawn }))
  assert.deepEqual(r.mail, { verifyEmail: 2, orderConfirmation: 1 })
  assert.deepEqual(loopMail(join(tmp, 'nowhere')), {})
})

test('소개형: 문의를 안 골랐거나 접수 코드가 없으면 건너뛰고, 있으면 문의 블록 결과를 그대로 낸다', async () => {
  let called = 0
  const intro = (res) => async () => { called++; return res }
  const dir = productDir()
  const no = await runCheckLoop(dir, base({ features: feats('analytics'), checkIntro: intro({ ok: true, mail: {} }) }))
  assert.equal(no.status, 'skipped')
  assert.equal(no.reason, copy.checkLoopNoInquiry.ko)
  // 문의는 골랐는데 시안에 문의 폼이 없어 접수 코드가 안 더해진 폴더
  const noRoute = await runCheckLoop(dir, base({ features: feats('inquiry'), checkIntro: intro({ ok: true, mail: {} }) }))
  assert.equal(noRoute.status, 'skipped')
  assert.equal(called, 0)
  // 접수 코드가 있는 폴더
  const route = join(dir, INQUIRY_TARGETS.route)
  mkdirSync(join(route, '..'), { recursive: true })
  writeFileSync(route, '// route')
  const ok = await runCheckLoop(dir, base({ features: feats('inquiry'), checkIntro: intro({ ok: true, mail: { inquiryNotice: 1 } }) }))
  assert.equal(ok.status, 'ok')
  assert.deepEqual(ok.mail, { inquiryNotice: 1 })
  const bad = await runCheckLoop(dir, base({ features: feats('inquiry'), checkIntro: intro({ ok: false, detail: 'a valid inquiry got 500, expected 200', mail: {} }) }))
  assert.equal(bad.status, 'failed')
  assert.ok(bad.detail.includes('got 500'))
  assert.equal(bad.reason, copy.checkLoopFailed.ko)
  assert.equal(called, 2)
})

test('기능 기록이나 launch-factory 가 없으면 건너뛴다', async () => {
  const s = stub({ code: 0, tail: '' })
  for (const over of [{ features: null }, { lfDir: null }]) {
    const r = await runCheckLoop(productDir(), base({ ...over, spawn: s.spawn }))
    assert.equal(r.status, 'skipped')
    assert.equal(r.reason, copy.checkLoopNoFeatures.ko)
  }
  assert.equal(s.calls.length, 0)
})

// ── deliver 연결 ───────────────────────────────────────────────────────────────────────
let local
before(async () => {
  local = await makeRun(join(tmp, 'local'), localBrief(), localContent)
  await gen(local)
})
after(() => { rmSync(tmp, { recursive: true, force: true }) })

const WITH_LF = { lf: LF, env: {} }
const readme = (dir) => readFileSync(join(dir, 'README.md'), 'utf8')
const wrap = (spawn) => (dir, o) => runCheckLoop(dir, { ...o, spawn, freeGb: () => 8, checkIntro: async () => ({ ok: true, mail: { inquiryNotice: 1 } }) })

test('--check-loop 없음: 확인을 부르지 않고 반환값·README 에 완성 확인이 없다', async () => {
  writeFeatures(local.runDir, feats('inquiry'))
  const s = stub({ code: 0, tail: '' })
  let called = 0
  const r = await deliver(local.runDir, 'a', { to: join(tmp, 'o', 'off'), ...WITH_LF, runCheck: (...a) => { called++; return wrap(s.spawn)(...a) } })
  assert.equal(called, 0)
  assert.equal(s.calls.length, 0)
  assert.equal(r.checkLoop, undefined)
  assert.doesNotMatch(readme(r.dir), /완성 확인|Completion check/)
  assert.equal('checkLoop' in parseDeliverArgs(['--run', 'x', '--pick', 'a', '--to', 'y']), false, '없으면 키 자체가 없다')
})

test('--check-loop: 소개형 + 문의 → 결과가 반환값과 README(ko·en)에 남는다', async () => {
  writeFeatures(local.runDir, feats('inquiry'))
  let args
  const r = await deliver(local.runDir, 'a', { to: join(tmp, 'o', 'on'), ...WITH_LF, checkLoop: true, runCheck: (dir, o) => { args = { dir, o }; return wrap(stub({ code: 0, tail: '' }).spawn)(dir, o) } })
  assert.equal(r.branch, 'intro')
  assert.equal(r.checkLoop.status, 'ok')
  assert.deepEqual(r.checkLoop.mail, { inquiryNotice: 1 })
  assert.equal(args.dir, r.dir)
  assert.deepEqual(args.o.features.outcomes, ['inquiry'])
  assert.equal(args.o.lfDir, LF)
  const md = readme(r.dir)
  const ko = md.slice(md.indexOf('## 한국어'), md.indexOf('## English'))
  const en = md.slice(md.indexOf('## English'))
  assert.ok(ko.includes(copy.checkLoopTitle.ko) && ko.includes(copy.checkLoopOk.ko))
  assert.ok(en.includes(copy.checkLoopTitle.en) && en.includes(copy.checkLoopOk.en))
  assert.ok(ko.includes(copy.inquiryMock.ko), '기존 소개형 절은 그대로 있다')
  assert.ok(ko.indexOf(copy.inquiryMock.ko) < ko.indexOf(copy.checkLoopTitle.ko) && ko.indexOf(copy.checkLoopTitle.ko) < ko.indexOf('### 실행하기'))
})

test('--check-loop: 건너뜀·실패 이유도 README 에 그대로 남는다 (옛 경로는 기능 기록이 없어 건너뜀)', async () => {
  rmSync(join(local.runDir, 'features.json'), { force: true })
  const r = await deliver(local.runDir, 'a', { to: join(tmp, 'o', 'legacy'), ...WITH_LF, checkLoop: true })
  assert.equal(r.branch, 'legacy')
  assert.equal(r.checkLoop.status, 'skipped')
  const md = readme(r.dir)
  assert.ok(md.includes(copy.checkLoopNoFeatures.ko) && md.includes(copy.checkLoopNoFeatures.en))
  const failed = { status: 'failed', reason: copy.checkLoopFailed.ko, reasonEn: copy.checkLoopFailed.en, detail: 'exit 1\nfull tail', mail: {} }
  // M1: 한국어 문장 줄 다음에 영어 원인이 코드 블록으로만 붙는다. 영어 절에는 원인이 없다
  assert.deepEqual(checkLoopSection(failed, copy, 'ko'), [copy.checkLoopTitle.ko, '', failed.reason, '', '```', 'exit 1\nfull tail', '```', '', copy.checkLoopLeftover.ko, ''])
  assert.deepEqual(checkLoopSection(failed, copy, 'en'), [copy.checkLoopTitle.en, '', failed.reasonEn, '', copy.checkLoopLeftover.en, ''])
  assert.doesNotMatch(failed.reason, /full tail|exit 1/)
  // 안에 백틱 줄이 있어도 블록이 닫히지 않게 울타리를 더 길게 한다
  const tricky = checkLoopSection({ ...failed, detail: 'a\n```\nb' }, copy, 'ko')
  assert.deepEqual(tricky.slice(4, 7), ['````', 'a\n```\nb', '````'])
  // 끝 DETAIL_LINES 줄만 싣는다(빈 줄은 센 줄에 넣지 않는다)
  const long = Array.from({ length: 45 }, (_, i) => (i % 5 === 4 ? '' : `line ${i}`)).join('\n')
  const shown = checkLoopSection({ ...failed, detail: long }, copy, 'ko')[5]
  assert.equal(DETAIL_LINES, 20)
  assert.equal(shown.split('\n').length, 20)
  assert.equal(shown, lastLines(long))
  assert.ok(shown.endsWith('line 43') && !shown.includes('line 0\n'))
  // CLI 도 같은 줄 수만 찍는다
  const cli = checkFailureText({ detail: long }).split('\n')
  assert.equal(cli.length, 1 + DETAIL_LINES)
  assert.ok(cli[0].startsWith('도구 실패: 완성 확인') && cli.at(-1) === 'line 43')
  // 건너뜀·통과에는 블록이 없다
  assert.deepEqual(checkLoopSection({ status: 'skipped', reason: copy.checkLoopNoLf.ko, reasonEn: copy.checkLoopNoLf.en, detail: 'x', mail: {} }, copy, 'ko'), [copy.checkLoopTitle.ko, '', copy.checkLoopNoLf.ko, ''])
})

test('CLI: --check-loop 가 인자로 들어오고 사용법에 있다', () => {
  assert.deepEqual(parseDeliverArgs(['--run', 'x', '--pick', 'a', '--to', 'y', '--check-loop']), { run: 'x', pick: 'a', to: 'y', deployPreview: false, checkLoop: true })
  assert.throws(() => parseDeliverArgs(['--run', 'x']), /--check-loop/)
})

test('새 문장은 deliver-copy.json 에만 있다: checkLoop* 칸마다 ko·en, 자리표시자가 같고 영어에 한글이 없다. 코드에는 한글 문장이 없다', () => {
  const keys = Object.keys(copy).filter((k) => k.startsWith('checkLoop'))
  assert.deepEqual(keys.sort(), ['checkLoopBadFeatures', 'checkLoopFailed', 'checkLoopFailedPlain', 'checkLoopLeftover', 'checkLoopMemory', 'checkLoopNoBrowser', 'checkLoopNoFeatures', 'checkLoopNoInquiry', 'checkLoopNoLf', 'checkLoopNoOwner', 'checkLoopNoPackage', 'checkLoopNoPlaywright', 'checkLoopNoSteps', 'checkLoopOk', 'checkLoopTableChanged', 'checkLoopTimedOut', 'checkLoopTitle'])
  assert.ok(copy.checkLoopMemory.ko.includes('{min}') && copy.checkLoopMemory.en.includes('{min}'), '문턱은 {min} 자리표시자 — 문장에 숫자를 박지 않는다')
  const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
  for (const k of keys) {
    assert.match(copy[k].ko, hangul, `${k}.ko`)
    assert.doesNotMatch(copy[k].en, hangul, `${k}.en`)
    assert.deepEqual(holes(copy[k].ko), holes(copy[k].en), `${k} 자리표시자`)
  }
  const code = readFileSync(join(root, 'factory', 'stamp', 'check-loop.mjs'), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/**'))
  assert.deepEqual(code.join('\n').match(/'[^'\n]*[가-힣][^'\n]*'|`[^`\n]*[가-힣][^`\n]*`/g) ?? [], [], 'check-loop.mjs 에 한글 문장이 없다')
})

// ── 소개형 문의 블록(checkIntroInquiry) — 진짜 next 대신 같은 약속(400·400·200·기록 한 줄)을 지키는 작은 서버로 블록의 논리를 본다. 진짜 next 는 heavy.
const fakeNext = (mode = 'good') => {
  const made = { stopped: 0, outbox: null, bodies: [] }
  const start = async (_dir, env) => {
    made.outbox = env.LF_MOCK_OUTBOX
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => { body += c })
      req.on('end', () => {
        made.bodies.push(body)
        if (mode === 'hang') return // 답하지 않는다 — 제한 시간 시험
        let j = null
        try { j = JSON.parse(body) } catch { /* 깨진 본문 */ }
        const valid = j && typeof j.name === 'string' && j.name.trim()
        if (!valid && mode !== 'accepts-bad') { res.statusCode = 400; res.end('{}'); return }
        const line = JSON.stringify({ id: 'abc', template: 'inquiryNotice', to: 'owner@example.com', subject: mode === 'leaks' ? j.name : 's', at: mode === 'bad-date' ? 'yesterday' : '2026-10-18T00:00:00.000Z' })
        if (mode === 'no-owner' || mode === 'no-owner-other') { res.statusCode = 503; res.end(JSON.stringify({ ok: false, formError: mode === 'no-owner' ? copy.inquiryRuntime.noOwner.ko : 'disk full' })); return } // 받는 메일이 「확인 필요」 — route.ts 의 noOwner
        if (mode === 'no-owner-record') { appendFileSync(env.LF_MOCK_OUTBOX, `${line}\n`); res.statusCode = 503; res.end('{}'); return }
        if (mode !== 'no-record') appendFileSync(env.LF_MOCK_OUTBOX, `${line}\n${mode === 'two-lines' ? `${line}\n` : ''}`)
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ ok: mode !== 'reply-not-ok', id: mode === 'wrong-id' ? 'zzz' : 'abc' }))
      })
    })
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    return { port: server.address().port, pid: 0, stop: () => { made.stopped++; server.closeAllConnections?.(); server.close() } }
  }
  return { start, made }
}

test('소개형 문의 블록: 400·400·200 뒤 기록이 expect.json 대로 1줄이면 ok, 서버와 임시 기록 폴더는 끝에 정리된다', async () => {
  const f = fakeNext()
  const s = stub({ code: 0, tail: '' })
  const r = await checkIntroInquiry(productDir(), { env: { PATH: 'x' }, spawn: s.spawn, start: f.start })
  assert.deepEqual(r, { ok: true, mail: { inquiryNotice: 1 } })
  assert.deepEqual(s.calls.map((c) => c.args.join(' ')), ['run build'], '설치가 끝난 폴더는 build 만')
  assert.equal(f.made.stopped, 1)
  assert.equal(existsSync(dirname(f.made.outbox)), false, '임시 메일 기록 폴더가 지워졌다')
})

test('소개형 문의 블록: 설치 실패·빌드 실패·서버 안 켜짐·약속 위반은 모두 failed 이고 서버는 그래도 꺼진다', async () => {
  const inst = await checkIntroInquiry(productDir({ installed: false }), { env: {}, spawn: stub((c, a) => (a[0] === 'install' ? { code: 1, tail: 'no net' } : { code: 0, tail: '' })).spawn, start: fakeNext().start })
  assert.equal(inst.ok, false)
  assert.match(inst.detail, /npm install exit 1: no net/)
  const bld = await checkIntroInquiry(productDir(), { env: {}, spawn: stub({ code: 2, tail: 'type error' }).spawn, start: fakeNext().start })
  assert.match(bld.detail, /npm run build exit 2: type error/)
  const down = await checkIntroInquiry(productDir(), { env: {}, spawn: stub({ code: 0, tail: '' }).spawn, start: async () => { throw new Error('boom: server did not start') } })
  assert.equal(down.ok, false)
  assert.match(down.detail, /server did not start/)
  const cases = { 'accepts-bad': /broken body got 200/, 'no-record': /mail records \{\}, expected/, 'two-lines': /"inquiryNotice":2/, 'wrong-id': /id differs/ }
  for (const [mode, re] of Object.entries(cases)) {
    const f = fakeNext(mode)
    const r = await checkIntroInquiry(productDir(), { env: {}, spawn: stub({ code: 0, tail: '' }).spawn, start: f.start })
    assert.equal(r.ok, false, mode)
    assert.match(r.detail, re, mode)
    assert.equal(f.made.stopped, 1, `${mode}: 서버를 끈다`)
  }
})

test('소개형 문의 블록(보강): 시험용 보낸 사람 정보는 sample.json, 답은 ok:true, 기록 시각은 날짜, 정보가 새면 실패, 응답이 없으면 제한 시간 뒤 실패', async () => {
  const f = fakeNext()
  const ok = await checkIntroInquiry(productDir(), { env: {}, spawn: stub({ code: 0, tail: '' }).spawn, start: f.start })
  assert.equal(ok.ok, true)
  const sent = JSON.parse(f.made.bodies.at(-1))
  assert.deepEqual(sent, INQUIRY_SAMPLE, '정상 접수 본문 = sample.json')
  assert.match(sent.name, hangul, '한글 보낸 사람으로 시험한다')
  assert.equal(f.made.bodies.length, 3)
  const cases = { 'reply-not-ok': /not ok:true/, 'bad-date': /not a date/, leaks: /sender data/ }
  for (const [mode, re] of Object.entries(cases)) {
    const g = fakeNext(mode)
    const r = await checkIntroInquiry(productDir(), { env: {}, spawn: stub({ code: 0, tail: '' }).spawn, start: g.start })
    assert.equal(r.ok, false, mode)
    assert.match(r.detail, re, mode)
  }
  const h = fakeNext('hang')
  const t0 = Date.now()
  const hung = await checkIntroInquiry(productDir(), { env: {}, spawn: stub({ code: 0, tail: '' }).spawn, start: h.start, fetchTimeoutMs: 150 })
  assert.equal(hung.ok, false)
  assert.ok(Date.now() - t0 < 5000, '제한 시간 안에 끝난다')
  assert.equal(h.made.stopped, 1, '응답 없는 서버도 끈다')
  assert.equal(FETCH_TIMEOUT_MS, 30_000)
})

test('F1 설치 뒤에도 폴더에 브라우저 시험 도구(@playwright/test)가 없으면 smoke 를 부르지 않고 skipped — 이유 문장에 경로가 없다', async () => {
  const s = stub({ code: 0, tail: '' })
  const dir = productDir({ installed: false })
  const r = await runCheckLoop(dir, base({ spawn: s.spawn, hasPlaywright: () => false }))
  assert.equal(r.status, 'skipped')
  assert.equal(r.key, 'checkLoopNoPlaywright')
  // I2: 설치는 먼저 하고(폴더가 설치돼야 시험 도구가 보인다), 그다음에도 없으면 smoke 없이 건너뛴다
  assert.deepEqual(s.calls.map((c) => c.args[0]), ['install'])
  assert.equal(smokeCall(s.calls), undefined)
  assert.notEqual(r.key, 'checkLoopNoBrowser')
  // M2: 이유 문장(ko·en)에 이 PC 의 절대 경로가 없다
  for (const text of [r.reason, r.reasonEn]) assert.ok(text.includes('npm install') && !text.includes(dir) && !text.includes(LF) && !text.includes(tmp), text)
  assert.doesNotMatch(r.reasonEn, hangul)
  // 이유 문장이 경로를 담게 바뀌어도 같은 가리개를 지난다
  const pathy = { ...copy, checkLoopNoPlaywright: { ko: `폴더 ${dir}`, en: `folder ${dir}` } }
  const p = await runCheckLoop(dir, base({ copy: pathy, spawn: stub({ code: 0, tail: '' }).spawn, hasPlaywright: () => false }))
  assert.equal(p.reason, '폴더 <folder>')
  assert.equal(p.reasonEn, 'folder <folder>')
  // 도구는 있는데 브라우저가 없어 smoke 가 3 으로 끝나면 그쪽 이유다
  const none = await runCheckLoop(productDir(), base({ spawn: stub({ code: 3, tail: '' }).spawn }))
  assert.equal(none.key, 'checkLoopNoBrowser')
})

test('I2 시험 도구 찾기는 설치가 끝난 뒤, 전달한 폴더(node_modules)에서: 설치 → 찾기 → smoke 순서', async () => {
  const order = []
  const dir = productDir({ installed: false })
  const s = stub((cmd, args) => { order.push(args[0] === 'install' ? 'install' : 'smoke'); return { code: 0, tail: '' } })
  const seen = []
  const r = await runCheckLoop(dir, base({ spawn: s.spawn, hasPlaywright: (d) => { order.push('find'); seen.push(d); return true } }))
  assert.equal(r.status, 'ok')
  assert.deepEqual(order, ['install', 'find', 'smoke'])
  assert.deepEqual(seen, [dir], 'launch-factory 템플릿이 아니라 전달한 폴더에서 찾는다')
  // 기본 해석: 전달한 폴더의 node_modules 에서 찾는다(launch-factory 템플릿에 설치돼 있어도 소용없다)
  const withTool = productDir()
  mkdirSync(join(withTool, 'node_modules', '@playwright', 'test'), { recursive: true })
  writeFileSync(join(withTool, 'node_modules', '@playwright', 'test', 'package.json'), '{"name":"@playwright/test","version":"0.0.0"}')
  assert.equal(defaultHasPlaywright(withTool), true)
  const lfWithTool = makeLf('lf-with-playwright', {})
  mkdirSync(join(lfWithTool, 'template', 'node_modules', '@playwright', 'test'), { recursive: true })
  writeFileSync(join(lfWithTool, 'template', 'node_modules', '@playwright', 'test', 'package.json'), '{"name":"@playwright/test","version":"0.0.0"}')
  const outside = mkdtempSync(join(tmpdir(), 'sitebrew-pw-'))
  try {
    writeFileSync(join(outside, 'package.json'), '{}')
    assert.equal(defaultHasPlaywright(outside), false)
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
  assert.equal(defaultHasPlaywright(productDir()), false, '폴더에 없으면 템플릿에 있어도 없다')
  // 설치가 실패하면 시험 도구를 찾지도 smoke 를 부르지도 않는다
  let found = 0
  const bad = await runCheckLoop(productDir({ installed: false }), base({ spawn: stub((c, a) => (a[0] === 'install' ? { code: 1, tail: 'boom' } : { code: 0, tail: '' })).spawn, hasPlaywright: () => { found++; return true } }))
  assert.equal(bad.status, 'failed')
  assert.equal(found, 0)
})

test('I5 소개형 문의 확인: 받는 메일이 「확인 필요」라 접수가 503 이면 실패가 아니라 skipped(이유 키 checkLoopNoOwner)', async () => {
  const f = fakeNext('no-owner')
  const r = await checkIntroInquiry(introDir(), { env: {}, spawn: stub({ code: 0, tail: '' }).spawn, start: f.start })
  assert.deepEqual(r, { ok: false, skip: 'checkLoopNoOwner', mail: {} })
  assert.equal(f.made.stopped, 1, '서버는 그래도 꺼진다')
  // 503 인데 기록이 남았다면 그건 결함이다
  const g = fakeNext('no-owner-record')
  const bad = await checkIntroInquiry(introDir(), { env: {}, spawn: stub({ code: 0, tail: '' }).spawn, start: g.start })
  assert.equal(bad.ok, false)
  assert.equal(bad.skip, undefined)
  assert.match(bad.detail, /got 503/)
  // runCheckLoop 은 skip 을 건너뜀으로 옮긴다 — 종료 코드를 바꾸는 failed 가 아니다
  const dir = productDir()
  const route = join(dir, INQUIRY_TARGETS.route)
  mkdirSync(join(route, '..'), { recursive: true })
  writeFileSync(route, '// route')
  const s = await runCheckLoop(dir, base({ features: feats('inquiry'), checkIntro: async () => ({ ok: false, skip: 'checkLoopNoOwner', mail: {} }) }))
  assert.equal(s.status, 'skipped')
  assert.equal(s.key, 'checkLoopNoOwner')
  assert.equal(s.reason, copy.checkLoopNoOwner.ko)
  assert.equal(s.reasonEn, copy.checkLoopNoOwner.en)
  assert.equal(s.detail, undefined)
})


test('결함 8 503 이어도 본문이 noOwner 문장이 아니면 건너뜀이 아니라 failed', async () => {
  const f = fakeNext('no-owner-other')
  const r = await checkIntroInquiry(introDir(), { env: {}, spawn: stub({ code: 0, tail: '' }).spawn, start: f.start })
  assert.equal(r.ok, false)
  assert.equal(r.skip, undefined)
  assert.match(r.detail, /got 503/)
  assert.equal(f.made.stopped, 1)
})

test('결함 8 받는 메일이 「확인 필요」면 설치·빌드 전에 건너뛴다(spawn 0, 서버 0)', async () => {
  for (const email of ['확인 필요', 'To be confirmed', '', 'a@b.c?x=1']) {
    const s = stub({ code: 0, tail: '' })
    const f = fakeNext()
    const r = await checkIntroInquiry(introDir({ email }), { env: {}, spawn: s.spawn, start: f.start })
    assert.deepEqual(r, { ok: false, skip: 'checkLoopNoOwner', ran: false, mail: {} }, email)
    assert.equal(s.calls.length, 0, email)
    assert.equal(f.made.outbox, null, email)
  }
  // 쓸 수 있는 주소가 있으면 평소대로 돈다
  const s = stub({ code: 0, tail: '' })
  const ok = await checkIntroInquiry(introDir({ email: 'owner@example.com' }), { env: {}, spawn: s.spawn, start: fakeNext().start })
  assert.equal(ok.ok, true)
  // runCheckLoop 은 이른 건너뜀을 「돌리지 않음」(ran 없음)으로 옮긴다
  const dir = introDir({ email: '확인 필요' })
  mkdirSync(join(dir, INQUIRY_TARGETS.route, '..'), { recursive: true })
  writeFileSync(join(dir, INQUIRY_TARGETS.route), '// route')
  const sk = await runCheckLoop(dir, base({ features: feats('inquiry'), checkIntro: (d, o) => checkIntroInquiry(d, { ...o, spawn: stub({ code: 0, tail: '' }).spawn, start: fakeNext().start }) }))
  assert.equal(sk.status, 'skipped')
  assert.equal(sk.key, 'checkLoopNoOwner')
  assert.equal(sk.ran, false)
})

test('결함 3 defaultHasPlaywright: 상위 폴더 node_modules 의 @playwright/test 는 없는 것으로 본다', () => {
  const outer = mkdtempSync(join(BASE, 'pw-outer-'))
  mkdirSync(join(outer, 'node_modules', '@playwright', 'test'), { recursive: true })
  writeFileSync(join(outer, 'node_modules', '@playwright', 'test', 'package.json'), '{"name":"@playwright/test","version":"0.0.0"}')
  const inner = join(outer, 'out')
  mkdirSync(inner)
  writeFileSync(join(inner, 'package.json'), '{}')
  assert.equal(defaultHasPlaywright(inner), false)
  // 같은 폴더 안에 있으면 있다(해석 캐시를 피하려고 다른 폴더로)
  const inner2 = join(outer, 'out2')
  mkdirSync(join(inner2, 'node_modules', '@playwright', 'test'), { recursive: true })
  writeFileSync(join(inner2, 'package.json'), '{}')
  writeFileSync(join(inner2, 'node_modules', '@playwright', 'test', 'package.json'), '{"name":"@playwright/test","version":"0.0.0"}')
  assert.equal(defaultHasPlaywright(inner2), true)
})

test('결함 5 소개형 설치·빌드 실패 detail 은 끝 20줄이다', async () => {
  const tail = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n')
  const b = await checkIntroInquiry(introDir(), { env: {}, spawn: stub({ code: 2, tail }).spawn, start: fakeNext().start })
  assert.equal(b.detail.split('\n').length, DETAIL_LINES)
  assert.match(b.detail, /^npm run build exit 2: line 11\n/)
  assert.ok(b.detail.endsWith('line 30'))
  const dir = introDir()
  rmSync(join(dir, 'node_modules'), { recursive: true })
  const i = await checkIntroInquiry(dir, { env: {}, spawn: stub({ code: 1, tail }).spawn, start: fakeNext().start })
  assert.equal(i.detail.split('\n').length, DETAIL_LINES)
  assert.match(i.detail, /^npm install exit 1: line 11/)
})

test('결함 10 제품형: components/blocks 가 없으면 smoke 를 띄우지 않고 failed', async () => {
  for (const missing of ['ax', 'blocks']) {
    const dir = productDir()
    rmSync(join(dir, 'components', missing), { recursive: true })
    const s = stub({ code: 0, tail: '' })
    const r = await runCheckLoop(dir, base({ spawn: s.spawn }))
    assert.equal(r.status, 'failed', missing)
    assert.match(r.detail, new RegExp(`components[\\\\/]${missing}`)) // Windows 는 경로 구분자가 \
    assert.equal(smokeCall(s.calls), undefined)
    assert.doesNotMatch(r.detail, hangul)
  }
})

test('결함 10 smoke 가 시간 제한에 걸리면 failed 이고 이유가 시간 제한이다', async () => {
  const r = await runCheckLoop(productDir(), base({ spawn: stub({ code: null, tail: 'x', timedOut: true }).spawn }))
  assert.equal(r.status, 'failed')
  assert.equal(r.key, 'checkLoopTimedOut')
  assert.equal(r.reason, copy.checkLoopTimedOut.ko)
  assert.equal(r.reasonEn, copy.checkLoopTimedOut.en)
  for (const lang of ['ko', 'en']) assert.ok(checkLoopSection(r, copy, lang).includes(copy.checkLoopTimedOut[lang]))
  assert.match(checkStatusText(r), new RegExp(copy.checkLoopTimedOut.ko.slice(0, 8)))
})

test('F2 런타임 오류는 던지지 않고 failed 가 된다: 깨진 메일 기록·깨진 표·옛 키트(단계 표 없음)', async () => {
  // 깨진 outbox JSON
  const dir = productDir()
  const out = join(dir, LOOP_OUTBOX_DIR)
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'outbox-1.jsonl'), '{not json\n')
  const bad = await runCheckLoop(dir, base({ spawn: stub({ code: 0, tail: '' }).spawn }))
  assert.equal(bad.status, 'failed')
  assert.match(bad.detail, /JSON/i)
  // 표를 읽을 수 없는 launch-factory(표 파일 없음 · table 인자도 없음)
  const noTable = join(tmp, `lf-no-table-${n++}`)
  mkdirSync(noTable, { recursive: true })
  const t = await runCheckLoop(productDir(), base({ lfDir: noTable }))
  assert.equal(t.status, 'failed')
  // 단계 표 파일이 없는 옛 키트: 던지지 않고 돌릴 단계가 없어 건너뛴다
  const old = makeLf('lf-old', {})
  rmSync(join(old, 'template', 'e2e', 'loop-steps.json'))
  const s = stub({ code: 0, tail: '' })
  const o = await runCheckLoop(productDir(), base({ lfDir: old, spawn: s.spawn }))
  assert.equal(o.status, 'skipped')
  assert.equal(o.key, 'checkLoopNoSteps')
  assert.equal(s.calls.length, 0)
  // spawn 자체가 던져도
  const boomDir = productDir({ installed: false })
  const boom = await runCheckLoop(boomDir, base({ spawn: async () => { throw new Error(`spawn boom at ${boomDir}`) } }))
  assert.equal(boom.status, 'failed')
  assert.match(boom.detail, /spawn boom/)
  assert.ok(!boom.detail.includes(boomDir) && !boom.reason.includes(boomDir), '절대 경로가 이유·원인에 없다')
})

test('F2 deliver: 확인이 던져도 전달은 끝나고 README·AGENTS.md 가 써지며 결과는 failed 로 남는다', async () => {
  writeFeatures(local.runDir, feats('inquiry'))
  const r = await deliver(local.runDir, 'a', { to: join(tmp, 'o', 'throws'), ...WITH_LF, checkLoop: true, runCheck: async () => { throw new Error('boom from check') } })
  assert.equal(r.branch, 'intro')
  assert.equal(r.checkLoop.status, 'failed')
  assert.match(r.checkLoop.detail, /boom from check/)
  assert.equal(r.checkLoop.reason, copy.checkLoopFailed.ko)
  assert.ok(existsSync(join(r.dir, 'AGENTS.md')))
  const md = readme(r.dir)
  assert.ok(md.includes('boom from check') && md.includes(copy.checkLoopTitle.ko))
  // M1: 한국어 문장 줄에는 영어 원인이 없고, 원인은 한국어 절의 코드 블록 안에만 있다
  const ko = md.slice(md.indexOf('## 한국어'), md.indexOf('## English'))
  assert.ok(ko.includes(`${copy.checkLoopFailed.ko}\n\n\`\`\`\nboom from check\n\`\`\`\n`), ko)
  assert.ok(!md.slice(md.indexOf('## English')).includes('boom from check'), '영어 절은 한국어 절의 블록을 가리키기만 한다')
})

test('F6 옛 경로의 까닭이 완성 확인 이유에 이어진다: 표가 바뀜 · launch-factory 못 찾음 · 기록 없음', async () => {
  writeFeatures(local.runDir, { version: 1, table: 'stale-hash', outcomes: ['inquiry'] })
  const hash = await deliver(local.runDir, 'a', { to: join(tmp, 'o', 'hash'), ...WITH_LF, checkLoop: true })
  assert.equal(hash.checkLoop.key, 'checkLoopTableChanged')
  assert.ok(readme(hash.dir).includes(copy.checkLoopTableChanged.ko) && readme(hash.dir).includes(copy.checkLoopTableChanged.en))
  writeFeatures(local.runDir, feats('inquiry'))
  const nolf = await deliver(local.runDir, 'a', { to: join(tmp, 'o', 'nolf'), wfRoot: join(tmp, 'nowhere', 'wf'), env: {}, checkLoop: true })
  assert.equal(nolf.checkLoop.key, 'checkLoopNoLf')
  rmSync(join(local.runDir, 'features.json'), { force: true })
  const none = await deliver(local.runDir, 'a', { to: join(tmp, 'o', 'none'), ...WITH_LF, checkLoop: true })
  assert.equal(none.checkLoop.key, 'checkLoopNoFeatures')
})

test('F4·F10 문턱은 한 값이다: 메모리 문장의 {min}, smoke 의 LF_SMOKE_MIN_FREE_GB, 우리 문턱이 같다', async () => {
  const s = stub({ code: 0, tail: '' })
  await runCheckLoop(productDir(), base({ spawn: s.spawn }))
  assert.equal(smokeCall(s.calls).env.LF_SMOKE_MIN_FREE_GB, String(MIN_FREE_GB))
  const low = await runCheckLoop(productDir(), base({ freeGb: () => 0.7 }))
  assert.ok(low.reason.includes(`${MIN_FREE_GB} GB`) && low.reason.includes('0.7'), low.reason)
  assert.ok(low.reasonEn.includes(`${MIN_FREE_GB} GB`))
  assert.equal(low.key, 'checkLoopMemory')
})

test('F9 긴 출력의 이 PC 절대 경로는 가려진다 · README 에 남은 폴더 안내는 돌렸을 때만 있다', async () => {
  const dir = productDir()
  const tail = `Error: Cannot find ${join(dir, 'app', 'x.ts')}\n  at ${join(LF, 'template', 'a.mjs')}\n  at ${homedir()}\\foo ${dir.split('\\').join('/')}/y`
  const r = await runCheckLoop(dir, base({ spawn: stub({ code: 1, tail }).spawn }))
  assert.equal(r.status, 'failed')
  for (const text of [r.detail, r.reason, r.reasonEn]) {
    assert.ok(!text.includes(dir) && !text.includes(dir.split('\\').join('/')) && !text.includes(LF) && !text.includes(homedir()), text)
  }
  assert.ok(r.detail.includes('<folder>') && r.detail.includes('<launch-factory>'))
  for (const lang of ['ko', 'en']) {
    const ranOk = checkLoopSection({ status: 'ok' }, copy, lang)
    const ranFail = checkLoopSection(r, copy, lang)
    const skipped = checkLoopSection({ status: 'skipped', reason: 'x', reasonEn: 'x' }, copy, lang)
    assert.ok(ranOk.includes(copy.checkLoopLeftover[lang]) && ranFail.includes(copy.checkLoopLeftover[lang]))
    assert.ok(!skipped.includes(copy.checkLoopLeftover[lang]), '돌리지 않았으면 남은 것이 없다')
  }
})

// 건너뜀 기준선(ci/baselines/skipped-tests.txt)은 모든 PC 에서 같아야 한다 — 진짜 launch-factory 가 필요한 가벼운 시험은 LF_DIR 이 있을 때만 돈다
const REAL_LF = process.env.LF_DIR || null
test('진짜 launch-factory (LF_DIR 이 있을 때): 표·단계 표로 LOOP_FEATURES 를 만들고, smoke 가 없는 폴더에서는 진짜 node 가 종료 1 로 실패한다', { skip: REAL_LF ? false : 'LF_DIR 없음' }, async () => {
  const { loadOutcomes } = await import('../intake/features.mjs')
  const real = loadOutcomes(REAL_LF)
  const s = stub({ code: 0, tail: '' })
  await runCheckLoop(productDir(), { lfDir: REAL_LF, features: { version: 1, table: real.hash, outcomes: ['signup', 'payments'] }, copy, freeGb: () => 8, hasPlaywright: () => true, spawn: s.spawn, env: { PATH: 'x' } })
  assert.equal(smokeCall(s.calls).env.LOOP_FEATURES, 'signup,payments')
  // 폴더 자신의 scripts/ci/smoke.mjs 가 없으면 진짜 node 가 1 로 끝난다(3 = 브라우저 없음과 섞이지 않는다)
  const bare = productDir()
  const r = await runCheckLoop(bare, { lfDir: REAL_LF, features: { version: 1, table: real.hash, outcomes: ['signup'] }, copy, freeGb: () => 8, hasPlaywright: () => true, env: { ...process.env } })
  assert.equal(r.status, 'failed')
  assert.match(r.detail, /smoke\.mjs/)
})

// ── 경로 가리기(scrubPaths): 대소문자·JSON 이스케이프·8.3 짧은 이름 ─────────────────────────
const SCRUB_PAIRS = (dir) => [[dir, '<folder>'], [homedir(), '~']]

test('scrubPaths: 대소문자가 달라도 가린다', () => {
  const dir = join(tmp, 'case-dir')
  const out = scrubPaths(`at ${dir.toUpperCase()}${sep}a.ts and ${dir.toLowerCase()}/b.ts`, SCRUB_PAIRS(dir), { env: {} })
  assert.ok(!out.toLowerCase().includes(dir.toLowerCase()), out)
  assert.equal(out.match(/<folder>|~/g)?.length >= 2, true, out)
})

test('scrubPaths: JSON 이스케이프(역슬래시 두 개)·슬래시·섞인 모양도 가린다', () => {
  const dir = join(tmp, 'json-dir')
  const escaped = dir.replaceAll('\\', '\\\\')
  const mixed = dir.replaceAll('\\', '/') + '\\sub'
  const out = scrubPaths(JSON.stringify({ message: `Cannot find ${join(dir, 'x.ts')}` }) + ' ' + escaped + '\\\\y ' + mixed, SCRUB_PAIRS(dir), { env: {} })
  for (const form of [dir, escaped, dir.replaceAll('\\', '/')]) assert.ok(!out.includes(form), `${form} 가 남음: ${out}`)
  assert.ok(out.includes('<folder>'), out)
})

test('scrubPaths: TEMP 가 8.3 짧은 이름이면 그 모양도 가린다 — 사용자 이름은 코드에 없고 실행 때 만든다', () => {
  const home = homedir()
  const shortHome = join(dirname(home), 'SHORTU~1')
  const rawTemp = join(shortHome, 'AppData', 'Local', 'Temp')
  const longDir = join(home, 'AppData', 'Local', 'Temp', 'out-1')
  const opts = { env: { TEMP: rawTemp, TMP: rawTemp }, home, tmp: rawTemp, realpath: (p) => p.replace(shortHome, home) }
  const shortDir = join(rawTemp, 'out-1')
  const text = `Error: ${join(shortDir, 'app', 'x.ts')}\n json ${shortDir.replaceAll('\\', '\\\\')}\n home ${shortHome} lower ${shortDir.toLowerCase()}`
  const out = scrubPaths(text, [[longDir, '<folder>'], [home, '~']], opts)
  assert.ok(!/shortu~1/i.test(out), out)
  assert.ok(out.includes('<folder>') && out.includes('~'), out)
  // 별칭이 없으면(옵션 없음 = 짧은 이름을 모름) 못 가린다 — 시험이 별칭 경로를 실제로 타는지 확인
  const without = scrubPaths(text, [[longDir, '<folder>'], [home, '~']], { env: {}, home, tmp: longDir, realpath: (p) => p })
  assert.ok(/shortu~1/i.test(without), '별칭 없이는 짧은 이름이 남는다')
})

test('F9b deliver: 확인이 던진 오류 문장의 이 PC 경로도 같은 가리개를 지난다', async () => {
  writeFeatures(local.runDir, feats('inquiry'))
  const dest = join(tmp, 'o', 'throws-path')
  const r = await deliver(local.runDir, 'a', { to: dest, ...WITH_LF, checkLoop: true, runCheck: async () => { throw new Error(`boom at ${dest.toUpperCase()} ${dest.replaceAll('\\', '\\\\')} ${homedir()}`) } })
  assert.equal(r.checkLoop.status, 'failed')
  for (const text of [r.checkLoop.detail, r.checkLoop.reason, r.checkLoop.reasonEn]) {
    assert.ok(!text.toLowerCase().includes(dest.toLowerCase()) && !text.includes(dest.replaceAll('\\', '\\\\')) && !text.includes(homedir()), text)
  }
  assert.ok(r.checkLoop.detail.includes('<folder>'))
})

test('결함 4 README 로그에서 다른 드라이브·다른 사용자의 절대 경로가 사라진다 — 상대 경로·주소는 남는다', () => {
  assert.equal(scrubAbsolute('at E:\\work\\x\\y.js:3'), 'at <path>')
  assert.equal(scrubAbsolute('at E:/work/someone/proj/a.ts and /home/ci/work/b.mjs, /root/c'), 'at <path> and <path>, <path>')
  assert.equal(scrubAbsolute('{"file":"E:\\\\x\\\\y"}'), '{"file":"<path>"}')
  const keep = 'see ./app/page.tsx, app/api/x.ts, https://example.com/home/page and <folder>/home/x'
  assert.equal(scrubAbsolute(keep), keep)
  const out = join(tmp, 'scrub-out')
  const text = scrubFor(out, LF)(`Error at ${join(out, 'a.ts')} and E:\\work\\other\\z.js:9 and ./app/page.tsx`)
  assert.equal(text, 'Error at <folder>/a.ts and <path> and ./app/page.tsx'.replace('/', sep))
})
