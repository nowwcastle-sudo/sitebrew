// 올리기 서비스(계획 3c Task 3). 흐름: ① createUpload — 요청 제한 → 정책 검사 → 키·장부 행(pending)·짧은 PUT 서명 → 티켓
//   ② 브라우저가 티켓 주소로 저장소에 직접 PUT ③ complete — 저장소에 실제 크기·형식을 물어 정책에 맞으면 ready, 속였으면 객체를 지우고 거절
//   ④ purgeExpired(Cron) — 끝내지 않은 것(24시간)·보유 기간이 지난 것의 객체를 지우고 행에 purgedAt.
// 저장소는 드라이버 인터페이스 하나(driver.ts)로만 만난다. 드라이버가 없으면(환경 이름이 없을 때) 서비스는 꺼진 채로 provider_unavailable 만 답한다 —
// 사이트는 켜지고 올리기만 꺼진다(문의 창구와 같은 방식). 비밀값·저장소 오류 원문은 응답과 로그에 싣지 않는다(오류는 이름만).
import { randomUUID } from "node:crypto"
import { getStoredFile, insertStoredFile, listExpiredStoredFiles, markStoredFilePurged, markStoredFileReady, type Database, type StoredFileRow } from "@launch-factory/db"
import { isLocale, t, type Locale } from "@launch-factory/i18n"
import { blockedByRate, blockedResult, type LaunchFailure } from "@launch-factory/security/protect"
import type { RateLimiter } from "@launch-factory/security/rate-limit"
import type { StorageDriver } from "./driver.ts"
import { buildKey, cleanFileName, formatList } from "./key.ts"
import { checkUpload, isKind, MAX_PRESIGN_SECONDS, PENDING_TTL_MS, STORAGE_POLICY, type StorageKind, type UploadIssue } from "./policy.ts"

/** 실패 + 상태 코드 힌트(HTTP 처리기가 읽고 본문에서는 뺀다 — http.ts). code 로 정해지는 실패(rate_limited·provider_unavailable)에는 없다 */
export type StorageFailure = LaunchFailure & { status?: 400 | 401 | 404 | 409 | 410 | 422 | 500 }
export type StorageResult<T> = { ok: true; data: T } | StorageFailure

export interface UploadInput {
  kind?: unknown
  contentType?: unknown
  size?: unknown
  /** 화면에 보일 이름(선택). 키에는 들어가지 않는다 */
  fileName?: unknown
}

/** 브라우저가 저장소에 PUT 할 때 필요한 전부. expiresAt 은 ISO 8601 */
export interface UploadTicket {
  id: string
  key: string
  method: "PUT"
  url: string
  headers: Record<string, string>
  expiresAt: string
  maxBytes: number
}

/** 끝낸 파일. 비공개 종류는 urlExpiresAt 까지 쓸 수 있는 짧은 GET 서명 주소다(그 뒤에는 getDownloadUrl) */
export interface StoredFile {
  id: string
  key: string
  url: string
  urlExpiresAt?: string
  kind: StorageKind
  contentType: string
  size: number
}

export interface RequestContext {
  /** 요청 머리(IP) — 요청 제한 키에만 쓴다. ip 를 직접 줘도 된다 */
  headers?: Headers
  ip?: string | null
  /** 로그인했으면 사용자 id */
  userId?: string | null
  locale?: Locale
}

export interface DownloadContext {
  userId?: string | null
  /** 관리자인가 — 부르는 쪽이 세션으로 판단한다(비공개 파일을 올린 사람이 아니어도 볼 수 있다) */
  isAdmin?: boolean
}

export interface StorageServiceOptions {
  db: Database
  /** 없으면 올리기가 꺼진다(provider_unavailable) */
  driver?: StorageDriver
  limiter: RateLimiter
  /** 요청 제한 경로 이름. 기본 "storage" */
  route?: string
  now?: () => Date
  newId?: () => string
  /** 저장소·DB 오류 — 이름만 담긴 Error 로 온다(원문·비밀값 없음) */
  onError?: (error: Error) => void
}

