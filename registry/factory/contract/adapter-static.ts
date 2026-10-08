// 정적 어댑터(registry:lib "adapter-static"). 서버 없는 배포(단일 HTML)에서 블록의 제출 포트를 메일·전화·카카오톡 채널로 잇는다.
// 네트워크를 쓰지 않는다 — 사용자의 메일 앱·전화 앱·카카오톡을 열 뿐이고, 보내기는 사람이 누른다(factory-rules.md §20-6 자동 제출 금지와 같은 방향).
// npm 의존 0(전화번호 정규화만 lib/phone 항목): 설정값(받는 주소·채널 URL)은 포트를 만들 때 작은 정규식으로 한 번 검사하고, 틀리면 개발자용 오류로 바로 멈춘다.
import type { ActionResult } from "@/registry/factory/contract/block-contract"
import type { BillingPort } from "@/registry/factory/contract/ports"
import { normalizePhone } from "@/registry/factory/lib/phone"

export interface StaticReceipt {
  reference: "mailto" | "tel" | "kakao"
  href: string // 연 주소 — 창이 안 열렸을 때 블록이 링크로 다시 보여준다(항상 그린다). 사용자 입력은 넣지 않는다(kakao)
  nextStep: string // 사람이 할 다음 행동(성공 화면 문구)
  text?: string // 복사해 붙여넣을 글(kakao, 너무 긴 메일 본문)
  copied?: boolean // text 를 클립보드에 복사했는가
}

export type StaticSubmit<TInput> = (input: TInput) => Promise<ActionResult<StaticReceipt>>

export interface OpenOptions {
  /** 주소를 여는 방법. 기본은 브라우저(mailto·tel: location, 카카오: 새 창). 테스트·앱 셸에서 바꿔 끼운다 */
  open?: (href: string) => void
  /** 글을 클립보드에 넣는 방법. 기본은 navigator.clipboard.writeText */
  copy?: (text: string) => void | Promise<void>
}

const NO_BROWSER = "브라우저에서만 보낼 수 있어요. 페이지를 새로 고친 뒤 다시 시도해 주세요."
const OPEN_FAILED = "보내기 창을 열지 못했어요. 잠시 후 다시 시도해 주세요."
const LINK_HINT = " 창이 열리지 않으면 아래 링크를 눌러 주세요."
const hasWindow = () => typeof window !== "undefined"

// 짝 없는 서로게이트(이모지를 잘랐을 때 등)는 encodeURIComponent 를 URIError 로 멈추게 한다 → U+FFFD 로 바꾼다.
const wellFormed = (s: string) => s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�")

// 포트는 절대 거부(reject)하지 않는다 — 블록은 ActionResult 만 기다린다. 콜백·인코딩·창 열기의 예외는 다시 시도할 수 있는 formError 로.
function neverReject<TInput>(body: (input: TInput) => Promise<ActionResult<StaticReceipt>>): StaticSubmit<TInput> {
  return async (input) => {
    try {
      return await body(input)
    } catch {
      return { ok: false, formError: OPEN_FAILED, retryable: true }
    }
  }
}

// 복사를 시작하고 창을 여는 것까지 await 없이 한다 — 사용자 클릭(일시적 활성화) 안에 있어야 팝업 차단·클립보드 거부를 피한다.
async function copyThenOpen(text: string, href: string, open: (h: string) => void, copy: OpenOptions["copy"]): Promise<boolean> {
  let pending: void | Promise<void> | undefined
  let copied = false
  try {
    pending = copy?.(text)
    copied = copy !== undefined
  } catch {
    // 권한 거부·비보안 문맥 → 창만 연다
  }
  open(href)
  try {
    await pending
  } catch {
    copied = false
  }
  return copied
}

const defaultCopy = () => (hasWindow() && navigator.clipboard ? (t: string) => navigator.clipboard.writeText(t) : undefined)

