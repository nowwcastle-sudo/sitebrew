// 타입 검사(npm run typecheck 가 돈다 — P3-6 AUTHBLK): auth/new-password 의 한 칸·두 칸 판 울타리.
// 틀린 모양은 @ts-expect-error 로 적었다 — 타입이 느슨해지면 typecheck 가 TS2578 로 실패한다.
// auth-blocks-p36.test.mjs 가 이 파일에서 @ts-expect-error 줄을 지운 사본을 tsc 로 돌려, 오류가 바로 그 줄들에서 나는지 본다(음성 대조).
import type { AuthNewPasswordCopy, AuthNewPasswordProps } from "@/registry/factory/blocks/auth/new-password"

declare const copy: AuthNewPasswordCopy
declare const reset: AuthNewPasswordProps["resetPassword"]

const confirm = { label: "한 번 더", marker: "(필수)" }

// 두 칸(기본 — confirmField 생략): 한 번 더 문구와 불일치 문구가 있어야 한다
export const twoFields: AuthNewPasswordProps = { copy: { ...copy, confirm, errors: { ...copy.errors, mismatch: "달라요" } }, resetPassword: reset }
export const twoFieldsExplicit: AuthNewPasswordProps = { confirmField: true, copy: { ...copy, confirm, errors: { ...copy.errors, mismatch: "달라요" } }, resetPassword: reset }
// @ts-expect-error — 두 칸 판은 한 번 더 칸 문구(confirm)가 필요하다
export const twoFieldsNoConfirm: AuthNewPasswordProps = { copy: { ...copy, errors: { ...copy.errors, mismatch: "달라요" } }, resetPassword: reset }
// @ts-expect-error — 두 칸 판은 불일치 문구(errors.mismatch)가 필요하다
export const twoFieldsNoMismatch: AuthNewPasswordProps = { copy: { ...copy, confirm }, resetPassword: reset }

// 한 칸(confirmField: false): 한 번 더 칸·불일치 문구는 필요 없고, 비밀번호 보기 토글 이름(newPassword.show)이 필요하다
export const oneField: AuthNewPasswordProps = { confirmField: false, copy: { ...copy, newPassword: { ...copy.newPassword, show: "비밀번호 보기" } }, resetPassword: reset }
// @ts-expect-error — 한 칸 판은 보기 토글 이름(newPassword.show)이 필수다(한 번 더 칸이 없는 대신 눈으로 확인한다)
export const oneFieldNoToggle: AuthNewPasswordProps = { confirmField: false, copy: { ...copy, newPassword: { label: "a", marker: "b", hint: "c" } }, resetPassword: reset }
