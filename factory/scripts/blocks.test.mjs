// 블록 층(P3-2 Task 1) 검사. 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/blocks.test.mjs
// 폴더를 훑어 모든 블록에 공통 검사를 건다 — 새 블록을 더할 때 이 파일에 줄을 더하지 않는다.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BLOCK_KINDS, BlockMeta, loadBlocks, loadShared, blockProblems, blockItems, blockName, blockComponent, blockDeps, parseCheckArgs, baseHooks, BLOCK_IMPORT_ALLOW, reservedNames, repoProblems, sceneLevelPassed, BLOCK_MOTION_IDS, STATE_QUERY, BLOCK_STATES, stateQuery } from './blocks.mjs'
import { compileAll } from './gen-blocks.mjs'
import { galleryModule, metaModule, recipeCopy } from './gen-blocks-gallery.mjs'
import { LAYERS } from './pincheck.mjs'
import { steps } from './gen-all.mjs'
import { recipeMarkers, recipeMotionLevel, recipeLocalImports } from './recipe.mjs'
import { axisOfHook } from './axes.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const run = (args) => new Promise((res) => { const p = spawn(process.execPath, args, { cwd: root, stdio: 'ignore' }); p.on('exit', (c) => res(c)) })
const runOut = (args) => new Promise((res) => { const p = spawn(process.execPath, args, { cwd: root }); let err = ''; p.stderr.on('data', (d) => { err += d }); p.stdout.resume(); p.on('exit', (code) => res({ code, err })) })

const meta = (o = {}) => ({ kind: 'faq', variant: 'v1', title: 't', layout: 'l1', density: 'comfortable', archetypes: ['saas'], archetypeKinds: ['faq'], states: [], media: [], motion: [], ...o })
const okSrc = (kind, variant) => `import { Button } from "@/registry/factory/ui/button"\nexport function ${blockComponent(kind, variant)}() { return <section data-block="${kind}-${variant}"><Button /></section> }\n`
const made = []
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }) })
function fakeRepo(blocks) {
  const r = mkdtempSync(join(tmpdir(), 'wf-blocks-'))
  made.push(r)
  for (const b of blocks) {
    const d = join(r, 'registry', 'factory', 'blocks', b.kind); mkdirSync(d, { recursive: true })
    if (b.tsx !== false) writeFileSync(join(d, `${b.variant}.tsx`), b.src ?? okSrc(b.kind, b.variant))
    writeFileSync(join(d, `${b.variant}.block.json`), JSON.stringify(meta({ kind: b.kind, variant: b.variant, layout: b.layout ?? b.variant })))
    if (b.fixture !== false) writeFileSync(join(d, `${b.variant}.fixture.ts`), 'export const fixture = {}; export const fixtureMax = {}; export const fixtureMin = {}\n')
  }
  return r
}

