// 탈퇴한 사용자의 글 익명화 — 서비스를 만들지 않고도 부를 수 있게 따로 둔다(파기 Cron 의 Purger 가 부른다).
// 작성자 이름을 「탈퇴한 사용자」(글의 언어대로)로 바꾸고 사용자 연결(user_id)을 끊는다. 글 자체는 공개 콘텐츠라 남는다.
import { anonymizeReviewsOf, type Database } from "@launch-factory/db"
import { DEFAULT_LOCALE, LOCALES, t } from "@launch-factory/i18n"

/**
 * 바꾼 글의 수를 돌려준다. 다시 불러도 결과가 같다(이미 끊긴 글은 user_id 가 없어 걸리지 않는다).
 * `db` 에 파기 트랜잭션의 tx 를 넘기면 그 트랜잭션 안에서 돈다 — runPurge 의 purgers: `async (tx, { userId }) => { await anonymizeUserReviews(tx, userId) }`.
 */
export async function anonymizeUserReviews(db: Database, userId: string, at: Date = new Date()): Promise<number> {
  let changed = 0
  for (const locale of LOCALES) changed += await anonymizeReviewsOf(db, userId, { authorName: t(locale, "reviews.deletedUser"), locale, at })
  // 모르는 언어 값이 든 글이 있어도 연결은 끊는다
  changed += await anonymizeReviewsOf(db, userId, { authorName: t(DEFAULT_LOCALE, "reviews.deletedUser"), at })
  return changed
}
