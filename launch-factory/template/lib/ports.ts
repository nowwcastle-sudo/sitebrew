// 포트 조립(v0 Task 10). 블록은 공급자를 모른다 — 이 파일이 모드에 따라 포트 뒤를 바꾼다.
//   LF_MODE=mock → web-factory 목 어댑터(components/contract/adapter-mock, 키 없이 켜진다)
//   LF_MODE=live → @launch-factory/* 어댑터(lib/ports.live.ts — 기능 번들 lib/launch/* 를 부른다)
// 두 모드의 반환 모양이 같아서(ProductPorts) 페이지·블록 코드는 같다. 서버 전용이다 — 포트는 함수 묶음이라 서버 컴포넌트에서 클라이언트
// 블록으로 넘길 수 없으므로 app/actions/product.ts 의 서버 액션이 이것을 부른다.
import { cookies } from "next/headers"
import { mockNotify } from "@/components/contract/adapter-mock"
import type { ActionResult } from "@/components/contract/block-contract"
import type { AuthPort, BillingPort, NotifyPort, Subscription } from "@/components/contract/ports"
import { env } from "@/lib/launch/env"
import { buildMockPorts } from "@/lib/mock-ports"
import { effectiveScene, parseMockScene, SCENE_COOKIE, type MockScene } from "@/lib/mock-scene"

export type ProductAuth = Pick<AuthPort, "methods" | "session" | "signIn" | "signUp" | "signOut" | "verifyTwoFactor" | "requestPasswordReset"> & {
  /** 재설정 메일 링크의 토큰으로 새 비밀번호를 정한다(계약 밖 — 어댑터의 확장 메서드). 로그인이 없어도 부른다 */
  resetPassword(input: { token: string; newPassword: string }): Promise<ActionResult<Record<string, never>>>
  /** 지금 로그인한 계정의 주소로 확인 메일을 다시 보낸다(가입 직후 안내의 「다시 보내기」). 계약에는 선택 메서드라 여기서 필수로 올린다 */
  sendVerificationEmail: NonNullable<AuthPort["sendVerificationEmail"]>
}
export type ProductBilling = Pick<BillingPort, "plans" | "subscription" | "checkout" | "changePlan" | "cancel" | "resume" | "updatePaymentMethod" | "applyRetentionOffer" | "acceptPriceChange"> & {
  portal: NonNullable<BillingPort["portal"]>
  /** 결제 창이 끝난 직후(`/billing/return?_ptxn=`) 공급자 거래를 읽어 구독을 바로 맞춘다(웹훅이 늦어도 화면이 맞게). 로그인한 본인의 거래만 받는다 */
  syncCheckout(input: { transactionId: string }): Promise<ActionResult<Subscription & { receiptEmail?: string }>>
}
export interface ProductPorts {
  auth: ProductAuth
  billing: ProductBilling
}

export const productMode = () => env().LF_MODE

const globals = globalThis as { __lfMockPorts?: ProductPorts; __lfMockNotify?: Required<NotifyPort>; __lfMockName?: string }

/**
 * mock 전용(LFRUNNER · web-factory G1): 이 요청이 실은 세션 장면(쿠키 wf_session). 쿠키가 없거나 요청 밖(예약 작업 등)이면 null.
 * live 에서는 쿠키를 읽지 않는다 — 운영 빌드가 쿠키로 세션을 위조당하지 않게 모드를 먼저 본다.
 * mock 에서도 LF_MOCK_SCENES=1(화면 관문 러너가 켠다)일 때만 읽는다 — 그 변수가 없는 mock 서버는 쿠키 하나로 로그인·유료 구독자가 되지 않는다(최종 라운드 E1).
 */
export async function currentMockScene(): Promise<MockScene | null> {
  if (productMode() !== "mock") return null
  if (process.env.LF_MOCK_SCENES !== "1") return null
  try {
    return parseMockScene((await cookies()).get(SCENE_COOKIE)?.value)
  } catch {
    return null
  }
}

const mockInput = (scene: MockScene | null) => ({ scene, defaultSub: process.env.LF_MOCK_SUB || "active", getName: () => globals.__lfMockName })

/**
 * 목 포트. LF_MOCK_SCENES=1 이 아니면 서버 프로세스에 하나다(로그인 상태가 요청 사이에 이어진다 — 방문자끼리 세션을 나눠 쓰므로 mock 은 개발 전용이다.
 * 운영 실행에서는 packages/env 의 loadAppEnv 가 mock 을 막는다). 켜져 있고 쿠키가 있으면 요청마다 그 장면으로 새로 만든다(장면 시험이 서로 오염되지 않는다).
 * 가입·결제는 청약철회·만 14세 체크를 빠뜨리면 거절한다 — live 와 같다.
 */
async function mockPorts(): Promise<ProductPorts> {
  const scene = effectiveScene(await currentMockScene(), process.env.LF_MOCK_SCENES === "1")
  if (scene) return buildMockPorts(mockInput(scene))
  return (globals.__lfMockPorts ??= buildMockPorts(mockInput(null)))
}

/**
 * mock 전용(LFACCT): 계정 화면이 쓰는 목 메서드. 목 인증 포트는 비밀번호·이메일 바꾸기·기기·탈퇴·내려받기를 이미 갖고 있어 같은 객체를 돌려준다(ProductAuth 가 좁혀 둔 타입만 넓힌다).
 * 수신 동의는 목 알림 포트 하나를 프로세스에 둔다. 이름은 globals.__lfMockName 에 둔다(세션이 덮어 보인다).
 */
export async function mockAccountPorts() {
  return {
    auth: (await mockPorts()).auth as unknown as Required<AuthPort>,
    notify: (globals.__lfMockNotify ??= mockNotify("")),
    setName(name: string) {
      globals.__lfMockName = name
      return name
    },
  }
}

export async function ports(): Promise<ProductPorts> {
  if (productMode() === "mock") return await mockPorts()
  return (await import("@/lib/ports.live")).livePorts()
}
