// 주소의 `?plan=<요금제 id>` 를 읽는 한 곳(LFADB E01). 요금표의 단추가 로그아웃은 가입 주소에, 로그인은 결제 주소에 실어 보낸 값이다.
// 쓰는 곳은 서버 쪽(가입·결제 화면)이고, 모양이 맞지 않으면 없는 값으로 본다 — 요금제 id 는 어댑터가 가진 목록과 대조되므로 여기서는 이상한 글자만 거른다.
const PLAN_ID = /^[A-Za-z0-9_.-]{1,64}$/

export function planParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && PLAN_ID.test(value) ? value : undefined
}

/** 지금 쓰는 요금제로 칠 구독 상태 — 해지 예약(canceled)·끝남(expired)·없음은 쓰는 요금제가 아니다(해지 예약은 기간 끝까지 쓰지만 요금표에서는 다시 고를 수 있어야 한다) */
export const IN_USE_STATUSES = ["trialing", "active", "past_due", "paused"] as const

/**
 * 이 제품이 내는 결제 주기(E03 — 운영자 결정 2026-10-07: 월 요금제만, 연은 첫 달 전환을 본 뒤). 요금표·결제 화면이 쓰는 요금제 목록은 이것으로 거른다 —
 * 요금제 설정(PLANS)에 연 가격이 들어 있어도 화면에는 나오지 않는다. 연을 열 때 이 한 줄만 고친다(그때 블록의 연 토글 문구도 같이 채운다).
 */
export const OFFERED_INTERVALS = ["month"] as const
export const onlyOffered = <P extends { interval: string }>(plans: readonly P[]): P[] => plans.filter((p) => (OFFERED_INTERVALS as readonly string[]).includes(p.interval))
