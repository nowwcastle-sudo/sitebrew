// 보안 수정 C — 로컬 경로 신뢰 경계(WF-3·SB-9·SB-12·SB-14). 브리프·콘텐츠·재개 산출물(manifest)·next.config 가 가리키는 경로를 읽기 전에 거는 정책의 시험.
//   항목마다 「재현」(수정 전 코드에서는 실패한다)과 「정상 선례」(계속 통과해야 한다)를 짝으로 둔다. 가볍다(Chrome·네트워크 없음).
//   링크 시험은 디렉터리 junction 을 쓴다(Windows 에서 권한 없이 만들 수 있다 — 파일 심볼릭 링크는 권한이 필요하다).
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/security-local-paths.test.mjs
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs, { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { assertNoLinkInPath, isNetworkOrDevicePath, readLocalInputFile, realInside, statLocalInputFile } from '../lib/safe-path.mjs'
import { mediaPlan, fetchMedia } from '../stamp/media.mjs'
import { copyMediaFiles } from '../stamp/site-media.mjs'
import { headerLogoOf, markSvg } from '../stamp/site-files.mjs'
import { emptySiteDir, prepareSiteDir } from '../stamp/site-install.mjs'
import { OBJECT_HERO_BLOCK } from '../stamp/object-media.mjs'
import { exportDir } from '../tunnel/static-export.mjs'
import { assertStaticRoot } from '../tunnel/site-server.mjs'
import { resolveFile, startStaticServer } from '../tunnel/static-server.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sharp = createRequire(join(ROOT, 'package.json'))('sharp')
const TMP = mkdtempSync(join(tmpdir(), 'wf-seclocal-'))
after(() => rmSync(TMP, { recursive: true, force: true }))

let n = 0
const dirOf = (name) => { const d = join(TMP, `${name}-${++n}`); mkdirSync(d, { recursive: true }); return d }
const junction = (target, path) => symlinkSync(target, path, 'junction')
const GLB = (len = 2000) => Buffer.concat([Buffer.from('glTF'), Buffer.alloc(len, 7)])

// ── safe-path 단위 ───────────────────────────────────────────────────────────────────────────────
test('isNetworkOrDevicePath: UNC·장치 경로는 참, 드라이브 문자·POSIX 절대·상대 경로는 거짓', () => {
  for (const p of ['\\\\attacker\\share\\x.svg', '//attacker/share/x.svg', '\\\\?\\C:\\x.svg', '\\\\.\\pipe\\x', '//?/C:/x', '\\??\\C:\\x', '/\\attacker\\x'])
    assert.equal(isNetworkOrDevicePath(p), true, p)
  for (const p of ['Y:\\logo.svg', 'C:/logo.svg', '/var/logo.svg', 'logo.svg', './a/b.svg', '..\\a.svg', '', undefined])
    assert.equal(isNetworkOrDevicePath(p), false, String(p))
})

test('assertNoLinkInPath·realInside·readLocalInputFile: 링크는 거절하고 일반 파일은 읽는다', () => {
  const root = dirOf('sp'), outside = dirOf('sp-out')
  writeFileSync(join(outside, 'a.bin'), GLB(10))
  junction(outside, join(root, 'link'))
  mkdirSync(join(root, 'real'))
  writeFileSync(join(root, 'real', 'a.bin'), GLB(10))
  assert.throws(() => assertNoLinkInPath(join(root, 'link', 'a.bin'), { stopAt: root }), /링크/)
  assert.doesNotThrow(() => assertNoLinkInPath(join(root, 'real', 'a.bin'), { stopAt: root }))
  assert.doesNotThrow(() => assertNoLinkInPath(join(root, 'nothing', 'yet'), { stopAt: root }), '없는 경로는 링크가 아니다')
  assert.throws(() => assertNoLinkInPath(join(outside, 'a.bin'), { stopAt: root }), /밖/)
  assert.equal(realInside(root, join(root, 'real', 'a.bin')), true)
  assert.equal(realInside(root, join(root, 'link', 'a.bin')), false)
  assert.throws(() => readLocalInputFile(join(root, 'link')), /링크/)
  assert.throws(() => readLocalInputFile('\\\\h\\s\\f.glb'), /네트워크/)
  assert.throws(() => readLocalInputFile(join(root, 'real', 'a.bin'), { magic: 'PNG!' }), /형식/)
  assert.throws(() => readLocalInputFile(join(root, 'real', 'a.bin'), { maxBytes: 5 }), /너무 크다/)
  assert.deepEqual(readLocalInputFile(join(root, 'real', 'a.bin'), { magic: 'glTF' }), GLB(10))
  assert.equal(statLocalInputFile(join(root, 'real', 'a.bin')).size, 14)
})

// ── WF-3: 미디어 모델 경로 ───────────────────────────────────────────────────────────────────────
const SLOT = 'home/hero/hero-visual'
const arch = (source) => ({ id: 'landing', pages: [{ id: 'home', route: '/', sections: [{ kind: 'hero', imageSlots: [{ id: 'hero-visual', aspect: '4:3', source }] }] }] })
const planOf = (source, media) => mediaPlan(arch(source), { locale: 'ko', media: { [SLOT]: media } }, { id: 'a', slot: 'safe', source: 'library', recipe: 'r5-celadon' }, { variants: { 'home/hero': OBJECT_HERO_BLOCK }, mediaOf: (b) => (b === OBJECT_HERO_BLOCK ? ['scene3d', 'image'] : []) })

async function mediaFolder() {
  const dir = dirOf('media'), hf = join(dir, 'hf'), out = join(dir, 'out')
  mkdirSync(hf, { recursive: true }); mkdirSync(out, { recursive: true })
  await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 40, g: 80, b: 170 } } }).png().toFile(join(hf, 'obj.png'))
  writeFileSync(join(hf, 'credits.json'), JSON.stringify([{ file: 'obj.png', job: 'j', model: 'm', credits: 0.25, slot: SLOT, created: '2026-10-11' }]))
  return { dir, hf, out }
}

