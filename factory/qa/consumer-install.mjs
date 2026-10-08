// 소비자 설치 검증 도구(P3-2 Task 9, 대장 A23 — 그동안 작업 스크래치에만 있던 `consumer-check`·`serve-reg` 를 저장소로).
// 사용: node factory/qa/consumer-install.mjs --dir <빈 폴더> --add <항목,항목,…> [--file <소비자 안 경로>=<원본 파일> …] [--build] [--fetch <경로>:<content-type 앞부분> …]
//                                              [--port 4971] [--out <json>] [--reuse] [--batch] [--dry-run]
// 하는 일(태그를 찍기 전이라 GitHub 대신 로컬 빌드로 — docs/qa/recipe-install-test.md 와 같은 방식):
//  1. 루트 registry.json 을 `shadcn build` 로 구워 `<dir>/localreg/` 에 둔다. 의존 주소 `nowwcastle-sudo/sitebrew/<이름>#vX.Y.Z` 만 `../localreg/<이름>.json` 으로 바꾼다
//     (shadcn 은 항목 경로·의존 경로를 모두 명령을 실행한 폴더 기준으로 읽는다 — 소비자 폴더에서 실행하므로 `../localreg`).
//  2. `<dir>` 에서 `shadcn init -t next -b base -p nova -n consumer -y --no-monorepo`(네트워크 필요 — create-next-app).
//  3. 소비자 폴더에서 `--add` 의 항목을 순서대로 `add ../localreg/<항목>.json -y -o`(`--batch` 면 한 번의 `add` 호출에 모두 — 블록 수십 개를 깔 때).
//  4. `--file` 로 받은 파일을 소비자 안에 복사(예: 그 항목을 부르는 페이지). 5. `--build` 면 `npm run build`.
//  6. `--fetch` 가 있으면 `next start` 를 띄워 그 경로들을 받아 상태 200 과 content-type 을 본다(서버는 끝에서 프로세스 나무째 끈다).
// 종료: 0 = 모든 단계 통과, 1 = 단계 실패 또는 도구 실패(`도구 실패:`, --out 파일을 남기지 않는다), 2 = 인자 오류. 표: docs/agents/agent-guide.md §3.
// 무거운 관문이다 — `next build` 하나와 서버 하나(진행 기록 잠금 heavy). 설치 폴더는 저장소 밖에 둔다.
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DEP_RE = /^nowwcastle-sudo\/sitebrew\/([a-z0-9-]+)#v\d+\.\d+\.\d+$/

export function parseArgs(argv) {
  const o = { add: [], files: [], fetch: [], build: false, reuse: false, batch: false, dryRun: false, port: 4971 }
  const need = (i, f) => { if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`${f} 값이 필요하다`); return argv[i + 1] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dir') o.dir = need(i++, a)
    else if (a === '--add') o.add = need(i++, a).split(',').filter(Boolean)
    else if (a === '--file') { const [dst, src] = need(i++, a).split('='); if (!dst || !src) throw new Error('--file <소비자 안 경로>=<원본 파일>'); o.files.push({ dst, src }) }
    else if (a === '--fetch') { const [p, ct] = need(i++, a).split(':'); if (!p?.startsWith('/')) throw new Error('--fetch /경로[:content-type 앞부분]'); o.fetch.push({ path: p, type: ct ?? '' }) }
    else if (a === '--port') o.port = Number(need(i++, a))
    else if (a === '--out') o.out = need(i++, a)
    else if (a === '--build') o.build = true
    else if (a === '--reuse') o.reuse = true
    else if (a === '--batch') o.batch = true
    else if (a === '--dry-run') o.dryRun = true
    else throw new Error(`알 수 없는 인자 ${a}`)
  }
  if (!o.dir) throw new Error('--dir 가 필요하다')
  if (!o.add.length) throw new Error('--add 가 필요하다')
  if (o.fetch.length && !o.build) throw new Error('--fetch 는 --build 와 함께')
  if (!Number.isInteger(o.port) || o.port < 1024) throw new Error('--port 는 1024 이상 정수')
  return o
}

// 구운 항목 JSON 한 개의 의존 주소를 로컬 경로로 — 주소 밖(이미 로컬이거나 다른 레지스트리)은 그대로 둔다. 바꾼 수를 센다.
export function localize(item) {
  let n = 0
  const deps = (item.registryDependencies ?? []).map((d) => { const m = DEP_RE.exec(d); if (!m) return d; n++; return `../localreg/${m[1]}.json` })
  return { item: { ...item, ...(item.registryDependencies ? { registryDependencies: deps } : {}) }, changed: n }
}

