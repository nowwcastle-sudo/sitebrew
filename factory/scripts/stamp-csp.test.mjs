// P3-4 perf — 정적 사이트(completion "site")의 보안 헤더(대장 C171): next.config headers() + 빌드 뒤 script 해시 주입(scripts/csp-hashes.mjs).
// 정적 검사(빌드 없음 — 가짜 .next 폴더로 스크립트를 돌린다). 실제 next build·next start 위의 헤더는 보고서 실측(npm run qa:ops)이 맡는다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/stamp-csp.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inlineScriptHashes as gateHashes, judgeCspHash } from '../qa/ops-gate.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const TEMPLATE = join(root, 'factory', 'stamp', 'site-template')
const lib = await import(new URL(`file:///${join(TEMPLATE, 'security-headers.mjs').replaceAll('\\', '/')}`))
const { securityHeaders, inlineScriptHashes, withScriptHashes, patchRoutesManifest } = lib
const sha = (t) => `'sha256-${createHash('sha256').update(t, 'utf8').digest('base64')}'`
const cspOf = (list) => list.find((h) => h.key === 'Content-Security-Policy')?.value

test('securityHeaders(운영): CSP(script-src \'self\' 만 — 해시는 빌드 뒤에 붙는다)·nosniff·Referrer-Policy·Permissions-Policy 를 싣는다', () => {
  const list = securityHeaders({ dev: false })
  assert.deepEqual(list.map((h) => h.key).sort(), ['Content-Security-Policy', 'Permissions-Policy', 'Referrer-Policy', 'X-Content-Type-Options'])
  const map = Object.fromEntries(list.map((h) => [h.key, h.value]))
  assert.equal(map['X-Content-Type-Options'], 'nosniff')
  assert.equal(map['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.match(map['Permissions-Policy'], /camera=\(\)/)
  const csp = map['Content-Security-Policy']
  assert.match(csp, /(?:^|; )script-src 'self'(?:;|$)/, "해시를 붙이기 전 script-src 는 'self' 하나")
  assert.doesNotMatch(csp.split(';').find((d) => d.trim().startsWith('script-src')), /unsafe-inline|unsafe-eval|nonce/)
  for (const d of ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "default-src 'self'", "form-action 'self'"]) assert.ok(csp.includes(d), d)
  // ops-gate 의 판정이 「해시가 아직 없다」만 말하는 상태(주입 전 = 인라인 script 를 막는 정책)
  assert.deepEqual(judgeCspHash(csp, '<p>x</p>').detail, [])
})

// FINAL-WF E4: form-action 'self' 는 폼 제출·폼 뒤 리다이렉트만 막는다. 정적 어댑터의 mailto: 은 location 이동이지 form action 이 아니어야 막히지 않는다.
test("form-action 'self': 정적 어댑터 문의 폼의 mailto/tel/카카오 길은 폼 제출이 아니라 location 이동·window.open 이라 막히지 않는다", () => {
  const csp = cspOf(securityHeaders({ dev: false }))
  assert.match(csp, /(?:^|; )form-action 'self'(?:;|$)/)
  const adapter = readFileSync(join(root, 'registry', 'factory', 'contract', 'adapter-static.ts'), 'utf8')
  assert.match(adapter, /window\.location\.assign\(/, 'mailto/tel 은 location 이동으로 연다')
  assert.doesNotMatch(adapter, /\.action\s*=|setAttribute\(\s*["']action["']|\.submit\(\)|formaction/i, '어댑터가 폼 action 으로 제출하지 않는다')
  const contact = readFileSync(join(TEMPLATE, 'lib', 'contact.ts'), 'utf8')
  assert.doesNotMatch(contact, /action\s*[=:]\s*["']mailto|<form/i, '템플릿 contact 도 mailto 를 form action 으로 쓰지 않는다')
})

test('securityHeaders(개발): 개발 서버(HMR·eval)를 막는 CSP 는 싣지 않는다 — 나머지 셋은 그대로', () => {
  const list = securityHeaders({ dev: true })
  assert.equal(cspOf(list), undefined)
  assert.deepEqual(list.map((h) => h.key).sort(), ['Permissions-Policy', 'Referrer-Policy', 'X-Content-Type-Options'])
})

test('inlineScriptHashes: ops-gate 의 계산과 같다(같은 HTML → 같은 해시) — 실행되는 인라인 script 만', () => {
  const html = '<html><head><script>(function(){var a=1})()</script><script type="application/ld+json">{"@type":"WebSite"}</script><script src="/_next/static/a.js" async></script></head><body><script>self.__next_f.push([1,"안녕 \\u0041"])</script><script type="module">import("/m.js")</script></body></html>'
  assert.deepEqual(inlineScriptHashes(html), gateHashes(html))
  assert.equal(inlineScriptHashes(html).length, 3)
  assert.equal(inlineScriptHashes('<script></script>').length, 0)
})

test('withScriptHashes: script-src 에만 해시를 더하고(중복 없이 정렬), script-src 가 없으면 던진다', () => {
  const csp = "default-src 'self'; script-src 'self'; object-src 'none'"
  const out = withScriptHashes(csp, [sha('b'), sha('a'), sha('b')])
  assert.equal(out, `default-src 'self'; script-src 'self' ${[sha('a'), sha('b')].sort().join(' ')}; object-src 'none'`)
  assert.equal(withScriptHashes(out, [sha('a')]), out, '다시 돌려도 같다(멱등)')
  assert.throws(() => withScriptHashes("default-src 'self'", [sha('a')]), /script-src/)
})

test('patchRoutesManifest: headers 의 CSP 값마다 해시를 주입하고 개수를 돌려준다 — CSP 를 싣는 항목이 없으면 던진다(조용히 통과하지 않는다)', () => {
  const manifest = { version: 3, headers: [{ source: '/(.*)', regex: '^/(.*)$', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Content-Security-Policy', value: "script-src 'self'" }] }] }
  const n = patchRoutesManifest(manifest, [sha('a')])
  assert.equal(n, 1)
  assert.equal(cspOf(manifest.headers[0].headers), `script-src 'self' ${sha('a')}`)
  assert.throws(() => patchRoutesManifest({ headers: [] }, [sha('a')]), /Content-Security-Policy/)
  assert.throws(() => patchRoutesManifest({}, [sha('a')]), /Content-Security-Policy/)
})

function fakeDist({ withCsp = true } = {}) {
  const site = mkdtempSync(join(tmpdir(), 'csp-hashes-'))
  const app = join(site, '.next', 'server', 'app')
  mkdirSync(join(app, 'privacy'), { recursive: true })
  const page = (s) => `<html><head><script>${s}</script><script type="application/ld+json">{}</script></head><body><script src="/x.js"></script></body></html>`
  writeFileSync(join(app, 'index.html'), page('one()'))
  writeFileSync(join(app, 'privacy.html'), page('two()'))
  writeFileSync(join(app, '_not-found.html'), page('one()'))
  writeFileSync(join(site, '.next', 'routes-manifest.json'), JSON.stringify({ version: 3, headers: withCsp ? [{ source: '/(.*)', regex: '^/(.*)$', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" }] }] : [] }))
  return site
}
const runScript = (site, env = {}) => spawnSync(process.execPath, [join(TEMPLATE, 'scripts', 'csp-hashes.mjs')], { cwd: site, env: { ...process.env, WF_STATIC_EXPORT: '', ...env }, encoding: 'utf8' })

test('scripts/csp-hashes.mjs: .next/server/app 의 모든 HTML 인라인 script 해시를 routes-manifest 의 CSP 에 주입하고 기록을 남긴다', () => {
  const site = fakeDist()
  const r = runScript(site)
  assert.equal(r.status, 0, r.stderr + r.stdout)
  const manifest = JSON.parse(readFileSync(join(site, '.next', 'routes-manifest.json'), 'utf8'))
  const csp = cspOf(manifest.headers[0].headers)
  for (const t of ['one()', 'two()']) assert.ok(csp.includes(sha(t)), `${t} 해시가 CSP 에 있다`)
  assert.equal(csp.split(sha('one()')).length, 2, '같은 script(두 쪽)는 한 번만')
  assert.deepEqual(judgeCspHash(csp, `<script>one()</script><script>two()</script>`).detail, [], 'ops-gate 가 이 정책을 통과시킨다')
  const rec = JSON.parse(readFileSync(join(site, '.next', 'csp-hashes.json'), 'utf8'))
  assert.equal(rec.pages, 3)
  assert.equal(rec.hashes, 2)
  assert.match(r.stdout, /csp-hashes: 쪽 3개 · 해시 2개/)
})

test('scripts/csp-hashes.mjs: CSP 헤더가 없으면 종료 1(조용히 통과하지 않는다) · 정적 내보내기(WF_STATIC_EXPORT=1)는 건너뛴다(종료 0)', () => {
  const noCsp = fakeDist({ withCsp: false })
  const bad = runScript(noCsp)
  assert.equal(bad.status, 1)
  assert.match(bad.stderr, /Content-Security-Policy/)
  const exp = fakeDist()
  const skipped = runScript(exp, { WF_STATIC_EXPORT: '1' })
  assert.equal(skipped.status, 0)
  assert.match(skipped.stdout, /건너뜀/)
  assert.doesNotMatch(readFileSync(join(exp, '.next', 'routes-manifest.json'), 'utf8'), /sha256-/)
})

test('site-template: next.config 가 headers() 에 securityHeaders 를 물리고(내보내기 빌드는 제외), package.json build 가 next build 뒤에 해시 주입을 돌린다', () => {
  const cfg = readFileSync(join(TEMPLATE, 'next.config.ts'), 'utf8')
  assert.match(cfg, /import \{ securityHeaders \} from "\.\/security-headers\.mjs"/)
  assert.match(cfg, /async headers\(\)/)
  assert.match(cfg, /source: "\/\(\.\*\)"/)
  assert.match(cfg, /staticExport\s*\?\s*\{[^}]*output: "export"/,'내보내기 빌드는 headers() 를 안 싣는다(Next 는 output export 에서 headers 를 무시하고 경고한다)')
  const pkg = JSON.parse(readFileSync(join(TEMPLATE, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts.build, 'next build && node scripts/defer-hydration.mjs && node scripts/csp-hashes.mjs') // PERF2: 하이드레이션 로더가 먼저 — 그 인라인 로더의 해시를 csp-hashes 가 싣는다
  const dts = readFileSync(join(TEMPLATE, 'security-headers.d.mts'), 'utf8')
  assert.match(dts, /export declare function securityHeaders/)
})
