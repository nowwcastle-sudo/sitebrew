"use server"
// launch-factory: 탈퇴·내려받기 서버 액션. 로그인한 본인에게만 작용한다(세션에서 읽는다 — 사용자 id 를 입력으로 받지 않는다).
// deleteAccount 는 구독 해지가 실패하면 탈퇴를 기록하지 않는다(요금이 계속 나가는 채로 계정만 지우지 않는다). 성공하면 세션이 모두 끊기고 유예 끝(graceUntil)을 알려 준다.
// 두 액션 모두 사람의 확인 입력(`confirmed: true`) 없이는 실행하지 않는다(LFAX M03). 탈퇴는 화면이 받는 이메일 주소 입력(`confirmEmail`)도 서버가 다시 본다.
import { authActions } from "@launch-factory/auth"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { accountPort } from "@/lib/launch/account"

const actions = async () => authActions(await accountPort(), { locale: DEFAULT_LOCALE })

/** 입력: { confirmed: true, confirmEmail: <지금 로그인한 이메일 주소 그대로> } — 이메일이 없는 계정은 confirmed 만 */
export async function deleteAccount(input?: { confirmed?: true; confirmEmail?: string }) {
  // 타입은 블록 props 모양(계약 포트 입력 — 확인 칸 선택). 확인 칸 검사는 런타임(authActions → requireConfirmation)이 한다
  return (await actions()).deleteAccount(input)
}

/** 내 정보 내려받기(프로필·로그인 방법·세션·구독·동의 이력·마케팅 수신·조직 멤버십·진행 중 탈퇴). 비밀번호 해시·세션 토큰·2단계 비밀은 싣지 않는다. 입력: { confirmed: true } */
export async function exportMyData(input?: { confirmed?: true }) {
  return (await actions()).exportMyData(input)
}
