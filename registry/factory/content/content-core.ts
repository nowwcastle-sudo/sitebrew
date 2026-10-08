import { z } from "zod"
import { phoneDigits } from "@/registry/factory/lib/phone"

/**
 * 원형 id 10개. SiteShell `archetype`·원형 스키마·JSON-LD가 같은 목록을 쓴다.
 * 정본은 web-factory `registry/factory/archetypes/<id>.json` — 이 목록과 어긋나면 content.test.mjs 가 실패한다.
 */
export const ARCHETYPE_IDS = ["brand", "commerce", "dashboard", "detail", "local", "portfolio", "public", "pwa", "saas", "landing"] as const
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number]

const KO_ERROR = z.locales.ko().localeError

// ── 사실 자리 표시(J12, P3-3 Task 9 · 대장 C102) ───────────────────────────────────────────────────────────
// 사실이 없는 자리는 지어내지 않고 정확히 이 글자를 적는다(ko 「확인 필요」 · en "To be confirmed"). 형식이 있는 사실 칸(전화·사업자등록번호·메일)은
// 이 글자를 값으로 받는다 — 그래야 빈 사실이 있는 브리프도 스키마 검사를 통과해 화면이 그 자리를 자리 표시로 그린다. 공개는 다른 곳(ops-gate·
// legal-gate·후보의 blockers)이 막는다. 정본 상수는 이 둘이고 factory/legal/drafts.mjs PLACEHOLDER 와 같아야 한다(시험이 잠근다).
/** 사실 칸이 비었을 때 화면·메타에 그리는 글자(J12). ops-gate 가 이 글자를 찾아 공개를 막는다. JSON-LD 에는 싣지 않는다(X4). */
export const NEEDS_CHECK = "확인 필요"
export const NEEDS_CHECK_EN = "To be confirmed"
export const NEEDS_CHECK_LITERALS = [NEEDS_CHECK, NEEDS_CHECK_EN] as const
/** 값이 사실 자리 표시 글자(앞뒤 공백 무시)인가. */
export const isNeedsCheck = (v: unknown): boolean => typeof v === "string" && (NEEDS_CHECK_LITERALS as readonly string[]).includes(v.trim())

/**
 * 콘텐츠 검사. 스키마에 적은 한국어 메시지를 먼저 쓰고, 빠진 필드·타입 오류 같은 zod 기본 메시지도 한국어로 준다
 * (전역 z.config 를 바꾸지 않는다). 원형 스키마는 `.safeParse` 대신 이것으로 검사한다.
 */
export function safeParseContent<T extends z.ZodType>(schema: T, data: unknown) {
  return schema.safeParse(data, { error: KO_ERROR })
}

/** safeParseContent 의 던지는 판. 실패하면 한국어 메시지가 든 ZodError 를 던진다. */
export function parseContent<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  return schema.parse(data, { error: KO_ERROR })
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * http(s) 절대 주소. 사실 자리 표시 글자(「확인 필요」·"To be confirmed")도 값으로 받는다 — 지도 링크·제품 주소처럼 브리프가 주지 않은 주소 칸이
 * 그 글자로 남아야 화면이 「링크 없음」으로 그리고 공개 관문이 막는다(전화·사업자등록번호와 같은 방식, 대장 C102). 링크를 그리는 쪽은
 * `isNeedsCheck(값)`이면 링크를 만들지 않는다.
 */
export const Url = z
  .string()
  .refine((v) => isNeedsCheck(v) || /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v), { error: "http:// 또는 https:// 로 시작하는 주소여야 합니다" })
  .describe("http(s) 절대 주소")

/** YYYY-MM-DD 날짜. */
export const IsoDate = z.string().regex(ISO_DATE, { error: "날짜는 YYYY-MM-DD 형식이어야 합니다" }).describe("날짜(YYYY-MM-DD)")

// 전화번호 정규화는 lib/phone 하나다(최종 리뷰 M5) — phoneDigits(콘텐츠 검사, 한국 번호만)·normalizePhone(tel: 링크).
export { phoneDigits }

