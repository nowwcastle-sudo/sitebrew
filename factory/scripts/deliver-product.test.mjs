// deliver 분기 무거운 시험(sitebrew v0.2.0 계획 3 Task 9·10) — 진짜 launch-factory composeProduct·npm install·next build·next start·smoke 를 돈다. 일반 단위 시험(npm run ci:test)에는 들어가지 않는다 — ci/tests-heavy.txt.
//   1) 소개형 + 문의 + --check-loop: 전달 폴더를 설치·빌드하고 켜서 POST /api/inquiry 한 번 → 가짜 메일 기록이 deliver-assets/inquiry/expect.json 대로 1줄 남는다(잘못된 본문은 400, 기록 없음 — check-loop.mjs 의 checkIntroInquiry 가 본다).
//   2) 소개형 + 문의, 정적 내보내기: WF_STATIC_EXPORT=1 빌드가 끝나고 app/api/inquiry 는 없으며 문의 폼 번들에 mailto 갈래가 있다.
//   3) 제품형(saas {signup,payments}): 진짜 composeProduct 출력이 설치·빌드되고, 가입·요금제 쪽이 200 이며 제품 이름·OG 언어가 시안의 것이다.
//   4) 제품형 출력에 완성 확인(smoke --mode loop): ok 이거나 브라우저(또는 시험 도구)가 없어 skipped. ok 면 메일 기록이 단계 표의 mail 대로다.
// 메모리 여유가 3.0 GB 보다 적으면 시험은 건너뛰고 값을 적는다(무거운 실행은 한 번에 하나). 띄운 서버는 PID 나무째 끄고 임시 폴더를 지운다. 대표의 키는 쓰지 않는다 — 자식 환경에서 공급자 이름을 뺀다.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { freemem } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { writeFeatures, loadOutcomes } from '../intake/features.mjs'
import { resolveLf } from '../intake/resolve-lf.mjs'
import { envWithoutSecrets } from '../lib/secret-env.mjs'
import { runCheckLoop } from '../stamp/check-loop.mjs'
import { DELIVER_COPY, deliver } from '../stamp/deliver.mjs'
import { INQUIRY_EXPECT } from '../stamp/deliver-intro.mjs'
import { killTree, run, startServer } from '../stamp/run-proc.mjs'
import { guardKeep } from './lib/keep-on-fail.mjs'
import { gen, localBrief, localContent, makeRun, root, SAAS_BRIEF, saasContent } from './lib/stamp-site-fixtures.mjs'

const MIN_FREE_GB = 3
const freeGb = () => freemem() / 2 ** 30
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const BASE = join(root, '.tmp', 'deliver-product-test')
mkdirSync(BASE, { recursive: true })
const tmp = mkdtempSync(join(BASE, 't-'))
const lfDir = resolveLf({ env: process.env, wfRoot: root })
const servers = []

let keep = false
after(() => {
  for (const pid of servers) killTree(pid)
  // 시험이 하나라도 실패하면 출력 폴더를 지우지 않는다 — 실패한 빌드를 같은 폴더에서 다시 돌려 볼 수 있어야 한다
  if (keep) return console.error(`시험이 실패해서 출력 폴더를 남겼다(손으로 지운다): ${tmp}`)
  rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 })
})
const markKeep = () => { keep = true }
const itest = (name, opts, fn) => test(name, opts, guardKeep(fn, markKeep))
const logTail = (text, n = 40) => String(text ?? '').split(/\r?\n/).slice(-n).join('\n')

/** 켠 서버 하나(next start). 끝나면 stop() 으로 PID 나무째 끈다. after 가 남은 서버도 끈다. */
const serve = async (...args) => {
  const srv = await startServer(...args)
  servers.push(srv.pid)
  return srv
}
/** 시험을 돌릴 수 있는지: launch-factory 를 찾았고, 메모리 여유가 있고, (needs 가 있으면) 앞 시험의 결과가 있다. 아니면 이유를 적고 건너뛴다(조용히 통과하지 않는다). */
const guard = (t, needs = null) => {
  const free = freeGb()
  const why = !lfDir ? 'launch-factory 를 못 찾음(LF_DIR 또는 ../launch-factory)' : free < MIN_FREE_GB ? `heavy batch(메모리)로 미룸: 여유 ${free.toFixed(2)} GB < ${MIN_FREE_GB} GB` : needs && !needs.value ? `앞 시험이 건너뛰어졌다: ${needs.label}` : null
  if (why) { t.skip(why); return false }
  return true
}
const env = () => ({ ...envWithoutSecrets(process.env), NEXT_TELEMETRY_DISABLED: '1', CI: '1' })
const installBuild = async (dir, extraEnv = {}) => {
  const e = { ...env(), ...extraEnv }
  const i = await run(NPM, ['install', '--no-audit', '--no-fund', '--prefer-offline'], { cwd: dir, env: e, timeoutMs: 20 * 60_000 })
  assert.equal(i.code, 0, `npm install 종료 ${i.code}${i.timedOut ? ' (시간 제한에 걸려 끔)' : ''} · 폴더 ${dir}\n${logTail(i.tail)}`)
  return e
}
const build = async (dir, e) => {
  const t0 = Date.now()
  const b = await run(NPM, ['run', 'build'], { cwd: dir, env: e, timeoutMs: 20 * 60_000 })
  // 실패하면 어느 폴더에서 몇 초 만에 어떻게 끝났는지(시간 제한이었는지)와 빌드 출력 끝 40줄을 남긴다
  assert.equal(b.code, 0, `npm run build 종료 ${b.code}${b.timedOut ? ' (시간 제한에 걸려 끔)' : ''} · ${Math.round((Date.now() - t0) / 1000)}초 · 폴더 ${dir}\n${logTail(b.tail)}`)
}

