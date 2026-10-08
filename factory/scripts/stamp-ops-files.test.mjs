// P3-4 perf 레인 — 찍어낸 사이트가 운영 준비 관문(ops-gate)의 사이트 수준 검사(favicon-set·error-pages)를 통과하는 파일을 갖는다.
// 정적 검사(설치·빌드 없음). 실제 next build·실 서버에서 재는 것은 보고서 실측(npm run qa:ops)이 맡는다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-ops-files.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { root, localBrief, localContent, SAAS_BRIEF, saasContent, makeRun as makeRunIn, gen } from './lib/stamp-site-fixtures.mjs'
import { SITE_FILE_ROUTES } from '../stamp/site-files.mjs'

const TMP = join(root, '.tmp', 'stamp-ops-files-test')
const makeRun = (brief, contentFor, opts) => makeRunIn(TMP, brief, contentFor, opts)
const read = (siteDir, ...p) => readFileSync(join(siteDir, ...p), 'utf8')

const L = await makeRun(localBrief(), localContent)
const LS = await gen(L)
const S = await makeRun(SAAS_BRIEF, saasContent)
const SS = await gen(S)
const SITES = [LS, SS]

test('C148: app/manifest.ts — 192·512 any + 512 maskable 이 실제로 구워지는 public 파일을 가리키고, 값은 lib/site 에서 온다', () => {
  for (const s of SITES) {
    const src = read(s.siteDir, 'app', 'manifest.ts')
    assert.match(src, /MetadataRoute\.Manifest/)
    assert.match(src, /manifestProps\(\)/)
    const icons = [...src.matchAll(/src: "(\/[^"]+)", sizes: "(\d+x\d+)", type: "image\/png", purpose: "(any|maskable)"/g)].map((m) => ({ src: m[1], sizes: m[2], purpose: m[3] }))
    assert.deepEqual(icons.map((i) => `${i.sizes} ${i.purpose}`), ['192x192 any', '512x512 any', '512x512 maskable'])
    for (const i of icons) assert.ok(existsSync(join(s.siteDir, 'public', i.src.slice(1))), `public${i.src} 가 구워지지 않았다`)
    for (const v of ['달빛 베이커리', '예약노트', '02-1234-5678']) assert.equal(src.includes(v), false, `manifest 코드에 콘텐츠 값 ${v}`)
  }
  assert.match(read(LS.siteDir, 'lib/site.tsx'), /export function manifestProps\(\)/)
})

test('C172: not-found·error·global-error — 사이트 셸 안 404, 500 경계 둘, 안내 글은 로캘별', () => {
  for (const s of SITES) {
    const nf = read(s.siteDir, 'app', 'not-found.tsx')
    assert.match(nf, /SiteShell/, '404 는 사이트 셸 안이다')
    assert.match(nf, /href="\/"/, '404 에 홈 링크')
    assert.match(nf, /pageTitle=\{/, '404 는 h1 하나(셸의 pageTitle)')
    const err = read(s.siteDir, 'app', 'error.tsx')
    assert.match(err, /^"use client"/, 'error 경계는 클라이언트 컴포넌트')
    assert.match(err, /reset/)
    const ge = read(s.siteDir, 'app', 'global-error.tsx')
    assert.match(ge, /^"use client"/)
    assert.match(ge, /<html[^>]*lang=\{/, 'global-error 는 자기 html 을 가진다(루트 레이아웃을 대신한다)')
    assert.match(ge, /<body/)
    assert.match(ge, /globals\.css/, 'global-error 도 사이트 CSS 를 싣는다')
    const view = read(s.siteDir, 'components', 'site', 'error-view.tsx')
    assert.match(view, /<h1/)
    assert.match(read(s.siteDir, 'lib', 'system-copy.ts'), /ko:[\s\S]*en:/)
  }
})

test('C172: lib/build.json 이 locale·brand 를 싣는다(error·global-error 는 site.json 을 클라이언트 번들에 끌어오지 않는다)', () => {
  const build = JSON.parse(read(LS.siteDir, 'lib/build.json'))
  assert.equal(build.locale, 'ko')
  assert.equal(build.brand, '달빛 베이커리')
  const saas = JSON.parse(read(SS.siteDir, 'lib/build.json'))
  assert.equal(saas.brand, '예약노트')
  for (const s of SITES) {
    for (const f of ['app/error.tsx', 'app/global-error.tsx', 'components/site/error-view.tsx']) assert.equal(/content\/site\.json|@\/lib\/site["']/.test(read(s.siteDir, ...f.split('/'))), false, `${f} 가 site.json 을 import 한다`)
  }
})

test('라우트 코드에 콘텐츠 값이 없다 — 새 파일도 J9 를 지킨다', () => {
  for (const s of SITES) {
    for (const f of ['app/manifest.ts', 'app/not-found.tsx', 'app/error.tsx', 'app/global-error.tsx', 'components/site/error-view.tsx']) {
      const src = read(s.siteDir, ...f.split('/'))
      for (const v of ['달빛 베이커리', '예약노트', '02-1234-5678']) assert.equal(src.includes(v), false, `${f}: ${v}`)
    }
  }
  assert.ok(SITE_FILE_ROUTES.includes('app/manifest.ts') && SITE_FILE_ROUTES.includes('app/not-found.tsx'), 'SITE_FILE_ROUTES 표에 새 라우트 파일이 있다')
})
