import { z } from "zod"
import { Business, Faq, ImageSlot, IsoDate, slotsSchema, type CopySlotDefs, type ImageSlotDefs } from "@/registry/factory/content/content-core"

// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.
/** 문구 칸 정의 — registry/factory/archetypes/detail.json 의 copySlots. */
export const COPY_SLOTS = {
  name: { role: "상품명", maxChars: null },
  rating: { role: "별점 평균·리뷰 수(상품명 아래, 스크롤 없이)", maxChars: null },
  price: { role: "가격·세금 포함 여부", maxChars: null },
  shipping: { role: "배송비·무료배송 기준", maxChars: null },
  returnsSummary: { role: "반품 배송비 부담 주체·7일 청약철회", maxChars: null },
  labels: { role: "상세정보·상품정보·리뷰·문의 앵커(스크롤 5회 넘으면 필수)", maxChars: null },
  point: { role: "핵심 구매 포인트(HTML)", maxChars: null },
  imageTextLine: { role: "이미지 속 글자 한 줄(피할 수 없을 때만, alt에 같은 문구)", maxChars: 15 },
  caption: { role: "HTML 캡션·지시선(기능 콜아웃)", maxChars: null },
  rows: { role: "상품정보제공 고시 품목별 항목: 제조자·수입자, 제조국, 품질보증기준, A/S 책임자와 전화, KC 인증(대상이면)", maxChars: null },
  policy: { role: "배송비·반품 배송비 부담·7일 청약철회·불가 사유(구매 근처 + 여기)", maxChars: null },
  sellerReply: { role: "낮은 별점 판매자 답글 + 날짜", maxChars: null },
} as const satisfies CopySlotDefs

/** 이미지 칸 정의 — registry/factory/archetypes/detail.json 의 imageSlots(비율·출처 정책). */
export const IMAGE_SLOTS = {
  "gallery-main": { aspect: "1:1", source: "real-required" },
  "point-slice": { aspect: "860x1000-1200", source: "real-required" },
  slice: { aspect: "860x1000-1200", source: "real-required" },
  diagram: { aspect: null, source: "generated-ok" },
  scene: { aspect: null, source: "real-required" },
  "in-scale": { aspect: null, source: "real-required" },
  model: { aspect: null, source: "real-required" },
  closeup: { aspect: null, source: "real-required" },
  "review-photo": { aspect: null, source: "real-required" },
} as const satisfies ImageSlotDefs
// ── 생성 구역 끝

/**
 * 상세페이지(`detail`) 콘텐츠. 고시 표·배송·반품은 HTML 텍스트로 싣는다(이미지 OCR 금지). 이미지 조각은 폭 860·높이 1000~1200px,
 * 조각마다 altText 필수(글자가 든 조각은 그 문구를 옮긴다).
 */
