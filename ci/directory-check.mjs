#!/usr/bin/env node
// Checks a commit of a repository against the automated rules of Anthropic's plugin directory (the developer portal's Validate step), before anyone
// submits it. It reads the commit the way the portal does (git ls-tree / git archive), not the working folder, so node_modules and other untracked files
// do not count. Source: https://claude.com/docs/plugins/pre-submission-checklist (2026-10-15) and the top-level bin/ rule in
// https://claude.com/docs/plugins/org-sync. The portal applies more rules than these (and a security scan); passing here is necessary, not sufficient.
//   node directory-check.mjs --repo <folder> [--ref HEAD] [--plugin plugins/sitebrew] [--json]
// Exit: 0 = no finding that blocks or stops validation, 1 = at least one, 2 = usage or git error. Holds and warnings are printed and do not fail.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const KiB = 1024
const MiB = 1024 * KiB
export const LIMITS = { archiveBytes: 50 * MiB, unpackedBytes: 256 * MiB, entries: 10_000, repoFileBytes: 5 * MiB, pluginFileBytes: 256 * KiB, pluginFiles: 512, readmeWords: 40 }
const IMAGE_FONT = /\.(png|jpe?g|gif|webp|svg|woff2?|ttf|otf|eot)$/i
const DEVICE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i
const SYSTEM_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])
const RESERVED_WHOLE = new Set(['claude', 'anthropic', 'official', 'plugin', 'mcp', 'test'])
// launcher, then any flags (a flag takes a value only as --flag=value), then the package; `${...}` after the @ is a version filled in at run time
const LAUNCHER = /\b(npx|bunx|pnpm dlx|yarn dlx|uvx|pipx run)\s+(?:-{1,2}[\w-]+(?:=\S+)?\s+)*([@\w./-]+(?:\$\{\w+\})?)/g

/** Reads the tree of `ref`: [{ mode, type, size, path }] (blobs only). */
export function readTree(repo, ref = 'HEAD') {
  const out = execFileSync('git', ['-C', repo, 'ls-tree', '-r', '-l', '-z', ref], { encoding: 'utf8', maxBuffer: 1 << 28 })
  return out.split('\0').filter(Boolean).map((line) => {
    const tab = line.indexOf('\t')
    const [mode, type, , size] = line.slice(0, tab).split(/\s+/)
    return { mode, type, size: size === '-' ? 0 : Number(size), path: line.slice(tab + 1) }
  })
}

const show = (git, repo, ref, p) => execFileSync('git', ['-C', repo, 'show', `${ref}:${p}`], { encoding: 'utf8', maxBuffer: 1 << 26 })
/** Reads many blobs of `ref` with one `git cat-file --batch` (one `git show` per file took minutes on a whole repository). Returns Map path -> text. */
export function readBlobs(repo, ref, paths) {
  const out = new Map()
  if (!paths.length) return out
  const buf = execFileSync('git', ['-C', repo, 'cat-file', '--batch'], { input: paths.map((p) => `${ref}:${p}`).join('\n') + '\n', maxBuffer: 1 << 30 })
  let at = 0
  for (const p of paths) {
    const nl = buf.indexOf(10, at)
    const head = buf.subarray(at, nl).toString('utf8')
    at = nl + 1
    const m = /^\S+ \S+ (\d+)$/.exec(head)
    if (!m) continue // "<ref>:<path> missing"
    const n = Number(m[1])
    out.set(p, buf.subarray(at, at + n).toString('utf8'))
    at += n + 1
  }
  return out
}
/** The attribute lines of a .gitattributes text: [{ line, pattern, attrs }], comments and macro definitions ([attr]) left out. */
export function attributeLines(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('[attr]'))
    .map((line) => { const [pattern, ...attrs] = line.split(/\s+/); return { line, pattern, attrs } })
}

// Attributes that make the checked-out file differ from the committed bytes: a filter (Git LFS included), $Id$ expansion, a re-encoding, and line-ending
// conversion (text, eol, crlf). The directory counts these in any stated form, unset included: v0.1.1 had only `*.png binary` (= -diff -merge -text)
// reaching the plugin icon and the portal still refused it (2026-10-15). Only `!name` (back to unspecified) and attributes outside the list are allowed.
const REWRITING = ['filter', 'ident', 'working-tree-encoding', 'eol', 'text', 'crlf']
export function rewritesContent(attr) {
  if (attr.startsWith('!')) return false
  if (attr === 'binary') return true
  return REWRITING.includes(attr.replace(/^-/, '').split('=')[0])
}

