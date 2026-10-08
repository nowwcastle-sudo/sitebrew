#!/usr/bin/env node
// Blocks a change that touches plugin files without raising the version in .claude-plugin/plugin.json.
//   node .github/check-version-bump.mjs --base <git ref> [--head <git ref>] [--repo <folder>] [--plugin <plugin folder inside the repo, default .>]
// Why: Claude Code updates an installed plugin only when its version number goes up. A change shipped under the same number never reaches anyone.
// Rule: if any file of the plugin folder (outside .github/) differs between the merge base and head, plugin.json "version" must be strictly higher than at the base.
// In the Sitebrew repository the plugin sits in plugins/sitebrew/ and the marketplace file is the repository root's .claude-plugin/marketplace.json; its entry must carry the same version as plugin.json. Exit 0 = fine, 1 = blocked, 2 = usage or git error.
// No dependencies: Node built-ins and git only.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const MANIFEST = '.claude-plugin/plugin.json' // relative to the plugin folder
export const MARKETPLACE = '.claude-plugin/marketplace.json' // always relative to the repository root
const EXEMPT = [/^\.github\//]

export function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(v ?? '').trim())
  return m ? { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ? m[4].split('.') : [] } : null
}

/** -1 | 0 | 1 by semver precedence (a pre-release is lower than the same version without one). */
export function compareSemver(a, b) {
  for (let i = 0; i < 3; i++) if (a.nums[i] !== b.nums[i]) return a.nums[i] > b.nums[i] ? 1 : -1
  if (!a.pre.length && !b.pre.length) return 0
  if (!a.pre.length) return 1
  if (!b.pre.length) return -1
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const nx = /^\d+$/.test(x)
    const ny = /^\d+$/.test(y)
    if (nx && ny) return Number(x) > Number(y) ? 1 : -1
    if (nx) return -1
    if (ny) return 1
    return x > y ? 1 : -1
  }
  return 0
}

/** Pure decision. baseVersion null = the manifest did not exist at the base (first release). */
export function judge({ changedFiles, baseVersion, headVersion, marketplaceVersion, plugin = '.' }) {
  const prefix = plugin === '.' ? '' : `${plugin.replace(/\/+$/, '')}/`
  const payload = changedFiles.filter((f) => f.startsWith(prefix) && !EXEMPT.some((r) => r.test(f.slice(prefix.length))))
  const head = parseSemver(headVersion)
  if (payload.length && !head) return { ok: false, message: `${prefix}${MANIFEST}: "version" is missing or not a semantic version (${JSON.stringify(headVersion)}).` }
  if (marketplaceVersion !== undefined && marketplaceVersion !== null && marketplaceVersion !== headVersion) {
    return { ok: false, message: `${MARKETPLACE} says version ${marketplaceVersion} but ${prefix}${MANIFEST} says ${headVersion}. Make them equal.` }
  }
  if (!payload.length) return { ok: true, message: 'No plugin file changed (only .github/ or nothing). No version bump needed.' }
  if (baseVersion === null) return { ok: true, message: `First release: ${prefix}${MANIFEST} is new (version ${headVersion}).` }
  const base = parseSemver(baseVersion)
  if (!base) return { ok: true, message: `The base version ${JSON.stringify(baseVersion)} is not a semantic version; head ${headVersion} accepted.` }
  const c = compareSemver(head, base)
  const list = payload.slice(0, 8).join(', ') + (payload.length > 8 ? `, ... (${payload.length} files)` : '')
  if (c > 0) return { ok: true, message: `Version raised ${baseVersion} -> ${headVersion} for ${payload.length} changed file(s).` }
  if (c === 0) return { ok: false, message: `${payload.length} plugin file(s) changed (${list}) but ${prefix}${MANIFEST} version is still ${headVersion}. Raise "version" (and the marketplace entry) so installed copies update.` }
  return { ok: false, message: `${prefix}${MANIFEST} version went down: ${baseVersion} -> ${headVersion}.` }
}

const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const readJsonAt = (repo, ref, file) => {
  let text
  try { text = git(repo, 'show', `${ref}:${file}`) } catch { return null }
  return JSON.parse(text)
}

export function check({ repo = '.', base, head = 'HEAD', plugin = '.' }) {
  const prefix = plugin === '.' ? '' : `${plugin.replace(/\/+$/, '')}/`
  if (!base || /^0+$/.test(base)) return { ok: true, message: 'No base commit (new branch or first push). Nothing to compare.' }
  let mb = base
  try { mb = git(repo, 'merge-base', base, head).trim() } catch { /* unrelated histories: compare to the base itself */ }
  const changedFiles = git(repo, 'diff', '--name-only', '--no-renames', mb, head).split('\n').map((s) => s.trim()).filter(Boolean)
  const headManifest = readJsonAt(repo, head, prefix + MANIFEST)
  const baseManifest = readJsonAt(repo, mb, prefix + MANIFEST)
  const market = readJsonAt(repo, head, MARKETPLACE)
  const entry = market?.plugins?.find?.((p) => p.name === headManifest?.name)
  return judge({ changedFiles, baseVersion: baseManifest ? baseManifest.version ?? null : null, headVersion: headManifest?.version, marketplaceVersion: entry?.version, plugin })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
  try {
    const r = check({ repo: arg('--repo', '.'), base: arg('--base'), head: arg('--head', 'HEAD'), plugin: arg('--plugin', '.') })
    console.log(`${r.ok ? 'ok' : 'BLOCKED'}: ${r.message}`)
    process.exit(r.ok ? 0 : 1)
  } catch (e) {
    console.error(`version-bump check could not run: ${e.message}`)
    process.exit(2)
  }
}
