// AWS Signature Version 4 — 쿼리 방식 presigned URL(순수 함수, node:crypto 만). 입출력은 하지 않는다.
// 규칙 출처: AWS 문서 「Authenticating Requests: Using Query Parameters (AWS Signature Version 4)」
//   https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
// 정규 요청 = 메서드 \n 경로 \n 쿼리(서명 뺀 X-Amz-* 이름순) \n 머리(소문자·이름순) \n \n 서명한 머리 \n UNSIGNED-PAYLOAD.
// 시험은 문서의 예제(GET /test.txt · examplebucket · 20130524 · AKIAIOSFODNN7EXAMPLE)와 서명이 같음을 본다.
// 만료 상한(604800초)은 프로토콜 한도다. 우리 정책의 상한(900초)은 service.ts 가 정한다.
import { createHash, createHmac, timingSafeEqual } from "node:crypto"

export type PresignMethod = "GET" | "PUT" | "HEAD" | "DELETE"
const METHODS: readonly string[] = ["GET", "PUT", "HEAD", "DELETE"]
const MAX_EXPIRES = 604_800
const ALGORITHM = "AWS4-HMAC-SHA256"
/** 서명 시각이 서버 시계보다 이만큼 앞서도 받는다(시계 어긋남) */
const CLOCK_SKEW_MS = 5 * 60_000

export interface PresignInput {
  method: PresignMethod
  /** 종단점 주소(예: https://<계정>.r2.cloudflarestorage.com, http://127.0.0.1:9000, https://s3.amazonaws.com) */
  endpoint: string
  bucket: string
  /** 객체 키(맨 앞 / 없이). 구간마다 인코딩하고 / 는 남긴다 */
  key: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** 초. 1~604800 */
  expiresIn: number
  now: Date
  /** true 면 경로식(`host/bucket/key`, R2·MinIO 기본), 아니면 가상호스트식(`bucket.host/key`) */
  pathStyle?: boolean
  /** 서명에 넣는 머리(예: content-type). 보내는 쪽이 같은 값을 보내야 한다 — 돌려주는 headers 에 그대로 담긴다 */
  headers?: Readonly<Record<string, string>>
}

export interface Presigned {
  url: string
  /** 요청에 그대로 실어야 하는 머리(소문자 이름) */
  headers: Record<string, string>
  expiresAt: Date
}

const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex")
const hmac = (key: string | Buffer, s: string) => createHmac("sha256", key).update(s).digest()

/** RFC 3986 인코딩 — encodeURIComponent 가 남기는 !'()* 도 인코딩한다 */
const encode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
const amzDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

function endpointUrl(endpoint: string): URL {
  try {
    return new URL(endpoint)
  } catch {
    throw new Error("presign: endpoint is not a valid URL")
  }
}

