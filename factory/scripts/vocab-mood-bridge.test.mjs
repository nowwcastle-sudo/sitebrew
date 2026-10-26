// MOOD_TABLE 이 디자인 어휘 사전(impression + mood)에서 만들어지는지 본다(설계 5.10).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOOD_TABLE, moodProfile } from '../stamp/mood.mjs'
import { loadLexicon } from '../vocab/lexicon.mjs'

const lex = loadLexicon()
const moodEntries = lex.entries.filter((e) => e.kind === 'impression' && e.mood)

test('MOOD_TABLE 은 사전 impression(mood 있음)과 항목·id가 같고 13개 이상이다', () => {
  assert.ok(MOOD_TABLE.length >= 13)
  assert.deepEqual(MOOD_TABLE.map((m) => m.key), moodEntries.map((e) => e.id))
  for (const m of MOOD_TABLE) {
    assert.deepEqual(Object.keys(m).sort(), ['en', 'ko', 'key', 'label', 'recipeTokens', 'tokens'].sort())
    assert.ok(m.ko.length && m.tokens.length)
  }
})

test('따뜻한은 warm 으로, 모던은 이제 null(보여 주며 묻기)이다', () => {
  assert.ok(moodProfile('따뜻한')?.keys.includes('warm'))
  assert.equal(moodProfile('모던'), null)
  assert.equal(moodProfile('modern'), null)
})
