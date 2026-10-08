import { z } from "zod"
import { Business, ImageSlot, Url, slotsSchema, type CopySlotDefs, type ImageSlotDefs } from "@/registry/factory/content/content-core"

// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.
/** 문구 칸 정의 — registry/factory/archetypes/commerce.json 의 copySlots. */
export const COPY_SLOTS = {
  text: { role: "배송 기준·첫 구매 혜택(모달 아님, 구매 영역에도 반복)", maxChars: null },
  headline: { role: "기획전 1개 또는 단일 상품 + 가격", maxChars: 28 },
  origin: { role: "원산지 안내(식품이면 필수)", maxChars: null },
  resultCount: { role: "실시간 결과 수(「128개 상품」)", maxChars: null },
  name: { role: "상품명", maxChars: null },
  price: { role: "정가(취소선)+할인가, 단위 가격(용량 상품), 품절", maxChars: null },
  total: { role: "배송비 포함 합계", maxChars: null },
  escrowNotice: { role: "에스크로·소비자피해보상보험 선택 안내, 무통장 계좌(은행·번호·예금주)", maxChars: null },
} as const satisfies CopySlotDefs

/** 이미지 칸 정의 — registry/factory/archetypes/commerce.json 의 imageSlots(비율·출처 정책). */
export const IMAGE_SLOTS = {
  hero: { aspect: "16:9", source: "real-required" },
  "hero-mobile": { aspect: "4:5", source: "real-required" },
  "product-thumb": { aspect: "1:1", source: "real-required" },
  "customer-photo": { aspect: null, source: "real-required" },
  story: { aspect: null, source: "stock-ok" },
  thumb: { aspect: "1:1", source: "real-required" },
  "second-shot": { aspect: "1:1", source: "real-required" },
} as const satisfies ImageSlotDefs
// ── 생성 구역 끝

/** 배송 조건 — 구매 영역과 장바구니가 같은 객체를 쓴다. */
export const Shipping = z
  .object({
    fee: z.number().int().nonnegative().describe("배송비(원)"),
    freeThreshold: z.number().int().nonnegative().optional().describe("무료배송 기준 금액(원)"),
    courier: z.string().min(1).describe("택배사"),
    leadDays: z.number().int().nonnegative().describe("출고까지 영업일"),
  })
  .describe("배송 조건")

/** 판매 상품. 옵션은 보이는 버튼으로 렌더한다(select 금지), 품절 옵션은 「품절」 글자를 붙인다. */
export const Product = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/, { error: "slug 는 영문 소문자·숫자·하이픈만 씁니다" }).describe("주소 조각"),
    name: z.string().min(1).describe("상품명"),
    price: z.number().int().nonnegative().describe("판매가(원)"),
    listPrice: z.number().int().nonnegative().optional().describe("정가(원, 할인할 때 취소선)"),
    unitPrice: z.object({ amount: z.number().nonnegative().describe("단위 가격(원)"), per: z.string().min(1).describe("단위(예: 100g)") }).optional().describe("단위 가격 — 용량 상품"),
    options: z
      .array(
        z.object({
          name: z.string().min(1).describe("옵션 이름(예: 사이즈)"),
          values: z.array(z.object({ label: z.string().min(1).describe("값"), soldOut: z.boolean().default(false).describe("품절") })).min(1).describe("옵션 값 — 버튼 하나씩"),
        })
      )
      .default([])
      .describe("옵션 — 보이는 버튼으로"),
    thumbs: z.array(ImageSlot).min(1, { error: "상품 사진이 하나 이상 필요합니다(실물 촬영)" }).describe("상품 사진(실사 필수)"),
    origin: z.string().min(1).optional().describe("원산지(식품이면 필수)"),
    category: z.string().min(1).optional().describe("분류 — 상품 목록 위 분류 칩의 이름(예: 원두·드립백). 같은 분류는 같은 글로 적고, 모든 상품에 적을 때만 칩이 그려진다"),
  })
  .describe("판매 상품")
export type Product = z.infer<typeof Product>

/**
 * 소형 커머스(`commerce`) 콘텐츠. 전자상거래법 제10조 표시 사항이 `business` 에 모두 있어야 하고,
 * 무통장입금 계좌(`bankAccount`)가 있으면 선지급식이므로 에스크로·소비자피해보상보험(`escrowProvider`)이 필수다(제13조②10).
 */
export const CommerceContent = z
  .object({
    archetype: z.literal("commerce").describe("원형 id"),
    business: Business.extend({
      representative: z.string({ error: "대표자 성명을 적어 주세요(전자상거래법 제10조)" }).min(1, { error: "대표자 성명을 적어 주세요(전자상거래법 제10조)" }).describe("대표자"),
      bizRegNo: Business.shape.bizRegNo.unwrap().describe("사업자등록번호"),
      mailOrderNo: z.string({ error: "통신판매업 신고번호를 적어 주세요(전자상거래법 제10조)" }).min(1, { error: "통신판매업 신고번호를 적어 주세요(전자상거래법 제10조)" }).describe("통신판매업 신고번호"),
      email: z.email({ error: "메일 주소 형식이 올바르지 않습니다" }).describe("메일 주소"),
      ftcLookupUrl: Url.describe("공정위 사업자정보 공개 페이지 링크"),
      termsUrl: Url.describe("이용약관"),
      privacyUrl: Url.describe("개인정보 처리방침"),
      privacyOfficer: z.string().min(1).optional().describe("개인정보 보호책임자"),
      bankAccount: z
        .object({ bank: z.string().min(1).describe("은행"), number: z.string().min(1).describe("계좌번호"), holder: z.string().min(1).describe("예금주") })
        .optional()
        .describe("무통장입금 계좌 — 은행·계좌번호·예금주를 함께"),
      escrowProvider: z.string().min(1).optional().describe("결제대금예치(에스크로) 또는 소비자피해보상보험 제공자"),
    }).describe("사업자 정보(푸터)"),
    products: z.array(Product).min(1, { error: "상품이 하나 이상 필요합니다" }).describe("상품 목록"),
    shipping: Shipping,
    slots: slotsSchema(COPY_SLOTS, IMAGE_SLOTS).default({ copy: [], images: [] }).describe("문구·이미지 칸 — 원형 JSON 의 칸 정의를 따른다"),
  })
  .superRefine((c, ctx) => {
    if (c.business.bankAccount && !c.business.escrowProvider)
      ctx.addIssue({ code: "custom", path: ["business", "escrowProvider"], message: "무통장입금(선지급식)을 받으면 에스크로 또는 소비자피해보상보험 안내가 필요합니다(전자상거래법 제13조②10)" })
  })
  .describe("소형 커머스 원형 콘텐츠")
export type CommerceContent = z.infer<typeof CommerceContent>
