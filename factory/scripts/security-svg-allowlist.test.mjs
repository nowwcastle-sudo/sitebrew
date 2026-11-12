// 보안 수정 F — 표지(로고·파비콘) SVG 허용 목록(daybreak svg-smil-href-bypasses-favicon-sanitizer).
//   예전 거부 목록(`<script`·`on*=`·`href=`)은 `<animate attributeName="href">`·`<set>`·`<a>`·`<use>`·`<style>` 을 못 막아 악성 로고의
//   활성 마크업이 app/icon.svg 로 그대로 나갔다. 이제 `svg-allowlist` 한 곳이 허용한 요소·속성만 통과시킨다 — 공장(markSvg)과 소비자(parseMark)가 같은 검사를 쓴다.
//   「재현」은 수정 전 코드에서 실패하고, 「정상 선례」(내장 도형 표지 셋·currentColor 로고)는 수정 전과 출력이 글자 단위로 같아야 한다(GOLDEN = 수정 전 모듈의 sha256).
//   가볍다(Chrome·네트워크 없음).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/security-svg-allowlist.test.mjs
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectMarkSvg } from '../../registry/factory/ax/svg-allowlist.ts'
import { markSvg } from '../stamp/site-files.mjs'
import { tsLoader } from './gen-favicons.mjs'

const kit = await tsLoader('security-svg-allowlist')('ax/favicon-kit.ts')
const TMP = mkdtempSync(join(tmpdir(), 'wf-secsvg-'))
after(() => rmSync(TMP, { recursive: true, force: true }))
const HANGUL = /[가-힣]/
const sha = (s) => createHash('sha256').update(s).digest('hex')
const COLORS = { color: '#112233', darkColor: '#eeeeee', background: '#ffffff' }
const NS = 'xmlns="http://www.w3.org/2000/svg"'
const wrapSvg = (inner, root = `${NS} viewBox="0 0 10 10"`) => `<svg ${root}>${inner}</svg>`
const PATH = '<path fill="currentColor" d="M0 0h10v10z"/>'

let n = 0
function logoFile(svg) {
  const dir = join(TMP, `d${++n}`)
  mkdirSync(dir, { recursive: true })
  const f = join(dir, 'logo.svg')
  writeFileSync(f, svg)
  return f
}
function quiet(fn) {
  const warn = console.warn, seen = []
  console.warn = (...a) => seen.push(a.join(' '))
  try { return [fn(), seen] } finally { console.warn = warn }
}

