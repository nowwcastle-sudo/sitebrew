// 손잡이 배선 로더(설계 5.10). factory/stamp/handles.yaml(배선) + 사전 axes(순서·등급)를 한 모양으로 합친다.
//   loadHandles(lex) → { axes: { [AxisId]: Handle }, palette, values, elements, redraw }
//   Handle = { kind, field?, order?, rank?, repair?, recolor?, default? } — order·rank 는 사전에서 채운다.
// 사전 axes 에 없는 축이나 블록 모듈이 없는 kind(handles/blocks.mjs 등록부에 없는 것)를 적은 배선은 던진다. 네트워크 없음.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { z } from 'zod'
import { BLOCKS } from './handles/blocks.mjs'

export const HANDLES_FILE = join(dirname(fileURLToPath(import.meta.url)), 'handles.yaml')

const names = z.array(z.string().min(1))
const handle = z.strictObject({
  kind: z.string().min(1),
  field: z.string().min(1).optional(),
  repair: names.optional(),
  recolor: z.literal(true).optional(),
  default: z.string().min(1).optional(),
})
const value = z.strictObject({
  name: z.string().min(1).optional(),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '#rrggbb 모양').optional(),
  avoidHueFamilies: names.optional(),
  category: z.string().min(1).optional(),
  notCurrent: names.optional(),
})
const file = z.strictObject({
  axes: z.record(z.string(), handle),
  palette: z.strictObject({
    pool: z.literal('recipe'),
    temperature: z.record(z.string(), names),
    saturation: z.record(z.string(), names),
    lightness: z.strictObject({ by: z.string().min(1) }),
  }),
  values: z.record(z.string(), z.record(z.string(), value)),
  elements: z.record(z.string(), z.record(z.string(), z.string().min(1))),
  redraw: z.strictObject({ minAxesDelta: z.number().int().min(1) }),
})

/** @param {object} lex loadLexicon() 결과 @param {string} [path] 기본은 handles.yaml */
export function loadHandles(lex, path = HANDLES_FILE) {
  const r = file.safeParse(parse(readFileSync(path, 'utf8')))
  if (!r.success) throw new Error(`손잡이 배선 모양 위반:\n- ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n- ')}`)
  const axes = {}
  for (const [id, h] of Object.entries(r.data.axes)) {
    const def = lex.axes[id]
    if (!def) throw new Error(`손잡이 ${id}: 사전 axes 에 없는 축이다`)
    if (!Object.hasOwn(BLOCKS, h.kind)) throw new Error(`손잡이 ${id}: kind ${h.kind} 의 모듈이 없다(${Object.keys(BLOCKS).join('·')})`)
    if (h.kind === 'order' && !def.order) throw new Error(`손잡이 ${id}: order 형인데 사전 axes.${id}.order 가 없다`)
    if (h.kind === 'rank' && !def.rank) throw new Error(`손잡이 ${id}: rank 형인데 사전 axes.${id}.rank 가 없다`)
    axes[id] = { ...h, ...(h.kind === 'order' ? { order: def.order } : {}), ...(h.kind === 'rank' ? { rank: def.rank } : {}) }
  }
  const { palette, values, elements, redraw } = r.data
  return { axes, palette, values, elements, redraw }
}
