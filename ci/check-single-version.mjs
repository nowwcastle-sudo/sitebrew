#!/usr/bin/env node
// One release number for the whole repository: a tag vX.Y.Z covers web-factory (the root), launch-factory/, plugins/sitebrew, packages/create-sitebrew and the
// marketplace files. This check fails when one of those places names another number, or when the Node/npm requirement differs between the parts.
//   node ci/check-single-version.mjs [--root <repository folder>] [--tag vX.Y.Z]     exit 0 = one number everywhere, 1 = a place differs, 2 = usage / unreadable file
// The number is the root package.json "version". --tag (a release run) must equal it. ci/bump-version.mjs writes the same places this file reads (SITES).
// No dependencies: Node built-ins only, so it can run before `npm ci`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const replaceFirst = (text, re, v) => {
  if (!re.test(text)) throw new Error(`version field not found (${re})`)
  return text.replace(re, (_m, a, b) => `${a}${v}${b}`)
}
const FIELD = /("version":\s*")[^"]*(")/

/** A package.json / plugin.json: top-level "version". */
const jsonVersion = (file, label) => ({
  file,
  label,
  actual: (t) => JSON.parse(t).version,
  write: (t, v) => replaceFirst(t, FIELD, v),
})
/** A package-lock.json: the top "version" and packages[""].version (the first two "version" lines). */
const lockVersion = (file, label) => ({
  file,
  label,
  actual: (t) => {
    const j = JSON.parse(t)
    const a = j.version
    const b = j.packages?.['']?.version
    return a === b ? a : `${a} / ${b}`
  },
  write: (t, v) => {
    const lines = t.split('\n')
    let n = 0
    for (let i = 0; i < lines.length && n < 2; i++) if (FIELD.test(lines[i])) { lines[i] = lines[i].replace(FIELD, (_m, a, b) => `${a}${v}${b}`); n++ }
    if (n !== 2) throw new Error(`${file}: expected two root version lines, found ${n}`)
    return lines.join('\n')
  },
})
/** A marketplace file: the version of the sitebrew entry (the Codex file may carry none). */
const marketVersion = (file, label, optional) => ({
  file,
  label,
  optional,
  actual: (t) => JSON.parse(t).plugins?.find((p) => p.name === 'sitebrew')?.version,
  write: (t, v) => {
    const at = t.indexOf('"name": "sitebrew"', t.indexOf('"plugins"'))
    if (at < 0) throw new Error(`${file}: sitebrew entry not found`)
    return t.slice(0, at) + replaceFirst(t.slice(at), FIELD, v)
  },
})

export const SITES = [
  jsonVersion('package.json', 'web-factory (repository root)'),
  lockVersion('package-lock.json', 'web-factory lock file'),
  jsonVersion('launch-factory/package.json', 'launch-factory'),
  lockVersion('launch-factory/package-lock.json', 'launch-factory lock file'),
  jsonVersion('plugins/sitebrew/.claude-plugin/plugin.json', 'plugin (Claude Code)'),
  jsonVersion('plugins/sitebrew/.codex-plugin/plugin.json', 'plugin (Codex)'),
  marketVersion('.claude-plugin/marketplace.json', 'marketplace (Claude Code)', false),
  marketVersion('.agents/plugins/marketplace.json', 'marketplace (Codex)', true),
  jsonVersion('packages/create-sitebrew/package.json', 'npx package'),
]
export const COMPAT = 'plugins/sitebrew/compat.json'

const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8')

/** The compat table names this release: guides["X.Y.Z"] exists and, when it names a kit tag, that tag is vX.Y.Z. */
export function compatProblems(text, version) {
  const g = JSON.parse(text).guides?.[version]
  if (!g) return [`${COMPAT}: guides has no entry "${version}"`]
  const tag = g.sitebrew?.tag
  return tag !== undefined && tag !== `v${version}` ? [`${COMPAT}: guides["${version}"].sitebrew.tag is ${tag}, expected v${version}`] : []
}

/** Node and npm requirements are the same in every part (package.json engines, .nvmrc, compat table, npx package). */
export function engineProblems(root) {
  const out = []
  const rootPkg = JSON.parse(read(root, 'package.json'))
  const want = rootPkg.engines ?? {}
  const min = (range) => /(\d+\.\d+\.\d+)/.exec(range ?? '')?.[1]
  const same = (label, got, expected) => { if (got !== expected) out.push(`${label}: ${got ?? 'missing'} (root says ${expected ?? 'missing'})`) }
  const lfPkg = JSON.parse(read(root, 'launch-factory/package.json'))
  same('launch-factory/package.json engines.node', lfPkg.engines?.node, want.node)
  same('launch-factory/package.json engines.npm', lfPkg.engines?.npm, want.npm)
  const nvm = (f) => read(root, f).trim().replace(/^v/, '')
  same('.nvmrc', nvm('.nvmrc'), min(want.node))
  same('launch-factory/.nvmrc', nvm('launch-factory/.nvmrc'), min(want.node))
  const compat = JSON.parse(read(root, COMPAT))
  same(`${COMPAT} engines.node`, compat.engines?.node, want.node)
  same(`${COMPAT} engines.npm`, compat.engines?.npm, want.npm)
  same('packages/create-sitebrew/package.json engines.node', JSON.parse(read(root, 'packages/create-sitebrew/package.json')).engines?.node, want.node)
  return out
}

export function check(root, { tag } = {}) {
  const problems = []
  const version = JSON.parse(read(root, 'package.json')).version
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) return [`package.json: version ${JSON.stringify(version)} is not X.Y.Z`]
  if (tag && tag !== `v${version}`) problems.push(`--tag ${tag} but package.json says ${version}`)
  for (const s of SITES) {
    let actual
    try { actual = s.actual(read(root, s.file)) } catch (e) { problems.push(`${s.file}: ${e.message}`); continue }
    if (actual === undefined && s.optional) continue
    if (actual !== version) problems.push(`${s.file} (${s.label}): ${actual ?? 'no version'} (should be ${version})`)
  }
  try { problems.push(...compatProblems(read(root, COMPAT), version)) } catch (e) { problems.push(`${COMPAT}: ${e.message}`) }
  try { problems.push(...engineProblems(root)) } catch (e) { problems.push(`engines: ${e.message}`) }
  return problems
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
  const root = path.resolve(arg('--root', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')))
  let problems
  try { problems = check(root, { tag: arg('--tag', null) }) } catch (e) { console.error(`single-version check could not run: ${e.message}`); process.exit(2) }
  if (problems.length) {
    console.error(`BLOCKED: the repository does not name one release number (${problems.length} place${problems.length === 1 ? '' : 's'}):\n- ${problems.join('\n- ')}\nRun: node ci/bump-version.mjs <X.Y.Z> to set them all together.`)
    process.exit(1)
  }
  console.log(`ok: one version ${JSON.parse(read(root, 'package.json')).version} in ${SITES.length} files + the compat table, same Node/npm requirement everywhere`)
}
