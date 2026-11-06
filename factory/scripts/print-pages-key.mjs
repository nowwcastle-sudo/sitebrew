// 06 코드 열쇠 확인 도구 — v0.2.6 개선 라운드의 Phase A 불변 검사용.
// stdout 에 JSON 한 문서 `{ key, closure }` 를 낸다. key = pagesCodeKey()(64자 16진), closure = importClosure() 의 저장소 상대 경로(정렬).
// 이 파일은 열쇠 닫힘 밖이다(gen-pages.mjs·ui-copy.mjs 가 import 하지 않는다) — 열쇠에 영향을 주지 않는다.
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importClosure, pagesCodeKey } from '../stamp/pages-key.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 절대 경로를 저장소 상대 경로(슬래시 구분)로 바꾼다. */
const rel = (file) => relative(ROOT, file).split(sep).join('/')

export function printPagesKey() {
  return { key: pagesCodeKey({ root: ROOT }), closure: importClosure().map(rel) }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(`${JSON.stringify(printPagesKey(), null, 2)}\n`)
}
