// create-sitebrew: check git (and Node), download Sitebrew at its release tag, run the doctor, point to the agent plugin.
// Every user-facing message has a Korean line and an English line. Nothing is installed without a yes (or --yes).
// Exit codes: 0 done, 1 a command failed, 2 a wrong option or folder, 3 something is missing or needs your answer (nothing is "Next" then), 4 refused to start.
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_FOLDER, DEFAULT_OWNER, MARKETPLACE, NEXT_STEP_CLAUDE, NEXT_STEP_CODEX, OWNER_PLACEHOLDER, PLUGIN, REPO, TAG } from './constants.mjs'
import { confirm, ask, endPrompt } from './prompt.mjs'
import { compareVersions, has, isOneDrivePath, isProtectedFolder, refreshPath, resolveCommand, run, saveUserEnv } from './shell.mjs'

// requirements.json is the shared table; the export step copies the rendered file here.
const REQ = JSON.parse(fs.readFileSync(new URL('./requirements.json', import.meta.url), 'utf8'))
const tool = (id) => REQ.tools.find((t) => t.id === id)
const IS_WIN = process.platform === 'win32'
const ASK_INSTALL = '설치할까요? Install it? [Y/n]'
const ASK_ONEDRIVE = '그래도 이 폴더에 계속할까요? Go on with this folder anyway? [Y/n]'
const AGENT_NAME = { claude: 'Claude Code', codex: 'Codex' }
// The package name is pinned to the release (npx create-sitebrew@0.1.0): a bare name could be taken over by somebody else.
const VERSION = TAG.replace(/^v/, '')

const say = (ko, en) => console.log(`${ko}\n${en}`)
const show = (cmd, args) => [cmd, ...args].map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ')

const USAGE = `npx create-sitebrew@${VERSION} [folder] [--yes] [--dry-run] [--tool claude|codex|both] [--ref ${TAG}] [--owner ${DEFAULT_OWNER}]
  folder     새 폴더 이름 (기본 ${DEFAULT_FOLDER}) / new folder (default ${DEFAULT_FOLDER})
  --yes      묻지 않고 설치 / install without asking (agent defaults to claude)
  --dry-run  아무것도 바꾸지 않고 할 일만 출력 / change nothing, only print the plan`

function parseArgs(argv) {
  const o = { folder: null, yes: false, dryRun: false, tool: null, ref: TAG, owner: DEFAULT_OWNER, help: false }
  const bad = (ko, en) => ({ error: { ko, en } })
  for (let i = 0; i < argv.length; i++) {
    let [k, v] = argv[i].startsWith('--') ? argv[i].split(/=(.*)/s, 2) : [argv[i]]
    if (k === '--yes' || k === '-y') o.yes = true
    else if (k === '--dry-run') o.dryRun = true
    else if (k === '--help' || k === '-h') o.help = true
    else if (k === '--tool' || k === '--ref' || k === '--owner') {
      v ??= argv[++i]
      if (v === undefined) return bad(`${k} 뒤에 값이 필요해요.`, `${k} needs a value.`)
      o[k.slice(2)] = v
    } else if (k.startsWith('-')) return bad(`모르는 옵션이에요: ${k}`, `Unknown option: ${k}`)
    else if (o.folder === null) o.folder = k
    else return bad('폴더 이름은 하나만 쓸 수 있어요.', 'Give only one folder name.')
  }
  if (o.tool && !['claude', 'codex', 'both'].includes(o.tool)) return bad('--tool 은 claude, codex, both 중 하나예요.', '--tool must be claude, codex or both.')
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(o.ref)) return bad('--ref 값이 올바르지 않아요.', 'The --ref value is not valid.')
  if (o.owner !== OWNER_PLACEHOLDER && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(o.owner)) return bad('--owner 값이 올바르지 않아요.', 'The --owner value is not valid.')
  return o
}

