// 관리 화면 주소에서 온 값을 다루는 순수 함수(계획 3d). 주소의 값은 믿지 않는다 — 모양이 맞는 것만 서버 액션에 넘기고, 틀리면 쪽이 404 를 낸다.
// 구획·기록이 있는지는 여기서 알 수 없다(그건 콘솔이 정한다) — 여기는 모양만 본다.

const SECTION_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/
const SEARCH_MAX = 100

/** 구획 id(소문자·숫자·하이픈) 또는 null */
export const parseSectionId = (value: unknown): string | null => (typeof value === "string" && SECTION_ID.test(value) ? value : null)

/** 기록 id 또는 null */
export const parseRecordId = (value: unknown): string | null => (typeof value === "string" && RECORD_ID.test(value) ? value : null)

const first = (value: unknown): string | undefined => (Array.isArray(value) ? first(value[0]) : typeof value === "string" ? value : undefined)

/** 쪽 번호(1~10000 정수 글자, 콘솔 MAX_PAGE 와 같다). 틀리거나 비면 1 */
export function parsePage(value: unknown): number {
  const s = first(value)?.trim()
  if (!s || !/^[0-9]{1,5}$/.test(s)) return 1
  const n = Number(s)
  return n >= 1 && n <= 10_000 ? n : 1
}

/** 검색어: 앞뒤 공백을 떼고 제어 문자를 버리며 100자까지. 비면 undefined */
export function parseSearch(value: unknown): string | undefined {
  // eslint-disable-next-line no-control-regex
  const s = first(value)?.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, SEARCH_MAX)
  return s ? s : undefined
}

/** 상태 거르기 값: 구획이 아는 값만 받는다(여기서는 모양만 — 소문자·숫자·하이픈·밑줄 40자). 틀리면 undefined */
export function parseStatus(value: unknown): string | undefined {
  const s = first(value)?.trim()
  return s && /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(s) ? s : undefined
}

/** 중복 전송 방지 키(32자 16진). 콘솔이 받는 모양(/^[A-Za-z0-9_-]{8,100}$/)이다. 폼 저장 한 번(성공할 때까지의 재시도 포함)마다 하나 만든다 */
export const newIdempotencyKey = (): string => globalThis.crypto.randomUUID().replace(/-/g, "")