test('WF-3 재현: 모델 칸에 비밀 텍스트 파일 경로를 적으면 복사되지 않고 실패한다 · 정상 GLB 는 복사된다', async () => {
  const { dir, hf, out } = await mediaFolder()
  const secret = join(dir, 'secret.txt')
  writeFileSync(secret, 'private notes: do not publish')
  const bad = planOf('generated-ok', { higgsfield: 'obj.png', higgsfieldModel: secret })
  await assert.rejects(() => fetchMedia(bad, out, { higgsfieldDir: hf }), /모델 파일을 쓸 수 없다/)
  const leaked = existsSync(join(out, 'r5-celadon')) ? readdirSync(join(out, 'r5-celadon')).filter((f) => f.endsWith('.glb')) : []
  assert.deepEqual(leaked, [], '비밀 파일이 .glb 로 복사되면 안 된다')

  const good = join(dir, 'ok.glb')
  writeFileSync(good, GLB())
  const r = await fetchMedia(planOf('generated-ok', { higgsfield: 'obj.png', higgsfieldModel: good }), out, { higgsfieldDir: hf })
  assert.equal(r.manifest.assets[0].kind, 'model')
  assert.deepEqual(readFileSync(join(out, r.manifest.assets[0].model.glb)), GLB())
})

test('WF-3 재현: 2 MB 를 넘는 큰 비 GLB 파일은 줄이는 도구에도 넘기지 않는다', async () => {
  const { dir, hf, out } = await mediaFolder()
  const big = join(dir, 'big.txt')
  writeFileSync(big, Buffer.alloc(2 * 1024 * 1024 + 64, 65))
  let called = 0
  await assert.rejects(() => fetchMedia(planOf('generated-ok', { higgsfield: 'obj.png', higgsfieldModel: big }), out, { higgsfieldDir: hf, optimizeGlb: async () => { called++ } }), /모델 파일을 쓸 수 없다/)
  assert.equal(called, 0)
})

