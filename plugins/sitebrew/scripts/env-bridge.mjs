#!/usr/bin/env node
// SessionStart hook - zero dependency (Node built-ins only).
// Claude Code hands the values a user typed into the plugin settings dialog (userConfig) to hook processes as CLAUDE_PLUGIN_OPTION_<NAME>.
// It does not hand them to the shell commands Claude runs later (node doctor.mjs, npm run stamp, ...), and the kit reads plain environment
// variables. This hook closes the gap: it appends `export NAME='value'` lines to the file named by CLAUDE_ENV_FILE, which Claude Code runs
// before every Bash command of the session (and, in Claude Code v2.1.296 or later, copies into PowerShell commands when every line is a plain
// assignment - Claude Code hooks reference, "Persisted variables in PowerShell commands").
// Rules: only the four names the plugin declares; a variable the user already set (non-empty) wins; an empty variable does not;
// empty, multi-line and single-quote-containing values are skipped one by one (a quote would need the form 'a'\''b', which is not a plain assignment,
// and PowerShell would then receive none of the variables); values are trimmed and single-quoted; a line that is already in the file is not written
// again (a resumed or compacted session runs this hook again); a missing final newline of the existing file is added first; nothing is printed
// (a hook's output goes into the conversation); any problem ends quietly with exit 0 so a session never fails.
// It also leaves a names-only status file (CLAUDE_PLUGIN_DATA/env-bridge-status.json) so the doctor can say what was not copied - never a value.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { OPTION_NAMES, PLUGIN_OPTION_PREFIX } from './lib/kit.mjs'

export const NAMES = OPTION_NAMES

/** One shell-safe export line, or null when the value cannot be written as a plain assignment (empty, a line break, a single quote). */
export function exportLine(name, value) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (v === '' || /[\r\n\0']/.test(v)) return null
  return `export ${name}='${v}'\n`
}

/** Per name: the line to write, or why nothing is written. `existing` is the text already in the file. */
export function plan(env = process.env, existing = '') {
  const lines = []
  const skippedQuote = []
  const powershellBlocked = []
  for (const name of NAMES) {
    if (typeof env[name] === 'string' && env[name].trim() !== '') continue // the user's own variable wins; an empty one does not
    const raw = env[PLUGIN_OPTION_PREFIX + name]
    if (typeof raw === 'string' && raw.includes("'") && !/[\r\n\0]/.test(raw)) skippedQuote.push(name)
    const line = exportLine(name, raw)
    if (!line) continue
    if (/[\\/]/.test(raw.trim())) powershellBlocked.push(name)
    if (!existing.split('\n').includes(line.trimEnd())) lines.push(line)
  }
  return { lines, skippedQuote, powershellBlocked }
}

/** The lines to append for this environment (kept for callers that do not read the existing file). */
export function linesFor(env = process.env, existing = '') {
  return plan(env, existing).lines
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const file = process.env.CLAUDE_ENV_FILE
    const existing = file && existsSync(file) ? readFileSync(file, 'utf8') : ''
    const p = plan(process.env, existing)
    if (file && p.lines.length) {
      const lead = existing !== '' && !existing.endsWith('\n') ? '\n' : ''
      appendFileSync(file, lead + p.lines.join(''), { mode: 0o600 })
    }
    const data = process.env.CLAUDE_PLUGIN_DATA
    if (data) {
      mkdirSync(data, { recursive: true })
      writeFileSync(join(data, 'env-bridge-status.json'), JSON.stringify({ skippedQuote: p.skippedQuote, powershellBlocked: process.platform === 'win32' ? p.powershellBlocked : [] }) + '\n')
    }
  } catch {
    // never fail a session start because of this hook
  }
}
