import { z } from "zod"
import { Business, ImageSlot, IsoDate, Url, slotsSchema, type CopySlotDefs, type ImageSlotDefs } from "@/registry/factory/content/content-core"

// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.
/** 문구 칸 정의 — registry/factory/archetypes/brand.json 의 copySlots. */
export const COPY_SLOTS = {
  tagline: { role: "회사가 무엇을 하는지 말하는 H1(로고 아님)", maxChars: 28 },
  mission: { role: "짧고 구체적인 미션 한 문장(다른 회사 이름 대입 검사)", maxChars: null },
  tileTitle: { role: "사업·서비스 이름", maxChars: null },
  tileBody: { role: "한 줄 설명", maxChars: null },
  productName: { role: "모델·서비스 이름", maxChars: null },
  oneLiner: { role: "한 줄 설명", maxChars: null },
  action: { role: "체험 예약·자세히", maxChars: null },
  fact: { role: "설립·규모·거점 수치(기준일 표기)", maxChars: null },
  award: { role: "발급 기관·연도가 붙은 수상·인증", maxChars: null },
  claim: { role: "수치 + 연도 붙은 보고서 링크(친환경·ESG를 주장하면 필수)", maxChars: null },
  headline: { role: "날짜 붙은 소식 제목", maxChars: null },
  summary: { role: "맨 위 1~2문단: 공식 회사명·하는 일·차별점·주요 성과", maxChars: null },
  entry: { role: "연도 + 사건(<ol>·<table>, JS 없이 전부 보임)", maxChars: null },
  person: { role: "이름·직함·약력", maxChars: null },
  title: { role: "보도자료 제목 + 날짜", maxChars: null },
} as const satisfies CopySlotDefs

/** 이미지 칸 정의 — registry/factory/archetypes/brand.json 의 imageSlots(비율·출처 정책). */
export const IMAGE_SLOTS = {
  "hero-media": { aspect: "16:9", source: "real-required" },
  "tile-image": { aspect: "4:3", source: "real-required" },
  product: { aspect: null, source: "real-required" },
  "site-photo": { aspect: null, source: "real-required" },
  "news-thumb": { aspect: "16:9", source: "stock-ok" },
  portrait: { aspect: "4:5", source: "real-required" },
} as const satisfies ImageSlotDefs
// ── 생성 구역 끝

/**
 * 브랜드·회사 홈(`brand`) 콘텐츠. `organization` 하나에서 푸터 회사 정보와 Organization JSON-LD(`toOrganization`)가 나온다.
 * 회사 정보는 네 층(factory-rules.md §21-2): 홈 태그라인(H1) → 회사소개 요약 → 하위 페이지 → 푸터 링크.
 */
export const BrandContent = z
  .object({
    archetype: z.literal("brand").describe("원형 id"),
    organization: Business.extend({
      legalName: z.string({ error: "공식 회사명(법인명)을 적어 주세요 — 회사소개·IR 페이지에 글자로 싣는다" }).min(1, { error: "공식 회사명(법인명)을 적어 주세요 — 회사소개·IR 페이지에 글자로 싣는다" }).describe("공식 회사명(법인명)"),
      url: Url.describe("회사 대표 주소"),
      logo: ImageSlot.optional().describe("로고 — H1 밖의 링크 이미지(alt=회사명)"),
      sameAs: z.array(Url).default([]).describe("공식 SNS·위키 등 같은 회사를 가리키는 주소"),
    }).describe("회사 정보 — 푸터와 Organization JSON-LD 를 같은 객체에서"),
    tagline: z.string().min(1).max(28, { error: "태그라인(H1)은 28자 이하여야 합니다" }).describe("회사가 무엇을 하는지 말하는 H1 문장(로고 아님)"),
    news: z
      .array(z.object({ date: IsoDate, title: z.string().min(1).describe("제목"), url: Url.describe("기사 주소"), thumb: ImageSlot.optional().describe("썸네일") }))
      .default([])
      .describe("소식·보도자료(날짜 붙음)"),
    history: z.array(z.object({ year: z.number().int().min(1800).max(2100).describe("연도"), event: z.string().min(1).describe("사건") })).default([]).describe("연혁 — <ol>·<table>로 JS 없이 전부 보인다"),
    leaders: z
      .array(
        z.object({
          name: z.string().min(1).describe("이름"),
          title: z.string().min(1).describe("직함"),
          bio: z.string().min(1).describe("약력"),
          portrait: ImageSlot.describe("사진(실사 필수)"),
        })
      )
      .default([])
      .describe("리더십 — 이름·직함·사진·약력을 함께"),
    reports: z
      .array(
        z.object({
          year: z.number().int().describe("연도"),
          title: z.string().min(1).describe("보고서 제목"),
          pdfUrl: Url.describe("PDF 주소"),
          pages: z.number().int().positive().describe("쪽수"),
          size: z.string().min(1).describe("용량(예: 4.2MB)"),
        })
      )
      .default([])
      .describe("지속가능성·ESG 보고서 — 사회·환경 기여를 주장하면 필수"),
    careersUrl: Url.optional().describe("채용 목록 페이지"),
    slots: slotsSchema(COPY_SLOTS, IMAGE_SLOTS).default({ copy: [], images: [] }).describe("문구·이미지 칸 — 원형 JSON 의 칸 정의를 따른다"),
  })
  .superRefine((c, ctx) => {
    if (c.slots.copy.some((s) => s.id === "claim") && c.reports.length === 0)
      ctx.addIssue({ code: "custom", path: ["reports"], message: "사회·환경 기여를 주장하면 수치와 연도가 붙은 보고서를 함께 둡니다(factory-rules.md §21-2)" })
  })
  .describe("브랜드·회사 홈 원형 콘텐츠")
export type BrandContent = z.infer<typeof BrandContent>