// ── 재현: 목록 밖 마크업은 거절하고 도형 표지로 대체한다 ─────────────────────────────────────────────
// [이름, 입력 SVG, 수정 전 거부 목록이 이미 잡았는가]
const ATTACKS = [
  ['SMIL animate 가 링크 주소를 바꾼다(daybreak 재현)', wrapSvg(`<a href="#x"><animate attributeName="href" values="javascript:alert(1)" begin="0s" dur="1s" fill="freeze"/>${PATH}</a>`), false],
  ['SMIL animate 가 xlink:href 를 바꾼다', wrapSvg(`<a><animate attributeName="xlink:href" to="javascript:alert(1)"/>${PATH}</a>`), false],
  ['SMIL set 이 링크 주소를 바꾼다', wrapSvg(`<a><set attributeName="href" to="javascript:alert(1)"/>${PATH}</a>`), false],
  ['animateTransform·animateMotion', wrapSvg(`<path fill="currentColor" d="M0 0h10v10z"><animateTransform attributeName="transform" type="rotate" to="360" dur="1s"/></path>`), false],
  ['<a> 요소(링크 없이도 거절)', wrapSvg(`<a>${PATH}</a>`), false],
  ['<a href> 안쪽 앵커', wrapSvg(`<a href="#top">${PATH}</a>`), false],
  ['<a href="https://…"> 바깥 링크', wrapSvg(`<a href="https://evil.example/x">${PATH}</a>`), true],
  ['<use href="#id">(정상 로고에서도 쓰이지만 허용 목록 밖)', wrapSvg(`<defs><path id="p" d="M0 0h10v10z"/></defs><use href="#p" fill="currentColor"/>`), false],
  ['<use xlink:href="#id">', wrapSvg(`<defs><path id="p" d="M0 0h10v10z"/></defs><use xlink:href="#p" fill="currentColor"/>`), false],
  ['<image href> 바깥 그림', wrapSvg(`<image href="https://evil.example/a.png" fill="currentColor"/>`), true],
  ['<image href="data:…">', wrapSvg(`<image href="data:image/svg+xml;base64,PHN2Zy8+" fill="currentColor"/>`), false],
  ['<foreignObject>', wrapSvg(`<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>${PATH}`), true],
  ['<style> 요소', wrapSvg(`<style>path{fill:url(https://evil.example/x)}</style>${PATH}`), false],
  ['style 속성', wrapSvg(`<path fill="currentColor" style="fill:red" d="M0 0h10v10z"/>`), false],
  ['class 속성(스타일 없이는 쓸모 없고 목록 밖)', wrapSvg(`<path class="a" fill="currentColor" d="M0 0h10v10z"/>`), false],
  ['<script>', wrapSvg(`<script>alert(1)</script>${PATH}`), true],
  ['<script> 대문자', wrapSvg(`<SCRIPT>alert(1)</SCRIPT>${PATH}`), true],
  ['루트 onload', wrapSvg(PATH, `${NS} viewBox="0 0 10 10" onload="alert(1)"`), true],
  ['요소 onclick', wrapSvg(`<path onclick="alert(1)" fill="currentColor" d="M0 0h10v10z"/>`), true],
  ['onmouseover 줄바꿈 사이', wrapSvg(`<path\nonmouseover\n=\n"alert(1)" fill="currentColor" d="M0 0h10v10z"/>`), true],
  ['url(javascript:) 칠', wrapSvg(`<path fill="url(javascript:alert(1))" d="M0 0h10v10z"/><path fill="currentColor" d="M0 0"/>`), false],
  ['url(data:) 칠', wrapSvg(`<path fill="url(data:image/svg+xml;base64,PHN2Zy8+)" d="M0 0h10v10z"/><path fill="currentColor" d="M0 0"/>`), false],
  ['url(바깥 주소) 칠', wrapSvg(`<path fill="url(https://evil.example/a.svg#g)" d="M0 0h10v10z"/><path fill="currentColor" d="M0 0"/>`), false],
  ['url(#id) 가 아닌 clip-path', wrapSvg(`<path clip-path="url(//evil.example/c.svg#c)" fill="currentColor" d="M0 0h10v10z"/>`), false],
  ['URL ( 대문자·공백 변형', wrapSvg(`<path fill="URL (https://evil.example/a.svg#g)" d="M0 0h10v10z"/><path fill="currentColor" d="M0 0"/>`), false],
  ['엔티티로 숨긴 javascript:', wrapSvg(`<path fill="&#106;avascript:alert(1)" d="M0 0h10v10z"/><path fill="currentColor" d="M0 0"/>`), false],
  ['따옴표 없는 속성값', wrapSvg(`<path fill=currentColor d="M0 0h10v10z"/>`), false],
  ['이름공간 접두 요소 svg:animate', wrapSvg(`<svg:animate attributeName="href" to="javascript:alert(1)"/>${PATH}`), false],
  ['DOCTYPE·ENTITY', `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg ${NS} viewBox="0 0 10 10">${PATH}</svg>`, false],
  ['CDATA', wrapSvg(`<![CDATA[<script>alert(1)</script>]]>${PATH}`), false],
  ['글 노드에 숨긴 마크업', wrapSvg(`<title>a</title>text${PATH}`), false],
  ['루트 뒤 두 번째 <svg>', `${wrapSvg(PATH)}<svg ${NS}><script>alert(1)</script></svg>`, false],
  ['루트가 <svg> 아님', `<g ${NS}>${PATH}</g>`, false],
  ['닫는 태그 짝이 안 맞음', wrapSvg(`<g><path fill="currentColor" d="M0 0"/></svg>`), false],
]

for (const [name, svg, oldCaught] of ATTACKS) {
  test(`재현: ${name} — 허용 목록이 거절하고 markSvg 는 도형 표지로 대체한다(빌드는 계속)`, () => {
    const r = inspectMarkSvg(svg)
    assert.equal(r.ok, false, '허용 목록 검사가 거절한다')
    assert.ok(r.reason, '거절 이유가 있다')
    assert.throws(() => kit.faviconSet(svg, COLORS), (e) => HANGUL.test(e.message), 'faviconSet 이 한국어 메시지로 던진다')
    const [mark, warned] = quiet(() => markSvg('상호', { logoPath: logoFile(svg) }))
    assert.equal(mark.source, 'shape', '도형 표지로 대체')
    assert.ok(!/animate|<set|<a[\s>]|<use|foreignObject|<style|javascript|onload|onclick/i.test(mark.svg), '결과 SVG 에 활성 마크업이 없다')
    assert.equal(warned.length, 1, '한 줄 알림')
    assert.ok(!warned[0].includes('\n'))
    void oldCaught
  })
}

