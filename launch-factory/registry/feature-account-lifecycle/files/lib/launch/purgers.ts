// launch-factory: 탈퇴 파기 확장 자리. 이 파일은 제품 것이다 — 레지스트리를 다시 받으면 덮어쓸지 묻는다.
// 개인 식별 칸이 있는 표(후기 작성자·올린 파일·제품이 만든 표)를 가진 기능을 함께 쓰면, 그 기능이 파기 트랜잭션 안에서 할 일을 여기에 한 줄씩 더한다.
// 각 함수는 파기 트랜잭션의 tx 를 받는다 — 하나라도 던지면 그 사람의 파기 전체가 되돌려지고 다음 Cron 에 다시 시도한다(오류는 이름만 남는다).
// 기능마다 한 줄이면 되는 짝을 패키지가 낸다: 후기 = anonymizeUserReviews(@launch-factory/reviews), 올린 파일 = scheduleUserFilesForPurge(@launch-factory/storage).
import type { Purger } from "@launch-factory/account-lifecycle"

/** 파기 트랜잭션 안에서 도는 함수들(user 행을 지우기 직전, 지금 목록 순서대로) */
export const purgers: readonly Purger[] = []

/**
 * 파기 트랜잭션이 끝난 뒤(커밋된 뒤) 한 번 도는 일. 저장소 입출력처럼 트랜잭션 안에서 하면 안 되는 일을 둔다.
 * 던져도 파기는 이미 끝났다 — 부르는 쪽(account.ts)이 이름만 로그로 남기고 넘어간다.
 */
export async function afterPurge(): Promise<void> {}
