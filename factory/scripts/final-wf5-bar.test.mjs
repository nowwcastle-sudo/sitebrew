// FINAL-WF5 항목 2 — 하단 고정 바가 푸터 연락처 링크의 초점을 일부 가린다(2.4.11, 대장 C424).
// 원인: bottom-tab 블록이 줄 높이만큼 「제자리 빈 칸」(cn-block-bottom-spacer)을 본문 끝에 두었다 — 푸터(SiteShell)는 그 빈 칸 뒤에 오므로 문서 맨 아래 푸터 링크가 줄 밑에 깔렸다
//   (local-1 실측: 375·1440 에서 푸터 전화·메일 링크 2곳이 9px 가려짐, a11y-gate 경고 「초점 2곳이 일부 가려진다」).
// 고침: 쿠키 띠(consent/bottom-banner)와 같은 useBottomBarSpace(bar, { pad: true }) — 줄이 가리는 만큼 문서 끝 여백만 더한다(훅 동작 시험은 rel11-browser.test.mjs).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/final-wf5-bar.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')
const BARS = ['icon-tabs', 'split-booking-bar', 'sticky-action-bar']

for (const b of BARS) {
  test(`bottom-tab/${b}: 줄 뒤에 오는 푸터를 위해 문서 끝 여백(pad)을 쓰고 제자리 빈 칸은 두지 않는다`, () => {
    const s = read('registry', 'factory', 'blocks', 'bottom-tab', `${b}.tsx`)
    assert.match(s, /useBottomBarSpace\(bar, \{ pad: true \}\)/)
    assert.doesNotMatch(s, /cn-block-bottom-spacer/, '제자리 빈 칸이 푸터 앞에 남는다')
  })
}

test('split-booking-bar: 안내 글이 없으면(버튼만) 데스크톱에서 가운데 정렬 훅을 단다 — justify-between 은 자식 하나를 왼쪽에 둔다', () => {
  const s = read('registry', 'factory', 'blocks', 'bottom-tab', 'split-booking-bar.tsx')
  assert.match(s, /data-solo=\{copy\.note \? undefined : ""\}/)
  const css = read('registry', 'factory', 'styles', 'base.css')
  const rule = css.match(/\.cn-block-bottom-split-row \{\s*@apply ([^;]+);/)
  assert.ok(rule, 'base.css 에 split-row 훅이 없다')
  assert.match(rule[1], /md:justify-between/)
  assert.match(rule[1], /md:data-\[solo\]:justify-center/, 'data-solo 면 가운데(변형이 기본보다 뒤라 이긴다)')
})

test('base.css 에 쓰는 곳 없는 cn-block-bottom-spacer 훅이 남지 않는다', () => {
  assert.doesNotMatch(read('registry', 'factory', 'styles', 'base.css'), /\.cn-block-bottom-spacer\b/)
})
