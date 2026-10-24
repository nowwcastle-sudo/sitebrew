// 공개 면: 콘솔 만들기 · 구획 선언 · 거절 값, 그리고 타입. 요청 파서·상수는 내보내지 않는다 —
// 서버 액션은 받은 값(unknown)을 그대로 포트에 넘기고, 모양 검사는 콘솔이 한다.
export { createAdminConsole } from "./console.ts"
export { defineSection, hasServerSearch, pageSizeOf, refuse } from "./section.ts"
export type * from "./port.ts"
export type * from "./section.ts"
export type * from "./options.ts"
