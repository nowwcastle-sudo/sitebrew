// Running other programs without ever building a command string from user input.
// Test hook (tests only): env SITEBREW_REGISTRY_PATH replaces the Machine+User PATH read from the Windows registry
// after an install, so a test never sees the real PC's tools.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const IS_WIN = process.platform === 'win32'

/** Full path of a program found on PATH, or null. On Windows the order is .exe, .com, .cmd, .bat. */
export function resolveCommand(name) {
  if (!IS_WIN || path.isAbsolute(name)) return name
  for (const dir of (process.env.PATH ?? '').split(';').filter(Boolean)) {
    for (const ext of ['.exe', '.com', '.cmd', '.bat']) {
      const file = path.join(dir, name + ext)
      if (fs.existsSync(file)) return file
    }
  }
  return null
}

// Node (since the 2024 security fix) refuses to start .cmd/.bat files directly, so they go through cmd.exe.
// Inside double quotes cmd only needs " and % kept out; & | < > ^ are refused too to stay on the safe side.
const CMD_UNSAFE = /["%&|<>^\r\n]/

/** spawnSync with an argument array. Returns { status, stdout, stderr } (status null when the program could not start). */
export function run(command, args, { inherit = false } = {}) {
  const file = resolveCommand(command)
  if (!file) return { status: null, stdout: '', stderr: '', missing: true }
  const stdio = inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
  if (IS_WIN && /\.(cmd|bat)$/i.test(file)) {
    const bad = args.find((a) => CMD_UNSAFE.test(a))
    if (bad !== undefined) throw new Error(`argument has a character that cmd.exe cannot take safely: ${bad}`)
    const line = [file, ...args].map((a) => `"${a}"`).join(' ')
    const comspec = process.env.ComSpec ?? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe')
    const r = spawnSync(comspec, ['/d', '/s', '/c', `"${line}"`], { stdio, encoding: 'utf8', windowsVerbatimArguments: true })
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
  }
  const r = spawnSync(file, args, { stdio, encoding: 'utf8' })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

export const has = (command, args = ['--version']) => run(command, args).status === 0

/** Compare dotted versions like 24.13.0 (a leading v is allowed). Negative when a < b. */
export function compareVersions(a, b) {
  const parts = (v) => String(v).replace(/^v/, '').split('.').map((x) => Number.parseInt(x, 10) || 0)
  const [pa, pb] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

const under = (p, root) => {
  const a = path.resolve(p).toLowerCase()
  const b = path.resolve(root).toLowerCase()
  return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep)
}

/** Windows itself and Program Files are not a place for a project folder. */
export function isProtectedFolder(p, env = process.env) {
  if (!IS_WIN) return false
  return [env.windir ?? env.SystemRoot, env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432].filter(Boolean).some((root) => under(p, root))
}

/** A folder that OneDrive syncs: thousands of small files (node_modules) make it slow, and a sync lock can break the build. */
export function isOneDrivePath(p, env = process.env) {
  if (!IS_WIN) return false
  return /\\OneDrive/i.test(path.resolve(p)) || [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].filter(Boolean).some((root) => under(p, root))
}

/**
 * Keep one user environment variable for later windows. On Windows this is `setx NAME value` (it writes the user's registry, not the machine's).
 * Test hook (tests only): env SITEBREW_TEST_USERENV names a file that receives NAME=value lines instead. Returns whether it was saved.
 */
export function saveUserEnv(name, value) {
  if (process.env.SITEBREW_TEST_USERENV) {
    fs.appendFileSync(process.env.SITEBREW_TEST_USERENV, `${name}=${value}\n`)
    return true
  }
  if (!IS_WIN) return false
  return run('setx', [name, value]).status === 0
}

function registryPath() {
  if (process.env.SITEBREW_REGISTRY_PATH !== undefined) return process.env.SITEBREW_REGISTRY_PATH
  const ps = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const read = (scope) => spawnSync(ps, ['-NoProfile', '-Command', `[Environment]::GetEnvironmentVariable('Path','${scope}')`], { encoding: 'utf8' }).stdout?.trim() ?? ''
  return [read('Machine'), read('User')].filter(Boolean).join(';')
}

/** After an install: put the registry PATH (Machine, User) in front of this process's PATH so new programs are found. */
export function refreshPath() {
  if (!IS_WIN) return
  const fresh = registryPath().split(';').filter(Boolean)
  const seen = new Set(fresh.map((p) => p.toLowerCase()))
  const old = (process.env.PATH ?? '').split(';').filter((p) => p && !seen.has(p.toLowerCase()))
  process.env.PATH = [...fresh, ...old].join(';')
}
