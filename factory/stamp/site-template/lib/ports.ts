// 기능 포트 자리(P3-3 Task 9) — 지금은 목(adapter-mock)이다. 로그인·결제·알림·파일·동의를 받는 블록은 필요한 메서드만 골라 쓴다.
// 실제 어댑터(launch-factory)를 붙일 때 이 함수 하나만 바꾼다. 포트는 함수 묶음이라 서버 컴포넌트에서 넘길 수 없다 — 클라이언트 잎에서 만든다.
// 청약철회 동의(결제)·만 14세 확인(가입)·승인 행동의 확인 입력(해지·요금제 변경·탈퇴·이메일 변경·수신 동의 변경 …, P3-7 AXC)은 목도 필수로 요구해, 그 체크·확인을 빠뜨린 블록을 화면에서 잡는다.
// 동의 상태(consent·setConsent — consent 블록이 받는다)는 계측 포트의 것이다. track 은 여기 넣지 않는다(잎이 withAttribution 으로 감싼 것을 넘긴다).
import { mockAnalytics, mockAuth, mockBilling, mockNotify, mockStorage } from "@/components/contract/adapter-mock"
import build from "@/lib/build.json"

export function makePorts() {
  const { consent, setConsent, identify } = mockAnalytics("")
  return { ...mockStorage(""), ...mockNotify("", { requireConfirmation: true }), ...mockBilling("", { requireWithdrawalConsent: true, requireConfirmation: true }), ...mockAuth("", { requireAgeOver14: (build as { requireAgeOver14?: boolean }).requireAgeOver14 !== false, requireConfirmation: true }), consent, setConsent, identify }
}