/** 서명 입력을 검사하고 쿼리 방식 presigned URL 을 만든다. 오류 문구에 자격 증명을 싣지 않는다 */
export function presignUrl(i: PresignInput): Presigned {
  if (!METHODS.includes(i.method)) throw new Error("presign: method must be GET, PUT, HEAD or DELETE")
  if (!i.key || i.key.startsWith("/")) throw new Error("presign: key must be a non-empty path without a leading slash")
  if (!i.bucket || !i.region) throw new Error("presign: bucket and region are required")
  if (!i.accessKeyId || !i.secretAccessKey) throw new Error("presign: credentials are required")
  if (!Number.isInteger(i.expiresIn) || i.expiresIn < 1 || i.expiresIn > MAX_EXPIRES) throw new Error(`presign: expiresIn must be an integer from 1 to ${MAX_EXPIRES}`)
  const base = endpointUrl(i.endpoint)

  const extra = Object.entries(i.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v.trim()] as const)
  const host = i.pathStyle ? base.host : `${i.bucket}.${base.host}`
  const signed = new Map<string, string>([["host", host], ...extra])
  const names = [...signed.keys()].sort()
  const path = `${i.pathStyle ? `/${encode(i.bucket)}` : ""}/${i.key.split("/").map(encode).join("/")}`

  const stamp = amzDate(i.now)
  const day = stamp.slice(0, 8)
  const scope = `${day}/${i.region}/s3/aws4_request`
  const query: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${i.accessKeyId}/${scope}`,
    "X-Amz-Date": stamp,
    "X-Amz-Expires": String(i.expiresIn),
    "X-Amz-SignedHeaders": names.join(";"),
  }
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encode(k)}=${encode(query[k] as string)}`)
    .join("&")
  const canonicalRequest = [i.method, path, canonicalQuery, ...names.map((n) => `${n}:${signed.get(n)}`), "", names.join(";"), "UNSIGNED-PAYLOAD"].join("\n")
  const stringToSign = [ALGORITHM, stamp, scope, sha256Hex(canonicalRequest)].join("\n")
  const signingKey = [day, i.region, "s3", "aws4_request"].reduce<Buffer>((k, part) => hmac(k, part), Buffer.from(`AWS4${i.secretAccessKey}`))
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

  return {
    url: `${base.protocol}//${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    headers: Object.fromEntries(extra),
    expiresAt: new Date(i.now.getTime() + i.expiresIn * 1000),
  }
}

export interface VerifyInput {
  method: PresignMethod
  /** 요청의 경로+쿼리(호스트는 읽지 않는다 — 서명한 호스트는 endpoint 가 정한다) */
  url: string
  /** 요청 머리. 서명에 든 이름만 읽는다 */
  headers: Readonly<Record<string, string | null | undefined>>
  endpoint: string
  bucket: string
  region: string
  secretAccessKey: string
  now: Date
}

export type Verified = { ok: true; key: string } | { ok: false }

/**
 * 우리가 만든 경로식 presigned URL 인지 다시 계산해 본다(로컬 드라이버 경로가 쓴다).
 * 서명·메서드·키·서명한 머리가 하나라도 다르거나 만료됐으면(또는 서명 시각이 시계보다 한참 앞이면) 거절한다.
 */
export function verifyPresigned(i: VerifyInput): Verified {
  const no: Verified = { ok: false }
  let u: URL
  try {
    u = new URL(i.url, "http://placeholder.invalid")
  } catch {
    return no
  }
  const q = u.searchParams
  const stamp = q.get("X-Amz-Date") ?? ""
  const given = q.get("X-Amz-Signature") ?? ""
  const credential = q.get("X-Amz-Credential") ?? ""
  const expires = Number(q.get("X-Amz-Expires"))
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(stamp)
  const prefix = `/${encode(i.bucket)}/`
  if (!m || !/^[0-9a-f]{64}$/.test(given) || !u.pathname.startsWith(prefix)) return no
  const signedAt = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`)
  const accessKeyId = credential.split("/")[0] ?? ""
  if (!(expires >= 1) || i.now.getTime() > signedAt.getTime() + expires * 1000 || signedAt.getTime() > i.now.getTime() + CLOCK_SKEW_MS) return no
  let key: string
  try {
    key = decodeURIComponent(u.pathname.slice(prefix.length))
  } catch {
    return no
  }
  const names = (q.get("X-Amz-SignedHeaders") ?? "").split(";").filter((n) => n && n !== "host")
  const lower = Object.fromEntries(Object.entries(i.headers).map(([k, v]) => [k.toLowerCase(), v]))
  const headers: Record<string, string> = {}
  for (const n of names) {
    const v = lower[n]
    if (typeof v !== "string") return no
    headers[n] = v
  }
  let again: Presigned
  try {
    again = presignUrl({ method: i.method, endpoint: i.endpoint, bucket: i.bucket, key, region: i.region, accessKeyId, secretAccessKey: i.secretAccessKey, expiresIn: expires, now: signedAt, pathStyle: true, headers })
  } catch {
    return no
  }
  const want = new URL(again.url).searchParams.get("X-Amz-Signature") ?? ""
  return want.length === given.length && timingSafeEqual(Buffer.from(want), Buffer.from(given)) ? { ok: true, key } : no
}
