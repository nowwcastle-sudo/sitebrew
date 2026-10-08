// 블록의 읽기 오류(ReadError — web-factory v0.0.10 `_shared/port-read`)는 계약 값 `signInRequired` 로 「다시 불러오기」 대신 로그인 링크를 고른다(B04 · ReadErrorProvider — components/product/read-error-sign-in.tsx).
// 우리 기계 값은 `sign_in_required`(LFAX — packages/security/src/action.ts)라 이름이 다르다. 블록이 읽는 읽기 액션(app/actions/product.ts 의 subscription)에서만 계약 이름으로 바꾼다.
// 쓰기 액션과 서버가 미리 그리는 로그인 안내(components/product/sign-in-required.tsx)는 `sign_in_required` 그대로다. 순수 함수 — 성공·다른 실패는 건드리지 않는다.
export const forReadBlock = <R extends { ok: boolean }>(r: R): R => (!r.ok && (r as { code?: string }).code === "sign_in_required" ? { ...r, code: "signInRequired" } : r)