/** A folder typed as "...\My Site\" (in quotes, ending in a backslash) reaches a program as ...\My Site" (the backslash escapes the closing quote): drop quotes and a trailing slash, keep a drive root. */
export function cleanFolderArg(f) {
  const s = f.replaceAll('"', '').trim()
  if (/^[A-Za-z]:[\\/]*$/.test(s)) return `${s.slice(0, 2)}\\`
  return s.replace(/[\\/]+$/, '')
}

/** What to return for an installTool result that stops the run: a failed command is 1, everything that needs the user (no answer, no winget, new terminal) is 3. */
const stopCode = (res) => (res === 'failed' ? 1 : 3)

/** Ask (or, with --yes, just go) and install one tool with winget. Returns 'installed' | 'dry' | 'declined' | 'failed' | 'nowinget' | 'manual'. */
async function installTool(id, o) {
  const t = tool(id)
  say(t.why.ko, t.why.en)
  if (!IS_WIN) {
    say(`이 컴퓨터에서는 자동 설치하지 않아요. 직접 설치하세요 (macOS: brew, Linux: apt 등): ${t.download}`, `Not installing automatically here. Install it yourself (brew on macOS, apt on Linux, ...): ${t.download}`)
    return 'manual'
  }
  // no winget: nothing can be installed, so no question and no plan - only the official download page (also in --dry-run)
  if (!resolveCommand('winget')) {
    say(`winget 을 찾지 못했어요. 이 주소에서 직접 설치하세요: ${t.download}`, `winget was not found. Install it yourself from this page: ${t.download}`)
    return 'nowinget'
  }
  const wingetArgs = REQ.wingetInstall.map((a) => (a === '<id>' ? t.winget : a))
  if (o.dryRun) {
    console.log(`[dry-run] would ask: ${ASK_INSTALL}`)
    console.log(`[dry-run] would run: ${show('winget', wingetArgs)}`)
    return 'dry'
  }
  if (o.yes) say('--yes: 묻지 않고 설치해요.', '--yes: installing without asking.')
  else {
    const { yes, noInput } = await confirm(ASK_INSTALL)
    if (noInput) say("입력이 없어 '아니오'로 처리했어요.", "No input, so the answer is 'no'.")
    if (!yes) {
      say(`설치하지 않았어요. 직접 설치하세요: ${t.download}`, `Not installed. Install it yourself: ${t.download}`)
      return 'declined'
    }
  }
  let r = run('winget', wingetArgs, { inherit: true })
  if (r.status !== 0) {
    const at = wingetArgs.indexOf('--scope')
    const retry = at < 0 ? null : wingetArgs.filter((_, i) => i !== at && i !== at + 1)
    if (!retry) return 'failed'
    say('--scope user 설치가 실패했어요. --scope user 없이 한 번 더 시도해요 (관리자 확인 창이 뜰 수 있어요).', 'The --scope user install failed. Trying once more without --scope user (Windows may ask for administrator approval).')
    r = run('winget', retry, { inherit: true })
  }
  if (r.status !== 0) {
    say(`설치에 실패했어요. 직접 설치하세요: ${t.download}`, `The install failed. Install it yourself: ${t.download}`)
    return 'failed'
  }
  refreshPath()
  return 'installed'
}

const newTerminal = (what) => say(`${what} 설치는 끝났지만 이 창에서는 찾지 못했어요. 새 터미널을 열고 같은 명령을 다시 실행하세요.`, `${what} is installed, but this window cannot find it. Open a NEW terminal and run the same command again.`)

async function chooseTool(o) {
  if (o.tool) return o.tool
  const q = '어느 에이전트를 쓸까요? Which agent? 1) Claude Code  2) Codex  3) 둘 다 both [1/2/3]'
  if (o.yes) return 'claude'
  if (o.dryRun) {
    console.log(`[dry-run] would ask: ${q}`)
    return 'claude'
  }
  const a = (await ask(q))?.trim()
  const picked = { 1: 'claude', 2: 'codex', 3: 'both' }[a]
  if (!picked) say('Claude Code 로 진행해요.', 'Going with Claude Code.')
  return picked ?? 'claude'
}