test('WF-3 재현: UNC 모델 경로는 파일 시스템을 건드리지 않고 거절한다', async () => {
  const { hf, out } = await mediaFolder()
  await assert.rejects(() => fetchMedia(planOf('generated-ok', { higgsfield: 'obj.png', higgsfieldModel: '\\\\127.0.0.1\\nope\\m.glb' }), out, { higgsfieldDir: hf }), /네트워크·장치 경로/)
})

test('WF-3 재현: 대표 사진 칸이 링크(junction)·UNC 이면 거절하고, 정상 사진은 그대로 쓴다', async () => {
  const { dir, out } = await mediaFolder()
  const real = join(dir, 'photos'); mkdirSync(real)
  await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 200, g: 100, b: 50 } } }).jpeg().toFile(join(real, 'p.jpg'))
  const link = join(dir, 'photolink'); junction(real, link)
  await assert.rejects(() => fetchMedia(planOf('real-required', { file: link }), out, { higgsfieldDir: null }), /링크/)
  await assert.rejects(() => fetchMedia(planOf('real-required', { file: '\\\\127.0.0.1\\nope\\p.jpg' }), out, { higgsfieldDir: null }), /네트워크·장치 경로/)
  const ok = await fetchMedia(planOf('real-required', { file: join(real, 'p.jpg') }), out, { higgsfieldDir: null })
  assert.equal(ok.manifest.assets[0].source, 'brand')
})

// ── WF-3: manifest 파일 이름 ─────────────────────────────────────────────────────────────────────
test('WF-3 재현: manifest 의 상대 경로가 ../ 로 나가면 거절하고, 정상 경로는 복사한다', () => {
  const dir = dirOf('manifest'), mediaDir = join(dir, 'run', '05-media'), siteDir = join(dir, 'run', 'site')
  mkdirSync(join(mediaDir, 'r1'), { recursive: true }); mkdirSync(siteDir, { recursive: true })
  writeFileSync(join(dir, 'run', 'secret.txt'), 'secret')
  writeFileSync(join(mediaDir, 'r1', 'a.webp'), 'img')
  for (const rel of ['../secret.txt', 'r1/../../secret.txt', '/etc/passwd', 'C:\\Windows\\win.ini', '\\\\h\\s\\x', '..\\secret.txt']) {
    assert.throws(() => copyMediaFiles(mediaDir, siteDir, [{ files: [{ file: rel }] }]), /안전하지 않다/, rel)
  }
  assert.equal(existsSync(join(siteDir, 'secret.txt')), false)
  assert.deepEqual(copyMediaFiles(mediaDir, siteDir, [{ files: [{ file: 'r1/a.webp' }] }]), ['r1/a.webp'])
  assert.equal(readFileSync(join(siteDir, 'public', 'media', 'r1', 'a.webp'), 'utf8'), 'img')
})

test('WF-3 재현: 05-media 안의 폴더 링크가 밖을 가리키면 그 파일을 읽지 않는다', () => {
  const dir = dirOf('manifest-link'), mediaDir = join(dir, '05-media'), siteDir = join(dir, 'site'), outside = join(dir, 'outside')
  mkdirSync(mediaDir, { recursive: true }); mkdirSync(siteDir); mkdirSync(outside)
  writeFileSync(join(outside, 'x.webp'), 'secret')
  junction(outside, join(mediaDir, 'evil'))
  assert.throws(() => copyMediaFiles(mediaDir, siteDir, [{ files: [{ file: 'evil/x.webp' }] }]), /링크|밖/)
  assert.equal(existsSync(join(siteDir, 'public', 'media', 'evil', 'x.webp')), false)
})

// ── SB-9: 로고 경로 ──────────────────────────────────────────────────────────────────────────────
const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path fill="currentColor" d="M0 0h8v8H0z"/></svg>'

