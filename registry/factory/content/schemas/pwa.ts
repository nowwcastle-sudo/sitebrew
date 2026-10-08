import { z } from "zod"
import { Href, slotsSchema, type CopySlotDefs, type ImageSlotDefs } from "@/registry/factory/content/content-core"

// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.
/** 문구 칸 정의 — registry/factory/archetypes/pwa.json 의 copySlots. */
export const COPY_SLOTS = {
  title: { role: "화면 이름(<title> 앞부분, 앱 전환기 이름)", maxChars: 60 },
  reason: { role: "비어 있는 이유(빈 탭도 숨기지 않음)", maxChars: null },
  cta: { role: "금액·결과를 담은 문구(단일 과업형)", maxChars: null },
  message: { role: "행동 언어 상태 문구(「인터넷 연결이 끊겼어요」)", maxChars: null },
  retry: { role: "재시도 버튼", maxChars: null },
  toggle: { role: "알림 켜기·끄기, 위치·카메라", maxChars: null },
  usage: { role: "「오프라인 저장」 토글·저장 위치·용량", maxChars: null },
  benefit: { role: "얻는 것 + 「허용」·「나중에」", maxChars: null },
} as const satisfies CopySlotDefs

/** 이미지 칸 정의 — registry/factory/archetypes/pwa.json 의 imageSlots(비율·출처 정책). */
export const IMAGE_SLOTS = {
  empty: { aspect: null, source: "generated-ok" },
  "list-thumb": { aspect: null, source: "real-required" },
} as const satisfies ImageSlotDefs
// ── 생성 구역 끝

const HEX = /^#[0-9a-f]{6}$/i

/** 모바일 PWA(`pwa`) 콘텐츠. manifest 필수 항목·탭바 3~5개·상태 문구 한 곳 정의(factory-rules.md §21-9). */
export const PwaContent = z
  .object({
    archetype: z.literal("pwa").describe("원형 id"),
    manifest: z
      .object({
        name: z.string().min(1).describe("앱 이름"),
        short_name: z.string().min(1).max(12, { error: "short_name 은 12자 이하가 안전합니다" }).describe("짧은 이름"),
        description: z.string().min(1).describe("설명"),
        icons: z
          .array(
            z.object({
              src: z.string().min(1).describe("아이콘 경로"),
              sizes: z.string().regex(/^\d+x\d+$/, { error: "아이콘 크기는 192x192 형식입니다" }).describe("크기(NxN)"),
              purpose: z.enum(["any", "maskable", "monochrome"], { error: "purpose 는 any·maskable·monochrome 중 하나입니다 — \"any maskable\" 처럼 섞지 말고 아이콘을 따로 두세요" }).default("any").describe("용도"),
            })
          )
          .describe("아이콘 — 192·512 필수, 마스크 가능 포함"),
        start_url: Href.describe("시작 주소"),
        display: z.enum(["standalone", "fullscreen", "minimal-ui"]).default("standalone").describe("표시 모드"),
        theme_color: z.string().regex(HEX, { error: "색은 #rrggbb 형식입니다" }).describe("테마 색"),
        background_color: z.string().regex(HEX, { error: "색은 #rrggbb 형식입니다" }).describe("배경 색"),
        screenshots: z.array(z.object({ src: z.string().min(1).describe("경로"), sizes: z.string().regex(/^\d+x\d+$/, { error: "스크린샷 크기는 1080x1920 형식입니다" }).describe("크기(NxN)") })).default([]).describe("실제 화면 스크린샷"),
        prefer_related_applications: z.literal(false).optional().describe("없거나 false"),
      })
      .superRefine((m, ctx) => {
        for (const s of ["192x192", "512x512"] as const)
          if (!m.icons.some((i) => i.sizes === s)) ctx.addIssue({ code: "custom", path: ["icons"], message: `${s} 아이콘이 필요합니다` })
        if (!m.icons.some((i) => i.purpose === "maskable")) ctx.addIssue({ code: "custom", path: ["icons"], message: "마스크 가능(maskable) 아이콘이 필요합니다" })
      })
      .describe("Web App Manifest"),
    tabs: z
      .array(
        z.object({
          id: z.string().min(1).describe("탭 id"),
          label: z.string().min(1).refine((l) => l.trim().split(/\s+/).length <= 2, { error: "탭 라벨은 1~2단어입니다" }).describe("라벨 1~2단어"),
          icon: z.string().min(1).describe("아이콘 이름"),
          iconFilled: z.string().min(1).optional().describe("선택 상태 아이콘"),
          href: Href.describe("주소"),
        })
      )
      .min(3, { error: "하단 탭은 3~5개입니다 — 3개 미만이면 상단 탭을 쓰세요" })
      .max(5, { error: "하단 탭은 3~5개입니다 — 넘으면 「전체」 메뉴로 보내세요" })
      .optional()
      .describe("하단 탭바"),
    offline: z
      .object({
        fallbackUrl: Href.describe("사용자 지정 오프라인 화면"),
        precache: z.array(z.string().min(1)).default([]).describe("미리 캐시할 경로"),
        runtimeCache: z
          .object({
            images: z.literal("stale-while-revalidate").default("stale-while-revalidate").describe("이미지"),
            home: z.literal("network-first").default("network-first").describe("홈"),
            static: z.literal("cache-first").default("cache-first").describe("정적 파일"),
          })
          .default({ images: "stale-while-revalidate", home: "network-first", static: "cache-first" })
          .describe("런타임 캐시 전략"),
      })
      .describe("오프라인"),
    strings: z
      .object({
        offline: z.string().min(1).describe("연결 끊김(예: 인터넷 연결이 끊겼어요)"),
        serviceDown: z.string().min(1).describe("서비스 문제(예: 서비스를 점검하고 있어요)"),
        savedPending: z.string().min(1).describe("저장됨 · 연결되면 보냅니다"),
        synced: z.string().min(1).describe("동기화 완료"),
        updateAvailable: z.string().min(1).describe("새 버전이 있어요 — 새로고침"),
      })
      .describe("상태 문구 — 한 곳에서 정의해 모든 화면이 같은 문구"),
    // 앱 고유 화면의 안내 글(QFIX [3]) — 실제 데이터는 launch-factory 가 실행 때 채운다. 정적 사이트는 각 화면이 무엇을 보이는지 말하는 브리프 사실만 싣는다(없으면 섹션은 「자료 연결 안 됨」).
    homeItems: z.array(z.object({ title: z.string().min(1).describe("항목 이름"), body: z.string().min(1).optional().describe("한 줄 설명") })).optional().describe("주 화면 안내 — 첫 화면에서 할 수 있는 일(항목마다 이름 + 한 줄)"),
    detailBody: z.array(z.string().min(1)).optional().describe("상세 화면 안내 — 상세 화면이 보이는 것(문단)"),
    resultBody: z.array(z.string().min(1)).optional().describe("결과 화면 안내 — 일을 마친 뒤 화면이 알리는 것(문단)"),
    slots: slotsSchema(COPY_SLOTS, IMAGE_SLOTS).default({ copy: [], images: [] }).describe("문구·이미지 칸 — 원형 JSON 의 칸 정의를 따른다"),
  })
  .describe("모바일 PWA 원형 콘텐츠")
export type PwaContent = z.infer<typeof PwaContent>
