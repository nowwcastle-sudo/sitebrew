// Is an install item really there now? Looks at the computer after a step ran. Pure with respect to its arguments: the file check and git are injected.
//   'ok'            the program or folder is there and a new process finds it
//   'new-terminal'  the installer put it in its usual folder, but this process's PATH does not know it yet - a new terminal sees it
//   'missing'       not found
//   'unknown'       a human-only item: nothing to look at
// Paths use forward slashes (Windows accepts them) so the same code answers the same on every platform.
import { INSTALL_DONE_MARK } from './install-facts.mjs'
import { INSTALL_TABLE } from './install-plan.mjs'
import { fileThere, onPath } from './path-find.mjs'

const trim = (d) => d.replace(/[\\/]+$/, '')
const expand = (p, env) => p.replace(/\{([A-Z]+)\}/g, (_, k) => (env[k] ?? '').replace(/\\/g, '/'))
// the programs of the install steps themselves: this process runs on the Node it started with, so a Node that was just installed is never the one running
const RUNNING = new Set(['node', 'npm'])
/** The folder `git clone <repository>` makes: the last part of the address without .git. */
export const cloneFolderName = (repository) => String(repository ?? '').replace(/\/+$/, '').split('/').pop().replace(/\.git$/, '') || 'sitebrew'

export function verifyItem(id, { platform, env = process.env, exists = fileThere, kitDir, here = '.', tag, repository, tagsAt = () => null, table = INSTALL_TABLE.items } = {}) {
  if (id === 'kit-clone') return exists(`${trim(here)}/${cloneFolderName(repository)}/factory/doctor.mjs`) ? 'ok' : 'missing'
  if (id === 'kit-checkout') return (tagsAt(kitDir) ?? []).includes(tag) ? 'ok' : 'missing'
  if (id === 'kit-setup') return kitDir && exists(`${trim(kitDir)}/${INSTALL_DONE_MARK.join('/')}`) ? 'ok' : 'missing'
  const v = table[id]?.verify
  if (!v) return 'unknown'
  const exe = v.exe?.[platform] ?? v.exe?.default
  const there = exe && onPath(exe, env, platform, exists)
  const known = (v.known?.[platform] ?? []).map((p) => expand(p, env)).some((p) => exists(p))
  if (!there && !known) return 'missing'
  // an old Node on PATH answers "present" and says nothing about the version: only a new terminal tells
  if (RUNNING.has(id)) return 'new-terminal'
  return there ? 'ok' : 'new-terminal'
}
