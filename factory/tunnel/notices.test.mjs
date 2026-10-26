// 사용자 문장 시험(계획 4 Task 4) — copy.json 의 짝(ko·en)·해요체·교차 검사, notices·failure·guide.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { failure, guide, notices, text } from './notices.mjs'
import { loadProviders } from './providers.mjs'

const copy = JSON.parse(readFileSync(fileURLToPath(new URL('./copy.json', import.meta.url)), 'utf8'))
const groups = Object.entries(copy).filter(([k]) => !k.startsWith('_'))
const entries = groups.flatMap(([, g]) => Object.entries(g))
const table = loadProviders()
const cf = table.providers.cloudflare
const lhr = table.providers.localhostrun
const FORBIDDEN = /cloudflare|cloudflared|trycloudflare|localhost\.run|localhostrun|\bssh\b/i

test('모든 키가 ko·en 둘 다 있고 비지 않으며, 키는 그룹을 가로질러 유일하다', () => {
  const keys = entries.map(([k]) => k)
  assert.equal(new Set(keys).size, keys.length, 'duplicate key')
  for (const [k, v] of entries) {
    assert.ok(typeof v.ko === 'string' && v.ko.trim(), `${k}.ko`)
    assert.ok(typeof v.en === 'string' && v.en.trim(), `${k}.en`)
  }
})

test('영어에는 한글이 없고, 한국어는 해요체 어미로 끝난다', () => {
  for (const [k, v] of entries) {
    assert.doesNotMatch(v.en, /[가-힣]/, `${k}.en has Hangul`)
    assert.match(v.ko, /요\.?$/, `${k}.ko must end in 해요체`)
  }
})

test('providers.json 의 limits 키와 설치 textKey 가 모두 copy.json 에 있다', () => {
  const have = new Set(entries.map(([k]) => k))
  for (const p of Object.values(table.providers)) {
    for (const key of p.limits) assert.ok(have.has(key), `limits: ${key}`)
    for (const steps of Object.values(p.install ?? {})) for (const s of steps) assert.ok(have.has(s.textKey), `textKey: ${s.textKey}`)
  }
  assert.ok(have.has('manualInstall'))
})

test('notices: 소개형은 네 문장 + 한계 + longTerm', () => {
  const out = notices({ lang: 'ko', kind: 'site', provider: cf, minutes: 120 })
  assert.deepEqual(out.slice(0, 4), [text('ko', 'publicAnyone'), text('ko', 'closesWhen').replace('{minutes}', '120'), text('ko', 'addressChanges'), text('ko', 'fakeDataOnly')])
  assert.ok(out.includes(text('ko', 'limit200')) && out.includes(text('ko', 'noSse')))
  assert.equal(out.at(-1), text('ko', 'longTerm'))
  assert.equal(out.includes(text('ko', 'mockShared')), false)
  assert.equal(out.length, 7)
})

test('notices: 제품형은 가짜 로그인 공유 문장이 더 있다', () => {
  const out = notices({ lang: 'ko', kind: 'product', provider: lhr, minutes: 60 })
  assert.ok(out.includes(text('ko', 'mockShared')))
  assert.ok(out.includes(text('ko', 'rotates')) && out.includes(text('ko', 'speedLimit')))
})

test('notices: 공급자는 id 문자열로도 받고, 없으면 한계 문장이 빠진다', () => {
  assert.deepEqual(notices({ lang: 'en', kind: 'site', provider: 'cloudflare', minutes: 30 }), notices({ lang: 'en', kind: 'site', provider: cf, minutes: 30 }))
  assert.equal(notices({ lang: 'en', kind: 'site', minutes: 30 }).length, 5)
  assert.throws(() => notices({ lang: 'en', kind: 'site', provider: 'nope', minutes: 30 }), /provider/)
})

test('notices: 분이 문장에 들어가고 빈 자리가 남지 않는다', () => {
  for (const lang of ['ko', 'en']) {
    const out = notices({ lang, kind: 'product', provider: cf, minutes: 120 })
    assert.ok(out.some((s) => s.includes('120')))
    assert.ok(out.every((s) => !s.includes('{')))
  }
})

test('notices: 문장에 도구·공급자 이름이 없다', () => {
  for (const lang of ['ko', 'en']) for (const p of [cf, lhr]) for (const kind of ['site', 'product']) {
    for (const s of notices({ lang, kind, provider: p, minutes: 5 })) assert.doesNotMatch(s, FORBIDDEN, s)
  }
})

test('notices: 잘못된 입력은 던진다', () => {
  assert.throws(() => notices({ lang: 'fr', kind: 'site', minutes: 5 }), /lang/)
  assert.throws(() => notices({ lang: 'ko', kind: 'x', minutes: 5 }), /kind/)
  assert.throws(() => notices({ lang: 'ko', kind: 'site', minutes: 0 }), /minutes/)
  assert.throws(() => notices({ lang: 'ko', kind: 'site', minutes: 1.5 }), /minutes/)
})

test('failure: 모든 실패 키가 두 언어로 나오고, 모르는 키는 던진다', () => {
  for (const key of Object.keys(copy.failures)) for (const lang of ['ko', 'en']) assert.equal(failure(lang, key), copy.failures[key][lang])
  assert.throws(() => failure('ko', 'nope'), /key/)
  assert.throws(() => failure('fr', 'timeout'), /lang/)
  for (const key of ['toolMissing', 'urlNotFound', 'notReachable', 'exited', 'buildFailed', 'installFailed', 'noPackage', 'alreadyRunning', 'mockNeedsOk', 'timeout']) assert.ok(copy.failures[key], key)
})

test('guide: 소개 문장으로 시작하고 플랫폼별 설치 문장이 붙는다', () => {
  assert.equal(guide('ko', {})[0], text('ko', 'guideIntro'))
  assert.ok(guide('en', { platform: 'win32' }).includes(text('en', 'installWinget')))
  assert.ok(guide('en', { platform: 'darwin' }).includes(text('en', 'installBrew')))
  assert.ok(guide('en', { platform: 'linux' }).includes(text('en', 'manualInstall')))
  assert.equal(guide('ko', { platform: 'win32' }).at(-1), text('ko', 'guideRun'))
})
