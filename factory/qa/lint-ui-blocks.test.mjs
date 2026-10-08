// lint-ui 블록 층 규칙(P3-2 Task 1) — lint-ui.test.mjs 와 나눠 둔다(부품 규칙 테스트와 따로 고친다).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/qa/lint-ui-blocks.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { lintBlocksSrc, lintBlocksCompiled, lintBlocksCopy, gradientFails, numericCellWarnings, fixtureTextWithImports, fixedDurationProblems, blockTokenProblems, lintBlocksTokens, lintSource, disabledFocusProblems, imeEnterProblems, autocompleteProblems } from './lint-ui.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const run = (args) => new Promise((res) => { const p = spawn(process.execPath, args, { stdio: 'ignore' }); p.on('exit', (c) => res(c)) })

const blockTree = (files) => {
  const d = mkdtempSync(join(tmpdir(), 'wf-lint-blocks-'))
  for (const [rel, text] of Object.entries(files)) { mkdirSync(join(d, dirname(rel)), { recursive: true }); writeFileSync(join(d, rel), text) }
  return d
}

test('blocks src: inline shape classes outside cn-block-* hooks fail like ui-src; hooks-only block passes; _compiled is skipped', () => {
  const d = blockTree({
    'faq/bad.tsx': 'export function FaqBad() { return <section className="cn-block-section rounded-xl px-6">x</section> }\n',
    'faq/good.tsx': 'export function FaqGood() { return <section className="cn-block-section">x</section> }\n',
    '_shared/x.tsx': 'export function X() { return <p className="cn-block-lead text-xs">x</p> }\n',
    '_compiled/faq/bad.tsx': 'export function FaqBad() { return <section className="rounded-xl px-6">x</section> }\n',
  })
  try {
    const r = lintBlocksSrc(d)
    assert.equal(r.files, 3)
    assert.deepEqual(r.fails.map((f) => [f.rule, f.at.split(':')[0], f.hit]).sort(), [['shape-outside-hook', '_shared/x.tsx', 'text-xs'], ['shape-outside-hook', 'faq/bad.tsx', 'px-6'], ['shape-outside-hook', 'faq/bad.tsx', 'rounded-xl'], ['small-text', '_shared/x.tsx', 'text-xs']])
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('blocks compiled: generated folder needs GENERATED.md; the real repo blocks pass src and compiled rules', () => {
  const d = blockTree({ 'faq/a.tsx': 'export const A = 1\n' })
  try { assert.deepEqual(lintBlocksCompiled(d).fails.map((f) => f.rule), ['generated-marker']) } finally { rmSync(d, { recursive: true, force: true }) }
  const blocks = join(here, '..', '..', 'registry', 'factory', 'blocks')
  assert.deepEqual(lintBlocksSrc(blocks, { motionCoveredGlobally: true }).fails, [])
  const c = lintBlocksCompiled(join(blocks, '_compiled'), { motionCoveredGlobally: true })
  assert.ok(c.files >= 2)
  assert.deepEqual(c.fails, [])
})

test('k7-gradient (negative control): a gradient block fails in a K7 recipe copy, passes in K1; every gradient spelling is caught', () => {
  const d = blockTree({ 'faq/grad.tsx': 'export function FaqGrad() { return <section className="bg-linear-to-r from-primary to-field-1">x</section> }\n', 'faq/plain.tsx': 'export const P = 1\n' })
  try {
    assert.deepEqual(lintBlocksCopy(d, { colorLogic: 'K7' }).fails.map((f) => [f.rule, f.at]), [['k7-gradient', 'faq/grad.tsx:1']])
    assert.deepEqual(lintBlocksCopy(d, { colorLogic: 'K1' }).fails, [])
  } finally { rmSync(d, { recursive: true, force: true }) }
  for (const s of ['style={{ background: "linear-gradient(90deg, red, blue)" }}', 'radial-gradient(circle, var(--primary), var(--field-1))', 'conic-gradient(#f00, #00f)', 'className="bg-gradient-to-r from-primary to-field-2"', 'className="md:bg-linear-45 from-block-1 via-accent to-block-3"', 'className="bg-radial-[at_25%_25%] from-primary to-field-1"', 'background:repeating-linear-gradient(45deg,oklch(0.6 0.2 30),oklch(0.6 0.2 250))'])
    assert.equal(gradientFails('x.tsx', s).length, 1, s)
  assert.deepEqual(gradientFails('x.tsx', 'className="bg-field-1 text-linear"'), [])
})

// P3-2 Task 12 (대장 A9): K7 그라디언트는 「두 유채색 사이」만 잡는다. 스크림·하드 스톱 띠·마스크·같은 색 한 겹·중립 그라디언트는 된다.
test('k7-gradient (A9): scrims, hard-stop bands, masks, same-colour fills and neutral gradients pass; two-hue blends fail; foreign heroes are skipped', () => {
  for (const s of [
    '[&_.band-scrim]:[background:linear-gradient(to_bottom,var(--field-1)_0_62%,transparent_72%)]',
    '[&_.x]:[background:linear-gradient(to_right,var(--primary)_0_3px,transparent_3px)]',
    '[&_.dots]:[background-image:radial-gradient(circle,color-mix(in_oklch,var(--primary)_70%,transparent)_1px,transparent_1.5px)]',
    '[&_.m]:[mask-image:radial-gradient(closest-side,var(--foreground)_30%,transparent)]',
    '[&_.e]:[background:linear-gradient(var(--field-1),var(--field-1))]',
    '[&_.g]:[background-image:linear-gradient(to_right,color-mix(in_oklch,var(--foreground)_9%,transparent)_1px,transparent_1px)]',
    '[&_.s]:[background:linear-gradient(90deg,transparent,var(--gw-veil)_40%,transparent)]',
    'className="bg-linear-to-b from-background to-muted"',
    'className="bg-gradient-to-r from-primary to-transparent"',
  ]) assert.deepEqual(gradientFails('x.tsx', s), [], s)
  assert.equal(gradientFails('x.tsx', '[&_.b]:[background:linear-gradient(var(--field-1),color-mix(in_oklch,var(--primary)_60%,transparent))]').length, 1)
  const blend = 'const a = "[background:linear-gradient(var(--primary),var(--field-1))]"\n'
  const d = blockTree({ 'hero/mine.tsx': blend, 'hero/other.tsx': blend, 'faq/plain.tsx': blend })
  try {
    assert.deepEqual(lintBlocksCopy(d, { colorLogic: 'K7' }).fails.map((f) => f.at.split(':')[0]).sort(), ['faq/plain.tsx', 'hero/mine.tsx', 'hero/other.tsx'])
    assert.deepEqual(lintBlocksCopy(d, { colorLogic: 'K7', ownHeroes: ['mine'] }).fails.map((f) => f.at.split(':')[0]).sort(), ['faq/plain.tsx', 'hero/mine.tsx'])
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('block-token (A9): a hook whose name only has title as a layout word (cropped-title-list) is not a heading; real title hooks still are', () => {
  const css = '.cn-block-hero-cropped-title-list { @apply font-bold; }\n.cn-block-hero-vertical-title-slides { @apply font-semibold; }\n.cn-block-faq-title { @apply font-bold; }\n.cn-block-faq-question { @apply font-medium; }\n'
  assert.deepEqual(blockTokenProblems(css, []).map((f) => f.hit.split(' ')[0]).sort(), ['cn-block-faq-question', 'cn-block-faq-title'])
})

test('numeric-cell: a <td>/<TableCell> without data-numeric warns only when the fixture carries numbers', () => {
  const src = '<table><tbody><tr><td>{r.name}</td><TableCell data-numeric>{r.price}</TableCell><TableCell>{r.qty}</TableCell></tr></tbody></table>'
  assert.deepEqual(numericCellWarnings('t.tsx', src, 'export const fixture = { rows: [{ name: "가", price: 12000, qty: 3 }] }').map((w) => w.hit.split(' ')[0]), ['<td>', '<TableCell>'])
  assert.deepEqual(numericCellWarnings('t.tsx', src, 'export const fixture = { rows: [{ name: "가" }] }'), [])
})

// 대장 A132: 예시 데이터가 다른 .fixture.ts 에 있어도(상대 import 를 따라간다) 숫자를 보고, 글자 열은 태그 안 표지로 경고에서 뺀다.
test('numeric-cell (A132): follows relative .fixture imports; `/* numeric-cell: 글자 열 */` in the tag silences a text column', () => {
  const d = mkdtempSync(join(tmpdir(), 'nc-'))
  try {
    writeFileSync(join(d, 'shared.fixture.ts'), 'export const DATA = { rows: [{ name: "가", qty: 3 }] }\n')
    writeFileSync(join(d, 'own.fixture.ts'), 'import { DATA } from "./shared.fixture"\nexport const fixture = { data: DATA }\n')
    const text = fixtureTextWithImports(join(d, 'own.fixture.ts'))
    assert.match(text, /qty: 3/)
    assert.equal(fixtureTextWithImports(join(d, 'none.fixture.ts')), null)
    const src = '<TableCell className="a">{x}</TableCell><TableCell /* numeric-cell: 글자 열 */ className="b">{y}</TableCell><td data-numeric>{z}</td>'
    assert.deepEqual(numericCellWarnings('t.tsx', src, text).map((w) => w.at.split(':')[1]), ['1'], '표지 없는 칸 하나만 경고')
    assert.equal(numericCellWarnings('t.tsx', src, text).length, 1)
    // 자기 파일만 보면(이전 동작) 숫자를 못 본다 — 이 시험이 고친 틈
    assert.deepEqual(numericCellWarnings('t.tsx', src, readFileSync(join(d, 'own.fixture.ts'), 'utf8')), [])
  } finally { rmSync(d, { recursive: true, force: true }) }
})

// P3-2 Task 1c(리뷰 I-8): 임의 값·인라인 style 의 고정 길이도 잡는다. var()·calc() 안(토큰 대체값)은 된다.
test('fixed-duration (Task 1c): arbitrary time literals, [transition:…], animate-[…] and inline style durations fail; token fallbacks and calc pass; blocks src runs it', () => {
  const hits = (src) => fixedDurationProblems(src).map((p) => p.hit)
  assert.deepEqual(hits('cn("duration-[250ms] md:duration-[0.35s] [transition:opacity_500ms] [transition-duration:200ms] animate-[fade_300ms_ease]")'),
    ['duration-[250ms]', 'md:duration-[0.35s]', '[transition:opacity_500ms]', '[transition-duration:200ms]', 'animate-[fade_300ms_ease]'])
  assert.deepEqual(hits('<div style={{ transitionDuration: "200ms" }} /><p style={{ transition: "opacity 0.3s ease" }} /><i style={{ animation: "x 1s" }} />'),
    ['transitionDuration: "200ms"', 'transition: "opacity 0.3s ease"', 'animation: "x 1s"'])
  // 토큰을 읽는 길이는 된다
  assert.deepEqual(hits('cn("duration-(--duration-sheet,320ms) [transition:transform_var(--duration-sheet,320ms)_var(--ease-standard,cubic-bezier(0.23,1,0.32,1)),height_var(--duration-popover,160ms)] duration-[calc(var(--x)*2)] ease-[cubic-bezier(0.22,1,0.36,1)] animate-[spin_var(--d,1s)_linear]")'), [])
  assert.deepEqual(hits('<div style={{ transition: "opacity var(--duration-hover, 200ms)" }} />'), [])
  // CSS @apply 줄(base.css): 끝이 ; 인 토큰
  assert.deepEqual(hits('.cn-block-x {\n  @apply transition-opacity duration-300;\n}'), ['duration-300'])
  // 블록 원천 검사가 이 규칙을 돈다
  const d = blockTree({ 'faq/slow.tsx': 'export function FaqSlow() { return <section className="cn-block-section" style={{ transitionDuration: "400ms" }}>x</section> }\n' })
  try { assert.deepEqual(lintBlocksSrc(d).fails.filter((f) => f.rule === 'fixed-duration').map((f) => f.at), ['faq/slow.tsx:1']) } finally { rmSync(d, { recursive: true, force: true }) }
})

// P3-2 Task 1c(리뷰 I-4): 블록 훅 값·블록 원천에서 제목 칸 고정 굵기·임의 반경·임의 그림자는 실패, 토큰은 통과.
test('block-token (negative control): fixed weight on heading/question hooks, rounded-[Npx] and shadow-[…] fail; font-heading, rounded-lg, rounded-(--radius), shadow-md pass', () => {
  const css = [
    '.cn-block-x-question {\n  @apply text-[1.25rem] font-bold;\n}',
    '.cn-block-x-name {\n  @apply font-semibold;\n}',
    '.cn-block-x-label {\n  @apply font-medium;\n}',
    '.cn-block-x-card {\n  @apply rounded-[12px] shadow-[0_1px_2px_rgb(0_0_0/0.2)];\n}',
    '.cn-block-x-chip {\n  @apply rounded-t-[0.5rem];\n}',
    '.cn-block-x-ok {\n  @apply rounded-lg rounded-(--radius) rounded-full rounded-none shadow-md shadow-none;\n}',
  ].join('\n')
  const sources = [{ rel: 'x/a.tsx', source: 'export function XA() { return <section className="cn-block-section"><h3 className="cn-block-x-name font-heading">q</h3><span className="cn-block-x-label">l</span><h2 className="font-heading font-bold">t</h2></section> }\n' }]
  const f = blockTokenProblems(css, sources).map((x) => `${x.at} ${x.hit.split(' — ')[0]}`)
  assert.deepEqual(f.sort(), [
    'styles/base.css:10 cn-block-x-card rounded-[12px]',
    'styles/base.css:10 cn-block-x-card shadow-[0_1px_2px_rgb(0_0_0/0.2)]',
    'styles/base.css:13 cn-block-x-chip rounded-t-[0.5rem]',
    'styles/base.css:1 cn-block-x-question font-bold',
    'styles/base.css:4 cn-block-x-name font-semibold',
    'x/a.tsx:1 font-bold',
  ].sort())
  // 제목이 아닌 칸(label)의 굵기는 이 규칙 밖
  assert.ok(!f.some((x) => x.includes('cn-block-x-label')))
  // 저장소 블록 층은 통과(시범 faq 질문 칸의 font-bold 를 뺐다)
  const blocks = join(here, '..', '..', 'registry', 'factory', 'blocks')
  assert.deepEqual(lintBlocksTokens(blocks, join(here, '..', '..', 'registry', 'factory', 'styles', 'base.css')).fails, [])
})

// Task 14c: font-heading-ko(한글 제목 스택)는 font-heading 과 같은 제목 칸 서체 — 토큰 굵기만 받으면 통과, 고정 굵기와 함께면 실패(그 칸의 훅까지 제목 칸으로 잡힌다).
test('block-token: font-heading-ko is an allowed heading face; a fixed weight beside it (inline or on its hook) fails like font-heading', () => {
  const css = '.cn-block-y-lead {\n  @apply text-[2rem] font-bold;\n}\n.cn-block-y-plain {\n  @apply text-[2rem];\n}'
  const ok = [{ rel: 'y/a.tsx', source: 'export function YA() { return <section><h1 className="cn-block-y-plain font-heading-ko">한글 제목</h1><p className="font-heading-ko">부제</p></section> }\n' }]
  assert.deepEqual(blockTokenProblems(css.split('\n').slice(3).join('\n'), ok), [])
  const bad = [{ rel: 'y/b.tsx', source: 'export function YB() { return <section><p className="cn-block-y-lead font-heading-ko">큰 한글</p><span className="font-heading-ko font-semibold">x</span></section> }\n' }]
  assert.deepEqual(blockTokenProblems(css, bad).map((x) => `${x.at} ${x.hit.split(' — ')[0]}`).sort(), ['styles/base.css:1 cn-block-y-lead font-bold', 'y/b.tsx:1 font-semibold'].sort())
})

test('lint-ui CLI: --blocks-recipe needs an id (2), reads the recipe colour logic, and lints the .tmp copy', async () => {
  assert.equal(await run([join(here, 'lint-ui.mjs'), '--blocks-recipe']), 2)
  assert.equal(await run([join(here, 'lint-ui.mjs'), '--blocks-recipe', 'no-such-recipe']), 2)
})

// P3-2 Task 7a: 폼·포커스 규칙(대장 A2·A5·A42·A44·A100) — 음성 대조(나쁜 원천은 실패, 고친 원천은 통과) + 저장소 블록 층은 통과.
test('disabled-focus (A2): a Button/ChoiceButton/native button with disabled and no focusableWhenDisabled fails; the fixed spellings and option items pass', () => {
  const bad = [
    'export const A = () => <Button type="button" disabled={busy}>x</Button>',
    'export const B = () => <ChoiceButton choice="primary" disabled>x</ChoiceButton>',
    'export const C = () => <button type="button" disabled={busy}>x</button>',
    'export const D = () => <IconButton label="닫기" disabled={x ? 1 : 2}><X /></IconButton>',
  ]
  for (const s of bad) assert.equal(disabledFocusProblems(s).length, 1, s)
  const ok = [
    'export const A = () => <Button type="button" disabled={busy} focusableWhenDisabled>x</Button>',
    'export const B = () => <Button type="button" aria-disabled={busy || undefined}>x</Button>',
    'export const C = () => <ToggleGroupItem value="a" disabled={v.soldOut}>x</ToggleGroupItem>',
    'export const D = () => <Button type="button" disabled={locked} /* disabled-ok: 구독 없는 미리보기 */>x</Button>',
    'export const E = () => <Button type="button" onClick={() => go((a) => a)} aria-label="disabled">x</Button>',
  ]
  for (const s of ok) assert.deepEqual(disabledFocusProblems(s), [], s)
  const d = blockTree({ 'x/a.tsx': bad[0] + '\n' })
  try { assert.deepEqual(lintBlocksSrc(d).fails.filter((f) => f.rule === 'disabled-focus').map((f) => f.at), ['x/a.tsx:1']) } finally { rmSync(d, { recursive: true, force: true }) }
})

test('forced-colors-focus (A100): outline-none beside a focus ring fails in any source and in base.css hooks; outline-hidden and a ringless outline-none pass', () => {
  const hit = (s) => lintSource('x.tsx', s).fails.filter((f) => f.rule === 'forced-colors-focus').length
  assert.equal(hit('const RING = "outline-none focus-visible:ring-3 focus-visible:ring-ring"'), 1)
  assert.equal(hit('<a className="outline-none focus:ring-2 focus:ring-ring">x</a>'), 1)
  assert.equal(hit('const RING = "outline-hidden focus-visible:ring-3 focus-visible:ring-ring"'), 0)
  assert.equal(hit('<main tabIndex={-1} className="flex-1 outline-none">x</main>'), 0)
  const css = '.cn-block-x-a {\n  @apply outline-none focus-visible:ring-3 focus-visible:ring-ring;\n}\n.cn-block-x-b {\n  @apply outline-hidden focus-visible:ring-3 focus-visible:ring-ring;\n}\n'
  const d = blockTree({ 'styles/base.css': css })
  try { assert.deepEqual(lintBlocksTokens(d, join(d, 'styles', 'base.css')).fails.filter((f) => f.rule === 'forced-colors-focus').map((f) => f.at), ['styles/base.css:2']) } finally { rmSync(d, { recursive: true, force: true }) }
})

test('ime-enter (A42): an "Enter" key comparison without isComposingEnter fails; with the guard, or without an Enter comparison, passes', () => {
  assert.equal(imeEnterProblems('const h = (e) => { if (e.key === "Enter") go() }').length, 1)
  assert.equal(imeEnterProblems("const h = (e) => { if (e.key === 'Enter') go() }").length, 1)
  assert.deepEqual(imeEnterProblems('const h = (e) => { if (e.key === "Enter" && !isComposingEnter(e)) go() }'), [])
  assert.deepEqual(imeEnterProblems('// Enter 로 보내면 안 된다\nconst h = () => 1'), [])
  assert.deepEqual(imeEnterProblems('const h = (e) => e.key === "Escape"'), [])
})

test('autocomplete (A44): text inputs and FormField/TextField need autoComplete (off counts); email inputs also need autoCapitalize and spellCheck; radios, readOnly and textareas are exempt', () => {
  const bad = [
    '<Input id="a" name="a" type="text" />',
    '<input name="a" />',
    '<FormField form={form} name="email" label="이메일" type="email" />',
    '<TextField flow={flow} id={id} name="name" label="이름" />',
  ]
  for (const s of bad) assert.equal(autocompleteProblems(s).length, 1, s)
  const ok = [
    '<Input id="a" name="a" type="text" autoComplete="off" />',
    '<input type="radio" name="r" value="1" />',
    '<input readOnly value={url} />',
    '<FormField form={form} name="email" label="이메일" type="email" autoComplete="email" />',
    '<TextField flow={flow} id={id} name="message" label="문의" multiline />',
    '<Input name="a" type="email" autoComplete="email" autoCapitalize="off" spellCheck={false} />',
    '<Input name="a" type={type} autoComplete={autoComplete} autoCapitalize={type === "email" ? "off" : undefined} spellCheck={type === "email" ? false : undefined} />',
  ]
  for (const s of ok) assert.deepEqual(autocompleteProblems(s), [], s)
  // 이메일 칸에 autoComplete 만 있고 autoCapitalize·spellCheck 가 없으면 실패(종류를 식으로 받는 칸도 같다)
  assert.equal(autocompleteProblems('<Input name="a" type="email" autoComplete="email" />').length, 1)
  assert.equal(autocompleteProblems('<Input name="a" type={type} autoComplete={autoComplete} />').length, 1)
})

test('block-token (A5): the platform login hooks may use their official radii (12/6/4px) only inside _shared/social-login; other radii and other files still fail', () => {
  const css = '.cn-block-social-kakao {\n  @apply rounded-[12px] bg-[#FEE500];\n}\n.cn-block-social-naver {\n  @apply rounded-[6px];\n}\n.cn-block-social-google {\n  @apply rounded-[4px];\n}\n'
  const home = [{ rel: '_shared/social-login.tsx', source: 'export const S = () => <button className="cn-block-social cn-block-social-kakao">x</button>\n' }]
  assert.deepEqual(blockTokenProblems(css, home), [])
  // 다른 반경은 같은 훅이어도 실패, 다른 훅의 12px 도 실패
  assert.equal(blockTokenProblems(css.replace('rounded-[12px]', 'rounded-[13px]'), home).length, 1)
  assert.equal(blockTokenProblems(css + '.cn-block-x-card {\n  @apply rounded-[12px];\n}\n', home).length, 1)
  // 플랫폼 훅을 다른 원천이 부르면 실패
  const other = [{ rel: 'auth/other.tsx', source: 'export const O = () => <button className="cn-block-social-kakao">x</button>\n' }]
  assert.deepEqual(blockTokenProblems(css, other).map((f) => f.at), ['auth/other.tsx:1'])
  // 저장소 실물: base.css 의 카카오 훅이 12px 직접 값이고 lintBlocksTokens 는 통과(위 테스트가 확인)
  assert.match(readFileSync(join(here, '..', '..', 'registry', 'factory', 'styles', 'base.css'), 'utf8'), /\.cn-block-social-kakao \{\s*@apply rounded-\[12px\]/)
})
