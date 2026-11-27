import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const tag = `v${JSON.parse(read('package.json')).version}`

test('release installers default to the current repository tag', () => {
  const bootstrap = read('get.ps1')
  const installer = read('install.ps1')
  assert.equal(bootstrap.match(/\$tag\s*=\s*'([^']+)'/)?.[1], tag)
  assert.equal(installer.match(/\[string\]\$Tag\s*=\s*'([^']+)'/)?.[1], tag)
  const cli = spawnSync(process.execPath, ['packages/create-sitebrew/bin/create-sitebrew.mjs', '--help'], { cwd: root, encoding: 'utf8' })
  assert.equal(cli.status, 0, cli.stderr)
  assert.ok(cli.stdout.includes(`--ref ${tag}`), 'create-sitebrew help must name the current default')
})