export const DetailContent = z
  .object({
    archetype: z.literal("detail").describe("원형 id"),
    business: Business.optional().describe("판매자 사업자 정보 — 푸터·법정 쪽(전자상거래법 제10조 표시)에 쓴다"),
    product: z
      .object({
        name: z.string().min(1).describe("상품명"),
        rating: z.object({ avg: z.number().min(0).max(5).describe("별점 평균"), count: z.number().int().nonnegative().describe("리뷰 수") }).optional().describe("별점"),
        price: z.number().int().nonnegative().describe("가격 — 최소 단위 정수(원·센트, ports Money.amount 와 같다). 통화는 currency"),
        currency: z.enum(["KRW", "USD", "EUR", "JPY"]).default("KRW").describe("통화 — ports Money.currency 와 같다(USD·EUR 은 센트)"),
        taxIncluded: z.boolean().describe("부가세 포함 여부"),
        shipping: z
          .object({
            fee: z.number().int().nonnegative().describe("배송비(최소 단위 정수 — 원·센트)"),
            freeThreshold: z.number().int().nonnegative().optional().describe("무료배송 기준(최소 단위 정수 — 원·센트)"),
            courier: z.string().min(1).describe("택배사"),
            leadDays: z.number().int().nonnegative().describe("출고까지 영업일"),
            remoteExtra: z.number().int().nonnegative().nullable().optional().describe("도서산간 추가 배송비(최소 단위 정수 — 원·센트). 추가 비용이 없다고 브리프가 밝히면 null, 브리프에 없으면 적지 않는다(화면이 확인 필요로 남는다)"),
          })
          .describe("배송"),
        returns: z
          .object({
            feePayer: z.enum(["buyer", "seller"]).describe("반품 배송비 부담 주체"),
            withdrawalDays: z.number().int().min(7, { error: "청약철회 기간은 7일 이상이어야 합니다(전자상거래법 제17조)" }).describe("청약철회 기간(일)"),
            exclusions: z.array(z.string().min(1)).default([]).describe("청약철회 불가 사유"),
            refundDays: z.number().int().positive().max(3, { error: "환급은 반환받은 날부터 3영업일 이내여야 합니다(전자상거래법 제18조 제2항)" }).optional().describe("반품 상품 도착 뒤 환불까지 영업일 — 브리프에 없으면 적지 않는다(화면이 확인 필요로 남는다)"),
          })
          .describe("반품"),
        options: z.array(z.object({ name: z.string().min(1).describe("옵션 이름"), values: z.array(z.string().min(1)).min(1).describe("옵션 값") })).default([]).describe("옵션"),
      })
      .describe("구매 영역"),
    notice: z
      .object({
        category: z.string().min(1).describe("상품정보제공 고시 품목"),
        rows: z.array(z.object({ label: z.string().min(1).describe("고시 항목 이름 그대로"), value: z.string().min(1).describe("값") })).min(1, { error: "상품정보제공 고시 항목이 비었습니다" }).describe("고시 항목 행"),
      })
      .describe("상품정보제공 고시 표(HTML)"),
    specs: z
      .array(z.object({ label: z.string().min(1).describe("사양 이름(크기·무게·소재·구성)"), value: z.string().min(1).describe("값") }))
      .default([])
      .describe("사양 — 사는 사람이 견주는 값. 브리프 사실 specs 의 항목을 이름·값으로 옮기고, 사실에 없는 항목은 더하지 않는다"),
    slices: z
      .array(
        z.object({
          src: z.string().min(1).optional().describe("조각 이미지 경로 — 실제 파일이 아직 없으면 적지 않는다(화면이 「실제 사진 필요」 틀을 그리고 공개 불가 입력 대기 사유로 남는다)"),
          width: z.literal(860, { error: "상세 이미지 조각의 폭은 860px 입니다" }).describe("폭 860px"),
          height: z.number().int().min(1000, { error: "조각 높이는 1000~1200px 입니다" }).max(1200, { error: "조각 높이는 1000~1200px 입니다" }).describe("높이 1000~1200px"),
          altText: z.string({ error: "상세 이미지 조각에는 altText 가 필요합니다" }).min(1, { error: "상세 이미지 조각에는 altText 가 필요합니다" }).describe("대체 텍스트 — 글자가 들어 있으면 그 문구"),
        })
      )
      .default([])
      .describe("상세 이미지 조각"),
    faq: z.array(Faq).default([]).describe("묻고 답한 질문(Q&A) — 사는 사람이 자주 묻는 것. 브리프 사실 faq 의 항목을 한 쌍씩 옮기고, 사실에 없는 질문은 더하지 않는다. 주제는 사실에 있을 때만"),
    compare: z
      .object({
        usLabel: z.string().min(1).describe("우리 쪽 이름(비교표 첫 값 열)"),
        themLabel: z.string().min(1).describe("다른 방식의 이름 — 경쟁사 이름 대신 방식 이름으로"),
        rows: z.array(z.object({ label: z.string().min(1).describe("비교 기준"), us: z.string().min(1).describe("우리 쪽 값"), them: z.string().min(1).describe("다른 방식의 값") })).min(1).describe("비교 줄"),
      })
      .optional()
      .describe("우리 대 다른 방식 비교 — 사실에 있는 비교 값만. 없으면 적지 않는다(비교 값을 지어내지 않는다)"),
    reviews: z
      .array(
        z.object({
          rating: z.number().int().min(1).max(5).describe("별점"),
          text: z.string().min(1).describe("리뷰"),
          photos: z.array(ImageSlot).default([]).describe("리뷰 사진(작성자 동의 범위 안에서)"),
          date: IsoDate,
          sellerReply: z.object({ text: z.string().min(1).describe("답글"), date: IsoDate }).optional().describe("판매자 답글 + 날짜"),
        })
      )
      .default([])
      .describe("리뷰"),
    slots: slotsSchema(COPY_SLOTS, IMAGE_SLOTS).default({ copy: [], images: [] }).describe("문구·이미지 칸 — 원형 JSON 의 칸 정의를 따른다"),
  })
  .describe("상세페이지 원형 콘텐츠")
export type DetailContent = z.infer<typeof DetailContent>