let local, saas, introDir, productDir, productFeatures
// before 훅이 던져도(예: 06 생성 실패) 출력 폴더를 남긴다 — 훅 실패는 itest 를 거치지 않는다(결함 9)
before(guardKeep(async () => {
  if (freeGb() < MIN_FREE_GB || !lfDir) return // 시험이 각자 건너뛴다
  local = await makeRun(join(tmp, 'local'), localBrief(), localContent)
  await gen(local, { install: true })
  saas = await makeRun(join(tmp, 'saas'), SAAS_BRIEF, saasContent)
  // install: true — 시안의 블록·부품(components/ax · components/blocks)은 06 의 shadcn add 가 가져온다. false 로 만들면 이 폴더로는 빌드가 풀 수 없는 모듈(28건)로 멈춘다(진단 2026-10-18: install:true 출력은 npm install 238초 · build 74초에 끝난다)
  await gen(saas, { install: true })
}, markKeep))

itest('소개형 + 문의 + --check-loop: 설치·빌드·서버·잘못된 본문 400 둘·정상 접수 한 번 → 가짜 메일 기록이 expect.json 대로 1줄', { timeout: 40 * 60_000 }, async (t) => {
  if (!guard(t)) return
  const table = loadOutcomes(lfDir)
  writeFeatures(local.runDir, { version: 1, table: table.hash, outcomes: ['inquiry'] })
  const dest = join(tmp, 'intro')
  const r = await deliver(local.runDir, 'a', { to: dest, lf: lfDir, env: {}, checkLoop: true })
  assert.equal(r.branch, 'intro')
  introDir = dest
  assert.ok(existsSync(join(dest, 'app', 'api', 'inquiry', 'route.ts')))
  assert.ok(existsSync(join(dest, 'lib', 'inquiry-copy.json')))
  // 건너뛰는 것은 시험 도중 메모리가 줄었을 때뿐이다 — 다른 건너뜀(문의 접수 없음 등)은 시험 자체가 틀렸다는 뜻이라 실패다
  if (r.checkLoop.key === 'checkLoopMemory') return t.skip(`완성 확인이 건너뜀: ${r.checkLoop.reason}`)
  assert.equal(r.checkLoop.status, 'ok', `${r.checkLoop.reason}\n${r.checkLoop.detail}`)
  assert.deepEqual(r.checkLoop.mail, INQUIRY_EXPECT, '접수 한 번 → expect.json 줄 수')
  assert.deepEqual(r.checkLoop.mail, { inquiryNotice: 1 })
  const md = readFileSync(join(dest, 'README.md'), 'utf8')
  assert.ok(md.includes(DELIVER_COPY.checkLoopOk.ko) && md.includes(DELIVER_COPY.checkLoopOk.en))
})

