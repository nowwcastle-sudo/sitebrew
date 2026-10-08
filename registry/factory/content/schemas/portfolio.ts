import { z } from "zod"
import { ImageSlot, Url, slotsSchema, type CopySlotDefs, type ImageSlotDefs } from "@/registry/factory/content/content-core"

// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.
/** 문구 칸 정의 — registry/factory/archetypes/portfolio.json 의 copySlots. */
export const COPY_SLOTS = {
  h1: { role: "누구·무엇(분야)·어디 한 문장, 한 화면 안에서 끝남", maxChars: 28 },
  workTitle: { role: "작업 제목", maxChars: null },
  client: { role: "의뢰인 / 고객 이름(글자)", maxChars: null },
  award: { role: "수상·언론 이름 + 연도(배지 이미지만 두지 않음)", maxChars: null },
  cta: { role: "협업 제안(「프로젝트 문의」)", maxChars: null },
  email: { role: "mailto: 링크 글자가 주소 자체", maxChars: null },
  services: { role: "제공 서비스", maxChars: null },
  year: { role: "연도", maxChars: null },
  role: { role: "역할", maxChars: null },
  body: { role: "짧은 글 덩어리(약 150단어·한글 약 400자마다 figure)", maxChars: 400 },
  result: { role: "수치·수상·의뢰인 말", maxChars: null },
} as const satisfies CopySlotDefs

/** 이미지 칸 정의 — registry/factory/archetypes/portfolio.json 의 imageSlots(비율·출처 정책). */
export const IMAGE_SLOTS = {
  "work-thumb": { aspect: null, source: "real-required" },
  team: { aspect: null, source: "real-required" },
  "case-hero": { aspect: null, source: "real-required" },
  process: { aspect: null, source: "real-required" },
  deliverable: { aspect: null, source: "real-required" },
} as const satisfies ImageSlotDefs
// ── 생성 구역 끝

/** 포트폴리오·스튜디오(`portfolio`) 콘텐츠. 캔버스 갤러리여도 `works` 에서 DOM `<a href="/work/<slug>">` 목록을 만든다. */
export const PortfolioContent = z
  .object({
    archetype: z.literal("portfolio").describe("원형 id"),
    statement: z.string().min(1).max(28, { error: "선언문(H1)은 28자 이하여야 합니다" }).describe("누구·무엇·어디 한 문장(H1)"),
    works: z
      .array(
        z.object({
          slug: z.string().regex(/^[a-z0-9-]+$/, { error: "slug 는 영문 소문자·숫자·하이픈만 씁니다 — 주소는 /work/<slug>" }).describe("/work/<slug>"),
          title: z.string().min(1).describe("작업 제목"),
          client: z.string().min(1).describe("의뢰인"),
          disciplines: z.array(z.string().min(1)).default([]).describe("분야"),
          year: z.number().int().describe("연도"),
          thumb: ImageSlot.describe("썸네일(실제 작업물)"),
        })
      )
      .min(1, { error: "작업이 하나 이상 필요합니다" })
      .describe("작업 목록"),
    caseStudies: z
      .array(
        z.object({
          slug: z.string().min(1).describe("작업 slug"),
          meta: z.object({ client: z.string().min(1).describe("의뢰인"), services: z.array(z.string().min(1)).min(1).describe("제공 서비스"), year: z.number().int().describe("연도"), role: z.string().min(1).describe("역할") }).describe("맨 위 메타"),
          challenge: z.string().min(1).describe("과제"),
          role: z.string().min(1).describe("역할과 협업"),
          process: z.array(z.string().min(1)).min(1).describe("과정(버린 안 포함)"),
          solution: z.string().min(1).describe("해결"),
          results: z.array(z.string().min(1)).min(1).describe("결과(수치·수상·의뢰인 말)"),
          next: z.string().min(1).describe("다음 작업 slug"),
        })
      )
      .default([])
      .describe("사례 페이지 — 메타 → 과제 → 역할 → 과정 → 해결 → 결과 → 다음 작업"),
    contact: z
      .object({ email: z.email({ error: "문의 메일 주소 형식이 올바르지 않습니다" }).describe("문의 메일(글자로 보인다)"), inquiryUrl: Url.optional().describe("문의 폼") })
      .describe("연락처"),
    slots: slotsSchema(COPY_SLOTS, IMAGE_SLOTS).default({ copy: [], images: [] }).describe("문구·이미지 칸 — 원형 JSON 의 칸 정의를 따른다"),
  })
  .superRefine((c, ctx) => {
    const slugs = new Set(c.works.map((w) => w.slug))
    c.caseStudies.forEach((s, i) => {
      if (!slugs.has(s.slug)) ctx.addIssue({ code: "custom", path: ["caseStudies", i, "slug"], message: `works 에 없는 작업입니다: ${s.slug}` })
    })
  })
  .describe("포트폴리오 원형 콘텐츠")
export type PortfolioContent = z.infer<typeof PortfolioContent>
