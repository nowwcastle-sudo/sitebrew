// What is missing, and what would install it. A pure function: it reads the doctor results (id, status, reason), a few facts about this computer and
// the data table install-items.json. It installs nothing and starts nothing; install-run.mjs runs a step only after the skill asked the user.
// A command is an argv array from the table (the pinned tag and the repository come from compat.json): no user value, no shell.
import { readFileSync } from 'node:fs'

const TABLE = JSON.parse(readFileSync(new URL('./install-items.json', import.meta.url), 'utf8'))

const PLATFORMS = ['win32', 'darwin']

const fill = (text, vars) => text.replace(/\{(tag|repository|nodeMin|npmMin)\}/g, (_, k) => vars[k])
const fillSay = (say, vars) => ({ ko: fill(say.ko, vars), en: fill(say.en, vars) })
const fillStep = (s, vars) => ({
  argv: s.argv.map((a) => fill(a, vars)),
  ...(s.fallbackArgv ? { fallbackArgv: s.fallbackArgv.map((a) => fill(a, vars)), fallbackOnExit: s.fallbackOnExit ?? [], mayElevate: true } : {}),
  admin: Boolean(s.admin),
  ...(s.manualOnly ? { manualOnly: true } : {}),
  ...(s.cwd ? { cwd: s.cwd } : {}),
  ...(s.timeoutMs ? { timeoutMs: s.timeoutMs } : {}),
  ...(s.show ? { show: fill(s.show, vars) } : {}),
  say: fillSay(s.say, vars),
})

const find = (results, id) => results.find((r) => r.id === id)
const failing = (results, id) => {
  const r = find(results, id)
  return r && r.status === 'fail' ? r : null
}

/** Which items are needed, from the doctor results and the facts. Returns [{ id, reason? }] in install order. */
function needed(results, facts) {
  const out = []
  if (failing(results, 'node')) out.push({ id: 'node' })
  if (failing(results, 'npm')) out.push({ id: 'npm' })
  if (failing(results, 'git')) out.push({ id: 'git' })
  const browser = failing(results, 'browser')
  if (browser) out.push({ id: 'browser', reason: browser.reason ?? 'not-found' })
  const kit = failing(results, 'sitebrew')
  let cloned = false
  if (kit) {
    if (kit.reason === 'explicit-missing') out.push({ id: 'kit-clone', reason: 'explicit-missing' })
    else if (kit.reason === 'missing' && facts.kitRejected) out.push({ id: 'kit-clone', reason: 'rejected' })
    else if (kit.reason === 'missing') {
      out.push({ id: 'kit-clone' })
      cloned = true
    } else out.push({ id: 'kit-checkout', reason: kit.reason })
  }
  if (cloned || (facts.kitDir && !facts.kitInstalled)) out.push({ id: 'kit-setup' })
  return out
}

/**
 * @param {{ results: object[], platform: string, facts: { winget?: boolean, brew?: boolean, kitDir?: string|null, kitInstalled?: boolean, kitRejected?: boolean, kitGitRoot?: boolean, unsafeHere?: boolean, where?: string },
 *           compat: { repository: string, tag: string, nodeMin: string, npmMin: string, ownerUnset: boolean }, items?: object }} input
 * @returns {{ platform: string, items: { id: string, status: 'todo'|'manual'|'blocked', reason?: string, steps: object[], say: {ko:string,en:string} }[] }}
 */
export function buildPlan({ results, platform, facts = {}, compat, items = TABLE.items }) {
  const vars = { tag: compat.tag, repository: compat.repository, nodeMin: compat.nodeMin, npmMin: compat.npmMin }
  const key = PLATFORMS.includes(platform) ? platform : 'linux'
  const out = []
  // why the clone (and the setup behind it) cannot run: this build has no owner, or the folder the clone would land in is one where a clone must not go
  const cloneBlock = compat.ownerUnset || !compat.repository ? { say: items['kit-clone'].blocked } : facts.unsafeHere ? { reason: 'unsafe-folder', say: items['kit-clone'].unsafeFolder } : null
  for (const { id, reason } of needed(results, facts)) {
    const it = items[id]
    const entry = it[key] ?? it.all
    const base = { id, ...(reason ? { reason } : {}) }
    if (id === 'kit-clone' && (reason === 'rejected' || reason === 'explicit-missing')) {
      out.push({ ...base, status: 'manual', steps: [], say: fillSay(reason === 'rejected' ? it.rejectedNote : it.explicitNote, vars) })
    } else if (id === 'browser' && reason && reason !== 'not-found') {
      out.push({ ...base, status: 'manual', steps: [], say: fillSay(it.manualReasons[reason], vars) })
    } else if ((id === 'kit-clone' || id === 'kit-setup') && cloneBlock && (id === 'kit-clone' || out.some((o) => o.id === 'kit-clone'))) {
      out.push({ ...base, ...(cloneBlock.reason ? { reason: cloneBlock.reason } : {}), status: 'blocked', steps: [], say: fillSay(cloneBlock.say, vars) })
    } else if (entry.needs && !facts[entry.needs]) {
      out.push({ ...base, status: 'manual', steps: [], say: fillSay(entry.manual, vars) })
    } else if (id === 'kit-checkout' && (reason === 'dev-commit' || !facts.kitGitRoot)) {
      out.push({ ...base, status: 'manual', steps: entry.steps.map((s) => fillStep({ ...s, manualOnly: true }, vars)), say: fillSay(reason === 'dev-commit' ? it.devNote : it.notGitNote, vars) })
    } else {
      const steps = entry.steps.map((s) => fillStep(s, vars))
      out.push({ ...base, status: steps.every((s) => s.manualOnly) ? 'manual' : 'todo', steps, say: fillSay(it.say, vars) })
    }
  }
  const where = facts.where
  return { platform: key, items: where ? out.map((i) => (i.steps.some((s) => s.cwd === 'kit') ? { ...i, where } : i)) : out }
}

export const INSTALL_TABLE = TABLE
