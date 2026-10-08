"use server"
// launch-factory: 인증 서버 액션. 공개 입구다 — 폼(FormData)이든 객체든 authActions 가 모양을 먼저 검사하고 포트로 넘긴다.
// 로그인한 사용자 자신에게만 작용한다(세션 쿠키). 대상 사용자 id 를 입력으로 받지 않는다.
import { authActions } from "@launch-factory/auth"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { authPort } from "@/lib/launch/auth"

const actions = async () => authActions(await authPort(), { locale: DEFAULT_LOCALE })

export async function signIn(input: unknown) {
  return (await actions()).signIn(input)
}
export async function signUp(input: unknown) {
  return (await actions()).signUp(input)
}
export async function resetPassword(input: unknown) {
  return (await actions()).resetPassword(input)
}
export async function signOut() {
  return (await actions()).signOut()
}
export async function verifyTwoFactor(input: unknown) {
  return (await actions()).verifyTwoFactor(input)
}
export async function changePassword(input: unknown) {
  return (await actions()).changePassword(input)
}
export async function changeEmail(input: unknown) {
  return (await actions()).changeEmail(input)
}
export async function sendVerificationEmail(input?: unknown) {
  return (await actions()).sendVerificationEmail(input)
}
export async function listSessions() {
  return (await actions()).listSessions()
}
export async function revokeSession(input: unknown) {
  return (await actions()).revokeSession(input)
}
export async function revokeOtherSessions() {
  return (await actions()).revokeOtherSessions()
}
export async function updatePreferences(input: unknown) {
  return (await actions()).updatePreferences(input)
}
export async function updateProfile(input: unknown) {
  return (await actions()).updateProfile(input)
}