// ── 메일 ────────────────────────────────────────────────────────────────
// 받는 주소: 공백·꺾쇠·따옴표 없는 local@domain.tld 정도만 본다(설정값 오타를 잡는 것이 목적).
// 앞부분(@ 앞)과 도메인에 ? & # % / = 가 있으면 거절한다(FINAL-WF E3) — `a?bcc=x@y.z` 가 mailto: 주소줄에서 숨은 수신자·머리글이 되는 길.
// content-core 의 MAILTO_ADDRESS·찍어내기 site-bind 의 MAIL_ADDRESS 와 같은 식이다(시험 stamp-mail-address.test.mjs 가 맞춰 본다).
const EMAIL = /^[^\s@<>()[\]\\,;:"?&#%/=]+@[^\s@<>()[\]\\,;:".?&#%/=]+(\.[^\s@<>()[\]\\,;:".?&#%/=]+)*\.[A-Za-z]{2,}$/
/** mailto: 주소가 이보다 길면 일부 Windows 메일 처리기가 자르거나 거부한다 → 본문은 복사로 넘긴다 */
export const MAX_MAILTO_LENGTH = 2000

// RFC 6068: UTF-8 퍼센트 인코딩. 제목에는 줄바꿈이 들어가면 안 되므로(머리글 주입) 공백으로, 본문 줄바꿈은 CRLF 로.
// URLSearchParams 는 공백을 + 로 바꿔 메일 앱에 + 가 그대로 보이므로 쓰지 않는다.
const mailSubject = (s: string) => encodeURIComponent(wellFormed(s).replace(/[\r\n]+/g, " "))
const mailBody = (s: string) => encodeURIComponent(wellFormed(s).replace(/\r\n|\r|\n/g, "\r\n"))
const show = (v: unknown) => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v))
const defaultBody = (input: unknown) =>
  input !== null && typeof input === "object"
    ? Object.entries(input)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}: ${show(v)}`)
        .join("\n")
    : String(input ?? "")

/**
 * 메일 앱을 제목·본문이 채워진 새 메일로 연다. 본문 기본값은 입력의 「키: 값」 줄.
 * 주소가 MAX_MAILTO_LENGTH 를 넘으면 본문은 클립보드로 넘기고 제목만 채운 메일을 연다(data.text 에 본문).
 * 받는 주소가 틀리면 포트를 만들 때 멈춘다(개발자 오류). 포트는 함수라 서버 컴포넌트에서 클라이언트 블록으로 props 로
 * 넘길 수 없다 — 클라이언트 래퍼('use client') 안에서 만든다.
 */
export function mailtoSubmit<TInput>(
  to: string,
  subjectFrom: (input: TInput) => string,
  options: OpenOptions & { body?: (input: TInput) => string } = {},
): StaticSubmit<TInput> {
  const addr = to.trim()
  if (!EMAIL.test(addr)) throw new Error(`mailtoSubmit: 받는 메일 주소가 올바르지 않아요 — "${to}"`)
  return neverReject(async (input) => {
    const open = options.open ?? (hasWindow() ? (h: string) => window.location.assign(h) : undefined)
    if (!open) return { ok: false, formError: NO_BROWSER }
    const head = `mailto:${addr}?subject=${mailSubject(subjectFrom(input))}`
    const bodyText = (options.body ?? defaultBody)(input)
    const href = `${head}&body=${mailBody(bodyText)}`
    if (href.length <= MAX_MAILTO_LENGTH) {
      open(href)
      return { ok: true, data: { reference: "mailto", href, nextStep: "메일 앱에서 내용을 확인한 뒤 보내기를 눌러 주세요." + LINK_HINT } }
    }
    const text = wellFormed(bodyText)
    const copied = await copyThenOpen(text, head, open, options.copy ?? defaultCopy())
    return {
      ok: true,
      data: {
        reference: "mailto",
        href: head,
        text,
        copied,
        nextStep:
          (copied
            ? "내용이 길어 메일 본문에 다 담지 못했어요. 복사한 내용을 본문에 붙여넣어 보내 주세요."
            : "내용이 길어 메일 본문에 다 담지 못했어요. 아래 내용을 복사해 본문에 붙여넣어 보내 주세요.") + LINK_HINT,
      },
    }
  })
}

// ── 전화 ────────────────────────────────────────────────────────────────
// 정규화는 lib/phone 의 normalizePhone 하나다(최종 리뷰 M5): 국내 0XXXXXXXX(9~11자리)·대표번호 1XXX-XXXX 는 국내 숫자,
// +82 등 국제 번호는 E.164(+ 와 8~15자리). SiteShell 의 tel: 링크도 같은 함수라 같은 설정값이면 같은 링크다.
const PHONE_ERROR = "전화번호 설정을 확인해 주세요 (예: 02-123-4567, +82 10-1234-5678)."
export { normalizePhone }

/**
 * tel: 링크. 여는 일은 <a href> 가 하므로 결과만 돌려준다(블록은 data.href 를 링크로 그린다).
 * 전화번호는 사이트 설정값이라 오류는 필드가 아니라 formError 로 돌려준다.
 */
export function telLink(phone: string): ActionResult<StaticReceipt> {
  const digits = normalizePhone(phone)
  if (!digits) return { ok: false, formError: PHONE_ERROR }
  return { ok: true, data: { reference: "tel", href: `tel:${digits}`, nextStep: "전화 앱에서 통화 버튼을 눌러 주세요." } }
}

// ── 카카오톡 채널 ────────────────────────────────────────────────────────
// 채널 URL: https://pf.kakao.com/<프로필 ID>(developers.kakao.com 「카카오톡 채널 > 이해하기」, 예 https://pf.kakao.com/_ZeUTxl).
// 1:1 채팅은 <채널 URL>/chat (Kakao JS SDK 2.7.4 Channel.chat 이 여는 주소). 뒤에 /chat·/ 가 붙어 와도 받는다.
const KAKAO_CHANNEL = /^https:\/\/pf\.kakao\.com\/(_[A-Za-z0-9]+)\/?(?:chat\/?)?$/

/**
 * 카카오톡 채널 1:1 채팅을 열고, 보낼 글은 클립보드에 복사한다(「붙여넣어 보내 주세요」로 안내).
 * 카카오톡 채널 채팅은 미리 채운 글을 받지 않는다(SDK·문서에 글 매개변수가 없다). 그래서 글을 주소에 싣지 않는다 —
 * 효과 없이 방문 기록·서버 로그에 개인정보만 남기 때문이다. data.href 는 입력과 무관한 채팅방 주소다.
 * 채널 URL 이 틀리면 포트를 만들 때 멈춘다(개발자 오류). 포트는 함수라 서버 컴포넌트에서 클라이언트 블록으로 props 로
 * 넘길 수 없다 — 클라이언트 래퍼('use client') 안에서 만든다.
 */
export function kakaoChannelSubmit<TInput>(
  channelUrl: string,
  format: (input: TInput) => string,
  options: OpenOptions = {},
): StaticSubmit<TInput> {
  const m = channelUrl.trim().match(KAKAO_CHANNEL)
  if (!m) throw new Error(`kakaoChannelSubmit: 카카오톡 채널 주소가 올바르지 않아요 — "${channelUrl}" (예: https://pf.kakao.com/_채널ID)`)
  const href = `https://pf.kakao.com/${m[1]}/chat`
  return neverReject(async (input) => {
    const open = options.open ?? (hasWindow() ? (h: string) => void window.open(h, "_blank", "noopener,noreferrer") : undefined)
    if (!open) return { ok: false, formError: NO_BROWSER }
    const text = wellFormed(format(input))
    const copied = await copyThenOpen(text, href, open, options.copy ?? defaultCopy())
    return {
      ok: true,
      data: {
        reference: "kakao",
        href,
        text,
        copied,
        nextStep:
          (copied
            ? "카카오톡 채널 채팅방에 복사한 내용을 붙여넣어 보내 주세요."
            : "카카오톡 채널 채팅방에서 요청 내용을 적어 보내 주세요.") + LINK_HINT,
      },
    }
  })
}

