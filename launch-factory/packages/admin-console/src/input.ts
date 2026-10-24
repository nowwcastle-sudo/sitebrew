// 요청 정규화(순수) — 서버 액션이 받은 값은 모양을 믿지 않는다. 모양이 틀리면 null, 맞으면 다듬은 값.
import type { AdminActInput, AdminTableQuery } from "./port.ts"

export const SECTION_ID = /^[a-z][a-z0-9-]{0,31}$/
export const MAX_ROWS = 200
export const DEFAULT_ROWS = 100
/** 멱등 키 모양 — 서비스(inquiry · …)의 멱등 키와 같은 모양 */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/
/** 쪽 번호 상한 — 터무니없는 offset 으로 DB 를 훑게 하지 않는다 */
export const MAX_PAGE = 10_000
const MAX_ID = 128
const MAX_ACTION = 48
const MAX_FIELD_NAME = 48
const MAX_FIELD_VALUE = 8000
const MAX_FIELDS = 20

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const shortText = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() !== "" && v.length <= max ? v.trim() : null)

export const sectionIdOf = (v: unknown): string | null => {
  const s = shortText(v, 32)
  return s !== null && SECTION_ID.test(s) ? s : null
}

/** 표 질의: 검색어 100자·상태 32자·줄 수 1~200(기본 100)·쪽 1~10000(기본 1). 모르는 칸은 버린다. 모양이 틀린 칸이 있으면 null */
export function parseTableQuery(input: unknown): AdminTableQuery | null {
  if (input === undefined || input === null) return {}
  if (!isRecord(input)) return null
  const out: AdminTableQuery = {}
  if (input.search !== undefined && input.search !== "") {
    if (typeof input.search !== "string" || input.search.length > 100) return null
    out.search = input.search.trim()
  }
  if (input.status !== undefined && input.status !== "") {
    const s = shortText(input.status, 32)
    if (s === null) return null
    out.status = s
  }
  if (input.limit !== undefined) {
    if (typeof input.limit !== "number" || !Number.isInteger(input.limit) || input.limit < 1) return null
    out.limit = Math.min(input.limit, MAX_ROWS)
  }
  if (input.page !== undefined) {
    if (typeof input.page !== "number" || !Number.isInteger(input.page) || input.page < 1 || input.page > MAX_PAGE) return null
    out.page = input.page
  }
  return { ...out, limit: out.limit ?? DEFAULT_ROWS }
}

/** 기록 id: 비어 있지 않은 글자 128자 이하 */
export const recordIdOf = (v: unknown): string | null => shortText(v, MAX_ID)

/** 행동 입력: { section, id, action, fields?, confirmed? }. confirmed 는 정확히 true 일 때만 true 로 읽는다(그 밖의 값은 없는 것) */
export function parseActInput(input: unknown): AdminActInput | null {
  if (!isRecord(input)) return null
  const section = sectionIdOf(input.section)
  const id = recordIdOf(input.id)
  const action = shortText(input.action, MAX_ACTION)
  if (!section || !id || !action) return null
  let fields: Record<string, string> | undefined
  if (input.fields !== undefined) {
    if (!isRecord(input.fields)) return null
    const entries = Object.entries(input.fields)
    if (entries.length > MAX_FIELDS) return null
    fields = {}
    for (const [k, v] of entries) {
      if (k.length === 0 || k.length > MAX_FIELD_NAME || typeof v !== "string" || v.length > MAX_FIELD_VALUE) return null
      fields[k] = v
    }
  }
  let idempotencyKey: string | undefined
  if (input.idempotencyKey !== undefined) {
    if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) return null
    idempotencyKey = input.idempotencyKey
  }
  return { section, id, action, ...(fields ? { fields } : {}), ...(input.confirmed === true ? { confirmed: true as const } : {}), ...(idempotencyKey ? { idempotencyKey } : {}) }
}
