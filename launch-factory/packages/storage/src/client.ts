// 브라우저 헬퍼 — web-factory StoragePort.upload(file, { kind }) 모양: 티켓 받기 → 저장소에 PUT → 끝내기. 브라우저에서 쓰므로 node 모듈을 부르지 않는다.
// `@launch-factory/storage/client` 로만 가져온다(루트 export 는 서명 코드를 끌어온다).
import { t, type Locale } from "@launch-factory/i18n"
import { contentTypeFromName } from "./key.ts"
import type { StorageKind } from "./policy.ts"

export interface StorageClientOptions {
  /** 티켓을 받는 경로(템플릿 `/api/storage/ticket`) */
  ticketUrl: string
  /** 끝내기 경로(템플릿 `/api/storage/complete`) */
  completeUrl: string
  fetch?: typeof fetch
  /** 클라이언트가 만드는 실패 문구의 언어(기본 en). 서버가 준 문구는 서버 언어 그대로다 */
  locale?: Locale
}

/** web-factory ActionResult 와 같은 모양 */
export type ClientResult<T> = { ok: true; data: T } | { ok: false; formError?: string; fieldErrors?: Partial<Record<string, string[]>>; retryable?: boolean; code?: string; retryAfter?: number }

export interface StorageClient {
  upload(file: Blob & { name?: string }, opts: { kind: StorageKind }): Promise<ClientResult<{ url: string; key: string }>>
}

export function createStorageClient(o: StorageClientOptions): StorageClient {
  const doFetch = o.fetch ?? fetch
  const failed = (): ClientResult<never> => ({ ok: false, retryable: true, formError: t(o.locale ?? "en", "storage.failed") })
  const postJson = async (url: string, body: unknown) => {
    const res = await doFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    return (await res.json()) as ClientResult<Record<string, unknown>>
  }

  return {
    async upload(file, opts) {
      try {
        const name = file.name
        const contentType = file.type || (name ? contentTypeFromName(name) : undefined) || ""
        const ticket = await postJson(o.ticketUrl, { kind: opts.kind, contentType, size: file.size, ...(name ? { fileName: name } : {}) })
        if (!ticket.ok) return ticket
        const { id, url, headers } = ticket.data as { id: string; url: string; headers: Record<string, string> }
        const put = await doFetch(url, { method: "PUT", headers, body: file })
        if (!put.ok) return failed()
        const done = await postJson(o.completeUrl, { id })
        if (!done.ok) return done
        const { url: fileUrl, key } = done.data as { url: string; key: string }
        return { ok: true, data: { url: fileUrl, key } }
      } catch {
        return failed()
      }
    },
  }
}
