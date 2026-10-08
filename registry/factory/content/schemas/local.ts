import { z } from "zod"
import {
  Business,
  ContactChannel,
  Faq,
  Holidays,
  HolidayPolicy,
  ImageSlot,
  IsoDate,
  OpeningHours,
  Phone,
  SpecialHours,
  Url,
  slotsSchema,
  type CopySlotDefs,
  type ImageSlotDefs,
} from "@/registry/factory/content/content-core"

// ── 생성 구역 시작 — factory/scripts/gen-content-slots.mjs 가 원형 JSON 에서 다시 만든다. 손으로 고치지 않는다.
/** 문구 칸 정의 — registry/factory/archetypes/local.json 의 copySlots. */
export const COPY_SLOTS = {
  tagline: { role: "무엇을 파는 곳인지(§10-A)", maxChars: 28 },
  todayHours: { role: "오늘 영업(진료)시간 또는 「오늘 휴무」", maxChars: null },
  addressLine: { role: "주소 한 줄", maxChars: null },
  primaryCta: { role: "실제 받는 예약 채널 하나 또는 전화", maxChars: null },
  notice: { role: "날짜 붙은 한 줄 공지(임시 휴무·브레이크타임·품절·신메뉴) — 팝업 아님", maxChars: null },
  hours: { role: "진료시간표: 점심·야간·주말·휴진일(의료 변형)", maxChars: null },
  item: { role: "메뉴·시술·진료 이름 + 가격(HTML 텍스트)", maxChars: null },
  department: { role: "진료과목(의료 변형)", maxChars: null },
  doctor: { role: "의료인 성명·성별·면허 종류·약력(의료 변형)", maxChars: null },
  address: { role: "복사 가능한 텍스트 주소", maxChars: null },
  transit: { role: "대중교통 한 줄", maxChars: null },
  parking: { role: "주차 여부", maxChars: null },
  branch: { role: "지점명·주소·오늘 시간·전화·지도 링크(2곳 이상이면 필수)", maxChars: null },
  link: { role: "네이버 플레이스 등 외부 후기 링크 — 의료 변형에서는 끔", maxChars: null },
  qa: { role: "혜택·취소 정책(예약 상품형)", maxChars: null },
  price: { role: "가격·후기(비의료)·취소 정책", maxChars: null },
} as const satisfies CopySlotDefs

/** 이미지 칸 정의 — registry/factory/archetypes/local.json 의 imageSlots(비율·출처 정책). */
export const IMAGE_SLOTS = {
  hero: { aspect: "16:9", source: "real-required" },
  "menu-photo": { aspect: "1:1", source: "real-required" },
  portrait: { aspect: "1:1", source: "real-required" },
  space: { aspect: "3:2", source: "real-required" },
  "item-photo": { aspect: "3:2", source: "real-required" },
} as const satisfies ImageSlotDefs
// ── 생성 구역 끝

/** LocalBusiness 하위 유형(가장 구체적인 것을 고른다, factory-rules.md §21-3). */
export const LOCAL_SUBTYPES = ["LocalBusiness", "Bakery", "CafeOrCoffeeShop", "Restaurant", "Dentist", "MedicalClinic", "HairSalon"] as const
/** 의료기관 하위 유형 — 고르면 의료 변형 규칙(후기 칸 0)이 저절로 걸린다. */
export const MEDICAL_SUBTYPES = ["Dentist", "MedicalClinic"] as const
/** 의료기관이 될 수 없는 하위 유형 — medical: true 와 함께 쓰면 실패한다(한의원·의원은 MedicalClinic 이나 LocalBusiness). */
export const NON_MEDICAL_SUBTYPES = ["Bakery", "CafeOrCoffeeShop", "Restaurant", "HairSalon"] as const

/**
 * 의료 변형인가. 다음 중 하나라도 참이면 의료 변형이다(플래그를 빼먹어도 추론한다):
 * medical: true · 하위 유형 Dentist/MedicalClinic · 진료과목(departments)이나 의료진(doctors)이 있음.
 */
