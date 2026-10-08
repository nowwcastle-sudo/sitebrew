// 보안 헤더. 헤더 조립과 검증은 `nosecone`(arcjet/arcjet-js, Apache-2.0)을 쓰고, 지시어는 여기서 정한다.
//   `@nosecone/next` 를 쓰지 않는 이유(2026-09-30, 1.13.0 소스 확인):
//     - Next 기본값이 style-src 에 'unsafe-inline' 을 넣는다(Task 2 게이트와 충돌).
//     - nonce 를 내부에서 만들어 `securityHeaders(nonce)` 처럼 밖에서 받을 수 없다.
//     - peer 로 next 를 요구한다(서버 전용 패키지가 Next 를 끌어온다).
//   지시어 모양은 Next 16 공식 가이드 「Content Security Policy」의 proxy.ts 예시와 같다:
//     script-src 'self' 'nonce-…' 'strict-dynamic' (개발만 'unsafe-eval') · style-src 'self' 'nonce-…'
//
// 템플릿 proxy.ts 에서 쓰는 법(Task 10):
//   const nonce = createNonce()
//   const h = securityHeaders(nonce, { dev: process.env.NODE_ENV === "development" })
//   const req = new Headers(request.headers); req.set("x-nonce", nonce); req.set("content-security-policy", h.get("content-security-policy")!)
//   const res = NextResponse.next({ request: { headers: req } }); h.forEach((v, k) => res.headers.set(k, v)); return res
import { nosecone, type ActionSource, type Source } from "nosecone"

const NONCE = /^[A-Za-z0-9+/_-]{16,}={0,2}$/
const SOURCE = /^[^\s;,]+$/

/** 요청마다 새 nonce(16바이트 난수의 base64). */
export function createNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64")
}

export type ExtendableDirective = "scriptSrc" | "styleSrc" | "imgSrc" | "connectSrc" | "frameSrc" | "fontSrc" | "formAction" | "mediaSrc" | "workerSrc"

export interface SecurityHeaderOptions {
  /** 개발 서버: script-src 에 'unsafe-eval'(React 디버깅)을 더하고 upgrade-insecure-requests 를 뺀다. */
  dev?: boolean
  /** 공급자 출처를 더한다(예: Paddle 결제 창 frameSrc, PostHog connectSrc). 'unsafe-inline' 은 거부한다. */
  extend?: Partial<Record<ExtendableDirective, readonly string[]>>
}

const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), usb=(), browsing-topics=()"

export function securityHeaders(nonce: string, { dev = false, extend = {} }: SecurityHeaderOptions = {}): Headers {
  if (!NONCE.test(nonce)) throw new Error("nonce 모양이 아니다(base64 16자 이상)")
  for (const [directive, sources] of Object.entries(extend)) {
    for (const s of sources ?? []) {
      if (/unsafe-inline/i.test(s)) throw new Error(`${directive}: 'unsafe-inline' 은 더할 수 없다 — nonce 를 쓴다`)
      if (!SOURCE.test(s)) throw new Error(`${directive}: 출처 모양이 아니다`)
    }
  }
  const n = `'nonce-${nonce}'`
  // 출처 모양은 위 SOURCE 검사와 nosecone 검증이 본다. 타입은 nosecone 의 출처 타입으로 맞춘다.
  const plus = (d: ExtendableDirective, base: string[]) => [...base, ...(extend[d] ?? [])] as Array<Source | ActionSource> as Source[]
  const headers = nosecone({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: plus("scriptSrc", ["'self'", n, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])]) as Array<Source | ActionSource>,
        styleSrc: plus("styleSrc", ["'self'", n]),
        imgSrc: plus("imgSrc", ["'self'", "blob:", "data:"]),
        fontSrc: plus("fontSrc", ["'self'"]),
        connectSrc: plus("connectSrc", ["'self'"]),
        frameSrc: extend.frameSrc?.length ? ([...extend.frameSrc] as Source[]) : ["'none'"],
        mediaSrc: plus("mediaSrc", ["'self'"]),
        workerSrc: plus("workerSrc", ["'self'"]),
        manifestSrc: ["'self'"],
        formAction: plus("formAction", ["'self'"]),
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        childSrc: ["'none'"],
        frameAncestors: ["'none'"],
        ...(dev ? {} : { upgradeInsecureRequests: true }),
      },
    },
    // require-corp 는 결제 창·외부 이미지를 막는다. 필요해지면 제품별로 켠다.
    crossOriginEmbedderPolicy: false,
    // 결제·소셜 로그인 팝업이 opener 를 잃지 않게.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    referrerPolicy: { policy: ["strict-origin-when-cross-origin"] },
    // preload 는 도메인 결정(대표)이라 끈다.
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: false },
    xFrameOptions: { action: "deny" },
  })
  headers.set("permissions-policy", PERMISSIONS_POLICY)
  return headers
}
