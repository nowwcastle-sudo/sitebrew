// 요청 본문 상한 읽기(CWE-400). 공개 경로가 request.text()/json()/formData() 로 본문 전체를 읽으면, 서명·요청 제한·필드 길이·Turnstile 을 보기 전에
// 큰 본문이 메모리와 파서 CPU 를 먼저 쓴다. 여기서는 상한까지만 스트림으로 읽고 넘으면 거기서 끊는다(BodyTooLargeError → 라우트가 413).
//   - Content-Length 가 상한을 넘으면 한 바이트도 읽지 않고 거절한다.
//   - Content-Length 가 없거나 거짓(chunked 포함)이어도 읽은 바이트를 세어 상한을 넘는 순간 스트림을 취소한다 — 읽는 양은 상한에 청크 하나를 더한 정도다.
//   - 읽은 바이트를 그대로 돌려준다 — 웹훅 서명 검증은 이 원문 바이트(문자열로 푼 값)에 대해 한다.
// 서버 전용(Request 를 받는 경로 처리기용). 상한은 경로마다 호출하는 쪽이 정한다 — 아래 기본값은 시작점이다.

/** 폼 제출(문의·예약·후기·뉴스레터) 기본 상한. 칸 길이 한도(가장 긴 5,000자 = 한글 UTF-8 약 15KB)와 Turnstile 토큰·멀티파트 머리를 넉넉히 덮는다 */
export const DEFAULT_FORM_BODY_BYTES = 64 * 1024
/** 결제 웹훅 기본 상한. 공급자 알림(구독·거래 이벤트)은 수 KB 이지만 품목이 많은 거래도 깨지 않도록 넉넉히 둔다 */
export const DEFAULT_WEBHOOK_BODY_BYTES = 512 * 1024

/** 본문이 상한을 넘었다. 라우트는 이것을 잡아 payloadTooLarge() 로 답한다 */
export class BodyTooLargeError extends Error {
  readonly limit: number
  constructor(limit: number) {
    super(`request body exceeds ${limit} bytes`)
    this.name = "BodyTooLargeError"
    this.limit = limit
  }
}

/** 상한 값 검사 — 양의 정수만(0·음수·NaN 이면 모든 본문이 막히거나 상한이 사라진다) */
function limitOf(maxBytes: number): number {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError("maxBytes must be a positive integer")
  return maxBytes
}

const declaredLength = (request: Request): number | null => {
  const v = request.headers.get("content-length")?.trim()
  return v !== undefined && /^\d{1,15}$/.test(v) ? Number(v) : null
}

/** 본문을 상한까지만 읽어 바이트로 돌려준다. 넘으면 BodyTooLargeError. 본문이 없으면 빈 배열 */
export async function readBodyBytes(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const limit = limitOf(maxBytes)
  const declared = declaredLength(request)
  if (declared !== null && declared > limit) {
    await request.body?.cancel().catch(() => {})
    throw new BodyTooLargeError(limit)
  }
  if (!request.body) return new Uint8Array(0)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit) throw new BodyTooLargeError(limit)
      chunks.push(value)
    }
  } catch (e) {
    await reader.cancel().catch(() => {})
    throw e
  } finally {
    reader.releaseLock()
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.byteLength
  }
  return out
}

/** 본문을 상한까지만 읽어 UTF-8 문자열로 돌려준다(request.text() 와 같은 해석 — 앞의 BOM 은 버린다) */
export async function readBodyText(request: Request, maxBytes: number): Promise<string> {
  return new TextDecoder("utf-8").decode(await readBodyBytes(request, maxBytes))
}

/**
 * 폼 제출 본문 읽기: application/json 이면 객체, 아니면 FormData(urlencoded·multipart). 읽을 수 없거나 파싱이 안 되면 빈 객체 —
 * 칸 검사가 평소처럼 400 으로 답한다. 상한을 넘은 것만 BodyTooLargeError 로 던진다(라우트가 413 으로 답한다).
 */
export async function readFormInput(request: Request, maxBytes: number): Promise<Record<string, unknown> | FormData> {
  const limit = limitOf(maxBytes)
  const type = request.headers.get("content-type") ?? ""
  try {
    const bytes = await readBodyBytes(request, limit)
    if (type.includes("application/json")) return JSON.parse(new TextDecoder("utf-8").decode(bytes)) as Record<string, unknown>
    return await new Response(bytes, { headers: { "content-type": type } }).formData()
  } catch (e) {
    if (e instanceof BodyTooLargeError) throw e
    return {}
  }
}

/** 413 응답(본문 상한 초과). 재시도해도 같으므로 Retry-After 는 없다 */
export function payloadTooLarge(): Response {
  return new Response(JSON.stringify({ ok: false, code: "payload_too_large", retryable: false }), {
    status: 413,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  })
}
