// 제품 화면이 외부 출처를 여는 CSP 조각(LFFIX F1·F2). proxy.ts 가 요청마다 합친다. 값(키)이 아니라 출처 주소만 다룬다.
//
// 근거(2026-10-03 확인, 표는 docs/qa/lffix.md):
//   Turnstile — https://developers.cloudflare.com/turnstile/reference/content-security-policy/ : script-src·frame-src 에 https://challenges.cloudflare.com
//     (connect-src 'self' 는 사전 허가 모드에서만). nonce 방식·strict-dynamic 과 함께 쓸 수 있다.
//   Paddle.js — developer.paddle.com 에는 CSP 절이 없다(llms-full.txt 1.1MB 에서 「content security policy」·「frame-src」 0건). 그래서 출처는
//     ① https://cdn.paddle.com/paddle/v2/paddle.js 본문이 부르는 주소 ② 브라우저에서 오버레이를 열어 본 CSP 위반 보고(콘솔)로 정했다:
//       - 스크립트 cdn.paddle.com(문서도 「항상 https://cdn.paddle.com/ 에서 직접」), 결제 프레임 sandbox-buy.paddle.com | buy.paddle.com,
//       - 오버레이 스타일시트 sandbox-cdn.paddle.com | cdn.paddle.com /paddle/v2/assets/css (paddle.js 본문의 주소표),
//       - Paddle.js 가 오버레이 프레임에 쓰는 인라인 style 속성 5개(아래 해시) — nonce 는 속성에 안 되므로 기존 방식(D14)대로 해시로 연다.
//     connect-src 는 오버레이를 열고 닫는 동안 위반이 없었다(요청은 프레임 안에서 일어난다) — 열지 않는다.
//   Paddle.js 는 CDN 에서 늘 최신으로 받는다(문서 지시) — 인라인 style 값이 바뀌면 해시가 어긋나 오버레이 위치가 깨진다. 그때는 콘솔의 위반 보고에 나오는
//   새 해시로 PADDLE_STYLE_ATTR_HASHES 를 고친다(docs/qa/lffix.md 「Paddle 오버레이 CSP 다시 재기」).
import { TURNSTILE_CSP } from "@launch-factory/security/turnstile"

type Sources = Partial<Record<"scriptSrc" | "frameSrc" | "connectSrc" | "imgSrc" | "styleSrc", readonly string[]>>

/** Paddle.js(2026-10-03 판)가 오버레이 프레임에 다는 인라인 style 속성의 sha256(브라우저 위반 보고에서 읽음) */
export const PADDLE_STYLE_ATTR_HASHES = [
  "sha256-DZJGI9GW1KarnkjWFGQEtAWrfY4TQZwE9gIsAtq6sTk=",
  "sha256-G1uQ2TdzPadBgZhbO2zOTrRdlDoq9BGEKzWJvICVQLo=",
  "sha256-Z29WkVafffk4H/87Pln052+Z9XSPafMCUJvrH0WSxpM=",
  "sha256-BKJzP3dU1V1cVZwOs23ngG9tPG4LdgjCR+1pJQmpx+U=",
  "sha256-ET0BUt5sEVpoIgG1qTt57VnxpJOfKa7aXm9/pkiVoto=",
] as const

/**
 * 토큰 종류에 맞는 출처만 연다: 샌드박스 토큰(`test_`)이면 샌드박스 출처만, 실결제(`live_`)면 실결제 출처만. 토큰이 없으면 아무것도 열지 않는다(결제는 이동 방식).
 * 경로로 좁히지 않는다 — CSP 는 문서마다 한 번 정해지고 쪽 이동(클라이언트 라우팅)에서는 바뀌지 않아서, /pricing 에서 /upgrade 로 옮겨 오면 처음 문서의 CSP 가 그대로다.
 */
export function paddleCsp(clientToken: string | undefined): Sources {
  if (!clientToken) return {}
  const sandbox = clientToken.startsWith("test_")
  return {
    scriptSrc: ["https://cdn.paddle.com"],
    frameSrc: [sandbox ? "https://sandbox-buy.paddle.com" : "https://buy.paddle.com"],
    styleSrc: [sandbox ? "https://sandbox-cdn.paddle.com" : "https://cdn.paddle.com", "'unsafe-hashes'", ...PADDLE_STYLE_ATTR_HASHES.map((h) => `'${h}'`)],
  }
}

/** Turnstile 위젯은 사이트 키가 있을 때만 연다(경로로 좁히지 않는다 — 위와 같은 이유) */
export function turnstileCsp(siteKey: string | undefined): Sources {
  return siteKey ? TURNSTILE_CSP : {}
}

/** 여럿을 합친다(같은 지시어는 이어 붙인다). PostHog 같은 기존 extend 와도 같은 모양이다 */
export function mergeCsp(...parts: Sources[]): Sources {
  const out: Record<string, string[]> = {}
  for (const p of parts) for (const [k, v] of Object.entries(p)) out[k] = [...new Set([...(out[k] ?? []), ...(v ?? [])])]
  return out
}
