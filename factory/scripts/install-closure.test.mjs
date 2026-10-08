// 설치 닫힘 탐침(최종 리뷰 I1·권고 2). 실행: node --test --test-force-exit --test-timeout=60000 "factory/scripts/*.test.mjs"
// 실제 `shadcn build`(node_modules 의 4.21.0, 네트워크 없음)를 임시 폴더에 돌려 저장소에서 만든 항목과 같은지도 본다(2초 안팎).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildItems, readBuildDir, checkAll, checkItem, installPath, rewriteImport } from './install-closure.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const items = buildItems(root)
const byName = (list) => new Map(list.map((it) => [it.name, it]))

// 양성 대조: P3 모션 블록처럼 저장소 안 경로로 훅을 부르는 합성 항목.
const probe = {
  name: 'probe-motion-block', type: 'registry:component',
  registryDependencies: ['nowwcastle-sudo/sitebrew/motion-core#v0.0.4'], dependencies: [],
  files: [{ path: 'registry/factory/blocks/probe.tsx', type: 'registry:component', content: 'import { useReducedMotion } from "@/registry/factory/motion/use-reduced-motion"\nimport { usePauseOffscreen } from "@/registry/factory/motion/use-pause-offscreen"\n' }],
}

test('shadcn 4.21.0 rules: install spot and import rewrite for each layer shape', () => {
  assert.equal(installPath({ path: 'registry/factory/r/r1-measure/ui/button.tsx', type: 'registry:ui', target: '@ui/button.tsx' }), 'components/ui/button.tsx')
  assert.equal(installPath({ path: 'registry/factory/ui/button.tsx', type: 'registry:ui' }), 'components/ui/button.tsx')
  assert.equal(installPath({ path: 'registry/factory/hooks/use-mobile.ts', type: 'registry:hook' }), 'hooks/use-mobile.ts')
  assert.equal(installPath({ path: 'registry/factory/content/schemas/brand.ts', type: 'registry:lib', target: '@components/content/schemas/brand.ts' }), 'components/content/schemas/brand.ts')
  assert.equal(rewriteImport('@/registry/factory/r/r1-measure/ui/button'), '@/components/ui/button')
  assert.equal(rewriteImport('@/registry/factory/hooks/use-mobile'), '@/hooks/use-mobile')
  assert.equal(rewriteImport('@/registry/factory/icons/phosphor-light'), '@/components/icons/phosphor-light')
  // 원인(I1): /hooks·/lib 가 아닌 층은 aliases.components 아래로 간다.
  assert.equal(rewriteImport('@/registry/factory/motion/use-reduced-motion'), '@/components/motion/use-reduced-motion')
})

test('every registry item: its install closure resolves every import and declares every npm import', () => {
  const t0 = Date.now()
  const r = checkAll(items)
  assert.ok(r.count >= 170, `항목 ${r.count}개`)
  assert.deepEqual(r.unresolved.map((x) => `${x.file}: ${x.spec} → ${x.rewritten}`), [])
  assert.deepEqual(r.undeclared.map((x) => `${x.file}: ${x.pkg}`), [])
  assert.deepEqual(r.missing.map((x) => x.name), [])
  assert.ok(Date.now() - t0 < 5000, `${Date.now() - t0}ms`)
})

test('positive control: a block importing the motion hooks by repo path resolves (hooks install under components/motion)', () => {
  const r = checkItem(probe.name, byName([...items, probe]))
  assert.deepEqual(r.unresolved, [])
  const hook = items.find((it) => it.name === 'use-reduced-motion')
  assert.equal(installPath(hook.files[0]), 'components/motion/use-reduced-motion.ts')
})

test('M8: a css @import of a shipped face file resolves from the consumer globals.css; a wrong target is caught', () => {
  const names = ['font-bm-euljiro', 'font-natural-sans', 'font-pyeojin-gothic', 'font-seocho-batang']
  for (const n of names) {
    const it = items.find((x) => x.name === n)
    assert.equal(installPath(it.files[0]), `styles/wf-fonts/${n.replace(/^font-/, '')}.css`, n)
    assert.match(it.files[0].content, /@font-face \{ font-family: "[^"]+"; src: url\("https:/, n)
    assert.deepEqual(checkItem(n, byName(items)).unresolved, [], n)
  }
  // 음성 대조: 파일 자리를 옮기면 @import 가 풀리지 않는다.
  const moved = items.map((x) => (x.name === 'font-seocho-batang' ? { ...x, files: x.files.map((f) => ({ ...f, target: 'fonts/seocho-batang.css' })) } : x))
  assert.deepEqual(checkItem('font-seocho-batang', byName(moved)).unresolved.map((u) => u.rewritten), ['styles/wf-fonts/seocho-batang.css'])
})