test('재현: 수정 전에는 못 잡던 활성 요소가 있었다(표가 거짓 양성 없이 재현을 담고 있다)', () => {
  assert.ok(ATTACKS.filter(([, , caught]) => !caught).length >= 20, '수정 전 거부 목록을 빠져나가던 입력이 대부분')
})

// ── 정상 선례: 수정 전과 출력이 글자 단위로 같다 ────────────────────────────────────────────────────
const CIRCLE = `<svg ${NS} viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>`
const RICH = `<?xml version="1.0" encoding="UTF-8"?>
<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="달빛 베이커리">
  <!-- Generator: 로고 도구 -->
  <title>달빛 베이커리</title>
  <desc>로고 표지</desc>
  <defs>
    <linearGradient id="g1" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="100%" stop-color="#000"/></linearGradient>
    <clipPath id="c1"><rect x="2" y="2" width="60" height="60" rx="8"/></clipPath>
    <mask id="m1"><circle cx="32" cy="32" r="20" fill="#fff"/></mask>
  </defs>
  <g transform="translate(1 1) rotate(0)" clip-path="url(#c1)" opacity=".9">
    <path fill="currentColor" fill-rule="evenodd" fill-opacity="0.9" d="M14 6h36a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z" stroke="url(#g1)" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="32" cy="32" rx="10" ry="6" fill="none" stroke="currentColor" mask="url(#m1)"/>
    <polygon points="10,10 20,10 15,20" fill="currentColor"/><polyline points="1,1 2,2" fill="none" stroke="currentColor"/><line x1="0" y1="0" x2="5" y2="5" stroke="currentColor"/>
  </g>
</svg>
`
// 수정 전 모듈(origin/fix/sec-c-local-paths)로 구한 sha256 — 표지 셋·두 로고의 markSvg 결과와 faviconSet 결과(색 #112233·#eeeeee·#ffffff).
const GOLDEN = {
  shapes: {
    '가': '57595fe43f49875f87adc8c7ae38954acda09172c8c08d4b1a96972cef83b7fe',
    '나': '57595fe43f49875f87adc8c7ae38954acda09172c8c08d4b1a96972cef83b7fe',
    '다': '57595fe43f49875f87adc8c7ae38954acda09172c8c08d4b1a96972cef83b7fe',
    '라': 'd5fa317e514931edd702f36ca18e7770096915493e285b4da87accd712712b80',
    '마': '57595fe43f49875f87adc8c7ae38954acda09172c8c08d4b1a96972cef83b7fe',
    '바': 'd5fa317e514931edd702f36ca18e7770096915493e285b4da87accd712712b80',
    '사': '2003ba26424fb9847fd2d7a92d53dc9dc20df242bc64f695a93bcf19f8510c7f',
    '아': '57595fe43f49875f87adc8c7ae38954acda09172c8c08d4b1a96972cef83b7fe',
    '자': '57595fe43f49875f87adc8c7ae38954acda09172c8c08d4b1a96972cef83b7fe',
    '차': 'd5fa317e514931edd702f36ca18e7770096915493e285b4da87accd712712b80',
    '카': '2003ba26424fb9847fd2d7a92d53dc9dc20df242bc64f695a93bcf19f8510c7f',
    '타': 'd5fa317e514931edd702f36ca18e7770096915493e285b4da87accd712712b80',
    '파': '2003ba26424fb9847fd2d7a92d53dc9dc20df242bc64f695a93bcf19f8510c7f',
    '하': 'd5fa317e514931edd702f36ca18e7770096915493e285b4da87accd712712b80'
  },
  markCircle: '544b5d747817e41d9459ee642b0313f6663991dd6755e1a3bdafbc97886b00fa',
  markRich: '79a0380c9b64bcf264d4f666b40bef56fb6a97cbbbbdaff195947925941b2682',
  kitCircle: '42d789a975ab293f384c645963bbeddaa836c88c05acd573317e37ec9ce0998b',
  kitRich: '14f02c078a20a17eea29bba551920e3c0cfa912293137ca5829fa1a704184e7d'
}
const SHAPE_NAMES = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하']

