// FV1 Task 5.8 — 떠 있는 행동 3·공지 3·스토어 배지·신뢰 서명·내보내기 조각(레인 SECTIONS).
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/sections-new.test.mjs
// 방법: 블록 원천(.tsx)을 typescript 로 .tmp 에 옮겨 예시 콘텐츠(.fixture.ts)로 정적 렌더(react-dom/server)한 뒤 마크업을 본다 — 브라우저 없음.
// 모션 장면·기법은 아무것도 안 하는 가짜로 바꾼다. 클릭·키보드·화면 배치(Chrome)는 갤러리 관문(blocks:gates·blocks:a11y — Task 5.17 몫)이 잰다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { BLOCK_KINDS, BlockMeta, blockName, blockProblems, loadBlocks, loadShared } from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'sections-new-test')
const BLK = join(root, 'registry', 'factory', 'blocks')
const rd = (rel) => readFileSync(join(BLK, rel), 'utf8')

// ── 정적 렌더 도구 ─────────────────────────────────────────────────────────────────────────────────
const STUBS = {
  [join(root, 'registry', 'factory', 'motion', 'use-gsap-scene.ts')]: 'export function useGsapScene() {}\n',
  [join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts')]: 'export function rise() {}\n',
}
const loaded = new Map()
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let outputText
  if (STUBS[abs]) outputText = STUBS[abs]
  else ({ outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }))
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const load = (rel) => import(pathToFileURL(transpile(join(root, rel))).href)
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement
const comp = (kind, variant) => `${kind}-${variant}`.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')
/** 블록 하나를 예시 콘텐츠(fixture|fixtureMax|fixtureMin)로 서버 렌더한 마크업 */
async function renderFixtureHtml(path, fx = 'fixture', extra = {}) {
  const [kind, variant] = path.split('/')
  const mod = await load(`registry/factory/blocks/${path}.tsx`)
  const f = await load(`registry/factory/blocks/${path}.fixture.ts`)
  return renderToStaticMarkup(h(mod[comp(kind, variant)], { ...f[fx], ...extra }))
}
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ')
const jsonLdOf = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&')))

const FLOATING = ['quick-menu-rail', 'chat-launcher', 'call-bar']
const NEW_BLOCKS = [
  ...FLOATING.map((v) => `floating-action/${v}`),
  'announcement/notice-ticker', 'announcement/popup-today', 'announcement/update-toast',
  'final-cta/store-badges', 'trust/author-byline',
]

// ── 떠 있는 행동 ──────────────────────────────────────────────────────────────────────────────────
test('floating-action 은 kind 표에 있고 변형 3개', () => {
  assert.ok(BLOCK_KINDS.includes('floating-action'))
  assert.equal(readdirSync(join(BLK, 'floating-action')).filter((f) => f.endsWith('.block.json')).length, 3)
  assert.deepEqual(readdirSync(join(BLK, 'floating-action')).filter((f) => f.endsWith('.block.json')).map((f) => f.replace('.block.json', '')).sort(), [...FLOATING].sort())
})

