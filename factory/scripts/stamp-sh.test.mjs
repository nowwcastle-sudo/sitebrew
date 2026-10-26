// FINAL-WF S5·P4 — site-install.mjs sh(): 자식에게 사용자 키 이름을 넘기지 않고, 시간 제한을 걸고, 실패 메시지에 로그 마지막 20줄을 싣는다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/stamp-sh.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sh, shTimeoutMs } from '../stamp/site-install.mjs'
import { failMessage, tailLog } from '../stamp/fail-message.mjs'
import { SECRET_ENV_NAMES, envWithoutSecrets, powershellPath } from '../lib/secret-env.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'wf-sh-'))

test('S5: sh() 의 자식 환경에는 사용자 키 이름(SECRET_ENV_NAMES·HIGGSFIELD_*)이 없고, 일반 환경 변수와 명령별 env 는 그대로 간다', async () => {
  const dir = tmp()
  const log = join(dir, 'env.log')
  const saved = {}
  const set = { PEXELS_API_KEY: 'k-pex', LAW_API_OC: 'k-law', VERCEL_TOKEN: 'k-ver', POSTHOG_PROJECT_KEY: 'k-ph', HIGGSFIELD_DIR: 'D:/x', HIGGSFIELD_SOMETHING: 'h', WF_PLAIN_VAR: 'plain' }
  for (const [k, v] of Object.entries(set)) { saved[k] = process.env[k]; process.env[k] = v }
  try {
    const code = await sh(`node -e "process.stdout.write(JSON.stringify(process.env))"`, dir, log, { env: { WF_EXTRA: 'extra' } })
    assert.equal(code, 0)
    const env = JSON.parse(readFileSync(log, 'utf8'))
    for (const k of ['PEXELS_API_KEY', 'LAW_API_OC', 'VERCEL_TOKEN', 'POSTHOG_PROJECT_KEY', 'HIGGSFIELD_DIR', 'HIGGSFIELD_SOMETHING']) assert.equal(env[k], undefined, `${k} 가 자식 환경에 새어 갔다`)
    assert.equal(env.WF_PLAIN_VAR, 'plain', '양성 대조: 일반 환경 변수는 간다')
    assert.equal(env.WF_EXTRA, 'extra', '명령별 env 도 간다')
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
})

test('S5: 키 이름 목록은 소스가 readSecret 으로 읽는 이름을 모두 품는다(새 키를 더하고 목록에서 빠뜨리면 실패)', () => {
  const names = new Set()
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'site-template' && e.name !== 'fixtures') walk(p) } else if (/\.mjs$/.test(e.name) && !/\.test\.mjs$/.test(e.name)) {
        for (const m of readFileSync(p, 'utf8').matchAll(/readSecret\(\s*["']([A-Z0-9_]+)["']/g)) names.add(m[1])
      }
    }
  }
  walk(join(root, 'factory'))
  assert.ok(names.size >= 4, `readSecret 이름을 ${names.size}개만 읽었다 — 읽기가 깨졌다`)
  const missing = [...names].filter((n) => !SECRET_ENV_NAMES.includes(n) && !/^FV1_/.test(n))
  assert.deepEqual(missing, [], '목록에 없는 키 이름 — factory/lib/secret-env.mjs SECRET_ENV_NAMES 에 더한다')
  assert.deepEqual(envWithoutSecrets({ PEXELS_API_KEY: 'x', A: '1' }), { A: '1' })
})

test('P4: 시간 제한을 넘기면 프로세스를 끝내고 종료 124, 로그에 까닭 한 줄 — WF_SH_TIMEOUT_MS 로 기본값(20분)을 바꾼다', async () => {
  assert.equal(shTimeoutMs({}), 20 * 60 * 1000)
  assert.equal(shTimeoutMs({ WF_SH_TIMEOUT_MS: '1500' }), 1500)
  assert.equal(shTimeoutMs({ WF_SH_TIMEOUT_MS: 'abc' }), 20 * 60 * 1000)
  const dir = tmp()
  const log = join(dir, 'slow.log')
  const t0 = Date.now()
  const code = await sh(`node -e "setTimeout(() => {}, 60000)"`, dir, log, { timeoutMs: 800 })
  assert.equal(code, 124)
  assert.ok(Date.now() - t0 < 20000, '제한을 넘겨 끝없이 기다리지 않는다')
  assert.match(readFileSync(log, 'utf8'), /시간 제한 1초를 넘겨 중단했다/)
  // 양성 대조: 제한 안에 끝나는 명령은 제 종료 코드
  assert.equal(await sh(`node -e "process.exit(3)"`, dir, join(dir, 'fast.log'), { timeoutMs: 30000 }), 3)
})

test('P4: 실패 메시지는 한 줄 요약 + 로그 마지막 20줄(빈 줄 제외) — 로그가 없으면 요약만', () => {
  const dir = tmp()
  const log = join(dir, 'build.log')
  writeFileSync(log, Array.from({ length: 30 }, (_, i) => `줄 ${i + 1}`).join('\n') + '\n\n')
  const msg = failMessage('next build', 1, log)
  assert.match(msg, /^도구 실패: next build 종료 1 — /)
  assert.match(msg, /--- 로그 마지막 20줄 ---/)
  assert.match(msg, /줄 30$/)
  assert.match(msg, /줄 11\n/)
  assert.doesNotMatch(msg, /줄 10\n/, '21번째부터 앞줄은 싣지 않는다')
  assert.equal(tailLog(log, 20).split('\n').length, 20)
  assert.equal(failMessage('x', 2, join(dir, '없음.log')), `도구 실패: x 종료 2 — ${join(dir, '없음.log')}`)
})

test('S5: 사용자 환경 읽기는 Windows PowerShell 5.1 의 절대 경로로 부른다(SystemRoot 없으면 C:\\Windows) — PATH·작업 폴더의 다른 powershell.exe 를 실행하지 않는다', () => {
  assert.equal(powershellPath({ SystemRoot: 'D:\\WinX' }), 'D:\\WinX\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
  assert.equal(powershellPath({}), 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
  const src = readFileSync(join(root, 'factory', 'lib', 'secret-env.mjs'), 'utf8')
  assert.doesNotMatch(src, /execFileSync\(\s*['"]powershell/, '상대 이름 powershell 로 부르지 않는다')
  assert.match(src, /execFileSync\(powershellPath\(env\)/)
})

// FINAL-WF P5: 템플릿의 shadcn 은 정확히 고정이고(registry:check 의 shadcn@4.22.1 과 같다), 잠금 파일이 package.json 과 맞아야 npm ci 가 돈다.
test('P5: 사이트 템플릿 shadcn 은 4.22.1 정확 고정 · 잠금 파일의 루트 의존성이 package.json 과 같고 npm ci 로 설치한다', () => {
  const dir = join(root, 'factory', 'stamp', 'site-template')
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  assert.equal(pkg.dependencies.shadcn, '4.22.1')
  const lock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8'))
  assert.equal(lock.lockfileVersion >= 3, true)
  const rootPkg = lock.packages['']
  assert.deepEqual(rootPkg.dependencies, pkg.dependencies, '잠금 파일을 package.json 에서 다시 만든다(docs/qa/site-template-lock.md)')
  assert.deepEqual(rootPkg.devDependencies, pkg.devDependencies)
  assert.equal(lock.packages['node_modules/shadcn'].version, '4.22.1', '잠금 파일의 shadcn 도 같은 버전')
  assert.equal(lock.packages['node_modules/next'].version, pkg.dependencies.next)
  const install = readFileSync(join(root, 'factory', 'stamp', 'site-install.mjs'), 'utf8')
  assert.match(install, /hasLock \? 'npm ci --no-audit --no-fund'/)
})

test('P4: 06 시작 안내 두 줄(ko 다음 en)이 stamp.mjs 의 쪽 만들기 단계에 있고, 설치·빌드 실패는 failMessage 로 던진다', () => {
  const stamp = readFileSync(join(root, 'factory', 'stamp', 'stamp.mjs'), 'utf8')
  const ko = stamp.indexOf('06 쪽 만들기 시작 — 첫 후보는 템플릿 설치까지 20분 안팎')
  const en = stamp.indexOf('06 building pages - the first run installs the site template')
  assert.ok(ko > 0 && en > ko, 'ko 줄 다음에 en 줄')
  assert.ok(ko < stamp.indexOf('pagesMod.generateSite('), '안내는 06 을 돌리기 전에')
  assert.match(stamp, /failMessage\('next build'/)
  const install = readFileSync(join(root, 'factory', 'stamp', 'site-install.mjs'), 'utf8')
  assert.equal([...install.matchAll(/failMessage\(/g)].length >= 3, true, '템플릿 npm install·shadcn build 두 곳이 failMessage 를 쓴다')
  assert.match(readFileSync(join(root, 'factory', 'stamp', 'gen-pages.mjs'), 'utf8'), /failMessage\('shadcn add'/)
})