test('BLOCK_KINDS: 스펙 16종 + 레인 D1 5종 + 레인 D2 7종 + Task 7b-commerce 3종 + Task 7b data-table + 본문 섹션 렌더러 content + 떠 있는 행동 floating-action + 거르기 줄 filter-bar(차례로 뒤에 붙인다) = 35', () => {
  assert.equal(BLOCK_KINDS.length, 35)
  assert.equal(new Set(BLOCK_KINDS).size, 35)
  assert.ok(BLOCK_KINDS.includes('state-screen'))
  assert.deepEqual(BLOCK_KINDS.slice(16, 21), ['auth', 'account', 'paywall', 'retention', 'consent'])
  assert.deepEqual(BLOCK_KINDS.slice(21, 28), ['onboarding', 'trust', 'review-list', 'referral', 'lead-capture', 'announcement', 'confirmation'])
  assert.deepEqual(BLOCK_KINDS.slice(28), ['product-info', 'shipping-returns', 'qna', 'data-table', 'content', 'floating-action', 'filter-bar'])
})
test('BlockMeta: rules 는 선택, 규칙 ID(L·P·O·R·T·A·V·X·M + 숫자)만 받고 중복은 위반', () => {
  assert.equal(BlockMeta.safeParse(meta()).success, true)
  assert.equal(BlockMeta.safeParse(meta({ rules: ['L3', 'P13', 'O2', 'R1', 'T5', 'A6', 'V2', 'X1', 'M1'] })).success, true)
  assert.equal(BlockMeta.safeParse(meta({ rules: [] })).success, true)
  for (const bad of ['l3', 'L', 'Q1', 'L3a', 'L-3', ' L3', 'X10 ']) assert.equal(BlockMeta.safeParse(meta({ rules: [bad] })).success, false, bad)
  assert.match(JSON.stringify(BlockMeta.safeParse(meta({ rules: ['Z9'] })).error.issues), /규칙 ID/)
  assert.match(JSON.stringify(BlockMeta.safeParse(meta({ rules: ['L3', 'L3'] })).error.issues), /두 번/)
  assert.equal(BlockMeta.safeParse(meta({ rules: 'L3' })).success, false)
})
test('BlockMeta: 모르는 density 거절', () => { assert.equal(BlockMeta.safeParse(meta({ density: 'airy' })).success, false) })
test('blockName · blockComponent', () => {
  assert.equal(blockName('faq', 'two-column-index'), 'block-faq-two-column-index')
  assert.equal(blockComponent('faq', 'two-column-index'), 'FaqTwoColumnIndex')
  assert.equal(blockComponent('bottom-tab', 'sticky-cta'), 'BottomTabStickyCta')
})
test('blockProblems: 파일 셋 중 하나가 빠지면 위반', () => {
  const r = fakeRepo([{ kind: 'faq', variant: 'a', fixture: false }])
  assert.match(blockProblems(loadBlocks(r)).join('\n'), /faq\/a — 예시 콘텐츠 \.fixture\.ts 없음/)
  const r2 = fakeRepo([{ kind: 'faq', variant: 'a', tsx: false }])
  assert.match(blockProblems(loadBlocks(r2), { minVariants: 0 }).join('\n'), /faq\/a — 원천 \.tsx 없음/)
})
test('blockProblems: 같은 kind 안 layout 중복은 위반', () => {
  const r = fakeRepo([{ kind: 'faq', variant: 'a', layout: 'same' }, { kind: 'faq', variant: 'b', layout: 'same' }])
  assert.match(blockProblems(loadBlocks(r), { minVariants: 0 }).join('\n'), /faq: layout 'same' 중복/)
})
test('blockProblems: 허용 밖 import는 위반', () => {
  const r = fakeRepo([{ kind: 'faq', variant: 'a', src: `import x from "@/app/qa/recipes/heroes/parts"\n${okSrc('faq', 'a')}` }])
  assert.match(blockProblems(loadBlocks(r), { minVariants: 0 }).join('\n'), /허용 밖 import @\/app\/qa\/recipes\/heroes\/parts/)
  // 라이브러리 직접 import(아이콘은 @/registry/factory/icons 로만)도 위반.
  const r2 = fakeRepo([{ kind: 'faq', variant: 'a', src: `import { X } from "lucide-react"\n${okSrc('faq', 'a')}` }])
  assert.match(blockProblems(loadBlocks(r2), { minVariants: 0 }).join('\n'), /허용 밖 import lucide-react/)
})
test('blockProblems: kind마다 변형 3개 미만이면 위반(기본)', () => {
  const r = fakeRepo([{ kind: 'faq', variant: 'a' }])
  assert.match(blockProblems(loadBlocks(r)).join('\n'), /faq: 변형 1개 — 3개 이상 필요/)
})
test('blockProblems: h1 은 hero kind 만 · 컴포넌트 이름 · data-block · base.css 에 없는 훅', () => {
  const r = fakeRepo([
    { kind: 'faq', variant: 'a', src: `export function FaqA() { return <section data-block="faq-a"><h1>x</h1></section> }\n` },
    { kind: 'faq', variant: 'b', src: `export function Wrong() { return <section className="cn-block-nope">x</section> }\n` },
  ])
  const p = blockProblems(loadBlocks(r), { minVariants: 0, hooks: new Set(['cn-block-section']) }).join('\n')
  assert.match(p, /faq\/a — h1은 hero kind만 쓴다/)
  assert.match(p, /faq\/b — 컴포넌트 FaqB 를 내보내지 않음/)
  assert.match(p, /faq\/b — 섹션 루트에 data-block="faq-b" 없음/)
  assert.match(p, /faq\/b — base\.css 에 없는 훅 cn-block-nope/)
})
// Task 1b: shadcn 4.21.0 은 import 를 풀 때 같은 add 묶음의 파일 중 끝 이름이 같은 것(/<이름>.tsx)을 후보로 넣고 .tsx 를 .ts 보다 앞세운다 —
// 변형·조각 이름이 icons 면 블록의 @/components/icons import 가 레시피 base 의 components/icons/index.ts 대신 그 블록 파일로 바뀐다(소비자에서 실측).
test('blockProblems: 변형·_shared 조각 이름 icons 는 위반(아이콘 정본 모듈 import 를 가로챈다), 다른 이름은 통과', () => {
  const r = fakeRepo([{ kind: 'faq', variant: 'icons' }, { kind: 'faq', variant: 'icon-links' }])
  const p = blockProblems(loadBlocks(r), { minVariants: 0, shared: new Set(['icons', 'block-heading']) })
  assert.deepEqual(p.filter((m) => /가로챈다/.test(m)), [
    'faq/icons — 이름 icons 는 쓸 수 없다(소비자 설치에서 registry/factory/icons/index.ts 로 가는 import 를 가로챈다)',
    '_shared/icons — 이름 icons 는 쓸 수 없다(소비자 설치에서 registry/factory/icons/index.ts 로 가는 import 를 가로챈다)',
  ])
})
// Task 1c(리뷰 I-1): 가로채기는 icons 만이 아니다 — 확장자 순서(.tsx → .ts)에서 지는 .ts 대상 모두. 막는 이름은 파일에서 만든다.
test('blockProblems: 가로채기 일반화 — contact-form/phone·_shared/utils·motion 훅 이름·_shared 와 같은 변형 이름은 위반, 부품 이름(.tsx 제자리가 이긴다)은 통과', () => {
  const reserved = reservedNames(root)
  for (const n of ['phone', 'utils', 'block-contract', 'adapter-mock', 'content-core', 'saas', 'use-gsap-scene', 'use-recipe-motion', 'motion-scale', 'agent-form-attrs', 'json-ld', 'icons', 'lucide', 'use-mobile'])
    assert.ok(reserved.has(n), `${n} 는 막는 이름`)
  for (const n of ['table', 'card', 'button', 'block-heading', 'index']) assert.ok(!reserved.has(n), `${n} 는 막지 않는다`)
  assert.equal(reserved.get('phone'), 'registry/factory/lib/phone.ts')
  const r = fakeRepo([{ kind: 'contact-form', variant: 'phone' }, { kind: 'faq', variant: 'use-gsap-scene' }, { kind: 'faq', variant: 'block-heading' }, { kind: 'pricing', variant: 'table' }])
  const p = blockProblems(loadBlocks(r), { minVariants: 0, shared: new Set(['block-heading', 'utils']) }).filter((m) => /가로챈다/.test(m))
  assert.deepEqual(p, [
    'contact-form/phone — 이름 phone 는 쓸 수 없다(소비자 설치에서 registry/factory/lib/phone.ts 로 가는 import 를 가로챈다)',
    'faq/block-heading — 이름 block-heading 는 쓸 수 없다(소비자 설치에서 _shared 조각 block-heading 로 가는 import 를 가로챈다)',
    'faq/use-gsap-scene — 이름 use-gsap-scene 는 쓸 수 없다(소비자 설치에서 registry/factory/motion/use-gsap-scene.ts 로 가는 import 를 가로챈다)',
    '_shared/utils — 이름 utils 는 쓸 수 없다(소비자 설치에서 registry/factory/lib/utils.ts 로 가는 import 를 가로챈다)',
  ])
})

