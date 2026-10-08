import { z } from "zod"
import { Href, Url, slotsSchema, type CopySlotDefs, type ImageSlotDefs } from "@/registry/factory/content/content-core"

// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.
/** 문구 칸 정의 — registry/factory/archetypes/dashboard.json 의 copySlots. */
export const COPY_SLOTS = {
  title: { role: "페이지 제목", maxChars: null },
  asOf: { role: "기준 시각·마지막 업데이트", maxChars: null },
  period: { role: "기간·필터(URL에 반영)", maxChars: null },
  pause: { role: "갱신 멈춤(자동 갱신이면 필수)", maxChars: null },
  newItems: { role: "「새 항목 n건 — 보기」", maxChars: null },
  alert: { role: "조치가 필요한 항목만 + 조치 링크(열기·배정·연락)", maxChars: null },
  value: { role: "값·단위 / KPI 4~6개, 누르면 주 차트 지표 전환(진짜 button)", maxChars: null },
  baseline: { role: "목표값·정상 범위·비교 기간 중 하나 이상", maxChars: null },
  delta: { role: "델타", maxChars: null },
  chartTitle: { role: "한 문장 결론 제목", maxChars: null },
  dimension: { role: "유입·페이지·지역·기기 등 — 항목 클릭 시 필터 추가·URL 반영", maxChars: null },
  primaryAction: { role: "주 행동 1개(「새로 만들기」)", maxChars: null },
  resultCount: { role: "결과 수 + 적용 필터 칩", maxChars: null },
  firstColumn: { role: "사람이 읽는 식별자(이름·주문번호)", maxChars: null },
} as const satisfies CopySlotDefs

/** 이미지 칸 정의 — registry/factory/archetypes/dashboard.json 의 imageSlots(비율·출처 정책). */
export const IMAGE_SLOTS = {
  avatar: { aspect: "1:1", source: "real-required" },
} as const satisfies ImageSlotDefs
// ── 생성 구역 끝

/** KPI 판단 기준 — 목표값·정상 범위·비교 기간 중 하나 이상(기준 없는 숫자는 대시보드에서 뺀다, factory-rules.md §21-7). */
const Baseline = z
  .object({
    target: z.number().optional().describe("목표값"),
    range: z.tuple([z.number(), z.number()]).optional().describe("정상 범위 [최소, 최대]"),
    comparePeriod: z.string().min(1).optional().describe("비교 기간(예: 지난주 같은 요일)"),
  })
  .refine((b) => b.target !== undefined || b.range !== undefined || b.comparePeriod !== undefined, {
    error: "KPI 에 판단 기준(목표값·정상 범위·비교 기간 중 하나)이 필요합니다",
  })
  .describe("판단 기준")

/** 운영 대시보드(`dashboard`) 콘텐츠. 종류(운영·분석·전략)를 하나로 정해 결정 기록에 쓴다. */
export const DashboardContent = z
  .object({
    archetype: z.literal("dashboard").describe("원형 id"),
    decision: z
      .object({
        dashboard_type: z.enum(["operational", "analytical", "strategic"]).describe("운영·분석·전략 중 하나"),
        refresh: z.string().min(1).describe("갱신 주기 — 사람이 조치할 수 있는 주기"),
      })
      .describe("결정 기록 필수 필드(db-01)"),
    kpis: z
      .array(
        z.object({
          id: z.string().min(1).describe("id"),
          label: z.string().min(1).describe("이름"),
          value: z.number().describe("값"),
          unit: z.string().describe("단위"),
          baseline: Baseline,
          delta: z.number().optional().describe("델타"),
          rank: z.number().int().positive().describe("중요도 순위(1이 가장 중요)"),
        })
      )
      .default([])
      .describe("KPI"),
    alerts: z
      .array(
        z.object({
          id: z.string().min(1).describe("id"),
          severity: z.enum(["critical", "warning"]).describe("경고 수준 — 지금 조치가 필요한 항목만"),
          recordUrl: Href.describe("레코드 상세 주소"),
          actions: z.array(z.string().min(1)).min(1, { error: "경고마다 조치 링크(열기·배정·연락)가 하나 이상 필요합니다" }).describe("조치"),
        })
      )
      .default([])
      .describe("조치가 필요한 경고"),
    table: z
      .object({
        columns: z.array(z.object({ id: z.string().min(1).describe("열 id"), label: z.string().min(1).describe("열 이름"), numeric: z.boolean().default(false).describe("숫자 열(오른쪽 정렬)") })).min(1).describe("열 — 사용자에게 중요한 순"),
        density: z.union([z.literal(32), z.literal(40), z.literal(48), z.literal(64)], { error: "행 높이는 32·40·48·64 중 하나입니다" }).describe("행 높이(px)"),
        rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).default([]).describe("행 — 열 id → 값"),
      })
      .optional()
      .describe("데이터 표 — 첫 열은 사람이 읽는 식별자"),
    helpUrl: Url.optional().describe("도움말"),
    primaryActionHref: Href.optional().describe("주 행동 주소 — 목록 쪽 제목 줄의 주 행동 버튼(문구 칸 primaryAction 「새로 만들기」)이 가는 곳. 사실에 없으면 적지 않는다(가짜 버튼을 그리지 않는다)"),
    slots: slotsSchema(COPY_SLOTS, IMAGE_SLOTS).default({ copy: [], images: [] }).describe("문구·이미지 칸 — 원형 JSON 의 칸 정의를 따른다"),
  })
  .describe("운영 대시보드 원형 콘텐츠")
export type DashboardContent = z.infer<typeof DashboardContent>
