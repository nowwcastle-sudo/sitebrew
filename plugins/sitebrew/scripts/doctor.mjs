#!/usr/bin/env node
// Sitebrew doctor - zero dependency (Node built-ins only), no network. The only shell call is a fixed `npm -v` fallback (see npmVersion).
//   node doctor.mjs [--kit <folder>] [--strict] [--allow-dev] [--data <folder>]
// Checks: Node and npm versions, git, a Chrome or Edge the kit can find, a Sitebrew clone on the pinned tag or another release of the range in compat.json (its launch-factory/ folder is optional),
// and which key names are set. A clone on a commit that is not a release tag fails, unless --allow-dev or SITEBREW_DEV=1 (then a note). --data <folder> is the plugin's data folder
// (the skill passes ${CLAUDE_PLUGIN_DATA}): the env-bridge hook leaves a names-only status file there, and the doctor says which option it could not copy into the shell.
// It prints a name's presence and length - never a value, never a path that was given as a value. A key can be seen under its own name or as
// CLAUDE_PLUGIN_OPTION_<NAME> (what Claude Code passes to hook processes for a plugin option). Paths in the output are relative to the current folder or left out.
// Every item that is not ok prints one Korean line and one English line: what turns off, and how to fix it.
// Exit 0 in preview mode (optional keys missing). Exit 1 only when a real prerequisite is missing or wrong, or in strict mode (--strict or WF_REQUIRE_KEYS=1) when a key is missing.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { KEY_NAMES, KIT, OPTION_NAMES, PLUGIN_OPTION_PREFIX, findKit, hasLaunchKit, inKitRange, packageVersion, safeEnv, shownFolder, tagsAt } from './lib/kit.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

const parseVer = (v) => {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? ''))
  return m ? m.slice(1, 4).map(Number) : null
}

/** satisfies('24.20.1', '>=24.13.0') - only the ">=x.y.z" form that compat.json uses. */
export function satisfies(version, range) {
  const have = parseVer(version)
  const want = parseVer(range)
  if (!have || !want) return false
  for (let i = 0; i < 3; i++) if (have[i] !== want[i]) return have[i] > want[i]
  return true
}

/**
 * npm's version: read the package.json next to the running node (the standard installers put it there). When npm lives somewhere else
 * (Volta, a Node without bundled npm, a portable Node) ask the npm on PATH: `npm -v` on Linux/macOS, and on Windows the fixed command
 * `cmd /d /s /c "npm -v"` because npm is a .cmd file there and Node refuses to start a .cmd directly. No user value reaches that command.
 */
export function npmVersion(execPath = process.execPath) {
  const nodeDir = dirname(execPath)
  for (const p of [join(nodeDir, 'node_modules', 'npm', 'package.json'), join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'package.json')]) {
    try {
      return readJson(p).version
    } catch {}
  }
  const win = process.platform === 'win32'
  try {
    const out = execFileSync(win ? process.env.ComSpec || 'cmd.exe' : 'npm', win ? ['/d', '/s', '/c', 'npm -v'] : ['-v'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: safeEnv(), timeout: 30_000, windowsHide: true })
    return /\d+\.\d+\.\d+/.exec(out)?.[0] ?? null
  } catch {
    return null
  }
}

export function gitVersion() {
  try {
    return execFileSync('git', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: safeEnv(), timeout: 15_000 }).trim().split(/\s+/)[2] ?? 'unknown'
  } catch {
    return null
  }
}

const ok = (id, text) => ({ status: 'ok', id, text })
const off = (status, id, ko, en) => ({ status, id, ko, en })

