// C310 — 일부러 화면 밖으로 잘리는 창 목업의 면제 표지. hero/narrow-title-wide-window 의 앱 창(role="img" 일러스트)은 375 에서
// 뷰포트 오른쪽으로 일부러 잘리는 설계라, ux-gate 「text clipped by ancestor」(factory/qa/text-boxes.mjs — `[data-clip-ok]` 아래 글은 잘림에서 뺀다)에
// 면제 표지가 있어야 한다. 표지가 빠지면 골든 saas-1/b·c·saas-2/b 의 375 관문이 떨어진다(대장 C310).
// 정적 시험(브라우저 없음) — 원천과 컴파일본(gen:all 생성물)이 같은 표지를 가졌는지 본다. 실제 잘림 판정은 blocks:gates 가 맡는다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/blocks-clip-ok.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const SRC = 'registry/factory/blocks/hero/narrow-title-wide-window.tsx'
const COMPILED = 'registry/factory/blocks/_compiled/hero/narrow-title-wide-window.tsx'

/** `<div …>` 여는 태그 중 nt-window 클래스를 가진 것(창 요소). */
const windowTag = (file) => {
  const s = readFileSync(join(root, file), 'utf8')
  const tags = [...s.matchAll(/<div\b[^>]*>/g)].map((m) => m[0]).filter((t) => /\bnt-window\b/.test(t) && /role="img"/.test(t))
  return tags
}

test('C310: 앱 창(role="img" nt-window)에 data-clip-ok 면제 표지가 있다 — 원천·컴파일본 모두', () => {
  for (const f of [SRC, COMPILED]) {
    const tags = windowTag(f)
    assert.equal(tags.length, 1, `${f}: 창 요소 ${tags.length}개`)
    assert.match(tags[0], /\bdata-clip-ok(=""|\s|>)/, `${f}: 창에 data-clip-ok 가 없다`)
  }
})

test('C310: 음성 대조 — 표지를 지운 창 태그는 이 검사가 잡는다', () => {
  const tag = windowTag(SRC)[0]
  assert.ok(!/\bdata-clip-ok(=""|\s|>)/.test(tag.replace(/\s*data-clip-ok=""/, '')))
})