itest('소개형 + 문의, 정적 내보내기: route 가 빠지고 빌드가 끝나며 문의 폼 번들에 mailto 갈래가 있다', { timeout: 40 * 60_000 }, async (t) => {
  if (!guard(t, { value: introDir, label: '소개형 전달 폴더가 없다' })) return
  if (!existsSync(join(introDir, 'node_modules'))) return t.skip('앞 시험의 완성 확인이 설치까지 가지 못했다')
  const routeFile = join(introDir, 'app', 'api', 'inquiry', 'route.ts')
  const routeBefore = readFileSync(routeFile, 'utf8')
  const e = { ...env(), WF_STATIC_EXPORT: '1' }
  await build(introDir, e)
  assert.equal(readFileSync(routeFile, 'utf8'), routeBefore, '정적 빌드가 끝난 뒤에도 사용자 폴더의 route.ts 는 그대로 제자리에 있다')
  assert.equal(existsSync(join(introDir, '.wf-saved-inquiry')), false, '옆 폴더가 남지 않는다')
  const out = join(introDir, '.next-export')
  const all = readdirSync(out, { recursive: true }).map(String).filter((p) => statSync(join(out, p)).isFile())
  assert.equal(all.some((p) => /(^|[\\/])api[\\/]inquiry/.test(p)), false, '내보낸 폴더에 접수 경로 파일이 없다')
  const text = all.filter((p) => /\.(?:js|html|txt|json|rsc|map)$/.test(p)).map((p) => [p, readFileSync(join(out, p), 'utf8')])
  assert.ok(text.length > 0)
  assert.deepEqual(text.filter(([, s]) => s.includes('/api/inquiry')).map(([p]) => p), [], '내보낸 JS·HTML 어디에도 /api/inquiry 가 없다(죽은 갈래까지 빠졌다)')
  assert.ok(text.some(([p, s]) => p.endsWith('.js') && s.includes('mailto:')), '정적 빌드의 문의 폼은 mailto 로 간다')
})

itest('제품형(saas {signup,payments}): 진짜 composeProduct 출력이 설치·빌드되고 가입·요금제 쪽이 200, 제품 이름·OG 언어가 시안의 것이다', { timeout: 60 * 60_000 }, async (t) => {
  if (!guard(t)) return
  const table = loadOutcomes(lfDir)
  productFeatures = { version: 1, table: table.hash, outcomes: ['signup', 'payments'] }
  writeFeatures(saas.runDir, productFeatures)
  const dest = join(tmp, 'product')
  const r = await deliver(saas.runDir, 'a', { to: dest, lf: lfDir, env: {} })
  assert.equal(r.branch, 'product')
  assert.equal(r.rootMetaSkipped, undefined, `뿌리 메타 자리를 못 찾았다: ${r.rootMetaSkipped}`)
  const md = readFileSync(join(dest, 'README.md'), 'utf8')
  for (const needle of ['npm install', 'npm run dev', 'G-auth', 'G-billing', 'PADDLE_API_KEY']) assert.ok(md.includes(needle), needle)
  const { modeEnv } = await import(pathToFileURL(join(lfDir, 'template', 'scripts', 'ci', 'smoke-lib.mjs')).href)
  // 빌드 전에 시안의 블록이 들어 있는지 본다 — 없으면 20분 기다릴 필요 없이 바로 알린다
  for (const d of ['components/ax', 'components/blocks']) assert.ok(existsSync(join(dest, d)), `${d} 가 전달 폴더에 없다 — 시안을 install: true 로 만든다`)
  const e = { ...(await installBuild(dest)), ...modeEnv('mock', env()) }
  await build(dest, e)
  productDir = dest
  const srv = await serve(dest, e, '/sign-up')
  try {
    for (const path of ['/sign-up', '/pricing']) {
      const res = await fetch(`http://127.0.0.1:${srv.port}${path}`)
      assert.equal(res.status, 200, path)
    }
    const html = await (await fetch(`http://127.0.0.1:${srv.port}/sign-up`)).text()
    assert.doesNotMatch(html, /Example App/, '템플릿 제품 이름 자리 표시가 남지 않는다')
    assert.match(html, /예약노트/)
    assert.match(html, /property="og:locale" content="ko_KR"/)
  } finally {
    srv.stop()
  }
})

itest('제품형 출력에 완성 확인(smoke --mode loop): ok 이거나 브라우저 없음 skipped, ok 면 메일 기록이 단계 표의 mail 대로다', { timeout: 60 * 60_000 }, async (t) => {
  if (!guard(t, { value: productDir, label: '제품형 전달 폴더가 없다' })) return
  const r = await runCheckLoop(productDir, { lfDir, features: productFeatures, copy: DELIVER_COPY })
  if (r.status === 'skipped') {
    // 브라우저가 없거나 시험 도중 메모리가 줄었다 — 이유가 문장으로 남아 있어야 한다. 조용한 통과가 아니다.
    assert.ok(['checkLoopNoBrowser', 'checkLoopNoPlaywright', 'checkLoopMemory'].includes(r.key), `${r.key}: ${r.reason}`)
    return t.skip(`완성 확인이 건너뜀: ${r.reason}`)
  }
  assert.equal(r.status, 'ok', `${r.reason}\n${r.detail}`)
  const steps = JSON.parse(readFileSync(join(lfDir, 'template', 'e2e', 'loop-steps.json'), 'utf8'))
  const expected = Object.assign({}, ...productFeatures.outcomes.map((id) => steps.mail[id]))
  assert.deepEqual(r.mail, expected, '메일 기록은 고른 기능의 단계 표 mail 과 같다')
})