// Where the kit looks for Chrome or Edge (copied from factory/qa/cdp.mjs of the Sitebrew clone; a test compares the two). The quality gates of
// step 07 and the board photos need one. Anything else - a per-user Chrome install, for example - is found only when CHROME_PATH names it.
export const KIT_BROWSER_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
const extraBrowserPaths = (env) => [
  ...(env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')] : []),
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
]

function browserResult(env, exists) {
  const own = typeof env.CHROME_PATH === 'string' ? env.CHROME_PATH.trim() : ''
  if (own) {
    // the value is the user's own path: say whether it works, never print it
    return exists(own)
      ? ok('browser', 'found via CHROME_PATH')
      : off('fail', 'browser', 'CHROME_PATH 가 가리키는 파일이 없어요 — 품질 관문(07단계)과 보드 사진이 멈춰요. 경로를 chrome.exe 또는 msedge.exe 의 전체 경로로 고치거나 환경 변수를 비워요.', 'The file that CHROME_PATH points to does not exist - the quality gates (step 07) and board photos stop. Set it to the full path of chrome.exe or msedge.exe, or unset the variable.')
  }
  if (KIT_BROWSER_PATHS.some((p) => exists(p))) return ok('browser', 'Chrome or Edge found')
  const other = extraBrowserPaths(env).find((p) => exists(p))
  if (other) {
    return off('fail', 'browser', `Chrome 은 있지만 키트가 찾는 자리에 없어요 (${other}) — 품질 관문(07단계)이 "Chrome/Edge not found" 로 멈춰요. 환경 변수 CHROME_PATH 에 그 전체 경로를 넣어요 (PowerShell: setx CHROME_PATH "${other}" 한 뒤 Claude Code 를 다시 시작해요).`,
      `Chrome is installed but not where the kit looks (${other}) - the quality gates (step 07) stop with "Chrome/Edge not found". Set the environment variable CHROME_PATH to that full path (PowerShell: setx CHROME_PATH "${other}", then restart Claude Code).`)
  }
  return off('fail', 'browser', 'Chrome 또는 Edge 를 찾지 못했어요 — 품질 관문(07단계)과 보드 사진이 멈춰요. 설치해요: winget install Google.Chrome (Windows 11 에는 Edge 가 이미 있어요). 다른 곳에 있으면 환경 변수 CHROME_PATH 에 chrome.exe 또는 msedge.exe 의 전체 경로를 넣어요.',
    'Chrome or Edge was not found - the quality gates (step 07) and board photos stop. Install it: winget install Google.Chrome (Windows 11 already ships Edge). If it lives elsewhere, set the environment variable CHROME_PATH to the full path of chrome.exe or msedge.exe.')
}

// The account that hosts the repository. The export fills it in; until then it is the placeholder (not a real GitHub name), and the comparison is
// written with a split literal so that the fill-in cannot change it.
const OWNER = 'nowwcastle-sudo'
export const OWNER_UNSET = OWNER === ['__', 'OWNER__'].join('')

/**
 * The clone command, or null while the account is still the placeholder (the messages then say that the owner is not set).
 * The address comes from compat.json (`repository`), a data file: the doctor itself names no remote host.
 */
function cloneCommand(tag, repository) {
  return OWNER_UNSET || !repository ? null : `git clone --branch ${tag} --depth 1 ${repository}`
}

// One clone holds web-factory (its root) and the launch-factory kit (its launch-factory/ folder), so one release covers both. The clone is accepted when it is
// on the pinned tag, on another release tag of the range in compat.json (the same 0.x minor), or without git metadata with a package.json version in that range.
// A commit that is not a tag (a contributor's clone, main) fails unless --allow-dev or SITEBREW_DEV=1: then it is only a note.
function kitResult({ tag, range, repository, args, env, cwd, allowDev }) {
  const found = findKit({ arg: args.kit, env, cwd, pluginRoot: ROOT, range })
  if (found.missing) {
    const odd = found.rejected?.length
    const clone = cloneCommand(tag, repository)
    return off('fail', 'sitebrew', `Sitebrew 클론을 찾지 못했어요 — 사이트 만들기·수정·전달이 모두 멈춰요. ${clone ? `고정 태그로 내려받아요: ${clone} 그리고 그 폴더 안에서 npm run setup.` : '이 플러그인은 소유자 미정 판이라 내려받을 주소를 알려 줄 수 없어요 — 설치 안내의 주소를 써요.'} 다른 곳에 있으면 ${KIT.flag} <폴더> 또는 환경 변수 ${KIT.env} 로 알려요.${odd ? ` (현재 폴더의 ${KIT.name} 비슷한 폴더는 ${range} 판의 Sitebrew 가 아니라서 쓰지 않았어요.)` : ''}`,
      `Sitebrew clone not found - creating, revising and delivering sites all stop. ${clone ? `Clone the pinned tag: ${clone} then run npm run setup inside it.` : 'This plugin build has no owner set, so it cannot print a clone address - use the address in the install instructions.'} If it lives elsewhere, pass ${KIT.flag} <folder> or set the environment variable ${KIT.env}.${odd ? ` (A Sitebrew-like folder in the current directory was not used: it is not a Sitebrew ${range} release.)` : ''}`)
  }
  const dir = found.dir
  const where = shownFolder(dir, cwd)
  const tags = tagsAt(dir)
  const ver = packageVersion(dir)
  if (tags?.includes(tag)) return ok('sitebrew', `${tag} at ${where}`)
  if (ver && inKitRange(ver, range)) {
    if (tags === null) return ok('sitebrew', `v${ver} at ${where} (no git metadata; the version is in ${range})`)
    const release = tags.find((t) => inKitRange(t, range))
    if (release) return ok('sitebrew', `${release} at ${where} (another release of ${range})`)
    if (allowDev) {
      return off('note', 'sitebrew', `개발용 클론이에요 (태그가 아닌 커밋, 버전 ${ver}). --allow-dev / SITEBREW_DEV=1 이라 경고만 해요 — 릴리스 판이 아니라서 설치·찍어내기 결과가 고정 태그와 다를 수 있어요.`,
        `This is a development clone (a commit that is not a release tag, version ${ver}). It is only a warning because of --allow-dev / SITEBREW_DEV=1 - results can differ from the pinned release.`)
    }
    return off('fail', 'sitebrew', `Sitebrew 가 태그가 아닌 커밋에 있어요 (버전 ${ver}). 고정 태그는 ${tag} 이에요 — 판이 섞이면 설치와 찍어내기가 어긋나요. 릴리스로 맞춰요: git -C "${dir}" fetch --tags 그리고 git -C "${dir}" checkout ${tag}. 개발용 클론이면 --allow-dev (또는 환경 변수 SITEBREW_DEV=1) 를 붙여요.`,
      `Sitebrew is on a commit that is not a release tag (version ${ver}). The pinned tag is ${tag} - mixed versions break installs and stamping. Move to the release: git -C "${dir}" fetch --tags then git -C "${dir}" checkout ${tag}. For a development clone add --allow-dev (or set SITEBREW_DEV=1).`)
  }
  const at = tags?.length ? tags.join(', ') : ver ? `버전 ${ver}` : '알 수 없는 판'
  const atEn = tags?.length ? tags.join(', ') : ver ? `version ${ver}` : 'an unknown version'
  return off('fail', 'sitebrew',
    `Sitebrew 가 ${at} 에 있어요. 이 플러그인은 ${range} 판과 맞고 고정 태그는 ${tag} 이에요 — 판이 섞이면 설치와 찍어내기가 어긋나요. git -C "${dir}" fetch --tags 그리고 git -C "${dir}" checkout ${tag} 을 실행해요.`,
    `Sitebrew is at ${atEn}. This plugin works with ${range} and the pinned tag is ${tag} - mixed versions break installs and stamping. Run git -C "${dir}" fetch --tags then git -C "${dir}" checkout ${tag}.`)
}

// The launch-factory kit is optional: it adds sign-in, billing and mail to a product site. `dir` is the clone that was found, whatever its version
// (a clone on the wrong version still has or lacks the folder); null only when no clone was found, and then nothing could be checked.
function launchResult(dir) {
  if (!dir) {
    return off('note', 'launch-factory', '선택: 클론을 찾지 못해서 launch-factory/ 폴더는 확인하지 못했어요 — 위 sitebrew 줄대로 클론을 준비하면 다음 점검에서 확인해요.',
      'optional: not checked - no clone was found (see the sitebrew line above); the next check looks for the launch-factory/ folder once the clone is there.')
  }
  if (hasLaunchKit(dir)) return ok('launch-factory', 'launch-factory/ folder present in the clone')
  return off('note', 'launch-factory', '선택: 클론 안의 launch-factory/ 폴더를 찾지 못했어요 — 로그인·결제·메일이 필요한 제품(saas·pwa)의 백엔드 연결만 빠져요. 소개 사이트 만들기는 돼요.',
    'optional: the launch-factory/ folder was not found in the clone - only the back-end hookup for products with sign-in, billing and mail (saas, pwa) is missing; site building still works.')
}

const KEY_TEXT = {
  PEXELS_API_KEY: {
    ko: '스톡 사진·영상을 받지 않고 그 칸은 「이미지 준비 중」 틀로 남아요. 사이트는 만들어져요. 키는 pexels.com/api 에서 무료로 받아 환경 변수 PEXELS_API_KEY 로 넣어요.',
    en: 'stock photo/video slots are not fetched and stay as "image in progress" placeholders; the site is still built. Get a free key at pexels.com/api and set it as the environment variable PEXELS_API_KEY.',
  },
  LAW_API_OC: {
    ko: '한국어 법정 쪽(약관·개인정보 처리방침)을 현행 법령과 대조하지 못해 「검토 안 됨」으로 남고 공개할 수 없어요 (영어 쪽은 이 키를 쓰지 않아요). 미리보기는 만들어져요. 키는 open.law.go.kr 에서 Open API 신청 뒤 받아 환경 변수 LAW_API_OC 로 넣어요.',
    en: 'Korean-language legal pages cannot be checked against current law and stay "unverified" (not publishable); English pages do not use this key. Previews are still built. Request a key at open.law.go.kr (Open API) and set it as the environment variable LAW_API_OC.',
  },
  VERCEL_TOKEN: {
    ko: '온라인 미리보기 주소(--deploy-preview)를 만들 수 없어요. 사이트 만들기와 전달은 돼요. npm i -g vercel 한 뒤 vercel login 을 하거나, 환경 변수 VERCEL_TOKEN 을 넣어요.',
    en: 'an online preview link (--deploy-preview) cannot be made; building and delivering the site still work. Run npm i -g vercel then vercel login, or set the environment variable VERCEL_TOKEN.',
  },
  HIGGSFIELD_DIR: {
    ko: '생성 이미지 칸은 만들지 않고 higgsfield.request.json 요청으로 남겨요. 직접 만든 이미지 폴더가 있으면 환경 변수 HIGGSFIELD_DIR 로 그 폴더를 가리켜요.',
    en: 'generated-image slots are not produced; they are written to higgsfield.request.json as requests. If you have a folder of your own generated images, point the environment variable HIGGSFIELD_DIR at it.',
  },
}

function envValue(env, name) {
  for (const k of [name, PLUGIN_OPTION_PREFIX + name]) {
    const v = env[k]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return ''
}

function keyResults(env, strict) {
  const results = []
  for (const name of KEY_NAMES) {
    const v = envValue(env, name)
    results.push(v ? ok(name, `set (length ${v.length})`) : off(strict ? 'fail' : 'note', name, `${strict ? '필수(엄격 모드)' : '선택'}: ${name} 없음 — ${KEY_TEXT[name].ko}`, `${strict ? 'required (strict mode)' : 'optional'}: ${name} not set - ${KEY_TEXT[name].en}`))
  }
  const dir = envValue(env, 'HIGGSFIELD_DIR')
  if (!dir) results.push(off(strict ? 'fail' : 'note', 'HIGGSFIELD_DIR', `${strict ? '필수(엄격 모드)' : '선택'}: HIGGSFIELD_DIR 없음 — ${KEY_TEXT.HIGGSFIELD_DIR.ko}`, `${strict ? 'required (strict mode)' : 'optional'}: HIGGSFIELD_DIR not set - ${KEY_TEXT.HIGGSFIELD_DIR.en}`))
  else {
    let isDir = false
    try {
      isDir = statSync(dir).isDirectory()
    } catch {}
    results.push(isDir ? ok('HIGGSFIELD_DIR', 'set (folder exists)') : off('fail', 'HIGGSFIELD_DIR', 'HIGGSFIELD_DIR 가 가리키는 폴더가 없어요 — 키트의 doctor 도 여기서 멈춰요. 경로를 고치거나 환경 변수를 비워요.', "The folder that HIGGSFIELD_DIR points to does not exist - the kit's doctor stops here too. Fix the path or unset the variable."))
  }
  return results
}

/**
 * What the env-bridge hook could not copy into the shell, from its status file (names only, no values): <data folder>/env-bridge-status.json.
 * Claude Code hands an option to hook processes only; the bridge writes it into the session environment, and two cases do not make it:
 * a value with a single quote (the bridge skips that one option) and, in PowerShell on Windows, a value with / or \ (Claude Code does not pass it on).
 */
export function bridgeResults({ env, args }) {
  const dir = args.data ?? env.CLAUDE_PLUGIN_DATA
  let status = null
  try {
    if (dir) status = JSON.parse(readFileSync(join(dir, 'env-bridge-status.json'), 'utf8'))
  } catch {}
  if (!status) return []
  const out = []
  for (const name of status.skippedQuote ?? []) {
    if (!OPTION_NAMES.includes(name)) continue
    out.push(off('note', 'env-bridge', `플러그인 옵션 ${name} 의 값에 작은따옴표(')가 들어 있어 세션 환경으로 복사하지 않았어요 — 다른 옵션은 그대로 복사됐어요. 따옴표 없는 값으로 바꾸거나 환경 변수를 직접 설정해요 (PowerShell: setx ${name} "<값>" 한 뒤 Claude Code 를 다시 시작해요).`,
      `The value of plugin option ${name} contains a single quote ('), so it was not copied into the session environment - the other options were. Use a value without a quote, or set the environment variable yourself (PowerShell: setx ${name} "<value>", then restart Claude Code).`))
  }
  for (const name of status.powershellBlocked ?? []) {
    if (!OPTION_NAMES.includes(name)) continue
    out.push(off('note', 'env-bridge', `${name} 의 값은 경로(\\ 또는 /)라서 Claude Code 가 PowerShell 명령에는 전달하지 않아요 (Bash 명령에는 전달돼요; PowerShell 이 환경 변수를 받는 것은 Claude Code v2.1.296 이상이에요). PowerShell 에서는 setx ${name} "<폴더>" 로 직접 설정하고 Claude Code 를 다시 시작해요.`,
      `The value of ${name} is a path (contains \\ or /), so Claude Code does not pass it to PowerShell commands (Bash commands get it; PowerShell receives variables only in Claude Code v2.1.296 or later). In PowerShell set it yourself: setx ${name} "<folder>", then restart Claude Code.`))
  }
  return out
}

export function diagnose({ args = {}, env = process.env, cwd = process.cwd(), exists = existsSync } = {}) {
  const compat = readJson(join(ROOT, 'compat.json'))
  const manifest = readJson(join(ROOT, '.claude-plugin', 'plugin.json'))
  const guide = compat.guides[manifest.version]
  if (!guide) throw new Error(`compat.json has no entry for sitebrew ${manifest.version}`)
  const strict = Boolean(args.strict) || env.WF_REQUIRE_KEYS === '1'
  const tag = guide.sitebrew.tag
  const range = guide.sitebrew.range
  const allowDev = Boolean(args.allowDev) || env.SITEBREW_DEV === '1'
  const results = []

  const nodeV = process.versions.node
  results.push(satisfies(nodeV, compat.engines.node)
    ? ok('node', `${nodeV} (needs ${compat.engines.node})`)
    : off('fail', 'node', `Node ${nodeV} 는 너무 낮아요 (필요 ${compat.engines.node}). 키트의 스크립트가 시작되지 않아요. nodejs.org 에서 새 판을 설치해요 (Windows: winget install OpenJS.NodeJS.LTS, macOS·Linux: nvm install ${compat.engines.node.slice(2)}).`, `Node ${nodeV} is too old (needs ${compat.engines.node}). The kit's scripts will not start. Install a newer Node from nodejs.org (Windows: winget install OpenJS.NodeJS.LTS, macOS/Linux: nvm install ${compat.engines.node.slice(2)}).`))
  const npmV = npmVersion()
  if (!npmV) results.push(off('fail', 'npm', 'npm 을 찾지 못했어요 — 키트 설치(npm run setup)가 안 돼요. npm 은 Node 와 함께 와요. Node 를 다시 설치해요.', 'npm was not found - the kit cannot be installed (npm run setup). npm ships with Node; reinstall Node.'))
  else if (!satisfies(npmV, compat.engines.npm)) results.push(off('fail', 'npm', `npm ${npmV} 는 너무 낮아요 (필요 ${compat.engines.npm}). 키트 설치가 어긋날 수 있어요. npm i -g npm@latest 를 실행하거나 Node 를 새 판으로 올려요.`, `npm ${npmV} is too old (needs ${compat.engines.npm}). Kit installs may fail. Run npm i -g npm@latest or upgrade Node.`))
  else results.push(ok('npm', `${npmV} (needs ${compat.engines.npm})`))
  const gitV = gitVersion()
  results.push(gitV
    ? ok('git', gitV)
    : off('fail', 'git', 'git 을 찾지 못했어요 — 키트를 고정 태그로 내려받을 수 없어요. git-scm.com 에서 설치해요 (Windows: winget install Git.Git, macOS: brew install git, Linux: sudo apt install git).', 'git was not found - the kit cannot be cloned at the pinned tag. Install it from git-scm.com (Windows: winget install Git.Git, macOS: brew install git, Linux: sudo apt install git).'))

  results.push(browserResult(env, exists))
  const kit = kitResult({ tag, range, repository: compat.repository, args, env, cwd, allowDev })
  results.push(kit)
  // the folder the kit check found, also when that check failed on the version: the launch-factory line reports what is in it, not the version verdict
  results.push(launchResult(findKit({ arg: args.kit, env, cwd, pluginRoot: ROOT, range }).dir ?? null))
  results.push(...keyResults(env, strict))
  results.push(...bridgeResults({ env, args }))
  return { guide: manifest.version, tag, strict, results }
}

const PAD = { ok: 'ok   ', note: 'note ', fail: 'FAIL ' }

export function format({ guide, tag, strict, results }) {
  const lines = [`sitebrew doctor ${guide} - Sitebrew ${tag}`]
  for (const r of results) {
    if (r.status === 'ok') lines.push(`${PAD.ok}${r.id} ${r.text}`)
    else {
      lines.push(`${PAD[r.status]}${r.id} — ${r.ko}`)
      lines.push(`     ${r.id} — ${r.en}`)
    }
  }
  const stampKeys = ['PEXELS_API_KEY', 'LAW_API_OC', 'HIGGSFIELD_DIR']
  const missing = results.filter((r) => stampKeys.includes(r.id) && r.status !== 'ok')
  const fails = results.filter((r) => r.status === 'fail').length
  const notes = results.filter((r) => r.status === 'note').length
  // Two different counts used to sit next to each other ("4 optional off" below, "3 optional item(s) are off" here). The totals line counts every optional note;
  // the mode is decided by the three keys and folders the kit's stamp step reads (PEXELS_API_KEY, LAW_API_OC, HIGGSFIELD_DIR - kit doctor, D24). The mode line
  // repeats the totals number and says how many of those decide the mode, so the two numbers can be read together.
  const deciding = missing.filter((r) => r.status === 'note').map((r) => r.id)
  if (!(strict && missing.length)) {
    if (deciding.length) {
      const names = deciding.join(', ')
      lines.push(`mode: preview — 선택 항목 ${notes}개가 꺼져 있어요. 그중 키·폴더 ${deciding.length}개(${names})가 없어서 사이트는 미리보기 모드로 만들어져요 (이미지 준비 중 틀, 법정 쪽 「검토 안 됨」, 공개 불가). 써 보기에는 충분해요.`)
      lines.push(`mode: preview - ${notes} optional item(s) are off; ${deciding.length} of them (${names}) decide the mode, so sites are built in preview mode (image placeholders, legal pages "unverified", not publishable). That is enough to try things out.`)
    } else if (!missing.length) {
      lines.push('mode: full — 선택 키와 폴더가 모두 있어요.')
      lines.push('mode: full - every optional key and folder is set.')
    }
  }
  lines.push('info 키 값은 출력하지 않아요. 길이만 보여요. 값이 맞는지는 키트의 node factory/doctor.mjs --stage stamp 가 실제로 호출해 확인해요.')
  lines.push('     Key values are never printed, only the length. The kit\'s node factory/doctor.mjs --stage stamp makes a real call to check that a key works.')
  const okCount = results.filter((r) => r.status === 'ok').length
  lines.push(`doctor: ${okCount}/${results.length} ok · ${notes} optional off / 선택 ${notes}개 꺼짐 · ${fails} failed / 실패 ${fails}`)
  return lines
}

export function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--strict') args.strict = true
    else if (a === '--kit') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a folder`)
      args.kit = v
    } else if (a === '--allow-dev') args.allowDev = true
    else if (a === '--data') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a folder`)
      args.data = v
    } else throw new Error(`unknown argument: ${a}`)
  }
  return args
}

const USAGE = 'usage: node doctor.mjs [--kit <folder>] [--strict] [--allow-dev] [--data <folder>]'

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const report = diagnose({ args: parseArgs(process.argv.slice(2)) })
    for (const l of format(report)) console.log(l)
    process.exitCode = report.results.some((r) => r.status === 'fail') ? 1 : 0
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`)
    process.exitCode = 2
  }
}
