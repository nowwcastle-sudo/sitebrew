// createAdminConsole 의 옵션과 주입 모양(타입 전용). 순수 패키지는 세션·DB·로그·가리개를 모른다 — 모두 템플릿이 꽂는다.
import type { AdminFailureCode, AdminResult } from "./port.ts"
import type { AdminActor, AdminIdentity, AdminSection } from "./section.ts"

/** 표·상세를 읽어 나갈 때 남기는 접속 기록(개인정보처리시스템 접속기록). ids = 내보낸 행/기록 id */
export interface AdminAccessRecord {
  actorId: string
  via: AdminActor["via"]
  section: string
  kind: "table" | "record"
  ids: string[]
  at: Date
}
/** 행동을 실행한 뒤 남기는 기록. 폼 값은 싣지 않는다 */
export interface AdminActionRecord {
  actorId: string
  via: AdminActor["via"]
  section: string
  id: string
  action: string
  ok: boolean
  code?: string
  at: Date
}
/** 개인정보 가리개(주입). contact 는 연락처 열·요약 값, text 는 나가는 모든 문구(formError·message·칸 오류) */
export interface AdminMasker {
  contact(value: string): string
  text(value: string): string
}

export interface AdminConsoleOptions {
  /** 등록된 구획(순서가 사이드바 순서). 같은 id 가 둘이면 만들 때 던진다 */
  sections: readonly AdminSection[]
  /** 세션과 사용자 행에서 신원을 읽는다. 포트 호출마다 한 번만 부른다. 던지면 forbidden 으로 닫힌다 */
  identify(): Promise<AdminIdentity>
  /** 거부·실패 문구(i18n 에서 온다). 순수 패키지에는 고정 문구를 두지 않는다 */
  messages: Record<AdminFailureCode, string>
  /** 켜진 부품 이름. 없으면 전부 켜짐 — 꺼진 부품의 구획은 목록에서도 직접 요청에서도 사라진다 */
  enabledParts?: readonly string[] | null
  /** 관리자 역할 이름(기본 ['admin']) */
  adminRoles?: readonly string[]
  /** 구획의 경로 머리(기본 /admin) */
  basePath?: string
  /** 개요·기록의 기준 시각(시험에서 고정) */
  now?: () => Date
  /** 요청 제한 훅 — 읽기(표·상세)·쓰기(행동) 실행 앞에서 부른다. 막으려면 실패 결과를, 통과면 null */
  limit?: (kind: "read" | "write", actor: AdminActor) => Promise<AdminResult<never> | null>
  /** 접속 기록. access 가 실패하면 읽기를 거부한다(기록 없이 데이터를 내보내지 않는다). action 이 실패해도 결과는 돌려주고 onError 로만 알린다 */
  audit?: { access(record: AdminAccessRecord): Promise<void> | void; action(record: AdminActionRecord): Promise<void> | void }
  mask?: AdminMasker
  /** 구획·주입 훅이 던진 오류 — 서버 로그용. 화면에는 이름 없는 action_failed 만 나간다 */
  onError?: (error: unknown, where: string) => void
}
