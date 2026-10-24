// 사이트 종류·서버 환경 시험(계획 4 Task 3) — 임시 폴더에 package.json 만 놓고 읽는다.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { serveEnv, siteKind } from './site-kind.mjs'

const root = mkdtempSync(join(tmpdir(), 'wf-kind-'))
after(() => rmSync(root, { recursive: true, force: true }))

/** 폴더를 만들고 파일을 놓는다 */
function folder(name, files) {
  const dir = join(root, name)
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  mkdirSync(dir, { recursive: true })
  return dir
}
const pkg = (deps) => JSON.stringify({ name: 'x', dependencies: deps })

test('siteKind: lib/launch/enabled.json 이 있으면 제품형', () => {
  assert.deepEqual(siteKind(folder('a', { 'package.json': pkg({ next: '1' }), 'lib/launch/enabled.json': '{}' })), { product: true })
})

test('siteKind: @launch-factory/* 의존이 있으면 제품형', () => {
  assert.deepEqual(siteKind(folder('b', { 'package.json': pkg({ '@launch-factory/auth': '1' }) })), { product: true })
})

test('siteKind: 둘 다 없으면 소개형', () => {
  assert.deepEqual(siteKind(folder('c', { 'package.json': pkg({ next: '1', react: '1' }) })), { product: false })
  assert.deepEqual(siteKind(folder('c2', { 'package.json': JSON.stringify({ name: 'x' }) })), { product: false })
})

test('siteKind: package.json 이 없으면 reason noPackage 로 던진다', () => {
  assert.throws(() => siteKind(folder('d', { 'readme.md': 'x' })), (e) => e.reason === 'noPackage')
  assert.throws(() => siteKind(folder('e', { 'package.json': '{broken' })), (e) => e.reason === 'noPackage')
})

test('siteKind: 파일 읽기는 주입한 함수로 바꿔 끼운다', () => {
  const fs = { exists: (p) => p.endsWith('package.json'), readFile: () => pkg({ '@launch-factory/billing': '1' }) }
  assert.deepEqual(siteKind('/nowhere', fs), { product: true })
})

const BASE = { PATH: '/usr/bin', VERCEL_TOKEN: 'secret-xyz', HIGGSFIELD_API_KEY: 'k', PEXELS_API_KEY: 'p', LF_MODE: 'prod', LF_SOMETHING: 'x', NODE_ENV: 'production' }

test('serveEnv: 비밀 이름을 뺀다', () => {
  for (const kind of [{ product: false }, { product: true }]) {
    const env = serveEnv(kind, { base: BASE, outboxFile: '/o.jsonl' })
    for (const k of ['VERCEL_TOKEN', 'HIGGSFIELD_API_KEY', 'PEXELS_API_KEY']) assert.equal(k in env, false, k)
    assert.equal(env.PATH, '/usr/bin')
    assert.equal(env.NEXT_TELEMETRY_DISABLED, '1')
  }
})

test('serveEnv: 제품형은 mock 네 개로 덮는다', () => {
  const env = serveEnv({ product: true }, { base: BASE, outboxFile: '/o.jsonl' })
  assert.equal(env.LF_MODE, 'mock')
  assert.equal(env.LF_ALLOW_MOCK_PROD, '1')
  assert.equal(env.LF_MOCK_SUB, 'none')
  assert.equal(env.LF_MOCK_OUTBOX, '/o.jsonl')
})

test('serveEnv: 소개형에는 LF_ 이름이 없다(기존 것도 뺀다)', () => {
  const env = serveEnv({ product: false }, { base: BASE })
  assert.deepEqual(Object.keys(env).filter((k) => k.startsWith('LF_')), [])
  assert.equal(env.NODE_ENV, 'production')
})

test('serveEnv: 받은 환경을 바꾸지 않는다', () => {
  const base = { ...BASE }
  serveEnv({ product: true }, { base, outboxFile: '/o.jsonl' })
  serveEnv({ product: false }, { base })
  assert.deepEqual(base, BASE)
})

test('serveEnv: 제품형인데 outbox 파일이 없으면 던진다', () => {
  assert.throws(() => serveEnv({ product: true }, { base: BASE }), /outboxFile/)
})
