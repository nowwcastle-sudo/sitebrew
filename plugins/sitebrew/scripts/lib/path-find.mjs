// Looking for a program by name in the PATH folders. One place for the splitting and the file check, so the doctor facts, the install check and the runner agree.
// Only file names are looked at; nothing is started. Paths use forward slashes (Windows accepts them).
import { lstatSync } from 'node:fs'

/** Is there a file system entry at `p`? lstat, not stat: a Windows app execution alias (winget.exe in WindowsApps) is a reparse point that existsSync answers false for (statSync: EACCES), so the winget check and the runner would call a present winget missing. */
export const fileThere = (p) => { try { lstatSync(p); return true } catch { return false } }

const trim = (d) => d.replace(/[\\/]+$/, '')

export const pathDirs = (env, platform) => {
  const raw = (platform === 'win32' ? env.Path ?? env.PATH : env.PATH) ?? ''
  return String(raw).split(platform === 'win32' ? ';' : ':').filter(Boolean)
}

/** Is `file` (a file name with its extension) in one of the PATH folders? */
export const onPath = (file, env, platform, exists = fileThere) => pathDirs(env, platform).some((d) => exists(`${trim(d)}/${file}`))

/**
 * The absolute path of a program, or null. Windows looks for the program in the current folder before PATH when it is given a bare name, so a program that
 * could sit in a folder the user opened is started by its absolute path instead. `cmd` is the command interpreter named by ComSpec.
 */
export function findProgram(name, { env = process.env, platform = process.platform, exists = fileThere } = {}) {
  if (platform !== 'win32') return name
  if (name.toLowerCase() === 'cmd' && env.ComSpec && exists(env.ComSpec.replace(/\\/g, '/'))) return env.ComSpec
  const file = /\.[a-z]+$/i.test(name) ? name : `${name}.exe`
  const dir = pathDirs(env, platform).find((d) => exists(`${trim(d)}/${file}`))
  return dir ? `${trim(dir)}\\${file}` : null
}
