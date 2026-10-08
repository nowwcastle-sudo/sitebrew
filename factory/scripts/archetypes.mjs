// 원형 JSON v1 — 원천은 registry/factory/archetypes/<id>.json 이다(스펙 3판 §3 자리).
// 섹션은 블록 이름(allowedVariants = block-<kind>-<variant>)에 묶인다. 블록이 없는 섹션은 noBlock 으로 이유를 남긴다(C42·C55):
//   content — 콘텐츠 본문으로 그린다(전용 블록 없이도 된다)
//   part    — 블록은 없고 ui 부품(parts)으로 그린다
//   pending — 블록이 필요하다. 대장 행(register)이 있고, 그 블록이 생길 때까지 찍어내기가 비워 둔다
// 섹션 kind 는 원형 안의 섹션 이름(페이지 안에서 하나)이고, 어떤 블록 kind 로 그릴 수 있는지는 blockKinds 가 말한다.
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
/** 저장소 루트 기준 상대 경로(문서·메시지용). 읽는 쪽은 ARCHETYPE_PATH 를 쓴다. */
export const ARCHETYPE_DIR = "registry/factory/archetypes"
export const ARCHETYPE_PATH = join(ROOT, ARCHETYPE_DIR)
export const UI_PARTS_DIR = join(ROOT, "registry", "factory", "ui-src")
export const BLOCK_REGISTRY = join(ROOT, "registry", "factory", "blocks", "registry.json")

/** 원형 id 10개 — 폴더의 파일 이름이 정본이다. */
export const ARCHETYPE_IDS = readdirSync(ARCHETYPE_PATH).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort()