/** True when the agent can be used afterwards. */
async function ensureAgent(id, o) {
  if (has(id)) return true
  const res = await installTool(id, o)
  if (res === 'installed' && !has(id)) newTerminal(AGENT_NAME[id])
  return o.dryRun || has(id)
}

/** After the clone: with a yes, keep the folder in the user variable SITEBREW_DIR; with a no, say what to pass instead. */
async function rememberKit(target, o) {
  if (process.env.SITEBREW_DIR && path.resolve(process.env.SITEBREW_DIR) === target) return
  const q = `이 Sitebrew 폴더(${target})를 사용자 환경 변수 SITEBREW_DIR 에 저장할까요? 다른 폴더에서 에이전트를 열어도 도구가 이 폴더를 찾아요. Save this folder in the user environment variable SITEBREW_DIR so the tools find it from any folder? [Y/n]`
  if (o.dryRun) {
    console.log(`[dry-run] would ask: ${q}`)
    return
  }
  let yes = o.yes
  if (!yes) {
    const a = await confirm(q)
    if (a.noInput) say("입력이 없어 '아니오'로 처리했어요.", "No input, so the answer is 'no'.")
    yes = a.yes
  }
  if (yes && saveUserEnv('SITEBREW_DIR', target)) {
    process.env.SITEBREW_DIR = target
    say('SITEBREW_DIR 를 저장했어요. 새로 여는 창부터 적용돼요.', 'SITEBREW_DIR is saved. It applies to windows you open from now on.')
  } else {
    say(`저장하지 않았어요. 다른 폴더에서 열 때는 doctor 와 intake 에 --kit "${target}" 를 붙이세요.`, `Not saved. When you open the agent in another folder, add --kit "${target}" to the doctor and intake commands.`)
  }
}