test('SB-9 재현: UNC·장치 로고 경로는 파일 시스템을 부르지 않고 도형 표지로 대체한다', (t) => {
  const calls = []
  t.mock.method(fs, 'existsSync', (p) => { calls.push(['existsSync', String(p)]); return true })
  t.mock.method(fs, 'readFileSync', (p) => { calls.push(['readFileSync', String(p)]); return LOGO_SVG })
  syncBuiltinESMExports()
  try {
    for (const logoPath of ['\\\\attacker\\share\\x.svg', '//attacker/share/x.svg', '\\\\?\\UNC\\attacker\\share\\x.svg', '\\\\.\\pipe\\x.svg']) {
      const r = markSvg('상호', { logoPath })
      assert.equal(r.source, 'shape', logoPath)
    }
    assert.deepEqual(calls.filter(([, p]) => /attacker|pipe|\?/.test(p)), [], '외부 호스트 경로로 fs 를 부르면 SMB 접속이 일어난다')
  } finally {
    t.mock.restoreAll()
    syncBuiltinESMExports()
  }
})

test('SB-9 정상 선례: 로컬 SVG 로고는 brand-logo, 링크로 가리킨 로고는 도형 표지', () => {
  const dir = dirOf('logo'), real = join(dir, 'real'); mkdirSync(real)
  writeFileSync(join(real, 'logo.svg'), LOGO_SVG)
  assert.equal(markSvg('상호', { logoPath: join(real, 'logo.svg') }).source, 'brand-logo')
  assert.equal(markSvg('상호', { logoPath: 'logo.svg', baseDir: real }).source, 'brand-logo')
  junction(real, join(dir, 'via'))
  // 링크 폴더 안의 일반 파일은 부모가 링크라도 허용한다(마지막 요소만 본다) — 로고 파일 자체가 링크일 때만 거절한다
  assert.equal(markSvg('상호', { logoPath: join(dir, 'via', 'logo.svg') }).source, 'brand-logo')
  assert.equal(markSvg('상호', { logoPath: join(real, 'nope.svg') }).source, 'shape')
})

test('SB-9 재현(v0.2.6 headerLogoOf): UNC·장치 로고 경로는 파일 시스템을 부르지 않고 이유와 함께 거절한다', async (t) => {
  const calls = []
  for (const name of ['existsSync', 'statSync', 'lstatSync', 'openSync', 'readFileSync']) {
    t.mock.method(fs, name, (p) => { calls.push([name, String(p)]); return name === 'existsSync' ? true : LOGO_SVG })
  }
  syncBuiltinESMExports()
  try {
    for (const logoPath of ['\\\\attacker\\share\\x.svg', '//attacker/share/x.svg', '\\\\?\\UNC\\attacker\\share\\x.svg', '\\\\.\\pipe\\x.svg']) {
      const r = await headerLogoOf(logoPath)
      assert.equal(r.ok, false, logoPath)
      assert.match(r.reason, /네트워크·장치/, logoPath)
      const rel = await headerLogoOf(logoPath, { baseDir: TMP }) // baseDir 를 줘도 같다
      assert.equal(rel.ok, false, logoPath)
    }
    assert.deepEqual(calls.filter(([, p]) => /attacker|pipe|\?/.test(p)), [], '외부 호스트 경로로 fs 를 부르면 SMB 접속이 일어난다')
  } finally {
    t.mock.restoreAll()
    syncBuiltinESMExports()
  }
})