const Slot = z.object({ id: z.string(), role: z.string(), maxChars: z.number().int().positive().nullable() }).strict()
const Img = z.object({ id: z.string(), aspect: z.string().nullable(), source: z.enum(["real-required", "stock-ok", "generated-ok", "none"]) }).strict()
const RegisterId = z.string().regex(/^[ACD]\d+$/, { error: "대장 행 번호는 A12·C42·D80 꼴이다" })
// 본문·부품 섹션의 렌더(대장 C70 — factory/stamp/content-sections.mjs 가 읽는다): 렌더러(블록 kind content 의 변형) + 콘텐츠 자리(출처) + 머리 이름표.
// 출처 문법: 콘텐츠 경로(news · caseStudies.0.challenge) · slot:<칸> · slot:<섹션>/<칸> · images:<칸> · @trail·@pages·@legal-pages·@route:<쪽>[#앵커].
// fields 값은 항목 안 경로(+ ":date|year|money|days|pages" 서식, "." 은 항목 자체, href "@case-link").
export const CONTENT_RENDERERS = ["prose", "list", "cards", "facts", "links", "gallery", "timeline", "breadcrumb", "skeleton"]
const Format = z.enum(["text", "date", "year", "money", "days", "pages"])
const Label = z.object({ ko: z.string().min(1), en: z.string().min(1) }).strict()
const Source = z.string().regex(/^(?:slot:[a-z][a-zA-Z0-9-]*(?:\/[a-z][a-zA-Z0-9-]*)?|images:[a-z][a-z0-9-]*|@(?:trail|pages|legal-pages)|@route:[a-z][a-z0-9-]*(?:#[a-z][a-z0-9-]*)?|[A-Za-z][A-Za-z0-9]*(?:\.(?:[A-Za-z][A-Za-z0-9]*|\d+))*)$/, { error: "출처는 콘텐츠 경로·slot:·images:·@trail·@pages·@legal-pages·@route: 중 하나다" })
const Field = z.string().regex(/^(?:\.|@case-link|slot:[a-z][a-zA-Z0-9-]*|[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)(?::(?:text|date|year|money|days|pages))?$/)
export const ContentRender = z.object({
  as: z.enum(CONTENT_RENDERERS),
  heading: Label,
  hideHeading: z.boolean().optional(),
  lead: z.array(Source).min(1).optional(),
  caption: z.array(Source).min(1).optional(),
  from: z.array(Source).min(1).optional(),
  fields: z.record(z.string(), z.union([Field, z.array(Field).min(1)])).optional(),
  rows: z.array(z.object({ label: Label, from: z.array(Source).min(1), format: Format.optional() }).strict()).min(1).optional(),
  // labelFrom(QFIX [3]): 링크 이름이 정해진 이름표(label)가 아니라 04 문구 칸(slot:<칸>)일 때 — 둘 중 하나만
  links: z.array(z.object({ label: Label.optional(), labelFrom: z.array(Source).min(1).optional(), from: z.array(Source).min(1) }).strict().superRefine((l, ctx) => { if (!!l.label === !!l.labelFrom) ctx.addIssue({ code: "custom", path: ["label"], message: "링크 이름은 label(정해진 이름표) 또는 labelFrom(문구 칸) 중 하나만 적는다" }) })).min(1).optional(),
  mode: z.enum(["tiles", "menu", "grid", "stack"]).optional(),
  sort: z.string().regex(/^-?[a-zA-Z]+$/).optional(),
  limit: z.number().int().positive().optional(),
  maxAgeDays: z.number().int().positive().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  imageSource: z.enum(["real-required", "stock-ok", "generated-ok"]).optional(),
}).strict().superRefine((r, ctx) => {
  const need = { prose: ["from"], list: ["fields"], cards: ["fields"], timeline: ["from", "fields"], gallery: ["from"], facts: [], links: [], breadcrumb: [], skeleton: [] }[r.as]
  for (const k of need) if (!r[k]) ctx.addIssue({ code: "custom", path: [k], message: `렌더러 ${r.as} 는 ${k} 가 있어야 한다` })
  if (r.as === "facts" && !r.rows && !(r.from && r.fields?.label && r.fields?.value)) ctx.addIssue({ code: "custom", path: ["rows"], message: "facts 는 rows 또는 from + fields{label,value} 가 있어야 한다" })
  if (r.as === "links" && !r.links && !r.from) ctx.addIssue({ code: "custom", path: ["links"], message: "links 는 links 또는 from 이 있어야 한다" })
  if ((r.as === "list" || r.as === "cards") && !r.fields?.title) ctx.addIssue({ code: "custom", path: ["fields", "title"], message: `${r.as} 는 fields.title 이 있어야 한다` })
})
const NoBlock = z.object({
  mode: z.enum(["content", "part", "pending"]),
  reason: z.string().min(1),
  parts: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).min(1).optional(),
  register: z.array(RegisterId).min(1).optional(),
  /** content·part: 06 이 그리는 법(렌더러·콘텐츠 자리). 그릴 자료 칸이 스키마에 없으면 대신 missing 에 그 사실을 적는다(→ 「자료 연결 안 됨」) */
  render: ContentRender.optional(),
  missing: z.string().min(1).optional(),
}).strict().superRefine((n, ctx) => {
  if (n.mode === "pending" && !n.register) ctx.addIssue({ code: "custom", path: ["register"], message: "블록을 기다리는 섹션(pending)은 대장 행(register)이 있어야 한다" })
  if (n.mode === "part" && !n.parts) ctx.addIssue({ code: "custom", path: ["parts"], message: "부품으로 그리는 섹션(part)은 부품 이름(parts)이 있어야 한다" })
  if (n.mode === "pending" && (n.render || n.missing)) ctx.addIssue({ code: "custom", path: ["render"], message: "pending 섹션은 render·missing 이 없다 — 블록을 기다린다" })
  if (n.mode !== "pending" && !!n.render === !!n.missing) ctx.addIssue({ code: "custom", path: ["render"], message: "본문·부품 섹션(content·part)은 render(그리는 법) 또는 missing(스키마에 없는 자료) 중 하나만 적는다(대장 C70)" })
})
const Section = z.object({
  kind: z.string().regex(/^[a-z][a-z0-9-]*$/),
  legacyKind: z.string().optional(),
  required: z.boolean(),
  importance: z.number().int().min(1).max(3),
  blockKinds: z.array(z.string()),
  allowedVariants: z.array(z.string().regex(/^block-[a-z0-9-]+$/)),
  noBlock: NoBlock.optional(),
  register: z.array(RegisterId).min(1).optional(),
  copySlots: z.array(Slot),
  imageSlots: z.array(Img),
}).strict().superRefine((s, ctx) => {
  const bound = s.allowedVariants.length > 0
  if (bound && s.noBlock) ctx.addIssue({ code: "custom", path: ["noBlock"], message: "블록에 묶인 섹션에는 noBlock 이 없다" })
  if (!bound && !s.noBlock) ctx.addIssue({ code: "custom", path: ["noBlock"], message: "블록이 없는 섹션은 noBlock 으로 이유를 적는다" })
  if (bound !== (s.blockKinds.length > 0)) ctx.addIssue({ code: "custom", path: ["blockKinds"], message: "blockKinds 와 allowedVariants 는 함께 있거나 함께 없다" })
})
const Page = z.object({
  id: z.string(), route: z.string().startsWith("/"),
  /** 없으면 v0. v0.2 쪽은 찍어내기가 사이트맵에 넣지 않는다(commerce 장바구니 — C44) */
  phase: z.enum(["v0", "v0.2"]).optional(),
  sections: z.array(Section).min(1),
}).strict()
const Conversion = z.object({
  event: z.string(), match: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(), phase: z.enum(["v0", "v0.2"]).optional(),
}).strict()

export const ArchetypeSchema = z.object({
  id: z.string(), purpose: z.string(), coreTask: z.string(), completion: z.enum(["site", "product"]),
  locales: z.array(z.enum(["ko", "en"])).min(1), pages: z.array(Page).min(1),
  sectionOrderTemplates: z.unknown(), globalSections: z.unknown(), imagePolicy: z.unknown(), contentSchemaHints: z.unknown(), references: z.unknown(),
  /** 원형이 지켜야 할 법적 요건 목록(기준·언제·요구·출처) — ai/tasks 의 legal */
  legalRequirements: z.array(z.object({ basis: z.string(), appliesWhen: z.string(), requirement: z.string(), source: z.string() }).passthrough()),
  /** 법정 페이지와 검토할 법 — factory/legal/drafts.mjs·AGENT.md 가 읽는다 */
  legal: z.object({
    pages: z.array(z.enum(["privacy", "terms", "refund", "withdrawal"])),
    laws: z.object({ ko: z.array(z.string()), en: z.array(z.string()) }).strict(),
  }).strict(),
  seo: z.object({ titleTemplate: z.string().includes("%s"), type: z.enum(["website", "product", "local", "software"]) }).strict(),
  /** 전환 정의(C43) — 앞이 주 전환. J11 가중치의 「전환 N건」을 무엇으로 셀지 여기서 정한다 */
  conversion: z.array(Conversion),
}).strict().superRefine((a, ctx) => {
  const dup = (list) => list.find((x, i) => list.indexOf(x) !== i)
  const p = dup(a.pages.map((x) => x.id)); if (p) ctx.addIssue({ code: "custom", path: ["pages"], message: `쪽 id 가 겹친다: ${p}` })
  const r = dup(a.pages.map((x) => x.route)); if (r) ctx.addIssue({ code: "custom", path: ["pages"], message: `쪽 경로가 겹친다: ${r}` })
  for (const pg of a.pages) {
    const k = dup(pg.sections.map((s) => s.kind))
    if (k) ctx.addIssue({ code: "custom", path: ["pages", pg.id], message: `${pg.id} 쪽에서 섹션 이름이 겹친다: ${k}` })
  }
})

export async function loadArchetypes(dir = ARCHETYPE_PATH) {
  const out = {}
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const a = JSON.parse(readFileSync(join(dir, f), "utf8"))
    out[a.id] = a
  }
  return out
}

/** 블록 항목 이름과 그 블록이 적은 원형(archetypes 메타) — blocks/registry.json 에서 읽는다. */
export function loadBlockIndex(file = BLOCK_REGISTRY) {
  const items = JSON.parse(readFileSync(file, "utf8")).items.filter((i) => i.type === "registry:block" && i.meta?.kind)
  return { names: new Set(items.map((i) => i.name)), fit: new Map(items.map((i) => [i.name, i.meta.archetypes ?? []])) }
}

/**
 * 원형의 블록 묶음 검사. 문제 목록을 돌려주고, 빈 배열이면 통과다.
 *  - 없는 블록 이름
 *  - 섹션의 blockKinds 밖 kind 의 블록(blockKinds 를 안 적은 옛 모양은 섹션 kind 하나)
 *  - fit(블록 이름 → 그 블록이 적은 원형 목록)을 주면, 이 원형을 적지 않은 블록
 */
export function checkArchetypes(all, blockNames, fit) {
  const issues = []
  const check = (a, where, s, fallbackKinds) => {
    for (const v of s.allowedVariants ?? []) {
      const kinds = s.blockKinds ?? fallbackKinds
      if (!blockNames.has(v)) issues.push(`${where}: 없는 블록 ${v}`)
      else if (!kinds.some((k) => v.startsWith(`block-${k}-`))) issues.push(`${where}: 다른 kind 블록 ${v}(허용 kind ${kinds.join("·")})`)
      else if (fit && !fit.get(v)?.includes(a.id)) issues.push(`${where}: ${v} 는 ${a.id} 를 archetypes 메타에 적지 않았다`)
    }
  }
  for (const a of Object.values(all)) {
    for (const p of a.pages) for (const s of p.sections) check(a, `${a.id}/${p.id}/${s.kind}`, s, [s.kind])
    // 전역 섹션(FV1 Task 5.9): 허용 변형을 JSON 에 직접 적은 것(앱 사이드바·상단 바·상태 화면·연결 띠·새 판 알림)도 같은 검사를 받는다. 적지 않은 전역 섹션은 사이트맵이 GLOBAL_BLOCK_KIND 로 묶는다.
    for (const g of Array.isArray(a.globalSections) ? a.globalSections : []) check(a, `${a.id}/global/${g.kind}`, g, [])
  }
  return issues
}
