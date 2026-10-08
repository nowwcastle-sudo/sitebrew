// 원형 JSON(registry/factory/archetypes/<id>.json)의 copySlots·imageSlots → 원형 스키마(registry/factory/content/schemas/<id>.ts)의 생성 구역.
// 사용: node factory/scripts/gen-content-slots.mjs   (npm run gen:all 이 gen-registry 앞에서 돌린다 — check:regen 이 덮는다)
// 스키마 파일은 원천이지만 두 표시줄 사이(생성 구역)만 이 생성기가 쓴다. 같은 값을 두 곳에 손으로 적지 않는다(factory-rules.md §20-1).
// 한 원형 안에서 같은 칸 id 가 여러 섹션에 나오면 역할을 「 / 」로 잇는다. maxChars·aspect·source 가 어긋나면 멈춘다.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyRegion as replaceRegion } from './lib/registry-lib.mjs'
import { ARCHETYPE_PATH, ARCHETYPE_DIR } from './archetypes.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const ARCH_DIR = ARCHETYPE_PATH
export const SCHEMA_DIR = join(root, 'registry', 'factory', 'content', 'schemas')
export const BEGIN = '// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.'
export const END = '// ── 생성 구역 끝'

// 원형 JSON → { copy: { id: { role, maxChars } }, image: { id: { aspect, source } } } (처음 나온 순서)
export function slotDefs(archetype) {
  const copy = {}, image = {}
  for (const p of archetype.pages) for (const s of p.sections) {
    for (const c of s.copySlots) {
      const e = (copy[c.id] ??= { roles: [], maxChars: c.maxChars })
      if (e.maxChars !== c.maxChars) throw new Error(`${archetype.id}.${c.id}: maxChars 가 섹션마다 다르다(${e.maxChars} ≠ ${c.maxChars})`)
      if (!e.roles.includes(c.role)) e.roles.push(c.role)
    }
    for (const m of s.imageSlots) {
      const e = (image[m.id] ??= { aspect: m.aspect, source: m.source })
      if (e.aspect !== m.aspect || e.source !== m.source) throw new Error(`${archetype.id}.${m.id}: 이미지 칸 정의가 섹션마다 다르다`)
    }
  }
  return {
    copy: Object.fromEntries(Object.entries(copy).map(([k, v]) => [k, { role: v.roles.join(' / '), maxChars: v.maxChars }])),
    image,
  }
}

const key = (k) => (/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k))
export function slotBlock(archetype) {
  const { copy, image } = slotDefs(archetype)
  const q = JSON.stringify
  return [
    BEGIN,
    `/** 문구 칸 정의 — ${ARCHETYPE_DIR}/${archetype.id}.json 의 copySlots. */`,
    'export const COPY_SLOTS = {',
    ...Object.entries(copy).map(([k, v]) => `  ${key(k)}: { role: ${q(v.role)}, maxChars: ${v.maxChars} },`),
    '} as const satisfies CopySlotDefs',
    '',
    `/** 이미지 칸 정의 — ${ARCHETYPE_DIR}/${archetype.id}.json 의 imageSlots(비율·출처 정책). */`,
    'export const IMAGE_SLOTS = {',
    ...Object.entries(image).map(([k, v]) => `  ${key(k)}: { aspect: ${q(v.aspect)}, source: ${q(v.source)} },`),
    '} as const satisfies ImageSlotDefs',
    END,
  ].join('\n')
}

// 스키마 원천의 생성 구역을 바꾼다(registry-lib applyRegion — 표시줄이 없으면 멈추고, 줄바꿈은 원본 것을 따른다).
export const applyRegion = (source, block) => replaceRegion(source, block, { begin: BEGIN, end: END, where: '원형 스키마 파일' })

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const ids = readdirSync(ARCH_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
  let changed = 0
  for (const id of ids) {
    const file = join(SCHEMA_DIR, `${id}.ts`)
    if (!existsSync(file)) throw new Error(`원형 스키마가 없다: ${file}`)
    const before = readFileSync(file, 'utf8')
    const after = applyRegion(before, slotBlock(JSON.parse(readFileSync(join(ARCH_DIR, `${id}.json`), 'utf8'))))
    if (after !== before) { writeFileSync(file, after); changed++ }
  }
  console.log(`gen-content-slots: 원형 ${ids.length}개, 바뀐 파일 ${changed}개`)
}
