// 공급자 표 읽기 시험(계획 4 Task 1) — 데이터 모양 검사, 인자 만들기, 출력에서 주소 찾기. 프로세스·네트워크는 쓰지 않는다.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { findUrl, loadProviders, providerArgs } from './providers.mjs'

const table = loadProviders()
const cf = table.providers.cloudflare
const lhr = table.providers.localhostrun

/** 한 항목만 바꾼 표를 임시 파일로 써서 읽어 본다 */
function loadWith(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'wf-prov-'))
  try {
    const raw = JSON.parse(JSON.stringify(table))
    mutate(raw)
    const file = join(dir, 'providers.json')
    writeFileSync(file, JSON.stringify(raw))
    return loadProviders(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('기본 파일은 두 공급자와 순서를 낸다', () => {
  assert.equal(table.default, 'cloudflare')
  assert.deepEqual(table.order, ['cloudflare', 'localhostrun'])
  assert.equal(cf.tool, 'cloudflared')
  assert.equal(lhr.tool, 'ssh')
  assert.equal(cf.id, 'cloudflare')
  assert.ok(cf.install.win32 && cf.install.darwin && cf.install.debian)
  assert.equal(cf.install.debian.length, 4)
  assert.ok(cf.install.debian.every((s) => s.needsAdmin === true))
  assert.equal(cf.install.win32[0].needsAdmin, false)
  assert.equal(lhr.install, undefined)
})

test('localhost.run 주소 모양은 확인 안 됨으로 표시되어 있다', () => {
  assert.match(lhr._comment, /확인 안 됨|unverified/i)
  assert.match(lhr._comment, /unverified/i)
})

test('모양이 틀린 항목은 던진다', () => {
  assert.throws(() => loadWith((r) => { r.providers.cloudflare.args = ['tunnel', '--url', 'http://127.0.0.1:8080'] }), /\{port\}/)
  assert.throws(() => loadWith((r) => { r.providers.cloudflare.urlPattern = '(' }), /urlPattern/)
  assert.throws(() => loadWith((r) => { r.providers.cloudflare.install.win32[0].argv = [1] }), /argv/)
  assert.throws(() => loadWith((r) => { r.providers.cloudflare.readyMs = 0 }), /readyMs/)
  assert.throws(() => loadWith((r) => { r.order = ['nope'] }), /order/)
  assert.throws(() => loadWith((r) => { r.default = 'nope' }), /default/)
  assert.throws(() => loadWith((r) => { delete r.providers.cloudflare.limits }), /limits/)
})

test('providerArgs: 포트를 채운 argv', () => {
  assert.deepEqual(providerArgs(cf, 8080), ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:8080'])
  assert.ok(providerArgs(lhr, 3000).includes('80:127.0.0.1:3000'))
})

test('providerArgs: 포트는 1~65535 정수만', () => {
  for (const bad of ['80; rm', '8080', 0, -1, 70000, 1.5, NaN, null, undefined]) {
    assert.throws(() => providerArgs(cf, bad), /port/, String(bad))
  }
  assert.equal(providerArgs(cf, 1).at(-1), 'http://127.0.0.1:1')
  assert.equal(providerArgs(cf, 65535).at(-1), 'http://127.0.0.1:65535')
})

test('findUrl: cloudflared 실제 출력 모양(상자 그림 포함)', () => {
  const out = [
    '2026-10-22T01:00:00Z INF Thank you for trying Cloudflare Tunnel.',
    '2026-10-22T01:00:00Z INF Requesting new quick Tunnel on trycloudflare.com...',
    '2026-10-22T01:00:01Z INF +--------------------------------------------------------------------------------------------+',
    '2026-10-22T01:00:01Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |',
    '2026-10-22T01:00:01Z INF |  https://abc-def-123.trycloudflare.com                                                     |',
    '2026-10-22T01:00:01Z INF +--------------------------------------------------------------------------------------------+',
  ].join('\n')
  assert.equal(findUrl(cf, out), 'https://abc-def-123.trycloudflare.com')
})

test('findUrl: 주소가 없으면 null, 첫 주소만', () => {
  assert.equal(findUrl(cf, 'INF starting tunnel'), null)
  assert.equal(findUrl(cf, ''), null)
  assert.equal(findUrl(cf, 'a https://one.trycloudflare.com b https://two.trycloudflare.com'), 'https://one.trycloudflare.com')
})

test('findUrl: 끝의 구두점은 주소가 아니다', () => {
  assert.equal(findUrl(cf, 'open (https://one.trycloudflare.com).'), 'https://one.trycloudflare.com')
  assert.equal(findUrl(cf, 'see https://one.trycloudflare.com, ok'), 'https://one.trycloudflare.com')
  assert.equal(findUrl(lhr, 'url https://abc123.lhr.life.'), 'https://abc123.lhr.life')
})

test('findUrl: 제외 목록(api.trycloudflare.com·admin.localhost.run)은 주소가 아니다', () => {
  assert.equal(findUrl(cf, 'INF Requesting from https://api.trycloudflare.com/tunnel'), null)
  assert.equal(findUrl(cf, 'https://api.trycloudflare.com\nhttps://real-one.trycloudflare.com'), 'https://real-one.trycloudflare.com')
  assert.equal(findUrl(lhr, 'Open https://admin.localhost.run for admin'), null)
  assert.equal(findUrl(lhr, 'https://admin.localhost.run https://abc.lhr.life tunneled'), 'https://abc.lhr.life')
})
