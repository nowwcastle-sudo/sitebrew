// 접속기록. 근거: 「개인정보의 안전성 확보조치 기준」(개인정보보호위원회 고시 제2026-9호, 2026-07-01 시행)
//   제2조 제3호 — 접속기록 = 식별자 · 접속일시 · 접속지 정보 · 처리한 정보주체 정보 · 수행업무
//   제8조 제1항 — 개인정보처리시스템에 접속한 자(정보주체 본인은 제외)의 접속기록을 1년 이상 보관
//                 (5만 명 이상·고유식별정보/민감정보·기간통신사업자면 2년 이상)
//   제8조 제2항 — 접속기록과 개인정보 **다운로드** 상황을 점검 → 다운로드는 따로 표시한다
//   제8조 제3항 — 위·변조·도난·분실 방지 → 저장소(sink)의 책임(Task 3 access_logs 표)
//   확인: 국가법령정보센터 Open API target=admrul, 행정규칙일련번호 2100000281400, 2026-09-30 조회
import { isIP } from "node:net"
import { containsPii } from "./pii.ts"

export interface AccessEvent {
  /** 식별자: 접속한 개인정보취급자(관리자·운영자)의 계정 id */
  actorId: string
  /** 접속지 정보: 접속한 IP */
  ip: string
  /** 처리한 정보주체 정보: 처리 대상 정보주체의 **식별자**(내부 id). 이메일·전화 같은 개인정보 자체는 넣지 않는다 */
  subjects: readonly string[]
  /** 수행업무: 조회·수정·삭제·다운로드·대리 로그인 등 */
  action: string
  /** 무엇을(표·화면 이름). 선택 */
  target?: string
  /** 접속일시. 없으면 지금 */
  occurredAt?: Date | string
  /** 다운로드 여부. action 이 download·export 면 자동으로 true */
  download?: boolean
}

export interface AccessRecord {
  actorId: string
  ip: string
  subjects: string[]
  action: string
  target: string | null
  occurredAt: string
  download: boolean
}

export type AccessLogSink = (record: AccessRecord) => void | Promise<void>

const DOWNLOAD_ACTIONS = new Set(["download", "export"])

/** 접속기록 한 줄을 검사해 `sink` 에 쓴다. 쓰기가 실패하면 그대로 던진다(조용히 넘어가지 않는다). */
export async function accessLog(event: Partial<AccessEvent>, sink: AccessLogSink): Promise<AccessRecord> {
  const missing: string[] = []
  if (!event.actorId) missing.push("actorId")
  if (!event.ip) missing.push("ip")
  if (!Array.isArray(event.subjects) || event.subjects.length === 0) missing.push("subjects")
  if (!event.action) missing.push("action")
  if (missing.length) throw new Error(`접속기록 항목 빠짐: ${missing.join(", ")}`)

  const { actorId, ip, subjects, action } = event as AccessEvent
  if (isIP(ip) === 0) throw new Error("접속기록 ip 가 IP 주소 모양이 아니다")
  for (const s of subjects) {
    if (typeof s !== "string" || !s || containsPii(s)) throw new Error("접속기록 subjects 에는 정보주체의 식별자(내부 id)만 넣는다")
  }
  const at = event.occurredAt === undefined ? new Date() : new Date(event.occurredAt)
  if (Number.isNaN(at.getTime())) throw new Error("접속기록 occurredAt 이 날짜가 아니다")

  const record: AccessRecord = {
    actorId,
    ip,
    subjects: [...subjects],
    action,
    target: event.target ?? null,
    occurredAt: at.toISOString(),
    download: event.download === true || DOWNLOAD_ACTIONS.has(action),
  }
  await sink(record)
  return record
}
