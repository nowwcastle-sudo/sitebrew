// 후보 사이트 설치(P3-3 Task 9) — 뼈대(site-template)에 로컬 레지스트리로 레시피·블록을 shadcn add 하고 next build 를 돌린다.
//   소비자 검사와 같은 방식이다(factory/scripts/recipe-swap.mjs): shadcn build 로 항목 json 을 만들고, 항목 사이 의존 주소
//   nowwcastle-sudo/sitebrew/<이름>#vX 를 ../localreg/<이름>.json 으로 바꿔 사이트 폴더(cwd)에서 add 한다. 원격·태그가 필요 없다(C81).
//   node_modules 는 템플릿에서 한 번 설치해 .tmp/stamp-template 에 두고 후보마다 robocopy 로 복사한다(Turbopack 은 junction 을 받지 않는다 — P3-2).
//   무거운 실행(shadcn build·add·next build)은 부르는 쪽이 실행 잠금(원장 gate 줄) 안에서 한다.
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { localRegistry } from '../scripts/recipe-swap.mjs'
import { envWithoutSecrets } from '../lib/secret-env.mjs'
import { failMessage, tailLog } from './fail-message.mjs'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), 'site-template')
export const SHADCN = 'shadcn@4.21.0'
const CACHE = join(ROOT, '.tmp', 'stamp-template')
const REG_CACHE = join(ROOT, '.tmp', 'stamp-registry')

const sha = (s) => createHash('sha256').update(s).digest('hex')

/** 셸 명령 한 개의 시간 제한(밀리초) — 기본 20분, 환경 변수 WF_SH_TIMEOUT_MS 로 바꾼다(FINAL-WF P4: 멈춘 npm install 이 끝없이 기다리지 않게). */
export const shTimeoutMs = (env = process.env) => { const n = Number(env.WF_SH_TIMEOUT_MS); return Number.isFinite(n) && n > 0 ? n : 20 * 60 * 1000 }

/**
 * 셸 명령 한 줄을 돌려 출력은 로그 파일에 쓴다(append 면 이어 쓴다). env 는 이 명령에만 더하는 환경 변수. → 종료 코드
 * 자식 환경에서는 사용자 키 이름(SECRET_ENV_NAMES — secret-env.mjs)을 뺀다: 서드파티 설치 스크립트(npm install·shadcn add)가 키를 읽지 못하게(FINAL-WF S5). 사이트 빌드는 키를 쓰지 않는다.
 * 시간 제한을 넘으면 프로세스 트리째 끝내고 로그에 한 줄 남긴 뒤 종료 코드 124 를 돌려준다.
 */
export const sh = (cmd, cwd, log, { env, append = false, timeoutMs = shTimeoutMs() } = {}) => new Promise((res) => {
  const out = createWriteStream(log, append ? { flags: 'a' } : undefined)
  const p = spawn(cmd, { cwd, shell: true, env: { ...envWithoutSecrets(process.env), ...(env ?? {}) } })
  p.stdout.pipe(out)
  p.stderr.pipe(out)
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    out.write(`\n[시간 제한 ${Math.round(timeoutMs / 1000)}초를 넘겨 중단했다 — WF_SH_TIMEOUT_MS 로 늘린다]\n`)
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' })
    else p.kill('SIGKILL')
  }, timeoutMs)
  p.on('close', (code) => { clearTimeout(timer); out.end(() => res(timedOut ? 124 : code)) })
})

export { failMessage, tailLog }

/** robocopy(Windows) — 0~7 이 성공이다. 폴더 복사(하위 포함). */
export function robocopy(src, dest, { exclude = [] } = {}) {
  mkdirSync(dest, { recursive: true })
  // Windows 가 아니면(Linux CI — P3-8 이식성) robocopy 가 없다: fs.cpSync 로 같은 일을 한다. /XD 처럼 이름이 exclude 에 든 폴더는 어느 깊이든 건너뛴다.
  if (process.platform !== 'win32') {
    cpSync(src, dest, { recursive: true, force: true, filter: (p) => !exclude.includes(basename(p)) })
    return
  }
  const r = spawnSync('robocopy', [src, dest, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/MT:8', ...(exclude.length ? ['/XD', ...exclude] : [])], { encoding: 'utf8' })
  if (r.status === null || r.status >= 8) throw new Error(`robocopy 실패(${r.status}): ${src} → ${dest}\n${r.stdout ?? ''}${r.stderr ?? ''}`)
}

/** 템플릿 파일 목록(node_modules 제외)의 해시 — 템플릿이 바뀌면 후보 사이트가 다시 만든다. */
export function templateHash() {
  const files = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (!e.isDirectory()) files.push(p)
      else if (e.name !== 'node_modules') walk(p)
    }
  }
  walk(TEMPLATE)
  return sha(files.sort().map((f) => `${f.slice(TEMPLATE.length)}\n${readFileSync(f, 'utf8')}`).join('\n\0'))
}

