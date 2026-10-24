// launch-factory: 관리 콘솔 조립(계획 3d) — 구획 등록부와 AdminPort. 서버 전용. 이 파일은 제품 것이다(레지스트리를 다시 받아도 덮어쓰지 않는다 — 구획을 더하는 자리다).
// 구획 하나 = lib/launch/admin-sections/<id>.ts (defineSection 선언 하나) + 아래 ADMIN_SECTIONS 에 한 줄. 구획이 켜질 부품(part)이 꺼지면(lib/launch/enabled) 사이드바에서도 직접 주소로도 사라진다.
// 콘솔(@launch-factory/admin-console)이 접근 벽(관리자 · 소유자)·사람 확인 벽(confirmed: true)·상태 검사·주소·가리기·기록을 한 곳에서 한다. 여기서는 주입물만 꽂는다:
//   identify  — 세션 + 사용자 행(lib/launch/admin-identity.ts)      limit — 읽기 요청 제한(admin:read 분당 120, 사용자·IP 별). 쓰기 제한은 서버 액션 adminAct 한 곳(분당 30)이 센다 — 여기서 한 번 더 세지 않는다
//   audit     — 표·상세를 읽으면 access_logs 한 줄, 행동을 하면 admin_actions 한 줄(폼 값은 싣지 않는다. 읽기 기록이 실패하면 읽기도 거부)
//   mask      — 연락처 열은 일부만 보이게, 나가는 모든 문구는 이메일·전화·토큰 모양을 가린다
//   onError   — 구획이 던진 오류는 서버 로그에 오류 이름과 위치만(글·개인정보 없음). 화면에는 일반 문구만 나간다
import { headers } from "next/headers"
import { createAdminConsole, hasServerSearch, pageSizeOf, type AdminMasker, type AdminPort, type AdminSection } from "@launch-factory/admin-console"
import { adminActions, insertAccessLog } from "@launch-factory/db"
import { maskPii } from "@launch-factory/security/pii"
import { clientIp, ipAddressFromEnv } from "@launch-factory/security/rate-limit"
import { adminMessages } from "@/content/copy.admin-messages.en"
import ordersSection from "@/lib/launch/admin-sections/orders"
import stockSection from "@/lib/launch/admin-sections/stock"
import { identify } from "@/lib/launch/admin-identity"
import bookingsSection from "@/lib/launch/admin-sections/bookings"
import inquiriesSection from "@/lib/launch/admin-sections/inquiries"
import newsletterSection from "@/lib/launch/admin-sections/newsletter"
import reviewsSection from "@/lib/launch/admin-sections/reviews"
import usersSection from "@/lib/launch/admin-sections/users"
import { database } from "@/lib/launch/db"
import { hasPart } from "@/lib/launch/enabled"
import { guardAction } from "@/lib/launch/security"

/**
 * 등록한 구획(순서가 사이드바 순서). 구획 모듈(lib/launch/admin-sections/<id>.ts)에서 구획을 가져와 배열에 한 줄씩 더한다:
 *   ADMIN_SECTIONS = [ordersSection, bookingsSection]
 * 부품 이름(part)은 features/outcomes.yaml parts 의 이름과 같아야 한다 — 시험이 대조한다.
 */
export const ADMIN_SECTIONS: readonly AdminSection[] = [ordersSection, stockSection, bookingsSection, inquiriesSection, reviewsSection, newsletterSection, usersSection]

const MASK = "***"

/** 연락처를 알아볼 만큼만 보인다: 메일 k***@example.com · 전화 ***-1234 · 그 밖(주소)은 앞 낱말만 */
export function maskContact(value: string): string {
  const v = value.trim()
  if (v === "") return v
  const at = v.indexOf("@")
  if (at > 0) return `${[...v][0]}${MASK}${v.slice(at)}`
  const digits = v.replace(/\D/g, "")
  if (digits.length >= 8 && /^[+\d\s().-]+$/.test(v)) return `${MASK}-${digits.slice(-4)}`
  // 낱말이 하나뿐이면 이름일 수 있다("홍길동") — 첫 글자만 보인다. 낱말이 여럿이면(주소) 앞 낱말만 보인다
  const words = v.split(/\s+/)
  return words.length === 1 ? `${Array.from(v)[0]}${MASK}` : `${words[0]} ${MASK}`
}

const masker: AdminMasker = { contact: maskContact, text: maskPii }

async function requester(): Promise<{ headers: Headers; ip: string }> {
  const h = new Headers(await headers())
  return { headers: h, ip: clientIp(h, ipAddressFromEnv(process.env)) ?? "unknown" }
}

/** 이 구획의 검색을 서버가 가린 연락처 칸까지 맞추는가(구획의 serverSearch 선언) — 목록 쪽이 받은 행을 다시 거르지 않게 한다 */
export const searchesOnServer = (id: string): boolean => hasServerSearch(ADMIN_SECTIONS, id)

/** 이 구획의 한 쪽 줄 수(구획의 pageSize 선언, 없으면 100) — 쪽 이동이 몇 쪽까지 있는지 셀 때 쓴다 */
export const pageSizeFor = (id: string): number => pageSizeOf(ADMIN_SECTIONS, id)

let cached: AdminPort | undefined

/** 등록한 구획으로 만든 콘솔(요청마다 새로 만들지 않는다 — 신원은 포트 호출마다 한 번 읽는다) */
export function adminConsole(): AdminPort {
  return (cached ??= createAdminConsole({
    sections: ADMIN_SECTIONS,
    identify,
    messages: adminMessages,
    enabledParts: [...new Set(ADMIN_SECTIONS.map((s) => s.part))].filter(hasPart),
    mask: masker,
    limit: async (kind, actor) => (kind === "read" ? guardAction("admin:read", { headers: (await requester()).headers, userId: actor.userId }) : null),
    audit: {
      async access(r) {
        const { ip } = await requester()
        await insertAccessLog(await database(), { actorId: r.actorId, ip, subjects: r.ids, action: "view", target: `admin/${r.section}/${r.kind}`, occurredAt: r.at.toISOString(), download: false })
      },
      async action(r) {
        const { ip } = await requester()
        await (await database()).insert(adminActions).values({ adminUserId: r.actorId, action: `${r.section}.${r.action}`, ipAddress: ip, meta: { section: r.section, recordId: r.id, ok: r.ok, via: r.via, ...(r.code ? { code: r.code } : {}) }, occurredAt: r.at })
      },
    },
    onError: (error, where) => console.error(`[admin] ${where}: ${error instanceof Error ? error.name : "error"}`),
  }))
}