// Task 1c(리뷰 I-2·M-3): _shared 조각도 블록과 같은 원천 검사를 받는다 — 리뷰 탐침 P1(오타 훅·허용 밖 import·npm·h1)과 이름.
const sharedRepo = (shared) => {
  const r = fakeRepo([{ kind: 'faq', variant: 'a' }])
  const d = join(r, 'registry', 'factory', 'blocks', '_shared'); mkdirSync(d, { recursive: true })
  for (const [name, src] of Object.entries(shared)) writeFileSync(join(d, `${name}.tsx`), src)
  return r
}
test('blockProblems: _shared 조각 — 모르는 훅·부품 훅·허용 밖 import·npm·h1·대문자 이름·가로채기 이름은 위반, 올바른 조각은 통과', () => {
  const r = sharedRepo({
    'card-frame': 'import x from "@/app/qa/recipes/heroes/parts"\nimport _ from "lodash"\nexport function CardFrame() { return <div className="cn-block-card-frme cn-card"><h1>x</h1></div> }\n',
    BlockHeading: 'export function BlockHeading() { return <div className="cn-block-heading">x</div> }\n',
    ok: 'import { cn } from "@/registry/factory/lib/utils"\nexport function Ok() { return <div className={cn("cn-block-heading")}>x</div> }\n',
  })
  const shared = loadShared(r)
  const p = blockProblems(loadBlocks(r), { minVariants: 0, hooks: new Set(['cn-block-heading', 'cn-block-section']), shared: new Set(shared.map((s) => s.name)), sharedSources: shared })
  assert.deepEqual(p.filter((m) => m.startsWith('_shared/')).sort(), [
    '_shared/BlockHeading — 조각 이름은 소문자·숫자·하이픈(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)',
    '_shared/card-frame — base.css 에 없는 훅 cn-block-card-frme',
    '_shared/card-frame — h1은 hero kind만 쓴다',
    '_shared/card-frame — 부품 훅 cn-card — 블록은 cn-block-* 훅만 쓴다(부품 모양은 부품 컴포넌트로)',
    '_shared/card-frame — 허용 밖 import @/app/qa/recipes/heroes/parts',
    '_shared/card-frame — 허용 밖 import lodash',
  ].sort())
  // 양성 대조: 같은 검사가 블록에서도(repoProblems — CLI·gen-blocks 경로)
  assert.ok(repoProblems(r, { minVariants: 0 }, new Set(['cn-block-heading', 'cn-block-section'])).some((m) => m === '_shared/card-frame — 허용 밖 import lodash'))
})
test('gen-blocks: 문제가 있는 조각이면 스택 없이 문제 줄과 종료 1, 옛 생성물은 그대로(리뷰 I-2·M-1)', async () => {
  const r = sharedRepo({ 'card-frame': 'import x from "@/app/qa/recipes/heroes/parts"\nexport function CardFrame() { return <div className="cn-block-heading">x</div> }\n' })
  mkdirSync(join(r, 'registry', 'factory', 'styles'), { recursive: true })
  writeFileSync(join(r, 'registry', 'factory', 'styles', 'base.css'), '.cn-block-heading {\n  @apply flex;\n}\n.cn-block-section {\n  @apply flex;\n}\n')
  writeFileSync(join(r, 'package.json'), '{"version":"0.0.0","dependencies":{}}')
  mkdirSync(join(r, 'registry', 'factory', 'blocks', '_compiled'), { recursive: true })
  writeFileSync(join(r, 'registry', 'factory', 'blocks', '_compiled', 'old.tsx'), 'old')
  const { code, err } = await runOut([join(root, 'factory', 'scripts', 'gen-blocks.mjs'), '--root', r])
  assert.equal(code, 1)
  assert.match(err, /gen-blocks: _shared\/card-frame — 허용 밖 import @\/app\/qa\/recipes\/heroes\/parts/)
  assert.match(err, /gen-blocks: 문제 1건 — 쓰지 않았다/)
  assert.doesNotMatch(err, /\n\s+at /, '스택이 아니다')
  assert.equal(readFileSync(join(r, 'registry', 'factory', 'blocks', '_compiled', 'old.tsx'), 'utf8'), 'old')
  // 양성 대조: 조각을 고치면 같은 명령이 0 으로 쓴다
  writeFileSync(join(r, 'registry', 'factory', 'blocks', '_shared', 'card-frame.tsx'), 'export function CardFrame() { return <div className="cn-block-heading">x</div> }\n')
  writeFileSync(join(r, 'registry', 'factory', 'blocks', 'faq', 'a.tsx'), 'export function FaqA() { return <section data-block="faq-a" className="cn-block-section">x</section> }\n')
  const ok = await runOut([join(root, 'factory', 'scripts', 'gen-blocks.mjs'), '--root', r])
  assert.equal(ok.code, 0, ok.err)
  assert.ok(existsSync(join(r, 'registry', 'factory', 'blocks', '_compiled', '_shared', 'card-frame.tsx')))
  assert.ok(!existsSync(join(r, 'registry', 'factory', 'blocks', '_compiled', 'old.tsx')))
})

