// hyperframes 렌더 래퍼(GUIDE S1·S6·S7 — 이 PC 실측 절차를 한 곳에). 템플릿 폴더 + 입력(사진·변수 행) → mp4.
//   node factory/media/render-hyperframes.mjs --template ken-burns-stills --input a.jpg --input b.jpg … --out <file.mp4> [--no-check] [--keep]
//   node factory/media/render-hyperframes.mjs --template <t> --rows rows.json --out "<폴더>/{name}.mp4"      (브리프 사실 배치 — hf-rows.mjs 가 rows.json 을 만든다)
// 하지 않는 것: `hyperframes init`(전역 스킬을 덮어쓴다 — GUIDE 함정 1). 작업 폴더는 템플릿 폴더를 그대로 복사해 만든다(hyperframes.json·meta.json 이 이미 들어 있다).
// 템플릿 폴더 = factory/media/hyperframes/<이름>/ { index.html · hyperframes.json · meta.json · wf-template.json({ inputs }) }.
//   입력 사진은 assets/s1.jpg … sN.jpg 로, gsap 은 assets/gsap.min.js 로 복사한다(렌더 중 네트워크 없음).
//   순서: lint(에러 0) → check(종료 0) → render --quality looks --workers 1 [--strict-variables]. 하나라도 실패하면 렌더하지 않고 던진다.
// 05 미디어(stamp/media.mjs)는 hyperframesAvailable() 이 참일 때만 렌더한다: 환경 변수 WF_HYPERFRAMES=1(무거운 일이라 명시적으로 켠다 — 크롬·ffmpeg·npx 내려받기) 이고 npx 가 있을 때.
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const HF_VERSION = '0.8.111'
export const TEMPLATES_DIR = join(ROOT, 'factory', 'media', 'hyperframes')
export const WORK_DIR = join(ROOT, '.tmp', 'hyperframes-work')
const GSAP = join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js')
const NAME = /^[a-z0-9][a-z0-9-]*$/

/** hyperframes CLI 인자(순수). 버전 고정 npx 호출. */
export function hfArgs(sub, extra = []) {
  return ['--yes', `hyperframes@${HF_VERSION}`, sub, ...extra]
}

/** render 인자(순수): 단건(output + 선택 variables) 또는 배치(rows 파일 + output 패턴 — 행 키 전부가 선언돼 있어야 한다). */
export function renderArgs({ output, rows = null, variables = null, quality = 'looks', workers = 1 }) {
  if (!output) throw new Error('output 이 비었다')
  const base = ['--quality', quality, '--workers', String(workers), '--output', output]
  if (rows) return hfArgs('render', ['--batch', rows, '--batch-concurrency', '1', '--strict-variables', ...base])
  return hfArgs('render', [...base, ...(variables ? ['--variables', JSON.stringify(variables), '--strict-variables'] : [])])
}

/** 켜져 있고(WF_HYPERFRAMES=1) npx 가 있으면 참. exec 은 시험이 바꿔 끼운다. */
export function hyperframesAvailable({ env = process.env, exec = defaultExec } = {}) {
  if (env.WF_HYPERFRAMES !== '1') return false
  return exec(process.platform === 'win32' ? 'where' : 'which', ['npx'], { cwd: ROOT }).status === 0
}

