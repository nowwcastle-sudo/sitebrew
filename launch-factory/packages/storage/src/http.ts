// HTTP 처리기 — 서비스 결과를 상태 코드로 바꾼다(입출력 껍데기, 판단은 service.ts). 로그인 사용자는 부르는 쪽(템플릿 접착)이 요청에서 읽어 넘긴다.
// 상태: 200 · 칸 오류 400 · 로그인 필요 401 · 없음 404 · 아직 안 올림 409 · 시간 지남 410 · 규칙 위반 422 · 요청 제한 429(+Retry-After) · 꺼짐 503 · 그 밖 500.
import { blockedResponse } from "@launch-factory/security/protect"
import type { StorageFailure, StorageResult, StorageService } from "./service.ts"

export interface StorageHandlerOptions {
  service: StorageService
  /** 로그인한 사용자 id(없으면 null). 요청 쿠키는 부르는 쪽이 읽는다 */
  userId?: (request: Request) => Promise<string | null>
}

export interface StorageHandlers {
  /** POST { kind, contentType, size, fileName? } → 티켓 */
  ticket(request: Request): Promise<Response>
  /** POST { id } → 끝낸 파일 */
  complete(request: Request): Promise<Response>
}

const MAX_JSON_BYTES = 8 * 1024
const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } as const

/** 서비스 결과 → 응답. 본문은 결과 그대로(상태 힌트 칸만 뺀다) */
export function toResponse(result: StorageResult<unknown>): Response {
  if (result.ok) return new Response(JSON.stringify(result), { status: 200, headers: HEADERS })
  const { status, ...body } = result as StorageFailure
  if (body.code === "rate_limited") return blockedResponse({ kind: "rate_limited", retryAfter: body.retryAfter ?? 1 })
  const code = body.code === "provider_unavailable" ? 503 : (status ?? (body.fieldErrors ? 400 : 500))
  return new Response(JSON.stringify(body), { status: code, headers: HEADERS })
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    if (Number(request.headers.get("content-length")) > MAX_JSON_BYTES) return {}
    const text = await request.text()
    if (text.length > MAX_JSON_BYTES) return {}
    const v: unknown = JSON.parse(text)
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function createStorageHandlers(o: StorageHandlerOptions): StorageHandlers {
  const handle = (run: (body: Record<string, unknown>, ctx: { headers: Headers; userId: string | null }) => Promise<StorageResult<unknown>>) => async (request: Request) => {
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } })
    const userId = o.userId ? await o.userId(request) : null
    return toResponse(await run(await readJson(request), { headers: request.headers, userId }))
  }
  return {
    ticket: handle((body, ctx) => o.service.createUpload(body, ctx)),
    complete: handle((body, ctx) => o.service.complete(body, ctx)),
  }
}
