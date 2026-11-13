#!/usr/bin/env node
// After the release tag is pushed: turn the PowerShell install lines of the READMEs and AGENT_INSTALL.md into the commit-pinned form.
//   node ci/fill-install-commit.mjs vX.Y.Z [--commit <40-hex SHA>] [--root <repository folder>]
// A tag can be moved by anyone with write access; a commit address cannot. get.ps1 reads SITEBREW_COMMIT, downloads install.ps1 from that
// commit and passes -Commit, so install.ps1 refuses a clone whose HEAD is another commit (docs/RELEASING.md step 7b).
// The SHA cannot be written inside the tagged commit itself (a commit cannot contain its own hash), so this runs on main after the tag.
// Exit: 0 = written (or already pinned to this commit) · 1 = no install line for this tag found · 2 = usage, bad SHA or tag not found.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FILES = ['README.md', 'README.ko.md', 'README.zh-CN.md', 'README.es.md', 'README.ja.md', 'AGENT_INSTALL.md']
const SHA = /^[0-9a-f]{40}$/

/** The tag form `irm …/sitebrew/vX.Y.Z/get.ps1 | iex` → the commit-pinned form; the variable is removed again after the run. */
export function pinLine(owner, sha) {
  return `$env:SITEBREW_COMMIT = '${sha}'; irm https://raw.githubusercontent.com/${owner}/sitebrew/${sha}/get.ps1 | iex; Remove-Item Env:SITEBREW_COMMIT`
}

/** Rewrites one file's text. Returns { text, changed, pinned } — pinned counts lines already in the commit-pinned form for this SHA. */
export function fillText(text, tag, sha) {
  const tagLine = new RegExp(`^irm https://raw\\.githubusercontent\\.com/([A-Za-z0-9-]+)/sitebrew/${tag.replace(/\./g, '\\.')}/get\\.ps1 \\| iex$`)
  let changed = 0
  let pinned = 0
  const lines = text.split('\n').map((raw) => {
    const cr = raw.endsWith('\r') ? '\r' : ''
    const line = cr ? raw.slice(0, -1) : raw
    if (line.includes(`/sitebrew/${sha}/get.ps1`)) { pinned++; return raw }
    const m = tagLine.exec(line)
    if (!m) return raw
    changed++
    return pinLine(m[1], sha) + cr
  })
  return { text: lines.join('\n'), changed, pinned }
}

export function fill(root, tag, sha) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '')) throw Object.assign(new Error('usage: node ci/fill-install-commit.mjs vX.Y.Z [--commit <sha>]'), { code: 2 })
  if (!SHA.test(sha ?? '')) throw Object.assign(new Error(`not a full 40-character commit SHA: ${sha}`), { code: 2 })
  const report = []
  for (const rel of FILES) {
    const file = path.join(root, rel)
    const before = fs.readFileSync(file, 'utf8')
    const r = fillText(before, tag, sha)
    if (r.text !== before) fs.writeFileSync(file, r.text)
    report.push({ file: rel, changed: r.changed, pinned: r.pinned })
  }
  if (report.every((r) => r.changed + r.pinned === 0)) throw Object.assign(new Error(`no install line for ${tag} found in ${FILES.join(', ')}`), { code: 1 })
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : undefined }
  const root = path.resolve(arg('--root') ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'))
  const tag = process.argv.slice(2).find((a) => /^v\d+\.\d+\.\d+$/.test(a))
  let sha = arg('--commit')
  try {
    if (!sha && tag) {
      try { sha = execFileSync('git', ['-C', root, 'rev-parse', `${tag}^{commit}`], { encoding: 'utf8' }).trim() } catch { throw Object.assign(new Error(`tag ${tag} not found — push or fetch it first`), { code: 2 }) }
    }
    const report = fill(root, tag, sha?.toLowerCase())
    for (const r of report) console.log(`${r.file}: ${r.changed} line(s) pinned${r.pinned ? `, ${r.pinned} already pinned` : ''}`)
    console.log(`install lines pinned to ${sha}. Next: npm run readme:check, then commit on main (docs/RELEASING.md step 7b).`)
  } catch (e) { console.error(e.message); process.exit(e.code ?? 1) }
}