/** 한국 전화번호(국내 0 번호·전국대표번호 15xx/16xx/18xx·+82). 하이픈·공백·점·지역번호 괄호를 허용한다. */
export const Phone = z
  .string({ error: "전화번호를 적어 주세요" })
  .refine((v) => isNeedsCheck(v) || phoneDigits(v) !== null, {
    error: "전화번호 형식이 올바르지 않습니다 (예: 02-1234-5678, 1588-1234, +82-2-1234-5678)",
  })
  .describe("전화번호. 화면에 보이는 모양 그대로(예: 02-1234-5678). JSON-LD 는 +82 형식으로 바꿔 싣는다")

/**
 * 사업자·연락처 정보(NAP + 한국 전자상거래 표시 사항). 푸터·Organization/LocalBusiness JSON-LD 가 이 객체 하나에서 나온다.
 * 전자상거래법 제10조 표시 항목: 상호(name 또는 legalName)·대표자(representative)·사업자등록번호(bizRegNo)·
 * 통신판매업 신고번호(mailOrderNo)·주소(address)·연락처(phone·email).
 */
export const Business = z
  .object({
    name: z.string({ error: "상호(가게·회사 이름)를 적어 주세요" }).min(1, { error: "상호(가게·회사 이름)를 적어 주세요" }).describe("상호 — 화면에 보이는 이름"),
    legalName: z.string().min(1).optional().describe("법인명·등기 상호(상호와 다를 때만)"),
    representative: z.string().min(1).optional().describe("대표자 성명(전자상거래법 제10조 표시 사항)"),
    bizRegNo: z
      .string()
      .refine((v) => isNeedsCheck(v) || /^\d{3}-\d{2}-\d{5}$/.test(v), { error: "사업자등록번호는 000-00-00000 형식이어야 합니다" })
      .optional()
      .describe("사업자등록번호(000-00-00000)"),
    mailOrderNo: z.string().min(1).optional().describe("통신판매업 신고번호(예: 제2026-서울강남-0000호) — 온라인으로 팔 때 필수"),
    address: z.string({ error: "주소를 적어 주세요" }).min(1, { error: "주소를 적어 주세요" }).describe("도로명 주소 한 줄 — 복사할 수 있는 텍스트로 화면에 싣는다"),
    postalCode: z.string().regex(/^\d{5}$/, { error: "우편번호는 5자리 숫자입니다" }).optional().describe("우편번호(JSON-LD PostalAddress)"),
    addressRegion: z.string().min(1).optional().describe("시·도(예: 서울특별시) — JSON-LD addressRegion"),
    addressLocality: z.string().min(1).optional().describe("시·군·구(예: 마포구) — JSON-LD addressLocality"),
    addressCountry: z.string().regex(/^[A-Z]{2}$/, { error: "국가 코드는 대문자 두 글자입니다(ISO 3166-1 alpha-2, 예: KR·US)" }).optional().describe("국가 코드(ISO 3166-1 alpha-2) — JSON-LD addressCountry. 비우면 한국어 사이트는 KR, 영어 사이트는 칸을 싣지 않는다"),
    phone: Phone,
    email: z
      .string()
      .refine((v) => isNeedsCheck(v) || (z.email().safeParse(v).success && isMailAddress(v)), { error: "메일 주소 형식이 올바르지 않습니다" })
      .optional()
      .describe("대표 메일 주소"),
    ftcLookupUrl: z.string().regex(/^https:\/\//, { error: "공정위 사업자정보 조회 링크는 https 주소입니다" }).optional().describe("공정위 사업자정보 공개 페이지 — 푸터 「사업자정보 확인」"),
    termsUrl: z.string().regex(/^(https:\/\/|\/(?!\/))/, { error: "이용약관 링크는 https 주소나 /경로입니다" }).optional().describe("이용약관"),
    privacyUrl: z.string().regex(/^(https:\/\/|\/(?!\/))/, { error: "개인정보 처리방침 링크는 https 주소나 /경로입니다" }).optional().describe("개인정보 처리방침"),
  })
  .describe("사업자·연락처 정보")
export type Business = z.infer<typeof Business>

export const DAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"] as const
export type Day = (typeof DAYS)[number]

const TimeRange = z
  .object({
    start: z.string().regex(HHMM, { error: "시각은 HH:MM 형식이어야 합니다" }).describe("시작 HH:MM"),
    end: z.string().regex(HHMM, { error: "시각은 HH:MM 형식이어야 합니다" }).describe("끝 HH:MM"),
  })
  .describe("쉬는 구간")

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
/**
 * 영업 구간을 여는 시각 기준 분으로 편다. 밤샘 영업이면 여는 시각보다 이른 시각을 다음 날(+1440)로 본다.
 * 돌려줌: [여는 분, 닫는 분, 쉬는 구간[]] — 화면 문구·JSON-LD·검사가 같은 해석을 쓴다.
 */
export function hoursTimeline(h: { opens: string; closes: string; overnight?: boolean; breaks?: { start: string; end: string }[] }) {
  const open = minutes(h.opens)
  const at = (t: string) => (h.overnight && minutes(t) < open ? minutes(t) + 1440 : minutes(t))
  const close = at(h.closes)
  const breaks = (h.breaks ?? []).map((b) => [at(b.start), at(b.end)] as [number, number]).sort((a, b) => a[0] - b[0])
  return { open, close, breaks }
}

/** 요일별 영업(진료)시간. 휴무일은 목록에서 뺀다(빠진 요일 = 휴무). */
export const OpeningHours = z
  .array(
    z
      .object({
        day: z.enum(DAYS, { error: "요일은 mo·tu·we·th·fr·sa·su 중 하나여야 합니다" }).describe("요일(mo~su)"),
        opens: z.string().regex(HHMM, { error: "여는 시각은 HH:MM 형식이어야 합니다" }).describe("여는 시각 HH:MM"),
        closes: z.string().regex(HHMM, { error: "닫는 시각은 HH:MM 형식이어야 합니다" }).describe("닫는 시각 HH:MM(자정은 24:00, 밤샘 영업이면 다음 날 시각)"),
        overnight: z.boolean().optional().describe("밤샘 영업 — 닫는 시각이 다음 날(예: 18:00~익일 02:00). 켜야만 닫는 시각이 여는 시각보다 이를 수 있다"),
        breaks: z.array(TimeRange).optional().describe("브레이크타임·점심시간 — 영업시간 안, 서로 겹치지 않게"),
      })
      .superRefine((h, ctx) => {
        if (h.overnight) {
          if (h.closes === "24:00" || minutes(h.closes) >= minutes(h.opens))
            return ctx.addIssue({ code: "custom", path: ["closes"], message: "밤샘 영업(overnight)이면 닫는 시각이 다음 날이라 여는 시각보다 일러야 합니다" })
        } else if (minutes(h.closes) <= minutes(h.opens))
          return ctx.addIssue({ code: "custom", path: ["closes"], message: "닫는 시각이 여는 시각보다 늦어야 합니다 — 자정을 넘기면 overnight: true 를 켜 주세요" })
        const { open, close, breaks } = hoursTimeline(h)
        breaks.forEach(([s, e], i) => {
          const path = ["breaks", i]
          if (s >= e) ctx.addIssue({ code: "custom", path, message: "쉬는 시간의 끝이 시작보다 늦어야 합니다" })
          else if (s <= open || e >= close) ctx.addIssue({ code: "custom", path, message: "쉬는 시간은 여는 시각과 닫는 시각 사이에 있어야 합니다" })
          else if (i > 0 && s <= breaks[i - 1][1]) ctx.addIssue({ code: "custom", path, message: "쉬는 시간이 서로 겹칩니다" })
        })
      })
      .describe("요일 하나의 영업시간")
  )
  .min(1, { error: "영업시간이 비었습니다 — 여는 요일을 하나 이상 적어 주세요" })
  .refine((a) => new Set(a.map((h) => h.day)).size === a.length, { error: "같은 요일이 두 번 들어 있습니다" })
  .describe("요일별 영업시간 — 빠진 요일은 휴무")
export type OpeningHours = z.infer<typeof OpeningHours>

/**
 * 특수일 영업시간(P3-2 Task 7a, 대장 A105): 설·추석·대체공휴일·임시 휴무·연장 영업. 요일표(OpeningHours)를 그날만 덮어쓴다.
 * 날짜(YYYY-MM-DD, 서울 달력) 하나마다 「쉬어요」(closed) 또는 「이 시각에 열어요」(opens·closes). 이름(label)은 화면 문구(「추석 연휴」).
 * 판정 순서: 특수일 → 공휴일(holidayPolicy) → 요일 — openNow(options)와 JSON-LD specialOpeningHoursSpecification 이 같은 객체를 쓴다.
 */
export const SpecialHours = z
  .array(
    z
      .object({
        date: IsoDate,
        label: z.string().min(1).optional().describe("이름(예: 추석 연휴) — 「오늘은 {이름}이라 쉬어요」에 쓴다"),
        closed: z.boolean().optional().describe("그날 쉰다"),
        opens: z.string().regex(HHMM, { error: "여는 시각은 HH:MM 형식이어야 합니다" }).optional().describe("여는 시각 HH:MM"),
        closes: z.string().regex(HHMM, { error: "닫는 시각은 HH:MM 형식이어야 합니다" }).optional().describe("닫는 시각 HH:MM(자정은 24:00)"),
      })
      .superRefine((h, ctx) => {
        if (h.closed) {
          if (h.opens || h.closes) ctx.addIssue({ code: "custom", path: ["closed"], message: "쉬는 날(closed)에는 여는·닫는 시각을 적지 않습니다" })
          return
        }
        if (!h.opens || !h.closes) return ctx.addIssue({ code: "custom", path: ["opens"], message: "쉬는 날이 아니면 여는 시각과 닫는 시각을 모두 적어 주세요" })
        if (minutes(h.closes) <= minutes(h.opens)) ctx.addIssue({ code: "custom", path: ["closes"], message: "닫는 시각이 여는 시각보다 늦어야 합니다" })
      })
      .describe("특수일 하나")
  )
  .refine((a) => new Set(a.map((h) => h.date)).size === a.length, { error: "같은 날짜가 두 번 들어 있습니다" })
  .describe("특수일 영업시간 — 요일표보다 우선한다")
export type SpecialHours = z.infer<typeof SpecialHours>

/** 공휴일 목록(찍어낼 때 천문연 특일 정보에서 받아 굽는다 — P3-3 Task 9). 이 나라 달력의 쉬는 날이라 요일과 상관없이 정책(HolidayPolicy)을 받는다. */
export const Holidays = z.array(z.object({ date: IsoDate, label: z.string().min(1).describe("공휴일 이름(설날·추석·대체공휴일 …)") })).describe("공휴일 목록")
export type Holidays = z.infer<typeof Holidays>
/** closed 공휴일은 쉰다 · open 요일표대로(기본) · special 은 그날을 SpecialHours 에서 정한다(없으면 요일표) */
export const HolidayPolicy = z.enum(["closed", "open", "special"], { error: "공휴일 정책은 closed·open·special 중 하나여야 합니다" })
export type HolidayPolicy = z.infer<typeof HolidayPolicy>

const DAY_KO: Record<Day, string> = { mo: "월", tu: "화", we: "수", th: "목", fr: "금", sa: "토", su: "일" }
const clock = (m: number) => {
  const d = Math.floor(m / 1440), r = m % 1440
  const t = `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`
  return d ? `익일 ${t}` : t
}
/**
 * 화면에 싣는 영업시간 한 줄(예: 「화 10:00~20:00」, 「금 18:00~익일 02:00」, 「토 10:00~24시 (쉬는 시간 14:00~15:00)」).
 * JSON-LD(toOpeningHoursSpecification)와 같은 객체를 쓴다.
 */
export function formatOpeningHours(h: OpeningHours[number]): string {
  const { open, close, breaks } = hoursTimeline(h)
  const end = h.closes === "24:00" ? "24시" : clock(close)
  const rest = breaks.length ? ` (쉬는 시간 ${breaks.map(([s, e]) => `${clock(s)}~${clock(e)}`).join(", ")})` : ""
  return `${DAY_KO[h.day]} ${clock(open)}~${end}${rest}`
}

// 옛 real-preferred → stock-ok(스톡 허용), illustration → generated-ok(생성 허용), 그림이 없는 칸 → none (P3-3 Task 1, 대장 C12 — 찍어내기 미디어 단계 factory/stamp/media.mjs 와 같은 값)
export const IMAGE_SOURCES = ["real-required", "stock-ok", "generated-ok", "none"] as const

/** 이미지 칸. source 는 출처 정책이다(factory-rules.md §20-5): 사람·장소·판매 상품·작업물은 real-required. */
export const ImageSlot = z
  .object({
    id: z.string().min(1).describe("칸 id — 원형 JSON 의 imageSlots id"),
    aspect: z.string().regex(/^\d+(:\d+|x\d+(-\d+)?)$/, { error: "비율은 16:9 또는 860x1000-1200 형식이어야 합니다" }).describe("가로:세로 비율(예: 16:9)"),
    source: z.enum(IMAGE_SOURCES).describe("출처 정책: 실사 필수·스톡 허용·생성 허용·없음"),
    alt: z.string().describe("대체 텍스트 — 글자가 든 이미지는 그 글자를 옮긴다. 장식 이미지만 빈 문자열"),
    src: z.string().min(1).optional().describe("이미지 경로 — 비우면 비율을 고정한 빈 슬롯(「매장 사진 자리」)으로 납품"),
    license: Url.optional().describe("라이선스 URL(상업 무료 사진을 쓸 때)"),
  })
  .describe("이미지 칸")
export type ImageSlot = z.infer<typeof ImageSlot>

/** 문구 칸. maxChars 를 넘으면 실패한다(원형 칸 정의의 maxChars 가 기본값). */
export const CopySlot = z
  .object({
    id: z.string().min(1).describe("칸 id — 원형 JSON 의 copySlots id"),
    role: z.string().min(1).describe("문구의 역할"),
    maxChars: z.number().int().positive().optional().describe("최대 글자 수"),
    text: z.string({ error: "문구가 비었습니다" }).min(1, { error: "문구가 비었습니다" }).describe("문구"),
    tone: z.string().optional().describe("말투(예: 존댓말·짧게)"),
    forbid: z.array(z.string()).optional().describe("쓰면 안 되는 말"),
  })
  .superRefine((c, ctx) => {
    if (c.maxChars !== undefined && [...c.text].length > c.maxChars)
      ctx.addIssue({ code: "custom", path: ["text"], message: `「${c.id}」 문구가 ${[...c.text].length}자입니다 — ${c.maxChars}자 이하로 줄여 주세요` })
    for (const w of c.forbid ?? []) if (w && c.text.includes(w)) ctx.addIssue({ code: "custom", path: ["text"], message: `「${c.id}」 문구에 금지어 「${w}」가 있습니다` })
  })
  .describe("문구 칸")
export type CopySlot = z.infer<typeof CopySlot>

/** 링크 주소: http(s)·tel:·mailto:·사이트 안 경로(/…, //로 시작하는 다른 호스트는 아님)·앵커(#…). javascript: 등은 거절한다. */
export const HREF_PATTERN = /^(https?:\/\/\S+$|tel:\+?[\d-]+$|mailto:[^\s@<>()[\]\\,;:"?&#%/=]+@[^\s@<>()[\]\\,;:".?&#%/=]+(\.[^\s@<>()[\]\\,;:".?&#%/=]+)*\.[A-Za-z]{2,}(\?\S*)?$|\/(?![/\\])[^\s\\]*$|#\S*$)/i
/**
 * mailto: 로 쓸 메일 주소(FINAL-WF E3): 앞부분(@ 앞)과 도메인에 ? & # % / = 가 없다 — `a?bcc=x@y.z` 가 주소줄에서 숨은 수신자·머리글이 되는 길을 막는다.
 * 링크(HREF_PATTERN)의 mailto 는 `?` 앞 주소만 이 식으로 본다(`?subject=…` 는 허용). 찍어낸 사이트의 `$ref … as: "mailto"` 와 정적 어댑터 mailtoSubmit 이 같은 식을 쓴다.
 */
export const MAILTO_ADDRESS = /^[^\s@<>()[\]\\,;:"?&#%/=]+@[^\s@<>()[\]\\,;:".?&#%/=]+(\.[^\s@<>()[\]\\,;:".?&#%/=]+)*\.[A-Za-z]{2,}$/
export const isMailAddress = (v: string) => MAILTO_ADDRESS.test(v)
export const HREF_ERROR = "링크는 https://·tel:·mailto:·/경로·#앵커 중 하나여야 합니다"
export const Href = z.string({ error: "링크 주소를 적어 주세요" }).regex(HREF_PATTERN, { error: HREF_ERROR }).describe("링크 주소")

/** 행동 버튼·링크. */
export const Cta = z
  .object({
    label: z.string({ error: "버튼 이름이 비었습니다" }).min(1, { error: "버튼 이름이 비었습니다" }).describe("보이는 이름 = 접근 가능한 이름"),
    href: Href,
  })
  .describe("행동 버튼·링크")
export type Cta = z.infer<typeof Cta>

export const CONTACT_KINDS = ["tel", "kakao", "naver-booking", "mail", "catchtable"] as const

/** 연락·예약 채널. value 는 tel 이면 전화번호, mail 이면 메일 주소, 나머지는 https 주소. */
export const ContactChannel = z
  .object({
    kind: z.enum(CONTACT_KINDS).describe("채널 종류: 전화·카카오톡 채널·네이버 예약·메일·캐치테이블"),
    value: z.string().min(1).describe("전화번호·메일 주소·채널 URL"),
  })
  .superRefine((c, ctx) => {
    const ok =
      c.kind === "tel" ? Phone.safeParse(c.value).success
      : c.kind === "mail" ? z.email().safeParse(c.value).success
      : Url.safeParse(c.value).success && /^https:/i.test(c.value)
    if (!ok) ctx.addIssue({ code: "custom", path: ["value"], message: `${c.kind} 채널 값이 올바르지 않습니다: ${c.value}` })
  })
  .describe("연락·예약 채널")
export type ContactChannel = z.infer<typeof ContactChannel>

/** 자주 묻는 질문 한 쌍. */
export const Faq = z.object({ q: z.string().min(1).describe("질문"), a: z.string().min(1).describe("답"), topic: z.string().min(1).optional().describe("주제 — 주제별 묶음 변형이 이 이름으로 묶는다. 모든 질문에 적을 때만 주제별로 그린다(브리프 사실에 주제가 없으면 적지 않는다)") }).describe("자주 묻는 질문")
export type Faq = z.infer<typeof Faq>

/** 원형 JSON 의 칸 정의(id → 역할·최대 글자 수 / 비율·출처 정책). */
export type CopySlotDefs = Readonly<Record<string, { readonly role: string; readonly maxChars: number | null }>>
export type ImageSlotDefs = Readonly<Record<string, { readonly aspect: string | null; readonly source: (typeof IMAGE_SOURCES)[number] }>>

/**
 * 원형의 문구·이미지 칸 목록 스키마. 칸 id 는 원형 정의에 있어야 하고, 문구는 정의의 maxChars 를,
 * 이미지는 정의의 비율·출처 정책을 따라야 한다. `blocked` 에 든 칸 id 는 넣을 수 없다(예: 의료 변형의 후기 칸).
 */
export function slotsSchema(copyDefs: CopySlotDefs, imageDefs: ImageSlotDefs) {
  return z
    .object({
      copy: z.array(CopySlot).default([]).describe("문구 칸 목록"),
      images: z.array(ImageSlot).default([]).describe("이미지 칸 목록"),
    })
    .superRefine((s, ctx) => {
      s.copy.forEach((c, i) => {
        // 「ui:<잎 경로>」 칸은 원형 정의가 아니라 블록 예시의 화면 안내 문구다(P3-3 Task 9b, 04-content 가 요청한다) — 글자 수 제한 없음
        const def = copyDefs[c.id] ?? (c.id.startsWith("ui:") ? { role: "화면 안내 문구", maxChars: null } : undefined)
        if (!def) return ctx.addIssue({ code: "custom", path: ["copy", i, "id"], message: `이 원형에 없는 문구 칸입니다: ${c.id}` })
        const max = c.maxChars ?? def.maxChars
        if (max != null && [...c.text].length > max)
          ctx.addIssue({ code: "custom", path: ["copy", i, "text"], message: `「${c.id}」 문구가 ${[...c.text].length}자입니다 — ${max}자 이하로 줄여 주세요` })
      })
      s.images.forEach((m, i) => {
        const def = imageDefs[m.id]
        if (!def) return ctx.addIssue({ code: "custom", path: ["images", i, "id"], message: `이 원형에 없는 이미지 칸입니다: ${m.id}` })
        if (m.source !== def.source)
          ctx.addIssue({ code: "custom", path: ["images", i, "source"], message: `「${m.id}」 칸의 출처 정책은 ${def.source} 입니다(지금 ${m.source})` })
        if (def.aspect && m.aspect !== def.aspect)
          ctx.addIssue({ code: "custom", path: ["images", i, "aspect"], message: `「${m.id}」 칸의 비율은 ${def.aspect} 입니다(지금 ${m.aspect})` })
      })
    })
}


/**
 * 사이트 한 벌의 공통 사실(J9 — SEO 메타·OG·파비콘·JSON-LD·robots·sitemap 이 이 객체와 원형 콘텐츠에서만 나온다).
 * 찍어낸 콘텐츠 파일은 `{ ...원형 콘텐츠, site }` 모양이다. 사이트 이름은 따로 적지 않으면 원형의 회사·가게·제품·기관 이름을 쓴다.
 * 사이트는 한국어 또는 영어 하나다(§9 Q4) — hreflang 짝은 기본 끔이고, 다른 언어 사이트가 따로 있을 때만 `hreflang` 에 적는다.
 */
export const Site = z
  .object({
    url: Url.describe("사이트 기준 주소(https://…) — canonical·OG·sitemap 의 절대 주소가 여기서 나온다"),
    locale: z.enum(["ko", "en"]).default("ko").describe("사이트 언어 하나(ko 또는 en)"),
    name: z.string().min(1).optional().describe("사이트 이름 — 없으면 원형의 회사·가게·제품·기관 이름"),
    description: z.string().min(1).optional().describe("사이트 한두 문장 요약 — 페이지 설명이 없을 때 meta description"),
    sameAs: z.array(Url).default([]).describe("같은 사업체를 가리키는 공식 채널(네이버 플레이스·블로그·카카오톡 채널 등) — Organization sameAs"),
    verification: z
      .object({
        google: z.string().min(1).optional().describe("Google Search Console 소유확인 값(google-site-verification)"),
        naver: z.string().min(1).optional().describe("네이버 서치어드바이저 소유확인 값(naver-site-verification)"),
        bing: z.string().min(1).optional().describe("Bing 웹마스터 도구 소유확인 값(msvalidate.01)"),
      })
      .default({})
      .describe("검색 엔진 소유확인 메타 값"),
    hreflang: z
      .record(z.string().regex(/^([a-z]{2}(-[A-Z]{2})?|x-default)$/, { error: "hreflang 키는 ko·en·en-US·x-default 형식입니다" }), Url)
      .optional()
      .describe("다른 언어 사이트 기준 주소(기본 끔 — §9 Q4). 예: { en: \"https://en.example.com\" }"),
  })
  .describe("사이트 공통 사실")
export type Site = z.infer<typeof Site>
/** 기본값을 채우기 전 모양(locale·sameAs·verification 생략 가능) — ax 층 도우미가 받는 모양. */
export type SiteInput = z.input<typeof Site>
