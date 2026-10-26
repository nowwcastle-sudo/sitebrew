"use server"
// launch-factory: 관리 화면의 서버 액션 다섯(계획 3d) = 포트 AdminPort 의 모양: adminSections · adminOverview · adminTable · adminRecord · adminAct.
// 서버 액션은 누구나 직접 POST 로 부를 수 있다 — 그래서 모든 입구가 세션을 먼저 읽는다(없으면 sign_in_required). 이 파일은 로그인 여부만 보고 포트(콘솔)에 넘긴다.
// 이 사람이 이 구획을 쓸 수 있는지(관리자 벽·소유자 규칙)와 사람 확인 벽(confirmed: true)은 콘솔이 신원(lib/launch/admin-identity.ts)으로 정한다 — 입력의 role·userId 는 읽지 않는다.
// 행동(adminAct)은 요청 제한(adminAct, 분당 30)을 먼저 지난다 — 쓰기 제한은 이 한 곳뿐이다(콘솔은 읽기만 센다). 던진 오류는 콘솔이 일반 실패로 바꿔 돌려준다(DB 글·개인정보가 화면에 나가지 않는다).
import { headers } from "next/headers"
import type { AdminActInput, AdminActOutcome, AdminOverview, AdminRecord, AdminResult, AdminSectionInfo, AdminTable, AdminTableQuery } from "@launch-factory/admin-console"
import { signInRequiredResult } from "@launch-factory/security/action"
import { adminConsole } from "@/lib/launch/admin-console"
import { authPort } from "@/lib/launch/auth"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { guardAction } from "@/lib/launch/security"

/** 지금 로그인한 사람. 로그아웃·만료·읽기 실패는 null */
async function actor(): Promise<{ userId: string } | null> {
  const s = await (await authPort()).session()
  return s.ok && s.data ? { userId: s.data.userId } : null
}

const signInRequired = () => signInRequiredResult(DEFAULT_LOCALE)

/** 사이드바에 보일 구획 목록(이 사람이 볼 수 있는 것만) */
export async function adminSections(): Promise<AdminResult<AdminSectionInfo[]>> {
  if (!(await actor())) return signInRequired()
  return adminConsole().sections()
}

/** 개요: 지금 처리할 일 + 최근 변화(구획들이 보탠 것을 합친다) */
export async function adminOverview(): Promise<AdminResult<AdminOverview>> {
  if (!(await actor())) return signInRequired()
  return adminConsole().overview()
}

/** 입력: { section, search?, status?, limit? } — 최근 순, limit 은 1~200(기본 100) */
export async function adminTable(input: { section: string } & AdminTableQuery): Promise<AdminResult<AdminTable>> {
  if (!(await actor())) return signInRequired()
  return adminConsole().table(input)
}

/** 입력: { section, id } */
export async function adminRecord(input: { section: string; id: string }): Promise<AdminResult<AdminRecord>> {
  if (!(await actor())) return signInRequired()
  return adminConsole().record(input)
}

/** 입력: { section, id, action, fields?, confirmed? } — 확인이 필요한 행동(confirmActions)은 confirmed: true 가 있어야 실행된다 */
export async function adminAct(input: AdminActInput): Promise<AdminResult<AdminActOutcome>> {
  const who = await actor()
  if (!who) return signInRequired()
  const refused = await guardAction("adminAct", { headers: new Headers(await headers()), userId: who.userId })
  if (refused) return refused
  return adminConsole().act(input)
}