async function go(argv) {
  const o = parseArgs(argv)
  if (o.error) {
    say(o.error.ko, o.error.en)
    console.log(USAGE)
    return 2
  }
  if (o.help) {
    console.log(USAGE)
    return 0
  }
  // 0. an installer from before publication has no account to download from: stop before anything is installed or downloaded
  if (o.owner === OWNER_PLACEHOLDER) {
    say('이 설치 안내는 아직 게시 전 판이에요. 아무것도 내려받지 않고 멈춰요. 게시된 저장소의 안내를 쓰세요.', 'This installer is a version from before publication. Nothing was downloaded. Use the instructions in the published repository.')
    return 4
  }

  // 1. Node: it is already running, so only its version can be wrong. A running node cannot switch, so a fix always ends with "open a new terminal".
  const nodeMin = tool('node').min
  if (compareVersions(process.versions.node, nodeMin) < 0) {
    say(`Node.js ${process.versions.node} 은 너무 낮아요. ${nodeMin} 이상이 필요해요.`, `Node.js ${process.versions.node} is too old. ${nodeMin} or newer is needed.`)
    const res = await installTool('node', o)
    if (res === 'installed') {
      say('새 터미널을 열고 같은 명령을 다시 실행하세요. (실행 중인 Node 는 바꿀 수 없어요.)', 'Open a NEW terminal and run the same command again. (A running Node cannot be switched.)')
      return 3
    }
    if (!o.dryRun) return stopCode(res)
  }

  // 2. git
  if (!has('git')) {
    const res = await installTool('git', o)
    if (res === 'installed') {
      if (!has('git')) {
        newTerminal('git')
        return 3
      }
    } else if (!o.dryRun) return stopCode(res)
  }

  // 3. target folder
  const target = path.resolve(cleanFolderArg(o.folder ?? DEFAULT_FOLDER))
  if (isProtectedFolder(target)) {
    say(`이 폴더에는 설치하지 않아요 (Windows 나 Program Files 아래): ${target}  다른 이름을 쓰세요.`, `Not installing into this folder (under Windows or Program Files): ${target}  Use another name.`)
    return 2
  }
  if (fs.existsSync(target) && (!fs.statSync(target).isDirectory() || fs.readdirSync(target).length > 0)) {
    say(`폴더가 이미 있고 비어 있지 않아요: ${target}  다른 이름을 쓰거나 폴더를 비우세요.`, `The folder already exists and is not empty: ${target}  Use another name or empty it.`)
    return 2
  }
  if (isOneDrivePath(target)) {
    say(`이 폴더는 OneDrive 가 동기화하는 위치예요: ${target}  파일이 수천 개 생겨 느려지고, 동기화 잠금이 설치를 깨뜨릴 수 있어요. C:\\sitebrew 처럼 동기화되지 않는 곳을 권해요 (폴더 이름으로 C:\\sitebrew 를 주세요).`,
      `This folder is synced by OneDrive: ${target} - thousands of small files make it slow and a sync lock can break the install. A place that is not synced, such as C:\\sitebrew, is better (pass C:\\sitebrew as the folder).`)
    if (o.dryRun) console.log(`[dry-run] would ask: ${ASK_ONEDRIVE}`)
    else if (!o.yes) {
      const a = await confirm(ASK_ONEDRIVE) // an empty line or no input goes on; only an explicit no stops
      if (a.noInput) say('입력이 없어 계속해요.', 'No input, so going on.')
      else if (!a.yes) {
        say('여기서 멈춰요. 다른 폴더로 같은 명령을 다시 실행하세요.', 'Stopping here. Run the same command again with another folder.')
        return 3
      }
    }
  }

  // 4. clone. --quiet: no progress lines; advice.detachedHead=false: no "You are in 'detached HEAD' state" essay (a tag is detached on purpose). An error still prints.
  const cloneArgs = ['-c', 'advice.detachedHead=false', 'clone', '--quiet', '--branch', o.ref, '--depth', '1', `https://github.com/${o.owner}/${REPO}.git`, target]
  if (o.dryRun) console.log(`[dry-run] would run: ${show('git', cloneArgs)}`)
  else {
    say(`Sitebrew ${o.ref} 를 내려받아요: ${target}`, `Downloading Sitebrew ${o.ref} into: ${target}`)
    if (run('git', cloneArgs, { inherit: true }).status !== 0) {
      say('내려받기에 실패했어요. 이름, 태그, 인터넷 연결을 확인하세요.', 'The download failed. Check the owner, the tag and your internet connection.')
      return 1
    }
  }
  await rememberKit(target, o)

  // 5. doctor (its exit code is shown, never fatal)
  const doctorArgs = [path.join(target, 'plugins', 'sitebrew', 'scripts', 'doctor.mjs'), '--kit', target]
  if (o.dryRun) console.log(`[dry-run] would run: ${show('node', doctorArgs)}`)
  else if (fs.existsSync(doctorArgs[0])) run(process.execPath, doctorArgs, { inherit: true })
  else say('doctor 파일을 찾지 못해 건너뛰어요.', 'The doctor file was not found, so it is skipped.')

  // 6. agents
  const picked = await chooseTool(o)
  const agents = picked === 'both' ? ['claude', 'codex'] : [picked]
  const lacking = []
  for (const id of agents) if (!(await ensureAgent(id, o))) lacking.push(AGENT_NAME[id])

  say('안내: 4단계(사이트 문구 쓰기)에는 에이전트(Claude Code 또는 Codex)가 필요해요. 숨기지 않고 미리 알려 드려요.', 'Note: step 04 (writing the site copy) needs an agent - Claude Code or Codex. It is not hidden.')
  const pluginCmds = agents.flatMap((id) => [[id, ['plugin', 'marketplace', 'add', target]], [id, ['plugin', id === 'claude' ? 'install' : 'add', `${PLUGIN}@${MARKETPLACE}`]]])
  console.log('\n플러그인을 설치하는 명령이에요 / Plugin install commands:')
  for (const [id, args] of pluginCmds) console.log(`  ${show(id, args)}`)
  console.log()
  if (lacking.length) {
    say(`아직 끝나지 않았어요. 빠진 것: ${lacking.join(', ')}. 설치한 뒤 위 명령을 실행하고 같은 명령을 다시 실행해 확인하세요.`, `Not finished. Missing: ${lacking.join(', ')}. Install it, run the commands above, then run this command again to check.`)
    return 3
  }
  // A "Next step" that sends the user into Claude Code before the plugin exists was the old flow: the install commands are run here, after a yes (--yes is a yes),
  // and only then is the next step named. A no (or no answer) keeps the commands on screen and says to run them first.
  const planned = o.dryRun ? plannedInstalls(agents) : []
  const pluginsInstalled = await installPlugins(pluginCmds, o)
  if (pluginsInstalled === 'failed') return 1
  // a preview that still has something to install must not end with a "Next step" that cannot work yet
  if (planned.length) {
    say(`먼저 설치할 것: ${planned.join(', ')}. 위에 적힌 대로 설치한 뒤 같은 명령을 실행해요.`, `Install first: ${planned.join(', ')}. Install as described above, then run the same command.`)
    return 0
  }
  if (pluginsInstalled === 'declined') say('먼저 위 명령을 실행해 플러그인을 설치해요. 그다음에 할 일이에요:', 'Run the commands above first to install the plugin. Then:')
  for (const id of agents) {
    if (id === 'claude') say(`다음 단계: 그 폴더에서 Claude Code 를 열고 ${NEXT_STEP_CLAUDE} 를 입력하세요.`, `Next step: open Claude Code in that folder and type ${NEXT_STEP_CLAUDE}.`)
    else say(`다음 단계: 그 폴더에서 Codex 를 열고 ${NEXT_STEP_CODEX.ko}.`, `Next step: open Codex in that folder and ${NEXT_STEP_CODEX.en}.`)
  }
  return 0
}

