// launch-factory: 탈퇴 파기 확장 자리. 이 파일은 제품 것이다 — 레지스트리를 다시 받으면 덮어쓸지 묻는다.
// 템플릿은 후기·올린 파일 기능을 모두 갖고 있어 두 줄이 켜져 있다. 쓰지 않는 기능이 있으면 그 줄을 지운다.
// 각 함수는 파기 트랜잭션의 tx 를 받는다 — 하나라도 던지면 그 사람의 파기 전체가 되돌려지고 다음 Cron 에 다시 시도한다(오류는 이름만 남는다).
import type { Purger } from "@launch-factory/account-lifecycle"
import { anonymizeUserReviews } from "@launch-factory/reviews"
import { scheduleUserFilesForPurge } from "@launch-factory/storage"

/** 파기 트랜잭션 안에서 도는 함수들(user 행을 지우기 직전, 목록 순서대로) */
export const purgers: readonly Purger[] = [
  // 후기·상품 문의: 작성자 이름을 「탈퇴한 사용자」로 바꾸고 연결을 끊는다(글은 공개 콘텐츠라 남는다)
  async (tx, { userId }) => {
    await anonymizeUserReviews(tx, userId)
  },
  // 올린 파일: 장부에서 「지울 때」를 지금으로 당기고 파일 이름을 비운다(객체 삭제는 아래 afterPurge 또는 파일 파기 Cron)
  async (tx, { userId }) => {
    await scheduleUserFilesForPurge(tx, userId)
  },
]

/**
 * 파기 트랜잭션이 끝난 뒤 한 번 도는 일. 올린 파일의 객체를 바로 지운다(저장소 입출력이라 트랜잭션 밖).
 * 저장소 설정이 없으면 서비스가 아무것도 하지 않는다. 못 지운 객체는 파일 파기 Cron(/api/cron/storage)이 다시 지운다.
 */
export async function afterPurge(): Promise<void> {
  const { storage } = await import("@/lib/launch/storage")
  await (await storage()).purgeExpired()
}
