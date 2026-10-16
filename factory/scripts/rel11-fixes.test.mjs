// REL11 (v0.0.11) — 출시 직전에 들어온 고침 다섯 건의 회귀 시험. 고치기 전에는 모두 실패해야 한다.
//   1) next 보안 패치(GHSA-vcvr-r3jv-pc5j — next/og ImageResponse 원격 코드 실행, 16.2.0 이상 16.3.6 미만)
//   4) 서버 부품이 가져오는 쿠키 설정 속성은 "use client" 밖에 있어야 한다
// 브라우저 시험(2·3·5)은 rel11-browser.test.mjs.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/rel11-fixes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const semver = (v) => v.split('.').map(Number)
const gte = (a, b) => { const [x, y] = [semver(a), semver(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return true }

// next 바닥 판: 16.3.6(REL11 — GHSA-vcvr-r3jv-pc5j) → 16.3.8(v0.1.2 — 2026-10-08 공개 6건: GHSA-39w2-rjm5-chcv · 3w37-wq28-93x7 · 4jqv-mc3x-m676 · cjq9-62q9-8jv4(CVSS 8.3) · f87g-xv8r-7p7x · mcj8-r9mp-w47p, OSV 가 잡았다)
const NEXT_FLOOR = '16.3.8'

test('REL11-1: next 는 알려진 보안 공지가 고쳐진 바닥 판(NEXT_FLOOR) 이상이고, eslint-config-next·잠금 파일과 같은 고정 판이다', () => {
  const pkg = JSON.parse(read('package.json'))
  const lock = JSON.parse(read('package-lock.json'))
  const next = pkg.dependencies.next
  assert.match(next, /^\d+\.\d+\.\d+$/, `next 는 정확한 판으로 고정한다(${next})`)
  assert.ok(gte(next, NEXT_FLOOR), `next ${next} 는 ${NEXT_FLOOR} 미만 — 알려진 보안 공지가 남아 있다(위 주석)`)
  assert.equal(pkg.devDependencies['eslint-config-next'], next, 'eslint-config-next 는 next 와 같은 판')
  assert.equal(lock.packages['node_modules/next'].version, next, '잠금 파일의 next 가 package.json 과 같다')
  assert.equal(lock.packages['node_modules/eslint-config-next'].version, next)
  assert.equal(lock.packages['node_modules/@next/eslint-plugin-next'].version, next)
  // 찍어내는 사이트 템플릿도 같은 판 — 취약한 next 로 사이트를 만들지 않는다(stamp-pages 시험이 저장소와 같은지도 본다)
  assert.equal(JSON.parse(read('factory/stamp/site-template/package.json')).dependencies.next, next, '사이트 템플릿 next 가 저장소와 같다')
  // 잠금 파일에 next 가 바닥 판 미만으로 남은 곳(중첩 사본)이 없다
  for (const [k, v] of Object.entries(lock.packages)) if (/(^|\/)node_modules\/next$/.test(k)) assert.ok(gte(v.version, NEXT_FLOOR), `${k} ${v.version}`)
})

// 서버 컴포넌트(맨 위에 "use client" 없음)가 "use client" 모듈에서 값(상수)을 가져오면 RSC 에서는 값이 아니라 클라이언트 참조가 와서 펼쳐도 속성이 안 붙는다.
// 컴포넌트·훅(대문자 또는 use 로 시작)은 참조로 와도 쓸 수 있으므로, 여기서는 소문자로 시작하는 비훅 이름(상수·도우미)만 막는다.
const isClient = (src) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(src)
const importsOf = (src) => [...src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)].map((m) => ({ names: m[1].split(',').map((s) => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean), from: m[2] }))

test('REL11-4: 서버 부품(블록·조각)은 "use client" 모듈에서 상수·도우미 값을 가져오지 않는다 — 쿠키 설정 링크의 data-consent-open 이 서버 HTML 에 나간다', () => {
  const dir = join(root, 'registry', 'factory', 'blocks')
  const files = []
  for (const kind of readdirSync(dir, { withFileTypes: true })) {
    if (!kind.isDirectory() || kind.name === '_compiled') continue
    for (const f of readdirSync(join(dir, kind.name))) if (f.endsWith('.tsx')) files.push(join(kind.name, f))
  }
  const bad = []
  let serverFiles = 0
  for (const rel of files) {
    const src = readFileSync(join(dir, rel), 'utf8')
    if (isClient(src)) continue
    serverFiles++
    for (const { names, from } of importsOf(src)) {
      if (!from.startsWith('../_shared/') && !from.startsWith('./')) continue
      const target = join(dir, dirname(rel), from + '.tsx')
      if (!existsSync(target) || !isClient(readFileSync(target, 'utf8'))) continue
      for (const n of names) if (/^[a-z]/.test(n) && !/^use[A-Z]/.test(n)) bad.push(`${rel} ← ${from} 의 ${n}`)
    }
  }
  assert.ok(serverFiles > 20, `서버 부품이 ${serverFiles}개뿐 — 검사가 파일을 못 읽는다`)
  assert.deepEqual(bad, [])
})

test('REL11-4: consentOpenAttrs 는 "use client" 가 아닌 조각에 있고 푸터가 거기서 가져온다 — 브라우저 쪽 훅은 그대로 consent-open 에 있다', () => {
  const dir = join(root, 'registry', 'factory', 'blocks')
  const attrs = join(dir, '_shared', 'consent-open-attrs.tsx')
  assert.ok(existsSync(attrs), '_shared/consent-open-attrs.tsx 가 없다')
  const a = readFileSync(attrs, 'utf8')
  assert.ok(!isClient(a), 'consent-open-attrs 는 "use client" 가 없어야 한다')
  assert.match(a, /export const consentOpenAttrs = \{ "data-consent-open": "" \} as const/)
  assert.match(read('registry/factory/blocks/footer/product-legal.tsx'), /import \{ consentOpenAttrs \} from "\.\.\/_shared\/consent-open-attrs"/)
  const c = readFileSync(join(dir, '_shared', 'consent-open.tsx'), 'utf8')
  assert.ok(isClient(c))
  assert.match(c, /export function useConsentOpener/)
  assert.doesNotMatch(c, /export const consentOpenAttrs/, '값은 한 곳에만 둔다')
})

// next 16.3.6 의 CSS 파서는 따옴표 없는 숫자 속성 값(`[data-slide=0]` — 규격상 식별자가 아니다)을 거절한다: globals.css 전체가 「Parsing CSS source code failed」로 죽어
// 모든 쪽이 500 이다. 숫자 값은 따옴표로 감싼다 — 컴파일본의 큰따옴표 문자열 안에서는 이스케이프가 되어 후보 추출이 어긋나므로 작은따옴표를 쓴다.
test('REL11-1b: 모양 원천(base.css)·컴파일본에 따옴표 없는 숫자 속성 선택자(`[data-x=0]`)가 없다 — next 16.3.6 CSS 파서가 거절한다', () => {
  const UNQUOTED = /\[(?:data|aria)-[\w-]+[~|^$*]?=[0-9]/g
  const found = []
  for (const m of read('registry/factory/styles/base.css').matchAll(UNQUOTED)) found.push(`base.css: ${m[0]}`)
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.tsx?$/.test(e.name)) for (const m of readFileSync(p, 'utf8').matchAll(UNQUOTED)) found.push(`${p.slice(root.length + 1)}: ${m[0]}`)
    }
  }
  walk(join(root, 'registry', 'factory', 'blocks', '_compiled'))
  assert.deepEqual(found, [])
  // 양성 대조: 이 검사가 옛 모양은 잡고 새 모양은 통과시킨다
  assert.equal([...'[&_.vts-art[data-slide=0]_.vts-scrim]'.matchAll(UNQUOTED)].length, 1)
  assert.equal([...`[&_.vts-art[data-slide='0']_.vts-scrim]`.matchAll(UNQUOTED)].length, 0)
})
