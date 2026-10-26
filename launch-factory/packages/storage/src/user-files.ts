// 탈퇴한 사용자의 파일 정리 — 서비스를 만들지 않고도 부를 수 있게 따로 둔다(파기 Cron 의 Purger 가 부른다).
// 장부에서 「지울 때가 됐다」고 적기만 한다(객체 삭제는 저장소 입출력이라 트랜잭션 밖 — purgeExpired 가 한다).
import { scheduleUserFilesPurge, type Database } from "@launch-factory/db"

/**
 * 바꾼 장부 행의 수를 돌려준다. `db` 에 파기 트랜잭션의 tx 를 넘기면 그 트랜잭션 안에서 돈다 —
 * runPurge 의 purgers: `async (tx, { userId }) => { await scheduleUserFilesForPurge(tx, userId) }`. 다시 불러도 결과가 같다.
 */
export function scheduleUserFilesForPurge(db: Database, userId: string, at: Date = new Date()): Promise<number> {
  return scheduleUserFilesPurge(db, userId, at)
}
