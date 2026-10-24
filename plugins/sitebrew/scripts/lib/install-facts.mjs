// Facts about this computer that the install plan needs and the doctor results do not carry: is winget or brew there, where is the clone, are its packages installed.
// Only file names are looked at (no program is started). Everything environmental is an argument, so a test replaces it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findKit, shownFolder } from './kit.mjs'
import { fileThere, onPath } from './path-find.mjs'

/** npm writes this file when an install has finished; a folder cut off half way has node_modules but not this file. */
export const INSTALL_DONE_MARK = ['node_modules', '.package-lock.json']

/** The compat data of this plugin version, in the shape buildPlan wants. `ownerUnset` is passed in (the doctor owns that constant). */
export function readCompat(root, ownerUnset) {
  const compat = JSON.parse(readFileSync(join(root, 'compat.json'), 'utf8'))
  const manifest = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'))
  const guide = compat.guides[manifest.version]
  if (!guide) throw new Error(`compat.json has no entry for sitebrew ${manifest.version}`)
  return { repository: compat.repository, tag: guide.sitebrew.tag, range: guide.sitebrew.range, nodeMin: String(compat.engines.node).replace(/^>=\s*/, ''), ownerUnset }
}

export function gatherFacts({ args = {}, env = process.env, cwd = process.cwd(), platform = process.platform, exists = fileThere, root, range } = {}) {
  const winget = platform === 'win32' && (onPath('winget.exe', env, platform, exists) || (env.LOCALAPPDATA ? exists(`${env.LOCALAPPDATA}/Microsoft/WindowsApps/winget.exe`) : false))
  const brew = platform === 'darwin' && (onPath('brew', env, platform, exists) || exists('/opt/homebrew/bin/brew') || exists('/usr/local/bin/brew'))
  const found = findKit({ arg: args.kit, env, cwd, pluginRoot: root, range })
  const kitDir = found.dir ?? null
  return {
    winget, brew, kitDir,
    kitInstalled: Boolean(kitDir && exists(join(kitDir, ...INSTALL_DONE_MARK))),
    kitGitRoot: Boolean(kitDir && exists(join(kitDir, '.git'))),
    kitRejected: Boolean(found.rejected?.length),
    ...(kitDir ? { where: shownFolder(kitDir, cwd) } : {}),
  }
}
