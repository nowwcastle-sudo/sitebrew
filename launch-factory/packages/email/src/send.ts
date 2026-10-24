// 메일 보내기. LF_MODE=mock 이면 키 없이 콘솔로 「보낸다」(렌더는 실제와 똑같이 한다 — 입력 오류는 mock 에서도 잡힌다).
// live 면 Resend 로 보낸다. 공급자 실패는 던지지 않고 결과 값으로 돌려준다(Resend SDK 도 { data, error } 로 준다).
// 입력 오류(EmailRenderError)는 던진다 — 프로그램 오류라 조용히 넘기면 안 된다(예: 기한 없는 가격 변경 안내).
// 콘솔 줄은 @launch-factory/security 의 maskPii 로 가린다(받는 주소·전화·토큰).
// 광고성 템플릿(kinds.ts)은 어댑터가 법정 표시를 책임진다(G03): 제품 설정의 사업자 정보(상호·이메일·전화·주소)와 로그인 없는 수신거부 링크가 없으면 보내지 않고 던지며(MarketingComplianceError),
// 있으면 본문 바닥글에 싣고 수신거부 헤더 List-Unsubscribe·List-Unsubscribe-Post(RFC 8058 — 한 번 눌러 수신거부)를 단다. 헤더가 DKIM 서명 대상(h=)에 들어가는지는 Resend 몫이다(문서: 확인 안 됨).
import { randomUUID } from "node:crypto"
import { appendFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { Resend } from "resend"
import { maskPii } from "@launch-factory/security"
import { renderEmail, type TemplateInputs, type TemplateName } from "./render.ts"
import { kindOf } from "./kinds.ts"
import type { AdvertisingInput } from "./advertising.ts"

export type MailMode = "mock" | "live"

/** Resend 클라이언트에서 쓰는 부분만. 테스트는 진짜 Resend + 녹화 응답 fetch 로 돈다. */
export interface ResendLike {
  emails: {
    send(
      payload: { from: string; to: string | string[]; subject: string; html: string; text: string; replyTo?: string; tags?: { name: string; value: string }[]; headers?: Record<string, string> },
      options?: { idempotencyKey?: string },
    ): Promise<{ data: { id: string } | null; error: { name: string; statusCode?: number | null; message: string } | null }>
  }
}

/** 광고성 메일의 전송자 표시에 쓰는 사업자 정보(제품 설정 LF_BUSINESS_* 에서 읽어 넘긴다 — 이 패키지에는 값이 없다) */
export interface MarketingMailConfig {
  business: { name?: string; email?: string; phone?: string; address?: string }
}

export interface MailerOptions {
  mode: MailMode
  /** 발신 주소(`"이름 <addr@도메인>"`). live 필수 — Resend 에서 인증한 도메인이어야 한다(운영자 할 일 O4) */
  from?: string
  /** live 필수. 값은 로그에 싣지 않는다 */
  apiKey?: string
  replyTo?: string
  /** mock 콘솔 출력 대상(기본 console.info) */
  log?: (line: string) => void
  /** mock 전용(LF_MOCK_OUTBOX): 이 파일에 메일마다 한 줄(JSONL — id·template·to·subject·at, 본문 없음)을 덧붙인다. 뒤 시험이 보낸 메일 수를 센다. live 는 무시 */
  outbox?: string
  /** 테스트·다른 공급자 주입용. 주면 apiKey 는 쓰지 않는다 */
  client?: ResendLike
  /** 광고성 템플릿을 보내려면 필요하다(없으면 광고성 메일은 보내지 않고 던진다) */
  marketing?: MarketingMailConfig
}

export interface SendRequest<N extends TemplateName> {
  to: string
  template: N
  input: TemplateInputs[N]
  /** 재시도 중복 방지 키(Resend Idempotency-Key). 예: `price-change:<구독 id>:<consentBy>` */
  idempotencyKey?: string
  /** 광고성 템플릿 전용: 이 수신자의 로그인 없는 수신거부 링크(서명 토큰, https). 헤더·본문이 같은 주소를 쓴다 */
  unsubscribeUrl?: string
}

export type SendResult =
  | { ok: true; id: string; mode: MailMode }
  | { ok: false; mode: MailMode; error: { name: string; statusCode: number | null; message: string } }

export interface Mailer {
  readonly mode: MailMode
  send<N extends TemplateName>(request: SendRequest<N>): Promise<SendResult>
}

export class MailerConfigError extends Error {
  readonly missing: string[]
  constructor(missing: string[]) {
    super(`live email needs ${missing.join(", ")} — set them in the environment (owner action O4: Resend key + verified sender domain)`)
    this.name = "MailerConfigError"
    this.missing = missing
  }
}

/** 광고성 메일을 법정 표시 없이 보내려 했다(사업자 정보나 수신거부 링크가 없다). 빠진 칸 이름만 담는다 */
export class MarketingComplianceError extends Error {
  readonly missing: string[]
  constructor(missing: string[]) {
    super(`marketing mail needs ${missing.join(", ")} — set LF_BUSINESS_NAME, LF_BUSINESS_EMAIL, LF_BUSINESS_PHONE, LF_BUSINESS_ADDRESS and pass a no-login unsubscribe link (Korean Network Act art. 50, Enforcement Decree annex 6)`)
    this.name = "MarketingComplianceError"
    this.missing = missing
  }
}

const UNSAFE_HEADER_URL = /[<>\s"]/

/** 광고성 템플릿이면 법정 표시를 채우고 수신거부 헤더를 만든다. 아니면 그대로 */
function prepare<N extends TemplateName>(options: MailerOptions, request: SendRequest<N>): { input: TemplateInputs[N]; headers?: Record<string, string> } {
  if (kindOf(request.template) !== "marketing") return { input: request.input }
  const biz = options.marketing?.business ?? {}
  const missing: string[] = []
  for (const [key, label] of [["name", "business name"], ["email", "business email"], ["phone", "business phone"], ["address", "business address"]] as const) {
    if (!biz[key]?.trim()) missing.push(label)
  }
  const url = request.unsubscribeUrl
  if (!url) missing.push("unsubscribeUrl")
  else if (UNSAFE_HEADER_URL.test(url) || !/^https?:\/\//.test(url)) missing.push("a valid unsubscribeUrl")
  if (missing.length || !url) throw new MarketingComplianceError(missing)
  const advertising: AdvertisingInput = { senderName: biz.name as string, senderEmail: biz.email as string, senderPhone: biz.phone as string, senderAddress: biz.address as string, unsubscribeUrl: url }
  return {
    input: { ...(request.input as object), advertising } as TemplateInputs[N],
    headers: { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  }
}

export function createMailer(options: MailerOptions): Mailer {
  const { mode } = options
  if (mode !== "mock" && mode !== "live") throw new Error(`mail mode must be mock or live, got ${String(mode)}`)
  if (mode === "mock") return mockMailer(options)

  const missing: string[] = []
  if (!options.client && !options.apiKey) missing.push("RESEND_API_KEY")
  if (!options.from) missing.push("EMAIL_FROM")
  if (missing.length) throw new MailerConfigError(missing)
  const client: ResendLike = options.client ?? (new Resend(options.apiKey) as unknown as ResendLike)
  const from = options.from as string

  return {
    mode,
    async send(request) {
      const { input, headers } = prepare(options, request)
      const mail = await renderEmail(request.template, input)
      try {
        const { data, error } = await client.emails.send(
          {
            from,
            to: request.to,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            ...(options.replyTo ? { replyTo: options.replyTo } : {}),
            tags: [{ name: "template", value: request.template }],
            ...(headers ? { headers } : {}),
          },
          request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : undefined,
        )
        if (error || !data) {
          return { ok: false, mode, error: { name: error?.name ?? "unknown_error", statusCode: error?.statusCode ?? null, message: maskPii(error?.message ?? "no data") } }
        }
        return { ok: true, mode, id: data.id }
      } catch (e) {
        return { ok: false, mode, error: { name: "network_error", statusCode: null, message: maskPii(e instanceof Error ? e.message : String(e)) } }
      }
    },
  }
}

function mockMailer(options: MailerOptions): Mailer {
  const log = options.log ?? ((line: string) => console.info(line))
  let n = 0
  return {
    mode: "mock",
    async send(request) {
      const { input, headers } = prepare(options, request)
      const mail = await renderEmail(request.template, input)
      n += 1
      const id = `mock_${n}`
      if (options.outbox) {
        // 줄 id 는 프로세스·인스턴스를 넘어 유일하다(여러 서버가 한 파일에 덧붙일 수 있다)
        const line = JSON.stringify({ id: randomUUID(), template: request.template, to: request.to, subject: mail.subject, at: new Date().toISOString() })
        try {
          mkdirSync(dirname(options.outbox), { recursive: true })
          appendFileSync(options.outbox, `${line}\n`)
        } catch (cause) {
          throw new Error(`LF_MOCK_OUTBOX: cannot write ${options.outbox}`, { cause })
        }
      }
      log(
        maskPii(
          [
            `[email:mock] ${id} template=${request.template} to=${request.to} subject=${JSON.stringify(mail.subject)}` +
              (request.idempotencyKey ? ` idempotencyKey=${request.idempotencyKey}` : "") +
              (headers ? ` headers=${JSON.stringify(headers)}` : ""),
            mail.text,
            "[email:mock] end",
          ].join("\n"),
        ),
      )
      return { ok: true, mode: "mock", id }
    },
  }
}
