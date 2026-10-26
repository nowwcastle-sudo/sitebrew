// Finding the Sitebrew clone and reading its tag. Node built-ins only; paths go through node:path and no shell is used, so this behaves the same on Windows, Linux and macOS.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve, isAbsolute, sep } from 'node:path'

export const KEY_NAMES = ['PEXELS_API_KEY', 'LAW_API_OC', 'VERCEL_TOKEN']
/** Every plugin option (userConfig key) the env-bridge hook copies into the shell, and the doctor reads. */
export const OPTION_NAMES = [...KEY_NAMES, 'HIGGSFIELD_DIR']
export const PLUGIN_OPTION_PREFIX = 'CLAUDE_PLUGIN_OPTION_'

// The repository is one clone: web-factory is its root and the launch-factory kit is its launch-factory/ folder.
// marker = a file that only the Sitebrew clone has; flag/env = how the user can point at a clone that is not in the usual place.
// packageNames = the `name` of the root package.json (the folder is only taken from the current directory when it says so).
export const KIT = { name: 'sitebrew', packageNames: ['web-factory', 'sitebrew'], marker: ['factory', 'doctor.mjs'], flag: '--kit', env: 'SITEBREW_DIR', launchMarker: ['launch-factory', 'template', 'package.json'] }

/**
 * The environment a child process may see: the process environment without the Sitebrew key names and the plugin option values (names compared without
 * regard to case: Windows environment names have no case). Other variables, such as a token of another service, stay: an install step needs PATH, the
 * proxy settings and the like, and a list of what to allow would break installs.
 */
export function safeEnv(env = process.env) {
  const out = {}
  const keys = KEY_NAMES.map((n) => n.toUpperCase())
  for (const [k, v] of Object.entries(env)) {
    if (keys.includes(k.toUpperCase()) || k.toUpperCase().startsWith(PLUGIN_OPTION_PREFIX)) continue
    out[k] = v
  }
  return out
}

const isKit = (dir) => existsSync(join(dir, ...KIT.marker))
export const hasLaunchKit = (dir) => existsSync(join(dir, ...KIT.launchMarker))

const parseVer = (v) => {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? ''))
  return m ? m.slice(1, 4).map(Number) : null
}
const cmp = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

/** inKitRange('0.1.3', '>=0.1.0 <0.2.0') - only the ">=x.y.z <x.y.z" form that compat.json uses (the upper bound is optional). */
export function inKitRange(version, range) {
  const have = parseVer(version)
  if (!have || typeof range !== 'string') return false
  const low = /(?:^|\s)>=\s*v?(\d+\.\d+\.\d+)/.exec(range)?.[1]
  const high = /(?:^|\s)<\s*v?(\d+\.\d+\.\d+)/.exec(range)?.[1]
  if (!low) return false
  if (cmp(have, parseVer(low)) < 0) return false
  if (high && cmp(have, parseVer(high)) >= 0) return false
  return true
}

/** Tags that point at the checked-out commit, or null when the folder is not a usable git clone. */
export function tagsAt(dir) {
  try {
    const out = execFileSync('git', ['-C', dir, 'tag', '--points-at', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: safeEnv(), timeout: 15_000 })
    return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  } catch {
    return null
  }
}

export function packageJson(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
}

export function packageVersion(dir) {
  return packageJson(dir)?.version ?? null
}

/** A folder found only because the current directory looks like one: it must say it is Sitebrew (package.json name) and be on a release this plugin supports. */
export function looksLikeRelease(dir, range) {
  const pkg = packageJson(dir)
  if (!pkg || !KIT.packageNames.includes(pkg.name)) return false
  if (inKitRange(pkg.version, range)) return true
  return (tagsAt(dir) ?? []).some((t) => inKitRange(t, range))
}

/**
 * Where is the clone? Order: the flag value, the environment variable, the repository this plugin sits in (plugins/sitebrew/ -> two folders up;
 * only when pluginRoot is given), then - only when `range` is given and the folder is a Sitebrew release of that range - ./sitebrew and the
 * current folder. Everything the user did not point at comes last on purpose: a folder you merely opened (a cloned project from the internet)
 * must not win over the clone you installed, because the intake script imports code from the folder it finds.
 * Without `range` the current-folder candidates are not looked at at all.
 * @returns {{ dir: string } | { missing: true, explicit: boolean, rejected?: string[] }}
 */
export function findKit({ arg, env = process.env, cwd = process.cwd(), pluginRoot, range } = {}) {
  if (arg) return isKit(resolve(cwd, arg)) ? { dir: resolve(cwd, arg) } : { missing: true, explicit: true }
  const fromEnv = env[KIT.env]?.trim()
  if (fromEnv) return isKit(resolve(cwd, fromEnv)) ? { dir: resolve(cwd, fromEnv) } : { missing: true, explicit: true }
  const inRepo = pluginRoot ? resolve(pluginRoot, '..', '..') : null
  if (inRepo && isKit(inRepo)) return { dir: inRepo }
  const rejected = []
  if (range) {
    for (const dir of [join(cwd, KIT.name), cwd]) {
      if (!isKit(dir)) continue
      if (looksLikeRelease(dir, range)) return { dir }
      rejected.push(dir)
    }
  }
  return { missing: true, explicit: false, ...(rejected.length ? { rejected } : {}) }
}

/** A folder for a message: relative to the current folder when it is below it (no user name in it), otherwise a generic phrase. */
export function shownFolder(dir, cwd = process.cwd()) {
  const rel = relative(cwd, dir)
  if (rel === '') return '.'
  if (!rel.startsWith('..') && !isAbsolute(rel)) return `.${sep}${rel}`
  return 'the folder you pointed at (--kit or SITEBREW_DIR) / 지정한 폴더'
}

/** The kit versions this plugin version works with (compat.json -> guides.<plugin version>.sitebrew.range), or null when the file cannot be read. */
export function kitRange(pluginRoot) {
  try {
    const compat = JSON.parse(readFileSync(join(pluginRoot, 'compat.json'), 'utf8'))
    const manifest = JSON.parse(readFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'))
    return compat.guides?.[manifest.version]?.sitebrew?.range ?? null
  } catch {
    return null
  }
}
