// 기준 커밋 대조 로더(FV1 Task 5.14) — `base-compare.mjs` 와 같은 방식이지만 기준 커밋을 인자로 받는다(그 파일의 BASE 는 P3-5 시작 커밋 하나로 고정이다).
// 쓰는 법: `const { load, baseOk } = makeBaseLoader('c3f1e351')` → `load('registry/factory/blocks/_shared/price-tag.tsx', 'old' | 'new')`.
// old = 기준 커밋에서 바뀐 파일은 그 커밋의 것, 나머지는 작업 트리 것. 기준 커밋이 없는 저장소(얕은 복제)에서는 baseOk 가 false 라 대조 시험이 건너뛴다.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 })

export function makeBaseLoader(base, outName = 'base-compare-at') {
  let baseOk = true
  try { git('cat-file', '-e', `${base}:package.json`) } catch { baseOk = false }
  const OUT = join(root, '.tmp', outName)
  const changed = new Set(baseOk ? git('diff', '--name-only', base, '--', 'registry/factory').split('\n').filter(Boolean) : [])
  const existsAtBase = (rel) => { try { git('cat-file', '-e', `${base}:${rel}`); return true } catch { return false } }
  const loaded = new Map()
  function transpile(abs, mode) {
    const key = `${mode}:${abs}`
    if (loaded.has(key)) return loaded.get(key)
    const rel = relative(root, abs).split('\\').join('/')
    const out = join(OUT, mode, rel.replace(/\.tsx?$/, '.mjs'))
    loaded.set(key, out)
    const old = mode === 'old' && changed.has(rel) && existsAtBase(rel)
    const text = old ? git('show', `${base}:${rel}`) : readFileSync(abs, 'utf8')
    let { outputText } = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
    outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
      const b = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
      const src = [b, `${b}.ts`, `${b}.tsx`, join(b, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
      if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
      return `${kw}${q}${pathToFileURL(src.endsWith('.mjs') ? src : transpile(src, mode)).href}${q}`
    })
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, outputText)
    return out
  }
  return { baseOk, base, load: (rel, mode = 'new') => import(pathToFileURL(transpile(join(root, rel), mode)).href) }
}
