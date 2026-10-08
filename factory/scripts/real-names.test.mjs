// 실존 사이트·브랜드·도메인 이름 검사(Task 10d fix — 리뷰 b1 I2 · b2 I4): node --test factory/scripts/real-names.test.mjs
// 복제 경계(운영자 승인): DNA 카드(docs/recipes/dna/)만 출처 사이트를 부른다. 레시피 파일(머리·본문·결정 기록·references)·히어로 구성(app/qa/recipes/heroes/**)
// ·heroes.css 에는 실존 사이트·브랜드·도메인 이름이 0이어야 한다. 표준 이름(KRDS·WCAG)은 규칙 이름으로 남아도 된다 — 도메인은 안 된다.
// 목록은 docs/recipes/dna/index.md 의 20개 출처(주소에서 도메인을 뽑는다) + 사람이 읽는 브랜드 이름(아래 BRANDS)이다. 양성 대조: index.md 자체는 20개 모두에 걸린다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const INDEX = join(ROOT, 'docs', 'recipes', 'dna', 'index.md')

// index.md 표의 사이트 1·2 주소 → 호스트(www. 뺀 것). 20개.
export function dnaHosts(md = readFileSync(INDEX, 'utf8')) {
  const hosts = [...md.matchAll(/https?:\/\/([^/\s|]+)\//g)].map((m) => m[1].toLowerCase().replace(/^www\./, ''))
  return [...new Set(hosts)]
}
// 호스트마다 화면에 쓰이는 브랜드 이름(정규식 원문). 표준 이름으로 쓰는 KRDS 는 도메인만 막는다(이름은 규칙 이름으로 허용 — 컨트롤러 판정).
// 일반 영어 낱말과 겹치는 이름(linear·readily·exemplar·FMI)은 대문자로 시작하는 고유명사 꼴만 잡는다 — CSS 의 linear-gradient 같은 말은 걸리지 않는다.
// 나머지는 대소문자를 가리지 않는다(예전 결정 기록의 소문자 「orchid」도 잡는다).
export const BRANDS = {
  'fmi-industries.com': '\\bFMI\\b|fmi-industries',
  'ausvector.ai': 'ausvector',
  'visualsociety.ch': 'visual ?society',
  'thedesignsociety.fr': 'design ?society',
  'tabkitchenbakery.com': 'tab ?kitchen',
  'counter-print.co.uk': 'counter-?print',
  'readily.ai': '\\bReadily\\b',
  'orchid.security': 'orchid',
  'susannekaufmann.com': 'kaufmann',
  'exemplarfromsweden.com': '\\bExemplar\\b|exemplarfromsweden',
  'checkpointresearch.ca': 'checkpoint ?research',
  'krds.go.kr': 'krds\\.go\\.kr',
  'mintlify.com': 'mintlify',
  'fibery.io': 'fibery',
  'white-desert.com': 'white ?-?desert',
  'villa-banwoo.imweb.me': 'banwoo|반우',
  'madie.es': '\\bmadie\\b',
  'thecozyhollow.ca': 'cozy ?hollow',
  'linear.app': '\\bLinear\\b(?!-)|linear\\.app',
  'koyeb.com': 'koyeb',
  'cerebrium.ai': 'cerebrium',
  'raycast.com': 'raycast',
  'dashboard.simpleanalytics.com': 'simple ?analytics',
  'askmidnight.com': 'ask ?midnight',
  'archiv.systems': 'archiv\\.systems',
  'tinycomputer.co': 'tiny ?computer',
  'theunholyproject.com': 'unholy ?project',
  'neon.com': 'neon\\.com',
  'seedlipdrinks.com': 'seedlip',
  'brinkerhoffpoetry.org': 'brinkerhoff',
  'supaste.com': 'supaste',
  'cityxofxangels.com': 'cityxofxangels',
}
// DNA 밖이지만 예전에 레시피 파일에 있던 실존 이름(리뷰 b1 I2 범위) — 다시 들어오지 않게 함께 막는다.
export const EXTRA = 'moto-card|photiu|mindrobotics|redcollar|metic\\.studio|brightland|marhenj|마르헨|grafana|digitalocean|avecanni|madebykota|gionatannese|tokonoma|gov\\.uk|moef\\.go\\.kr|github\\.com/IBM'
const caseSensitive = (src) => /\\b[A-Z]/.test(src)
export function patterns() {
  return Object.entries(BRANDS).map(([host, src]) => ({ host, re: new RegExp(`${host.replace(/[.]/g, '\\.')}|${src}`, caseSensitive(src) ? 'g' : 'gi') }))
}

const walk = (dir, keep) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p, keep) : keep(p) ? [p] : [] })
export const scopedFiles = () => [
  ...walk(join(ROOT, 'registry', 'factory', 'recipes'), (p) => p.endsWith('DESIGN.md')),
  ...walk(join(ROOT, 'app', 'qa', 'recipes', 'heroes'), (p) => /\.(tsx?|css)$/.test(p)),
]

function hitsIn(text) {
  const out = []
  for (const { host, re } of patterns()) for (const m of text.matchAll(re)) out.push(`${host}: ${m[0]}`)
  for (const m of text.matchAll(new RegExp(EXTRA, 'gi'))) out.push(`extra: ${m[0]}`)
  return out
}

test('dna index lists every source host and every host has a brand pattern (positive control: index.md itself hits all of them)', () => {
  const hosts = dnaHosts()
  assert.equal(hosts.length, Object.keys(BRANDS).length, hosts.join(' '))
  assert.deepEqual([...hosts].sort(), Object.keys(BRANDS).sort())
  const idx = readFileSync(INDEX, 'utf8')
  for (const { host, re } of patterns()) assert.ok(idx.match(re), `${host} 가 index.md 에서 잡히지 않는다 — 패턴이 죽었다`)
  // 일반 낱말은 걸리지 않는다(음성 대조).
  assert.deepEqual(hitsIn('background: linear-gradient(red, blue); animation: x 1s linear infinite; readily available; an exemplar case; KRDS 표준형'), [])
})

test('recipe files, hero components and heroes.css carry no real site, brand or domain name (0 hits)', () => {
  const files = scopedFiles()
  assert.ok(files.length >= 30, `검사한 파일 ${files.length}개 — 레시피 10 + 히어로 20 이상이어야 한다`)
  const hits = files.flatMap((f) => hitsIn(readFileSync(f, 'utf8')).map((h) => `${relative(ROOT, f)} — ${h}`))
  assert.deepEqual(hits, [])
})
