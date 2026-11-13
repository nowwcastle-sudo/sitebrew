// fill-install-commit: the README install lines become the commit-pinned form get.ps1 checks (daybreak 4 — a moved tag must not install other code).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FILES, fill, fillText, pinLine } from './fill-install-commit.mjs'

const SHA = 'a'.repeat(40)
const TAG_LINE = 'irm https://raw.githubusercontent.com/someone/sitebrew/v9.9.9/get.ps1 | iex'
const doc = (eol = '\n') => ['```powershell', TAG_LINE, '```', '', '```powershell', "$env:SITEBREW_WHATIF = '1'", TAG_LINE, '```', 'irm https://raw.githubusercontent.com/someone/sitebrew/v9.9.8/get.ps1 | iex'].join(eol)

test('the tag lines of this release become the commit-pinned line; other releases and other lines stay', () => {
  const r = fillText(doc(), 'v9.9.9', SHA)
  assert.equal(r.changed, 2)
  const lines = r.text.split('\n')
  assert.equal(lines[1], pinLine('someone', SHA))
  assert.match(lines[1], /^\$env:SITEBREW_COMMIT = 'a{40}'; irm https:\/\/raw\.githubusercontent\.com\/someone\/sitebrew\/a{40}\/get\.ps1 \| iex; Remove-Item Env:SITEBREW_COMMIT$/)
  assert.equal(lines[6], pinLine('someone', SHA))
  assert.equal(lines[8], 'irm https://raw.githubusercontent.com/someone/sitebrew/v9.9.8/get.ps1 | iex')
})

test('a second run changes nothing and counts the lines as already pinned; CRLF files keep CRLF', () => {
  const once = fillText(doc('\r\n'), 'v9.9.9', SHA)
  assert.ok(once.text.split('\r\n')[1].startsWith('$env:SITEBREW_COMMIT'))
  const twice = fillText(once.text, 'v9.9.9', SHA)
  assert.equal(twice.text, once.text)
  assert.deepEqual([twice.changed, twice.pinned], [0, 2])
})

test('fill: every README and AGENT_INSTALL get the same line; a bad SHA is code 2, no line for the tag is code 1', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fill-commit-'))
  try {
    for (const f of FILES) fs.writeFileSync(path.join(root, f), doc())
    assert.throws(() => fill(root, 'v9.9.9', 'abc'), (e) => e.code === 2)
    assert.throws(() => fill(root, '9.9.9', SHA), (e) => e.code === 2)
    assert.throws(() => fill(root, 'v1.0.0', SHA), (e) => e.code === 1)
    const report = fill(root, 'v9.9.9', SHA)
    assert.deepEqual(report.map((r) => r.changed), FILES.map(() => 2))
    const texts = new Set(FILES.map((f) => fs.readFileSync(path.join(root, f), 'utf8')))
    assert.equal(texts.size, 1, 'the code blocks stay byte-identical across the languages')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