/** What a --dry-run would have to install first (git, a new enough Node, the chosen agents that are not on this PC). */
function plannedInstalls(agents) {
  const out = []
  if (compareVersions(process.versions.node, tool('node').min) < 0) out.push('node')
  if (!has('git')) out.push('git')
  for (const id of agents) if (!has(id)) out.push(id)
  return out
}

const ASK_PLUGIN = '플러그인도 지금 설치할까요? Install the plugin now? [Y/n]'

/** Ask (or --yes, or show in --dry-run) and run the plugin commands. Returns 'done' | 'dry' | 'declined' | 'failed'. */
async function installPlugins(cmds, o) {
  if (o.dryRun) {
    console.log(`[dry-run] would ask: ${ASK_PLUGIN}`)
    for (const [id, args] of cmds) console.log(`[dry-run] would run: ${show(id, args)}`)
    return 'dry'
  }
  if (o.yes) say('--yes: 묻지 않고 플러그인을 설치해요.', '--yes: installing the plugin without asking.')
  else {
    const { yes, noInput } = await confirm(ASK_PLUGIN)
    if (noInput) say("입력이 없어 '아니오'로 처리했어요.", "No input, so the answer is 'no'.")
    if (!yes) return 'declined'
  }
  for (const [id, args] of cmds) {
    if (run(id, args, { inherit: true }).status !== 0) {
      say('플러그인 설치 명령이 실패했어요. 위에 적힌 명령을 직접 실행해 보세요.', 'A plugin install command failed. Run the commands listed above yourself.')
      return 'failed'
    }
  }
  return 'done'
}

export async function main(argv) {
  try {
    return await go(argv)
  } finally {
    endPrompt()
  }
}
