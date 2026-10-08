import { z } from "zod"
import { Cta, HREF_ERROR, HREF_PATTERN, Href, IsoDate, OpeningHours, Phone, Url, slotsSchema, type CopySlotDefs, type ImageSlotDefs } from "@/registry/factory/content/content-core"

// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.
/** 문구 칸 정의 — registry/factory/archetypes/public.json 의 copySlots. */
export const COPY_SLOTS = {
  title: { role: "대표 정책 제목(HTML, 이미지에 굽지 않음) / 제목", maxChars: null },
  oneLiner: { role: "한 줄 설명", maxChars: null },
  link: { role: "바로가기 1개", maxChars: null },
  label: { role: "목적별(해결·정보·참여·소식)·사용자 유형별 바로가기 레이블", maxChars: null },
  desc: { role: "짧은 설명", maxChars: null },
  deadline: { role: "기한·최신 업데이트 레이블", maxChars: null },
  row: { role: "날짜·분류·제목·담당 부서", maxChars: null },
  links: { role: "콜센터·조직도·청사 안내·오시는 길", maxChars: null },
  h1: { role: "본문 제목", maxChars: null },
  meta: { role: "날짜·담당 부서", maxChars: null },
} as const satisfies CopySlotDefs

/** 이미지 칸 정의 — registry/factory/archetypes/public.json 의 imageSlots(비율·출처 정책). */
export const IMAGE_SLOTS = {
  background: { aspect: null, source: "real-required" },
  icon: { aspect: "1:1", source: "generated-ok" },
  building: { aspect: null, source: "real-required" },
  "head-portrait": { aspect: null, source: "real-required" },
} as const satisfies ImageSlotDefs
// ── 생성 구역 끝

/** KRDS 공식 배너 문구(factory-rules.md §21-8) — 공식 정부 서비스만, 모든 화면 최상단(건너뛰기 링크 바로 다음)에 같은 문구로. */
export const OFFICIAL_BANNER_TEXT = "이 누리집은 대한민국 공식 전자정부 누리집입니다."

/**
 * 공공기관(`public`) 콘텐츠 — KRDS 우선. 푸터는 연락처(주소·대표전화·민원전화·유료 여부·운영 시간),
 * 「개인정보 처리방침」·웹 접근성 정책 링크, 저작권, 운영기관 식별자(마지막) 순서다. 첫 화면 「자주 찾는 서비스」 바로가기는 필수다.
 */
