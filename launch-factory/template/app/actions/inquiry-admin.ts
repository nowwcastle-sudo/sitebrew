"use server"
// launch-factory: 문의 종류 변경 서버 액션(운영자·관리자용). 누가 바꾸는지는 세션에서 읽은 사용자 행으로 정한다 — 입력의 isOwner·role·userId 는 읽지 않는다(대장 D170).
//   소유자 = 확인된 이메일이 INQUIRY_OWNER_EMAIL 과 같은 사람, 관리자 = user.role 에 admin 이 든 사람(Better Auth admin 플러그인과 같은 규칙). 정지된 사람은 아니다.
//   INQUIRY_OWNER_EMAIL 이 없으면(문의 창구 꺼짐) 소유자가 없고 관리자만 바꿀 수 있다 — 이미 받은 문의의 보유 기간(불만 3년)은 창구가 꺼져도 지켜야 한다.
//   대리 로그인 세션은 소유자도 관리자도 아니다(관리자가 사용자 이름으로 문의 종류를 바꾸지 못한다). 불만·분쟁 등급을 넘나드는 변경은 관리자만이다(서비스가 판정).
import { user } from "@launch-factory/db"
import { messages } from "@launch-factory/i18n"
import { actorFromUser, type InquiryActor, type InquiryKind } from "@launch-factory/inquiry"
import { eq } from "drizzle-orm"
import { authPort } from "@/lib/launch/auth"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { inquiry, inquiryOwnerEmail } from "@/lib/launch/inquiry"

const signInRequired = () => ({ ok: false as const, formError: messages(DEFAULT_LOCALE).auth.signInRequired })
const impersonationBlocked = () => ({ ok: false as const, status: 403 as const, code: "impersonation_blocked" as const, formError: messages(DEFAULT_LOCALE).auth.impersonationBlocked })
const invalidInput = { ok: false as const, error: "invalid_input" as const }

/** 지금 로그인한 사람의 행위자. 로그아웃·정지 → null(로그인 요구), 대리 세션 → "impersonated" */
async function actor(): Promise<InquiryActor | "impersonated" | null> {
  const s = await (await authPort()).session()
  if (!s.ok || !s.data) return null
  if (s.data.impersonatedBy) return "impersonated"
  const [row] = await (await database()).select({ id: user.id, role: user.role, email: user.email, emailVerified: user.emailVerified, banned: user.banned }).from(user).where(eq(user.id, s.data.userId)).limit(1)
  // 운영자 메일이 없으면(문의 창구가 꺼진 상태) 「소유자」는 아무도 아니다 — 관리자 역할은 그대로 판정한다. 지난 문의의 보유 기간을 바꾸는 일은 창구와 별개다
  return row ? actorFromUser(row, inquiryOwnerEmail() ?? "") : null
}

const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() !== "" && v.length <= max ? v.trim() : null)

/** 입력: { reference, reason? }(+ to). 모양이 틀리면 invalid_input — 서비스는 부르지 않는다 */
function parse(input: unknown, needsKind: boolean): { reference: string; to: string; reason?: string } | null {
  if (typeof input !== "object" || input === null) return null
  const i = input as Record<string, unknown>
  const reference = text(i.reference, 64)
  const to = needsKind ? text(i.to, 32) : "complaint"
  if (!reference || !to) return null
  if (i.reason === undefined) return { reference, to }
  const reason = text(i.reason, 500)
  return reason ? { reference, to, reason } : null
}

/** 문의 종류를 바꾼다(접수 번호 reference, 새 종류 to). 보유 기간이 접수일 기준으로 다시 정해지고 admin_actions 에 한 줄이 남는다 */
export async function reclassifyInquiry(input: unknown) {
  const p = parse(input, true)
  if (!p) return invalidInput
  const who = await actor()
  if (who === "impersonated") return impersonationBlocked()
  if (!who) return signInRequired()
  return (await inquiry()).reclassify(p.reference, p.to as InquiryKind, who, p.reason ? { reason: p.reason } : {})
}

/** 불만 문의로 올린다(관리자만 — 서비스가 판정) */
export async function markInquiryAsComplaint(input: unknown) {
  const p = parse(input, false)
  if (!p) return invalidInput
  const who = await actor()
  if (who === "impersonated") return impersonationBlocked()
  if (!who) return signInRequired()
  return (await inquiry()).markAsComplaint(p.reference, who, p.reason ? { reason: p.reason } : {})
}
