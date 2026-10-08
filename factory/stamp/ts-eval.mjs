// TS/TSX 파일을 노드에서 불러온다(P3-3 Task 9) — 블록 예시 모듈(<변형>.fixture.ts)을 찍어내기가 읽어 문구의 모양을 얻는다.
//   loadTs(절대경로) → 모듈 exports.  TS → .tmp/stamp-ts/<경로>.mjs 로 바꾸고(typescript transpileModule),
//   `@/registry/factory/…` import 는 저장소 원천으로, `./x`·`../x` import 는 같은 폴더 기준으로 풀어 file:// 주소로 바꾼다(재귀).
//   그 밖 bare import(zod·react …)는 노드가 저장소 node_modules 에서 푼다. 타입 전용 import 는 transpile 이 지운다.
//   변환본은 내용이 같으면 다시 쓰지 않고, 쓸 때는 임시 파일 + rename 이다(여러 프로세스가 같은 파일을 만들어도 안전).
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FACTORY = join(ROOT, 'registry', 'factory')
const OUT = join(ROOT, '.tmp', 'stamp-ts')
const ts = createRequire(join(ROOT, 'package.json'))('typescript')
const EXTS = ['.ts', '.tsx', '/index.ts', '/index.tsx']

const done = new Map()
const findSource = (base) => EXTS.map((e) => base + e).find(existsSync)
const outPathOf = (abs) => join(OUT, relative(ROOT, abs).replace(/\.tsx?$/, '.mjs'))

function transpile(abs) {
  if (done.has(abs)) return done.get(abs)
  const out = outPathOf(abs)
  done.set(abs, out)
  const { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  })
  const swap = (spec) => {
    const base = spec.startsWith('@/registry/factory/') ? join(FACTORY, spec.slice('@/registry/factory/'.length)) : spec.startsWith('.') ? resolve(dirname(abs), spec) : null
    if (!base) return null
    const src = findSource(base)
    if (!src) throw new Error(`ts-eval: import 대상 없음 ${spec} (${relative(ROOT, abs)})`)
    return pathToFileURL(transpile(src)).href
  }
  const text = outputText.replace(/(from\s+|import\s*\(?\s*)(["'])((?:@\/registry\/factory\/|\.{1,2}\/)[^"']*)\2/g, (m, kw, q, spec) => `${kw}${q}${swap(spec)}${q}`)
  mkdirSync(dirname(out), { recursive: true })
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) {
    const tmp = `${out}.${process.pid}.tmp`
    writeFileSync(tmp, text)
    renameSync(tmp, out)
  }
  return out
}

/** TS/TSX 파일(절대 경로)을 불러 exports 를 돌려준다. */
export const loadTs = (abs) => import(pathToFileURL(transpile(abs)).href)
