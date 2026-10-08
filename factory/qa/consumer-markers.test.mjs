// consumer-markers: 브라우저·소비자 없이 판정 함수와 CLI 인자·--dry-run 을 본다(실제 소비자 확인은 Step 8, 보고서 참고).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expectedMarkers, judgeMarkers, shapeStrings, whichPart, isGeist } from './consumer-markers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const RECIPE_BUTTON = read('registry/factory/r/r1-measure/ui/button.tsx')
const BASE_BUTTON = read('registry/factory/ui/button.tsx')
const run = (...args) => spawnSync(process.execPath, [join(here, 'consumer-markers.mjs'), ...args], { encoding: 'utf8' })

// shadcn 설치가 하는 일을 흉내 낸다: import 경로를 별칭으로 바꾸고 머리 주석을 지우고 CRLF 로.
const installed = (src) => src.replace(/from "cn"/g, 'from "@/lib/utils"').replace(/@\/registry\/factory\/[^"]+\/ui\//g, '@/components/ui/')
  .replace(/^\/\/.*\n/gm, '').replace(/\n/g, '\r\n')

test('expectedMarkers: 레시피 base 항목의 cssVars 표지를 읽는다, 없는 레시피는 던진다', () => {
  assert.deepEqual(expectedMarkers('r1-measure'), { axes: '"B1 I3 C2 T4 H3 R0 S0"', tuned: '"display body mono"', partsOf: 'r1-measure' })
  // 보드 B안 항목(P3-2 Task 8): 표지는 B 머리 값, 부품 비교는 A 레시피 폴더
  assert.equal(expectedMarkers('r1-measure-alt').partsOf, 'r1-measure')
  assert.equal(expectedMarkers('r1-measure-alt').axes, expectedMarkers('r1-measure').axes)
  assert.throws(() => expectedMarkers('r9-none'), /r9-none/)
  assert.throws(() => expectedMarkers('x', { items: [{ name: 'x', type: 'registry:base', cssVars: { light: {} } }] }), /표지/)
})

test('judgeMarkers: 같으면 문제 0, 빠지거나 다르면 문제', () => {
  const e = expectedMarkers('r1-measure')
  assert.deepEqual(judgeMarkers({ ...e }, e), [])
  assert.equal(judgeMarkers({ axes: '', tuned: e.tuned }, e).length, 1)
  assert.equal(judgeMarkers({ axes: '"B2"', tuned: '' }, e).length, 2)
  assert.equal(judgeMarkers(undefined, e).length, 2)
})

test('whichPart: 설치된 레시피 버튼은 recipe, 기본 버튼은 base, 손본 파일은 unknown', () => {
  assert.notDeepEqual(shapeStrings(RECIPE_BUTTON), shapeStrings(BASE_BUTTON))
  assert.equal(whichPart(installed(RECIPE_BUTTON), RECIPE_BUTTON, BASE_BUTTON), 'recipe')
  assert.equal(whichPart(installed(BASE_BUTTON), RECIPE_BUTTON, BASE_BUTTON), 'base')
  assert.equal(whichPart(installed(RECIPE_BUTTON).replace('rounded-none', 'rounded-xl'), RECIPE_BUTTON, BASE_BUTTON), 'unknown')
})

test('isGeist: init 의 Geist 스택을 알아본다', () => {
  assert.equal(isGeist('"Geist", "Geist Fallback"'), true)
  assert.equal(isGeist('var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR")'), false)
  assert.equal(isGeist(undefined), false)
})

test('CLI: --dry-run 은 브라우저 없이 기대값을 내고 0, 인자 오류는 2', () => {
  const dry = run('--dry-run', '--recipe', 'r1-measure')
  assert.equal(dry.status, 0, dry.stderr)
  assert.deepEqual(JSON.parse(dry.stdout).expected, expectedMarkers('r1-measure'))
  assert.equal(run('--dry-run').status, 2)
  assert.equal(run('http://localhost:1/').status, 2)
  assert.equal(run('--dry-run', '--recipe', 'r9-none').status, 2)
  assert.equal(run('--recipe', 'r1-measure', '--bogus').status, 2)
})
