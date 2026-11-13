// bump-version: the compat table gets its new guides row whatever line ending the working copy has.
// plugins/ has no .gitattributes on purpose (the plugin directory refuses attributes that rewrite content), so a Windows
// checkout with core.autocrlf=true gives compat.json CRLF line endings.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addCompatEntry } from './bump-version.mjs'

const COMPAT = ['{', '  "guides": {', '    "0.2.6": {', '      "sitebrew": { "tag": "v0.2.6", "status": "pending-release", "range": ">=0.2.0 <0.3.0" }', '    }', '  }', '}', '']

test('addCompatEntry adds the row on top with LF and with CRLF, keeping the file\'s line ending', () => {
  for (const eol of ['\n', '\r\n']) {
    const out = addCompatEntry(COMPAT.join(eol), '0.2.7')
    const j = JSON.parse(out)
    assert.deepEqual(Object.keys(j.guides), ['0.2.7', '0.2.6'], JSON.stringify(eol))
    assert.deepEqual(j.guides['0.2.7'].sitebrew, { tag: 'v0.2.7', status: 'pending-release', range: '>=0.2.0 <0.3.0' })
    if (eol === '\r\n') assert.equal(out.split('\n').filter((l) => !l.endsWith('\r')).length, 1, 'only the end of the file has no CR')
    assert.equal(addCompatEntry(out, '0.2.7'), out, 'a second run changes nothing')
  }
})
