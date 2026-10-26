// S3 호환 드라이버(AWS S3 · Cloudflare R2 · MinIO). 서명은 sigv4.ts(순수), 이 파일은 fetch 입출력만 한다.
// head·delete 도 presigned 주소(HEAD·DELETE)로 부른다 — 머리 서명 방식 코드를 따로 두지 않는다.
// 오류 문구에는 상태 코드와 동작 이름만 싣는다: 서명 주소(서명이 든다)·자격 증명·응답 본문·fetch 원인은 싣지 않는다.
import type { ObjectInfo, Presign, PresignRequest, StorageDriver } from "./driver.ts"
import { presignUrl } from "./sigv4.ts"

export interface S3DriverOptions {
  endpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** true 면 경로식(R2·MinIO), 아니면 가상호스트식(AWS S3) */
  pathStyle?: boolean
  /** 공개 종류의 읽기 주소 앞부분(CDN·R2 공개 도메인). 없으면 서명 없는 객체 주소 */
  publicBaseUrl?: string
  fetch?: typeof fetch
}

/** 호출 시간 상한. 저장소가 멈추면 요청이 끝없이 매달리지 않는다 */
const REQUEST_TIMEOUT_MS = 10_000

function validUrl(value: string, name: string): URL {
  try {
    return new URL(value)
  } catch {
    throw new Error(`storage: ${name} is not a valid URL`)
  }
}

export function createS3Driver(o: S3DriverOptions): StorageDriver {
  const endpoint = validUrl(o.endpoint, "endpoint")
  if (!o.bucket || !o.region) throw new Error("storage: bucket and region are required")
  if (!o.accessKeyId || !o.secretAccessKey) throw new Error("storage: credentials are required")
  const publicBase = o.publicBaseUrl ? validUrl(o.publicBaseUrl, "publicBaseUrl").href.replace(/\/+$/, "") : undefined
  const doFetch = o.fetch ?? fetch
  const sign = (method: "PUT" | "GET" | "HEAD" | "DELETE", key: string, now: Date, expiresIn: number, headers?: Record<string, string>) =>
    presignUrl({ method, endpoint: o.endpoint, bucket: o.bucket, key, region: o.region, accessKeyId: o.accessKeyId, secretAccessKey: o.secretAccessKey, expiresIn, now, ...(o.pathStyle ? { pathStyle: true } : {}), ...(headers ? { headers } : {}) })

  /** 서명한 요청을 보낸다. 네트워크 오류는 원인 없이 이름만 던진다 */
  async function call(action: string, method: "HEAD" | "DELETE", key: string): Promise<Response> {
    try {
      return await doFetch(sign(method, key, new Date(), 60).url, { method, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    } catch {
      throw new Error(`storage ${action} failed (network)`)
    }
  }

  return {
    presign(req: PresignRequest): Presign {
      return sign(req.method, req.key, req.now, req.expiresIn, req.method === "PUT" && req.contentType ? { "content-type": req.contentType } : undefined)
    },
    async head(key): Promise<ObjectInfo | null> {
      const r = await call("head", "HEAD", key)
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`storage head failed (status ${r.status})`)
      const length = r.headers.get("content-length")
      const size = length === null || length.trim() === "" ? Number.NaN : Number(length)
      if (!Number.isFinite(size)) throw new Error("storage head failed (no size)") // 크기를 모르는 채로 정책 위반으로 보고 지우지 않는다
      return { size, contentType: r.headers.get("content-type") }
    },
    async delete(key) {
      const r = await call("delete", "DELETE", key)
      if (!r.ok && r.status !== 404) throw new Error(`storage delete failed (status ${r.status})`)
    },
    publicUrl(key) {
      if (publicBase) return `${publicBase}/${key}`
      const keyPath = key.split("/").map(encodeURIComponent).join("/")
      return o.pathStyle ? `${endpoint.origin}/${encodeURIComponent(o.bucket)}/${keyPath}` : `${endpoint.protocol}//${o.bucket}.${endpoint.host}/${keyPath}`
    },
  }
}
