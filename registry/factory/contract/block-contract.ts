// 블록 계약(registry:lib "block-contract"). 블록은 이 파일과 자기 스키마에만 기댄다 — 공급자 SDK·서버 코드를 import하지 않는다.
// 기능(인증·결제·데이터)은 어댑터가 블록의 포트(port)를 구현해 끼운다: adapter-static(단일 HTML)·adapter-mock(QA)·feature 어댑터.
// 정본 규칙: factory-rules.md §20-6. 타입 초안: docs/inputs/contract-draft.md §3 (그대로 옮겼다).
// 이 파일은 타입만 내보낸다(런타임 코드·의존 0) — 어느 출력 경로에서도 비용 없이 설치된다.

/**
 * 실패 code 값(계약 판 2 안의 선택 추가 — P3-2 Task 10d, 대장 A52·A101·D136·D160). 블록은 아는 값에만 갈래를 두고 모르는 값은 formError 로 그린다.
 *   rate_limited — 요청 제한(retryAfter 초 뒤에 다시) · bot_check_failed·bot_check_unavailable — 봇 확인 실패·확인 불가 · in_progress — 같은 멱등 키가 처리 중
 *   invalid_token — 메일 링크의 토큰(비밀번호 재설정 resetPassword)이 틀렸거나 만료됐거나 이미 쓰였다 — 블록이 다시 요청하는 길로 보낸다
 *   provider_unsupported — 공급자가 API 로 할 수 없는 동작(예: Gumroad 해지) · scenario_unsupported — 그 공급자에 그 상태 자체가 없음(일시정지 등)
 *   confirmation_required — **승인 대기**(P3-7 AXC — launch-factory LFAX R20·R21). 사람이 확인해야 하는 행동(결제·해지·요금제 변경·가격 변경 동의·탈퇴·이메일 변경·수신 동의 변경·내 정보 내려받기)을
 *     확인 입력(`confirmed: true`) 없이 불렀다 — **오류가 아니라 정해진 결과다**(`provider_unsupported` 와 같은 자리). 어댑터는 아무것도 바꾸지 않고(상태 불변·공급자 호출 0) `retryable: false` 로 끝낸다.
 *     블록이 오류 색이 아닌 승인 대기 알림으로 보이고(data-state="awaiting-approval"), 자동으로 다시 시도하지 않는다. 탈퇴에서 입력한 이메일이 틀린 경우도 이 값이다(`fieldErrors.confirmEmail`)
 *   approval_required — `confirmation_required` 의 옛 이름(AXWF 초안). 뜻·화면은 같다 — 블록은 둘 다 승인 대기로 그린다. 새 어댑터는 `confirmation_required` 를 쓴다
 *   sign_in_required — 로그인이 먼저다(retryable false). `signInRequired` 는 같은 뜻의 옛 표기(P3-6 B04)다 — 블록은 둘 다 로그인 행동으로 그린다(읽기 오류 화면 _shared/port-read ReadError)
 *   provider_unavailable — 공급자·서버에 닿지 못했거나 일시 실패(retryable true) · invalid_input — 칸 오류(fieldErrors, retryable false) · invalid_credentials — 이메일·비밀번호가 맞지 않음(retryable false)
 *   action_failed — 위에 없는 실패(마지막 보루, retryable false)
 *   두 「지원 안 함」 값은 오류가 아니라 정해진 결과다 — manageUrl 이 있으면 블록이 손님을 그 화면으로 보낸다.
 * 시간 초과(timeout)는 서버 값이 아니다 — 응답이 안 오는 것이라 폼이 15초 뒤에 스스로 판단한다(_shared/submit-guard).
 */
export type ActionFailureCode = "rate_limited" | "bot_check_failed" | "bot_check_unavailable" | "in_progress" | "provider_unsupported" | "scenario_unsupported" | "invalid_token" | "signInRequired" | "sign_in_required" | "approval_required" | "confirmation_required" | "provider_unavailable" | "invalid_input" | "invalid_credentials" | "action_failed"

/** 서버 액션·정적 어댑터·목 어댑터가 모두 돌려주는 결과. next-safe-action 결과와 1:1 변환 가능 */
export type ActionResult<TData> =
  | { ok: true; data: TData; message?: string }
  | {
      ok: false
      formError?: string // 필드와 무관한 오류(「지금은 예약을 받지 않습니다」)
      fieldErrors?: Partial<Record<string, string[]>> // 필드 옆에 표시(DESIGN.md §7-A)
      /**
       * 같은 요청을 그대로 다시 보내면 성공할 수 있는가(네트워크 오류 등 true → [다시 시도] 노출). 블록은 알림 상자에 data-retryable 로 남긴다(자동화가 글을 해석하지 않고 다시 시도해도 되는지 안다 — P3-7 AXWF, R21).
       * **`code` 가 있으면 어댑터는 `retryable` 도 준다**(P3-7 AXC 문서화 — 타입은 선택 칸이라 안 주는 옛 어댑터도 계약을 지킨다. 안 주면 블록은 표지를 달지 않는다: 거짓 약속 없음).
       * 값은 code 가 정한다: rate_limited·bot_check_failed·bot_check_unavailable·in_progress·provider_unavailable 은 true, 나머지(사람이 먼저 무언가 해야 하는 값 — 로그인·확인·입력 고치기·지원 안 함)는 false
       */
      retryable?: boolean
      /** 실패 갈래(선택, 계약 판 2). 알려진 값(ActionFailureCode)에만 블록이 갈래를 둔다 — 공급자 어댑터가 더 넓은 문자열을 줘도 받는다. 화면은 formError 를 그린다. 예: checkout 의 "trial_unavailable"(ports BillingPort) */
      code?: ActionFailureCode | (string & {})
      /** code: rate_limited 일 때 다시 보낼 수 있을 때까지 남은 초(양의 정수, RFC 9110 Retry-After 의 delay-seconds 와 같은 뜻) */
      retryAfter?: number
      /** code: provider_unsupported·scenario_unsupported 일 때 손님이 직접 관리할 곳(https 주소) */
      manageUrl?: string
    }