function digests() {
  const shapes = {}
  for (const name of SHAPE_NAMES) shapes[name] = sha(markSvg(name).svg)
  return {
    shapes,
    markCircle: sha(markSvg('x', { logoPath: logoFile(CIRCLE) }).svg),
    markRich: sha(markSvg('x', { logoPath: logoFile(RICH) }).svg),
    kitCircle: sha(JSON.stringify(kit.faviconSet(CIRCLE, COLORS))),
    kitRich: sha(JSON.stringify(kit.faviconSet(RICH, COLORS))),
  }
}

test('정상 선례: 내장 도형 표지 셋이 모두 나오고 faviconSet 이 받는다(수정 전과 같은 출력)', () => {
  const d = digests()
  const kinds = new Set(Object.values(d.shapes))
  assert.equal(kinds.size, 3, '도형 표지 3종이 모두 나온다(이름 14개로 훑음)')
  assert.deepEqual(d.shapes, GOLDEN.shapes)
  for (const name of SHAPE_NAMES) assert.equal(markSvg(name).source, 'shape')
  for (const name of SHAPE_NAMES) {
    const svg = markSvg(name).svg
    assert.equal(inspectMarkSvg(svg).ok, true, '내장 표지는 허용 목록을 통과한다')
    assert.ok(kit.faviconSet(svg, COLORS).length === 6)
  }
})

test('정상 선례: currentColor 로고 둘(단순 원·그러데이션·클립·마스크·제목 든 로고)은 로고로 쓰이고 출력이 수정 전과 글자 단위로 같다', () => {
  for (const [svg, mark, kitKey] of [[CIRCLE, 'markCircle', 'kitCircle'], [RICH, 'markRich', 'kitRich']]) {
    assert.equal(inspectMarkSvg(svg).ok, true)
    const [m, warned] = quiet(() => markSvg('x', { logoPath: logoFile(svg) }))
    assert.equal(m.source, 'brand-logo')
    assert.equal(m.svg, svg, '입력 글자를 그대로 돌려준다')
    assert.equal(warned.length, 0, '알림 없음')
    assert.equal(sha(m.svg), GOLDEN[mark])
    assert.equal(sha(JSON.stringify(kit.faviconSet(svg, COLORS))), GOLDEN[kitKey])
  }
})

test('정상 선례: 수정 전에도 도형 표지로 가던 로고(currentColor 없음·viewBox 없음)는 알림 없이 그대로 도형이다', () => {
  const noColor = `<svg ${NS} viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#000"/></svg>`
  const noBox = `<svg ${NS}><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>`
  for (const svg of [noColor, noBox]) {
    const [m] = quiet(() => markSvg('x', { logoPath: logoFile(svg) }))
    assert.equal(m.source, 'shape')
  }
  assert.throws(() => kit.faviconSet(noColor, COLORS), /currentColor/)
  assert.throws(() => kit.faviconSet(noBox, COLORS), /viewBox/)
})

test('선택: 정상 로고에 쓰이던 <use href="#…"> 는 허용 목록 밖이라 도형 표지가 된다(계획 F 의 알려진 비용)', () => {
  const svg = wrapSvg(`<defs><path id="p" d="M0 0h10v10z"/></defs><use href="#p" fill="currentColor"/>`)
  const [m, warned] = quiet(() => markSvg('x', { logoPath: logoFile(svg) }))
  assert.equal(m.source, 'shape')
  assert.match(warned[0], /<use>/)
})

test('경계: 요소·속성 허용 목록 전체가 한 로고에서 통과하고 하나만 어겨도 거절된다', () => {
  assert.equal(inspectMarkSvg(RICH).ok, true)
  assert.equal(inspectMarkSvg(RICH.replace('<ellipse', '<ellipse data-x="1"')).ok, false, '허용 목록에 없는 속성')
  assert.equal(inspectMarkSvg(RICH.replace('<ellipse', '<ellipse onfocus="a()"')).ok, false)
  assert.equal(inspectMarkSvg(RICH.replace('<line ', '<symbol ')).ok, false, '허용 목록에 없는 요소')
  const ok = inspectMarkSvg(CIRCLE)
  assert.deepEqual(ok, { ok: true, viewBox: '0 0 10 10', inner: '<circle cx="5" cy="5" r="4" fill="currentColor"/>' })
})