/**
 * Can `pattern`, written in the .gitattributes of folder `dir` ('' = the repository root), match a file of the plugin folder `pre` ('plugins/x/', or '' for a
 * plugin at the root)? A pattern without a slash matches at any depth below dir; an anchored one is compared segment by segment with the plugin path, and a
 * wildcard segment counts as a match. A pattern that names the plugin folder itself (no trailing part) matches a directory, and attributes never apply to one.
 */
export function reachesPlugin(dir, pattern, pre) {
  const dirSlash = dir ? `${dir}/` : ''
  if (!pre) return true // the plugin is the whole repository: every file is a plugin file
  if (dirSlash.startsWith(pre)) return true // a .gitattributes inside the plugin folder
  if (dirSlash && !pre.startsWith(dirSlash)) return false // a sibling folder's file governs nothing in the plugin
  const below = pre.slice(dirSlash.length).split('/').filter(Boolean) // the plugin path relative to dir
  const p = pattern.replace(/\/$/, '')
  if (!p.slice(0, -1).includes('/') && !p.startsWith('/')) return true // no slash: any depth
  const segs = p.replace(/^\//, '').split('/')
  for (let i = 0; i < segs.length; i++) {
    if (segs[i] === '**' || /[*?[]/.test(segs[i])) return true
    if (i >= below.length) return true // the pattern goes below the plugin folder: it names plugin files
    if (segs[i] !== below[i]) return false
  }
  return false // the pattern stops at (or above) the plugin folder itself: a directory, not a file
}

const words = (md) => md.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length

/**
 * Runs every check. Returns { findings: [{ level, rule, detail }], stats }.
 * level: 'blocks' | 'stops' (validation stops) | 'hold' (held for a reviewer) | 'warning'
 */
export function check({ repo, ref = 'HEAD', plugin = '', archiveBytes }) {
  const findings = []
  const add = (level, rule, detail) => findings.push({ level, rule, detail })
  const tree = readTree(repo, ref)
  const pre = plugin ? `${plugin.replace(/\/+$/, '')}/` : ''
  const inPlugin = tree.filter((e) => e.path.startsWith(pre))
  const rel = (p) => p.slice(pre.length)

  // ── repository and folder layout ──
  const dirs = new Set()
  for (const e of tree) { const parts = e.path.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/')) }
  const entries = tree.length + dirs.size
  const unpacked = tree.reduce((s, e) => s + e.size, 0)
  if (entries >= LIMITS.entries) add('stops', 'Repository too large to validate', `${entries} files and folders (limit: fewer than ${LIMITS.entries})`)
  if (unpacked >= LIMITS.unpackedBytes) add('stops', 'Repository too large to validate', `${(unpacked / MiB).toFixed(1)} MiB unpacked (limit: under 256 MiB)`)
  if (archiveBytes !== undefined && archiveBytes >= LIMITS.archiveBytes) add('stops', 'Repository too large to validate', `${(archiveBytes / MiB).toFixed(1)} MiB as an archive (limit: under 50 MiB)`)
  for (const e of inPlugin) if (e.size >= LIMITS.repoFileBytes) add('stops', 'Repository too large to validate', `${e.path} is ${(e.size / MiB).toFixed(1)} MiB (a plugin file must be under 5 MiB)`)

  const lower = new Map()
  for (const p of [...tree.map((e) => e.path), ...dirs]) {
    for (const seg of p.split('/')) {
      if (seg.includes(':') || /[ .]$/.test(seg) || DEVICE.test(seg)) add('stops', "Couldn't validate that repository", `name not valid on Windows or macOS: ${p}`)
    }
    const k = p.toLowerCase()
    if (lower.has(k) && lower.get(k) !== p) add('stops', "Couldn't validate that repository", `names differ only by case: ${lower.get(k)} / ${p}`)
    else lower.set(k, p)
  }
  if (plugin) for (const seg of plugin.split('/')) if (!/^[A-Za-z0-9._-]+$/.test(seg)) add('stops', "Couldn't validate that repository", `plugin path folder "${seg}" may use only letters, digits, dots, hyphens and underscores`)

  for (const e of tree.filter((x) => /(^|\/)\.gitattributes$/.test(x.path))) {
    const text = show('git', repo, ref, e.path)
    if (/\bexport-(ignore|subst)\b/.test(text)) add('stops', "Couldn't validate that repository", `${e.path} uses export-ignore or export-subst`)
    const dir = e.path.replace(/\/?\.gitattributes$/, '')
    // The checklist names the files, not the reach of their lines: "at the repository root, above the plugin folder, and inside it". The portal refused
    // a root file whose rewriting lines were all scoped away from the plugin (2026-10-15 17:37), so in those files every such line counts.
    const dirSlash = dir ? `${dir}/` : ''
    const governing = pre.startsWith(dirSlash) || dirSlash.startsWith(pre)
    for (const { line, pattern, attrs } of attributeLines(text)) {
      const rewriting = attrs.filter(rewritesContent)
      if (rewriting.length && (governing || reachesPlugin(dir, pattern, pre))) add('stops', 'A .gitattributes filter rewrites files at checkout', `${e.path}: "${line}" sets ${rewriting.join(', ')} - a .gitattributes at the root, above ${pre || 'the plugin'} or inside it must not hold content-rewriting attributes; move the rule into the .gitattributes of the folders it is for`)
    }
  }

  if (!tree.some((e) => e.path === `${pre}.claude-plugin/plugin.json`)) add('blocks', 'No plugin manifest', `${pre}.claude-plugin/plugin.json is not in the commit`)
  for (const e of inPlugin) {
    if (e.mode === '120000' || e.mode === '160000') add('blocks', 'Symbolic link or submodule in the plugin folder', e.path)
    const base = path.posix.basename(e.path).toLowerCase()
    if (SYSTEM_FILES.has(base) || e.path.split('/').includes('__MACOSX')) add('blocks', 'This is a macOS or Windows system file', e.path)
  }
  // claude.ai and Cowork do not install a plugin with a top-level bin/ ("Plugin contains a top-level bin/ directory")
  if (inPlugin.some((e) => rel(e.path).startsWith('bin/'))) add('blocks', 'Plugin contains a top-level bin/ directory', `${pre}bin/ - move executables to scripts/ and call them as \${CLAUDE_PLUGIN_ROOT}/scripts/<name>`)

  // ── manifest and name ──
  let manifest = null
  try { manifest = JSON.parse(show('git', repo, ref, `${pre}.claude-plugin/plugin.json`)) } catch { /* reported above or below */ }
  if (manifest) {
    const n = String(manifest.name ?? '')
    if (/[^\x00-\x7f]/.test(n)) add('blocks', 'Non-ASCII identifier', `name "${n}"`)
    else if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(n)) add('warning', 'Name pattern', `name "${n}" should be lowercase letters, digits and hyphens, up to 64 characters`)
    if (RESERVED_WHOLE.has(n)) add('blocks', 'Name is taken', `"${n}" is a reserved word`)
    for (const k of ['description', 'author', 'version']) if (!manifest[k]) add('warning', 'Manifest field missing', k)
    for (const [k, v] of Object.entries(manifest)) if (typeof v === 'string' && v.startsWith('./') && !tree.some((e) => e.path === pre + v.slice(2) || e.path.startsWith(`${pre + v.slice(2).replace(/\/$/, '')}/`))) add('blocks', 'Manifest path not in the plugin folder', `${k}: ${v}`)
  }

  // ── README and license ──
  const readme = inPlugin.find((e) => /^readme(\.md)?$/i.test(rel(e.path)))
  if (!readme) add('blocks', 'README missing', `${pre}README.md`)
  else { const w = words(show('git', repo, ref, readme.path)); if (w < LIMITS.readmeWords) add('blocks', 'README too short', `${w} words outside code blocks (at least ${LIMITS.readmeWords})`) }
  if (!inPlugin.some((e) => /^licen[cs]e(\.\w+)?$/i.test(rel(e.path))) && !manifest?.license) add('blocks', 'License missing', 'no LICENSE file and no license in plugin.json')

  // ── files in the plugin folder ──
  if (inPlugin.length > LIMITS.pluginFiles) add('hold', "Files or downloads the validator couldn't inspect", `${inPlugin.length} files (more than ${LIMITS.pluginFiles})`)
  for (const e of inPlugin) {
    if (!IMAGE_FONT.test(e.path) && e.size > LIMITS.pluginFileBytes) add('hold', "Files or downloads the validator couldn't inspect", `${e.path} is ${Math.round(e.size / KiB)} KiB (over 256 KiB)`)
    if (/\.(ico|pdf|zip|tgz|gz|exe|dll|so|dylib|wasm|node|jar|bin)$/i.test(e.path)) add('hold', "Files or downloads the validator couldn't inspect", `${e.path} is a binary file`)
  }

  // ── what the plugin runs ──
  const text = inPlugin.filter((e) => !IMAGE_FONT.test(e.path) && e.size < LIMITS.repoFileBytes)
  let usesLauncher = false
  const blobs = readBlobs(repo, ref, text.map((e) => e.path))
  for (const e of text) {
    const t = blobs.get(e.path) ?? ''
    for (const m of t.matchAll(LAUNCHER)) {
      usesLauncher = true
      const pkg = m[2]
      const pinned = /@\d+\.\d+\.\d+([-+][\w.]+)?$/.test(pkg) || /@\$\{\w+\}$/.test(pkg) || /==\d/.test(t.slice(m.index, m.index + m[0].length + 20))
      if (!pinned) add('blocks', `Unpinned ${m[1].split(' ')[0]} launcher`, `${e.path}: ${m[0].trim()}`)
    }
  }
  for (const e of inPlugin) if (/(^|\/)(\.npmrc|bunfig\.toml|uv\.toml|pip\.conf)$/.test(e.path) && usesLauncher) add('blocks', 'Install may use a custom registry or package source', e.path)
  if (inPlugin.some((e) => rel(e.path) === 'package.json') && inPlugin.some((e) => /^(package-lock\.json|npm-shrinkwrap\.json|bun\.lockb?)$/.test(rel(e.path)))) add('hold', 'Dependencies install from a lockfile', `${pre}package.json + lockfile`)

  // ── hooks ──
  const hookFiles = new Set(inPlugin.filter((e) => rel(e.path) === 'hooks/hooks.json').map((e) => e.path))
  if (manifest && typeof manifest.hooks === 'string') hookFiles.add(pre + manifest.hooks.replace(/^\.\//, ''))
  for (const f of hookFiles) {
    let h
    try { h = JSON.parse(show('git', repo, ref, f)) } catch { add('blocks', 'hooks.json is invalid', f); continue }
    if (!h || typeof h.hooks !== 'object') { add('blocks', 'hooks.json is invalid', `${f}: no top-level "hooks" object`); continue }
    for (const groups of Object.values(h.hooks)) for (const g of groups ?? []) for (const hk of g.hooks ?? []) {
      for (const part of [hk.command, ...(hk.args ?? [])].filter((x) => typeof x === 'string')) {
        const vars = [...part.matchAll(/\$\{?(\w+)\}?/g)].map((m) => m[1]).filter((v) => v !== 'CLAUDE_PLUGIN_ROOT')
        if (pre && (vars.length || /\$\(|`|[*?]/.test(part))) add('blocks', 'Hook command path', `${f}: "${part}" (write each path in full from \${CLAUDE_PLUGIN_ROOT}, nothing else)`)
      }
    }
  }

  // ── skills: front matter with a text description ──
  for (const e of inPlugin.filter((x) => /(^|\/)SKILL\.md$/.test(x.path))) {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(show('git', repo, ref, e.path))?.[1]
    if (!fm) { add('warning', 'No front matter', e.path); continue }
    const d = /^description:\s*(.*)$/m.exec(fm)
    if (!d) add('warning', 'No description', e.path)
    else if (/^\s*$/.test(d[1]) && /^description:\s*\n\s+-\s/m.test(fm)) add('blocks', 'Description is a list', e.path)
  }

  return { findings, stats: { entries, unpackedMiB: +(unpacked / MiB).toFixed(1), archiveMiB: archiveBytes === undefined ? null : +(archiveBytes / MiB).toFixed(1), pluginFiles: inPlugin.length } }
}

/** Size of `git archive --format=tar.gz` of the ref (what GitHub serves as the repository archive). */
export function archiveSize(repo, ref = 'HEAD') {
  const tmp = path.join(os.tmpdir(), `dircheck-${process.pid}.tar.gz`)
  const r = spawnSync('git', ['-C', repo, 'archive', '--format=tar.gz', '-o', tmp, ref])
  if (r.status !== 0) throw new Error(`git archive failed: ${r.stderr}`)
  const n = fs.statSync(tmp).size
  fs.rmSync(tmp, { force: true })
  return n
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
  const repo = arg('--repo')
  if (!repo) { console.error('usage: node directory-check.mjs --repo <folder> [--ref HEAD] [--plugin <path>] [--json]'); process.exit(2) }
  try {
    const ref = arg('--ref', 'HEAD')
    const r = check({ repo, ref, plugin: arg('--plugin', ''), archiveBytes: archiveSize(repo, ref) })
    if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2))
    else {
      for (const f of r.findings) console.log(`${f.level.toUpperCase().padEnd(7)} ${f.rule} — ${f.detail}`)
      console.log(`directory-check: ${JSON.stringify(r.stats)} · blocks/stops ${r.findings.filter((f) => f.level === 'blocks' || f.level === 'stops').length} · holds ${r.findings.filter((f) => f.level === 'hold').length} · warnings ${r.findings.filter((f) => f.level === 'warning').length}`)
    }
    process.exitCode = r.findings.some((f) => f.level === 'blocks' || f.level === 'stops') ? 1 : 0
  } catch (e) {
    console.error(e.message)
    process.exitCode = 2
  }
}
