// 정적 내보내기 판별(모듈 E) — 사이트 폴더의 next.config 가 output: "export" 이면 빌드가 서버가 아니라 정적 파일 폴더(기본 out)를 만든다.
//   exportDir(dir, fs) → 내보내기 폴더 이름('out' 또는 distDir 값) | null(서버형). distDir 이 사이트 폴더 밖이면 reason unsafeExportDir 로 던진다.
//   · 설정 파일을 실행하지 않고 글자만 읽는다(사용자 코드를 돌리지 않는다). 주석은 뺀다.
//   · output 이 따옴표 글자 하나(export)일 때만 맞는다 — 환경 변수로 갈리는 설정(`cond ? 'export' : undefined`)은 서버형으로 본다.
//   · 설정 파일이 없거나 못 읽으면 null — 서버형으로 두고, 잘못 짚은 경우는 서버 켜기 단계가 reason exportNeedsStatic 으로 알린다.
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, posix, relative, resolve, sep, win32 } from 'node:path'
import { isNetworkOrDevicePath } from '../lib/safe-path.mjs'

const CONFIG_NAMES = ['next.config.mjs', 'next.config.js', 'next.config.ts', 'next.config.cjs', 'next.config.mts']
const DEFAULT_OUT = 'out'
const OUTPUT_EXPORT = /(?:^|[\s{,])output\s*:\s*(['"`])export\1/
const DIST_DIR = /(?:^|[\s{,])distDir\s*:\s*(['"`])([^'"`]+)\1/
const defaultFs = { exists: existsSync, readFile: (p) => readFileSync(p, 'utf8') }

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** distDir 이 사이트 폴더 안의 하위 폴더 이름인가(상대·`..` 없음·드라이브·UNC 아님·정규화해도 사이트 폴더 안). */
export function isSafeDistDir(dir, name) {
  if (typeof name !== 'string' || name.trim() === '' || name.includes('\0')) return false
  if (isAbsolute(name) || posix.isAbsolute(name) || win32.isAbsolute(name) || isNetworkOrDevicePath(name) || /^[a-zA-Z]:/.test(name)) return false
  if (name.split(/[\\/]/).includes('..')) return false
  const rel = relative(resolve(dir), resolve(dir, name))
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)
}

/**
 * 내보내기 폴더 이름. 정적 내보내기 사이트가 아니면 null.
 * distDir 이 사이트 폴더 밖을 가리키면(`../..`·절대·UNC) null 이 아니라 reason `unsafeExportDir` 을 단 오류를 던진다 — 서버형으로 조용히 넘기면 next start 가 다른 길을 연다.
 */
export function exportDir(dir, fs = defaultFs) {
  for (const name of CONFIG_NAMES) {
    const file = join(dir, name)
    if (!fs.exists(file)) continue
    let src
    try { src = stripComments(fs.readFile(file)) } catch { return null }
    if (!OUTPUT_EXPORT.test(src)) return null
    const dist = src.match(DIST_DIR)?.[2] ?? DEFAULT_OUT
    if (!isSafeDistDir(dir, dist)) throw Object.assign(new Error(`distDir is outside the site folder: ${dist}`), { reason: 'unsafeExportDir' })
    return dist
  }
  return null
}
