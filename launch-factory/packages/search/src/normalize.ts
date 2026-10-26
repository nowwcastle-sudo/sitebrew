// 질의·문서 정리(순수 함수 — 입출력 없음). 검색 서비스가 DB 에 닿기 전에 모든 입력이 여기를 지난다.

export const MAX_QUERY_LENGTH = 100
export const MAX_TERMS = 5
export const MAX_BODY_LENGTH = 4000
export const MAX_TITLE_LENGTH = 300

const KIND = /^[a-z0-9][a-z0-9_-]{0,39}$/
/** 문서 종류 이름이 쓸 수 있는 모양인가(소문자·숫자·_·-, 40자 이하) */
export const isKind = (value: unknown): value is string => typeof value === "string" && KIND.test(value)

/** 코드 포인트 기준으로 자른다(짝 잃은 대리쌍(surrogate pair)를 만들지 않는다) */
const clip = (text: string, max: number): string => {
  const chars = Array.from(text)
  return chars.length <= max ? text : chars.slice(0, max).join("")
}

/** 앞뒤 공백·제어 문자·보이지 않는 서식 문자를 정리하고 NFC 로 합친다(자모로 갈라진 한글이 음절로 합쳐진다) */
const clean = (text: string): string =>
  text
    .normalize("NFC")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim()

/**
 * 질의 → 낱말 목록. 정리 → 100자 상한 → 공백으로 나눔 → 같은 낱말(대소문자 무시) 한 번만 → 최대 5개.
 * 문자열이 아니거나 빈 질의는 빈 목록이다(오류가 아니다).
 */
export function normalizeQuery(q: unknown): string[] {
  if (typeof q !== "string") return []
  const words = clip(clean(q), MAX_QUERY_LENGTH).split(" ").filter(Boolean)
  const seen = new Set<string>()
  const terms: string[] = []
  for (const w of words) {
    const key = w.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    terms.push(w)
    if (terms.length === MAX_TERMS) break
  }
  return terms
}

/** LIKE 의 특별한 글자 `%` `_` `\` 를 글자 그대로 찾도록 막는다(Postgres 기본 이스케이프 문자는 `\`) */
export const escapeLike = (term: string): string => term.replace(/[\\%_]/g, (c) => `\\${c}`)

/** 낱말이 어디에든 들어 있으면 맞는 패턴(`%낱말%`) */
export const likePattern = (term: string): string => `%${escapeLike(term)}%`

/** 색인에 넣는 문서. `locale` 은 "ko"|"en" */
export interface SearchDocumentInput {
  kind: string
  ref: string
  locale: string
  title: string
  body?: string
  url: string
}

export interface NormalizedDocument {
  kind: string
  ref: string
  locale: string
  title: string
  body: string
  url: string
}

/** 결과를 누르면 가는 곳: 이 사이트 안 경로(`/…`, `//` 제외) 또는 http(s) 주소. `javascript:` 같은 것은 막는다 */
const SAFE_URL = /^(?:\/(?!\/)|https?:\/\/)\S*$/

/**
 * 색인 문서를 정리한다. 본문은 4000자, 제목은 300자로 자르고 공백을 하나로 모은다.
 * 잘못된 문서(종류 모양·빈 ref/제목·모르는 locale·위험한 주소)는 던진다 — 색인은 믿는 서버 코드가 부르므로 조용히 버리지 않는다.
 */
export function normalizeDocument(doc: SearchDocumentInput): NormalizedDocument {
  const where = `search document ${JSON.stringify(doc?.kind)}/${JSON.stringify(doc?.ref)}`
  if (!isKind(doc?.kind)) throw new Error(`${where}: kind must match ${KIND}`)
  const ref = typeof doc.ref === "string" ? doc.ref.trim() : ""
  if (!ref || ref.length > 200) throw new Error(`${where}: ref must be 1–200 characters`)
  if (doc.locale !== "ko" && doc.locale !== "en") throw new Error(`${where}: locale must be "ko" or "en"`)
  const title = clip(clean(String(doc.title ?? "")), MAX_TITLE_LENGTH)
  if (!title) throw new Error(`${where}: title is required`)
  if (typeof doc.url !== "string" || !SAFE_URL.test(doc.url.trim())) throw new Error(`${where}: url must be a site path or an http(s) address`)
  return { kind: doc.kind, ref, locale: doc.locale, title, body: clip(clean(String(doc.body ?? "")), MAX_BODY_LENGTH), url: doc.url.trim() }
}