// Task 14c(레인 C 걱정 2): 삼항식 안의 훅은 컴파일러가 바꾸지 않는다 — gen-blocks 가 컴파일본에 남은 cn-block- 을 잡아 쓰지 않고 종료 1.
test('gen-blocks: 삼항식 안의 훅이 컴파일본에 남으면 문제 줄(파일:줄 · 훅 이름)과 종료 1, 아무것도 쓰지 않는다 — JSX 글자로 옮기면 0(음성·양성 대조)', async () => {
  const r = fakeRepo([{ kind: 'faq', variant: 'a', src: 'export function FaqA({ on = false }: { on?: boolean }) {\n  return <section data-block="faq-a" className="cn-block-section"><p className={on ? "cn-block-heading" : "cn-block-section"}>x</p></section>\n}\n' }])
  mkdirSync(join(r, 'registry', 'factory', 'styles'), { recursive: true })
  writeFileSync(join(r, 'registry', 'factory', 'styles', 'base.css'), '.cn-block-heading {\n  @apply flex;\n}\n.cn-block-section {\n  @apply grid;\n}\n')
  writeFileSync(join(r, 'package.json'), '{"version":"0.0.0","dependencies":{}}')
  mkdirSync(join(r, 'registry', 'factory', 'blocks', '_compiled'), { recursive: true })
  writeFileSync(join(r, 'registry', 'factory', 'blocks', '_compiled', 'old.tsx'), 'old')
  const { code, err } = await runOut([join(root, 'factory', 'scripts', 'gen-blocks.mjs'), '--root', r])
  assert.equal(code, 1, err)
  assert.match(err, /gen-blocks: _compiled\/faq\/a\.tsx:2 — 컴파일되지 않은 훅 cn-block-heading/)
  assert.match(err, /gen-blocks: _compiled\/faq\/a\.tsx:2 — 컴파일되지 않은 훅 cn-block-section/)
  assert.match(err, /gen-blocks: 컴파일되지 않은 훅 2건 — 쓰지 않았다/)
  assert.doesNotMatch(err, /\n\s+at /, '스택이 아니다')
  assert.equal(readFileSync(join(r, 'registry', 'factory', 'blocks', '_compiled', 'old.tsx'), 'utf8'), 'old')
  assert.ok(!existsSync(join(r, 'registry', 'factory', 'blocks', 'registry.json')))
  // 양성 대조: 갈래마다 JSX 글자로 두면 컴파일러가 바꾸고 0 으로 쓴다(컴파일본에 cn-block- 이 없다)
  writeFileSync(join(r, 'registry', 'factory', 'blocks', 'faq', 'a.tsx'), 'export function FaqA({ on = false }: { on?: boolean }) {\n  return <section data-block="faq-a" className="cn-block-section">{on ? <p className="cn-block-heading">x</p> : <p className="cn-block-section">x</p>}</section>\n}\n')
  const ok = await runOut([join(root, 'factory', 'scripts', 'gen-blocks.mjs'), '--root', r])
  assert.equal(ok.code, 0, ok.err)
  assert.doesNotMatch(readFileSync(join(r, 'registry', 'factory', 'blocks', '_compiled', 'faq', 'a.tsx'), 'utf8'), /cn-block-/)
})

// Task 1c(리뷰 I-3·M-1·M-2·M-8): 허용 목록과 의존 짝이 같은 모양이다.
test('BLOCK_IMPORT_ALLOW: ax 는 agent-form-attrs·json-ld 만, content/schemas 만 두 마디, _shared 는 ../ 만, @gsap/react 는 밖', () => {
  const src = (spec) => `import x from "${spec}"\n${okSrc('faq', 'a')}`
  const probs = (spec) => blockProblems(loadBlocks(fakeRepo([{ kind: 'faq', variant: 'a', src: src(spec) }])), { minVariants: 0 }).filter((m) => /import/.test(m))
  for (const ok of ['@/registry/factory/ax/agent-form-attrs', '@/registry/factory/ax/json-ld', '@/registry/factory/content/schemas/saas', '@/registry/factory/contract/block-contract', 'gsap/ScrollTrigger'])
    assert.deepEqual(probs(ok), [], ok)
  for (const bad of ['@/registry/factory/ax/seo-files', '@/registry/factory/lib/sub/deep', '@/registry/factory/motion/x/y', './_shared/block-heading', '@gsap/react', '@/registry/factory/hooks/use-mobile'])
    assert.deepEqual(probs(bad), [`faq/a — 허용 밖 import ${bad}`], bad)
  assert.deepEqual(blockDeps('import { agentFormAttrs } from "@/registry/factory/ax/agent-form-attrs"\nimport { JsonLd } from "@/registry/factory/ax/json-ld"\n'), { registry: ['agent-form-attrs', 'json-ld'], npm: [] })
})

