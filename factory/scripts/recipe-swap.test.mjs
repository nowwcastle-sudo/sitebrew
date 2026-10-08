// T9-c2: 레시피를 두 번째로 add 해도 소비자 layout.tsx 의 서체 선언이 겹치지 않는다.
// - 빠른 검사(늘 돈다): 설치된 shadcn 4.21.0 을 그대로 써서 작은 Next 뼈대에 폰트 항목만 두 번 add 한다(네트워크 없음).
// - 전 과정(WF_INSTALL_TEST=1 일 때만): recipe-swap.mjs — 새 소비자에 레시피 두 벌 add → npm run build 종료 0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { loadSources } from './gen-fonts.mjs'
import { FONT_VAR_END } from './lib/registry-lib.mjs'
import { layoutDuplicates, localRegistry, runSwap, secondWins, SECOND } from './recipe-swap.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHADCN_BIN = join(ROOT, 'node_modules', 'shadcn', 'dist', 'index.js')

test('layoutDuplicates finds a const declared twice, and nothing in a clean layout', () => {
  const dup = "import { A } from 'x'\r\nconst ibmPlexSans = A({variable:'--a'});\r\n\r\nconst ibmPlexSans = A({variable:'--a'});\nconst geist = B()\n"
  assert.deepEqual(layoutDuplicates(dup), ['ibmPlexSans'])
  assert.deepEqual(layoutDuplicates("const a = A()\nconst b = B()\n  const a = inner()\n"), [])
})

test('secondWins reads the role font variable from @theme and the light primary from :root (CRLF too)', () => {
  const css = ':root {\r\n  --primary: oklch(0.3 0.08 150);\r\n  --ring: x;\r\n}\n.dark { --primary: oklch(0.9 0 0); }\n@theme inline {\n  --font-sans: var(--font-noto-sans-kr-wf, "Noto Sans KR", sans-serif), sans-serif;\n}\n'
  assert.deepEqual(secondWins(css), { fontSans: '--font-noto-sans-kr-wf', primary: 'oklch(0.3 0.08 150)' })
  assert.deepEqual(secondWins(''), { fontSans: null, primary: null })
})

test('localRegistry rewrites every remote dependency to ../localreg and leaves none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-localreg-'))
  try {
    mkdirSync(join(dir, 'a'))
    writeFileSync(join(dir, 'a', 'x.json'), JSON.stringify({ registryDependencies: ['nowwcastle-sudo/sitebrew/factory-base#v0.0.3', 'nowwcastle-sudo/sitebrew/font-sora#v1.2.3', 'nowwcastle-sudo/sitebrew/motion-core'] }))
    const r = localRegistry([join(dir, 'a')], join(dir, 'out'))
    assert.deepEqual(r, { files: 1, rewritten: 3, remaining: 0 })
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'out', 'x.json'), 'utf8')).registryDependencies, ['../localreg/factory-base.json', '../localreg/font-sora.json', '../localreg/motion-core.json'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// ── 실제 shadcn 으로 layout.tsx 를 고쳐 쓴다 ─────────────────────────────
const LAYOUT = [
  'import { Geist } from "next/font/google"',
  'import "./globals.css"',
  'import { cn } from "@/lib/utils";',
  '',
  "const geist = Geist({subsets:['latin'],variable:'--font-sans'})",
  '',
  'export default function RootLayout({ children }: { children: React.ReactNode }) {',
  '  return (',
  '    <html lang="ko" className={cn("antialiased", "font-sans", geist.variable)}>',
  '      <body>{children}</body>',
  '    </html>',
  '  )',
  '}',
  '',
].join('\n')

function skeleton() {
  const dir = mkdtempSync(join(tmpdir(), 'wf-fontlayout-'))
  mkdirSync(join(dir, 'app')); mkdirSync(join(dir, 'items'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wf-font-layout', private: true, dependencies: { next: '16.3.4', react: '19.2.8', 'react-dom': '19.2.8' } }))
  writeFileSync(join(dir, 'next.config.ts'), 'export default {}\n')
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'preserve', paths: { '@/*': ['./*'] } } }))
  writeFileSync(join(dir, 'components.json'), JSON.stringify({
    $schema: 'https://ui.shadcn.com/schema.json', style: 'base-nova', rsc: true, tsx: true,
    tailwind: { config: '', css: 'app/globals.css', baseColor: 'neutral', cssVariables: true, prefix: '' },
    iconLibrary: 'lucide', aliases: { components: '@/components', utils: '@/lib/utils', ui: '@/components/ui', lib: '@/lib', hooks: '@/hooks' },
  }))
  writeFileSync(join(dir, 'app', 'globals.css'), '@import "tailwindcss";\n')
  writeFileSync(join(dir, 'app', 'layout.tsx'), LAYOUT)
  return dir
}
const addItems = (dir, items) => new Promise((res) => {
  const paths = items.map((i) => { const p = `./items/${i.name}${i.font.variable.endsWith(FONT_VAR_END) ? '' : '-old'}.json`; writeFileSync(join(dir, p), JSON.stringify(i)); return p })
  const p = spawn(process.execPath, [SHADCN_BIN, 'add', ...paths, '-y', '-o', '--cwd', '.'], { cwd: dir })
  let out = ''
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { out += d })
  p.on('close', (code) => res({ code, out }))
})
const layoutOf = (dir) => readFileSync(join(dir, 'app', 'layout.tsx'), 'utf8')
const kitFonts = () => loadSources().filter((i) => i.type === 'registry:font').map(({ file, $schema, ...i }) => i)
// v0.0.3 의 항목 모양: 변수에 종결자가 없다(--font-ibm-plex-sans ⊂ --font-ibm-plex-sans-kr).
const v003 = (i) => ({ ...i, font: { ...i.font, variable: i.font.variable.slice(0, -FONT_VAR_END.length) } })
const R1 = ['font-ibm-plex-mono', 'font-ibm-plex-sans', 'font-ibm-plex-sans-kr']

