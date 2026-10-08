// 기준 커밋 대조 시험의 공용 로더(P3-5 I18N) — blocks-money.test.mjs 와 같은 방식: 바뀐 파일은 기준 커밋(BASE) 것으로, 나머지는 작업 트리 것으로 TypeScript 로 변환해
// 따로 불러온다(mode 'old' · 'new'). 기준 커밋이 없는 저장소(얕은 복제)에서는 baseOk 가 false 라 대조 시험이 건너뛴다.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

export const BASE = 'fdf8a09' // P3-5 I18N 이 시작한 커밋 — 한국어 출력 기준
export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const OUT = join(root, '.tmp', 'blocks-i18n-test')
export const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 })
export let baseOk = true
try { git('cat-file', '-e', `${BASE}:registry/factory/blocks/_shared/billing-format.tsx`) } catch { baseOk = false }
const CHANGED = new Set(baseOk ? git('diff', '--name-only', BASE, '--', 'registry/factory/blocks', 'registry/factory/ui-src', 'registry/factory/ui', 'registry/factory/contract').split('\n').filter(Boolean) : [])
const existsAtBase = (rel) => { try { git('cat-file', '-e', `${BASE}:${rel}`); return true } catch { return false } }

const loaded = new Map()
function transpile(abs, mode) {
  const key = `${mode}:${abs}`
  if (loaded.has(key)) return loaded.get(key)
  const rel = relative(root, abs).split('\\').join('/')
  const out = join(OUT, mode, rel.replace(/\.tsx?$/, '.mjs'))
  loaded.set(key, out)
  const old = mode === 'old' && CHANGED.has(rel) && existsAtBase(rel)
  const text = old ? git('show', `${BASE}:${rel}`) : readFileSync(abs, 'utf8')
  let { outputText } = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(src.endsWith('.mjs') ? src : transpile(src, mode)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
export const load = (rel, mode = 'new') => import(pathToFileURL(transpile(join(root, rel), mode)).href)
export const React = await import('react')
export const { renderToStaticMarkup } = await import('react-dom/server')
export const h = React.createElement
export const html = (el) => renderToStaticMarkup(el)
/**
 * 최종 라운드(FINAL-WF3·WF5)가 일부러 바꾼 출력을 걸러 낸다 — 한국어 글자 비교는 그대로 남는다.
 * 버튼 포커스 링 바깥 간격(WF3 10) · 이동 링크(Button href)의 role="button"·tabindex(WF3 11) · 빈 썸네일 「실제 사진 필요」 표지(WF3 9) · 하단 고정 바의 제자리 빈 칸(WF5 — 끝 여백으로 바뀜).
 */
export const stripFinalRound = (s) =>
  typeof s !== 'string'
    ? s
    : s
        .replace(/ focus-visible:ring-offset-2 focus-visible:ring-offset-background/g, '')
        .replace(/(<a\b[^>]*?) role="button"( tabindex="0")?/g, '$1')
        .replace(/(<a\b[^>]*?) tabindex="0"(?= data-slot="button")/g, '$1')
        .replace(/<span role="img"[^>]*data-photo-needed[^>]*><svg[^>]*>.*?<\/svg><span aria-hidden="true">[^<]*<\/span><\/span>/g, '')
        .replace(/<svg[^>]*lucide-image[^>]*>.*?<\/svg>/g, '')
        .replace(/<div aria-hidden="true" class="cn-block-bottom-spacer"><\/div>/g, '')
        // 체크박스 접근 이름(WF6 — 하이드레이션 전에도 이름이 있게 서버 HTML 에 aria-labelledby, 라벨에 id)
        .replace(/ aria-labelledby="[^"]*-(?:consent|marketing|trust|rememberMe)-label"/g, '')
        .replace(/(<label\b[^>]*?) id="[^"]*-(?:consent|marketing|trust|rememberMe)-label"/g, '$1')