export interface StorageService {
  readonly enabled: boolean
  createUpload(input: UploadInput, ctx?: RequestContext): Promise<StorageResult<UploadTicket>>
  complete(input: { id?: unknown }, ctx?: RequestContext): Promise<StorageResult<StoredFile>>
  getDownloadUrl(input: { id?: unknown }, ctx?: DownloadContext & { locale?: Locale }): Promise<StorageResult<{ url: string; urlExpiresAt?: string }>>
  /** 지울 때가 된 객체를 지운다(Cron). 객체 삭제가 실패한 행은 purged 로 적지 않고 다음에 다시 시도한다 */
  purgeExpired(now?: Date): Promise<{ purged: number; failed: number }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PURGE_BATCH = 100

/** 저장소가 알려 준 형식을 비교용으로 맞춘다(소문자·매개변수 제거) */
const bareType = (v: string) => (v.split(";")[0] ?? "").trim().toLowerCase()

export function createStorageService(o: StorageServiceOptions): StorageService {
  const driver = o.driver
  const now = o.now ?? (() => new Date())
  const newId = o.newId ?? randomUUID
  const route = o.route ?? "storage"
  const onError = o.onError ?? ((e: Error) => console.error(e.message))
  const report = (step: string, e: unknown) => onError(new Error(`storage ${step} failed (${e instanceof Error ? e.name : "Error"})`))

  const loc = (ctx?: { locale?: Locale }): Locale => (isLocale(ctx?.locale) ? ctx.locale : "en")
  const fail = (locale: Locale, key: Parameters<typeof t>[1], status: NonNullable<StorageFailure["status"]>, extra: Partial<StorageFailure> = {}, vars?: Record<string, string | number>): StorageFailure => ({
    ok: false,
    retryable: false,
    formError: t(locale, key, vars),
    status,
    ...extra,
  })
  const unavailable = (locale: Locale): StorageFailure => ({ ok: false, code: "provider_unavailable", retryable: false, formError: t(locale, "storage.unavailable") })
  const notFound = (locale: Locale) => fail(locale, "storage.notFound", 404)

  const guard = async (ctx: RequestContext): Promise<StorageFailure | null> => {
    const who = { ...(ctx.headers ? { headers: ctx.headers } : {}), ...(ctx.ip !== undefined ? { ip: ctx.ip } : {}), userId: ctx.userId ?? null }
    const rate = blockedByRate(await o.limiter.check(route, who))
    return rate ? blockedResult(rate, loc(ctx)) : null
  }

  function issueFailure(issue: UploadIssue, input: UploadInput, locale: Locale): StorageFailure {
    const policy = isKind(input.kind) ? STORAGE_POLICY[input.kind] : undefined
    switch (issue) {
      case "signIn":
        return fail(locale, "storage.signInRequired", 401)
      case "kind":
        return fail(locale, "storage.kindInvalid", 400, { fieldErrors: { kind: [t(locale, "storage.kindInvalid")] } })
      case "contentType":
        return fail(locale, "storage.typeNotAllowed", 400, { fieldErrors: { contentType: [t(locale, "storage.typeNotAllowed", { formats: formatList(policy?.contentTypes ?? []) })] } }, { formats: formatList(policy?.contentTypes ?? []) })
      case "size": {
        const tooBig = typeof input.size === "number" && policy !== undefined && input.size > policy.maxBytes
        const text = tooBig ? t(locale, "storage.tooLarge", { max: Math.floor(policy.maxBytes / (1024 * 1024)) }) : t(locale, "storage.sizeInvalid")
        return { ok: false, retryable: false, formError: text, fieldErrors: { size: [text] }, status: 400 }
      }
    }
  }

  /** 끝낸 파일의 모양. 비공개 종류는 짧은 GET 서명을 붙인다 */
  function shape(row: StoredFileRow, d: StorageDriver): StoredFile {
    const kind = row.kind as StorageKind
    const base = { id: row.id, key: row.key, kind, contentType: row.contentType, size: row.sizeBytes ?? row.declaredBytes }
    if (STORAGE_POLICY[kind].public) return { id: base.id, key: base.key, url: d.publicUrl(row.key), kind, contentType: base.contentType, size: base.size }
    const at = now()
    const p = d.presign({ method: "GET", key: row.key, expiresIn: MAX_PRESIGN_SECONDS, now: at })
    return { ...base, url: p.url, urlExpiresAt: p.expiresAt.toISOString() }
  }

  async function createUpload(input: UploadInput, ctx: RequestContext = {}): Promise<StorageResult<UploadTicket>> {
    const locale = loc(ctx)
    if (!driver) return unavailable(locale)
    try {
      const blocked = await guard(ctx)
      if (blocked) return blocked
      const checked = checkUpload(input, Boolean(ctx.userId))
      if (!checked.ok) return issueFailure(checked.issue, input, locale)
      const at = now()
      const id = newId()
      const key = buildKey({ kind: checked.kind, id, contentType: checked.contentType, now: at })
      const signed = driver.presign({ method: "PUT", key, contentType: checked.contentType, expiresIn: MAX_PRESIGN_SECONDS, now: at })
      await insertStoredFile(o.db, {
        id,
        key,
        kind: checked.kind,
        contentType: checked.contentType,
        declaredBytes: checked.size,
        fileName: cleanFileName(input.fileName) ?? null,
        userId: ctx.userId ?? null,
        createdAt: at,
        expiresAt: new Date(at.getTime() + PENDING_TTL_MS),
      })
      return { ok: true, data: { id, key, method: "PUT", url: signed.url, headers: signed.headers, expiresAt: signed.expiresAt.toISOString(), maxBytes: STORAGE_POLICY[checked.kind].maxBytes } }
    } catch (e) {
      report("createUpload", e)
      return fail(locale, "storage.failed", 500, { retryable: true })
    }
  }

  async function complete(input: { id?: unknown }, ctx: RequestContext = {}): Promise<StorageResult<StoredFile>> {
    const locale = loc(ctx)
    if (!driver) return unavailable(locale)
    try {
      const blocked = await guard(ctx)
      if (blocked) return blocked
      if (typeof input.id !== "string" || !UUID.test(input.id)) return notFound(locale)
      const row = await getStoredFile(o.db, input.id)
      // 올린 사람이 정해진 파일은 그 사람만 끝낸다. 남의 파일·지운 파일은 있는지조차 알리지 않는다
      if (!row || row.status === "purged" || (row.userId !== null && row.userId !== (ctx.userId ?? null))) return notFound(locale)
      if (row.status === "ready") return { ok: true, data: shape(row, driver) }
      const at = now()
      if (row.expiresAt && at.getTime() > row.expiresAt.getTime()) return fail(locale, "storage.expired", 410)

      const info = await driver.head(row.key)
      if (!info) return fail(locale, "storage.notUploaded", 409, { retryable: true })
      const policy = STORAGE_POLICY[row.kind as StorageKind]
      // 서명은 형식을 묶지만 크기는 못 묶는다 — 실제 크기가 정책을 넘거나 비었거나 형식이 서명과 다르면 객체를 지우고 거절한다
      const sizeOk = Number.isInteger(info.size) && info.size >= 1 && info.size <= policy.maxBytes
      const typeOk = info.contentType === null || bareType(info.contentType) === row.contentType
      if (!sizeOk || !typeOk) {
        await driver.delete(row.key)
        await markStoredFilePurged(o.db, row.id, at)
        return fail(locale, "storage.rejected", 422)
      }
      const ready = await markStoredFileReady(o.db, row.id, { sizeBytes: info.size, at, expiresAt: policy.retentionDays ? new Date(at.getTime() + policy.retentionDays * 86_400_000) : null })
      const final = ready ?? (await getStoredFile(o.db, row.id)) // 동시에 끝낸 다른 요청이 먼저 바꿨다
      return final?.status === "ready" ? { ok: true, data: shape(final, driver) } : notFound(locale)
    } catch (e) {
      report("complete", e)
      return fail(locale, "storage.failed", 500, { retryable: true })
    }
  }

  async function getDownloadUrl(input: { id?: unknown }, ctx: DownloadContext & { locale?: Locale } = {}): Promise<StorageResult<{ url: string; urlExpiresAt?: string }>> {
    const locale = loc(ctx)
    if (!driver) return unavailable(locale)
    try {
      if (typeof input.id !== "string" || !UUID.test(input.id)) return notFound(locale)
      const row = await getStoredFile(o.db, input.id)
      if (!row || row.status !== "ready") return notFound(locale)
      const owner = row.userId !== null && row.userId === (ctx.userId ?? null)
      if (!STORAGE_POLICY[row.kind as StorageKind].public && !owner && ctx.isAdmin !== true) return notFound(locale)
      const f = shape(row, driver)
      return { ok: true, data: f.urlExpiresAt ? { url: f.url, urlExpiresAt: f.urlExpiresAt } : { url: f.url } }
    } catch (e) {
      report("getDownloadUrl", e)
      return fail(locale, "storage.failed", 500, { retryable: true })
    }
  }

  async function purgeExpired(at: Date = now()): Promise<{ purged: number; failed: number }> {
    // 객체를 지울 길이 없으면 행을 purged 로 적지 않는다(실제 객체가 남는다)
    if (!driver) return { purged: 0, failed: 0 }
    let purged = 0
    let failed = 0
    for (;;) {
      const batch = await listExpiredStoredFiles(o.db, at, PURGE_BATCH)
      for (const row of batch) {
        try {
          await driver.delete(row.key)
          if (await markStoredFilePurged(o.db, row.id, at)) purged++
        } catch (e) {
          failed++
          report("purge", e)
        }
      }
      if (batch.length < PURGE_BATCH || failed > 0) break
    }
    return { purged, failed }
  }

  return { enabled: driver !== undefined, createUpload, complete, getDownloadUrl, purgeExpired }
}
