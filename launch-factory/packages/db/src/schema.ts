// 모든 표를 한곳에서 내보낸다. drizzle-kit은 src/schema/ 폴더를 통째로 읽는다(drizzle.config.ts).
// Better Auth 표는 auth-base.ts 한 파일이다(기본·2단계·조직·rate_limit). 플러그인이 기본 표에 칸을 더하므로 플러그인별 파일로 나누지 않고,
// 플러그인을 더할 때 그 파일을 통째로 다시 생성한다(Task 4 보고).
export * from "./schema/auth-base.ts"
export * from "./schema/subscriptions.ts"
export * from "./schema/webhook-events.ts"
export * from "./schema/access-logs.ts"
export * from "./schema/account-lifecycle.ts"
export * from "./schema/admin-actions.ts"
export * from "./schema/rate-limits.ts"
export * from "./schema/consents.ts"
export * from "./schema/mail.ts"
export * from "./schema/inquiries.ts"
