// 사이트 종류와 서버 환경(계획 4 Task 3, 모듈 K) — 전달받은 폴더가 소개형인지 제품형(launch-factory 얹힘)인지 가르고,
//   터널 서버 프로세스에만 줄 환경을 만든다. 제품형은 가짜(mock) 인증·결제 환경 네 개를 더한다 — 이 환경은 자식 프로세스에만 가고
//   사용자 폴더 파일(.env)에는 쓰지 않는다.
//   · 파일 읽기는 fs 인자로 받는다(기본은 node:fs). 환경은 base 인자로 받고 바꾸지 않는다.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { envWithoutSecrets } from '../lib/secret-env.mjs'

const LF_PACKAGE_PREFIX = '@launch-factory/'
const ENABLED_FILE = ['lib', 'launch', 'enabled.json']
const defaultFs = { exists: existsSync, readFile: (p) => readFileSync(p, 'utf8') }

/** reason 이 붙은 오류 */
function reasoned(reason, message) {
  return Object.assign(new Error(message), { reason })
}

/** 폴더 종류: { product } — enabled.json 이 있거나 package.json 의 dependencies 에 @launch-factory/* 가 있으면 제품형 */
export function siteKind(dir, fs = defaultFs) {
  const pkgFile = join(dir, 'package.json')
  if (!fs.exists(pkgFile)) throw reasoned('noPackage', `no package.json in ${dir}`)
  let pkg
  try {
    pkg = JSON.parse(fs.readFile(pkgFile))
  } catch {
    throw reasoned('noPackage', `package.json is not readable JSON in ${dir}`)
  }
  const viaDeps = Object.keys(pkg?.dependencies ?? {}).some((name) => name.startsWith(LF_PACKAGE_PREFIX))
  return { product: viaDeps || fs.exists(join(dir, ...ENABLED_FILE)) }
}

/** 터널 서버 프로세스의 환경. 비밀 이름을 빼고, 제품형이면 mock 네 개, 소개형이면 LF_ 로 시작하는 이름을 뺀다. */
export function serveEnv(kind, { base = process.env, outboxFile } = {}) {
  const env = { ...envWithoutSecrets(base), NEXT_TELEMETRY_DISABLED: '1' }
  if (!kind.product) {
    for (const k of Object.keys(env)) if (k.startsWith('LF_')) delete env[k]
    return env
  }
  if (!outboxFile) throw new Error('outboxFile is required for a product folder')
  return { ...env, LF_MODE: 'mock', LF_ALLOW_MOCK_PROD: '1', LF_MOCK_SUB: 'none', LF_MOCK_OUTBOX: outboxFile }
}