export function isMedical(c: { medical?: boolean; business: { subtype: string }; departments?: unknown[]; doctors?: unknown[] }): boolean {
  return c.medical === true || (MEDICAL_SUBTYPES as readonly string[]).includes(c.business.subtype) || !!c.departments?.length || !!c.doctors?.length
}

/** 역할에 「후기」가 든 문구 칸 id(local: link·price) — 의료 변형에서는 이 칸을 쓸 수 없다. 진료 가격은 item 칸에 싣는다. */
export const REVIEW_SLOT_IDS = Object.entries(COPY_SLOTS as Record<string, { role: string }>).filter(([, d]) => d.role.includes("후기")).map(([id]) => id)

/** 소수점 5자리 이상인 좌표(Google LocalBusiness 권장). */
const Coord = (name: string, min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .refine((n) => (String(n).split(".")[1] ?? "").length >= 5, { error: `${name}는 소수점 5자리 이상이어야 합니다` })

const MapLinks = z
  .object({
    naver: Url.describe("네이버 지도 길찾기 링크"),
    kakao: Url.describe("카카오맵 길찾기 링크"),
    google: Url.optional().describe("구글 지도 링크 — 외국인 손님을 받을 때"),
  })
  .describe("지도 링크 — 지도 iframe 만으로 위치를 알리지 않는다")

const reviewBlocked = "의료 변형에서는 후기 칸을 싣지 않습니다(의료법 제56조②2 치료경험담 금지, factory-rules.md §21-3)"

/**
 * 동네 가게·예약(`local`) 콘텐츠. 화면·LocalBusiness JSON-LD(`toLocalBusiness`)·llms.txt 가 이 객체 하나에서 나온다.
 * `medical: true` 이거나 하위 유형이 Dentist·MedicalClinic 이면 의료 변형이다 — 외부 후기 링크·후기 문구 칸(`link`)을 넣으면 실패한다.
 */
export const LocalContent = z
  .object({
    archetype: z.literal("local").describe("원형 id"),
    business: Business.extend({
      subtype: z.enum(LOCAL_SUBTYPES).default("LocalBusiness").describe("schema.org 하위 유형"),
      geo: z
        .object({ lat: Coord("위도", -90, 90).describe("위도"), lng: Coord("경도", -180, 180).describe("경도") })
        .optional()
        .describe("좌표(소수점 5자리 이상)"),
      url: Url.optional().describe("이 가게(지점) 페이지 주소"),
    }).describe("가게 정보 — 화면 방문 정보와 JSON-LD 가 같은 객체를 쓴다"),
    hours: OpeningHours,
    hoursSpecial: SpecialHours.optional().describe("특수일 영업시간(임시 휴무·연장 영업) — 요일표보다 우선(대장 A105)"),
    holidays: Holidays.optional().describe("공휴일 목록(설·추석·대체공휴일) — 찍어낼 때 천문연 특일 정보로 채운다"),
    holidayPolicy: HolidayPolicy.optional().describe("공휴일 영업: closed 쉰다 · open 요일표대로(기본) · special 은 hoursSpecial 로"),
    medical: z.boolean().optional().describe("의료 변형(병원·의원·치과·한의원) — 후기 칸을 끈다"),
    menu: z
      .array(
        z.object({
          name: z.string().min(1).describe("메뉴·시술·진료 이름"),
          price: z.number().int().nonnegative().describe("가격(원) — HTML 텍스트로 싣는다"),
          photo: ImageSlot.optional().describe("메뉴 사진(실사 필수)"),
        })
      )
      .default([])
      .describe("메뉴·가격표"),
    servesCuisine: z.array(z.string().min(1)).optional().describe("음식 종류(음식점 JSON-LD servesCuisine)"),
    notices: z.array(z.object({ date: IsoDate, text: z.string().min(1).describe("한 줄 공지") })).default([]).describe("날짜 붙은 한 줄 공지 — 팝업 아님"),
    booking: z
      .object({
        primary: ContactChannel.refine((c) => c.kind !== "mail", { error: "주 예약 채널은 네이버 예약·캐치테이블·카카오톡 채널·전화 중 하나여야 합니다" }).describe(
          "실제로 받는 예약 채널 하나(주 CTA, 모바일 하단 고정 바)"
        ),
        secondary: z.array(ContactChannel).default([]).describe("보조 채널 — 링크로 낮춘다"),
      })
      .describe("예약 경로"),
    mapLinks: MapLinks,
    directions: z
      .object({ transit: z.string().min(1).describe("대중교통 한 줄"), parking: z.string().min(1).describe("주차 여부") })
      .describe("오시는 길"),
    gallery: z.array(ImageSlot).default([]).describe("공간·음식 사진(실사 필수)"),
    faq: z.array(Faq).default([]).describe("자주 묻는 질문"),
    branches: z
      .array(
        z.object({
          name: z.string().min(1).describe("지점명"),
          url: Url.describe("지점 페이지"),
          address: z.string().min(1).describe("지점 주소"),
          todayHours: z.string().min(1).describe("오늘 영업시간"),
          telephone: Phone,
          naverMapUrl: Url.describe("네이버 지도"),
          kakaoMapUrl: Url.describe("카카오맵"),
        })
      )
      .default([])
      .describe("지점 — 2곳 이상이면 같은 형식으로"),
    departments: z.array(z.string().min(1)).default([]).describe("진료과목(의료 변형)"),
    doctors: z
      .array(
        z.object({
          name: z.string().min(1).describe("의료인 성명"),
          gender: z.enum(["여", "남"]).describe("성별"),
          license: z.string().min(1).describe("면허 종류"),
          career: z.array(z.string()).default([]).describe("약력"),
          portrait: ImageSlot.optional().describe("사진(실사 필수)"),
        })
      )
      .default([])
      .describe("의료진(의료 변형) — 의료법 제57조 심의 제외 사실 항목"),
    externalReviews: z.array(z.object({ label: z.string().min(1).describe("링크 이름"), url: Url.describe("외부 후기 주소") })).default([]).describe("외부 후기 링크(네이버 플레이스 등) — 의료 변형에서는 넣을 수 없다"),
    slots: slotsSchema(COPY_SLOTS, IMAGE_SLOTS).default({ copy: [], images: [] }).describe("문구·이미지 칸 — 원형 JSON 의 칸 정의를 따른다"),
  })
  .superRefine((c, ctx) => {
    const subtype = c.business.subtype
    if (c.medical === true && (NON_MEDICAL_SUBTYPES as readonly string[]).includes(subtype))
      ctx.addIssue({ code: "custom", path: ["business", "subtype"], message: `의료 변형에 ${subtype} 하위 유형을 쓸 수 없습니다 — MedicalClinic·Dentist·LocalBusiness 중 하나를 고르세요` })
    if (!isMedical(c)) return
    if (c.medical === false)
      ctx.addIssue({ code: "custom", path: ["medical"], message: "의료기관 하위 유형이나 진료과목·의료진이 있으면 의료 변형입니다 — medical 을 false 로 끌 수 없습니다" })
    if (c.externalReviews.length) ctx.addIssue({ code: "custom", path: ["externalReviews"], message: reviewBlocked })
    c.slots.copy.forEach((s, i) => {
      if (REVIEW_SLOT_IDS.includes(s.id)) ctx.addIssue({ code: "custom", path: ["slots", "copy", i], message: `${reviewBlocked} — 「${s.id}」 칸은 후기를 담는 칸입니다. 진료 가격은 item 칸에 적어 주세요` })
    })
  })
  .describe("동네 가게·예약 원형 콘텐츠")
export type LocalContent = z.infer<typeof LocalContent>
export type LocalContentInput = z.input<typeof LocalContent>