/** 읽기 데이터의 네 상태. 블록은 네 가지를 모두 그려야 한다(렌더 감사 대상) */
export type AsyncState<T> =
  | { status: "loading" }
  | { status: "empty"; reason?: string }
  | { status: "error"; message: string; retry?: () => void; /** 실패 갈래(ActionResult.code 그대로, 선택 — P3-6 B04·L04) */ code?: ActionFailureCode | (string & {}); /** ActionResult.retryable 그대로(선택 — P3-7 AXWF) */ retryable?: boolean }
  | { status: "ready"; data: T }

/** 모든 블록 공통: 사용자에게 보이는 문구는 전부 copy로 받는다(블록 안 하드코딩 금지 → i18n 접합면) */
export interface BlockBase<TCopy> {
  copy: TCopy
  locale?: "ko" | "en"
  /** IANA 시간대(선택, D234) — 날짜를 읽는 블록(결제·계정·공지)이 그 시간대의 날짜로 적는다. 없으면 Asia/Seoul */
  timeZone?: string
  id?: string // 앵커·aria 연결용
  className?: string
}

/** 미디어 칸의 출처 정책(content-core IMAGE_SOURCES 와 같은 값 — factory-rules.md §20-5). 사람·장소·판매 상품·작업물은 real-required */
export type MediaSource = "real-required" | "real-preferred" | "generated-ok" | "illustration"

/**
 * 그려진 이미지 한 장(블록이 받는 화면용 값 — 콘텐츠 스키마의 ImageSlot 을 빌드한 결과).
 * width·height 는 가장 큰 파일의 픽셀이다 — 블록은 이 비로 자리를 미리 잡는다(레이아웃 이동 0).
 * sources 는 형식별 후보(AVIF 먼저), src·srcSet 은 마지막 대체(WebP). focal 은 잘릴 때 남길 점(0~1, object-position).
 */
export interface ImageSlot {
  kind?: "image"
  src: string
  srcSet: string
  sources?: { type: string; srcSet: string }[]
  alt: string // 장식 이미지만 빈 문자열
  width: number
  height: number
  focal?: { x: number; y: number }
  source?: MediaSource
  previewLabel?: string // 보드 미리보기 전용 사진 표지(「미리보기 전용 사진」 — 실사 필수 칸을 스톡·생성으로 채운 결선 미리보기, 공개본에는 없다). 있으면 그림 위에 보인다
}

/**
 * 짧은 반복 영상 한 칸. 소리는 없다(muted: true 만 허용 — 자동 재생 규칙). poster 는 첫 칠·동작 줄이기·재생 전 자리에 그리는 그림(첫 프레임).
 * decorative 면 읽기 도구에서 숨기고, 아니면 alt 를 이름으로 읽는다. 재생은 보일 때만, 동작 줄이기에서는 멈춘 포스터.
 */
export interface VideoSlot {
  kind: "video"
  mp4: string // H.264
  webm?: string // VP9
  poster: ImageSlot
  alt: string
  decorative?: boolean
  loop: boolean
  muted: true
  width: number
  height: number
  focal?: { x: number; y: number }
  source?: MediaSource
  previewLabel?: string // ImageSlot.previewLabel 과 같다
}

/**
 * 3D 모델 한 칸(판 2 안의 선택 추가 — 3D 히어로 object-3d-orbit 이 받는다). 모델은 **이미지에서 시작한다**: 고품질 원본 이미지 → 이미지-3D 변환 GLB → 화면은 표시만(라이브러리 기본 도형으로 채우지 않는다).
 * src 는 같은 출처의 GLB 주소(≤ 2 MB, PBR 재질 그대로 — 텍스처는 WebP, 메시는 양자화 또는 Draco). poster 는 같은 장면을 미리 찍은 그림(원본 이미지) — 첫 칠(LCP)·동작 줄이기·WebGL 없음일 때의 그림이다.
 * source: 판매 대상은 실제 사진에서 만든 모델(real-required), 상징·분위기 오브젝트는 생성 이미지에서 만든 모델(generated-ok).
 * dracoPath: Draco 로 줄인 GLB 일 때만 쓴다 — 디코더 폴더(같은 출처, 기본 "/draco/"). 양자화만 한 GLB 는 디코더가 필요 없다.
 */
export interface ModelSlot {
  src: string
  poster: ImageSlot
  source: "real-required" | "generated-ok"
  alt: string // 모델을 말로 설명한다(읽기 도구가 무대의 이름으로 읽는다)
  dracoPath?: string
  previewLabel?: string // ImageSlot.previewLabel 과 같다
}

export type MediaSlot = ImageSlot | VideoSlot

/** WebMCP 선언형 메타. 미지원 브라우저는 속성을 무시한다 */
export interface AgentToolMeta {
  toolName: string // 예: "request-booking"
  description: string // 무엇을 하는지 한 문장, 사람이 읽어도 맞는 말
  autoSubmit?: false // 되돌릴 수 없는 행위는 타입으로 false만 허용 — 에이전트는 채우고 사람이 누른다(§20-6)
}