// Task 1c(리뷰 I-4 가): 블록은 부품 훅을 쓰지 않는다 — 부품 훅은 블록 컴파일이 base 값으로 굳혀 레시피 모양이 닿지 않는다.
test('blockProblems: 블록 원천의 부품 훅(cn-card)은 위반, cn-block-* 은 통과', () => {
  const r = fakeRepo([{ kind: 'pricing', variant: 'a', src: 'export function PricingA() { return <section data-block="pricing-a" className="cn-block-section"><div className="cn-card">x</div></section> }\n' }])
  assert.deepEqual(blockProblems(loadBlocks(r), { minVariants: 0, hooks: new Set(['cn-block-section', 'cn-card']) }), ['pricing/a — 부품 훅 cn-card — 블록은 cn-block-* 훅만 쓴다(부품 모양은 부품 컴포넌트로)'])
})

// Task 1c(리뷰 M-6·G-2): 메타 교차 검사 — 기법 id·상태 묶음·중복.
test('BlockMeta: motion 은 기법 id(카탈로그 + gsap-techniques 도우미), 읽기 상태는 넷 모두, 제출은 ok·field-error·server-error(+pending), 중복 금지', () => {
  assert.ok(BLOCK_MOTION_IDS.includes('rise') && BLOCK_MOTION_IDS.includes('split-text') && BLOCK_MOTION_IDS.includes('count-up'))
  assert.equal(BlockMeta.safeParse(meta({ motion: ['rise', 'svg-draw'] })).success, true)
  assert.equal(BlockMeta.safeParse(meta({ motion: ['wobble'] })).success, false)
  assert.equal(BlockMeta.safeParse(meta({ motion: ['rise', 'rise'] })).success, false)
  assert.equal(BlockMeta.safeParse(meta({ states: ['loading', 'empty', 'error', 'ready'] })).success, true)
  assert.match(JSON.stringify(BlockMeta.safeParse(meta({ states: ['loading'] })).error.issues), /읽기 상태는 넷을 모두/)
  assert.equal(BlockMeta.safeParse(meta({ states: ['submit-ok', 'submit-field-error', 'submit-server-error'] })).success, true)
  assert.equal(BlockMeta.safeParse(meta({ states: ['submit-ok', 'submit-field-error', 'submit-server-error', 'submit-pending'] })).success, true)
  assert.match(JSON.stringify(BlockMeta.safeParse(meta({ states: ['submit-ok', 'submit-pending'] })).error.issues), /제출 상태는/)
})

// Task 1c(리뷰 I-6): 메타 상태 → 갤러리 쿼리는 한 표.
test('STATE_QUERY: 메타 상태 8개(submit-pending 포함) → state=/submit= 한 쌍, stateQuery 는 모르는 값에서 멈춘다', () => {
  assert.deepEqual(BLOCK_STATES, ['loading', 'empty', 'error', 'ready', 'submit-ok', 'submit-field-error', 'submit-server-error', 'submit-pending'])
  assert.deepEqual(BLOCK_STATES.map(stateQuery), ['state=loading', 'state=empty', 'state=error', 'state=ready', 'submit=ok', 'submit=field-error', 'submit=server-error', 'submit=pending'])
  assert.throws(() => stateQuery('submit-maybe'), /없다/)
  // 표의 값은 mock 어댑터가 받는 값이다
  const mock = readFileSync(join(root, 'registry', 'factory', 'contract', 'adapter-mock.ts'), 'utf8')
  const states = JSON.parse(mock.match(/MOCK_STATES = (\[[^\]]*\])/)[1]), submits = JSON.parse(mock.match(/MOCK_SUBMITS = (\[[^\]]*\])/)[1])
  for (const s of BLOCK_STATES) assert.ok((STATE_QUERY[s].key === 'state' ? states : submits).includes(STATE_QUERY[s].value), s)
})