test('SB-9 정상 선례(headerLogoOf): 로컬 SVG·PNG 와 짝 .dark 파일은 그대로 쓰고, 없는 파일·큰 파일은 이유를 단다', async () => {
  const dir = dirOf('hlogo')
  writeFileSync(join(dir, 'cc.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><path fill="currentColor" d="M0 0h8v8H0z"/></svg>')
  const svg = await headerLogoOf(join(dir, 'cc.svg'))
  assert.deepEqual(svg, { ok: true, file: join(dir, 'cc.svg'), ext: '.svg', width: 120, height: 40, mode: 'mask' })
  assert.equal((await headerLogoOf('cc.svg', { baseDir: dir })).ok, true)
  const png = (f, w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#336699' } }).png().toFile(join(dir, f))
  await png('a.png', 300, 100); await png('a.dark.png', 300, 100)
  const pair = await headerLogoOf(join(dir, 'a.png'))
  assert.equal(pair.ok, true)
  assert.equal(pair.darkFile, join(dir, 'a.dark.png'))
  assert.equal((await headerLogoOf(join(dir, 'nope.png'))).reason, '파일을 찾지 못했어요')
  writeFileSync(join(dir, 'huge.svg'), '<svg viewBox="0 0 1 1">' + ' '.repeat(1024 * 1024 + 1) + '</svg>')
  assert.equal((await headerLogoOf(join(dir, 'huge.svg'))).reason, '파일이 1MB 를 넘어요')
})

// ── SB-12: 공개 미리보기 정적 서버───────────────────────────────────────────────────────────────
test('SB-12 재현: distDir 이 사이트 폴더 밖이면 서버형으로 넘기지 않고 reason 을 달아 던진다 · 정상 distDir 은 그대로', () => {
  const fsOf = (src) => ({ exists: () => true, readFile: () => src })
  const cfg = (dist) => `export default { output: "export", distDir: ${JSON.stringify(dist)} }`
  for (const dist of ['../..', '../out', '/etc', 'C:\\Windows', '\\\\h\\s\\o', 'a/../../b', '.', './'])
    assert.throws(() => exportDir('/site', fsOf(cfg(dist))), (e) => e.reason === 'unsafeExportDir', dist)
  assert.equal(exportDir('/site', fsOf(cfg('dist'))), 'dist')
  assert.equal(exportDir('/site', fsOf(cfg('build/out'))), 'build/out')
  assert.equal(exportDir('/site', fsOf('export default { output: "export" }')), 'out')
})

test('SB-12 재현: 루트 안의 링크가 루트 밖 파일을 가리키면 403, 정상 파일은 200', async () => {
  const dir = dirOf('static'), root = join(dir, 'out'), outside = join(dir, 'outside')
  mkdirSync(join(root, 'sub'), { recursive: true }); mkdirSync(outside)
  writeFileSync(join(root, 'index.html'), '<h1>home</h1>')
  writeFileSync(join(root, 'sub', 'index.html'), '<h1>sub</h1>')
  writeFileSync(join(outside, 'secret.txt'), 'top secret')
  writeFileSync(join(outside, 'index.html'), '<h1>outside</h1>')
  junction(outside, join(root, 'leak'))
  assert.equal(resolveFile(root, '/leak/secret.txt'), 'forbidden')
  assert.equal(resolveFile(root, '/leak/'), 'forbidden', '링크 폴더의 index.html 도 밖 파일이다')
  assert.equal(resolveFile(root, '/sub/'), join(root, 'sub', 'index.html'))
  const srv = await startStaticServer(root)
  try {
    const get = (p) => fetch(`http://127.0.0.1:${srv.port}${p}`, { redirect: 'manual' })
    assert.equal((await get('/leak/secret.txt')).status, 403)
    assert.equal((await get('/leak/')).status, 403)
    const ok = await get('/')
    assert.equal(ok.status, 200)
    assert.equal(await ok.text(), '<h1>home</h1>')
  } finally { await srv.stop() }
})

test('SB-12 재현: 루트 폴더 자체가 링크면 서버를 열지 않는다 · assertStaticRoot 는 링크·밖 폴더를 거절한다', async () => {
  const dir = dirOf('static-root'), site = join(dir, 'site'), real = join(dir, 'elsewhere')
  mkdirSync(site); mkdirSync(real)
  writeFileSync(join(real, 'index.html'), 'x')
  junction(real, join(site, 'out'))
  await assert.rejects(() => startStaticServer(join(site, 'out')), (e) => e.reason === 'unsafeExportDir')
  assert.throws(() => assertStaticRoot(site, 'out'), (e) => e.reason === 'unsafeExportDir')
  assert.throws(() => assertStaticRoot(site, '../elsewhere'), (e) => e.reason === 'unsafeExportDir')
  mkdirSync(join(site, 'dist')); writeFileSync(join(site, 'dist', 'index.html'), 'ok')
  assert.equal(assertStaticRoot(site, 'dist'), join(site, 'dist'))
})

// ── SB-14: 사이트 폴더 비우기 ────────────────────────────────────────────────────────────────────
test('SB-14 재현: siteDir 이 링크(junction)면 던지고 링크 대상 폴더의 내용은 그대로다', () => {
  const run = dirOf('prep'), victim = join(run, 'victim'), cand = join(run, 'cand'), cache = join(run, 'cache')
  mkdirSync(victim); mkdirSync(cand); mkdirSync(cache)
  writeFileSync(join(victim, 'keep.txt'), 'precious'); mkdirSync(join(victim, 'sub')); writeFileSync(join(victim, 'sub', 'deep.txt'), 'deep')
  writeFileSync(join(cache, 'package.json'), '{}')
  junction(victim, join(cand, 'site'))
  assert.throws(() => prepareSiteDir(join(cand, 'site'), cache, { runDir: run }), /링크/)
  assert.throws(() => emptySiteDir(join(cand, 'site'), { runDir: run }), /링크/)
  assert.deepEqual(readdirSync(victim).sort(), ['keep.txt', 'sub'])
  assert.equal(readFileSync(join(victim, 'sub', 'deep.txt'), 'utf8'), 'deep')
  // 후보 폴더 자체가 링크여도 같다
  const run2 = dirOf('prep2'); const target = join(run2, 'target'); mkdirSync(join(target, 'site'), { recursive: true }); writeFileSync(join(target, 'site', 'f.txt'), 'f')
  junction(target, join(run2, 'cand'))
  assert.throws(() => emptySiteDir(join(run2, 'cand', 'site'), { runDir: run2 }), /링크/)
  assert.equal(existsSync(join(target, 'site', 'f.txt')), true)
})

test('SB-14 정상 선례: 일반 사이트 폴더는 비우고 node_modules 는 둔다 · 안의 링크 항목은 링크만 끊는다', () => {
  const run = dirOf('prep-ok'), cand = join(run, 'cand'), site = join(cand, 'site'), cache = join(run, 'cache'), outside = join(run, 'outside')
  mkdirSync(join(site, 'node_modules', 'next'), { recursive: true }); mkdirSync(join(site, 'app')); mkdirSync(cache); mkdirSync(outside)
  writeFileSync(join(site, 'node_modules', 'next', 'x.js'), 'n'); writeFileSync(join(site, 'app', 'old.tsx'), 'old'); writeFileSync(join(site, 'stale.txt'), 's')
  writeFileSync(join(outside, 'precious.txt'), 'precious')
  junction(outside, join(site, 'planted'))
  writeFileSync(join(cache, 'package.json'), '{"name":"t"}')
  prepareSiteDir(site, cache, { runDir: run })
  assert.deepEqual(readdirSync(site).sort(), ['node_modules', 'package.json'])
  assert.equal(readFileSync(join(site, 'node_modules', 'next', 'x.js'), 'utf8'), 'n')
  assert.equal(readFileSync(join(outside, 'precious.txt'), 'utf8'), 'precious', '링크 대상은 지우지 않는다')
  // 처음 만드는 폴더(없음)도 된다
  prepareSiteDir(join(run, 'cand2', 'site'), cache, { runDir: run })
  assert.equal(existsSync(join(run, 'cand2', 'site', 'package.json')), true)
})