/** 외부 명령 — 셸 없이 인자 배열로. npx 는 노드 옆의 npx-cli.js 를 node 로 직접 부른다(Windows 의 npx.cmd 는 셸이 있어야 돌아 인자가 셸 문자열로 붙는다). */
function defaultExec(cmd, args, { cwd }) {
  const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')
  const [bin, argv] = cmd === 'npx' && existsSync(npxCli) ? [process.execPath, [npxCli, ...args]] : [cmd, args]
  const r = spawnSync(bin, argv, { cwd, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 })
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

export function readTemplateInfo(template, templatesDir = TEMPLATES_DIR) {
  if (!NAME.test(template)) throw new Error(`템플릿 이름은 소문자·숫자·하이픈: ${JSON.stringify(template)}`)
  const dir = join(templatesDir, template)
  if (!existsSync(join(dir, 'index.html'))) throw new Error(`템플릿이 없다: ${dir}`)
  const info = existsSync(join(dir, 'wf-template.json')) ? JSON.parse(readFileSync(join(dir, 'wf-template.json'), 'utf8')) : {}
  return { dir, info }
}

/** 작업 폴더 만들기(init 없이): 템플릿 폴더 복사 + 입력 사진 → assets/s<N>.jpg + gsap. 입력 수가 템플릿의 inputs 와 다르면 던진다. */
export function prepareWork({ template, workDir, inputs = [], templatesDir = TEMPLATES_DIR }) {
  const { dir, info } = readTemplateInfo(template, templatesDir)
  if (info.inputs != null && inputs.length !== info.inputs) throw new Error(`${template} 은 사진 ${info.inputs}장이 필요하다(받은 것 ${inputs.length}장)`)
  rmSync(workDir, { recursive: true, force: true })
  cpSync(dir, workDir, { recursive: true })
  mkdirSync(join(workDir, 'assets'), { recursive: true })
  inputs.forEach((src, i) => {
    if (!existsSync(src)) throw new Error(`입력 사진이 없다: ${src}`)
    copyFileSync(src, join(workDir, 'assets', `s${i + 1}.jpg`))
  })
  if (existsSync(GSAP)) copyFileSync(GSAP, join(workDir, 'assets', 'gsap.min.js'))
  return { workDir, info }
}

/**
 * 한 번 렌더한다. → { out, seconds, workDir }.
 * @param {{ template: string, out: string, inputs?: string[], variables?: object, rows?: string, check?: boolean, keep?: boolean, exec?: Function, workDir?: string, templatesDir?: string }} o
 */
export function renderTemplate({ template, out, inputs = [], variables = null, rows = null, check = true, keep = false, exec = defaultExec, workDir, templatesDir = TEMPLATES_DIR }) {
  const work = workDir ?? join(WORK_DIR, `${template}-${basename(out).replace(/[^a-z0-9._-]/gi, '_')}`)
  prepareWork({ template, workDir: work, inputs, templatesDir })
  if (rows) copyFileSync(rows, join(work, 'rows.json'))
  const run = (sub, extra, label) => {
    const r = exec('npx', hfArgs(sub, extra), { cwd: work })
    if (r.status !== 0) throw new Error(`도구 실패: hyperframes ${label} 종료 ${r.status} — ${(r.stderr || r.stdout).trim().split('\n').slice(-6).join(' | ')}`)
    return r
  }
  const t0 = Date.now()
  if (check) { run('lint', [], 'lint'); run('check', [], 'check') }
  mkdirSync(dirname(resolve(out)), { recursive: true })
  const r = exec('npx', renderArgs({ output: resolve(out), rows: rows ? 'rows.json' : null, variables }), { cwd: work })
  if (r.status !== 0) throw new Error(`도구 실패: hyperframes render 종료 ${r.status} — ${(r.stderr || r.stdout).trim().split('\n').slice(-6).join(' | ')}`)
  if (!rows && !existsSync(out)) throw new Error(`렌더 출력이 없다: ${out}`)
  if (!rows && statSync(out).size === 0) throw new Error(`렌더 출력이 비었다: ${out}`)
  if (!keep) rmSync(work, { recursive: true, force: true })
  return { out, seconds: +((Date.now() - t0) / 1000).toFixed(1), workDir: keep ? work : null }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
  const all = (k) => argv.flatMap((a, i) => (a === k ? [argv[i + 1]] : []))
  try {
    const template = flag('--template'), out = flag('--out')
    if (!template || !out) throw new Error('--template 과 --out 이 필요하다')
    const vars = flag('--variables')
    const r = renderTemplate({ template, out, inputs: all('--input').map((p) => resolve(p)), variables: vars ? JSON.parse(vars) : null, rows: flag('--rows') ? resolve(flag('--rows')) : null, check: !argv.includes('--no-check'), keep: argv.includes('--keep') })
    console.log(`렌더 ${r.out} (${r.seconds}초)`)
  } catch (e) {
    console.error(e.message)
    process.exitCode = 1
  }
}
