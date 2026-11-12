// 외부 명령을 셸·작업 폴더를 거치지 않고 신뢰된 절대 경로로 부른다(보안 수정 B — daybreak project-local-vercel-command-shadowing ·
// shell-path-command-injection).
//   · Windows 셸(cmd.exe)은 이름만 준 명령을 PATH 보다 먼저 **작업 폴더**에서 찾는다 — 사이트 폴더에 놓인 vercel.cmd 가 진짜 CLI 를 가로챈다.
//   · POSIX 셸은 큰따옴표 안의 $( ) 와 백틱을 푼다 — 경로를 명령 문자열에 끼우면 폴더 이름이 명령이 된다.
// 그래서 npm·npx 는 지금 도는 node 옆의 npm 설치본(npm-cli.js·npx-cli.js)을 node 로 직접 부르고, 그 밖의 CLI 는 PATH 에서 **절대 경로이고
// 작업 폴더 밖인** 항목만 찾는다. Windows 의 .cmd 껍데기는 셸 없이 못 도니, 같은 폴더의 node_modules/<패키지>/package.json bin 을 node 로 부른다.
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, posix, relative, resolve, win32 } from 'node:path'

const WIN = process.platform === 'win32'

/** 지금 node 와 같이 설치된 npm 의 `<name>-cli.js`(npm·npx). 못 찾으면 null. Windows 는 node 옆, POSIX 는 ../lib/node_modules. */
export function npmCliPath(name, { execPath = process.execPath, exists = existsSync } = {}) {
  const dir = dirname(execPath)
  for (const p of [join(dir, 'node_modules', 'npm', 'bin', `${name}-cli.js`), join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', `${name}-cli.js`)]) if (exists(p)) return p
  return null
}

/** npm·npx 를 셸 없이 부르는 [실행 파일, 인자]. npm 설치본을 못 찾으면 POSIX 는 PATH 의 이름 그대로, Windows 는 null(부를 수 없다). */
export function npmCommand(name, args, opts = {}) {
  const cli = npmCliPath(name, opts)
  if (cli) return [opts.execPath ?? process.execPath, [cli, ...args]]
  return (opts.platform ?? process.platform) === 'win32' ? null : [name, args]
}

const inside = (child, parent) => {
  const r = relative(parent, child)
  return r === '' || (!r.startsWith('..') && !isAbsolute(r))
}
const real = (p) => { try { return realpathSync(p) } catch { return resolve(p) } }
const isFile = (p) => { try { return statSync(p).isFile() } catch { return false } }

/**
 * PATH 에서 `name` 의 신뢰된 절대 경로. 상대 PATH 항목(`.`·빈 칸)과 작업 폴더(cwd) 안의 항목은 건너뛴다. 없으면 null.
 * Windows 는 PATHEXT 순서로 붙여 본다(.COM;.EXE;.BAT;.CMD 기본).
 */
export function resolveTrustedBin(name, { env = process.env, cwd = process.cwd(), platform = process.platform, fileExists = isFile } = {}) {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(`명령 이름은 글자·숫자·. _ - 만 쓴다: ${JSON.stringify(name)}`)
  const win = platform === 'win32'
  const P = win ? win32 : posix // 경로 규칙은 실행 OS 가 아니라 platform 인자를 따른다
  const sep = win ? ';' : ':'
  const pathVar = env.PATH ?? env.Path ?? env.path ?? ''
  const exts = win ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : ['']
  const realOf = platform === process.platform ? real : (x) => P.resolve(x) // 다른 OS 규칙으로 부를 때(시험)는 파일 시스템을 묻지 않는다
  const here = realOf(cwd)
  const within = (child, parent) => { const r = P.relative(parent, child); return r === '' || (!r.startsWith('..') && !P.isAbsolute(r)) }
  for (const raw of pathVar.split(sep)) {
    const dir = raw.trim().replace(/^"(.*)"$/, '$1')
    if (!dir || !P.isAbsolute(dir)) continue
    if (within(realOf(dir), here) || within(P.resolve(dir), P.resolve(cwd))) continue
    for (const ext of exts) {
      const p = P.join(dir, name + ext)
      if (fileExists(p)) return p
    }
  }
  return null
}

/**
 * Windows .cmd·.bat 껍데기(npm 이 전역 설치로 만든 것) → 같은 폴더 node_modules/<패키지> 의 bin js. 못 찾으면 null.
 * 껍데기의 내용은 읽지 않는다(그 글을 믿지 않는다) — 패키지 이름이 명령 이름과 같다고 보고 package.json 의 bin 만 읽는다.
 */
export function shimEntry(shimPath, pkg) {
  const pj = join(dirname(shimPath), 'node_modules', pkg, 'package.json')
  if (!isFile(pj)) return null
  let bin
  try { bin = JSON.parse(readFileSync(pj, 'utf8')).bin } catch { return null }
  const rel = typeof bin === 'string' ? bin : bin?.[pkg]
  if (typeof rel !== 'string') return null
  const js = resolve(dirname(pj), rel)
  return inside(js, dirname(pj)) && isFile(js) ? js : null
}

/**
 * 셸 없이 부를 [실행 파일, 인자]. PATH 의 신뢰된 위치에서 찾고, Windows .cmd·.bat 은 패키지 bin 을 node 로 부른다. 못 찾으면 null.
 */
export function trustedCommand(name, args, { env = process.env, cwd = process.cwd(), platform = process.platform, execPath = process.execPath } = {}) {
  const bin = resolveTrustedBin(name, { env, cwd, platform })
  if (!bin) return null
  if (/\.(cmd|bat)$/i.test(bin)) {
    const js = shimEntry(bin, name)
    return js ? [execPath, [js, ...args]] : null
  }
  return [bin, args]
}

export const IS_WIN = WIN