test('positive control: the pre-fix hook shape (no target → hooks/) is caught as unresolved', () => {
  const prefix = items.map((it) => (it.type === 'registry:hook' && it.files[0].path.includes('/motion/') ? { ...it, files: it.files.map((f) => ({ ...f, target: undefined })) } : it))
  const r = checkItem(probe.name, byName([...prefix, probe]))
  assert.deepEqual(r.unresolved.map((u) => u.rewritten).sort(), ['@/components/motion/use-pause-offscreen', '@/components/motion/use-reduced-motion'])
  // 선언 안 된 npm 도 잡는다.
  const npmProbe = { ...probe, name: 'probe-npm', files: [{ ...probe.files[0], content: 'import { motion } from "framer-motion"\n' }] }
  assert.deepEqual(checkItem(npmProbe.name, byName([...items, npmProbe])).undeclared.map((u) => u.pkg), ['framer-motion'])
})

// 자기 기한 300초(대장 A24 — 직렬 시험 부하 때 공통 기한 120초를 넘겨 1건 취소된 적이 있다. 관문 명령의 공통 기한은 올리지 않는다).
test('the real `shadcn build` output (offline, local shadcn 4.21.0) equals the in-repo items and passes the same probe', { timeout: 300000 }, async () => {
  const out = mkdtempSync(join(tmpdir(), 'wf-build-'))
  try {
    const code = await new Promise((res) => spawn(process.execPath, [join(root, 'node_modules', 'shadcn', 'dist', 'index.js'), 'build', '-o', out], { cwd: root, stdio: 'ignore' }).on('exit', res))
    assert.equal(code, 0)
    const built = byName(readBuildDir(out))
    assert.equal(built.size, items.length)
    for (const it of items) {
      const b = built.get(it.name)
      assert.ok(b, it.name)
      assert.deepEqual((b.files ?? []).map((f) => [f.path, f.target, f.content.replace(/\r\n/g, '\n')]), it.files.map((f) => [f.path, f.target, f.content.replace(/\r\n/g, '\n')]), it.name)
    }
    const r = checkAll([...built.values()])
    assert.equal(r.unresolved.length + r.undeclared.length + r.missing.length, 0)
  } finally { rmSync(out, { recursive: true, force: true }) }
})

// 블록 묶음 닫힘(P3-2 Task 1): registry:block(meta.requires 'recipe')은 「블록 닫힘 + 레시피 base(r1-measure) 닫힘」으로 본다 —
// 블록의 @/registry/factory/ui/* import 는 레시피 base 가 까는 부품 파일(components/ui/<부품>.tsx)로 풀려야 한다.
const fakeBlock = (name, content, meta = { requires: 'recipe' }) => ({
  name, type: 'registry:block', dependencies: [], meta,
  registryDependencies: ['nowwcastle-sudo/sitebrew/utils#v0.0.5'],
  files: [{ path: `registry/factory/blocks/_compiled/faq/${name}.tsx`, type: 'registry:block', target: `components/blocks/faq/${name}.tsx`, content }],
})

test('block bundle: a block calling a part the recipe base does not ship is an unresolved import', () => {
  const b = fakeBlock('probe-block-missing', 'import { Nope } from "@/registry/factory/ui/nope-part"\nimport { cn } from "@/registry/factory/lib/utils"\n')
  assert.deepEqual(checkItem(b.name, byName([...items, b])).unresolved.map((u) => u.rewritten), ['@/components/ui/nope-part'])
})

test('block bundle: a block calling only parts the recipe base ships resolves (0); without the recipe bundle the same block does not', () => {
  const src = 'import { Separator } from "@/registry/factory/ui/separator"\nimport { Button } from "@/registry/factory/ui/button"\nimport { cn } from "@/registry/factory/lib/utils"\n'
  const b = fakeBlock('probe-block-ok', src)
  const r = checkItem(b.name, byName([...items, b]))
  assert.deepEqual([r.unresolved, r.undeclared, r.missing], [[], [], []])
  // 음성 대조: 레시피 묶음 표지(meta.requires)가 없으면 ui import 가 풀리지 않는다 — 묶음 판정이 실제로 일한다.
  const alone = fakeBlock('probe-block-alone', src, {})
  assert.deepEqual(checkItem(alone.name, byName([...items, alone])).unresolved.map((u) => u.rewritten).sort(), ['@/components/ui/button', '@/components/ui/separator'])
})

