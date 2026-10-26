// 객체 키 — `${종류}/${yyyy}/${uuid}.${확장자}`. 사용자가 정한 파일 이름은 키에 넣지 않는다(경로 이동·추측·개인정보를 막는다).
import { STORAGE_KINDS, type StorageKind } from "./policy.ts"

/** 형식 → 확장자. 정책 표의 모든 형식이 여기 있어야 한다(시험이 본다) */
const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/x-hwp": "hwp",
  "application/vnd.hancom.hwpx": "hwpx",
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const KEY = new RegExp(`^(${STORAGE_KINDS.join("|")})/\\d{4}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${[...new Set(Object.values(EXTENSIONS))].join("|")})$`)

export const extensionOf = (contentType: string): string | undefined => EXTENSIONS[contentType]

export function buildKey(i: { kind: StorageKind; id: string; contentType: string; now: Date }): string {
  if (!UUID.test(i.id)) throw new Error("key: id must be a lowercase uuid")
  const ext = extensionOf(i.contentType)
  if (!ext) throw new Error("key: unsupported contentType")
  return `${i.kind}/${i.now.getUTCFullYear()}/${i.id}.${ext}`
}

/** 우리가 만든 키 모양인가(디스크·URL 에서 읽은 키를 믿기 전에 거른다) */
export const isStorageKey = (key: string): boolean => KEY.test(key)

/** 파일 이름의 확장자로 형식을 짐작한다. 브라우저가 .hwp 같은 형식을 비워 보낼 때 브라우저 헬퍼가 쓴다. 모르면 undefined */
export function contentTypeFromName(fileName: string): string | undefined {
  const dot = fileName.lastIndexOf(".")
  if (dot < 0) return undefined
  const ext = fileName.slice(dot + 1).toLowerCase()
  const normalized = ext === "jpeg" ? "jpg" : ext
  return Object.entries(EXTENSIONS).find(([, e]) => e === normalized)?.[0]
}

// 제어 문자를 일부러 찾는 식이다
// eslint-disable-next-line no-control-regex
const HIDDEN_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g
const FILE_NAME_MAX = 100

/** 화면에 보일 파일 이름을 정리한다: 경로 앞부분·제어 문자·방향 바꿈 문자를 버리고 100자(코드 포인트)로 자른다. 비면 undefined. 키와 무관하다 */
export function cleanFileName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const base = raw.slice(Math.max(raw.lastIndexOf("/"), raw.lastIndexOf("\\")) + 1)
  const cleaned = [...base.replace(HIDDEN_CHARS, "").replace(/\s+/g, " ").trim()].slice(0, FILE_NAME_MAX).join("").trim()
  return cleaned || undefined
}

/** 안내 문구에 쓰는 허용 확장자 목록(예: "PNG, JPG, WEBP") */
export function formatList(contentTypes: readonly string[]): string {
  return [...new Set(contentTypes.map((t) => EXTENSIONS[t]).filter((e): e is string => !!e))].map((e) => e.toUpperCase()).join(", ")
}