export const PublicContent = z
  .object({
    archetype: z.literal("public").describe("원형 id"),
    decision: z
      .object({
        krds_scope: z.object({
          agencyType: z.enum(["central-main", "central-service", "public-institution", "local-gov"]).describe("기관 유형"),
          level: z.enum(["standard", "extended"]).describe("KRDS 표준형·확장형"),
          officialBanner: z.boolean().describe("공식 배너 필수 여부 — 공식 정부 서비스가 아니면 false"),
          identifier: z.boolean().describe("운영기관 식별자 필수 여부"),
        }).describe("KRDS 적용 수준"),
      })
      .describe("결정 기록 맨 위(pb-01)"),
    agency: z
      .object({
        name: z.string().min(1).describe("기관명(로고 alt 에 「로고」 없이)"),
        address: z.string({ error: "푸터 연락처에 주소가 필요합니다(KRDS 푸터)" }).min(1, { error: "푸터 연락처에 주소가 필요합니다(KRDS 푸터)" }).describe("주소"),
        mainPhone: Phone.describe("대표전화"),
        civilPhone: z
          .string()
          .refine((v) => /^1\d{2}$/.test(v.trim()) || Phone.safeParse(v).success, { error: "민원전화 형식이 올바르지 않습니다 (예: 120, 1588-1234, 031-123-4567)" })
          .optional()
          .describe("민원전화 — 3자리 특수번호(110·120 등)도 받는다"),
        phoneNote: z.string({ error: "전화의 유료 여부·운영 시간을 적어 주세요(KRDS 푸터)" }).min(1, { error: "전화의 유료 여부·운영 시간을 적어 주세요(KRDS 푸터)" }).describe("유료 여부·운영 시간"),
        privacyPolicyUrl: z.string({ error: "「개인정보 처리방침」 링크가 필요합니다" }).min(1, { error: "「개인정보 처리방침」 링크가 필요합니다" }).regex(HREF_PATTERN, { error: HREF_ERROR }).describe("개인정보 처리방침(이 명칭 그대로, 굵기·색으로 구분)"),
        accessibilityPolicyUrl: z.string({ error: "웹 접근성 정책 링크가 필요합니다" }).min(1, { error: "웹 접근성 정책 링크가 필요합니다" }).regex(HREF_PATTERN, { error: HREF_ERROR }).describe("웹 접근성 정책"),
        copyright: z.string().min(1).describe("저작권 문구"),
        identifier: z.string().min(1).optional().describe("운영기관 식별자(푸터 마지막 구획)"),
      })
      .describe("기관 정보(푸터)"),
    quickLinks: z.array(Cta).min(1, { error: "첫 화면 「자주 찾는 서비스」 바로가기가 하나 이상 필요합니다" }).describe("방문 목적별·사용자 유형별 바로가기"),
    notices: z
      .array(
        z.object({
          date: IsoDate,
          category: z.string().min(1).describe("분류"),
          title: z.string().min(1).describe("제목"),
          department: z.string({ error: "게시물에는 담당 부서가 필요합니다" }).min(1, { error: "게시물에는 담당 부서가 필요합니다" }).describe("담당 부서"),
          url: Href.describe("주소"),
          external: z.boolean().default(false).describe("외부 사이트면 표시"),
        })
      )
      .default([])
      .describe("공지·소식"),
    emergency: z
      .object({
        severity: z.enum(["상", "중", "하"]).describe("긴급도"),
        text: z.string().min(1).describe("문장 1줄"),
        url: Href.describe("관련 화면 링크 1개"),
        until: IsoDate.describe("내리는 날"),
      })
      .nullable()
      .default(null)
      .describe("긴급 공지 — 하나만, 숨기기 버튼 없음"),
    fontScales: z.array(z.number().int().min(80).max(200)).min(1).max(5, { error: "글자 크기 옵션은 5개 이내입니다" }).default([90, 100, 110, 130]).describe("글자 크기 조정 옵션(%)"),
    homeUrl: Url.optional().describe("누리집 주소"),
    // 기관 안내(영업시간 표 + 오시는 길 + 지도 링크)와 하위 쪽 본문(QFIX [3]) — 모두 선택이라 사실이 없으면 그 칸만 비고 섹션은 「자료 연결 안 됨」으로 남는다
    hours: OpeningHours.optional().describe("운영(영업) 시간 — 요일별. 쉬는 날은 목록에서 뺀다"),
    directions: z.object({ transit: z.string().min(1).optional().describe("대중교통 한 줄"), parking: z.string().min(1).optional().describe("주차 안내") }).optional().describe("오시는 길"),
    mapLinks: z.object({ naver: Url.optional().describe("네이버 지도 길찾기 링크"), kakao: Url.optional().describe("카카오맵 길찾기 링크") }).optional().describe("지도 링크 — 지도 iframe 만으로 위치를 알리지 않는다"),
    subBody: z.array(z.string().min(1)).optional().describe("하위 쪽 본문 — 안내 글 문단"),
    slots: slotsSchema(COPY_SLOTS, IMAGE_SLOTS).default({ copy: [], images: [] }).describe("문구·이미지 칸 — 원형 JSON 의 칸 정의를 따른다"),
  })
  .superRefine((c, ctx) => {
    if (c.decision.krds_scope.identifier && !c.agency.identifier)
      ctx.addIssue({ code: "custom", path: ["agency", "identifier"], message: "운영기관 식별자가 필수인 기관입니다 — 푸터 마지막 구획 문구를 적어 주세요" })
  })
  .describe("공공기관 원형 콘텐츠")
export type PublicContent = z.infer<typeof PublicContent>
