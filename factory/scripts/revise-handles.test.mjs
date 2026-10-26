// 축 사실(사전 axes 의 order·rank·sectionIntent)과 손잡이 배선(factory/stamp/handles.yaml)·여백 토큰(spacing.json)의 일관성.
// 값은 한 집에만 있다 — 축 사실은 사전, 손잡이 배선은 handles.yaml, 여백 CSS 수치는 spacing.json. 이 시험은 그 셋이 서로 맞는지를 본다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { AXES, DEFAULT_FILE, LexiconError, loadLexicon } from '../vocab/lexicon.mjs'
import { HANDLES_FILE, loadHandles } from '../stamp/handles.mjs'
import { BLOCKS } from '../stamp/handles/index.mjs'
import { COLOR_NAMES } from '../stamp/revise-values.mjs'
import { COMPAT } from './compat.mjs'
import { COLOR_LOGICS, SPACING_DEFAULT, parseRecipe, recipeCss, spacingVars } from './recipe.mjs'

const lex = loadLexicon()
const handles = loadHandles(lex)
const spacing = JSON.parse(readFileSync(new URL('./spacing.json', import.meta.url), 'utf8'))
const baseCss = readFileSync(new URL('../../registry/factory/styles/base.css', import.meta.url), 'utf8')

/** 손잡이 field(레시피 머리 칸)가 받는 값 목록 — rank 값이 compat.json 의 축 값인지 가린다. */
const MOTIONS = ['M0', 'M1', 'M2', 'M3']
const valuesOf = (field) => (field === 'colorLogic' ? COLOR_LOGICS : field === 'motion' ? MOTIONS : COMPAT.axes[field.replace(/^axes\./, '')])

