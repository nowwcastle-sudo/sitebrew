#!/usr/bin/env node
// Sitebrew setup - installs what is missing, one item at a time, only after the skill asked the user. Zero dependency (Node built-ins only), no network of its own.
//   node setup.mjs detect [--as agent|chatbot]
//   node setup.mjs plan   [--kit <folder>] [--allow-dev] [--as agent|chatbot]
//   node setup.mjs run <item> --yes [--kit <folder>] [--allow-dev] [--as agent|chatbot]
// detect: where this runs (agent = a tool that runs commands on the user's computer, chatbot = anything else, the default when unsure).
// plan: what is missing and the exact steps that would install it (nothing is installed). Chatbot mode prints no plan: the person follows references/install-steps.md.
// run: runs the steps of one item of the plan. --yes is the skill's statement that the user said yes to THIS item; without it nothing runs.
// Exit codes: 0 done (or nothing to do) · 1 a step failed, or an internal error · 2 wrong arguments · 3 refused (chatbot mode, cloud session, a manual or blocked item) · 4 installed, but a new terminal is needed.
// It prints JSON. It prints no key value and no path of this computer: folders in the output of a step are replaced by <kit>, <here> and <home>.
// --yes is the skill's statement that the user said yes to this item; the program cannot check it, only that nothing runs without it.
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { OWNER_UNSET, diagnose } from './doctor.mjs'
import { applyOverride, detectMode } from './lib/env-mode.mjs'
import { gatherFacts, readCompat } from './lib/install-facts.mjs'
import { INSTALL_TABLE, buildPlan } from './lib/install-plan.mjs'
import { runItem } from './lib/install-run.mjs'
import { verifyItem } from './lib/install-verify.mjs'
import { fileThere } from './lib/path-find.mjs'
import { tagsAt } from './lib/kit.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REFERENCE = 'skills/setup/references/install-steps.md'
const COMMANDS = ['detect', 'plan', 'run']
const USAGE = 'usage: node setup.mjs detect | plan | run <item> --yes   [--kit <folder>] [--allow-dev] [--as agent|chatbot]'

export function parseArgs(argv) {
  const [command, ...rest] = argv
  if (!COMMANDS.includes(command)) throw new Error(`unknown command: ${command ?? '(none)'}`)
  const args = { command }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    const value = () => {
      const v = rest[++i]
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`)
      return v
    }
    if (a === '--yes') args.yes = true
    else if (a === '--allow-dev') args.allowDev = true
    else if (a === '--kit') args.kit = value()
    else if (a === '--as') {
      args.as = value()
      if (!['agent', 'chatbot'].includes(args.as)) throw new Error('--as is agent or chatbot')
    } else if (a.startsWith('--')) throw new Error(`unknown argument: ${a}`)
    else if (command === 'run' && !args.item) args.item = a
    else throw new Error(`unexpected argument: ${a}`)
  }
  if (command === 'run' && !args.item) throw new Error('run needs an item (see plan)')
  return args
}

/** What the commands do, with the world as arguments. Returns { out, code }. */
export function main(args, { env = process.env, cwd = process.cwd(), platform = process.platform, exists = fileThere, spawn, doctor = diagnose } = {}) {
  if (args.command === 'run' && !args.yes) throw new Error('run needs --yes: the user must say yes to this item first')
  if (args.command === 'run' && !(args.item in INSTALL_TABLE.items)) throw new Error(`unknown item: ${args.item} (the items are ${Object.keys(INSTALL_TABLE.items).join(', ')})`)
  const mode = applyOverride(detectMode({ env, exists }), args.as)
  if (args.command === 'detect') return { out: { ...mode }, code: 0 }
  if (mode.mode === 'chatbot') {
    if (args.command === 'plan') return { out: { mode, plan: null, reference: REFERENCE }, code: 0 }
    return { out: { mode, status: 'refused', why: 'chatbot', reference: REFERENCE }, code: 3 }
  }
  const compat = readCompat(ROOT, OWNER_UNSET)
  const dargs = { kit: args.kit, allowDev: args.allowDev }
  const { results } = doctor({ args: dargs, env, cwd, exists, platform })
  const facts = gatherFacts({ args: dargs, env, cwd, platform, exists, root: ROOT, range: compat.range })
  const plan = buildPlan({ results, platform, facts, compat })
  if (args.command === 'plan') return { out: { mode, plan, ...(mode.remote ? { note: 'remote' } : {}) }, code: 0 }

  const item = plan.items.find((i) => i.id === args.item)
  if (!item) return { out: { mode, id: args.item, status: 'nothing-to-do' }, code: 0 }
  const kitDir = facts.kitDir
  const ran = runItem(item, {
    spawn, env, cwd, kitDir, remote: mode.remote, platform, exists,
    roots: { '<kit>': kitDir, '<here>': cwd, '<home>': homedir(), '<local-app-data>': env.LOCALAPPDATA, '<app-data>': env.APPDATA, '<temp>': env.TEMP ?? env.TMPDIR },
    verify: (id) => verifyItem(id, { platform, env, exists, kitDir, here: cwd, tag: compat.tag, repository: compat.repository, tagsAt }),
  })
  const why = ran.steps.find((s) => s.refused)?.refused ?? (item.status !== 'todo' ? item.status : undefined)
  const out = { mode, id: ran.id, status: ran.status, ...(why ? { why } : {}), blocksFollowing: ran.blocksFollowing, tail: ran.tail }
  const code = { done: 0, failed: 1, refused: 3, 'new-terminal': 4 }[ran.status]
  return { out, code }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
    const { out, code } = main(args)
    console.log(JSON.stringify(out, null, 2))
    process.exitCode = code
  } catch (e) {
    // a wrong command line is a usage error; anything else is an internal error whose message may hold a path, so only its kind is printed
    const usage = !args || /^(run needs|unknown item)/.test(e.message)
    console.error(usage ? `${e.message}\n${USAGE}` : `setup failed inside (${e.code ?? e.name}); run the doctor skill to see what is missing`)
    process.exitCode = usage ? 2 : 1
  }
}
