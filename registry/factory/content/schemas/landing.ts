import { z } from "zod"
import { Business, Faq, Url, slotsSchema, type CopySlotDefs, type ImageSlotDefs } from "@/registry/factory/content/content-core"

// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.
/** 문구 칸 정의 — registry/factory/archetypes/landing.json 의 copySlots. */
export const COPY_SLOTS = {
  headline: { role: "방문자가 얻는 결과를 말하는 H1(§9) / 다른 H2보다 한 단계 큰 마지막 H2, 첫 H1 과 같은 약속(메시지 일치, §10)", maxChars: 28 },
  subhead: { role: "누가·언제·무엇을 받는지 한두 문장", maxChars: null },
  primaryCta: { role: "주 행동(사전 등록·대기 명단 가입) — 아래 신청 폼으로 이어진다 / 주 행동 한 번 더(같은 신청으로 이어진다)", maxChars: null },
  secondaryCta: { role: "보조 행동(자세히 보기·일정 보기), 주 행동과 다른 채움", maxChars: null },
  claim: { role: "참인 신청자 수·참여 기관 수·지난 행사 규모(기준일). 없으면 후기나 로고 중 참인 것만", maxChars: null },
  quote: { role: "실명·소속·구체 결과가 있는 후기 또는 지난 참가자 말", maxChars: null },
  featureTitle: { role: "받는 것·들을 것·할 것 하나의 이름", maxChars: null },
  featureBody: { role: "그것이 방문자에게 주는 결과 한 문장", maxChars: null },
  planName: { role: "참가권·이용권·요금제 이름", maxChars: null },
  price: { role: "가격·통화(부가세 포함 여부) — 사실이 있을 때만", maxChars: null },
  qa: { role: "대상·일정·비용·취소와 환불·개인정보 사용처럼 신청 직전에 걸리는 반론에 답한다", maxChars: null },
  leadTitle: { role: "신청하면 받는 것을 한 줄로(주 전환)", maxChars: null },
  leadWhat: { role: "무엇을·언제·얼마나 자주 받는지, 언제든 끊을 수 있다는 안내", maxChars: null },
  submitLabel: { role: "신청 버튼 글자(동사로 시작)", maxChars: null },
  consentNote: { role: "개인정보 수집·이용 고지와 선택 수신 동의 안내(법정 문구는 법정 쪽이 정본)", maxChars: null },
  riskReducer: { role: "무료·해지 자유·스팸 없음 중 참인 것(§10)", maxChars: null },
} as const satisfies CopySlotDefs

/** 이미지 칸 정의 — registry/factory/archetypes/landing.json 의 imageSlots(비율·출처 정책). */
export const IMAGE_SLOTS = {
  "hero-visual": { aspect: "16:10", source: "stock-ok" },
  "customer-logo": { aspect: null, source: "real-required" },
  person: { aspect: "1:1", source: "real-required" },
  "feature-visual": { aspect: null, source: "stock-ok" },
  "magnet-cover": { aspect: "4:3", source: "real-required" },
} as const satisfies ImageSlotDefs
// ── 생성 구역 끝

/**
 * 한 쪽 랜딩(`landing`) 콘텐츠 — 행사 사전 등록·출시 대기 명단처럼 한 가지 제안과 신청 폼 하나로 끝나는 쪽.
 * `plans`(참가권·요금제)와 `leadMagnet`(신청하면 보내는 자료)은 사실이 있을 때만 채운다. 없는 것을 지어내지 않는다.
 */
export const LandingContent = z
  .object({
    archetype: z.literal("landing").describe("원형 id"),
    business: Business.optional().describe("푸터 사업자·연락처 정보 — 주최·운영 주체"),
    oneLiner: z.string().min(1).describe("제안을 한 문장으로 — H1 이 말하는 약속의 맥락"),
    offerUrl: Url.optional().describe("이 랜딩의 공개 주소 — 아직 없으면 비운다"),
    features: z
      .array(z.object({ title: z.string().min(1).describe("받는 것·들을 것·할 것의 이름"), body: z.string().min(1).describe("방문자에게 주는 결과 한 문장") }).describe("특징 한 항목"))
      .default([])
      .describe("특징 — 필수 섹션 features 가 그린다"),
    faq: z.array(Faq).default([]).describe("자주 묻는 질문 — 신청 직전에 걸리는 반론에 답한다"),
    plans: z
      .array(
        z.object({
          name: z.string().min(1).describe("참가권·이용권·요금제 이름"),
          price: z.number().nonnegative().nullable().describe("가격 — 무료이면 0, 문의형이면 null"),
          currency: z.string().regex(/^[A-Z]{3}$/, { error: "통화는 KRW·USD 같은 세 글자 코드입니다" }).default("KRW").describe("통화"),
          vatIncluded: z.boolean().optional().describe("가격에 부가세가 들어 있는지 — 사실이 있을 때만 적는다"),
        })
      )
      .optional()
      .describe("참가권·요금제 — 가격 사실이 있을 때만(없으면 pricing 섹션이 빠진다)"),
    leadMagnet: z
      .object({
        title: z.string().min(1).describe("보내는 자료의 이름"),
        what: z.string().min(1).describe("담긴 것 한두 문장"),
        format: z.string().min(1).optional().describe("형식·분량(예: PDF 12쪽)"),
      })
      .optional()
      .describe("신청하면 보내는 자료 — 실제로 있을 때만"),
    slots: slotsSchema(COPY_SLOTS, IMAGE_SLOTS).default({ copy: [], images: [] }).describe("문구·이미지 칸 — 원형 JSON 의 칸 정의를 따른다"),
  })
  .describe("한 쪽 랜딩 원형 콘텐츠")
export type LandingContent = z.infer<typeof LandingContent>