const fail = (msg) => { console.error(`도구 실패: ${msg}`); process.exit(1) }
const shadcn = join(ROOT, 'node_modules', 'shadcn', 'dist', 'index.js')

function run(label, cmd, args, cwd, log) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: cmd === 'npm', maxBuffer: 64 * 1024 * 1024 })
  log.push({ step: label, exit: r.status, tail: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-6).join('\n') })
  console.log(`${r.status === 0 ? '통과' : '실패'} ${label} (종료 ${r.status})`)
  return r.status === 0
}

async function probe(consumer, port, list, log) {
  const server = spawn(process.execPath, [join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)], { cwd: consumer, stdio: 'ignore' })
  const kill = () => spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  try {
    let up = false
    for (let i = 0; i < 60 && !up; i++) { await new Promise((r) => setTimeout(r, 1000)); up = await fetch(`http://localhost:${port}/`).then(() => true, () => false) }
    if (!up) { log.push({ step: 'next start', exit: 1, tail: '60초 안에 뜨지 않았다' }); return false }
    let ok = true
    for (const f of list) {
      const res = await fetch(`http://localhost:${port}${f.path}`)
      const type = res.headers.get('content-type') ?? ''
      const bytes = (await res.arrayBuffer()).byteLength
      const pass = res.status === 200 && type.startsWith(f.type) && bytes > 0
      ok &&= pass
      log.push({ step: `GET ${f.path}`, exit: pass ? 0 : 1, tail: `${res.status} ${type} ${bytes}B` })
      console.log(`${pass ? '통과' : '실패'} GET ${f.path} — ${res.status} ${type} ${bytes}B`)
    }
    return ok
  } finally { kill() }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  let o
  try { o = parseArgs(process.argv.slice(2)) } catch (e) { console.error(`consumer-install: ${e.message}`); process.exit(2) }
  const dir = resolve(o.dir)
  if (o.dryRun) { console.log(JSON.stringify({ dir, add: o.add, files: o.files, build: o.build, fetch: o.fetch, port: o.port })); process.exit(0) }
  if (existsSync(dir) && readdirSync(dir).length && !o.reuse) fail(`${dir} 가 비어 있지 않다(--reuse 로 이어 받는다)`)
  mkdirSync(dir, { recursive: true })
  const log = []
  const out = mkdtempSync(join(tmpdir(), 'wf-ci-'))
  try {
    if (!run('shadcn build', process.execPath, [shadcn, 'build', '-o', out], ROOT, log)) fail('shadcn build 가 실패했다')
    const reg = join(dir, 'localreg')
    mkdirSync(reg, { recursive: true })
    let files = 0, rewritten = 0
    for (const f of readdirSync(out).filter((n) => n.endsWith('.json') && n !== 'registry.json')) {
      const { item, changed } = localize(JSON.parse(readFileSync(join(out, f), 'utf8')))
      writeFileSync(join(reg, f), JSON.stringify(item))
      files++; rewritten += changed
    }
    if (!files || !rewritten) fail(`로컬 레지스트리를 만들지 못했다(파일 ${files}·바꾼 의존 ${rewritten})`)
    console.log(`로컬 레지스트리: 항목 ${files}개 · 의존 주소 ${rewritten}개를 ../localreg 로`)
    const consumer = join(dir, 'consumer')
    let ok = existsSync(consumer) || run('shadcn init', process.execPath, [shadcn, 'init', '-t', 'next', '-b', 'base', '-p', 'nova', '-n', 'consumer', '-y', '--no-monorepo'], dir, log)
    const groups = o.batch ? [o.add] : o.add.map((item) => [item])
    for (const g of groups) ok = ok && run(`shadcn add ${g.length > 1 ? `${g.length}개(${g[0]} …)` : g[0]}`, process.execPath, [shadcn, 'add', ...g.map((item) => `../localreg/${item}.json`), '-y', '-o'], consumer, log)
    for (const f of o.files) { if (ok) { mkdirSync(dirname(join(consumer, f.dst)), { recursive: true }); cpSync(resolve(f.src), join(consumer, f.dst)); log.push({ step: `copy ${f.dst}`, exit: 0, tail: '' }) } }
    if (ok && o.build) ok = run('npm run build', 'npm', ['run', 'build'], consumer, log)
    if (ok && o.fetch.length) ok = await probe(consumer, o.port, o.fetch, log)
    const summary = { ok, dir, add: o.add, steps: log }
    if (o.out) writeFileSync(o.out, JSON.stringify(summary, null, 2))
    console.log(ok ? '소비자 설치 검증: 통과' : '소비자 설치 검증: 실패')
    process.exit(ok ? 0 : 1)
  } finally { rmSync(out, { recursive: true, force: true }) }
}
