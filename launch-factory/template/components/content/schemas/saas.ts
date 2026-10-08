import { z } from "zod"
import { Business, Faq, Href, ImageSlot, IsoDate, Url, slotsSchema, type CopySlotDefs, type ImageSlotDefs } from "@/components/content/content-core"

// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.
/** 문구 칸 정의 — registry/factory/archetypes/saas.json 의 copySlots. */
export const COPY_SLOTS = {
  headline: { role: "결과를 말하는 H1(§9) / 다른 H2보다 한 단계 큰 마지막 H2 / 광고 문구와 같은 약속(메시지 일치, §10)", maxChars: 28 },
  subhead: { role: "맥락 한두 문장", maxChars: null },
  primaryCta: { role: "주 행동(무료 시작·가입) / 무료 시작", maxChars: null },
  secondaryCta: { role: "보조 행동(데모 보기·영업 문의), 다른 채움 / 영업 문의(영업 병행형)", maxChars: null },
  claim: { role: "참인 고객 수·규모(기준일)", maxChars: null },
  stepTitle: { role: "작업 흐름 한 단계의 이름", maxChars: null },
  stepBody: { role: "그 단계에서 얻는 것", maxChars: null },
  title: { role: "연동·호환 제목", maxChars: null },
  apiNote: { role: "API·SDK·웹훅 제공 여부와 가져오기 경로", maxChars: null },
  body: { role: "보안·규모·지원·계약 조건(SSO·SLA·인증)", maxChars: null },
  quote: { role: "실명·직함·소속·구체 결과가 있는 후기", maxChars: null },
  entryTitle: { role: "날짜 붙은 새 기능(최신 3~5개, 90일 넘으면 섹션 제거)", maxChars: null },
  qa: { role: "가져오기·이전 지원·해지 뒤 데이터 반출 / 전환 비용·해지 / 가격·나에게 맞나·실패하면(§10)", maxChars: null },
  riskReducer: { role: "무료 체험·해지 자유·보증 중 참인 것(§10)", maxChars: null },
  planName: { role: "요금제 이름", maxChars: null },
  price: { role: "월 가격·통화(JSON-LD offers와 같은 값)", maxChars: null },
} as const satisfies CopySlotDefs

/** 이미지 칸 정의 — registry/factory/archetypes/saas.json 의 imageSlots(비율·출처 정책). */
export const IMAGE_SLOTS = {
  "product-ui": { aspect: "16:10", source: "real-required" },
  "customer-logo": { aspect: null, source: "real-required" },
  "step-ui-crop": { aspect: null, source: "real-required" },
  "integration-logo": { aspect: null, source: "real-required" },
  person: { aspect: "1:1", source: "real-required" },
  "entry-thumb": { aspect: null, source: "real-required" },
} as const satisfies ImageSlotDefs
// ── 생성 구역 끝

/**
 * SaaS 랜딩(`saas`) 콘텐츠. `plans` 하나에서 화면 요금표와 SoftwareApplication.offers(`toSoftwareApplication`)를 만든다.
 * 변경 기록은 최신 항목이 90일을 넘으면 섹션을 뺀다(렌더러 몫, factory-rules.md §21-1).
 */
export const SaasContent = z
  .object({
    archetype: z.literal("saas").describe("원형 id"),
    product: z
      .object({
        name: z.string().min(1).describe("제품 이름"),
        url: Url.describe("제품 주소"),
        category: z.string().min(1).default("BusinessApplication").describe("applicationCategory"),
        os: z.string().min(1).default("Web").describe("operatingSystem"),
      })
      .describe("제품"),
    business: Business.optional().describe("푸터 한국 사업자 정보"),
    plans: z
      .array(
        z.object({
          name: z.string().min(1).describe("요금제 이름"),
          monthlyPrice: z.number().nonnegative().nullable().describe("월 가격 — 문의형이면 null"),
          currency: z.string().regex(/^[A-Z]{3}$/, { error: "통화는 KRW·USD 같은 세 글자 코드입니다" }).default("KRW").describe("통화"),
          vatIncluded: z.boolean().optional().describe("월 가격에 부가세가 들어 있는지 — 사실이 있을 때만 적는다. 없으면 요금표가 세금 표기를 못 그린다"),
          features: z.array(z.string().min(1)).default([]).describe("포함 기능"),
        })
      )
      .default([])
      .describe("요금제 — 화면 요금표와 JSON-LD offers 가 같은 객체"),
    integrations: z
      .array(z.object({ name: z.string().min(1).describe("실제로 연동하는 제품"), url: Url, kind: z.enum(["native", "api", "webhook"]).describe("연동 방식") }))
      .default([])
      .describe("연동·호환 — 연동하지 않는 제품 로고는 쓰지 않는다"),
    changelog: z.array(z.object({ date: IsoDate, title: z.string().min(1).describe("새 기능 이름"), url: Href.describe("변경 기록 주소") }).describe("변경 기록 한 줄")).default([]).describe("변경 기록(최신 3~5개)"),
    testimonials: z
      .array(z.object({ name: z.string().min(1).describe("실명"), title: z.string().min(1).describe("직함"), company: z.string().min(1).describe("소속"), result: z.string().min(1).describe("구체 결과") }))
      .default([])
      .describe("후기 — 실명·직함·소속·구체 결과"),
    workflowSteps: z.array(z.object({ title: z.string().min(1).describe("단계 이름"), body: z.string().min(1).describe("그 단계에서 얻는 것"), uiCrop: ImageSlot.describe("실제 UI 조각") })).default([]).describe("작업 흐름 단계(실제 UI 조각)"),
    faq: z.array(Faq).default([]).describe("자주 묻는 질문 — 가져오기·해지·가격처럼 가입 직전에 걸리는 반론에 답한다. 질문마다 한 항목(문구 칸 qa 는 이 항목들의 요약 한 줄)"),
    slots: slotsSchema(COPY_SLOTS, IMAGE_SLOTS).default({ copy: [], images: [] }).describe("문구·이미지 칸 — 원형 JSON 의 칸 정의를 따른다"),
  })
  .describe("SaaS 랜딩 원형 콘텐츠")
export type SaasContent = z.infer<typeof SaasContent>
