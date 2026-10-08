// launch-factory: 관리자 조립. 관리자 벽(role=admin + 2단계 인증 켬 + 대리 세션 아님)과 행동 기록(admin_actions)은 @launch-factory/auth 가 갖는다.
// 이 파일은 요청 하나에 붙는 입출력(쿠키)·DB·인증 처리기를 묶을 뿐이다. 관리자 조각이 꺼져 있으면(lib/launch/features.ts) 열리지 않고 이유를 알린다.
import { adminActions, type AdminActions } from "@launch-factory/auth"
import { authIO, getAuth } from "@/lib/launch/auth"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { AUTH_FEATURES } from "@/lib/launch/features"

/** 관리자 조각이 꺼져 있다 — AUTH_FEATURES 를 { twoFactor: true, admin: true } 로 바꿔야 한다 */
export class AdminDisabledError extends Error {
  constructor() {
    super("admin feature is off: set AUTH_FEATURES to { twoFactor: true, admin: true } in lib/launch/features.ts")
    this.name = "AdminDisabledError"
  }
}

export async function admin(): Promise<AdminActions> {
  if (!AUTH_FEATURES.admin || !AUTH_FEATURES.twoFactor) throw new AdminDisabledError()
  return adminActions({ auth: await getAuth(), db: await database(), io: await authIO(), locale: DEFAULT_LOCALE })
}

/** 꺼져 있으면 503 unavailable 로 닫는다(조용히 성공하지도, 500 으로 새지도 않는다) */
export async function runAdmin<T>(run: (actions: AdminActions) => Promise<T>) {
  try {
    return await run(await admin())
  } catch (e) {
    if (e instanceof AdminDisabledError) return { ok: false as const, status: 503 as const, code: "unavailable" as const, formError: e.message }
    throw e
  }
}