// ── 호스팅 결제 링크(P3-2 Task 10) ────────────────────────────────────────
// 서버 없는 가벼운 조합·단일 HTML 의 결제: Paddle·토스페이먼츠 등이 만들어 준 결제 페이지 주소로 보낸다(결제 상태는 공급자가 가진다).
const CHECKOUT_FAILED = "선택한 요금제의 결제 링크가 없어요. 다른 요금제를 선택하거나 문의해 주세요."

function checkoutUrl(raw: string): string {
  const s = typeof raw === "string" ? raw.trim() : ""
  let u: URL | undefined
  try {
    u = new URL(s)
  } catch {
    u = undefined
  }
  if (!u || u.protocol !== "https:" || u.username || u.password)
    throw new Error(`hostedCheckoutLink: 결제 링크는 계정 정보 없는 https 주소여야 해요 — "${String(raw)}"`)
  return s
}

/**
 * 호스팅 결제 링크를 BillingPort["checkout"] 으로 끼운다. 결과는 { redirectUrl } — 블록이 그 주소로 이동한다(이 함수는 창을 열지 않는다).
 * url 하나면 모든 요금제가 그 링크로, { planId: url } 표면 요금제마다 제 링크로 간다(표에 없는 요금제는 formError).
 * 링크는 https 만 받는다 — 틀리면 포트를 만들 때 멈춘다(개발자 오류). 네트워크를 쓰지 않는다.
 * 계약 판 2 의 선택 입력 trial·withdrawalConsent 는 받아도 쓰지 않는다 — 체험·약관은 호스팅 결제 페이지가 정하고, 청약철회 고지·체크는 블록이 결제를 시작하기 전에 이미 받았다(Task 10d).
 * 포트는 함수라 서버 컴포넌트에서 클라이언트 블록으로 props 로 넘길 수 없다 — 클라이언트 래퍼('use client') 안에서 만든다.
 */
export function hostedCheckoutLink(url: string | Readonly<Record<string, string>>): BillingPort["checkout"] {
  const single = typeof url === "string" ? checkoutUrl(url) : undefined
  const table = new Map<string, string>()
  if (single === undefined) {
    const entries = url && typeof url === "object" ? Object.entries(url) : []
    if (!entries.length) throw new Error("hostedCheckoutLink: 결제 링크가 없어요 — 주소 하나나 { 요금제 id: 주소 } 표를 주세요")
    for (const [planId, u] of entries) table.set(planId, checkoutUrl(u))
  }
  return async (input) => {
    const href = single ?? (typeof input?.planId === "string" ? table.get(input.planId) : undefined)
    if (!href) return { ok: false, formError: CHECKOUT_FAILED }
    return { ok: true, data: { redirectUrl: href } }
  }
}