test('floating-action 셋은 하단 탭이 있는 쪽에서 안 그리고, 초점이 가려지지 않게 자리를 잰다', () => {
  const kit = rd('_shared/floating-kit.tsx')
  assert.match(kit, /bottom-tab-/, '하단 탭 블록(data-block^=bottom-tab-)을 찾는다')
  assert.match(kit, /scrollPaddingBottom/, 'scroll-padding-bottom 으로 초점 가림 방지(WCAG 2.4.11)')
  for (const v of FLOATING) {
    const src = rd(`floating-action/${v}.tsx`)
    assert.match(src, /useFloatingDrawn\(/, `${v}: 하단 탭이 있으면 안 그린다`)
    assert.match(src, /useFloatingSpace\(/, `${v}: 고정 줄이 가리는 만큼 scroll-padding 을 준다`)
    assert.doesNotMatch(src, /<script|document\.write|appendChild\(|createElement\(['"]script/, `${v}: 위젯 스크립트를 넣지 않는다`)
    assert.doesNotMatch(src, /^import .* from ['"]https?:/m, `${v}: 바깥 주소를 부르지 않는다`)
  }
})

test('quick-menu-rail: 전화·상담 링크와 「맨 위로」 단추, 이름 있는 nav', async () => {
  const html = await renderFixtureHtml('floating-action/quick-menu-rail')
  assert.match(html, /data-block="floating-action-quick-menu-rail"/)
  assert.match(html, /<nav[^>]*aria-label="[^"]+"/)
  assert.match(html, /href="tel:/)
  assert.match(html, /<button[^>]*data-top[^>]*>/)
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 0)
})

test('chat-launcher: 닫혀 있는 단추 + 메신저·메일 링크 목록(위젯 스크립트 없음), 펼침 상태가 aria-expanded 로 말해진다', async () => {
  const html = await renderFixtureHtml('floating-action/chat-launcher')
  assert.match(html, /<button[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+"/)
  assert.match(html, /href="https:\/\/example\.com\/channel"/)
  assert.match(html, /href="mailto:/)
  assert.doesNotMatch(html, /<script/)
})

test('call-bar: tel 링크가 주 행동이고, 좁은 화면에서만 아래 고정(넓은 화면은 흐름 안 줄)', async () => {
  const html = await renderFixtureHtml('floating-action/call-bar')
  assert.match(html, /<a[^>]*href="tel:\+?\d+"/)
  assert.match(html, /data-block="floating-action-call-bar"/)
  const css = readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8')
  const bar = css.match(/\.cn-block-fa-callbar \{\s*@apply ([^;]*);/)?.[1] ?? ''
  assert.match(bar, /max-md:fixed/, '375 에서만 fixed')
  assert.doesNotMatch(bar.replace(/max-md:fixed/g, ''), /(^|\s)fixed(\s|$)/, '넓은 화면 기본은 fixed 가 아니다')
})

// ── 공지 ──────────────────────────────────────────────────────────────────────────────────────────
test('notice-ticker 는 멈춤 단추와 동작 줄이기 목록이 있다', () => {
  const src = rd('announcement/notice-ticker.tsx')
  assert.match(src, /LoopPause|data-wf-user-paused/); assert.match(src, /reducedMotion|prefers-reduced-motion|reducedMotion/)
})

test('notice-ticker: 공지가 모두 마크업에 있고(읽기 도구·동작 줄이기 목록), 둘 이상이면 멈춤 단추, 하나면 없다', async () => {
  const html = await renderFixtureHtml('announcement/notice-ticker')
  assert.ok((html.match(/<li[\s>]/g) ?? []).length >= 3, '공지 3개 이상')
  assert.match(html, /data-wf-loop-pause/)
  assert.match(html, /aria-live="off"/, '자동으로 넘어가는 동안 낭독하지 않는다')
  const one = await renderFixtureHtml('announcement/notice-ticker', 'fixtureMin')
  assert.equal((one.match(/<li[\s>]/g) ?? []).length, 1)
  assert.doesNotMatch(one, /data-wf-loop-pause/, '넘길 것이 없으면 멈춤 단추도 없다')
})

test('notice-ticker: 마우스를 올리거나 초점이 들어오면 넘김을 멈추고, 자동 넘김은 5초 이상', () => {
  const src = rd('announcement/notice-ticker.tsx')
  assert.match(src, /onFocus|onFocusCapture/); assert.match(src, /onMouseEnter|onPointerEnter/)
  const meta = JSON.parse(rd('announcement/notice-ticker.block.json'))
  assert.ok(meta.notes.includes('5초'))
})

test('popup-today 는 기기 저장만 쓰고 서버로 보내지 않는다', () => {
  const src = rd('announcement/popup-today.tsx')
  assert.match(src, /localStorage/); assert.doesNotMatch(src, /fetch\(/)
})

test('popup-today: 닫기 단추가 처음 초점이고, 비모달(aria-modal 없음)·Esc 로 닫히며, 닫기·오늘 하루 보지 않기 둘 다 있다', async () => {
  const src = rd('announcement/popup-today.tsx')
  assert.match(src, /Escape/); assert.match(src, /\.focus\(/); assert.doesNotMatch(src, /aria-modal|showModal\(/)
  const html = await renderFixtureHtml('announcement/popup-today')
  assert.match(html, /role="dialog"/); assert.doesNotMatch(html, /aria-modal/)
  // DOM 순서: 닫기 단추가 팝업 안 첫 번째 눌리는 것
  const inner = html.slice(html.indexOf('role="dialog"'))
  const first = inner.match(/<(button|a)\b[^>]*>/)
  assert.match(first?.[0] ?? '', /data-popup-close/)
  assert.match(html, /data-popup-today/)
  assert.doesNotMatch(src, /localStorage\.setItem\([^)]*fetch/)
})

test('update-toast: 블록 이름 block-announcement-update-toast, role=status, pwa 원형', () => {
  assert.equal(blockName('announcement', 'update-toast'), 'block-announcement-update-toast')
  const src = rd('announcement/update-toast.tsx')
  assert.match(src, /role="status"/)
  const meta = JSON.parse(rd('announcement/update-toast.block.json'))
  assert.ok(meta.archetypes.includes('pwa'))
})

test('update-toast: 새 판이 있을 때만 그리고, [지금 새로 고침][나중에]가 대등하게 나란히 있다', async () => {
  const on = await renderFixtureHtml('announcement/update-toast')
  assert.match(on, /role="status"/); assert.match(on, /data-choice="primary"/); assert.match(on, /data-choice="decline"/)
  const off = await renderFixtureHtml('announcement/update-toast', 'fixture', { available: false })
  assert.doesNotMatch(off, /data-choice/)
})

// ── 스토어 배지 ────────────────────────────────────────────────────────────────────────────────────
test('store-badges: 글자 단추뿐 — 공식 배지 그림을 저장소에 넣지 않는다', async () => {
  const html = await renderFixtureHtml('final-cta/store-badges')
  assert.ok((html.match(/data-store="/g) ?? []).length >= 2)
  assert.doesNotMatch(html, /<img[\s>]/)
  const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n')
  assert.deepEqual(files.filter((f) => /(app-?store|google-?play|web-?store|chrome-?web).*(badge|button)|badge.*(app-?store|google-?play)/i.test(f) && /\.(svg|png|webp|jpe?g|avif)$/i.test(f)), [])
  // (public export: the maintainers' licence review that held the three brand-rule links is not shipped, so that check is left out)
})

// ── 신뢰 서명 ──────────────────────────────────────────────────────────────────────────────────────
test('author-byline 은 JSON-LD author 와 화면 글자가 같다', async () => {
  const { jsonLdVisibleIssues } = await load('registry/factory/ax/geo-entity.ts')
  const html = await renderFixtureHtml('trust/author-byline')
  const objs = jsonLdOf(html)
  assert.ok(objs.length >= 1, 'JSON-LD 가 있다')
  assert.equal(objs[0]['@type'], 'WebPage')
  assert.equal(objs[0].author['@type'], 'Person'); assert.ok(objs[0].reviewedBy?.name, '검수자')
  assert.deepEqual(jsonLdVisibleIssues(objs, textOf(html)), [])
  // 음성 대조: 화면 글자에서 작성자 이름을 지우면 잡는다
  const name = objs[0].author.name
  assert.ok(jsonLdVisibleIssues(objs, textOf(html).split(name).join('')).length > 0)
})

test('author-byline: 갱신일은 <time> 하나이고 JSON-LD dateModified 와 같다, 출처 목록은 링크', async () => {
  const html = await renderFixtureHtml('trust/author-byline')
  const objs = jsonLdOf(html)
  const times = [...html.matchAll(/<time[^>]*datetime="([^"]+)"/gi)].map((m) => m[1])
  assert.deepEqual(times, [objs[0].dateModified])
  assert.match(html, /data-sources/)
  assert.ok((html.match(/<a[^>]*href="https?:/g) ?? []).length >= 2)
  const off = await renderFixtureHtml('trust/author-byline', 'fixture', { jsonLd: false })
  assert.doesNotMatch(off, /application\/ld\+json/)
})

// ── 내보내기 조각 ──────────────────────────────────────────────────────────────────────────────────
test('export-actions: CSV 는 따옴표·줄바꿈을 지키고 스프레드시트 수식 주입을 막으며 한글 엑셀용 BOM 이 붙는다', async () => {
  const { toCsv, toTsv } = await load('registry/factory/blocks/_shared/export-actions.tsx')
  const cols = [{ id: 'a', label: '이름' }, { id: 'b', label: '금액', kind: 'numeric' }]
  const rows = [
    { id: '1', cells: { a: '김, "예시"', b: 1200 } },
    { id: '2', cells: { a: '=SUM(A1:A2)', b: null } },
    { id: '3', cells: { a: '줄\n바꿈', b: 3 } },
  ]
  const csv = toCsv(cols, rows)
  assert.ok(csv.startsWith('﻿'))
  const lines = csv.slice(1).split('\r\n')
  assert.equal(lines[0], '이름,금액')
  assert.equal(lines[1], '"김, ""예시""",1200')
  assert.equal(lines[2], "'=SUM(A1:A2),")
  assert.equal(lines.length, 4)
  assert.equal(lines[3], '"줄\n바꿈",3', '줄바꿈이 든 칸은 따옴표로 감싼다')
  assert.equal(toTsv(cols, rows.slice(0, 1)), '이름\t금액\n김, "예시"\t1200')
})

test('data-table 세 변형(admin-list·bulk-select·compact)에 내보내기 조각을 달고, 카피가 있을 때만 그린다', async () => {
  for (const v of ['admin-list', 'bulk-select', 'compact']) {
    const src = rd(`data-table/${v}.tsx`)
    assert.match(src, /from "\.\.\/_shared\/export-actions"/, v)
    const base = await renderFixtureHtml(`data-table/${v}`)
    assert.doesNotMatch(base, /data-export/, `${v}: export 카피가 없으면 예전 그대로`)
    const max = await renderFixtureHtml(`data-table/${v}`, 'fixtureMax')
    assert.match(max, /data-export-csv/, `${v}: fixtureMax 에서 CSV 단추`)
    assert.match(max, /data-copy-button/, `${v}: 표 복사 단추`)
  }
  assert.equal(readFileSync(join(BLK, 'data-table', 'record-panel.tsx'), 'utf8').includes('export-actions'), false, 'record-panel 은 표가 아니라 달지 않는다')
})

// ── 메타·규약 ──────────────────────────────────────────────────────────────────────────────────────
test('새 블록 8개: 메타 통과 · 규약 검사(blockProblems) 0 · 원형은 계획에 적은 것만 · landing 은 병합 뒤 · 대담 표시 없음', () => {
  const PLAN = {
    'floating-action/quick-menu-rail': ['public', 'brand', 'dashboard', 'local', 'portfolio'],
    'floating-action/chat-launcher': ['commerce', 'detail', 'public', 'local', 'saas', 'brand', 'dashboard', 'portfolio'],
    'floating-action/call-bar': ['public', 'brand', 'local'],
    'announcement/notice-ticker': ['dashboard', 'public', 'commerce', 'local', 'portfolio', 'saas'],
    'announcement/popup-today': ['local', 'commerce', 'brand', 'portfolio'] /* 5.11: public 은 뺐다 — 공지 한 줄(제목)로 팝업의 본문 칸을 못 채운다(binding-audit) */,
    'announcement/update-toast': ['pwa'],
    'final-cta/store-badges': ['pwa', 'saas', 'dashboard', 'portfolio', 'public'],
    'trust/author-byline': ['brand', 'public', 'detail', 'portfolio', 'local'],
  }
  assert.deepEqual(Object.keys(PLAN).sort(), [...NEW_BLOCKS].sort())
  const all = loadBlocks(root)
  const mine = all.filter((b) => NEW_BLOCKS.includes(`${b.kind}/${b.variant}`))
  assert.equal(mine.length, 8)
  const shared = new Set(loadShared(root).map((s) => s.name))
  for (const b of mine) {
    const at = `${b.kind}/${b.variant}`
    assert.ok(b.meta.success, `${at}: ${b.meta.success ? '' : JSON.stringify(b.meta.error.issues)}`)
    assert.deepEqual([...b.meta.data.archetypes].sort(), [...PLAN[at]].sort(), at)
    assert.equal(b.meta.data.boldness, undefined, `${at}: 대담 장면이 아니다`)
    assert.ok(!b.meta.data.archetypes.includes('landing'))
  }
  const problems = blockProblems(mine, { minVariants: 1, shared, sharedSources: loadShared(root).filter((s) => ['floating-kit', 'export-actions'].includes(s.name)) })
  assert.deepEqual(problems, [])
  assert.ok(BlockMeta)
})

// ── GATES2: 떠 있는 알림은 375px 에서 화면 높이의 35% 를 넘지 않는다(marketing first-screen-modal 문턱 0.35) ──────────────────────────────
// 긴 글(fixtureMax)에서 popup-today 는 40~43%, update-toast 는 37% 였다(blocks:gates fx=max 행, first-screen-modal fixed-cover). 뿌리 높이를 35dvh 로 막고
// 글 칸(제목·본문)만 스크롤 칸(_shared/floating-kit ScrollText)으로 두며 행동 줄은 스크롤 밖에 남긴다 — 눌러야 할 두 단추가 늘 보인다.
test('popup-today·update-toast: 뿌리 높이를 35dvh 로 막고, 글 칸만 스크롤 칸이며 행동 줄은 그 밖에 있다', async () => {
  const css = readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8')
  const rule = (sel) => css.match(new RegExp(`\\n${sel.replace(/[.]/g, '\\.')} \\{\\s*@apply ([^;]*);`))?.[1] ?? ''
  for (const sel of ['.cn-block-pt-popup', '.cn-block-ut-toast']) {
    assert.match(rule(sel), /max-h-\[35dvh\]/, `${sel}: 높이 상한`)
    assert.match(rule(sel), /overflow-hidden/, `${sel}: 넘치는 것은 잘라 스크롤 칸이 받는다`)
  }
  for (const sel of ['.cn-block-pt-scroll', '.cn-block-ut-text']) assert.match(rule(sel), /min-h-0[^]*overflow-y-auto|overflow-y-auto[^]*min-h-0/, `${sel}: 글 칸은 줄어들 수 있는 스크롤 칸`)
  for (const [path, textClass, rowClass] of [['announcement/popup-today', 'cn-block-pt-scroll', 'cn-block-pt-actions'], ['announcement/update-toast', 'cn-block-ut-text', 'cn-block-ut-actions']]) {
    const html = await renderFixtureHtml(path)
    const at = html.indexOf('data-scroll-text')
    assert.ok(at > 0, `${path}: 글 스크롤 칸 표지`)
    assert.match(html.slice(Math.max(0, at - 160), at + 160), new RegExp(textClass))
    const rowAt = html.lastIndexOf('<div', html.indexOf(rowClass)) // 행동 줄 여는 태그의 시작
    assert.ok(rowAt > at, `${path}: 행동 줄이 글 칸 뒤에 있다`)
    // 행동 줄은 스크롤 칸 안이 아니다 — 스크롤 칸이 열린 div 는 행동 줄 앞에서 모두 닫힌다
    const between = html.slice(html.lastIndexOf('<div', at), rowAt)
    assert.ok((between.match(/<\/div>/g) ?? []).length >= (between.match(/<div/g) ?? []).length, `${path}: 행동 줄은 스크롤 칸 밖`)
    // 서버 렌더에서는 넘침을 모르므로 초점 이동 속성이 없다(넘칠 때만 붙는다)
    assert.doesNotMatch(html.slice(Math.max(0, at - 10), at + 120), /tabindex/)
  }
  const kit = rd('_shared/floating-kit.tsx')
  assert.match(kit, /export function ScrollText/)
  assert.match(kit, /tabIndex=\{overflow \? 0 : undefined\}/)
})

// ── GATES2: 갤러리 예시가 눌리는 단추를 그린다(블록 행렬이 단추를 재려면 그려져 있어야 한다 — 히트 영역 na 13/13 이던 account/permissions) ──────────────
test('account/permissions: 기본·최대·최소 예시 모두 눌리는 단추(권한 켜기·다시 확인)를 그린다', async () => {
  for (const fx of ['fixture', 'fixtureMax', 'fixtureMin']) {
    const html = await renderFixtureHtml('account/permissions', fx)
    assert.ok((html.match(/<button\b/g) ?? []).length >= 1, `${fx}: 단추 0개 — 히트 영역·axe 가 잴 것이 없다`)
  }
  // 켜기 단추는 아직 묻지 않음 상태 + onRequest 가 있을 때만 — 기본 예시가 그 경우를 보인다
  assert.match(await renderFixtureHtml('account/permissions', 'fixture'), /위치 켜기/)
  // 다시 확인 단추는 상태를 고정하지 않은 행에만 — 최소 예시가 그 경우를 보인다
  assert.match(await renderFixtureHtml('account/permissions', 'fixtureMin'), /다시 확인/)
})