/**
 * .tmp/stamp-template 에 템플릿 파일 + node_modules 를 둔다(package.json·잠금 파일이 그대로면 설치를 건너뛴다). → 캐시 폴더
 * 템플릿에 package-lock.json 이 있으면 `npm ci` 로 잠금대로 설치한다(FINAL-WF P5 — 같은 템플릿이 날마다 다른 의존성 버전으로 깔리지 않게). 없으면 예전처럼 `npm install`.
 * 잠금 파일은 package.json 과 어긋나면 npm ci 가 멈추므로 시험(stamp-sh.test.mjs)이 루트 의존성을 맞춰 본다 — package.json 을 고치면 잠금도 다시 만든다(docs/qa/site-template-lock.md).
 */
export async function ensureTemplateCache({ log = join(ROOT, '.tmp', 'stamp-template-install.log') } = {}) {
  mkdirSync(CACHE, { recursive: true })
  const lockFile = join(TEMPLATE, 'package-lock.json')
  const hasLock = existsSync(lockFile)
  const pkg = readFileSync(join(TEMPLATE, 'package.json'), 'utf8') + (hasLock ? `\n--lock--\n${readFileSync(lockFile, 'utf8')}` : '')
  const marker = join(CACHE, '.pkg-hash')
  const same = existsSync(join(CACHE, 'node_modules')) && existsSync(marker) && readFileSync(marker, 'utf8') === sha(pkg)
  robocopy(TEMPLATE, CACHE, { exclude: ['node_modules'] })
  if (!same) {
    const code = await sh(hasLock ? 'npm ci --no-audit --no-fund' : 'npm install --no-audit --no-fund', CACHE, log)
    if (code !== 0) throw new Error(failMessage(hasLock ? '템플릿 npm ci' : '템플릿 npm install', code, log))
    writeFileSync(marker, sha(pkg))
  }
  return CACHE
}

/** 저장소 로컬 레지스트리 빌드(shadcn build) → .tmp/stamp-registry/r0. 생성물(레지스트리 json)이 그대로면 건너뛴다. */
/** 캐시 키: registry.json 만이 아니라 registry/factory 아래 모든 파일의 내용을 본다 — 항목 json 은 파일 본문을 담지 않아 블록·부품 소스를 고쳐도 registry.json 은 그대로다(P3-4 perf 실측: 옛 캐시로 옛 히어로가 설치됐다). */
export function repoRegistryKey(root = ROOT) {
  const files = []
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else files.push(p) } }
  const base = join(root, 'registry', 'factory')
  if (existsSync(base)) walk(base)
  const h = createHash('sha256')
  for (const f of [join(root, 'registry.json'), ...files.sort()].filter(existsSync)) h.update(f.slice(root.length)).update('\0').update(readFileSync(f)).update('\0')
  h.update(readFileSync(join(root, 'package.json'), 'utf8'))
  return h.digest('hex')
}

const LAYERS = ['ax', 'blocks', 'content', 'contract', 'fonts', 'icons', 'lib', 'motion', 'r', 'ui']

/**
 * 저장소 레지스트리 입력 키. 층 registry.json 은 파일 이름만 적고 내용은 적지 않으므로, 그것만 해시하면 원천(.ts·.tsx·.css)을 고쳐도 키가 그대로라
 * 낡은 shadcn build 결과(.tmp/stamp-registry)를 계속 쓴다(P3-3 Task 14b 골든 — geo-entity·seo-meta 를 고쳤는데 후보 빌드가 옛 사본으로 타입 검사에 떨어졌다).
 * 그래서 항목이 가리키는 파일의 내용까지 넣는다.
 */
export function registryInputsKey(root = ROOT) {
  const metas = ['registry.json', ...LAYERS.map((l) => join('registry', 'factory', l, 'registry.json'))].map((f) => join(root, f)).filter(existsSync)
  const parts = []
  for (const meta of metas) {
    const text = readFileSync(meta, 'utf8')
    parts.push(`${meta}:${sha(text)}`)
    let items = []
    try { items = JSON.parse(text).items ?? [] } catch { /* 모양이 깨졌으면 메타 해시만 — shadcn build 가 그 오류를 낸다 */ }
    for (const item of items) for (const f of item.files ?? []) {
      const file = [join(dirname(meta), f.path), join(root, f.path)].find((p) => existsSync(p))
      parts.push(`${item.name}:${f.path}:${file ? sha(readFileSync(file)) : 'missing'}`)
    }
  }
  return sha(parts.join('\n') + readFileSync(join(root, 'package.json'), 'utf8'))
}

