// ai/ 생성물과 그 원천의 모양(zod 4). gen-ai.mjs 가 쓰기 전에, gen-ai.test.mjs 가 커밋된 파일에 건다.
import { z } from 'zod'
import { shadcnAddPattern } from '../scripts/lib/pins.mjs'

const text = z.string().min(1)
export const AREAS = ['part', 'block', 'recipe', 'font', 'install', 'contract']
export const GENERATED = '생성물 — factory/scripts/gen-ai.mjs 로 다시 만든다. 손으로 고치지 않는다.'

export const Gotcha = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  area: z.enum(AREAS),
  rule: text.refine((s) => !s.includes('\n'), 'rule 은 한 줄(docs/agents/agent-guide.md 목록 한 줄)'),
  action: text,
  source: text,
}).strict()

const uniqueIds = (list) => new Set(list.map((g) => g.id)).size === list.length

// 원천(factory/ai/gotchas.source.json)
export const GotchasSource = z.object({
  $comment: text,
  gotchas: z.array(Gotcha).min(1).refine(uniqueIds, 'gotcha id 가 겹친다'),
}).strict()

// 생성물 ai/gotchas.json
export const GotchasFile = z.object({
  $comment: z.literal(GENERATED),
  source: z.literal('factory/ai/gotchas.source.json'),
  mirror: z.literal('docs/agents/agent-guide.md §5'),
  gotchas: z.array(Gotcha).min(1).refine(uniqueIds, 'gotcha id 가 겹친다'),
}).strict()

const tag = z.string().regex(/^v\d+\.\d+\.\d+$/)
const install = z.string().regex(shadcnAddPattern())

// 섹션 한 줄 — 블록에 묶였으면 allowedVariants(블록 이름), 없으면 noBlock(이유·대장 행). 원형 JSON v1(P3-3 Task 1).
const Section = z.object({
  kind: text,
  blockKinds: z.array(text),
  allowedVariants: z.array(z.string().regex(/^block-[a-z0-9-]+$/)),
  // render·missing: 본문·부품 섹션을 06 이 어떻게 그리는지(렌더러·콘텐츠 자리) 또는 스키마에 없는 자료(대장 C70) — 모양 검사는 원천 쪽 archetypes.mjs ContentRender
  noBlock: z.object({ mode: z.enum(['content', 'part', 'pending']), reason: text, parts: z.array(text).optional(), register: z.array(text).optional(), render: z.record(z.string(), z.unknown()).optional(), missing: text.optional() }).strict().optional(),
}).strict()

// 원형 하나가 쓸 수 있는 블록 한 칸(P3-2 Task 9) — 블록 메타 `archetypes` 에 그 원형을 적은 블록. item 은 레지스트리 항목 이름(`block-<kind>-<variant>`).
const blockRef = z.object({
  item: z.string().regex(/^block-[a-z0-9]+(-[a-z0-9]+)+$/),
  variant: text, layout: text, density: z.enum(['compact', 'comfortable', 'spacious']),
  sectionKinds: z.array(text).min(1), // 블록 메타 archetypeKinds — 원형 JSON 섹션 kind 와 맞춘다
  states: z.array(text), media: z.array(text), install,
}).strict()

// 생성물 ai/tasks/<원형>.json
export const TaskFile = z.object({
  $comment: z.literal(GENERATED),
  id: z.string().regex(/^[a-z]+$/),
  source: z.string().regex(/^registry\/factory\/archetypes\/[a-z]+\.json$/),
  ref: tag,
  purpose: text,
  coreTask: text,
  completion: z.enum(['site', 'product']),
  locales: z.array(z.enum(['ko', 'en'])).min(1),
  pages: z.array(z.object({
    id: text,
    route: z.string().startsWith('/'),
    phase: z.enum(['v0', 'v0.2']).optional(),
    required: z.array(Section),
    optional: z.array(Section),
  }).strict()).min(1),
  globalSections: z.array(z.object({
    kind: text, required: z.boolean(), mustContain: z.array(text), condition: text.optional(), maxItems: z.number().int().positive().optional(),
  }).strict()),
  sectionOrders: z.array(z.object({ id: text, order: z.array(text).min(1) }).strict()),
  legal: z.array(z.object({ basis: text, appliesWhen: text, requirement: text, source: text }).passthrough()),
  legalPages: z.object({ pages: z.array(z.enum(['privacy', 'terms', 'refund', 'withdrawal'])), laws: z.object({ ko: z.array(text), en: z.array(text) }).strict() }).strict(),
  seo: z.object({ titleTemplate: z.string().includes('%s'), type: z.enum(['website', 'product', 'local', 'software']), install: z.object({ seoMetadata: install, jsonLdFor: install }).strict(), usage: text }).strict(),
  conversion: z.array(z.object({ event: text, match: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(), phase: z.enum(['v0', 'v0.2']).optional() }).strict()),
  content: z.object({ item: z.string().regex(/^content-[a-z]+$/), install }).strict(),
  recipes: z.object({
    // condition: 레시피 archetypeConditions[원형] — 이 원형에서 이 레시피를 쓸 수 있는 조건(Task 7 fix 1). 없으면 조건 없음.
    candidates: z.array(z.object({ id: text, name: text, install, condition: text.optional() }).strict()),
    complete: z.boolean(),
    note: text,
  }).strict(),
  // 블록 종류(kind) → 이 원형이 쓸 수 있는 블록 목록(P3-2 Task 9). 블록은 레시피 base 를 먼저 깐 뒤 설치한다(blocksNote).
  blocks: z.record(text, z.array(blockRef).min(1)),
  blocksNote: text,
}).strict()
