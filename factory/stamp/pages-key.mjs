// 06-pages 입력 해시에 넣는 「코드 열쇠」(대장 C314) — 06 의 입력(사이트맵·변형·콘텐츠·미디어·법정)은 같아도 사이트를 만드는 코드가 바뀌면 결과가 달라진다.
// 입력 해시가 코드 변경을 못 보면 병합 뒤에도 끝난 골든이 「옛 코드의 결과」로 남아, 「이 태그 코드의 결과」라는 증명이 되지 않는다(v0.0.8 골든 18).
// 열쇠 = 아래 셋의 해시:
//   ① 블록·부품·레시피 등 `registry/factory/**` 전부와 `registry.json`·`package.json`(repoRegistryKey — 블록 소스·메타·예시(fixture)·컴파일본·원형 JSON·콘텐츠 스키마가 한꺼번에)
//   ② 사이트 템플릿 파일(templateHash — `site-template/**`)
//   ③ 06 이 부르는 코드: gen-pages.mjs 에서 상대 경로 import 를 따라가 모은 `factory/**` 모듈 전부(site-bind·site-install·ui-copy·content-sections·법정 초안 drafts … — 목록을 손으로 적지 않아
//      새 모듈을 import 해도 빠지지 않는다)
// 잃는 것: 위 파일 어느 하나라도 바뀌면(주석 포함) 끝난 06 이 다시 돈다 — 안전한 쪽으로 틀린다.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { repoRegistryKey, templateHash } from './site-install.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
// 진입 파일: gen-pages 와 ui-copy(06 의 문구 칸 잎 계산 — gen-pages 가 부르는 쪽이 아니라 04 요청이 부르지만 같은 예시·종류 규칙을 쓴다)
const ENTRIES = [join(HERE, 'gen-pages.mjs'), join(HERE, 'ui-copy.mjs')]

const sha = (s) => createHash('sha256').update(s).digest('hex')
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\1/g

/** 진입 파일들에서 상대 경로 import(정적·동적)를 따라가 모은 모듈 파일(절대 경로, 정렬). `.mjs`·`.js`·`.ts`·`.tsx`·`.json` 만 따라간다. */
export function importClosure(entries = ENTRIES) {
  const seen = new Set()
  const visit = (file) => {
    if (seen.has(file) || !existsSync(file)) return
    seen.add(file)
    if (!/\.(?:mjs|js|ts|tsx)$/.test(file)) return
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(IMPORT)) {
      const spec = m[2]
      if (/\$\{/.test(spec)) continue // 템플릿 문자열 속 코드 예(생성 코드의 import)는 이 모듈의 import 가 아니다
      visit(resolve(dirname(file), spec))
    }
  }
  for (const e of [entries].flat()) visit(e)
  return [...seen].sort()
}

/** 06 코드 열쇠(64자 16진). */
export function pagesCodeKey({ root = ROOT, entries = ENTRIES } = {}) {
  const files = importClosure(entries)
  const code = sha(files.map((f) => `${f.slice(root.length)}\0${sha(readFileSync(f))}`).join('\n'))
  return sha(`${repoRegistryKey(root)}\n${templateHash()}\n${code}`)
}
