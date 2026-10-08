// 마케팅 수신 처리 결과 통지 메일의 신뢰성(대장 D210). 통지는 의사를 표시한 날부터 14일 안에 알려야 한다(정보통신망법 제50조제7항 · 시행령 제62조의2).
// 보내기가 실패하면 로그만 남기고 끝나던 것을 발신함(marketing_notice_outbox)에 남기고 Cron 이 늘어나는 간격으로 다시 보낸다.
//   • 한 통은 한 번만 나간다: 잡기(claimNotice)가 한 문장으로 시도 횟수를 올려 동시 실행 중 한쪽만 얻고, 보낸 행(sent)은 다시 뽑히지 않으며, 메일에는 같은 멱등 키(notice:<id>)가 간다.
//   • 상한: 처음 한 번 + 재시도 7번(마지막 시도가 첫 실패의 약 10.7일 뒤 — 법정 14일 안에 3일 남짓 여유). 다 쓰면 exhausted 로 멈추고 알린다(log·onExhausted) — 사람이 봐야 한다.
//   • 저장하는 것: 사용자 id·채널·동의 여부·의사 표시 시각·시도 상태·마지막 오류 코드뿐. 메일 주소·이름·본문은 보낼 때 사용자 표에서 읽는다.
// 보내는 함수(send)는 앱이 준다(메일러·사용자 조회가 앱 쪽이다). 던지면 실패, "skipped" 를 돌려주면 보낼 곳이 없는 것(이메일 없는 대체 주소 — 재시도해도 소용없다).
import { randomUUID } from "node:crypto"
import { claimNotice, dueNotices, enqueueNotice, noteNoticeFailure, settleNotice, type Database, type NoticeChange, type NoticeSource, type OutboxNotice } from "@launch-factory/db"

const HOUR = 3_600_000
/** 실패 뒤 다음 시도까지의 간격(n 번째 시도가 실패하면 [n-1]). Cron 이 한 시간 주기라 1시간이 가장 짧다 */
export const NOTICE_RETRY_DELAYS_MS: readonly number[] = [1, 3, 12, 24, 48, 72, 96].map((h) => h * HOUR)
/** 처음 한 번 + 재시도. 합계 간격 256시간(약 10.7일) < 법정 14일 */
export const NOTICE_MAX_ATTEMPTS = NOTICE_RETRY_DELAYS_MS.length + 1

export interface NoticeEvent {
  userId: string
  changes: NoticeChange[]
  /** 의사를 표시한 때 */
  at: Date
}

export interface NoticeSendInput extends NoticeEvent {
  /** 메일 공급자에 넘기는 멱등 키 — 같은 통지의 재시도는 늘 같은 값이다 */
  idempotencyKey: string
  /** 몇 번째 시도인가(처음 한 번이 1) */
  attempt: number
}
export type NoticeSend = (n: NoticeSendInput) => Promise<"skipped" | void>

type Log = (...args: unknown[]) => void
const consoleLog: Log = (...a) => console.error(...a)

/** 오류에서 짧은 코드만 꺼낸다 — 글(주소가 섞일 수 있다)은 저장하지 않는다. 「… email failed: validation_error」 → validation_error */
export function noticeErrorCode(e: unknown): string {
  const coded = e instanceof Error ? /failed: ([A-Za-z0-9_.-]+)\s*$/.exec(e.message)?.[1] : undefined
  const raw = coded ?? (e instanceof Error && e.name ? e.name : "error")
  return raw.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 64) || "error"
}

const delayAfter = (attempts: number): number => NOTICE_RETRY_DELAYS_MS[Math.min(attempts, NOTICE_RETRY_DELAYS_MS.length) - 1] as number

export interface DeliverNoticeOptions {
  db: Database
  event: NoticeEvent
  source: NoticeSource
  send: NoticeSend
  now?: () => Date
  log?: Log
}

/**
 * 통지를 지금 한 번 보낸다. 실패하면 발신함에 넣는다(Cron 이 이어서 보낸다). 호출하는 쪽은 이 결과로 응답을 바꾸지 않는다 — 설정 저장·가입은 통지와 무관하게 성공이다.
 * 보내기도 발신함에 넣기도 실패하면 던진다(호출하는 쪽이 로그로 남긴다 — 조용히 사라지지 않는다).
 */