/** 사전 yaml 을 고쳐 임시 파일로 쓰고 loadLexicon 이 던지는지 본다. */
function lexiconFails(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'revise-handles-test-'))
  try {
    const doc = parse(readFileSync(DEFAULT_FILE, 'utf8'))
    mutate(doc.axes)
    const f = join(dir, 'lex.yaml')
    writeFileSync(f, stringify(doc))
    assert.throws(() => loadLexicon(f), LexiconError)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('handles: 사전 AXES 12개 모두 손잡이가 있고 kind 마다 블록 모듈이 있다 · 모듈마다 쓰는 축이 있다', () => {
  assert.deepEqual(Object.keys(handles.axes).sort(), [...AXES].sort())
  for (const [id, h] of Object.entries(handles.axes)) assert.equal(typeof BLOCKS[h.kind]?.step, 'function', `${id}: kind ${h.kind} 의 블록 모듈(step)이 없다`)
  for (const kind of Object.keys(BLOCKS)) assert.ok(Object.values(handles.axes).some((h) => h.kind === kind), `kind ${kind} 를 쓰는 축이 없다`)
})

test('handles: order 형은 사전 order 가 있고, rank 형은 사전 rank 가 있다 · rank 값은 compat.json 축 값이다', () => {
  for (const [id, h] of Object.entries(handles.axes)) {
    if (h.kind === 'order') {
      assert.deepEqual(h.order, lex.axes[id].order, `${id}: order 는 사전에서 채운다`)
      // 여백(spacing)은 레시피 값이 아니라 새 칸이라 compat 값이 없다 — 있는 축만 맞춘다.
      for (const v of valuesOf(h.field) ? h.order : []) assert.ok(valuesOf(h.field).includes(v), `${id}: ${v} 가 ${h.field} 의 값이 아니다`)
    }
    if (h.kind === 'rank') {
      assert.deepEqual(h.rank, lex.axes[id].rank, `${id}: rank 는 사전에서 채운다`)
      for (const v of Object.keys(h.rank)) assert.ok(valuesOf(h.field).includes(v), `${id}: ${v} 가 ${h.field} 의 값이 아니다`)
      assert.equal(new Set(Object.values(h.rank)).size > 1, true, `${id}: 등급이 하나뿐이다`)
    }
  }
  assert.equal(handles.axes.spacing.default, SPACING_DEFAULT)
  assert.ok(handles.axes.spacing.order.includes(handles.axes.spacing.default))
  for (const h of Object.values(handles.axes)) for (const a of h.repair ?? []) assert.ok(COMPAT.axes[a], `repair 의 ${a} 는 compat 축이 아니다`)
})

test('handles: values.color-hue 가 사전 valueLabels 21개를 모두 덮는다 · type-family 9개 모두', () => {
  for (const axis of ['color-hue', 'type-family']) {
    assert.deepEqual(Object.keys(handles.values[axis]).sort(), Object.keys(lex.axes[axis].valueLabels).sort(), `${axis}: 값 목록이 사전과 같아야 한다`)
  }
  assert.equal(Object.keys(handles.values['color-hue']).length, 21)
  assert.equal(Object.keys(handles.values['type-family']).length, 9)
  const named = new Set(COLOR_NAMES.map((c) => c.key))
  for (const [id, v] of Object.entries(handles.values['color-hue'])) {
    if (v.avoidHueFamilies) continue
    assert.equal(v.name, lex.axes['color-hue'].valueLabels[id], `${id}: name 은 사전 한국어 이름과 같다`)
    if (v.hex === undefined) assert.ok(named.has(id), `${id}: hex 도 COLOR_NAMES 도 없다`)
    else assert.match(v.hex, /^#[0-9A-Fa-f]{6}$/, `${id}: hex 모양`)
  }
})

test('handles: 모르는 축·모듈 없는 kind·사전 order 없는 order 형은 던진다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'revise-handles-test-'))
  try {
    const doc = parse(readFileSync(HANDLES_FILE, 'utf8'))
    const write = (d) => { const f = join(dir, 'handles.yaml'); writeFileSync(f, stringify(d)); return f }
    assert.throws(() => loadHandles(lex, write({ ...doc, axes: { ...doc.axes, bogus: { kind: 'order' } } })), /bogus/)
    assert.throws(() => loadHandles(lex, write({ ...doc, axes: { ...doc.axes, motion: { kind: 'nothing', field: 'motion' } } })), /nothing/)
    assert.throws(() => loadHandles(lex, write({ ...doc, axes: { ...doc.axes, motion: { kind: 'toString', field: 'motion' } } })), /toString/)
    const bare = structuredClone(lex)
    delete bare.axes['type-scale'].order
    assert.throws(() => loadHandles(bare), /type-scale/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('lexicon: 새 칸(order·rank·sectionIntent) 모양이 틀리면 loadLexicon 이 던진다', () => {
  lexiconFails((axes) => { axes.spacing.order = ['tight'] }) // 순서는 2개 이상
  lexiconFails((axes) => { axes.depth.rank = { S0: -1, S1: 0 } }) // 등급은 0 이상 정수
  lexiconFails((axes) => { axes.depth.rank = { S0: 0.5, S1: 1 } })
  lexiconFails((axes) => { axes.depth.order = ['S0', 'S1'] }) // order 와 rank 는 함께 쓰지 않는다
  lexiconFails((axes) => { axes['color-hue'].rank = { red: 0, blue: 1 } }) // ends 없는 축에는 못 건다
  lexiconFails((axes) => { axes['type-scale'].sectionIntent = { larger: 'bolder', bigger: 'calmer' } }) // 키는 축 ends 중 하나
  lexiconFails((axes) => { axes.spacing.sectionIntent = { airy: 3 } })
})

test('lexicon: 순서·등급·구획 의도 값이 있다 — 낮은 등급이 ends[0] 쪽', () => {
  assert.deepEqual(lex.axes.spacing.order, ['tight', 'normal', 'airy'])
  assert.deepEqual(lex.axes.depth.rank, { S0: 0, S1: 1, S2: 1, S3: 2 })
  assert.deepEqual(lex.axes.contrast.rank, { C3: 0, C5: 0, C1: 1, C4: 1, C2: 2, C6: 3, C8: 3 })
  assert.deepEqual(lex.axes['palette-count'].rank, { K3: 0, K9: 0, K1: 1, K5: 1, K4: 2, K7: 2, K2: 3, K6: 3, K8: 4 })
  assert.deepEqual(lex.axes.spacing.sectionIntent, { airy: { density: 'spacious' }, tight: { density: 'compact' } })
  assert.deepEqual(lex.axes['type-scale'].sectionIntent, { larger: 'bolder', smaller: 'calmer' })
  for (const id of ['depth', 'contrast', 'palette-count']) assert.equal(Math.min(...Object.values(lex.axes[id].rank)), 0, `${id}: 가장 낮은 등급은 0`)
})

test('spacing: spacing.json 단계 이름 = 사전 spacing order · normal 은 base.css 기본값과 같다(16·24·10·12)', () => {
  assert.deepEqual(Object.keys(spacing), lex.axes.spacing.order)
  assert.deepEqual(spacing.normal, { py: 16, pyMd: 24, gap: 10, gapMd: 12 })
  const section = baseCss.match(/\.cn-block-section \{([\s\S]*?)\n\}/)[1]
  const fallback = (name) => Number(section.match(new RegExp(`--wf-section-${name},calc\\(var\\(--spacing\\)\\*(\\d+)\\)`))?.[1])
  assert.deepEqual({ py: fallback('py'), pyMd: fallback('py-md'), gap: fallback('gap'), gapMd: fallback('gap-md') }, spacing.normal)
  for (const [level, v] of Object.entries(spacing)) assert.deepEqual(Object.keys(v), ['py', 'pyMd', 'gap', 'gapMd'], `${level}: 칸 네 개`)
})

test('recipeCss: head.spacing 이 airy 면 --wf-section-py 가 있고, 없으면 없다', () => {
  const md = readFileSync(new URL('../../registry/factory/recipes/r1-measure/DESIGN.md', import.meta.url), 'utf8')
  const head = parseRecipe(md)
  assert.doesNotMatch(recipeCss(head), /--wf-section-/)
  assert.doesNotMatch(recipeCss({ ...head, spacing: SPACING_DEFAULT }), /--wf-section-/)
  const css = recipeCss({ ...head, spacing: 'airy' })
  assert.match(css, /--wf-section-py: calc\(var\(--spacing\) \* 24\);/)
  for (const name of Object.keys(spacingVars('airy'))) assert.ok(css.includes(`--${name}:`), name)
  assert.deepEqual(Object.keys(spacingVars('tight')), ['wf-section-py', 'wf-section-py-md', 'wf-section-gap', 'wf-section-gap-md'])
  assert.throws(() => spacingVars('huge'), /huge/)
})