test('block bundle: every block item in the repo resolves with the r1-measure base (pilot faq/two-column-index included)', () => {
  const blocks = items.filter((it) => it.type === 'registry:block')
  assert.ok(blocks.some((it) => it.name === 'block-faq-two-column-index'))
  for (const b of blocks) {
    const r = checkItem(b.name, byName(items))
    assert.deepEqual([r.unresolved, r.undeclared, r.missing], [[], [], []], b.name)
  }
})

// P3-2 Task 1b: 블록이 아이콘 정본 모듈 @/registry/factory/icons 를 부르면 소비자에서 @/components/icons 가 된다 —
// 레시피 base 가 까는 components/icons/index.ts(그 레시피 어댑터를 다시 내보냄)로 풀려야 한다. 레시피 10벌 모두, 아이콘 어댑터 파일까지.
const iconBlockSrc = 'import { ArrowRight, Check } from "@/registry/factory/icons"\nimport { cn } from "@/registry/factory/lib/utils"\n'

test('block bundle: a block importing the icon module resolves with every recipe base (index.ts → that recipe adapter)', () => {
  const b = fakeBlock('probe-block-icons', iconBlockSrc)
  const all = byName([...items, b])
  const bases = items.filter((it) => it.type === 'registry:base')
  assert.ok(bases.length >= 10, `레시피 base ${bases.length}개`)
  for (const base of bases) {
    const r = checkItem(b.name, all, undefined, { recipeBase: base.name })
    assert.deepEqual([r.unresolved, r.undeclared, r.missing], [[], [], []], base.name)
    const idx = (base.files ?? []).find((f) => installPath(f) === 'components/icons/index.ts')
    assert.ok(idx, `${base.name}: components/icons/index.ts 없음`)
    assert.equal(idx.type, 'registry:component', `${base.name}: registry:file 은 shadcn 이 import 를 바꾸지 않는다`)
    const adapter = idx.content.match(/from "@\/registry\/factory\/icons\/([a-z-]+)"/)?.[1]
    assert.ok(adapter, base.name)
    // index.ts 가 가리키는 어댑터 파일을 같은 묶음(레시피 base 닫힘의 icons-<library>)이 실제로 깐다.
    const bundle = checkItem(base.name, all)
    assert.deepEqual(bundle.unresolved, [], base.name)
  }
})

test('negative control: without the recipe base icons index the same icon block is an unresolved import', () => {
  const b = fakeBlock('probe-block-icons', iconBlockSrc)
  const stripped = items.map((it) => (it.type === 'registry:base' ? { ...it, files: (it.files ?? []).filter((f) => installPath(f) !== 'components/icons/index.ts') } : it))
  const r = checkItem(b.name, byName([...stripped, b]))
  assert.deepEqual(r.unresolved.map((u) => u.rewritten), ['@/components/icons'])
})

// P3-2 Task 1c(리뷰 I-3): 블록은 ax 층의 agent-form-attrs·json-ld 를 부를 수 있다 — blocks.mjs blockDeps 가 같은 이름의 ax 항목으로 잇고,
// 그 닫힘이 소비자 components/ax/<이름> 을 깐다. 음성 대조: 그 의존 없이는 같은 import 가 풀리지 않는다.
test('block bundle: a block importing ax/agent-form-attrs and ax/json-ld resolves through the blockDeps mapping; without it, it does not', async () => {
  const { blockDeps } = await import('./blocks.mjs')
  const src = 'import { agentFormAttrs } from "@/registry/factory/ax/agent-form-attrs"\nimport { JsonLd } from "@/registry/factory/ax/json-ld"\nimport { cn } from "@/registry/factory/lib/utils"\n'
  const deps = blockDeps(src)
  assert.deepEqual(deps, { registry: ['agent-form-attrs', 'json-ld', 'utils'], npm: [] })
  const b = { ...fakeBlock('probe-block-ax', src), registryDependencies: deps.registry.map((n) => `nowwcastle-sudo/sitebrew/${n}#v0.0.5`) }
  const r = checkItem(b.name, byName([...items, b]))
  assert.deepEqual([r.unresolved, r.undeclared, r.missing], [[], [], []])
  const bare = fakeBlock('probe-block-ax-bare', src)
  assert.deepEqual(checkItem(bare.name, byName([...items, bare])).unresolved.map((u) => u.rewritten).sort(), ['@/components/ax/agent-form-attrs', '@/components/ax/json-ld'])
})