export async function deliverNotice({ db, event, source, send, now = () => new Date(), log = consoleLog }: DeliverNoticeOptions): Promise<{ outcome: "sent" | "skipped" | "queued" }> {
  const id = randomUUID()
  try {
    const r = await send({ ...event, idempotencyKey: `notice:${id}`, attempt: 1 })
    if (r === "skipped") {
      log(`[notice-outbox] skipped: no deliverable email address (user=${event.userId} source=${source}) — the result notice has no other channel yet`)
      return { outcome: "skipped" }
    }
    return { outcome: "sent" }
  } catch (e) {
    const at = now()
    const code = noticeErrorCode(e)
    await enqueueNotice(db, { id, userId: event.userId, changes: event.changes, changedAt: event.at, source, attempts: 1, nextAttemptAt: new Date(at.getTime() + delayAfter(1)), lastErrorCode: code, createdAt: at })
    log(`[notice-outbox] send failed — queued for retry id=${id} user=${event.userId} source=${source} attempt=1/${NOTICE_MAX_ATTEMPTS} code=${code}`, e)
    return { outcome: "queued" }
  }
}

export interface RunNoticeRetriesOptions {
  db: Database
  send: NoticeSend
  now?: () => Date
  /** 한 번에 처리할 최대 통지 수(기본 100) */
  limit?: number
  log?: Log
  /** 시도 횟수를 다 써서 멈춘 통지 하나마다 한 번 — 알림을 보내는 자리(메일 내용은 없다) */
  onExhausted?: (n: Pick<OutboxNotice, "id" | "userId" | "attempts" | "lastErrorCode" | "source" | "changedAt">) => void | Promise<void>
}

export interface NoticeRetryResult {
  /** 이번에 때가 된 통지 수 */
  due: number
  sent: number
  /** 보낼 곳이 없어 닫은 것 */
  skipped: number
  /** 이번에도 실패했지만 다음 시도가 남은 것 */
  failed: number
  /** 이번에 상한을 다 써서 멈춘 것 */
  exhausted: number
  /** 다른 실행이 먼저 잡아 건너뛴 것 */
  raced: number
}

/**
 * 발신함 Cron(/api/cron/notices). 때가 된 통지를 한 통씩 잡아 보낸다. 두 번(동시에도) 와도 안전하다 — 닫힌 통지는 다시 뽑히지 않고, 열린 통지는 먼저 잡은 실행만 보낸다.
 * 한 통의 실패가 다른 통을 막지 않는다. 던지지 않는다(통지 하나의 문제로 Cron 이 500 이 되지 않게) — 결과 숫자와 로그로 알린다.
 */
export async function runNoticeRetries({ db, send, now = () => new Date(), limit = 100, log = consoleLog, onExhausted }: RunNoticeRetriesOptions): Promise<NoticeRetryResult> {
  const result: NoticeRetryResult = { due: 0, sent: 0, skipped: 0, failed: 0, exhausted: 0, raced: 0 }
  const at = now()
  const due = await dueNotices(db, at, limit)
  result.due = due.length
  for (const seen of due) {
    // 시도 횟수를 올리며 다음 시각을 미리 민다 — 이 시도가 실패하거나 프로세스가 죽으면 그 시각에 이어진다
    const claimed = await claimNotice(db, seen, new Date(at.getTime() + delayAfter(seen.attempts + 1)))
    if (!claimed) {
      result.raced += 1
      continue
    }
    try {
      const r = await send({ userId: claimed.userId, changes: claimed.changes, at: claimed.changedAt, idempotencyKey: `notice:${claimed.id}`, attempt: claimed.attempts })
      await settleNotice(db, claimed.id, r === "skipped" ? "skipped" : "sent", now())
      if (r === "skipped") {
        result.skipped += 1
        log(`[notice-outbox] skipped on retry: no deliverable email address id=${claimed.id} user=${claimed.userId}`)
      } else result.sent += 1
    } catch (e) {
      const code = noticeErrorCode(e)
      if (claimed.attempts >= NOTICE_MAX_ATTEMPTS) {
        await settleNotice(db, claimed.id, "exhausted", now(), code)
        result.exhausted += 1
        log(`[notice-outbox] exhausted id=${claimed.id} user=${claimed.userId} source=${claimed.source} attempts=${claimed.attempts} lastError=${code} — a person must send or waive this result notice before the 14-day deadline (Enforcement Decree of the Network Act art. 62-2)`)
        try {
          await onExhausted?.({ id: claimed.id, userId: claimed.userId, attempts: claimed.attempts, lastErrorCode: code, source: claimed.source, changedAt: claimed.changedAt })
        } catch (hookError) {
          log("[notice-outbox] onExhausted hook failed", hookError)
        }
      } else {
        await noteNoticeFailure(db, claimed.id, code)
        result.failed += 1
        log(`[notice-outbox] retry failed id=${claimed.id} attempt=${claimed.attempts}/${NOTICE_MAX_ATTEMPTS} code=${code} next=${new Date(at.getTime() + delayAfter(claimed.attempts)).toISOString()}`)
      }
    }
  }
  return result
}
