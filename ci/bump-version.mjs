#!/usr/bin/env node
// Sets the one release number everywhere (the same places ci/check-single-version.mjs reads), then runs that check.
//   node ci/bump-version.mjs X.Y.Z [--root <repository folder>]
// It does not touch the READMEs: add the release row to the root README and launch-factory/README in all five languages by hand (see docs/RELEASING.md).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMPAT, SITES, check } from './check-single-version.mjs'

/** A new guides["X.Y.Z"] entry in the compat table (old plugin versions keep their rows). */
export function addCompatEntry(text, version) {
  if (JSON.parse(text).guides?.[version]) return text
  const re = /("guides":\s*\{\n)/
  if (!re.test(text)) throw new Error(`${COMPAT}: "guides" object not found`)
  return text.replace(re, `$1    "${version}": {\n      "sitebrew": { "tag": "v${version}", "status": "pending-release" }\n    },\n`)
}

export function bump(root, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('usage: node ci/bump-version.mjs X.Y.Z')
  const changed = []
  for (const s of SITES) {
    const file = path.join(root, s.file)
    const text = fs.readFileSync(file, 'utf8')
    if (s.optional && s.actual(text) === undefined) continue
    const next = s.write(text, version)
    if (next !== text) { fs.writeFileSync(file, next); changed.push(s.file) }
  }
  const compat = path.join(root, COMPAT)
  const text = fs.readFileSync(compat, 'utf8')
  const next = addCompatEntry(text, version)
  if (next !== text) { fs.writeFileSync(compat, next); changed.push(COMPAT) }
  return changed
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
  const root = path.resolve(arg('--root', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')))
  const version = process.argv.slice(2).find((a) => /^\d+\.\d+\.\d+$/.test(a))
  try {
    const changed = bump(root, version)
    console.log(`version ${version} written to ${changed.length} file(s):\n- ${changed.join('\n- ')}`)
  } catch (e) { console.error(e.message); process.exit(2) }
  const problems = check(root, { tag: `v${version}` })
  if (problems.length) { console.error(`still different:\n- ${problems.join('\n- ')}`); process.exit(1) }
  console.log('single-version check: ok. Next: the README rows, regenerate with the tag pinned, the gates, then the tag (docs/RELEASING.md).')
}
