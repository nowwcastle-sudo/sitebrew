// Vercel 미리보기 배포(P3-3 Task 13): deployPreview(siteDir, opts) → { url, argv }
//   vercel build → vercel deploy --prebuilt, 둘 다 target 을 preview 로 못 박는다. 프로덕션 배포는 이 도구가 못 한다(운영자가 한다 — 계획 §9 Q14).
//   가드: 인자 어디든 `--prod`·`production`(대소문자 무관)·preview 가 아닌 `--target` 이 있으면 프로세스를 띄우기 전에 던진다.
//   토큰: readSecret("VERCEL_TOKEN") 이 있으면 자식 프로세스 환경 변수(VERCEL_TOKEN)로만 넘긴다 — 인자(--token)에 싣지 않는다(공식 가이드: 토큰을 플래그에 하드코딩하지 말 것).
//         없으면 CLI 로그인(대표 O1)을 쓴다. 토큰 값은 오류·로그 어디에도 싣지 않는다(maskSecrets).
//   배포 주소는 <후보 폴더>/08-board.json 의 data.previewUrl 에 적는다(run-dir 단계 파일 모양 { inputHash, producedAt, data } 를 지킨다).
// 실제 배포는 Task 14 골든 1개에서 한 번만 한다 — 시험은 spawn 을 주입해 argv 를 고정한다.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { maskSecrets, readSecret } from '../lib/secret-env.mjs'

export const DEFAULT_PROJECT = 'wf-preview'
const PROJECT = /^[a-z0-9][a-z0-9._-]{0,99}$/
const URL_RE = /https:\/\/[A-Za-z0-9][A-Za-z0-9-]*\.vercel\.app\b[^\s"'<>]*/g

/** 프로덕션으로 갈 수 있는 인자를 실행 전에 막는다. args: 명령 하나의 인자 목록(vercel 자체는 뺀다). */
export function assertPreviewOnly(args) {
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i])
    if (/^--prod(?:uction)?(?:=|$)/i.test(a) || /production/i.test(a)) throw new Error(`프로덕션 배포는 이 도구가 하지 않는다 — 인자 「${a}」. 프로덕션은 운영자가 직접 한다.`)
    if (/^--target(?:=|$)/i.test(a)) {
      const value = a.includes('=') ? a.slice(a.indexOf('=') + 1) : String(args[i + 1] ?? '')
      if (value !== 'preview') throw new Error(`--target 은 preview 만 쓴다(받은 값 「${value}」).`)
    }
  }
}

/** 실행할 명령 목록. 미리보기 빌드와 배포를 같은 project·target 으로 부른다. */
export function previewCommands({ project = DEFAULT_PROJECT, extraArgs = [] } = {}) {
  if (!PROJECT.test(project)) throw new Error(`Vercel 프로젝트 이름은 소문자·숫자·. _ - 만 쓴다: ${JSON.stringify(project)}`)
  const common = ['--yes', '--target=preview', '--project', project, ...extraArgs]
  return [
    ['vercel', 'build', ...common],
    ['vercel', 'deploy', '--prebuilt', ...common],
  ]
}

/** 기본 실행기 — vercel(Windows 는 vercel.cmd)을 돌려 { code, stdout, stderr } 를 돌려준다. 인자는 위에서 정규식·가드를 거친 것뿐이다. */
export function defaultSpawn(cmd, args, { cwd, env, timeoutMs = 20 * 60 * 1000 } = {}) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { cwd, env, shell: process.platform === 'win32', windowsHide: true })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => p.kill(), timeoutMs)
    p.stdout.on('data', (d) => { stdout += d })
    p.stderr.on('data', (d) => { stderr += d })
    p.on('error', (e) => { clearTimeout(timer); res({ code: 127, stdout, stderr: `${stderr}${e.message}` }) })
    p.on('close', (code) => { clearTimeout(timer); res({ code: code ?? 1, stdout, stderr }) })
  })
}

/** 08-board.json 에 미리보기 주소를 적는다(있으면 data 를 보존해 합친다). */
export function writePreviewUrl(candDir, url, now = () => new Date().toISOString()) {
  const file = join(candDir, '08-board.json')
  let saved = { inputHash: 'deploy-preview', data: {} }
  if (existsSync(file)) {
    try { const j = JSON.parse(readFileSync(file, 'utf8')); if (j && typeof j === 'object') saved = j } catch { /* 깨진 파일은 새로 쓴다 */ }
  }
  const data = { ...(saved.data && typeof saved.data === 'object' ? saved.data : {}), previewUrl: url, previewDeployedAt: now() }
  mkdirSync(candDir, { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify({ ...saved, producedAt: saved.producedAt ?? now(), data }, null, 2) + '\n')
  renameSync(`${file}.tmp`, file)
  return file
}

/**
 * 사이트 폴더(<실행>/<후보>/site)를 Vercel 미리보기로 배포한다.
 * opts: { project, extraArgs, spawn = defaultSpawn, readSecret = readSecret, env = process.env, board = true }
 * → { url, argv } (argv: 실제로 돌린 명령 목록 — 토큰 없음)
 */
export async function deployPreview(siteDir, opts = {}) {
  const { spawn: run = defaultSpawn, env = process.env, board = true } = opts
  const read = opts.readSecret ?? readSecret
  const cmds = previewCommands(opts)
  for (const [, ...args] of cmds) assertPreviewOnly(args) // 어느 것도 실행하기 전에 전부 검사한다
  const token = read('VERCEL_TOKEN', env)
  const childEnv = { ...env, ...(token ? { VERCEL_TOKEN: token } : {}) }
  const secrets = [token]
  let last
  for (const [cmd, ...args] of cmds) {
    last = await run(cmd, args, { cwd: siteDir, env: childEnv })
    if (last.code !== 0) {
      const tail = maskSecrets(`${last.stderr ?? ''}\n${last.stdout ?? ''}`, secrets).trim().split(/\r?\n/).slice(-8).join('\n')
      throw new Error(`도구 실패: ${cmd} ${args[0]} 종료 ${last.code}\n${tail}`)
    }
  }
  const urls = maskSecrets(last.stdout ?? '', secrets).match(URL_RE)
  if (!urls) throw new Error('도구 실패: vercel deploy 출력에서 배포 주소(https://….vercel.app)를 찾지 못했다')
  const url = urls[urls.length - 1]
  if (board) writePreviewUrl(dirname(siteDir), url)
  return { url, argv: cmds.map((c) => [...c]) }
}
