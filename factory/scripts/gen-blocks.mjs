// 블록 층 생성: node factory/scripts/gen-blocks.mjs [--ref vX.Y.Z] [--root <폴더>]   (npm run gen:all 이 gen-content-slots 다음, gen-registry 앞에 돌린다)
// ① 블록·_shared 원천을 base.css 훅 지도로 컴파일해 registry/factory/blocks/_compiled/ 에 쓴다(생성물 — 소비자에게 나가는 파일).
//    아이콘 정본 모듈(@/registry/factory/icons)은 바꾸지 않는다 — 블록은 레시피마다 하나라 어댑터를 고를 수 없다.
//    소비자에서는 @/components/icons 가 되고, 레시피 base 가 까는 components/icons/index.ts(그 레시피 어댑터 다시 내보내기)가 받는다(Task 1b).
// ② blocks.mjs blockItems 결과를 registry/factory/blocks/registry.json 에 쓴다.
// 검사는 blocks.mjs repoProblems(블록 + _shared 조각)를 minVariants 0 으로 돌린다(레인 도중 kind 가 3개 미만이어도 생성은 막지 않는다 — 3개 규칙은
// blocks:check·출시 관문). 문제가 있으면 쓰지 않고 종료 1. 컴파일·항목 만들기는 옛 생성물을 지우기 전에 끝낸다 — 도중에 멈춰도 옛 _compiled·registry.json 이
// 짝을 이룬 채 남는다(리뷰 M-1). 멈추면 스택 대신 한 줄 이유로 종료 1(리뷰 I-2).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStyleMap, transformStyle } from 'shadcn/utils'
import { parseRef } from './lib/registry-lib.mjs'
import { loadBlocks, loadShared, repoProblems, blockItems, COMPILED } from './blocks.mjs'
import { MARKER } from './compile-styles.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const GENERATOR = 'factory/scripts/gen-blocks.mjs'

// 블록 원천 → 컴파일본(훅 → base 값). 모르는 훅은 컴파일러가 지우므로 blockProblems(hooks) 가 먼저 막는다.
export const compileBlock = (source, styleMap) => transformStyle(source, { styleMap })
export const baseStyleMap = (root = ROOT) => createStyleMap(readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8'))

// 컴파일본에 남은 훅(Task 14c — 레인 C 걱정 2): 컴파일러(shadcn transformStyle)는 JSX 속성 글자·cn() 의 글자 인자만 바꾼다. 삼항식(`a ? "cn-block-x" : …`)·
// 템플릿 글자 안의 훅은 그대로 남아 아무 모양도 내지 않는다(blocks:check 의 「base.css 에 없는 훅」은 이름만 보므로 통과한다). 하나라도 남으면 쓰지 않고 종료 1.
export function leftoverHooks(files) {
  const out = []
  for (const [rel, text] of Object.entries(files))
    text.split('\n').forEach((l, i) => {
      for (const m of l.matchAll(/\bcn-block-[a-z0-9-]+/g)) out.push(`_compiled/${rel}:${i + 1} — 컴파일되지 않은 훅 ${m[0]}(삼항식·템플릿 글자 안의 훅은 바뀌지 않는다 — 갈래마다 JSX 글자나 cn() 의 글자 인자로 옮긴다)`)
    })
  return out
}

// { '<kind>/<variant>.tsx' | '_shared/<이름>.tsx': 컴파일본 }
export async function compileAll(root = ROOT, styleMap = baseStyleMap(root)) {
  const out = {}
  for (const b of loadBlocks(root)) if (b.meta.success && b.source) out[`${b.kind}/${b.variant}.tsx`] = await compileBlock(b.source, styleMap)
  for (const s of loadShared(root)) out[`_shared/${s.name}.tsx`] = await compileBlock(s.source, styleMap)
  return out
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  try {
    const argv = process.argv.slice(2)
    // --root <폴더>: 검사용(가짜 저장소에서 문제 보고·종료 코드를 잰다). 기본은 이 저장소.
    const ri = argv.indexOf('--root')
    const root = ri === -1 ? ROOT : resolve(argv[ri + 1] ?? '')
    const ref = parseRef(argv)
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const versions = { ...pkg.devDependencies, ...pkg.dependencies }
    const styleMap = createStyleMap(readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8'))
    const blocks = loadBlocks(root)
    const probs = repoProblems(root, { minVariants: 0 }, new Set(Object.keys(styleMap)))
    if (probs.length) { for (const x of probs) console.error(`gen-blocks: ${x}`); console.error(`gen-blocks: 문제 ${probs.length}건 — 쓰지 않았다`); process.exit(1) }
    const dir = join(root, 'registry', 'factory', 'blocks')
    const out = join(dir, COMPILED)
    const files = await compileAll(root, styleMap)
    const left = leftoverHooks(files)
    if (left.length) { for (const x of left) console.error(`gen-blocks: ${x}`); console.error(`gen-blocks: 컴파일되지 않은 훅 ${left.length}건 — 쓰지 않았다`); process.exit(1) }
    const items = blockItems({ repo: 'nowwcastle-sudo/sitebrew', ref, versions, root })
    // 원천이 사라진 컴파일본을 치운다(폴더째 다시 쓴다 — 생성물 폴더다). 컴파일·항목이 다 된 뒤에만 지운다.
    if (existsSync(out)) rmSync(out, { recursive: true })
    for (const [rel, text] of Object.entries(files)) { mkdirSync(dirname(join(out, rel)), { recursive: true }); writeFileSync(join(out, rel), text) }
    mkdirSync(out, { recursive: true })
    writeFileSync(join(out, MARKER), `생성물 — ${GENERATOR} 로 다시 만든다. 손으로 고치지 않는다. 원천: registry/factory/blocks/<kind>/*.tsx · _shared/*.tsx + registry/factory/styles/base.css\n`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'registry.json'), JSON.stringify({ $schema: 'https://ui.shadcn.com/schema/registry.json', items }, null, 2) + '\n')
    const kinds = new Set(blocks.map((b) => b.kind)).size
    console.log(`gen-blocks: 블록 ${blocks.length}개(kind ${kinds}종) · 조각 ${loadShared(root).length}개 → 컴파일본 ${Object.keys(files).length}개 · 항목 ${items.length}개`)
  } catch (e) {
    console.error(`gen-blocks: 도구 실패: ${e instanceof Error ? e.message : String(e)} — 쓰지 않았다`)
    process.exit(1)
  }
}
