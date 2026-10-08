// mock 모드 세션 장면(LFRUNNER · web-factory G1 계약 — docs/qa/p3-6-uxgates.md §2). 순수 함수만 둔다(서버·Chrome 이 필요 없다).
// web-factory 의 모든 CDP 관문은 `--session <장면>` 을 받아 쿠키 `wf_session` 을 심는다. LF_MODE=mock 이고 LF_MOCK_SCENES=1 일 때만 이 쿠키가 세션·구독을 정한다 —
// live·장면 변수 없는 mock 에서는 이 파일을 아예 부르지 않는다(lib/ports.ts 가 모드와 변수를 먼저 본다). 누구나 쿠키로 세션을 위조하면 안 되기 때문이다.
//   signed-out | signed-in | signed-in:sub=<상태> | signed-in:unverified (뒤 둘은 이어 쓴다: signed-in:unverified:sub=trialing)
// 구독 상태 표는 adapter-mock.ts 의 MOCK_SUBS + MOCK_SUB_SCENARIOS 와 같아야 한다(template.test 가 소스와 대조한다).

export const SCENE_COOKIE = "wf_session"
export const SCENE_SUBS = ["none", "trialing", "active", "past_due", "paused", "canceled", "expired", "pending-price-change"] as const
export type SceneSub = (typeof SCENE_SUBS)[number]

export interface MockScene {
  signedIn: boolean
  /** 로그인 장면의 이메일 확인 여부(signed-in = true · :unverified = false). 로그아웃이면 의미 없다 */
  verified: boolean
  /** 장면이 정한 구독 상태. null = 앱 기본값(LF_MOCK_SUB 또는 active) */
  sub: SceneSub | null
  /** 정규화한 장면 문자열 — `<html data-wf-session>` 에 달리고 쿠키 값의 기준이다 */
  canonical: string
}

const SIGNED_OUT: MockScene = { signedIn: false, verified: false, sub: null, canonical: "signed-out" }

/**
 * 요청에 실린 장면(쿠키) + 서버 모드 → 이 요청이 쓸 장면.
 * 기본(scenesOnly=false): 쿠키가 없으면 null — 기존 mock 동작(프로세스 하나의 목 포트, 화면에서 한 로그인이 요청 사이에 이어진다. 손으로 mock 을 쓸 때 필요하다).
 * LF_MOCK_SCENES=1(scenesOnly=true — 화면 관문 러너가 켠다): web-factory 계약대로 「쿠키 없음 = 로그아웃」이다. 관문이 연 화면에서 일어난 로그인(양식 제출)이
 * 다음 요청의 「로그아웃 장면」을 로그인으로 바꾸는 오염(첫 전체 실행에서 실제로 났다 — 로그아웃 /account 가 목 사용자 이름을 그렸다)을 막는다.
 */
export function effectiveScene(fromCookie: MockScene | null, scenesOnly: boolean): MockScene | null {
  return fromCookie ?? (scenesOnly ? SIGNED_OUT : null)
}

/**
 * 쿠키 값(encodeURIComponent 된 장면 문자열) → 장면.
 * 쿠키가 없으면(undefined·빈 값) null — 장면 없음, 기존 mock 동작(프로세스 하나의 목 포트)을 그대로 쓴다.
 * 모르는 장면(오타·`sub=gold`)은 로그아웃으로 본다 — 위조·오타가 로그인 화면을 만들지 않게(web-factory 도구는 이런 값을 인자 오류로 거절한다).
 */
export function parseMockScene(raw: string | null | undefined): MockScene | null {
  if (raw === undefined || raw === null || raw === "") return null
  let text: string
  try {
    text = decodeURIComponent(raw).trim()
  } catch {
    return SIGNED_OUT
  }
  const [head, ...mods] = text.split(":")
  if (head === "signed-out") return SIGNED_OUT
  if (head !== "signed-in") return SIGNED_OUT
  let sub: SceneSub | null = null
  let verified = true
  for (const m of mods) {
    if (m === "unverified") {
      verified = false
      continue
    }
    const mm = /^sub=(.+)$/.exec(m)
    if (mm && (SCENE_SUBS as readonly string[]).includes(mm[1]!)) {
      sub = mm[1] as SceneSub
      continue
    }
    return SIGNED_OUT
  }
  const canonical = ["signed-in", ...(verified ? [] : ["unverified"]), ...(sub ? [`sub=${sub}`] : [])].join(":")
  return { signedIn: true, verified, sub, canonical }
}
