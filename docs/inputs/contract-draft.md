<!-- 출처: design-rules\factory\audit-2026-09-25\B_ax_boilerplate_content.md §3(TypeScript 계약 초안) -->

## 3. TypeScript 계약 초안: 예약 폼 블록

```ts
// design/contract/block-contract.ts  (registry:lib "block-contract")
// 블록은 이 파일과 자기 스키마에만 기댄다. 공급자 SDK를 import하지 않는다.

/** 서버 액션·정적 어댑터·목 어댑터가 모두 돌려주는 결과. next-safe-action 결과와 1:1 변환 가능 */
export type ActionResult<TData> =
  | { ok: true; data: TData; message?: string }
  | {
      ok: false
      formError?: string                              // 필드와 무관한 오류(「지금은 예약을 받지 않습니다」)
      fieldErrors?: Partial<Record<string, string[]>> // 필드 옆에 표시(DESIGN.md §7-A)
      retryable?: boolean                             // 네트워크 오류 등 → [다시 시도] 노출
    }

/** 읽기 데이터의 네 상태. 블록은 네 가지를 모두 그려야 한다(렌더 감사 대상) */
export type AsyncState<T> =
  | { status: "loading" }
  | { status: "empty"; reason?: string }
  | { status: "error"; message: string; retry?: () => void }
  | { status: "ready"; data: T }

/** 모든 블록 공통: 사용자에게 보이는 문구는 전부 copy로 받는다(블록 안 하드코딩 금지 → i18n 접합면) */
export interface BlockBase<TCopy> {
  copy: TCopy
  locale?: "ko" | "en"
  id?: string          // 앵커·aria 연결용
  className?: string
}

/** WebMCP 선언형 메타. 미지원 브라우저는 속성을 무시한다 */
export interface AgentToolMeta {
  toolName: string            // 예: "request-booking"
  description: string         // 무엇을 하는지 한 문장, 사람이 읽어도 맞는 말
  autoSubmit?: false          // 되돌릴 수 없는 행위는 타입으로 false만 허용
}
```

```ts
// design/blocks/booking-form/schema.ts  (블록과 함께 배포, feature 어댑터가 재사용)
import * as z from "zod"

export const bookingInputSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요").describe("예약자 이름"),
  phone: z
    .string()
    .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "휴대전화 번호 형식을 확인해 주세요 (예: 010-1234-5678)")
    .describe("예약 확인 문자를 받을 휴대전화 번호"),
  date: z.iso.date().describe("방문 날짜, YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}$/).describe("방문 시각, HH:MM (slots 중 하나)"),
  partySize: z.coerce.number().int().min(1).max(20).describe("인원 수"),
  note: z.string().max(500).optional().describe("요청 사항"),
  privacyConsent: z.literal(true, { error: "개인정보 수집·이용에 동의해 주세요" })
    .describe("개인정보 수집·이용 동의(필수)"),
})
export type BookingInput = z.infer<typeof bookingInputSchema>

export interface Slot { time: string; available: boolean; note?: string }
export interface BookingReceipt { reference: string; confirmedAt?: string; nextStep?: string }
```

```ts
// design/blocks/booking-form/booking-form.tsx 의 props
import type { ActionResult, AsyncState, BlockBase, AgentToolMeta } from "@/lib/block-contract"
import type { BookingInput, BookingReceipt, Slot } from "./schema"

export interface BookingFormCopy {
  title: string; submit: string; submitting: string
  success: (r: BookingReceipt) => string
  emptySlots: string; slotsError: string; privacyNotice: string
}

/** 포트(port): feature 층이 구현한다. 블록은 이것만 안다 */
export interface BookingPort {
  /** 서버 액션을 그대로 넘겨도 된다: async (input) => ActionResult<BookingReceipt> */
  submit: (input: BookingInput) => Promise<ActionResult<BookingReceipt>>
  /** 날짜가 바뀔 때 호출. 없으면 slots prop만 쓴다(정적 영업시간 기반) */
  loadSlots?: (date: string) => Promise<AsyncState<Slot[]>>
}

export interface BookingFormProps extends BlockBase<BookingFormCopy> {
  port: BookingPort
  slots?: AsyncState<Slot[]>          // 서버에서 미리 읽어 온 초기 상태
  defaultValues?: Partial<BookingInput>
  minDate?: string; maxDate?: string
  agent?: AgentToolMeta               // 주면 <form toolname=…>으로 에이전트에 노출
  onSuccess?: (r: BookingReceipt) => void   // 분석·전환 추적 훅 자리
}
```

어댑터 세 종류가 같은 포트를 구현한다.

```ts
// design/contract/adapter-static.ts: 단일 HTML·서버 없는 배포
export const kakaoChannelBooking = (channelUrl: string): BookingPort => ({
  submit: async (input) => {
    window.open(`${channelUrl}?text=${encodeURIComponent(formatBookingText(input))}`, "_blank")
    return { ok: true, data: { reference: "kakao", nextStep: "카카오톡 채널에서 확정 안내를 받습니다" } }
  },
})

// feature/booking/supabase/adapter.ts: 기능 공장이 추가 (registry:lib + registry:file 서버 액션 + envVars)
// "use server" 액션이 bookingInputSchema.safeParse → insert → ActionResult 반환.
// 페이지(Server Component)에서 <BookingForm port={{ submit: requestBookingAction }} … /> 로 끼운다.
```

설계 판단과 잃는 것:
- **포트 방식을 쓴 이유:** 블록을 타입 props만 받게 하면 서버 호출 위치가 페이지마다 흩어진다. 서버 액션을 블록에 직접 박으면 단일 HTML 출력이 불가능하다. 포트는 두 출력 경로와 공급자 교체를 모두 허용한다.
- **잃는 것:** ① 블록 하나당 파일이 2~3개 늘어난다(schema·props·어댑터). ② `useActionState` 기반의 JS 없는 점진적 향상(progressive enhancement)은 포트 함수를 통과하므로 기본으로는 빠진다. 필요한 원형(기관·공공)에만 `<form action={serverAction}>` 변형을 따로 둔다. ③ 스키마를 블록과 feature가 공유하므로 스키마 변경은 버전 태그로 관리해야 한다.
- **i18n:** 문구는 `copy`, 검증 문구는 스키마 안의 한국어 메시지, 대비책으로 `z.config(z.locales.ko())`를 둔다. 날짜·금액은 `Intl`로 처리한다.