export async function ensureRepoRegistry() {
  const key = registryInputsKey()
  const out = join(REG_CACHE, 'r0')
  const marker = join(REG_CACHE, '.key')
  if (existsSync(out) && existsSync(marker) && readFileSync(marker, 'utf8') === key) return out
  mkdirSync(REG_CACHE, { recursive: true })
  rmSync(out, { recursive: true, force: true })
  const log = join(REG_CACHE, 'build-repo.log')
  const code = await sh(`npx -y ${SHADCN} build -o "${out}"`, ROOT, log)
  if (code !== 0) throw new Error(failMessage('shadcn build', code, log))
  writeFileSync(marker, key)
  return out
}

/** 생성·브랜드 후보의 임시 레시피 레지스트리(registry.json)를 shadcn build 한다. → 빌드 폴더 */
export async function buildCandidateRegistry(registryDir, outDir) {
  rmSync(outDir, { recursive: true, force: true })
  const log = join(dirname(outDir), 'build-candidate.log')
  const code = await sh(`npx -y ${SHADCN} build -o "${outDir}"`, registryDir, log)
  if (code !== 0) throw new Error(failMessage('후보 레지스트리 shadcn build', code, log))
  return outDir
}

/**
 * 사이트 폴더 준비: 템플릿 캐시(node_modules 포함)를 복사한다. 이미 있으면 node_modules 는 두고 생성 폴더만 비운 뒤 템플릿 파일을 다시 덮는다.
 */
export function prepareSiteDir(siteDir, cache) {
  const keep = join(siteDir, 'node_modules')
  if (existsSync(siteDir)) for (const e of readdirSync(siteDir)) if (e !== 'node_modules') rmSync(join(siteDir, e), { recursive: true, force: true })
  robocopy(cache, siteDir, { exclude: existsSync(keep) ? ['node_modules'] : [] })
}

/** shadcn add — 로컬 레지스트리(../localreg)의 항목 이름들을 한 번에. → { code, log } */
export async function addItems(siteDir, names, log) {
  const args = names.map((n) => `../localreg/${n}.json`).join(' ')
  const code = await sh(`npx -y ${SHADCN} add ${args} -y -o`, siteDir, log)
  return { code, log }
}

/** 로컬 레지스트리 폴더 만들기(사이트 옆 ../localreg). → { files, rewritten, remaining } */
export const makeLocalRegistry = (buildDirs, dest) => localRegistry(buildDirs, dest)

/**
 * next build. → { code, seconds, log, typecheck }
 * WF_BUILD_SPLIT_TYPECHECK=1(메모리가 모자란 머신 — 타입 검사 작업자(~0.6GB)가 빌드 본체(~1.2GB)와 겹쳐 정점을 만든다): 타입 검사를 빌드와 따로 먼저 한다 —
 * `next typegen && tsc --noEmit`(Next.js 문서 CLI 「next typegen」: 빌드 없이 타입 검사하는 CI 방식)이 실패하면 거기서 실패시키고(타입 검사는 여전히 강제), 통과하면 빌드는
 * WF_BUILD_SKIP_TYPECHECK=1 로 돌려 next.config 가 `typescript.ignoreBuildErrors` 로 내장 타입 검사를 건너뛴다(같은 검사를 두 번 하지 않는다). 변수가 없으면 예전과 똑같이 `npm run build` 한 번이다.
 */
export async function nextBuild(siteDir, log) {
  const t0 = Date.now()
  let code
  let typecheck = 'next'
  if (process.env.WF_BUILD_SPLIT_TYPECHECK === '1') {
    typecheck = 'split'
    const bin = (n) => `"${join(siteDir, 'node_modules', '.bin', n)}"` // 사이트 폴더의 설치본만 쓴다(npx 는 위쪽 폴더의 같은 이름을 먼저 잡을 수 있다)
    code = await sh(`${bin('next')} typegen && ${bin('tsc')} --noEmit`, siteDir, log)
    if (code === 0) code = await sh('npm run build', siteDir, log, { append: true, env: { WF_BUILD_SKIP_TYPECHECK: '1' } })
    else appendFileSync(log, '\n[타입 검사 실패 — tsc 단계(WF_BUILD_SPLIT_TYPECHECK=1), next build 는 돌리지 않았다]\n')
  } else code = await sh('npm run build', siteDir, log)
  return { code, seconds: Math.round((Date.now() - t0) / 100) / 10, log, typecheck }
}

/** 폴더 안 파일 크기의 합(바이트). */
export function dirBytes(dir) {
  if (!existsSync(dir)) return 0
  let n = 0
  for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); n += e.isDirectory() ? dirBytes(p) : statSync(p).size }
  return n
}
