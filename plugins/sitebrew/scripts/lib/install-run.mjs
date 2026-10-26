// Runs the steps of an install plan - only after the skill asked the user. Nothing here decides what to install: the steps come from install-plan.mjs
// (argv arrays from the data table). A step that needs administrator rights, is marked manual-only, or belongs to a cloud session is refused and
// nothing is started. No shell: the program is started directly (by its absolute path on Windows) with the process environment minus the Sitebrew key names and the plugin option values.
// The process, the environment and the after-install check are arguments, so a test replaces them.
import { spawnSync } from 'node:child_process'
import { safeEnv } from './kit.mjs'
import { fileThere, findProgram } from './path-find.mjs'
import { scrubPaths } from './scrub.mjs'

const TAIL_LINES = 20
const LINE_MAX = 300
const MAX_BUFFER = 256 * 1024 * 1024 // only the last lines are kept; a chatty installer must not be killed for its output
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g

const tailOf = (text, roots) => scrubPaths(String(text ?? '').replace(ANSI, ''), roots).split(/\r?\n/).map((l) => l.slice(0, LINE_MAX)).filter((l, i, a) => l !== '' || i < a.length - 1).slice(-TAIL_LINES).join('\n').replace(/\n+$/, '')

const refuse = (refused) => ({ ok: false, exit: null, needsNewTerminal: false, tail: '', attempts: 0, refused })

function attempt(argv, { spawn, env, cwd, timeout, platform, exists, roots }) {
  const program = findProgram(argv[0], { env, platform, exists })
  if (!program) return { exit: null, tail: '', notFound: true }
  const r = spawn(program, argv.slice(1), { cwd, env: safeEnv(env), encoding: 'utf8', timeout, windowsHide: true, maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', 'pipe'] })
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`
  if (r.error) return { exit: null, tail: tailOf(`${out}\n${r.error.code ?? ''} ${r.error.message}`.trim(), roots) }
  return { exit: r.status, tail: tailOf(out, roots) }
}

/**
 * Runs one step. The second attempt (`fallbackArgv`) starts only when the first one ended with an exit code that the table names in `fallbackOnExit`
 * (winget: "no installer for this scope"); any other failure stops there. The result says how many attempts ran.
 * @returns {{ ok: boolean, exit: number|null, needsNewTerminal: boolean, tail: string, attempts: number, refused?: 'manual'|'remote'|'no-kit'|'not-found' }}
 */
export function runStep(step, { spawn = spawnSync, env = process.env, cwd = process.cwd(), kitDir, remote = false, defaultTimeoutMs = 600_000, platform = process.platform, exists = fileThere, roots = {} } = {}) {
  if (remote) return refuse('remote')
  if (step.manualOnly || step.admin) return refuse('manual')
  let dir = cwd
  if (step.cwd === 'kit') {
    if (!kitDir) return refuse('no-kit')
    dir = kitDir
  }
  const timeout = step.timeoutMs ?? defaultTimeoutMs
  const ctx = { spawn, env, cwd: dir, timeout, platform, exists, roots }
  let last = attempt(step.argv, ctx)
  if (last.notFound) return refuse('not-found')
  if (last.exit === 0) return { ok: true, exit: 0, needsNewTerminal: false, tail: last.tail, attempts: 1 }
  if (step.fallbackArgv && (step.fallbackOnExit ?? []).includes(last.exit)) {
    last = attempt(step.fallbackArgv, ctx)
    if (last.notFound) return refuse('not-found')
    return { ok: last.exit === 0, exit: last.exit, needsNewTerminal: false, tail: last.tail, attempts: 2 }
  }
  return { ok: false, exit: last.exit, needsNewTerminal: false, tail: last.tail, attempts: 1 }
}

/**
 * Runs the steps of one plan item in order and stops at the first failure, then asks `verify(id)` whether the thing is really there.
 * status: done | new-terminal (installed, but a new terminal is needed - the following items must wait) | failed | refused.
 * @param {{ id: string, status: string, steps: object[] }} item
 */
export function runItem(item, ctx) {
  if (item.status !== 'todo') return { id: item.id, status: 'refused', steps: [], tail: '', blocksFollowing: false }
  const steps = []
  for (const s of item.steps) {
    const r = runStep(s, ctx)
    steps.push(r)
    if (!r.ok) return { id: item.id, status: r.refused ? 'refused' : 'failed', steps, tail: r.tail, blocksFollowing: false }
  }
  const seen = ctx.verify ? ctx.verify(item.id) : 'ok'
  const tail = steps.at(-1)?.tail ?? ''
  if (seen === 'new-terminal') return { id: item.id, status: 'new-terminal', steps, tail, blocksFollowing: true }
  if (seen === 'missing') return { id: item.id, status: 'failed', steps, tail, blocksFollowing: false }
  return { id: item.id, status: 'done', steps, tail, blocksFollowing: false }
}