test('--lenient: 변형 1개인 kind도 통과, --lenient 없이는 위반 (CLI 인자·판정)', () => {
  const r = fakeRepo([{ kind: 'faq', variant: 'a' }])
  const lenient = parseCheckArgs(['--check', '--lenient'])
  assert.deepEqual(lenient, { minVariants: 0, requireKinds: false })
  assert.deepEqual(blockProblems(loadBlocks(r), lenient), [])
  assert.match(blockProblems(loadBlocks(r), parseCheckArgs(['--check'])).join('\n'), /faq: 변형 1개/)
  assert.deepEqual(parseCheckArgs(['--check', '--all-kinds']), { minVariants: 3, requireKinds: true })
  assert.equal(parseCheckArgs(['--lenient']), null)
  assert.equal(parseCheckArgs(['--check', '--oops']), null)
  assert.match(blockProblems(loadBlocks(r), { minVariants: 0, requireKinds: true }).join('\n'), /nav: 블록 없음/)
})
test('blockItems: registry:block · ui 의존 없음 · 고정 ref · fixture 빠짐 · 컴파일본 파일', () => {
  const r = fakeRepo([{ kind: 'faq', variant: 'a' }])
  const [it] = blockItems({ repo: 'o/r', ref: 'v0.0.6', versions: {}, root: r })
  assert.equal(it.name, 'block-faq-a'); assert.equal(it.type, 'registry:block')
  assert.ok(!(it.registryDependencies ?? []).some((d) => /\/button#/.test(d)), 'ui 부품은 레시피가 채운다')
  assert.deepEqual(it.files.map((f) => f.target), ['components/blocks/faq/a.tsx'])
  assert.deepEqual(it.files.map((f) => f.path), ['_compiled/faq/a.tsx'])
  assert.equal(it.meta.requires, 'recipe')
})
test('blockDeps: 층 import → 항목 이름(motion-gsap 파일·훅·계약·lib·조각), ui·아이콘은 빠진다, 모르는 경로는 멈춘다', () => {
  const src = [
    'import type { BlockBase } from "@/registry/factory/contract/block-contract"',
    'import { cn } from "@/registry/factory/lib/utils"',
    'import { rise } from "@/registry/factory/motion/gsap-techniques"',
    'import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"',
    'import { useRecipeMotion } from "@/registry/factory/motion/use-recipe-motion"',
    'import type { SaasContent } from "@/registry/factory/content/schemas/saas"',
    'import { Icon } from "@/registry/factory/icons"',
    'import { Button } from "@/registry/factory/ui/button"',
    'import { BlockHeading } from "../_shared/block-heading"',
    'import { gsap } from "gsap"',
    'import * as React from "react"',
  ].join('\n')
  assert.deepEqual(blockDeps(src), { registry: ['block-contract', 'block-shared-block-heading', 'content-saas', 'motion-gsap', 'use-recipe-motion', 'utils'], npm: ['gsap'] })
  assert.throws(() => blockDeps('import x from "@/app/qa/x"'), /의존으로 바꿀 수 없다/)
  assert.ok(BLOCK_IMPORT_ALLOW.some((re) => re.test('@/registry/factory/icons')))
})

// ── 저장소의 실제 블록 ────────────────────────────────────────────────────────
test('저장소 블록: 메타·파일 셋·import·h1·훅·조각 검사 통과(--lenient 기준), 시범 블록 faq/two-column-index 가 있다', async () => {
  const blocks = loadBlocks(root)
  assert.ok(blocks.some((b) => b.kind === 'faq' && b.variant === 'two-column-index'))
  assert.deepEqual(blockProblems(blocks, { minVariants: 0, hooks: await baseHooks(root), shared: new Set(loadShared(root).map((s) => s.name)) }), [])
})
// P3-2 Task 3: 히어로 19개가 블록이다 — 변형 = 레시피 히어로 카탈로그(HERO_IDS, 메타 layout 도 같은 id), 블록마다 h1 하나(SplitSource 제목),
// 뿌리는 data-hero(검수대 틀 머리 CSS 가 가둔다)와 공용 뿌리 훅을 단다. 머리는 header 칸으로 받는다(틀이 넘긴다).
test('저장소 블록: hero kind = HERO_IDS(원래 19개 + r12~r16 이 올려 쓴 블록 히어로 5) ∪ 모션 그래픽 히어로(MOTION_HEROES, P3-5) ∪ FV1 히어로 6(FV1_HEROES, Task 5.7), 블록마다 h1 하나 · data-hero · header 칸', async () => {
  const { HERO_IDS } = await import('./recipe.mjs')
  const { MOTION_HEROES, FV1_HEROES } = await import('./blocks.mjs')
  const heroes = loadBlocks(root).filter((b) => b.kind === 'hero')
  assert.deepEqual(heroes.map((b) => b.variant).sort(), [...new Set([...HERO_IDS, ...MOTION_HEROES, ...FV1_HEROES])].sort())
  // FV1 레인 DRAFTS(2026-10-11): 확정한 r12~r16 이 아직 아무 레시피도 안 쓴 블록 히어로 다섯을 카탈로그(HERO_IDS)에 올려 썼다 — 그 겹침은 이 다섯뿐이다(블록 표 FV1_HEROES 자체는 그대로).
  assert.deepEqual([...MOTION_HEROES, ...FV1_HEROES].filter((h) => HERO_IDS.includes(h)).sort(), ['illustration-scene', 'ken-burns-stills', 'map-first', 'punch-in-statement', 'video-montage'])
  for (const b of heroes) {
    assert.equal(b.meta.data?.layout, b.variant, `${b.variant}: layout`)
    assert.equal((b.source.match(/<h1[\s>]/g) ?? []).length, 1, `${b.variant}: h1 하나`)
    assert.ok(b.source.includes(`data-hero="${b.variant}"`), `${b.variant}: data-hero`)
    assert.ok(b.source.includes(`cn("cn-block-hero-root cn-block-hero-${b.variant}`), `${b.variant}: 뿌리 훅`)
    assert.match(b.source, /\n\s*\{header\}\n/, `${b.variant}: header 칸`)
  }
})
test('저장소 블록: 생성물 blocks/registry.json·_compiled 가 원천과 같다(gen-blocks 결과)', async () => {
  const reg = JSON.parse(readFileSync(join(root, 'registry', 'factory', 'blocks', 'registry.json'), 'utf8'))
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.deepEqual(reg.items, blockItems({ repo: 'nowwcastle-sudo/sitebrew', ref: `v${pkg.version}`, versions: { ...pkg.devDependencies, ...pkg.dependencies }, root }))
  const files = await compileAll(root)
  for (const [rel, text] of Object.entries(files)) assert.equal(readFileSync(join(root, 'registry', 'factory', 'blocks', '_compiled', rel), 'utf8'), text, rel)
  // 컴파일본에는 훅이 남지 않는다(모르는 훅은 blockProblems 가 먼저 막는다).
  for (const [rel, text] of Object.entries(files)) assert.doesNotMatch(text, /\bcn-block-/, rel)
})
test('층 연결: include·LAYERS·gen:all 단계에 blocks', () => {
  const reg = JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8'))
  assert.ok(reg.include.includes('registry/factory/blocks/registry.json'))
  assert.ok(reg.include.indexOf('registry/factory/blocks/registry.json') < reg.include.indexOf('registry/factory/r/registry.json'))
  assert.ok(LAYERS.includes('blocks'))
  const names = steps('v1.2.3', { hasAi: false }).map((s) => s[0])
  assert.ok(names.indexOf('gen-content-slots') < names.indexOf('gen-blocks') && names.indexOf('gen-blocks') < names.indexOf('gen-registry'), names.join(','))
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts['blocks:check'], 'node factory/scripts/blocks.mjs --check')
  assert.equal(pkg.scripts['qa:blocks'], 'node factory/scripts/gen-blocks-gallery.mjs')
  for (const k of ['predev', 'prebuild', 'pretypecheck']) assert.match(pkg.scripts[k], /qa:recipes && npm run qa:blocks/, k)
  assert.match(readFileSync(join(root, '.gitignore'), 'utf8'), /^\/\.tmp\/$/m, '.tmp/blocks 는 .tmp 로 덮인다')
})
test('블록 훅(cn-block-*)은 어느 스타일 축에도 속하지 않는다 — 반경 축 생성물로 새지 않는다', () => {
  assert.equal(axisOfHook('cn-block-section'), 'block')
  assert.equal(axisOfHook('cn-block-card-shadow'), 'block')
  for (const f of ['r0-zero', 'r1-soft', 'r2-pill-controls']) assert.doesNotMatch(readFileSync(join(root, 'registry', 'factory', 'styles', 'axes', 'radius', `${f}.css`), 'utf8'), /cn-block-/, f)
})

// ── 레시피 모션 단계 ─────────────────────────────────────────────────────────
test('--wf-motion: 레시피 motion M0~M3 → 0~3, r1 CSS·registry cssVars 에 실린다', () => {
  assert.deepEqual(['M0', 'M1', 'M2', 'M3', undefined, 'M9'].map(recipeMotionLevel), ['0', '1', '2', '3', '2', '2'])
  assert.equal(recipeMarkers({ motion: 'M3' })['wf-motion'], '3')
  assert.match(readFileSync(join(root, 'registry', 'factory', 'r', 'r1-measure', 'r1-measure.css'), 'utf8'), /--wf-motion: 1;/)
  const base = JSON.parse(readFileSync(join(root, 'registry', 'factory', 'r', 'registry.json'), 'utf8')).items.find((i) => i.name === 'r1-measure')
  assert.equal(base.cssVars.light['wf-motion'], '1')
})
test('useRecipeMotion 순수 파서: " 3 " → 3, "" → 2, 잘못된 값 → 2; 훅 항목이 motion-core 로 깔린다', async () => {
  const { parseMotionLevel, motionLevel } = await import(pathToFileURL(join(root, 'registry', 'factory', 'motion', 'use-recipe-motion.ts')).href)
  assert.equal(parseMotionLevel(' 3 '), 3)
  assert.equal(parseMotionLevel('0'), 0)
  assert.equal(parseMotionLevel(''), 2)
  assert.equal(parseMotionLevel(null), 2)
  assert.equal(parseMotionLevel('4'), 2)
  assert.equal(parseMotionLevel('1.5'), 2)
  assert.equal(motionLevel(1), 'M1')
  const motion = JSON.parse(readFileSync(join(root, 'registry', 'factory', 'motion', 'registry.json'), 'utf8')).items
  const hook = motion.find((i) => i.name === 'use-recipe-motion')
  assert.deepEqual(hook.files, [{ path: 'use-recipe-motion.ts', type: 'registry:hook', target: '@components/motion/use-recipe-motion.ts' }])
  assert.ok(motion.find((i) => i.name === 'motion-core').registryDependencies.some((d) => d.includes('/use-recipe-motion#')))
})

// ── 갤러리 ───────────────────────────────────────────────────────────────────
test('galleryModule: 블록마다 레시피 수만큼 동적 import 사본 경로 · 예시 콘텐츠 동적 import; metaModule 은 동적 import 없음', () => {
  const blocks = [{ kind: 'faq', variant: 'a', meta: meta({ variant: 'a' }) }, { kind: 'nav', variant: 'bar', meta: meta({ kind: 'nav', variant: 'bar' }) }]
  const recipes = [{ id: 'r1-x', name: 'x', defaultTheme: 'light', colorLogic: 'K1' }, { id: 'r2-y', name: 'y', defaultTheme: 'dark', colorLogic: 'K7' }, { id: 'r3-z', name: 'z', defaultTheme: 'light', colorLogic: 'K8' }]
  const g = galleryModule(blocks, recipes)
  for (const b of blocks) {
    const hits = recipes.map((r) => `import("./${r.id}/${b.kind}/${b.variant}").then((m) => m.${blockComponent(b.kind, b.variant)})`)
    for (const h of hits) assert.ok(g.includes(h), h)
    assert.ok(g.includes(`import("@/registry/factory/blocks/${b.kind}/${b.variant}.fixture")`))
  }
  assert.equal((g.match(/import\("\.\//g) ?? []).length, blocks.length * recipes.length)
  const m = metaModule(blocks, recipes)
  assert.doesNotMatch(m, /import\(/)
  assert.match(m, /"block-nav-bar"/)
  assert.match(m, /"colorLogic":"K7"/)
})
test('recipeCopy: 부품은 레시피 컴파일본, 아이콘 정본 모듈은 그 레시피 어댑터로', () => {
  const src = 'import { Button } from "@/registry/factory/ui/button"\nimport { ArrowRight } from "@/registry/factory/icons"\nimport { cn } from "@/registry/factory/lib/utils"\n'
  assert.equal(recipeCopy(src, 'r5-celadon', 'phosphor-light'), 'import { Button } from "@/registry/factory/r/r5-celadon/ui/button"\nimport { ArrowRight } from "@/registry/factory/icons/phosphor-light"\nimport { cn } from "@/registry/factory/lib/utils"\n')
})
// Task 1c(리뷰 I-5): 따옴표 셋 × 모양 넷(import from · export from · export * from · import()) 모두 레시피 폴더로. 다른 층은 그대로.
test('recipeLocalImports·recipeCopy: 홑따옴표·백틱·export from·동적 import 도 바꾼다(부품 공용 — 저장소 부품 컴파일본은 그대로)', () => {
  const forms = (q, mod) => [
    `import { X } from ${q}${mod}${q}`,
    `export { X } from ${q}${mod}${q}`,
    `export * from ${q}${mod}${q}`,
    `const m = await import(${q}${mod}${q})`,
    `import type { Y } from ${q}${mod}${q}`,
  ].join('\n')
  for (const q of ['"', "'", '`']) {
    assert.equal(recipeLocalImports(forms(q, '@/registry/factory/ui/button'), 'r9-clay'), forms(q, '@/registry/factory/r/r9-clay/ui/button'), `ui ${q}`)
    assert.equal(recipeCopy(forms(q, '@/registry/factory/icons'), 'r9-clay', 'phosphor'), forms(q, '@/registry/factory/icons/phosphor'), `icons ${q}`)
    // 다른 층·아이콘 하위 모듈은 건드리지 않는다
    for (const other of ['@/registry/factory/hooks/use-mobile', '@/registry/factory/lib/utils', '@/registry/factory/icons/lucide']) assert.equal(recipeCopy(forms(q, other), 'r9-clay', 'phosphor'), forms(q, other), `${other} ${q}`)
  }
  // 음성 대조(옛 구현 — 겹따옴표만): 홑따옴표 import 를 놓친다
  const old = (s, id) => s.replaceAll('"@/registry/factory/ui/', '"@/registry/factory/r/' + id + '/ui/')
  assert.equal(old(forms("'", '@/registry/factory/ui/button'), 'x'), forms("'", '@/registry/factory/ui/button'))
})

// Task 1c(리뷰 I-7): 장면은 뿌리의 --wf-motion 을 레이아웃 효과 안에서 읽는다 — 블록은 level 을 넘기지 않는다.
test('모션 단계: levelFromVar 순수 파서 · 장면 훅이 level 없을 때 --wf-motion 을 등장 길이보다 먼저 읽는다 · 저장소 블록은 level·useRecipeMotion 을 쓰지 않는다', async () => {
  const { levelFromVar } = await import(pathToFileURL(join(root, 'registry', 'factory', 'motion', 'motion-scale.ts')).href)
  assert.deepEqual(['0', ' 1 ', '2', '3', '', '4', '1.5', null, undefined].map(levelFromVar), ['M0', 'M1', 'M2', 'M3', null, null, null, null, null])
  const hook = readFileSync(join(root, 'registry', 'factory', 'motion', 'use-gsap-scene.ts'), 'utf8')
  assert.match(hook, /const lv = level \?\? levelFromVar\(getComputedStyle\(root\)\.getPropertyValue\("--wf-motion"\)\) \?\? levelFromEnter\(t\.enter\)/)
  // blocks:check 가 level 을 넘기는 블록을 잡는다(레인 블록이 옛 BP-4 예시를 따라도 BP-5 에서 드러난다)
  assert.equal(sceneLevelPassed('useGsapScene(ref, (s) => { rise(s, s.q("[data-enter]")) }, { level: motionLevel(level) })'), true)
  assert.equal(sceneLevelPassed('useGsapScene(ref, build, { deps: [a], level })'), true)
  assert.equal(sceneLevelPassed('useGsapScene(ref, (s) => { rise(s, s.q("[data-enter]")) })'), false)
  assert.equal(sceneLevelPassed('useGsapScene(ref, (s) => { rise(s, s.q("(level: x)")) }, { deps: [k] })\nconst o = { level: 1 }'), false)
  const src = `"use client"\nimport { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"\nimport { motionLevel, useRecipeMotion } from "@/registry/factory/motion/use-recipe-motion"\nexport function FaqA() { const level = useRecipeMotion(); useGsapScene(ref, (s) => {}, { level: motionLevel(level) }); return <section data-block="faq-a" /> }\n`
  assert.deepEqual(blockProblems(loadBlocks(fakeRepo([{ kind: 'faq', variant: 'a', src }])), { minVariants: 0 }), ['faq/a — useGsapScene 에 level 을 넘기지 않는다(장면이 뿌리의 --wf-motion 을 읽는다 — 넘기면 서버 렌더 뒤 등장이 두 번 시작한다)'])
})

test('blocks.mjs CLI: --check 는 변형 3개 규칙으로 1, --check --lenient 는 0, 인자 오류 2', async () => {
  assert.equal(await run([join(root, 'factory', 'scripts', 'blocks.mjs'), '--check', '--lenient']), 0)
  assert.equal(await run([join(root, 'factory', 'scripts', 'blocks.mjs')]), 2)
  // 저장소에 kind 마다 3개가 모두 차기 전에는 --check 가 1 이다(레인 도중). 다 차면 0 — 둘 다 판정 결과다.
  const code = await run([join(root, 'factory', 'scripts', 'blocks.mjs'), '--check'])
  const full = [...new Set(loadBlocks(root).map((b) => b.kind))].every((k) => loadBlocks(root).filter((b) => b.kind === k).length >= 3)
  assert.equal(code, full ? 0 : 1)
})