test('positive control: v0.0.3-shaped font items added twice duplicate a declaration (the T9-c2 build break)', { timeout: 120000 }, async () => {
  const dir = skeleton()
  try {
    const items = kitFonts().filter((i) => R1.includes(i.name)).map(v003)
    for (let n = 0; n < 2; n++) { const r = await addItems(dir, items); assert.equal(r.code, 0, r.out) }
    assert.deepEqual(layoutDuplicates(layoutOf(dir)), ['ibmPlexSansIbmPlexSans'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('every kit font added twice declares each loader exactly once (idempotent)', { timeout: 120000 }, async () => {
  const dir = skeleton()
  try {
    const items = kitFonts()
    for (let n = 0; n < 2; n++) { const r = await addItems(dir, items); assert.equal(r.code, 0, r.out) }
    const layout = layoutOf(dir)
    assert.deepEqual(layoutDuplicates(layout), [])
    for (const i of items) assert.equal(layout.split(`variable:'${i.font.variable}'`).length - 1, 1, i.name)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a consumer on v0.0.3 fonts can take the new items without a duplicate (upgrade path)', { timeout: 120000 }, async () => {
  const dir = skeleton()
  try {
    const r1 = kitFonts().filter((i) => R1.includes(i.name))
    let r = await addItems(dir, r1.map(v003)); assert.equal(r.code, 0, r.out)
    r = await addItems(dir, r1); assert.equal(r.code, 0, r.out)
    assert.deepEqual(layoutDuplicates(layoutOf(dir)), [])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// 새 소비자에 레시피 두 벌(r1-measure → 시험용 고정물 t13-swap)을 차례로 add 하고 빌드한다. npm 네트워크·10분쯤.
test('two recipes added in sequence to one fresh consumer build with exit 0 (WF_INSTALL_TEST=1)', {
  skip: process.env.WF_INSTALL_TEST === '1' ? false : 'WF_INSTALL_TEST=1 일 때만 돈다(새 소비자 설치·빌드, 네트워크 필요)',
  timeout: 1_800_000,
}, async () => {
  const res = await runSwap()
  assert.equal(res.steps['add-1'], 0, JSON.stringify(res))
  assert.equal(res.steps['add-2'], 0, JSON.stringify(res))
  assert.deepEqual(res.duplicates, [])
  // 두 번째 레시피가 이겼다(리뷰 M6): 역할 서체 변수와 라이트 primary 가 고정물 값
  assert.equal(res.fontSans, SECOND.fontSans, JSON.stringify(res))
  assert.equal(res.primary, SECOND.primary, JSON.stringify(res))
  assert.ok(res.layoutVariables.some((v) => /NotoSansKr/.test(v)), res.layoutVariables.join(' '))
  assert.equal(res.steps.build, 0, JSON.stringify(res))
  assert.equal(res.deleted, true)
})
