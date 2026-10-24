// 올리기 정책 — 종류(kind)마다 크기·형식·공개 여부·보유 기간. 데이터와 순수 검사만 있다(입출력 없음).
// 사용자 파일은 이 표에 있는 종류·형식·크기만 받는다. 새 종류는 여기 한 줄 + 확장자는 key.ts EXTENSIONS 에 더한다.
const MB = 1024 * 1024

export const STORAGE_KINDS = ["avatar", "image", "attachment"] as const
export type StorageKind = (typeof STORAGE_KINDS)[number]

export interface KindPolicy {
  maxBytes: number
  contentTypes: readonly string[]
  /** true 면 누구나 주소로 읽는다(공개 읽기 주소). false 면 짧은 서명 주소로만 읽는다 */
  public: boolean
  /** 올린 뒤 이 날수가 지나면 객체를 지운다(개인정보 보호법 제21조①). 없으면 보유 기간 파기 없음 */
  retentionDays?: number
  /** true 면 로그인한 사람만 올린다 */
  signInRequired: boolean
}

export const STORAGE_POLICY: Readonly<Record<StorageKind, KindPolicy>> = {
  avatar: { maxBytes: 2 * MB, contentTypes: ["image/png", "image/jpeg", "image/webp"], public: true, signInRequired: true },
  image: { maxBytes: 5 * MB, contentTypes: ["image/png", "image/jpeg", "image/webp", "image/avif"], public: true, signInRequired: false },
  attachment: {
    maxBytes: 10 * MB,
    contentTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/x-hwp", "application/vnd.hancom.hwpx", "image/jpeg", "image/png"],
    public: false,
    retentionDays: 365,
    signInRequired: false,
  },
}

/** presigned 주소의 유효 시간 상한(초). 올리기·내려받기 모두 이 안에서만 쓴다 */
export const MAX_PRESIGN_SECONDS = 900
/** 올리기를 시작하고 끝내지 않은 파일을 지우기까지 */
export const PENDING_TTL_MS = 24 * 3600_000

export const isKind = (v: unknown): v is StorageKind => typeof v === "string" && Object.hasOwn(STORAGE_POLICY, v)

export type UploadIssue = "kind" | "contentType" | "size" | "signIn"
export type Checked = { ok: true; kind: StorageKind; contentType: string; size: number } | { ok: false; issue: UploadIssue }

/** 종류·형식·크기·로그인 여부를 정책 표로 본다. 형식은 소문자로 맞추고 매개변수(`; charset=`)가 붙으면 거절한다 */
export function checkUpload(input: { kind?: unknown; contentType?: unknown; size?: unknown }, signedIn: boolean): Checked {
  if (!isKind(input.kind)) return { ok: false, issue: "kind" }
  const policy = STORAGE_POLICY[input.kind]
  if (policy.signInRequired && !signedIn) return { ok: false, issue: "signIn" }
  const contentType = typeof input.contentType === "string" ? input.contentType.trim().toLowerCase() : ""
  if (!policy.contentTypes.includes(contentType)) return { ok: false, issue: "contentType" }
  const size = input.size
  if (typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > policy.maxBytes) return { ok: false, issue: "size" }
  return { ok: true, kind: input.kind, contentType, size }
}
